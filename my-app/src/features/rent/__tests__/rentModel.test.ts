import {
  buildLedger,
  chargeStatus,
  filterLedger,
  halfOf,
  ledgerSummary,
  parseAmount,
  parseDateInput,
  shiftPeriod,
  validateCharge,
  validatePayment,
  type RentCharge,
  type RentPayment,
} from '@/features/rent/rentModel';

const day = (y: number, m: number, d: number) => new Date(y, m - 1, d).getTime();
const NOW = day(2026, 10, 20) + 15 * 3_600_000;

const charge = (tenantUid: string, period: string, amountInr: number, dueMs: number): RentCharge => ({
  id: `${tenantUid}_${period}`,
  tenantUid,
  period,
  amountInr,
  dueMs,
});
const pay = (chargeId: string, tenantUid: string, amountInr: number): RentPayment => ({
  id: `${chargeId}-${amountInr}`,
  tenantUid,
  chargeId,
  amountInr,
  method: 'upi',
  paidMs: NOW,
  reference: null,
  note: null,
});

describe('chargeStatus', () => {
  it('classifies by payments and due date', () => {
    expect(chargeStatus(6000, 6000, day(2026, 10, 1), NOW)).toBe('paid');
    expect(chargeStatus(0, 6000, day(2026, 10, 15), NOW)).toBe('overdue');
    expect(chargeStatus(3000, 6000, day(2026, 10, 15), NOW)).toBe('overdue');
    expect(chargeStatus(0, 6000, day(2026, 10, 20), NOW)).toBe('due-today');
    expect(chargeStatus(3000, 6000, day(2026, 10, 25), NOW)).toBe('partial');
    expect(chargeStatus(0, 6000, day(2026, 10, 25), NOW)).toBe('upcoming');
  });
});

describe('ledger', () => {
  const names = new Map([
    ['a', 'Aarav'],
    ['b', 'Priya'],
  ]);
  const charges = [charge('a', '2026-10', 6000, day(2026, 10, 15)), charge('b', '2026-10', 8000, day(2026, 10, 25))];
  const payments = [pay('a_2026-10', 'a', 2000), pay('a_2026-10', 'a', 1000), pay('gone_2026-10', 'x', 999)];
  const rows = buildLedger(charges, payments, names, NOW);

  it('derives paid and remaining from the payments of each charge only', () => {
    const a = rows.find((r) => r.charge.tenantUid === 'a')!;
    expect([a.paidInr, a.remainingInr, a.status, a.daysOverdue]).toEqual([3000, 3000, 'overdue', 5]);
    const b = rows.find((r) => r.charge.tenantUid === 'b')!;
    expect([b.paidInr, b.remainingInr, b.status]).toEqual([0, 8000, 'upcoming']);
  });
  it('summarises the rows given', () => {
    expect(ledgerSummary(rows)).toEqual({
      chargedInr: 14000,
      collectedInr: 3000,
      outstandingInr: 11000,
      overdueInr: 3000,
      overdueCount: 1,
    });
    expect(ledgerSummary([])).toEqual({ chargedInr: 0, collectedInr: 0, outstandingInr: 0, overdueInr: 0, overdueCount: 0 });
  });
  it('filters by status, period and tenant name', () => {
    const base = { status: 'all' as const, period: 'all' as const, search: '' };
    expect(filterLedger(rows, { ...base, status: 'overdue' })).toHaveLength(1);
    expect(filterLedger(rows, { ...base, status: 'paid' })).toHaveLength(0);
    expect(filterLedger(rows, { ...base, search: 'PRIYA' })).toHaveLength(1);
    expect(filterLedger(rows, { ...base, period: '2026-09' })).toHaveLength(0);
  });
});

describe('amounts and dates', () => {
  it('parses whole rupees only', () => {
    expect(parseAmount('6,000')).toBe(6000);
    expect(parseAmount('₹ 500')).toBe(500);
    for (const bad of ['', '0', '-5', '12.5', 'abc', '10000000']) expect(parseAmount(bad)).toBeNull();
  });
  it('rounds half up', () => {
    expect(halfOf(6000)).toBe(3000);
    expect(halfOf(5001)).toBe(2501);
    expect(halfOf(1)).toBe(1);
  });
  it('parses real calendar dates', () => {
    expect(parseDateInput('2026-02-30')).toBeNull();
    expect(parseDateInput('15/10/2026')).toBeNull();
    expect(parseDateInput('2026-10-15')).toBe(day(2026, 10, 15));
    expect(shiftPeriod('2026-12', 1)).toBe('2027-01');
    expect(shiftPeriod('2026-01', -1)).toBe('2025-12');
  });
});

describe('validatePayment', () => {
  const ok = { amount: '3000', date: '2026-10-20', reference: '', note: '' };
  it('accepts a valid partial or full payment', () => {
    expect(validatePayment(ok, 6000, NOW)).toEqual({});
    expect(validatePayment({ ...ok, amount: '6000' }, 6000, NOW)).toEqual({});
  });
  it('rejects bad amounts, overpayment and future dates', () => {
    expect(validatePayment({ ...ok, amount: '' }, 6000, NOW).amount).toBeDefined();
    expect(validatePayment({ ...ok, amount: '0' }, 6000, NOW).amount).toBeDefined();
    expect(validatePayment({ ...ok, amount: '6001' }, 6000, NOW).amount).toMatch(/more than/);
    expect(validatePayment({ ...ok, date: '2026-10-21' }, 6000, NOW).date).toBeDefined();
    expect(validatePayment({ ...ok, date: 'x' }, 6000, NOW).date).toBeDefined();
  });
});

describe('validateCharge', () => {
  const existing = [charge('a', '2026-10', 6000, day(2026, 10, 5))];
  const input = { tenantUid: 'a', period: '2026-11', amount: '6000', dueDate: '2026-11-05' };
  it('requires tenant, period, amount and due date, and one charge per tenant and month', () => {
    expect(validateCharge(input, existing)).toEqual({});
    expect(validateCharge({ ...input, period: '2026-10' }, existing).period).toMatch(/already/);
    expect(validateCharge({ ...input, tenantUid: '' }, existing).tenantUid).toBeDefined();
    expect(validateCharge({ ...input, amount: '0' }, existing).amount).toBeDefined();
    expect(validateCharge({ ...input, dueDate: '2026-13-01' }, existing).dueDate).toBeDefined();
  });
});
