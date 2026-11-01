import { acLabel, galleryOf, MAX_SEARCH_PAGES, mergePages, shouldLoadMoreForSearch, addressOf, buildListing, canRequest, filterListings, formatRentRange, sharingSummary, whatsAppUrl, type Listing } from '@/features/discovery/discoveryModel';

const l = (id: string, name: string, city: string | null, location: string | null = null): Listing => ({
  id, ownerUid: 'o', name, propertyType: null, location, city, state: null, postalCode: null, description: null, coverUrl: null, photoUrls: [],
  rentMinInr: null, rentMaxInr: null, roomTypes: [], amenities: [], updatedMs: null, sharingOptions: [], contactName: null, contactPhone: null,
});

describe('discovery model', () => {
  const items = [l('1', 'Green PG', 'Pune', 'Baner Road'), l('2', 'Sunrise Hostel', 'Mumbai')];
  it('filters by name, city and locality', () => {
    expect(filterListings(items, '').length).toBe(2);
    expect(filterListings(items, ' green ').map((x) => x.id)).toEqual(['1']);
    expect(filterListings(items, 'mumbai').map((x) => x.id)).toEqual(['2']);
    expect(filterListings(items, 'baner').map((x) => x.id)).toEqual(['1']);
    expect(filterListings(items, 'zzz')).toEqual([]);
  });
  it('formats address, rent and sharing only from stored values', () => {
    expect(addressOf({ location: 'A', city: 'B', state: 'C', postalCode: '1' })).toBe('A, B, C 1');
    expect(addressOf({ location: null, city: null, state: null, postalCode: null })).toBeNull();
    expect(formatRentRange(4000, 6500)).toContain('4,000 – ₹6,500');
    expect(formatRentRange(5000, 5000)).toBe('₹5,000 / month');
    expect(formatRentRange(null, null)).toBeNull();
    expect(sharingSummary([3, 1])).toBe('Single · 3-sharing');
    expect(sharingSummary([])).toBeNull();
  });
  it('builds a listing without unset rents and without contact unless shared', () => {
    const property = { name: 'P', location: null, city: 'X', state: null, postalCode: null, description: null, coverUrl: null, contactName: 'Sam', contactPhone: '+91 99999 99999' };
    const bed = (status: string, occupant: string | null = null) => ({ status, occupant });
    const rooms = [
      { sharing: 2, ac: true, rentPerBedInr: 4000, beds: [bed('available'), bed('available', 'Asha')] },
      { sharing: 2, ac: false, rentPerBedInr: null, beds: [bed('unavailable'), bed('available')] },
      { sharing: 1, ac: false, rentPerBedInr: 7000, beds: [bed('available')] },
    ];
    expect(buildListing({ property, rooms, shareContact: false })).toMatchObject({ rentMinInr: 4000, rentMaxInr: 7000, sharingOptions: [1, 2], contactPhone: null });
    expect(buildListing({ property, rooms, shareContact: false }).roomTypes).toEqual([
      { sharing: 1, rooms: 1, bedsTotal: 1, bedsAvailable: 1, rentMinInr: 7000, rentMaxInr: 7000, acRooms: 0 },
      { sharing: 2, rooms: 2, bedsTotal: 4, bedsAvailable: 2, rentMinInr: 4000, rentMaxInr: 4000, acRooms: 1 },
    ]);
    expect(acLabel({ rooms: 2, acRooms: 1 })).toBe('AC & non-AC');
    expect(acLabel({ rooms: 2, acRooms: 2 })).toBe('AC');
    expect(acLabel({ rooms: 2, acRooms: 0 })).toBe('Non-AC');
    expect(buildListing({ property, rooms: [], shareContact: true })).toMatchObject({ rentMinInr: null, contactPhone: '+91 99999 99999' });
  });
  it('limits requests and builds a WhatsApp link only from a full number', () => {
    expect(canRequest(null)).toBe(true);
    expect(canRequest({ status: 'withdrawn', message: null })).toBe(true);
    expect(canRequest({ status: 'pending', message: null })).toBe(false);
    expect(whatsAppUrl('+91 98765 43210')).toBe('https://wa.me/919876543210');
    expect(whatsAppUrl('98765 43210')).toBe('https://wa.me/919876543210');
    expect(whatsAppUrl('12345')).toBeNull();
  });

  it('merges pages without duplicates and keeps their order', () => {
    const pages = [{ items: [l('1', 'A', null), l('2', 'B', null)] }, { items: [l('2', 'B', null), l('3', 'C', null)] }];
    expect(mergePages(pages).map((x) => x.id)).toEqual(['1', '2', '3']);
    expect(mergePages([])).toEqual([]);
  });

  it('loads more pages for a search only while there are more, nothing is loading, and under the cap', () => {
    const base = { searching: true, hasNextPage: true, busy: false, failed: false, pagesLoaded: 1 };
    expect(shouldLoadMoreForSearch(base)).toBe(true);
    expect(shouldLoadMoreForSearch({ ...base, searching: false })).toBe(false);
    expect(shouldLoadMoreForSearch({ ...base, hasNextPage: false })).toBe(false);
    expect(shouldLoadMoreForSearch({ ...base, busy: true })).toBe(false);
    expect(shouldLoadMoreForSearch({ ...base, failed: true })).toBe(false);
    expect(shouldLoadMoreForSearch({ ...base, pagesLoaded: MAX_SEARCH_PAGES })).toBe(false);
  });

  it('shows the published photos, or just the cover for older listings', () => {
    expect(galleryOf({ photoUrls: ['a', 'b'], coverUrl: 'a' })).toEqual(['a', 'b']);
    expect(galleryOf({ photoUrls: [], coverUrl: 'c' })).toEqual(['c']);
    expect(galleryOf({ photoUrls: [], coverUrl: null })).toEqual([]);
  });
});
