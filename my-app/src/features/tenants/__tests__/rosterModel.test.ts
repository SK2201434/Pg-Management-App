import type { LedgerRow } from '@/features/rent/rentModel';
import {
  filterRoster,
  summarizeRoster,
  tabCounts,
  tenantRent,
  type RosterTenant,
} from '@/features/tenants/rosterModel';

const row = (period: string, amountInr: number, paidInr: number, status: LedgerRow['status'], daysOverdue = 0): LedgerRow => ({
  charge: { id: `t_${period}`, tenantUid: 't', period, amountInr, dueMs: 0 },
  tenantName: 'T',
  paidInr,
  remainingInr: amountInr - paidInr,
  status,
  daysOverdue,
});

describe('tenantRent', () => {
  it('has no rent status without charges', () => {
    expect(tenantRent([])).toEqual({ kind: 'none' });
  });
  it('is paid only when every charge is paid, showing the latest amount', () => {
    expect(tenantRent([row('2026-09', 5000, 5000, 'paid'), row('2026-10', 6000, 6000, 'paid')])).toEqual({ kind: 'paid', latestAmountInr: 6000 });
  });
  it('takes the worst unpaid charge and totals what is outstanding', () => {
    const r = tenantRent([row('2026-09', 5000, 0, 'overdue', 30), row('2026-10', 6000, 3000, 'partial')]);
    expect(r).toEqual({ kind: 'unpaid', status: 'overdue', latestAmountInr: 6000, outstandingInr: 8000, daysOverdue: 30 });
  });
});

const person = (uid: string, propertyId: string, rent: RosterTenant['rent'], status: RosterTenant['status'] = 'active'): RosterTenant => ({
  key: `${propertyId}:${uid}`,
  tenantUid: uid,
  name: uid.toUpperCase(),
  propertyId,
  propertyName: propertyId === 'p1' ? 'Greenwood' : 'Sunrise',
  status,
  placement: uid === 'c' ? 'Room 204 · Cot 2' : null,
  rent,
});
const overdue: RosterTenant['rent'] = { kind: 'unpaid', status: 'overdue', latestAmountInr: 6000, outstandingInr: 6000, daysOverdue: 5 };
const dueToday: RosterTenant['rent'] = { kind: 'unpaid', status: 'due-today', latestAmountInr: 5000, outstandingInr: 5000, daysOverdue: 0 };
const roster = [
  person('a', 'p1', overdue),
  person('b', 'p1', { kind: 'paid', latestAmountInr: 5000 }),
  person('a', 'p2', dueToday),
  person('c', 'p2', { kind: 'none' }, 'inactive'),
];

describe('summarizeRoster', () => {
  it('counts a tenant once across properties and sums what is owed', () => {
    expect(summarizeRoster(roster, true)).toEqual({ totalTenants: 3, activeTenants: 2, pendingInr: 11000, dueRows: 2 });
  });
  it('reports pending rent as unavailable rather than zero', () => {
    expect(summarizeRoster(roster, false)).toMatchObject({ pendingInr: null, dueRows: null });
  });
});

describe('filterRoster / tabCounts', () => {
  const base = { propertyId: 'all' as const, tab: 'all' as const, search: '' };
  it('scopes by property id', () => {
    expect(filterRoster(roster, { ...base, propertyId: 'p2' }).map((r) => r.key)).toEqual(['p2:a', 'p2:c']);
  });
  it('filters by status tab and keeps active separate from rent state', () => {
    expect(filterRoster(roster, { ...base, tab: 'overdue' }).map((r) => r.key)).toEqual(['p1:a']);
    expect(filterRoster(roster, { ...base, tab: 'due' }).map((r) => r.key)).toEqual(['p2:a']);
    expect(filterRoster(roster, { ...base, tab: 'active' })).toHaveLength(3);
  });
  it('searches names, and property names only across all properties', () => {
    expect(filterRoster(roster, { ...base, search: 'sunrise' })).toHaveLength(2);
    expect(filterRoster(roster, { ...base, propertyId: 'p1', search: 'sunrise' })).toHaveLength(0);
    expect(filterRoster(roster, { ...base, search: ' B ' }).map((r) => r.key)).toEqual(['p1:b']);
  });
  it('counts per scope', () => {
    expect(tabCounts(roster, 'all')).toEqual({ all: 4, active: 3, due: 1, overdue: 1 });
    expect(tabCounts(roster, 'p1')).toEqual({ all: 2, active: 2, due: 0, overdue: 1 });
  });
});

describe('roster search by room', () => {
  it('matches the room and bed of a placed tenant', () => {
    const r = [person('c', 'p2', { kind: 'none' }), person('a', 'p1', { kind: 'none' })];
    expect(filterRoster(r, { propertyId: 'all', tab: 'all', search: 'room 204' }).map((x) => x.key)).toEqual(['p2:c']);
    expect(filterRoster(r, { propertyId: 'all', tab: 'all', search: 'cot 2' }).map((x) => x.key)).toEqual(['p2:c']);
  });
});
