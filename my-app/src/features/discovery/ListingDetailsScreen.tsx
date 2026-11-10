import FontAwesome from '@expo/vector-icons/FontAwesome';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/app-button';
import { BrandColors } from '@/constants/theme';
import { selectOwner } from '@/features/auth/ownerAuthSelectors';
import {
  MESSAGE_MAX,
  REQUEST_LABEL,
  addressOf,
  canRequest,
  requestAgainMs,
  acLabel,
  formatRentRange,
  galleryOf,
  sharingLabel,
  sharingSummary,
  type RoomType,
  whatsAppUrl,
} from '@/features/discovery/discoveryModel';
import { ReviewsSection } from '@/features/reviews/ReviewsSection';
import { PhotoCarousel } from '@/features/discovery/PhotoCarousel';
import { useListing, useMyStayRequest, useStayRequestActions } from '@/features/discovery/useDiscovery';
import { Field } from '@/features/properties/addProperty/formParts';
import { useAccountProfile } from '@/features/profile/useProfile';
import { mapUrl, telUrl } from '@/features/tenantHome/stayModel';
import { amenityLabel } from '@/features/properties/propertySetup';
import { useTenantStay } from '@/features/tenantHome/useTenantStay';
import { useAppSelector } from '@/store/hooks';

const open = (url: string) => {
  Linking.openURL(url).catch(() => {});
};

// A listed property's public page. It shows only what the owner published; the owner's contact is
// there only if the owner chose to share it. A stay request is only a request: it allocates no bed
// and grants no access.
export function ListingDetailsScreen() {
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  const id = typeof propertyId === 'string' ? propertyId : '';
  const listing = useListing(id);
  const mine = useMyStayRequest(id);
  const stay = useTenantStay();
  const profile = useAccountProfile();
  const owner = useAppSelector(selectOwner);
  const { send, withdraw } = useStayRequestActions(listing.data);
  const [sheet, setSheet] = useState(false);
  // Read once per visit: whether a declined request may be sent again depends on the date.
  const [now] = useState(Date.now);
  const [notice, setNotice] = useState<string | null>(null);
  const header = <Stack.Screen options={{ title: listing.data?.name ?? 'Property' }} />;

  if (listing.isPending) {
    return (
      <View style={[styles.screen, styles.center]}>
        {header}
        <ActivityIndicator color={BrandColors.accent} />
      </View>
    );
  }
  if (listing.isError) {
    return (
      <View style={[styles.screen, styles.center]}>
        {header}
        <Text style={styles.title}>Couldn’t load this property</Text>
        <Text style={styles.muted}>Check your connection and try again.</Text>
        <AppButton label="Retry" onPress={() => listing.refetch()} style={styles.retry} />
      </View>
    );
  }
  const l = listing.data;
  if (!l) {
    return (
      <View style={[styles.screen, styles.center]}>
        {header}
        <MaterialIcons name="apartment" size={32} color={BrandColors.textSecondary} />
        <Text style={styles.title}>Property not available</Text>
        <Text style={styles.muted}>It may have been removed by its owner.</Text>
      </View>
    );
  }

  const address = addressOf(l);
  // A listing carries the address only (no coordinates), so the link searches that address.
  const mapLink = mapUrl(null, address);
  const rent = formatRentRange(l.rentMinInr, l.rentMaxInr);
  const sharing = sharingSummary(l.sharingOptions);
  const amenities = l.amenities.flatMap((k) => amenityLabel(k) ?? []);
  const call = telUrl(l.contactPhone);
  const whatsApp = whatsAppUrl(l.contactPhone);
  const existing = mine.data ?? null;
  const current = stay.data?.state === 'active' && stay.data.propertyId === l.id;
  const tenantName = profile.data?.displayName ?? owner?.displayName ?? null;

  const requestError = send.isError
    ? (send.error as { code?: string }).code === 'permission-denied'
      ? 'You can’t request this property right now.'
      : 'Could not send your request. Check your connection and try again.'
    : null;

  return (
    <View style={styles.screen}>
      {header}
      <ScrollView contentContainerStyle={styles.content}>
        <PhotoCarousel urls={galleryOf(l)} />

        <View style={styles.card}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, styles.flex]}>{l.name}</Text>
            {current ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Your stay</Text>
              </View>
            ) : null}
          </View>
          {address ? (
            <View style={styles.row}>
              <MaterialIcons name="location-on" size={16} color={BrandColors.textSecondary} />
              <Text style={[styles.muted, styles.flex]}>{address}</Text>
            </View>
          ) : null}
          {mapLink ? (
            <Pressable accessibilityRole="link" onPress={() => open(mapLink)} style={({ pressed }) => [styles.row, styles.locationLink, pressed && styles.linkPressed]}>
              <Text style={styles.link}>View Location Details</Text>
              <MaterialIcons name="north-east" size={16} color={BrandColors.accent} />
            </Pressable>
          ) : null}
          {l.roomTypes.length === 0 ? (rent ? <Text style={styles.rent}>{rent}</Text> : <Text style={styles.muted}>Rent not published</Text>) : null}
          {l.description ? <Text style={styles.body}>{l.description}</Text> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Beds & pricing</Text>
          {l.roomTypes.length > 0 ? (
            <>
              {l.roomTypes.map((t) => (
                <RoomTypeRow key={t.sharing} type={t} />
              ))}
              {l.updatedMs !== null ? <Text style={styles.note}>Availability as of {new Date(l.updatedMs).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}. Ask the owner to confirm before you visit.</Text> : null}
            </>
          ) : (
            <>
              <Text style={styles.muted}>{sharing ? `Rooms: ${sharing}` : 'The owner has not published room details yet.'}</Text>
              {rent ? <Text style={styles.rent}>{rent}</Text> : null}
              <Text style={styles.note}>Bed availability has not been published for this property yet.</Text>
            </>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Amenities</Text>
          {amenities.length > 0 ? (
            <View style={styles.amenities}>
              {amenities.map((label) => (
                <View key={label} style={styles.amenity}>
                  <MaterialIcons name="check" size={14} color={BrandColors.accent} />
                  <Text style={styles.amenityText}>{label}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.muted}>The owner has not listed amenities for this property.</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Rules & regulations</Text>
          {l.houseRules.length > 0 ? (
            l.houseRules.map((rule, i) => (
              <View key={`${i}-${rule}`} style={styles.ruleRow}>
                <Text style={styles.ruleNumber}>{i + 1}.</Text>
                <Text style={[styles.muted, styles.flex]}>{rule}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.muted}>The owner has not published rules for this property.</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Contact the owner</Text>
          {l.contactName || l.contactPhone ? (
            <>
              {l.contactName ? <Text style={styles.rowTitle}>{l.contactName}</Text> : null}
              <View style={styles.contactRow}>
                <Text style={[styles.phone, styles.flex]} numberOfLines={1}>{l.contactPhone ?? ''}</Text>
                {call ? (
                  <Pressable accessibilityRole="button" accessibilityLabel="Call the owner" hitSlop={6} onPress={() => open(call)} style={({ pressed }) => [styles.iconBtn, styles.callBtn, pressed && styles.linkPressed]}>
                    <MaterialIcons name="call" size={20} color="#FFFFFF" />
                  </Pressable>
                ) : null}
                {whatsApp ? (
                  <Pressable accessibilityRole="button" accessibilityLabel="Message the owner on WhatsApp" hitSlop={6} onPress={() => open(whatsApp)} style={({ pressed }) => [styles.iconBtn, styles.waBtn, pressed && styles.linkPressed]}>
                    <FontAwesome name="whatsapp" size={22} color="#FFFFFF" />
                  </Pressable>
                ) : null}
              </View>
            </>
          ) : (
            <Text style={styles.muted}>The owner has not published contact details. You can still send a request to stay.</Text>
          )}
        </View>

        <ReviewsSection propertyId={l.id} reviewerName={tenantName} />

        <View style={styles.card}>
          <Text style={styles.label}>Stay request</Text>
          {mine.isPending ? (
            <ActivityIndicator color={BrandColors.accent} />
          ) : mine.isError ? (
            <>
              <Text style={styles.muted}>Could not check your request status.</Text>
              <AppButton label="Retry" variant="secondary" size="sm" onPress={() => mine.refetch()} />
            </>
          ) : existing && !canRequest(existing, now) ? (
            <>
              <Text style={styles.rowTitle}>{REQUEST_LABEL[existing.status]}</Text>
              <Text style={styles.muted}>
                {existing.status === 'pending'
                  ? 'The owner has your request. Nothing is allocated until they respond and assign you a bed.'
                  : existing.status === 'approved'
                    ? 'The owner approved your request. They will assign your bed and add you to the property.'
                    : (() => {
                        const again = requestAgainMs(existing);
                        return again === null
                          ? 'The owner did not accept this request.'
                          : `The owner did not accept this request. You can send a new request on ${new Date(again).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}.`;
                      })()}
              </Text>
              {existing.status === 'pending' ? (
                <AppButton
                  label="Withdraw request"
                  variant="secondary"
                  size="sm"
                  loading={withdraw.isPending}
                  onPress={() => withdraw.mutate(undefined, { onSuccess: () => setNotice('Request withdrawn.') })}
                />
              ) : null}
              {withdraw.isError ? <Text style={styles.error}>Could not withdraw your request. Try again.</Text> : null}
            </>
          ) : (
            <>
              <Text style={styles.muted}>
                {existing?.status === 'withdrawn'
                  ? 'You withdrew your earlier request. You can send it again.'
                  : existing?.status === 'rejected'
                    ? 'The owner did not accept your earlier request. It has been 7 days, so you can send a new one.'
                  : 'Tell the owner you would like to stay here. This is only a request: it does not reserve a bed.'}
              </Text>
              <AppButton label={existing ? 'Request again' : 'Request to stay'} onPress={() => { send.reset(); setSheet(true); }} disabled={tenantName === null} />
            </>
          )}
          {notice ? <Text style={styles.success} accessibilityRole="alert">{notice}</Text> : null}
        </View>
      </ScrollView>

      {sheet ? (
        <RequestSheet
          propertyName={l.name}
          busy={send.isPending}
          error={requestError}
          onClose={() => setSheet(false)}
          onSubmit={(message) =>
            send.mutate(
              { tenantName: tenantName as string, tenantPhone: profile.data?.phone ?? null, tenantGender: profile.data?.gender ?? null, tenantEmail: profile.data?.email ?? null, message, existing },
              { onSuccess: () => { setSheet(false); setNotice('Request sent to the owner.'); } },
            )
          }
        />
      ) : null}
    </View>
  );
}

function RoomTypeRow({ type }: { type: RoomType }) {
  const price = formatRentRange(type.rentMinInr, type.rentMaxInr)?.replace(' / month', '') ?? null;
  const full = type.bedsAvailable === 0;
  return (
    <View style={styles.roomRow} accessible accessibilityLabel={`${sharingLabel(type.sharing)}, ${type.bedsAvailable} of ${type.bedsTotal} beds available${price ? `, ${price} per month` : ''}`}>
      <View style={styles.flex}>
        <Text style={styles.rowTitle}>{sharingLabel(type.sharing)} · {acLabel(type)}</Text>
        <Text style={[styles.availability, full && styles.availabilityFull]}>
          {full ? `No beds available (${type.bedsTotal} total)` : `${type.bedsAvailable} of ${type.bedsTotal} ${type.bedsTotal === 1 ? 'bed' : 'beds'} available`}
        </Text>
      </View>
      <View style={styles.price}>
        <Text style={styles.priceValue}>{price ?? 'Price not set'}</Text>
        {price ? <Text style={styles.note}>per month</Text> : null}
      </View>
    </View>
  );
}

function RequestSheet({ propertyName, busy, error, onClose, onSubmit }: { propertyName: string; busy: boolean; error: string | null; onClose: () => void; onSubmit: (message: string) => void }) {
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState('');
  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent onRequestClose={busy ? undefined : onClose}>
      <KeyboardAvoidingView behavior="padding" style={styles.overlay}>
        <Pressable accessibilityLabel="Dismiss" disabled={busy} style={StyleSheet.absoluteFill} onPress={onClose} />
        <View accessibilityViewIsModal style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.handle} />
          <Text accessibilityRole="header" style={styles.title}>Request to stay</Text>
          <Text style={styles.muted}>{propertyName}</Text>
          <Field label="Message to the owner" optional value={message} onChangeText={setMessage} maxLength={MESSAGE_MAX} multiline numberOfLines={4} textAlignVertical="top" editable={!busy} placeholder="When you would like to move in, and anything the owner should know." />
          {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
          <View style={styles.row}>
            <AppButton variant="secondary" label="Cancel" disabled={busy} onPress={onClose} style={styles.flex} />
            <AppButton variant="submit" label="Send request" loading={busy} onPress={() => onSubmit(message)} style={styles.flex} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BrandColors.canvas },
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  locationLink: { paddingLeft: 24 },
  link: { fontSize: 14, fontWeight: '700', color: BrandColors.accent },
  linkPressed: { opacity: 0.85 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  callBtn: { backgroundColor: BrandColors.accent },
  waBtn: { backgroundColor: '#25D366' },
  center: { alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  content: { padding: 16, gap: 14, paddingBottom: 32 },
  card: { gap: 8, padding: 16, borderRadius: 16, backgroundColor: BrandColors.surface, borderWidth: 1, borderColor: BrandColors.border },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 18, fontWeight: '800', color: BrandColors.textPrimary },
  rowTitle: { fontSize: 15, fontWeight: '700', color: BrandColors.textPrimary },
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: BrandColors.textSecondary },
  muted: { fontSize: 13, lineHeight: 19, color: BrandColors.textSecondary },
  ruleRow: { flexDirection: 'row', gap: 8 },
  ruleNumber: { fontSize: 13, lineHeight: 19, fontWeight: '700', color: BrandColors.textPrimary },
  body: { fontSize: 14, lineHeight: 21, color: BrandColors.textPrimary },
  rent: { fontSize: 15, fontWeight: '700', color: BrandColors.textPrimary },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  phone: { fontSize: 20, fontWeight: '800', letterSpacing: 0.5, color: BrandColors.textPrimary },
  note: { fontSize: 12, lineHeight: 17, color: BrandColors.textSecondary },
  roomRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: BrandColors.border },
  availability: { marginTop: 2, fontSize: 13, fontWeight: '700', color: BrandColors.accent },
  availabilityFull: { color: BrandColors.error },
  price: { alignItems: 'flex-end' },
  priceValue: { fontSize: 15, fontWeight: '800', color: BrandColors.textPrimary },
  amenities: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  amenity: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: '#E8F0EE' },
  amenityText: { fontSize: 12, fontWeight: '600', color: BrandColors.textPrimary },
  retry: { alignSelf: 'stretch', marginTop: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: '#E8F0EE' },
  badgeText: { fontSize: 11, fontWeight: '800', color: BrandColors.accent },
  error: { fontSize: 13, color: BrandColors.error },
  success: { fontSize: 13, fontWeight: '600', color: BrandColors.accent },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(32, 42, 43, 0.45)' },
  sheet: { gap: 10, paddingTop: 8, paddingHorizontal: 16, borderTopLeftRadius: 28, borderTopRightRadius: 20, backgroundColor: BrandColors.surface },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 4, backgroundColor: BrandColors.border },
});
