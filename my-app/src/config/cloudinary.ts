// Cloudinary settings. Only the cloud name and an UNSIGNED upload preset are used, and both are
// public by design. The API secret must never be put in the app or in any EXPO_PUBLIC_* variable.
//
// Must be referenced as literal `process.env.EXPO_PUBLIC_*` so Expo can inline them at build time.
const CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

export type CloudinaryConfig = { cloudName: string; uploadPreset: string };

/** Thrown when a required setting is missing, with the exact fix. */
export class CloudinaryConfigError extends Error {
  constructor(missing: string[]) {
    super(`Missing ${missing.join(' and ')}. Set ${missing.length > 1 ? 'them' : 'it'} in the root .env file and restart the dev server.`);
    this.name = 'CloudinaryConfigError';
  }
}

export function getCloudinaryConfig(): CloudinaryConfig {
  const cloudName = CLOUD_NAME?.trim();
  const uploadPreset = UPLOAD_PRESET?.trim();
  const missing = [
    ...(cloudName ? [] : ['EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME']),
    ...(uploadPreset ? [] : ['EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET']),
  ];
  if (!cloudName || !uploadPreset || missing.length > 0) throw new CloudinaryConfigError(missing);
  return { cloudName, uploadPreset };
}

/** Whether each setting is present (never the values), for diagnostics. */
export const cloudinaryConfigPresence = () => ({ cloudName: !!CLOUD_NAME?.trim(), uploadPreset: !!UPLOAD_PRESET?.trim() });
