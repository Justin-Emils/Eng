import { useFocusEffect, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { getArticleById } from '@/data/articles';
import { computeStats, type LearningStats } from '@/domain/analytics';
import { wordsToCsv } from '@/domain/export';
import { computeStreak } from '@/domain/stats';
import { useDailyCorpus } from '@/hooks/use-daily-corpus';
import { useTheme } from '@/hooks/use-theme';
import {
  getAllCheckedArticleIds,
  getCheckedArticleIdsOn,
  getCheckinDateKeys,
  todayKey,
} from '@/storage/checkins';
import { getSettings, saveDailyGoal, type DailyGoal } from '@/storage/settings';
import { getUserLevel } from '@/storage/user';
import { getWords } from '@/storage/words';
import type { Article, UserLevel } from '@/types';

const GOAL_PRESETS: DailyGoal[] = [
  { articles: 1, reviewWords: 5 },
  { articles: 1, reviewWords: 10 },
  { articles: 2, reviewWords: 10 },
  { articles: 3, reviewWords: 20 },
];

function resolveArticles(ids: string[]): Article[] {
  return ids
    .map((aid) => getArticleById(aid))
    .filter((a): a is Article => Boolean(a));
}

/**
 * 「我的」页(模块 G):
 * - 统计:连续打卡、今日已读篇数/词数、累计篇数/词数、生词总数/已掌握;
 * - 每日目标(可切换预设);
 * - 导出生词本 CSV(复制到剪贴板,带 UTF-8 BOM 防乱码)。
 */
export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();

  const [stats, setStats] = useState<LearningStats | null>(null);
  const [goal, setGoal] = useState<DailyGoal | null>(null);
  const [exported, setExported] = useState(false);
  const [userLevel, setUserLevel] = useState<UserLevel | null>(null);
  const daily = useDailyCorpus();

  const refresh = useCallback(() => {
    let active = true;
    const load = async () => {
      const [words, allChecked, dateKeys, settings, todayIds, level] = await Promise.all([
        getWords(),
        getAllCheckedArticleIds(),
        getCheckinDateKeys(),
        getSettings(),
        getCheckedArticleIdsOn(todayKey()),
        getUserLevel(),
      ]);
      if (!active) return;
      setStats(
        computeStats({
          todayArticles: resolveArticles(todayIds),
          allReadArticles: resolveArticles([...allChecked]),
          words,
          streakDays: computeStreak(dateKeys, todayKey()),
        }),
      );
      setGoal(settings.dailyGoal);
      setUserLevel(level);
    };
    load().catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useFocusEffect(refresh);

  const handleSetGoal = async (g: DailyGoal) => {
    setGoal(g);
    await saveDailyGoal(g);
  };

  const handleExport = async () => {
    const words = await getWords();
    if (words.length === 0) {
      setExported(false);
      return;
    }
    // 加 UTF-8 BOM,Excel/记事本打开不乱码
    const csv = '\uFEFF' + wordsToCsv(words);
    await Clipboard.setStringAsync(csv);
    setExported(true);
    setTimeout(() => setExported(false), 2000);
  };

  return (
    <ThemedView style={styles.flex}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + Spacing.three,
            paddingBottom: insets.bottom + BottomTabInset + Spacing.four,
          },
        ]}>
        <View style={styles.headingWrap}>
          <ThemedText type="subtitle" style={styles.heading}>
            我的
          </ThemedText>
        </View>

        {/* 连续打卡横幅 */}
        <ThemedView type="backgroundElement" style={styles.streakCard}>
          <ThemedText type="title" themeColor="accent" style={styles.streakNumber}>
            {stats ? String(stats.streakDays) : '–'}
          </ThemedText>
          <View style={styles.streakTextWrap}>
            <ThemedText type="smallBold">连续打卡(天)</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              每天读完一篇短文即可保持
            </ThemedText>
          </View>
        </ThemedView>

        {/* 统计格子 */}
        <View style={styles.grid}>
          <StatTile
            label="今日已读"
            value={stats ? String(stats.todayArticles) : '–'}
            sub={`${stats?.todayWordsRead ?? 0} 词`}
          />
          <StatTile
            label="累计读完"
            value={stats ? String(stats.totalArticlesCompleted) : '–'}
            sub={`${stats?.totalWordsRead ?? 0} 词`}
          />
          <StatTile
            label="生词本"
            value={stats ? String(stats.wordCount) : '–'}
            sub={`已掌握 ${stats?.masteredCount ?? 0}`}
          />
        </View>

        {/* 每日目标 */}
        <ThemedView type="backgroundElement" style={styles.section}>
          <ThemedText type="smallBold">每日目标</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            当前:读 {goal?.articles ?? 1} 篇 · 复习 {goal?.reviewWords ?? 10} 词
          </ThemedText>
          <View style={styles.goalRow}>
            {GOAL_PRESETS.map((g) => {
              const active =
                goal?.articles === g.articles && goal?.reviewWords === g.reviewWords;
              return (
                <Pressable key={`${g.articles}-${g.reviewWords}`} onPress={() => void handleSetGoal(g)}>
                  <ThemedView
                    type={active ? 'backgroundSelected' : 'background'}
                    style={[
                      styles.goalChip,
                      { borderColor: active ? theme.accent : theme.border },
                    ]}>
                    <ThemedText type="smallBold" themeColor={active ? 'accent' : 'textSecondary'}>
                      {g.articles}篇/{g.reviewWords}词
                    </ThemedText>
                  </ThemedView>
                </Pressable>
              );
            })}
          </View>
        </ThemedView>

        {/* 每日语料(公版自动更新) */}
        <ThemedView type="backgroundElement" style={styles.section}>
          <View style={styles.levelRow}>
            <View style={styles.levelText}>
              <ThemedText type="smallBold">每日语料</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {daily.busy || daily.status.kind === 'running'
                  ? '正在抓取公版短文并切分入库…'
                  : `已入库 ${daily.remoteCount} 篇${daily.updatedToday ? '(今日已更新)' : '(今日未更新)'}`}
              </ThemedText>
              {daily.lastUpdate ? (
                <ThemedText type="small" themeColor="textSecondary">
                  最近更新:{daily.lastUpdate}
                </ThemedText>
              ) : null}
              {daily.manualResult ? (
                <ThemedText type="small" themeColor="accent">
                  {daily.manualResult}
                </ThemedText>
              ) : daily.status.kind === 'failed' ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {daily.status.detail}
                </ThemedText>
              ) : null}
            </View>
            <Pressable
              onPress={() => void daily.updateNow()}
              disabled={daily.busy || daily.status.kind === 'running'}
              style={({ pressed }) => pressed && styles.pressed}>
              <ThemedView
                type={daily.busy || daily.status.kind === 'running' ? 'backgroundElement' : 'backgroundSelected'}
                style={styles.smallCta}>
                {daily.busy || daily.status.kind === 'running' ? (
                  <ActivityIndicator size="small" color={theme.accent} />
                ) : (
                  <ThemedText type="smallBold" themeColor="accent">
                    立即更新 ›
                  </ThemedText>
                )}
              </ThemedView>
            </Pressable>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            每日首次打开 App 自动更新;来源为 Project Gutenberg 公版书籍,自动切分/标注后进入文章库。
          </ThemedText>
        </ThemedView>

        {/* 我的水平 */}
        <Pressable
          onPress={() => router.push({ pathname: '/assessment', params: { from: 'profile' } })}
          style={({ pressed }) => pressed && styles.pressed}>
          <ThemedView type="backgroundElement" style={styles.section}>
            <View style={styles.levelRow}>
              <View style={styles.levelText}>
                <ThemedText type="smallBold">我的水平</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {userLevel
                    ? userLevel.assessed
                      ? `${userLevel.level} · 约 ${userLevel.vocab ?? '–'} 词量`
                      : '未评估(默认 B1),点按重新评估'
                    : '加载中…'}
                </ThemedText>
              </View>
              <ThemedText type="small" themeColor="accent">
                {userLevel?.assessed ? '重新评估 ›' : '去评估 ›'}
              </ThemedText>
            </View>
          </ThemedView>
        </Pressable>

        {/* 工具入口 */}
        <View style={styles.actions}>
          <Pressable onPress={() => void handleExport()} style={({ pressed }) => pressed && styles.pressed}>
            <ThemedView type="backgroundElement" style={styles.actionRow}>
              <ThemedText type="small">导出生词本(CSV 复制到剪贴板)</ThemedText>
              <ThemedText type="small" themeColor={exported ? 'accent' : 'textSecondary'}>
                {exported ? '✓ 已复制' : '›'}
              </ThemedText>
            </ThemedView>
          </Pressable>

          <Pressable
            onPress={() => router.push('/words')}
            style={({ pressed }) => pressed && styles.pressed}>
            <ThemedView type="backgroundElement" style={styles.actionRow}>
              <ThemedText type="small">生词本管理</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">›</ThemedText>
            </ThemedView>
          </Pressable>
        </View>
        <ThemedText type="small" themeColor="textSecondary" style={styles.footnote}>
          复习在底部「复习」Tab;数据保存在本机,可随时导出。
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <ThemedView type="backgroundElement" style={styles.tile}>
      <ThemedText type="small" themeColor="textSecondary">{label}</ThemedText>
      <ThemedText type="subtitle" style={styles.tileValue}>{value}</ThemedText>
      {sub ? (
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {sub}
        </ThemedText>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  headingWrap: { gap: Spacing.one },
  heading: { fontSize: 28, lineHeight: 36 },
  streakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.four,
    borderRadius: Spacing.four,
    gap: Spacing.three,
  },
  streakNumber: { fontSize: 44, lineHeight: 52, minWidth: 64 },
  streakTextWrap: { flex: 1, gap: Spacing.half },
  grid: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  tile: {
    flex: 1,
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.half,
  },
  tileValue: { fontSize: 26, lineHeight: 32 },
  section: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  levelText: { gap: Spacing.half, flexShrink: 1 },
  smallCta: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
  },
  goalRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  goalChip: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: 999,
    borderWidth: 1,
  },
  actions: { gap: Spacing.two },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  footnote: {
    lineHeight: 18,
    textAlign: 'center',
  },
  pressed: { opacity: 0.6 },
});
