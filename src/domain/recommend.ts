/**
 * 推荐文章筛选(模块 B/学习闭环)—— 量化版。
 *
 * 打分改用**预测理解率**(连续量)做主判据,不再用"档差 ±1"(离散桶)。
 * 原因:档宽 400–1200 词,"差 1 档"既可能是差 20 个词,也可能是差 990 个词,
 * 同一个"略有挑战"标签背后难度差几十倍。
 *
 * 目标区间按用户选定 = 学习区:**理解率 93%–96%**(生词率 4%–7%)。
 * 两个维度:
 *   1. **理解率贴合度**(权重 0.7):越接近区间中枢(94.5%)越好;
 *   2. **可学词适配**(权重 0.3):新词集中在"够得着"的范围(+2000 词以内)最有价值;
 *      太少 → 学不到东西;噪音词过多(过难)→ 打折。
 * 细分档位(bandGap / bandLabel)仅用于展示与兜底排序,不再参与主打分。
 */

import {
  coverageFitLabel,
  difficultyOf,
  learnableWords,
} from '@/domain/difficulty';
import { defaultCurve, expectedCoverage, type KnowledgeCurve } from '@/domain/knowledge';
import { bandIndexOf, bandLabelOf } from '@/domain/levels';
import { isStudyCandidate } from '@/domain/wordlevel';
import { extractWords } from '@/domain/wordmark';
import type { Article } from '@/types';

/** 目标理解率区间(学习区:生词率 4%–7%);与 domain/profile.ts 的 LEARNING_ZONE 一致 */
export const TARGET_COVERAGE = { min: 0.93, max: 0.96 } as const;
const COVERAGE_CENTER = (TARGET_COVERAGE.min + TARGET_COVERAGE.max) / 2;
/** 理解率偏离中枢多少就基本不给分(0.06 ≈ 半个区间宽的两倍) */
const COVERAGE_TOLERANCE = 0.06;
/** 理想的可学新词数(去重口径):太少学不到东西,太多读得累 */
const IDEAL_NEW_WORDS = 12;
/** 明显不在目标区间的惩罚系数(仍保留兜底出场的机会) */
const OUT_OF_RANGE_PENALTY = 0.35;
/** 噪音词比例超过这个值再打折 */
const NOISE_RATIO_LIMIT = 0.05;

export interface RecommendInput {
  articles: Article[];
  /** 用户词汇量(量化后的点估计) */
  userVocab: number;
  /**
   * 掌握概率曲线(见 domain/knowledge)。给了就按"概率加权理解率"匹配 ——
   * 4200 档的词不会因为词汇量够就被判成全认识。不给则退化为硬阈值版本。
   */
  curve?: KnowledgeCurve;
  /** 已学过的词(小写) */
  learned: ReadonlySet<string>;
  /** 已认识(用户标"我会了",小写) */
  known: ReadonlySet<string>;
  /** 希望返回的篇数 */
  count?: number;
  /** 已读文章 id(不推荐) */
  excludeIds?: ReadonlySet<string>;
  /** 是否允许在全部文章已读/都不合适时兜底返回(默认 true) */
  allowFallback?: boolean;
}

export interface Recommendation {
  article: Article;
  /** 读懂 95% 词所需词汇量(文章难度,连续值) */
  requiredVocab: number;
  /** 预测理解率(0–1):该用户能认识的 running words 比例 */
  coverage: number;
  /** 超出用户水平的实词比例(0–1)= 1 - coverage */
  unknownRate: number;
  /** 值得学的去重新词数 */
  learnableCount: number;
  /** 其中考研大纲词数量 */
  examWordCount: number;
  /** 过难噪音词数 */
  noisyCount: number;
  /** 是否落在学习区(理解率 93%–96%) */
  inRange: boolean;
  /** 人话评价:刚好合适 / 稍简单 / 偏难 …(按理解率判定) */
  fit: string;
  /** —— 参考层(旧体系,仅展示与兜底) —— */
  bandLabel: string;
  bandGap: number;
  /** 该篇对用户的新词数(去重口径,与域内统一口径) */
  newWordCount: number;
  /** 新词示例(最多 3 个) */
  sampleNewWords: string[];
  /** 是否已读(仅兜底时可能出现) */
  read?: boolean;
  /** 推荐理由(量化文案) */
  reason: string;
}

/** 判断是否"该用户尚未掌握的词"(供密度统计) */
export function isNewForUser(
  word: string,
  userVocab: number,
  learned: ReadonlySet<string>,
  known: ReadonlySet<string>,
): boolean {
  const w = word.toLowerCase();
  if (learned.has(w) || known.has(w)) return false;
  return isStudyCandidate(word, userVocab);
}

/** 统计一篇的候选生词(去重口径):数量 + 示例词 */
export function computeArticleNewWords(
  article: Article,
  userVocab: number,
  learned: ReadonlySet<string>,
  known: ReadonlySet<string>,
): { newCount: number; samples: string[] } {
  const words = extractWords(article.paragraphs.join(' '));
  const unique = [...new Set(words.map((w) => w.toLowerCase()))];
  if (unique.length === 0) return { newCount: 0, samples: [] };
  const newWords: string[] = [];
  for (const w of unique) {
    if (isNewForUser(w, userVocab, learned, known)) newWords.push(w);
  }
  return { newCount: newWords.length, samples: newWords.slice(0, 3) };
}

interface Row {
  article: Article;
  requiredVocab: number;
  coverage: number;
  learnable: number;
  examWords: number;
  noisy: number;
  bandGap: number;
  ideal: boolean;
  inRange: boolean;
  score: number;
  newCount: number;
  samples: string[];
  read: boolean;
}

/**
 * 生成推荐:
 * - 排除已读文章(excludeIds);
 * - 按理解率贴合度 + 可学词适配打分,目标区间内优先;
 * - 附带量化推荐理由(理解率 / 新词数 / 参考档位)。
 */
export function recommendFor(input: RecommendInput): Recommendation[] {
  const count = input.count ?? 3;
  const fallback = input.allowFallback ?? true;
  const userBandIdx = bandIndexOf(input.userVocab);
  const curve = input.curve ?? defaultCurve(input.userVocab);

  const rows: Row[] = input.articles
    .map((article) => {
      const info = difficultyOf(article);
      // 概率加权理解率:比"词汇量硬阈值"更接近真实阅读体验
      const coverage = expectedCoverage(article.paragraphs, curve);
      const { learnable, examWords, noisy, samples } = learnableWords(
        article.paragraphs,
        input.userVocab,
      );
      const { newCount, samples: candidateSamples } = computeArticleNewWords(
        article,
        input.userVocab,
        input.learned,
        input.known,
      );
      const gap = bandIndexOf(info.requiredVocab) - userBandIdx;
      const inRange = coverage >= TARGET_COVERAGE.min && coverage <= TARGET_COVERAGE.max;

      // 理解率贴合度:越接近区间中枢越高
      const coverageScore = Math.max(
        0,
        1 - Math.abs(coverage - COVERAGE_CENTER) / COVERAGE_TOLERANCE,
      );
      // 可学词适配:接近理想新词数最高;完全没有新词 → 0
      const learnableScore =
        learnable <= 0
          ? 0
          : Math.max(0, 1 - Math.abs(learnable - IDEAL_NEW_WORDS) / IDEAL_NEW_WORDS);
      const noisePenalty = noisy / Math.max(1, info.tokens) > NOISE_RATIO_LIMIT ? 0.7 : 1;

      const score =
        (0.7 * coverageScore + 0.3 * learnableScore) *
        (inRange ? 1 : OUT_OF_RANGE_PENALTY) *
        noisePenalty;

      return {
        article,
        requiredVocab: info.requiredVocab,
        coverage,
        learnable,
        examWords,
        noisy,
        bandGap: gap,
        ideal: inRange,
        inRange,
        score,
        newCount,
        samples: samples.length > 0 ? samples : candidateSamples,
        read: input.excludeIds?.has(article.id) ?? false,
      };
    })
    .sort(
      (a, b) =>
        Number(a.read) - Number(b.read) ||
        Number(b.inRange) - Number(a.inRange) ||
        b.score - a.score ||
        a.article.difficulty.wordCount - b.article.difficulty.wordCount,
    );

  // 未读优先取前 count;不足时允许用已读兜底(fallback)
  const unread = rows.filter((r) => !r.read);
  const pickedSrc = unread.length >= count ? unread : fallback ? rows : unread;

  // 话题多样性贪心:但**难度合适优先** —— 绝不为话题分散而选一篇明显太难/太简单的
  const picked: Row[] = [];
  const usedTopics = new Set<string>();
  const rest = [...pickedSrc];
  while (picked.length < count && rest.length > 0) {
    const topicIsNew = (r: Row) => !r.article.topicTags.some((t) => usedTopics.has(t));
    // 1) 目标区间内 + 话题新 → 2) 目标区间内 → 3) 话题新 → 4) 剩余里最好的
    let idx = rest.findIndex((r) => r.inRange && topicIsNew(r));
    if (idx < 0) idx = rest.findIndex((r) => r.inRange);
    if (idx < 0) idx = rest.findIndex(topicIsNew);
    const chosen = idx >= 0 ? rest.splice(idx, 1)[0] : rest.shift()!;
    for (const t of chosen.article.topicTags) usedTopics.add(t);
    picked.push(chosen);
  }

  return picked.map((r) => {
    const fit = coverageFitLabel(r.coverage);
    const coverageText = `${(r.coverage * 100).toFixed(1)}%`;
    const examText = r.examWords > 0 ? `(其中 ${r.examWords} 个考研词)` : '';
    const refBand = bandLabelOf(r.requiredVocab);
    const reason = r.read
      ? '已读回顾(其余文章都已读完)'
      : `预计认识 ${coverageText} 的词 · 新词 ${r.learnable} 个${examText} · 参考档位 ${refBand}`;

    return {
      article: r.article,
      requiredVocab: r.requiredVocab,
      coverage: r.coverage,
      unknownRate: 1 - r.coverage,
      learnableCount: r.learnable,
      examWordCount: r.examWords,
      noisyCount: r.noisy,
      inRange: r.inRange,
      fit,
      bandLabel: refBand,
      bandGap: r.bandGap,
      newWordCount: r.newCount,
      sampleNewWords: r.samples,
      read: r.read || undefined,
      reason,
    };
  });
}
