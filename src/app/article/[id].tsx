import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  View,
  type ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ArticleCover } from '@/components/article-cover';
import { ChipRow } from '@/components/chip';
import { DictCard } from '@/components/dict-card';
import { HeadingTranslate } from '@/components/heading-translate';
import { SentenceBlock } from '@/components/sentence-block';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { getArticleById } from '@/data/articles';
import { offlineDictionary, type LookupResult } from '@/domain/dictionary';
import { CEFR_REPRESENTATIVE_VOCAB } from '@/domain/levels';
import { splitSentences, extractWords } from '@/domain/wordmark';
import { isStudyCandidate } from '@/domain/wordlevel';
import { useTheme } from '@/hooks/use-theme';
import { addCheckin } from '@/storage/checkins';
import { getAllKnown, getAllLearned, getLearnedToday, markKnown, markLearned } from '@/storage/learning';
import { getReadingProgress, markArticleCompleted, saveReadingProgress } from '@/storage/progress';
import { getUserLevel } from '@/storage/user';

const MIN_FONT = 16;
const MAX_FONT = 28;
const DEFAULT_FONT = 19;
/** 到达末段后停留多久(ms)自动视为读完 */
const AUTO_COMPLETE_DELAY = 4000;

/**
 * 阅读页(模块 D + M1.2 进度续读 / 打卡):
 * - 段落 → 句子 渲染;点词查词 / 概要卡 / 详情 / 生词本;句末「译」在线整句翻译;
 * - 进度:进入自动恢复到上次位置;滚动时自动保存当前段;读完全文自动打卡,
 *   也可点底部「已完成阅读」手动打卡;
 * - 字号 A-/A+。
 * 下一里程碑:长按划词/词组、译段。
 */
export default function ArticleReaderScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const article = id ? getArticleById(id) : undefined;

  const [fontSize, setFontSize] = useState(DEFAULT_FONT);
  const [dictResult, setDictResult] = useState<LookupResult | null>(null);
  const [dictVisible, setDictVisible] = useState(false);
  const [dictKaoyan, setDictKaoyan] = useState(false);
  const [dictStudyState, setDictStudyState] = useState<'candidate' | 'learned' | 'known' | null>(null);
  // 点词时所在句子:收藏生词时记作 sourceSentence,供复习例句/详情使用
  const [pendingSentence, setPendingSentence] = useState<string | undefined>(undefined);
  const [completed, setCompleted] = useState(false);
  // 是否为"首次渲染后需要恢复滚动位置"(加载完进度前不滚)
  const [restoreIndex, setRestoreIndex] = useState<number | null>(null);

  // 学习闭环:用户词汇量 / 已学 / 今日新学 / 已会
  const [userVocab, setUserVocab] = useState(CEFR_REPRESENTATIVE_VOCAB.B1);
  const [learnedSet, setLearnedSet] = useState<ReadonlySet<string>>(new Set());
  const [learnedToday, setLearnedToday] = useState<ReadonlySet<string>>(new Set());
  const [knownSet, setKnownSet] = useState<ReadonlySet<string>>(new Set());

  // 查词缓存(同一词不重复查):用 ref,避免 React Compiler 把 map 当不可变参数
  const lookupCacheRef = useRef(new Map<string, LookupResult>());
  const listRef = useRef<FlatList<{ index: number; sentences: string[] }>>(null);
  // 已保存进度的段索引(避免滚动时重复写)
  const lastSavedIndexRef = useRef(0);
  // 自动完成打卡计时器
  const completeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // completed 的 ref 镜像:供 setTimeout 回调读最新值(避免闭包过期);用 effect 同步,不在渲染期写 ref
  const completedRef = useRef(false);
  useEffect(() => {
    completedRef.current = completed;
  }, [completed]);

  // 段落 → 句子 拆分(只在文章变化时重算);放在条件 return 之前(遵守 hooks 规则)
  const paragraphItems = useMemo(
    () =>
      article
        ? article.paragraphs.map((text, index) => ({ index, sentences: splitSentences(text) }))
        : [],
    [article],
  );

  // 载入学习上下文:用户水平、已学/今日/已会集合
  useEffect(() => {
    if (!article) return;
    let active = true;
    const load = async () => {
      const [level, learnedAll, todaySet, knownAll] = await Promise.all([
        getUserLevel(),
        getAllLearned(),
        getLearnedToday(),
        getAllKnown(),
      ]);
      if (!active) return;
      const vocab = (level.assessed ? level.vocab : undefined) ?? CEFR_REPRESENTATIVE_VOCAB[level.level];
      setUserVocab(vocab);
      setLearnedSet(learnedAll);
      setLearnedToday(todaySet);
      setKnownSet(knownAll);
    };
    load().catch(() => {});
    return () => {
      active = false;
    };
  }, [article]);

  // 全篇候选生词集合(标蓝):门槛高于用户词汇量 且 未学 且 未会
  const candidateSet = useMemo(() => {
    if (!article) return new Set<string>();
    const set = new Set<string>();
    const words = extractWords(article.paragraphs.join(' '));
    for (const w of words) {
      const lower = w.toLowerCase();
      if (learnedSet.has(lower) || knownSet.has(lower)) continue;
      if (isStudyCandidate(w, userVocab)) set.add(lower);
    }
    return set;
  }, [article, userVocab, learnedSet, knownSet]);

  // 挂载:读进度 → 决定是否恢复到某段;并判断是否已完成
  useEffect(() => {
    if (!article) return;
    let active = true;
    getReadingProgress(article.id)
      .then((p) => {
        if (!active) return;
        if (p?.completed) {
          setCompleted(true);
        } else if (p && p.paragraphIndex > 0) {
          setRestoreIndex(Math.min(p.paragraphIndex, Math.max(paragraphItems.length - 1, 0)));
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
    // 只在文章变化时执行一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article]);

  // restoreIndex 确定后滚动到该段(数据就绪后)
  useEffect(() => {
    if (restoreIndex === null || !article) return;
    const timer = setTimeout(() => {
      listRef.current?.scrollToIndex({ index: restoreIndex, animated: false });
    }, 120);
    return () => clearTimeout(timer);
  }, [restoreIndex, article]);

  // 卸载时清理计时器
  useEffect(() => {
    return () => {
      if (completeTimerRef.current) clearTimeout(completeTimerRef.current);
    };
  }, []);

  if (!article) {
    return (
      <ThemedView style={[styles.center, { paddingTop: insets.top }]}>
        <ThemedText>文章不存在或已被移除</ThemedText>
        <Pressable onPress={() => router.back()}>
          <ThemedText themeColor="accent">返回</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  const d = article.difficulty;
  const meta = [`${d.level}`, `词汇 ${d.vocab}`, `${d.wordCount} 词`, `约 ${d.minutes} 分钟`];
  const chips = [...meta, ...article.topicTags];

  const handleWordPress = (word: string, sentence?: string) => {
    const cache = lookupCacheRef.current;
    const key = word.toLowerCase();
    let result = cache.get(key);
    if (!result) {
      result = offlineDictionary.lookup(word);
      cache.set(key, result);
    }
    // 学习状态:已学(今日或历史)> 已会 > 候选生词 > 无
    const isKnownWord = knownSet.has(key);
    const isLearned = learnedSet.has(key);
    const isCandidate = isStudyCandidate(word, userVocab);
    setDictStudyState(
      isLearned ? 'learned' : isKnownWord ? 'known' : isCandidate ? 'candidate' : null,
    );
    setDictKaoyan(isStudyCandidate(word, userVocab));
    setPendingSentence(sentence);
    setDictResult(result);
    setDictVisible(true);
  };

  /** 标记今日学习(进入学习流;正文立即加粗并从候选蓝中移除) */
  const handleMarkLearned = async (headword: string) => {
    await markLearned(headword);
    const lower = headword.toLowerCase();
    setLearnedSet((prev) => new Set([...prev, lower]));
    setLearnedToday((prev) => new Set([...prev, lower]));
    setDictStudyState('learned');
  };

  /** 标记"我已会"(不再当作生词) */
  const handleMarkKnown = async (headword: string) => {
    await markKnown(headword);
    const lower = headword.toLowerCase();
    setKnownSet((prev) => new Set([...prev, lower]));
    setDictStudyState('known');
  };

  const finishArticle = async () => {
    if (!article || completedRef.current) return;
    setCompleted(true);
    await markArticleCompleted(article.id);
    await addCheckin(article.id);
  };

  /** 保存进度:段索引变化时才写;并处理读完自动打卡 */
  const handleViewableChanged = (info: { viewableItems: ViewToken[] }) => {
    if (!article || paragraphItems.length === 0) return;
    const visible = info.viewableItems
      .map((v) => (typeof v.index === 'number' ? v.index : -1))
      .filter((i) => i >= 0)
      .sort((a, b) => a - b);
    if (visible.length === 0) return;
    // 取最靠上的可见段作为"当前读到的位置"
    const topVisible = visible[0];
    if (topVisible !== lastSavedIndexRef.current) {
      lastSavedIndexRef.current = topVisible;
      void saveReadingProgress(article.id, { paragraphIndex: topVisible });
    }
    // 读到末段:启动自动完成计时
    const reachedEnd = visible.includes(paragraphItems.length - 1);
    if (reachedEnd && !completeTimerRef.current) {
      completeTimerRef.current = setTimeout(() => {
        completeTimerRef.current = null;
        if (lastSavedIndexRef.current >= paragraphItems.length - 1) {
          void finishArticle();
        }
      }, AUTO_COMPLETE_DELAY);
    } else if (!reachedEnd && completeTimerRef.current) {
      clearTimeout(completeTimerRef.current);
      completeTimerRef.current = null;
    }
  };

  const listHeader = (
    <View style={styles.header}>
      <View style={styles.heroWrap}>
        <ArticleCover article={article} size="hero" />
      </View>
      <View style={styles.headerBody}>
        <ThemedText type="subtitle" style={styles.title}>
          {article.title}
        </ThemedText>
        {completed ? (
          <ThemedView type="backgroundSelected" style={styles.doneChip}>
            <ThemedText type="smallBold" themeColor="accent">
              ✓ 已读完本篇
            </ThemedText>
          </ThemedView>
        ) : null}
        {article.summary ? (
          <ThemedText themeColor="textSecondary" style={styles.summary}>
            {article.summary}
          </ThemedText>
        ) : null}
        {/* 与段落一致:单个「译」按钮,展开标题+简介对照译文 */}
        <HeadingTranslate title={article.title} summary={article.summary} />
        <ChipRow items={chips} />
        {article.credit ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.credit}>
            来源:{article.credit}
          </ThemedText>
        ) : null}
        <ThemedText type="small" themeColor="textSecondary" style={styles.tapHint}>
          蓝=按你词汇量该学的生词 · 蓝粗=今日新学 · 点词可查义/标记学习
        </ThemedText>
      </View>
    </View>
  );

  const listFooter = (
    <View style={styles.footer}>
      {completed ? (
        <ThemedView type="backgroundSelected" style={styles.finishBtn}>
          <ThemedText type="smallBold" themeColor="accent">
            ✓ 已完成 · 已记录今日打卡
          </ThemedText>
        </ThemedView>
      ) : (
        <Pressable onPress={() => void finishArticle()} style={({ pressed }) => pressed && styles.pressed}>
          <ThemedView type="backgroundSelected" style={styles.finishBtn}>
            <ThemedText type="smallBold" themeColor="accent">
              已完成阅读,打卡 ✓
            </ThemedText>
          </ThemedView>
        </Pressable>
      )}
    </View>
  );

  const lineHeight = Math.round(fontSize * 1.7);

  return (
    <ThemedView style={styles.flex}>
      {/* 顶部工具条 */}
      <View style={[styles.topBar, { paddingTop: insets.top + Spacing.two }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}>
          <ThemedText style={styles.backIcon} themeColor="accent">
            ‹
          </ThemedText>
        </Pressable>
        <ThemedText type="smallBold" numberOfLines={1} style={styles.topBarTitle}>
          {article.title}
        </ThemedText>
        <View style={styles.fontControls}>
          <Pressable
            onPress={() => setFontSize((s) => Math.max(MIN_FONT, s - 1))}
            style={({ pressed }) => [styles.fontBtn, pressed && { opacity: 0.5 }]}>
            <ThemedText type="smallBold">A−</ThemedText>
          </Pressable>
          <Pressable
            onPress={() => setFontSize((s) => Math.min(MAX_FONT, s + 1))}
            style={({ pressed }) => [styles.fontBtn, pressed && { opacity: 0.5 }]}>
            <ThemedText type="smallBold">A+</ThemedText>
          </Pressable>
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={paragraphItems}
        keyExtractor={(p) => String(p.index)}
        renderItem={({ item }) => (
          <View style={styles.paragraphWrap}>
            {item.sentences.map((sentence, si) => (
              <SentenceBlock
                key={`${item.index}-${si}`}
                sentence={sentence}
                fontSize={fontSize}
                lineHeight={lineHeight}
                candidateSet={candidateSet}
                todayLearnedSet={learnedToday}
                onWordPress={(word) => handleWordPress(word, sentence)}
              />
            ))}
          </View>
        )}
        ListHeaderComponent={listHeader}
        ListFooterComponent={listFooter}
        onViewableItemsChanged={handleViewableChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 40 }}
        onScrollToIndexFailed={({ index, averageItemLength }) => {
          // 段落高度不定导致 scrollToIndex 失败时,按平均高度估算偏移量兜底
          listRef.current?.scrollToOffset({
            offset: Math.max(0, index * averageItemLength),
            animated: false,
          });
        }}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + Spacing.six },
        ]}
        style={{ backgroundColor: theme.background }}
      />

      <DictCard
        result={dictResult}
        visible={dictVisible}
        source={{ articleId: article.id, sentence: pendingSentence }}
        kaoyan={dictKaoyan}
        studyState={dictStudyState}
        onMarkLearned={(headword) => void handleMarkLearned(headword)}
        onMarkKnown={(headword) => void handleMarkKnown(headword)}
        onOpenDetail={(headword) => {
          setDictVisible(false);
          router.push({ pathname: '/word/[word]', params: { word: headword, articleId: article.id } });
        }}
        onClose={() => setDictVisible(false)}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
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
  },
  fontControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  fontBtn: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.two,
  },
  listContent: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
  },
  header: {
    gap: Spacing.three,
    // 顶部不需要 padding,封面从最上开始
  },
  heroWrap: {
    marginHorizontal: -Spacing.four,
  },
  headerBody: {
    gap: Spacing.three,
    paddingBottom: Spacing.three,
  },
  doneChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: 999,
  },
  title: {
    fontSize: 26,
    lineHeight: 34,
  },
  summary: {
    lineHeight: 24,
  },
  tapHint: {
    lineHeight: 20,
  },
  credit: {
    lineHeight: 16,
    opacity: 0.75,
  },
  paragraphWrap: {
    marginBottom: Spacing.four,
  },
  footer: {
    paddingVertical: Spacing.two,
  },
  finishBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
  },
  pressed: {
    opacity: 0.6,
  },
});
