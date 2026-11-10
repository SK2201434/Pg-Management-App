import {
  attentionRows,
  collectedThisMonth,
  computeOccupancy,
  dueWithinDays,
  filterAttention,
  greeting,
  missedMonthRows,
  outstandingRent,
  trackingNote,
  propertiesOwing,
  rentRows,
  scopeProperties,
  type PropertyData,
} from '@/features/dashboard/dashboardModel';
import type { PropertyRoom, PropertyTenant } from '@/features/properties/propertyTypes';
import { DUE_NEXT_DAY_AFTER_JOINING_FOR_TESTING } from '@/features/rent/reminderModel';
import type { RentCharge, RentPayment } from '@/features/rent/rentModel';

const day = (y: number, m: number, d: number) => new Date(y, m - 1, d).getTime();
const NOW = day(2026, 10, 20) + 10 * 3_600_000;

const room = (id: string, beds: { occupant: string | null; status?: 'available' | 'unavailable' }[]): PropertyRoom => ({
  id,
  roomNumber: id,
  floor: null,
  sharing: beds.length,
  ac: false,
  rentPerBedInr: null,
  beds: beds.map((b, i) => ({ id: `${id}b${i}`, label: `Bed ${i + 1}`, status: b.status ?? 'available', occupant: b.occupant })),
});
const tenant = (uid: string, name: string): PropertyTenant => ({
  tenantUid: uid,
  name,
  status: 'active',
  joinedAtMs: null,
  source: 'added',
  roomNumber: '204',
  bedLabel: 'Bed B',
  sharing: 2,
  rentInr: 6000,
});
const charge = (uid: string, period: string, amountInr: number, dueMs: number): RentCharge => ({ id: `${uid}_${period}`, tenantUid: uid, period, amountInr, dueMs });
const pay = (chargeId: string, uid: string, amountInr: number, paidMs: number): RentPayment => ({
  id: `${chargeId}${amountInr}${paidMs}`,
  tenantUid: uid,
  chargeId,
  amountInr,
  method: 'upi',
  paidMs,
  reference: null,
  note: null,
});

const greenwood: PropertyData = {
  id: 'g',
  name: 'Greenwood',
  rooms: [room('101', [{ occupant: 'A' }, { occupant: null }]), room('102', [{ occupant: null, status: 'unavailable' }])],
  tenants: [tenant('a', 'Aarav'), tenant('b', 'Priya')],
  charges: [charge('a', '2026-10', 6000, day(2026, 10, 15)), charge('b', '2026-10', 5000, day(2026, 10, 20)), charge('a', '2026-11', 6000, day(2026, 10, 25))],
  payments: [pay('a_2026-10', 'a', 2000, day(2026, 10, 18)), pay('b_2026-10', 'b', 100, day(2026, 9, 30))],
};
const sunrise: PropertyData = {
  id: 's',
  name: 'Sunrise',
  rooms: [room('1', [{ occupant: 'Z' }])],
  tenants: [tenant('a', 'Aarav')],
  charges: [charge('a', '2026-10', 8000, day(2026, 10, 1))],
  payments: [],
};

describe('occupancy', () => {
  it('counts occupied and free beds, leaving blocked beds out of "vacant"', () => {
    expect(computeOccupancy([greenwood])).toEqual({ totalBeds: 3, occupiedBeds: 1, vacantBeds: 1, occupancyPercentage: 33 });
  });
  it('sums across properties and is safe with no beds', () => {
    expect(computeOccupancy([greenwood, sunrise])).toMatchObject({ totalBeds: 4, occupiedBeds: 2, occupancyPercentage: 50 });
    expect(computeOccupancy([{ ...greenwood, rooms: [] }])).toEqual({ totalBeds: 0, occupiedBeds: 0, vacantBeds: 0, occupancyPercentage: 0 });
  });
  it('is null until every room list is loaded', () => {
    expect(computeOccupancy([greenwood, { ...sunrise, rooms: null }])).toBeNull();
  });
});

describe('rent figures', () => {
  const rows = rentRows([greenwood, sunrise], NOW) as NonNullable<ReturnType<typeof rentRows>>;
  it('outstanding is what is left after payments, with distinct tenants per property', () => {
    // Aarav(g) 4000 + Priya(g) 5000 - 100 = 4900 + Aarav(g, Nov) 6000 + Aarav(s) 8000
    expect(outstandingRent(rows)).toEqual({ amountInr: 4000 + 4900 + 6000 + 8000, tenantCount: 3 });
  });
  it('due in 7 days covers today through the next week, not overdue', () => {
    expect(dueWithinDays(rows, NOW)).toEqual({ amountInr: 4900 + 6000, tenantCount: 2 });
  });
  it('collected counts only payments dated in the current month', () => {
    expect(collectedThisMonth([greenwood], NOW)).toBe(2000);
    expect(collectedThisMonth([greenwood, sunrise], NOW)).toBe(2000);
  });
  it('is null while rent data is missing', () => {
    expect(rentRows([{ ...greenwood, charges: null }], NOW)).toBeNull();
    expect(collectedThisMonth([{ ...greenwood, payments: null }], NOW)).toBeNull();
  });
});

describe('needs attention', () => {
  const rows = rentRows([greenwood, sunrise], NOW) as NonNullable<ReturnType<typeof rentRows>>;
  const att = attentionRows([greenwood, sunrise], rows, NOW);
  it('lists overdue, then due-today, then rent due within 7 days, with placement', () => {
    expect(att.map((r) => [r.name, r.status])).toEqual([
      ['Aarav', 'overdue'],
      ['Aarav', 'overdue'],
      ['Priya', 'due-today'],
      ['Aarav', 'due-soon'],
    ]);
    expect(att[0].daysOverdue).toBeGreaterThan(att[1].daysOverdue);
    expect(att[0].placement).toBe('Room 204 · Bed B');
  });
  it('filters', () => {
    expect(filterAttention(att, 'overdue')).toHaveLength(2);
    expect(filterAttention(att, 'due-today')).toHaveLength(1);
    expect(filterAttention(att, 'due-soon')).toHaveLength(1);
    expect(filterAttention(att, 'all')).toHaveLength(4);
  });
  it('picks properties that owe, largest first', () => {
    expect(propertiesOwing(rows).map((p) => p.propertyId)).toEqual(['g', 's']);
  });
});

describe('scope and greeting', () => {
  it('limits to one property or keeps all', () => {
    expect(scopeProperties([greenwood, sunrise], 's').map((p) => p.id)).toEqual(['s']);
    expect(scopeProperties([greenwood, sunrise], null)).toHaveLength(2);
    expect(scopeProperties([greenwood], 'missing')).toEqual([]);
  });
  it('greets by time of day', () => {
    expect(greeting(day(2026, 10, 20) + 8 * 3_600_000)).toBe('Good morning');
    expect(greeting(day(2026, 10, 20) + 14 * 3_600_000)).toBe('Good afternoon');
    expect(greeting(day(2026, 10, 20) + 20 * 3_600_000)).toBe('Good evening');
  });
});

describe('rent counted from when the property was added to HOSTELL', () => {
  const NOW_NOV = day(2026, 11, 5) + 10 * 3_600_000;
  // Joined 6 Aug 2026, but the property was only registered in HOSTELL on 1 Oct 2026.
  const joined = (over: Partial<PropertyTenant> = {}): PropertyTenant => ({ ...tenant('t', 'Tara'), joinedAtMs: day(2026, 8, 6), rentInr: 6000, ...over });
  const property = (over: Partial<PropertyData> = {}): PropertyData => ({ id: 'p', name: 'Palm', rooms: [], tenants: [joined()], charges: [], payments: [], trackingStartMs: day(2026, 10, 1), ...over });

  it('does not count months that fell due before the property was added', () => {
    const missed = missedMonthRows(property(), NOW_NOV);
    // Only October's due date falls after 1 Oct and before today; August and September are not counted.
    expect(missed.map((m) => m.row.charge.period)).toEqual(['2026-10']);
    expect(missed[0].row).toMatchObject({ remainingInr: 6000, status: 'overdue' });
  });

  it('shows the missed month on the dashboard as overdue rent with no charge recorded yet', () => {
    const p = property();
    const rows = rentRows([p], NOW_NOV) ?? [];
    const attention = attentionRows([p], rows, NOW_NOV);
    const overdue = attention.filter((a) => a.status === 'overdue');
    expect(overdue).toHaveLength(1);
    expect(overdue[0]).toMatchObject({ chargeId: null, period: '2026-10', remainingInr: 6000 });
  });

  it('skips a month that already has a recorded charge, and counts nothing when the start date is unknown', () => {
    const recorded = property({ charges: [charge('t', '2026-10', 6000, day(2026, 10, 6))] });
    expect(missedMonthRows(recorded, NOW_NOV)).toEqual([]);
    expect(missedMonthRows(property({ trackingStartMs: null }), NOW_NOV)).toEqual([]);
  });

  it('counts every missed month once the property was added earlier', () => {
    const missed = missedMonthRows(property({ trackingStartMs: day(2026, 8, 1) }), NOW_NOV);
    // Real cycle: first due one month after joining (Sep, Oct). While the testing switch is on, rent is
    // due from the day after joining (Aug, Sep, Oct).
    expect(missed.map((m) => m.row.charge.period)).toEqual(DUE_NEXT_DAY_AFTER_JOINING_FOR_TESTING ? ['2026-08', '2026-09', '2026-10'] : ['2026-09', '2026-10']);
  });

  it('reports the date rent is counted from', () => {
    expect(trackingNote([property()])).toEqual({ sinceMs: day(2026, 10, 1), propertyCount: 1 });
    expect(trackingNote([property(), property({ id: 'q', trackingStartMs: day(2026, 9, 1) })])).toEqual({ sinceMs: day(2026, 9, 1), propertyCount: 2 });
    expect(trackingNote([property({ trackingStartMs: null })])).toBeNull();
  });
});
