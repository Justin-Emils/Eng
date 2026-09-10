import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ArticleCover } from '@/components/article-cover';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import type { Article } from '@/types';

/**
 * 「最新更新」横向条(文章库顶部):
 * 展示最近一次每日语料更新入库的文章,配封面图,点卡片进阅读。
 * articles 为空时整体不渲染。
 */
export function LatestStrip({
  articles,
  date,
}: {
  articles: Article[];
  date?: string;
}) {
  const router = useRouter();
  if (articles.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.headRow}>
        <ThemedText type="smallBold" themeColor="text">
          最新更新
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {date ? `更新于 ${date}` : `${articles.length} 篇`}
        </ThemedText>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}>
        {articles.map((a) => (
          <Pressable
            key={a.id}
            onPress={() => router.push(`/article/${a.id}`)}
            style={({ pressed }) => pressed && styles.pressed}>
            <ThemedView type="backgroundElement" style={styles.card}>
              <ArticleCover article={a} size="thumb" />
              <View style={styles.cardBody}>
                <ThemedText type="small" numberOfLines={2} style={styles.cardTitle}>
                  {a.title}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {a.difficulty.level} · {a.difficulty.minutes} 分钟
                </ThemedText>
              </View>
            </ThemedView>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const CARD_WIDTH = 172;

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: Spacing.two,
  },
  row: {
    gap: Spacing.three,
    paddingBottom: Spacing.one,
  },
  pressed: { opacity: 0.9 },
  card: {
    width: CARD_WIDTH,
    borderRadius: Spacing.three,
    overflow: 'hidden',
  },
  cardBody: {
    padding: Spacing.two,
    gap: Spacing.one,
  },
  cardTitle: {
    minHeight: 40,
    lineHeight: 20,
  },
});
