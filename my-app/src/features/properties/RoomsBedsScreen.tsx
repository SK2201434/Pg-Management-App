import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppScrollView } from '@/components/app-scroll-view';
import { OptionSheet } from '@/components/option-sheet';
import { BrandColors } from '@/constants/theme';
import { TopBarIconButton } from '@/features/navigation/AppTopBar';
import { AddRoomSheet } from '@/features/properties/AddRoomSheet';
import {
  availableBedCount,
  occupiedBedCount,
  filterRooms,
  occupancyPercent,
  parsePropertyId,
  sortRooms,
  summarizeRooms,
  type RoomListFilter,
  type SharingFilter,
} from '@/features/properties/propertyDetailsModel';
import { StateCard } from '@/features/properties/PropertyDetailsScreen';
import { formatInr, sharingLabel, type RoomDraft } from '@/features/properties/propertySetup';
import { getPropertyErrorMessage, PropertyRequestError } from '@/features/properties/propertyService';
import type { PropertyRoom } from '@/features/properties/propertyTypes';
import { RoomDetailsSheet } from '@/features/properties/RoomDetailsSheet';
import { usePropertyDetail, usePropertyRooms, useAddRoom } from '@/features/properties/usePropertyQueries';

const SHARING_OPTIONS: { value: SharingFilter; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: 1, label: '1 sharing' },
  { value: 2, label: '2 sharing' },
  { value: 3, label: '3 sharing' },
  { value: '4+', label: '4+ sharing' },
];

// Rooms & Beds of one property (route param `propertyId`, validated and re-checked against the
// signed-in owner). Real data: rooms, beds, bed status (`available` / `unavailable`). Not available
// yet, and therefore never invented: the Maintenance filter (the bed model has no maintenance state),
// payments, room editing. Occupied beds are those held by a resident (bed allocations).
export function RoomsBedsScreen() {
  const params = useLocalSearchParams<{ propertyId?: string | string[] }>();
  const propertyId = parsePropertyId(params.propertyId);
  const property = usePropertyDetail(propertyId);
  const rooms = usePropertyRooms(propertyId);
  const addRoom = useAddRoom(propertyId ?? '');

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<RoomListFilter>('all');
  const [sharing, setSharing] = useState<SharingFilter>('any');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 4000);
    return () => clearTimeout(t);
  }, [banner]);

  const all = useMemo(() => sortRooms(rooms.data ?? []), [rooms.data]);
  const visible = useMemo(() => filterRooms(all, { search, filter, sharing }), [all, search, filter, sharing]);
  const totals = useMemo(() => summarizeRooms(all), [all]);
  const availableRooms = useMemo(() => all.filter((r) => availableBedCount(r) > 0).length, [all]);
  const selected = all.find((r) => r.id === selectedId) ?? null;
  const percent = occupancyPercent(totals.occupiedBeds, totals.totalBeds);
  const occupiedRooms = useMemo(() => all.filter((r) => occupiedBedCount(r) > 0).length, [all]);

  const header = (
    <Stack.Screen
      options={{
        title: 'Rooms & Beds',
        headerTitle: property.data?.name ?? '',
        headerRight: () => (
          <TopBarIconButton icon="more-vert" label="Room options" disabled={!rooms.data} onPress={() => setMenuOpen(true)} />
        ),
      }}
    />
  );

  const goToProperties = () => router.replace('/owner/properties');
  if (propertyId === null) {
    return (
      <Shell>
        {header}
        <StateCard icon="search-off" title="Property not found" message="This link does not point to a property." actionLabel="Back to properties" onAction={goToProperties} />
      </Shell>
    );
  }
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

  const submitRoom = async (draft: RoomDraft, includeFloor: boolean) => {
    try {
      await addRoom.mutateAsync({ draft, includeFloor });
      setAdding(false);
      setBanner(`Room ${draft.roomNumber} added with ${draft.sharing} vacant bed${draft.sharing === 1 ? '' : 's'}.`);
    } catch {
      // The error is shown inside the sheet (addRoom.error); the same draft can be retried.
    }
  };
  const openAdd = () => {
    addRoom.reset();
    setAdding(true);
  };

  let list: ReactNode;
  if (rooms.isPending) {
    list = (
      <View style={styles.center}>
        <ActivityIndicator color={BrandColors.accent} />
        <Text style={styles.muted}>Loading rooms…</Text>
      </View>
    );
  } else if (rooms.isError) {
    list = (
      <StateCard icon="error-outline" title="Couldn’t load rooms" message={getPropertyErrorMessage(rooms.error)} actionLabel="Retry" onAction={() => rooms.refetch()} />
    );
  } else if (all.length === 0) {
    list = (
      <StateCard icon="meeting-room" title="No rooms configured" message="Add the first room of this property." actionLabel="Add Room" onAction={openAdd} />
    );
  } else if (visible.length === 0) {
    const narrowed = filter !== 'all' || sharing !== 'any';
    list = (
      <StateCard
        icon="search-off"
        title={search.trim() ? 'No rooms match your search' : 'No rooms match these filters'}
        message={narrowed || search.trim() ? 'Try a different search or clear the filters.' : ''}
        actionLabel="Clear search and filters"
        onAction={() => {
          setSearch('');
          setFilter('all');
          setSharing('any');
        }}
      />
    );
  } else {
    list = (
      <View style={styles.list}>
        {visible.map((room) => (
          <RoomCard key={room.id} room={room} onPress={() => setSelectedId(room.id)} />
        ))}
      </View>
    );
  }

  return (
    <AppScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={rooms.isRefetching && !rooms.isPending} onRefresh={() => void rooms.refetch()} />}>
      {header}
      {banner ? (
        <View style={styles.banner} accessibilityLiveRegion="polite">
          <MaterialIcons name="check-circle" size={18} color={BrandColors.accent} />
          <Text style={styles.bannerText}>{banner}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <View style={styles.spread}>
          <View style={styles.inline}>
            <View style={styles.dot} />
            <Text style={styles.sectionLabel}>Occupancy status</Text>
          </View>
          <View style={styles.inline}>
            <Text style={percent === null ? styles.percentNone : styles.percent}>{percent === null ? '—' : `${percent}%`}</Text>
            <Text style={styles.capacity}>CAPACITY</Text>
          </View>
        </View>
        <View style={styles.track}>{percent !== null ? <View style={[styles.fill, { width: `${percent}%` }]} /> : null}</View>
        {rooms.isError ? (
          <Text style={styles.muted}>Room totals are unavailable right now.</Text>
        ) : (
          <View style={styles.metrics}>
            <Metric label="Rooms" value={rooms.isPending ? '…' : String(totals.totalRooms)} />
            <Metric label="Beds" value={rooms.isPending ? '…' : String(totals.totalBeds)} />
            <Metric label="Occupied" value={rooms.isPending ? '…' : String(totals.occupiedBeds)} />
            <Metric label="Available" value={rooms.isPending ? '…' : String(totals.availableBeds)} accent />
          </View>
        )}
      </View>

      <View style={styles.searchRow}>
        <View style={styles.search}>
          <MaterialIcons name="search" size={18} color={BrandColors.textSecondary} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search room or bed..."
            placeholderTextColor={BrandColors.textSecondary}
            accessibilityLabel="Search rooms and beds"
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
        <AppButton icon="add" label="Add Room" size="sm" onPress={openAdd} style={styles.addButton} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills}>
        <Pill label="All Rooms" count={rooms.data ? all.length : undefined} selected={filter === 'all'} onPress={() => setFilter('all')} />
        <Pill label="Available Beds" count={rooms.data ? availableRooms : undefined} selected={filter === 'available'} onPress={() => setFilter('available')} jade />
        <Pill label="Occupied" count={rooms.data ? occupiedRooms : undefined} selected={filter === 'occupied'} onPress={() => setFilter('occupied')} />
        <Pill label="Maintenance" disabled />
      </ScrollView>
      <Text style={styles.footnote}>Maintenance needs a bed maintenance status, which is not set up yet.</Text>

      <View style={styles.spread}>
        <Text style={styles.sectionLabel}>Sharing type</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills}>
        {SHARING_OPTIONS.map((o) => (
          <Pressable
            key={String(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: sharing === o.value }}
            onPress={() => setSharing(o.value)}
            style={[styles.sharing, sharing === o.value && styles.sharingOn]}>
            <Text style={[styles.sharingText, sharing === o.value && styles.sharingTextOn]}>{o.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {list}

      <RoomDetailsSheet room={selected} propertyId={propertyId} onClose={() => setSelectedId(null)} />
      {adding ? (
        <AddRoomSheet
          rooms={all}
          busy={addRoom.isPending}
          submitError={addRoom.isError ? getAddRoomMessage(addRoom.error) : null}
          onSubmit={submitRoom}
          onClose={() => setAdding(false)}
        />
      ) : null}
      <OptionSheet
        visible={menuOpen}
        title="Room options"
        onClose={() => setMenuOpen(false)}
        options={[
          { label: 'Add room', icon: 'add', onPress: openAdd },
          { label: 'Refresh', icon: 'refresh', onPress: () => rooms.refetch() },
        ]}
      />
    </AppScrollView>
  );
}

function getAddRoomMessage(error: unknown): string {
  if (error instanceof Error && error.name === 'DuplicateRoomError') return error.message;
  return `Could not add the room. ${getPropertyErrorMessage(error)}`;
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {children}
    </ScrollView>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricLabel, accent && styles.accentText]}>{label}</Text>
      <Text style={[styles.metricValue, accent && styles.accentText]}>{value}</Text>
    </View>
  );
}

function Pill({ label, count, selected, onPress, disabled, jade }: { label: string; count?: number; selected?: boolean; onPress?: () => void; disabled?: boolean; jade?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      accessibilityLabel={disabled ? `${label} (not available yet)` : label}
      disabled={disabled}
      onPress={onPress}
      style={[styles.pill, selected && styles.pillOn, disabled && styles.pillOff]}>
      <Text style={[styles.pillText, selected && styles.pillTextOn]}>{label}</Text>
      {count !== undefined ? (
        <Text style={[styles.pillCount, selected ? styles.pillTextOn : jade && styles.accentText]}>({count})</Text>
      ) : null}
    </Pressable>
  );
}

function RoomCard({ room, onPress }: { room: PropertyRoom; onPress: () => void }) {
  const available = availableBedCount(room);
  const total = room.beds.length;
  const noBeds = total === 0;
  const occupied = occupiedBedCount(room);
  const pct = occupancyPercent(occupied, total);
  const badge = noBeds ? 'No beds' : occupied === total ? 'Full' : available === 0 ? 'None available' : `${available} ${available === 1 ? 'Bed' : 'Beds'} Available`;
  const good = available > 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Room ${room.roomNumber}, ${badge}`}
      onPress={onPress}
      style={({ pressed }) => [styles.roomCard, pressed && styles.pressed]}>
      <View style={styles.roomTop}>
        <View style={styles.roomBadge}>
          <Text style={styles.roomBadgeLabel}>ROOM</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit style={styles.roomBadgeNumber}>
            {room.roomNumber}
          </Text>
        </View>
        <View style={styles.flex}>
          <View style={styles.inline}>
            <Text numberOfLines={1} style={styles.roomTitle}>
              {room.sharing > 0 ? sharingLabel(room.sharing) : 'Room'}
            </Text>
            <View style={[styles.acTag, room.ac && styles.acTagOn]}>
              <Text style={[styles.acText, room.ac && styles.acTextOn]}>{room.ac ? 'AC' : 'Non-AC'}</Text>
            </View>
          </View>
          <Text style={styles.rent}>
            {room.rentPerBedInr !== null ? formatInr(room.rentPerBedInr) : 'Rent not set'}
            {room.rentPerBedInr !== null ? <Text style={styles.perBed}> / bed</Text> : null}
          </Text>
        </View>
        <MaterialIcons name="chevron-right" size={20} color={BrandColors.textSecondary} />
      </View>
      <View style={styles.roomBottom}>
        <View style={[styles.status, good ? styles.statusGood : styles.statusNeutral]}>
          {good ? <View style={styles.statusDot} /> : null}
          <Text style={[styles.statusText, good && styles.accentText]}>{badge}</Text>
        </View>
        <Text style={styles.muted}>
          {noBeds ? 'Bed details unavailable' : `${occupied} of ${total} bed${total === 1 ? '' : 's'} occupied${pct !== null ? ` · ${pct}%` : ''}`}
        </Text>
      </View>
      {pct !== null ? (
        <View style={styles.roomTrack}>
          <View style={[styles.roomFill, { width: `${pct}%` }]} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BrandColors.canvas },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  flex: { flex: 1, minWidth: 0 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  spread: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  center: { alignItems: 'center', gap: 8, paddingVertical: 40 },
  muted: { fontSize: 12, color: BrandColors.textSecondary },
  footnote: { fontSize: 11, color: BrandColors.textSecondary },
  accentText: { color: BrandColors.accent },
  pressed: { opacity: 0.85 },
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
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: BrandColors.accent },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: BrandColors.textSecondary },
  percent: { fontSize: 22, fontWeight: '800', color: BrandColors.textPrimary },
  percentNone: { fontSize: 22, fontWeight: '800', color: BrandColors.textSecondary },
  capacity: { fontSize: 10, fontWeight: '600', letterSpacing: 0.8, color: BrandColors.textSecondary },
  track: { height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: BrandColors.border },
  fill: { height: '100%', borderRadius: 3, backgroundColor: BrandColors.accent },
  metrics: { flexDirection: 'row', gap: 4 },
  metric: { flex: 1, gap: 2 },
  metricLabel: { fontSize: 11, color: BrandColors.textSecondary },
  metricValue: { fontSize: 18, fontWeight: '700', color: BrandColors.textPrimary },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  search: {
    flex: 1,
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
  addButton: { flexShrink: 0 },
  pills: { gap: 8, paddingVertical: 2 },
  pill: { height: 34, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, borderRadius: 999, backgroundColor: BrandColors.surface, borderWidth: 1, borderColor: BrandColors.border },
  pillOn: { backgroundColor: BrandColors.accent, borderColor: BrandColors.accent },
  pillOff: { opacity: 0.5 },
  pillText: { fontSize: 12, fontWeight: '700', color: BrandColors.textSecondary },
  pillTextOn: { color: BrandColors.surface },
  pillCount: { fontSize: 11, fontWeight: '700', color: BrandColors.textSecondary },
  sharing: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  sharingOn: { backgroundColor: '#E8EEEC' },
  sharingText: { fontSize: 12, fontWeight: '600', color: BrandColors.textSecondary },
  sharingTextOn: { fontWeight: '800', color: BrandColors.textPrimary },
  list: { gap: 12 },
  roomCard: {
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
  roomTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  roomBadge: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, backgroundColor: BrandColors.accent },
  roomBadgeLabel: { fontSize: 8, fontWeight: '700', letterSpacing: 0.8, color: 'rgba(255,255,255,0.7)' },
  roomBadgeNumber: { fontSize: 16, fontWeight: '800', color: BrandColors.surface },
  roomTitle: { flexShrink: 1, fontSize: 16, fontWeight: '700', color: BrandColors.textPrimary },
  acTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: BrandColors.canvas },
  acTagOn: { backgroundColor: '#E8F0EE' },
  acText: { fontSize: 10, fontWeight: '700', color: BrandColors.textSecondary },
  acTextOn: { color: BrandColors.accent },
  rent: { marginTop: 2, fontSize: 13, fontWeight: '600', color: BrandColors.accent },
  perBed: { fontWeight: '400', color: BrandColors.textSecondary },
  roomTrack: { height: 4, borderRadius: 2, overflow: 'hidden', backgroundColor: BrandColors.border },
  roomFill: { height: '100%', borderRadius: 2, backgroundColor: BrandColors.accent },
  roomBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusGood: { backgroundColor: '#E8F0EE' },
  statusNeutral: { backgroundColor: BrandColors.canvas },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: BrandColors.accent },
  statusText: { fontSize: 11, fontWeight: '700', color: BrandColors.textSecondary },
});
