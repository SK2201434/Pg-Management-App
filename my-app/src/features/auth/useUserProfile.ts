import { useQuery } from '@tanstack/react-query';

import type { AccountRole } from '@/constants/account';
import { selectOwner } from '@/features/auth/ownerAuthSelectors';
import { fetchUserProfile } from '@/features/auth/userProfile';
import { useAppSelector } from '@/store/hooks';

export const userProfileQueryKey = (uid: string | undefined) => ['userProfile', uid] as const;

/** The signed-in user's Firestore profile, cached per uid (one read, shared by all consumers). */
export function useUserProfile() {
  const uid = useAppSelector(selectOwner)?.uid;
  return useQuery({
    queryKey: userProfileQueryKey(uid),
    queryFn: () => fetchUserProfile(uid as string),
    enabled: uid !== undefined,
    // A failed read shows the recovery screen with an explicit Retry, instead of spinning through
    // hidden retries.
    retry: false,
  });
}

/** The profile display name, or null if it is missing. */
export function useProfileDisplayName(): string | null {
  const { data } = useUserProfile();
  return data?.state === 'ready' ? data.profile.displayName : null;
}

/** The verified role, or null until a valid, active profile has been read. */
export function useVerifiedRole(): AccountRole | null {
  const { data } = useUserProfile();
  return data?.state === 'ready' ? data.profile.role : null;
}
