import { StyleSheet, Text, type TextStyle } from 'react-native';

import { tokenize } from '@/domain/wordmark';
import { useTheme } from '@/hooks/use-theme';

/**
 * 词级渲染组件:把一段英文拆成单词/空白 token,词可点。
 * 高亮(仅按"用户词汇量学习范围"):
 *  1. 今日新学词(todayLearned 命中):品牌蓝 + 加粗;
 *  2. 候选生词(candidateSet 命中):品牌蓝(纯色)。
 * 轻点单词 → onWordPress(word)。
 */
export function WordText({
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
  /** 候选生词(按用户词汇量判定、未学未会)——标蓝 */
  candidateSet?: ReadonlySet<string>;
  /** 今日新学的词——加粗 */
  todayLearnedSet?: ReadonlySet<string>;
  onWordPress?: (word: string) => void;
}) {
  const theme = useTheme();
  const tokens = tokenize(text);

  const wordStyle: TextStyle = { fontSize, lineHeight };

  return (
    <Text style={[styles.para, wordStyle]}>
      {tokens.map((tok, i) => {
        if (!tok.isWord) {
          return tok.text;
        }
        const lower = tok.text.toLowerCase();
        let highlightStyle: TextStyle | undefined;

        if (todayLearnedSet?.has(lower)) {
          highlightStyle = { color: theme.accent, fontWeight: '700' };
        } else if (candidateSet?.has(lower)) {
          highlightStyle = { color: theme.accent };
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
}

const styles = StyleSheet.create({
  para: {
    fontWeight: '400',
  },
});
