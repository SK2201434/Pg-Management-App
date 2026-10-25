import { hashKey, locationCheckKeys, locationKeys, normalizeAddressText, parseGeo, splitCoordinatePair } from '@/features/properties/propertyLocation';

describe('property location keys', () => {
  it('ignores case, spacing and punctuation in addresses (when there are no coordinates)', () => {
    expect(normalizeAddressText(' 12, MG  Road. ')).toBe('12mgroad');
    const a = locationKeys({ location: '12, MG Road', city: 'Pune', state: 'MH', postalCode: '411001' });
    const b = locationKeys({ location: '12 mg road', city: 'PUNE', state: 'mh', postalCode: '411 001' });
    expect(a).toEqual(b);
    expect(locationKeys({ location: '14 MG Road', city: 'Pune' })).not.toEqual(locationKeys({ location: '12 MG Road', city: 'Pune' }));
  });

  it('lets coordinates decide when they exist, whatever the address says', () => {
    const geo = { latitude: 18.52041, longitude: 73.85672 };
    const a = locationKeys({ location: 'Koramangala', geo });
    const b = locationKeys({ location: 'A completely different text', city: 'Elsewhere', geo: { latitude: 18.520412, longitude: 73.856719 } });
    expect(a).toHaveLength(1);
    expect(a).toEqual(b);
    expect(locationKeys({ location: 'Koramangala', geo: { latitude: 18.5301, longitude: 73.85672 } })).not.toEqual(a);
  });

  it('catches a point just across a cell edge by checking the neighbouring cells', () => {
    const here = { latitude: 18.52044, longitude: 73.85672 }; // cell edge is at ...045
    const across = { latitude: 18.52046, longitude: 73.85672 }; // ~2 m away, next cell
    expect(locationKeys({ location: 'x', geo: here })).not.toEqual(locationKeys({ location: 'x', geo: across }));
    expect(locationCheckKeys({ location: 'x', geo: here })).toContain(locationKeys({ location: 'x', geo: across })[0]);
    expect(locationCheckKeys({ location: 'x', geo: here })).toHaveLength(9);
    // ...but a property a street away is not a duplicate.
    const far = { latitude: 18.5206, longitude: 73.85672 };
    expect(locationCheckKeys({ location: 'x', geo: here })).not.toContain(locationKeys({ location: 'x', geo: far })[0]);
  });

  it('claims nothing without an address or coordinates, and makes ids the rules accept', () => {
    expect(locationKeys({ location: '  ', geo: null })).toEqual([]);
    for (const key of [...locationKeys({ location: 'a' }), ...locationKeys({ location: 'a', geo: { latitude: 1, longitude: 2 } })]) expect(key).toMatch(/^(addr|geo)_[0-9a-f]{14}$/);
    expect(hashKey('abc')).toBe(hashKey('abc'));
  });
});

describe('coordinate input', () => {
  it('accepts a valid pair, an empty pair, and rejects the rest', () => {
    expect(parseGeo('12.971599', '77.594566').geo).toEqual({ latitude: 12.971599, longitude: 77.594566 });
    expect(parseGeo('', '').geo).toBeNull();
    expect(parseGeo('', '').latError).toBeUndefined();
    expect(parseGeo('91', '10').latError).toBeDefined();
    expect(parseGeo('10', '181').lngError).toBeDefined();
    expect(parseGeo('12.9', '').lngError).toBeDefined();
    expect(parseGeo('abc', '10').geo).toBeNull();
  });
  it('splits a pasted Google Maps pair', () => {
    expect(splitCoordinatePair('12.971599, 77.594566')).toEqual(['12.971599', '77.594566']);
    expect(splitCoordinatePair('-33.8, 151.2')).toEqual(['-33.8', '151.2']);
    expect(splitCoordinatePair('12.97')).toBeNull();
  });
});
