import { getCloudinaryConfig } from '@/config/cloudinary';
import { describeCause, responseErrorMessage, type UploadFailureDetails } from '@/features/storage/uploadDiagnostics';
import { ImageUploadError, validateImage, type ImageStorageProvider, type ImageUploadInput, type StoredImage } from '@/features/storage/imageStorage';

const UPLOAD_TIMEOUT_MS = 60_000;

type CloudinaryResponse = { secure_url?: unknown; public_id?: unknown; width?: unknown; height?: unknown; bytes?: unknown; error?: { message?: unknown } };

/**
 * Turns a Cloudinary upload response into a stored image. Only the fields we use are read, and only
 * an https Cloudinary URL is accepted, so a malformed or unexpected response is never saved.
 */
export function parseUploadResponse(body: CloudinaryResponse, cloudName: string): StoredImage {
  const url = typeof body.secure_url === 'string' ? body.secure_url : '';
  const publicId = typeof body.public_id === 'string' ? body.public_id : '';
  if (!url.startsWith(`https://res.cloudinary.com/${cloudName}/`) || publicId === '') {
    throw new ImageUploadError('cloudinary/bad-response');
  }
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
  return {
    provider: 'cloudinary',
    path: publicId,
    publicId,
    url,
    ...(num(body.width) !== undefined ? { width: num(body.width) } : {}),
    ...(num(body.height) !== undefined ? { height: num(body.height) } : {}),
    ...(num(body.bytes) !== undefined ? { bytes: num(body.bytes) } : {}),
  };
}

/** Maps an HTTP failure to a stable code without including anything from the request. */
export const failureCode = (status: number): string =>
  status === 0 ? 'cloudinary/network' : status === 401 || status === 403 ? 'cloudinary/unauthorized' : status === 413 ? 'image/too-large' : status === 400 || status === 404 ? 'cloudinary/rejected' : 'cloudinary/failed';

/**
 * Cloudinary unsigned upload (multipart POST to /image/upload with an upload preset). It uses
 * XMLHttpRequest because React Native's fetch cannot report upload progress, and a `{ uri, name,
 * type }` file part, which React Native's FormData streams from disk (there is no browser File).
 */
export const cloudinaryProvider: ImageStorageProvider = {
  name: 'cloudinary',
  async upload(input: ImageUploadInput): Promise<StoredImage> {
    const { cloudName, uploadPreset } = getCloudinaryConfig();
    const invalid = validateImage(input.mimeType, input.fileSize);
    if (invalid) throw new ImageUploadError(invalid, { details: { stage: 'file-validation' } });

    let form: FormData;
    try {
      form = new FormData();
      form.append('file', { uri: input.uri, name: `photo_${Date.now()}.jpg`, type: input.mimeType ?? 'image/jpeg' } as unknown as Blob);
      form.append('upload_preset', uploadPreset);
      form.append('folder', `hostell/${input.folder}`);
    } catch (error) {
      throw new ImageUploadError('cloudinary/request-creation', { cause: error, details: { stage: 'request-creation', requestSent: false, ...describeCause(error) } });
    }

    return new Promise<StoredImage>((resolve, reject) => {
      let sent = false;
      const fail = (code: string, details: UploadFailureDetails, cause?: unknown) =>
        reject(new ImageUploadError(code, { cause, details: { requestSent: sent, ...details } }));
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`);
      xhr.timeout = UPLOAD_TIMEOUT_MS;
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && e.total > 0) input.onProgress(e.loaded / e.total);
      };
      xhr.onload = () => {
        const responseMessage = responseErrorMessage(xhr.responseText);
        if (xhr.status < 200 || xhr.status >= 300) {
          return fail(failureCode(xhr.status), { stage: 'http-response', responseReceived: true, httpStatus: xhr.status, responseMessage });
        }
        try {
          resolve(parseUploadResponse(JSON.parse(xhr.responseText) as CloudinaryResponse, cloudName));
        } catch (error) {
          fail(error instanceof ImageUploadError ? (error.code ?? 'cloudinary/bad-response') : 'cloudinary/bad-response', { stage: 'response-parsing', responseReceived: true, httpStatus: xhr.status, ...describeCause(error) }, error);
        }
      };
      xhr.onerror = () => fail('cloudinary/network', { stage: 'network-upload', responseReceived: false, httpStatus: xhr.status, causeName: 'XMLHttpRequestError', causeMessage: 'The request could not be completed (no response).' });
      xhr.ontimeout = () => fail('cloudinary/timeout', { stage: 'network-upload', responseReceived: false, causeName: 'Timeout', causeMessage: `No response within ${UPLOAD_TIMEOUT_MS / 1000}s.` });
      try {
        xhr.send(form);
        sent = true;
      } catch (error) {
        fail('cloudinary/request-creation', { stage: 'request-creation', responseReceived: false, ...describeCause(error) }, error);
      }
    });
  },
};
