import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * M0 占位主页:所有学英语 Tab 页在对应模块完成前都渲染这个通用骨架,
 * 保证 App 能启动、5 tab 可跳转。后续里程碑逐个替换为真实页面。
 *
 * props:
 * - emoji / badge:tab 显眼标识
 * - title:中文页面名
 * - description:功能简介(说明该页将来做什么)
 * - moduleHint:告知"进度",如"模块 B 未实现"
 */
export function PlaceholderScreen({
  title,
  badge,
  description,
  moduleHint,
}: {
  title: string;
  badge?: string;
  description?: string;
  moduleHint?: string;
}) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  const contentPlatformStyle = Platform.select({
    android: {
      paddingTop: insets.top,
      paddingLeft: insets.left,
      paddingRight: insets.right,
      paddingBottom: insets.bottom + BottomTabInset + Spacing.two,
    },
    default: {
      paddingTop: insets.top,
      paddingLeft: insets.left,
      paddingRight: insets.right,
      paddingBottom: insets.bottom + BottomTabInset + Spacing.two,
    },
    web: {
      paddingTop: Spacing.five,
      paddingBottom: Spacing.four,
    },
  });

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.background }]}
      contentContainerStyle={[styles.content, contentPlatformStyle]}>
      <View style={styles.centerCol}>
        <View style={[styles.badgeCircle, { backgroundColor: theme.accentSoft }]}>
          <ThemedText type="subtitle">{badge ?? '📘'}</ThemedText>
        </View>
        <ThemedText type="title" style={styles.title}>
          {title}
        </ThemedText>
        {description ? (
          <ThemedText themeColor="textSecondary" style={styles.description}>
            {description}
          </ThemedText>
        ) : null}
        <ThemedView type="backgroundElement" style={styles.hintCard}>
          <ThemedText type="small" themeColor="accent" style={styles.hintAccent}>
            {moduleHint ?? '模块开发中'}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            本骨架页已接入底部导航,真实功能将在后续里程碑落地。
          </ThemedText>
        </ThemedView>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    flexGrow: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  centerCol: {
    maxWidth: MaxContentWidth,
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  badgeCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.three,
  },
  title: {
    textAlign: 'center',
    fontSize: 36,
    lineHeight: 44,
  },
  description: {
    textAlign: 'center',
    lineHeight: 24,
  },
  hintCard: {
    alignSelf: 'stretch',
    gap: Spacing.one,
    padding: Spacing.four,
    borderRadius: Spacing.three,
    marginTop: Spacing.four,
  },
  hintAccent: {
    fontWeight: '700',
  },
});
