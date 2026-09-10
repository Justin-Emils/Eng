/**
 * 语料自动管线 · 标注(纯函数)。
 * 把切分出的段落块转成 RawArticle:
 * - 标题/摘要:由首段文本启发式生成;
 * - 难度:统计块内单词的"平均词频门槛",映射到词汇量/CEFR;
 * - 话题:由关键词命中粗略打标(科技/文化/生活/新闻/科学/社会/历史/环境)。
 * keyWords 置空 —— 阅读页标蓝不依赖语料预标注。
 */

import type { RawArticle } from '@/data/articles/build';
import { vocabToCefr } from '@/domain/levels';
import { wordFreqThreshold } from '@/domain/wordlevel';
import { extractWords } from '@/domain/wordmark';
import type { CefrLevel } from '@/types';

export interface CandidateBlock {
  paragraphs: string[];
}

/** 从一段文本生成标题(取前几个实词大写) */
export function titleFromText(text: string, max = 8): string {
  const words = extractWords(text).filter((w) => w.length > 3);
  const title = words.slice(0, max).join(' ');
  return title ? title.charAt(0).toUpperCase() + title.slice(1) : 'Untitled Passage';
}

/** 话题关键词表 */
const TOPIC_HINTS: { tag: string; words: string[] }[] = [
  { tag: '科技', words: ['technology', 'computer', 'internet', 'machine', 'digital', 'software', 'data', 'robot', 'phone', 'network'] },
  { tag: '科学', words: ['science', 'experiment', 'research', 'theory', 'biology', 'physics', 'chemistry', 'nature', 'evolution', 'species'] },
  { tag: '经济', words: ['economy', 'money', 'market', 'trade', 'bank', 'price', 'business', 'industry', 'finance', 'capital'] },
  { tag: '教育', words: ['education', 'school', 'university', 'student', 'teacher', 'learning', 'knowledge', 'curriculum'] },
  { tag: '环境', words: ['environment', 'climate', 'pollution', 'forest', 'energy', 'carbon', 'sustainable', 'ecology'] },
  { tag: '文化', words: ['culture', 'art', 'music', 'literature', 'tradition', 'language', 'history', 'poetry', 'book'] },
  { tag: '社会', words: ['society', 'government', 'law', 'social', 'community', 'public', 'politics', 'citizen', 'crime', 'war'] },
  { tag: '生活', words: ['life', 'health', 'food', 'family', 'work', 'home', 'daily', 'habit'] },
];

/** 粗略话题标签(取命中数前 2) */
export function tagsFromText(paragraphs: string[]): string[] {
  const joined = paragraphs.join(' ').toLowerCase();
  const hits = TOPIC_HINTS.map((h) => ({
    tag: h.tag,
    score: h.words.reduce((s, w) => s + (joined.includes(w) ? 1 : 0), 0),
  })).filter((h) => h.score > 0);
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, 2).map((h) => h.tag);
}

/**
 * 估算一段文本的学习难度:取各单词"词频门槛"(无门槛词忽略)的平均,
 * 映射回词汇量区间。纯口语短词会拉低,学术词拉高,粗估即可。
 */
export function estimateLevel(paragraphs: string[]): { level: CefrLevel; vocab: number } {
  const words = extractWords(paragraphs.join(' '));
  const thresholds: number[] = [];
  for (const w of words) {
    const t = wordFreqThreshold(w);
    if (t != null) thresholds.push(t);
  }
  const avg = thresholds.length > 0 ? thresholds.reduce((a, b) => a + b, 0) / thresholds.length : 3000;
  const vocab = Math.round(Math.max(1000, Math.min(12000, avg)));
  return { level: vocabToCefr(vocab), vocab };
}

/** 生词密度(命中"考研词表且非基础高频"的词占 unique 词比例),供筛选 */
export function estimateNoveltyDensity(paragraphs: string[]): number {
  const words = [...new Set(extractWords(paragraphs.join(' ')).map((w) => w.toLowerCase()))];
  if (words.length === 0) return 0;
  const novel = words.filter((w) => {
    const f = wordFreqThreshold(w);
    // 词频非常靠前(基础)不算生词
    return f != null && f > 3500;
  });
  return novel.length / words.length;
}

/**
 * 段落块 → RawArticle。
 * @param blockId 稳定 id(如 书号-序号),用于 url/去重
 */
export function annotateBlock(
  block: CandidateBlock,
  bookTitle: string,
  blockId: string,
  coverUrl?: string,
): RawArticle {
  const firstText = block.paragraphs.join(' ');
  const { level, vocab } = estimateLevel(block.paragraphs);
  const summary = firstText.slice(0, 120).trim() + (firstText.length > 120 ? '…' : '');
  const topicTags = tagsFromText(block.paragraphs) as RawArticle['topicTags'];
  return {
    id: blockId,
    title: titleFromText(firstText) || blockId,
    summary,
    level,
    vocab,
    topicTags: topicTags.length > 0 ? topicTags : ['文化'],
    paragraphs: block.paragraphs,
    keyWords: [],
    credit: `Project Gutenberg · ${bookTitle} · Public Domain`,
    coverUrl,
  };
}
