import { useEffect, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import type { LookupResult } from '@/domain/dictionary';
import { useTheme } from '@/hooks/use-theme';
import { useWordSaved } from '@/hooks/use-word-saved';

export interface WordSource {
  articleId: string;
  sentence?: string;
}

/**
 * 单词概要卡(轻点单词后弹出)——屏幕居中悬浮框:
 * - 居中展示,避开底部对齐的各平台差异(Android 导航条/安全区);
 * - 淡遮罩 + 卡片轻微缩放淡入(无位移,无抖动);
 * - 主体为词条概要,底部一行小按钮:详情 / ＋生词本 / 关闭。
 */
export function DictCard({
  result,
  visible,
  source,
  onOpenDetail,
  onClose,
  kaoyan = false,
  studyState = null,
  onMarkLearned,
  onMarkKnown,
}: {
  result: LookupResult | null;
  visible: boolean;
  /** 加入生词本所需的来源上下文 */
  source: WordSource;
  onOpenDetail: (headword: string) => void;
  onClose: () => void;
  /** 是否命中考研/外部词表(旧标记,保持兼容) */
  kaoyan?: boolean;
  /** 学习状态:candidate=候选生词;learned=已学;known=已会 */
  studyState?: 'candidate' | 'learned' | 'known' | null;
  onMarkLearned?: (headword: string) => void;
  onMarkKnown?: (headword: string) => void;
}) {
  const theme = useTheme();
  const entry = result?.entry;
  const headword = entry?.headword;

  const { saved, toggle } = useWordSaved(headword);

  // 缩放 + 淡入(一次,无 overshoot)。useState 惰性持有 Animated.Value(React Compiler 友好)
  const [scale] = useState(() => new Animated.Value(0.92));
  const [fade] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (visible) {
      scale.setValue(0.92);
      fade.setValue(0);
      Animated.parallel([
        Animated.timing(scale, { toValue: 1, duration: 160, useNativeDriver: true }),
        Animated.timing(fade, { toValue: 1, duration: 160, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, scale, fade]);

  const handleSave = async () => {
    if (!entry) return;
    await toggle({
      word: result?.query || entry.headword,
      headword: entry.headword,
      phonetic: entry.phonetic,
      pos: entry.pos,
      zh: entry.zh,
      en: entry.en,
      example: entry.example,
      sourceArticleId: source.articleId,
      sourceSentence: source.sentence,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        {/* 淡遮罩:原地淡入,点空白关闭 */}
        <Pressable style={styles.backdrop} onPress={onClose} />

        {/* 居中悬浮卡 */}
        <Animated.View
          style={[
            styles.centerWrap,
            {
              opacity: fade,
              transform: [{ scale }],
            },
          ]}>
          <ThemedView style={styles.card}>
            <View style={[styles.handle, { backgroundColor: theme.backgroundSelected }]} />

            {entry ? (
              <>
                {/* 概要区:主要空间留给词条信息 */}
                <View style={styles.headRow}>
                  <View style={styles.titleCol}>
                    <ThemedText type="subtitle" style={styles.word}>
                      {entry.headword}
                    </ThemedText>
                    {entry.phonetic ? (
                      <ThemedText type="small" themeColor="textSecondary">
                        /{entry.phonetic}/
                      </ThemedText>
                    ) : null}
                  </View>
                  <ThemedText type="smallBold" themeColor="accent">
                    {entry.pos}
                  </ThemedText>
                </View>

                {result.status === 'inflected' ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    原文词形 “{result.query}” · 已还原为 {entry.headword}
                  </ThemedText>
                ) : null}

                <ThemedText style={styles.zh} numberOfLines={4}>
                  {entry.zh}
                </ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.en} numberOfLines={3}>
                  {entry.en}
                </ThemedText>
              </>
            ) : (
              <>
                {kaoyan ? (
                  <ThemedView type="backgroundSelected" style={styles.flagBadge}>
                    <ThemedText type="smallBold" themeColor="accent">
                      考研词 · 已收录词形
                    </ThemedText>
                  </ThemedView>
                ) : null}
                <ThemedText type="subtitle" style={styles.word}>
                  {result?.query ?? ''}
                </ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.en}>
                  {kaoyan
                    ? '该词高于你当前水平,建议标记学习。'
                    : (result?.hint ?? '离线词典未收录该词。')}
                </ThemedText>
              </>
            )}

            {/* 学习状态区:候选生词 → 邀请加入今日学习;已学/已会 → 状态徽章 */}
            {entry && studyState ? (
              studyState === 'candidate' ? (
                <View style={styles.studyRow}>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.studyHint}>
                    高于你当前词汇量,值得学
                  </ThemedText>
                  <Pressable
                    onPress={() => onMarkLearned?.(entry.headword)}
                    style={({ pressed }) => pressed && styles.pressed}>
                    <ThemedView type="backgroundSelected" style={styles.smallBtn}>
                      <ThemedText type="smallBold" themeColor="accent">
                        ＋ 今日学习
                      </ThemedText>
                    </ThemedView>
                  </Pressable>
                  <Pressable
                    onPress={() => onMarkKnown?.(entry.headword)}
                    style={({ pressed }) => pressed && styles.pressed}>
                    <ThemedText type="small" themeColor="textSecondary">
                      我会了
                    </ThemedText>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.studyRow}>
                  <ThemedView type="backgroundSelected" style={styles.smallBtn}>
                    <ThemedText type="smallBold" themeColor="accent">
                      {studyState === 'learned' ? '✓ 今日已学' : '✓ 已认识'}
                    </ThemedText>
                  </ThemedView>
                </View>
              )
            ) : null}

            {/* 小按钮行:详情 / 收藏 */}
            <View style={styles.actions}>
              {entry ? (
                <Pressable
                  onPress={() => onOpenDetail(entry.headword)}
                  style={({ pressed }) => pressed && styles.pressed}>
                  <ThemedView type="backgroundSelected" style={styles.smallBtn}>
                    <ThemedText type="smallBold" style={{ color: theme.accent }}>
                      详情 ›
                    </ThemedText>
                  </ThemedView>
                </Pressable>
              ) : (
                <View />
              )}

              <Pressable
                onPress={handleSave}
                disabled={!entry}
                style={({ pressed }) => pressed && styles.pressed}>
                <ThemedView
                  type={saved ? 'backgroundElement' : 'backgroundSelected'}
                  style={styles.smallBtn}>
                  <ThemedText
                    type="smallBold"
                    style={{ color: saved ? theme.textSecondary : theme.accent }}>
                    {saved ? '✓ 已收藏' : '＋ 生词本'}
                  </ThemedText>
                </ThemedView>
              </Pressable>

              <Pressable onPress={onClose} style={({ pressed }) => pressed && styles.pressed}>
                <ThemedView type="backgroundElement" style={styles.smallBtn}>
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    关闭
                  </ThemedText>
                </ThemedView>
              </Pressable>
            </View>
          </ThemedView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  centerWrap: {
    width: '100%',
    maxWidth: 480,
    // 遮罩之上、居中
  },
  card: {
    borderRadius: Spacing.four,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
    gap: Spacing.two,
    // 卡片自身的投影(提升悬浮层次感)
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: Spacing.one,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  flagBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: 999,
  },
  titleCol: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  word: {
    fontSize: 30,
    lineHeight: 38,
  },
  zh: {
    fontSize: 17,
    lineHeight: 26,
    fontWeight: '600',
    marginTop: Spacing.one,
  },
  en: {
    lineHeight: 22,
    marginTop: Spacing.one,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  smallBtn: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
  },
  studyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  studyHint: {
    marginRight: 'auto',
    lineHeight: 20,
  },
  pressed: {
    opacity: 0.6,
  },
});
