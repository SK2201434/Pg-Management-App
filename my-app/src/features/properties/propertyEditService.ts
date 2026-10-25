import { deleteField, doc, GeoPoint, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore';

import { getFirestoreDb } from '@/config/firebase';
import { syncListing } from '@/features/discovery/discoveryService';
import { getPhotoErrorMessage, uploadPropertyPhoto } from '@/features/properties/photoUpload';
import { formFromProperty, isSavedPhoto, type EditablePhotos, type PropertyEditData } from '@/features/properties/propertyEdit';
import { locationKeys, type LocationParts } from '@/features/properties/propertyLocation';
import { assertLocationFree, DuplicateLocationError, queueLocationMove } from '@/features/properties/propertyLocationService';
import { PropertyRequestError, toRequestError } from '@/features/properties/propertyService';
import { propertyFields, type PhotoDraft, type PropertyForm } from '@/features/properties/propertySetup';
import type { StoredImage } from '@/features/storage/imageStorage';

const WRITE_TIMEOUT_MS = 25_000;

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new PropertyRequestError('unavailable', 'deadline-exceeded')), WRITE_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * One of the signed-in owner's own properties, ready to edit. A property that belongs to someone
 * else is refused here (permission-denied), and the Security Rules refuse the same write again:
 * only the owner of a property can update it, and `ownerUid` can never be changed.
 */
export async function fetchPropertyForEdit(propertyId: string, ownerUid: string): Promise<PropertyEditData> {
  let snap;
  try {
    snap = await getDoc(doc(getFirestoreDb(), 'properties', propertyId));
  } catch (error) {
    throw toRequestError(error);
  }
  if (!snap.exists()) throw new PropertyRequestError('not-found', 'not-found');
  const data = snap.data() as Record<string, unknown>;
  if (data.ownerUid !== ownerUid) throw new PropertyRequestError('permission-denied', 'permission-denied');
  return formFromProperty(data);
}

export type EditProgress = { message: string; fraction?: number };
export type EditResult = { photosFailed: number; photoError?: string };

/**
 * Saves an edit: uploads any new photos (a failed one is reported and left out, never saved),
 * then updates the property and moves its location locks in ONE batch, so a rejected save changes
 * nothing. Afterwards the public listing is refreshed (best effort).
 */
export async function savePropertyEdit(args: {
  propertyId: string;
  ownerUid: string;
  form: PropertyForm;
  original: PropertyEditData;
  report: (p: EditProgress) => void;
}): Promise<EditResult> {
  const { propertyId, ownerUid, form, original, report } = args;
  const db = getFirestoreDb();
  const placeOf = (f: PropertyForm): LocationParts => ({ location: f.location.trim(), city: f.city.trim(), state: f.state.trim(), postalCode: f.postalCode.trim(), geo: f.geo });
  const before = placeOf(original.form);
  const after = placeOf(form);

  try {
    // One property per location: only checked when the address or coordinates changed.
    const moved = JSON.stringify(locationKeys(before)) !== JSON.stringify(locationKeys(after));
    if (moved) await assertLocationFree(after, propertyId);

    let failures = 0;
    let photoError: string | undefined;
    const total = [...form.photos, ...form.roomPhotos].filter((d) => !isSavedPhoto(d)).length;
    let done = 0;
    const resolve = async (drafts: PhotoDraft[], saved: StoredImage[], room: boolean): Promise<StoredImage[]> => {
      const out: StoredImage[] = [];
      for (const draft of drafts) {
        if (isSavedPhoto(draft)) {
          const kept = saved.find((s) => s.url === draft.uri);
          if (kept) out.push(kept);
          continue;
        }
        const message = `Uploading photo ${done + 1} of ${total}…`;
        report({ message, fraction: done / total });
        try {
          out.push(await uploadPropertyPhoto(propertyId, draft, done, (f) => report({ message, fraction: (done + f) / total }), room));
        } catch (error) {
          failures += 1;
          photoError ??= getPhotoErrorMessage(error);
        }
        done += 1;
      }
      return out;
    };
    const photos = await resolve(form.photos, original.stored.photos, false);
    const roomPhotos = await resolve(form.roomPhotos, original.stored.roomPhotos, true);

    report({ message: 'Saving…' });
    const batch = writeBatch(db);
    const optional = propertyFields(form);
    batch.update(doc(db, 'properties', propertyId), {
      ...optional,
      ...(optional.description === undefined ? { description: deleteField() } : {}),
      amenities: form.amenities,
      ...(form.geo ? { geo: new GeoPoint(form.geo.latitude, form.geo.longitude) } : {}),
      photos,
      roomPhotos,
      updatedAt: serverTimestamp(),
    });
    if (moved) await queueLocationMove(batch, before, after, propertyId);
    await withTimeout(batch.commit());

    // The public listing mirrors name, address, photos and amenities (best effort).
    void syncListing(propertyId, ownerUid);
    return { photosFailed: failures, photoError };
  } catch (error) {
    if (error instanceof DuplicateLocationError) throw new PropertyRequestError('duplicate-location', undefined, { cause: error });
    if (error instanceof PropertyRequestError) throw error;
    // Another owner's claim of the location may have landed a moment ago.
    if ((error as { code?: string } | null)?.code?.endsWith('permission-denied')) {
      try {
        await assertLocationFree(after, propertyId);
      } catch (inner) {
        if (inner instanceof DuplicateLocationError) throw new PropertyRequestError('duplicate-location', undefined, { cause: inner });
      }
    }
    throw toRequestError(error);
  }
}

export type { EditablePhotos };
