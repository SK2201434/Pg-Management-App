import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { BrandColors } from '@/constants/theme';
import { addressOf, filterListings, formatRentRange, mergePages, shouldLoadMoreForSearch, sharingLabel, type Listing } from '@/features/discovery/discoveryModel';
import { classifyLoadError, FAILURE_TEXT } from '@/features/discovery/loadError';
import { useSearchState } from '@/features/discovery/searchStore';
import { useDebounced, useListings } from '@/features/discovery/useDiscovery';
import { useTenantStay } from '@/features/tenantHome/useTenantStay';

// Property discovery: the properties owners have chosen to list publicly. One bounded read; the
// search field in the top bar filters those in memory (debounced), by name, city or area.
export function DiscoverScreen() {
  const listings = useListings();
  const stay = useTenantStay();
  const { query } = useSearchState();
  const search = useDebounced(query);
  const currentId = stay.data?.state === 'active' ? stay.data.propertyId : null;
  const all = useMemo(() => mergePages(listings.data?.pages ?? []), [listings.data]);
  const shown = useMemo(() => filterListings(all, search), [all, search]);
  const searching = search.trim() !== '';
  const { hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } = listings;
  const pagesLoaded = listings.data?.pages.length ?? 0;

  // A search can only match what is loaded, so keep loading pages (bounded) while one is typed.
  useEffect(() => {
    if (shouldLoadMoreForSearch({ searching, hasNextPage, busy: isFetchingNextPage, failed: isFetchNextPageError, pagesLoaded })) void fetchNextPage();
  }, [searching, hasNextPage, isFetchingNextPage, isFetchNextPageError, pagesLoaded, fetchNextPage]);
  // Coming back to this screen (e.g. from a listing) re-reads the list; the first focus is the mount fetch.
  const focused = useRef(false);
  const { refetch } = listings;
  useFocusEffect(
    useCallback(() => {
      if (focused.current) void refetch();
      focused.current = true;
    }, [refetch]),
  );
  const header = <Stack.Screen options={{ title: 'Find a place' }} />;

  if (listings.isPending) {
    return (
      <View style={[styles.screen, styles.center]}>
        {header}
        <ActivityIndicator color={BrandColors.accent} />
      </View>
    );
  }
  if (listings.isError) {
    const failure = classifyLoadError(listings.error);
    return (
      <View style={[styles.screen, styles.center]}>
        {header}
        <MaterialIcons name="error-outline" size={28} color={BrandColors.textSecondary} />
        <Text style={styles.title}>{FAILURE_TEXT[failure].title}</Text>
        <Text style={styles.mutedCenter}>{FAILURE_TEXT[failure].body}</Text>
        <AppButton label="Retry" onPress={() => listings.refetch()} style={styles.retry} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {header}
      <FlatList
        data={shown}
        keyExtractor={(l) => l.id}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={Separator}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage && !isFetchNextPageError) void fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        refreshControl={<RefreshControl refreshing={listings.isRefetching} onRefresh={() => void listings.refetch()} tintColor={BrandColors.accent} colors={[BrandColors.accent]} />}
        ListHeaderComponent={
          <Text style={styles.intro}>
            {searching ? `${shown.length} ${shown.length === 1 ? 'result' : 'results'} for “${search.trim()}”` : 'Hostels and PGs listed by their owners. Search by name, city or area.'}
          </Text>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialIcons name={searching ? 'search-off' : 'apartment'} size={32} color={BrandColors.textSecondary} />
            <Text style={styles.title}>{searching ? 'No matching properties' : 'No properties listed yet'}</Text>
            <Text style={styles.emptyText}>{searching ? 'Try a different name, city or area.' : 'Properties appear here once their owners publish them.'}</Text>
          </View>
        }
        ListFooterComponent={
          isFetchingNextPage ? (
            <ActivityIndicator color={BrandColors.accent} style={styles.footer} />
          ) : isFetchNextPageError ? (
            <View style={styles.footer}>
              <Text style={styles.muted}>Couldn’t load more properties.</Text>
              <AppButton label="Try again" variant="secondary" size="sm" onPress={() => fetchNextPage()} />
            </View>
          ) : undefined
        }
        renderItem={({ item }) => <ListingCard listing={item} current={item.id === currentId} />}
      />
    </View>
  );
}

const Separator = () => <View style={styles.separator} />;

function ListingCard({ listing, current }: { listing: Listing; current: boolean }) {
  const rent = formatRentRange(listing.rentMinInr, listing.rentMaxInr);
  const address = addressOf(listing);
  const rooms = [...listing.sharingOptions].sort((x, y) => x - y);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${listing.name}${address ? `, ${address}` : ''}`}
      onPress={() => router.push({ pathname: '/tenant/discover/[propertyId]', params: { propertyId: listing.id } })}
      style={({ pressed }) => [styles.card, current && styles.cardCurrent, pressed && styles.pressed]}>
      <View style={styles.photo}>
        {listing.coverUrl ? (
          <Image source={{ uri: listing.coverUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
        ) : (
          <View style={styles.noPhoto}>
            <MaterialIcons name="apartment" size={32} color={BrandColors.textSecondary} />
          </View>
        )}
      </View>
      <View style={styles.details}>
        <View style={styles.titleRow}>
          <Text numberOfLines={2} style={[styles.title, styles.flex]}>{listing.name}</Text>
          {current ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Your stay</Text>
            </View>
          ) : null}
        </View>
        {address ? (
          <View style={styles.row}>
            <MaterialIcons name="location-on" size={16} color={BrandColors.textSecondary} />
            <Text numberOfLines={2} style={[styles.muted, styles.flex]}>{address}</Text>
          </View>
        ) : null}
        {rooms.length > 0 ? (
          <View style={styles.chips} accessibilityLabel={`Rooms: ${rooms.map(sharingLabel).join(', ')}`}>
            {rooms.map((n) => (
              <View key={n} style={styles.chip}>
                <Text style={styles.chipText}>{sharingLabel(n)}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {rent ? <Text style={styles.rent}>{rent}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BrandColors.canvas },
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  content: { padding: 16, paddingBottom: 32, flexGrow: 1 },
  separator: { height: 12 },
  intro: { marginBottom: 12, fontSize: 13, lineHeight: 19, color: BrandColors.textSecondary },
  title: { fontSize: 16, fontWeight: '800', color: BrandColors.textPrimary },
  muted: { fontSize: 13, color: BrandColors.textSecondary },
  mutedCenter: { textAlign: 'center', fontSize: 13, lineHeight: 19, color: BrandColors.textSecondary },
  retry: { alignSelf: 'stretch', marginTop: 8 },
  footer: { alignItems: 'center', gap: 8, paddingVertical: 16 },
  pressed: { opacity: 0.9 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 56, paddingHorizontal: 24 },
  emptyText: { textAlign: 'center', fontSize: 13, lineHeight: 19, color: BrandColors.textSecondary },
  card: { flexDirection: 'row', overflow: 'hidden', borderRadius: 16, backgroundColor: BrandColors.surface, borderWidth: 1, borderColor: BrandColors.border },
  cardCurrent: { borderColor: BrandColors.accent, borderWidth: 2 },
  photo: { width: '38%', minHeight: 150, backgroundColor: BrandColors.canvas },
  noPhoto: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  details: { flex: 1, minWidth: 0, gap: 8, padding: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: '#E8F0EE' },
  chipText: { fontSize: 11, fontWeight: '700', color: BrandColors.accent },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: '#E8F0EE' },
  badgeText: { fontSize: 11, fontWeight: '800', color: BrandColors.accent },
  rent: { fontSize: 14, fontWeight: '700', color: BrandColors.textPrimary },
});
