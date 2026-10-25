import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useConfirm } from '@/components/confirm-dialog';
import { APP_NAME, APP_TAGLINE } from '@/constants/brand';
import { BrandColors } from '@/constants/theme';
import { getAuthErrorMessage } from '@/features/auth/authErrorMessage';
import { HostellLogo } from '@/features/auth/HostellLogo';
import { selectOwner } from '@/features/auth/ownerAuthSelectors';
import { logoutOwnerThunk } from '@/features/auth/ownerAuthSlice';
import { initialsOf } from '@/features/profile/profileModel';
import { useAccountProfile } from '@/features/profile/useProfile';
import { telUrl } from '@/features/tenantHome/stayModel';
import { canRaiseRequest } from '@/features/tenantHome/tenantHomeModel';
import { useTenantStay } from '@/features/tenantHome/useTenantStay';
import { useAppDispatch, useAppSelector } from '@/store/hooks';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

// The tenant More tab. Every row either does something real or is visibly marked unavailable:
// documents, notification preferences and security settings have no feature behind them yet.
export function TenantMoreScreen() {
  const owner = useAppSelector(selectOwner);
  const dispatch = useAppDispatch();
  const profile = useAccountProfile();
  const stay = useTenantStay();
  const { confirm, dialog } = useConfirm();
  const [now] = useState(Date.now);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const name = profile.data?.displayName ?? owner?.displayName ?? null;
  const email = profile.data?.email ?? owner?.email ?? null;
  const active = stay.data?.state === 'active' ? stay.data : null;
  const staying = canRaiseRequest(stay.data, now);
  const call = telUrl(active?.contactPhone ?? null);
  const version = Constants.expoConfig?.version;

  const logOut = async () => {
    if (signingOut) return;
    const ok = await confirm({ title: `Log out of ${APP_NAME}?`, message: 'You will need to sign in again.', confirmLabel: 'Log out', destructive: true });
    if (!ok) return;
    setSigningOut(true);
    setError(null);
    try {
      // The auth observer clears the cached data and Redux state once Firebase has signed out.
      await dispatch(logoutOwnerThunk()).unwrap();
    } catch (e) {
      setError(getAuthErrorMessage(e));
      setSigningOut(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.intro}>
        <View style={[styles.row, styles.spread]}>
          <Text style={styles.heading}>More</Text>
          {active ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{staying ? 'Active resident' : 'Stay ended'}</Text>
            </View>
          ) : null}
        </View>
        <Text numberOfLines={1} style={styles.muted}>
          {stay.isPending ? 'Loading…' : active ? active.propertyName : 'No active stay'}
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="View profile"
        onPress={() => router.push('/tenant/profile')}
        style={({ pressed }) => [styles.card, styles.row, styles.spread, pressed && styles.pressed]}>
        <View style={[styles.row, styles.flex]}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initialsOf(name)}</Text>
          </View>
          <View style={styles.flex}>
            <Text numberOfLines={1} style={styles.name}>{profile.isPending ? 'Loading…' : (name ?? 'Your name is not set')}</Text>
            {email ? <Text numberOfLines={1} style={styles.muted}>{email}</Text> : null}
          </View>
        </View>
        <View style={styles.row}>
          <Text style={styles.link}>View</Text>
          <MaterialIcons name="chevron-right" size={18} color={BrandColors.accent} />
        </View>
      </Pressable>
      {profile.isError ? (
        <Pressable accessibilityRole="button" onPress={() => profile.refetch()}>
          <Text style={styles.errorText}>Could not load your profile. Tap to retry.</Text>
        </Pressable>
      ) : null}

      <Section title="My Information">
        <Row icon="menu-book" title="House Rules & Policies" subtitle="Rules set by your property" onPress={() => router.navigate('/tenant/my-stay')} last />
      </Section>

      <Section title="Help & Support">
        <Row
          icon="chat-bubble"
          title="Contact Property Owner"
          subtitle={call ? (active?.contactName ?? 'Call your property contact') : 'No contact number on file'}
          onPress={call ? () => Linking.openURL(call).catch(() => {}) : undefined}
          trailing={call ? undefined : 'Unavailable'}
        />
        <Row icon="help-outline" title="Help & Resident Guide" subtitle="Review your raised tickets" onPress={() => router.navigate('/tenant/requests')} />
        <Row icon="info-outline" title={`About ${APP_NAME}`} subtitle="About the app, terms & privacy" trailing={version ? `v${version}` : undefined} onPress={() => router.push('/tenant/about')} last />
      </Section>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: signingOut, busy: signingOut }}
        disabled={signingOut}
        onPress={logOut}
        style={({ pressed }) => [styles.card, styles.row, styles.spread, pressed && styles.pressed]}>
        <View style={[styles.row, styles.flex]}>
          <View style={[styles.iconBox, styles.iconDanger]}>
            <MaterialIcons name="logout" size={20} color={BrandColors.error} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.logoutTitle}>{signingOut ? 'Logging out…' : 'Log Out'}</Text>
            {name ? <Text numberOfLines={1} style={styles.muted}>Signed in as {name}</Text> : null}
          </View>
        </View>
        {signingOut ? <ActivityIndicator color={BrandColors.accent} /> : <MaterialIcons name="chevron-right" size={20} color={BrandColors.textSecondary} />}
      </Pressable>
      {error ? <Text style={styles.errorText} accessibilityRole="alert">{error}</Text> : null}

      <View style={styles.footer}>
        <HostellLogo />
        <View style={styles.taglineRow}>
          <View style={styles.taglineLine} />
          <Text style={styles.tagline}>{APP_TAGLINE}</Text>
          <View style={styles.taglineLine} />
        </View>
      </View>
      {dialog}
    </ScrollView>
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

function Row({ icon, title, subtitle, trailing, onPress, last }: { icon: IconName; title: string; subtitle: string; trailing?: string; onPress?: () => void; last?: boolean }) {
  const body = (
    <>
      <View style={styles.iconBox}>
        <MaterialIcons name={icon} size={20} color={BrandColors.accent} />
      </View>
      <View style={styles.flex}>
        <Text numberOfLines={1} style={styles.rowTitle}>{title}</Text>
        <Text numberOfLines={1} style={styles.muted}>{subtitle}</Text>
      </View>
      {trailing ? <Text style={styles.trailing}>{trailing}</Text> : null}
      {onPress ? <MaterialIcons name="chevron-right" size={20} color={BrandColors.textSecondary} /> : null}
    </>
  );
  const rowStyle = [styles.menuRow, !last && styles.divider];
  return onPress ? (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${subtitle}`} onPress={onPress} style={({ pressed }) => [...rowStyle, pressed && styles.pressed]}>
      {body}
    </Pressable>
  ) : (
    <View accessible accessibilityState={{ disabled: true }} accessibilityLabel={`${title}. ${trailing ?? 'Not available'}`} style={[...rowStyle, styles.dim]}>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BrandColors.canvas },
  content: { flexGrow: 1, padding: 16, gap: 18, paddingBottom: 32 },
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  spread: { justifyContent: 'space-between' },
  dim: { opacity: 0.6 },
  pressed: { opacity: 0.85 },
  intro: { gap: 2 },
  heading: { fontSize: 24, fontWeight: '800', color: BrandColors.textPrimary },
  muted: { fontSize: 13, lineHeight: 19, color: BrandColors.textSecondary },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: '#E8F0EE' },
  badgeText: { fontSize: 11, fontWeight: '800', color: BrandColors.accent },
  card: { padding: 16, borderRadius: 16, backgroundColor: BrandColors.surface, borderWidth: 1, borderColor: BrandColors.border },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F0EE' },
  avatarText: { fontSize: 16, fontWeight: '800', color: BrandColors.accent },
  name: { fontSize: 16, fontWeight: '800', color: BrandColors.textPrimary },
  link: { fontSize: 14, fontWeight: '700', color: BrandColors.accent },
  section: { gap: 8 },
  sectionLabel: { paddingHorizontal: 4, fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: BrandColors.textSecondary },
  rows: { borderRadius: 16, backgroundColor: BrandColors.surface, borderWidth: 1, borderColor: BrandColors.border, overflow: 'hidden' },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, minHeight: 64 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BrandColors.border },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: BrandColors.canvas },
  iconDanger: { backgroundColor: '#F6E9E8' },
  rowTitle: { fontSize: 14, fontWeight: '700', color: BrandColors.textPrimary },
  trailing: { fontSize: 11, fontWeight: '600', color: BrandColors.textSecondary },
  logoutTitle: { fontSize: 14, fontWeight: '700', color: BrandColors.error },
  errorText: { fontSize: 13, color: BrandColors.error },
  footer: { flexGrow: 1, alignItems: 'center', justifyContent: 'flex-end', paddingVertical: 8, gap: 8 },
  taglineRow: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8 },
  taglineLine: { width: 40, height: 1, backgroundColor: BrandColors.border },
  tagline: { fontSize: 12, fontWeight: '600', letterSpacing: 2, textTransform: 'uppercase', color: BrandColors.textSecondary },
});
