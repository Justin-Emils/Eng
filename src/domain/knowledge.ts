/**
 * 掌握概率模型 —— 取代"词汇量硬阈值"的一刀切。
 *
 * 旧口径:threshold(word) > vocab → 判定"不会";≤ vocab → 判定"会"。
 * 这与事实不符,你指出的两点都对:
 *   1. 词汇量只是**估算值**,低于它的词也可能不会(评估里 4200 档实测只认识 80%);
 *   2. 高于它的词也可能早就掌握(比如打了考研标签、但实际极常见的高频词)。
 *
 * 现在改成概率:pKnown(t) = 该用户认识"门槛为 t 的词"的概率。
 * 拟合数据来自**评估的每档正确率** —— 这是评估除了给出词汇量之外的第二份产出,
 * 以前被丢掉了,现在用它把"会 / 不会"变成一条连续曲线。
 * 没有评估明细(自选档位/从未评估)时,退化为以词汇量为中心的 logistic。
 */

import { thresholdOfWord } from '@/domain/difficulty';
import { extractWords } from '@/domain/wordmark';
import type { UserLevel } from '@/types';

/** 词典查不到的词按"超纲"计(与 difficulty.ts 保持同一常量) */
const UNKNOWN_THRESHOLD = 12000;
/** 概率上下限:任何词都不会是 100% 或 0% 把握 */
const PROB_MIN = 0.01;
const PROB_MAX = 0.995;

/** 曲线锚点:一个门槛档位上的实测掌握率 */
export interface CurveAnchor {
  threshold: number;
  rate: number;
  /** 该锚点是否由**复习**实测结果校准而来(用于说明与展示) */
  review?: boolean;
}

/**
 * 复习的分档战况(结构上与 storage/review-stats 一致)。
 * 定义在这里而不是 storage:domain 保持"只做计算",调用方把数据传进来。
 */
export type ReviewBandStats = Record<number, { known: number; total: number }>;

/** 参与校准所需的最少作答数:低于此不参与,避免 2~3 个样本把曲线拽歪 */
export const REVIEW_MIN_SAMPLES = 5;
/** 收缩强度(伪计数):越大越向评估曲线靠,4 表示约等于 4 个虚拟样本 */
const REVIEW_SHRINK = 4;

export interface KnowledgeCurve {
  /** 认识"门槛为 t 的词"的概率(0–1,单调不增) */
  pKnown: (threshold: number) => number;
  /** 曲线来源:评估拟合 / 评估+复习校准 / 默认 logistic */
  source: 'assessment' | 'assessment+review' | 'default';
  /** 展示用锚点(评估各档实测正确率,复习校准过的会被替换) */
  anchors: CurveAnchor[];
}

function clampProb(p: number): number {
  return Math.max(PROB_MIN, Math.min(PROB_MAX, p));
}

function logistic(t: number, center: number, width: number): number {
  return 1 / (1 + Math.exp((t - center) / Math.max(1, width)));
}

/** 默认曲线:以词汇量为中心,宽度取词汇量的 30%(经验值;宁可宽,不要假装精确) */
export function defaultCurve(vocab: number): KnowledgeCurve {
  const width = Math.max(300, vocab * 0.3);
  return {
    pKnown: (t) => clampProb(logistic(t, vocab, width)),
    source: 'default',
    anchors: [],
  };
}

/**
 * 由评估明细拟合曲线(分段线性 + 两端外推)。
 * 为什么不用 logistic 回归:锚点通常只有 3–5 个,拟合出的参数不稳健;
 * 分段线性至少能保证"评估测到的档位一定穿过实测正确率",不会骗人。
 *
 * @param reviewStats 复习的分档战况(可选)。给了就用它校准对应档位 ——
 *   评估是一次性的窄样本,而复习是持续发生的真实学习行为,应当反哺曲线。
 */
export function curveForLevel(
  level: UserLevel,
  fallbackVocab?: number,
  reviewStats?: ReviewBandStats,
): KnowledgeCurve {
  const rounds = level.rounds ?? [];
  if (rounds.length === 0) {
    return defaultCurve(level.vocab ?? fallbackVocab ?? 3000);
  }

  // 同档可能答了多轮(精细评估的确认轮),先合并
  const merged = new Map<number, { known: number; total: number }>();
  for (const r of rounds) {
    const prev = merged.get(r.threshold) ?? { known: 0, total: 0 };
    merged.set(r.threshold, { known: prev.known + r.known, total: prev.total + r.total });
  }
  const anchors = [...merged.entries()]
    .filter(([, agg]) => agg.total > 0)
    .map(([threshold, agg]) => ({ threshold, rate: agg.known / agg.total }))
    .sort((a, b) => a.threshold - b.threshold);

  if (anchors.length === 0) return defaultCurve(level.vocab ?? fallbackVocab ?? 3000);

  // 把复习的实测结果并进锚点(见下方 mergeReviewStats)
  const mergedAnchors = mergeReviewStats(anchors, reviewStats);
  const first = mergedAnchors[0];
  const last = mergedAnchors[mergedAnchors.length - 1];

  const pKnown = (t: number): number => {
    // 低于最低作答档:不低于实测值,但也不给满分(没测到的高频词仍可能不会)
    if (t <= first.threshold) return clampProb(Math.min(0.99, Math.max(first.rate, 0.9)));
    // 高于最高作答档:按指数衰减,保证"更高档也可能认识一部分"
    if (t >= last.threshold) {
      const scale = Math.max(500, last.threshold * 0.5);
      return clampProb(last.rate * Math.exp(-(t - last.threshold) / scale));
    }
    // 锚点之间线性插值
    for (let i = 1; i < mergedAnchors.length; i += 1) {
      const hi = mergedAnchors[i];
      if (t <= hi.threshold) {
        const lo = mergedAnchors[i - 1];
        const ratio = (t - lo.threshold) / Math.max(1, hi.threshold - lo.threshold);
        return clampProb(lo.rate + ratio * (hi.rate - lo.rate));
      }
    }
    return clampProb(last.rate);
  };

  return {
    pKnown,
    source: mergedAnchors.some((a) => a.review) ? 'assessment+review' : 'assessment',
    anchors: mergedAnchors,
  };
}

/**
 * 把复习的分档战况并进锚点(复习校准)。
 *
 * 两个约束,都是为了防止"用很少的样本把曲线拽歪":
 *  1. **样本门槛**:某档作答数 < REVIEW_MIN_SAMPLES 就不参与;
 *  2. **收缩**:把复习实测正确率与评估曲线在该档的取值按伪计数加权
 *     —— 答得越多,越信复习;答得少,基本还是评估那条线。
 *
 * 注意复习数据是**有偏样本**里的无偏用法:个人词表收的都是"当时不会的词",
 * 直接拿它估整体水平会偏低;这里只用它修正**所在档位的掌握率**,
 * 且被评估曲线拉着,所以不会把曲线拽塌。
 */
function mergeReviewStats(
  anchors: CurveAnchor[],
  stats?: ReviewBandStats,
): CurveAnchor[] {
  if (!stats) return anchors;
  const bands = Object.entries(stats)
    .map(([bandKey, s]) => ({ threshold: Number(bandKey), ...s }))
    .filter((s) => Number.isFinite(s.threshold) && s.total >= REVIEW_MIN_SAMPLES);
  if (bands.length === 0) return anchors;

  const out: CurveAnchor[] = [...anchors];
  for (const band of bands) {
    const baseRate = evaluateAnchors(anchors, band.threshold);
    const observed = band.known / band.total;
    // 收缩:复习实测正确率与评估曲线取值按伪计数加权(答得越多越信复习)
    const shrunk =
      (observed * band.total + REVIEW_SHRINK * baseRate) / (band.total + REVIEW_SHRINK);
    const at = out.findIndex((a) => a.threshold === band.threshold);
    const anchor: CurveAnchor = { threshold: band.threshold, rate: shrunk, review: true };
    if (at >= 0) out[at] = anchor;
    else out.push(anchor);
  }
  return out.sort((a, b) => a.threshold - b.threshold);
}

/** 在锚点之间取值(与 pKnown 的插值规则一致,单独抽出来供校准复用) */
function evaluateAnchors(anchors: CurveAnchor[], t: number): number {
  const first = anchors[0];
  const last = anchors[anchors.length - 1];
  if (t <= first.threshold) return clampProb(Math.min(0.99, Math.max(first.rate, 0.9)));
  if (t >= last.threshold) {
    const scale = Math.max(500, last.threshold * 0.5);
    return clampProb(last.rate * Math.exp(-(t - last.threshold) / scale));
  }
  for (let i = 1; i < anchors.length; i += 1) {
    const hi = anchors[i];
    if (t <= hi.threshold) {
      const lo = anchors[i - 1];
      const ratio = (t - lo.threshold) / Math.max(1, hi.threshold - lo.threshold);
      return clampProb(lo.rate + ratio * (hi.rate - lo.rate));
    }
  }
  return clampProb(last.rate);
}

/** 单词的"认识概率";词典没覆盖的词按最难的档位估(偏保守) */
export function wordKnownProbability(word: string, curve: KnowledgeCurve): number {
  const threshold = thresholdOfWord(word);
  return curve.pKnown(threshold ?? UNKNOWN_THRESHOLD);
}

/**
 * 预测理解率 = 认识的 token 占比(含重复词,按 running words 计)。
 * 与旧的硬阈值版本的区别:4200 档的词不再被整档判定为"会",而是按其概率计权。
 */
export function expectedCoverage(paragraphs: readonly string[], curve: KnowledgeCurve): number {
  const tokens = extractWords(paragraphs.join(' '));
  if (tokens.length === 0) return 1;
  let known = 0;
  for (const token of tokens) known += wordKnownProbability(token, curve);
  return known / tokens.length;
}

/**
 * 期望"不会的词"数量(去重口径,概率加权)。
 * 例:100 个 4200 档词、实测掌握率 80% → 期望不会 20 个,而不是 0 或 100。
 */
export function expectedUnknownUnique(
  paragraphs: readonly string[],
  curve: KnowledgeCurve,
): number {
  const tokens = extractWords(paragraphs.join(' '));
  const unique = [...new Set(tokens.map((t) => t.toLowerCase()))];
  let unknown = 0;
  for (const word of unique) unknown += 1 - wordKnownProbability(word, curve);
  return unknown;
}
