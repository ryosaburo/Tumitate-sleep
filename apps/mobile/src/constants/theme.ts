/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

/** 配色。値はプロトタイプ(docs/prototype/nekase.html)に合わせる。睡眠はインディゴ、資産は橙の3段階。 */
export const Colors = {
  light: {
    text: '#161A38',
    textSecondary: '#464C70',
    background: '#EEF0F7',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#D9DEF6',
    line: '#D6DAEA',
    sleep: '#4452B8',
    sleepInk: '#3341A6',
    onSleep: '#FFFFFF',
    asset: '#D9791C',
    assetInk: '#9F4E08',
    assetSoft: '#F6DDBE',
    assetL1: '#E9C690',
    assetL2: '#D9791C',
    assetL3: '#8F3D07',
    good: '#1B8756',
    goodInk: '#12643F',
    goodSoft: '#D6EFE2',
    onGood: '#FFFFFF',
    /** レートの上昇(青)・下降(赤)。赤は落ち着いた色にし、点滅や強調はしない */
    rateUp: '#1F6FC4',
    rateDown: '#B5443A',
  },
  dark: {
    text: '#ECEEFB',
    textSecondary: '#B9BEDD',
    background: '#0D1024',
    backgroundElement: '#171B3A',
    backgroundSelected: '#2B3270',
    line: '#2D3463',
    sleep: '#7F8CE6',
    sleepInk: '#AEB8FF',
    onSleep: '#0D1024',
    asset: '#C77D2E',
    assetInk: '#F2B26B',
    assetSoft: '#4B3518',
    assetL1: '#7A5A33',
    assetL2: '#C77D2E',
    assetL3: '#F6CF98',
    good: '#5CD6A0',
    goodInk: '#7BE3B2',
    goodSoft: '#173A2E',
    onGood: '#0D1024',
    rateUp: '#7DB4FF',
    rateDown: '#E8928A',
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
/** Web では、タブバーが画面上部に浮いている(position: absolute)ので、その高さぶんだけ本文を下げる。 */
export const WebTopInset = Platform.OS === 'web' ? 72 : 0;
export const MaxContentWidth = 800;
