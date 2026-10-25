import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppScrollView } from '@/components/app-scroll-view';
import { useConfirm } from '@/components/confirm-dialog';
import { APP_TAGLINE } from '@/constants/brand';
import { BrandColors } from '@/constants/theme';
import { getAuthErrorMessage } from '@/features/auth/authErrorMessage';
import { HostellLogo } from '@/features/auth/HostellLogo';
import { selectOwner } from '@/features/auth/ownerAuthSelectors';
import { logoutOwnerThunk } from '@/features/auth/ownerAuthSlice';
import { initialsOf } from '@/features/profile/profileModel';
import { useAccountProfile, useBusinessOverview } from '@/features/profile/useProfile';
import { occupancyPercent } from '@/features/properties/propertyDetailsModel';
import { useAppDispatch, useAppSelector } from '@/store/hooks';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

// The owner's More tab. Everything shown is real: the profile and counts come from the owner's own
// data. Items for features that do not exist (staff, agreement templates, subscription, WhatsApp
// automation, payment gateway, notification and security settings, support and legal pages) are
// left out rather than shown as if they worked.
export function OwnerMoreScreen() {
  const owner = useAppSelector(selectOwner);
  const dispatch = useAppDispatch();
  const profile = useAccountProfile();
  const business = useBusinessOverview();
  const { confirm, dialog } = useConfirm();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const name = profile.data?.displayName ?? owner?.displayName ?? null;
  const email = profile.data?.email ?? owner?.email ?? null;
  const phone = profile.data?.phone ?? null;
  const percent = business.totalBeds !== null && business.occupiedBeds !== null ? occupancyPercent(business.occupiedBeds, business.totalBeds) : null;

  const logOut = async () => {
    if (signingOut) return;
    const ok = await confirm({ title: 'Log out of HOSTELL?', message: 'You will need to sign in again.', confirmLabel: 'Log out', destructive: true });
    if (!ok) return;
    setSigningOut(true);
    setError(null);
    try {
      // Redux auth state is cleared by the auth observer only after Firebase has signed out.
      await dispatch(logoutOwnerThunk()).unwrap();
    } catch (e) {
      setError(getAuthErrorMessage(e));
      setSigningOut(false);
    }
  };

  const propertyLine = business.isPending
    ? 'Loading…'
    : business.propertyCount === null
      ? 'Unavailable right now'
      : `${business.propertyCount} ${business.propertyCount === 1 ? 'property' : 'properties'}${business.totalBeds !== null ? ` · ${business.totalBeds} ${business.totalBeds === 1 ? 'bed' : 'beds'}` : ''}`;

  return (
    <AppScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.strip}>
        <View style={styles.flex}>
          <Text style={styles.eyebrow}>Account & scope</Text>
          <Text style={styles.stripTitle}>Settings & preferences</Text>
        </View>
        <View style={styles.stripIcon}>
          <MaterialIcons name="manage-accounts" size={20} color={BrandColors.textSecondary} />
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.profile}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initialsOf(name)}</Text>
          </View>
          <View style={styles.flex}>
            <View style={styles.nameRow}>
              <Text numberOfLines={1} style={styles.name}>
                {profile.isPending ? 'Loading…' : (name ?? 'Your name is not set')}
              </Text>
              {owner?.emailVerified ? (
                <View style={styles.verified}>
                  <MaterialIcons name="verified" size={13} color={BrandColors.accent} />
                  <Text style={styles.verifiedText}>Email verified</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.muted}>Property Owner</Text>
            <Text numberOfLines={1} style={styles.muted}>
              {[phone, email].filter(Boolean).join(' · ') || 'No contact details'}
            </Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Edit profile" onPress={() => router.push('/owner/profile')} hitSlop={8} style={styles.editButton}>
            <MaterialIcons name="edit" size={20} color={BrandColors.textSecondary} />
          </Pressable>
        </View>
        <View style={styles.stats}>
          <Stat label="Properties" value={business.propertyCount === null ? (business.isPending ? '…' : '—') : String(business.propertyCount)} />
          <Stat label="Capacity" value={business.totalBeds === null ? (business.bedsLoading || business.isPending ? '…' : '—') : `${business.totalBeds} ${business.totalBeds === 1 ? 'bed' : 'beds'}`} />
          <Stat label="Occupancy" value={percent === null ? (business.bedsLoading || business.isPending ? '…' : '—') : `${percent}%`} accent />
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Refer and earn"
        onPress={() => router.push({ pathname: '/owner/profile', params: { tab: 'refer' } })}
        style={({ pressed }) => [styles.refer, pressed && styles.pressed]}>
        <View style={styles.referIcon}>
          <MaterialIcons name="card-giftcard" size={22} color={BrandColors.accent} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.referTitle}>Refer & Earn</Text>
          <Text style={styles.referText}>Share your HOSTELL invite link and follow who signs up. Rewards are not part of HOSTELL yet.</Text>
        </View>
        <MaterialIcons name="chevron-right" size={22} color={BrandColors.accent} />
      </Pressable>

      <Section title="Management">
        <Row icon="apartment" title="My Properties" subtitle={propertyLine} onPress={() => router.navigate('/owner/properties')} />
        <Row icon="group" title="Tenants" subtitle="Residents across your properties" onPress={() => router.navigate('/owner/tenants')} last />
      </Section>

      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <AppButton variant="secondary" icon="logout" label={signingOut ? 'Logging out…' : 'Log Out of HOSTELL'} disabled={signingOut} onPress={logOut} />
      {signingOut ? <ActivityIndicator color={BrandColors.accent} /> : null}

      <View style={styles.footer}>
        <HostellLogo />
        <View style={styles.taglineRow}>
          <View style={styles.taglineLine} />
          <Text style={styles.tagline}>{APP_TAGLINE}</Text>
          <View style={styles.taglineLine} />
        </View>
      </View>
      {dialog}
    </AppScrollView>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, accent && { color: BrandColors.accent }]}>{value}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{title}</Text>
      <View style={styles.rows}>{children}</View>
    </View>
  );
}

function Row({ icon, title, subtitle, onPress, last }: { icon: IconName; title: string; subtitle: string; onPress: () => void; last?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, !last && styles.rowDivider, pressed && styles.pressed]}>
      <View style={styles.rowIcon}>
        <MaterialIcons name={icon} size={20} color={BrandColors.textPrimary} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text numberOfLines={1} style={styles.muted}>
          {subtitle}
        </Text>
      </View>
      <MaterialIcons name="chevron-right" size={20} color={BrandColors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BrandColors.canvas },
  content: { flexGrow: 1, padding: 16, gap: 16, paddingBottom: 32 },
  flex: { flex: 1, minWidth: 0 },
  muted: { fontSize: 12, color: BrandColors.textSecondary },
  pressed: { opacity: 0.85 },
  strip: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16, backgroundColor: BrandColors.surface, borderWidth: 1, borderColor: BrandColors.border },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: BrandColors.accent },
  stripTitle: { marginTop: 2, fontSize: 18, fontWeight: '800', color: BrandColors.textPrimary },
  stripIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: BrandColors.canvas },
  card: { gap: 14, padding: 16, borderRadius: 16, backgroundColor: BrandColors.surface, borderWidth: 1, borderColor: BrandColors.border },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F0EE' },
  avatarText: { fontSize: 18, fontWeight: '800', color: BrandColors.textPrimary },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  name: { flexShrink: 1, fontSize: 17, fontWeight: '800', color: BrandColors.textPrimary },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: '#E8F0EE' },
  verifiedText: { fontSize: 10, fontWeight: '700', color: BrandColors.accent },
  editButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', gap: 8, padding: 10, borderRadius: 12, backgroundColor: BrandColors.canvas },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', color: BrandColors.textSecondary },
  statValue: { fontSize: 16, fontWeight: '800', color: BrandColors.textPrimary },
  refer: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 16, backgroundColor: BrandColors.surface, borderWidth: 1, borderColor: BrandColors.border },
  referIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F0EE' },
  referTitle: { fontSize: 16, fontWeight: '800', color: BrandColors.textPrimary },
  referText: { marginTop: 2, fontSize: 12, lineHeight: 17, color: BrandColors.textSecondary },
  section: { gap: 8 },
  sectionLabel: { paddingHorizontal: 4, fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: BrandColors.textSecondary },
  rows: { borderRadius: 16, backgroundColor: BrandColors.surface, borderWidth: 1, borderColor: BrandColors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BrandColors.border },
  rowIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: BrandColors.canvas },
  rowTitle: { fontSize: 15, fontWeight: '700', color: BrandColors.textPrimary },
  error: { fontSize: 13, color: BrandColors.error },
  footer: { alignItems: 'center', justifyContent: 'flex-end', flexGrow: 1, paddingVertical: 8, gap: 8 },
  taglineRow: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8 },
  taglineLine: { width: 40, height: 1, backgroundColor: BrandColors.border },
  tagline: { fontSize: 12, fontWeight: '600', letterSpacing: 2, textTransform: 'uppercase', color: BrandColors.textSecondary },
});
