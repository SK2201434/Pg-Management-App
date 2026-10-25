import { useQuery, useQueryClient } from '@tanstack/react-query';
import { collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { useEffect } from 'react';

import { getFirestoreDb } from '@/config/firebase';
import { selectOwner } from '@/features/auth/ownerAuthSelectors';
import { describeLoadError } from '@/features/discovery/loadError';
import { useOwnerProperties } from '@/features/properties/usePropertyQueries';
import type { OwnerStayRequest, OwnerStayRequestStatus } from '@/features/stayRequests/stayRequestsModel';
import { useAppSelector } from '@/store/hooks';

export type LiveStayRequests = { items: OwnerStayRequest[]; ready: boolean; failed: boolean };

const EMPTY: LiveStayRequests = { items: [], ready: false, failed: false };
const liveKey = (uid: string | undefined) => ['stayRequests', 'live', uid] as const;

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const millis = (v: unknown): number | null => (typeof (v as { toMillis?: unknown } | null)?.toMillis === 'function' ? (v as { toMillis: () => number }).toMillis() : null);
const STATUSES: readonly OwnerStayRequestStatus[] = ['pending', 'approved', 'rejected', 'withdrawn'];

/**
 * Keeps the owner's stay requests live: one Firestore listener per property, so a request a tenant
 * sends reaches the owner's app within a moment, without a refresh. It is mounted ONCE (by the
 * notification bell, which is always on screen) and writes into the query cache; every screen reads
 * the same data through `useStayRequests`, so there are no duplicate listeners. It works while the
 * app is open; with the app closed there is no push, because that needs a server.
 */
export function useStayRequestsListener(): void {
  const uid = useAppSelector(selectOwner)?.uid;
  const properties = useOwnerProperties().data;
  const queryClient = useQueryClient();
  const signature = properties?.map((p) => `${p.id}:${p.name}`).join('|');

  useEffect(() => {
    if (!uid || !properties) return;
    const db = getFirestoreDb();
    const byProperty = new Map<string, OwnerStayRequest[]>();
    let failed = false;
    const publish = () =>
      queryClient.setQueryData<LiveStayRequests>(liveKey(uid), {
        items: [...byProperty.values()].flat(),
        ready: byProperty.size === properties.length,
        failed,
      });
    publish();

    const unsubscribers = properties.map((p) =>
      onSnapshot(
        query(collection(db, 'properties', p.id, 'stayRequests'), where('ownerUid', '==', uid)),
        (snap) => {
          byProperty.set(
            p.id,
            snap.docs.flatMap((d) => {
              const data = d.data();
              const tenantName = text(data.tenantName);
              if (tenantName === null) return [];
              return [
                {
                  propertyId: p.id,
                  propertyName: p.name,
                  tenantUid: d.id,
                  tenantName,
                  tenantPhone: text(data.tenantPhone),
                  tenantGender: data.tenantGender === 'male' || data.tenantGender === 'female' ? data.tenantGender : null,
                  tenantEmail: text(data.tenantEmail),
                  message: text(data.message),
                  status: STATUSES.includes(data.status) ? (data.status as OwnerStayRequestStatus) : 'pending',
                  createdMs: millis(data.createdAt),
                  updatedMs: millis(data.updatedAt),
                },
              ];
            }),
          );
          publish();
        },
        (error) => {
          // A listener that fails (for example before the rules are deployed) must not block the
          // rest of the owner's notifications: it counts as loaded, with no requests.
          if (__DEV__) console.warn('[stay-requests] listener failed', JSON.stringify(describeLoadError(error)));
          failed = true;
          byProperty.set(p.id, []);
          publish();
        },
      ),
    );
    return () => unsubscribers.forEach((u) => u());
    // `signature` stands for the property list, so an unchanged list does not resubscribe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, signature, queryClient]);
}

/** The owner's stay requests as kept live by `useStayRequestsListener`. */
export function useStayRequests(): LiveStayRequests {
  const uid = useAppSelector(selectOwner)?.uid;
  // The listener fills this cache entry; the query itself never fetches.
  const { data } = useQuery({ queryKey: liveKey(uid), queryFn: () => EMPTY, initialData: EMPTY, staleTime: Infinity, gcTime: Infinity, enabled: false });
  return data;
}

/** The owner's decision on a pending request. The rules allow only this change, by the property's owner. */
export async function decideStayRequest(propertyId: string, tenantUid: string, status: 'approved' | 'rejected'): Promise<void> {
  await updateDoc(doc(getFirestoreDb(), 'properties', propertyId, 'stayRequests', tenantUid), { status, updatedAt: serverTimestamp() });
}
