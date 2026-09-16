/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

/**
 * 取当前主题色板。
 * 注意:useColorScheme() 可能返回 null / 'unspecified'(系统未指定)。
 * 早期实现直接用它索引 Colors,遇到 null 会得到 undefined → 整页颜色失效;
 * 现在显式判定:只有明确 'dark' 才用深色,其余一律浅色。
 */
export function useTheme() {
  const scheme = useColorScheme();
  return Colors[scheme === 'dark' ? 'dark' : 'light'];
}
