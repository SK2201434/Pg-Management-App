import { formatAddress, mapUrl, monthsCompleted, telUrl } from '@/features/tenantHome/stayModel';

describe('stay model', () => {
  it('builds the address from stored parts only', () => {
    expect(formatAddress({ location: 'Plot 1', city: 'Pune', state: 'MH', postalCode: '411001' })).toBe('Plot 1, Pune, MH 411001');
    expect(formatAddress({ location: null, city: null, state: null, postalCode: null })).toBeNull();
  });
  it('prefers coordinates for the map link and falls back to the address', () => {
    expect(mapUrl({ lat: 1.5, lng: 2.5 }, 'x')).toContain('query=1.5%2C2.5');
    expect(mapUrl(null, 'A B')).toContain('query=A%20B');
    expect(mapUrl(null, null)).toBeNull();
  });
  it('only makes a call link from a usable number', () => {
    expect(telUrl('+91 98765 43210')).toBe('tel:+919876543210');
    expect(telUrl('12')).toBeNull();
    expect(telUrl(null)).toBeNull();
  });
  it('counts whole completed months', () => {
    const from = new Date(2024, 0, 15).getTime();
    expect(monthsCompleted(from, new Date(2024, 0, 20).getTime())).toBeNull();
    expect(monthsCompleted(from, new Date(2024, 1, 15).getTime())).toBe('1 month completed');
    expect(monthsCompleted(from, new Date(2024, 7, 14).getTime())).toBe('6 months completed');
    expect(monthsCompleted(null, 1)).toBeNull();
  });
});
