import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, SectionList, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ArticleCard } from '@/components/article-card';
import { EmptyState } from '@/components/empty-state';
import { LatestStrip } from '@/components/latest-strip';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radii, BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { getAllArticles } from '@/data/articles';
import { remoteArticles } from '@/data/articles/remote-registry';
import { LEVEL_BANDS } from '@/domain/levels';
import { difficultyOf } from '@/domain/difficulty';
import { useCompletedArticleIds } from '@/hooks/use-completed-articles';
import { useTheme, useThemeSkin } from '@/hooks/use-theme';
import { loadRemoteArticles } from '@/storage/remote-articles';
import type { Article } from '@/types';

type ViewMode = 'flat' | 'topic' | 'level';

const MODES: { key: ViewMode; label: string; hint: string }[] = [
  { key: 'flat', label: '全部文章', hint: '不分组,按入库顺序' },
  { key: 'topic', label: '按话题', hint: '经济 / 科技 / 文化…' },
  { key: 'level', label: '按难度', hint: '按词汇量档位从易到难' },
];

/**
 * 文章库:全部内置 + 每日公版更新文章。
 * 支持搜索 + 分组浏览(话题/难度),内容多也易定位。
 *
 * 两处界面重做(反馈):
 *  1. **分区标题原来会叠在卡片上**:吸顶标题给了 sticky,但没有背景色 ——
 *     卡片从标题文字下面透出来。现在标题是满宽、不透明背景,并加了一条强调色竖条;
 *  2. **排序原来是横排三个 chip**,挤且看不出"这是选项"。改成右侧一个按钮,
 *     点开是底部弹层,每项带说明与勾选。
 */
export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const skin = useThemeSkin();
  const [mode, setMode] = useState<ViewMode>('topic');
  const [sortOpen, setSortOpen] = useState(false);
  const [query, setQuery] = useState('');
  const completedIds = useCompletedArticleIds();
  // 聚焦时重新读取语料(远程每日更新文章水化后立即可见)
  const [allArticles, setAllArticles] = useState<Article[]>(() => getAllArticles());
  // 「最新更新」条:最近一次入库的远程文章 + 更新日期
  const [remoteList, setRemoteList] = useState<Article[]>(() => [...remoteArticles]);
  const [remoteDate, setRemoteDate] = useState('');
  useFocusEffect(
    useCallback(() => {
      setAllArticles(getAllArticles());
      setRemoteList([...remoteArticles]);
      loadRemoteArticles()
        .then((shape) => setRemoteDate(shape.updatedDate))
        .catch(() => {});
    }, []),
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allArticles;
    return allArticles.filter(
      (a) =>
        a.title.toLowerCase().includes(q) || a.summary.toLowerCase().includes(q),
    );
  }, [allArticles, query]);

  // 组顺序(话题按常见次序展示;难度按 CEFR)
  const sections = useMemo(() => {
    if (mode === 'flat') {
      return [{ key: 'all', title: '', data: filtered }];
    }
    if (mode === 'level') {
      // 按细分难度档(11 档)分组,而不是粗 CEFR(6 档跨度太大)
      const map = new Map<string, Article[]>();
      for (const a of filtered) {
        const k = difficultyOf(a).band.id;
        const arr = map.get(k) ?? [];
        arr.push(a);
        map.set(k, arr);
      }
      return LEVEL_BANDS.filter((b) => map.has(b.id)).map((b) => ({
        key: b.id,
        title: `${b.id} ${b.label.replace(/^\S+\s*/, '')} · ${b.min}–${b.max} 词`,
        data: map.get(b.id)!,
      }));
    }
    // topic:用第一个话题分组
    const map = new Map<string, Article[]>();
    for (const a of filtered) {
      const k = a.topicTags[0] ?? '其他';
      const arr = map.get(k) ?? [];
      arr.push(a);
      map.set(k, arr);
    }
    const order = ['教育', '经济', '科技', '科学', '文化', '社会', '新闻', '环境', '历史', '生活', '故事', '其他'];
    const keys = [...order.filter((k) => map.has(k)), ...[...map.keys()].filter((k) => !order.includes(k))];
    return keys.map((k) => ({ key: k, title: k, data: map.get(k)! }));
  }, [filtered, mode]);

  const currentMode = MODES.find((m) => m.key === mode) ?? MODES[0];

  return (
    <ThemedView style={styles.flex}>
      {/* 标题 */}
      <View style={[styles.headingWrap, { paddingTop: insets.top + Spacing.three }]}>
        <ThemedText type="subtitle" style={styles.heading}>
          文章库
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          共 {allArticles.length} 篇 · 含每日公版更新
        </ThemedText>
      </View>

      {/* 搜索 + 排序按钮(同一行:搜索占满,排序靠右) */}
      <View style={styles.toolbar}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="搜索标题或摘要"
          placeholderTextColor={theme.textSecondary}
          style={[
            styles.searchInput,
            { borderRadius: skin.radiusCard },
            {
              color: theme.text,
              backgroundColor: theme.backgroundElement,
              borderColor: theme.border,
            },
          ]}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        <Pressable
          onPress={() => setSortOpen(true)}
          style={({ pressed }) => pressed && styles.pressed}>
          <ThemedView
            type="backgroundElement"
            radius="chip"
            style={[styles.sortBtn, { borderColor: theme.border }]}>
            <ThemedText type="smallBold" numberOfLines={1}>
              {currentMode.label}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              ▾
            </ThemedText>
          </ThemedView>
        </Pressable>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(a) => a.id}
        stickySectionHeadersEnabled={mode !== 'flat'}
        ListHeaderComponent={
          query.trim() ? null : <LatestStrip articles={remoteList} date={remoteDate} />
        }
        ListHeaderComponentStyle={styles.stripWrap}
        renderSectionHeader={({ section }) =>
          section.title ? (
            /**
             * 吸顶标题必须**不透明**:以前只有 padding 没有背景,
             * 吸顶时下面的卡片会从文字中间透出来(反馈里的"重叠")。
             * 现在是满宽不透明底 + 左侧强调色竖条,和卡片内容明确分层。
             */
            <View style={[styles.sectionHeader, { backgroundColor: theme.background }]}>
              <View style={styles.sectionHeaderInner}>
                <View style={[styles.sectionAccent, { backgroundColor: theme.accent }]} />
                <ThemedText type="smallBold">{section.title}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.sectionCount}>
                  {section.data.length} 篇
                </ThemedText>
              </View>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <ArticleCard article={item} completed={completedIds.has(item.id)} />
        )}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + BottomTabInset + Spacing.three },
        ]}
        ListEmptyComponent={
          query.trim() ? (
            <EmptyState
              emoji="🔍"
              title="没有匹配的文章"
              description={`没找到和「${query.trim()}」相关的标题或摘要,换个关键词试试。`}
              actionLabel="清除搜索"
              onAction={() => setQuery('')}
            />
          ) : (
            <EmptyState
              emoji="📚"
              title="这里还没有文章"
              description="公版短文每天自动更新;下拉刷新或稍后再来看看。"
            />
          )
        }
      />

      <SortSheet
        visible={sortOpen}
        value={mode}
        onChange={(next) => {
          setMode(next);
          setSortOpen(false);
        }}
        onClose={() => setSortOpen(false)}
      />
    </ThemedView>
  );
}

/**
 * 排序方式:底部弹层。
 * 原来把三个选项横排成 chip,看起来像筛选项、也不写各自含义;
 * 现在是一个按钮 + 带说明的菜单,点了才知道"按话题/按难度"到底怎么排。
 */
function SortSheet({
  visible,
  value,
  onChange,
  onClose,
}: {
  visible: boolean;
  value: ViewMode;
  onChange: (next: ViewMode) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.sheetRoot}>
        <Pressable style={styles.sheetBackdrop} onPress={onClose} />
        <ThemedView
          type="backgroundElement"
          style={[styles.sheetCard, { paddingBottom: insets.bottom + Spacing.three }]}>
          <View style={styles.sheetHandle} />
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sheetTitle}>
            排序方式
          </ThemedText>
          {MODES.map((m) => {
            const active = m.key === value;
            return (
              <Pressable
                key={m.key}
                onPress={() => onChange(m.key)}
                style={({ pressed }) => pressed && styles.pressed}>
                <View
                  style={[
                    styles.sheetRow,
                    active && { backgroundColor: theme.backgroundSelected },
                  ]}>
                  <View style={styles.sheetRowText}>
                    <ThemedText
                      type={active ? 'smallBold' : 'small'}
                      themeColor={active ? 'accent' : 'text'}>
                      {m.label}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {m.hint}
                    </ThemedText>
                  </View>
                  {active ? (
                    <ThemedText type="smallBold" themeColor="accent">
                      ✓
                    </ThemedText>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headingWrap: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
    gap: Spacing.one,
  },
  heading: {
    fontSize: 28,
    lineHeight: 36,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    minHeight: 44,
    borderWidth: 1,
  },
  pressed: { opacity: 0.7 },
  listContent: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  /**
   * 吸顶分区标题:满宽 + 不透明背景(负边距抵消列表内边距,让底色铺满整屏宽度)。
   * 不这么做的话,吸顶时卡片会从标题文字下面透出来。
   */
  sectionHeader: {
    marginHorizontal: -Spacing.four,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  sectionHeaderInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  sectionAccent: {
    width: 3,
    height: 14,
    borderRadius: 2,
  },
  sectionCount: {
    marginLeft: 'auto',
  },
  stripWrap: {
    paddingTop: Spacing.one,
    paddingBottom: Spacing.two,
  },
  empty: {
    paddingVertical: Spacing.six,
    alignItems: 'center',
  },
  // ── 排序弹层 ──
  sheetRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetBackdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheetCard: {
    paddingTop: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderTopLeftRadius: Radii.card,
    borderTopRightRadius: Radii.card,
    gap: Spacing.one,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(128,128,128,0.35)',
    marginBottom: Spacing.two,
  },
  sheetTitle: {
    paddingHorizontal: Spacing.two,
    paddingBottom: Spacing.one,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: Radii.sharp,
  },
  sheetRowText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
});
