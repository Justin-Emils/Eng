import { StyleSheet, View, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * 小徽章:文章库 / 阅读页 里展示 CEFR 等级等标签。
 */
export function Chip({ children, style }: { children: string; style?: ViewStyle }) {
  const theme = useTheme();
  return (
    <ThemedView
      type="backgroundSelected"
      style={[styles.chip, { borderColor: theme.border }, style]}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.chipText}>
        {children}
      </ThemedText>
    </ThemedView>
  );
}

/** 标签行:横向排布多个 Chip,超长自动换行 */
export function ChipRow({ items }: { items: string[] }) {
  return (
    <View style={styles.row}>
      {items.map((label) => (
        <Chip key={label}>{label}</Chip>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: {
    fontSize: 12,
    lineHeight: 16,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
