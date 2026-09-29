/**
 * 紧凑推荐卡(首页「为你挑选」用):
 * 缩略封面 + 标题 + 难度/生词率/时长芯片 + 一句推荐理由。
 * 与文章库的大卡区分:首页要能一屏看到多篇。
 */

import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ArticleCover } from '@/components/article-cover';
import { PressScale } from '@/components/motion';
import { Star } from '@/components/ornaments';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme, useThemeSkin } from '@/hooks/use-theme';
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
  const skin = useThemeSkin();
  const { article, bandId, requiredVocab, coverage, fit, learnableCount, sampleNewWords } = data;
  const coverageText = `${(coverage * 100).toFixed(1)}%`;
  const samples = sampleNewWords.slice(0, 2).join(' / ');
  const isStretch = fit === '略有挑战' || fit === '刚好合适';

  return (
    <PressScale onPress={() => router.push(`/article/${article.id}`)}>
      <ThemedView type="backgroundElement" frame="playbill" style={styles.card}>
        {/*
          必须给封面一个**固定宽度**。
          卡片是行布局,而行布局里子元素的主轴尺寸由内容决定 —— 封面自身只有 height,
          宽度靠父容器给。少了这层包裹,宽度会退化成"内容宽度"(只剩中央徽记那么宽,
          6–20px 的窄条)。列布局的调用点(文章库大卡、最新短文条)靠 stretch 撑开,
          不受影响。
        */}
        <View style={styles.cover}>
          <ArticleCover article={article} size="thumb" />
        </View>

        <View style={styles.body}>
          <ThemedText type="heading" numberOfLines={2} style={styles.title}>
            {article.title}
          </ThemedText>
          <View style={styles.chips}>
            <Chip text={`认识约 ${coverageText}`} />
            <Chip text={`新词 ${learnableCount}`} />
            <Chip text={`${article.difficulty.minutes} 分钟`} />
          </View>
          <View style={styles.reasonRow}>
            {skin.motifs ? (
              <Star size={5} />
            ) : (
              <ThemedText type="caption" themeColor={isStretch ? 'accent' : 'textSecondary'}>
                {isStretch ? '✓' : '💡'}
              </ThemedText>
            )}
            <ThemedText
              type="caption"
              themeColor={isStretch ? 'accent' : 'textSecondary'}
              numberOfLines={1}
              style={styles.reason}>
              {/* 这里给的是"读懂本文所需词汇量",不是文章长度 —— 别写成「约 N 词」 */}
              {fit} · {bandId} 需词汇量 {requiredVocab}
              {samples ? ` · 新词 ${samples}` : ''}
            </ThemedText>
          </View>
        </View>

        <ThemedText type="small" themeColor="textSecondary" style={styles.arrow}>
          ›
        </ThemedText>
      </ThemedView>
    </PressScale>
  );
}

/** 芯片(浅底强调色) */
function Chip({ text }: { text: string }) {
  const theme = useTheme();
  const skin = useThemeSkin();
  return (
    <View
      style={[
        styles.chip,
        { backgroundColor: theme.accentSoft, borderRadius: skin.radiusChip },
      ]}>
      <ThemedText type="caption" themeColor="accent" style={styles.chipText}>
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
  },
  /** 封面固定宽度:行布局里必须显式给(见上面的注释)。高度由 thumb 自己的 80 决定,
   *  得到 60×80 的海报比例 —— 正好和右侧文字列的高度相当 */
  cover: { width: 60 },
  body: { flex: 1, gap: Spacing.one },
  title: { fontSize: 15, lineHeight: 21 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one + 2 },
  chip: { paddingHorizontal: Spacing.two, paddingVertical: 2 },
  chipText: { fontSize: 11, lineHeight: 16 },
  reasonRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one + 2 },
  reason: { fontSize: 11.5, lineHeight: 16, flexShrink: 1 },
  arrow: { fontSize: 18 },
});
