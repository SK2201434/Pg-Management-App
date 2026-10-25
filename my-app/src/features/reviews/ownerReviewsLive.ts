import { useQuery, useQueryClient } from '@tanstack/react-query';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useEffect } from 'react';

import { getFirestoreDb } from '@/config/firebase';
import { selectOwner } from '@/features/auth/ownerAuthSelectors';
import { describeLoadError } from '@/features/discovery/loadError';
import type { OwnerReviewEvent } from '@/features/notifications/notificationsModel';
import { useOwnerProperties } from '@/features/properties/usePropertyQueries';
import { reviewerLabel } from '@/features/reviews/reviewsModel';
import { useAppSelector } from '@/store/hooks';

// The newest reviews per property are enough for the owner's notifications.
const PER_PROPERTY = 20;
const EMPTY: OwnerReviewEvent[] = [];
const liveKey = (uid: string | undefined) => ['ownerReviews', 'live', uid] as const;

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const millis = (v: unknown): number | null => (typeof (v as { toMillis?: unknown } | null)?.toMillis === 'function' ? (v as { toMillis: () => number }).toMillis() : null);

/**
 * Keeps the newest reviews of each of the owner's properties live (one listener per property), so a
 * review a resident writes reaches the owner's notifications within a moment. Mounted once, by the bell.
 */
export function useOwnerReviewsListener(): void {
  const uid = useAppSelector(selectOwner)?.uid;
  const properties = useOwnerProperties().data;
  const queryClient = useQueryClient();
  const signature = properties?.map((p) => `${p.id}:${p.name}`).join('|');

  useEffect(() => {
    if (!uid || !properties) return;
    const db = getFirestoreDb();
    const byProperty = new Map<string, OwnerReviewEvent[]>();
    const publish = () => queryClient.setQueryData<OwnerReviewEvent[]>(liveKey(uid), [...byProperty.values()].flat());

    const unsubscribers = properties.map((p) =>
      onSnapshot(
        query(collection(db, 'properties', p.id, 'reviews'), orderBy('createdAt', 'desc'), limit(PER_PROPERTY)),
        (snap) => {
          byProperty.set(
            p.id,
            snap.docs.flatMap((d) => {
              const data = d.data();
              const rating = data.rating;
              if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) return [];
              // A review whose server time has not arrived yet is the reviewer's own pending write; it has no id yet.
              const createdMs = millis(data.createdAt);
              if (createdMs === null) return [];
              return [{ id: d.id, propertyId: p.id, propertyName: p.name, tenantName: reviewerLabel(text(data.tenantName)), rating, comment: text(data.comment), createdMs }];
            }),
          );
          publish();
        },
        (error) => {
          if (__DEV__) console.warn('[owner-reviews] listener failed', JSON.stringify(describeLoadError(error)));
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

/** The reviews as kept live by `useOwnerReviewsListener`. */
export function useOwnerReviewEvents(): OwnerReviewEvent[] {
  const uid = useAppSelector(selectOwner)?.uid;
  const { data } = useQuery({ queryKey: liveKey(uid), queryFn: () => EMPTY, initialData: EMPTY, staleTime: Infinity, gcTime: Infinity, enabled: false });
  return data;
}
