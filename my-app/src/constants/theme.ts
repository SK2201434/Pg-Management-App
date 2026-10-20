/** Colors used by the themed components, defined for light and dark mode. */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
  },
} as const;

/** Fixed brand palette used by the signed-out auth screens (not theme-dependent). */
export const BrandColors = {
  background: '#F3FBF7',
  /** Page background of the signed-in screens. */
  canvas: '#F5F4EF',
  surface: '#FFFFFF',
  textPrimary: '#202A2B',
  textSecondary: '#737B78',
  accent: '#6D9990',
  border: '#E4E5DF',
  buttonBackground: '#202A2B',
  buttonText: '#FFFFFF',
  /** Final "submit" buttons (Sign In, Create Account, Save Property), dark like the primary brand colour. All other buttons are `accent`. */
  submit: '#202A2B',
  /** The app's one red: errors, overdue, destructive actions. */
  error: '#B65D57',
  /** A soft tint of `error` for badges and icon backgrounds. */
  errorTint: '#F6E9E8',
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
