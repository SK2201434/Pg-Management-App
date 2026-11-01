import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useState, type ComponentProps } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BrandColors } from '@/constants/theme';
import { AppButton } from '@/components/app-button';
import { stayLabel } from '@/features/stayChange/stayChangeModel';
import { useRespondStayChange, useStayChange } from '@/features/stayChange/useStayChange';
import { NewRequestSheet } from '@/features/requests/NewRequestSheet';
import { useCreateRequest } from '@/features/requests/useTenantRequests';
import { MoveOutDialog } from '@/features/moveOut/MoveOutDialog';
import { DEFAULT_POLICY, formatMoveOutDate, moveOutOptions } from '@/features/moveOut/moveOutModel';
import { useMoveOutActions, useMyMoveOutRequest } from '@/features/moveOut/useMoveOut';
import { formatInr } from '@/features/properties/propertySetup';
import { selectOwner } from '@/features/auth/ownerAuthSelectors';
import { useAccountProfile } from '@/features/profile/useProfile';
import { ReviewsSection } from '@/features/reviews/ReviewsSection';
import { useAppSelector } from '@/store/hooks';
import { canRaiseRequest, formatJoined } from '@/features/tenantHome/tenantHomeModel';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { whatsAppUrl } from '@/features/discovery/discoveryModel';
import { formatAddress, mapUrl, monthsCompleted, telUrl } from '@/features/tenantHome/stayModel';
import { useMyStayRequestViews } from '@/features/discovery/useMyStayRequestViews';
import { StayRequestsSection } from '@/features/requests/StayRequestsSection';
import { useRefetchOnFocus } from '@/features/tenantHome/useRefetchOnFocus';
import { useTenantStay } from '@/features/tenantHome/useTenantStay';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

const open = (url: string) => {
  Linking.openURL(url).catch(() => {});
};

// My Stay: the tenant's own property and stay. Only what is stored is shown. Room and bed,
// house rules and a notice workflow do not exist in the data model yet (residents the
// owner adds are not linked to a tenant account), so those parts say so instead of inventing values.
export function TenantStayScreen() {
  const stay = useTenantStay();
  const stayRequests = useMyStayRequestViews();
  useRefetchOnFocus(stay.refetch);
  const [now] = useState(Date.now);
  const [rulesOpen, setRulesOpen] = useState(false);
  const profile = useAccountProfile();
  const owner = useAppSelector(selectOwner);
  const reviewerName = profile.data?.displayName ?? owner?.displayName ?? null;
  // Moving out: a request to the owner, within what the property's rules allow.
  const activeStay = stay.data?.state === 'active' ? stay.data : undefined;
  const moveOut = useMyMoveOutRequest(activeStay?.propertyId);
  const moveOutActions = useMoveOutActions(activeStay);
  const [moveOutOpen, setMoveOutOpen] = useState(false);
  // A room change the owner proposed: shown here to accept or decline.
  const stayChange = useStayChange(activeStay?.propertyId, owner?.uid);
  const respond = useRespondStayChange(activeStay?.propertyId, owner?.uid);
  // "Report Issue" opens the same New Request form as the Requests screen, right here.
  const createRequest = useCreateRequest(activeStay);
  const [reportOpen, setReportOpen] = useState(false);
  const reportError = createRequest.isError
    ? (createRequest.error as { code?: string }).code === 'permission-denied'
      ? 'You can’t submit requests for this property right now.'
      : 'Could not submit your request. Check your connection and try again.'
    : null;

  if (stay.isPending) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={BrandColors.accent} />
      </View>
    );
  }
  if (stay.isError || !stay.data) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={styles.cardTitle}>Could not load your stay</Text>
        <Text style={styles.muted}>Check your connection and try again.</Text>
        <Pressable accessibilityRole="button" onPress={() => stay.refetch()}>
          <Text style={styles.link}>Retry</Text>
        </Pressable>
      </View>
    );
  }
  const data = stay.data;
  if (data.state !== 'active') {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <StayRequestsSection items={stayRequests.items} />
        <View style={styles.center}>
          <MaterialIcons name="home-work" size={32} color={BrandColors.textSecondary} />
          <Text style={styles.cardTitle}>No active stay</Text>
          <Text style={styles.mutedCenter}>
            {data.state === 'none'
              ? 'No accommodation is associated with your account yet. Once an owner approves your request and assigns your bed, your stay appears here.'
              : data.state === 'inactive'
                ? 'Your stay at this property is no longer active.'
                : 'We could not find your property. Please try again later.'}
          </Text>
        </View>
      </ScrollView>
    );
  }

  const staying = canRaiseRequest(data, now);
  const address = formatAddress({ location: data.location, city: data.city, state: data.region, postalCode: data.postalCode });
  const map = mapUrl(data.geo, address);
  const call = telUrl(data.contactPhone);
  const whatsApp = whatsAppUrl(data.contactPhone);
  const moveIn = formatJoined(data.checkInMs);
  const duration = monthsCompleted(data.checkInMs, now);
  const mo = moveOut.data;
  const moveOutNote = mo && (mo.status === 'pending' || mo.status === 'approved') ? `${mo.status === 'approved' ? 'Moving out on' : 'Move-out requested for'} ${formatMoveOutDate(mo.moveOutMs)}${mo.status === 'pending' ? ' · waiting for the owner' : ''}` : null;
  const moveOutError = moveOutActions.send.isError ? 'Could not send your request. Check your connection and try again.' : moveOutActions.withdraw.isError ? 'Could not withdraw your request. Try again.' : null;

  return (
    <>
    {reportOpen && activeStay ? (
      <NewRequestSheet
        propertyName={activeStay.propertyName}
        busy={createRequest.isPending}
        submitError={reportError}
        onSubmit={(input) =>
          createRequest.mutate(input, {
            onSuccess: () => {
              setReportOpen(false);
              Alert.alert('Request submitted', 'You can follow it on the Requests screen.');
            },
          })
        }
        onClose={() => setReportOpen(false)}
      />
    ) : null}
    <MoveOutDialog
      visible={moveOutOpen}
      options={moveOutOptions(data.moveOutPolicy ?? DEFAULT_POLICY, now)}
      existing={moveOut.data ?? null}
      busy={moveOutActions.send.isPending || moveOutActions.withdraw.isPending}
      error={moveOutError}
      onSubmit={(option) => moveOutActions.send.mutate({ tenantName: reviewerName ?? 'Tenant', option, existing: moveOut.data ?? null }, { onSuccess: () => setMoveOutOpen(false) })}
      onWithdraw={() => moveOutActions.withdraw.mutate(undefined, { onSuccess: () => setMoveOutOpen(false) })}
      onClose={() => setMoveOutOpen(false)}
    />
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={stay.isRefetching} onRefresh={() => void stay.refetch()} tintColor={BrandColors.accent} colors={[BrandColors.accent]} />}>
      <View style={styles.card}>
        <View style={[styles.row, styles.spread]}>
          <View style={[styles.row, styles.flex]}>
            <View style={styles.iconBox}>
              {data.coverUrl ? (
                <Image source={{ uri: data.coverUrl }} style={styles.cover} accessibilityLabel={`${data.propertyName} photo`} />
              ) : (
                <MaterialIcons name="domain" size={22} color={BrandColors.accent} />
              )}
            </View>
            <Text numberOfLines={2} style={[styles.cardTitle, styles.flex]}>{data.propertyName}</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{staying ? 'Currently staying' : 'Stay ended'}</Text>
          </View>
        </View>
        <View style={styles.inset}>
          <View style={styles.row}>
            <MaterialIcons name="location-on" size={18} color={BrandColors.textSecondary} />
            <Text style={[styles.muted, styles.flex]}>{address ?? 'The property address has not been added yet.'}</Text>
          </View>
          {map ? (
            <Pressable accessibilityRole="link" onPress={() => open(map)} style={({ pressed }) => [styles.row, styles.indent, pressed && styles.pressed]}>
              <Text style={styles.link}>View Location Details</Text>
              <MaterialIcons name="north-east" size={16} color={BrandColors.accent} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {stayChange.data?.status === 'pending' || stayChange.data?.status === 'accepted' ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Room change</Text>
          <View style={styles.card}>
            <Text style={styles.rowTitle}>
              {stayChange.data.status === 'pending' ? 'Your owner proposed a new room' : 'You accepted the room change'}
            </Text>
            <Text style={styles.muted}>
              {stayLabel(stayChange.data.fromRoomNumber, stayChange.data.fromBedLabel)}  →  {stayLabel(stayChange.data.toRoomNumber, stayChange.data.toBedLabel)}
              {stayChange.data.toRentInr !== null ? ` · ${formatInr(stayChange.data.toRentInr)} / month` : ''}
            </Text>
            {stayChange.data.status === 'pending' ? (
              <>
                <Text style={styles.muted}>Your room and bed change only if you accept.</Text>
                {respond.isError ? <Text style={styles.muted} accessibilityRole="alert">Could not save your answer. Check your connection and try again.</Text> : null}
                <View style={styles.row}>
                  <View style={styles.flex}>
                    <AppButton variant="secondary" label="Decline" disabled={respond.isPending} onPress={() => respond.mutate('declined')} />
                  </View>
                  <View style={styles.flex}>
                    <AppButton label="Accept" loading={respond.isPending} onPress={() => respond.mutate('accepted')} />
                  </View>
                </View>
              </>
            ) : (
              <Text style={styles.muted}>Your room updates here once the owner confirms the move.</Text>
            )}
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Your room</Text>
        <View style={[styles.card, styles.row]}>
          <View style={styles.iconBox}>
            <MaterialIcons name="bed" size={22} color={BrandColors.textSecondary} />
          </View>
          <View style={styles.flex}>
            {data.room ? (
              <>
                <Text style={styles.rowTitle}>Room {data.room.roomNumber}{data.room.bedLabel ? ` · Bed ${data.room.bedLabel}` : ''}</Text>
                <Text style={styles.muted}>{data.room.sharing ? `${data.room.sharing === 1 ? 'Single' : `${data.room.sharing}-sharing`} room` : 'Assigned by your property'}</Text>
              </>
            ) : (
              <>
                <Text style={styles.rowTitle}>Room not assigned yet</Text>
                <Text style={styles.muted}>Your room and bed will appear here once the property links them to your account.</Text>
              </>
            )}
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Stay details</Text>
        <View style={styles.card}>
          <DetailRow
            icon="calendar-today"
            label="Move-in date"
            value={moveIn ?? 'Not recorded yet'}
            note={moveOutNote ?? duration}
            action={staying && moveOut.data?.status !== 'approved' ? { label: 'Move out', icon: 'logout', onPress: () => { moveOutActions.send.reset(); setMoveOutOpen(true); } } : undefined}
          />
          {data.room?.rentInr ? <DetailRow icon="payments" label="Monthly rent" value={`${formatInr(data.room.rentInr)} / month`} note={data.room.bedLabel ? `Room ${data.room.roomNumber} · Bed ${data.room.bedLabel}` : `Room ${data.room.roomNumber}`} /> : null}
          <DetailRow icon="badge" label="Stay status" value={staying ? 'Active resident' : 'Stay ended'} />
          {data.contactName || data.contactPhone ? (
            <DetailRow
              icon="person-pin"
              label="Warden / Manager"
              value={data.contactName ?? 'Property contact'}
              note={data.contactPhone}
              action={call ? { label: 'Call', icon: 'call', onPress: () => open(call) } : undefined}
              whatsApp={whatsApp ? () => open(whatsApp) : undefined}
            />
          ) : null}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Available facilities</Text>
        {data.amenities && data.amenities.length > 0 ? (
          <View style={[styles.card, styles.chips]}>
            {data.amenities.map((label) => (
              <View key={label} style={styles.chip}>
                <MaterialIcons name="check-circle" size={16} color={BrandColors.accent} />
                <Text style={styles.chipText}>{label}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={[styles.card, styles.row]}>
            <View style={styles.iconBox}>
              <MaterialIcons name="widgets" size={22} color={BrandColors.textSecondary} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.rowTitle}>No facilities listed</Text>
              <Text style={styles.muted}>Your property has not published its facilities yet.</Text>
            </View>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: rulesOpen }}
          onPress={() => setRulesOpen((v) => !v)}
          style={({ pressed }) => [styles.card, styles.row, styles.spread, pressed && styles.pressed]}>
          <View style={[styles.row, styles.flex]}>
            <View style={styles.iconBox}>
              <MaterialIcons name="policy" size={22} color={BrandColors.accent} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.rowTitle}>House Rules & Guidelines</Text>
              <Text numberOfLines={1} style={styles.muted}>Rules set by your property</Text>
            </View>
          </View>
          <MaterialIcons name="chevron-right" size={22} color={BrandColors.textSecondary} style={rulesOpen ? styles.rotated : undefined} />
        </Pressable>
        {rulesOpen ? (
          <View style={styles.card}>
            <Text style={styles.muted}>Your property has not published house rules yet.</Text>
          </View>
        ) : null}
      </View>

      <ReviewsSection propertyId={data.propertyId} reviewerName={reviewerName} />

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !call }}
          disabled={!call}
          onPress={() => call && open(call)}
          style={({ pressed }) => [styles.actionBtn, !call && styles.dim, pressed && styles.pressed]}>
          <MaterialIcons name="call" size={20} color={BrandColors.textPrimary} />
          <Text style={styles.actionText}>Contact Owner</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !staying }}
          disabled={!staying}
          onPress={() => { createRequest.reset(); setReportOpen(true); }}
          style={({ pressed }) => [styles.actionBtn, styles.actionPrimary, !staying && styles.dim, pressed && styles.pressed]}>
          <MaterialIcons name="build" size={20} color={BrandColors.surface} />
          <Text style={[styles.actionText, styles.actionPrimaryText]}>Report Issue</Text>
        </Pressable>
      </View>
    </ScrollView>
    </>
  );
}

function DetailRow({ icon, label, value, note, action, whatsApp }: { icon: IconName; label: string; value: string; note?: string | null; action?: { label: string; icon: IconName; onPress: () => void }; whatsApp?: () => void }) {
  return (
    <View style={[styles.row, styles.spread, styles.detail]}>
      <View style={[styles.row, styles.flex]}>
        <View style={styles.smallIcon}>
          <MaterialIcons name={icon} size={18} color={BrandColors.textSecondary} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.detailLabel}>{label}</Text>
          <Text numberOfLines={1} style={styles.rowTitle}>{value}</Text>
          {note ? <Text numberOfLines={1} style={styles.muted}>{note}</Text> : null}
        </View>
      </View>
      {whatsApp ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Message on WhatsApp" hitSlop={6} onPress={whatsApp} style={({ pressed }) => [styles.waBtn, pressed && styles.pressed]}>
          <FontAwesome name="whatsapp" size={20} color="#FFFFFF" />
        </Pressable>
      ) : null}
      {action ? (
        <Pressable accessibilityRole="button" accessibilityLabel={action.label} onPress={action.onPress} style={({ pressed }) => [styles.callBtn, pressed && styles.pressed]}>
          <MaterialIcons name={action.icon} size={16} color={BrandColors.surface} />
          <Text style={styles.callText}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: '#E8F0EE' },
  chipText: { fontSize: 13, fontWeight: '600', color: BrandColors.textPrimary },
  screen: { flex: 1, backgroundColor: BrandColors.canvas },
  content: { padding: 16, gap: 20, paddingBottom: 32 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  spread: { justifyContent: 'space-between' },
  indent: { paddingLeft: 28 },
  dim: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
  rotated: { transform: [{ rotate: '90deg' }] },
  section: { gap: 8 },
  sectionLabel: { paddingHorizontal: 4, fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: BrandColors.textSecondary },
  card: { gap: 10, padding: 16, borderRadius: 16, backgroundColor: BrandColors.surface, borderWidth: 1, borderColor: BrandColors.border },
  inset: { gap: 8, padding: 12, borderRadius: 12, backgroundColor: BrandColors.canvas },
  cardTitle: { fontSize: 16, fontWeight: '800', color: BrandColors.textPrimary },
  rowTitle: { fontSize: 14, fontWeight: '700', color: BrandColors.textPrimary },
  muted: { fontSize: 13, lineHeight: 19, color: BrandColors.textSecondary },
  mutedCenter: { fontSize: 13, lineHeight: 19, textAlign: 'center', color: BrandColors.textSecondary },
  link: { fontSize: 14, fontWeight: '700', color: BrandColors.accent },
  iconBox: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F0EE', overflow: 'hidden' },
  cover: { width: '100%', height: '100%' },
  smallIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: BrandColors.canvas },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: '#E8F0EE' },
  badgeText: { fontSize: 11, fontWeight: '800', color: BrandColors.accent },
  detail: { paddingVertical: 4 },
  detailLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', color: BrandColors.textSecondary },
  callBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: BrandColors.accent },
  waBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#25D366' },
  callText: { fontSize: 12, fontWeight: '700', color: BrandColors.surface },
  actions: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48, borderRadius: 12, backgroundColor: BrandColors.surface, borderWidth: 1, borderColor: BrandColors.border },
  actionPrimary: { backgroundColor: BrandColors.accent, borderColor: BrandColors.accent },
  actionText: { fontSize: 14, fontWeight: '700', color: BrandColors.textPrimary },
  actionPrimaryText: { color: BrandColors.surface },
});
