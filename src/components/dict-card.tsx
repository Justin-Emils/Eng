import { useEffect, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radii, Spacing } from '@/constants/theme';
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
}: {
  result: LookupResult | null;
  visible: boolean;
  /** 加入生词本所需的来源上下文 */
  source: WordSource;
  onOpenDetail: (headword: string) => void;
  onClose: () => void;
  /** 是否命中考研/外部词表(旧标记,保持兼容) */
  kaoyan?: boolean;
}) {

  const theme = useTheme();
  const entry = result?.entry;
  /**
   * 当前操作的词形:命中词典用 headword,未收录则用查询词本身。
   * 未收录也要能加入生词本 / 标记学习(否则按钮看起来能点却毫无反应)。
   */
  const displayWord = entry ? entry.headword : (result?.query ?? '');
  const headword = displayWord;

  const { saved, toggle } = useWordSaved(headword);

  // 缩放 + 淡入(一次,无 overshoot)。useState 惰性持有 Animated.Value(React Compiler 友好)
  const [scale] = useState(() => new Animated.Value(0.92));
  const [fade] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (visible) {
      scale.setValue(0.92);
      fade.setValue(0);
      Animated.parallel([
        Animated.timing(scale, { toValue: 1, duration: 110, useNativeDriver: true }),
        Animated.timing(fade, { toValue: 1, duration: 110, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, scale, fade]);

  const handleSave = async () => {
    if (!displayWord) return;
    await toggle({
      word: result?.query || displayWord,
      headword: displayWord,
      // 未收录词:释义留空,先存下来(可在词条详情/复习时补),来源句一并保留
      phonetic: entry?.phonetic,
      pos: entry?.pos ?? '',
      zh: entry?.zh ?? '',
      en: entry?.en ?? '',
      example: entry?.example,
      sourceArticleId: source.articleId,
      sourceSentence: source.sentence,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
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
                  <ThemedView type="backgroundSelected" radius="chip" style={styles.flagBadge}>
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

            {/*
              这里原来有「＋ 今日学习」「我会了」两个按钮,现已删除:
              · 加入生词本即等于今日新学 +1(见 storage/words.ts 的 toggleWordSave),
                不再需要一个专门标记"今日学习"的按钮;
              · 「我会了」的判定改由复习流程承担 —— 生词本只负责"收",
                是否掌握由复习的自评结果决定(见 domain/srs 与复习页),
                这样知识曲线才有一个可信的数据来源,而不是靠随手一个按钮。
            */}

            {/* 小按钮行:详情 / 收藏 / 关闭(未收录词也允许详情与收藏) */}
            <View style={styles.actions}>
              {displayWord ? (
                <Pressable
                  onPress={() => onOpenDetail(displayWord)}
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
                onPress={() => void handleSave()}
                disabled={!displayWord}
                style={({ pressed }) => pressed && styles.pressed}>
                <ThemedView
                  type={saved ? 'backgroundElement' : 'backgroundSelected'}
                  style={styles.smallBtn}>
                  <ThemedText
                    type="smallBold"
                    style={{ color: saved ? theme.textSecondary : theme.accent }}>
                    {saved ? '✓ 已收藏 · 点按移出' : '＋ 生词本'}
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
    borderRadius: Radii.sharp,
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
    borderRadius: Radii.card,
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
