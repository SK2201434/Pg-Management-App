import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { selectOwner } from '@/features/auth/ownerAuthSelectors';
import { ownerPropertiesQueryKey } from '@/features/properties/usePropertyQueries';
import type { ResidentEdit } from '@/features/tenants/addTenantModel';
import { createResident, fetchResidentDetail, updateResident, type ResidentInput } from '@/features/tenants/residentService';
import { useAppSelector } from '@/store/hooks';

/**
 * Saves a tenant with their bed, then refreshes everything under the owner's properties: the
 * tenant lists, room and bed availability (occupancy), and the rent screens.
 */
export function useAddResident(propertyId: string) {
  const ownerUid = useAppSelector(selectOwner)?.uid;
  const queryClient = useQueryClient();
  return useMutation<void, Error, ResidentInput>({
    mutationFn: (input) => createResident(propertyId, ownerUid as string, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ownerPropertiesQueryKey(ownerUid) }),
  });
}

export const residentDetailKey = (ownerUid: string | undefined, propertyId: string, residentId: string) =>
  ['properties', ownerUid, 'resident', propertyId, residentId] as const;

/** The stored details of one added tenant; only fetched when the tenant is one the owner added. */
export function useResidentDetail(propertyId: string, residentId: string, enabled: boolean) {
  const ownerUid = useAppSelector(selectOwner)?.uid;
  return useQuery({
    queryKey: residentDetailKey(ownerUid, propertyId, residentId),
    queryFn: () => fetchResidentDetail(propertyId, residentId, ownerUid as string),
    enabled: enabled && ownerUid !== undefined,
  });
}

/** Saves an edited tenant, then refreshes every list and detail under the owner's properties. */
export function useUpdateResident(propertyId: string, residentId: string, bedId: string | null) {
  const ownerUid = useAppSelector(selectOwner)?.uid;
  const queryClient = useQueryClient();
  return useMutation<void, Error, { edit: ResidentEdit; nameChanged: boolean }>({
    mutationFn: ({ edit, nameChanged }) => {
      if (bedId === null) throw new Error('This tenant has no bed record to update.');
      return updateResident(propertyId, residentId, bedId, nameChanged, edit);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ownerPropertiesQueryKey(ownerUid) }),
  });
}
