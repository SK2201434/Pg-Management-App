import { ImageUploadError } from '@/features/storage/imageStorage';
import { buildDiagnostic, describeCause, responseErrorMessage, sanitizeMessage, uriScheme } from '@/features/storage/uploadDiagnostics';

describe('upload diagnostics', () => {
  it('strips paths, URIs and token-like strings from messages', () => {
    const out = sanitizeMessage('Failed to read file:///data/user/0/host.app/cache/ImageManipulator/abc.jpg at C:/Users/Jane Doe/x.jpg key AbCdEfGhIjKlMnOpQrStUvWxYz0123456789');
    expect(out).not.toMatch(/Jane|file:|data\/user|ImageManipulator|AbCdEf/);
    expect(out.length).toBeLessThanOrEqual(200);
  });

  it('keeps only the scheme of a URI', () => {
    expect(uriScheme('file:///data/user/0/x.jpg')).toBe('file');
    expect(uriScheme('content://media/external/1')).toBe('content');
    expect(uriScheme(undefined)).toBe('none');
  });

  it('reads Cloudinary error.message and ignores non-JSON bodies', () => {
    expect(responseErrorMessage('{"error":{"message":"Upload preset must be whitelisted for unsigned uploads"}}')).toBe('Upload preset must be whitelisted for unsigned uploads');
    expect(responseErrorMessage('<html>502</html>')).toBeUndefined();
    expect(responseErrorMessage('')).toBeUndefined();
  });

  it('preserves the original error name and message', () => {
    expect(describeCause(new TypeError('Network request failed'))).toEqual({ causeName: 'TypeError', causeMessage: 'Network request failed' });
  });

  it('builds a diagnostic that keeps the stage and status but no URI path or secrets', () => {
    const error = new ImageUploadError('cloudinary/failed', { details: { stage: 'http-response', requestSent: true, responseReceived: true, httpStatus: 500, responseMessage: 'Server error' } });
    const d = buildDiagnostic(error, { index: 3, total: 8, room: false, mimeType: 'image/jpeg', fileSize: 250_000, uri: 'file:///data/user/0/secret/path.jpg', configured: { cloudName: true, uploadPreset: true } });
    expect(d).toMatchObject({ code: 'cloudinary/failed', stage: 'http-response', httpStatus: 500, responseMessage: 'Server error', photo: '3/8', uriScheme: 'file', fileSizeBytes: 250_000, beforeRequest: false, cloudinaryConfigured: { cloudName: true, uploadPreset: true } });
    expect(JSON.stringify(d)).not.toMatch(/secret|path\.jpg|data\/user/);
  });

  it('describes an unexpected thrown value instead of dropping it', () => {
    const d = buildDiagnostic(new Error('boom at file:///x/y.jpg'), { uri: 'file:///x/y.jpg' });
    expect(d).toMatchObject({ stage: 'unknown', causeName: 'Error' });
    expect(d.causeMessage).toBe('boom at <uri>');
  });
});
