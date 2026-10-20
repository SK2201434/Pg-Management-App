import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import { AppButton } from '@/components/app-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import {
  selectAuthErrors,
  selectIsAuthenticated,
  selectIsInitialized,
  selectOwner,
} from '@/features/auth/ownerAuthSelectors';
import { BrandedLoading } from '@/features/auth/BrandedLoading';
import { ForgotPasswordScreen } from '@/features/auth/ForgotPasswordScreen';
import { OwnerLoginScreen } from '@/features/auth/OwnerLoginScreen';
import { observeOwnerAuthState } from '@/features/auth/ownerAuthObserver';
import { OwnerRegisterScreen } from '@/features/auth/OwnerRegisterScreen';
import { VerifyEmailScreen } from '@/features/auth/VerifyEmailScreen';
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

  // The native splash stays up until the persisted session has been read.
  useEffect(() => {
    if (isInitialized) SplashScreen.hideAsync().catch(() => {});
  }, [isInitialized]);

  if (!isInitialized) {
    return <BrandedLoading />;
  }

  if (isAuthenticated && owner) {
    // An unverified email/password account never reaches profile creation or a dashboard.
    return owner.emailVerified ? children : <VerifyEmailScreen />;
  }

  // The observer reported an error, so the session state is unknown; the user can retry.
  if (restoreError) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText type="subtitle" style={styles.text}>
          Couldn&apos;t restore your session
        </ThemedText>
        <ThemedText style={styles.text}>{restoreError.message}</ThemedText>
        <AppButton label="Retry" onPress={() => setAttempt((n) => n + 1)} />
      </ThemedView>
    );
  }

  return <SignedOutScreens />;
}

// Which signed-out screen is shown is local UI state, not part of the auth state. It lives in
// its own component so it resets to the login screen whenever the user signs out again.
function SignedOutScreens() {
  const [authScreen, setAuthScreen] = useState<'login' | 'register' | 'forgotPassword'>('login');
  // Email typed on the login screen, offered again on the Forgot Password screen.
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');

  if (authScreen === 'register') {
    return <OwnerRegisterScreen onShowLogin={() => setAuthScreen('login')} />;
  }
  if (authScreen === 'forgotPassword') {
    // Forgot Password is only reachable from the login screen, so "back" is the login screen.
    return (
      <ForgotPasswordScreen
        initialEmail={forgotPasswordEmail}
        onBack={() => setAuthScreen('login')}
        onShowLogin={() => setAuthScreen('login')}
      />
    );
  }
  return (
    <OwnerLoginScreen
      onShowRegister={() => setAuthScreen('register')}
      onShowForgotPassword={(email) => {
        setForgotPasswordEmail(email);
        setAuthScreen('forgotPassword');
      }}
    />
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
