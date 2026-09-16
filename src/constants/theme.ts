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
    /** 品牌/强调色(学习类 App 常用清爽蓝),用于重点、按钮、高亮 */
    accent: '#208AEF',
    /**
     * 填充按钮的底色(与 accent 分开的原因:白字压在 accent #208AEF 上
     * 对比度只有 3.53;深色主题 accent 变成亮蓝后更是只剩 2.63 → 字看不清)
     */
    accentStrong: '#0F5CC0',
    /** 填充按钮上的文字色(与 accentStrong 对比度 ≥ 4.5) */
    onAccentStrong: '#ffffff',
    /** 品牌色的浅色衬底(足够浅,保证 accent 文字压在它上面也有 ≥3 对比度) */
    accentSoft: '#E3F2FD',
    /** 分隔线/描边(弱) */
    border: '#D5D9DF',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
    accent: '#4DA3FF',
    /** 深色下按钮:亮蓝底 + 深墨蓝字(对比度 6.47,不用白字) */
    accentStrong: '#4DA3FF',
    onAccentStrong: '#0A1D33',
    accentSoft: '#17324D',
    border: '#3A3D42',
  },
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
