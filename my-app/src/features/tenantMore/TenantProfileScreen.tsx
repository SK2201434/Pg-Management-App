import { Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { BrandColors } from '@/constants/theme';
import { selectOwner } from '@/features/auth/ownerAuthSelectors';
import { EditProfileSheet } from '@/features/profile/EditProfileSheet';
import { formatMemberSince, initialsOf } from '@/features/profile/profileModel';
import { useAccountProfile, useSaveProfile } from '@/features/profile/useProfile';
import { useAppSelector } from '@/store/hooks';

// The tenant's own profile: users/{uid}. Name and phone can be edited (the only fields the rules
// allow); email, role and status cannot.
export function TenantProfileScreen() {
  const owner = useAppSelector(selectOwner);
  const profile = useAccountProfile();
  const save = useSaveProfile();
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const header = <Stack.Screen options={{ title: 'My Profile' }} />;

  if (profile.isPending) {
    return (
      <View style={[styles.screen, styles.center]}>
        {header}
        <ActivityIndicator color={BrandColors.accent} />
      </View>
    );
  }
  if (profile.isError) {
    return (
      <View style={[styles.screen, styles.center]}>
        {header}
        <Text style={styles.name}>Couldn’t load your profile</Text>
        <Text style={styles.muted}>Check your connection and try again.</Text>
        <AppButton label="Retry" onPress={() => profile.refetch()} />
      </View>
    );
  }

  const data = profile.data;
  const name = data.displayName ?? owner?.displayName ?? null;
  const email = data.email ?? owner?.email ?? null;
  const since = formatMemberSince(data.createdMs);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {header}
      <View style={[styles.card, styles.identity]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initialsOf(name)}</Text>
        </View>
        <Text style={styles.name}>{name ?? 'Your name is not set'}</Text>
        {since ? <Text style={styles.muted}>Member since {since}</Text> : null}
      </View>

      {notice ? (
        <View style={styles.notice} accessibilityRole="alert">
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Field label="Email" value={email ?? 'Not available'} />
        <Field label="Phone" value={data.phone ?? 'Not added'} />
        <Field label="Account" value="Tenant" />
      </View>

      <AppButton label="Edit profile" icon="edit" onPress={() => { save.reset(); setEditing(true); }} />

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
    </ScrollView>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BrandColors.canvas },
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  card: { gap: 12, padding: 16, borderRadius: 16, backgroundColor: BrandColors.surface, borderWidth: 1, borderColor: BrandColors.border },
  identity: { alignItems: 'center' },
  avatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F0EE' },
  avatarText: { fontSize: 24, fontWeight: '800', color: BrandColors.accent },
  name: { fontSize: 18, fontWeight: '800', color: BrandColors.textPrimary },
  muted: { fontSize: 13, color: BrandColors.textSecondary },
  notice: { padding: 12, borderRadius: 12, backgroundColor: '#E8F0EE' },
  noticeText: { fontSize: 13, fontWeight: '600', color: BrandColors.textPrimary },
  field: { gap: 2 },
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', color: BrandColors.textSecondary },
  value: { fontSize: 15, fontWeight: '600', color: BrandColors.textPrimary },
});
