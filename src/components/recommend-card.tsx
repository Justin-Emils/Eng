/**
 * 紧凑推荐卡(首页「为你挑选」用):
 * 缩略封面 + 标题 + 难度/生词率/时长芯片 + 一句推荐理由。
 * 与文章库的大卡区分:首页要能一屏看到多篇。
 */

import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ArticleCover } from '@/components/article-cover';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Article } from '@/types';

export interface RecommendCardData {
  article: Article;
  /** 参考档位(如 B1+)—— 只作参考层展示 */
  bandId: string;
  /** 所需词汇量 */
  requiredVocab: number;
  /** 预测理解率(0–1):你大约能认识这篇多少比例的词 */
  coverage: number;
  /** 一句人话评价:刚好合适 / 略有挑战 …(按理解率判定) */
  fit: string;
  /** 值得学的去重新词数 */
  learnableCount: number;
  /** 新词示例 */
  sampleNewWords: string[];
}

export function RecommendCard({ data }: { data: RecommendCardData }) {
  const router = useRouter();
  const { article, bandId, requiredVocab, coverage, fit, learnableCount, sampleNewWords } = data;
  const coverageText = `${(coverage * 100).toFixed(1)}%`;
  const samples = sampleNewWords.slice(0, 2).join(' / ');
  const isStretch = fit === '略有挑战' || fit === '刚好合适';

  return (
    <Pressable
      onPress={() => router.push(`/article/${article.id}`)}
      style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView type="backgroundElement" style={styles.card}>
        <ArticleCover article={article} size="thumb" />

        <View style={styles.body}>
          <ThemedText type="smallBold" numberOfLines={2} style={styles.title}>
            {article.title}
          </ThemedText>
          <View style={styles.chips}>
            <Chip text={`认识约 ${coverageText}`} />
            <Chip text={`新词 ${learnableCount}`} />
            <Chip text={`${article.difficulty.minutes} 分钟`} />
          </View>
          <ThemedText
            type="small"
            themeColor={isStretch ? 'accent' : 'textSecondary'}
            numberOfLines={1}
            style={styles.reason}>
            {isStretch ? '✓' : '💡'} {fit} · {bandId} 约 {requiredVocab} 词
            {samples ? ` · 新词 ${samples}` : ''}
          </ThemedText>
        </View>

        <ThemedText type="small" themeColor="textSecondary" style={styles.arrow}>
          ›
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

/** 芯片(浅底强调色) */
function Chip({ text }: { text: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.chip, { backgroundColor: theme.accentSoft }]}>
      <ThemedText type="small" themeColor="accent" style={styles.chipText}>
        {text}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.two + 2,
    borderRadius: Spacing.three,
  },
  body: { flex: 1, gap: Spacing.one },
  title: { fontSize: 14.5, lineHeight: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one + 2 },
  chip: { paddingHorizontal: Spacing.two, paddingVertical: 2, borderRadius: 999 },
  chipText: { fontSize: 11, lineHeight: 16 },
  reason: { fontSize: 11.5, lineHeight: 16 },
  arrow: { fontSize: 18 },
  pressed: { opacity: 0.85 },
});
