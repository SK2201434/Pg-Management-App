import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { useConfirm } from '@/components/confirm-dialog';
import { BrandColors } from '@/constants/theme';
import { getAuthErrorMessage } from '@/features/auth/authErrorMessage';
import { HostellLogo } from '@/features/auth/HostellLogo';
import { selectOwner } from '@/features/auth/ownerAuthSelectors';
import { logoutOwnerThunk } from '@/features/auth/ownerAuthSlice';
import { requestPasswordReset } from '@/features/auth/passwordReset';
import { EditProfileSheet } from '@/features/profile/EditProfileSheet';
import { formatMemberSince, initialsOf } from '@/features/profile/profileModel';
import { useAccountProfile, useBusinessOverview, useSaveProfile } from '@/features/profile/useProfile';
import { useAppDispatch, useAppSelector } from '@/store/hooks';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

// My Profile. Everything comes from the signed-in user's own data: `users/{uid}`, Firebase Auth
// (email verification) and the owner's own properties. Phone verification does not exist, so no
// phone badge is shown. Account Settings has no destination yet and says so.
export function ProfileTab() {
  const owner = useAppSelector(selectOwner);
  const dispatch = useAppDispatch();
  const profile = useAccountProfile();
  const business = useBusinessOverview();
  const save = useSaveProfile();
  const { confirm, dialog } = useConfirm();
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  if (profile.isPending) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={BrandColors.accent} />
        <Text style={styles.muted}>Loading your profile…</Text>
      </View>
    );
  }
  if (profile.isError) {
    return (
      <View style={styles.card}>
        <Text style={styles.heading}>Couldn’t load your profile</Text>
        <Text style={styles.muted}>Check your connection and try again.</Text>
        <AppButton label="Retry" onPress={() => profile.refetch()} />
      </View>
    );
  }

  const data = profile.data;
  const name = data.displayName ?? owner?.displayName ?? null;
  const email = data.email ?? owner?.email ?? null;
  const active = data.status === 'active';
  const since = formatMemberSince(data.createdMs);

  const changePassword = async () => {
    if (!email) {
      setNotice('There is no email address on this account.');
      return;
    }
    const ok = await confirm({
      title: 'Reset your password?',
      message: `We’ll email a password reset link to ${email}.`,
      confirmLabel: 'Send link',
    });
    if (!ok) return;
    const error = await requestPasswordReset(email);
    setNotice(error ? error.message : `A password reset link was sent to ${email}.`);
  };

  const logOut = async () => {
    if (signingOut) return;
    const ok = await confirm({ title: 'Log out?', message: 'You will need to sign in again.', confirmLabel: 'Log out', destructive: true });
    if (!ok) return;
    setSigningOut(true);
    try {
      // Redux auth state is cleared by the auth observer only after Firebase signs out.
      await dispatch(logoutOwnerThunk()).unwrap();
    } catch (error) {
      setNotice(getAuthErrorMessage(error));
      setSigningOut(false);
    }
  };

  const businessValue = (() => {
    if (business.isPending) return 'Loading…';
    if (business.propertyCount === null) return 'Unavailable';
    const props = `${business.propertyCount} ${business.propertyCount === 1 ? 'property' : 'properties'}`;
    if (business.totalBeds !== null) return `${props} · ${business.totalBeds} ${business.totalBeds === 1 ? 'bed' : 'beds'}`;
    return business.bedsLoading ? `${props} · counting beds…` : `${props} · bed total unavailable`;
  })();

  return (
    <View style={styles.stack}>
      {notice ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss message" onPress={() => setNotice(null)} style={styles.notice}>
          <Text style={styles.noticeText}>{notice}</Text>
        </Pressable>
      ) : null}

      <View style={styles.card}>
        <View style={styles.identity}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initialsOf(name)}</Text>
          </View>
          <View style={styles.flex}>
            <Text numberOfLines={1} style={styles.name}>
              {name ?? 'Your name is not set'}
            </Text>
            <View style={styles.inline}>
              <Text style={styles.muted}>Property Owner</Text>
              {data.status ? (
                <View style={[styles.badge, active ? styles.badgeOn : styles.badgeOff]}>
                  <Text style={[styles.badgeText, active && { color: BrandColors.accent }]}>{active ? 'Active' : data.status}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
        <AppButton variant="secondary" size="sm" icon="edit" label="Edit Profile" onPress={() => { save.reset(); setEditing(true); }} style={styles.selfStart} />
      </View>

      <Section title="Personal information">
        <Row icon="person" label="Full name" value={name ?? 'Not set'} />
        <Row icon="mail" label="Email address" value={email ?? 'Not set'} trailing={owner?.emailVerified ? <MaterialIcons name="check-circle" size={18} color={BrandColors.accent} accessibilityLabel="Email verified" /> : undefined} />
        <Row icon="phone" label="Phone number" value={data.phone ?? 'Not added'} />
        <Row icon="wc" label="Gender" value={data.gender ? (data.gender === 'male' ? 'Male' : 'Female') : 'Not added'} last />
      </Section>

      <Section title="Business overview">
        <Row icon="domain" label="Account type" value="Property Owner" />
        <Row
          icon="apartment"
          label="Properties managed"
          value={businessValue}
          onPress={() => router.navigate('/owner/properties')}
          trailing={<Text style={styles.link}>View</Text>}
        />
        <Row icon="calendar-today" label="Member since" value={since ?? 'Unavailable'} last />
      </Section>

      <Section title="Account & security">
        <Row icon="lock-reset" label="Password & Security" value="Send a password reset link to your email" onPress={changePassword} />
        <Row icon="tune" label="Account Settings" value="Not available yet" disabled last />
      </Section>

      <AppButton variant="secondary" icon="logout" label={signingOut ? 'Logging out…' : 'Log out'} disabled={signingOut} onPress={logOut} />

      <View style={styles.footer}>
        <HostellLogo />
      </View>

      {editing ? (
        <EditProfileSheet
          initial={{ displayName: name ?? '', phone: data.phone ?? '' }}
          email={email}
          busy={save.isPending}
          submitError={save.isError ? 'Could not save your profile. Check your connection and try again.' : null}
          onSubmit={(input) => save.mutate(input, { onSuccess: () => { setEditing(false); setNotice('Profile updated.'); } })}
          onClose={() => setEditing(false)}
        />
      ) : null}
      {dialog}
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

function Row({ icon, label, value, trailing, onPress, disabled, last }: { icon: IconName; label: string; value: string; trailing?: ReactNode; onPress?: () => void; disabled?: boolean; last?: boolean }) {
  const body = (
    <>
      <View style={styles.rowIcon}>
        <MaterialIcons name={icon} size={20} color={BrandColors.textPrimary} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
      {trailing}
      {onPress && !trailing ? <MaterialIcons name="chevron-right" size={20} color={BrandColors.textSecondary} /> : null}
    </>
  );
  const rowStyle = [styles.row, !last && styles.rowDivider, disabled && styles.dim];
  return onPress ? (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} onPress={onPress} style={({ pressed }) => [...rowStyle, pressed && styles.pressed]}>
      {body}
    </Pressable>
  ) : (
    <View style={rowStyle} accessibilityState={{ disabled: !!disabled }}>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 16 },
  flex: { flex: 1, minWidth: 0 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  selfStart: { alignSelf: 'flex-start' },
  center: { alignItems: 'center', gap: 8, paddingVertical: 40 },
  muted: { fontSize: 12, color: BrandColors.textSecondary },
  dim: { opacity: 0.55 },
  pressed: { opacity: 0.85 },
  notice: { padding: 12, borderRadius: 12, backgroundColor: '#E8F0EE' },
  noticeText: { fontSize: 13, fontWeight: '600', color: BrandColors.textPrimary },
  card: { gap: 12, padding: 16, borderRadius: 16, backgroundColor: BrandColors.surface, borderWidth: 1, borderColor: BrandColors.border },
  heading: { fontSize: 16, fontWeight: '800', color: BrandColors.textPrimary },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F0EE' },
  avatarText: { fontSize: 22, fontWeight: '800', color: BrandColors.textPrimary },
  name: { fontSize: 18, fontWeight: '800', color: BrandColors.textPrimary },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  badgeOn: { backgroundColor: '#E8F0EE' },
  badgeOff: { backgroundColor: BrandColors.canvas },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', color: BrandColors.textSecondary },
  section: { gap: 8 },
  sectionLabel: { paddingHorizontal: 4, fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: BrandColors.textSecondary },
  rows: { borderRadius: 16, backgroundColor: BrandColors.surface, borderWidth: 1, borderColor: BrandColors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BrandColors.border },
  rowIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: BrandColors.canvas },
  rowLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: BrandColors.textSecondary },
  rowValue: { marginTop: 2, fontSize: 14, fontWeight: '600', color: BrandColors.textPrimary },
  link: { fontSize: 13, fontWeight: '700', color: BrandColors.accent },
  footer: { alignItems: 'center', paddingVertical: 8 },
});
