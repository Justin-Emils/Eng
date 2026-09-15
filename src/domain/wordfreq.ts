/**
 * 广覆盖词频表查询(读 data/word-freq.ts,首次调用时解析一次)。
 *
 * 与 word-meta.ts 的区别:
 *  - word-meta:只含"考研标签词 + 自备词表"(约 6800 条),用于判定"该学的生词";
 *  - word-freq:含 7.8 万个常用词及其变形(按 ECDICT frq/bnc 名次 ≤ 40000),
 *    用于**难度估计**(覆盖率口径需要绝大多数实词都能查到名次)。
 */

import { WORD_FREQ_TEXT } from '@/data/word-freq';
import { lookupCandidates } from '@/domain/wordmark';

let table: Map<string, number> | null = null;

function ensureTable(): Map<string, number> {
  if (table) return table;
  const t = new Map<string, number>();
  for (const line of WORD_FREQ_TEXT.split('\n')) {
    const sp = line.lastIndexOf(' ');
    if (sp <= 0) continue;
    const rank = Number(line.slice(sp + 1));
    if (Number.isFinite(rank)) t.set(line.slice(0, sp), rank);
  }
  table = t;
  return t;
}

/**
 * 取一个词的词频名次(1 = 最常见)。
 * 依次尝试:原词 → 词干/常见变形(表里已含 ECDICT 变形词)。
 * 查不到返回 null(视为超纲词)。
 */
export function freqRankOf(word: string): number | null {
  const t = ensureTable();
  for (const cand of lookupCandidates(word)) {
    const r = t.get(cand);
    if (r != null) return r;
  }
  return null;
}

/** 词频表规模(自检/调试用) */
export function wordFreqTableSize(): number {
  return ensureTable().size;
}
