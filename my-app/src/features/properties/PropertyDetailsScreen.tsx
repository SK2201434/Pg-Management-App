import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Clipboard from 'expo-clipboard';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, type ComponentProps, type ReactElement, type ReactNode } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, type RefreshControlProps, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { BrandColors } from '@/constants/theme';
import { selectOwner } from '@/features/auth/ownerAuthSelectors';
import { ensurePropertyJoin } from '@/features/properties/propertyJoin';
import { useAppSelector } from '@/store/hooks';
import { TopBarIconButton } from '@/features/navigation/AppTopBar';
import { propertyBadge } from '@/features/properties/propertyFilter';
import { occupancyPercent, parsePropertyId, sortRooms, summarizeRooms } from '@/features/properties/propertyDetailsModel';
import { PhotoCarousel } from '@/features/discovery/PhotoCarousel';
import { PropertyActionsSheet, type PropertyAction } from '@/features/properties/PropertyActionsSheet';
import { getPropertyErrorMessage, PropertyRequestError } from '@/features/properties/propertyService';
import type { PropertyDetail, PropertyRoom } from '@/features/properties/propertyTypes';
import { formatInr, sharingLabel } from '@/features/properties/propertySetup';
import { PropertyStayRequestsSection } from '@/features/stayRequests/PropertyStayRequestsSection';
import { ReviewsSection } from '@/features/reviews/ReviewsSection';
import { useConfirm } from '@/components/confirm-dialog';
import { buildLedger, currentPeriod, formatPeriod, ledgerSummary } from '@/features/rent/rentModel';
import { usePayments, useRentCharges } from '@/features/rent/useRentQueries';
import { usePropertyDetail, usePropertyRooms, useSetPropertyStatus } from '@/features/properties/usePropertyQueries';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

const PREVIEW_ROOMS = 4;
const goToProperties = () => router.replace('/owner/properties');
const openRentLedger = (propertyId: string) =>
  router.push({ pathname: '/owner/properties/[propertyId]/rent-ledger', params: { propertyId } });
const openTenants = (propertyId: string) =>
  router.push({ pathname: '/owner/properties/[propertyId]/tenants', params: { propertyId } });
const openRules = (propertyId: string) =>
  router.push({ pathname: '/owner/properties/[propertyId]/rules', params: { propertyId } });
const openRoomsBeds = (propertyId: string) =>
  router.push({ pathname: '/owner/properties/[propertyId]/rooms-beds', params: { propertyId } });

// Property Details: reached from a property card with the property's document ID as the route
// param. Everything is read from Firestore for that ID. What the app has no data model for yet
// (occupancy, tenants, rent, property status, editing, deletion) is shown as unavailable, never
// estimated or simulated.
export function PropertyDetailsScreen() {
  const params = useLocalSearchParams<{ propertyId?: string | string[] }>();
  const propertyId = parsePropertyId(params.propertyId);
  const property = usePropertyDetail(propertyId);
  const rooms = usePropertyRooms(propertyId);
  const [menuOpen, setMenuOpen] = useState(false);
  const setStatus = useSetPropertyStatus();
  const { confirm, dialog } = useConfirm();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const toggleStatus = async (current: PropertyDetail) => {
    const next = current.status === 'active' ? 'inactive' : 'active';
    const ok = await confirm({
      title: next === 'inactive' ? 'Deactivate property?' : 'Activate property?',
      message:
        next === 'inactive'
          ? 'It will be marked inactive. Rooms, beds and records are kept, and you can activate it again anytime.'
          : 'It will be marked active again.',
      confirmLabel: next === 'inactive' ? 'Deactivate' : 'Activate',
      destructive: next === 'inactive',
    });
    if (!ok || setStatus.isPending) return;
    setStatus.mutate(
      { propertyId: current.id, status: next },
      {
        onSuccess: () => setStatusMessage(next === 'inactive' ? 'Property deactivated.' : 'Property activated.'),
        onError: (error) => setStatusMessage(`Could not update the property. ${getPropertyErrorMessage(error)}`),
      },
    );
  };

  const header = (
    <Stack.Screen
      options={{
        title: 'Property Details',
        headerRight: () => (
          <TopBarIconButton
            icon="more-vert"
            label="Property actions"
            disabled={!property.data}
            onPress={() => setMenuOpen(true)}
          />
        ),
      }}
    />
  );

  if (propertyId === null) {
    return (
      <Screen>
        {header}
        <StateCard icon="search-off" title="Property not found" message="This link does not point to a property." actionLabel="Back to properties" onAction={goToProperties} />
      </Screen>
    );
  }
  if (property.isPending) {
    return (
      <Screen>
        {header}
        <View style={styles.center}>
          <ActivityIndicator color={BrandColors.accent} />
          <Text style={styles.muted}>Loading property…</Text>
        </View>
      </Screen>
    );
  }
  if (property.isError) {
    const kind = property.error instanceof PropertyRequestError ? property.error.kind : 'unknown';
    if (kind === 'not-found' || kind === 'permission-denied') {
      return (
        <Screen>
          {header}
          <StateCard
            icon={kind === 'not-found' ? 'search-off' : 'lock-outline'}
            title={kind === 'not-found' ? 'Property not found' : 'No access to this property'}
            message={
              kind === 'not-found'
                ? 'It may have been removed.'
                : 'This property does not belong to your account.'
            }
            actionLabel="Back to properties"
            onAction={goToProperties}
          />
        </Screen>
      );
    }
    return (
      <Screen>
        {header}
        <StateCard icon="error-outline" title="Couldn’t load property" message={getPropertyErrorMessage(property.error)} actionLabel="Retry" onAction={() => property.refetch()} />
      </Screen>
    );
  }

  const data = property.data;
  const refresh = () => {
    property.refetch();
    rooms.refetch();
  };
  const actions: PropertyAction[] = [
    {
      label: 'Edit Property Information',
      icon: 'edit',
      onPress: () => {
        setMenuOpen(false);
        router.push({ pathname: '/owner/properties/[propertyId]/edit', params: { propertyId: data.id } });
      },
    },
    {
      label: data.status === 'active' ? 'Deactivate Property' : 'Activate Property',
      icon: 'power-settings-new',
      onPress: () => void toggleStatus(data),
    },
    {
      label: 'Delete Property',
      icon: 'delete-outline',
      destructive: true,
      unavailableReason: 'Not available: rooms, stays and rent history must be kept, and that needs a server-side check.',
    },
  ];

  return (
    <Screen
      refreshControl={<RefreshControl refreshing={(property.isRefetching || rooms.isRefetching) && !property.isPending} onRefresh={refresh} />}>
      {header}
      {statusMessage ? (
        <Pressable accessibilityRole="button" onPress={() => setStatusMessage(null)} style={styles.statusMessage}>
          <Text style={styles.muted}>{statusMessage}</Text>
        </Pressable>
      ) : null}
      {data.photoUrls.length > 0 ? <PhotoCarousel urls={data.photoUrls} /> : null}
      <SummaryCard property={data} roomsData={rooms.data} />
      <OccupancyCard roomsState={rooms} />
      <PropertyStayRequestsSection propertyId={data.id} />
      <ManagementSuite onRoomsBeds={() => openRoomsBeds(data.id)} onTenants={() => openTenants(data.id)} onRentLedger={() => openRentLedger(data.id)} onRules={() => openRules(data.id)} onSettings={() => setMenuOpen(true)} />
      <RentOverview propertyId={data.id} onOpen={() => openRentLedger(data.id)} />
      <RoomsPreview roomsState={rooms} onViewAll={() => openRoomsBeds(data.id)} />
      <ReviewsSection propertyId={data.id} reviewerName={null} readOnly />
      {dialog}
      <PropertyActionsSheet
        visible={menuOpen}
        title={data.name}
        subtitle={data.location ?? 'Property actions'}
        actions={actions}
        onClose={() => setMenuOpen(false)}
      />
    </Screen>
  );
}

function Screen({ children, refreshControl }: { children: ReactNode; refreshControl?: ReactElement<RefreshControlProps> }) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} refreshControl={refreshControl}>
      {children}
    </ScrollView>
  );
}

function Card({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

function SummaryCard({ property, roomsData }: { property: PropertyDetail; roomsData: PropertyRoom[] | undefined }) {
  const badgeInfo = propertyBadge(property);
  const ready = badgeInfo.good;
  const floorCount = roomsData ? summarizeRooms(roomsData).floorCount : 0;
  const address = [property.location, property.city, property.state, property.postalCode].filter(Boolean).join(', ');
  const subtitle = [property.description, floorCount > 0 ? `${floorCount} floor${floorCount === 1 ? '' : 's'}` : null]
    .filter(Boolean)
    .join(' · ');
  return (
    <Card>
      <View style={styles.spread}>
        <View style={[styles.badge, ready ? styles.badgeReady : styles.badgeDraft]}>
          <View style={[styles.dot, { backgroundColor: ready ? BrandColors.accent : BrandColors.error }]} />
          <Text style={[styles.badgeText, { color: ready ? BrandColors.accent : BrandColors.error }]}>
            {badgeInfo.label}
          </Text>
        </View>
        <AppButton variant="secondary" size="sm" icon="edit" label="Edit" disabled onPress={() => undefined} accessibilityLabel="Edit property (not available yet)" />
      </View>
      <View style={styles.summaryRow}>
        <View style={styles.thumb}>
          {property.coverUrl ? (
            <Image source={{ uri: property.coverUrl }} style={styles.thumbImage} accessibilityLabel={`${property.name} photo`} />
          ) : (
            <MaterialIcons name="apartment" size={32} color={BrandColors.accent} />
          )}
        </View>
        <View style={styles.summaryText}>
          <Text style={styles.propertyName}>{property.name}</Text>
          {subtitle ? <Text style={styles.muted}>{subtitle}</Text> : null}
          {address ? (
            <View style={styles.addressRow}>
              <MaterialIcons name="location-on" size={15} color={BrandColors.textSecondary} />
              <Text style={[styles.muted, styles.flex]}>{address}</Text>
            </View>
          ) : null}
        </View>
      </View>
      <PropertyIdRow propertyId={property.id} />
      <Text style={styles.footnote}>Editing is not available yet.</Text>
    </Card>
  );
}

// The permanent Property ID: tenants enter it when creating their account to send a stay request. It is
// the property's own id; the lookup record that lets a tenant use it is added here for older properties.
function PropertyIdRow({ propertyId }: { propertyId: string }) {
  const ownerUid = useAppSelector(selectOwner)?.uid;
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (ownerUid) ensurePropertyJoin(propertyId, ownerUid).catch(() => undefined);
  }, [propertyId, ownerUid]);
  const copy = async () => {
    try {
      setCopied(await Clipboard.setStringAsync(propertyId));
    } catch {
      setCopied(false);
    }
  };
  return (
    <View style={styles.idRow}>
      <View style={styles.flex}>
        <Text style={styles.idLabel}>Property ID</Text>
        <Text selectable style={styles.idValue}>{propertyId}</Text>
        <Text style={styles.footnote}>Share it with tenants: they enter it when creating their account.</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Copy Property ID" onPress={copy} hitSlop={8}>
        <MaterialIcons name={copied ? 'check' : 'content-copy'} size={20} color={BrandColors.accent} />
      </Pressable>
    </View>
  );
}

type RoomsState = ReturnType<typeof usePropertyRooms>;

function SectionError({ roomsState, what }: { roomsState: RoomsState; what: string }) {
  return (
    <View style={styles.inlineState}>
      <Text style={styles.muted}>{getPropertyErrorMessage(roomsState.error)}</Text>
      <AppButton variant="secondary" size="sm" label={`Retry ${what}`} onPress={() => roomsState.refetch()} />
    </View>
  );
}

function OccupancyCard({ roomsState }: { roomsState: RoomsState }) {
  let body: ReactNode;
  if (roomsState.isPending) {
    body = <ActivityIndicator color={BrandColors.accent} />;
  } else if (roomsState.isError) {
    body = <SectionError roomsState={roomsState} what="rooms" />;
  } else {
    const totals = summarizeRooms(roomsState.data);
    const pct = occupancyPercent(totals.occupiedBeds, totals.totalBeds);
    body = (
      <>
        <View style={styles.spread}>
          <Text style={styles.percent}>{pct === null ? '—' : `${pct}%`}</Text>
          <Text style={styles.muted}>{pct === null ? 'No beds set up yet' : 'Occupancy'}</Text>
        </View>
        <View style={styles.track}>{pct !== null ? <View style={[styles.trackFill, { width: `${pct}%` }]} /> : null}</View>
        <View style={styles.metricGrid}>
          <Metric label="Total rooms" value={String(totals.totalRooms)} />
          <Metric label="Total beds" value={String(totals.totalBeds)} />
          <Metric label="Occupied beds" value={String(totals.occupiedBeds)} />
          <Metric label="Available beds" value={String(totals.availableBeds)} />
        </View>
        {totals.totalRooms === 0 ? <Text style={styles.footnote}>No rooms set up yet.</Text> : null}
      </>
    );
  }
  return (
    <Card>
      <SectionLabel>Occupancy status</SectionLabel>
      {body}
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function ManagementSuite({ onRoomsBeds, onTenants, onRentLedger, onRules, onSettings }: { onRoomsBeds: () => void; onTenants: () => void; onRentLedger: () => void; onRules: () => void; onSettings: () => void }) {
  return (
    <View style={styles.suite}>
      <SectionLabel>Management suite</SectionLabel>
      <View style={styles.suiteGrid}>
        <SuiteCard icon="meeting-room" title="Rooms & Beds" onPress={onRoomsBeds} />
        <SuiteCard icon="group" title="Tenants" onPress={onTenants} />
        <SuiteCard icon="receipt-long" title="Rent Ledger" onPress={onRentLedger} />
        <SuiteCard icon="gavel" title="Rules & Regulations" onPress={onRules} />
        <SuiteCard icon="settings" title="Settings" onPress={onSettings} />
        {/* Fills the last half of the row so an odd card keeps the same size as the others. */}
        <View style={styles.suiteSpacer} />
      </View>
    </View>
  );
}

// A shortcut without a destination is disabled and says so, instead of navigating somewhere unrelated.
function SuiteCard({ icon, title, onPress }: { icon: IconName; title: string; onPress?: () => void }) {
  const disabled = !onPress;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={disabled ? `${title} (not available yet)` : title}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.suiteCard, disabled && styles.disabled, pressed && styles.pressed]}>
      <View style={styles.suiteIcon}>
        <MaterialIcons name={icon} size={22} color={BrandColors.accent} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.suiteTitle}>{title}</Text>
        {disabled ? <Text style={styles.soon}>Not available yet</Text> : null}
      </View>
      {disabled ? null : <MaterialIcons name="chevron-right" size={20} color={BrandColors.textSecondary} />}
    </Pressable>
  );
}

function RentOverview({ propertyId, onOpen }: { propertyId: string; onOpen: () => void }) {
  const charges = useRentCharges(propertyId);
  const payments = usePayments(propertyId);
  const [now] = useState(Date.now);
  const period = currentPeriod(now);
  let body: ReactNode;
  if (charges.isPending || payments.isPending) {
    body = <ActivityIndicator color={BrandColors.accent} />;
  } else if (charges.isError || payments.isError) {
    body = (
      <View style={styles.inlineState}>
        <Text style={styles.muted}>{getPropertyErrorMessage(charges.error ?? payments.error)}</Text>
        <AppButton variant="secondary" size="sm" label="Retry" onPress={() => { charges.refetch(); payments.refetch(); }} />
      </View>
    );
  } else {
    const rows = buildLedger(charges.data, payments.data, new Map(), now).filter((r) => r.charge.period === period);
    const sum = ledgerSummary(rows);
    body =
      charges.data.length === 0 ? (
        <Text style={styles.muted}>No rent charges have been added for this property yet.</Text>
      ) : rows.length === 0 ? (
        <Text style={styles.muted}>No rent charges for {formatPeriod(period)} yet.</Text>
      ) : (
        <View style={styles.metricGrid}>
          <Metric label="Outstanding" value={formatInr(sum.outstandingInr)} />
          <Metric label="Collected" value={formatInr(sum.collectedInr)} />
          <Metric label="Overdue" value={`${sum.overdueCount} (${formatInr(sum.overdueInr)})`} />
        </View>
      );
  }
  return (
    <Card>
      <View style={styles.spread}>
        <SectionLabel>Rent overview</SectionLabel>
        <Text style={styles.muted}>{formatPeriod(period)}</Text>
      </View>
      {body}
      <AppButton variant="secondary" size="sm" label="View Financial Details" onPress={onOpen} style={styles.selfStart} />
    </Card>
  );
}

function RoomsPreview({ roomsState, onViewAll }: { roomsState: RoomsState; onViewAll: () => void }) {
  let body: ReactNode;
  let count: number | null = null;
  if (roomsState.isPending) {
    body = <ActivityIndicator color={BrandColors.accent} />;
  } else if (roomsState.isError) {
    body = <SectionError roomsState={roomsState} what="rooms" />;
  } else if (roomsState.data.length === 0) {
    body = <Text style={styles.muted}>No rooms have been set up for this property yet.</Text>;
  } else {
    count = roomsState.data.length;
    const sorted = sortRooms(roomsState.data);
    body = (
      <>
        {sorted.slice(0, PREVIEW_ROOMS).map((room) => (
          <RoomRow key={room.id} room={room} />
        ))}
        {sorted.length > PREVIEW_ROOMS ? (
          <Text style={styles.footnote}>
            +{sorted.length - PREVIEW_ROOMS} more room{sorted.length - PREVIEW_ROOMS === 1 ? '' : 's'}
          </Text>
        ) : null}
      </>
    );
  }
  return (
    <Card>
      <View style={styles.spread}>
        <SectionLabel>Rooms & beds</SectionLabel>
        {count !== null ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`View all ${count} rooms`} hitSlop={8} onPress={onViewAll}>
            <Text style={styles.viewAll}>View All ({count})</Text>
          </Pressable>
        ) : null}
      </View>
      {body}
    </Card>
  );
}

function RoomRow({ room }: { room: PropertyRoom }) {
  const configured = room.beds.length === room.sharing;
  return (
    <View style={styles.roomRow}>
      <View style={styles.flex}>
        <Text style={styles.roomName}>Room {room.roomNumber}</Text>
        <Text style={styles.muted}>
          {[
            room.sharing > 0 ? sharingLabel(room.sharing) : null,
            room.ac ? 'AC' : 'Non-AC',
            room.rentPerBedInr !== null ? `${formatInr(room.rentPerBedInr)}/bed` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </View>
      <Text style={configured ? styles.roomBeds : styles.roomBedsWarn}>
        {room.beds.length} {room.beds.length === 1 ? 'bed' : 'beds'}
        {configured ? '' : ` of ${room.sharing}`}
      </Text>
    </View>
  );
}

export function StateCard({ icon, title, message, actionLabel, onAction }: { icon: IconName; title: string; message: string; actionLabel: string; onAction: () => void }) {
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
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  flex: { flex: 1, minWidth: 0 },
  selfStart: { alignSelf: 'flex-start' },
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
  spread: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: BrandColors.textSecondary },
  statusMessage: { padding: 12, borderRadius: 12, backgroundColor: '#E8F0EE' },
  viewAll: { fontSize: 13, fontWeight: '700', color: BrandColors.accent },
  muted: { fontSize: 13, color: BrandColors.textSecondary },
  idRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, backgroundColor: BrandColors.canvas },
  idLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: BrandColors.textSecondary },
  idValue: { marginVertical: 2, fontSize: 14, fontWeight: '700', color: BrandColors.textPrimary },
  footnote: { fontSize: 12, color: BrandColors.textSecondary },
  center: { alignItems: 'center', gap: 8, paddingVertical: 40 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeReady: { backgroundColor: '#E8F0EE' },
  badgeDraft: { backgroundColor: BrandColors.errorTint },
  dot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  summaryRow: { flexDirection: 'row', gap: 14 },
  thumb: { width: 84, height: 84, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF3F1', overflow: 'hidden' },
  thumbImage: { width: '100%', height: '100%' },
  summaryText: { flex: 1, minWidth: 0, gap: 4 },
  propertyName: { fontSize: 20, fontWeight: '800', color: BrandColors.textPrimary },
  addressRow: { flexDirection: 'row', gap: 4, alignItems: 'flex-start' },
  trackFill: { height: '100%', borderRadius: 4, backgroundColor: BrandColors.accent },
  percent: { fontSize: 32, fontWeight: '800', color: BrandColors.textPrimary },
  track: { height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: BrandColors.canvas },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 },
  metric: { width: '50%', gap: 2 },
  metricLabel: { fontSize: 12, color: BrandColors.textSecondary },
  metricValue: { fontSize: 20, fontWeight: '800', color: BrandColors.textPrimary },
  inlineState: { gap: 8, alignItems: 'flex-start' },
  suite: { gap: 10 },
  suiteGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  suiteCard: {
    flexGrow: 1,
    flexBasis: '45%',
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 16,
    backgroundColor: BrandColors.surface,
    borderWidth: 1,
    borderColor: BrandColors.border,
  },
  suiteSpacer: { flexGrow: 1, flexBasis: '45%' },
  suiteIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF3F1' },
  suiteTitle: { fontSize: 14, fontWeight: '700', color: BrandColors.textPrimary },
  soon: { fontSize: 11, color: BrandColors.textSecondary },
  disabled: { opacity: 0.6 },
  pressed: { opacity: 0.85 },
  roomRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, backgroundColor: BrandColors.canvas },
  roomName: { fontSize: 14, fontWeight: '700', color: BrandColors.textPrimary },
  roomBeds: { fontSize: 13, fontWeight: '700', color: BrandColors.accent },
  roomBedsWarn: { fontSize: 13, fontWeight: '700', color: BrandColors.error },
  stateCard: { alignItems: 'center', padding: 28, borderRadius: 16, backgroundColor: BrandColors.surface, borderWidth: 1, borderColor: BrandColors.border },
  stateIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 12, backgroundColor: BrandColors.canvas },
  stateTitle: { fontSize: 16, fontWeight: '700', color: BrandColors.textPrimary },
  stateMessage: { marginTop: 4, textAlign: 'center', fontSize: 13, color: BrandColors.textSecondary },
  stateAction: { marginTop: 14, alignSelf: 'stretch' },
});
