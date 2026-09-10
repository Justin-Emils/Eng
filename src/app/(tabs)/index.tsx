import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ArticleCard } from '@/components/article-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { getAllArticles } from '@/data/articles';
import { CEFR_REPRESENTATIVE_VOCAB } from '@/domain/levels';
import { recommendFor } from '@/domain/recommend';
import { useCompletedArticleIds } from '@/hooks/use-completed-articles';
import { useTheme } from '@/hooks/use-theme';
import { getCheckedArticleIdsOn, todayKey } from '@/storage/checkins';
import { getAllKnown, getAllLearned } from '@/storage/learning';
import { getSettings } from '@/storage/settings';
import { DEFAULT_USER_LEVEL, getUserLevel } from '@/storage/user';
import type { UserLevel } from '@/types';

/**
 * 首页「今日推荐」:
 * - 未评估引导 + 今日目标进度条;
 * - 推荐按用户词汇量 + 已学/已会集合,筛出"生词密度合适"的文章;
 * - 每篇带推荐理由 + 已读角标。
 */
export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();
  const completedIds = useCompletedArticleIds();

  const [todayRead, setTodayRead] = useState(0);
  const [goalArticles, setGoalArticles] = useState(1);
  const [userLevel, setUserLevel] = useState<UserLevel>(DEFAULT_USER_LEVEL);
  const [learned, setLearned] = useState<Set<string>>(new Set());
  const [known, setKnown] = useState<Set<string>>(new Set());

  const reloadSets = useCallback(async () => {
    const [learnedAll, knownAll] = await Promise.all([getAllLearned(), getAllKnown()]);
    setLearned(learnedAll);
    setKnown(knownAll);
  }, []);

  // 每次聚焦刷新进度 / 用户水平 / 学习集合
  useFocusEffect(
    useCallback(() => {
      let active = true;
      const load = async () => {
        const [todayIds, settings, level] = await Promise.all([
          getCheckedArticleIdsOn(todayKey()),
          getSettings(),
          getUserLevel(),
        ]);
        if (!active) return;
        setTodayRead(todayIds.length);
        setGoalArticles(settings.dailyGoal.articles);
        setUserLevel(level);
        await reloadSets();
      };
      load().catch(() => {});
      return () => {
        active = false;
      };
    }, [reloadSets]),
  );

  const userVocab =
    (userLevel.assessed ? userLevel.vocab : undefined) ??
    CEFR_REPRESENTATIVE_VOCAB[userLevel.level];

  const picks = useMemo(
    () =>
      recommendFor({
        articles: getAllArticles(),
        userVocab,
        learned,
        known,
        count: 3,
        excludeIds: completedIds,
      }),
    [userVocab, learned, known, completedIds],
  );

  const percent =
    goalArticles > 0 ? Math.min(100, Math.round((todayRead / goalArticles) * 100)) : 0;

  const header = (
    <View>
      {/* 标题 */}
      <View style={styles.headingWrap}>
        <ThemedText type="subtitle" style={styles.heading}>
          今日推荐
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {userLevel.assessed
            ? `根据你的水平 ${userLevel.level}(约 ${userVocab} 词)为你挑选`
            : '先做水平评估,推荐会更贴合你的词汇量'}
        </ThemedText>
      </View>

      {/* 未评估引导 */}
      {!userLevel.assessed ? (
        <Pressable
          onPress={() => router.push('/assessment')}
          style={({ pressed }) => pressed && styles.pressed}>
          <ThemedView type="backgroundSelected" style={styles.assessBanner}>
            <ThemedText type="smallBold" themeColor="accent">
              去做 1 分钟水平评估 →
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              当前按 B1(约 2800 词)推荐
            </ThemedText>
          </ThemedView>
        </Pressable>
      ) : null}

      {/* 今日目标进度 */}
      <ThemedView type="backgroundElement" style={styles.progressCard}>
        <View style={styles.progressTop}>
          <ThemedText type="smallBold">今日目标</ThemedText>
          <ThemedText type="smallBold" themeColor="accent">
            {todayRead} / {goalArticles} 篇
          </ThemedText>
        </View>
        <View style={[styles.progressTrack, { backgroundColor: theme.backgroundSelected }]}>
          <View
            style={[styles.progressFill, { width: `${percent}%`, backgroundColor: theme.accent }]}
          />
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {todayRead >= goalArticles && goalArticles > 0
            ? '🎉 今日阅读目标已完成'
            : `还差 ${Math.max(0, goalArticles - todayRead)} 篇,加油!`}
        </ThemedText>
      </ThemedView>
    </View>
  );

  return (
    <ThemedView style={styles.flex}>
      <FlatList
        data={picks}
        keyExtractor={(p) => p.article.id}
        ListHeaderComponent={header}
        renderItem={({ item, index }) => (
          <View style={styles.cardWrap}>
            {index === 0 ? (
              <ThemedText type="smallBold" themeColor="accent" style={styles.topPick}>
                今日主打
              </ThemedText>
            ) : null}
            <ArticleCard article={item.article} completed={completedIds.has(item.article.id)} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.reason}>
              💡 {item.reason}
            </ThemedText>
          </View>
        )}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: insets.top + Spacing.three,
            paddingBottom: insets.bottom + BottomTabInset + Spacing.three,
          },
        ]}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headingWrap: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.one,
    marginBottom: Spacing.three,
  },
  heading: {
    fontSize: 28,
    lineHeight: 36,
  },
  assessBanner: {
    marginHorizontal: Spacing.four,
    marginBottom: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.half,
    alignItems: 'flex-start',
  },
  progressCard: {
    marginHorizontal: Spacing.four,
    marginBottom: Spacing.four,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  progressTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  listContent: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  cardWrap: {
    marginHorizontal: Spacing.four,
    marginBottom: Spacing.four,
    gap: Spacing.two,
  },
  topPick: {
    alignSelf: 'flex-start',
  },
  reason: {
    lineHeight: 20,
  },
  pressed: { opacity: 0.6 },
});
