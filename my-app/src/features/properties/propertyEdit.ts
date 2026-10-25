// Pure helpers for editing an existing property. No React and no Firebase.
import { emptyForm, type PhotoDraft, type PropertyForm } from '@/features/properties/propertySetup';
import type { StoredImage } from '@/features/storage/imageStorage';

export type EditablePhotos = { photos: StoredImage[]; roomPhotos: StoredImage[] };

/** The property as loaded for editing: the form to show, and the photos already saved. */
export type PropertyEditData = { form: PropertyForm; stored: EditablePhotos };

const text = (v: unknown): string => (typeof v === 'string' ? v : '');

/** Saved photo references from a property document; entries without a usable https `url` are dropped. */
export function parseStoredPhotos(value: unknown): StoredImage[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const e = entry as Record<string, unknown> | null;
    const url = typeof e?.url === 'string' ? e.url : '';
    if (!url.startsWith('https://')) return [];
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
    const provider = e?.provider === 'cloudinary' || e?.provider === 'firebase' ? e.provider : undefined;
    return [
      {
        url,
        path: typeof e?.path === 'string' ? e.path : '',
        ...(provider ? { provider } : {}),
        ...(typeof e?.publicId === 'string' ? { publicId: e.publicId } : {}),
        ...(num(e?.width) !== undefined ? { width: num(e?.width) } : {}),
        ...(num(e?.height) !== undefined ? { height: num(e?.height) } : {}),
        ...(num(e?.bytes) !== undefined ? { bytes: num(e?.bytes) } : {}),
      } satisfies StoredImage,
    ];
  });
}

/** A saved photo shown in the editor as a draft whose `uri` is its URL (so it is never uploaded again). */
const asDraft = (p: StoredImage): PhotoDraft => ({ uri: p.url, mimeType: null, fileSize: null });

/** The edit form for a property document. Rooms are not edited here, so they stay empty. */
export function formFromProperty(data: Record<string, unknown>): PropertyEditData {
  const photos = parseStoredPhotos(data.photos);
  const roomPhotos = parseStoredPhotos(data.roomPhotos);
  const geo = data.geo as { latitude?: unknown; longitude?: unknown } | undefined;
  return {
    form: {
      ...emptyForm(),
      name: text(data.name),
      location: text(data.location),
      city: text(data.city),
      state: text(data.state),
      postalCode: text(data.postalCode),
      description: text(data.description),
      contactName: text(data.contactName),
      contactPhone: text(data.contactPhone),
      amenities: Array.isArray(data.amenities) ? data.amenities.filter((k): k is string => typeof k === 'string') : [],
      photos: photos.map(asDraft),
      roomPhotos: roomPhotos.map(asDraft),
      geo: typeof geo?.latitude === 'number' && typeof geo?.longitude === 'number' ? { latitude: geo.latitude, longitude: geo.longitude } : null,
    },
    stored: { photos, roomPhotos },
  };
}

/** A draft that points at an already saved photo (an https URL) rather than a new local file. */
export const isSavedPhoto = (d: PhotoDraft): boolean => d.uri.startsWith('https://');

/** Whether the owner changed anything (to confirm before leaving). */
export function isEdited(initial: PropertyForm, current: PropertyForm): boolean {
  const key = (f: PropertyForm) =>
    JSON.stringify([f.name, f.location, f.city, f.state, f.postalCode, f.description, f.contactName, f.contactPhone, [...f.amenities].sort(), f.photos.map((p) => p.uri), f.roomPhotos.map((p) => p.uri), f.geo]);
  return key(initial) !== key(current);
}
