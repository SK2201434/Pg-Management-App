import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { selectOwner } from '@/features/auth/ownerAuthSelectors';
import type { MoveOutOption, MoveOutRequest } from '@/features/moveOut/moveOutModel';
import {
  decideMoveOut,
  fetchMyMoveOutRequest,
  fetchOwnerMoveOutRequests,
  sendMoveOutRequest,
  withdrawMoveOutRequest,
  type OwnerMoveOutRequest,
} from '@/features/moveOut/moveOutService';
import { useOwnerProperties } from '@/features/properties/usePropertyQueries';
import { tenantStayKey } from '@/features/tenantHome/useTenantStay';
import { useAppSelector } from '@/store/hooks';

const myKey = (uid: string | undefined, propertyId: string | undefined) => ['moveOutRequest', uid, propertyId] as const;
const ownerKey = (uid: string | undefined) => ['moveOutRequests', 'owner', uid] as const;

/** The tenant's move-out request for their current property. */
export function useMyMoveOutRequest(propertyId: string | undefined) {
  const uid = useAppSelector(selectOwner)?.uid;
  return useQuery({
    queryKey: myKey(uid, propertyId),
    queryFn: () => fetchMyMoveOutRequest(propertyId as string, uid as string),
    enabled: uid !== undefined && propertyId !== undefined,
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

/** Sends or withdraws the tenant's request; the status refetches once Firestore confirms the write. */
export function useMoveOutActions(stay: { propertyId: string; ownerUid: string } | undefined) {
  const uid = useAppSelector(selectOwner)?.uid;
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: myKey(uid, stay?.propertyId) });
  const send = useMutation<void, Error, { tenantName: string; option: MoveOutOption; existing: MoveOutRequest | null }>({
    mutationFn: (input) => {
      if (uid === undefined || !stay) return Promise.reject(new Error('Not ready'));
      return sendMoveOutRequest({ propertyId: stay.propertyId, tenantUid: uid, ownerUid: stay.ownerUid, ...input });
    },
    onSuccess: refresh,
  });
  const withdraw = useMutation<void, Error, void>({
    mutationFn: () => {
      if (uid === undefined || !stay) return Promise.reject(new Error('Not ready'));
      return withdrawMoveOutRequest(stay.propertyId, uid);
    },
    onSuccess: refresh,
  });
  return { send, withdraw };
}

/** The owner's move-out requests across their properties, re-read whenever the screen opens. */
export function useOwnerMoveOutRequests() {
  const uid = useAppSelector(selectOwner)?.uid;
  const properties = useOwnerProperties().data;
  const signature = properties?.map((p) => p.id).join('|');
  return useQuery<OwnerMoveOutRequest[]>({
    queryKey: [...ownerKey(uid), signature],
    queryFn: () => fetchOwnerMoveOutRequests(uid as string, (properties ?? []).map((p) => ({ id: p.id, name: p.name }))),
    enabled: uid !== undefined && properties !== undefined,
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

export function useDecideMoveOut() {
  const uid = useAppSelector(selectOwner)?.uid;
  const queryClient = useQueryClient();
  return useMutation<void, Error, { request: MoveOutRequest; status: 'approved' | 'rejected' }>({
    mutationFn: ({ request, status }) => decideMoveOut(request, status),
    onSuccess: (_, { request }) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ownerKey(uid) }),
        // The tenant's stay carries the check-out date the approval sets.
        queryClient.invalidateQueries({ queryKey: tenantStayKey(request.tenantUid) }),
      ]),
  });
}
