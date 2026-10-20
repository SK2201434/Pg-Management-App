import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { selectOwner } from '@/features/auth/ownerAuthSelectors';
import { ownerPropertiesQueryKey } from '@/features/properties/usePropertyQueries';
import {
  createRentCharge,
  fetchPayments,
  fetchRentCharges,
  recordPayment,
  type PaymentInput,
} from '@/features/rent/rentService';
import { useAppSelector } from '@/store/hooks';

// Keys sit under ['properties', ownerUid, ...] and carry the property id, so one property's ledger
// is never reused for another, and invalidating the owner's properties refreshes them too.
export const rentChargesKey = (ownerUid: string | undefined, propertyId: string) =>
  ['properties', ownerUid, 'rentCharges', propertyId] as const;
export const paymentsKey = (ownerUid: string | undefined, propertyId: string) =>
  ['properties', ownerUid, 'payments', propertyId] as const;

export function useRentCharges(propertyId: string | null) {
  const ownerUid = useAppSelector(selectOwner)?.uid;
  return useQuery({
    queryKey: rentChargesKey(ownerUid, propertyId ?? ''),
    queryFn: () => fetchRentCharges(propertyId as string, ownerUid as string),
    enabled: ownerUid !== undefined && propertyId !== null,
  });
}

export function usePayments(propertyId: string | null) {
  const ownerUid = useAppSelector(selectOwner)?.uid;
  return useQuery({
    queryKey: paymentsKey(ownerUid, propertyId ?? ''),
    queryFn: () => fetchPayments(propertyId as string, ownerUid as string),
    enabled: ownerUid !== undefined && propertyId !== null,
  });
}

export function useCreateRentCharge(propertyId: string) {
  const ownerUid = useAppSelector(selectOwner)?.uid;
  const queryClient = useQueryClient();
  return useMutation<void, Error, { tenantUid: string; period: string; amountInr: number; dueMs: number }>({
    mutationFn: (input) => createRentCharge(propertyId, ownerUid as string, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ownerPropertiesQueryKey(ownerUid) }),
  });
}

export function useRecordPayment(propertyId: string) {
  const ownerUid = useAppSelector(selectOwner)?.uid;
  const queryClient = useQueryClient();
  return useMutation<void, Error, PaymentInput>({
    mutationFn: (input) => recordPayment(propertyId, ownerUid as string, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ownerPropertiesQueryKey(ownerUid) }),
  });
}
