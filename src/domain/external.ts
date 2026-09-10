/**
 * 外部词表(考研等)判定辅助。
 * 仅做"是否命中词表"的判断,不承载释义(释义仍走离线词典)。
 */

import { EXTERNAL_WORDSET, EXTERNAL_WORDLIST_META } from '@/data/external-wordlist';
import { CORE_DICT } from '@/data/dict-core';
import { normalizeWord, lookupCandidates } from '@/domain/wordmark';

/** 词表来源与规模(供界面展示) */
export const EXTERNAL_META = {
  source: EXTERNAL_WORDLIST_META.source || '外部词表',
  count: EXTERNAL_WORDLIST_META.count,
};

/** 内置核心词典已覆盖的基础常用词(正文中不再重复高亮为"考研词") */
const CORE_KEYS = new Set(Object.keys(CORE_DICT).map((k) => k.toLowerCase()));

/**
 * 判断一个词(含变形)是否在外部词表中。
 * 先精确匹配,再做简单词干还原匹配(reading→read)。
 */
export function isExternalWord(word: string): boolean {
  const w = normalizeWord(word);
  if (!w) return false;
  if (EXTERNAL_WORDSET.has(w)) return true;
  for (const candidate of lookupCandidates(w)) {
    if (candidate !== w && EXTERNAL_WORDSET.has(candidate)) return true;
  }
  return false;
}

/**
 * 正文高亮判定:是否值得按"考研词"标蓝。
 * 规则:命中考研词表,且不是内置核心词表已覆盖的基础常用词(the/and/big…),
 * 避免整篇发蓝、失去区分度。
 */
export function isKaoyanHighlightWord(word: string): boolean {
  const w = normalizeWord(word);
  if (!w) return false;
  if (CORE_KEYS.has(w)) return false;
  return isExternalWord(word);
}

/** 词表规模中文文案,如「考研词库 6545 词」 */
export function externalSourceLabel(): string {
  return `${EXTERNAL_META.source} · ${EXTERNAL_META.count} 词`;
}
