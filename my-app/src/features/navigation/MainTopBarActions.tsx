import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, usePathname, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { BrandColors } from '@/constants/theme';
import { useProfileDisplayName } from '@/features/auth/useUserProfile';
import { TopBarIconButton, useReportProfileHighlight } from '@/features/navigation/AppTopBar';
import { NotificationBell } from '@/features/notifications/NotificationBell';

// Right-side actions of the top bar: the notifications bell (owner only; the tenant has no
// notifications yet, so theirs is disabled) and the profile button.
export function MainTopBarActions({ profileHref, notificationsHref }: { profileHref: Href; notificationsHref?: Href | null }) {
  const name = useProfileDisplayName();
  const initial = name?.charAt(0).toUpperCase();
  // The button turns sage green while pressed and while its own page is open.
  const onProfilePage = usePathname() === profileHref;
  const [held, setHeld] = useState(false);
  const report = useReportProfileHighlight();
  useEffect(() => {
    report(held || onProfilePage);
    return () => report(false);
  }, [held, onProfilePage, report]);
  return (
    <>
      {notificationsHref ? (
        <NotificationBell href={notificationsHref} />
      ) : (
        <TopBarIconButton icon="notifications-none" label="Notifications (not available yet)" disabled />
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Profile"
        onPressIn={() => setHeld(true)}
        onPressOut={() => setHeld(false)}
        onPress={() => router.navigate(profileHref)}
        style={({ pressed }) => [styles.profile, (pressed || onProfilePage) && styles.profileActive]}>
        {({ pressed }) => {
          const active = pressed || onProfilePage;
          return initial ? (
            <Text style={[styles.initial, active && styles.initialActive]}>{initial}</Text>
          ) : (
            <MaterialIcons name="person" size={20} color={active ? BrandColors.surface : BrandColors.textPrimary} />
          );
        }}
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  profile: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BrandColors.canvas,
    borderWidth: 1,
    borderColor: BrandColors.border,
  },
  profileActive: { backgroundColor: BrandColors.accent, borderColor: BrandColors.accent },
  initialActive: { color: BrandColors.surface },
  initial: { fontSize: 16, fontWeight: '700', color: BrandColors.textPrimary },
});
