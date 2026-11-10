import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/app-button';
import { BrandColors } from '@/constants/theme';
import { Field } from '@/features/properties/addProperty/formParts';
import {
  CATEGORIES,
  DESCRIPTION_MAX,
  TITLE_MAX,
  validateRequest,
  type NewRequestInput,
  type RequestCategory,
  type RequestErrors,
} from '@/features/requests/requestsModel';
import { ErrorScrollView, ErrorText } from '@/components/form-error-scroll';

type Props = {
  propertyName: string;
  busy: boolean;
  submitError: string | null;
  onSubmit: (input: NewRequestInput & { category: RequestCategory }) => void;
  onClose: () => void;
};

// The New Request form. Mount only while open (fresh state); the entered values stay while a
// failed save is retried, and the parent unmounts it only after the write is confirmed.
export function NewRequestSheet({ propertyName, busy, submitError, onSubmit, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState<RequestCategory | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<RequestErrors>({});

  const submit = () => {
    if (busy) return;
    const found = validateRequest({ category, title, description });
    setErrors(found);
    if (Object.keys(found).length === 0 && category !== null) onSubmit({ category, title, description });
  };

  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent onRequestClose={busy ? undefined : onClose}>
      <KeyboardAvoidingView behavior="padding" style={styles.root}>
        <Pressable accessibilityLabel="Dismiss" disabled={busy} style={StyleSheet.absoluteFill} onPress={onClose} />
        <View accessibilityViewIsModal style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.handle} />
          <Text accessibilityRole="header" style={styles.title}>New Service Request</Text>
          <Text style={styles.muted}>{propertyName}</Text>
          <ErrorScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Issue category</Text>
              <View style={styles.chips}>
                {CATEGORIES.map((c) => {
                  const selected = c.key === category;
                  return (
                    <Pressable
                      key={c.key}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      disabled={busy}
                      onPress={() => setCategory(c.key)}
                      style={[styles.chip, selected && styles.chipOn]}>
                      <MaterialIcons name={c.icon} size={20} color={selected ? BrandColors.surface : BrandColors.accent} />
                      <Text style={[styles.chipText, selected && styles.chipTextOn]}>{c.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <ErrorText style={styles.error}>{errors.category}</ErrorText>
            </View>
            <Field label="Issue title" value={title} onChangeText={setTitle} maxLength={TITLE_MAX} placeholder="e.g. Air conditioner not cooling" editable={!busy} error={errors.title} />
            <Field
              label="Detailed description"
              value={description}
              onChangeText={setDescription}
              maxLength={DESCRIPTION_MAX}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              placeholder="Describe the problem and when it started."
              editable={!busy}
              error={errors.description}
            />
            {submitError ? <Text style={styles.error} accessibilityRole="alert">{submitError}</Text> : null}
          </ErrorScrollView>
          <View style={styles.actions}>
            <AppButton variant="secondary" label="Cancel" disabled={busy} onPress={onClose} style={styles.action} />
            <AppButton variant="submit" label="Submit Ticket" loading={busy} onPress={submit} style={styles.action} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(32, 42, 43, 0.45)' },
  sheet: { maxHeight: '90%', gap: 4, paddingTop: 8, paddingHorizontal: 16, borderTopLeftRadius: 28, borderTopRightRadius: 20, backgroundColor: BrandColors.surface },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 4, backgroundColor: BrandColors.border },
  title: { fontSize: 18, fontWeight: '800', color: BrandColors.textPrimary },
  muted: { fontSize: 13, color: BrandColors.textSecondary },
  form: { gap: 14, paddingVertical: 8 },
  field: { gap: 8 },
  label: { fontSize: 13, fontWeight: '700', color: BrandColors.textPrimary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { width: '31%', flexGrow: 1, alignItems: 'center', gap: 4, paddingVertical: 10, borderRadius: 12, backgroundColor: BrandColors.canvas, borderWidth: 1, borderColor: BrandColors.border },
  chipOn: { backgroundColor: BrandColors.accent, borderColor: BrandColors.accent },
  chipText: { fontSize: 12, fontWeight: '600', color: BrandColors.textPrimary },
  chipTextOn: { color: BrandColors.surface },
  error: { fontSize: 13, color: BrandColors.error },
  actions: { flexDirection: 'row', gap: 8, paddingTop: 8 },
  action: { flex: 1 },
});
