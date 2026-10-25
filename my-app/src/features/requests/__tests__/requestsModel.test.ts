import { activeCount, countRequests, filterRequests, sortRequests, ticketRef, toStatus, validateRequest, type TenantRequest } from '@/features/requests/requestsModel';
import { canRaiseRequest, type TenantStay } from '@/features/tenantHome/tenantHomeModel';

const r = (id: string, status: TenantRequest['status'], createdMs: number | null = 1): TenantRequest => ({ id, category: 'wifi', title: id, description: '', status, createdMs, updatedMs: createdMs });
const items = [r('a', 'open', 1), r('b', 'in_progress', 3), r('c', 'resolved', 2), r('d', 'open', null)];

describe('requests model', () => {
  it('maps unknown statuses to open', () => {
    expect(toStatus('in_progress')).toBe('in_progress');
    expect(toStatus('weird')).toBe('open');
  });
  it('filters, counts and sorts (pending timestamps first)', () => {
    expect(filterRequests(items, 'open').map((x) => x.id)).toEqual(['a', 'd']);
    expect(countRequests(items, 'all')).toBe(4);
    expect(countRequests(items, 'resolved')).toBe(1);
    expect(activeCount(items)).toBe(3);
    expect(sortRequests(items).map((x) => x.id)).toEqual(['d', 'b', 'c', 'a']);
  });
  it('derives a reference from the id', () => {
    expect(ticketRef('abcdef123')).toBe('#ABCDEF');
  });
  it('validates the form', () => {
    expect(validateRequest({ category: null, title: ' ', description: 'short' })).toEqual({
      category: expect.any(String), title: expect.any(String), description: expect.any(String),
    });
    expect(validateRequest({ category: 'wifi', title: 'Wi-Fi drops', description: 'Drops every evening.' })).toEqual({});
    expect(validateRequest({ category: 'wifi', title: 'x'.repeat(101), description: 'Drops every evening.' }).title).toBeDefined();
  });
  it('allows requests only for an active stay that has not ended', () => {
    const stay = (checkOutMs: number | null): TenantStay => ({ state: 'active', propertyId: 'p', ownerUid: 'o', propertyName: 'P', location: null, city: null, region: null, postalCode: null, geo: null, contactName: null, contactPhone: null, joinedMs: null, checkInMs: null, checkOutMs });
    expect(canRaiseRequest(stay(null), 10)).toBe(true);
    expect(canRaiseRequest(stay(20), 10)).toBe(true);
    expect(canRaiseRequest(stay(5), 10)).toBe(false);
    expect(canRaiseRequest({ state: 'none' }, 10)).toBe(false);
    expect(canRaiseRequest(undefined, 10)).toBe(false);
  });
});
