/**
 * 主按钮(实心强调色):统一全站"主要操作"的样子。
 *
 * 注意:这里必须只用**一层** Pressable。曾经写成外层 Pressable 包内层 Pressable,
 * 内层没有 onPress 但同样会抢走触摸响应,导致按钮"点不动"(要点很多次才偶尔生效)。
 *
 * 文字色用 onAccentStrong,保证浅色/深色下对比度都 ≥ 4.5(见 scripts/audit-contrast.mjs)。
 */

import { ActivityIndicator, Pressable, StyleSheet, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function PrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  style,
  variant = 'solid',
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  /** solid = 实心主操作;outline = 描边次操作(用在同一屏里有两个并列按钮时) */
  variant?: 'solid' | 'outline';
}) {
  const theme = useTheme();
  const isDisabled = disabled || loading;
  const isOutline = variant === 'outline';

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      hitSlop={6}
      style={({ pressed }) => [
        styles.button,
        isOutline && styles.outline,
        {
          backgroundColor: isDisabled
            ? theme.backgroundSelected
            : isOutline
              ? 'transparent'
              : theme.accentStrong,
          borderColor: isDisabled ? theme.border : theme.accent,
        },
        pressed && !isDisabled && styles.pressed,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator size="small" color={isOutline ? theme.accent : theme.onAccentStrong} />
      ) : (
        <ThemedText
          type="smallBold"
          themeColor={isOutline ? 'accent' : 'onAccentStrong'}
          style={styles.label}>
          {label}
        </ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  label: { fontSize: 15 },
  /** 描边款只加边框,宽度靠 borderWidth 与实心款对齐(避免两按钮高度差 1px) */
  outline: { borderWidth: 1 },
  pressed: { opacity: 0.85 },
});
