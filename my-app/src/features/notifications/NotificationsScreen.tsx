import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, Stack } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { BrandColors } from '@/constants/theme';
import { TopBarIconButton } from '@/features/navigation/AppTopBar';
import { formatWhen, type NotificationKind } from '@/features/notifications/notificationsModel';
import { useNotifications, type NotificationItem } from '@/features/notifications/useNotifications';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

const ICON: Record<NotificationKind, { icon: IconName; color: string; tint: string }> = {
  'rent-overdue': { icon: 'error-outline', color: BrandColors.error, tint: BrandColors.errorTint },
  'rent-due-today': { icon: 'schedule', color: '#9E7231', tint: '#FDF7EB' },
  'payment-recorded': { icon: 'check-circle', color: BrandColors.accent, tint: '#E8F0EE' },
};

// Notifications: rent due and overdue, and payments recorded. They are derived from the owner's own rent
// records (so the same event is never listed twice) and only their read marks are stored. Tenant issues
// and join requests have no data in the app yet, so there is nothing to list for them and no
// Approve/Decline: that workflow does not exist.
export function NotificationsScreen() {
  const n = useNotifications();
  const [now] = useState(Date.now);

  const open = (item: NotificationItem) => {
    n.markRead([item.id]);
    router.push({ pathname: '/owner/tenants/[tenantId]', params: { tenantId: item.tenantUid, propertyId: item.propertyId } });
  };

  const header = (
    <Stack.Screen
      options={{
        title: 'Notifications',
        headerTitle: n.unread > 0 ? `${n.unread} unread` : '',
        headerRight: () => <TopBarIconButton icon="done-all" label="Mark all as read" disabled={n.unread === 0} onPress={n.markAllRead} />,
      }}
    />
  );

  if (n.isPending) {
    return (
      <View style={[styles.screen, styles.center]}>
        {header}
        <ActivityIndicator color={BrandColors.accent} />
        <Text style={styles.muted}>Loading notifications…</Text>
      </View>
    );
  }
  if (n.isError || n.items === null) {
    return (
      <View style={[styles.screen, styles.center]}>
        {header}
        <MaterialIcons name="error-outline" size={28} color={BrandColors.textSecondary} />
        <Text style={styles.title}>Couldn’t load notifications</Text>
        <Text style={styles.muted}>Check your connection and try again.</Text>
        <AppButton label="Retry" onPress={n.retry} style={styles.retry} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {header}
      <FlatList
        data={n.items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={Separator}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <MaterialIcons name="notifications-none" size={28} color={BrandColors.textSecondary} />
            </View>
            <Text style={styles.title}>You’re all caught up</Text>
            <Text style={styles.emptyText}>Rent that is due or overdue, and payments you record, will appear here.</Text>
          </View>
        }
        renderItem={({ item }) => <Card item={item} now={now} onPress={() => open(item)} />}
      />
    </View>
  );
}

const Separator = () => <View style={styles.separator} />;

function Card({ item, now, onPress }: { item: NotificationItem; now: number; onPress: () => void }) {
  const look = ICON[item.kind];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.read ? '' : 'Unread. '}${item.title}. ${item.body}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, item.read ? styles.read : styles.unread, pressed && styles.pressed]}>
      <View style={[styles.iconWrap, { backgroundColor: look.tint }]}>
        <MaterialIcons name={look.icon} size={20} color={look.color} />
      </View>
      <View style={styles.flex}>
        <View style={styles.titleRow}>
          <Text style={[styles.cardTitle, !item.read && styles.cardTitleUnread]}>{item.title}</Text>
          {!item.read ? <View style={styles.dot} accessibilityLabel="Unread" /> : null}
        </View>
        <Text style={styles.body}>{item.body}</Text>
        <Text numberOfLines={1} style={styles.meta}>
          {[item.propertyName, formatWhen(item.atMs, now)].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <MaterialIcons name="chevron-right" size={20} color={BrandColors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BrandColors.canvas },
  flex: { flex: 1, minWidth: 0 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  content: { padding: 16, paddingBottom: 32, flexGrow: 1 },
  separator: { height: 10 },
  muted: { fontSize: 13, color: BrandColors.textSecondary },
  title: { fontSize: 17, fontWeight: '800', color: BrandColors.textPrimary },
  retry: { alignSelf: 'stretch', marginTop: 8 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 56, paddingHorizontal: 24 },
  emptyIcon: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: BrandColors.surface, borderWidth: 1, borderColor: BrandColors.border },
  emptyText: { textAlign: 'center', fontSize: 13, lineHeight: 19, color: BrandColors.textSecondary },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1 },
  // Unread: a soft mint tint and a dot; read: plain white.
  unread: { backgroundColor: '#E3EEEA', borderColor: '#CFE0DA' },
  read: { backgroundColor: BrandColors.surface, borderColor: BrandColors.border },
  pressed: { opacity: 0.85 },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: BrandColors.textPrimary },
  cardTitleUnread: { fontWeight: '800' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: BrandColors.accent },
  body: { marginTop: 2, fontSize: 13, lineHeight: 18, color: BrandColors.textPrimary },
  meta: { marginTop: 4, fontSize: 11, color: BrandColors.textSecondary },
});
