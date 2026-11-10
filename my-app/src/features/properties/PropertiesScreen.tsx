import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppScrollView } from '@/components/app-scroll-view';
import { useConfirm } from '@/components/confirm-dialog';
import { BrandColors } from '@/constants/theme';
import { getCurrentAddressMessage } from '@/features/properties/currentAddress';
import { PortfolioSummary } from '@/features/properties/PortfolioSummary';
import { PropertyCard } from '@/features/properties/PropertyCard';
import { filterByStatus, filterProperties, statusCounts, type StatusFilter } from '@/features/properties/propertyFilter';
import { getPropertyErrorMessage } from '@/features/properties/propertyService';
import { useCapturePropertyGeo, useBedOccupancySync, useOwnerProperties } from '@/features/properties/usePropertyQueries';

const openAddProperty = () => router.push('/owner/add-property');

// Owner Properties tab. The top bar comes from the tab layout. The All / Active / Inactive tabs
// filter on the property's `status` (absent = active) and count properties, not rooms.
// Bed totals are deferred to the Room and Bed module (`occupancy` stays null).
export function PropertiesScreen() {
  const { data, error, isPending, isError, refetch, isRefetching } = useOwnerProperties();
  useBedOccupancySync();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const { confirm, dialog } = useConfirm();
  const captureGeo = useCapturePropertyGeo();
  const [capturingId, setCapturingId] = useState<string | null>(null);
  const [geoError, setGeoError] = useState<{ id: string; message: string } | null>(null);

  // Coordinates are taken from the phone, so the owner must be at the property first.
  const addLocation = async (propertyId: string) => {
    const ok = await confirm({
      title: 'Capture property location',
      message:
        'Make sure you are at your property right now. HOSTELL will save your phone’s current location as this property’s location.',
      confirmLabel: 'I’m at the property',
    });
    if (!ok) return;
    setGeoError(null);
    setCapturingId(propertyId);
    captureGeo.mutate(propertyId, {
      onError: (error) => setGeoError({ id: propertyId, message: getCurrentAddressMessage(error) }),
      onSettled: () => setCapturingId(null),
    });
  };
  const counts = useMemo(() => statusCounts(data ?? []), [data]);
  const results = useMemo(
    () => filterProperties(filterByStatus(data ?? [], statusFilter), search),
    [data, search, statusFilter],
  );

  let body: ReactNode;
  if (isPending) {
    body = (
      <View style={styles.center}>
        <ActivityIndicator color={BrandColors.accent} />
        <Text style={styles.muted}>Loading your properties…</Text>
      </View>
    );
  } else if (isError) {
    body = (
      <StateCard
        icon="error-outline"
        title="Couldn’t load properties"
        message={getPropertyErrorMessage(error)}
        actionLabel="Retry"
        onAction={() => refetch()}
      />
    );
  } else if (data.length === 0) {
    body = (
      <StateCard
        icon="apartment"
        title="No properties yet"
        message="Add your first property to start managing your spaces."
        actionLabel="Add Property"
        onAction={openAddProperty}
      />
    );
  } else if (results.length === 0) {
    body = (
      <StateCard
        icon="search-off"
        title="No properties found"
        message={
          statusFilter !== 'all' && !search.trim()
            ? `You have no ${statusFilter} properties.`
            : 'Try a different name or location.'
        }
        actionLabel={statusFilter !== 'all' ? 'Show all properties' : 'Clear search'}
        onAction={() => {
          setSearch('');
          setStatusFilter('all');
        }}
      />
    );
  } else {
    body = (
      <View style={styles.list}>
        {results.map((property) => (
          <PropertyCard
            key={property.id}
            property={property}
            onPress={() =>
              router.push({ pathname: '/owner/properties/[propertyId]', params: { propertyId: property.id } })
            }
            onAddLocation={() => addLocation(property.id)}
            addingLocation={capturingId === property.id}
            locationError={geoError?.id === property.id ? geoError.message : undefined}
          />
        ))}
      </View>
    );
  }

  const count = data?.length;
  const hasProperties = !!data && data.length > 0;

  return (
    <AppScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      refreshControl={
        <RefreshControl refreshing={isRefetching && !isPending} onRefresh={() => void refetch()} />
      }>
      <View style={styles.intro}>
        <View style={styles.introText}>
          <View style={styles.titleRow}>
            <Text style={styles.title} accessibilityRole="header">
              Properties
            </Text>
            {count !== undefined ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{count === 1 ? '1 property' : `${count} properties`}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.subtitle}>Manage your spaces and occupancy.</Text>
        </View>
        <AppButton
          icon="add"
          size="sm"
          label="Add Property"
          onPress={openAddProperty}
          style={styles.addButton}
        />
      </View>

      <PortfolioSummary occupancy={null} />

      {hasProperties ? (
        <View style={styles.search}>
          <MaterialIcons name="search" size={20} color={BrandColors.textSecondary} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search properties or locations..."
            placeholderTextColor={BrandColors.textSecondary}
            accessibilityLabel="Search properties"
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.searchInput}
          />
          {search.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={10}
              onPress={() => setSearch('')}>
              <MaterialIcons name="close" size={18} color={BrandColors.textSecondary} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {hasProperties ? (
        <View style={styles.tabs}>
          {(['all', 'active', 'inactive'] as const).map((key) => (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityState={{ selected: statusFilter === key }}
              onPress={() => setStatusFilter(key)}
              style={[styles.tab, statusFilter === key && styles.tabOn]}>
              <Text style={[styles.tabText, statusFilter === key && styles.tabTextOn]}>
                {key === 'all' ? 'All' : key === 'active' ? 'Active' : 'Inactive'} ({counts[key]})
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {body}
      {dialog}
    </AppScrollView>
  );
}

type StateCardProps = {
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  title: string;
  message: string;
  actionLabel: string;
  onAction: () => void;
};

function StateCard({ icon, title, message, actionLabel, onAction }: StateCardProps) {
  return (
    <View style={styles.stateCard}>
      <View style={styles.stateIcon}>
        <MaterialIcons name={icon} size={24} color={BrandColors.textSecondary} />
      </View>
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateMessage}>{message}</Text>
      <AppButton label={actionLabel} onPress={onAction} style={styles.stateAction} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BrandColors.canvas },
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  intro: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  introText: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  title: { fontSize: 26, fontWeight: '800', color: BrandColors.textPrimary },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: '#E8EEEC' },
  badgeText: { fontSize: 11, fontWeight: '700', color: BrandColors.textPrimary },
  subtitle: { marginTop: 2, fontSize: 13, color: BrandColors.textSecondary },
  addButton: { flexShrink: 0 },
  search: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: BrandColors.surface,
    borderWidth: 1,
    borderColor: BrandColors.border,
  },
  searchInput: { flex: 1, paddingVertical: 8, fontSize: 14, color: BrandColors.textPrimary },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tab: {
    height: 34,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: BrandColors.surface,
    borderWidth: 1,
    borderColor: BrandColors.border,
  },
  tabOn: { backgroundColor: BrandColors.accent, borderColor: BrandColors.accent },
  tabText: { fontSize: 12, fontWeight: '700', color: BrandColors.textSecondary },
  tabTextOn: { color: BrandColors.surface },
  list: { gap: 12 },
  center: { alignItems: 'center', gap: 8, paddingVertical: 40 },
  muted: { fontSize: 13, color: BrandColors.textSecondary },
  stateCard: {
    alignItems: 'center',
    padding: 28,
    borderRadius: 16,
    backgroundColor: BrandColors.surface,
    borderWidth: 1,
    borderColor: BrandColors.border,
  },
  stateIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    backgroundColor: BrandColors.canvas,
  },
  stateTitle: { fontSize: 17, fontWeight: '700', color: BrandColors.textPrimary },
  stateMessage: { marginTop: 4, textAlign: 'center', fontSize: 13, color: BrandColors.textSecondary },
  stateAction: { marginTop: 14, alignSelf: 'stretch' },
});
