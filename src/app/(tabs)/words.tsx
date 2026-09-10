import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { getArticleById } from '@/data/articles';
import { useTheme } from '@/hooks/use-theme';
import { countByStatus, getWords, removeWord, setWordStatus } from '@/storage/words';
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

  const handleRemove = async (id: string) => {
    await removeWord(id);
    const list = await getWords();
    const counts = await countByStatus();
    setWords(list);
    setDueCount(counts.due);
  };

  const handleSetMastered = async (item: WordItem, mastered: boolean) => {
    await setWordStatus(item.id, mastered ? 'mastered' : 'learning');
    const list = await getWords();
    const counts = await countByStatus();
    setWords(list);
    setDueCount(counts.due);
  };

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
          <ThemedText themeColor="textSecondary">加载中…</ThemedText>
        </View>
      ) : words.length === 0 ? (
        <View style={styles.empty}>
          <ThemedText type="subtitle">📭</ThemedText>
          <ThemedText themeColor="textSecondary">生词本是空的</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.emptyHint}>
            阅读短文时轻点单词 → 加入生词本,就会出现在这里。
          </ThemedText>
        </View>
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
              onToggleMastered={(mastered) => void handleSetMastered(item, mastered)}
              onRemove={() => handleRemove(item.id)}
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
  onToggleMastered,
  onRemove,
  onSourcePress,
}: {
  item: WordItem;
  onWordPress: () => void;
  onToggleMastered: (mastered: boolean) => void;
  onRemove: () => void;
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
            <Pressable
              onPress={onSourcePress}
              hitSlop={6}
              style={({ pressed }) => pressed && styles.pressed}>
              <ThemedText type="small" themeColor="accent" numberOfLines={1} style={styles.source}>
                来源:《{source.title}》
              </ThemedText>
            </Pressable>
          ) : (
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              详情 ›
            </ThemedText>
          )}
          <View style={styles.rowActions}>
            <Pressable
              onPress={() => onToggleMastered(!mastered)}
              hitSlop={6}
              style={({ pressed }) => pressed && styles.pressed}>
              <ThemedText type="small" themeColor="accent">
                {mastered ? '取消掌握' : '标为掌握'}
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={onRemove}
              hitSlop={8}
              style={({ pressed }) => pressed && styles.pressed}>
              <ThemedText type="small" themeColor="textSecondary">
                删除
              </ThemedText>
            </Pressable>
          </View>
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
  source: {
    flexShrink: 1,
    lineHeight: 20,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  pressed: {
    opacity: 0.6,
  },
});
