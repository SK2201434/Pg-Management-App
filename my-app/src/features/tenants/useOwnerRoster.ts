import { useQueries } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { selectOwner } from '@/features/auth/ownerAuthSelectors';
import { fetchPropertyTenants } from '@/features/properties/propertyService';
import { propertyTenantsQueryKey, useOwnerProperties } from '@/features/properties/usePropertyQueries';
import { buildLedger } from '@/features/rent/rentModel';
import { fetchPayments, fetchRentCharges } from '@/features/rent/rentService';
import { paymentsKey, rentChargesKey } from '@/features/rent/useRentQueries';
import { sortRoster, tenantRent, type RosterTenant } from '@/features/tenants/rosterModel';
import { useAppSelector } from '@/store/hooks';

/**
 * The owner's roster across their own properties. There is one tenant/charge/payment query per owned
 * property (each limited to that property and the owner's uid, as the rules require; the rules allow
 * no cross-property query), cached under the same keys the per-property screens use. Rent figures
 * are `available` only when every rent query succeeded.
 */
export function useOwnerRoster() {
  const ownerUid = useAppSelector(selectOwner)?.uid;
  const properties = useOwnerProperties();
  const list = useMemo(() => properties.data ?? [], [properties.data]);
  const enabled = ownerUid !== undefined;
  const [now] = useState(Date.now);

  const tenantQs = useQueries({
    queries: list.map((p) => ({
      queryKey: propertyTenantsQueryKey(ownerUid, p.id),
      queryFn: () => fetchPropertyTenants(p.id, ownerUid as string),
      enabled,
    })),
  });
  const chargeQs = useQueries({
    queries: list.map((p) => ({
      queryKey: rentChargesKey(ownerUid, p.id),
      queryFn: () => fetchRentCharges(p.id, ownerUid as string),
      enabled,
    })),
  });
  const paymentQs = useQueries({
    queries: list.map((p) => ({
      queryKey: paymentsKey(ownerUid, p.id),
      queryFn: () => fetchPayments(p.id, ownerUid as string),
      enabled,
    })),
  });

  const tenantsLoaded = tenantQs.every((q) => q.isSuccess);
  const tenantsFailed = tenantQs.some((q) => q.isError);
  const rentAvailable = chargeQs.every((q) => q.isSuccess) && paymentQs.every((q) => q.isSuccess);

  const roster = useMemo<RosterTenant[]>(() => {
    const out: RosterTenant[] = [];
    list.forEach((property, i) => {
      const members = tenantQs[i]?.data;
      if (!members) return;
      const charges = chargeQs[i]?.data;
      const payments = paymentQs[i]?.data;
      const names = new Map(members.map((m) => [m.tenantUid, m.name]));
      const ledger = charges && payments ? buildLedger(charges, payments, names, now) : null;
      for (const m of members) {
        out.push({
          key: `${property.id}:${m.tenantUid}`,
          tenantUid: m.tenantUid,
          name: m.name,
          propertyId: property.id,
          propertyName: property.name,
          status: m.status,
          placement: m.roomNumber ? `Room ${m.roomNumber} · ${m.bedLabel ?? 'Bed'}` : null,
          rent: ledger ? tenantRent(ledger.filter((r) => r.charge.tenantUid === m.tenantUid)) : { kind: 'none' },
        });
      }
    });
    return sortRoster(out);
  }, [list, tenantQs, chargeQs, paymentQs, now]);

  const refetch = () => {
    properties.refetch();
    tenantQs.forEach((q) => q.refetch());
    chargeQs.forEach((q) => q.refetch());
    paymentQs.forEach((q) => q.refetch());
  };

  return {
    properties: list,
    isPending: properties.isPending || (properties.isSuccess && !tenantsLoaded && !tenantsFailed),
    isError: properties.isError || tenantsFailed,
    error: properties.error ?? tenantQs.find((q) => q.isError)?.error,
    isRefetching: properties.isRefetching || tenantQs.some((q) => q.isRefetching),
    roster,
    rentAvailable: properties.isSuccess && tenantsLoaded && rentAvailable,
    refetch,
  };
}
