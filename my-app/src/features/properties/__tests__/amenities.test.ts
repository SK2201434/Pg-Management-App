import { AMENITIES, amenityLabel, emptyForm } from '@/features/properties/propertySetup';

describe('amenities', () => {
  it('start empty and have unique keys with labels', () => {
    expect(emptyForm().amenities).toEqual([]);
    expect(new Set(AMENITIES.map((a) => a.key)).size).toBe(AMENITIES.length);
    expect(AMENITIES.length).toBeLessThanOrEqual(20);
    expect(amenityLabel('wifi')).toBe('Wi-Fi');
    expect(amenityLabel('unknown')).toBeNull();
  });

  it('is not shared between forms', () => {
    const a = emptyForm();
    a.amenities.push('wifi');
    expect(emptyForm().amenities).toEqual([]);
  });
});
