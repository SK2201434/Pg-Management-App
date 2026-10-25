import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BrandColors } from '@/constants/theme';
import { useProfileDisplayName } from '@/features/auth/useUserProfile';
import { useMyStayRequestViews, type MyStayRequestView } from '@/features/discovery/useMyStayRequestViews';
import { activeCount, combineRequests } from '@/features/requests/requestsModel';
import { NewRequestSheet } from '@/features/requests/NewRequestSheet';
import { useCreateRequest, useTenantRequests } from '@/features/requests/useTenantRequests';
import { whatsAppUrl } from '@/features/discovery/discoveryModel';
import { telUrl } from '@/features/tenantHome/stayModel';
import { canRaiseRequest, firstNameOf, formatJoined, greetingFor } from '@/features/tenantHome/tenantHomeModel';
import { ACCESS_MESSAGE } from '@/features/tenantHome/updatesModel';
import { ContactHostDialog } from '@/features/tenantHome/ContactHostDialog';
import { UpdatesSwiper } from '@/features/tenantHome/UpdatesSwiper';
import { RequestsSwiper } from '@/features/tenantHome/RequestsSwiper';
import { useRefetchOnFocus } from '@/features/tenantHome/useRefetchOnFocus';
import { useTenantStay } from '@/features/tenantHome/useTenantStay';
import { useTenantUpdates } from '@/features/tenantHome/useTenantUpdates';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

// The tenant Home. Only the stay is real today: the name and the property the tenant joined come
// from their own records. Announcements, requests, facilities, house rules and host contact have
// no data model yet, so those sections say so instead of showing made-up content, and quick
// actions without a destination are disabled. The top bar (title, bell, profile) comes from the
// tab layout; the tenant has no notifications, so the bell stays disabled there.
export function TenantHomeScreen() {
  const name = firstNameOf(useProfileDisplayName());
  const stay = useTenantStay();
  const updates = useTenantUpdates(stay.data);
  const requests = useTenantRequests(stay.data);
  const stayRequests = useMyStayRequestViews();
  useRefetchOnFocus(stay.refetch);
  // The host's number is the owner's contact on the property, shown only for an active stay.
  const hostCall = stay.data?.state === 'active' ? telUrl(stay.data.contactPhone) : null;
  const hostWhatsApp = stay.data?.state === 'active' ? whatsAppUrl(stay.data.contactPhone) : null;
  const [contactOpen, setContactOpen] = useState(false);
  // "Raise an Issue" opens the same New Request form as the Requests screen, right here.
  const [now] = useState(Date.now);
  const raisable = canRaiseRequest(stay.data, now) ? stay.data : undefined;
  const create = useCreateRequest(raisable);
  const [raiseOpen, setRaiseOpen] = useState(false);
  const submitError = create.isError
    ? (create.error as { code?: string }).code === 'permission-denied'
      ? 'You can’t submit requests for this property right now.'
      : 'Could not submit your request. Check your connection and try again.'
    : null;
  const openLink = (url: string) => {
    setContactOpen(false);
    void Linking.openURL(url).catch(() => Alert.alert('Could not open', 'This device could not open that app.'));
  };
  const greeting = greetingFor(new Date().getHours());

  return (
    <>
    {raiseOpen && raisable ? (
      <NewRequestSheet
        propertyName={raisable.propertyName}
        busy={create.isPending}
        submitError={submitError}
        onSubmit={(input) =>
          create.mutate(input, {
            onSuccess: () => {
              setRaiseOpen(false);
              Alert.alert('Request submitted', 'You can follow it under My Requests.');
            },
          })
        }
        onClose={() => setRaiseOpen(false)}
      />
    ) : null}
    <ContactHostDialog visible={contactOpen} callUrl={hostCall} whatsAppUrl={hostWhatsApp} onOpen={openLink} onClose={() => setContactOpen(false)} />
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={stay.isRefetching} onRefresh={() => stay.refetch()} tintColor={BrandColors.accent} colors={[BrandColors.accent]} />}>
      <View style={styles.greeting}>
        <Text style={styles.greetingTitle}>{name ? `${greeting}, ${name}` : greeting}</Text>
        {stay.data?.state === 'active' ? <Text style={styles.muted}>{stay.data.propertyName}</Text> : null}
      </View>

      <StayCard stay={stay} />

      <Section title="Latest Updates" onViewAll={() => router.push('/tenant/updates')}>
        {updates.items.length > 0 ? (
          <UpdatesSwiper items={updates.items} />
        ) : updates.access === 'before' || updates.access === 'after' ? (
          <EmptyCard icon="lock-clock" title="Updates unavailable" body={ACCESS_MESSAGE[updates.access]} />
        ) : (
          <EmptyCard icon="campaign" title="No updates yet" body="Notices from your property will appear here once announcements are available." />
        )}
      </Section>

      <Section title="My Requests" onViewAll={() => router.navigate('/tenant/requests')}>
        <RequestsSummary requests={requests} stayActive={stay.data?.state === 'active'} stayRequests={stayRequests.items} />
      </Section>

      <Section title="Quick Actions">
        <View style={styles.actions}>
          <Action icon="construction" title="Raise an Issue" subtitle="Repairs & help" onPress={raisable ? () => { create.reset(); setRaiseOpen(true); } : undefined} />
          <Action icon="support-agent" title="Contact Host" subtitle={hostCall || hostWhatsApp ? (stay.data?.state === 'active' && stay.data.contactName) || 'Call or message' : 'Concierge desk'} onPress={hostCall || hostWhatsApp ? () => setContactOpen(true) : undefined} />
          <Action icon="menu-book" title="House Rules" subtitle="Quiet hours & info" />
        </View>
        <Text style={styles.note}>These actions will be enabled when the features are available.</Text>
      </Section>
    </ScrollView>
    </>
  );
}

function StayCard({ stay }: { stay: ReturnType<typeof useTenantStay> }) {
  if (stay.isPending) {
    return (
      <View style={[styles.card, styles.center]}>
        <ActivityIndicator color={BrandColors.accent} />
      </View>
    );
  }
  if (stay.isError || !stay.data) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Could not load your stay</Text>
        <Text style={styles.muted}>Check your connection and try again.</Text>
        <Pressable accessibilityRole="button" onPress={() => stay.refetch()} style={({ pressed }) => pressed && styles.pressed}>
          <Text style={styles.link}>Retry</Text>
        </Pressable>
      </View>
    );
  }
  const data = stay.data;
  if (data.state !== 'active') {
    const body =
      data.state === 'none'
        ? 'You are not part of a property yet. Ask your property owner for an invite code.'
        : data.state === 'inactive'
          ? 'Your stay at this property is no longer active.'
          : 'We could not find your property. Please try again later.';
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{data.state === 'none' ? 'No active stay' : 'Stay unavailable'}</Text>
        <Text style={styles.muted}>{body}</Text>
      </View>
    );
  }
  const joined = formatJoined(data.joinedMs);
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.iconBox}>
          {data.coverUrl ? (
            <Image source={{ uri: data.coverUrl }} style={styles.cover} accessibilityLabel={`${data.propertyName} photo`} />
          ) : (
            <MaterialIcons name="apartment" size={20} color={BrandColors.accent} />
          )}
        </View>
        <View style={styles.flex}>
          <Text style={styles.cardTitle}>{data.propertyName}</Text>
          {data.location ? <Text style={styles.muted}>{data.location}</Text> : null}
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Active</Text>
        </View>
      </View>
      {joined ? <Text style={styles.muted}>Joined {joined}</Text> : null}
      {data.room ? (
        <Text style={styles.cardTitle}>
          Room {data.room.roomNumber}
          {data.room.bedLabel ? ` · Bed ${data.room.bedLabel}` : ''}
          {data.room.sharing ? ` · ${data.room.sharing === 1 ? 'Single' : `${data.room.sharing}-sharing`}` : ''}
        </Text>
      ) : (
        <Text style={styles.muted}>Room and bed details will show here once they are assigned to your account.</Text>
      )}
      <Pressable accessibilityRole="button" onPress={() => router.navigate('/tenant/my-stay')} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
        <Text style={styles.link}>View My Stay</Text>
        <MaterialIcons name="chevron-right" size={18} color={BrandColors.accent} />
      </Pressable>
    </View>
  );
}

function Section({ title, onViewAll, children }: { title: string; onViewAll?: () => void; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={[styles.row, styles.spread]}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {onViewAll ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`View all ${title}`} onPress={onViewAll} hitSlop={8} style={({ pressed }) => pressed && styles.pressed}>
            <Text style={styles.link}>View All</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function EmptyCard({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  return (
    <View style={[styles.card, styles.row]}>
      <View style={styles.iconBox}>
        <MaterialIcons name={icon} size={20} color={BrandColors.textSecondary} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.muted}>{body}</Text>
      </View>
    </View>
  );
}

function RequestsSummary({ requests, stayActive, stayRequests }: { requests: ReturnType<typeof useTenantRequests>; stayActive: boolean; stayRequests: MyStayRequestView[] }) {
  const maintenance = stayActive && requests.data ? requests.data : [];
  if (!stayActive && stayRequests.length === 0) return <EmptyCard icon="build" title="No requests" body="Requests need an active stay, or send a request to stay at a property." />;
  if (stayActive && requests.isPending && stayRequests.length === 0) {
    return (
      <View style={[styles.card, styles.center]}>
        <ActivityIndicator color={BrandColors.accent} />
      </View>
    );
  }
  if (stayActive && requests.isError && stayRequests.length === 0) return <EmptyCard icon="error-outline" title="Could not load requests" body="Pull down to refresh and try again." />;
  if (maintenance.length === 0 && stayRequests.length === 0) return <EmptyCard icon="build" title="No requests yet" body="Tickets you raise for your stay will appear here." />;
  const active = activeCount(maintenance) + stayRequests.filter((r) => r.status === 'pending').length;
  return (
    <View style={{ gap: 10 }}>
      <Text style={styles.muted}>{active} active · {maintenance.length + stayRequests.length} total</Text>
      <RequestsSwiper items={combineRequests(stayRequests, maintenance)} />
    </View>
  );
}

function Action({ icon, title, subtitle, onPress }: { icon: IconName; title: string; subtitle: string; onPress?: () => void }) {
  if (onPress) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
        <View style={styles.iconBox}>
          <MaterialIcons name={icon} size={20} color={BrandColors.accent} />
        </View>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionSub}>{subtitle}</Text>
      </Pressable>
    );
  }
  return (
    <View accessible accessibilityRole="button" accessibilityState={{ disabled: true }} accessibilityLabel={`${title}, not available yet`} style={[styles.action, styles.dim]}>
      <View style={styles.iconBox}>
        <MaterialIcons name={icon} size={20} color={BrandColors.textSecondary} />
      </View>
      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={styles.actionSub}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BrandColors.canvas },
  content: { padding: 16, gap: 20, paddingBottom: 32 },
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  spread: { justifyContent: 'space-between' },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 32 },
  dim: { opacity: 0.55 },
  pressed: { opacity: 0.85 },
  greeting: { gap: 2 },
  greetingTitle: { fontSize: 22, fontWeight: '800', color: BrandColors.textPrimary },
  muted: { fontSize: 13, lineHeight: 19, color: BrandColors.textSecondary },
  note: { fontSize: 12, color: BrandColors.textSecondary },
  section: { gap: 10 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: BrandColors.textPrimary },
  card: { gap: 10, padding: 16, borderRadius: 16, backgroundColor: BrandColors.surface, borderWidth: 1, borderColor: BrandColors.border },
  cardTitle: { fontSize: 16, fontWeight: '800', color: BrandColors.textPrimary },
  rowTitle: { fontSize: 14, fontWeight: '700', color: BrandColors.textPrimary },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F0EE', overflow: 'hidden' },
  cover: { width: '100%', height: '100%' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: '#E8F0EE' },
  badgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', color: BrandColors.accent },
  link: { fontSize: 14, fontWeight: '700', color: BrandColors.accent },
  actions: { flexDirection: 'row', gap: 10 },
  action: { flex: 1, alignItems: 'center', gap: 4, padding: 12, borderRadius: 16, backgroundColor: BrandColors.surface, borderWidth: 1, borderColor: BrandColors.border },
  actionTitle: { fontSize: 12, fontWeight: '700', textAlign: 'center', color: BrandColors.textPrimary },
  actionSub: { fontSize: 11, textAlign: 'center', color: BrandColors.textSecondary },
});
