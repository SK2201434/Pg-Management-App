import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandColors } from '@/constants/theme';
import type { NavItem } from '@/features/navigation/navigationConfig';

const BAR_HEIGHT = 64;
const ICON_SIZE = 24;

type BottomNavigationProps = BottomTabBarProps & { items: readonly NavItem[] };

// One bottom bar for every role: `items` (see navigationConfig) decide what it shows. It is used
// as the `tabBar` of a role's Tabs layout, so React Navigation owns active state, tab-press
// handling (no duplicate pushes on the active tab) and the Android back behavior.
export function BottomNavigation({ state, navigation, items }: BottomNavigationProps) {
  const insets = useSafeAreaInsets();
  const activeRoute = state.routes[state.index];

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom, height: BAR_HEIGHT + insets.bottom }]}>
      {items.map((item) => {
        const route = state.routes.find((r) => r.name === item.routeName);
        if (!route) return null;
        const focused = route.key === activeRoute.key;
        const color = focused ? BrandColors.accent : BrandColors.textSecondary;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
        };

        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: focused }}
            onPress={onPress}
            onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
            style={styles.item}>
            <MaterialIcons name={item.icon} size={ICON_SIZE} color={color} />
            <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.label, focused && styles.labelActive, { color }]}>
              {item.label}
            </Text>
            <View style={[styles.dot, focused && styles.dotActive]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: BrandColors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BrandColors.border,
    elevation: 8,
    shadowColor: BrandColors.textPrimary,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
  },
  item: {
    flex: 1,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    gap: 2,
  },
  label: { fontSize: 11, fontWeight: '400', maxWidth: '100%' },
  labelActive: { fontWeight: '700' },
  dot: { width: 6, height: 6, borderRadius: 999, overflow: 'hidden', backgroundColor: 'transparent' },
  dotActive: { backgroundColor: BrandColors.accent },
});
