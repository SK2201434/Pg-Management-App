import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppButton } from '@/components/app-button';
import { BrandColors } from '@/constants/theme';
import { filterAttention, type AttentionFilter } from '@/features/dashboard/dashboardModel';
import { formatRupees, pluralize } from '@/features/dashboard/dashboardFormat';
import type { AttentionRow, Metric, RentAmount } from '@/features/dashboard/dashboardTypes';
import { MetricBoundary } from '@/features/dashboard/MetricBoundary';
import { initials } from '@/features/properties/tenantsModel';
import { formatPeriod } from '@/features/rent/rentModel';
import { StatusBadge } from '@/features/rent/rentUi';

function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

type OutstandingProps = {
  metric: Metric<RentAmount>;
  hasCharges: boolean;
  /** Opens the payment flow; absent when there is nothing to record against. */
  onRecordPayment?: () => void;
};

// The main money card: what is still owed, how many tenants owe it, and the way to record a payment.
export function OutstandingRentCard({ metric, hasCharges, onRecordPayment }: OutstandingProps) {
  return (
    <Card style={styles.hero}>
      <View style={styles.spread}>
        <View style={styles.titleRow}>
          <View style={styles.redDot} />
          <Text style={styles.eyebrow}>Total outstanding rent</Text>
        </View>
        <View style={styles.walletIcon}>
          <MaterialIcons name="account-balance-wallet" size={20} color={BrandColors.textPrimary} />
        </View>
      </View>
      <MetricBoundary metric={metric} skeletonHeight={40}>
        {(r) => (
          <>
            <Text style={styles.heroValue}>{formatRupees(r.amountInr)}</Text>
            {r.tenantCount > 0 ? (
              <View style={styles.warn}>
                <MaterialIcons name="warning" size={14} color={BrandColors.error} />
                <Text style={styles.warnText}>{pluralize(r.tenantCount, 'tenant')} with unpaid balances</Text>
              </View>
            ) : (
              <Text style={styles.sub}>{hasCharges ? 'No outstanding payments' : 'No rent charges have been added yet'}</Text>
            )}
          </>
        )}
      </MetricBoundary>
      <AppButton
        icon="add-circle-outline"
        label="Record Payment"
        onPress={onRecordPayment ?? (() => undefined)}
        disabled={!onRecordPayment}
        accessibilityLabel={onRecordPayment ? 'Record payment' : 'Record payment (nothing to collect)'}
      />
    </Card>
  );
}

export function CollectedCard({ metric, monthLabel, style }: { metric: Metric<{ amountInr: number }>; monthLabel: string; style?: StyleProp<ViewStyle> }) {
  return (
    <Card style={style}>
      <View style={styles.spread}>
        <Text style={styles.eyebrow}>Collected ({monthLabel})</Text>
        <MaterialIcons name="check-circle" size={18} color={BrandColors.accent} />
      </View>
      <MetricBoundary metric={metric} skeletonHeight={30}>
        {(c) => <Text style={styles.value}>{formatRupees(c.amountInr)}</Text>}
      </MetricBoundary>
    </Card>
  );
}

export function DueSoonCard({ metric, style }: { metric: Metric<RentAmount>; style?: StyleProp<ViewStyle> }) {
  return (
    <Card style={style}>
      <View style={styles.spread}>
        <Text style={styles.eyebrow}>Due in 7 days</Text>
        <MaterialIcons name="schedule" size={18} color={BrandColors.textSecondary} />
      </View>
      <MetricBoundary metric={metric} skeletonHeight={30}>
        {(r) =>
          r.tenantCount === 0 ? (
            <Text style={styles.sub}>Nothing due</Text>
          ) : (
            <>
              <Text style={styles.value}>{formatRupees(r.amountInr)}</Text>
              <View style={styles.titleRow}>
                <MaterialIcons name="group" size={14} color={BrandColors.textSecondary} />
                <Text style={styles.small}>{pluralize(r.tenantCount, 'upcoming tenant')}</Text>
              </View>
            </>
          )
        }
      </MetricBoundary>
    </Card>
  );
}

type AttentionProps = {
  metric: Metric<AttentionRow[]>;
  onRecord: (row: AttentionRow) => void;
  onOpenTenant: (row: AttentionRow) => void;
};

const VISIBLE = 6;

const FILTERS: { key: AttentionFilter; label: string }[] = [
  { key: 'all', label: 'All Urgent' },
  { key: 'overdue', label: 'Overdue Only' },
  { key: 'due-today', label: 'Due Today' },
];

// Overdue and due-today balances. Reminders and payment verification do not exist in the app, so the
// only action is Record (the existing payment flow); tapping a row opens the tenant.
export function NeedsAttention({ metric, onRecord, onOpenTenant }: AttentionProps) {
  const [filter, setFilter] = useState<AttentionFilter>('all');
  const count = metric.status === 'ready' ? metric.value.length : null;
  return (
    <View style={styles.section}>
      <View style={styles.titleRow}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          Needs Attention
        </Text>
        {count !== null && count > 0 ? (
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{count}</Text>
          </View>
        ) : null}
      </View>
      <MetricBoundary metric={metric} skeletonHeight={60}>
        {(rows) => {
          if (rows.length === 0) {
            return (
              <Card>
                <Text style={styles.sub}>No overdue or due-today payments.</Text>
              </Card>
            );
          }
          const shown = filterAttention(rows, filter);
          return (
            <>
              <View style={styles.chips} accessibilityRole="tablist">
                {FILTERS.map((f) => {
                  const n = filterAttention(rows, f.key).length;
                  const selected = filter === f.key;
                  return (
                    <Pressable key={f.key} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => setFilter(f.key)} style={[styles.chip, selected && styles.chipOn]}>
                      <Text style={[styles.chipText, selected && styles.chipTextOn]}>
                        {f.label} ({n})
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.list}>
                {shown.slice(0, VISIBLE).map((row, i) => (
                  <View key={row.key} style={[styles.row, i > 0 && styles.rowDivider]}>
                    <Pressable accessibilityRole="button" accessibilityLabel={`${row.name}, ${formatRupees(row.remainingInr)}. Open tenant`} onPress={() => onOpenTenant(row)} style={styles.rowTop}>
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{initials(row.name)}</Text>
                      </View>
                      <View style={styles.flex}>
                        <Text numberOfLines={1} style={styles.rowName}>
                          {row.name}
                        </Text>
                        <Text numberOfLines={1} style={styles.small}>
                          {[row.placement, row.propertyName].filter(Boolean).join(' • ')}
                        </Text>
                      </View>
                      <View style={styles.rowRight}>
                        <Text style={styles.rowAmount}>{formatRupees(row.remainingInr)}</Text>
                        {row.status === 'overdue' ? <StatusBadge status="overdue" daysOverdue={row.daysOverdue} /> : <StatusBadge status="due-today" daysOverdue={0} />}
                      </View>
                    </Pressable>
                    <View style={styles.rowFooter}>
                      <Text style={styles.small}>{formatPeriod(row.period)} rent</Text>
                      <AppButton variant="secondary" size="sm" label="Record" onPress={() => onRecord(row)} accessibilityLabel={`Record payment for ${row.name}`} />
                    </View>
                  </View>
                ))}
                {shown.length === 0 ? <Text style={[styles.sub, styles.pad]}>Nothing in this filter.</Text> : null}
                {shown.length > VISIBLE ? <Text style={[styles.small, styles.pad]}>+{shown.length - VISIBLE} more. See them in each property’s Rent Ledger.</Text> : null}
              </View>
            </>
          );
        }}
      </MetricBoundary>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  spread: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  card: {
    gap: 10,
    padding: 16,
    borderRadius: 18,
    backgroundColor: BrandColors.surface,
    borderWidth: 1,
    borderColor: BrandColors.border,
    shadowColor: BrandColors.textPrimary,
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  hero: { gap: 12 },
  eyebrow: { flexShrink: 1, fontSize: 10, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', color: BrandColors.textSecondary },
  redDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: BrandColors.error },
  walletIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: BrandColors.canvas },
  heroValue: { fontSize: 34, fontWeight: '800', color: BrandColors.textPrimary },
  warn: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: BrandColors.errorTint },
  warnText: { fontSize: 12, fontWeight: '700', color: BrandColors.error },
  value: { fontSize: 22, fontWeight: '800', color: BrandColors.textPrimary },
  sub: { fontSize: 14, color: BrandColors.textSecondary },
  small: { fontSize: 11, color: BrandColors.textSecondary },
  pad: { padding: 14 },
  section: { gap: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: BrandColors.textPrimary },
  countBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: BrandColors.errorTint },
  countText: { fontSize: 11, fontWeight: '800', color: BrandColors.error },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: '#E8EEEC' },
  chipOn: { backgroundColor: BrandColors.textPrimary },
  chipText: { fontSize: 12, fontWeight: '700', color: BrandColors.textSecondary },
  chipTextOn: { color: BrandColors.surface },
  list: { borderRadius: 18, backgroundColor: BrandColors.surface, borderWidth: 1, borderColor: BrandColors.border, overflow: 'hidden' },
  row: { padding: 14, gap: 10 },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: BrandColors.border },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F0EE' },
  avatarText: { fontSize: 14, fontWeight: '800', color: BrandColors.textPrimary },
  rowName: { fontSize: 15, fontWeight: '800', color: BrandColors.textPrimary },
  rowRight: { alignItems: 'flex-end', gap: 4, maxWidth: 130 },
  rowAmount: { fontSize: 15, fontWeight: '800', color: BrandColors.textPrimary },
  rowFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
});
