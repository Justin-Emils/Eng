/**
 * 学习统计汇总纯函数(模块 G)。
 * 各数字从 storage 聚合后,由本模块计算展示指标。
 */

import type { Article, WordItem } from '@/types';

import { countWords } from '@/data/articles/build';

/** 今日/累计学习统计(由调用方从 storage 取数后计算) */
export interface LearningStats {
  /** 今天读完的篇数(打卡数) */
  todayArticles: number;
  /** 今天读完篇目的总词数 */
  todayWordsRead: number;
  /** 累计读完篇数(全部历史) */
  totalArticlesCompleted: number;
  /** 累计阅读词数(全部已读篇的词数之和) */
  totalWordsRead: number;
  /** 生词本总数 */
  wordCount: number;
  /** 已掌握生词数 */
  masteredCount: number;
  /** 连续打卡天数 */
  streakDays: number;
}

export interface StatsInput {
  /** 今天读过的文章 */
  todayArticles: Article[];
  /** 全部读过的文章 */
  allReadArticles: Article[];
  /** 全部生词 */
  words: WordItem[];
  /** 连续打卡天数(已用 domain/stats 算好传入) */
  streakDays: number;
}

/** 汇总计算统计卡片数字 */
export function computeStats(input: StatsInput): LearningStats {
  const sumWords = (articles: Article[]) =>
    articles.reduce((sum, a) => sum + countWords(a.paragraphs), 0);

  return {
    todayArticles: input.todayArticles.length,
    todayWordsRead: sumWords(input.todayArticles),
    totalArticlesCompleted: input.allReadArticles.length,
    totalWordsRead: sumWords(input.allReadArticles),
    wordCount: input.words.length,
    masteredCount: input.words.filter((w) => w.status === 'mastered').length,
    streakDays: input.streakDays,
  };
}
