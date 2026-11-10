import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { selectOwner } from '@/features/auth/ownerAuthSelectors';
import { dismissMatch, fetchPhoneMatches, linkMatch } from '@/features/phoneMatch/phoneMatchService';
import type { PhoneMatch } from '@/features/phoneMatch/phoneMatchModel';
import { ownerPropertiesQueryKey, useOwnerProperties } from '@/features/properties/usePropertyQueries';
import { useAppSelector } from '@/store/hooks';

// Under ['properties', ownerUid, ...] so adding or editing a tenant (which refreshes everything under the
// owner's properties) also refreshes the suggestions.
export const phoneMatchesKey = (ownerUid: string | undefined) => ['properties', ownerUid, 'phoneMatches'] as const;

const EMPTY: PhoneMatch[] = [];

/** Suggested tenant matches for the signed-in owner. Empty until loaded; a failure is reported, not shown as "none". */
export function usePhoneMatches() {
  const ownerUid = useAppSelector(selectOwner)?.uid;
  const properties = useOwnerProperties();
  const list = properties.data;
  const query = useQuery({
    queryKey: phoneMatchesKey(ownerUid),
    queryFn: () => fetchPhoneMatches(ownerUid as string, (list ?? []).map((p) => ({ id: p.id, name: p.name }))),
    enabled: ownerUid !== undefined && list !== undefined,
    staleTime: 60_000,
    retry: false,
  });
  return { matches: query.data ?? EMPTY, isPending: query.isPending, isError: query.isError, refetch: query.refetch };
}

/** Confirm or dismiss a match, then refresh the suggestions and everything under the owner's properties. */
export function usePhoneMatchActions() {
  const ownerUid = useAppSelector(selectOwner)?.uid;
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ownerPropertiesQueryKey(ownerUid) });
  const link = useMutation<void, Error, PhoneMatch>({
    mutationFn: (match) => (ownerUid === undefined ? Promise.reject(new Error('Not ready')) : linkMatch(match, ownerUid)),
    onSuccess: refresh,
  });
  const dismiss = useMutation<void, Error, PhoneMatch>({
    mutationFn: (match) => (ownerUid === undefined ? Promise.reject(new Error('Not ready')) : dismissMatch(match, ownerUid)),
    onSuccess: refresh,
  });
  return { link, dismiss };
}
