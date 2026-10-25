import { formFromProperty, isEdited, isSavedPhoto, parseStoredPhotos } from '@/features/properties/propertyEdit';

const doc = {
  name: 'Green PG',
  location: '12 MG Road',
  city: 'Pune',
  state: 'MH',
  postalCode: '411001',
  description: 'Nice',
  contactName: 'Sam',
  contactPhone: '+91 99999 99999',
  amenities: ['wifi', 5, 'meals'],
  geo: { latitude: 18.5, longitude: 73.8 },
  photos: [
    { url: 'https://res.cloudinary.com/x/a.jpg', path: 'hostell/a', provider: 'cloudinary', publicId: 'hostell/a', width: 800 },
    { url: 'http://insecure/x.jpg', path: 'x' },
    { path: 'no-url' },
  ],
  roomPhotos: [{ url: 'https://firebasestorage/x.jpg', path: 'properties/p/photos/x.jpg' }],
};

describe('property edit model', () => {
  it('loads a property document into the form and keeps only usable saved photos', () => {
    const { form, stored } = formFromProperty(doc);
    expect(form).toMatchObject({ name: 'Green PG', city: 'Pune', amenities: ['wifi', 'meals'], geo: { latitude: 18.5, longitude: 73.8 }, rooms: [] });
    expect(stored.photos).toHaveLength(1);
    expect(stored.photos[0]).toMatchObject({ provider: 'cloudinary', publicId: 'hostell/a', width: 800 });
    expect(form.photos.map((p) => p.uri)).toEqual(['https://res.cloudinary.com/x/a.jpg']);
    expect(stored.roomPhotos[0].provider).toBeUndefined(); // an older (Firebase) photo stays as it was
  });

  it('tells saved photos from new local files', () => {
    expect(isSavedPhoto({ uri: 'https://x/y.jpg', mimeType: null, fileSize: null })).toBe(true);
    expect(isSavedPhoto({ uri: 'file:///cache/p.jpg', mimeType: 'image/jpeg', fileSize: 10 })).toBe(false);
  });

  it('detects changes, ignoring amenity order', () => {
    const { form } = formFromProperty(doc);
    expect(isEdited(form, { ...form })).toBe(false);
    expect(isEdited(form, { ...form, amenities: ['meals', 'wifi'] })).toBe(false);
    expect(isEdited(form, { ...form, name: 'Other' })).toBe(true);
    expect(isEdited(form, { ...form, photos: [] })).toBe(true);
  });

  it('parses nothing from non-lists', () => {
    expect(parseStoredPhotos(undefined)).toEqual([]);
    expect(parseStoredPhotos('x')).toEqual([]);
  });
});
