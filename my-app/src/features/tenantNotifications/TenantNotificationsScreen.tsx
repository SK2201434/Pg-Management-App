import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, Stack } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { BrandColors } from '@/constants/theme';
import { TopBarIconButton } from '@/features/navigation/AppTopBar';
import { formatWhen } from '@/features/notifications/notificationsModel';
import type { TenantNotificationKind } from '@/features/tenantNotifications/tenantNotificationsModel';
import { useTenantNotifications, type TenantNotificationItem } from '@/features/tenantNotifications/useTenantNotifications';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

const ICON: Record<TenantNotificationKind, { icon: IconName; color: string; tint: string }> = {
  'request-open': { icon: 'inbox', color: '#9E7231', tint: '#FDF7EB' },
  'request-in-progress': { icon: 'build', color: BrandColors.accent, tint: '#E8F0EE' },
  'request-resolved': { icon: 'check-circle', color: '#38775B', tint: '#EDF6F1' },
  announcement: { icon: 'campaign', color: BrandColors.accent, tint: '#E8F0EE' },
  'announcement-important': { icon: 'priority-high', color: BrandColors.error, tint: BrandColors.errorTint },
  'stay-approved': { icon: 'how-to-reg', color: '#38775B', tint: '#EDF6F1' },
  'stay-declined': { icon: 'person-off', color: BrandColors.textSecondary, tint: '#F1F1EC' },
  'stay-change': { icon: 'swap-horiz', color: BrandColors.accent, tint: '#E8F0EE' },
  'stay-changed': { icon: 'bed', color: '#38775B', tint: '#EDF6F1' },
  'rent-reminder': { icon: 'payments', color: '#9E7231', tint: '#FDF7EB' },
  'stay-confirmation': { icon: 'hourglass-top', color: '#9E7231', tint: '#FDF7EB' },
};

// The tenant's notifications: updates on their own requests and announcements from their property.
// They are derived from those records (so one event is never listed twice) and only the tenant's own
// read marks are stored. Rent alerts are not included: tenants cannot read rent records and there is
// no owner-send flow yet.
export function TenantNotificationsScreen() {
  const n = useTenantNotifications();
  const [now] = useState(Date.now);

  const open = (item: TenantNotificationItem) => {
    n.markRead([item.id]);
    if (item.target === 'property') router.push({ pathname: '/tenant/discover/[propertyId]', params: { propertyId: item.propertyId } });
    else router.push(item.target === 'requests' ? '/tenant/requests' : item.target === 'stay' ? '/tenant/my-stay' : '/tenant/updates');
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
            <Text style={styles.title}>No notifications yet</Text>
            <Text style={styles.emptyText}>Updates about your requests and property announcements will appear here.</Text>
          </View>
        }
        renderItem={({ item }) => <Card item={item} now={now} onPress={() => open(item)} />}
      />
    </View>
  );
}

const Separator = () => <View style={styles.separator} />;

function Card({ item, now, onPress }: { item: TenantNotificationItem; now: number; onPress: () => void }) {
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
          <Text numberOfLines={1} style={[styles.cardTitle, !item.read && styles.cardTitleUnread]}>{item.title}</Text>
          {!item.read ? <View style={styles.dot} accessibilityLabel="Unread" /> : null}
        </View>
        <Text numberOfLines={3} style={styles.body}>{item.body}</Text>
        <Text numberOfLines={1} style={styles.meta}>
          {[item.propertyName, item.atMs === null ? 'Just now' : formatWhen(item.atMs, now)].filter(Boolean).join(' · ')}
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
  unread: { backgroundColor: '#E3EEEA', borderColor: '#CFE0DA' },
  read: { backgroundColor: BrandColors.surface, borderColor: BrandColors.border },
  pressed: { opacity: 0.85 },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { flexShrink: 1, fontSize: 14, fontWeight: '700', color: BrandColors.textPrimary },
  cardTitleUnread: { fontWeight: '800' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: BrandColors.accent },
  body: { marginTop: 2, fontSize: 13, lineHeight: 18, color: BrandColors.textPrimary },
  meta: { marginTop: 4, fontSize: 11, color: BrandColors.textSecondary },
});
