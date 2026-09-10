/**
 * 按用户词汇量框定"生词/待学词"范围 —— 统一门槛标尺(评估 / 标蓝 / 推荐共用)。
 *
 * 每个词的门槛 threshold(word) 定义(唯一来源,评估与正文判定都走这里):
 *  1. 有考试标签(ECDICT tag:zk/gk/cet4/cet6/ky/toefl/ielts/sat/gre):
 *     取该词**最低(最易)标签**对应的门槛 —— 例如 abandon 同时带 gk/cet4/cet6/ky/toefl/gre,
 *     按"最早出现的考试" gk ≈ 3000 计,而不是按 gre 计(修过:旧实现取最难档,把常见词误判成超难);
 *  2. 无标签但有词频(frq/bnc):按名次映射;
 *  3. 都没有 → null(不参与生词判定)。
 */

import { WORD_META } from '@/data/word-meta';
import { CORE_DICT } from '@/data/dict-core';
import { isExternalWord } from '@/domain/external';
import { normalizeWord, lookupCandidates } from '@/domain/wordmark';

/** 内置核心词表(人工精选基础/虚词),覆盖这些词永不作为"待学词"标蓝 */
const CORE_KEYS = new Set(Object.keys(CORE_DICT).map((k) => k.toLowerCase()));

/** 考试标签 → 大致所需词汇量门槛(由低到高) */
const TAG_THRESHOLD: Record<string, number> = {
  zk: 1500, // 中考
  gk: 3000, // 高考
  cet4: 4200, // 四级
  ky: 5500, // 考研
  cet6: 5500, // 六级
  toefl: 7500,
  ielts: 7500,
  sat: 9500,
  gre: 9500,
};

/** 门槛档位(统一刻度):评估分档与展示都用它 */
export const VOCAB_BANDS = [1500, 3000, 4200, 5500, 7500, 9500] as const;

/** 标签 → 门槛;门槛 → 标签(每个档取最常见标签,供档位文案) */
const THRESHOLD_LABEL: Record<number, string> = {
  1500: '中考水平',
  3000: '高考水平',
  4200: '四级水平',
  5500: '考研/六级水平',
  7500: '托福/雅思水平',
  9500: 'GRE/更高',
};

/** 由词频名次(越小越常见)粗略映射到词汇量门槛(线性,与标签档同量纲) */
export function frqToThreshold(rank: number): number {
  if (rank <= 0) return 500;
  // rank 1 → ~500;rank 40000 → ~12000
  return Math.round(500 + (Math.min(rank, 40000) / 40000) * 11500);
}

/** 某门槛档位的展示文案 */
export function bandLabel(threshold: number): string {
  return THRESHOLD_LABEL[threshold] ?? `约 ${threshold} 词`;
}

/** 词条元数据(精确) */
export function metaFor(word: string): { tags: string[]; frq: number | null; bnc: number | null } | null {
  return WORD_META[normalizeWord(word)] ?? null;
}

/** 词条元数据(含词干还原:developing→develop),先精确后候选 */
function metaForWithStem(word: string): { tags: string[]; frq: number | null; bnc: number | null } | null {
  const exact = metaFor(word);
  if (exact) return exact;
  for (const candidate of lookupCandidates(word)) {
    const hit = WORD_META[candidate];
    if (hit) return hit;
  }
  return null;
}

/**
 * 估算一个词"需要掌握的大致词汇量门槛"(唯一标尺);无法判定返回 null。
 * 先精确匹配词条;未命中时对变形词做词干还原后取原形门槛。
 */
export function wordThreshold(word: string): number | null {
  const m = metaForWithStem(word);
  if (!m) return null;
  if (m.tags.length > 0) {
    // 取最容易标签(最低门槛):该词最早出现在哪个考试层级
    let min: number | null = null;
    for (const tag of m.tags) {
      const t = TAG_THRESHOLD[tag];
      if (t != null && (min == null || t < min)) min = t;
    }
    if (min != null) return min;
  }
  const rank = m.frq ?? m.bnc;
  if (rank != null && rank > 0) return frqToThreshold(rank);
  return null;
}

/** 某词所有标签中的最高门槛(最难出现的考试档);无标签返回 null */
export function wordPeakTag(word: string): number | null {
  const m = metaForWithStem(word);
  if (!m || m.tags.length === 0) return null;
  let max: number | null = null;
  for (const tag of m.tags) {
    const t = TAG_THRESHOLD[tag];
    if (t != null && (max == null || t > max)) max = t;
  }
  return max;
}

/** 词频门槛(该词在真实语料中的常用度 → 大约认识它需要的词汇量) */
export function wordFreqThreshold(word: string): number | null {
  const m = metaForWithStem(word);
  if (!m) return null;
  const rank = m.frq ?? m.bnc;
  if (rank == null || rank <= 0) return null;
  return frqToThreshold(rank);
}

/**
 * 是否为"该用户值得标蓝/学习的词"(考研备考口径):
 * 1. 内置核心词表覆盖的虚词/基础词永不标;
 * 2. 词频极靠前的基础词(初中已会,如 money/use/year)→ 不标;
 * 3. 否则只要命中考研大纲词表(含词干还原)→ 标。
 *
 * 说明:考研词表词(obligation/surveillance/autonomy…)即使真实语料常见也标,
 * 因为它们正是备考要积累的词;不再按 userVocab 逐词卡(否则难文章反而标不出词)。
 * userVocab 参数保留,供未来可选的"高级过滤"使用,当前不影响判定。
 */
export function isStudyCandidate(word: string, userVocab?: number): boolean {
  void userVocab;
  const w = normalizeWord(word);
  if (!w || CORE_KEYS.has(w)) return false;

  // 词频很靠前的基础词不标:frq 名次小于该值视为"四级以下已会高频词"
  // (click/pause/raw 等虽在考研大纲表里,但属于早已掌握的高频词)
  const m = metaForWithStem(word);
  const rank = m?.frq ?? m?.bnc ?? null;
  if (rank != null && rank > 0 && rank < 4500) return false;

  // 命中考研大纲词表(带词干还原)
  return isExternalWord(word);
}
