/**
 * 设置列表行(用于「我的」页):左侧标题(+副标题),右侧当前值/开关/箭头。
 */

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function SettingRow({
  label,
  sublabel,
  value,
  right,
  onPress,
  last = false,
}: {
  label: string;
  sublabel?: string;
  /** 右侧文字值(如 "每天 2 篇") */
  value?: string;
  /** 自定义右侧(如开关、色块) */
  right?: ReactNode;
  onPress?: () => void;
  /** 最后一行不画分隔线 */
  last?: boolean;
}) {
  const theme = useTheme();
  const content = (
    <View style={[styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }]}>
      <View style={styles.textCol}>
        <ThemedText type="small">{label}</ThemedText>
        {sublabel ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.sublabel}>
            {sublabel}
          </ThemedText>
        ) : null}
      </View>
      {right ?? (
        <View style={styles.rightCol}>
          {value ? (
            <ThemedText type="small" themeColor="textSecondary">
              {value}
            </ThemedText>
          ) : null}
          {onPress ? (
            <ThemedText type="small" themeColor="textSecondary">
              ›
            </ThemedText>
          ) : null}
        </View>
      )}
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    minHeight: 52,
  },
  textCol: { flex: 1, gap: 2 },
  sublabel: { lineHeight: 18 },
  rightCol: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  pressed: { opacity: 0.7 },
});
