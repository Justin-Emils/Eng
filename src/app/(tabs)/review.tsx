import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { getArticleById } from '@/data/articles';
import { scheduleReview } from '@/domain/srs';
import { getAllLearningWords, getDueWords, updateWordReview } from '@/storage/words';
import { useTheme } from '@/hooks/use-theme';
import type { ReviewGrade, WordItem } from '@/types';

type Phase = 'idle' | 'running' | 'done';
/** 当前词卡状态:question=先回忆自评;answer=不记得后学习详情 */
type CardMode = 'question' | 'answer';

interface SessionTally {
  total: number;
  remembered: number;
  fuzzy: number;
  forgotten: number;
}

const EMPTY_TALLY: SessionTally = { total: 0, remembered: 0, fuzzy: 0, forgotten: 0 };

/**
 * 复习 Tab(模块 E):
 * - 回忆优先:先只显示单词 → 自评「记得 / 不记得」两档,不预先展示释义;
 *   可点单词区切换「例句提示」(含目标词的原文句,无释义);
 * - 自评按钮为页面下部两个大按钮;
 * - 选「不记得」→ 自动调度为 again 并进入学习详情(完整释义+例句),学完继续;
 * - 选「记得」→ 直接推进下一词;
 * - idle 提供「立即复习全部(不等到期)」与「只复习到期词」入口。
 */
export default function ReviewScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  const [phase, setPhase] = useState<Phase>('idle');
  const [queue, setQueue] = useState<WordItem[]>([]);
  const [cursor, setCursor] = useState(0);
  const [mode, setMode] = useState<CardMode>('question');
  const [hintOn, setHintOn] = useState(false); // 例句提示是否显示
  const [tally, setTally] = useState<SessionTally>(EMPTY_TALLY);
  const [dueCount, setDueCount] = useState(0);
  const [learningCount, setLearningCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const loadCounts = async () => {
        const [due, learning] = await Promise.all([getDueWords(), getAllLearningWords()]);
        if (!active) return;
        setDueCount(due.length);
        setLearningCount(learning.length);
      };
      loadCounts().catch(() => {});
      return () => {
        active = false;
      };
    }, []),
  );

  const current = queue[cursor];
  const total = queue.length;

  const advance = () => {
    if (cursor + 1 < total) {
      setCursor(cursor + 1);
      setMode('question');
      setHintOn(false);
    } else {
      setPhase('done');
    }
  };

  const startReview = async (source: 'due' | 'all') => {
    const list = source === 'due' ? await getDueWords() : await getAllLearningWords();
    if (list.length === 0) return;
    setQueue(list);
    setTally(EMPTY_TALLY);
    setCursor(0);
    setMode('question');
    setHintOn(false);
    setPhase('running');
  };

  const finishToIdle = async () => {
    setPhase('idle');
    const [due, learning] = await Promise.all([getDueWords(), getAllLearningWords()]);
    setQueue([]);
    setDueCount(due.length);
    setLearningCount(learning.length);
  };

  /** 记得 → good 推进 */
  const gradeCurrent = async (grade: ReviewGrade) => {
    if (!current || mode === 'answer') return;
    setTally((t) => ({
      ...t,
      total: t.total + 1,
      remembered: t.remembered + (grade === 'good' || grade === 'easy' ? 1 : 0),
      fuzzy: t.fuzzy + (grade === 'hard' ? 1 : 0),
      forgotten: t.forgotten + (grade === 'again' ? 1 : 0),
    }));
    const next = scheduleReview(current, grade);
    await updateWordReview({ ...current, status: next.status, review: next.review });
    if (grade === 'again') {
      setMode('answer');
    } else {
      advance();
    }
  };

  /** 不记得 → again + 学习详情 */
  const sourceTitle = current?.sourceArticleId
    ? getArticleById(current.sourceArticleId)?.title
    : undefined;
  // 例句优先级:收藏时记录的原文句 > 词典例句
  const example = current?.sourceSentence ?? current?.example;

  const contentPaddingBottom = insets.bottom + BottomTabInset + Spacing.four;

  return (
    <ThemedView style={styles.flex}>
      {/* 顶部标题区 */}
      <View style={[styles.headingWrap, { paddingTop: insets.top + Spacing.three }]}>
        <ThemedText type="subtitle" style={styles.heading}>
          复习
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          先回忆,再揭晓答案
        </ThemedText>
      </View>

      {phase === 'idle' ? (
        <View style={styles.centerBox}>
          <ThemedText type="subtitle">🔁</ThemedText>
          <ThemedText type="smallBold">
            {learningCount > 0
              ? `生词本有 ${learningCount} 词可复习`
              : '生词本是空的,先去阅读收藏吧'}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.centerHint}>
            看到单词先回忆中文,想不起再看例句提示或选「不记得」查看详情
          </ThemedText>

          {learningCount > 0 ? (
            <View style={styles.idleActions}>
              <Pressable
                onPress={() => void startReview('all')}
                style={({ pressed }) => pressed && styles.pressed}>
                <ThemedView type="backgroundSelected" style={styles.bigBtn}>
                  <ThemedText type="smallBold" themeColor="accent">
                    立即复习全部 {learningCount} 词
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    不等到期,随时开练
                  </ThemedText>
                </ThemedView>
              </Pressable>
              {dueCount > 0 ? (
                <Pressable
                  onPress={() => void startReview('due')}
                  style={({ pressed }) => pressed && styles.pressed}>
                  <ThemedView type="backgroundElement" style={styles.bigBtn}>
                    <ThemedText type="smallBold" themeColor="textSecondary">
                      只复习到期词 {dueCount} 个
                    </ThemedText>
                  </ThemedView>
                </Pressable>
              ) : (
                <ThemedText type="small" themeColor="textSecondary">
                  目前没有按计划到期的词
                </ThemedText>
              )}
            </View>
          ) : null}
        </View>
      ) : phase === 'done' ? (
        <View style={styles.centerBox}>
          <ThemedText type="subtitle">🎉</ThemedText>
          <ThemedText type="smallBold">本次复习完成</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.centerHint}>
            共 {tally.total} 词 · 记得 {tally.remembered} · 模糊 {tally.fuzzy} · 忘记 {tally.forgotten}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.centerHint}>
            忘记的词已重新排入学习,随时可再「立即复习」;记得的词按 1/2/4/7/15… 天推进间隔。
          </ThemedText>
          <Pressable
            onPress={() => void finishToIdle()}
            style={({ pressed }) => pressed && styles.pressed}>
            <ThemedView type="backgroundSelected" style={styles.bigBtn}>
              <ThemedText type="smallBold" themeColor="accent">
                完成
              </ThemedText>
            </ThemedView>
          </Pressable>
        </View>
      ) : current && mode === 'question' ? (
        /* 回忆卡:全屏布局,大按钮固定于中下部 */
        <View style={[styles.quizArea, { paddingBottom: contentPaddingBottom }]}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.progress}>
            第 {cursor + 1} / {total} 词
          </ThemedText>

          {/* 中部:单词 + 例句提示 */}
          <View style={styles.recallWrap}>
            <Pressable onPress={() => setHintOn((v) => !v)} style={styles.wordBox}>
              <ThemedText type="title" style={styles.wordText}>
                {current.headword}
              </ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.phonetic}>
                {current.pos}
                {sourceTitle ? ` · 来自《${sourceTitle}》` : ''}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.hintToggle}>
                {hintOn ? '点此隐藏例句提示' : '点这里看含该词的例句(提示,不给释义)'}
              </ThemedText>
            </Pressable>

            {hintOn ? (
              <ThemedView type="backgroundElement" style={styles.exampleBox}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.exampleTag}>
                  例句提示
                </ThemedText>
                {example ? (
                  <ThemedText type="small" style={styles.example}>
                    {example}
                  </ThemedText>
                ) : (
                  <ThemedText type="small" themeColor="textSecondary">
                    该词暂时没有例句,直接尝试回忆吧。
                  </ThemedText>
                )}
              </ThemedView>
            ) : null}
          </View>

          {/* 底部:两个等宽大按钮(水平居中占满一行) */}
          <View style={styles.gradeArea}>
            <View style={styles.gradeRow}>
              <Pressable
                onPress={() => void gradeCurrent('again')}
                style={({ pressed }) => [
                  styles.gradeBtn,
                  { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="smallBold" style={{ color: theme.textSecondary, fontSize: 18 }}>
                  不记得
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => void gradeCurrent('hard')}
                style={({ pressed }) => [
                  styles.gradeBtn,
                  { backgroundColor: theme.backgroundSelected, borderColor: theme.border },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="smallBold" style={{ color: theme.textSecondary, fontSize: 18 }}>
                  模糊
                </ThemedText>
              </Pressable>
            </View>
            <View style={styles.gradeRow}>
              <Pressable
                onPress={() => void gradeCurrent('good')}
                style={({ pressed }) => [
                  styles.gradeBtn,
                  { backgroundColor: theme.accent },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="smallBold" style={styles.rememberText}>
                  记得 ✓
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => void gradeCurrent('easy')}
                style={({ pressed }) => [
                  styles.gradeBtn,
                  { backgroundColor: theme.accent },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="smallBold" style={styles.rememberText}>
                  很熟
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      ) : current ? (
        /* 不记得后的学习详情:同样全屏,释义可滚动,底部大按钮 */
        <View style={styles.learnArea}>
          <View style={styles.learnTop}>
            <ThemedView type="backgroundSelected" style={styles.learnTag}>
              <ThemedText type="smallBold" themeColor="accent">
                已标记为「不记得」,学一下再继续
              </ThemedText>
            </ThemedView>

            <ThemedText type="title" style={styles.wordText}>
              {current.headword}
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.phonetic}>
              {current.pos}
              {sourceTitle ? ` · 来自《${sourceTitle}》` : ''}
            </ThemedText>

            <ScrollView
              style={styles.learnScroll}
              contentContainerStyle={styles.learnScrollContent}
              showsVerticalScrollIndicator={false}>
              <ThemedText style={styles.zh}>{current.zh}</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.en}>
                {current.en}
              </ThemedText>
              {example ? (
                <ThemedView type="backgroundElement" style={styles.exampleBox}>
                  <ThemedText type="small" style={styles.example}>
                    {example}
                  </ThemedText>
                </ThemedView>
              ) : null}
            </ScrollView>
          </View>

          <View style={[styles.learnAction, { paddingBottom: contentPaddingBottom }]}>
            <Pressable
              onPress={advance}
              style={({ pressed }) => [
                styles.continueBtn,
                { backgroundColor: theme.accent },
                pressed && styles.pressed,
              ]}>
              <ThemedText type="smallBold" style={styles.rememberText}>
                继续学习 →
              </ThemedText>
            </Pressable>
          </View>
        </View>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headingWrap: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
    gap: Spacing.one,
  },
  heading: { fontSize: 28, lineHeight: 36 },

  // idle / done
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.six,
  },
  centerHint: { textAlign: 'center', lineHeight: 20 },
  idleActions: {
    alignItems: 'center',
    gap: Spacing.three,
    marginTop: Spacing.three,
    alignSelf: 'stretch',
  },
  bigBtn: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: Spacing.half,
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.five,
    borderRadius: Spacing.three,
    minWidth: 260,
  },

  // 回忆卡(running question)
  quizArea: {
    flex: 1,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
  },
  progress: { marginTop: Spacing.two },
  recallWrap: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.three,
  },
  wordBox: {
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.three,
  },
  wordText: {
    fontSize: 42,
    lineHeight: 52,
    textAlign: 'center',
  },
  phonetic: {
    textAlign: 'center',
    lineHeight: 22,
  },
  hintToggle: {
    textAlign: 'center',
    lineHeight: 18,
    marginTop: Spacing.two,
    opacity: 0.8,
  },
  exampleBox: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.half,
  },
  exampleTag: { letterSpacing: 0.5 },
  example: { fontStyle: 'italic', lineHeight: 22 },
  gradeArea: {
    alignItems: 'stretch',
    gap: Spacing.three,
    marginTop: 'auto',
    paddingTop: Spacing.three,
  },
  gradeRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: Spacing.three,
  },
  gradeBtn: {
    flex: 1,
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.four,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  rememberText: {
    fontSize: 18,
    color: '#ffffff',
    fontWeight: '700',
  },

  // 学习详情(answer)
  learnArea: {
    flex: 1,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
  },
  learnTop: {
    flex: 1,
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
  learnTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 999,
  },
  learnScroll: { flex: 1, marginTop: Spacing.two },
  learnScrollContent: {
    gap: Spacing.two,
    paddingBottom: Spacing.three,
  },
  zh: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600',
  },
  en: { lineHeight: 24 },
  learnAction: {
    paddingTop: Spacing.two,
  },
  continueBtn: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.four,
    borderRadius: Spacing.four,
  },
  pressed: { opacity: 0.7 },
});
