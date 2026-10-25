// Provider-independent image storage. The property workflow talks only to this module; the provider
// behind it (today Cloudinary) can be replaced without touching the screens or the Firestore logic.
//
// What is saved in Firestore for each photo (`properties/{id}.photos[]` / `roomPhotos[]`):
//   { url, path, provider?, publicId?, width?, height?, bytes? }
// `url` is what the UI displays and `path` is the provider's asset identifier (a Storage path for
// Firebase, the public id for Cloudinary). Photos saved before this existed have only { url, path }
// and are Firebase Storage files, so a missing `provider` means 'firebase'.

import type { UploadFailureDetails } from '@/features/storage/uploadDiagnostics';

export type ImageProviderName = 'firebase' | 'cloudinary';

export type StoredImage = {
  provider?: ImageProviderName;
  path: string;
  url: string;
  publicId?: string;
  width?: number;
  height?: number;
  bytes?: number;
};

export type ImageUploadInput = {
  /** A local file URI from the picker. */
  uri: string;
  mimeType: string | null;
  fileSize: number | null;
  /** Logical grouping, e.g. `properties/<id>`. */
  folder: string;
  onProgress: (fraction: number) => void;
};

export interface ImageStorageProvider {
  readonly name: ImageProviderName;
  upload(input: ImageUploadInput): Promise<StoredImage>;
}

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

/** A failed upload. `code` is stable and carries no credentials. */
export class ImageUploadError extends Error {
  constructor(
    readonly code: string | undefined,
    options?: { cause?: unknown; details?: UploadFailureDetails },
  ) {
    super(`Photo upload failed (${code ?? 'unknown'}).`, options);
    this.name = 'PhotoUploadError';
    this.details = options?.details;
  }

  /** Where and why it failed, safe to log (see uploadDiagnostics.ts). Never shown to users. */
  readonly details?: UploadFailureDetails;
}

/** The reason an image cannot be uploaded (as an error code), or null when it can. Size may be unknown. */
export function validateImage(mimeType: string | null, fileSize: number | null): string | null {
  if (mimeType !== null && !ALLOWED_IMAGE_TYPES.includes(mimeType.toLowerCase())) return 'image/unsupported-type';
  if (fileSize !== null && fileSize > MAX_IMAGE_BYTES) return 'image/too-large';
  return null;
}

/** A photo's provider; photos saved before providers were recorded are Firebase Storage files. */
export const providerOf = (photo: Pick<StoredImage, 'provider'>): ImageProviderName => photo.provider ?? 'firebase';
