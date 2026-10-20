/**
 * State of one dashboard metric. `unavailable` means no implemented, reachable data source backs
 * it yet; it is never a stand-in for zero. `error` means a source exists but the request failed.
 */
export type Metric<T> =
  | { status: 'loading' }
  | { status: 'error'; retry: () => void }
  | { status: 'unavailable' }
  | { status: 'ready'; value: T };

/** One of the signed-in owner's properties. */
export type PropertyOption = { id: string; name: string };

/** Bed counts for the scope. Occupied = held by a resident; vacant = free to allocate. */
export type OccupancySummary = {
  totalBeds: number;
  occupiedBeds: number;
  vacantBeds: number;
  /** 0–100. */
  occupancyPercentage: number;
};

/** Rupee amount plus the number of distinct tenants it covers. */
export type RentAmount = { amountInr: number; tenantCount: number };

/** An unpaid balance that is overdue or due today, with what is needed to act on it. */
export type AttentionRow = {
  key: string;
  propertyId: string;
  propertyName: string;
  tenantUid: string;
  chargeId: string;
  name: string;
  /** "Room 204 · Bed B" when the tenant was placed in a bed. */
  placement: string | null;
  remainingInr: number;
  status: 'overdue' | 'due-today';
  daysOverdue: number;
  period: string;
};

/**
 * Everything the Owner Home dashboard renders, for the selected property (or all). Tenant issues,
 * join requests, unverified payments and reminders are not part of the app, so they are not here.
 */
export type OwnerDashboardData = {
  properties: Metric<PropertyOption[]>;
  occupancy: Metric<OccupancySummary>;
  outstandingRent: Metric<RentAmount>;
  /** True when at least one rent charge exists in the scope (to tell "nothing owed" from "no charges"). */
  hasCharges: boolean;
  monthlyCollection: Metric<{ amountInr: number }>;
  upcomingRent: Metric<RentAmount>;
  needsAttention: Metric<AttentionRow[]>;
  /** Properties that currently owe rent (to choose where to record a payment). */
  owing: { propertyId: string; propertyName: string; amountInr: number }[];
};
