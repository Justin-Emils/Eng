import Constants from 'expo-constants';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SettingRow } from '@/components/setting-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { getArticleById } from '@/data/articles';
import { computeStats, type LearningStats } from '@/domain/analytics';
import { wordsToCsv } from '@/domain/export';
import { bandLabelOf } from '@/domain/levels';
import { computeStreak } from '@/domain/stats';
import { useDailyCorpus } from '@/hooks/use-daily-corpus';
import { useTheme } from '@/hooks/use-theme';
import { setThemeMode, useThemeMode, type ThemeMode } from '@/hooks/use-theme-mode';
import {
  getAllCheckedArticleIds,
  getCheckedArticleIdsOn,
  getCheckinDateKeys,
  todayKey,
} from '@/storage/checkins';
import { getSettings, saveDailyGoal, saveNickname, type DailyGoal } from '@/storage/settings';
import { getUserLevel } from '@/storage/user';
import { clearWords, getWords } from '@/storage/words';
import type { Article, UserLevel } from '@/types';

const GOAL_PRESETS: DailyGoal[] = [
  { articles: 1, reviewWords: 5 },
  { articles: 1, reviewWords: 10 },
  { articles: 2, reviewWords: 10 },
  { articles: 3, reviewWords: 20 },
];

const THEME_OPTIONS: { mode: ThemeMode; label: string }[] = [
  { mode: 'system', label: '跟随系统' },
  { mode: 'light', label: '浅色' },
  { mode: 'dark', label: '深色' },
];

function resolveArticles(ids: string[]): Article[] {
  return ids.map((aid) => getArticleById(aid)).filter((a): a is Article => Boolean(a));
}

/**
 * 「我的」= 标准设置页:
 * 个人卡(昵称/水平/连续打卡)→ 学习统计 → 学习设置(目标/水平/主题)
 * → 内容(每日语料)→ 数据(导出/清空)→ 关于。
 */
export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();
  const themeMode = useThemeMode();
  const daily = useDailyCorpus();

  const [stats, setStats] = useState<LearningStats | null>(null);
  const [goal, setGoal] = useState<DailyGoal | null>(null);
  const [userLevel, setUserLevel] = useState<UserLevel | null>(null);
  const [nickname, setNickname] = useState('');
  const [nicknameDraft, setNicknameDraft] = useState('');
  const [exported, setExported] = useState(false);

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
      setNickname(settings.nickname ?? '');
      setNicknameDraft(settings.nickname ?? '');
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

  const handleSaveNickname = async () => {
    const name = nicknameDraft.trim();
    await saveNickname(name);
    setNickname(name);
  };

  const handleExport = async () => {
    const words = await getWords();
    if (words.length === 0) {
      Alert.alert('生词本还是空的', '先在阅读页点词并标记「学习」,就会出现在这里。');
      return;
    }
    // 加 UTF-8 BOM,Excel/记事本打开不乱码
    await Clipboard.setStringAsync('\uFEFF' + wordsToCsv(words));
    setExported(true);
    setTimeout(() => setExported(false), 2000);
  };

  const handleClearWords = () => {
    Alert.alert('清空生词本?', '会删除全部生词与复习进度,不可恢复。阅读记录不受影响。', [
      { text: '取消', style: 'cancel' },
      {
        text: '清空',
        style: 'destructive',
        onPress: () => {
          void clearWords().then(refresh);
        },
      },
    ]);
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

        {/* 个人卡:昵称 / 水平 / 连续打卡 */}
        <ThemedView type="backgroundElement" style={styles.card}>
          <View style={styles.personRow}>
            <View style={styles.avatar}>
              <ThemedText style={styles.avatarText}>
                {(nickname || '读').slice(0, 1).toUpperCase()}
              </ThemedText>
            </View>
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
                <ThemedText type="small" themeColor="textSecondary">
                  纯本地
                </ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                {levelText}
              </ThemedText>
            </View>
          </View>

          <View style={styles.statRow}>
            <StatTile label="连续打卡" value={`${stats?.streakDays ?? 0} 天`} />
            <StatTile label="累计读完" value={`${stats?.totalArticlesCompleted ?? 0} 篇`} />
            <StatTile label="生词本" value={`${stats?.wordCount ?? 0} 词`} />
          </View>
        </ThemedView>

        {/* 学习设置 */}
        <SectionTitle text="学习设置" />
        <ThemedView type="backgroundElement" style={styles.list}>
          <SettingRow
            label="每日目标"
            sublabel={goal ? `读 ${goal.articles} 篇 · 复习 ${goal.reviewWords} 词` : '加载中…'}
          />
          <View style={styles.chipsRow}>
            {GOAL_PRESETS.map((g) => {
              const active = goal?.articles === g.articles && goal?.reviewWords === g.reviewWords;
              return (
                <Pressable key={`${g.articles}-${g.reviewWords}`} onPress={() => void handleSetGoal(g)}>
                  <View
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? theme.accentSoft : theme.background,
                        borderColor: active ? theme.accent : theme.border,
                      },
                    ]}>
                    <ThemedText type="small" themeColor={active ? 'accent' : 'textSecondary'}>
                      {g.articles}篇/{g.reviewWords}词
                    </ThemedText>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <SettingRow
            label="学习水平"
            value={userLevel?.assessed ? '重新评估' : '去评估'}
            onPress={() => router.push({ pathname: '/assessment', params: { from: 'profile' } })}
          />
          <SettingRow label="推荐难度" sublabel="按你的水平自动高 1 档" value={bandLabelOf(vocab).split(' ')[0]} />
          <SettingRow
            label="主题"
            sublabel="可跟随手机深色模式"
            right={
              <View style={styles.chipsRow}>
                {THEME_OPTIONS.map((opt) => {
                  const active = themeMode === opt.mode;
                  return (
                    <Pressable key={opt.mode} onPress={() => void setThemeMode(opt.mode)}>
                      <View
                        style={[
                          styles.chip,
                          {
                            backgroundColor: active ? theme.accentSoft : theme.background,
                            borderColor: active ? theme.accent : theme.border,
                          },
                        ]}>
                        <ThemedText type="small" themeColor={active ? 'accent' : 'textSecondary'}>
                          {opt.label}
                        </ThemedText>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            }
            last
          />
        </ThemedView>

        {/* 内容 */}
        <SectionTitle text="内容" />
        <ThemedView type="backgroundElement" style={styles.list}>
          <SettingRow
            label="每日语料"
            sublabel={
              daily.busy || daily.status.kind === 'running'
                ? '正在抓取公版短文并切分入库…'
                : `已入库 ${daily.remoteCount} 篇${daily.updatedToday ? ' · 今日已更新' : ' · 今日未更新'}${
                    daily.lastUpdate ? ` · 最近 ${daily.lastUpdate}` : ''
                  }`
            }
            value={daily.busy || daily.status.kind === 'running' ? undefined : '立即更新'}
            onPress={() => {
              if (!daily.busy && daily.status.kind !== 'running') void daily.updateNow();
            }}
            right={
              daily.busy || daily.status.kind === 'running' ? (
                <ActivityIndicator size="small" color={theme.accent} />
              ) : undefined
            }
          />
          {daily.manualResult ? (
            <ThemedText type="small" themeColor="accent" style={styles.listNote}>
              {daily.manualResult}
            </ThemedText>
          ) : daily.status.kind === 'failed' ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.listNote}>
              {daily.status.detail}
            </ThemedText>
          ) : null}
          <SettingRow
            label="测试语料源"
            sublabel="抓不到文章时,看看哪条源不通"
            value={daily.probing ? '测试中…' : undefined}
            onPress={() => {
              if (!daily.probing) void daily.testSources();
            }}
            last={!daily.probes}
          />
          {daily.probes
            ? daily.probes.map((p, i) => (
                <ThemedText
                  key={p.name}
                  type="small"
                  themeColor={p.ok ? 'accent' : 'textSecondary'}
                  style={[styles.listNote, i === daily.probes!.length - 1 && styles.listNoteLast]}>
                  {p.ok ? '✓' : '✗'} {p.name} · {p.ms}ms · {p.note}
                </ThemedText>
              ))
            : null}
        </ThemedView>

        {/* 数据 */}
        <SectionTitle text="数据" />
        <ThemedView type="backgroundElement" style={styles.list}>
          <SettingRow
            label="导出生词本"
            sublabel="CSV 复制到剪贴板,可粘到 Excel / 备忘录"
            value={exported ? '✓ 已复制' : undefined}
            onPress={() => void handleExport()}
          />
          <SettingRow label="清空生词本" sublabel="删除全部生词与复习进度" value="危险" onPress={handleClearWords} last />
        </ThemedView>

        {/* 关于 */}
        <SectionTitle text="关于" />
        <ThemedView type="backgroundElement" style={styles.list}>
          <SettingRow label="版本" value={String(Constants.expoConfig?.version ?? '1.0.0')} />
          <SettingRow label="词典与词频" sublabel="ECDICT(MIT License)" />
          <SettingRow label="每日语料" sublabel="Project Gutenberg 公版书籍(Public Domain)" />
          <SettingRow label="开源仓库" sublabel="github.com/Justin-Emils/Eng" last />
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
      <ThemedText type="smallBold" style={styles.statValue}>
        {value}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
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
  card: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.three },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 20, fontWeight: '800' },
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
  statValue: { fontSize: 15 },
  sectionTitle: { marginTop: Spacing.two, marginLeft: Spacing.one },
  list: { borderRadius: Spacing.three, paddingHorizontal: Spacing.three },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, paddingBottom: Spacing.two },
  chip: {
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.one + 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  listNote: { paddingBottom: Spacing.two, lineHeight: 18 },
  listNoteLast: { paddingBottom: Spacing.three },
});
