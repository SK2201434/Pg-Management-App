import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { useMyStayRequestViews } from '@/features/discovery/useMyStayRequestViews';
import { buildStayDecisionNotifications } from '@/features/tenantNotifications/tenantNotificationsModel';
import { selectOwner } from '@/features/auth/ownerAuthSelectors';
import type { TenantStay } from '@/features/tenantHome/tenantHomeModel';
import { fetchPropertyUpdates } from '@/features/tenantHome/updatesService';
import { updatesAccess, type TenantUpdate, type UpdatesAccess } from '@/features/tenantHome/updatesModel';
import { useReadMarks } from '@/features/tenantNotifications/useReadMarks';
import { useAppSelector } from '@/store/hooks';

export const tenantUpdatesKey = (uid: string | undefined, propertyId: string | undefined) => ['tenantUpdates', uid, propertyId] as const;

/**
 * The property updates a tenant may see, and whether the stay window allows reading them now. The
 * read runs only while `access === 'open'` (the rules enforce the same window with the server
 * clock). `read` comes from the tenant's own read marks.
 */
export function useTenantUpdates(stay: TenantStay | undefined): { items: TenantUpdate[]; access: UpdatesAccess | null; isPending: boolean; isError: boolean } {
  const uid = useAppSelector(selectOwner)?.uid;
  const [now] = useState(Date.now);
  const active = stay?.state === 'active' ? stay : undefined;
  const access = active ? updatesAccess(now, active.checkInMs, active.checkOutMs) : null;
  const query = useQuery({
    queryKey: tenantUpdatesKey(uid, active?.propertyId),
    queryFn: () => fetchPropertyUpdates(active?.propertyId as string),
    enabled: uid !== undefined && active !== undefined && access === 'open',
    retry: false,
  });
  const { reads } = useReadMarks();
  const myRequests = useMyStayRequestViews();
  const propertyId = active?.propertyId;
  const items = useMemo(() => {
    const readSet = new Set(reads.data ?? []);
    const fromProperty = (query.data ?? []).map((u) => ({ ...u, read: readSet.has(`upd_${propertyId}_${u.id}`) }));
    // When an owner decides a stay request it also shows here. It shares the notification's id, so
    // reading it in either place marks it read in both.
    const names = new Map(myRequests.items.flatMap((r) => (r.propertyName ? [[r.propertyId, r.propertyName] as [string, string]] : [])));
    const decisions = buildStayDecisionNotifications(myRequests.items, names).map(
      (n): TenantUpdate => ({ id: n.id, title: n.title, message: n.body, category: 'notice', createdMs: n.atMs ?? now, publisher: null, read: readSet.has(n.id) }),
    );
    return [...fromProperty, ...decisions];
  }, [query.data, reads.data, propertyId, myRequests.items, now]);
  return { items, access, isPending: access === 'open' && query.isPending, isError: query.isError };
}
