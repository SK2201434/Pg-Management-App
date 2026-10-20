import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppScrollView } from '@/components/app-scroll-view';
import { OptionSheet } from '@/components/option-sheet';
import { BrandColors } from '@/constants/theme';
import { occupancyPercent, parsePropertyId, summarizeRooms } from '@/features/properties/propertyDetailsModel';
import { StateCard } from '@/features/properties/PropertyDetailsScreen';
import { getPropertyErrorMessage, PropertyRequestError } from '@/features/properties/propertyService';
import { sharingLabel } from '@/features/properties/propertySetup';
import { formatInr } from '@/features/rent/rentModel';
import type { PropertyTenant } from '@/features/properties/propertyTypes';
import { activeTenantCount, formatJoined, initials, searchTenants } from '@/features/properties/tenantsModel';
import {
  useOwnerProperties,
  usePropertyDetail,
  usePropertyRooms,
  usePropertyTenants,
} from '@/features/properties/usePropertyQueries';

const goToProperties = () => router.replace('/owner/properties');

// Tenants of one property. The route param is validated, the property is re-checked against the
// signed-in owner, and tenants are read from that property's own `members` collection, so another
// property's tenants can never appear. `TenantsContent` is keyed by property id: switching property
// remounts it, which clears search/filters and shows no list from the previous property.
//
// Real data: who joined the property (name, status, join date), total beds. Not available yet, so
// never invented: room/bed per tenant (no allocation model), occupied beds, rent/dues, overdue,
// verification, reminders, payment recording, adding a tenant (no invite flow).
export function TenantsScreen() {
  const params = useLocalSearchParams<{ propertyId?: string | string[] }>();
  const propertyId = parsePropertyId(params.propertyId);
  if (propertyId === null) {
    return (
      <Shell>
        <Stack.Screen options={{ title: 'Tenants' }} />
        <StateCard icon="search-off" title="Property not found" message="This link does not point to a property." actionLabel="Back to properties" onAction={goToProperties} />
      </Shell>
    );
  }
  return <TenantsContent key={propertyId} propertyId={propertyId} />;
}

function TenantsContent({ propertyId }: { propertyId: string }) {
  const property = usePropertyDetail(propertyId);
  const tenants = usePropertyTenants(propertyId);
  const rooms = usePropertyRooms(propertyId);
  const owned = useOwnerProperties();

  const [search, setSearch] = useState('');
  const [switching, setSwitching] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  const header = (
    <Stack.Screen options={{ title: 'Tenants', headerTitle: property.data?.name ?? '' }} />
  );

  if (property.isPending) {
    return (
      <Shell>
        {header}
        <View style={styles.center}>
          <ActivityIndicator color={BrandColors.accent} />
          <Text style={styles.muted}>Loading property…</Text>
        </View>
      </Shell>
    );
  }
  if (property.isError) {
    const kind = property.error instanceof PropertyRequestError ? property.error.kind : 'unknown';
    const blocked = kind === 'not-found' || kind === 'permission-denied';
    return (
      <Shell>
        {header}
        <StateCard
          icon={kind === 'permission-denied' ? 'lock-outline' : blocked ? 'search-off' : 'error-outline'}
          title={kind === 'permission-denied' ? 'No access to this property' : kind === 'not-found' ? 'Property not found' : 'Couldn’t load property'}
          message={blocked ? 'This property is not available to your account.' : getPropertyErrorMessage(property.error)}
          actionLabel={blocked ? 'Back to properties' : 'Retry'}
          onAction={blocked ? goToProperties : () => property.refetch()}
        />
      </Shell>
    );
  }

  const all = tenants.data ?? [];
  const visible = searchTenants(all, search);
  const totals = rooms.data ? summarizeRooms(rooms.data) : null;
  const pct = totals ? occupancyPercent(totals.occupiedBeds, totals.totalBeds) : null;

  let list: ReactNode;
  if (tenants.isPending) {
    list = (
      <View style={styles.center}>
        <ActivityIndicator color={BrandColors.accent} />
        <Text style={styles.muted}>Loading tenants…</Text>
      </View>
    );
  } else if (tenants.isError) {
    list = (
      <StateCard icon="error-outline" title="Couldn’t load tenants" message={getPropertyErrorMessage(tenants.error)} actionLabel="Retry" onAction={() => tenants.refetch()} />
    );
  } else if (all.length === 0) {
    list = (
      <StateCard
        icon="group"
        title="No tenants yet"
        message="Add a tenant to a vacant bed, or have one join with an invite code."
        actionLabel="Add tenant"
        onAction={() => router.push({ pathname: '/owner/add-tenant', params: { propertyId } })}
      />
    );
  } else if (visible.length === 0) {
    list = (
      <StateCard icon="search-off" title="No tenants match your search" message="Try a different name." actionLabel="Clear search" onAction={() => setSearch('')} />
    );
  } else {
    list = (
      <View style={styles.list}>
        {visible.map((tenant) => (
          <TenantCard key={tenant.tenantUid} tenant={tenant} propertyId={propertyId} />
        ))}
      </View>
    );
  }

  const others = (owned.data ?? []).filter((p) => p.id !== propertyId);

  return (
    <AppScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={tenants.isRefetching && !tenants.isPending} onRefresh={() => tenants.refetch()} />}>
      {header}

      <View style={styles.switcher}>
        <View style={styles.switcherLeft}>
          <MaterialIcons name="apartment" size={18} color={BrandColors.accent} />
          <Text numberOfLines={1} style={styles.switcherText}>
            {[property.data.name, property.data.location].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Switch property"
          disabled={others.length === 0}
          hitSlop={8}
          onPress={() => setSwitching(true)}
          style={[styles.switchButton, others.length === 0 && styles.dim]}>
          <Text style={styles.switchText}>Switch</Text>
          <MaterialIcons name="expand-more" size={16} color={BrandColors.accent} />
        </Pressable>
      </View>

      <View style={styles.card}>
        <View style={styles.spread}>
          <View style={styles.flex}>
            <Text style={styles.sectionLabel}>Property capacity</Text>
            <Text style={styles.headline}>
              {tenants.isPending
                ? 'Loading tenants…'
                : tenants.isError
                  ? 'Tenant count unavailable'
                  : `${activeTenantCount(all)} Active ${activeTenantCount(all) === 1 ? 'Tenant' : 'Tenants'}`}
            </Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{pct === null ? 'No beds yet' : `${pct}% occupied`}</Text>
          </View>
        </View>
        <View style={styles.track}>{pct !== null ? <View style={[styles.trackFill, { width: `${pct}%` }]} /> : null}</View>
        <View style={styles.metrics}>
          <View style={styles.metric}>
            <Text style={styles.sectionLabel}>Occupied beds</Text>
            <Text style={styles.metricValue}>
              {totals ? totals.occupiedBeds : '—'}
              <Text style={styles.metricSub}> / {totals ? `${totals.totalBeds} total` : rooms.isPending ? '…' : 'beds unavailable'}</Text>
            </Text>
            <Text style={styles.metricNote}>{totals ? `${totals.availableBeds} vacant` : 'Bed totals unavailable'}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.sectionLabel}>Overdue dues</Text>
            <Text style={styles.metricValue}>—</Text>
            <Text style={styles.metricNote}>Rent tracking not configured</Text>
          </View>
        </View>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.search}>
          <MaterialIcons name="search" size={20} color={BrandColors.textSecondary} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search tenant, room, or bed..."
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
          onPress={() => router.push({ pathname: '/owner/add-tenant', params: { propertyId } })}
          accessibilityLabel="Add tenant"
          style={styles.addButton}
        />
      </View>
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip label={`All (${tenants.data ? all.length : '…'})`} selected />
        <Chip label="Rent Due" disabled />
        <Chip label="Overdue" disabled />
        <Chip label="Verification" disabled />
      </ScrollView>
      <Text style={styles.footnote}>Rent Due, Overdue and Verification need rent records and tenant verification, which are not set up yet.</Text>

      {list}

      <OptionSheet
        visible={switching}
        title="Switch property"
        onClose={() => setSwitching(false)}
        options={others.map((p) => ({
          label: [p.name, p.location].filter(Boolean).join(' · '),
          icon: 'apartment' as const,
          // Replace, not push: back still returns to where this screen was opened from.
          onPress: () => router.replace({ pathname: '/owner/properties/[propertyId]/tenants', params: { propertyId: p.id } }),
        }))}
      />
    </AppScrollView>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {children}
    </ScrollView>
  );
}

function Chip({ label, selected, disabled }: { label: string; selected?: boolean; disabled?: boolean }) {
  return (
    <View
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      accessibilityLabel={disabled ? `${label} (not available yet)` : label}
      style={[styles.chip, selected && styles.chipOn, disabled && styles.chipOff]}>
      <Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text>
    </View>
  );
}

// Identity and join date only. There is no room, bed or rent data for a tenant yet, so the footer
// says so instead of showing a made-up balance.
function TenantCard({ tenant, propertyId }: { tenant: PropertyTenant; propertyId: string }) {
  const joined = formatJoined(tenant.joinedAtMs);
  const active = tenant.status === 'active';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${tenant.name}, ${active ? 'active' : 'inactive'}. Open details`}
      onPress={() => router.push({ pathname: '/owner/tenants/[tenantId]', params: { tenantId: tenant.tenantUid, propertyId } })}
      style={({ pressed }) => [styles.tenantCard, pressed && { opacity: 0.85 }]}>
      <View style={styles.tenantTop}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(tenant.name)}</Text>
        </View>
        <View style={styles.flex}>
          <Text numberOfLines={1} style={styles.tenantName}>
            {tenant.name}
          </Text>
          <Text numberOfLines={1} style={styles.muted}>
            {joined ? `Joined ${joined}` : 'Joined this property'}
          </Text>
        </View>
        <View style={[styles.status, active ? styles.statusOn : styles.statusOff]}>
          <Text style={[styles.statusText, active && { color: BrandColors.accent }]}>{active ? 'Active' : 'Inactive'}</Text>
        </View>
      </View>
      <View style={styles.tenantFooter}>
        <Text style={styles.sectionLabel}>Room & bed</Text>
        <Text style={styles.muted}>
          {tenant.roomNumber
            ? `Room ${tenant.roomNumber} · ${tenant.bedLabel ?? ''}${tenant.sharing ? ` · ${sharingLabel(tenant.sharing)}` : ''}${tenant.rentInr ? ` · ${formatInr(tenant.rentInr)}/month` : ''}`
            : 'Not assigned yet'}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BrandColors.canvas },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  flex: { flex: 1, minWidth: 0 },
  spread: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  center: { alignItems: 'center', gap: 8, paddingVertical: 40 },
  muted: { fontSize: 12, color: BrandColors.textSecondary },
  footnote: { fontSize: 11, color: BrandColors.textSecondary },
  dim: { opacity: 0.4 },
  notice: { fontSize: 12, fontWeight: '600', color: BrandColors.textSecondary },
  switcher: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, backgroundColor: '#E8EEEC' },
  switcherLeft: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  switcherText: { flex: 1, fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', color: BrandColors.textPrimary },
  switchButton: { flexDirection: 'row', alignItems: 'center' },
  switchText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', color: BrandColors.accent },
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
  headline: { marginTop: 2, fontSize: 18, fontWeight: '800', color: BrandColors.textPrimary },
  badge: { flexShrink: 1, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: BrandColors.canvas },
  badgeText: { fontSize: 11, fontWeight: '700', color: BrandColors.textSecondary },
  track: { height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: BrandColors.border },
  trackFill: { height: '100%', backgroundColor: BrandColors.accent },
  metrics: { flexDirection: 'row', gap: 10 },
  metric: { flex: 1, gap: 2, padding: 12, borderRadius: 12, backgroundColor: BrandColors.canvas },
  metricValue: { fontSize: 18, fontWeight: '800', color: BrandColors.textPrimary },
  metricSub: { fontSize: 12, fontWeight: '400', color: BrandColors.textSecondary },
  metricNote: { fontSize: 11, color: BrandColors.textSecondary },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  search: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, borderRadius: 12, backgroundColor: BrandColors.surface, borderWidth: 1, borderColor: BrandColors.border },
  searchInput: { flex: 1, paddingVertical: 8, fontSize: 14, color: BrandColors.textPrimary },
  // Sage green (the app's `primary` button variant).
  addButton: { flexShrink: 0 },
  chips: { gap: 8, paddingVertical: 2 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: BrandColors.surface, borderWidth: 1, borderColor: BrandColors.border },
  chipOn: { backgroundColor: BrandColors.accent, borderColor: BrandColors.accent },
  chipOff: { opacity: 0.5 },
  chipText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', color: BrandColors.textSecondary },
  chipTextOn: { color: BrandColors.surface },
  list: { gap: 12 },
  tenantCard: {
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
  tenantTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F0EE' },
  avatarText: { fontSize: 14, fontWeight: '800', color: BrandColors.textPrimary },
  tenantName: { fontSize: 16, fontWeight: '800', color: BrandColors.textPrimary },
  status: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusOn: { backgroundColor: '#E8F0EE' },
  statusOff: { backgroundColor: BrandColors.canvas },
  statusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', color: BrandColors.textSecondary },
  tenantFooter: { gap: 2, padding: 10, borderRadius: 10, backgroundColor: BrandColors.canvas },
});
