import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppScrollView } from '@/components/app-scroll-view';
import { BrandColors } from '@/constants/theme';
import { parsePropertyId } from '@/features/properties/propertyDetailsModel';
import { StateCard } from '@/features/properties/PropertyDetailsScreen';
import { getPropertyErrorMessage } from '@/features/properties/propertyService';
import { usePropertyTenants } from '@/features/properties/usePropertyQueries';
import { initials } from '@/features/properties/tenantsModel';
import { AddChargeSheet } from '@/features/rent/AddChargeSheet';
import { PropertyGate } from '@/features/rent/PropertyGate';
import {
  buildLedger,
  filterLedger,
  formatDate,
  formatInr,
  formatPeriod,
  ledgerSummary,
  type LedgerRow,
  type StatusFilter,
} from '@/features/rent/rentModel';
import { StatusBadge } from '@/features/rent/rentUi';
import { useCreateRentCharge, usePayments, useRentCharges } from '@/features/rent/useRentQueries';

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unpaid', label: 'Unpaid' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'paid', label: 'Paid' },
];

// Rent Ledger of one property. Charges and payments are read from that property's own
// subcollections (see rentService), and the content is keyed by property id, so switching property
// cannot show the previous one's records. Everything is derived from saved charges and payments.
export function RentLedgerScreen() {
  const params = useLocalSearchParams<{ propertyId?: string | string[] }>();
  const propertyId = parsePropertyId(params.propertyId);
  return (
    <PropertyGate propertyId={propertyId} title="Rent Ledger">
      {(property) => <LedgerContent key={property.id} propertyId={property.id} />}
    </PropertyGate>
  );
}

function LedgerContent({ propertyId }: { propertyId: string }) {
  const charges = useRentCharges(propertyId);
  const payments = usePayments(propertyId);
  const tenants = usePropertyTenants(propertyId);
  const createCharge = useCreateRentCharge(propertyId);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [period, setPeriod] = useState<string | 'all'>('all');
  const [adding, setAdding] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [now] = useState(Date.now);

  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 4000);
    return () => clearTimeout(t);
  }, [banner]);

  const loading = charges.isPending || payments.isPending || tenants.isPending;
  const failed = charges.isError || payments.isError;

  const rows = useMemo(() => {
    if (!charges.data || !payments.data) return [];
    const names = new Map((tenants.data ?? []).map((t) => [t.tenantUid, t.name]));
    return buildLedger(charges.data, payments.data, names, now);
  }, [charges.data, payments.data, tenants.data, now]);

  const periods = useMemo(() => [...new Set(rows.map((r) => r.charge.period))].sort().reverse(), [rows]);
  const inPeriod = useMemo(() => filterLedger(rows, { status: 'all', period, search: '' }), [rows, period]);
  const summary = useMemo(() => ledgerSummary(inPeriod), [inPeriod]);
  const counts = useMemo(
    () => ({
      all: inPeriod.length,
      unpaid: inPeriod.filter((r) => r.status !== 'paid').length,
      overdue: inPeriod.filter((r) => r.status === 'overdue').length,
      paid: inPeriod.filter((r) => r.status === 'paid').length,
    }),
    [inPeriod],
  );
  const visible = useMemo(() => filterLedger(rows, { status, period, search }), [rows, status, period, search]);
  const openRows = rows.filter((r) => r.remainingInr > 0);

  const refetchAll = () => {
    charges.refetch();
    payments.refetch();
    tenants.refetch();
  };
  const openPayment = (chargeId?: string) =>
    router.push({ pathname: '/owner/properties/[propertyId]/record-payment', params: chargeId ? { propertyId, chargeId } : { propertyId } });

  const submitCharge = async (input: Parameters<typeof createCharge.mutateAsync>[0]) => {
    try {
      await createCharge.mutateAsync(input);
      setAdding(false);
      setBanner('Rent charge added.');
    } catch {
      // Shown in the sheet through createCharge.error.
    }
  };

  let body: ReactNode;
  if (loading) {
    body = (
      <View style={styles.center}>
        <ActivityIndicator color={BrandColors.accent} />
        <Text style={styles.muted}>Loading rent records…</Text>
      </View>
    );
  } else if (failed) {
    body = (
      <StateCard icon="error-outline" title="Couldn’t load the rent ledger" message={getPropertyErrorMessage(charges.error ?? payments.error)} actionLabel="Retry" onAction={refetchAll} />
    );
  } else if (rows.length === 0) {
    const noTenants = (tenants.data ?? []).length === 0;
    body = (
      <StateCard
        icon="receipt-long"
        title="No rent charges yet"
        message={
          noTenants
            ? 'Rent is charged to tenants of this property. No tenant has joined it yet.'
            : 'Add a monthly rent charge for a tenant, then record payments against it.'
        }
        actionLabel="Add rent charge"
        onAction={() => (noTenants ? setBanner('Add a charge once a tenant has joined this property.') : setAdding(true))}
      />
    );
  } else if (visible.length === 0) {
    body = (
      <StateCard
        icon="search-off"
        title="No records match"
        message="Try another search, status or month."
        actionLabel="Clear search and filters"
        onAction={() => {
          setSearch('');
          setStatus('all');
          setPeriod('all');
        }}
      />
    );
  } else {
    body = (
      <View style={styles.list}>
        {visible.map((row) => (
          <LedgerCard key={row.charge.id} row={row} onRecord={() => openPayment(row.charge.id)} />
        ))}
      </View>
    );
  }

  const ready = !loading && !failed;
  return (
    <AppScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={(charges.isRefetching || payments.isRefetching) && !loading} onRefresh={refetchAll} />}>
      {banner ? (
        <View style={styles.banner} accessibilityLiveRegion="polite">
          <MaterialIcons name="info-outline" size={18} color={BrandColors.accent} />
          <Text style={styles.bannerText}>{banner}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>{period === 'all' ? 'All months' : formatPeriod(period)}</Text>
        {ready && rows.length > 0 ? (
          <>
            <View style={styles.metrics}>
              <Metric label="Charged" value={formatInr(summary.chargedInr)} />
              <Metric label="Collected" value={formatInr(summary.collectedInr)} accent />
            </View>
            <View style={styles.metrics}>
              <Metric label="Outstanding" value={formatInr(summary.outstandingInr)} />
              <Metric
                label="Overdue"
                value={formatInr(summary.overdueInr)}
                note={`${summary.overdueCount} ${summary.overdueCount === 1 ? 'charge' : 'charges'}`}
                danger={summary.overdueCount > 0}
              />
            </View>
          </>
        ) : (
          <Text style={styles.muted}>{ready ? 'Totals appear once a rent charge is added.' : 'Totals are unavailable right now.'}</Text>
        )}
      </View>

      <View style={styles.searchRow}>
        <View style={styles.search}>
          <MaterialIcons name="search" size={20} color={BrandColors.textSecondary} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search tenant..."
            placeholderTextColor={BrandColors.textSecondary}
            accessibilityLabel="Search tenants in the ledger"
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.searchInput}
          />
          {search.length > 0 ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={10} onPress={() => setSearch('')}>
              <MaterialIcons name="close" size={18} color={BrandColors.textSecondary} />
            </Pressable>
          ) : null}
        </View>
        <AppButton icon="add" label="Charge" size="sm" onPress={() => setAdding(true)} disabled={!ready || (tenants.data ?? []).length === 0} accessibilityLabel="Add rent charge" style={styles.fixed} />
      </View>
      <AppButton
        variant="secondary"
        icon="payments"
        label="Record Payment"
        onPress={() => openPayment()}
        disabled={!ready || openRows.length === 0}
        accessibilityLabel={openRows.length === 0 ? 'Record payment (no unpaid charges)' : 'Record payment'}
      />

      {ready && rows.length > 0 ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {FILTERS.map((f) => (
              <Pill key={f.key} label={`${f.label} (${counts[f.key]})`} selected={status === f.key} onPress={() => setStatus(f.key)} />
            ))}
          </ScrollView>
          {periods.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              <Pill label="All months" selected={period === 'all'} onPress={() => setPeriod('all')} subtle />
              {periods.map((p) => (
                <Pill key={p} label={formatPeriod(p)} selected={period === p} onPress={() => setPeriod(p)} subtle />
              ))}
            </ScrollView>
          ) : null}
        </>
      ) : null}

      {body}

      {adding ? (
        <AddChargeSheet
          tenants={tenants.data ?? []}
          existing={charges.data ?? []}
          busy={createCharge.isPending}
          submitError={createCharge.isError ? chargeErrorMessage(createCharge.error) : null}
          onSubmit={submitCharge}
          onClose={() => {
            createCharge.reset();
            setAdding(false);
          }}
        />
      ) : null}
    </AppScrollView>
  );
}

function chargeErrorMessage(error: unknown): string {
  const code = (error as { code?: string } | null)?.code;
  if (code === 'permission-denied') {
    return 'Could not add the charge. It may already exist for that month, or the rent rules are not deployed yet.';
  }
  return `Could not add the charge. ${getPropertyErrorMessage(error)}`;
}

function Metric({ label, value, note, accent, danger }: { label: string; value: string; note?: string; accent?: boolean; danger?: boolean }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, accent && { color: BrandColors.accent }, danger && { color: BrandColors.error }]}>{value}</Text>
      {note ? <Text style={styles.metricNote}>{note}</Text> : null}
    </View>
  );
}

function Pill({ label, selected, onPress, subtle }: { label: string; selected: boolean; onPress: () => void; subtle?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.pill, subtle && styles.pillSubtle, selected && styles.pillOn]}>
      <Text style={[styles.pillText, selected && styles.pillTextOn]}>{label}</Text>
    </Pressable>
  );
}

function LedgerCard({ row, onRecord }: { row: LedgerRow; onRecord: () => void }) {
  const { charge } = row;
  return (
    <View style={styles.rowCard}>
      <View style={styles.rowTop}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(row.tenantName)}</Text>
        </View>
        <View style={styles.flex}>
          <Text numberOfLines={1} style={styles.name}>
            {row.tenantName}
          </Text>
          <Text numberOfLines={1} style={styles.muted}>
            {formatPeriod(charge.period)} · due {formatDate(charge.dueMs)}
          </Text>
        </View>
        <StatusBadge status={row.status} daysOverdue={row.daysOverdue} />
      </View>
      <View style={styles.rowFooter}>
        <View style={styles.flex}>
          <Text style={styles.sectionLabel}>Charge / Paid / Balance</Text>
          <Text style={styles.amounts}>
            {formatInr(charge.amountInr)} · {formatInr(row.paidInr)} ·{' '}
            <Text style={row.remainingInr > 0 ? styles.balanceDue : styles.balanceClear}>{formatInr(row.remainingInr)}</Text>
          </Text>
        </View>
        {row.remainingInr > 0 ? (
          <AppButton variant="secondary" size="sm" label="Record" onPress={onRecord} accessibilityLabel={`Record payment for ${row.tenantName}, ${formatPeriod(charge.period)}`} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BrandColors.canvas },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  flex: { flex: 1, minWidth: 0 },
  fixed: { flexShrink: 0 },
  center: { alignItems: 'center', gap: 8, paddingVertical: 40 },
  muted: { fontSize: 12, color: BrandColors.textSecondary },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, backgroundColor: '#E8F0EE' },
  bannerText: { flex: 1, fontSize: 13, fontWeight: '600', color: BrandColors.textPrimary },
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
  sectionLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: BrandColors.textSecondary },
  metrics: { flexDirection: 'row', gap: 10 },
  metric: { flex: 1, gap: 2, padding: 12, borderRadius: 12, backgroundColor: BrandColors.canvas },
  metricLabel: { fontSize: 11, color: BrandColors.textSecondary },
  metricValue: { fontSize: 18, fontWeight: '800', color: BrandColors.textPrimary },
  metricNote: { fontSize: 11, color: BrandColors.textSecondary },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  search: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, borderRadius: 12, backgroundColor: BrandColors.surface, borderWidth: 1, borderColor: BrandColors.border },
  searchInput: { flex: 1, paddingVertical: 8, fontSize: 14, color: BrandColors.textPrimary },
  chips: { gap: 8, paddingVertical: 2 },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: BrandColors.surface, borderWidth: 1, borderColor: BrandColors.border },
  pillSubtle: { paddingVertical: 5 },
  pillOn: { backgroundColor: BrandColors.accent, borderColor: BrandColors.accent },
  pillText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', color: BrandColors.textSecondary },
  pillTextOn: { color: BrandColors.surface },
  list: { gap: 12 },
  rowCard: {
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
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F0EE' },
  avatarText: { fontSize: 14, fontWeight: '800', color: BrandColors.textPrimary },
  name: { fontSize: 16, fontWeight: '800', color: BrandColors.textPrimary },
  rowFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10, backgroundColor: BrandColors.canvas },
  amounts: { marginTop: 2, fontSize: 13, fontWeight: '700', color: BrandColors.textPrimary },
  balanceDue: { color: BrandColors.error },
  balanceClear: { color: BrandColors.accent },
});
