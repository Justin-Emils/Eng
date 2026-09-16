/**
 * 空状态 / 错误状态组件:统一"没有内容时该看到什么"。
 * 正常 App 不会给白屏 —— 一律给图标 + 一句解释 + 一个可点的下一步。
 */

import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function EmptyState({
  emoji = '📭',
  title,
  description,
  actionLabel,
  onAction,
}: {
  emoji?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.wrap}>
      <ThemedView type="backgroundElement" style={styles.badge}>
        <ThemedText style={styles.emoji}>{emoji}</ThemedText>
      </ThemedView>
      <ThemedText type="smallBold" style={styles.title}>
        {title}
      </ThemedText>
      {description ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.desc}>
          {description}
        </ThemedText>
      ) : null}
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} style={({ pressed }) => pressed && styles.pressed}>
          <View style={[styles.button, { backgroundColor: theme.accentStrong }]}>
            <ThemedText type="smallBold" themeColor="onAccentStrong">
              {actionLabel}
            </ThemedText>
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.six,
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
  },
  badge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  emoji: { fontSize: 30, lineHeight: 38 },
  title: { textAlign: 'center' },
  desc: { textAlign: 'center', lineHeight: 20, maxWidth: 280 },
  button: {
    marginTop: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two + 2,
    borderRadius: Spacing.three,
  },
  pressed: { opacity: 0.85 },
});
