import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppScrollView } from '@/components/app-scroll-view';
import { BrandColors } from '@/constants/theme';
import { Field } from '@/features/properties/addProperty/formParts';
import { parsePropertyId } from '@/features/properties/propertyDetailsModel';
import { StateCard } from '@/features/properties/PropertyDetailsScreen';
import { getPropertyErrorMessage } from '@/features/properties/propertyService';
import { newKey } from '@/features/properties/propertySetup';
import { initials } from '@/features/properties/tenantsModel';
import { usePropertyTenants } from '@/features/properties/usePropertyQueries';
import { PropertyGate } from '@/features/rent/PropertyGate';
import {
  buildLedger,
  formatDate,
  formatInr,
  formatPeriod,
  halfOf,
  RECORDABLE_METHODS,
  parseAmount,
  parseDateInput,
  startOfDay,
  toDateInput,
  validatePayment,
  type LedgerRow,
  type PaymentErrors,
  type PaymentMethod,
} from '@/features/rent/rentModel';
import { PaymentRejectedError } from '@/features/rent/rentService';
import { StatusBadge } from '@/features/rent/rentUi';
import { usePayments, useRecordPayment, useRentCharges } from '@/features/rent/useRentQueries';

const DAY_MS = 86_400_000;

// Record Payment for one rent charge of one property. The charge (tenant, month, balance) comes
// from Firestore for this property; nothing is carried over when the tenant/charge changes, because
// the form is keyed by the charge id. Receipts by WhatsApp do not exist, so that option is disabled.
export function RecordPaymentScreen() {
  const params = useLocalSearchParams<{ propertyId?: string | string[]; chargeId?: string | string[] }>();
  const propertyId = parsePropertyId(params.propertyId);
  const rawCharge = Array.isArray(params.chargeId) ? params.chargeId[0] : params.chargeId;
  const presetChargeId = rawCharge && /^[A-Za-z0-9_-]{1,160}$/.test(rawCharge) ? rawCharge : null;
  return (
    <PropertyGate propertyId={propertyId} title="Record Payment">
      {(property) => <PaymentContent key={`${property.id}/${presetChargeId ?? ''}`} propertyId={property.id} presetChargeId={presetChargeId} />}
    </PropertyGate>
  );
}

const leave = () => router.back();

function PaymentContent({ propertyId, presetChargeId }: { propertyId: string; presetChargeId: string | null }) {
  const charges = useRentCharges(propertyId);
  const payments = usePayments(propertyId);
  const tenants = usePropertyTenants(propertyId);
  const [selectedId, setSelectedId] = useState<string | null>(presetChargeId);
  const [now] = useState(Date.now);

  const rows = useMemo(() => {
    if (!charges.data || !payments.data) return [];
    const names = new Map((tenants.data ?? []).map((t) => [t.tenantUid, t.name]));
    return buildLedger(charges.data, payments.data, names, now);
  }, [charges.data, payments.data, tenants.data, now]);

  let body: ReactNode;
  if (charges.isPending || payments.isPending || tenants.isPending) {
    body = (
      <View style={styles.center}>
        <ActivityIndicator color={BrandColors.accent} />
        <Text style={styles.muted}>Loading rent records…</Text>
      </View>
    );
  } else if (charges.isError || payments.isError) {
    body = (
      <StateCard
        icon="error-outline"
        title="Couldn’t load rent records"
        message={getPropertyErrorMessage(charges.error ?? payments.error)}
        actionLabel="Retry"
        onAction={() => {
          charges.refetch();
          payments.refetch();
        }}
      />
    );
  } else {
    const selected = selectedId ? rows.find((r) => r.charge.id === selectedId) : undefined;
    const open = rows.filter((r) => r.remainingInr > 0);
    if (selectedId && !selected) {
      body = <StateCard icon="search-off" title="Charge not found" message="This rent charge does not exist for this property." actionLabel="Back to ledger" onAction={leave} />;
    } else if (selected && selected.remainingInr === 0) {
      body = <StateCard icon="check-circle" title="Already paid in full" message={`${selected.tenantName}’s rent for ${formatPeriod(selected.charge.period)} has no balance.`} actionLabel="Back to ledger" onAction={leave} />;
    } else if (selected) {
      body = (
        <PaymentForm
          key={selected.charge.id}
          propertyId={propertyId}
          row={selected}
          onChange={presetChargeId ? undefined : () => setSelectedId(null)}
        />
      );
    } else if (open.length === 0) {
      body = <StateCard icon="receipt-long" title="Nothing to collect" message="There are no unpaid rent charges for this property." actionLabel="Back to ledger" onAction={leave} />;
    } else {
      body = (
        <View style={styles.list}>
          <Text style={styles.sectionLabel}>Choose the charge being paid</Text>
          {open.map((row) => (
            <Pressable
              key={row.charge.id}
              accessibilityRole="button"
              accessibilityLabel={`${row.tenantName}, ${formatPeriod(row.charge.period)}, balance ${formatInr(row.remainingInr)}`}
              onPress={() => setSelectedId(row.charge.id)}
              style={({ pressed }) => [styles.card, styles.pickRow, pressed && styles.pressed]}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials(row.tenantName)}</Text>
              </View>
              <View style={styles.flex}>
                <Text numberOfLines={1} style={styles.name}>
                  {row.tenantName}
                </Text>
                <Text style={styles.muted}>
                  {formatPeriod(row.charge.period)} · balance {formatInr(row.remainingInr)}
                </Text>
              </View>
              <StatusBadge status={row.status} daysOverdue={row.daysOverdue} />
            </Pressable>
          ))}
        </View>
      );
    }
  }

  return (
    <AppScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {body}
    </AppScrollView>
  );
}

function PaymentForm({ propertyId, row, onChange }: { propertyId: string; row: LedgerRow; onChange?: () => void }) {
  const record = useRecordPayment(propertyId);
  const [now] = useState(Date.now);
  const [paymentId] = useState(newKey);
  const [amount, setAmount] = useState(String(row.remainingInr));
  const [method, setMethod] = useState<PaymentMethod>('upi');
  const [date, setDate] = useState(() => toDateInput(now));
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<PaymentErrors>({});

  const parsed = parseAmount(amount);
  const preset: 'full' | 'half' | 'custom' =
    parsed === row.remainingInr ? 'full' : parsed === halfOf(row.remainingInr) ? 'half' : 'custom';

  const submit = () => {
    const found = validatePayment({ amount, date, reference, note }, row.remainingInr, Date.now());
    setErrors(found);
    if (Object.keys(found).length > 0 || record.isPending) return;
    record.mutate(
      {
        paymentId,
        chargeId: row.charge.id,
        tenantUid: row.charge.tenantUid,
        amountInr: parseAmount(amount) as number,
        method,
        paidMs: parseDateInput(date) as number,
        reference: reference.trim() || null,
        note: note.trim() || null,
      },
      {
        // Leave only after Firestore has confirmed the write.
        onSuccess: () => (router.canGoBack() ? router.back() : router.replace({ pathname: '/owner/properties/[propertyId]/rent-ledger', params: { propertyId } })),
      },
    );
  };

  const today = startOfDay(now);
  return (
    <>
      <View style={styles.card}>
        <View style={styles.tenantTop}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(row.tenantName)}</Text>
          </View>
          <View style={styles.flex}>
            <Text numberOfLines={1} style={styles.name}>
              {row.tenantName}
            </Text>
            <Text style={styles.muted}>Room & bed: not assigned yet</Text>
          </View>
          <StatusBadge status={row.status} daysOverdue={row.daysOverdue} />
        </View>
        {onChange ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Change charge" hitSlop={8} onPress={onChange} style={styles.selfStart}>
            <Text style={styles.link}>Change</Text>
          </Pressable>
        ) : null}
        <View style={styles.grid}>
          <Info label="Monthly rent" value={formatInr(row.charge.amountInr)} />
          <Info label="Cycle" value={formatPeriod(row.charge.period)} />
          <Info label="Due balance" value={formatInr(row.remainingInr)} danger={row.status === 'overdue'} />
        </View>
        <Text style={styles.muted}>Due {formatDate(row.charge.dueMs)}</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.spread}>
          <Text style={styles.heading}>Collection amount</Text>
          <Text style={styles.muted}>INR (₹)</Text>
        </View>
        <Field
          label="Amount"
          value={amount}
          onChangeText={setAmount}
          keyboardType="number-pad"
          maxLength={9}
          error={errors.amount}
          hint={`Balance ${formatInr(row.remainingInr)}`}
        />
        <View style={styles.chipRow}>
          <Chip label={`${formatInr(row.remainingInr)} (Full)`} selected={preset === 'full'} onPress={() => setAmount(String(row.remainingInr))} />
          <Chip label={`${formatInr(halfOf(row.remainingInr))} (Half)`} selected={preset === 'half'} onPress={() => setAmount(String(halfOf(row.remainingInr)))} />
          <Chip label="Custom" selected={preset === 'custom'} onPress={() => setAmount('')} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>Payment details</Text>
        <Text style={styles.label}>Payment mode</Text>
        <View style={styles.methods}>
          {RECORDABLE_METHODS.map((m) => (
            <Pressable
              key={m.value}
              accessibilityRole="radio"
              accessibilityState={{ selected: method === m.value }}
              onPress={() => setMethod(m.value)}
              style={[styles.method, method === m.value && styles.methodOn]}>
              <Text style={[styles.methodText, method === m.value && styles.methodTextOn]}>{m.label}</Text>
            </Pressable>
          ))}
        </View>
        <Field label="Payment date (YYYY-MM-DD)" value={date} onChangeText={setDate} maxLength={10} autoCapitalize="none" error={errors.date} />
        <View style={styles.chipRow}>
          <Chip label="Today" selected={date === toDateInput(today)} onPress={() => setDate(toDateInput(today))} />
          <Chip label="Yesterday" selected={date === toDateInput(today - DAY_MS)} onPress={() => setDate(toDateInput(today - DAY_MS))} />
        </View>
        <Field label="Reference / UTR" optional value={reference} onChangeText={setReference} maxLength={60} autoCapitalize="characters" error={errors.reference} />
        <Field label="Internal note" optional value={note} onChangeText={setNote} maxLength={200} error={errors.note} />
        <View style={[styles.spread, styles.dim]} accessibilityState={{ disabled: true }}>
          <View style={styles.flex}>
            <Text style={styles.label}>Send WhatsApp receipt slip</Text>
            <Text style={styles.muted}>Not available: the app has no messaging service.</Text>
          </View>
          <Switch value={false} disabled accessibilityLabel="Send WhatsApp receipt (not available)" />
        </View>
      </View>

      {record.isError ? <Text style={styles.error}>{paymentErrorMessage(record.error)}</Text> : null}

      <View style={styles.actions}>
        <AppButton
          icon="check"
          label={parsed !== null && parsed <= row.remainingInr ? `Confirm & Record Payment (${formatInr(parsed)})` : 'Confirm & Record Payment'}
          loading={record.isPending}
          onPress={submit}
        />
        <AppButton variant="ghost" label="Cancel & Return to Ledger" disabled={record.isPending} onPress={leave} />
      </View>
    </>
  );
}

function paymentErrorMessage(error: unknown): string {
  if (error instanceof PaymentRejectedError) {
    return error.reason === 'exceeds-balance'
      ? `The balance is now ${formatInr(error.remainingInr)}. Lower the amount and try again.`
      : 'This rent charge no longer exists.';
  }
  const code = (error as { code?: string } | null)?.code;
  if (code === 'permission-denied') return 'The payment was rejected. The rent rules may not be deployed yet.';
  return `The payment was not recorded. ${getPropertyErrorMessage(error)}`;
}

function Info({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <View style={[styles.info, danger && styles.infoDanger]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, danger && { color: BrandColors.error }]}>{value}</Text>
    </View>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.chip, selected && styles.chipOn]}>
      <Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BrandColors.canvas },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  flex: { flex: 1, minWidth: 0 },
  selfStart: { alignSelf: 'flex-start' },
  center: { alignItems: 'center', gap: 8, paddingVertical: 40 },
  muted: { fontSize: 12, color: BrandColors.textSecondary },
  dim: { opacity: 0.6 },
  pressed: { opacity: 0.85 },
  spread: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  list: { gap: 12 },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: BrandColors.textSecondary },
  card: {
    gap: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: BrandColors.surface,
    borderWidth: 1,
    borderColor: BrandColors.border,
    elevation: 2,
    shadowColor: BrandColors.textPrimary,
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tenantTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F0EE' },
  avatarText: { fontSize: 14, fontWeight: '800', color: BrandColors.textPrimary },
  name: { fontSize: 16, fontWeight: '800', color: BrandColors.textPrimary },
  link: { fontSize: 13, fontWeight: '700', color: BrandColors.accent },
  grid: { flexDirection: 'row', gap: 8 },
  info: { flex: 1, gap: 2, padding: 10, borderRadius: 12, backgroundColor: BrandColors.canvas },
  infoDanger: { backgroundColor: BrandColors.errorTint },
  infoLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', color: BrandColors.textSecondary },
  infoValue: { fontSize: 14, fontWeight: '800', color: BrandColors.textPrimary },
  heading: { fontSize: 14, fontWeight: '800', color: BrandColors.textPrimary },
  label: { fontSize: 13, fontWeight: '600', color: BrandColors.textPrimary },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: BrandColors.canvas, borderWidth: 1, borderColor: BrandColors.border },
  chipOn: { backgroundColor: BrandColors.accent, borderColor: BrandColors.accent },
  chipText: { fontSize: 12, fontWeight: '600', color: BrandColors.textPrimary },
  chipTextOn: { color: BrandColors.surface },
  methods: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  method: { flexGrow: 1, flexBasis: '22%', alignItems: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: BrandColors.border, backgroundColor: BrandColors.surface },
  methodOn: { borderColor: BrandColors.accent, backgroundColor: '#E8F0EE' },
  methodText: { fontSize: 12, fontWeight: '700', color: BrandColors.textSecondary },
  methodTextOn: { color: BrandColors.textPrimary },
  error: { fontSize: 13, color: BrandColors.error },
  actions: { gap: 8 },
});
