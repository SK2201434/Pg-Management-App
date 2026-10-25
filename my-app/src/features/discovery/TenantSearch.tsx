import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { BrandColors } from '@/constants/theme';
import { TopBarIconButton } from '@/features/navigation/AppTopBar';
import { closeSearch, openSearch, setSearchQuery, useSearchState } from '@/features/discovery/searchStore';

export const DISCOVER_PATH = '/tenant/discover';

/** The magnifier in the tenant top bar. It opens the search field and the discovery screen. */
export function TenantSearchButton() {
  const { active } = useSearchState();
  const pathname = usePathname();
  // While the field is open on the discovery screen its own close button takes over.
  if (active && pathname === DISCOVER_PATH) return null;
  return (
    <TopBarIconButton
      icon="search"
      label="Search properties"
      onPress={() => {
        openSearch();
        if (pathname !== DISCOVER_PATH) router.push(DISCOVER_PATH);
      }}
    />
  );
}

/** The expanded field that replaces the title in the top bar; closing it restores the normal bar. */
export function TenantSearchField() {
  const { query } = useSearchState();
  const input = useRef<TextInput>(null);
  useEffect(() => {
    input.current?.focus();
  }, []);

  const close = () => {
    closeSearch();
    if (router.canGoBack()) router.back();
  };

  return (
    <View style={styles.field}>
      <MaterialIcons name="search" size={20} color={BrandColors.textSecondary} />
      <TextInput
        ref={input}
        accessibilityLabel="Search properties"
        value={query}
        onChangeText={setSearchQuery}
        placeholder="Name, city or area"
        placeholderTextColor={BrandColors.textSecondary}
        returnKeyType="search"
        autoCorrect={false}
        maxLength={60}
        style={styles.input}
      />
      <Pressable accessibilityRole="button" accessibilityLabel="Close search" hitSlop={10} onPress={close}>
        <MaterialIcons name="close" size={20} color={BrandColors.textPrimary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: 40, paddingHorizontal: 12, borderRadius: 20, backgroundColor: BrandColors.canvas, borderWidth: 1, borderColor: BrandColors.border },
  input: { flex: 1, paddingVertical: 0, fontSize: 14, color: BrandColors.textPrimary },
});
