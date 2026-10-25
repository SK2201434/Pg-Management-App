import { useQuery, useQueryClient } from '@tanstack/react-query';
import { collectionGroup, doc, onSnapshot, query, where, type Unsubscribe } from 'firebase/firestore';
import { useEffect } from 'react';

import { getFirestoreDb } from '@/config/firebase';
import { selectOwner } from '@/features/auth/ownerAuthSelectors';
import { STAY_REQUEST_STATUSES } from '@/features/discovery/discoveryModel';
import { describeLoadError } from '@/features/discovery/loadError';
import { myStayRequestsLiveKey, stayRequestKey } from '@/features/discovery/stayRequestKeys';
import { loadStoredStayRequests, saveStoredStayRequests } from '@/features/discovery/myStayRequestsStore';
import type { MyStayRequest } from '@/features/tenantNotifications/tenantNotificationsModel';
import { useAppSelector } from '@/store/hooks';

export type LiveMyStayRequests = { items: MyStayRequest[]; ready: boolean };

const EMPTY: LiveMyStayRequests = { items: [], ready: false };
const liveKey = myStayRequestsLiveKey;
const STATUSES = STAY_REQUEST_STATUSES;

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const millis = (v: unknown): number | null => (typeof (v as { toMillis?: unknown } | null)?.toMillis === 'function' ? (v as { toMillis: () => number }).toMillis() : null);

function toMyStayRequest(data: Record<string, unknown>): MyStayRequest | null {
  const propertyId = text(data.propertyId);
  const status = STATUSES.find((s) => s === data.status);
  return propertyId && status ? { propertyId, status, message: text(data.message), createdMs: millis(data.createdAt), updatedMs: millis(data.updatedAt) } : null;
}

/**
 * Keeps the signed-in tenant's own stay requests live, across every property, with one listener on
 * the `stayRequests` collection group filtered to their uid (the rules allow only that query). When
 * an owner approves or declines, the change reaches the tenant's app within moments: the
 * notification appears and the property page's request status updates. Mounted once, by the
 * tenant's notification bell. It works while the app is open; there is no push for a closed app.
 */
export function useMyStayRequestsListener(): void {
  const uid = useAppSelector(selectOwner)?.uid;
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!uid) return;
    let approved = '';
    let active = true;
    // Show what was last known right away; the server copy (below) replaces it when it arrives.
    void loadStoredStayRequests(uid).then((stored) => {
      if (!active || stored.length === 0) return;
      const cur = queryClient.getQueryData<LiveMyStayRequests>(liveKey(uid));
      if (!cur?.ready && (cur?.items.length ?? 0) === 0) queryClient.setQueryData<LiveMyStayRequests>(liveKey(uid), { items: stored, ready: false });
    });
    // Remember every change, whether it came from the server or from a request just sent.
    const unwatch = queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== 'updated' || event.action.type !== 'success') return;
      const key = event.query.queryKey;
      if (key[0] !== 'myStayRequests' || key[1] !== 'live' || key[2] !== uid) return;
      const data = event.query.state.data as LiveMyStayRequests | undefined;
      if (data && (data.ready || data.items.length > 0)) void saveStoredStayRequests(uid, data.items);
    });
    // An approval makes the tenant a member of the property: re-read their stay when one appears.
    const noteApprovals = (items: readonly MyStayRequest[]) => {
      const nowApproved = items.filter((r) => r.status === 'approved').map((r) => `${r.propertyId}:${r.updatedMs}`).sort().join('|');
      if (nowApproved !== approved) {
        if (approved !== '' || nowApproved !== '') void queryClient.invalidateQueries({ queryKey: ['tenantStay', uid] });
        approved = nowApproved;
      }
    };
    // Fallback when the collection-group query is unavailable: watch each request this tenant is
    // known to have made, one document each (a single read of their own request is always allowed).
    const perDocument: Unsubscribe[] = [];
    const watchKnownRequests = async () => {
      const stored = await loadStoredStayRequests(uid);
      if (!active) return;
      const shown = queryClient.getQueryData<LiveMyStayRequests>(liveKey(uid))?.items ?? [];
      for (const id of new Set([...stored, ...shown].map((r) => r.propertyId))) {
        perDocument.push(
          onSnapshot(
            doc(getFirestoreDb(), 'properties', id, 'stayRequests', uid),
            (snap) => {
              const next = snap.exists() ? toMyStayRequest(snap.data()) : null;
              if (!next) return;
              queryClient.setQueryData<LiveMyStayRequests>(liveKey(uid), (cur) => ({ items: [...(cur?.items.filter((r) => r.propertyId !== id) ?? []), next], ready: true }));
              queryClient.setQueryData(stayRequestKey(uid, id), { status: next.status, message: next.message });
              noteApprovals(queryClient.getQueryData<LiveMyStayRequests>(liveKey(uid))?.items ?? []);
            },
            () => {
              // Nothing more to do for this one; what is already shown stays.
            },
          ),
        );
      }
    };
    const stop = onSnapshot(
      query(collectionGroup(getFirestoreDb(), 'stayRequests'), where('tenantUid', '==', uid)),
      (snap) => {
        const items = snap.docs.flatMap((d): MyStayRequest[] => {
          const r = toMyStayRequest(d.data());
          return r ? [r] : [];
        });
        queryClient.setQueryData<LiveMyStayRequests>(liveKey(uid), { items, ready: true });
        noteApprovals(items);
        // The property page shows the request's status from this cache entry.
        for (const r of items) queryClient.setQueryData(stayRequestKey(uid, r.propertyId), { status: r.status, message: r.message });
      },
      (error) => {
        // Not fatal (for example before the rules and index are deployed): other notifications go on.
        if (__DEV__) console.warn('[my-stay-requests] listener failed', JSON.stringify(describeLoadError(error)));
        // Keep whatever is already shown (e.g. a request just sent) rather than blanking the list.
        queryClient.setQueryData<LiveMyStayRequests>(liveKey(uid), (cur) => ({ items: cur?.items ?? [], ready: true }));
        void watchKnownRequests();
      },
    );
    return () => {
      active = false;
      unwatch();
      stop();
      perDocument.forEach((off) => off());
    };
  }, [uid, queryClient]);
}

/** The tenant's stay requests as kept live by `useMyStayRequestsListener`. */
export function useMyStayRequests(): LiveMyStayRequests {
  const uid = useAppSelector(selectOwner)?.uid;
  const { data } = useQuery({ queryKey: liveKey(uid), queryFn: () => EMPTY, initialData: EMPTY, staleTime: Infinity, gcTime: Infinity, enabled: false });
  return data;
}
