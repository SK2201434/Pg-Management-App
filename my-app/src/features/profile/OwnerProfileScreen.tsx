import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppScrollView } from '@/components/app-scroll-view';
import { BrandColors } from '@/constants/theme';
import { ProfileTab } from '@/features/profile/ProfileTab';
import { ReferTab } from '@/features/referral/ReferTab';

const TABS = [
  { key: 'profile', label: 'My Profile' },
  { key: 'refer', label: 'Refer & Earn' },
] as const;

// The owner's profile page: a nested route (back arrow, no bottom navigation) with two tabs.
// Switching tabs is local state, so nothing about the signed-in user or selected property is reset.
export function OwnerProfileScreen() {
  // `?tab=refer` (from the More menu) opens on Refer & Earn; anything else on My Profile.
  const { tab: requested } = useLocalSearchParams<{ tab?: string | string[] }>();
  const first = Array.isArray(requested) ? requested[0] : requested;
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>(first === 'refer' ? 'refer' : 'profile');
  return (
    <AppScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'My Profile' }} />
      <View style={styles.tabs} accessibilityRole="tablist">
        {TABS.map((t) => (
          <Pressable
            key={t.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t.key }}
            onPress={() => setTab(t.key)}
            style={[styles.tab, tab === t.key && styles.tabOn]}>
            <Text style={[styles.tabText, tab === t.key && styles.tabTextOn]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
      {tab === 'profile' ? <ProfileTab /> : <ReferTab />}
    </AppScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BrandColors.canvas },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  tabs: { flexDirection: 'row', padding: 4, borderRadius: 999, backgroundColor: '#E8EEEC' },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 999 },
  tabOn: { backgroundColor: BrandColors.accent },
  tabText: { fontSize: 13, fontWeight: '700', color: BrandColors.textSecondary },
  tabTextOn: { color: BrandColors.surface },
});
