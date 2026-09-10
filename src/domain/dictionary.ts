/**
 * 词典/翻译服务抽象与离线实现(模块 C 三 / D)。
 * - LookupService 是接口:UI 只依赖它,未来可换在线实现(有道/OpenAI adapter)。
 * - OfflineDictionaryService 为默认实现:语料重点词 + 内置核心词典 + 词干还原。
 */

import { ARTICLES } from '@/data/articles';
import { CORE_DICT, type DictEntry } from '@/data/dict-core';
import { EXTERNAL_DICT } from '@/data/ext-words';
import { lookupCandidates, normalizeWord } from '@/domain/wordmark';

/** 查询结果 */
export interface LookupResult {
  /** 命中的词典条目标题(展示用),如 "run" */
  word: string;
  /** 用户查询的原文词,如 "running" */
  query: string;
  /** 命中方式:精确 / 词形还原 / 未收录 */
  status: 'exact' | 'inflected' | 'missing';
  /** 命中条目(未收录时为 undefined) */
  entry?: DictEntry;
  /** 未收录时给用户的建议(词干提示/相近词) */
  hint?: string;
}

/** 词典服务接口:UI 只依赖它 */
export interface LookupService {
  lookup(word: string): LookupResult;
  /** 词组查询(整段,如 "give up");未收录返回 missing */
  lookupPhrase(phrase: string): LookupResult;
}

/**
 * 合并词典。优先级(高 → 低):
 *   1. 语料重点词(人工复核释义,与文章语境一致)
 *   2. 内置核心词表(人工精选)
 *   3. 外部词表(ECDICT 考研等机器释义,只补缺)
 * key 全部小写。先写底层的 external,再由人工词表覆盖。
 */
const merged: Record<string, DictEntry> = {};

// 底层:外部词表(考研等,量大;机器生成)
for (const [key, entry] of Object.entries(EXTERNAL_DICT)) {
  merged[key.toLowerCase()] = { ...entry, headword: key.toLowerCase() };
}

// 中层:内置核心词表(人工精选,覆盖外部对基础词的释义)
for (const [key, e] of Object.entries(CORE_DICT)) {
  merged[key.toLowerCase()] = { ...e, headword: key.toLowerCase() };
}

// 顶层:语料重点词(与文章语境一致)
for (const article of ARTICLES) {
  for (const kw of article.keyWords) {
    const key = kw.headword.toLowerCase();
    merged[key] = {
      headword: key,
      pos: kw.pos,
      zh: kw.zh,
      en: kw.en,
      example: kw.example,
    };
  }
}

export class OfflineDictionaryService implements LookupService {
  lookup(word: string): LookupResult {
    const query = normalizeWord(word);
    if (!query) {
      return { word, query, status: 'missing', hint: '这不是一个有效的英文单词' };
    }
    // 1. 精确
    const exact = merged[query];
    if (exact) {
      return { word: query, query, status: 'exact', entry: exact };
    }
    // 2. 词干还原:依次尝试候选(making→make、running→run)
    for (const candidate of lookupCandidates(query)) {
      const hit = merged[candidate];
      if (hit) {
        return { word: candidate, query, status: 'inflected', entry: hit };
      }
    }
    return {
      word: query,
      query,
      status: 'missing',
      hint: `未收录「${query}」,离线词典有限。试试用句子翻译或联网查词。`,
    };
  }

  lookupPhrase(phrase: string): LookupResult {
    const p = normalizeWord(phrase.trim());
    if (!p) {
      return { word: phrase, query: phrase, status: 'missing' };
    }
    const exact = merged[p];
    if (exact) {
      return { word: p, query: phrase, status: 'exact', entry: exact };
    }
    return { word: p, query: phrase, status: 'missing', hint: `短语「${phrase}」暂未收录` };
  }
}

/** 全局默认离线词典(单例) */
export const offlineDictionary: LookupService = new OfflineDictionaryService();
