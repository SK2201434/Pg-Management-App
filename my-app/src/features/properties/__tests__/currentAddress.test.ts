import type { LocationGeocodedAddress } from 'expo-location';

import { addressFromGeocode } from '@/features/properties/currentAddress';

const geo = (over: Partial<LocationGeocodedAddress>): LocationGeocodedAddress => ({
  city: null,
  country: 'India',
  district: null,
  formattedAddress: null,
  isoCountryCode: 'IN',
  name: null,
  postalCode: null,
  region: null,
  street: null,
  streetNumber: null,
  subregion: null,
  timezone: null,
  ...over,
});

describe('addressFromGeocode', () => {
  it('maps city, state and postal code', () => {
    const a = addressFromGeocode(
      geo({ name: '12-4', street: 'MG Road', district: 'MVP Colony', city: 'Visakhapatnam', region: 'Andhra Pradesh', postalCode: '530017' }),
    );
    expect(a).toEqual({
      location: '12-4, MG Road, MVP Colony',
      city: 'Visakhapatnam',
      state: 'Andhra Pradesh',
      postalCode: '530017',
    });
  });

  it('does not repeat a street already contained in the name, and prefers the fuller text', () => {
    expect(addressFromGeocode(geo({ name: '12 MG Road', street: 'MG Road' })).location).toBe('12 MG Road');
    expect(addressFromGeocode(geo({ name: 'MG Road', streetNumber: '12', street: 'MG Road' })).location).toBe('12 MG Road');
  });

  it('falls back to subregion for the city and leaves missing parts empty', () => {
    expect(addressFromGeocode(geo({ subregion: 'Krishna' }))).toEqual({
      location: '',
      city: 'Krishna',
      state: '',
      postalCode: '',
    });
  });
});
