import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/app-button';
import { BrandColors } from '@/constants/theme';
import { Field } from '@/features/properties/addProperty/formParts';
import { validateProfile, type EditableProfile, type ProfileErrors } from '@/features/profile/profileModel';

type Props = {
  initial: EditableProfile;
  email: string | null;
  busy: boolean;
  submitError: string | null;
  onSubmit: (input: EditableProfile) => void;
  onClose: () => void;
};

// Edits the two permitted fields. Email, role, status and referral data are shown elsewhere
// read-only; the rules reject writes to anything else. Mount only while open (fresh state).
export function EditProfileSheet({ initial, email, busy, submitError, onSubmit, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [phone, setPhone] = useState(initial.phone);
  const [errors, setErrors] = useState<ProfileErrors>({});

  const submit = () => {
    const found = validateProfile({ displayName, phone });
    setErrors(found);
    if (Object.keys(found).length === 0) onSubmit({ displayName, phone });
  };

  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent onRequestClose={busy ? undefined : onClose}>
      <KeyboardAvoidingView behavior="padding" style={styles.root}>
        <Pressable accessibilityLabel="Dismiss" disabled={busy} style={StyleSheet.absoluteFill} onPress={onClose} />
        <View accessibilityViewIsModal style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.handle} />
          <Text accessibilityRole="header" style={styles.title}>
            Edit profile
          </Text>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.form}>
            <Field label="Full name" value={displayName} onChangeText={setDisplayName} maxLength={100} autoCapitalize="words" error={errors.displayName} />
            <Field label="Phone number" optional value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={20} error={errors.phone} hint="Not verified by HOSTELL." />
            {email ? <Text style={styles.note}>Email: {email}. It can’t be changed here.</Text> : null}
            {submitError ? <Text style={styles.error}>{submitError}</Text> : null}
          </ScrollView>
          <View style={styles.actions}>
            <AppButton variant="secondary" label="Cancel" disabled={busy} onPress={onClose} style={styles.action} />
            <AppButton label="Save" loading={busy} onPress={submit} style={styles.action} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(32, 42, 43, 0.45)' },
  sheet: { maxHeight: '90%', gap: 8, paddingTop: 8, paddingHorizontal: 16, borderTopLeftRadius: 28, borderTopRightRadius: 20, backgroundColor: BrandColors.surface },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 4, backgroundColor: BrandColors.border },
  title: { fontSize: 18, fontWeight: '800', color: BrandColors.textPrimary },
  form: { gap: 14, paddingVertical: 8 },
  note: { fontSize: 12, color: BrandColors.textSecondary },
  error: { fontSize: 13, color: BrandColors.error },
  actions: { flexDirection: 'row', gap: 8, paddingTop: 8 },
  action: { flex: 1 },
});
