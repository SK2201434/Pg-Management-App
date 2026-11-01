import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppScrollView } from '@/components/app-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AccountRoles, type AccountType } from '@/constants/account';
import { BrandColors, Spacing } from '@/constants/theme';
import { selectOwner } from '@/features/auth/ownerAuthSelectors';
import {
  clearRegistrationIntent,
  loadRegistrationIntent,
  saveRegistrationIntent,
  type RegistrationIntent,
} from '@/features/auth/registrationIntent';
import { SignOutButton } from '@/features/auth/SignOutButton';
import {
  getProvisioningErrorMessage,
  isReferralFailure,
  provisionProfile,
} from '@/features/auth/userProvisioning';
import { useAppSelector } from '@/store/hooks';

type Phase =
  | { name: 'loading' }
  | { name: 'choose' }
  | { name: 'error'; message: string; intent: RegistrationIntent; referral: boolean };

// Shown for a verified user whose `users/{uid}` does not exist yet. It creates the profile from the
// account type chosen at registration, which cannot be changed here. Only if that choice is lost
// (reinstall, another device, Google sign-in) is the type asked for, once.
export function ProfileSetupScreen({ onDone }: { onDone: () => void }) {
  const owner = useAppSelector(selectOwner);
  const uid = owner?.uid;
  const displayName = owner?.displayName ?? undefined;
  const [phase, setPhase] = useState<Phase>({ name: 'loading' });
  const inFlight = useRef(false);

  const run = useCallback(
    async (intent: RegistrationIntent) => {
      if (uid === undefined || inFlight.current) return;
      inFlight.current = true;
      setPhase({ name: 'loading' });
      try {
        await provisionProfile({ uid, intent, fallbackName: displayName });
        await clearRegistrationIntent(uid);
        onDone();
      } catch (error) {
        setPhase({
          name: 'error',
          message: getProvisioningErrorMessage(error),
          intent,
          referral: isReferralFailure(error),
        });
      } finally {
        inFlight.current = false;
      }
    },
    [uid, displayName, onDone],
  );

  useEffect(() => {
    if (uid === undefined) return;
    let cancelled = false;
    loadRegistrationIntent(uid).then((intent) => {
      if (cancelled) return;
      if (intent === null) setPhase({ name: 'choose' });
      else run(intent);
    });
    return () => {
      cancelled = true;
    };
  }, [uid, run]);

  // Dropping the referral keeps the originally chosen type; only the code is removed.
  const continueWithoutReferral = async (intent: RegistrationIntent) => {
    if (uid === undefined) return;
    const { referralCode: _dropped, ...rest } = intent;
    await saveRegistrationIntent(uid, rest).catch(() => {});
    run(rest);
  };

  if (phase.name === 'loading') {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator />
        <ThemedText style={styles.text}>Setting up your account…</ThemedText>
      </ThemedView>
    );
  }

  if (phase.name === 'choose') {
    return (
      <ChooseType
        onChoose={async (intent) => {
          if (uid !== undefined) await saveRegistrationIntent(uid, intent).catch(() => {});
          run(intent);
        }}
      />
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="subtitle" style={styles.text}>
        Couldn’t finish setting up
      </ThemedText>
      <ThemedText style={styles.text} accessibilityRole="alert">
        {phase.message}
      </ThemedText>
      <AppButton label="Try again" onPress={() => run(phase.intent)} />
      {phase.referral ? (
        <AppButton
          variant="secondary"
          label="Continue without a referral code"
          onPress={() => continueWithoutReferral(phase.intent)}
        />
      ) : null}
      <SignOutButton />
    </ThemedView>
  );
}

function ChooseType({ onChoose }: { onChoose: (intent: RegistrationIntent) => void }) {
  const [type, setType] = useState<AccountType>(AccountRoles.Tenant);

  return (
    <ThemedView style={styles.flex}>
      <AppScrollView contentContainerStyle={styles.scrollContainer}>
      <ThemedText type="subtitle" style={styles.text}>
        Choose your account type
      </ThemedText>
      <ThemedText style={styles.text}>
        We couldn’t find your sign-up choice on this device. This can’t be changed later.
      </ThemedText>
      {[AccountRoles.Tenant, AccountRoles.Owner].map((option) => (
        <Pressable
          key={option}
          accessibilityRole="radio"
          accessibilityState={{ selected: type === option }}
          onPress={() => setType(option)}>
          <ThemedText type={type === option ? 'linkPrimary' : 'default'}>
            {option === AccountRoles.Tenant ? 'Tenant' : 'Property owner'}
            {type === option ? ' ✓' : ''}
          </ThemedText>
        </Pressable>
      ))}
      <AppButton
        variant="submit"
        label="Continue"
        onPress={() => onChoose({ accountType: type })}
      />
      <SignOutButton />
      </AppScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  text: { textAlign: 'center' },
  error: { color: BrandColors.error },
  input: {
    minWidth: 260,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: BrandColors.textPrimary,
  },
});
