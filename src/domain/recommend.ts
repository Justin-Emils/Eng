/**
 * 推荐文章筛选(模块 B/学习闭环)。
 *
 * 打分维度(两条都要看,才不会再推"不符合水平"的文章):
 *   1. **难度档差**:文章所需词汇量(95% 覆盖率口径)相对用户词汇量差几档。
 *      目标区 = 比用户高 1 档(学习区);差 ≤ -1 太简单、≥ +3 太难会重罚。
 *      旧实现只看生词密度、完全不比难度,所以池子里没有合适的也会硬推,
 *      这正是"推荐不符合评估水平"的原因。
 *   2. **生词比例**(按 running words 计):3%–8% 理想。
 *
 * 其他:已读文章不推荐(除非兜底);同批推荐尽量话题分散。
 */

import { difficultyOf, fitLabel, unknownTokenRate } from '@/domain/difficulty';
import { bandIndexOf, bandLabelOf } from '@/domain/levels';
import { isStudyCandidate } from '@/domain/wordlevel';
import { extractWords } from '@/domain/wordmark';
import type { Article } from '@/types';

/** 理想生词比例区间(按 running words,而非去重词) */
export const IDEAL_DENSITY = { min: 0.03, max: 0.08 };
const IDEAL_CENTER = (IDEAL_DENSITY.min + IDEAL_DENSITY.max) / 2;
/** 目标档差:比用户高 1 档最合适 */
const TARGET_BAND_GAP = 1;
/** 难度明显不合适的惩罚系数 */
const OUT_OF_RANGE_PENALTY = 0.3;

export interface RecommendInput {
  articles: Article[];
  /** 用户词汇量 */
  userVocab: number;
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
  /** 读懂 95% 词所需词汇量(连续难度值) */
  requiredVocab: number;
  /** 细分档位展示,如 "B1+ 中级上(3200–4000 词)" */
  bandLabel: string;
  /** 档差:正数表示比用户当前水平难几档 */
  bandGap: number;
  /** 人话评价:刚好合适 / 略有挑战 / 偏难 … */
  fit: string;
  /** 超出用户水平的实词比例(0–1,按 running words) */
  unknownRate: number;
  /** 是否落在理想生词区间 */
  idealDensity: boolean;
  /** 是否在"难度合适"的档差区间内 */
  inRange: boolean;
  /** 该篇对用户的新词数(去重口径,用于展示) */
  newWordCount: number;
  /** 新词示例(最多 3 个) */
  sampleNewWords: string[];
  /** 是否已读(仅兜底时可能出现) */
  read?: boolean;
  /** 推荐理由 */
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
  bandGap: number;
  unknownRate: number;
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
 * - 难度档差接近"高 1 档" + 生词比例贴近理想区间的优先;
 * - 明确不合适(档差 ≥ +3 或 ≤ -1)的只在兜底时出现;
 * - 附带推荐理由(难度档 + 生词比例 + 新词示例)。
 */
export function recommendFor(input: RecommendInput): Recommendation[] {
  const count = input.count ?? 3;
  const fallback = input.allowFallback ?? true;
  const userBandIdx = bandIndexOf(input.userVocab);

  const rows: Row[] = input.articles
    .map((article) => {
      const info = difficultyOf(article);
      const gap = bandIndexOf(info.requiredVocab) - userBandIdx;
      const rate = unknownTokenRate(article.paragraphs, input.userVocab);
      const { newCount, samples } = computeArticleNewWords(
        article,
        input.userVocab,
        input.learned,
        input.known,
      );
      const ideal = rate >= IDEAL_DENSITY.min && rate <= IDEAL_DENSITY.max;
      const inRange = gap >= -1 && gap <= 2;
      // 难度分:档差越接近目标(高 1 档)越高
      const levelScore = Math.max(0, 1 - Math.abs(gap - TARGET_BAND_GAP) / 4);
      // 生词分:越接近理想区间中值越高
      const rateScore = Math.max(0, 1 - Math.abs(rate - IDEAL_CENTER) / 0.1);
      const score = (0.6 * levelScore + 0.4 * rateScore) * (inRange ? 1 : OUT_OF_RANGE_PENALTY);
      return {
        article,
        requiredVocab: info.requiredVocab,
        bandGap: gap,
        unknownRate: rate,
        ideal,
        inRange,
        score,
        newCount,
        samples,
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
    // 1) 难度合适 + 话题新 → 2) 难度合适 → 3) 话题新 → 4) 剩余里最好的
    let idx = rest.findIndex((r) => r.inRange && topicIsNew(r));
    if (idx < 0) idx = rest.findIndex((r) => r.inRange);
    if (idx < 0) idx = rest.findIndex(topicIsNew);
    const chosen = idx >= 0 ? rest.splice(idx, 1)[0] : rest.shift()!;
    for (const t of chosen.article.topicTags) usedTopics.add(t);
    picked.push(chosen);
  }

  return picked.map((r) => {
    const sampleText = r.samples.length > 0 ? ` · 新词如 ${r.samples.join('/')}` : '';
    const band = bandLabelOf(r.requiredVocab);
    const rateText = `${(r.unknownRate * 100).toFixed(1)}%`;
    let reason: string;
    if (r.read) {
      reason = '已读回顾(其余文章都已读完)';
    } else {
      reason = `难度 ${band} · 生词 ${rateText} · ${fitLabel(r.bandGap)}${sampleText}`;
    }
    return {
      article: r.article,
      requiredVocab: r.requiredVocab,
      bandLabel: band,
      bandGap: r.bandGap,
      fit: fitLabel(r.bandGap),
      unknownRate: r.unknownRate,
      idealDensity: r.ideal,
      inRange: r.inRange,
      newWordCount: r.newCount,
      sampleNewWords: r.samples,
      read: r.read || undefined,
      reason,
    };
  });
}
