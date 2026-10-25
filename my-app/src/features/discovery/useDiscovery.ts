import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { selectOwner } from '@/features/auth/ownerAuthSelectors';
import { myStayRequestsLiveKey, stayRequestKey } from '@/features/discovery/stayRequestKeys';
import type { LiveMyStayRequests } from '@/features/discovery/myStayRequestsLive';
import { fetchListing, fetchListingsPage, fetchMyStayRequest, sendStayRequest, withdrawStayRequest } from '@/features/discovery/discoveryService';
import type { Listing, StayRequest } from '@/features/discovery/discoveryModel';
import { useAppSelector } from '@/store/hooks';

/** The value after it has stopped changing for `ms`, so typing does not re-filter on every key. */
export function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

export const listingsKey = ['listings'] as const;
const listingKey = (id: string) => ['listing', id] as const;
export { stayRequestKey };

/**
 * The publicly listed properties, one page at a time (infinite scroll). The first page is re-read
 * every time the screen opens, so a property an owner has just listed shows up at once.
 */
export function useListings() {
  return useInfiniteQuery({
    queryKey: listingsKey,
    queryFn: ({ pageParam }) => fetchListingsPage(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    staleTime: 0,
    refetchOnMount: 'always',
    retry: false,
  });
}

export function useListing(propertyId: string) {
  return useQuery({ queryKey: listingKey(propertyId), queryFn: () => fetchListing(propertyId), retry: false });
}

export function useMyStayRequest(propertyId: string) {
  const uid = useAppSelector(selectOwner)?.uid;
  return useQuery({
    queryKey: stayRequestKey(uid, propertyId),
    queryFn: () => fetchMyStayRequest(propertyId, uid as string),
    enabled: uid !== undefined,
    retry: false,
  });
}

/** Sends or withdraws the tenant's request; the status refetches only after Firestore confirms the write. */
export function useStayRequestActions(listing: Listing | null | undefined) {
  const uid = useAppSelector(selectOwner)?.uid;
  const queryClient = useQueryClient();
  const refresh = (_: unknown, input: unknown) => {
    // Show the request in "My requests" at once; the live listener replaces this with the stored copy.
    const sent = input as { message?: string; existing?: StayRequest | null } | undefined;
    if (uid !== undefined && listing) {
      const status = sent && 'tenantName' in sent ? 'pending' : 'withdrawn';
      const message = sent && 'tenantName' in sent ? sent.message?.trim() || null : null;
      queryClient.setQueryData<LiveMyStayRequests>(myStayRequestsLiveKey(uid), (cur) => {
        const now = Date.now();
        const prev = cur?.items.find((r) => r.propertyId === listing.id);
        const next = { propertyId: listing.id, status, message: message ?? prev?.message ?? null, createdMs: prev?.createdMs ?? now, updatedMs: now } as const;
        return { items: [...(cur?.items.filter((r) => r.propertyId !== listing.id) ?? []), next], ready: cur?.ready ?? false };
      });
    }
    return queryClient.invalidateQueries({ queryKey: stayRequestKey(uid, listing?.id ?? '') });
  };
  const send = useMutation<void, Error, { tenantName: string; tenantPhone: string | null; tenantGender?: 'male' | 'female' | null; tenantEmail?: string | null; message: string; existing: StayRequest | null }>({
    mutationFn: (input) => {
      if (uid === undefined || !listing) return Promise.reject(new Error('Not ready'));
      return sendStayRequest({ listing, tenantUid: uid, ...input });
    },
    onSuccess: refresh,
  });
  const withdraw = useMutation<void, Error, void>({
    mutationFn: () => {
      if (uid === undefined || !listing) return Promise.reject(new Error('Not ready'));
      return withdrawStayRequest(listing.id, uid);
    },
    onSuccess: refresh,
  });
  return { send, withdraw };
}
