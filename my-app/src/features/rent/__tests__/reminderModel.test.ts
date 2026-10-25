import { buildRentReminder, monthName, nextDueMs, nextReminderOpensMs, reminderDocId, withMessage } from '@/features/rent/reminderModel';
import type { LedgerRow } from '@/features/rent/rentModel';

const DAY = 86_400_000;
const NOW = new Date(2026, 2, 10, 12).getTime(); // 10 Mar 2026

const row = (period: string, amountInr: number, paidInr: number, dueMs: number, status: LedgerRow['status'], daysOverdue = 0): LedgerRow => ({
  charge: { id: `c-${period}`, tenantUid: 't1', period, amountInr, dueMs },
  tenantName: 'Asha Rao',
  paidInr,
  remainingInr: amountInr - paidInr,
  status,
  daysOverdue,
});

describe('rent reminder', () => {
  it('names the month and the amount still payable', () => {
    const r = buildRentReminder({ tenantName: 'Asha Rao', propertyName: 'Sunrise PG', rows: [row('2026-03', 6500, 2000, NOW + 5 * DAY, 'partial')], nowMs: NOW })!;
    expect(r.monthLabel).toBe('March 2026');
    expect(r.amountInr).toBe(4500);
    expect(r.status).toBe('partial');
    expect(r.message).toContain('Dear Asha,');
    expect(r.message).toContain('Sunrise PG');
    expect(r.message).toContain('rent for March 2026');
    expect(r.message).toContain('₹4,500');
    expect(r.message).toContain('due on');
  });

  it('says overdue, with the days, for a late month', () => {
    const r = buildRentReminder({ tenantName: 'Asha', propertyName: 'P', rows: [row('2026-03', 6500, 0, NOW - 3 * DAY, 'overdue', 3)], nowMs: NOW })!;
    expect(r.status).toBe('overdue');
    expect(r.message).toContain('overdue since');
    expect(r.message).toContain('3 days');
  });

  it('says due today, and adds the total when several months are unpaid', () => {
    const rows = [row('2026-02', 6500, 0, NOW - 30 * DAY, 'overdue', 30), row('2026-03', 6500, 0, NOW, 'due-today')];
    const r = buildRentReminder({ tenantName: 'Asha', propertyName: 'P', rows, nowMs: NOW })!;
    expect(r.period).toBe('2026-02'); // the most urgent month first
    expect(r.unpaidMonths).toBe(2);
    expect(r.totalInr).toBe(13000);
    expect(r.message).toContain('total outstanding across 2 months is ₹13,000');
    expect(buildRentReminder({ tenantName: 'A', propertyName: 'P', rows: [row('2026-03', 6500, 0, NOW, 'due-today')], nowMs: NOW })!.message).toContain('due today');
  });

  it('has nothing to say when nothing is unpaid', () => {
    expect(buildRentReminder({ tenantName: 'A', propertyName: 'P', rows: [row('2026-03', 6500, 6500, NOW, 'paid')], nowMs: NOW })).toBeNull();
    expect(buildRentReminder({ tenantName: 'A', propertyName: 'P', rows: [], nowMs: NOW })).toBeNull();
  });

  describe('monthly cycle from the move-in date', () => {
    const MOVE_IN = new Date(2026, 9, 22).getTime(); // 22 Oct 2026
    const schedule = { moveInMs: MOVE_IN, rentInr: 6000 };
    const at = (m: number, d: number) => new Date(2026, m, d, 12).getTime();
    const build = (nowMs: number, rows: LedgerRow[] = []) => buildRentReminder({ tenantName: 'Asha Rao', propertyName: 'P', rows, nowMs, schedule });

    it('first pays a month after moving in', () => {
      expect(new Date(nextDueMs(MOVE_IN, at(9, 22))).getTime()).toBe(new Date(2026, 10, 22).getTime());
    });

    it('opens a week before the due date, not earlier', () => {
      expect(build(at(10, 14))).toBeNull();
      expect(nextReminderOpensMs({ rows: [], schedule, nowMs: at(10, 14) })).toBe(new Date(2026, 10, 15).getTime());
      const r = build(at(10, 15))!;
      expect(r.period).toBe('2026-11');
      expect(r.amountInr).toBe(6000);
      expect(r.status).toBe('upcoming');
      expect(r.message).toContain('due on');
      expect(build(at(10, 22))!.status).toBe('due-today');
    });

    it('does not remind once that month is paid, and moves to the next cycle', () => {
      const paid = row('2026-11', 6000, 6000, new Date(2026, 10, 22).getTime(), 'paid');
      expect(build(at(10, 18), [paid])).toBeNull();
      expect(build(at(11, 16), [paid])!.period).toBe('2026-12');
    });

    it('uses a recorded charge instead of projecting one, and ignores a far-off recorded charge', () => {
      const recorded = row('2026-11', 6500, 0, new Date(2026, 10, 22).getTime(), 'upcoming');
      expect(build(at(10, 16), [recorded])!.amountInr).toBe(6500);
      expect(build(at(10, 1), [recorded])).toBeNull();
    });

    it('keeps the day within shorter months', () => {
      expect(new Date(nextDueMs(new Date(2026, 0, 31).getTime(), at(1, 1))).getTime()).toBe(new Date(2026, 1, 28).getTime());
    });
  });

  it('builds a per-day id and a WhatsApp link with the text', () => {
    expect(reminderDocId('u1', '2026-03', NOW)).toBe('u1_2026-03_20260310');
    expect(monthName('2026-03')).toBe('March 2026');
    expect(withMessage('https://wa.me/919876543210', 'Hi there\nPay')).toBe('https://wa.me/919876543210?text=Hi%20there%0APay');
  });
});
