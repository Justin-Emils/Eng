import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import {
  WORDS_PER_ROUND,
  START_BAND,
  decideBandStep,
  estimateFromRounds,
  nextBand,
  sampleAssessmentWords,
  type BandResult,
  type AssessEstimate,
  type AssessWord,
} from '@/domain/assessment';
import { VOCAB_BANDS, bandLabel } from '@/domain/wordlevel';
import { vocabToCefr } from '@/domain/levels';
import { useTheme } from '@/hooks/use-theme';
import { saveUserLevel } from '@/storage/user';

type Mode = 'intro' | 'testing' | 'pick' | 'result';

/** 每词一次作答记录 */
interface Answer {
  word: string;
  threshold: number;
  known: boolean;
}

/**
 * 水平评估页(自适应):
 * - 复用逐词作答 UI:每词大按钮「认识 / 不认识」;
 * - 从中间档开始,一档抽 WORDS_PER_ROUND 词作答,按正确率自动升/降档,
 *   收敛或达到最大轮数后结束 → 输出与正文标蓝同刻度的词汇量。
 */
export default function AssessmentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { from } = useLocalSearchParams<{ from?: string }>();

  const [mode, setMode] = useState<Mode>('intro');
  const [pickedLevel, setPickedLevel] = useState<number | null>(null);
  const [result, setResult] = useState<AssessEstimate | null>(null);

  // --- 自适应测试状态 ---
  const [currentBand, setCurrentBand] = useState<number>(START_BAND);
  const [roundAnswers, setRoundAnswers] = useState<Answer[]>([]); // 当前轮已答
  const [rounds, setRounds] = useState<BandResult[]>([]); // 已结束轮
  const [roundWords, setRoundWords] = useState<AssessWord[]>([]);
  const [usedWords, setUsedWords] = useState<Set<string>>(new Set());
  const [roundIndex, setRoundIndex] = useState(0); // 全局轮数(上限)

  const [assessmentError, setAssessmentError] = useState<string | null>(null);

  const maxRounds = 4;

  const startTest = () => {
    const firstWords = sampleAssessmentWords(START_BAND, WORDS_PER_ROUND);
    setAssessmentError(null);
    setResult(null);
    if (firstWords.length === 0) {
      setRoundWords([]);
      setRoundAnswers([]);
      setMode('intro');
      setAssessmentError('当前题库暂时没有可用的评估词，请稍后重试或直接选择水平。');
      return;
    }
    setCurrentBand(START_BAND);
    setRoundAnswers([]);
    setRounds([]);
    setRoundWords(firstWords);
    setUsedWords(new Set(firstWords.map((item) => item.word)));
    setRoundIndex(0);
    setMode('testing');
  };

  const currentWord = roundWords[roundAnswers.length]?.word;

  const finishAssessment = (completedRounds: BandResult[]) => {
    const est = estimateFromRounds(completedRounds);
    if (!est) return false;
    setResult(est);
    setMode('result');
    return true;
  };

  const answer = async (known: boolean) => {
    if (!currentWord) return;
    const nextAnswers = [...roundAnswers, { word: currentWord, threshold: currentBand, known }];
    setRoundAnswers(nextAnswers);
    // 该轮答满或词耗尽 → 结算本轮
    const done = nextAnswers.length >= roundWords.length;
    if (done) {
      const bandResult: BandResult = {
        threshold: currentBand,
        total: nextAnswers.length,
        known: nextAnswers.filter((a) => a.known).length,
      };
      const newRounds = [...rounds, bandResult];
      const step = decideBandStep(bandResult);
      const nextIdx = roundIndex + 1;
      if (step === 'settle' || nextIdx >= maxRounds) {
        finishAssessment(newRounds);
        return;
      }
      const next =
        step === 'up'
          ? nextBand(currentBand, 'up')
          : step === 'down'
            ? nextBand(currentBand, 'down')
            : null;
      if (next == null) {
        finishAssessment(newRounds);
        return;
      }
      const nextWords = sampleAssessmentWords(next, WORDS_PER_ROUND, usedWords);
      if (nextWords.length === 0) {
        finishAssessment(newRounds);
        return;
      }
      setRounds(newRounds);
      setRoundIndex(nextIdx);
      setCurrentBand(next);
      setRoundWords(nextWords);
      setUsedWords((previous) => {
        const merged = new Set(previous);
        for (const item of nextWords) merged.add(item.word);
        return merged;
      });
      setRoundAnswers([]);
    }
  };

  const finishPick = () => {
    if (pickedLevel == null) return;
    const pickedEst: AssessEstimate = {
      vocab: pickedLevel,
      level: vocabToCefr(pickedLevel),
      finalThreshold: pickedLevel,
      totalWords: 0,
      knownWords: 0,
      bandLabel: bandLabel(pickedLevel),
    };
    setResult(pickedEst);
    setMode('result');
  };

  const saveAndLeave = async () => {
    if (!result) return;
    await saveUserLevel({ vocab: result.vocab, level: result.level, assessed: true, updatedAt: Date.now() });
    if (from === 'profile') {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const answeredInRound = roundAnswers.length;
  const progressText =
    mode === 'testing'
      ? currentWord
        ? `第 ${answeredInRound + 1} 词 · ${bandLabel(currentBand)}(${currentBand} 词量)`
        : '判定中…'
      : '';

  return (
    <ThemedView style={styles.flex}>
      {/* 顶栏 */}
      <View style={[styles.topBar, { paddingTop: insets.top + Spacing.two }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => pressed && styles.pressed}>
          <ThemedText style={styles.backIcon} themeColor="accent">
            ‹
          </ThemedText>
        </Pressable>
        <ThemedText type="smallBold" style={styles.topTitle}>
          水平评估
        </ThemedText>
        <View style={styles.topRight} />
      </View>

      {mode === 'intro' ? (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.six }]}>
          <View style={styles.section}>
            <ThemedText type="subtitle" style={styles.title}>
              你的英语词汇量?
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.paragraph}>
              采用自适应测试:从中间难度开始,根据你的作答自动升/降难度,
              一般几分钟内收敛。结果用于标蓝与推荐文章难度。
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.paragraph}>
              每一轮会从对应能力水平范围内随机抽取最多 5 个词，并尽量避免重复。
            </ThemedText>
            {assessmentError ? (
              <ThemedView type="backgroundElement" style={styles.errorBox}>
                <ThemedText type="small" themeColor="textSecondary">
                  {assessmentError}
                </ThemedText>
              </ThemedView>
            ) : null}
            <Pressable onPress={startTest} style={({ pressed }) => pressed && styles.pressed}>
              <ThemedView type="backgroundSelected" style={styles.actionBtn}>
                <ThemedText type="smallBold" themeColor="accent">
                  开始自适应测试
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  每个词选「认识 / 不认识」即可
                </ThemedText>
              </ThemedView>
            </Pressable>
            <Pressable onPress={() => setMode('pick')} style={({ pressed }) => pressed && styles.pressed}>
              <ThemedView type="backgroundElement" style={styles.actionBtn}>
                <ThemedText type="smallBold">直接自选水平</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  按考试目标档位手动选
                </ThemedText>
              </ThemedView>
            </Pressable>
          </View>
        </ScrollView>
      ) : mode === 'testing' ? (
        /* 逐词作答:全屏大按钮,复用复习交互 */
        <View style={styles.testArea}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.progress}>
            {progressText}
          </ThemedText>

          <View style={styles.wordStage}>
            {currentWord ? (
              <>
                <ThemedText type="title" style={styles.wordText}>
                  {currentWord}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  你认识这个词吗?(认识≈见过且懂大致含义)
                </ThemedText>
              </>
            ) : (
              <ThemedText type="smallBold">正在评估下一档…</ThemedText>
            )}
          </View>

          <View style={[styles.gradeArea, { paddingBottom: insets.bottom + Spacing.four }]}>
            <Pressable
              onPress={() => void answer(false)}
              style={({ pressed }) => [
                styles.gradeBtn,
                { backgroundColor: theme.backgroundElement },
                pressed && styles.pressed,
              ]}>
              <ThemedText type="smallBold" style={{ color: theme.textSecondary, fontSize: 18 }}>
                不认识
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => void answer(true)}
              style={({ pressed }) => [
                styles.gradeBtn,
                { backgroundColor: theme.accent },
                pressed && styles.pressed,
              ]}>
              <ThemedText type="smallBold" style={styles.rememberText}>
                认识 ✓
              </ThemedText>
            </Pressable>
          </View>
        </View>
      ) : mode === 'pick' ? (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.six }]}>
          <View style={styles.section}>
            <ThemedText type="subtitle" style={styles.title}>
              自选水平
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.paragraph}>
              选一个最接近你的词汇量档位(≈考试水平)。
            </ThemedText>
            {VOCAB_BANDS.map((level) => {
              const active = pickedLevel === level;
              return (
                <Pressable
                  key={level}
                  onPress={() => setPickedLevel(level)}
                  style={({ pressed }) => pressed && styles.pressed}>
                  <ThemedView
                    type={active ? 'backgroundSelected' : 'backgroundElement'}
                    style={[styles.levelRow, active && { borderColor: theme.accent }]}>
                    <ThemedText type="smallBold" themeColor={active ? 'accent' : 'text'}>
                      {bandLabel(level)}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      约 {level} 词量
                    </ThemedText>
                  </ThemedView>
                </Pressable>
              );
            })}
            {pickedLevel != null ? (
              <Pressable onPress={finishPick} style={({ pressed }) => pressed && styles.pressed}>
                <ThemedView type="backgroundSelected" style={styles.actionBtn}>
                  <ThemedText type="smallBold" themeColor="accent">
                    确认选择 →
                  </ThemedText>
                </ThemedView>
              </Pressable>
            ) : null}
          </View>
        </ScrollView>
      ) : result ? (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.six }]}>
          <View style={styles.section}>
            <ThemedText type="subtitle" style={styles.title}>
              你的词汇量评估结果
            </ThemedText>
            <ThemedView type="backgroundElement" style={[styles.resultCard, { borderColor: theme.border }]}>
              <ThemedText type="small" themeColor="textSecondary">估计词汇量</ThemedText>
              <ThemedText type="title" themeColor="accent" style={styles.vocab}>
                {result.vocab}
              </ThemedText>
              <ThemedText type="smallBold">
                {bandLabel(result.finalThreshold)} · 约 {result.finalThreshold} 词档
              </ThemedText>
              {result.totalWords > 0 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  测试 {result.knownWords}/{result.totalWords} 认识
                </ThemedText>
              ) : null}
              <ThemedText type="small" themeColor="textSecondary" style={styles.paragraph}>
                保存后,正文会按此词汇量标蓝生词,并按生词密度推荐文章。
              </ThemedText>
            </ThemedView>
            <Pressable onPress={() => void saveAndLeave()} style={({ pressed }) => pressed && styles.pressed}>
              <ThemedView type="backgroundSelected" style={styles.actionBtn}>
                <ThemedText type="smallBold" themeColor="accent">
                  保存并开始
                </ThemedText>
              </ThemedView>
            </Pressable>
            <Pressable onPress={startTest} style={({ pressed }) => pressed && styles.pressed}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.retry}>
                重新测试
              </ThemedText>
            </Pressable>
          </View>
        </ScrollView>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
    gap: Spacing.two,
  },
  backIcon: { fontSize: 34, lineHeight: 36, marginTop: -4, paddingHorizontal: Spacing.one },
  topTitle: { flex: 1, textAlign: 'center' },
  topRight: { width: 40 },
  content: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
  },
  section: { gap: Spacing.three },
  title: { fontSize: 24, lineHeight: 32 },
  paragraph: { lineHeight: 20 },
  errorBox: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  actionBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
    gap: Spacing.half,
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  resultCard: {
    padding: Spacing.four,
    borderRadius: Spacing.four,
    borderWidth: 1,
    alignItems: 'center',
    gap: Spacing.two,
  },
  vocab: { fontSize: 48, lineHeight: 56 },
  retry: { textAlign: 'center', lineHeight: 24 },

  // 逐词测试
  testArea: {
    flex: 1,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
  },
  progress: { marginTop: Spacing.two, textAlign: 'center' },
  wordStage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.three,
  },
  wordText: { fontSize: 42, lineHeight: 52, textAlign: 'center' },
  gradeArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginTop: 'auto',
    paddingTop: Spacing.three,
  },
  gradeBtn: {
    flex: 1,
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.four,
  },
  rememberText: {
    fontSize: 18,
    color: '#ffffff',
    fontWeight: '700',
  },
  pressed: { opacity: 0.6 },
});
