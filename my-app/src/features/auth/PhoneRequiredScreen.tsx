import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppScrollView } from '@/components/app-scroll-view';
import { BrandColors, Spacing } from '@/constants/theme';
import { digitsOnly, isValidPhone, PHONE_DIGITS, PHONE_ERROR } from '@/features/auth/phone';
import { SignOutButton } from '@/features/auth/SignOutButton';
import { saveAccountProfile } from '@/features/profile/profileService';
import { Field } from '@/features/properties/addProperty/formParts';

// Shown to a signed-in user whose profile has no valid 10-digit phone number (accounts created before
// it became required). Saving it updates the profile only; nothing else changes.
export function PhoneRequiredScreen({ uid, displayName, onDone }: { uid: string; displayName: string | null; onDone: () => void }) {
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const save = async () => {
    if (!isValidPhone(phone)) {
      setError(PHONE_ERROR);
      return;
    }
    setError(undefined);
    setSaveError(null);
    setBusy(true);
    try {
      await saveAccountProfile(uid, { displayName: displayName ?? 'HOSTELL user', phone });
      onDone();
    } catch {
      setSaveError('Could not save your phone number. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.screen}>
      <AppScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.column}>
          <Text accessibilityRole="header" style={styles.title}>Add your phone number</Text>
          <Text style={styles.body}>
            HOSTELL needs a 10-digit mobile number on every account. It helps your property owner recognise you.
          </Text>
          <Field label="Phone number" value={phone} onChangeText={(t) => setPhone(digitsOnly(t))} keyboardType="number-pad" maxLength={PHONE_DIGITS} placeholder="98765 43210" error={error} hint="10 digits. Not verified by HOSTELL." />
          {saveError ? <Text style={styles.error} accessibilityRole="alert">{saveError}</Text> : null}
          <View style={styles.actions}>
            <SignOutButton fullWidth />
            <AppButton variant="submit" label="Save" loading={busy} onPress={save} style={styles.half} />
          </View>
        </View>
      </AppScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BrandColors.background },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  column: { width: '100%', maxWidth: 380, gap: Spacing.three },
  title: { fontSize: 24, fontWeight: '800', textAlign: 'center', color: BrandColors.textPrimary },
  body: { fontSize: 15, lineHeight: 22, textAlign: 'center', color: BrandColors.textSecondary },
  error: { fontSize: 13, textAlign: 'center', color: BrandColors.error },
  actions: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center' },
  half: { flex: 1 },
});
