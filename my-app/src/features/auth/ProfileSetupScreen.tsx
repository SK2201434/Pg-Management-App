import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppScrollView } from '@/components/app-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { GenderSelect } from '@/components/gender-select';
import { AccountRoles, type AccountType, type Gender } from '@/constants/account';
import { BrandColors, Spacing } from '@/constants/theme';
import { selectOwner } from '@/features/auth/ownerAuthSelectors';
import { digitsOnly, isValidPhone, PHONE_DIGITS, PHONE_ERROR } from '@/features/auth/phone';
import { Field } from '@/features/properties/addProperty/formParts';
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
  | { name: 'choose'; intent: RegistrationIntent | null }
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
      // The details step also covers an intent saved before phone and gender were required.
      if (intent === null || !isValidPhone(intent.phone) || intent.gender === undefined) setPhase({ name: 'choose', intent });
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
        existing={phase.intent}
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

const OPTION_LABEL: Record<AccountType, string> = {
  [AccountRoles.Tenant]: 'Tenant',
  [AccountRoles.Owner]: 'Property owner',
};

function ChooseType({ existing, onChoose }: { existing: RegistrationIntent | null; onChoose: (intent: RegistrationIntent) => void }) {
  // A sign-up choice that is already known (an older intent missing phone or gender) is kept and not asked again.
  const [type, setType] = useState<AccountType>(existing?.accountType ?? AccountRoles.Tenant);
  const [phone, setPhone] = useState(existing?.phone && isValidPhone(existing.phone) ? existing.phone : '');
  const [gender, setGender] = useState<Gender | null>(existing?.gender ?? null);
  const [errors, setErrors] = useState<{ phone?: string; gender?: string }>({});

  const submit = () => {
    const found = {
      ...(isValidPhone(phone) ? {} : { phone: PHONE_ERROR }),
      ...(gender === null ? { gender: 'Choose male or female.' } : {}),
    };
    setErrors(found);
    if (found.phone || found.gender || gender === null) return;
    onChoose({ ...(existing ?? {}), accountType: type, phone, gender });
  };

  return (
    <View style={styles.chooseScreen}>
      <AppScrollView contentContainerStyle={styles.chooseScroll}>
        <View style={styles.chooseColumn}>
          <ThemedText type="subtitle" style={[styles.text, styles.onGreen]}>
            {existing ? 'Finish setting up' : 'Choose your account type'}
          </ThemedText>
          <ThemedText style={[styles.text, styles.onGreenMuted]}>
            {existing
              ? 'Add your phone number and gender to finish your account.'
              : 'We couldn’t find your sign-up choice on this device. This can’t be changed later.'}
          </ThemedText>

          {existing ? null : (
            <View style={styles.options} accessibilityRole="radiogroup">
              {[AccountRoles.Tenant, AccountRoles.Owner].map((option) => {
                const selected = type === option;
                return (
                  <Pressable
                    key={option}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    onPress={() => setType(option)}
                    style={[styles.option, selected && styles.optionSelected]}>
                    <View style={[styles.radio, selected && styles.radioSelected]}>
                      {selected ? <View style={styles.radioDot} /> : null}
                    </View>
                    <ThemedText style={[styles.optionTitle, styles.onGreen]} numberOfLines={1}>
                      {OPTION_LABEL[option]}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          )}

          <Field label="Phone number" value={phone} onChangeText={(t) => setPhone(digitsOnly(t))} keyboardType="number-pad" maxLength={PHONE_DIGITS} placeholder="98765 43210" error={errors.phone} hint="10 digits. Not verified by HOSTELL." />
          <GenderSelect value={gender} onChange={setGender} error={errors.gender} />

          <View style={styles.actions}>
            <SignOutButton fullWidth />
            <AppButton variant="submit" label="Continue" style={styles.half} onPress={submit} />
          </View>
        </View>
      </AppScrollView>
    </View>
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
  // Account-type screen: light green page, one centred column so every row lines up.
  chooseScreen: { flex: 1, backgroundColor: BrandColors.background },
  chooseScroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  chooseColumn: { width: '100%', maxWidth: 380, gap: Spacing.three },
  onGreen: { color: BrandColors.textPrimary },
  onGreenMuted: { color: BrandColors.textSecondary },
  options: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
  option: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: BrandColors.border,
    backgroundColor: BrandColors.surface,
  },
  optionSelected: { borderColor: BrandColors.accent, backgroundColor: '#F7FCF9' },
  optionTitle: { flexShrink: 1, fontWeight: '700' },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: BrandColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: BrandColors.accent },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: BrandColors.accent },
  actions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two, alignItems: 'center' },
  half: { flex: 1 },
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
