import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { deleteObject, ref } from 'firebase/storage';

import { CloudinaryConfigError } from '@/config/cloudinary';
import { getFirebaseStorage } from '@/config/firebase';
import type { PhotoDraft } from '@/features/properties/propertySetup';
import { describeCause, type UploadStage } from '@/features/storage/uploadDiagnostics';
import { cloudinaryProvider } from '@/features/storage/cloudinaryProvider';
import {
  ALLOWED_IMAGE_TYPES,
  ImageUploadError,
  MAX_IMAGE_BYTES,
  providerOf,
  validateImage,
  type ImageStorageProvider,
  type StoredImage,
} from '@/features/storage/imageStorage';

export const MAX_PHOTO_BYTES = MAX_IMAGE_BYTES;
const ALLOWED_TYPES = ALLOWED_IMAGE_TYPES;

/** The provider new photos go to. Swap this one line to move uploads to another provider. */
const imageStorage: ImageStorageProvider = cloudinaryProvider;

// Photos are only viewed inside the app, on phone screens (about 1080 px wide at most), so each
// one is downscaled to 1280 px on its longest side and re-encoded as JPEG at 0.7. That is
// typically 150-300 KB instead of several MB, with no visible loss at that size.
export const PHOTO_MAX_EDGE = 1280;
export const PHOTO_JPEG_QUALITY = 0.7;

/** A saved photo reference (see storage/imageStorage.ts). Older ones are { path, url } Firebase files. */
export type StoredPhoto = StoredImage;

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

export { ImageUploadError as PhotoUploadError };
const PhotoUploadError = ImageUploadError;

/** User-facing text for a failed upload. */
export function getPhotoErrorMessage(error: unknown): string {
  if (error instanceof CloudinaryConfigError) return 'Photo uploads are not configured for this build. Ask the developer to set the Cloudinary settings.';
  const code = error instanceof PhotoUploadError ? error.code : undefined;
  switch (code) {
    case 'image/unsupported-type':
      return 'A photo is not a supported image (use JPEG, PNG or WebP).';
    case 'image/too-large':
      return 'A photo is larger than 5 MB.';
    case 'cloudinary/network':
      return 'A photo could not be uploaded. Check your connection and try again.';
    case 'cloudinary/timeout':
      return 'The photo upload timed out. Check your connection and try again.';
    case 'cloudinary/unauthorized':
    case 'cloudinary/rejected':
      return 'The photo service rejected the upload. Please try again later.';
    case 'cloudinary/bad-response':
      return 'The photo service returned an unexpected response, so the photo was not saved.';
    default:
      return 'A photo could not be uploaded.';
  }
}

/**
 * Uploads one (already compressed) photo through the image-storage provider and reports 0-1
 * progress. Room photos use the same property folder with a `room_` marker.
 */
export async function uploadPropertyPhoto(
  propertyId: string,
  photo: PhotoDraft,
  index: number,
  onProgress: (fraction: number) => void,
  isRoomPhoto = false,
): Promise<StoredPhoto> {
  void index;
  let stage: UploadStage = 'local-image-access';
  try {
    let size = photo.fileSize;
    if (size === null) size = (await (await fetch(photo.uri)).blob()).size;
    stage = 'file-validation';
    const invalid = validateImage(photo.mimeType, size);
    if (invalid) throw new PhotoUploadError(invalid, { details: { stage } });
    return await imageStorage.upload({
      uri: photo.uri,
      mimeType: photo.mimeType,
      fileSize: size,
      folder: `properties/${propertyId}${isRoomPhoto ? '/rooms' : ''}`,
      onProgress,
    });
  } catch (error) {
    if (error instanceof PhotoUploadError || error instanceof CloudinaryConfigError) throw error;
    // Keep what was thrown (name and a sanitized message) and where, instead of a bare error.
    const code = (error as { code?: unknown } | null)?.code;
    throw new PhotoUploadError(typeof code === 'string' ? code : undefined, {
      cause: error,
      details: { stage, requestSent: false, ...describeCause(error) },
    });
  }
}

/**
 * Best-effort removal of an uploaded file the property no longer references. Only Firebase Storage
 * files can be deleted from the app. Cloudinary deletion needs the API secret, which must never be
 * in the app, so those assets stay in the Cloudinary library (orphaned, but unreachable from any
 * property).
 */
export async function deleteStoredPhoto(photo: StoredPhoto): Promise<void> {
  if (providerOf(photo) !== 'firebase') return;
  try {
    await deleteObject(ref(getFirebaseStorage(), photo.path));
  } catch {
    // An orphaned file is harmless; it cannot be reached from any property.
  }
}
