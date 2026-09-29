import { memo } from 'react';
import { StyleSheet, Text, type TextStyle } from 'react-native';

import { SANS_FAMILY, SERIF_FAMILY } from '@/constants/fonts';
import { tokenize } from '@/domain/wordmark';
import { useTheme, useThemeSkin } from '@/hooks/use-theme';

/**
 * 词级渲染组件:把一段英文拆成单词/空白 token,词可点。
 * 高亮(仅按"用户词汇量学习范围"):
 *  1. 今日新学词(todayLearned 命中):annotateStrong + 加粗;
 *  2. 候选生词(candidateSet 命中):annotate(纯色)。
 * 轻点单词 → onWordPress(word)。
 *
 * 用 annotate 而不是 accent:标注是"学习语义",品牌色是"UI 语义"。
 * 两者分开后,换主题/换强调色都不会让正文里一片生词跟着变色。
 *
 * memo:未变的句子不随父级状态(如词典卡开关)重渲染 —— 这是点词后卡片能否"秒开"的关键。
 */
export const WordText = memo(function WordText({
  text,
  fontSize,
  lineHeight,
  candidateSet,
  todayLearnedSet,
  onWordPress,
}: {
  text: string;
  fontSize: number;
  lineHeight: number;
  /** 候选生词(按用户词汇量判定、未学未会)——标 annotate 色 */
  candidateSet?: ReadonlySet<string>;
  /** 今日新学的词——标 annotateStrong 色并加粗 */
  todayLearnedSet?: ReadonlySet<string>;
  onWordPress?: (word: string) => void;
}) {
  const theme = useTheme();
  const skin = useThemeSkin();
  const tokens = tokenize(text);

  /**
   * 阅读正文字体由主题决定:叙拉古用衬线(**内嵌的 Literata**,为长时间屏幕阅读设计),
   * 默认主题保持原来的无衬线。
   * 行高由调用方按 skin.bodyLineHeight 算好传进来。
   *
   * 衬线分支用具体的字重族名并把 fontWeight 归零 —— 见 constants/fonts.ts 的说明:
   * 安卓不会按 fontWeight 去挑 ttf,而是拿 400 合成假粗体。
   */
  const wordStyle: TextStyle = {
    fontFamily: skin.bodyFont === 'serif' ? SERIF_FAMILY.regular : SANS_FAMILY,
    ...(skin.bodyFont === 'serif' ? { fontWeight: 'normal' as const } : {}),
    fontSize,
    lineHeight,
    color: theme.text,
  };

  return (
    <Text style={[styles.para, wordStyle]}>
      {tokens.map((tok, i) => {
        if (!tok.isWord) {
          return tok.text;
        }
        const lower = tok.text.toLowerCase();
        let highlightStyle: TextStyle | undefined;

        if (todayLearnedSet?.has(lower)) {
          highlightStyle = { color: theme.annotateStrong, fontWeight: '700' };
        } else if (candidateSet?.has(lower)) {
          highlightStyle = { color: theme.annotate };
        }

        return (
          <Text
            key={`${i}-${tok.text}`}
            style={highlightStyle}
            suppressHighlighting
            onPress={onWordPress ? () => onWordPress(tok.text) : undefined}>
            {tok.text}
          </Text>
        );
      })}
    </Text>
  );
});

const styles = StyleSheet.create({
  para: {
    fontWeight: '400',
  },
});
