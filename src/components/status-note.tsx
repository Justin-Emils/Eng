/**
 * 状态提示条:成功 / 失败 / 说明。认证与同步相关的反馈统一走它,
 * 保证"出错时说人话、颜色在深色模式下也读得清"。
 *
 * 颜色来自主题令牌(danger / success 及其衬底),不再在这里写死 ——
 * 写死的话换主题时这块会掉队,而且每套主题的深浅色都要各自调一遍。
 */

import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme, useThemeSkin } from '@/hooks/use-theme';

export type StatusKind = 'info' | 'success' | 'error';

export function StatusNote({ kind = 'info', children }: { kind?: StatusKind; children: ReactNode }) {
  const theme = useTheme();
  const skin = useThemeSkin();

  const color =
    kind === 'info' ? theme.textSecondary : kind === 'success' ? theme.success : theme.danger;
  const background =
    kind === 'info'
      ? theme.backgroundElement
      : kind === 'success'
        ? theme.successSoft
        : theme.dangerSoft;

  return (
    <View
      style={[
        styles.wrap,
        { backgroundColor: background, borderColor: theme.border, borderRadius: skin.radiusPanel },
      ]}>
      <ThemedText type="small" style={[styles.text, { color }]}>
        {children}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  text: { lineHeight: 20 },
});
