import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { selectOwner } from '@/features/auth/ownerAuthSelectors';
import { ownerPropertiesQueryKey } from '@/features/properties/usePropertyQueries';
import type { BedChoice, StayChange } from '@/features/stayChange/stayChangeModel';
import { applyStayChange, cancelStayChange, fetchStayChange, proposeStayChange, respondStayChange } from '@/features/stayChange/stayChangeService';
import { useAppSelector } from '@/store/hooks';

export const stayChangeKey = (propertyId: string | undefined, tenantUid: string | undefined) => ['stayChange', propertyId, tenantUid] as const;

/**
 * A tenant's room-change proposal. Re-read whenever the screen opens and once a minute, so an answer
 * (or a new proposal) shows up without reopening the app; there is no push.
 */
export function useStayChange(propertyId: string | undefined, tenantUid: string | undefined) {
  return useQuery({
    queryKey: stayChangeKey(propertyId, tenantUid),
    queryFn: () => fetchStayChange(propertyId as string, tenantUid as string),
    enabled: propertyId !== undefined && tenantUid !== undefined,
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchInterval: 60_000,
  });
}

/** Owner: propose, cancel or apply a change for one tenant. */
export function useStayChangeActions(propertyId: string, tenantUid: string | undefined) {
  const ownerUid = useAppSelector(selectOwner)?.uid;
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: stayChangeKey(propertyId, tenantUid) });
  const propose = useMutation<void, Error, { residentId: string; from: { roomNumber: string; bedLabel: string | null }; target: BedChoice }>({
    mutationFn: ({ residentId, from, target }) => {
      if (ownerUid === undefined || tenantUid === undefined) return Promise.reject(new Error('Not ready'));
      return proposeStayChange({ propertyId, ownerUid, tenantUid, residentId, from, target });
    },
    onSuccess: refresh,
  });
  const cancel = useMutation<void, Error, void>({
    mutationFn: () => (tenantUid === undefined ? Promise.reject(new Error('Not ready')) : cancelStayChange(propertyId, tenantUid)),
    onSuccess: refresh,
  });
  const apply = useMutation<void, Error, StayChange>({
    mutationFn: (change) => (ownerUid === undefined ? Promise.reject(new Error('Not ready')) : applyStayChange(change, ownerUid)),
    onSuccess: async () => {
      await Promise.all([refresh(), queryClient.invalidateQueries({ queryKey: ownerPropertiesQueryKey(ownerUid) })]);
    },
  });
  return { propose, cancel, apply };
}

/** Tenant: accept or decline the proposal. */
export function useRespondStayChange(propertyId: string | undefined, tenantUid: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, 'accepted' | 'declined'>({
    mutationFn: (status) => {
      if (propertyId === undefined || tenantUid === undefined) return Promise.reject(new Error('Not ready'));
      return respondStayChange(propertyId, tenantUid, status);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: stayChangeKey(propertyId, tenantUid) }),
  });
}
