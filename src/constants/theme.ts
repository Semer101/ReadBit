/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
    accent: '#208AEF',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
    accent: '#208AEF',
  },
  chocolate: {
    text: '#3E2723',
    background: '#EFEBE9',
    backgroundElement: '#D7CCC8',
    backgroundSelected: '#BCAAA4',
    textSecondary: '#795548',
    accent: '#5D4037',
  },
  strawberry: {
    text: '#880E4F',
    background: '#FCE4EC',
    backgroundElement: '#F8BBD0',
    backgroundSelected: '#F48FB1',
    textSecondary: '#C2185B',
    accent: '#E91E63',
  },
  mint: {
    text: '#1B5E20',
    background: '#E8F5E9',
    backgroundElement: '#C8E6C9',
    backgroundSelected: '#A5D6A7',
    textSecondary: '#388E3C',
    accent: '#4CAF50',
  },
} as const;

export type AppTheme = keyof typeof Colors;
export type ThemeColor = keyof typeof Colors.light;


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
