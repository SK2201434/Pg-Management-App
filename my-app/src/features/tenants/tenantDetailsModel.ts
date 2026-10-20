// Pure helpers for the Tenant Details screen. No React, no Firebase.
import type { LedgerRow } from '@/features/rent/rentModel';

const SEVERITY: Record<string, number> = { overdue: 3, 'due-today': 2, partial: 1, upcoming: 0 };

/** The charge a "Record Payment" should start from: the most urgent unpaid one, the oldest month first. */
export function pickPayableCharge(rows: readonly LedgerRow[]): LedgerRow | null {
  const unpaid = rows.filter((r) => r.remainingInr > 0);
  if (unpaid.length === 0) return null;
  return [...unpaid].sort((a, b) => (SEVERITY[b.status] ?? 0) - (SEVERITY[a.status] ?? 0) || a.charge.period.localeCompare(b.charge.period))[0];
}

export const totalOutstanding = (rows: readonly LedgerRow[]): number => rows.reduce((s, r) => s + r.remainingInr, 0);

/** The most recent billing month with a charge, or null. */
export function latestRow(rows: readonly LedgerRow[]): LedgerRow | null {
  return [...rows].sort((a, b) => b.charge.period.localeCompare(a.charge.period))[0] ?? null;
}

// Contact links. Phones are stored as 10 digits with a +91 country code; anything else yields no link.
const TEN_DIGITS = /^[0-9]{10}$/;
export const telUrl = (phone: string | null): string | null => (phone && TEN_DIGITS.test(phone) ? `tel:+91${phone}` : null);
export const whatsAppUrl = (phone: string | null): string | null => (phone && TEN_DIGITS.test(phone) ? `https://wa.me/91${phone}` : null);
export const mailUrl = (email: string | null): string | null =>
  email && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? `mailto:${email}` : null;
