import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ArticleCover } from '@/components/article-cover';
import { EmptyState } from '@/components/empty-state';
import { RecommendCard } from '@/components/recommend-card';
import { SkeletonList } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { getArticleById, getAllArticles } from '@/data/articles';
import { hydrateRemoteArticles } from '@/data/articles/remote-registry';
import { bandLabelOf, CEFR_REPRESENTATIVE_VOCAB } from '@/domain/levels';
import { recommendFor } from '@/domain/recommend';
import { computeStreak } from '@/domain/stats';
import { useCompletedArticleIds } from '@/hooks/use-completed-articles';
import { useTheme } from '@/hooks/use-theme';
import { getCheckinDateKeys, getCheckedArticleIdsOn, todayKey } from '@/storage/checkins';
import { getAllKnown, getAllLearned, getLearnedToday } from '@/storage/learning';
import { getInProgressArticles } from '@/storage/progress';
import { getSettings } from '@/storage/settings';
import { DEFAULT_USER_LEVEL, getUserLevel } from '@/storage/user';
import { getDueWords, getWords } from '@/storage/words';
import type { Article, ReadingProgress, UserLevel } from '@/types';

/** 按时间给一句问候 */
function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 6) return '夜深了';
  if (h < 11) return '早上好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
}

function todayLabel(now = new Date()): string {
  const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][now.getDay()];
  return `${now.getMonth() + 1} 月 ${now.getDate()} 日 · ${week}`;
}

/**
 * 首页「今日」= 学习仪表盘:
 * - 顶部问候 + 连续打卡;
 * - 今日目标(已读篇数 / 今日新学词 / 待复习 + 进度);
 * - 继续阅读(上次没读完的文章,一键续读);
 * - 为你挑选(按你的水平高 1 档的 2 篇);
 * - 快捷入口(待复习 / 生词本 / 我的水平)。
 * 含加载骨架、空状态与下拉刷新。
 */
export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();
  const completedIds = useCompletedArticleIds();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [nickname, setNickname] = useState('');
  const [streak, setStreak] = useState(0);
  const [todayRead, setTodayRead] = useState(0);
  const [goalArticles, setGoalArticles] = useState(1);
  const [learnedTodayCount, setLearnedTodayCount] = useState(0);
  const [dueCount, setDueCount] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [continueReading, setContinueReading] = useState<{
    article: Article;
    progress: ReadingProgress;
  } | null>(null);
  const [userLevel, setUserLevel] = useState<UserLevel>(DEFAULT_USER_LEVEL);
  const [learned, setLearned] = useState<ReadonlySet<string>>(new Set());
  const [known, setKnown] = useState<ReadonlySet<string>>(new Set());

  const load = useCallback(async () => {
    const [
      todayIds,
      settings,
      level,
      learnedAll,
      knownAll,
      learnedTodaySet,
      dueWords,
      allWords,
      dateKeys,
      inProgress,
    ] = await Promise.all([
      getCheckedArticleIdsOn(todayKey()),
      getSettings(),
      getUserLevel(),
      getAllLearned(),
      getAllKnown(),
      getLearnedToday(),
      getDueWords(),
      getWords(),
      getCheckinDateKeys(),
      getInProgressArticles(),
    ]);

    setNickname(settings.nickname ?? '');
    setTodayRead(todayIds.length);
    setGoalArticles(settings.dailyGoal.articles);
    setUserLevel(level);
    setLearned(learnedAll);
    setKnown(knownAll);
    setLearnedTodayCount(learnedTodaySet.size);
    setDueCount(dueWords.length);
    setWordCount(allWords.length);
    setStreak(computeStreak(dateKeys));

    // 最近在读、且文章还在的一篇
    const first = inProgress.find((p) => getArticleById(p.articleId));
    const article = first ? getArticleById(first.articleId) : undefined;
    setContinueReading(first && article ? { article, progress: first } : null);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      load()
        .catch(() => {})
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await hydrateRemoteArticles();
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const userVocab = useMemo(
    () =>
      (userLevel.assessed ? userLevel.vocab : undefined) ??
      CEFR_REPRESENTATIVE_VOCAB[userLevel.level],
    [userLevel],
  );

  const picks = useMemo(
    () =>
      recommendFor({
        articles: getAllArticles(),
        userVocab,
        learned,
        known,
        count: 2,
        excludeIds: completedIds,
      }),
    [userVocab, learned, known, completedIds],
  );

  const goalPercent =
    goalArticles > 0 ? Math.min(100, Math.round((todayRead / goalArticles) * 100)) : 0;
  const remaining = Math.max(0, goalArticles - todayRead);

  const continuePercent = continueReading
    ? Math.min(
        95,
        Math.round(
          ((continueReading.progress.paragraphIndex + 1) /
            Math.max(1, continueReading.article.paragraphs.length)) *
            100,
        ),
      )
    : 0;

  return (
    <ThemedView style={styles.flex}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + Spacing.three,
            paddingBottom: insets.bottom + BottomTabInset + Spacing.four,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={theme.accent}
            colors={[theme.accent]}
          />
        }>
        {/* 问候 + 连续打卡 */}
        <View style={styles.greetRow}>
          <View style={styles.greetText}>
            <ThemedText type="subtitle" style={styles.greet}>
              {greeting()}
              {nickname ? `,${nickname}` : ''}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {todayLabel()}
            </ThemedText>
          </View>
          {streak > 0 ? (
            <ThemedView type="backgroundSelected" style={styles.streakBadge}>
              <ThemedText type="smallBold" themeColor="accent">
                🔥 连续 {streak} 天
              </ThemedText>
            </ThemedView>
          ) : null}
        </View>

        {/* 未评估引导 */}
        {!userLevel.assessed ? (
          <Pressable
            onPress={() => router.push('/assessment')}
            style={({ pressed }) => pressed && styles.pressed}>
            <ThemedView type="backgroundSelected" style={styles.assessBanner}>
              <ThemedText type="smallBold" themeColor="accent">
                先花 1 分钟做个水平评估 →
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.bannerSub}>
                评估后按「比你高 1 档」推荐;现在按 {bandLabelOf(userVocab)} 估计
              </ThemedText>
            </ThemedView>
          </Pressable>
        ) : null}

        {loading ? (
          <SkeletonList count={3} />
        ) : (
          <>
            {/* 今日目标 */}
            <ThemedView type="backgroundElement" style={styles.card}>
              <View style={styles.cardHead}>
                <ThemedText type="smallBold">今日目标</ThemedText>
                <ThemedText type="smallBold" themeColor="accent">
                  {todayRead} / {goalArticles} 篇
                </ThemedText>
              </View>
              <View style={styles.statRow}>
                <View style={styles.stat}>
                  <ThemedText style={styles.statNum}>{learnedTodayCount}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    今日新学词
                  </ThemedText>
                </View>
                <View style={styles.stat}>
                  <ThemedText style={styles.statNum}>{dueCount}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    待复习
                  </ThemedText>
                </View>
                <View style={styles.statProgress}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {remaining > 0 ? `还差 ${remaining} 篇完成目标` : '🎉 今日目标已达成'}
                  </ThemedText>
                  <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
                    <View
                      style={[
                        styles.fill,
                        { width: `${goalPercent}%`, backgroundColor: theme.accent },
                      ]}
                    />
                  </View>
                </View>
              </View>
            </ThemedView>

            {/* 继续阅读 */}
            {continueReading ? (
              <Pressable
                onPress={() => router.push(`/article/${continueReading.article.id}`)}
                style={({ pressed }) => pressed && styles.pressed}>
                <ThemedView type="backgroundElement" style={styles.card}>
                  <ThemedText type="smallBold" style={styles.cardHead2}>
                    继续阅读
                  </ThemedText>
                  <View style={styles.continueRow}>
                    <View style={styles.continueCover}>
                      <ArticleCover article={continueReading.article} size="thumb" />
                    </View>
                    <View style={styles.continueBody}>
                      <ThemedText type="smallBold" numberOfLines={2} style={styles.continueTitle}>
                        {continueReading.article.title}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        已读 {continuePercent}% · 约 {continueReading.article.difficulty.minutes} 分钟
                      </ThemedText>
                      <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
                        <View
                          style={[
                            styles.fill,
                            { width: `${continuePercent}%`, backgroundColor: theme.accent },
                          ]}
                        />
                      </View>
                    </View>
                  </View>
                </ThemedView>
              </Pressable>
            ) : null}

            {/* 为你挑选 */}
            <View style={styles.sectionHead}>
              <ThemedText type="smallBold">为你挑选</ThemedText>
              <Pressable onPress={() => router.push('/(tabs)/library')}>
                <ThemedText type="small" themeColor="textSecondary">
                  按你的 {userVocab} 词 · 查看更多 ›
                </ThemedText>
              </Pressable>
            </View>

            {picks.length === 0 ? (
              <EmptyState
                emoji="🎉"
                title="文章都读完了"
                description="公版短文每天自动更新,也可以去文章库挑一篇新的"
                actionLabel="去文章库"
                onAction={() => router.push('/(tabs)/library')}
              />
            ) : (
              picks.map((p) => (
                <RecommendCard
                  key={p.article.id}
                  data={{
                    article: p.article,
                    bandId: p.bandLabel.split(' ')[0],
                    requiredVocab: p.requiredVocab,
                    coverage: p.coverage,
                    fit: p.fit,
                    learnableCount: p.learnableCount,
                    sampleNewWords: p.sampleNewWords,
                  }}
                />
              ))
            )}

            {/* 快捷入口 */}
            <View style={styles.quickRow}>
              <QuickTile
                value={String(dueCount)}
                label="待复习"
                onPress={() => router.push('/(tabs)/review')}
              />
              <QuickTile
                value={String(wordCount)}
                label="生词本"
                onPress={() => router.push('/(tabs)/words')}
              />
              <QuickTile
                value={bandLabelOf(userVocab).split(' ')[0]}
                label="我的水平"
                onPress={() => router.push('/(tabs)/profile')}
              />
            </View>
          </>
        )}
      </ScrollView>
    </ThemedView>
  );
}

function QuickTile({
  value,
  label,
  onPress,
}: {
  value: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.quickTileWrap, pressed && styles.pressed]}>
      <ThemedView type="backgroundElement" style={styles.quickTile}>
        <ThemedText style={styles.quickValue}>{value}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
      </ThemedView>
    </Pressable>
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
  greetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  greetText: { flex: 1, gap: 2 },
  greet: { fontSize: 24, lineHeight: 32 },
  streakBadge: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    borderRadius: 999,
  },
  assessBanner: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.half,
  },
  bannerSub: { lineHeight: 18 },
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardHead2: { marginBottom: Spacing.half },
  statRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.four },
  stat: { gap: 1 },
  statNum: { fontSize: 24, fontWeight: '800', lineHeight: 30 },
  statProgress: { flex: 1, gap: Spacing.one, paddingBottom: 2 },
  track: { height: 8, borderRadius: 999, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999 },
  continueRow: { flexDirection: 'row', gap: Spacing.three, alignItems: 'center' },
  continueCover: { width: 72 },
  continueBody: { flex: 1, gap: Spacing.one },
  continueTitle: { fontSize: 14.5, lineHeight: 20 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.one,
  },
  quickRow: { flexDirection: 'row', gap: Spacing.two + 2, marginTop: Spacing.one },
  quickTileWrap: { flex: 1 },
  quickTile: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    gap: 2,
  },
  quickValue: { fontSize: 18, fontWeight: '800' },
  pressed: { opacity: 0.85 },
});
