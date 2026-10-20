import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { BrandColors } from '@/constants/theme';
import { getPropertyErrorMessage } from '@/features/properties/propertyService';
import { initials } from '@/features/properties/tenantsModel';
import { formatInr } from '@/features/rent/rentModel';
import { StatusBadge } from '@/features/rent/rentUi';
import {
  filterRoster,
  summarizeRoster,
  tabCounts,
  type RosterTenant,
  type StatusTab,
} from '@/features/tenants/rosterModel';
import { useOwnerRoster } from '@/features/tenants/useOwnerRoster';

const TABS: { key: StatusTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'due', label: 'Due' },
  { key: 'overdue', label: 'Overdue' },
];

/** With a property selected on screen it is preselected in the form; otherwise the owner chooses. */
const openAddTenant = (propertyId?: string) =>
  router.push(propertyId ? { pathname: '/owner/add-tenant', params: { propertyId } } : '/owner/add-tenant');

const openTenant = (tenant: RosterTenant) =>
  router.push({ pathname: '/owner/tenants/[tenantId]', params: { tenantId: tenant.tenantUid, propertyId: tenant.propertyId } });

// Owner's Tenants tab: tenants across the owner's own properties (one query set per owned property,
// each restricted to that property and the owner by the rules). The selected property is kept by id.
// Room/bed, sharing and phone numbers are not stored anywhere yet, so they are not shown; rent status
// is derived only from saved rent charges and payments.
export function TenantsOverviewScreen() {
  const data = useOwnerRoster();
  const [search, setSearch] = useState('');
  const [propertyId, setPropertyId] = useState<string | 'all'>('all');
  const [tab, setTab] = useState<StatusTab>('all');

  // A property that no longer exists in the owner's list falls back to "all".
  const scope = propertyId === 'all' || data.properties.some((p) => p.id === propertyId) ? propertyId : 'all';
  const activeTab = tab === 'due' || tab === 'overdue' ? (data.rentAvailable ? tab : 'all') : tab;

  const summary = useMemo(() => summarizeRoster(data.roster, data.rentAvailable), [data.roster, data.rentAvailable]);
  const counts = useMemo(() => tabCounts(data.roster, scope), [data.roster, scope]);
  const visible = useMemo(
    () => filterRoster(data.roster, { propertyId: scope, tab: activeTab, search }),
    [data.roster, scope, activeTab, search],
  );
  const perProperty = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of data.roster) m.set(r.propertyId, (m.get(r.propertyId) ?? 0) + 1);
    return m;
  }, [data.roster]);
  const noCharges = data.roster.every((r) => r.rent.kind === 'none');

  const header = (
    <View style={styles.header}>
      <View style={styles.card}>
        <View style={styles.summary}>
          <SummaryCell label="Total" value={String(summary.totalTenants)} sub="Residents" />
          <View style={styles.divider} />
          <SummaryCell label="Active" value={String(summary.activeTenants)} sub="With a joined account" accent />
          <View style={styles.divider} />
          <SummaryCell
            label="Pending"
            value={summary.pendingInr === null || noCharges ? '—' : formatInr(summary.pendingInr)}
            sub={summary.pendingInr === null ? 'Rent data unavailable' : noCharges ? 'No rent charges yet' : `${summary.dueRows} unpaid`}
            danger={!!summary.pendingInr}
          />
        </View>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.search}>
          <MaterialIcons name="search" size={19} color={BrandColors.textSecondary} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search name, room or property..."
            placeholderTextColor={BrandColors.textSecondary}
            accessibilityLabel="Search tenants"
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
        <AppButton
          icon="person-add"
          label="Add"
          size="sm"
          onPress={() => openAddTenant(scope === 'all' ? undefined : scope)}
          disabled={data.properties.length === 0}
          accessibilityLabel="Add tenant"
          style={styles.fixed}
        />
      </View>

      {data.properties.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Pill label={`All Properties (${data.roster.length})`} selected={scope === 'all'} onPress={() => setPropertyId('all')} />
          {data.properties.map((p) => (
            <Pill key={p.id} label={`${p.name} (${perProperty.get(p.id) ?? 0})`} selected={scope === p.id} onPress={() => setPropertyId(p.id)} />
          ))}
        </ScrollView>
      ) : null}

      <View style={styles.segmented} accessibilityRole="tablist">
        {TABS.map((t) => {
          const disabled = (t.key === 'due' || t.key === 'overdue') && !data.rentAvailable;
          const selected = activeTab === t.key;
          return (
            <Pressable
              key={t.key}
              accessibilityRole="tab"
              accessibilityState={{ selected, disabled }}
              accessibilityLabel={disabled ? `${t.label} (rent data unavailable)` : t.label}
              disabled={disabled}
              onPress={() => setTab(t.key)}
              style={[styles.segment, selected && styles.segmentOn, disabled && styles.dim]}>
              <Text style={[styles.segmentText, selected && styles.segmentTextOn]}>
                {t.label}
                {disabled ? '' : ` (${counts[t.key]})`}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  let empty: React.ReactNode = null;
  if (data.isPending) {
    empty = (
      <View style={styles.center}>
        <ActivityIndicator color={BrandColors.accent} />
        <Text style={styles.muted}>Loading tenants…</Text>
      </View>
    );
  } else if (data.isError) {
    empty = (
      <Notice icon="error-outline" title="Couldn’t load tenants" message={getPropertyErrorMessage(data.error)} actionLabel="Retry" onAction={data.refetch} />
    );
  } else if (data.properties.length === 0) {
    empty = (
      <Notice icon="apartment" title="No properties yet" message="Add a property first; tenants join a property." actionLabel="Go to Properties" onAction={() => router.navigate('/owner/properties')} />
    );
  } else if (data.roster.length === 0) {
    empty = (
      <Notice icon="group" title="No tenants yet" message="Tenants appear here after they join one of your properties with an invite code." actionLabel="Add tenant" onAction={() => openAddTenant(scope === 'all' ? undefined : scope)} />
    );
  } else if (visible.length === 0) {
    empty = (
      <Notice
        icon="search-off"
        title="No tenants match"
        message="Try another search, property or status."
        actionLabel="Clear search and filters"
        onAction={() => {
          setSearch('');
          setPropertyId('all');
          setTab('all');
        }}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={data.isPending || data.isError ? [] : visible}
        keyExtractor={(r) => r.key}
        renderItem={({ item }) => <TenantCard tenant={item} showProperty={scope === 'all'} />}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={Separator}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={data.isRefetching && !data.isPending} onRefresh={data.refetch} />}
      />
    </View>
  );
}

const Separator = () => <View style={styles.separator} />;

function SummaryCell({ label, value, sub, accent, danger }: { label: string; value: string; sub: string; accent?: boolean; danger?: boolean }) {
  return (
    <View style={styles.cell}>
      <Text style={styles.cellLabel}>{label}</Text>
      <Text style={[styles.cellValue, danger && { color: BrandColors.error }]}>{value}</Text>
      <Text style={[styles.cellSub, accent && { color: BrandColors.accent }]} numberOfLines={2}>
        {sub}
      </Text>
    </View>
  );
}

function Pill({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.pill, selected && styles.pillOn]}>
      <Text style={[styles.pillText, selected && styles.pillTextOn]}>{label}</Text>
    </Pressable>
  );
}

function Notice({ icon, title, message, actionLabel, onAction }: { icon: React.ComponentProps<typeof MaterialIcons>['name']; title: string; message: string; actionLabel: string; onAction: () => void }) {
  return (
    <View style={styles.notice}>
      <View style={styles.noticeIcon}>
        <MaterialIcons name={icon} size={24} color={BrandColors.textSecondary} />
      </View>
      <Text style={styles.noticeTitle}>{title}</Text>
      <Text style={styles.noticeMessage}>{message}</Text>
      <AppButton label={actionLabel} onPress={onAction} style={styles.noticeAction} />
    </View>
  );
}

function TenantCard({ tenant, showProperty }: { tenant: RosterTenant; showProperty: boolean }) {
  const { rent } = tenant;
  const active = tenant.status === 'active';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${tenant.name}, ${tenant.propertyName}`}
      onPress={() => openTenant(tenant)}
      style={({ pressed }) => [styles.tenant, pressed && styles.pressed]}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials(tenant.name)}</Text>
      </View>
      <View style={styles.flex}>
        <View style={styles.nameRow}>
          <Text numberOfLines={1} style={styles.name}>
            {tenant.name}
          </Text>
          <View style={[styles.dot, { backgroundColor: active ? BrandColors.accent : BrandColors.textSecondary }]} accessibilityLabel={active ? 'Active' : 'Inactive'} />
        </View>
        {showProperty ? (
          <Text numberOfLines={1} style={styles.muted}>
            {tenant.propertyName}
          </Text>
        ) : null}
        <Text numberOfLines={1} style={styles.small}>
          {tenant.placement ?? 'Room & bed not assigned yet'}
        </Text>
      </View>
      <View style={styles.right}>
        {rent.kind === 'none' ? (
          <Text style={styles.small}>No rent charge</Text>
        ) : (
          <>
            <Text style={styles.amount}>{formatInr(rent.latestAmountInr)}</Text>
            {rent.kind === 'paid' ? (
              <StatusBadge status="paid" daysOverdue={0} />
            ) : (
              <>
                <StatusBadge status={rent.status} daysOverdue={rent.daysOverdue} />
                <Text style={styles.small}>{formatInr(rent.outstandingInr)} due</Text>
              </>
            )}
          </>
        )}
      </View>
      <MaterialIcons name="chevron-right" size={20} color={BrandColors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BrandColors.canvas },
  content: { padding: 16, paddingBottom: 32 },
  header: { gap: 14, paddingBottom: 14 },
  separator: { height: 10 },
  flex: { flex: 1, minWidth: 0 },
  fixed: { flexShrink: 0 },
  dim: { opacity: 0.45 },
  pressed: { opacity: 0.85 },
  center: { alignItems: 'center', gap: 8, paddingVertical: 40 },
  muted: { fontSize: 12, color: BrandColors.textSecondary },
  small: { fontSize: 11, color: BrandColors.textSecondary },
  card: { padding: 16, borderRadius: 16, backgroundColor: BrandColors.surface, borderWidth: 1, borderColor: BrandColors.border },
  summary: { flexDirection: 'row', alignItems: 'stretch' },
  divider: { width: StyleSheet.hairlineWidth, backgroundColor: BrandColors.border },
  cell: { flex: 1, alignItems: 'center', gap: 2, paddingHorizontal: 4 },
  cellLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: BrandColors.textSecondary },
  cellValue: { fontSize: 24, fontWeight: '800', color: BrandColors.textPrimary },
  cellSub: { fontSize: 11, textAlign: 'center', color: BrandColors.textSecondary },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  search: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderRadius: 12, backgroundColor: BrandColors.surface, borderWidth: 1, borderColor: BrandColors.border },
  searchInput: { flex: 1, paddingVertical: 8, fontSize: 14, color: BrandColors.textPrimary },
  chips: { gap: 8, paddingVertical: 2 },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: BrandColors.surface, borderWidth: 1, borderColor: BrandColors.border },
  pillOn: { backgroundColor: BrandColors.accent, borderColor: BrandColors.accent },
  pillText: { fontSize: 12, fontWeight: '700', color: BrandColors.textSecondary },
  pillTextOn: { color: BrandColors.surface },
  segmented: { flexDirection: 'row', padding: 3, borderRadius: 12, backgroundColor: '#E8EEEC' },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10 },
  segmentOn: { backgroundColor: BrandColors.accent },
  segmentText: { fontSize: 12, fontWeight: '700', color: BrandColors.textSecondary },
  segmentTextOn: { color: BrandColors.surface },
  tenant: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, backgroundColor: BrandColors.surface, borderWidth: 1, borderColor: BrandColors.border },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F0EE' },
  avatarText: { fontSize: 14, fontWeight: '800', color: BrandColors.textPrimary },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { flexShrink: 1, fontSize: 16, fontWeight: '800', color: BrandColors.textPrimary },
  dot: { width: 6, height: 6, borderRadius: 3 },
  right: { alignItems: 'flex-end', gap: 3, maxWidth: 130 },
  amount: { fontSize: 15, fontWeight: '800', color: BrandColors.textPrimary },
  notice: { alignItems: 'center', padding: 28, borderRadius: 16, backgroundColor: BrandColors.surface, borderWidth: 1, borderColor: BrandColors.border },
  noticeIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 12, backgroundColor: BrandColors.canvas },
  noticeTitle: { fontSize: 16, fontWeight: '700', color: BrandColors.textPrimary },
  noticeMessage: { marginTop: 4, textAlign: 'center', fontSize: 13, color: BrandColors.textSecondary },
  noticeAction: { marginTop: 14, alignSelf: 'stretch' },
});
