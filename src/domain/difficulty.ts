/**
 * 文章难度评估(唯一口径)。
 *
 * 为什么不用"平均词频":旧实现把全文所有词的词频门槛求平均,
 * 结果一篇"多数简单词 + 少数超难词"的文章会显得很温和(平均值被拉平),
 * 而实际阅读时卡住的正是那些词。
 *
 * 现在用**覆盖率口径**(二语习得里的通行做法):
 *   读懂 95% 的实词 ≈ 可以勉强流畅阅读;98% ≈ 舒适阅读。
 *   于是"所需词汇量"= 全文实词按门槛排序后的第 95 / 98 百分位,
 *   即"掌握这么多词,就能认识这篇文章 95%/98% 的词"。
 *
 * 该指标是**连续值**(如 3820),再映射到 11 档细分档位用于展示与推荐匹配。
 */

import { LEVEL_BANDS, bandOf, type LevelBand } from '@/domain/levels';
import { frqToThreshold, wordThreshold } from '@/domain/wordlevel';
import { freqRankOf } from '@/domain/wordfreq';
import { extractWords } from '@/domain/wordmark';
import type { Article } from '@/types';

/** 词典查不到的词按"超纲"计(阈值取上限) */
const UNKNOWN_THRESHOLD = 12000;
/** 覆盖率档位 */
const COVERAGE_MAIN = 0.95;
const COVERAGE_EASY = 0.98;

export interface ArticleDifficultyInfo {
  /** 读懂 95% 实词所需词汇量(核心指标,连续值) */
  requiredVocab: number;
  /** 读懂 98% 实词所需词汇量(舒适阅读门槛) */
  requiredVocab98: number;
  /** 细分难度档 */
  band: LevelBand;
  /** 统计到的实词数(含重复,即 running words) */
  tokens: number;
}

/** 取百分位(升序数组中的第 p 分位) */
function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return UNKNOWN_THRESHOLD;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))));
  return sorted[idx];
}

/**
 * 单个词"认识它大约需要多少词汇量":
 *  1. 有词频名次(广表)→ 按名次连续映射(500–12000),让不同文章能拉开差距;
 *  2. 属于考试标签词(考研/六级等)→ **不少于其标签门槛**,与全站"该学词/标蓝"口径一致
 *     (考研大纲词就是按 5500 计,不能因为它在语料里常见就算得更容易);
 *  3. 无任何数据 → 视为超纲(按上限计)。
 */
function thresholdOf(word: string): number {
  const rank = freqRankOf(word);
  const tagged = wordThreshold(word);
  if (rank != null) {
    const byRank = frqToThreshold(rank);
    return tagged != null ? Math.max(byRank, tagged) : byRank;
  }
  return tagged ?? UNKNOWN_THRESHOLD;
}

/** 把一段文本的所有实词转成"认识它所需的词汇量"门槛 */
function thresholdsOf(paragraphs: readonly string[]): number[] {
  const tokens = extractWords(paragraphs.join(' '));
  const out: number[] = [];
  for (const t of tokens) {
    out.push(thresholdOf(t));
  }
  return out;
}

/** 估算一段文本的难度(无缓存,纯函数) */
export function estimateDifficulty(paragraphs: readonly string[]): ArticleDifficultyInfo {
  const sorted = thresholdsOf(paragraphs).sort((a, b) => a - b);
  // 95 分位 = 认识 95% 实词所需词汇量;
  // 再与"最难那 10% 词的平均门槛"混合,避免所有文章都挤在标签档位(3000/4200/5500)上
  const p95 = percentile(sorted, COVERAGE_MAIN);
  const tail = sorted.slice(Math.floor(sorted.length * 0.9));
  const tailMean = tail.length > 0 ? tail.reduce((a, b) => a + b, 0) / tail.length : p95;
  const requiredVocab = Math.round(0.6 * p95 + 0.4 * tailMean);
  return {
    requiredVocab,
    requiredVocab98: Math.round(percentile(sorted, COVERAGE_EASY)),
    band: bandOf(requiredVocab),
    tokens: sorted.length,
  };
}

/* ---------------- 缓存(同一篇文章只算一次) ---------------- */

const cache = new Map<string, ArticleDifficultyInfo>();

function cacheKey(article: Article): string {
  return `${article.id}|${article.paragraphs.length}|${article.paragraphs[0]?.length ?? 0}`;
}

/** 取某篇文章的难度(带缓存);语料未变化时复用上次结果 */
export function difficultyOf(article: Article): ArticleDifficultyInfo {
  const key = cacheKey(article);
  const hit = cache.get(key);
  if (hit) return hit;
  const info = estimateDifficulty(article.paragraphs);
  // 简单限容,避免长期运行时缓存过大
  if (cache.size > 400) cache.clear();
  cache.set(key, info);
  return info;
}

/**
 * 对某个词汇量而言,这篇文章"超出水平的实词比例"(0–1,按 running words 计)。
 * 这才是"读起来有多难"的直接度量:
 *  - 3%–8% 理想(查词可控、有学习量);
 *  -  >12%   偏难(阅读体验差);
 *  -  <2%    偏简单(学不到新词)。
 */
export function unknownTokenRate(paragraphs: readonly string[], userVocab: number): number {
  const tokens = extractWords(paragraphs.join(' '));
  if (tokens.length === 0) return 0;
  let hard = 0;
  for (const t of tokens) {
    if (thresholdOf(t) > userVocab) hard += 1;
  }
  return hard / tokens.length;
}

/** 按"档差"给一句人话评价(档差 = 文章档 - 用户档) */
export function fitLabel(bandGapValue: number): string {
  if (bandGapValue <= -2) return '偏简单';
  if (bandGapValue === -1) return '稍简单';
  if (bandGapValue === 0) return '刚好合适';
  if (bandGapValue === 1) return '略有挑战';
  if (bandGapValue === 2) return '偏难';
  return '太难';
}

export const LEVEL_BAND_COUNT = LEVEL_BANDS.length;
