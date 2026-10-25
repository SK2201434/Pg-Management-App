import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { selectOwner } from '@/features/auth/ownerAuthSelectors';
import { createTenantRequest, fetchTenantRequests } from '@/features/requests/requestsService';
import type { NewRequestInput, RequestCategory } from '@/features/requests/requestsModel';
import type { TenantStay } from '@/features/tenantHome/tenantHomeModel';
import { useAppSelector } from '@/store/hooks';

type ActiveStay = Extract<TenantStay, { state: 'active' }>;

export const tenantRequestsKey = (uid: string | undefined, propertyId: string | undefined) => ['tenantRequests', uid, propertyId] as const;

/** The signed-in tenant's requests at their current property; idle while there is no active stay. */
export function useTenantRequests(stay: TenantStay | undefined) {
  const uid = useAppSelector(selectOwner)?.uid;
  const propertyId = stay?.state === 'active' ? stay.propertyId : undefined;
  return useQuery({
    queryKey: tenantRequestsKey(uid, propertyId),
    queryFn: () => fetchTenantRequests(propertyId as string, uid as string),
    enabled: uid !== undefined && propertyId !== undefined,
    retry: false,
  });
}

/** Creates a request for the stay's property; the list refetches only after Firestore confirms the write. */
export function useCreateRequest(stay: ActiveStay | undefined) {
  const uid = useAppSelector(selectOwner)?.uid;
  const queryClient = useQueryClient();
  return useMutation<void, Error, NewRequestInput & { category: RequestCategory }>({
    mutationFn: (input) => {
      if (uid === undefined || stay === undefined) return Promise.reject(new Error('No active stay'));
      return createTenantRequest({ propertyId: stay.propertyId, tenantUid: uid, ownerUid: stay.ownerUid, input });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tenantRequestsKey(uid, stay?.propertyId) }),
  });
}
