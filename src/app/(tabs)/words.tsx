import { useFocusEffect, useRouter } from 'expo-router';
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
import { useTheme, useThemeSkin } from '@/hooks/use-theme';
import { countByStatus, getWords, removeWord, setWordStatus } from '@/storage/words';
import { recordReviewResult } from '@/storage/review-stats';
import { stageOf, WORD_STAGE_LABEL } from '@/domain/srs';
import type { WordItem } from '@/types';

/**
 * 生词本:
 * - 顶部:总数 + 到期复习数入口;
 * - 列表:词、词性、状态徽章(新词/学习中/已掌握)、中英释义、来源;
 * - 点行 → 词条详情;行内可「标记已掌握/取消」与「删除」。
 */
export default function WordsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const skin = useThemeSkin();
  const [words, setWords] = useState<WordItem[] | null>(null);
  const [dueCount, setDueCount] = useState(0);

  /**
   * 读取列表。抽成独立函数是为了让**行内操作**(标为已掌握 / 删除)之后能就地刷新,
   * 而不必等用户切走再切回来。
   */
  const refresh = useCallback(async () => {
    const [list, counts] = await Promise.all([getWords(), countByStatus()]);
    /**
     * 排序:待复习 → 复习中 → 已巩固(已掌握)。
     * 反馈原话:「这点进来一看生词本 20 个,进去发现 20 个已掌握也太抽象了」——
     * 已掌握的词仍然留在生词本里(它们是你的词汇资产),但不该占着视线,
     * 所以排到最后,并且首页计数器只统计未掌握的。
     */
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

  /**
   * 行内操作(长按词条):直接标为已掌握 / 取消 / 删除。
   *
   * 为什么要有这个入口:反馈明确要求「生词本中也可以直接将单词标为已掌握从而影响曲线」——
   * 有些词用户一眼就知道自己会(比如已经在别处学过),没必要走 5 次复习才算掌握。
   * 而且标记**会写入复习统计**(recordReviewResult),所以它同样参与知识曲线的校准,
   * 不是"点了就消失"的按钮。
   */
  const handleRowLongPress = (item: WordItem) => {
    const stage = stageOf(item);
    const consolidated = stage === 'consolidated';
    Alert.alert(
      item.headword,
      consolidated
        ? '这个词已标记为已掌握(已退出常规复习队列)。'
        : '标为已掌握后,它会退出常规复习队列,并作为"这个词你会"计入知识曲线。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: consolidated ? '取消已掌握' : '标为已掌握',
          onPress: () => {
            void (async () => {
              await setWordStatus(item.id, consolidated ? 'learning' : 'mastered');
              // 曲线记账:标为掌握记一笔"记得";取消则把那笔撤销,账目对齐
              await recordReviewResult(item.headword, true, consolidated);
              await refresh();
            })();
          },
        },
        {
          text: '从生词本删除',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              await removeWord(item.id);
              await refresh();
            })();
          },
        },
      ],
    );
  };

  return (
    <ThemedView style={styles.flex}>
      <View style={[styles.headingWrap, { paddingTop: insets.top + Spacing.three }]}>
        <ThemedText type="subtitle" style={styles.heading}>
          生词本
        </ThemedText>
        {words ? (
          <ThemedText type="small" themeColor="textSecondary">
            长按词条可标为已掌握 / 删除{'\n'}共 {words.length} 个生词 · 待学{' '}
            {words.filter((w) => stageOf(w) !== 'consolidated').length} · 已巩固{' '}
            {words.filter((w) => stageOf(w) === 'consolidated').length}
          </ThemedText>
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
          description="阅读短文时轻点单词 → 选「学习」,词就会进来并按遗忘曲线安排复习。"
          actionLabel="去读一篇"
          onAction={() => router.push('/(tabs)/library')}
        />
      ) : (
        <FlatList
          data={words}
          keyExtractor={(w) => w.id}
          ListHeaderComponent={
            <Pressable
              onPress={() => router.push('/review')}
              style={({ pressed }) => pressed && styles.pressed}>
              <ThemedView type="backgroundSelected" style={styles.reviewBar}>
                <View style={styles.reviewBarInner}>
                  {skin.motifs ? <Star size={6} /> : null}
                  <ThemedText type="smallBold" themeColor="accent">
                    {dueCount > 0
                      ? `${dueCount} 个词到期待复习 →`
                      : '暂无到期词,去复习页看看'}
                  </ThemedText>
                </View>
              </ThemedView>
            </Pressable>
          }
          renderItem={({ item }) => (
            <WordRow
              item={item}
              onWordPress={() =>
                router.push({ pathname: '/word/[word]', params: { word: item.headword } })
              }
              onSourcePress={() =>
                item.sourceArticleId && router.push(`/article/${item.sourceArticleId}`)
              }
              onLongPress={() => handleRowLongPress(item)}
            />
          )}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + BottomTabInset + Spacing.three },
          ]}
        />
      )}
    </ThemedView>
  );
}

function WordRow({
  item,
  onWordPress,
  onSourcePress,
  onLongPress,
}: {
  item: WordItem;
  onWordPress: () => void;
  onSourcePress: () => void;
  /** 长按:标为已掌握 / 取消 / 删除(见父组件的 handleRowLongPress) */
  onLongPress: () => void;
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
    <Pressable
      onPress={onWordPress}
      onLongPress={onLongPress}
      delayLongPress={300}
      style={({ pressed }) => pressed && styles.rowPressed}>
      <ThemedView type="backgroundElement" style={styles.row}>
        <View style={styles.rowHead}>
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
          {/* 管理操作(标记掌握/删除)移到词条详情页,列表行只保留"来源"入口,避免两个功能相近的按钮挤在一行 */}
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
  heading: {
    fontSize: 28,
    lineHeight: 36,
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
  },
  rowPressed: {
    opacity: 0.85,
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  rowHeadRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
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
