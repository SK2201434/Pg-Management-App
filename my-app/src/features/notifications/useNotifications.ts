import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { selectOwner } from '@/features/auth/ownerAuthSelectors';
import { useOwnerPropertyData } from '@/features/dashboard/useOwnerPropertyData';
import { buildNotifications, unreadIds, type OwnerNotification } from '@/features/notifications/notificationsModel';
import { fetchReadIds, saveReadIds } from '@/features/notifications/notificationService';
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
  const reads = useQuery({ queryKey: readsKey(uid), queryFn: () => fetchReadIds(uid as string), enabled: uid !== undefined });

  const indexes = source.list.map((_, i) => i);
  const rentState = source.stateOf([source.charges, source.payments, source.tenants], indexes);

  const items = useMemo<NotificationItem[] | null>(() => {
    if (source.owned.isSuccess === false || rentState !== 'ready' || reads.isPending) return null;
    const built = buildNotifications(source.data, source.now);
    if (built === null) return null;
    const read = new Set(reads.data ?? []);
    return built.map((n) => ({ ...n, read: read.has(n.id) }));
  }, [source.owned.isSuccess, rentState, source.data, source.now, reads.data, reads.isPending]);

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
      const ids = unreadIds(items, new Set(items.filter((n) => n.read).map((n) => n.id)));
      if (ids.length > 0) markRead.mutate(ids);
    },
  };
}

/** Just the unread count, for the bell. Zero until the data has loaded: no dot is better than a wrong one. */
export function useUnreadCount(): number {
  return useNotifications().unread;
}
