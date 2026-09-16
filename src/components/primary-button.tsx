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
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const theme = useTheme();
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      hitSlop={6}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: isDisabled ? theme.backgroundSelected : theme.accentStrong },
        pressed && !isDisabled && styles.pressed,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator size="small" color={theme.onAccentStrong} />
      ) : (
        <ThemedText type="smallBold" themeColor="onAccentStrong" style={styles.label}>
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
  pressed: { opacity: 0.85 },
});
