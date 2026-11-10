import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { selectOwner } from '@/features/auth/ownerAuthSelectors';
import { useOwnerPropertyData } from '@/features/dashboard/useOwnerPropertyData';
import { useOwnerTenantRequests } from '@/features/requests/ownerRequestsLive';
import { useOwnerReviewEvents } from '@/features/reviews/ownerReviewsLive';
import { buildPhoneMatchNotifications } from '@/features/phoneMatch/phoneMatchModel';
import { usePhoneMatches } from '@/features/phoneMatch/usePhoneMatches';
import { buildNotifications, buildReviewNotifications, buildTenantRequestNotifications, type OwnerNotification } from '@/features/notifications/notificationsModel';
import { fetchReadIds, saveReadIds } from '@/features/notifications/notificationService';
import { buildStayRequestNotifications } from '@/features/stayRequests/stayRequestsModel';
import { useStayRequests } from '@/features/stayRequests/stayRequestsLive';
import { useAppSelector } from '@/store/hooks';

// The key carries the uid, so one account's read marks are never shown for another.
const readsKey = (uid: string | undefined) => ['notificationReads', uid] as const;

export type NotificationItem = OwnerNotification & { read: boolean };

/**
 * The signed-in owner's notifications, with read state. The rent data comes from the same per-property
 * queries the dashboard uses (one shared cache, no extra requests); the read marks are one more small
 * query. Marking read updates the cache at once, so the bell dot reacts immediately.
 */
export function useNotifications() {
  const uid = useAppSelector(selectOwner)?.uid;
  const queryClient = useQueryClient();
  const source = useOwnerPropertyData();
  const stayRequests = useStayRequests();
  const tenantRequests = useOwnerTenantRequests();
  const reviewEvents = useOwnerReviewEvents();
  const phoneMatches = usePhoneMatches();
  const reads = useQuery({ queryKey: readsKey(uid), queryFn: () => fetchReadIds(uid as string), enabled: uid !== undefined });

  const indexes = source.list.map((_, i) => i);
  const rentState = source.stateOf([source.charges, source.payments, source.tenants], indexes);

  const items = useMemo<NotificationItem[] | null>(() => {
    if (source.owned.isSuccess === false || rentState !== 'ready' || reads.isPending) return null;
    const built = buildNotifications(source.data, source.now);
    if (built === null) return null;
    const read = new Set(reads.data ?? []);
    // Tenants' stay requests arrive live and sit among the rent notifications, newest first.
    const names = new Map(source.data.flatMap((p) => (p.tenants ?? []).map((t) => [t.tenantUid, t.name] as const)));
    const all = [
      ...built,
      ...buildStayRequestNotifications(stayRequests.items, source.now),
      ...buildTenantRequestNotifications(tenantRequests, names, source.now),
      ...buildReviewNotifications(reviewEvents, source.now),
      ...buildPhoneMatchNotifications(phoneMatches.matches, source.now),
    ].sort((a, b) => b.atMs - a.atMs || a.id.localeCompare(b.id));
    return all.map((n) => ({ ...n, read: n.autoRead === true || read.has(n.id) }));
  }, [source.owned.isSuccess, rentState, source.data, source.now, reads.data, reads.isPending, stayRequests.items, tenantRequests, reviewEvents, phoneMatches.matches]);

  const markRead = useMutation<boolean, Error, string[]>({
    mutationFn: (ids) => saveReadIds(uid as string, ids),
    onMutate: (ids) => {
      queryClient.setQueryData<string[]>(readsKey(uid), (old) => [...new Set([...(old ?? []), ...ids])]);
    },
  });

  const unread = items ? items.filter((n) => !n.read).length : 0;
  return {
    items,
    unread,
    isPending: source.owned.isPending || (source.owned.isSuccess && (rentState === 'loading' || reads.isPending)),
    isError: source.owned.isError || rentState === 'error',
    retry: source.retryAll,
    markRead: (ids: string[]) => {
      const fresh = ids.filter((id) => items?.find((n) => n.id === id && !n.read));
      if (fresh.length > 0) markRead.mutate(fresh);
    },
    markAllRead: () => {
      if (!items) return;
      const ids = items.filter((n) => !n.read).map((n) => n.id);
      if (ids.length > 0) markRead.mutate(ids);
    },
  };
}

/** Just the unread count, for the bell. Zero until the data has loaded: no dot is better than a wrong one. */
export function useUnreadCount(): number {
  return useNotifications().unread;
}
