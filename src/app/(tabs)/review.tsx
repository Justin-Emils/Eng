import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import { Medallion } from '@/components/ornaments';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radii, BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { getArticleById } from '@/data/articles';
import {
  describeDue,
  MASTER_THRESHOLD,
  readOutcome,
  scheduleReview,
  stageOf,
  WORD_STAGE_LABEL,
  type ReviewOutcome,
} from '@/domain/srs';
import { getAllLearningWords, getDueWords, updateWordReview } from '@/storage/words';
import { recordReviewResult } from '@/storage/review-stats';
import { useTheme, useThemeSkin } from '@/hooks/use-theme';
import type { WordItem } from '@/types';

type Phase = 'idle' | 'running' | 'done';
/** 当前词卡状态:question=先回忆自评;answer=揭晓详情(记得/不记得都进这里) */
type CardMode = 'question' | 'answer';

/** 词卡自评只有两档:记得(good) / 不记得(again) */
type SelfGrade = 'good' | 'again';

interface SessionTally {
  total: number;
  remembered: number;
  forgotten: number;
  /** 本次会话里新转为「已巩固」的词数 */
  masteredNew: number;
}

const EMPTY_TALLY: SessionTally = { total: 0, remembered: 0, forgotten: 0, masteredNew: 0 };

/**
 * 复习 Tab(模块 E):
 * - 回忆优先:先只显示单词 → 自评「记得 / 不记得」两档,不预先展示释义;
 *   可点单词区切换「例句提示」(含目标词的原文句,无释义);
 * - 自评按钮为页面下部两个大按钮(**只有两档**:模糊/很熟已下线,
 *   它们与「记得」边界含糊,反而增加每次复习的决策成本);
 * - **两档都进入单词详情**(完整释义+例句),由用户看完手动点「下一条」翻页 ——
 *   不再"点了记得就跳走",用户始终有机会核对释义;
 * - **两档的结果必须不同(A1)**:
 *   · 记得 → SRS 等级 +1,间隔沿 1/2/4/7/15… 推进,连续答对 5 次转「已巩固」;
 *   · 不记得 → 等级清零,10 分钟后重新到期,并**当场重新排进今天队列的末尾**,
 *     所以同一个词会在本次复习里再考一次(而不是默默变成"学习中"就结束)。
 *   详情页顶部会把这次到底发生了什么写出来(见 ReviewOutcome),不让人靠猜。
 * - 详情页若当前是「记得」,提供「记错了,标为不记得」把本次自评改判为 again;
 * - idle 提供「立即复习全部(不等到期)」与「只复习到期词」入口。
 */
export default function ReviewScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const skin = useThemeSkin();
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>('idle');
  const [queue, setQueue] = useState<WordItem[]>([]);
  const [cursor, setCursor] = useState(0);
  const [mode, setMode] = useState<CardMode>('question');
  /** 当前词的最终自评:决定详情页文案,以及是否显示「记错了」回退按钮 */
  const [lastGrade, setLastGrade] = useState<SelfGrade | null>(null);
  /** 本次自评产生的**实际结果**(等级、下次到期、是否转已巩固),详情页照着它说明 */
  const [lastOutcome, setLastOutcome] = useState<ReviewOutcome | null>(null);
  const [hintOn, setHintOn] = useState(false); // 例句提示是否显示
  const [tally, setTally] = useState<SessionTally>(EMPTY_TALLY);
  const [dueCount, setDueCount] = useState(0);
  const [learningCount, setLearningCount] = useState(0);
  /**
   * 本次会话里已经"因答错而被重新排回队列"的词。
   * 每个词一轮最多回队一次:否则连续两次答错就会无限延长本次复习,永远做不完。
   */
  const requeuedRef = useRef<Set<string>>(new Set());

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
  /** 是否已是本次复习的最后一个词(决定详情页按钮写「下一条」还是「完成」) */
  const isLast = cursor + 1 >= total;

  const advance = () => {
    if (cursor + 1 < total) {
      setCursor(cursor + 1);
      setMode('question');
      setLastGrade(null);
      setLastOutcome(null);
      setHintOn(false);
    } else {
      setPhase('done');
    }
  };

  const startReview = async (source: 'due' | 'all') => {
    const list = source === 'due' ? await getDueWords() : await getAllLearningWords();
    if (list.length === 0) return;
    requeuedRef.current = new Set();
    setQueue(list);
    setTally(EMPTY_TALLY);
    setCursor(0);
    setMode('question');
    setLastGrade(null);
    setLastOutcome(null);
    setHintOn(false);
    setPhase('running');
  };

  const finishToIdle = async () => {
    setPhase('idle');
    requeuedRef.current = new Set();
    const [due, learning] = await Promise.all([getDueWords(), getAllLearningWords()]);
    setQueue([]);
    setDueCount(due.length);
    setLearningCount(learning.length);
  };

  /**
   * 自评。两档都先落库,再统一进入详情页(answer),等用户看完点「下一条」才翻页。
   * 这样「记得」也一定能看到释义核对,而不会一闪而过。
   *
   * **两档的结果必须不同(反馈 A1)**:
   *   · good  → SRS 等级 +1,间隔沿 1/2/4/7/15… 推进,连续答对 5 次转「已巩固」;
   *   · again → 等级清零、lapses+1,dueAt 重置为 10 分钟后(今天之内),
   *             并把**更新后的词**重新排进本次队列末尾 —— 同一个词今天还会再考一次。
   * 只写库不重排的话,用户选「不记得」后当场什么也没发生(这就是原来"两个按钮一样"的根源)。
   */
  const gradeCurrent = async (grade: SelfGrade) => {
    if (!current || mode !== 'question') return;
    const next = scheduleReview(current, grade);
    const outcome = readOutcome(current, grade, next);
    const updated: WordItem = { ...current, status: next.status, review: next.review };
    await updateWordReview(updated);
    // 复习结果反哺知识曲线(按词所在的档位累积,见 storage/review-stats)
    await recordReviewResult(current.headword, grade === 'good');
    setTally((t) => ({
      ...t,
      total: t.total + 1,
      remembered: t.remembered + (grade === 'good' ? 1 : 0),
      forgotten: t.forgotten + (grade === 'again' ? 1 : 0),
      masteredNew: t.masteredNew + (outcome.justMastered ? 1 : 0),
    }));
    if (grade === 'again' && !requeuedRef.current.has(updated.id)) {
      requeuedRef.current.add(updated.id);
      setQueue((q) => [...q, updated]);
    }
    setLastGrade(grade);
    setLastOutcome(outcome);
    setMode('answer');
  };

  /**
   * 详情页里的「记错了,标为不记得」:把本次自评从 good 改判为 again。
   *
   * 直接拿队列里的 current 按 again 重算即可 —— current 始终是**未改动的原始词条**
   * (我们只把新状态写进存储,不回写队列),所以这里等价于"当初就选不记得",
   * 不会在 good 的结果上叠加第二次调度。同时修正本次会话的统计口径,
   * 并按同样的规则把词排回队列末尾。
   */
  const markAsForgotten = async () => {
    if (!current || lastGrade !== 'good') return;
    const next = scheduleReview(current, 'again');
    const outcome = readOutcome(current, 'again', next);
    const updated: WordItem = { ...current, status: next.status, review: next.review };
    await updateWordReview(updated);
    // 改判:撤掉刚才那笔「记得」再记一笔「不记得」,账才对得上
    await recordReviewResult(current.headword, true, true);
    await recordReviewResult(current.headword, false);
    if (!requeuedRef.current.has(updated.id)) {
      requeuedRef.current.add(updated.id);
      setQueue((q) => [...q, updated]);
    }
    const wasMasteredNew = lastOutcome?.justMastered ?? false;
    setTally((t) => ({
      ...t,
      remembered: Math.max(0, t.remembered - 1),
      forgotten: t.forgotten + 1,
      masteredNew: Math.max(0, t.masteredNew - (wasMasteredNew ? 1 : 0)),
    }));
    setLastGrade('again');
    setLastOutcome(outcome);
  };

  /** 把一次复习的结果翻译成详情页上的一句话(结果不同 → 说法不同) */
  const outcomeHint = (outcome: ReviewOutcome): string => {
    if (outcome.reset) {
      return `等级已归零,${describeDue(outcome.dueAt)}重新到期,并且已排回今天队列末尾 —— 本次复习里还会再考你一次。`;
    }
    if (outcome.justMastered) {
      return `连续答对 ${MASTER_THRESHOLD} 次,已转为「已巩固」,不再进入常规复习队列(生词本里归到底部单独一区)。`;
    }
    return `再连续答对 ${outcome.toMastery} 次即转为「已巩固」;下次复习在 ${describeDue(outcome.dueAt)}。`;
  };

  /** 详情页要展示的来源与例句 */
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

      {phase === 'idle' && learningCount === 0 ? (
        <EmptyState
          emoji="🔁"
          title="还没有可复习的词"
          description="读文章时把生词标记为「学习」,它们会按 1/2/4/7/15… 天的间隔自动排进复习队列。"
          actionLabel="去读一篇"
          onAction={() => router.push('/(tabs)/library')}
        />
      ) : phase === 'idle' ? (
        <View style={styles.centerBox}>
          {skin.motifs ? <Medallion size={44} /> : <ThemedText type="subtitle">🔁</ThemedText>}
          <ThemedText type="smallBold">{`生词本有 ${learningCount} 词可复习`}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.centerHint}>
            看到单词先回忆中文,想不起可以看例句提示;选「记得 / 不记得」后都会显示释义,看完再点「下一条」
          </ThemedText>
          {/* 两个按钮各自会发生什么,直接写在按钮上面 —— 不然用户只能靠试(反馈 A1/D) */}
          <ThemedText type="small" themeColor="textSecondary" style={styles.centerHint}>
            「记得」= 等级 +1(连续答对 {MASTER_THRESHOLD} 次转为「已巩固」);
            「不记得」= 等级清零,并把这个词排回今天队列末尾,本次还会再考一次。
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
          {skin.motifs ? <Medallion size={44} /> : <ThemedText type="subtitle">🎉</ThemedText>}
          <ThemedText type="smallBold">本次复习完成</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.centerHint}>
            共 {tally.total} 词 · 记得 {tally.remembered} · 不记得 {tally.forgotten}
            {tally.masteredNew > 0 ? ` · 新巩固 ${tally.masteredNew}` : ''}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.centerHint}>
            记得的词按 1/2/4/7/15… 天推进间隔,连续答对 {MASTER_THRESHOLD} 次后转为「已巩固」;
            不记得的词等级已清零,已排回队列末尾并在生词本里回到「待复习」。
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
            第 {cursor + 1} / {total} 词 · {WORD_STAGE_LABEL[stageOf(current)]}
            {current.review.reps > 0 ? `(连续答对 ${current.review.reps}/${MASTER_THRESHOLD})` : ''}
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

          {/* 底部:两个等宽大按钮(只有「不记得 / 记得」两档)
              每个按钮上写清按下去会发生什么 —— 两档结果不同,不能长得一样 */}
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
                <ThemedText type="small" style={{ color: theme.textSecondary, opacity: 0.85 }}>
                  等级清零 · 排回今天队列
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => void gradeCurrent('good')}
                style={({ pressed }) => [
                  styles.gradeBtn,
                  { backgroundColor: theme.accentStrong },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="smallBold" themeColor="onAccentStrong" style={styles.rememberText}>
                  记得 ✓
                </ThemedText>
                <ThemedText
                  type="small"
                  themeColor="onAccentStrong"
                  style={styles.gradeSubOnAccent}>
                  等级 +1 · 间隔加长
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      ) : current ? (
        /* 单词详情:记得/不记得都落在这里,由用户在底部手动翻页 */
        <View style={styles.learnArea}>
          <View style={styles.learnTop}>
            <ThemedView type="backgroundSelected" radius="chip" style={styles.learnTag}>
              <ThemedText type="smallBold" themeColor="accent">
                {lastGrade === 'good'
                  ? '已标记为「记得」,核对一下释义'
                  : '已标记为「不记得」,学一下再继续'}
              </ThemedText>
            </ThemedView>

            {/* 这次自评**具体发生了什么**(等级/下次到期/是否转已巩固)——
                两个按钮的结果不同,就要让人当场看见差别 */}
            {lastOutcome ? (
              <ThemedView
                type="backgroundElement"
                style={[
                  styles.outcomeBox,
                  { borderColor: lastOutcome.reset ? theme.danger : theme.success },
                ]}>
                <ThemedText
                  type="smallBold"
                  style={{ color: lastOutcome.reset ? theme.danger : theme.success }}>
                  {lastOutcome.reset
                    ? '✗ 不认识:SRS 等级已重置'
                    : lastOutcome.justMastered
                      ? '✓ 认识:已转为「已巩固」'
                      : `✓ 认识:SRS 等级 +1(连续答对 ${lastOutcome.reps}/${MASTER_THRESHOLD})`}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.outcomeHint}>
                  {outcomeHint(lastOutcome)}
                </ThemedText>
              </ThemedView>
            ) : null}

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
            {/* 选「记得」才有回退:看完释义发现其实想不起来,可当场改判为不记得 */}
            {lastGrade === 'good' ? (
              <Pressable
                onPress={() => void markAsForgotten()}
                style={({ pressed }) => [
                  styles.continueBtn,
                  styles.mistakeBtn,
                  { borderColor: theme.border },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="smallBold" themeColor="textSecondary" style={styles.rememberText}>
                  记错了,标为不记得
                </ThemedText>
              </Pressable>
            ) : null}

            <Pressable
              onPress={advance}
              style={({ pressed }) => [
                styles.continueBtn,
                { backgroundColor: theme.accentStrong },
                pressed && styles.pressed,
              ]}>
              <ThemedText type="smallBold" themeColor="onAccentStrong" style={styles.rememberText}>
                {isLast ? '完成 →' : '下一条 →'}
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
    borderRadius: Radii.card,
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
    borderRadius: Radii.card,
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
    gap: Spacing.half,
    borderRadius: Spacing.four,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  rememberText: {
    fontSize: 18,
    fontWeight: '700',
  },
  /** 主按钮上的副标题:用 onAccentStrong + 降透明度,保证实心底色上仍可读 */
  gradeSubOnAccent: {
    opacity: 0.85,
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
    borderRadius: Radii.sharp,
  },
  learnScroll: { flex: 1, marginTop: Spacing.two },
  /** 本次自评的结果块:描边用主题的成功色/危险色,深色模式下同样可读 */
  outcomeBox: {
    borderRadius: Radii.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    gap: Spacing.half,
  },
  outcomeHint: { lineHeight: 20 },
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
    gap: Spacing.two,
  },
  continueBtn: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.four,
    borderRadius: Spacing.four,
  },
  /** 「记错了」是次要动作:描边样式,不与主按钮「下一条」抢视觉重量 */
  mistakeBtn: {
    backgroundColor: 'transparent',
    borderWidth: StyleSheet.hairlineWidth,
  },
  pressed: { opacity: 0.7 },
});
