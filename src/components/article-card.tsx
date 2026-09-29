import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ArticleCover } from '@/components/article-cover';
import { ChipRow } from '@/components/chip';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radii, Spacing } from '@/constants/theme';
import { difficultyOf } from '@/domain/difficulty';
import type { Article } from '@/types';

/**
 * 文章卡片(文章库/首页推荐):
 * 顶部为该文章专属渐变色封面,下方标题/摘要/徽章/来源。
 * 徽章用**细分难度档 + 所需词汇量**(覆盖率口径),而不是粗 CEFR。
 * completed = 已读 ✓。
 *
 * 注意这里有两个"词"的指标,含义完全不同,标签不能混:
 *  - `diff.requiredVocab` = **读懂本文所需的词汇量**(如 4600),是"你的词汇量要到多少";
 *  - `d.wordCount`        = **本文实际长度**(如 460),是"这篇文章有多少词"。
 * 旧实现把前者写成「约 4600 词」并与「N 分钟」并排,读者会算成
 * 4600 词 / 3 分钟 ≈ 一分钟一千多词,看起来像时长估算坏了 —— 其实是指标标错了名。
 */
export function ArticleCard({ article, completed }: { article: Article; completed?: boolean }) {
  const router = useRouter();
  const diff = difficultyOf(article);
  const d = article.difficulty;
  const chips = [
    `难度 ${diff.band.id}`,
    `需词汇量 ${diff.requiredVocab}`,
    `${d.wordCount} 词`,
    `约 ${d.minutes} 分钟`,
  ];

  return (
    <Pressable
      onPress={() => router.push(`/article/${article.id}`)}
      style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView type="backgroundElement" frame="playbill" style={styles.card}>
        <ArticleCover article={article} size="banner" />

        <View style={styles.body}>
          <View style={styles.headRow}>
            <ThemedText type="label" themeColor="textSecondary" style={styles.topic}>
              {article.topicTags.join(' · ')}
            </ThemedText>
            {completed ? (
              <ThemedText type="smallBold" themeColor="accent">
                已读 ✓
              </ThemedText>
            ) : null}
          </View>
          <ThemedText type="heading">{article.title}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={2} style={styles.summary}>
            {article.summary}
          </ThemedText>
          <ChipRow items={chips} />
          {article.credit ? (
            <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1} style={styles.credit}>
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
    borderRadius: Radii.card,
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
    flexShrink: 1,
  },
  summary: {
    lineHeight: 20,
  },
  credit: {
    opacity: 0.8,
  },
});
