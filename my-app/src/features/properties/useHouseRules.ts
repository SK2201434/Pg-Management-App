import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { selectOwner } from '@/features/auth/ownerAuthSelectors';
import type { MoveOutPolicy } from '@/features/moveOut/moveOutModel';
import { fetchHouseRules, saveHouseRules } from '@/features/properties/houseRulesService';
import { useAppSelector } from '@/store/hooks';

export const houseRulesKey = (ownerUid: string | undefined, propertyId: string) => ['properties', ownerUid, 'houseRules', propertyId] as const;

export function useHouseRules(propertyId: string | null) {
  const ownerUid = useAppSelector(selectOwner)?.uid;
  return useQuery({
    queryKey: houseRulesKey(ownerUid, propertyId ?? ''),
    queryFn: () => fetchHouseRules(propertyId as string, ownerUid as string),
    enabled: ownerUid !== undefined && propertyId !== null,
    retry: (count, error) => (error as { kind?: string }).kind === 'unavailable' && count < 2,
    // The editor copies the rules once; it is not refreshed under the owner's hands.
    refetchOnWindowFocus: false,
  });
}

export function useSaveHouseRules(propertyId: string) {
  const ownerUid = useAppSelector(selectOwner)?.uid;
  const queryClient = useQueryClient();
  return useMutation<void, Error, { rules: string[]; policy: MoveOutPolicy }>({
    mutationFn: ({ rules, policy }) => saveHouseRules(propertyId, rules, policy),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: houseRulesKey(ownerUid, propertyId) }),
  });
}
