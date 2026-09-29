import Constants from 'expo-constants';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SettingRow } from '@/components/setting-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  getPalette,
  getSkin,
  MaxContentWidth,
  Radii,
  Spacing,
  THEME_IDS,
  THEME_META,
  type ThemeId,
} from '@/constants/theme';
import { wordsToCsv } from '@/domain/export';
import { DEFAULT_USER_VOCAB } from '@/domain/levels';
import { useDailyCorpus } from '@/hooks/use-daily-corpus';
import { useResolvedScheme, useTheme, useThemeSkin } from '@/hooks/use-theme';
import { setThemeId, setThemeMode, useThemeId, useThemeMode, type ThemeMode } from '@/hooks/use-theme-pref';
import { getSettings, saveDailyGoal, type DailyGoal } from '@/storage/settings';
import { getUserLevel } from '@/storage/user';
import { clearWords, getWords } from '@/storage/words';

const GOAL_PRESETS: DailyGoal[] = [
  { articles: 1, reviewWords: 5 },
  { articles: 1, reviewWords: 10 },
  { articles: 2, reviewWords: 10 },
  { articles: 3, reviewWords: 20 },
];

const THEME_MODE_OPTIONS: { mode: ThemeMode; label: string }[] = [
  { mode: 'system', label: '跟随系统' },
  { mode: 'light', label: '浅色' },
  { mode: 'dark', label: '深色' },
];

/** 预览卡片上那一小条"色板"取哪几个令牌 —— 挑最能代表一套配色的几个 */
const SWATCH_KEYS = ['background', 'backgroundElement', 'accent', 'annotate', 'gold'] as const;

/**
 * 设置页。
 *
 * 从「我的」里拎出来的东西都在这:外观(主题/深浅模式)、学习(目标/匹配口径)、
 * 内容(每日语料)、数据(导出/清空)、关于。
 *
 * 划分原则:
 *   「我的」= 关于"我"的东西(身份、水平、画像、统计);
 *   「设置」= 关于"App 怎么表现"的东西。
 * 之前两者混在一页,找一个开关要在一屏个人信息里翻。
 */
export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const skin = useThemeSkin();
  const scheme = useResolvedScheme();
  const themeId = useThemeId();
  const themeMode = useThemeMode();
  const daily = useDailyCorpus();

  const [goal, setGoal] = useState<DailyGoal | null>(null);
  const [vocab, setVocab] = useState<number | null>(null);
  const [exported, setExported] = useState(false);

  /**
   * 版本号取自 app.json 的 version —— 发版时必须同步递增,否则「关于」里显示的是假版本
   * (之前正是这个原因:tag 一路发到 v1.0.12,而这里一直显示 1.0.0)。
   * 开发环境下额外标注「开发版」,方便和 GitHub 上已发布的 Release 区分。
   */
  const appVersionText = `${String(Constants.expoConfig?.version ?? '未知')}${__DEV__ ? '(开发版)' : ''}`;

  /**
   * 隐藏开发者入口:在「关于 → 版本」上连点 5 次进入 /dev。
   * 正式 APK 里没有开发者菜单(摇一摇只在 Expo Go 有效),而重测首次启动流程
   * 必须能重置本机档案,所以入口藏在这里。2 秒内不继续点就清零,避免误触累积。
   */
  const [devTaps, setDevTaps] = useState(0);
  const [devHint, setDevHint] = useState(false);
  const devTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleVersionTap = () => {
    const next = devTaps + 1;
    if (next >= 5) {
      setDevTaps(0);
      setDevHint(false);
      if (devTimerRef.current) clearTimeout(devTimerRef.current);
      router.push('/dev');
      return;
    }
    setDevTaps(next);
    if (next >= 3) setDevHint(true);
    if (devTimerRef.current) clearTimeout(devTimerRef.current);
    devTimerRef.current = setTimeout(() => {
      setDevTaps(0);
      setDevHint(false);
    }, 2000);
  };

  // 卸载时清掉计时器
  useEffect(
    () => () => {
      if (devTimerRef.current) clearTimeout(devTimerRef.current);
    },
    [],
  );

  const refresh = useCallback(() => {
    let active = true;
    void (async () => {
      const [settings, level] = await Promise.all([getSettings(), getUserLevel()]);
      if (!active) return;
      setGoal(settings.dailyGoal);
      setVocab(level.vocab ?? DEFAULT_USER_VOCAB);
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(refresh, [refresh]);

  const handleSetGoal = async (g: DailyGoal) => {
    setGoal(g);
    await saveDailyGoal(g);
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
          void clearWords();
        },
      },
    ]);
  };

  const dailyBusy = daily.busy || daily.status.kind === 'running';

  return (
    <ThemedView style={styles.flex}>
      {/* 顶栏 */}
      <View style={[styles.topBar, { paddingTop: insets.top + Spacing.two }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}>
          <ThemedText style={styles.backIcon} themeColor="accent">
            ‹
          </ThemedText>
        </Pressable>
        <ThemedText type="smallBold">设置</ThemedText>
        <View style={styles.topBarRight} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.six }]}>
        {/* ── 外观 ── */}
        <SectionTitle text="外观" />

        <ThemedView type="backgroundElement" frame="playbill" style={styles.list}>
          <SettingRow
            label="主题"
            sublabel="配色方案。深浅色由下面的开关决定,两者互相独立"
            last
          />
          <View style={styles.themeGrid}>
            {THEME_IDS.map((id) => (
              <ThemePreviewCard
                key={id}
                themeId={id}
                scheme={scheme}
                active={themeId === id}
                onPress={() => void setThemeId(id)}
              />
            ))}
          </View>
        </ThemedView>

        <ThemedView type="backgroundElement" frame="playbill" style={styles.list}>
          <SettingRow label="深浅模式" sublabel="可跟随手机设置自动切换" last />
          <View style={styles.chipsRow}>
            {THEME_MODE_OPTIONS.map((opt) => {
              const active = themeMode === opt.mode;
              return (
                <Pressable
                  key={opt.mode}
                  onPress={() => void setThemeMode(opt.mode)}
                  hitSlop={4}
                  style={({ pressed }) => pressed && styles.pressed}>
                  <View
                    style={[
                      styles.chip,
                      {
                        borderRadius: skin.radiusChip,
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
        </ThemedView>

        {/* ── 学习 ── */}
        <SectionTitle text="学习" />
        <ThemedView type="backgroundElement" frame="playbill" style={styles.list}>
          <SettingRow
            label="每日目标"
            sublabel={goal ? `读 ${goal.articles} 篇 · 复习 ${goal.reviewWords} 词` : '加载中…'}
          />
          <View style={styles.chipsRow}>
            {GOAL_PRESETS.map((g) => {
              const active = goal?.articles === g.articles && goal?.reviewWords === g.reviewWords;
              return (
                <Pressable
                  key={`${g.articles}-${g.reviewWords}`}
                  onPress={() => void handleSetGoal(g)}
                  hitSlop={4}
                  style={({ pressed }) => pressed && styles.pressed}>
                  <View
                    style={[
                      styles.chip,
                      {
                        borderRadius: skin.radiusChip,
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

          {/* 评估入口在「我的 → 学习画像」卡里,这里只显示匹配口径 */}
          <SettingRow
            label="推荐匹配"
            sublabel="按预测理解率匹配 · 目标 93%–96%(生词 4%–7%)"
            value={vocab === null ? '–' : `${vocab} 词`}
            last
          />
        </ThemedView>

        {/* ── 内容 ── */}
        <SectionTitle text="内容" />
        <ThemedView type="backgroundElement" frame="playbill" style={styles.list}>
          <SettingRow
            label="每日语料"
            sublabel={
              dailyBusy
                ? '正在抓取公版短文并切分入库…'
                : `已入库 ${daily.remoteCount} 篇${daily.updatedToday ? ' · 今日已更新' : ' · 今日未更新'}${
                    daily.lastUpdate ? ` · 最近 ${daily.lastUpdate}` : ''
                  }`
            }
            value={dailyBusy ? undefined : '立即更新'}
            onPress={() => {
              if (!dailyBusy) void daily.updateNow();
            }}
            right={dailyBusy ? <ActivityIndicator size="small" color={theme.accent} /> : undefined}
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
                  themeColor={p.ok ? 'success' : 'danger'}
                  style={[styles.listNote, i === daily.probes!.length - 1 && styles.listNoteLast]}>
                  {p.ok ? '✓' : '✗'} {p.name} · {p.ms}ms · {p.note}
                </ThemedText>
              ))
            : null}
        </ThemedView>

        {/* ── 数据 ── */}
        <SectionTitle text="数据" />
        <ThemedView type="backgroundElement" frame="playbill" style={styles.list}>
          <SettingRow
            label="导出生词本"
            sublabel="CSV 复制到剪贴板,可粘到 Excel / 备忘录"
            value={exported ? '✓ 已复制' : undefined}
            onPress={() => void handleExport()}
          />
          <SettingRow
            label="清空生词本"
            sublabel="删除全部生词与复习进度"
            value="危险"
            onPress={handleClearWords}
            last
          />
        </ThemedView>

        {/* ── 关于 ── */}
        <SectionTitle text="关于" />
        <ThemedView type="backgroundElement" frame="playbill" style={styles.list}>
          <SettingRow
            label="当前主题"
            sublabel={THEME_META[themeId].tagline}
            value={THEME_META[themeId].name}
          />
          <SettingRow label="版本" value={appVersionText} onPress={handleVersionTap} />
          {devHint ? (
            <ThemedText type="small" themeColor="accent" style={styles.devHint}>
              再点 {5 - devTaps} 次进入开发者选项
            </ThemedText>
          ) : null}
          <SettingRow label="词典与词频" sublabel="ECDICT(MIT License)" />
          <SettingRow label="每日语料" sublabel="Project Gutenberg 公版书籍(Public Domain)" />
          <SettingRow label="开源仓库" sublabel="github.com/Justin-Emils/Eng" last />
        </ThemedView>
      </ScrollView>
    </ThemedView>
  );
}

/**
 * 主题预览卡。
 *
 * 关键点一:卡片内部**用它自己那套配色**渲染,而不是当前主题的配色 ——
 * 这样用户还没点下去就能看到这个主题长什么样,不用来回切着试。
 *
 * 关键点二:连**几何**也用被预览主题的(圆角取自 `getSkin(themeId)`)。
 * 一套主题是"颜色 + 几何 + 字形",预览只演颜色的话,用户切过去才发现形状也变了。
 */
function ThemePreviewCard({
  themeId,
  scheme,
  active,
  onPress,
}: {
  themeId: ThemeId;
  scheme: 'light' | 'dark';
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const meta = THEME_META[themeId];
  const preview = getPalette(themeId, scheme);
  const previewSkin = getSkin(themeId);

  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [styles.themeCardWrap, pressed && styles.pressed]}>
      <View
        style={[
          styles.themeCard,
          {
            borderRadius: previewSkin.radiusCard,
            backgroundColor: preview.background,
            borderColor: active ? theme.accent : theme.border,
            borderWidth: active ? 2 : 1,
          },
        ]}>
        {/* 迷你"一屏":底 + 一张卡 + 一行正文 + 强调点 + 标注条 + 金线 */}
        <View
          style={[
            styles.miniScreen,
            { backgroundColor: preview.background, borderRadius: previewSkin.radiusPanel },
          ]}>
          <View
            style={[
              styles.miniCard,
              {
                backgroundColor: preview.backgroundElement,
                borderRadius: previewSkin.radiusCard,
              },
            ]}>
            <View style={[styles.miniTitle, { backgroundColor: preview.text }]} />
            <View style={[styles.miniLine, { backgroundColor: preview.textSecondary }]} />
            <View style={styles.miniRow}>
              <View
                style={[
                  styles.miniDot,
                  { backgroundColor: preview.accent, borderRadius: previewSkin.radiusChip },
                ]}
              />
              <View style={[styles.miniBar, { backgroundColor: preview.annotate }]} />
            </View>
          </View>
          <View style={[styles.miniGold, { backgroundColor: preview.gold }]} />
        </View>

        <View style={styles.swatchRow}>
          {SWATCH_KEYS.map((key) => (
            <View
              key={key}
              style={[styles.swatch, { backgroundColor: preview[key], borderColor: theme.border }]}
            />
          ))}
        </View>
      </View>

      <View style={styles.themeTextWrap}>
        <ThemedText type="smallBold" themeColor={active ? 'accent' : 'text'}>
          {active ? '✓ ' : ''}
          {meta.name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.themeTagline}>
          {meta.tagline}
        </ThemedText>
      </View>
    </Pressable>
  );
}

function SectionTitle({ text }: { text: string }) {
  return (
    <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
      {text}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
    gap: Spacing.two,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 34, lineHeight: 36, marginTop: -4 },
  topBarRight: { width: 36 },
  content: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    gap: Spacing.three,
  },
  sectionTitle: { marginTop: Spacing.two, marginLeft: Spacing.one },
  list: { borderRadius: Radii.card, paddingHorizontal: Spacing.three },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, paddingBottom: Spacing.three },
  chip: {
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.one + 2,
    borderWidth: 1,
  },
  themeGrid: {
    flexDirection: 'row',
    gap: Spacing.three,
    paddingBottom: Spacing.three,
  },
  themeCardWrap: { flex: 1, gap: Spacing.two },
  themeCard: { padding: Spacing.two, gap: Spacing.two },
  miniScreen: { padding: Spacing.two, gap: Spacing.two },
  miniCard: { padding: Spacing.two, gap: Spacing.one + 1 },
  miniTitle: { height: 5, width: '62%', borderRadius: Radii.sharp, opacity: 0.9 },
  miniLine: { height: 3, width: '88%', borderRadius: Radii.sharp, opacity: 0.55 },
  miniRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one + 2, marginTop: 2 },
  miniDot: { width: 9, height: 9 },
  miniBar: { height: 3, flex: 1, borderRadius: Radii.sharp },
  miniGold: { height: 2, borderRadius: 1, opacity: 0.9 },
  swatchRow: { flexDirection: 'row', gap: Spacing.one },
  swatch: { flex: 1, height: 12, borderRadius: 1, borderWidth: StyleSheet.hairlineWidth },
  themeTextWrap: { gap: 2 },
  themeTagline: { lineHeight: 16 },
  devHint: { textAlign: 'right', paddingRight: Spacing.one, marginTop: -Spacing.one },
  listNote: { paddingBottom: Spacing.two, lineHeight: 18 },
  listNoteLast: { paddingBottom: Spacing.three },
  pressed: { opacity: 0.7 },
});
