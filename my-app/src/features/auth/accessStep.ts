import type { OwnerUser } from '@/features/auth/authTypes';
import type { UserProfileResult } from '@/features/auth/userProfile';

/** Where a signed-in user is on the way to the dashboard. Only `dashboard` renders the app. */
export type AccessStep = 'verify-email' | 'set-up-profile' | 'account-unavailable' | 'dashboard';

/**
 * Pure routing decision. An unverified email never reaches the profile step, and a profile is only
 * created (`set-up-profile`) after verification; the dashboard needs a ready profile read from
 * Firestore, never client input.
 */
export function getAccessStep(
  user: Pick<OwnerUser, 'emailVerified'>,
  profile: UserProfileResult | undefined,
): AccessStep {
  if (!user.emailVerified) return 'verify-email';
  if (profile === undefined) return 'account-unavailable';
  if (profile.state === 'ready') return 'dashboard';
  if (profile.state === 'missing') return 'set-up-profile';
  return 'account-unavailable';
}
