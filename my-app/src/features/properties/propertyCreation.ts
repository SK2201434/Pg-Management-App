import {
  collection,
  deleteField,
  doc,
  GeoPoint,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';

import { cloudinaryConfigPresence } from '@/config/cloudinary';
import { getFirestoreDb } from '@/config/firebase';
import { ImageUploadError } from '@/features/storage/imageStorage';
import { describeCause, logUploadFailure } from '@/features/storage/uploadDiagnostics';
import {
  deleteStoredPhoto,
  getPhotoErrorMessage,
  uploadPropertyPhoto,
  type StoredPhoto,
} from '@/features/properties/photoUpload';
import { addLocationLocks, assertLocationFree, DuplicateLocationError } from '@/features/properties/propertyLocationService';
import { completeInviteReferral } from '@/features/referral/referralService';
import { PropertyRequestError } from '@/features/properties/propertyService';
import {
  buildRoomWrites,
  chunkRoomWrites,
  orderedPhotos,
  propertyFields,
  type PhotoDraft,
  type PropertyForm,
} from '@/features/properties/propertySetup';

const WRITE_TIMEOUT_MS = 25_000;

export type SaveProgress = { message: string; fraction?: number };

export type SaveResult = {
  propertyId: string;
  photosUploaded: number;
  photosFailed: number;
  /** Why photos failed, when they did. The property itself was saved. */
  photoError?: string;
};

/** The SDK queues writes while offline and never rejects; surface that as an error instead. */
function withTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new PropertyRequestError('unavailable', 'deadline-exceeded')),
      WRITE_TIMEOUT_MS,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Development-only trace of one save step: name, outcome and timing, plus the Firebase error code
 * on failure. It names the step that was denied, which the user-facing message does not. It never
 * logs field values, only ids and counts, and is silent in release builds.
 */
async function traced<T>(step: string, run: () => Promise<T>, detail?: Record<string, unknown>): Promise<T> {
  if (!__DEV__) return run();
  const started = Date.now();
  console.log(`[property-save] ${step} → start`, detail ?? '');
  try {
    const result = await run();
    console.log(`[property-save] ${step} → ok (${Date.now() - started}ms)`);
    return result;
  } catch (error) {
    const code = (error as { code?: unknown } | null)?.code;
    console.warn(`[property-save] ${step} → FAILED (${Date.now() - started}ms) code=${typeof code === 'string' ? code : 'none'}`, detail ?? '');
    throw error;
  }
}

function asRequestError(error: unknown): PropertyRequestError {
  if (error instanceof PropertyRequestError) return error;
  if (error instanceof DuplicateLocationError) return new PropertyRequestError('duplicate-location', undefined, { cause: error });
  const raw = (error as { code?: unknown } | null)?.code;
  const code = typeof raw === 'string' ? raw.replace(/^firestore\//, '') : undefined;
  const kind =
    code === 'permission-denied' ? 'permission-denied' : code === 'unavailable' ? 'unavailable' : 'unknown';
  return new PropertyRequestError(kind, code, { cause: error });
}

/**
 * One Add Property save. Hold on to the session across retries: it remembers the property id,
 * which rooms/beds and photos already exist, so running it again after a failure resumes instead
 * of duplicating.
 *
 * Order (Spark plan, no Cloud Functions, so no single atomic write for a big property):
 *   1. create `properties/{id}` as `draft` (or `ready` straight away if there is nothing else);
 *   2. write rooms + beds in batches of <= 250 documents, a room never split from its beds, with
 *      deterministic ids, so a repeated batch overwrites itself;
 *   3. upload photos (a failure here does not stop the save);
 *   4. one update that sets the uploaded photos and flips `draft` -> `ready`.
 * A property is therefore only `ready` once its structure is complete; an interrupted save leaves
 * a visible `draft`, never a half-built property presented as finished.
 */
export class PropertySaveSession {
  readonly propertyId = doc(collection(getFirestoreDb(), 'properties')).id;
  private createAttempts = 0;
  private created = false;
  private finalized = false;
  /** roomId -> bed ids written so far, to remove what a later edit dropped. */
  private written = new Map<string, string[]>();
  private uploaded = new Map<string, StoredPhoto>();
  private photoFailures = 0;
  private photoError: string | undefined;

  constructor(private readonly ownerUid: string) {}

  async run(form: PropertyForm, report: (p: SaveProgress) => void): Promise<SaveResult> {
    try {
      return await this.execute(form, report);
    } catch (error) {
      throw asRequestError(error);
    }
  }

  private async execute(form: PropertyForm, report: (p: SaveProgress) => void): Promise<SaveResult> {
    const db = getFirestoreDb();
    const propertyRef = doc(db, 'properties', this.propertyId);
    const writes = buildRoomWrites(form);
    const needsFinalize = writes.length > 0 || form.photos.length + form.roomPhotos.length > 0;

    if (!this.created) {
      report({ message: 'Creating property…' });
      this.createAttempts += 1;
      const place = { ...propertyFields(form), geo: form.geo };
      // One property per location: refuse early with a clear message, then claim the location
      // in the same batch that creates the property (the lock can only ever be created once).
      await traced('check location is free', () => assertLocationFree(place, this.propertyId), { propertyId: this.propertyId });
      try {
        const batch = writeBatch(db);
        batch.set(propertyRef, {
          ownerUid: this.ownerUid,
          ...propertyFields(form),
          amenities: form.amenities,
          ...(form.geo ? { geo: new GeoPoint(form.geo.latitude, form.geo.longitude) } : {}),
          setupStatus: needsFinalize ? 'draft' : 'ready',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        addLocationLocks(batch, place, this.propertyId);
        // The permanent Property ID tenants join with: the property's own id, plus who owns it.
        batch.set(doc(db, 'propertyJoin', this.propertyId), { ownerUid: this.ownerUid, createdAt: serverTimestamp() });
        await traced(
          'create property + location locks + propertyJoin',
          () => withTimeout(batch.commit()),
          { propertyId: this.propertyId, ownerUid: this.ownerUid, attempt: this.createAttempts, setupStatus: needsFinalize ? 'draft' : 'ready' },
        );
      } catch (error) {
        // Another save may have claimed the location a moment ago: say so rather than "denied".
        if ((error as { code?: string } | null)?.code?.endsWith('permission-denied')) await assertLocationFree(place, this.propertyId);
        // A first attempt whose acknowledgement was lost may still have been applied; re-creating
        // an existing document is then denied, which is not a reason to stop.
        const code = (error as { code?: string } | null)?.code;
        if (!(this.createAttempts > 1 && code === 'permission-denied')) throw error;
      }
      this.created = true;
      if (!needsFinalize) {
        this.finalized = true;
        void completeInviteReferral(this.ownerUid, this.propertyId);
        return { propertyId: this.propertyId, photosUploaded: 0, photosFailed: 0 };
      }
    }

    // Rooms and beds.
    const chunks = chunkRoomWrites(writes);
    await this.removeStale(writes);

    for (let i = 0; i < chunks.length; i += 1) {
      report({ message: `Saving rooms and beds (${i + 1}/${chunks.length})…`, fraction: i / chunks.length });
      const batch = writeBatch(db);
      for (const { roomId, room, beds } of chunks[i]) {
        const roomRef = doc(db, 'properties', this.propertyId, 'rooms', roomId);
        batch.set(roomRef, {
          ownerUid: this.ownerUid,
          propertyId: this.propertyId,
          ...room,
          updatedAt: serverTimestamp(),
        });
        for (const bed of beds) {
          batch.set(doc(roomRef, 'beds', bed.id), {
            ownerUid: this.ownerUid,
            propertyId: this.propertyId,
            roomId,
            ...bed.data,
            updatedAt: serverTimestamp(),
          });
        }
      }
      await traced(
        `save rooms and beds ${i + 1}/${chunks.length}`,
        () => withTimeout(batch.commit()),
        { propertyId: this.propertyId, rooms: chunks[i].length, beds: chunks[i].reduce((n, c) => n + c.beds.length, 0) },
      );
      for (const { roomId, beds } of chunks[i]) this.written.set(roomId, beds.map((b) => b.id));
    }

    // Photos. Failures are reported, not thrown: the property is worth saving without them.
    await this.syncPhotos(form, report);

    // Finalize: store the real photo references and mark the property ready.
    report({ message: 'Finishing…' });
    const stored = (list: PhotoDraft[]) =>
      list.map((p) => this.uploaded.get(p.uri)).filter((p): p is StoredPhoto => !!p);
    const photos = stored(orderedPhotos(form));
    const roomPhotos = stored(form.roomPhotos);
    const optional = propertyFields(form);
    const clearable = ['description', 'contactName', 'contactPhone', 'city', 'postalCode'] as const;
    try {
      await traced('finalize property (photos + ready)', () => withTimeout(
        updateDoc(propertyRef, {
          ...optional,
          ...Object.fromEntries(clearable.filter((k) => !(k in optional)).map((k) => [k, deleteField()])),
          photos,
          roomPhotos,
          setupStatus: 'ready',
          updatedAt: serverTimestamp(),
        }),
      ), { propertyId: this.propertyId, photos: photos.length, roomPhotos: roomPhotos.length });
    } catch (error) {
      // Photos may already be uploaded; say so in the dev log, then fail the save as before.
      logUploadFailure(new ImageUploadError('firestore/persist', { cause: error, details: { stage: 'firestore-persistence', ...describeCause(error) } }), {
        configured: cloudinaryConfigPresence(),
      });
      throw error;
    }
    this.finalized = true;
    void completeInviteReferral(this.ownerUid, this.propertyId);

    return {
      propertyId: this.propertyId,
      photosUploaded: this.uploaded.size,
      photosFailed: this.photoFailures,
      photoError: this.photoError,
    };
  }

  get isFinalized() {
    return this.finalized;
  }

  /** Removes rooms/beds written by an earlier attempt that the form no longer contains. */
  private async removeStale(writes: ReturnType<typeof buildRoomWrites>) {
    if (this.written.size === 0) return;
    const db = getFirestoreDb();
    const batch = writeBatch(db);
    let count = 0;
    for (const [roomId, bedIds] of this.written) {
      const current = writes.find((w) => w.roomId === roomId);
      const keepBeds = new Set(current?.beds.map((b) => b.id));
      const roomRef = doc(db, 'properties', this.propertyId, 'rooms', roomId);
      for (const bedId of bedIds) {
        if (!keepBeds.has(bedId)) {
          batch.delete(doc(roomRef, 'beds', bedId));
          count += 1;
        }
      }
      if (!current) {
        batch.delete(roomRef);
        count += 1;
      }
      if (count > 400) break;
    }
    if (count > 0) {
      await traced('remove stale rooms/beds', () => withTimeout(batch.commit()), { propertyId: this.propertyId, deletes: count });
      for (const [roomId] of [...this.written]) {
        if (!writes.some((w) => w.roomId === roomId)) this.written.delete(roomId);
      }
    }
  }

  /** Uploads every property and room photo not yet uploaded, and deletes ones no longer wanted. */
  private async syncPhotos(form: PropertyForm, report: (p: SaveProgress) => void) {
    const jobs: { photo: PhotoDraft; room: boolean }[] = [
      ...form.photos.map((photo) => ({ photo, room: false })),
      ...form.roomPhotos.map((photo) => ({ photo, room: true })),
    ];
    const wanted = new Set(jobs.map((j) => j.photo.uri));
    for (const [uri, stored] of [...this.uploaded]) {
      if (!wanted.has(uri)) {
        this.uploaded.delete(uri);
        void deleteStoredPhoto(stored);
      }
    }
    this.photoFailures = 0;
    this.photoError = undefined;
    const total = jobs.length;
    for (let i = 0; i < total; i += 1) {
      const { photo, room } = jobs[i];
      if (this.uploaded.has(photo.uri)) continue;
      const message = `Uploading photo ${i + 1} of ${total}…`;
      report({ message, fraction: i / total });
      try {
        const stored = await uploadPropertyPhoto(
          this.propertyId,
          photo,
          i,
          (f) => report({ message, fraction: (i + f) / total }),
          room,
        );
        this.uploaded.set(photo.uri, stored);
      } catch (error) {
        // The user gets one friendly message; the developer gets the real cause in the Metro log.
        logUploadFailure(error, {
          index: i + 1,
          total,
          room,
          mimeType: photo.mimeType,
          fileSize: photo.fileSize,
          uri: photo.uri,
          configured: cloudinaryConfigPresence(),
        });
        this.photoFailures += 1;
        this.photoError ??= getPhotoErrorMessage(error);
      }
    }
  }
}
