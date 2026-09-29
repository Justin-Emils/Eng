/**
 * 空状态 / 错误状态组件:统一"没有内容时该看到什么"。
 * 正常 App 不会给白屏 —— 一律给图标 + 一句解释 + 一个可点的下一步。
 *
 * 图标的位置按主题分两种:
 *  · 默认主题 —— 原来的圆底 + emoji(原样);
 *  · 叙拉古主题 —— 换成金线勋章 + 菱形。
 * emoji 的含义是"话题提示",而空状态的含义本来就在标题与说明文字里,
 * 所以这里不试图把 emoji 翻译成某个具体符号,直接换成语汇统一的纹样。
 */

import { Pressable, StyleSheet, View } from 'react-native';

import { Mascot } from '@/components/mascot';
import { Medallion } from '@/components/ornaments';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme, useThemeSkin } from '@/hooks/use-theme';

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
  const skin = useThemeSkin();
  return (
    <View style={styles.wrap}>
      {/*
        三档回退,优先级从"最像成品"到"最保底":
          1. 有形象(主题开着 mascot)→ 直接用 App 自己的角色,这是最像成品的做法;
          2. 否则用主题纹样勋章;
          3. 都关着(默认主题)→ 原来的圆底 + emoji,逐像素保底。
      */}
      {skin.mascot ? (
        <Mascot height={132} style={styles.badgeGap} />
      ) : skin.motifs ? (
        <Medallion size={64} style={styles.badgeGap} />
      ) : (
        <ThemedView type="backgroundElement" radius="none" style={styles.badgeCircle}>
          <ThemedText style={styles.emoji}>{emoji}</ThemedText>
        </ThemedView>
      )}
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
          <View
            style={[
              styles.button,
              { borderRadius: skin.radiusCard, backgroundColor: theme.accentStrong },
            ]}>
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
  /** 默认主题:原来的圆底徽章(radius="none" 是为了不让 ThemedView 用主题卡片圆角盖掉正圆) */
  badgeCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  /** 叙拉古:勋章自己就是圆形,只留间距 */
  badgeGap: { marginBottom: Spacing.one },
  emoji: { fontSize: 30, lineHeight: 38 },
  title: { textAlign: 'center' },
  desc: { textAlign: 'center', lineHeight: 20, maxWidth: 280 },
  button: {
    marginTop: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two + 2,
  },
  pressed: { opacity: 0.85 },
});
