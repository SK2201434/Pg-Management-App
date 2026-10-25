import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';

import { fetchListing } from '@/features/discovery/discoveryService';
import { useMyStayRequests } from '@/features/discovery/myStayRequestsLive';
import { sortMyStayRequests, type MyStayRequest } from '@/features/tenantNotifications/tenantNotificationsModel';

export type MyStayRequestView = MyStayRequest & { propertyName: string | null };

/**
 * The tenant's own stay requests (live), each with its property's name. The name comes from the
 * property's public listing; it is null while loading, or if the owner has since unlisted the property.
 */
export function useMyStayRequestViews(): { items: MyStayRequestView[]; ready: boolean } {
  const live = useMyStayRequests();
  const ids = [...new Set(live.items.map((r) => r.propertyId))];
  const names = useQueries({ queries: ids.map((id) => ({ queryKey: ['listing', id] as const, queryFn: () => fetchListing(id), retry: false })) });
  const signature = ids.map((id, i) => `${id}:${names[i]?.data?.name ?? ''}`).join('|');
  const items = useMemo(() => {
    const byId = new Map(ids.map((id, i) => [id, names[i]?.data?.name ?? null] as const));
    return sortMyStayRequests(live.items).map((r) => ({ ...r, propertyName: byId.get(r.propertyId) ?? null }));
    // `signature` stands for the resolved names, which are rebuilt on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.items, signature]);
  return { items, ready: live.ready };
}
