import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { collection, doc, getDoc, getDocs, serverTimestamp, writeBatch } from 'firebase/firestore';

import { getFirestoreDb } from '@/config/firebase';
import { selectOwner } from '@/features/auth/ownerAuthSelectors';
import { useUserProfile } from '@/features/auth/useUserProfile';
import type { TenantStay } from '@/features/tenantHome/tenantHomeModel';
import { useAppSelector } from '@/store/hooks';

/** What the tenant is told while their owner still has to confirm them. It names no property, room or bed. */
export const STAY_CONFIRMATION_TITLE = 'You’re already a tenant of a property';
export const STAY_CONFIRMATION_TEXT =
  'Your owner has been sent a notification. Your stay details will be shown here after they confirm. Please contact your owner to confirm.';

const entriesOf = (phone: string) => collection(getFirestoreDb(), 'residentPhones', phone, 'entries');

/**
 * The markers an owner left on this phone number that still wait for this account: not dismissed by the
 * owner for this account, and not declined by the tenant. They hold nothing about the stay, so this reveals
 * that a resident exists for the number and nothing more. Returns the marker ids.
 */
export async function fetchPendingConfirmations(phone: string, uid: string): Promise<string[]> {
  const snap = await getDocs(entriesOf(phone));
  const open = snap.docs.filter((d) => {
    const dismissed = d.data().dismissed;
    return !(Array.isArray(dismissed) && dismissed.includes(uid));
  });
  const declined = await Promise.all(open.map(async (d) => (await getDoc(doc(getFirestoreDb(), 'residentPhones', phone, 'entries', d.id, 'declines', uid))).exists()));
  return open.filter((_, i) => !declined[i]).map((d) => d.id);
}

/**
 * "This isn't me": records, for each waiting marker, that this account is not that resident. It is final.
 * The owner is told the number they entered is wrong, and the rules refuse to link this account to them.
 */
export async function declineConfirmations(phone: string, uid: string, entryIds: readonly string[]): Promise<void> {
  const db = getFirestoreDb();
  const batch = writeBatch(db);
  for (const id of entryIds) batch.set(doc(db, 'residentPhones', phone, 'entries', id, 'declines', uid), { uid, createdAt: serverTimestamp() });
  await batch.commit();
}

/**
 * The signed-in tenant's pending confirmation: true while they have no stay but an owner has added a
 * resident with their phone number, plus the "this isn't me" action. `stayState` comes from the caller's own
 * `useTenantStay`, so no extra stay reads are made. A failed read simply shows nothing.
 */
export function useStayConfirmation(stayState: TenantStay['state'] | undefined) {
  const uid = useAppSelector(selectOwner)?.uid;
  const queryClient = useQueryClient();
  const profile = useUserProfile().data;
  const phone = profile?.state === 'ready' ? (profile.profile.phone ?? null) : null;
  const enabled = uid !== undefined && phone !== null && stayState === 'none';
  const key = ['stayConfirmation', uid, phone] as const;
  const query = useQuery({ queryKey: key, queryFn: () => fetchPendingConfirmations(phone as string, uid as string), enabled, staleTime: 30_000, retry: false });
  const decline = useMutation<void, Error, void>({
    mutationFn: () => declineConfirmations(phone as string, uid as string, query.data ?? []),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });
  return { pending: enabled && (query.data?.length ?? 0) > 0, decline: () => decline.mutate(), declining: decline.isPending, declineFailed: decline.isError };
}

/** Just whether a confirmation is pending, for the notifications list. */
export const useStayConfirmationPending = (stayState: TenantStay['state'] | undefined): boolean => useStayConfirmation(stayState).pending;
