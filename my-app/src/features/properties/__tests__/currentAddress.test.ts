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

  it('fills missing city and postal code from the one-line address (Android)', () => {
    const a = addressFromGeocode(
      geo({
        name: 'No 104',
        street: 'Kavuri Hills Road',
        region: 'Telangana',
        formattedAddress: 'No 104, Kavuri Hills Road, Madhapur, Hyderabad, Telangana 500081, India',
      }),
    );
    expect(a).toEqual({ location: 'No 104, Kavuri Hills Road', city: 'Hyderabad', state: 'Telangana', postalCode: '500081' });
  });

  it('never uses a Plus Code as the address, and builds it from the one-line address instead', () => {
    const a = addressFromGeocode(
      geo({
        name: '8J2W+XX',
        region: 'Telangana',
        formattedAddress: '8J2W+XX Madhapur, Kavuri Hills Road, Madhapur, Hyderabad, Telangana 500081, India',
      }),
    );
    expect(a.location).not.toMatch(/\+/);
    expect(a).toMatchObject({ city: 'Hyderabad', state: 'Telangana', postalCode: '500081' });
    expect(addressFromGeocode(geo({ name: '8J2W+XX', street: 'Kavuri Hills Road' })).location).toBe('Kavuri Hills Road');
  });

  it('prefers the separate fields over the one-line address', () => {
    const a = addressFromGeocode(
      geo({ city: 'Pune', region: 'Maharashtra', postalCode: '411001', formattedAddress: 'Somewhere, Mumbai, Maharashtra 400001, India' }),
    );
    expect(a).toMatchObject({ city: 'Pune', state: 'Maharashtra', postalCode: '411001' });
  });
});
