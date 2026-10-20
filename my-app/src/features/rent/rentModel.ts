// Pure rent model: charges, payments, balances, status and form validation. No React, no Firebase.
//
// Firestore (see firestore.rules):
//   properties/{pid}/rentCharges/{tenantUid}_{YYYY-MM}  ownerUid, propertyId, tenantUid, period,
//                                                       amountInr, dueDate, createdAt
//   properties/{pid}/payments/{id}                      ownerUid, propertyId, tenantUid, chargeId,
//                                                       amountInr, method, paidOn, reference?, note?, createdAt
// All amounts are whole rupees. A balance is never stored: remaining = charge - its payments.

export const PAYMENT_METHODS = [
  { value: 'upi', label: 'UPI' },
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank / IMPS' },
  { value: 'cheque', label: 'Cheque' },
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]['value'];

export const MAX_AMOUNT_INR = 1_000_000;

export type RentCharge = { id: string; tenantUid: string; period: string; amountInr: number; dueMs: number };
export type RentPayment = {
  id: string;
  tenantUid: string;
  chargeId: string;
  amountInr: number;
  method: PaymentMethod;
  paidMs: number;
  reference: string | null;
  note: string | null;
};

export type ChargeStatus = 'paid' | 'partial' | 'upcoming' | 'due-today' | 'overdue';

export type LedgerRow = {
  charge: RentCharge;
  tenantName: string;
  paidInr: number;
  remainingInr: number;
  status: ChargeStatus;
  /** Whole days past the due date (0 unless overdue). */
  daysOverdue: number;
};

const DAY_MS = 86_400_000;

export const startOfDay = (ms: number): number => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

/**
 * Paid when nothing remains. Otherwise by the due date: after it is overdue, on it due today, before
 * it upcoming. A part-paid charge that is not yet due is `partial`; once past due it is overdue.
 */
export function chargeStatus(paidInr: number, amountInr: number, dueMs: number, nowMs: number): ChargeStatus {
  if (paidInr >= amountInr) return 'paid';
  const today = startOfDay(nowMs);
  const due = startOfDay(dueMs);
  if (today > due) return 'overdue';
  if (paidInr > 0) return 'partial';
  return today === due ? 'due-today' : 'upcoming';
}

export function buildLedger(
  charges: readonly RentCharge[],
  payments: readonly RentPayment[],
  tenantNames: ReadonlyMap<string, string>,
  nowMs: number,
): LedgerRow[] {
  const paidByCharge = new Map<string, number>();
  for (const p of payments) paidByCharge.set(p.chargeId, (paidByCharge.get(p.chargeId) ?? 0) + p.amountInr);
  return charges
    .map((charge): LedgerRow => {
      const paidInr = paidByCharge.get(charge.id) ?? 0;
      const status = chargeStatus(paidInr, charge.amountInr, charge.dueMs, nowMs);
      return {
        charge,
        tenantName: tenantNames.get(charge.tenantUid) ?? 'Former tenant',
        paidInr,
        remainingInr: Math.max(0, charge.amountInr - paidInr),
        status,
        daysOverdue: status === 'overdue' ? Math.round((startOfDay(nowMs) - startOfDay(charge.dueMs)) / DAY_MS) : 0,
      };
    })
    .sort((a, b) => b.charge.period.localeCompare(a.charge.period) || a.tenantName.localeCompare(b.tenantName));
}

export type LedgerSummary = {
  chargedInr: number;
  collectedInr: number;
  outstandingInr: number;
  overdueInr: number;
  overdueCount: number;
};

/** Totals over exactly the rows given (callers pass the rows that are on screen). */
export function ledgerSummary(rows: readonly LedgerRow[]): LedgerSummary {
  const sum: LedgerSummary = { chargedInr: 0, collectedInr: 0, outstandingInr: 0, overdueInr: 0, overdueCount: 0 };
  for (const r of rows) {
    sum.chargedInr += r.charge.amountInr;
    sum.collectedInr += r.paidInr;
    sum.outstandingInr += r.remainingInr;
    if (r.status === 'overdue') {
      sum.overdueInr += r.remainingInr;
      sum.overdueCount += 1;
    }
  }
  return sum;
}

export type StatusFilter = 'all' | 'unpaid' | 'overdue' | 'paid';

export function filterLedger(
  rows: readonly LedgerRow[],
  { status, period, search }: { status: StatusFilter; period: string | 'all'; search: string },
): LedgerRow[] {
  const needle = search.trim().toLowerCase();
  return rows.filter((r) => {
    if (status === 'paid' && r.status !== 'paid') return false;
    if (status === 'unpaid' && r.status === 'paid') return false;
    if (status === 'overdue' && r.status !== 'overdue') return false;
    if (period !== 'all' && r.charge.period !== period) return false;
    return !needle || r.tenantName.toLowerCase().includes(needle);
  });
}

// ---- amounts ----

/** Whole rupees from typed text (commas and a leading ₹ allowed), or null when not a valid amount. */
export function parseAmount(raw: string): number | null {
  const text = raw.replace(/[₹,\s]/g, '');
  if (!/^\d{1,7}$/.test(text)) return null;
  const value = Number(text);
  return value >= 1 && value <= MAX_AMOUNT_INR ? value : null;
}

/** Half of what remains in whole rupees, rounded up, so the last rupee is never lost. */
export const halfOf = (remainingInr: number): number => Math.ceil(remainingInr / 2);

export const formatInr = (amount: number): string => `₹${amount.toLocaleString('en-IN')}`;

// ---- dates and periods ----

export const pad2 = (n: number) => String(n).padStart(2, '0');

export const toDateInput = (ms: number): string => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

/** `YYYY-MM-DD` to local midnight, or null when it is not a real calendar date. */
export function parseDateInput(raw: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d ? date.getTime() : null;
}

export const isPeriod = (raw: string) => /^20\d\d-(0[1-9]|1[0-2])$/.test(raw);

export const currentPeriod = (nowMs: number) => toDateInput(nowMs).slice(0, 7);

export function shiftPeriod(period: string, months: number): string {
  const [y, m] = period.split('-').map(Number);
  const d = new Date(y, m - 1 + months, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

export function formatPeriod(period: string): string {
  if (!isPeriod(period)) return period;
  const [y, m] = period.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

export const formatDate = (ms: number): string =>
  new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

// ---- form validation ----

export type PaymentInput = { amount: string; date: string; reference: string; note: string };
export type PaymentErrors = { amount?: string; date?: string; reference?: string; note?: string };

/** `remainingInr` is the balance of the charge being paid; a payment may not exceed it. */
export function validatePayment(input: PaymentInput, remainingInr: number, nowMs: number): PaymentErrors {
  const errors: PaymentErrors = {};
  const amount = parseAmount(input.amount);
  if (!input.amount.trim()) errors.amount = 'Enter the amount collected.';
  else if (amount === null) errors.amount = 'Enter a whole-rupee amount greater than zero.';
  else if (amount > remainingInr) errors.amount = `This is more than the balance of ${formatInr(remainingInr)}.`;
  const paidOn = parseDateInput(input.date);
  if (paidOn === null) errors.date = 'Enter the date as YYYY-MM-DD.';
  else if (paidOn > startOfDay(nowMs)) errors.date = 'The payment date cannot be in the future.';
  if (input.reference.trim().length > 60) errors.reference = 'Use at most 60 characters.';
  if (input.note.trim().length > 200) errors.note = 'Use at most 200 characters.';
  return errors;
}

export type ChargeInput = { tenantUid: string; period: string; amount: string; dueDate: string };
export type ChargeErrors = { tenantUid?: string; period?: string; amount?: string; dueDate?: string };

export const chargeId = (tenantUid: string, period: string) => `${tenantUid}_${period}`;

export function validateCharge(input: ChargeInput, existing: readonly RentCharge[]): ChargeErrors {
  const errors: ChargeErrors = {};
  if (!input.tenantUid) errors.tenantUid = 'Choose a tenant.';
  if (!isPeriod(input.period)) errors.period = 'Use the format YYYY-MM.';
  else if (input.tenantUid && existing.some((c) => c.id === chargeId(input.tenantUid, input.period))) {
    errors.period = 'This tenant already has a charge for that month.';
  }
  if (parseAmount(input.amount) === null) errors.amount = 'Enter a whole-rupee amount, 1 to 10,00,000.';
  if (parseDateInput(input.dueDate) === null) errors.dueDate = 'Enter the due date as YYYY-MM-DD.';
  return errors;
}
