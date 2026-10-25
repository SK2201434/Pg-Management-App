import { failureCode, parseUploadResponse } from '@/features/storage/cloudinaryProvider';
import { MAX_IMAGE_BYTES, providerOf, validateImage } from '@/features/storage/imageStorage';

describe('image storage', () => {
  it('validates type and size before uploading', () => {
    expect(validateImage('image/jpeg', 1000)).toBeNull();
    expect(validateImage(null, null)).toBeNull();
    expect(validateImage('application/pdf', 1000)).toBe('image/unsupported-type');
    expect(validateImage('image/jpeg', MAX_IMAGE_BYTES + 1)).toBe('image/too-large');
    expect(validateImage('image/png', MAX_IMAGE_BYTES)).toBeNull();
  });

  it('treats photos without a provider as Firebase files', () => {
    expect(providerOf({})).toBe('firebase');
    expect(providerOf({ provider: 'cloudinary' })).toBe('cloudinary');
  });

  it('keeps only the expected fields of a Cloudinary response', () => {
    const saved = parseUploadResponse(
      { secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/hostell/a.jpg', public_id: 'hostell/a', width: 800, height: 600, bytes: 1234, ownerUid: 'evil', status: 'x' } as never,
      'demo',
    );
    expect(saved).toEqual({
      provider: 'cloudinary',
      path: 'hostell/a',
      publicId: 'hostell/a',
      url: 'https://res.cloudinary.com/demo/image/upload/v1/hostell/a.jpg',
      width: 800,
      height: 600,
      bytes: 1234,
    });
  });

  it('rejects responses that are not an https URL on our cloud with an id', () => {
    expect(() => parseUploadResponse({ secure_url: 'http://res.cloudinary.com/demo/x.jpg', public_id: 'a' }, 'demo')).toThrow();
    expect(() => parseUploadResponse({ secure_url: 'https://evil.example/demo/x.jpg', public_id: 'a' }, 'demo')).toThrow();
    expect(() => parseUploadResponse({ secure_url: 'https://res.cloudinary.com/other/x.jpg', public_id: 'a' }, 'demo')).toThrow();
    expect(() => parseUploadResponse({ secure_url: 'https://res.cloudinary.com/demo/x.jpg' }, 'demo')).toThrow();
  });

  it('maps HTTP failures to stable codes', () => {
    expect(failureCode(0)).toBe('cloudinary/network');
    expect(failureCode(401)).toBe('cloudinary/unauthorized');
    expect(failureCode(413)).toBe('image/too-large');
    expect(failureCode(400)).toBe('cloudinary/rejected');
    expect(failureCode(500)).toBe('cloudinary/failed');
  });
});
