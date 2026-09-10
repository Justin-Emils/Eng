import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ArticleCover } from '@/components/article-cover';
import { ChipRow } from '@/components/chip';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import type { Article } from '@/types';

/**
 * 文章卡片(文章库/首页推荐):
 * 顶部为该文章专属渐变色封面(emoji + 主色调),下方标题/摘要/徽章/来源。
 * completed = 已读 ✓。
 */
export function ArticleCard({ article, completed }: { article: Article; completed?: boolean }) {
  const router = useRouter();
  const d = article.difficulty;
  const chips = [`${d.level}`, `${d.vocab} 词量`, `约 ${d.minutes} 分钟`];

  return (
    <Pressable
      onPress={() => router.push(`/article/${article.id}`)}
      style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView type="backgroundElement" style={styles.card}>
        <ArticleCover article={article} size="banner" />

        <View style={styles.body}>
          <View style={styles.headRow}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.topic}>
              {article.topicTags.join(' · ')}
            </ThemedText>
            {completed ? (
              <ThemedText type="smallBold" themeColor="accent">
                已读 ✓
              </ThemedText>
            ) : null}
          </View>
          <ThemedText type="smallBold" style={styles.title}>
            {article.title}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={2} style={styles.summary}>
            {article.summary}
          </ThemedText>
          <ChipRow items={chips} />
          {article.credit ? (
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.credit}>
              来源:{article.credit}
            </ThemedText>
          ) : null}
        </View>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.92 },
  card: {
    borderRadius: Spacing.three,
    overflow: 'hidden',
  },
  body: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  topic: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    flexShrink: 1,
  },
  title: {
    fontSize: 17,
    lineHeight: 24,
  },
  summary: {
    lineHeight: 20,
  },
  credit: {
    lineHeight: 16,
    opacity: 0.8,
  },
});
