/**
 * 水平刻度换算(模块 B 一)。
 * 纯 TS 常量/函数,不依赖任何 UI。
 *
 * 主刻度 = 词汇量区间 + CEFR;词汇量缺失时允许按 CEFR 自选。
 * 这里的换算值是"学习 App 内部分级用的参考区间",不是语言学定论,
 * 后续可整体调整而不影响 UI。
 */

import type { CefrLevel } from '@/types';

/** CEFR 每一级对应的参考词汇量区间(下限 ~ 上限) */
export const CEFR_VOCAB_RANGE: Record<CefrLevel, { min: number; max: number }> = {
  A1: { min: 500, max: 1000 },
  A2: { min: 1000, max: 2000 },
  B1: { min: 2000, max: 3500 },
  B2: { min: 3500, max: 5500 },
  C1: { min: 5500, max: 8000 },
  C2: { min: 8000, max: 12000 },
};

/** 每级代表词汇量(区间中点向上取整),用于"匹配你的词汇量 xxxx"这类展示 */
export const CEFR_REPRESENTATIVE_VOCAB: Record<CefrLevel, number> = {
  A1: 800,
  A2: 1500,
  B1: 2800,
  B2: 4500,
  C1: 6800,
  C2: 10000,
};

/** CEFR 各级的可读顺序(越小越简单) */
export const CEFR_ORDER: Record<CefrLevel, number> = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 };

/** 全部 CEFR 级别(从易到难) */
export const CEFR_LEVELS: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

/**
 * CEFR → 代表词汇量。
 * 未知输入(运行时脏数据)兜底返回 undefined,由调用方决定。
 */
export function cefrToVocab(level: CefrLevel): number {
  return CEFR_REPRESENTATIVE_VOCAB[level];
}

/**
 * 词汇量 → 最近 CEFR 级别。
 * - 边界安全:0/负数/极小 → A1;极大(>12000)→ C2;undefined/NaN → 默认 B1。
 */
export function vocabToCefr(vocab?: number): CefrLevel {
  if (vocab === undefined || Number.isNaN(vocab)) {
    return 'B1';
  }
  if (vocab <= CEFR_VOCAB_RANGE.A1.max) {
    return 'A1';
  }
  if (vocab <= CEFR_VOCAB_RANGE.A2.max) {
    return 'A2';
  }
  if (vocab <= CEFR_VOCAB_RANGE.B1.max) {
    return 'B1';
  }
  if (vocab <= CEFR_VOCAB_RANGE.B2.max) {
    return 'B2';
  }
  if (vocab <= CEFR_VOCAB_RANGE.C1.max) {
    return 'C1';
  }
  return 'C2';
}

/** 两个 CEFR 级别相差多少档(A1→C2 为 5 档) */
export function cefrGap(a: CefrLevel, b: CefrLevel): number {
  return Math.abs(CEFR_ORDER[a] - CEFR_ORDER[b]);
}

/** 默认水平(用户跳过评估时):B1,约 2800 词 */
export const DEFAULT_USER_LEVEL: CefrLevel = 'B1';
export const DEFAULT_USER_VOCAB = CEFR_REPRESENTATIVE_VOCAB[DEFAULT_USER_LEVEL];
