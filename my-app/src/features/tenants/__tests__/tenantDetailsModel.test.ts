import type { LedgerRow } from '@/features/rent/rentModel';
import { latestRow, mailUrl, pickPayableCharge, telUrl, totalOutstanding, whatsAppUrl } from '@/features/tenants/tenantDetailsModel';

const row = (period: string, amount: number, paid: number, status: LedgerRow['status']): LedgerRow => ({
  charge: { id: `t_${period}`, tenantUid: 't', period, amountInr: amount, dueMs: 0 },
  tenantName: 'T',
  paidInr: paid,
  remainingInr: amount - paid,
  status,
  daysOverdue: 0,
});

describe('pickPayableCharge', () => {
  it('is null when nothing is owed', () => {
    expect(pickPayableCharge([])).toBeNull();
    expect(pickPayableCharge([row('2026-10', 6000, 6000, 'paid')])).toBeNull();
  });
  it('prefers overdue, then the oldest month', () => {
    const rows = [row('2026-10', 6000, 0, 'upcoming'), row('2026-09', 6000, 0, 'overdue'), row('2026-08', 6000, 0, 'overdue')];
    expect(pickPayableCharge(rows)?.charge.period).toBe('2026-08');
  });
  it('totals and latest', () => {
    const rows = [row('2026-09', 5000, 2000, 'overdue'), row('2026-10', 6000, 0, 'upcoming')];
    expect(totalOutstanding(rows)).toBe(9000);
    expect(latestRow(rows)?.charge.period).toBe('2026-10');
    expect(latestRow([])).toBeNull();
  });
});

describe('contact links', () => {
  it('builds links only from well-formed values', () => {
    expect(telUrl('9876543210')).toBe('tel:+919876543210');
    expect(whatsAppUrl('9876543210')).toBe('https://wa.me/919876543210');
    expect(telUrl('12345')).toBeNull();
    expect(whatsAppUrl(null)).toBeNull();
    expect(mailUrl('a@b.co')).toBe('mailto:a@b.co');
    expect(mailUrl('nope')).toBeNull();
  });
});
