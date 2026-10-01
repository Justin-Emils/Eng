import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import { SkeletonList } from '@/components/skeleton';
import { Star } from '@/components/ornaments';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radii, BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { getArticleById } from '@/data/articles';
import { stageOf, WORD_STAGE_LABEL } from '@/domain/srs';
import { useTheme, useThemeSkin } from '@/hooks/use-theme';
import { todayKey } from '@/storage/learning';
import { recordReviewResult } from '@/storage/review-stats';
import { countByStatus, getWords, removeWord, setWordStatus } from '@/storage/words';
import type { WordItem } from '@/types';

/**
 * 生词本:
 * - 顶部:总数(待学 / 已巩固)+ 到期复习入口 + **筛选** + 多选;
 * - 列表:词、词性、阶段徽章、中英释义、来源;
 * - 点行 → 词条详情;右上「多选」→ 批量标为已掌握 / 移出已掌握 / 删除。
 *
 * 排序始终是「待复习 → 复习中 → 已巩固」:已掌握的词仍留在生词本里(它们是你的
 * 词汇资产),但不该占着视线 —— 反馈原话:「点进来一看 20 个,进去发现 20 个已掌握
 * 也太抽象了」。
 */

/** 筛选:全部 / 待学(未巩固)/ 已巩固 / 今日新增(B3:首页计数器点进来就是这一档) */
type WordFilter = 'all' | 'todo' | 'done' | 'today';

const FILTERS: { id: WordFilter; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'todo', label: '待学' },
  { id: 'done', label: '已巩固' },
  { id: 'today', label: '今日新增' },
];

/** 词是哪天加进来的(用于「今日新增」筛选) */
function addedOn(item: WordItem): string {
  return todayKey(new Date(item.addedAt || 0));
}

export default function WordsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const skin = useThemeSkin();
  const theme = useTheme();
  const params = useLocalSearchParams<{ filter?: string }>();
  const [words, setWords] = useState<WordItem[] | null>(null);
  const [dueCount, setDueCount] = useState(0);
  const [filter, setFilter] = useState<WordFilter>(() =>
    params.filter === 'today' ? 'today' : 'all',
  );
  /** 多选模式:行点击变成"选中",底部出现批量操作栏 */
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  /**
   * 读取列表。抽成独立函数是为了让**行内 / 批量操作**之后就地刷新,
   * 而不必等用户切走再切回来。
   */
  const refresh = useCallback(async () => {
    const [list, counts] = await Promise.all([getWords(), countByStatus()]);
    const STAGE_RANK = { pending: 0, reviewing: 1, consolidated: 2 } as const;
    setWords([...list].sort((a, b) => STAGE_RANK[stageOf(a)] - STAGE_RANK[stageOf(b)]));
    setDueCount(counts.due);
  }, []);

  // 每次页面聚焦都刷新,保证从阅读页收藏后回来立即可见
  useFocusEffect(
    useCallback(() => {
      void refresh().catch(() => {});
    }, [refresh]),
  );

  const exitSelect = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const visible = (words ?? []).filter((w) => {
    if (filter === 'todo') return stageOf(w) !== 'consolidated';
    if (filter === 'done') return stageOf(w) === 'consolidated';
    if (filter === 'today') return addedOn(w) === todayKey();
    return true;
  });

  const selectedItems = (words ?? []).filter((w) => selected.has(w.id));

  /**
   * 批量标为已掌握 / 移出已掌握。
   * 与复习共用同一套曲线记账(recordReviewResult):标记 = 记一笔"会",移出 = 撤销那笔,
   * 所以批量操作同样会如实影响知识曲线,不是"点了就消失"的勾选。
   */
  const batchSetMastered = async (reset: boolean) => {
    for (const w of selectedItems) {
      await setWordStatus(w.id, reset ? 'learning' : 'mastered');
      await recordReviewResult(w.headword, true, reset);
    }
    await refresh();
    exitSelect();
  };

  const batchRemove = () => {
    const n = selectedItems.length;
    Alert.alert(
      '从生词本删除?',
      `将删除选中的 ${n} 个词及其复习进度。阅读记录不受影响(删除不可恢复)。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: `删除 ${n} 个`,
          style: 'destructive',
          onPress: () => {
            void (async () => {
              for (const w of selectedItems) await removeWord(w.id);
              await refresh();
              exitSelect();
            })();
          },
        },
      ],
    );
  };

  const todoCount = (words ?? []).filter((w) => stageOf(w) !== 'consolidated').length;
  const doneCount = (words ?? []).length - todoCount;

  return (
    <ThemedView style={styles.flex}>
      <View style={[styles.headingWrap, { paddingTop: insets.top + Spacing.three }]}>
        <View style={styles.headingRow}>
          <ThemedText type="subtitle" style={styles.heading}>
            生词本
          </ThemedText>
          {/*
            多选入口:反馈原话「挨个点进去太变态了」。
            放在标题右侧,列表里不再挤按钮。
          */}
          {words && words.length > 0 ? (
            <Pressable
              onPress={() => (selectMode ? exitSelect() : setSelectMode(true))}
              hitSlop={8}
              style={({ pressed }) => pressed && styles.pressed}>
              <ThemedView type="backgroundSelected" radius="chip" style={styles.selectToggle}>
                <ThemedText type="smallBold" themeColor={selectMode ? 'accent' : 'textSecondary'}>
                  {selectMode ? '退出多选' : '多选'}
                </ThemedText>
              </ThemedView>
            </Pressable>
          ) : null}
        </View>
        {words ? (
          <ThemedText type="small" themeColor="textSecondary">
            共 {words.length} 个生词 · 待学 {todoCount} · 已巩固 {doneCount}
          </ThemedText>
        ) : null}

        {/* 筛选(C2):只看未掌握 / 只看已掌握 / 今日新增 */}
        {words && words.length > 0 ? (
          <View style={styles.filterRow}>
            {FILTERS.map((f) => {
              const active = filter === f.id;
              const count =
                f.id === 'all'
                  ? words.length
                  : f.id === 'todo'
                    ? todoCount
                    : f.id === 'done'
                      ? doneCount
                      : words.filter((w) => addedOn(w) === todayKey()).length;
              return (
                <Pressable
                  key={f.id}
                  onPress={() => setFilter(f.id)}
                  style={({ pressed }) => pressed && styles.pressed}>
                  <ThemedView
                    type={active ? 'backgroundSelected' : 'backgroundElement'}
                    radius="chip"
                    style={[
                      styles.filterChip,
                      active && { borderColor: theme.accent },
                    ]}>
                    <ThemedText type="small" themeColor={active ? 'accent' : 'textSecondary'}>
                      {f.label} {count}
                    </ThemedText>
                  </ThemedView>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>

      {words === null ? (
        <View style={styles.empty}>
          <SkeletonList count={4} />
        </View>
      ) : words.length === 0 ? (
        <EmptyState
          emoji="📭"
          title="生词本还是空的"
          description="阅读短文时轻点单词 → 选「加入生词本」,词就会进来并按遗忘曲线安排复习。"
          actionLabel="去读一篇"
          onAction={() => router.push('/(tabs)/library')}
        />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(w) => w.id}
          ListHeaderComponent={
            <Pressable
              onPress={() => router.push('/review')}
              style={({ pressed }) => pressed && styles.pressed}>
              <ThemedView type="backgroundSelected" style={styles.reviewBar}>
                <View style={styles.reviewBarInner}>
                  {skin.motifs ? <Star size={6} /> : null}
                  <ThemedText type="smallBold" themeColor="accent">
                    {dueCount > 0 ? `${dueCount} 个词到期待复习 →` : '暂无到期词,去复习页看看'}
                  </ThemedText>
                </View>
              </ThemedView>
            </Pressable>
          }
          ListEmptyComponent={
            <View style={styles.filterEmpty}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.emptyHint}>
                {filter === 'today'
                  ? '今天还没有新增生词。读一篇文章,点词加入就会计入今天。'
                  : filter === 'todo'
                    ? '没有待学的词 —— 都巩固了。'
                    : '这个筛选下没有词。'}
              </ThemedText>
            </View>
          }
          renderItem={({ item }) => (
            <WordRow
              item={item}
              selectable={selectMode}
              selected={selected.has(item.id)}
              onWordPress={() =>
                selectMode
                  ? toggleSelect(item.id)
                  : router.push({ pathname: '/word/[word]', params: { word: item.headword } })
              }
              onSourcePress={() =>
                item.sourceArticleId && router.push(`/article/${item.sourceArticleId}`)
              }
            />
          )}
          contentContainerStyle={[
            styles.listContent,
            {
              paddingBottom:
                insets.bottom + BottomTabInset + (selectMode ? Spacing.six * 2 : Spacing.three),
            },
          ]}
        />
      )}

      {/* 批量操作栏(仅多选模式出现) */}
      {selectMode ? (
        <View
          style={[
            styles.selectBarWrap,
            { paddingBottom: insets.bottom + BottomTabInset + Spacing.two },
          ]}>
          <ThemedView type="backgroundSelected" style={styles.selectBar}>
            <Pressable
              onPress={() => setSelected(new Set(visible.map((w) => w.id)))}
              hitSlop={6}
              style={({ pressed }) => pressed && styles.pressed}>
              <ThemedText type="small" themeColor="textSecondary">
                全选本页
              </ThemedText>
            </Pressable>
            <ThemedText type="small" themeColor="textSecondary">
              已选 {selected.size}
            </ThemedText>
            <View style={styles.selectActions}>
              <Pressable
                disabled={selected.size === 0}
                onPress={() => void batchSetMastered(false)}
                style={({ pressed }) => pressed && styles.pressed}>
                <ThemedText
                  type="smallBold"
                  themeColor={selected.size === 0 ? 'textSecondary' : 'accent'}>
                  标为已掌握
                </ThemedText>
              </Pressable>
              <Pressable
                disabled={selected.size === 0}
                onPress={() => void batchSetMastered(true)}
                style={({ pressed }) => pressed && styles.pressed}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  移出已掌握
                </ThemedText>
              </Pressable>
              <Pressable
                disabled={selected.size === 0}
                onPress={batchRemove}
                style={({ pressed }) => pressed && styles.pressed}>
                <ThemedText type="smallBold" themeColor="danger">
                  删除
                </ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        </View>
      ) : null}
    </ThemedView>
  );
}

function WordRow({
  item,
  onWordPress,
  onSourcePress,
  selectable = false,
  selected = false,
}: {
  item: WordItem;
  onWordPress: () => void;
  onSourcePress: () => void;
  /** 多选模式下:行首出现勾选框,点行 = 选中/取消 */
  selectable?: boolean;
  selected?: boolean;
}) {
  const theme = useTheme();
  const source = item.sourceArticleId ? getArticleById(item.sourceArticleId) : undefined;
  /**
   * 阶段标签(A2):用 domain/srs 的统一说法(待复习 / 复习中 / 已巩固),
   * 而不是各页面自己编(以前这里是"新词 / 学习中 / 已掌握",与复习页对不上)。
   * 已巩固的词用强调色描边,视觉上让它"退到背景里"。
   */
  const stage = stageOf(item);
  const statusText = WORD_STAGE_LABEL[stage];
  const consolidated = stage === 'consolidated';

  return (
    <Pressable onPress={onWordPress} style={({ pressed }) => pressed && styles.rowPressed}>
      <ThemedView
        type="backgroundElement"
        style={[styles.row, selected && { borderColor: theme.accent, borderWidth: 1 }]}>
        <View style={styles.rowHead}>
          {selectable ? (
            <View
              style={[
                styles.checkbox,
                { borderColor: selected ? theme.accent : theme.textSecondary },
                selected && { backgroundColor: theme.accent },
              ]}>
              {selected ? (
                <ThemedText type="smallBold" style={{ color: theme.onAccentStrong, fontSize: 12 }}>
                  ✓
                </ThemedText>
              ) : null}
            </View>
          ) : null}
          <ThemedText type="smallBold" style={styles.wordText}>
            {item.headword}
          </ThemedText>
          <View style={styles.rowHeadRight}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.pos}>
              {item.pos}
            </ThemedText>
            <ThemedView
              type="backgroundSelected"
              radius="chip"
              style={[styles.statusChip, consolidated && { borderColor: theme.accent }]}>
              <ThemedText
                type="small"
                style={{ color: consolidated ? theme.accent : theme.textSecondary }}>
                {statusText}
              </ThemedText>
            </ThemedView>
          </View>
        </View>
        <ThemedText style={styles.zh}>{item.zh || '（离线词典暂无释义）'}</ThemedText>
        {item.en ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {item.en}
          </ThemedText>
        ) : null}

        <View style={styles.rowFoot}>
          {source ? (
            <Pressable onPress={onSourcePress} hitSlop={6} style={styles.sourceWrap}>
              <ThemedText
                type="small"
                themeColor="accent"
                numberOfLines={1}
                ellipsizeMode="tail"
                style={styles.source}>
                来源:《{source.title}》
              </ThemedText>
            </Pressable>
          ) : (
            <View style={styles.sourceWrap}>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                详情 ›
              </ThemedText>
            </View>
          )}
          {/* 单个词的管理操作在词条详情页(标为已掌握 / 删除);批量操作走上面的「多选」 */}
        </View>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headingWrap: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
    gap: Spacing.one,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  heading: {
    fontSize: 28,
    lineHeight: 36,
  },
  selectToggle: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  filterChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterEmpty: {
    paddingVertical: Spacing.six,
    paddingHorizontal: Spacing.four,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.six,
  },
  emptyHint: {
    textAlign: 'center',
    lineHeight: 20,
  },
  listContent: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  reviewBar: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    marginBottom: Spacing.one,
  },
  reviewBarInner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  row: {
    padding: Spacing.three,
    borderRadius: Radii.card,
    gap: Spacing.one,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  rowPressed: {
    opacity: 0.85,
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowHeadRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginLeft: 'auto',
  },
  wordText: {
    fontSize: 18,
    lineHeight: 24,
    flexShrink: 1,
  },
  pos: {
    fontStyle: 'italic',
  },
  statusChip: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Radii.sharp,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  zh: {
    fontWeight: '600',
    marginTop: Spacing.one,
  },
  rowFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  /**
   * 来源那一段必须可收缩:flex:1 + minWidth:0,否则长标题会把卡片撑破
   * (只在 Text 上写 flexShrink 不够 —— 它的父级 Pressable 会按内容撑宽)。
   */
  sourceWrap: {
    flex: 1,
    minWidth: 0,
  },
  source: {
    lineHeight: 20,
  },
  /** 批量操作栏:浮在列表之上、Tab 栏之上 */
  selectBarWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.four,
  },
  selectBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  selectActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    flexShrink: 0,
  },
  pressed: {
    opacity: 0.6,
  },
});
