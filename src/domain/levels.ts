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

/* ------------------------------------------------------------------ *
 * 细分难度档(11 档)
 *
 * 为什么:原来只有 6 档 CEFR,跨度极大(如 B2 = 3500–5500 词,横跨 2000 词),
 * "B2"这个标签对"这篇到底适不适合我"几乎没有信息量。
 * 这里把 300–12000 词切成 11 档、每档跨度 400–1200 词(考研区间更细),
 * 推荐与展示统一按档位比较,给出"刚好 / 略难 / 偏难"的判断。
 * ------------------------------------------------------------------ */

/** 细分难度档位 */
export interface LevelBand {
  /** 档位代码,如 'B1+' */
  id: string;
  /** 展示名,如 'B1+ 中级上' */
  label: string;
  /** 该档词汇量下限(含) */
  min: number;
  /** 该档词汇量上限(不含,最后一档为无穷) */
  max: number;
}

/** 11 档细分(考研常用区间 3200–5800 被分成 4 档,便于精确匹配) */
export const LEVEL_BANDS: readonly LevelBand[] = [
  { id: 'A1', label: 'A1 入门', min: 300, max: 800 },
  { id: 'A1+', label: 'A1+ 初阶', min: 800, max: 1200 },
  { id: 'A2', label: 'A2 基础', min: 1200, max: 1800 },
  { id: 'A2+', label: 'A2+ 进阶基础', min: 1800, max: 2500 },
  { id: 'B1', label: 'B1 中级', min: 2500, max: 3200 },
  { id: 'B1+', label: 'B1+ 中级上', min: 3200, max: 4000 },
  { id: 'B2', label: 'B2 中高级', min: 4000, max: 4800 },
  { id: 'B2+', label: 'B2+ 中高级上', min: 4800, max: 5800 },
  { id: 'C1', label: 'C1 高级', min: 5800, max: 7000 },
  { id: 'C1+', label: 'C1+ 高级上', min: 7000, max: 8500 },
  { id: 'C2', label: 'C2 精通', min: 8500, max: 12000 },
];

/** 该档对应的粗 CEFR(兼容旧字段与旧数据) */
export function coarseCefrOfBand(bandId: string): CefrLevel {
  const base = bandId.replace('+', '');
  return (CEFR_LEVELS.includes(base as CefrLevel) ? base : 'B1') as CefrLevel;
}

/** 词汇量 → 档位 */
export function bandOf(vocab: number): LevelBand {
  const v = Number.isFinite(vocab) ? vocab : DEFAULT_USER_VOCAB;
  for (const b of LEVEL_BANDS) {
    if (v < b.max) return b;
  }
  return LEVEL_BANDS[LEVEL_BANDS.length - 1];
}

/** 词汇量 → 档位序号(0 起,越小越简单) */
export function bandIndexOf(vocab: number): number {
  const band = bandOf(vocab);
  const idx = LEVEL_BANDS.findIndex((b) => b.id === band.id);
  return idx < 0 ? 5 : idx;
}

/** 档位展示:如 "B1+ 中级上(3200–4000 词)" */
export function bandLabelOf(vocab: number): string {
  const b = bandOf(vocab);
  const last = b.id === LEVEL_BANDS[LEVEL_BANDS.length - 1].id;
  return `${b.label}(${b.min}–${last ? '12000+' : b.max} 词)`;
}

/** 两档相差几档(带符号:正数表示后者更难) */
export function bandGap(a: number, b: number): number {
  return bandIndexOf(b) - bandIndexOf(a);
}
