import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { LearnerProfileCard } from '@/components/learner-profile-card';
import { SettingRow } from '@/components/setting-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { getAllArticles, getArticleById } from '@/data/articles';
import { computeStats, type LearningStats } from '@/domain/analytics';
import { bandLabelOf, DEFAULT_USER_VOCAB } from '@/domain/levels';
import { curveForLevel } from '@/domain/knowledge';
import { getReviewStatsSync } from '@/storage/review-stats';
import { buildLearnerProfile, bandRoi, type LearnerProfile } from '@/domain/profile';
import { computeStreak } from '@/domain/stats';
import { useAuth } from '@/hooks/use-auth';
import { useTheme, useThemeMeta } from '@/hooks/use-theme';
import {
  getAllCheckedArticleIds,
  getCheckedArticleIdsOn,
  getCheckinDateKeys,
  todayKey,
} from '@/storage/checkins';
import {
  DEFAULT_AVATAR,
  getAccount,
  saveAccount,
  type AccountInfo,
} from '@/storage/account';
import { getSettings } from '@/storage/settings';
import { getUserLevel } from '@/storage/user';
import { getWords } from '@/storage/words';
import type { Article, UserLevel } from '@/types';

function resolveArticles(ids: string[]): Article[] {
  return ids.map((aid) => getArticleById(aid)).filter((a): a is Article => Boolean(a));
}

/**
 * 「我的」= 关于"我"的页面:
 * 个人卡(头像/昵称/水平/关键数据)→ 学习画像(含量化数据与评估入口)→ 入口行。
 *
 * 「App 怎么表现」的东西(主题、深浅模式、每日目标、语料更新、导出清空、关于)
 * 全部搬到 /settings —— 之前两者混在一页,找一个开关要在一屏个人信息里翻。
 */
export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();
  const themeMeta = useThemeMeta();
  const auth = useAuth();
  const signedIn = auth.status === 'authed';

  const [stats, setStats] = useState<LearningStats | null>(null);
  const [userLevel, setUserLevel] = useState<UserLevel | null>(null);
  const [nicknameDraft, setNicknameDraft] = useState('');
  const [account, setAccount] = useState<AccountInfo | null>(null);
  /** 常读话题(按已读文章统计,取前 3) */
  const [topTopics, setTopTopics] = useState<{ tag: string; count: number }[]>([]);
  /** 量化画像(由 domain/profile 从 UserLevel 算出) */
  const [profile, setProfile] = useState<LearnerProfile | null>(null);

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
      const readArticles = resolveArticles([...allChecked]);
      const nextStats = computeStats({
        todayArticles: resolveArticles(todayIds),
        allReadArticles: readArticles,
        words,
        streakDays: computeStreak(dateKeys, todayKey()),
      });
      setStats(nextStats);

      // 常读话题统计
      const counter = new Map<string, number>();
      for (const a of readArticles) {
        for (const t of a.topicTags) counter.set(t, (counter.get(t) ?? 0) + 1);
      }
      setTopTopics(
        [...counter.entries()]
          .map(([tag, count]) => ({ tag, count }))
          .sort((x, y) => y.count - x.count)
          .slice(0, 3),
      );

      // 本地账号(旧版本的 settings.nickname 迁移过来,避免昵称丢失)
      let acc = await getAccount();
      if (!acc.nickname && settings.nickname) {
        acc = await saveAccount({ nickname: settings.nickname });
      }
      setAccount(acc);
      setNicknameDraft(acc.nickname);

      setUserLevel(level);
      /**
       * 量化画像(词汇量 + 区间 + 分频段曲线 + 行为标签 + 派生建议)。
       * ROI(补词的投入产出比)用**内置语料**统计:每日远程文章不参与,
       * 否则同一条建议会随当天拉到什么文章而漂移。
       */
      setProfile(
        buildLearnerProfile(level, {
          behavior: {
            streakDays: nextStats.streakDays,
            wordCount: nextStats.wordCount,
            masteredCount: nextStats.masteredCount,
            totalArticlesCompleted: nextStats.totalArticlesCompleted,
            totalWordsRead: nextStats.totalWordsRead,
          },
          roi: bandRoi(level.vocab ?? DEFAULT_USER_VOCAB, getAllArticles(), curveForLevel(level, undefined, getReviewStatsSync())),
        }),
      );
    };
    load().catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useFocusEffect(refresh);

  const handleSaveNickname = async () => {
    const name = nicknameDraft.trim();
    const next = await saveAccount({ nickname: name });
    setAccount(next);
    setNicknameDraft(next.nickname);
  };

  const vocab = userLevel?.vocab ?? 0;
  const levelText = userLevel
    ? userLevel.assessed
      ? bandLabelOf(vocab)
      : '未评估(按 B1 中级推荐)'
    : '加载中…';

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
        <ThemedText type="subtitle" style={styles.heading}>
          我的
        </ThemedText>

        {/* 个人卡:头像 / 昵称 / 水平 / 关键数据。
            未登录时必须明说是「本机档案」并把入口写成「登录」——
            之前无论登不登录都显示「账号 ›」和「加入 N 天」,看起来像已经有账号了。 */}
        <ThemedView type="backgroundElement" frame="playbill" style={styles.card}>
          <View style={styles.personRow}>
            <Pressable onPress={() => router.push('/account')} hitSlop={6}>
              <Avatar source={account?.avatar ?? DEFAULT_AVATAR} size={56} />
            </Pressable>
            <View style={styles.personBody}>
              <View style={styles.nickRow}>
                <TextInput
                  value={nicknameDraft}
                  onChangeText={setNicknameDraft}
                  onBlur={() => void handleSaveNickname()}
                  onSubmitEditing={() => void handleSaveNickname()}
                  placeholder="设置昵称"
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.nickInput, { color: theme.text, borderColor: theme.border }]}
                  maxLength={12}
                  returnKeyType="done"
                />
                <Pressable onPress={() => router.push('/account')} hitSlop={6}>
                  <ThemedText type="small" themeColor="accent">
                    {signedIn ? '账号 ›' : '登录 ›'}
                  </ThemedText>
                </Pressable>
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                {levelText}
                {signedIn
                  ? ` · 已登录 ${auth.session?.user.email ?? ''}`
                  : ' · 本机档案(未登录)'}
              </ThemedText>
            </View>
          </View>

          <View style={styles.statRow}>
            <StatTile label="连续打卡" value={`${stats?.streakDays ?? 0} 天`} />
            <StatTile label="累计读完" value={`${stats?.totalArticlesCompleted ?? 0} 篇`} />
            <StatTile label="生词本" value={`${stats?.wordCount ?? 0} 词`} />
          </View>
        </ThemedView>

        {/* 学习画像:一个功能区承载量化数据(评估入口也在这里,不再分散到别的区块) */}
        <SectionTitle text="学习画像" />
        {profile ? (
          <LearnerProfileCard
            profile={profile}
            reading={{
              totalWordsRead: stats?.totalWordsRead ?? 0,
              avgPerArticle:
                stats && stats.totalArticlesCompleted > 0
                  ? Math.round(stats.totalWordsRead / stats.totalArticlesCompleted)
                  : null,
              masteredCount: stats?.masteredCount ?? 0,
              topics: topTopics.map((t) => `${t.tag}(${t.count})`).join(' · '),
            }}
            onAssess={() => router.push({ pathname: '/assessment', params: { from: 'profile' } })}
          />
        ) : (
          <ThemedView type="backgroundElement" frame="playbill" style={styles.card}>
            <ThemedText type="small" themeColor="textSecondary">
              正在读取水平数据…
            </ThemedText>
          </ThemedView>
        )}

        {/* 入口:账号与同步、设置。
            右侧把当前主题名露出来,不用进设置也知道现在在用哪套配色。 */}
        <SectionTitle text="更多" />
        <ThemedView type="backgroundElement" frame="playbill" style={styles.list}>
          <SettingRow
            label="账号与同步"
            sublabel={
              auth.status === 'authed'
                ? `已登录 ${auth.session?.user.email ?? ''} · 可上传 / 恢复学习数据`
                : '当前为本地账号,数据仅存本机;登录后可同步到云端'
            }
            value={auth.status === 'authed' ? '已登录 ›' : '去登录 ›'}
            onPress={() => router.push('/account')}
          />
          <SettingRow
            label="设置"
            sublabel="主题与深浅模式、每日目标、语料更新、导出与清空"
            value={themeMeta.name}
            onPress={() => router.push('/settings')}
            last
          />
        </ThemedView>
      </ScrollView>
    </ThemedView>
  );
}

function SectionTitle({ text }: { text: string }) {
  return (
    <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
      {text}
    </ThemedText>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statTile}>
      <ThemedText type="heading">{value}</ThemedText>
      <ThemedText type="caption" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
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
  heading: { fontSize: 24, lineHeight: 32 },
  card: { borderRadius: Radii.card, padding: Spacing.three, gap: Spacing.three },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  personBody: { flex: 1, gap: 4 },
  nickRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  nickInput: {
    flex: 1,
    minHeight: 34,
    borderBottomWidth: StyleSheet.hairlineWidth,
    fontSize: 16,
    fontWeight: '700',
    paddingVertical: 2,
  },
  statRow: { flexDirection: 'row', gap: Spacing.two },
  statTile: { flex: 1, gap: 1 },
  sectionTitle: { marginTop: Spacing.two, marginLeft: Spacing.one },
  list: { borderRadius: Radii.card, paddingHorizontal: Spacing.three },
});
