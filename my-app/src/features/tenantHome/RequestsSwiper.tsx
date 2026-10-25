import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandColors } from '@/constants/theme';
import { REQUEST_LABEL } from '@/features/discovery/discoveryModel';
import { STATUS_LABEL, categoryOf, formatSubmitted, type CombinedRequest } from '@/features/requests/requestsModel';

const MAX_SLIDES = 5;
const GAP = 12;

// Home's My Requests: stay requests and tickets together, the most recently changed first, as
// full-width cards the tenant swipes through, with dots for position. "View All" opens Requests.
export function RequestsSwiper({ items }: { items: readonly CombinedRequest[] }) {
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
          keyExtractor={(c) => c.key}
          showsHorizontalScrollIndicator={false}
          snapToInterval={step}
          decelerationRate="fast"
          ItemSeparatorComponent={() => <View style={{ width: GAP }} />}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / step))}
          renderItem={({ item }) => (
            <View style={{ width }}>
              <Slide item={item} />
            </View>
          )}
        />
      ) : null}
      {slides.length > 1 ? (
        <View style={styles.dots} accessibilityLabel={`Request ${index + 1} of ${slides.length}`}>
          {slides.map((c, i) => (
            <View key={c.key} style={[styles.dot, i === index && styles.dotOn]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Slide({ item }: { item: CombinedRequest }) {
  if (item.kind === 'stay') {
    const r = item.request;
    return (
      <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/tenant/discover/[propertyId]', params: { propertyId: r.propertyId } })} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
        <View style={styles.row}>
          <View style={styles.flex}>
            <Text numberOfLines={1} style={styles.title}>Stay request{r.propertyName ? ` · ${r.propertyName}` : ''}</Text>
            <Text style={styles.muted}>{formatSubmitted(r.updatedMs ?? r.createdMs) ?? 'Sending…'}</Text>
          </View>
          <Text style={styles.link}>{REQUEST_LABEL[r.status]}</Text>
        </View>
        {r.message ? <Text numberOfLines={2} style={styles.muted}>Your message: {r.message}</Text> : null}
      </Pressable>
    );
  }
  const r = item.request;
  const category = categoryOf(r.category);
  return (
    <Pressable accessibilityRole="button" onPress={() => router.navigate('/tenant/requests')} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.row}>
        <MaterialIcons name={category.icon} size={20} color={BrandColors.accent} />
        <View style={styles.flex}>
          <Text numberOfLines={1} style={styles.title}>{r.title}</Text>
          <Text style={styles.muted}>{category.label} · {formatSubmitted(r.createdMs) ?? 'Submitting…'}</Text>
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
