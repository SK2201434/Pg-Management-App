import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytesResumable,
} from 'firebase/storage';

import { getFirebaseStorage } from '@/config/firebase';
import type { PhotoDraft } from '@/features/properties/propertySetup';

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const UPLOAD_RETRY_MS = 30_000;

// Photos are only viewed inside the app, on phone screens (about 1080 px wide at most), so each
// one is downscaled to 1280 px on its longest side and re-encoded as JPEG at 0.7. That is
// typically 150-300 KB instead of several MB, with no visible loss at that size.
export const PHOTO_MAX_EDGE = 1280;
export const PHOTO_JPEG_QUALITY = 0.7;

/** A photo that is in Firebase Storage. `path` lets it be deleted later. */
export type StoredPhoto = { path: string; url: string };

export type PhotoSource = 'gallery' | 'camera';
export type PickResult = { added: PhotoDraft[]; rejected: string[] };

/** Longest side after fitting inside `maxEdge`; images already smaller are left alone. */
export function targetSize(
  width: number,
  height: number,
  maxEdge: number = PHOTO_MAX_EDGE,
): { width: number; height: number } | null {
  if (width <= 0 || height <= 0 || Math.max(width, height) <= maxEdge) return null;
  return width >= height
    ? { width: maxEdge, height: Math.round((height * maxEdge) / width) }
    : { width: Math.round((width * maxEdge) / height), height: maxEdge };
}

/** Downscales and re-encodes one image as a small JPEG; returns the new local file. */
export async function compressPhoto(uri: string, width: number, height: number): Promise<PhotoDraft> {
  let w = width;
  let h = height;
  if (w <= 0 || h <= 0) {
    // The picker did not report the size; render once to learn it.
    const probe = await ImageManipulator.ImageManipulator.manipulate(uri).renderAsync();
    w = probe.width;
    h = probe.height;
  }
  const context = ImageManipulator.ImageManipulator.manipulate(uri);
  const target = targetSize(w, h);
  if (target) context.resize(target);
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({
    format: ImageManipulator.SaveFormat.JPEG,
    compress: PHOTO_JPEG_QUALITY,
  });
  const size = (await (await fetch(saved.uri)).blob()).size;
  return { uri: saved.uri, mimeType: 'image/jpeg', fileSize: size };
}

/**
 * Takes photos from the library (several at once) or the camera (one per capture), then
 * compresses each. Unsupported types are rejected with a reason; a cancelled pick returns nothing.
 * Library access needs no runtime permission on Android; the camera asks for it.
 */
export async function pickPhotos(source: PhotoSource, room: number): Promise<PickResult> {
  if (room <= 0) return { added: [], rejected: ['No more photos can be added here.'] };

  let result: ImagePicker.ImagePickerResult;
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      return {
        added: [],
        rejected: [
          permission.canAskAgain
            ? 'Camera permission was not granted.'
            : 'Camera access is turned off for HOSTELL. Enable it in Settings.',
        ],
      };
    }
    result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
  } else {
    result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: room,
      quality: 1,
    });
  }
  if (result.canceled) return { added: [], rejected: [] };

  const added: PhotoDraft[] = [];
  const rejected: string[] = [];
  for (const asset of result.assets.slice(0, room)) {
    const type = asset.mimeType?.toLowerCase() ?? null;
    if (type !== null && !ALLOWED_TYPES.includes(type)) {
      rejected.push(`${asset.fileName ?? 'A file'} is not a supported image (use JPEG, PNG or WebP).`);
      continue;
    }
    try {
      const photo = await compressPhoto(asset.uri, asset.width, asset.height);
      if (photo.fileSize !== null && photo.fileSize > MAX_PHOTO_BYTES) {
        rejected.push(`${asset.fileName ?? 'A photo'} is still larger than 5 MB after compression.`);
      } else {
        added.push(photo);
      }
    } catch {
      rejected.push(`${asset.fileName ?? 'A photo'} could not be prepared.`);
    }
  }
  return { added, rejected };
}

export class PhotoUploadError extends Error {
  constructor(readonly code: string | undefined, options?: { cause?: unknown }) {
    super(`Photo upload failed (${code ?? 'unknown'}).`, options);
    this.name = 'PhotoUploadError';
  }
}

/** User-facing text for a failed upload, including the "Storage is not set up" cases. */
export function getPhotoErrorMessage(error: unknown): string {
  const code = error instanceof PhotoUploadError ? error.code : undefined;
  switch (code) {
    case 'storage/unauthorized':
      return 'Photo storage is not available for this project yet (Firebase Storage must be enabled and its rules published).';
    case 'storage/bucket-not-found':
    case 'storage/project-not-found':
      return 'Firebase Storage is not set up for this project, so photos cannot be uploaded.';
    case 'storage/quota-exceeded':
      return 'The photo storage quota has been reached.';
    case 'storage/retry-limit-exceeded':
    case 'storage/canceled':
      return 'The photo upload timed out. Check your connection and try again.';
    default:
      return 'A photo could not be uploaded.';
  }
}

/**
 * Uploads one (already compressed) photo to `properties/{id}/photos/` and reports 0-1 progress.
 * Room photos go to the same folder with a `room_` file prefix, so one storage rule covers both.
 */
export async function uploadPropertyPhoto(
  propertyId: string,
  photo: PhotoDraft,
  index: number,
  onProgress: (fraction: number) => void,
  isRoomPhoto = false,
): Promise<StoredPhoto> {
  try {
    const storage = getFirebaseStorage();
    storage.maxUploadRetryTime = UPLOAD_RETRY_MS;
    storage.maxOperationRetryTime = UPLOAD_RETRY_MS;
    const path = `properties/${propertyId}/photos/${isRoomPhoto ? 'room_' : ''}${Date.now()}_${index}.jpg`;
    const blob = await (await fetch(photo.uri)).blob();
    if (blob.size > MAX_PHOTO_BYTES) throw new PhotoUploadError('storage/too-large');

    const fileRef = ref(storage, path);
    await new Promise<void>((resolve, reject) => {
      const task = uploadBytesResumable(fileRef, blob, { contentType: 'image/jpeg' });
      task.on(
        'state_changed',
        (s) => onProgress(s.totalBytes > 0 ? s.bytesTransferred / s.totalBytes : 0),
        reject,
        () => resolve(),
      );
    });
    return { path, url: await getDownloadURL(fileRef) };
  } catch (error) {
    if (error instanceof PhotoUploadError) throw error;
    const code = (error as { code?: unknown } | null)?.code;
    throw new PhotoUploadError(typeof code === 'string' ? code : undefined, { cause: error });
  }
}

/** Best-effort removal of an uploaded file the property no longer references. */
export async function deleteStoredPhoto(path: string): Promise<void> {
  try {
    await deleteObject(ref(getFirebaseStorage(), path));
  } catch {
    // An orphaned file is harmless; it cannot be reached from any property.
  }
}
