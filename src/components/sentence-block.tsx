import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WordText } from '@/components/word-text';
import { Spacing } from '@/constants/theme';
import { translateSentence, type TranslationResult } from '@/domain/translate';

/**
 * 句子级渲染块:
 * - 句子本体用 WordText 词级渲染(点词查词/学习);
 * - 句子右下角轻量「译」小按钮 → 该句下方展开对照译文(再点收起)。
 */
export function SentenceBlock({
  sentence,
  fontSize,
  lineHeight,
  candidateSet,
  todayLearnedSet,
  onWordPress,
}: {
  sentence: string;
  fontSize: number;
  lineHeight: number;
  /** 候选生词集合(标蓝) */
  candidateSet?: ReadonlySet<string>;
  /** 今日新学词集合(加粗) */
  todayLearnedSet?: ReadonlySet<string>;
  onWordPress: (word: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [result, setResult] = useState<TranslationResult | null>(null);

  const toggleTranslate = useCallback(() => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (!result) {
      // 异步翻译;模块级缓存保证重复展开不重复计算
      translateSentence(sentence).then(setResult).catch(() => {
        setResult({
          text: '',
          mode: 'offline-wordwise',
          missingCount: 0,
          note: '翻译失败,请重试',
        });
      });
    }
  }, [expanded, result, sentence]);

  return (
    <View style={styles.block}>
      <WordText
        text={sentence}
        fontSize={fontSize}
        lineHeight={lineHeight}
        candidateSet={candidateSet}
        todayLearnedSet={todayLearnedSet}
        onWordPress={onWordPress}
      />

      <View style={styles.actionsRow}>
        <Pressable onPress={toggleTranslate} hitSlop={8} style={({ pressed }) => pressed && styles.pressed}>
          <ThemedText type="smallBold" themeColor="accent">
            {expanded ? '收起译 ›' : '译'}
          </ThemedText>
        </Pressable>
      </View>

      {expanded ? (
        <ThemedView type="backgroundElement" style={styles.translation}>
          {result ? (
            <>
              <ThemedText type="smallBold" themeColor="accent" style={styles.tag}>
                {result.mode === 'online' ? '整句翻译' : '离线兜底(非整句)'}
              </ThemedText>
              {result.text ? (
                <ThemedText style={styles.translationText}>{result.text}</ThemedText>
              ) : null}
              {result.note ? (
                <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
                  {result.note}
                </ThemedText>
              ) : null}
            </>
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              翻译中…
            </ThemedText>
          )}
        </ThemedView>
      ) : null}

      <View style={{ height: Spacing.two }} />
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: Spacing.one,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: Spacing.half,
  },
  translation: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.half,
  },
  tag: {
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.5,
  },
  translationText: {
    fontSize: 16,
    lineHeight: 24,
  },
  note: {
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.6,
  },
});
