import { useQuery, useQueryClient } from '@tanstack/react-query';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect } from 'react';

import { getFirestoreDb } from '@/config/firebase';
import { selectOwner } from '@/features/auth/ownerAuthSelectors';
import { describeLoadError } from '@/features/discovery/loadError';
import type { OwnerTenantRequest } from '@/features/notifications/notificationsModel';
import { useOwnerProperties } from '@/features/properties/usePropertyQueries';
import { isCategory, toStatus } from '@/features/requests/requestsModel';
import { useAppSelector } from '@/store/hooks';

const EMPTY: OwnerTenantRequest[] = [];
const liveKey = (uid: string | undefined) => ['tenantRequests', 'live', uid] as const;

const text = (v: unknown): string => (typeof v === 'string' ? v : '');
const millis = (v: unknown): number | null => (typeof (v as { toMillis?: unknown } | null)?.toMillis === 'function' ? (v as { toMillis: () => number }).toMillis() : null);

/**
 * Keeps the tenants' maintenance requests for the owner's properties live (one listener per property),
 * so a new request reaches the owner's notifications within a moment. Mounted once, by the bell; every
 * reader uses `useOwnerTenantRequests`.
 */
export function useOwnerTenantRequestsListener(): void {
  const uid = useAppSelector(selectOwner)?.uid;
  const properties = useOwnerProperties().data;
  const queryClient = useQueryClient();
  const signature = properties?.map((p) => `${p.id}:${p.name}`).join('|');

  useEffect(() => {
    if (!uid || !properties) return;
    const db = getFirestoreDb();
    const byProperty = new Map<string, OwnerTenantRequest[]>();
    const publish = () => queryClient.setQueryData<OwnerTenantRequest[]>(liveKey(uid), [...byProperty.values()].flat());

    const unsubscribers = properties.map((p) =>
      onSnapshot(
        query(collection(db, 'properties', p.id, 'requests'), where('ownerUid', '==', uid)),
        (snap) => {
          byProperty.set(
            p.id,
            snap.docs.map((d) => {
              const data = d.data();
              return {
                id: d.id,
                propertyId: p.id,
                propertyName: p.name,
                tenantUid: text(data.tenantUid),
                title: text(data.title) || 'a request',
                category: isCategory(data.category) ? data.category : 'other',
                description: text(data.description),
                status: toStatus(data.status),
                createdMs: millis(data.createdAt),
              };
            }),
          );
          publish();
        },
        (error) => {
          if (__DEV__) console.warn('[tenant-requests] listener failed', JSON.stringify(describeLoadError(error)));
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

/** The tenants' requests as kept live by `useOwnerTenantRequestsListener`. */
export function useOwnerTenantRequests(): OwnerTenantRequest[] {
  const uid = useAppSelector(selectOwner)?.uid;
  const { data } = useQuery({ queryKey: liveKey(uid), queryFn: () => EMPTY, initialData: EMPTY, staleTime: Infinity, gcTime: Infinity, enabled: false });
  return data;
}
