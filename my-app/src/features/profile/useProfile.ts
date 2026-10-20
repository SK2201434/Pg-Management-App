import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';

import { selectOwner } from '@/features/auth/ownerAuthSelectors';
import { userProfileQueryKey } from '@/features/auth/useUserProfile';
import type { EditableProfile } from '@/features/profile/profileModel';
import { fetchAccountProfile, saveAccountProfile } from '@/features/profile/profileService';
import { fetchPropertyRooms } from '@/features/properties/propertyService';
import { propertyRoomsQueryKey, useOwnerProperties } from '@/features/properties/usePropertyQueries';
import { summarizeRooms } from '@/features/properties/propertyDetailsModel';
import { useAppSelector } from '@/store/hooks';

const accountProfileKey = (uid: string | undefined) => ['accountProfile', uid] as const;

export function useAccountProfile() {
  const uid = useAppSelector(selectOwner)?.uid;
  return useQuery({
    queryKey: accountProfileKey(uid),
    queryFn: () => fetchAccountProfile(uid as string),
    enabled: uid !== undefined,
    retry: false,
  });
}

export function useSaveProfile() {
  const uid = useAppSelector(selectOwner)?.uid;
  const queryClient = useQueryClient();
  return useMutation<void, Error, EditableProfile>({
    mutationFn: (input) => saveAccountProfile(uid as string, input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: accountProfileKey(uid) }),
        // The top bar initial and role guard read this one.
        queryClient.invalidateQueries({ queryKey: userProfileQueryKey(uid) }),
      ]);
    },
  });
}

/**
 * The owner's property count and bed total. Beds come from the real bed records of every owned
 * property (the same cached per-property queries the other screens use); the total is `null`
 * until all of them have loaded, and also when any failed, rather than a partial number.
 */
export function useBusinessOverview() {
  const properties = useOwnerProperties();
  const ownerUid = useAppSelector(selectOwner)?.uid;
  const list = properties.data ?? [];
  const rooms = useQueries({
    queries: list.map((p) => ({
      queryKey: propertyRoomsQueryKey(ownerUid, p.id),
      queryFn: () => fetchPropertyRooms(p.id, ownerUid as string),
      enabled: ownerUid !== undefined,
    })),
  });
  const allLoaded = rooms.every((q) => q.isSuccess);
  const ready = properties.isSuccess && allLoaded;
  const totalBeds = ready ? rooms.reduce((sum, q) => sum + summarizeRooms(q.data ?? []).totalBeds, 0) : null;
  const occupiedBeds = ready ? rooms.reduce((sum, q) => sum + summarizeRooms(q.data ?? []).occupiedBeds, 0) : null;
  return {
    isPending: properties.isPending,
    isError: properties.isError,
    refetch: properties.refetch,
    propertyCount: properties.isSuccess ? list.length : null,
    totalBeds,
    occupiedBeds,
    bedsLoading: properties.isSuccess && rooms.some((q) => q.isPending),
    bedsFailed: rooms.some((q) => q.isError),
  };
}
