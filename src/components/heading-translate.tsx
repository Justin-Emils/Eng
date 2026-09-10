import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { translateSentence, type TranslationResult } from '@/domain/translate';

/**
 * 文章头部(标题 + 简介)整段翻译,交互与段落句子一致:
 * 右侧一个「译」小按钮,展开/收起一整块译文卡片。
 * 展开时同时翻译标题与简介(在线优先,失败自动离线兜底,带缓存),
 * 译文里分别标注「标题」「简介」方便对照。
 */
export function HeadingTranslate({
  title,
  summary,
}: {
  title: string;
  summary?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [titleRes, setTitleRes] = useState<TranslationResult | null>(null);
  const [summaryRes, setSummaryRes] = useState<TranslationResult | null>(null);

  const toggle = () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    // 触发标题与简介的翻译(模块级缓存:同一句只请求一次)
    if (!titleRes && title.trim()) {
      translateSentence(title).then(setTitleRes).catch(() => setTitleRes(failed()));
    }
    if (!summaryRes && summary?.trim()) {
      translateSentence(summary).then(setSummaryRes).catch(() => setSummaryRes(failed()));
    }
  };

  const loading =
    (title.trim() && !titleRes) || (Boolean(summary?.trim()) && !summaryRes);
  const offline = titleRes?.mode === 'offline-wordwise' || summaryRes?.mode === 'offline-wordwise';

  return (
    <View style={styles.block}>
      <View style={styles.actionsRow}>
        <Pressable onPress={toggle} hitSlop={8} style={({ pressed }) => pressed && styles.pressed}>
          <ThemedText type="smallBold" themeColor="accent">
            {expanded ? '收起 ›' : '译'}
          </ThemedText>
        </Pressable>
      </View>

      {expanded ? (
        <ThemedView type="backgroundElement" style={styles.card}>
          {loading ? (
            <ThemedText type="small" themeColor="textSecondary">
              翻译中…
            </ThemedText>
          ) : (
            <>
              <ThemedText type="smallBold" themeColor="accent" style={styles.tag}>
                {offline ? '离线兜底(非整句)' : '整句翻译'}
              </ThemedText>

              {title.trim() && titleRes ? (
                <View style={styles.part}>
                  <ThemedText type="smallBold" themeColor="textSecondary" style={styles.partLabel}>
                    标题
                  </ThemedText>
                  {titleRes.text ? (
                    <ThemedText style={styles.text}>{titleRes.text}</ThemedText>
                  ) : null}
                  {titleRes.note ? (
                    <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
                      {titleRes.note}
                    </ThemedText>
                  ) : null}
                </View>
              ) : null}

              {summary?.trim() && summaryRes ? (
                <View style={styles.part}>
                  <ThemedText type="smallBold" themeColor="textSecondary" style={styles.partLabel}>
                    简介
                  </ThemedText>
                  {summaryRes.text ? (
                    <ThemedText style={styles.text}>{summaryRes.text}</ThemedText>
                  ) : null}
                  {summaryRes.note ? (
                    <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
                      {summaryRes.note}
                    </ThemedText>
                  ) : null}
                </View>
              ) : null}
            </>
          )}
        </ThemedView>
      ) : null}
    </View>
  );
}

/** 翻译失败时的占位结果 */
function failed(): TranslationResult {
  return {
    text: '',
    mode: 'offline-wordwise',
    missingCount: 0,
    note: '翻译失败,请重试',
  };
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
  card: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  tag: {
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.5,
  },
  part: {
    gap: Spacing.half,
  },
  partLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
  text: {
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
