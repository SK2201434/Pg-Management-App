import { useEffect, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import { AppButton } from '@/components/app-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { BrandedLoading } from '@/features/auth/BrandedLoading';
import { SignOutButton } from '@/features/auth/SignOutButton';
import { ProfileSetupScreen } from '@/features/auth/ProfileSetupScreen';
import { ProfileReadError } from '@/features/auth/userProfile';
import { completeInviteReferral } from '@/features/referral/referralService';
import { useUserProfile } from '@/features/auth/useUserProfile';

const MESSAGES = {
  missing: 'Your account has not been set up yet. Please contact support.',
  invalid: 'Your account profile is incomplete. Please contact support.',
  disabled: 'Your account has been disabled. Please contact support.',
} as const;

function getLoadErrorMessage(error: unknown): string {
  const kind = error instanceof ProfileReadError ? error.kind : 'unknown';
  switch (kind) {
    case 'permission-denied':
      return 'Your account is signed in, but HOSTELL is not allowed to read its profile. The database access rules or setup need attention. Please contact support.';
    case 'unauthenticated':
      return 'Your sign-in was not accepted by the database. Sign out and sign in again.';
    case 'not-found':
      return 'The HOSTELL database is not set up for this project yet. Please contact support.';
    case 'config':
      return 'HOSTELL is not configured correctly. Please contact support.';
    case 'unavailable':
    case 'timeout':
      // Also what the SDK reports when the Firestore API/database is not enabled for the project.
      return 'HOSTELL could not get a response from its database. Check your connection and try again. If it keeps happening, the database may not be set up; please contact support.';
    default:
      return 'Something went wrong while loading your account. Please try again.';
  }
}

// Renders `children` (the role-based app) only once the signed-in user has a valid, active
// Firestore profile. Render it inside OwnerAuthGate, so a user is always signed in here.
export function ProfileGate({ children }: { children: ReactNode }) {
  const { data, error, isPending, isError, refetch, isRefetching } = useUserProfile();

  if (isPending) {
    return <BrandedLoading />;
  }

  if (data?.state === 'ready') {
    return (
      <>
        <InviteCompletionSync uid={data.profile.uid} />
        {children}
      </>
    );
  }

  // Verified but no profile yet: create it from the registration intent (see ProfileSetupScreen).
  if (data?.state === 'missing') return <ProfileSetupScreen onDone={() => refetch()} />;

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="subtitle" style={styles.text}>
        {isError ? 'Couldn’t load your account' : 'Account unavailable'}
      </ThemedText>
      <ThemedText style={styles.text}>
        {data ? MESSAGES[data.state] : getLoadErrorMessage(error)}
      </ThemedText>
      {isError && error instanceof ProfileReadError ? (
        // The real Firebase code (e.g. permission-denied), so support can tell causes apart.
        <ThemedText type="small" themeColor="textSecondary" style={styles.text}>
          Error code: {error.code ?? error.kind}
        </ThemedText>
      ) : null}
      <AppButton label="Retry" loading={isRefetching} onPress={() => refetch()} />
      <SignOutButton />
    </ThemedView>
  );
}

// Retry for a referred owner whose property is ready but whose referral is not yet `completed` (the
// write is also made right after the property is saved). Once per session.
function InviteCompletionSync({ uid }: { uid: string }) {
  useEffect(() => {
    completeInviteReferral(uid);
  }, [uid]);
  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  text: { textAlign: 'center' },
});
