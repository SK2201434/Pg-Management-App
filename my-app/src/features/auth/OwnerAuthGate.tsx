import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import {
  selectAuthErrors,
  selectIsAuthenticated,
  selectIsInitialized,
  selectOwner,
} from '@/features/auth/ownerAuthSelectors';
import { OwnerLoginScreen } from '@/features/auth/OwnerLoginScreen';
import { observeOwnerAuthState } from '@/features/auth/ownerAuthObserver';
import { OwnerRegisterScreen } from '@/features/auth/OwnerRegisterScreen';
import { useAppDispatch, useAppSelector } from '@/store/hooks';

type OwnerAuthGateProps = { children: ReactNode };

// Mirrors the persisted Firebase Auth session into Redux and renders `children` (the protected
// owner navigation) only for an authenticated owner. Render it inside the Redux Provider.
export function OwnerAuthGate({ children }: OwnerAuthGateProps) {
  const dispatch = useAppDispatch();
  const owner = useAppSelector(selectOwner);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const isInitialized = useAppSelector(selectIsInitialized);
  const { restoreSession: restoreError } = useAppSelector(selectAuthErrors);

  // Bumped by "Retry" to resubscribe after the observer reported an error.
  const [attempt, setAttempt] = useState(0);

  // One Firebase auth observer for the gate's lifetime. The cleanup removes it, so Strict
  // Mode's dev-only effect re-run and retries never leave two subscriptions behind. Its first
  // callback marks the auth state as initialized, so the signed-out screen is not flashed
  // before the persisted session has been read.
  useEffect(() => observeOwnerAuthState(dispatch), [dispatch, attempt]);

  if (!isInitialized) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  if (isAuthenticated && owner) {
    return children;
  }

  // The observer reported an error, so the session state is unknown; the user can retry.
  if (restoreError) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText type="subtitle" style={styles.text}>
          Couldn&apos;t restore your session
        </ThemedText>
        <ThemedText style={styles.text}>{restoreError.message}</ThemedText>
        <Pressable accessibilityRole="button" onPress={() => setAttempt((n) => n + 1)}>
          <ThemedText type="linkPrimary">Retry</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  return <SignedOutScreens />;
}

// Which signed-out screen is shown is local UI state, not part of the auth state. It lives in
// its own component so it resets to the login screen whenever the user signs out again.
function SignedOutScreens() {
  const [authScreen, setAuthScreen] = useState<'login' | 'register'>('login');

  return authScreen === 'register' ? (
    <OwnerRegisterScreen onShowLogin={() => setAuthScreen('login')} />
  ) : (
    <OwnerLoginScreen onShowRegister={() => setAuthScreen('register')} />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  text: {
    textAlign: 'center',
  },
});
