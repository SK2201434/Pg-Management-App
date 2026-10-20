// Pure calculations behind the Owner Home dashboard. No React, no Firebase.
//
// Input is what the app already loads per owned property: rooms and beds (with who holds each bed),
// the tenants, the rent charges and the payments. Every figure is derived from those records the same
// way the Property, Tenants and Rent Ledger screens derive it, so the numbers agree across screens.
import { occupancyPercent, summarizeRooms } from '@/features/properties/propertyDetailsModel';
import type { PropertyRoom, PropertyTenant } from '@/features/properties/propertyTypes';
import { buildLedger, startOfDay, type LedgerRow, type RentCharge, type RentPayment } from '@/features/rent/rentModel';
import type { AttentionRow, OccupancySummary, RentAmount } from '@/features/dashboard/dashboardTypes';

/** One owned property with whatever has been loaded for it (`null` = not loaded or failed). */
export type PropertyData = {
  id: string;
  name: string;
  rooms: PropertyRoom[] | null;
  tenants: PropertyTenant[] | null;
  charges: RentCharge[] | null;
  payments: RentPayment[] | null;
};

const DAY_MS = 86_400_000;

/** Limit to one property, or all of them when `propertyId` is null. */
export const scopeProperties = (all: readonly PropertyData[], propertyId: string | null): PropertyData[] =>
  propertyId === null ? [...all] : all.filter((p) => p.id === propertyId);

/** Bed totals across the scope, or null while any property's rooms are not loaded. */
export function computeOccupancy(list: readonly PropertyData[]): OccupancySummary | null {
  if (list.some((p) => p.rooms === null)) return null;
  let totalBeds = 0;
  let occupiedBeds = 0;
  let vacantBeds = 0;
  for (const p of list) {
    const t = summarizeRooms(p.rooms ?? []);
    totalBeds += t.totalBeds;
    occupiedBeds += t.occupiedBeds;
    vacantBeds += t.availableBeds;
  }
  return { totalBeds, occupiedBeds, vacantBeds, occupancyPercentage: occupancyPercent(occupiedBeds, totalBeds) ?? 0 };
}

export type DashboardRow = { propertyId: string; propertyName: string; row: LedgerRow; placement: string | null };

/** Rent rows for every charge in the scope, or null while any property's rent data is not loaded. */
export function rentRows(list: readonly PropertyData[], nowMs: number): DashboardRow[] | null {
  if (list.some((p) => p.charges === null || p.payments === null)) return null;
  const out: DashboardRow[] = [];
  for (const p of list) {
    const people = p.tenants ?? [];
    const names = new Map(people.map((t) => [t.tenantUid, t.name]));
    const place = new Map(people.map((t) => [t.tenantUid, t.roomNumber ? `Room ${t.roomNumber} · ${t.bedLabel ?? 'Bed'}` : null]));
    for (const row of buildLedger(p.charges ?? [], p.payments ?? [], names, nowMs)) {
      out.push({ propertyId: p.id, propertyName: p.name, row, placement: place.get(row.charge.tenantUid) ?? null });
    }
  }
  return out;
}

const distinctTenants = (rows: readonly DashboardRow[]) => new Set(rows.map((r) => `${r.propertyId}:${r.row.charge.tenantUid}`)).size;

/** What is still owed across all unpaid charges, and how many distinct tenants owe it. */
export function outstandingRent(rows: readonly DashboardRow[]): RentAmount {
  const owing = rows.filter((r) => r.row.remainingInr > 0);
  return { amountInr: owing.reduce((s, r) => s + r.row.remainingInr, 0), tenantCount: distinctTenants(owing) };
}

/** Unpaid balance of charges due from today through the next 7 days (overdue ones are not included). */
export function dueWithinDays(rows: readonly DashboardRow[], nowMs: number, days = 7): RentAmount {
  const from = startOfDay(nowMs);
  const to = from + days * DAY_MS;
  const due = rows.filter((r) => {
    const d = startOfDay(r.row.charge.dueMs);
    return r.row.remainingInr > 0 && d >= from && d <= to;
  });
  return { amountInr: due.reduce((s, r) => s + r.row.remainingInr, 0), tenantCount: distinctTenants(due) };
}

/** Money actually recorded as paid on a date within the calendar month of `nowMs`. */
export function collectedThisMonth(list: readonly PropertyData[], nowMs: number): number | null {
  if (list.some((p) => p.payments === null)) return null;
  const now = new Date(nowMs);
  const from = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
  let sum = 0;
  for (const p of list) for (const pay of p.payments ?? []) if (pay.paidMs >= from && pay.paidMs < to) sum += pay.amountInr;
  return sum;
}

/**
 * Overdue and due-today balances: overdue first (longest first), then due today. A charge that is
 * due today and part-paid still counts as due today.
 */
export function attentionRows(rows: readonly DashboardRow[], nowMs: number): AttentionRow[] {
  const today = startOfDay(nowMs);
  const dueToday = (r: DashboardRow) => startOfDay(r.row.charge.dueMs) === today;
  return rows
    .filter((r) => r.row.remainingInr > 0 && (r.row.status === 'overdue' || dueToday(r)))
    .map(
      (r): AttentionRow => ({
        key: `${r.propertyId}:${r.row.charge.id}`,
        propertyId: r.propertyId,
        propertyName: r.propertyName,
        tenantUid: r.row.charge.tenantUid,
        chargeId: r.row.charge.id,
        name: r.row.tenantName,
        placement: r.placement,
        remainingInr: r.row.remainingInr,
        status: r.row.status === 'overdue' ? 'overdue' : 'due-today',
        daysOverdue: r.row.daysOverdue,
        period: r.row.charge.period,
      }),
    )
    .sort((a, b) => (a.status === b.status ? b.daysOverdue - a.daysOverdue || a.name.localeCompare(b.name) : a.status === 'overdue' ? -1 : 1));
}

export type AttentionFilter = 'all' | 'overdue' | 'due-today';

export const filterAttention = (rows: readonly AttentionRow[], filter: AttentionFilter): AttentionRow[] =>
  filter === 'all' ? [...rows] : rows.filter((r) => r.status === filter);

/** Properties with an unpaid balance, with how much each owes (for choosing where to record a payment). */
export function propertiesOwing(rows: readonly DashboardRow[]): { propertyId: string; propertyName: string; amountInr: number }[] {
  const by = new Map<string, { propertyId: string; propertyName: string; amountInr: number }>();
  for (const r of rows) {
    if (r.row.remainingInr <= 0) continue;
    const cur = by.get(r.propertyId) ?? { propertyId: r.propertyId, propertyName: r.propertyName, amountInr: 0 };
    cur.amountInr += r.row.remainingInr;
    by.set(r.propertyId, cur);
  }
  return [...by.values()].sort((a, b) => b.amountInr - a.amountInr);
}

export function greeting(nowMs: number): string {
  const h = new Date(nowMs).getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}
