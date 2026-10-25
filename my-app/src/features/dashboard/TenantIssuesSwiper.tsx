import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandColors } from '@/constants/theme';
import type { OwnerTenantRequest } from '@/features/notifications/notificationsModel';
import { STATUS_LABEL, categoryOf, formatSubmitted } from '@/features/requests/requestsModel';

const MAX_SLIDES = 5;
const GAP = 12;

/** Issues still being worked on (not resolved), newest first. A request whose server time has not arrived counts as newest. */
export const activeIssues = (items: readonly OwnerTenantRequest[]): OwnerTenantRequest[] =>
  items.filter((r) => r.status !== 'resolved').sort((a, b) => (b.createdMs ?? Number.MAX_SAFE_INTEGER) - (a.createdMs ?? Number.MAX_SAFE_INTEGER));

// Owner Home's Tenant Issues: the issues tenants raised, as full-width cards the owner swipes through,
// with dots for position. Tapping one opens the issues page, with that issue first.
export function TenantIssuesSwiper({ items, names, showProperty }: { items: readonly OwnerTenantRequest[]; names: ReadonlyMap<string, string>; showProperty: boolean }) {
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const slides = items.slice(0, MAX_SLIDES);
  const step = width + GAP;

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? (
        <FlatList
          horizontal
          data={slides}
          keyExtractor={(r) => `${r.propertyId}_${r.id}`}
          showsHorizontalScrollIndicator={false}
          snapToInterval={step}
          decelerationRate="fast"
          ItemSeparatorComponent={() => <View style={{ width: GAP }} />}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / step))}
          renderItem={({ item }) => (
            <View style={{ width }}>
              <Slide item={item} tenantName={names.get(item.tenantUid) ?? 'A tenant'} showProperty={showProperty} />
            </View>
          )}
        />
      ) : null}
      {slides.length > 1 ? (
        <View style={styles.dots} accessibilityLabel={`Issue ${index + 1} of ${slides.length}`}>
          {slides.map((r, i) => (
            <View key={`${r.propertyId}_${r.id}`} style={[styles.dot, i === index && styles.dotOn]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Slide({ item: r, tenantName, showProperty }: { item: OwnerTenantRequest; tenantName: string; showProperty: boolean }) {
  const category = categoryOf(r.category);
  const meta = [tenantName, showProperty ? r.propertyName : null, formatSubmitted(r.createdMs) ?? 'Submitting…'].filter(Boolean).join(' · ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${r.title}, ${STATUS_LABEL[r.status]}. ${meta}`}
      onPress={() => router.push({ pathname: '/owner/issues', params: { requestId: r.id } })}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.row}>
        <MaterialIcons name={category.icon} size={20} color={BrandColors.accent} />
        <View style={styles.flex}>
          <Text numberOfLines={1} style={styles.title}>{r.title}</Text>
          <Text numberOfLines={1} style={styles.muted}>{category.label} · {meta}</Text>
        </View>
        <Text style={styles.link}>{STATUS_LABEL[r.status]}</Text>
      </View>
      {r.description ? <Text numberOfLines={2} style={styles.muted}>{r.description}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, padding: 16, borderRadius: 16, backgroundColor: BrandColors.surface, borderWidth: 1, borderColor: BrandColors.border },
  pressed: { opacity: 0.9 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1, minWidth: 0 },
  title: { fontSize: 14, fontWeight: '700', color: BrandColors.textPrimary },
  muted: { fontSize: 13, lineHeight: 19, color: BrandColors.textSecondary },
  link: { fontSize: 14, fontWeight: '700', color: BrandColors.accent },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: BrandColors.border },
  dotOn: { width: 18, backgroundColor: BrandColors.accent },
});
