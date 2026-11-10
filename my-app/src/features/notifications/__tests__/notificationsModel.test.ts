import type { PropertyData } from '@/features/dashboard/dashboardModel';
import {
  buildNotifications,
  formatWhen,
  mergeLocalReads,
  NOTIFICATION_PAGE_SIZE,
  nextVisibleCount,
  parseLocalReads,
  unreadIds,
} from '@/features/notifications/notificationsModel';
import type { PropertyTenant } from '@/features/properties/propertyTypes';
import type { RentCharge, RentPayment } from '@/features/rent/rentModel';

const day = (y: number, m: number, d: number) => new Date(y, m - 1, d).getTime();
const NOW = day(2026, 10, 20) + 11 * 3_600_000;

const tenant = (uid: string, name: string): PropertyTenant => ({ tenantUid: uid, name, status: 'active', joinedAtMs: null, source: 'added', roomNumber: null, bedLabel: null, sharing: null, rentInr: null });
const charge = (uid: string, period: string, amountInr: number, dueMs: number): RentCharge => ({ id: `${uid}_${period}`, tenantUid: uid, period, amountInr, dueMs });
const pay = (id: string, chargeId: string, uid: string, amountInr: number, paidMs: number): RentPayment => ({ id, tenantUid: uid, chargeId, amountInr, method: 'upi', paidMs, reference: null, note: null });

const property: PropertyData = {
  id: 'g',
  name: 'Greenwood',
  rooms: [],
  tenants: [tenant('a', 'Aarav'), tenant('b', 'Priya'), tenant('c', 'Rohan')],
  charges: [
    charge('a', '2026-10', 6000, day(2026, 10, 15)), // overdue
    charge('b', '2026-10', 5000, day(2026, 10, 20)), // due today
    charge('c', '2026-11', 7000, day(2026, 10, 28)), // upcoming: no notification
  ],
  payments: [pay('p1', 'a_2026-10', 'a', 1000, day(2026, 10, 19)), pay('old', 'a_2026-10', 'a', 500, day(2026, 8, 1))],
};

describe('buildNotifications', () => {
  const items = buildNotifications([property], NOW)!;
  it('creates overdue, due-today and recent-payment notifications only', () => {
    expect(items.map((n) => n.kind).sort()).toEqual(['payment-recorded', 'rent-due-today', 'rent-overdue']);
    expect(items.find((n) => n.kind === 'rent-overdue')?.body).toContain('₹4,500');
    expect(items.find((n) => n.kind === 'payment-recorded')?.body).toContain('Aarav paid ₹1,000 by UPI');
  });
  it('sorts newest first', () => {
    expect(items.map((n) => n.kind)).toEqual(['rent-due-today', 'payment-recorded', 'rent-overdue']);
  });
  it('gives the same ids every time, so nothing is duplicated by a refresh', () => {
    const again = buildNotifications([property], NOW)!;
    expect(again.map((n) => n.id)).toEqual(items.map((n) => n.id));
    expect(new Set(items.map((n) => n.id)).size).toBe(items.length);
    expect(items[0].id).toBe('rent-due-today_g_b_2026-10');
  });
  it('is null until every property rent data is loaded and empty with nothing to report', () => {
    expect(buildNotifications([{ ...property, payments: null }], NOW)).toBeNull();
    expect(buildNotifications([{ ...property, charges: [], payments: [] }], NOW)).toEqual([]);
  });
  it('drops an overdue charge once it is paid in full', () => {
    const paid = { ...property, payments: [pay('full', 'a_2026-10', 'a', 6000, day(2026, 10, 19))] };
    expect(buildNotifications([paid], NOW)!.some((n) => n.kind === 'rent-overdue')).toBe(false);
  });
});

describe('read marks', () => {
  it('lists the unread ids', () => {
    const items = buildNotifications([property], NOW)!;
    expect(unreadIds(items, new Set([items[0].id]))).toEqual(items.slice(1).map((n) => n.id));
    expect(unreadIds(items, new Set(items.map((n) => n.id)))).toEqual([]);
  });
  it('merges and parses stored reads safely', () => {
    expect(mergeLocalReads(['a', 'b'], ['b', 'c'])).toEqual(['a', 'b', 'c']);
    expect(parseLocalReads('["x", 3, "y"]')).toEqual(['x', 'y']);
    expect(parseLocalReads('{bad')).toEqual([]);
    expect(parseLocalReads(null)).toEqual([]);
  });
});

describe('formatWhen', () => {
  it('uses friendly labels for today and yesterday', () => {
    expect(formatWhen(day(2026, 10, 20), NOW)).toBe('Today');
    expect(formatWhen(day(2026, 10, 19), NOW)).toBe('Yesterday');
    expect(formatWhen(day(2026, 10, 1), NOW)).toMatch(/2026/);
    expect(formatWhen(null, NOW)).toBe('');
  });
});

describe('notification paging', () => {
  it('adds one page at a time and stops at the total', () => {
    expect(NOTIFICATION_PAGE_SIZE).toBe(15);
    expect(nextVisibleCount(15, 40)).toBe(30);
    expect(nextVisibleCount(30, 40)).toBe(40);
    // Everything is shown: asking again changes nothing, so the list stops growing.
    expect(nextVisibleCount(40, 40)).toBe(40);
    expect(nextVisibleCount(15, 10)).toBe(10);
    expect(nextVisibleCount(15, 0)).toBe(0);
  });
});
