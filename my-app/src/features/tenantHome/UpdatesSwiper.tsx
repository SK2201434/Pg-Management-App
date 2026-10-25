import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { BrandColors } from '@/constants/theme';
import { UpdateCard } from '@/features/tenantHome/UpdateCard';
import { sortUpdates, type TenantUpdate } from '@/features/tenantHome/updatesModel';

const MAX_SLIDES = 5;
const GAP = 12;

// Home's Latest Updates: the newest few updates as full-width cards the tenant swipes through, with
// dots for position. "View All" (in the section header) opens the full list.
export function UpdatesSwiper({ items }: { items: readonly TenantUpdate[] }) {
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const [now] = useState(Date.now);
  const slides = sortUpdates(items).slice(0, MAX_SLIDES);
  const step = width + GAP;

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? (
        <FlatList
          horizontal
          data={slides}
          keyExtractor={(u) => u.id}
          showsHorizontalScrollIndicator={false}
          snapToInterval={step}
          decelerationRate="fast"
          ItemSeparatorComponent={() => <View style={{ width: GAP }} />}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / step))}
          renderItem={({ item }) => (
            <View style={{ width }}>
              <UpdateCard update={item} now={now} />
            </View>
          )}
        />
      ) : null}
      {slides.length > 1 ? (
        <View style={styles.dots} accessibilityLabel={`Update ${index + 1} of ${slides.length}`}>
          {slides.map((u, i) => (
            <View key={u.id} style={[styles.dot, i === index && styles.dotOn]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: BrandColors.border },
  dotOn: { width: 18, backgroundColor: BrandColors.accent },
});
