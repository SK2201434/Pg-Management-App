import { useMutation, useQuery } from '@tanstack/react-query';

import { selectOwner } from '@/features/auth/ownerAuthSelectors';
import type { RentReminder } from '@/features/rent/reminderModel';
import { fetchMyRentReminders, sendRentReminder } from '@/features/rent/reminderService';
import { useAppSelector } from '@/store/hooks';

/** Owner: sends the in-app reminder to one tenant (by their account id). */
export function useSendRentReminder(propertyId: string) {
  const ownerUid = useAppSelector(selectOwner)?.uid;
  return useMutation<void, Error, { tenantUid: string; reminder: RentReminder }>({
    mutationFn: ({ tenantUid, reminder }) => {
      if (ownerUid === undefined) return Promise.reject(new Error('Not ready'));
      return sendRentReminder({ propertyId, ownerUid, tenantUid, reminder, nowMs: Date.now() });
    },
  });
}

export const myRentRemindersKey = (uid: string | undefined, propertyId: string | undefined) => ['rentReminders', 'mine', uid, propertyId] as const;

/**
 * The tenant's rent reminders. They are re-read whenever the screen opens and once a minute, so a
 * reminder the owner has just sent shows up without reopening the app (there is no push).
 */
export function useMyRentReminders(propertyId: string | undefined) {
  const uid = useAppSelector(selectOwner)?.uid;
  return useQuery({
    queryKey: myRentRemindersKey(uid, propertyId),
    queryFn: () => fetchMyRentReminders(propertyId as string, uid as string),
    enabled: uid !== undefined && propertyId !== undefined,
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchInterval: 60_000,
  });
}
