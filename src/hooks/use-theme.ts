/**
 * 主题取色入口(全局唯一)。
 *
 * 解析顺序:用户在设置里选的主题模式优先;选"跟随系统"时看系统深浅色。
 * 只有明确 dark 才用深色,避免系统值为 null/unspecified 时拿到 undefined。
 */

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeMode } from '@/hooks/use-theme-mode';

export type ColorScheme = 'light' | 'dark';

/** 解析出最终生效的深浅色(供 Navigation 主题、状态栏等使用) */
export function useResolvedScheme(): ColorScheme {
  const systemScheme = useColorScheme();
  const mode = useThemeMode();
  if (mode === 'light' || mode === 'dark') return mode;
  return systemScheme === 'dark' ? 'dark' : 'light';
}

export function useTheme() {
  return Colors[useResolvedScheme()];
}
