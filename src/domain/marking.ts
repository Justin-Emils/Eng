/**
 * 「这个词该不该给这个用户标蓝」—— 纯函数（P1-2）。
 *
 * 报告指出的缺陷：`isStudyCandidate(word, userVocab)` 里 `void userVocab`，
 * 参数被丢弃，于是 1500 词和 9500 词的用户看到的蓝词**完全一样** ——
 * 而 README、欢迎页、阅读页图例、评估结果页四处都在承诺"按你的词汇量"。
 *
 * 现在的规则（三步，全部基于"词的门槛"与"用户词汇量"的同一把尺子）：
 *   1. 词的门槛 `t` 比用户词汇量低出 300 词以上 → 你大概率会，不标；
 *   2. 认识概率 ≥ 0.85 → 已经熟，不标；
 *   3. 其余（高于你水平、且大概率还不熟）→ 标。
 *
 * 没有词汇量信息时（旧调用、评估缺失）退回"考研词表 + 词频"口径，
 * 保证不会因为缺少画像就什么都不标。
 */

/** 认识概率的默认估计：与 domain/knowledge 的 defaultCurve 同一套 logistic */
export function approxKnownProbability(threshold: number, vocab: number): number {
  const width = Math.max(300, vocab * 0.3);
  return 1 / (1 + Math.exp((threshold - vocab) / width));
}

export const STUDY_MARK_MIN_GAP = 300;
export const STUDY_MARK_MAX_PROBABILITY = 0.85;

export interface MarkDecisionInput {
  /** 词的门槛（thresholdOfWord；null = 词典没有该词，无法判断） */
  threshold: number | null;
  /** 用户词汇量；undefined/0 表示没有画像 */
  userVocab?: number;
  /** 认识概率函数；不传则用 defaultCurve 同款 logistic */
  pKnown?: (threshold: number) => number;
  /** 旧口径用：词频名次（越小越高频） */
  rank?: number | null;
  /** 旧口径用：是否命中考研大纲词表 */
  isExternal?: boolean;
}

export function shouldMarkAsStudy(input: MarkDecisionInput): boolean {
  const { threshold, userVocab, pKnown } = input;

  // 没有画像：沿用旧口径（词频名次 < 4500 视为基础词，其余看考研词表）
  if (userVocab == null || userVocab <= 0) {
    if (input.rank != null && input.rank > 0 && input.rank < 4500) return false;
    return Boolean(input.isExternal);
  }

  // 门槛比用户水平低出余量 → 视为已会
  if (threshold == null) return false;
  if (threshold <= userVocab - STUDY_MARK_MIN_GAP) return false;

  // 认识概率太高 → 不值得标
  const p = pKnown ? pKnown(threshold) : approxKnownProbability(threshold, userVocab);
  if (p >= STUDY_MARK_MAX_PROBABILITY) return false;

  return true;
}
