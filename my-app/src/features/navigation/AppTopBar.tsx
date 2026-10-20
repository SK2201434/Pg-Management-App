import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { createContext, useContext, useState, type ComponentProps, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandColors } from '@/constants/theme';

const BACK_ARROW = require('../../../assets/images/assets/Back-Arrow.svg');

type IconName = ComponentProps<typeof MaterialIcons>['name'];

/** Lets the profile button tell the bar it is highlighted (sage green), so the left icon drops its own fill. */
const ProfileHighlightContext = createContext<(active: boolean) => void>(() => {});
export const useReportProfileHighlight = () => useContext(ProfileHighlightContext);

export type AppTopBarProps = {
  title: string;
  /** Second line on main pages; a nested page shows `propertyName` in its place when given. */
  subtitle?: string;
  /** Icon in the dark rounded square of a main page. Ignored when `onBack` is set. */
  leadingIcon?: IconName;
  /** Makes this a nested-page bar: the leading square becomes a back button. */
  onBack?: () => void;
  /** Name of the property this page is about, as supplied by the screen. Never fetched here. */
  propertyName?: string | null;
  /** Right-side actions. */
  actions?: ReactNode;
};

// The shared HOSTELL top bar. Main tab pages pass `leadingIcon`; nested pages pass `onBack`.
// It owns the top safe-area inset, so screens below it must not add one.
export function AppTopBar({ title, subtitle, leadingIcon, onBack, propertyName, actions }: AppTopBarProps) {
  const insets = useSafeAreaInsets();
  const secondLine = onBack ? propertyName?.trim() || subtitle : subtitle;
  const [profileHighlighted, setProfileHighlighted] = useState(false);

  return (
    <View style={[styles.bar, { paddingTop: insets.top }]}>
      <View style={[styles.row, onBack && styles.rowNested]}>
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
            onPress={onBack}
            style={styles.back}>
            <Image
              source={BACK_ARROW}
              style={styles.backIcon}
              contentFit="contain"
              tintColor={BrandColors.textPrimary}
            />
          </Pressable>
        ) : (
          <View
            style={[styles.leading, !profileHighlighted && styles.leadingFilled]}
            accessibilityElementsHidden
            importantForAccessibility="no">
            <MaterialIcons
              name={leadingIcon ?? 'apartment'}
              size={profileHighlighted ? 24 : 22}
              color={profileHighlighted ? BrandColors.accent : BrandColors.surface}
            />
          </View>
        )}
        <View style={styles.text}>
          <Text numberOfLines={1} style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          {secondLine ? (
            <Text numberOfLines={1} style={styles.subtitle}>
              {secondLine}
            </Text>
          ) : null}
        </View>
        {actions ? (
          <ProfileHighlightContext.Provider value={setProfileHighlighted}>
            <View style={styles.actions}>{actions}</View>
          </ProfileHighlightContext.Provider>
        ) : null}
      </View>
    </View>
  );
}

type TopBarIconButtonProps = {
  icon: IconName;
  label: string;
  onPress?: () => void;
  disabled?: boolean;
};

export function TopBarIconButton({ icon, label, onPress, disabled }: TopBarIconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.iconButton, disabled && styles.disabled]}>
      <MaterialIcons name={icon} size={22} color={BrandColors.textPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: BrandColors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BrandColors.border,
    elevation: 3,
    shadowColor: BrandColors.textPrimary,
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  leading: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Same sage green as the active item in the bottom navigation; dropped while the profile
  // button is highlighted, so there is only one green shape in the bar.
  leadingFilled: { borderRadius: 12, backgroundColor: BrandColors.accent },
  // Nested pages: a plain arrow, no filled background.
  back: { width: 20, height: 44, alignItems: 'center', justifyContent: 'center' },
  rowNested: { gap: 8 },
  backIcon: { width: 18, height: 18 },
  text: { flex: 1, minWidth: 0 },
  title: { fontSize: 18, fontWeight: '800', color: BrandColors.textPrimary },
  subtitle: { marginTop: 1, fontSize: 12, color: BrandColors.textSecondary },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.4 },
});
