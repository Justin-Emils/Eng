/**
 * 主题取色入口(全局唯一)。
 *
 * 最终配色 = 用户选的主题(default / siracusa) × 解析出的深浅色。
 * 解析顺序:用户在设置里选的主题模式优先;选"跟随系统"时看系统深浅色。
 * 只有明确 dark 才用深色,避免系统值为 null/unspecified 时拿到 undefined。
 */

import {
  getPalette,
  getSkin,
  THEME_META,
  type ThemeMeta,
  type ThemePalette,
  type ThemeSkin,
} from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeId, useThemeMode } from '@/hooks/use-theme-pref';

export type ColorScheme = 'light' | 'dark';

/** 解析出最终生效的深浅色(供 Navigation 主题、状态栏等使用) */
export function useResolvedScheme(): ColorScheme {
  const systemScheme = useColorScheme();
  const mode = useThemeMode();
  if (mode === 'light' || mode === 'dark') return mode;
  return systemScheme === 'dark' ? 'dark' : 'light';
}

/** 当前主题 × 当前深浅色 → 一套配色令牌 */
export function useTheme(): ThemePalette {
  const scheme = useResolvedScheme();
  const themeId = useThemeId();
  return getPalette(themeId, scheme);
}

/**
 * 当前主题的形态语言(几何 + 字形)。
 *
 * 和 `useTheme()` 分开的理由:颜色是"值",形态是"结构"。
 * 结构类样式必须内联合并进 style(StyleSheet.create 是模块级静态的,拿不到主题),
 * 所以分成两个 hook 比塞进同一个对象更好用,也不会污染 `ThemeColor` 的键集合。
 */
export function useThemeSkin(): ThemeSkin {
  return getSkin(useThemeId());
}

/** 当前主题的名字与说明(设置页、关于页用) */
export function useThemeMeta(): ThemeMeta {
  return THEME_META[useThemeId()];
}
