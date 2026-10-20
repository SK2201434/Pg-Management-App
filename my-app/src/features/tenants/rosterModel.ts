// Pure model of the owner's Tenants Overview. No React, no Firebase.
//
// Roster definition: one row per tenant per property they joined (`properties/{pid}/members`). There
// is no stay or bed allocation yet, so a row says nothing about a room or bed. A tenant who joined two
// properties appears under each, and counts once in the totals. Rent status comes only from saved
// rent charges and payments (see features/rent/rentModel.ts).
import type { ChargeStatus, LedgerRow } from '@/features/rent/rentModel';

export type TenantRent =
  | { kind: 'none' }
  | { kind: 'paid'; latestAmountInr: number }
  | { kind: 'unpaid'; status: Exclude<ChargeStatus, 'paid'>; latestAmountInr: number; outstandingInr: number; daysOverdue: number };

export type RosterTenant = {
  /** `<propertyId>:<tenantUid>`: stable and unique per row. */
  key: string;
  tenantUid: string;
  name: string;
  propertyId: string;
  propertyName: string;
  status: 'active' | 'inactive';
  /** "Room 204 · Bed B" for a tenant the owner placed in a bed; null otherwise. */
  placement: string | null;
  rent: TenantRent;
};

const SEVERITY: Record<Exclude<ChargeStatus, 'paid'>, number> = { overdue: 3, 'due-today': 2, partial: 1, upcoming: 0 };

/** A tenant's rent state in one property: the worst unpaid charge wins; paid only if every charge is paid. */
export function tenantRent(rows: readonly LedgerRow[]): TenantRent {
  if (rows.length === 0) return { kind: 'none' };
  const latest = [...rows].sort((a, b) => b.charge.period.localeCompare(a.charge.period))[0];
  const unpaid = rows.filter((r) => r.status !== 'paid');
  if (unpaid.length === 0) return { kind: 'paid', latestAmountInr: latest.charge.amountInr };
  const worst = unpaid.reduce((a, b) => (SEVERITY[b.status as keyof typeof SEVERITY] > SEVERITY[a.status as keyof typeof SEVERITY] ? b : a));
  return {
    kind: 'unpaid',
    status: worst.status as Exclude<ChargeStatus, 'paid'>,
    latestAmountInr: latest.charge.amountInr,
    outstandingInr: unpaid.reduce((sum, r) => sum + r.remainingInr, 0),
    daysOverdue: Math.max(0, ...unpaid.map((r) => r.daysOverdue)),
  };
}

export type RosterSummary = {
  totalTenants: number;
  activeTenants: number;
  /** Total outstanding rent, or null when rent data is not available (never a guess). */
  pendingInr: number | null;
  /** Roster rows with an overdue charge (for the "N dues" hint), or null with `pendingInr`. */
  dueRows: number | null;
};

export function summarizeRoster(roster: readonly RosterTenant[], rentAvailable: boolean): RosterSummary {
  const all = new Set(roster.map((r) => r.tenantUid));
  const active = new Set(roster.filter((r) => r.status === 'active').map((r) => r.tenantUid));
  const unpaid = roster.filter((r) => r.rent.kind === 'unpaid');
  return {
    totalTenants: all.size,
    activeTenants: active.size,
    pendingInr: rentAvailable ? unpaid.reduce((s, r) => s + (r.rent.kind === 'unpaid' ? r.rent.outstandingInr : 0), 0) : null,
    dueRows: rentAvailable ? unpaid.length : null,
  };
}

export type StatusTab = 'all' | 'active' | 'due' | 'overdue';

const isOverdue = (r: RosterTenant) => r.rent.kind === 'unpaid' && r.rent.status === 'overdue';
// Due: money is owed and it is not late yet, but the due date is today or part of it is already paid.
const isDue = (r: RosterTenant) => r.rent.kind === 'unpaid' && (r.rent.status === 'due-today' || r.rent.status === 'partial');

export function matchesTab(r: RosterTenant, tab: StatusTab): boolean {
  switch (tab) {
    case 'active':
      return r.status === 'active';
    case 'due':
      return isDue(r);
    case 'overdue':
      return isOverdue(r);
    default:
      return true;
  }
}

export function filterRoster(
  roster: readonly RosterTenant[],
  { propertyId, tab, search }: { propertyId: string | 'all'; tab: StatusTab; search: string },
): RosterTenant[] {
  const needle = search.trim().toLowerCase();
  return roster.filter((r) => {
    if (propertyId !== 'all' && r.propertyId !== propertyId) return false;
    if (!matchesTab(r, tab)) return false;
    if (!needle) return true;
    return (
      r.name.toLowerCase().includes(needle) ||
      (r.placement?.toLowerCase().includes(needle) ?? false) ||
      (propertyId === 'all' && r.propertyName.toLowerCase().includes(needle))
    );
  });
}

/** Counts for the status tabs within one property scope (search is not applied to them). */
export function tabCounts(roster: readonly RosterTenant[], propertyId: string | 'all'): Record<StatusTab, number> {
  const scoped = roster.filter((r) => propertyId === 'all' || r.propertyId === propertyId);
  return {
    all: scoped.length,
    active: scoped.filter((r) => matchesTab(r, 'active')).length,
    due: scoped.filter((r) => matchesTab(r, 'due')).length,
    overdue: scoped.filter((r) => matchesTab(r, 'overdue')).length,
  };
}

export const sortRoster = (roster: readonly RosterTenant[]): RosterTenant[] =>
  [...roster].sort((a, b) => a.name.localeCompare(b.name) || a.propertyName.localeCompare(b.propertyName));
