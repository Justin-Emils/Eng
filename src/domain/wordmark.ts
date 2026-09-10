/**
 * 英文分词 / 切句纯函数(模块 C 二 / D 一)。
 * 供阅读页做词级渲染、重点词高亮与后续划词。不依赖 UI,便于单测。
 */

/** 一个词 token(词形、是否词) */
export interface WordToken {
  /** 原文片段,如 "give" / " " / "," */
  text: string;
  /** true 表示这是一个可查词的英文单词;false 是空白或标点 */
  isWord: boolean;
}

/** 缩写白名单:这些词后的句号不算句子结束(简单过滤) */
const ABBREVIATIONS = new Set(['mr', 'mrs', 'ms', 'dr', 'prof', 'st', 'vs', 'etc', 'e.g', 'i.e', 'u.s', 'a.m', 'p.m']);

/** 句子结束标点后必须跟空白或字符串结尾 */
const SENTENCE_SPLIT_RE = /[.!?…]+(?=\s|$)/g;

/** 单词正则(含撇号缩写,如 don't、children's) */
const WORD_RE = /[A-Za-z]+(?:['’][A-Za-z]+)*/;

/**
 * 把一段文本切成句子数组。
 * 处理逻辑:先临时隐藏缩写中的句点,再按结束标点切分,最后还原。
 */
export function splitSentences(text: string): string[] {
  const cleaned = text.replace(/(\b[A-Za-z]+\.[\s])/g, (m) => {
    const maybeAbbr = m.trim().replace(/\.$/, '').toLowerCase();
    return ABBREVIATIONS.has(maybeAbbr) ? m.replace('.', '\u0000') : m;
  });
  const sentences = cleaned.split(SENTENCE_SPLIT_RE).map((s) => s.trim()).filter(Boolean);
  return sentences.map((s) => s.replace(/\u0000/g, '.'));
}

/**
 * 把一个句子(或任意英文片段)切成 token 数组。
 * 单词之间保留原始空白与标点,保证渲染时换行自然。
 */
export function tokenize(text: string): WordToken[] {
  const tokens: WordToken[] = [];
  const re = new RegExp(`(${WORD_RE.source})|([^A-Za-z]+)`, 'g');
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match[1] !== undefined) {
      tokens.push({ text: match[1], isWord: true });
    } else if (match[2] !== undefined) {
      tokens.push({ text: match[2], isWord: false });
    }
  }
  return tokens;
}

/** 提取一段文本里的全部单词(去标点,保留撇号词),用于词级处理 */
export function extractWords(text: string): string[] {
  return tokenize(text).filter((t) => t.isWord).map((t) => t.text);
}

/** 简单词干还原(查询用):-ing/-ed/-ies/-es/-s,供词典 miss 时二次查找 */
export function stemWord(word: string): string {
  const w = word.toLowerCase();
  if (w.length <= 3) return w;
  if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
  if (w.endsWith('ing')) return w.slice(0, -3);
  if (w.endsWith('ed')) return w.slice(0, -2);
  if (w.endsWith('es')) return w.slice(0, -2);
  if (w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

/** 小写化并去除首尾非字母(用于词典 key) */
export function normalizeWord(word: string): string {
  return word.toLowerCase().replace(/^[^a-z]+|[^a-z]+$/g, '');
}

/**
 * 生成查词候选列表(按优先级):
 * 原词 → 词干 → 词干补 e(making→make)→ 去双写(mapping→map 由补候选覆盖)。
 * 词典 miss 时依序尝试,命中即返回。
 */
export function lookupCandidates(word: string): string[] {
  const w = normalizeWord(word);
  if (!w) return [];
  const stem = stemWord(w);
  const candidates = [w];
  if (stem !== w) candidates.push(stem);
  const withE = stem.length >= 3 && !stem.endsWith('e') ? stem + 'e' : '';
  if (withE && !candidates.includes(withE)) candidates.push(withE);
  // 双写辅音还原:running → runn → run
  if (stem.length > 3 && stem[stem.length - 1] === stem[stem.length - 2]) {
    const deDup = stem.slice(0, -1);
    if (!candidates.includes(deDup)) candidates.push(deDup);
  }
  return candidates;
}
