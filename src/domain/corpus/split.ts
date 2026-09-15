/**
 * 语料自动管线 · 文本切分(纯函数)。
 * 输入:任意长文本(如 Gutenberg 公版书全文);
 * 输出:若干"可读文章候选",每篇 = { paragraphs }(段落数组),
 * 词数控制在目标区间,便于按词汇量筛选与入库。
 */

/** 每篇目标词数区间 */
export const TARGET_MIN_WORDS = 220;
export const TARGET_MAX_WORDS = 600;

/**
 * 去 Gutenberg 头尾样板:
 * 1. 有 START/END 标记的(现代文件)只保留标记之间的正文;
 * 2. 没有标记的老书,用头部特征行(Release Date / Language / Produced by 等)
 *    定位正文起点,并在 "End of ... Project Gutenberg" 处截断;
 * 3. 最后再丢掉开头残留的许可声明 / 目录段落,避免把版权声明当成文章。
 */
export function stripGutenbergBoilerplate(fullText: string): string {
  const startRe = /\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK.*?\*\*\*/i;
  const endRe = /\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK.*?\*\*\*/i;
  const startMatch = startRe.exec(fullText);
  const endMatch = endRe.exec(fullText);

  let body: string;
  if (startMatch) {
    const from = startMatch.index + startMatch[0].length;
    const to = endMatch && endMatch.index > from ? endMatch.index : fullText.length;
    body = fullText.slice(from, to);
  } else {
    // 老书没有标记:按头部特征找正文起点(头部通常在前 12k 字符内)
    const headerRe =
      /^.*(?:Release Date|Posting Date|Language:\s|Character set encoding|Produced by|E-?[Tt]ext prepared by|Updated editions)[^\n]*$/gm;
    const limit = Math.min(fullText.length, 12000);
    let last: RegExpExecArray | null = null;
    let m: RegExpExecArray | null;
    while ((m = headerRe.exec(fullText)) !== null) {
      if (m.index >= limit) break;
      last = m;
    }
    body = last ? fullText.slice(last.index + last[0].length) : fullText;
    const endAlt = /End of (?:the )?Project Gutenberg/i.exec(body);
    if (endAlt) body = body.slice(0, endAlt.index);
  }

  return dropLeadingBoilerplateParagraphs(body);
}

/** 丢掉正文开头的许可声明/目录等噪声段落(只处理开头,不动正文中段) */
function dropLeadingBoilerplateParagraphs(text: string): string {
  const paras = text.split(/\n\s*\n/);
  /** 只看开头这些段,避免误伤正文 */
  const scanLimit = Math.min(paras.length, 30);
  const kept: string[] = [];
  for (let i = 0; i < paras.length; i += 1) {
    if (i < scanLimit && isBoilerplateParagraph(paras[i])) continue;
    kept.push(paras[i]);
  }
  return kept.join('\n\n');
}

/** 判断某段是不是许可声明 / 目录这类噪声(不是正文) */
function isBoilerplateParagraph(p: string): boolean {
  const trimmed = p.trim();
  if (trimmed.length < 60) return true;
  if (
    trimmed.length < 700 &&
    /project gutenberg|gutenberg\.org|gutenberg\.net|copyright|public domain|this ebook|ebook is for|isbn|transcriber|character set|encoding|release date|posting date|produced by|table of contents|^contents\b|list of illustrations|updated editions/i.test(
      trimmed,
    )
  ) {
    return true;
  }
  // 目录特征:多次出现 CHAPTER,或大量"短行且行尾无标点"(目录/插图清单)
  const lines = trimmed
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const chapterHits = (trimmed.match(/\bchapter\b|\bcontents\b/gi) ?? []).length;
  if (chapterHits >= 3) return true;
  if (lines.length >= 4) {
    const avgLen = lines.reduce((s, l) => s + l.length, 0) / lines.length;
    const endsWithPunct = lines.filter((l) => /[.!?"'”’]$/.test(l)).length;
    if (avgLen < 46 && endsWithPunct === 0) return true;
  }
  return false;
}

/** 按空行把正文切成段落,清洗缩进/多余空白 */
export function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((block) =>
      block
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .join(' '),
    )
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 40);
}

function countWords(text: string): number {
  const m = text.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g);
  return m ? m.length : 0;
}

/**
 * 把段落流贪心拼成"篇":每篇目标 TARGET_MIN..MAX 词,不跨句硬切。
 * 返回 { paragraphs }[];太短的尾块丢弃。
 */
export function chunkParagraphs(paragraphs: string[]): { paragraphs: string[] }[] {
  const result: { paragraphs: string[] }[] = [];
  let current: string[] = [];
  let currentWords = 0;

  const flush = () => {
    if (currentWords >= TARGET_MIN_WORDS) {
      result.push({ paragraphs: [...current] });
    }
    current = [];
    currentWords = 0;
  };

  for (const p of paragraphs) {
    const w = countWords(p);
    // 单个超长段:本身就是一"长文",单独成篇(>MAX 由上层截段)
    if (w > TARGET_MAX_WORDS) {
      flush();
      result.push({ paragraphs: [p] });
      continue;
    }
    current.push(p);
    currentWords += w;
    if (currentWords >= TARGET_MAX_WORDS) flush();
  }
  flush();
  return result;
}

/**
 * 主入口:全文 → 文章候选。
 * 可选把超长单段按句再拆成多个可读段。
 */
export function fullTextToCandidates(fullText: string): { paragraphs: string[] }[] {
  const body = stripGutenbergBoilerplate(fullText);
  const paragraphs = splitParagraphs(body);
  return chunkParagraphs(paragraphs);
}
