import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { BrandColors } from '@/constants/theme';

export type AppButtonVariant = 'primary' | 'submit' | 'secondary' | 'destructive' | 'ghost';

export type AppButtonProps = {
  label: string;
  onPress: () => void;
  /**
   * `primary` sage fill (the default for every ordinary action), `submit` blue fill (only for the
   * final submitting action of a form or flow), `secondary` white with border, `destructive` red
   * fill, `ghost` sage text only.
   */
  variant?: AppButtonVariant;
  /** Overrides the fill (and border) colour of `primary`/`submit`/`destructive`, for one-off needs. */
  color?: string;
  /** `md` is the standard 48 px button; `sm` is 40 px for inline actions. */
  size?: 'md' | 'sm';
  icon?: ComponentProps<typeof MaterialIcons>['name'];
  /** Icon after the label, e.g. an arrow. */
  trailingIcon?: ComponentProps<typeof MaterialIcons>['name'];
  /** Custom content before the label (e.g. a brand logo), instead of `icon`. */
  leading?: ReactNode;
  /** Shows a spinner in place of the label and ignores presses (the width does not change). */
  loading?: boolean;
  disabled?: boolean;
  /** Layout only (flex, margins, alignSelf). Colours come from `variant`. */
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

const PRESSED_SCALE = 0.96;

const COLORS: Record<AppButtonVariant, { bg: string; fg: string; border: string; ripple: string }> = {
  submit: { bg: BrandColors.submit, fg: BrandColors.buttonText, border: BrandColors.submit, ripple: 'rgba(255,255,255,0.25)' },
  primary: { bg: BrandColors.accent, fg: BrandColors.buttonText, border: BrandColors.accent, ripple: 'rgba(255,255,255,0.25)' },
  secondary: { bg: BrandColors.surface, fg: BrandColors.textPrimary, border: BrandColors.border, ripple: 'rgba(32,42,43,0.08)' },
  destructive: { bg: BrandColors.error, fg: BrandColors.buttonText, border: BrandColors.error, ripple: 'rgba(255,255,255,0.25)' },
  ghost: { bg: 'transparent', fg: BrandColors.accent, border: 'transparent', ripple: 'rgba(109,153,144,0.15)' },
};

// The app-wide button. Press feedback: it springs down to 96% while held and back on release,
// with a ripple on Android, so every tap visibly registers. Use this for every tappable action
// button instead of styling a Pressable by hand.
export function AppButton({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  color,
  icon,
  trailingIcon,
  leading,
  loading,
  disabled,
  style,
  accessibilityLabel,
}: AppButtonProps) {
  const [scale] = useState(() => new Animated.Value(1));
  const inactive = !!disabled || !!loading;
  const base = COLORS[variant];
  const colors = color && base.bg !== 'transparent' && variant !== 'secondary' ? { ...base, bg: color, border: color } : base;

  const animateTo = (value: number) =>
    Animated.spring(scale, { toValue: value, useNativeDriver: true, speed: 40, bounciness: 6 }).start();

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled: inactive, busy: !!loading }}
        disabled={inactive}
        onPress={onPress}
        onPressIn={() => animateTo(PRESSED_SCALE)}
        onPressOut={() => animateTo(1)}
        android_ripple={{ color: colors.ripple }}
        style={[
          styles.base,
          size === 'sm' ? styles.sm : styles.md,
          { backgroundColor: colors.bg, borderColor: colors.border },
          disabled && styles.disabled,
        ]}>
        {loading ? (
          <ActivityIndicator color={colors.fg} />
        ) : (
          <>
            {leading ?? (icon ? <MaterialIcons name={icon} size={size === 'sm' ? 16 : 18} color={colors.fg} /> : null)}
            <Text numberOfLines={1} style={[styles.label, size === 'sm' && styles.labelSm, { color: colors.fg }]}>
              {label}
            </Text>
            {trailingIcon ? (
              <MaterialIcons name={trailingIcon} size={size === 'sm' ? 16 : 18} color={colors.fg} />
            ) : null}
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  md: { minHeight: 48, paddingHorizontal: 18 },
  sm: { minHeight: 40, paddingHorizontal: 14 },
  label: { fontSize: 15, fontWeight: '700' },
  labelSm: { fontSize: 13 },
  disabled: { opacity: 0.45 },
});
