/**
 * 状态提示条:成功 / 失败 / 说明。认证与同步相关的反馈统一走它,
 * 保证"出错时说人话、颜色在深色模式下也读得清"。
 *
 * 颜色按浅色/深色分别定过:浅色下用深绿/深红压在浅底上,
 * 深色下换成亮绿/亮红压在深底上,两种情况对比度都在 4.5 以上。
 */

import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useResolvedScheme, useTheme } from '@/hooks/use-theme';

export type StatusKind = 'info' | 'success' | 'error';

const PALETTE = {
  light: {
    success: '#1B5E20',
    successSoft: '#E8F5E9',
    error: '#C62828',
    errorSoft: '#FDECEA',
  },
  dark: {
    success: '#81C784',
    successSoft: '#132A18',
    error: '#FF8A80',
    errorSoft: '#33191A',
  },
} as const;

export function StatusNote({ kind = 'info', children }: { kind?: StatusKind; children: ReactNode }) {
  const theme = useTheme();
  const scheme = useResolvedScheme();
  const palette = PALETTE[scheme];

  const color = kind === 'info' ? theme.textSecondary : kind === 'success' ? palette.success : palette.error;
  const background =
    kind === 'info'
      ? theme.backgroundElement
      : kind === 'success'
        ? palette.successSoft
        : palette.errorSoft;

  return (
    <View style={[styles.wrap, { backgroundColor: background, borderColor: theme.border }]}>
      <ThemedText type="small" style={[styles.text, { color }]}>
        {children}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: Spacing.two + 2,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  text: { lineHeight: 20 },
});
