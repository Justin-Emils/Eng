/**
 * 语料构造器:把"手写语料"(不含 wordCount/minutes)补全为完整 Article。
 * wordCount 与 minutes 由正文自动统计,保证与段落文本一致,避免手工数词出错。
 */

import type { Article, ArticleDifficulty, CefrLevel, KeyWord, TopicTag } from '@/types';

/** 估算阅读速度(wpm),用于 minutes 计算(需求:120–180 wpm,取 150) */
export const READING_WPM = 150;

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
    minutes: Math.max(1, Math.round(wordCount / READING_WPM)),
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
