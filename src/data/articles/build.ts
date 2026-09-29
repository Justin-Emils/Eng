/**
 * 语料构造器:把"手写语料"(不含 wordCount/minutes)补全为完整 Article。
 * wordCount 与 minutes 由正文自动统计,保证与段落文本一致,避免手工数词出错。
 */

import type { Article, ArticleDifficulty, CefrLevel, KeyWord, TopicTag } from '@/types';

/**
 * 估算阅读速度(wpm),按**文章难度等级**取值,用于 minutes 计算。
 *
 * 为什么不取固定值、也不照抄 .artifacts/algo-doc.txt 的基准表:
 * 那份表(A2 80–110 / B1 110–150 / B2 150–190 / C1 190–240+)的用途是
 * **评估某个用户的实测速度是否异常**,刻度挂在"读者水平"上,随水平升高而变快。
 * 而这里要回答的是"读这篇大概要多久",刻度应挂在"文章难度"上,方向恰好相反:
 * 文章越难,同一个学习者读得越慢(生词多、长句多、需要回读和查词)。
 *
 * 旧实现两者不分、一律取 150,对 B2/C1 的考研阅读明显偏快
 * (一篇 450 词的文章只算 3 分钟),这正是"阅读时间估计太短"的来源。
 *
 * 取值口径:以中国学习者(考研 / 四六级)的实读速度为准,并留出查词与回读余量。
 * 该值只用于给用户一个量级感受,不参与评分、推荐或复习调度。
 */
const WPM_BY_LEVEL: Record<CefrLevel, number> = {
  A1: 110,
  A2: 100,
  B1: 85,
  B2: 70,
  C1: 60,
  C2: 55,
};

/** 未知等级时的兜底速度(取 B1) */
const FALLBACK_WPM = WPM_BY_LEVEL.B1;

/** 按文章词数与等级估算阅读分钟数(至少 1 分钟) */
export function estimateMinutes(wordCount: number, level: CefrLevel): number {
  const wpm = WPM_BY_LEVEL[level] ?? FALLBACK_WPM;
  return Math.max(1, Math.round(wordCount / wpm));
}

export interface RawArticle {
  id: string;
  title: string;
  summary: string;
  /** 主难度 CEFR */
  level: CefrLevel;
  /** 文章所需词汇量估计(入库时给出) */
  vocab: number;
  topicTags: TopicTag[];
  paragraphs: string[];
  keyWords: KeyWord[];
  credit?: string;
  /** 可选配图 URL */
  coverUrl?: string;
}

/** 统计一段文本的英文词数(按空白切分,过滤纯标点) */
export function countWordsInParagraph(text: string): number {
  const tokens = text.trim().split(/\s+/);
  return tokens.filter((t) => /[A-Za-z0-9]/.test(t)).length;
}

export function countWords(paragraphs: string[]): number {
  return paragraphs.reduce((sum, p) => sum + countWordsInParagraph(p), 0);
}

/** 语料缺省来源标注:未显式给出 credit 的视为 App 内置原创学习短文 */
export const DEFAULT_CREDIT = 'App 内置原创短文(学习用途)';

/** 由 raw 语料构建 Article(wordCount/minutes 自动填充) */
export function buildArticle(raw: RawArticle): Article {
  const wordCount = countWords(raw.paragraphs);
  const difficulty: ArticleDifficulty = {
    level: raw.level,
    vocab: raw.vocab,
    wordCount,
    minutes: estimateMinutes(wordCount, raw.level),
  };
  return {
    id: raw.id,
    title: raw.title,
    summary: raw.summary,
    difficulty,
    topicTags: raw.topicTags,
    paragraphs: raw.paragraphs,
    keyWords: raw.keyWords,
    credit: raw.credit?.trim() ? raw.credit : DEFAULT_CREDIT,
    coverUrl: raw.coverUrl,
  };
}
