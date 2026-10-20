import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/app-button';
import { BrandColors } from '@/constants/theme';
import { Chip, Field } from '@/features/properties/addProperty/formParts';
import type { PropertyTenant } from '@/features/properties/propertyTypes';
import {
  currentPeriod,
  formatPeriod,
  parseAmount,
  parseDateInput,
  shiftPeriod,
  validateCharge,
  type ChargeErrors,
  type RentCharge,
} from '@/features/rent/rentModel';

type Props = {
  tenants: readonly PropertyTenant[];
  existing: readonly RentCharge[];
  onSubmit: (input: { tenantUid: string; period: string; amountInr: number; dueMs: number }) => Promise<void>;
  onClose: () => void;
  busy: boolean;
  submitError: string | null;
};

// Creates one month's rent charge for a tenant of the property. There is no room or bed allocation
// yet to take a rent from, so the owner types the amount. Mount only while open (fresh state).
export function AddChargeSheet({ tenants, existing, onSubmit, onClose, busy, submitError }: Props) {
  const insets = useSafeAreaInsets();
  const [now] = useState(Date.now);
  const [tenantUid, setTenantUid] = useState('');
  const [period, setPeriod] = useState(() => currentPeriod(now));
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(() => `${currentPeriod(now)}-01`);
  const [errors, setErrors] = useState<ChargeErrors>({});

  const pickPeriod = (next: string) => {
    setPeriod(next);
    setDueDate(`${next}-01`);
  };

  const submit = () => {
    const found = validateCharge({ tenantUid, period, amount, dueDate }, existing);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    void onSubmit({
      tenantUid,
      period,
      amountInr: parseAmount(amount) as number,
      dueMs: parseDateInput(dueDate) as number,
    });
  };

  const thisMonth = currentPeriod(now);
  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent onRequestClose={busy ? undefined : onClose}>
      <KeyboardAvoidingView behavior="padding" style={styles.root}>
        <Pressable accessibilityLabel="Dismiss" disabled={busy} style={StyleSheet.absoluteFill} onPress={onClose} />
        <View accessibilityViewIsModal style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.handle} />
          <Text accessibilityRole="header" style={styles.title}>
            Add rent charge
          </Text>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.form}>
            <View style={styles.group}>
              <Text style={styles.label}>Tenant</Text>
              <View style={styles.chips}>
                {tenants.map((t) => (
                  <Chip key={t.tenantUid} label={t.name} selected={tenantUid === t.tenantUid} onPress={() => {
                      setTenantUid(t.tenantUid);
                      // An added tenant has an agreed rent; use it as the starting amount.
                      if (t.rentInr !== null) setAmount(String(t.rentInr));
                    }} />
                ))}
              </View>
              {errors.tenantUid ? <Text style={styles.error}>{errors.tenantUid}</Text> : null}
            </View>
            <View style={styles.group}>
              <Text style={styles.label}>Billing month</Text>
              <View style={styles.chips}>
                {[shiftPeriod(thisMonth, -1), thisMonth, shiftPeriod(thisMonth, 1)].map((p) => (
                  <Chip key={p} label={formatPeriod(p)} selected={period === p} onPress={() => pickPeriod(p)} />
                ))}
              </View>
              <Field label="Month (YYYY-MM)" value={period} onChangeText={pickPeriod} maxLength={7} autoCapitalize="none" error={errors.period} />
            </View>
            <Field label="Rent for the month (₹)" value={amount} onChangeText={setAmount} keyboardType="number-pad" maxLength={9} error={errors.amount} />
            <Field label="Due date (YYYY-MM-DD)" value={dueDate} onChangeText={setDueDate} maxLength={10} autoCapitalize="none" error={errors.dueDate} />
            {submitError ? <Text style={styles.error}>{submitError}</Text> : null}
          </ScrollView>
          <View style={styles.actions}>
            <AppButton variant="secondary" label="Cancel" disabled={busy} onPress={onClose} style={styles.action} />
            <AppButton label="Add charge" loading={busy} onPress={submit} style={styles.action} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(32, 42, 43, 0.45)' },
  sheet: {
    maxHeight: '90%',
    gap: 8,
    paddingTop: 8,
    paddingHorizontal: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: BrandColors.surface,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 4, backgroundColor: BrandColors.border },
  title: { fontSize: 18, fontWeight: '800', color: BrandColors.textPrimary },
  form: { gap: 14, paddingVertical: 8 },
  group: { gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  label: { fontSize: 14, fontWeight: '600', color: BrandColors.textPrimary },
  error: { fontSize: 13, color: BrandColors.error },
  actions: { flexDirection: 'row', gap: 8, paddingTop: 8 },
  action: { flex: 1 },
});
