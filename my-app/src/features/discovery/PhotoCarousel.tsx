import { useState } from 'react';
import { FlatList, Image, StyleSheet, Text, View } from 'react-native';

import { BrandColors } from '@/constants/theme';

const HEIGHT = 220;

// A swipeable gallery that stops at the first and last photo (no looping, no overscroll bounce).
// With one photo it is just the photo; with none it renders nothing.
export function PhotoCarousel({ urls }: { urls: readonly string[] }) {
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  if (urls.length === 0) return null;

  return (
    <View style={styles.frame} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? (
        <FlatList
          horizontal
          pagingEnabled
          bounces={false}
          overScrollMode="never"
          showsHorizontalScrollIndicator={false}
          data={urls}
          keyExtractor={(u) => u}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onMomentumScrollEnd={(e) => setIndex(Math.min(urls.length - 1, Math.max(0, Math.round(e.nativeEvent.contentOffset.x / width))))}
          renderItem={({ item, index: i }) => (
            <Image source={{ uri: item }} style={{ width, height: HEIGHT }} resizeMode="cover" accessibilityLabel={`Photo ${i + 1} of ${urls.length}`} />
          )}
        />
      ) : null}
      {urls.length > 1 ? (
        <>
          <View style={styles.counter} accessibilityElementsHidden>
            <Text style={styles.counterText}>{index + 1} / {urls.length}</Text>
          </View>
          <View style={styles.dots} accessibilityElementsHidden>
            {urls.map((u, i) => (
              <View key={u} style={[styles.dot, i === index && styles.dotOn]} />
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { height: HEIGHT, borderRadius: 16, overflow: 'hidden', backgroundColor: BrandColors.surface },
  counter: { position: 'absolute', top: 10, right: 10, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(32, 42, 43, 0.65)' },
  counterText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  dots: { position: 'absolute', bottom: 10, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255, 255, 255, 0.6)' },
  dotOn: { width: 18, backgroundColor: '#FFFFFF' },
});
