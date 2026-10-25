import {
  attentionRows,
  collectedThisMonth,
  computeOccupancy,
  dueSoonRows,
  propertiesOwing,
  rentRows,
  scopeProperties,
  summarizeDueSoon,
} from '@/features/dashboard/dashboardModel';
import type { Metric, OwnerDashboardData } from '@/features/dashboard/dashboardTypes';
import { useOwnerPropertyData } from '@/features/dashboard/useOwnerPropertyData';

const LOADING: Metric<never> = { status: 'loading' };

/**
 * Dashboard data for the signed-in owner, optionally scoped to one property (`null` = all).
 *
 * Switching the scope only filters what is already loaded, so a previous selection can never show
 * through. A metric is `ready` only when every query it depends on, for the properties in scope, has
 * succeeded; otherwise it is loading or an error with a retry.
 */
export function useOwnerDashboard(propertyId: string | null): OwnerDashboardData {
  const { owned, list, data, now, rooms, tenants, charges, payments, retryAll, stateOf } = useOwnerPropertyData();

  if (owned.isPending) {
    return { properties: LOADING, occupancy: LOADING, outstandingRent: LOADING, hasCharges: false, monthlyCollection: LOADING, upcomingRent: LOADING, needsAttention: LOADING, owing: [] };
  }
  if (owned.isError) {
    const error: Metric<never> = { status: 'error', retry: retryAll };
    return { properties: error, occupancy: error, outstandingRent: error, hasCharges: false, monthlyCollection: error, upcomingRent: error, needsAttention: error, owing: [] };
  }

  const scoped = scopeProperties(data, propertyId);
  const indexes = list.map((p, i) => ({ id: p.id, i })).filter((x) => propertyId === null || x.id === propertyId).map((x) => x.i);

  const wrap = <T,>(state: 'error' | 'loading' | 'ready', make: () => T | null): Metric<T> => {
    if (state === 'error') return { status: 'error', retry: retryAll };
    if (state === 'loading') return LOADING;
    const value = make();
    return value === null ? LOADING : { status: 'ready', value };
  };

  const bedState = stateOf([rooms], indexes);
  const rentState = stateOf([charges, payments, tenants], indexes);
  const rows = rentState === 'ready' ? rentRows(scoped, now) : null;

  return {
    properties: { status: 'ready', value: list.map((p) => ({ id: p.id, name: p.name })) },
    occupancy: wrap(bedState, () => computeOccupancy(scoped)),
    // Overdue + due today + due within 7 days: what the owner should be collecting now (the Needs Attention rows).
    outstandingRent: wrap(rentState, () => (rows ? summarizeDueSoon(attentionRows(scoped, rows, now)) : null)),
    hasCharges: !!rows && rows.length > 0,
    monthlyCollection: wrap(rentState, () => {
      const amountInr = collectedThisMonth(scoped, now);
      return amountInr === null ? null : { amountInr };
    }),
    upcomingRent: wrap(rentState, () => (rows ? summarizeDueSoon(dueSoonRows(scoped, rows, now)) : null)),
    needsAttention: wrap(rentState, () => (rows ? attentionRows(scoped, rows, now) : null)),
    owing: rows ? propertiesOwing(rows) : [],
  };
}
