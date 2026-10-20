import { useQueries } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { selectOwner } from '@/features/auth/ownerAuthSelectors';
import type { PropertyData } from '@/features/dashboard/dashboardModel';
import { fetchPropertyRooms, fetchPropertyTenants } from '@/features/properties/propertyService';
import { propertyRoomsQueryKey, propertyTenantsQueryKey, useOwnerProperties } from '@/features/properties/usePropertyQueries';
import { fetchPayments, fetchRentCharges } from '@/features/rent/rentService';
import { paymentsKey, rentChargesKey } from '@/features/rent/useRentQueries';
import { useAppSelector } from '@/store/hooks';

export type QueryState = { isError: boolean; isSuccess: boolean };

/**
 * Everything the app loads per owned property, in one place: rooms and beds, tenants, rent charges
 * and payments. One query of each kind per property (each limited to that property and the owner by
 * the rules), under the same query keys the individual screens use, so the dashboard and the
 * notifications share one cache and nothing is fetched twice.
 */
export function useOwnerPropertyData() {
  const ownerUid = useAppSelector(selectOwner)?.uid;
  const owned = useOwnerProperties();
  const list = useMemo(() => owned.data ?? [], [owned.data]);
  const enabled = ownerUid !== undefined;
  const [now] = useState(Date.now);

  const rooms = useQueries({
    queries: list.map((p) => ({ queryKey: propertyRoomsQueryKey(ownerUid, p.id), queryFn: () => fetchPropertyRooms(p.id, ownerUid as string), enabled })),
  });
  const tenants = useQueries({
    queries: list.map((p) => ({ queryKey: propertyTenantsQueryKey(ownerUid, p.id), queryFn: () => fetchPropertyTenants(p.id, ownerUid as string), enabled })),
  });
  const charges = useQueries({
    queries: list.map((p) => ({ queryKey: rentChargesKey(ownerUid, p.id), queryFn: () => fetchRentCharges(p.id, ownerUid as string), enabled })),
  });
  const payments = useQueries({
    queries: list.map((p) => ({ queryKey: paymentsKey(ownerUid, p.id), queryFn: () => fetchPayments(p.id, ownerUid as string), enabled })),
  });

  const retryAll = () => {
    owned.refetch();
    for (const group of [rooms, tenants, charges, payments]) for (const q of group) if (q.isError) q.refetch();
  };

  const data = useMemo<PropertyData[]>(
    () =>
      list.map((p, i) => ({
        id: p.id,
        name: p.name,
        rooms: rooms[i]?.data ?? null,
        tenants: tenants[i]?.data ?? null,
        charges: charges[i]?.data ?? null,
        payments: payments[i]?.data ?? null,
      })),
    [list, rooms, tenants, charges, payments],
  );

  /** error > loading > ready across the given query groups, for the properties at `indexes`. */
  const stateOf = (groups: QueryState[][], indexes: number[]): 'error' | 'loading' | 'ready' => {
    const qs = indexes.flatMap((i) => groups.map((g) => g[i]).filter((q): q is QueryState => !!q));
    if (qs.some((q) => q.isError)) return 'error';
    return qs.every((q) => q.isSuccess) ? 'ready' : 'loading';
  };

  return { owned, list, data, now, rooms, tenants, charges, payments, retryAll, stateOf };
}
