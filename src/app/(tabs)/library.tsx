import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ArticleCard } from '@/components/article-card';
import { LatestStrip } from '@/components/latest-strip';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { getAllArticles } from '@/data/articles';
import { remoteArticles } from '@/data/articles/remote-registry';
import { CEFR_LEVELS } from '@/domain/levels';
import { useCompletedArticleIds } from '@/hooks/use-completed-articles';
import { useTheme } from '@/hooks/use-theme';
import { loadRemoteArticles } from '@/storage/remote-articles';
import type { Article } from '@/types';

type ViewMode = 'flat' | 'topic' | 'level';

const MODES: { key: ViewMode; label: string }[] = [
  { key: 'flat', label: '全部' },
  { key: 'topic', label: '按话题' },
  { key: 'level', label: '按难度' },
];

/**
 * 文章库:全部内置 + 每日公版更新文章。
 * 支持搜索 + 分组浏览(话题/难度),内容多也易定位。
 */
export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const [mode, setMode] = useState<ViewMode>('topic');
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
      const map = new Map<string, Article[]>();
      for (const a of filtered) {
        const k = a.difficulty.level;
        const arr = map.get(k) ?? [];
        arr.push(a);
        map.set(k, arr);
      }
      return CEFR_LEVELS.filter((l) => map.has(l)).map((l) => ({
        key: l,
        title: `${l} · 词汇 ${(map.get(l) ?? [])[0]?.difficulty.vocab ?? ''}`,
        data: map.get(l)!,
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

      {/* 搜索 */}
      <View style={styles.searchWrap}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="搜索文章标题或摘要"
          placeholderTextColor={theme.textSecondary}
          style={[
            styles.searchInput,
            {
              color: theme.text,
              backgroundColor: theme.backgroundElement,
              borderColor: theme.border,
            },
          ]}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      {/* 视图切换 */}
      <View style={styles.modeWrap}>
        {MODES.map((m) => {
          const active = m.key === mode;
          return (
            <Pressable key={m.key} onPress={() => setMode(m.key)} style={styles.modeBtn}>
              <ThemedView
                type={active ? 'backgroundSelected' : 'backgroundElement'}
                style={[styles.modeChip, active && { borderColor: theme.accent }]}>
                <ThemedText type="smallBold" themeColor={active ? 'accent' : 'textSecondary'}>
                  {m.label}
                </ThemedText>
              </ThemedView>
            </Pressable>
          );
        })}
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
            <View style={styles.sectionHeader}>
              <ThemedText type="smallBold" themeColor="accent">
                {section.title}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {section.data.length} 篇
              </ThemedText>
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
          <View style={styles.empty}>
            <ThemedText themeColor="textSecondary">没有匹配的文章</ThemedText>
          </View>
        }
      />
    </ThemedView>
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
  searchWrap: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
  },
  searchInput: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  modeWrap: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
  },
  modeBtn: { flexShrink: 0 },
  modeChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  listContent: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingTop: Spacing.three,
    paddingBottom: Spacing.one,
    marginHorizontal: -Spacing.four,
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
  },
  stripWrap: {
    paddingTop: Spacing.one,
    paddingBottom: Spacing.two,
  },
  empty: {
    paddingVertical: Spacing.six,
    alignItems: 'center',
  },
});
