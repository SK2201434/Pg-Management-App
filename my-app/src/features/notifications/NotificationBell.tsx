import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, usePathname, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { BrandColors } from '@/constants/theme';
import { useUnreadCount } from '@/features/notifications/useNotifications';

// The top bar's bell. A small sage dot at its upper-right corner shows while the owner has unread
// notifications; it hides itself when there are none, and updates the moment one is read.
export function NotificationBell({ href }: { href: Href }) {
  const unread = useUnreadCount();
  const hasUnread = unread > 0;
  // While the Notifications screen is open the bell sits on a sage green circle.
  const active = usePathname() === href;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={hasUnread ? `Notifications, ${unread} unread` : 'Notifications'}
      // Already on the Notifications screen: tapping the bell does nothing (no second copy is opened).
      onPress={() => {
        if (!active) router.push(href);
      }}
      style={[styles.button, active && styles.buttonActive]}>
      <MaterialIcons name={hasUnread ? 'notifications' : 'notifications-none'} size={22} color={active ? BrandColors.surface : BrandColors.textPrimary} />
      {hasUnread ? <View style={[styles.dot, active && styles.dotActive]} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  buttonActive: { backgroundColor: BrandColors.accent },
  // Over the bell's top-right corner; it does not affect the layout of the bar.
  dot: { position: 'absolute', top: 10, right: 11, width: 10, height: 10, borderRadius: 5, backgroundColor: BrandColors.accent, borderWidth: 2, borderColor: BrandColors.surface },
  // On the green circle the dot turns white so it stays visible.
  dotActive: { backgroundColor: BrandColors.surface, borderColor: BrandColors.accent },
});
