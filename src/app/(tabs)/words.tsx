import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import { SkeletonList } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { getArticleById } from '@/data/articles';
import { useTheme } from '@/hooks/use-theme';
import { countByStatus, getWords } from '@/storage/words';
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
  const [words, setWords] = useState<WordItem[] | null>(null);
  const [dueCount, setDueCount] = useState(0);

  // 每次页面聚焦都刷新,保证从阅读页收藏后回来立即可见
  useFocusEffect(
    useCallback(() => {
      let active = true;
      const load = async () => {
        const [list, counts] = await Promise.all([getWords(), countByStatus()]);
        if (!active) return;
        setWords(list);
        setDueCount(counts.due);
      };
      load().catch(() => {});
      return () => {
        active = false;
      };
    }, []),
  );

  return (
    <ThemedView style={styles.flex}>
      <View style={[styles.headingWrap, { paddingTop: insets.top + Spacing.three }]}>
        <ThemedText type="subtitle" style={styles.heading}>
          生词本
        </ThemedText>
        {words ? (
          <ThemedText type="small" themeColor="textSecondary">
            共 {words.length} 个生词
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
                <ThemedText type="smallBold" themeColor="accent">
                  {dueCount > 0 ? `🔁 ${dueCount} 个词到期待复习 →` : '🔁 暂无到期词,去复习页看看'}
                </ThemedText>
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
}: {
  item: WordItem;
  onWordPress: () => void;
  onSourcePress: () => void;
}) {
  const theme = useTheme();
  const source = item.sourceArticleId ? getArticleById(item.sourceArticleId) : undefined;
  const mastered = item.status === 'mastered';
  const statusText = mastered ? '已掌握' : item.status === 'learning' ? '学习中' : '新词';

  return (
    <Pressable onPress={onWordPress} style={({ pressed }) => pressed && styles.rowPressed}>
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
              style={[styles.statusChip, mastered && { borderColor: theme.accent }]}>
              <ThemedText
                type="small"
                style={{ color: mastered ? theme.accent : theme.textSecondary }}>
                {statusText}
              </ThemedText>
            </ThemedView>
          </View>
        </View>
        <ThemedText style={styles.zh}>{item.zh}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {item.en}
        </ThemedText>

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
    borderRadius: Spacing.three,
    marginBottom: Spacing.one,
  },
  row: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
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
    borderRadius: 999,
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
