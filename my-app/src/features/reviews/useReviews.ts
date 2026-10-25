import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { selectOwner } from '@/features/auth/ownerAuthSelectors';
import { useState } from 'react';

import { reviewEligibility, type ReviewInput } from '@/features/reviews/reviewsModel';
import { deleteReview, fetchMembership, fetchMyReview, fetchReviewsPage, fetchReviewSummary, saveReview } from '@/features/reviews/reviewsService';
import { useAppSelector } from '@/store/hooks';

const base = (propertyId: string) => ['reviews', propertyId] as const;

export function useReviewSummary(propertyId: string) {
  return useQuery({ queryKey: [...base(propertyId), 'summary'], queryFn: () => fetchReviewSummary(propertyId), retry: false });
}

/** Reviews, newest first, a page at a time. */
export function useReviewList(propertyId: string) {
  return useInfiniteQuery({
    queryKey: [...base(propertyId), 'list'],
    queryFn: ({ pageParam }) => fetchReviewsPage(propertyId, pageParam),
    initialPageParam: null as number | null,
    getNextPageParam: (last) => last.nextCursor,
    retry: false,
  });
}

export function useMyReview(propertyId: string) {
  const uid = useAppSelector(selectOwner)?.uid;
  return useQuery({ queryKey: [...base(propertyId), 'mine', uid], queryFn: () => fetchMyReview(propertyId, uid as string), enabled: uid !== undefined, retry: false });
}

/** Whether the signed-in user may add or change a review now (see reviewEligibility). */
export function useReviewEligibility(propertyId: string) {
  const uid = useAppSelector(selectOwner)?.uid;
  const [now] = useState(Date.now);
  return useQuery({
    queryKey: [...base(propertyId), 'eligibility', uid],
    queryFn: async () => reviewEligibility(await fetchMembership(propertyId, uid as string), now),
    enabled: uid !== undefined,
    retry: false,
  });
}

/** Saves or deletes the resident's review, then refreshes the summary, the list and their own review. */
export function useReviewActions(propertyId: string, tenantName: string | null) {
  const uid = useAppSelector(selectOwner)?.uid;
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: base(propertyId) });
  const save = useMutation<void, Error, { input: ReviewInput; existing: boolean }>({
    mutationFn: ({ input, existing }) => {
      if (uid === undefined || tenantName === null) return Promise.reject(new Error('Not ready'));
      return saveReview({ propertyId, uid, tenantName, input, existing });
    },
    onSuccess: refresh,
  });
  const remove = useMutation<void, Error, void>({
    mutationFn: () => (uid === undefined ? Promise.reject(new Error('Not ready')) : deleteReview(propertyId, uid)),
    onSuccess: refresh,
  });
  return { save, remove };
}
