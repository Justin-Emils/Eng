import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { offlineDictionary } from '@/domain/dictionary';
import { isExternalWord } from '@/domain/external';
import { useTheme } from '@/hooks/use-theme';
import { useWordSaved } from '@/hooks/use-word-saved';

/**
 * 词条详情页(/word/[word]):
 * 从词典卡「详情 ›」进入,展示单词完整信息(音标/词性/中英释义/例句),
 * 支持加入/移出生词本;若带 articleId 可跳回来源文章。
 */
export default function WordDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const params = useLocalSearchParams<{ word: string; articleId?: string }>();
  const rawWord = params.word ?? '';

  const result = offlineDictionary.lookup(rawWord);
  const entry = result?.entry;
  const headword = entry?.headword;

  const { saved, toggle } = useWordSaved(headword);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!entry) return;
    setSaving(true);
    try {
      await toggle({
        word: result?.query || entry.headword,
        headword: entry.headword,
        phonetic: entry.phonetic,
        pos: entry.pos,
        zh: entry.zh,
        en: entry.en,
        example: entry.example,
        sourceArticleId: params.articleId ?? '',
        sourceSentence: undefined,
      });
    } finally {
      setSaving(false);
    }
  };

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
        <ThemedText type="smallBold" style={styles.topBarTitle}>
          词条详情
        </ThemedText>
        <View style={styles.topBarRight} />
      </View>

      <ScrollView
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.six }]}>
        <View style={styles.mainCard}>
          {entry ? (
            <>
              {isExternalWord(rawWord) ? (
                <ThemedView type="backgroundSelected" style={styles.flagBadge}>
                  <ThemedText type="smallBold" themeColor="accent">
                    考研词表收录
                  </ThemedText>
                </ThemedView>
              ) : null}
              <View style={styles.headRow}>
                <View style={styles.titleCol}>
                  <ThemedText type="title" style={styles.word}>
                    {entry.headword}
                  </ThemedText>
                  {entry.phonetic ? (
                    <ThemedText themeColor="textSecondary" style={styles.phonetic}>
                      /{entry.phonetic}/
                    </ThemedText>
                  ) : null}
                </View>
                <ThemedText type="smallBold" themeColor="accent" style={styles.pos}>
                  {entry.pos}
                </ThemedText>
              </View>

              {result?.status === 'inflected' && result.query !== entry.headword ? (
                <ThemedView type="backgroundElement" style={styles.notice}>
                  <ThemedText type="small" themeColor="textSecondary">
                    你查的是原文词形 “{result.query}”,已还原为 {entry.headword}。
                  </ThemedText>
                </ThemedView>
              ) : null}

              <View style={[styles.divider, { backgroundColor: theme.border }]} />

              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
                中文释义
              </ThemedText>
              <ThemedText style={styles.zh}>{entry.zh}</ThemedText>

              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
                English Definition
              </ThemedText>
              <ThemedText style={styles.en}>{entry.en}</ThemedText>

              {entry.example ? (
                <>
                  <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
                    例句
                  </ThemedText>
                  <ThemedView type="backgroundElement" style={styles.exampleBox}>
                    <ThemedText type="small" style={styles.example}>
                      {entry.example}
                    </ThemedText>
                  </ThemedView>
                </>
              ) : null}
            </>
          ) : (
            <>
              <ThemedText type="title" style={styles.word}>
                {result?.query ?? rawWord}
              </ThemedText>
              <ThemedView type="backgroundElement" style={styles.exampleBox}>
                <ThemedText type="small" themeColor="textSecondary">
                  {result?.hint ?? '离线词典未收录该词。'}
                </ThemedText>
              </ThemedView>
            </>
          )}
        </View>

        {/* 操作区 */}
        {entry ? (
          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={({ pressed }) => pressed && styles.pressed}>
            <ThemedView
              type={saved ? 'backgroundElement' : 'backgroundSelected'}
              style={styles.saveBtn}>
              <ThemedText
                type="smallBold"
                style={{ color: saved ? theme.textSecondary : theme.accent }}>
                {saving ? '处理中…' : saved ? '✓ 已在生词本(点按取消)' : '＋ 加入生词本'}
              </ThemedText>
            </ThemedView>
          </Pressable>
        ) : null}

        {params.articleId ? (
          <Pressable
            onPress={() => router.push(`/article/${params.articleId}`)}
            style={({ pressed }) => pressed && styles.pressed}>
            <ThemedView type="backgroundElement" style={styles.sourceBtn}>
              <ThemedText type="small" themeColor="accent">
                查看来源文章 →
              </ThemedText>
            </ThemedView>
          </Pressable>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
    gap: Spacing.two,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 34,
    lineHeight: 36,
    marginTop: -4,
  },
  topBarTitle: {
    flex: 1,
    textAlign: 'center',
  },
  topBarRight: {
    width: 36,
  },
  content: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    gap: Spacing.three,
  },
  mainCard: {
    gap: Spacing.two,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  flagBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: 999,
  },
  titleCol: {
    flexShrink: 1,
    gap: Spacing.half,
  },
  word: {
    fontSize: 44,
    lineHeight: 52,
  },
  phonetic: {
    fontSize: 18,
    lineHeight: 24,
  },
  pos: {
    paddingTop: Spacing.two,
  },
  notice: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.two,
  },
  sectionLabel: {
    marginTop: Spacing.one,
    letterSpacing: 0.4,
  },
  zh: {
    fontSize: 20,
    lineHeight: 30,
    fontWeight: '600',
  },
  en: {
    fontSize: 17,
    lineHeight: 26,
  },
  exampleBox: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    marginTop: Spacing.one,
  },
  example: {
    fontStyle: 'italic',
    lineHeight: 22,
  },
  saveBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
  },
  sourceBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
  },
  pressed: {
    opacity: 0.6,
  },
});
