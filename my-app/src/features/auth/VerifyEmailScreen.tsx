import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { AppButton } from '@/components/app-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, BrandColors } from '@/constants/theme';
import { checkEmailVerified, sendVerificationEmail } from '@/features/auth/emailVerification';
import { getResendCooldownRemaining } from '@/features/auth/resendCooldown';
import { verificationEmailSendResult } from '@/features/auth/ownerAuthSlice';
import { selectOwner, selectVerificationEmailFailed } from '@/features/auth/ownerAuthSelectors';
import { SignOutButton } from '@/features/auth/SignOutButton';
import { useAppDispatch, useAppSelector } from '@/store/hooks';

// Shown to every signed-in email/password user whose email Firebase has not verified, whether they
// just registered or signed in later. Nothing behind it (profile creation, dashboards) is reachable.
export function VerifyEmailScreen() {
  const dispatch = useAppDispatch();
  const email = useAppSelector(selectOwner)?.email ?? 'your email address';
  const sendFailed = useAppSelector(selectVerificationEmailFailed);

  const [lastSentAt, setLastSentAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [isSending, setIsSending] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cooldown = getResendCooldownRemaining(lastSentAt, now);
  useEffect(() => {
    if (cooldown === 0) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const resend = async () => {
    if (isSending || cooldown > 0) return;
    setIsSending(true);
    setError(null);
    setMessage(null);
    const result = await sendVerificationEmail();
    setIsSending(false);
    dispatch(verificationEmailSendResult(result === null));
    if (result === null) {
      setLastSentAt(Date.now());
      setNow(Date.now());
      setMessage('Verification email sent. Check your inbox and spam folder.');
    } else {
      setError(result.message);
    }
  };

  // On success the dispatched user has emailVerified = true and the gate moves on by itself.
  const check = async () => {
    if (isChecking) return;
    setIsChecking(true);
    setError(null);
    setMessage(null);
    const result = await checkEmailVerified(dispatch);
    if (result.status === 'pending') {
      setMessage('Your email is not verified yet. Open the link in the email, then check again.');
    } else if (result.status === 'error') {
      setError(result.error.message);
    }
    setIsChecking(false);
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="subtitle" style={styles.text}>
        Verify your email
      </ThemedText>
      <ThemedText style={styles.text}>
        {sendFailed
          ? `We could not send a verification email to ${email}. Tap Resend to try again.`
          : `We sent a verification link to ${email}. Open it, then come back and tap “I’ve verified”.`}
      </ThemedText>

      {message ? <ThemedText style={styles.text}>{message}</ThemedText> : null}
      {error ? (
        <ThemedText style={[styles.text, styles.error]} accessibilityRole="alert">
          {error}
        </ThemedText>
      ) : null}

      <AppButton label="I’ve verified my email" loading={isChecking} onPress={check} />

      <AppButton
        variant="ghost"
        size="sm"
        label={
          isSending
            ? 'Sending…'
            : cooldown > 0
              ? `Resend verification email (${cooldown}s)`
              : 'Resend verification email'
        }
        disabled={isSending || cooldown > 0}
        onPress={resend}
      />

      <SignOutButton />
    </ThemedView>
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
  text: { textAlign: 'center' },
  error: { color: BrandColors.error },
});
