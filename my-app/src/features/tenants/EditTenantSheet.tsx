import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/app-button';
import { BrandColors } from '@/constants/theme';
import { Field } from '@/features/properties/addProperty/formParts';
import { formatInr } from '@/features/rent/rentModel';
import {
  isEditDirty,
  PHONE_COUNTRY,
  toResidentEdit,
  validateEditTenant,
  type EditTenantErrors,
  type EditTenantForm,
} from '@/features/tenants/addTenantModel';
import { ErrorScrollView } from '@/components/form-error-scroll';

type Props = {
  /** The saved values the form starts from (read fresh each time the sheet opens). */
  initial: EditTenantForm;
  stay: { property: string; room: string; bed: string; rentInr: number | null } | null;
  busy: boolean;
  submitError: string | null;
  onSave: (edit: ReturnType<typeof toResidentEdit>, nameChanged: boolean) => void;
  onClose: () => void;
};

// Edit Tenant, as a bottom sheet over Tenant Details. Contact fields only; the stay is shown read-only.
// Mount only while open, so every opening starts from the latest saved data. Leaving with unsaved
// edits asks first; leaving is blocked while a save runs.
export function EditTenantSheet({ initial, stay, busy, submitError, onSave, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState<EditTenantForm>(initial);
  const [errors, setErrors] = useState<EditTenantErrors>({});
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const set = (patch: Partial<EditTenantForm>) => setForm((f) => ({ ...f, ...patch }));
  const dirty = isEditDirty(form, initial);

  const requestClose = () => {
    if (busy) return;
    if (dirty) setConfirmingDiscard(true);
    else onClose();
  };
  const save = () => {
    const found = validateEditTenant(form);
    setErrors(found);
    if (Object.keys(found).length > 0 || busy) return;
    onSave(toResidentEdit(form), form.name.trim() !== initial.name.trim());
  };

  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent onRequestClose={requestClose}>
      <KeyboardAvoidingView behavior="padding" style={styles.root}>
        <Pressable accessibilityLabel="Dismiss" style={StyleSheet.absoluteFill} onPress={requestClose} />
        <View accessibilityViewIsModal style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.flex}>
              <View style={styles.titleRow}>
                <Text accessibilityRole="header" style={styles.title}>
                  Edit Tenant
                </Text>
                <View style={styles.dot} />
              </View>
              <Text style={styles.muted}>Update resident information & contacts</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" disabled={busy} hitSlop={8} onPress={requestClose} style={styles.close}>
              <MaterialIcons name="close" size={18} color={BrandColors.textSecondary} />
            </Pressable>
          </View>

          <ErrorScrollView keyboardShouldPersistTaps="handled" style={styles.body} contentContainerStyle={styles.form}>
            <SectionTitle icon="person" title="Personal details" />
            <Field label="Full name" value={form.name} onChangeText={(name) => set({ name })} maxLength={100} autoCapitalize="words" error={errors.name} />
            <View style={styles.phoneRow}>
              <View style={styles.countryBox} accessible accessibilityLabel={`Country code ${PHONE_COUNTRY}`}>
                <Text style={styles.countryText}>{PHONE_COUNTRY}</Text>
              </View>
              <View style={styles.flex}>
                <Field label="Phone number" value={form.phone} onChangeText={(phone) => set({ phone })} keyboardType="phone-pad" maxLength={12} error={errors.phone} />
              </View>
            </View>
            <Field label="Email address" optional value={form.email} onChangeText={(email) => set({ email })} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} maxLength={120} error={errors.email} />
            <Field label="Current address" optional value={form.address} onChangeText={(address) => set({ address })} maxLength={200} />

            <SectionTitle icon="contact-phone" title="Emergency contact" />
            <Field label="Contact name" optional value={form.emergencyName} onChangeText={(emergencyName) => set({ emergencyName })} maxLength={100} error={errors.emergency} />
            <Field label="Contact phone" optional value={form.emergencyPhone} onChangeText={(emergencyPhone) => set({ emergencyPhone })} keyboardType="phone-pad" maxLength={12} error={errors.emergencyPhone} />

            <View style={styles.stay}>
              <View style={styles.stayHeader}>
                <View style={styles.titleRow}>
                  <MaterialIcons name="bed" size={18} color={BrandColors.textSecondary} />
                  <Text style={styles.stayTitle}>Current stay</Text>
                </View>
                <View style={styles.lock}>
                  <MaterialIcons name="lock" size={12} color={BrandColors.textSecondary} />
                  <Text style={styles.lockText}>Read-only</Text>
                </View>
              </View>
              {stay ? (
                <View style={styles.grid}>
                  <Cell label="Property" value={stay.property} />
                  <Cell label="Room" value={stay.room} />
                  <Cell label="Bed" value={stay.bed} />
                  <Cell label="Monthly rent" value={stay.rentInr !== null ? `${formatInr(stay.rentInr)} / mo` : 'Not set'} />
                </View>
              ) : (
                <Text style={styles.muted}>No active stay.</Text>
              )}
              <View style={styles.note}>
                <MaterialIcons name="info-outline" size={16} color={BrandColors.accent} />
                <Text style={styles.noteText}>To change the room or bed, use Change stay on Tenant Details. The tenant has to accept the change first.</Text>
              </View>
            </View>
            {submitError ? <Text style={styles.error}>{submitError}</Text> : null}
          </ErrorScrollView>

          <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
            {confirmingDiscard ? (
              <View style={styles.discard}>
                <Text style={styles.discardText}>Discard your changes?</Text>
                <View style={styles.row}>
                  <AppButton variant="secondary" label="Keep editing" onPress={() => setConfirmingDiscard(false)} style={styles.flex} />
                  <AppButton variant="destructive" label="Discard" onPress={onClose} style={styles.flex} />
                </View>
              </View>
            ) : (
              <View style={styles.row}>
                <AppButton variant="secondary" label="Cancel" disabled={busy} onPress={requestClose} style={styles.flex} />
                <AppButton icon="check" label="Save Changes" loading={busy} onPress={save} style={styles.flex} />
              </View>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function SectionTitle({ icon, title }: { icon: React.ComponentProps<typeof MaterialIcons>['name']; title: string }) {
  return (
    <View style={styles.titleRow}>
      <MaterialIcons name={icon} size={17} color={BrandColors.accent} />
      <Text style={styles.sectionLabel}>{title}</Text>
    </View>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.cell}>
      <Text style={styles.cellLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.cellValue}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(32, 42, 43, 0.55)' },
  sheet: { maxHeight: '92%', borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: BrandColors.surface, elevation: 12 },
  flex: { flex: 1, minWidth: 0 },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginTop: 10, backgroundColor: BrandColors.border },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 18, fontWeight: '800', color: BrandColors.textPrimary },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: BrandColors.accent },
  muted: { fontSize: 12, color: BrandColors.textSecondary },
  close: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: BrandColors.canvas },
  body: { flexGrow: 0, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: BrandColors.border },
  form: { gap: 14, paddingHorizontal: 20, paddingVertical: 16 },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: BrandColors.textSecondary },
  phoneRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  countryBox: { marginTop: 25, minHeight: 46, paddingHorizontal: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: BrandColors.canvas },
  countryText: { fontSize: 14, fontWeight: '700', color: BrandColors.textPrimary },
  stay: { gap: 10, padding: 14, borderRadius: 16, backgroundColor: BrandColors.canvas, borderWidth: 1, borderColor: BrandColors.border },
  stayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stayTitle: { fontSize: 13, fontWeight: '800', color: BrandColors.textPrimary },
  lock: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: BrandColors.surface },
  lockText: { fontSize: 10, fontWeight: '700', color: BrandColors.textSecondary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { width: '48%', flexGrow: 1, padding: 10, borderRadius: 12, backgroundColor: BrandColors.surface },
  cellLabel: { fontSize: 10, color: BrandColors.textSecondary },
  cellValue: { marginTop: 2, fontSize: 13, fontWeight: '700', color: BrandColors.textPrimary },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  noteText: { flex: 1, fontSize: 12, color: BrandColors.textSecondary },
  error: { fontSize: 13, color: BrandColors.error },
  footer: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: BrandColors.border, backgroundColor: BrandColors.surface },
  row: { flexDirection: 'row', gap: 10 },
  discard: { gap: 10 },
  discardText: { fontSize: 14, fontWeight: '700', color: BrandColors.textPrimary },
});
