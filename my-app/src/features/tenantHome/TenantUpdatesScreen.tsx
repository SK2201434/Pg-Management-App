import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BrandColors } from '@/constants/theme';
import { UpdateCard } from '@/features/tenantHome/UpdateCard';
import { useTenantStay } from '@/features/tenantHome/useTenantStay';
import { useTenantUpdates } from '@/features/tenantHome/useTenantUpdates';
import {
  ACCESS_MESSAGE,
  UPDATE_FILTERS,
  countByFilter,
  filterUpdates,
  sortUpdates,
  unreadCount,
  type UpdateFilter,
} from '@/features/tenantHome/updatesModel';

// Latest Updates: a nested tenant page. The title and second line go through the shared header's
// supported options (`title`, string `headerTitle`); the header itself is not changed.
export function TenantUpdatesScreen() {
  const stay = useTenantStay();
  const updates = useTenantUpdates(stay.data);
  const [filter, setFilter] = useState<UpdateFilter>('all');
  const [now] = useState(Date.now);

  const header = <Stack.Screen options={{ title: 'Latest Updates', headerTitle: 'Notices from your property' }} />;

  if (stay.isPending) {
    return (
      <View style={[styles.screen, styles.center]}>
        {header}
        <ActivityIndicator color={BrandColors.accent} />
      </View>
    );
  }
  if (stay.isError || !stay.data) {
    return (
      <View style={[styles.screen, styles.center]}>
        {header}
        <Text style={styles.title}>Could not load your updates</Text>
        <Text style={styles.muted}>Check your connection and try again.</Text>
        <Pressable accessibilityRole="button" onPress={() => stay.refetch()} style={({ pressed }) => pressed && styles.pressed}>
          <Text style={styles.link}>Retry</Text>
        </Pressable>
      </View>
    );
  }
  const active = stay.data.state === 'active' ? stay.data : null;
  const all = sortUpdates(updates.items);
  // With nothing to list, say why: no stay, or the stay window is closed. Owners' decisions on stay
  // requests are listed even without a stay.
  if (all.length === 0 && active === null) {
    return (
      <View style={[styles.screen, styles.center]}>
        {header}
        <Text style={styles.title}>No updates yet</Text>
        <Text style={styles.mutedCenter}>Updates from your property, and owners’ answers to your stay requests, will appear here.</Text>
      </View>
    );
  }
  if (all.length === 0 && (updates.access === 'before' || updates.access === 'after')) {
    return (
      <View style={[styles.screen, styles.center]}>
        {header}
        <Text style={styles.title}>Updates unavailable</Text>
        <Text style={styles.mutedCenter}>{ACCESS_MESSAGE[updates.access]}</Text>
      </View>
    );
  }

  const shown = filterUpdates(all, filter);
  const unread = unreadCount(all);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={stay.isRefetching} onRefresh={() => void stay.refetch()} tintColor={BrandColors.accent} colors={[BrandColors.accent]} />}>
      {header}

      {active ? (
        <View style={styles.banner}>
          <View style={styles.iconBox}>
            <MaterialIcons name="apartment" size={20} color={BrandColors.accent} />
          </View>
          <View style={styles.flex}>
            <Text numberOfLines={1} style={styles.title}>{active.propertyName}</Text>
            <Text style={styles.muted}>Current residence</Text>
          </View>
        </View>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills}>
        {UPDATE_FILTERS.map((f) => {
          const selected = f.key === filter;
          const count = countByFilter(all, f.key);
          return (
            <Pressable
              key={f.key}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${f.label}, ${count}`}
              onPress={() => setFilter(f.key)}
              style={[styles.pill, selected && styles.pillOn]}>
              <Text style={[styles.pillText, selected && styles.pillTextOn]}>{f.label}</Text>
              <Text style={[styles.pillCount, selected && styles.pillTextOn]}>{count}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.headingRow}>
        <Text style={styles.heading}>Recent Bulletins ({all.length} total)</Text>
        {unread > 0 ? (
          <View style={styles.newBadge}>
            <Text style={styles.newBadgeText}>{unread} New</Text>
          </View>
        ) : null}
      </View>

      {shown.length === 0 ? (
        <View style={styles.empty}>
          <MaterialIcons name="campaign" size={28} color={BrandColors.textSecondary} />
          <Text style={styles.rowTitle}>{all.length === 0 ? 'No updates yet' : 'No updates in this category'}</Text>
          <Text style={styles.mutedCenter}>
            {all.length === 0 ? 'Notices from your property will appear here once they are published.' : 'Try another category.'}
          </Text>
        </View>
      ) : (
        shown.map((u) => <UpdateCard key={u.id} update={u} now={now} />)
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BrandColors.canvas },
  content: { padding: 16, gap: 14, paddingBottom: 32 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  spread: { justifyContent: 'space-between' },
  pressed: { opacity: 0.85 },
  title: { fontSize: 16, fontWeight: '800', color: BrandColors.textPrimary },
  rowTitle: { fontSize: 15, fontWeight: '700', color: BrandColors.textPrimary },
  muted: { fontSize: 13, lineHeight: 19, color: BrandColors.textSecondary },
  mutedCenter: { fontSize: 13, lineHeight: 19, textAlign: 'center', color: BrandColors.textSecondary },
  link: { fontSize: 14, fontWeight: '700', color: BrandColors.accent },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F0EE' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, backgroundColor: BrandColors.surface, borderWidth: 1, borderColor: BrandColors.border },
  pills: { gap: 8, paddingVertical: 2 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: BrandColors.surface, borderWidth: 1, borderColor: BrandColors.border },
  pillOn: { backgroundColor: BrandColors.accent, borderColor: BrandColors.accent },
  pillText: { fontSize: 13, fontWeight: '600', color: BrandColors.textSecondary },
  pillCount: { fontSize: 11, fontWeight: '700', color: BrandColors.textSecondary },
  pillTextOn: { color: BrandColors.surface },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  heading: { fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: BrandColors.textPrimary },
  newBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: '#E8F0EE' },
  newBadgeText: { fontSize: 12, fontWeight: '700', color: BrandColors.accent },
  empty: { alignItems: 'center', gap: 6, padding: 28, borderRadius: 16, backgroundColor: BrandColors.surface, borderWidth: 1, borderColor: BrandColors.border },
});
