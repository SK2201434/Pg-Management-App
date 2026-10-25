import { useMemo } from 'react';

import { useMyStayRequestViews } from '@/features/discovery/useMyStayRequestViews';

import { useTenantRequests } from '@/features/requests/useTenantRequests';
import { useTenantStay } from '@/features/tenantHome/useTenantStay';
import { useTenantUpdates } from '@/features/tenantHome/useTenantUpdates';
import { selectOwner } from '@/features/auth/ownerAuthSelectors';
import { useStayChange } from '@/features/stayChange/useStayChange';
import { useAppSelector } from '@/store/hooks';
import { useMyRentReminders } from '@/features/rent/useRentReminders';
import { buildRentReminderNotifications, buildStayChangeNotifications, buildStayDecisionNotifications, buildTenantNotifications, type TenantNotification } from '@/features/tenantNotifications/tenantNotificationsModel';
import { useReadMarks } from '@/features/tenantNotifications/useReadMarks';

export type TenantNotificationItem = TenantNotification & { read: boolean };

/**
 * The signed-in tenant's notifications with read state. They share the stay, request and update
 * queries with the other tenant screens (one cache, no extra reads); the read marks are one small
 * query. With no active stay there is nothing to list.
 */
export function useTenantNotifications() {
  const stay = useTenantStay();
  const requests = useTenantRequests(stay.data);
  const updates = useTenantUpdates(stay.data);
  const { reads, mark } = useReadMarks();
  const uid = useAppSelector(selectOwner)?.uid;
  const stayChange = useStayChange(stay.data?.state === 'active' ? stay.data.propertyId : undefined, uid);
  const reminders = useMyRentReminders(stay.data?.state === 'active' ? stay.data.propertyId : undefined);
  const active = stay.data?.state === 'active' ? stay.data : null;
  const myRequests = useMyStayRequestViews();
  const nameMap = useMemo(() => new Map(myRequests.items.flatMap((r) => (r.propertyName ? [[r.propertyId, r.propertyName] as [string, string]] : []))), [myRequests.items]);

  const items = useMemo<TenantNotificationItem[] | null>(() => {
    if (stay.isPending || reads.isPending) return null;
    if (active !== null && (requests.isPending || updates.isPending)) return null;
    const read = new Set(reads.data ?? []);
    const own =
      active === null ? [] : buildTenantNotifications({ propertyId: active.propertyId, propertyName: active.propertyName, requests: requests.data ?? [], updates: updates.items });
    // The owner's decisions on stay requests arrive live and do not need an active stay.
    const decisions = buildStayDecisionNotifications(myRequests.items, nameMap);
    // Rent reminders the owner sent (a failed read just means none are shown).
    const rent = active === null ? [] : buildRentReminderNotifications(reminders.data ?? [], active.propertyName);
    const change = active === null ? [] : buildStayChangeNotifications(stayChange.data ?? null, active.propertyName);
    return [...own, ...decisions, ...rent, ...change]
      .sort((a, b) => (b.atMs ?? Number.MAX_SAFE_INTEGER) - (a.atMs ?? Number.MAX_SAFE_INTEGER) || a.id.localeCompare(b.id))
      .map((n) => ({ ...n, read: read.has(n.id) }));
  }, [stay.isPending, reads.isPending, reads.data, active, requests.isPending, requests.data, updates.isPending, updates.items, myRequests.items, nameMap, reminders.data, stayChange.data]);

  const unread = items ? items.filter((n) => !n.read).length : 0;
  return {
    items,
    unread,
    isPending: stay.isPending || reads.isPending || (active !== null && (requests.isPending || updates.isPending)),
    // Updates only fail when the stay window is closed (denied), which is not an error to show.
    isError: stay.isError || (active !== null && requests.isError),
    retry: () => {
      stay.refetch();
      requests.refetch();
    },
    markRead: (ids: string[]) => {
      const fresh = ids.filter((id) => items?.find((n) => n.id === id && !n.read));
      if (fresh.length > 0) mark.mutate(fresh);
    },
    markAllRead: () => {
      const ids = items?.filter((n) => !n.read).map((n) => n.id) ?? [];
      if (ids.length > 0) mark.mutate(ids);
    },
  };
}
