import { useQuery } from '@tanstack/react-query';

import { selectOwner } from '@/features/auth/ownerAuthSelectors';
import { sortReferrals } from '@/features/referral/inviteModel';
import { ensureInviteCode, fetchReferrals } from '@/features/referral/referralService';
import { useAppSelector } from '@/store/hooks';

// Both keys carry the uid, so one account's code or referrals are never shown to another.
export const inviteCodeKey = (uid: string | undefined) => ['invite', uid, 'code'] as const;
export const referralsKey = (uid: string | undefined) => ['invite', uid, 'referrals'] as const;

/** The signed-in user's own invite code; created on first use, then always the same. */
export function useInviteCode() {
  const uid = useAppSelector(selectOwner)?.uid;
  return useQuery({
    queryKey: inviteCodeKey(uid),
    queryFn: () => ensureInviteCode(uid as string),
    enabled: uid !== undefined,
    staleTime: Infinity,
    retry: false,
  });
}

export function useReferrals() {
  const uid = useAppSelector(selectOwner)?.uid;
  return useQuery({
    queryKey: referralsKey(uid),
    queryFn: async () => sortReferrals(await fetchReferrals(uid as string)),
    enabled: uid !== undefined,
    retry: false,
  });
}
