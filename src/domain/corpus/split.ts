/**
 * 语料自动管线 · 文本切分(纯函数)。
 * 输入:任意长文本(如 Gutenberg 公版书全文);
 * 输出:若干"可读文章候选",每篇 = { paragraphs }(段落数组),
 * 词数控制在目标区间,便于按词汇量筛选与入库。
 */

/** 每篇目标词数区间 */
export const TARGET_MIN_WORDS = 220;
export const TARGET_MAX_WORDS = 600;

/** 去 Gutenberg 头尾样板:只保留 START/END 标记之间的正文 */
export function stripGutenbergBoilerplate(fullText: string): string {
  const startRe = /\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK.*?\*\*\*/i;
  const endRe = /\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK.*?\*\*\*/i;
  const startMatch = startRe.exec(fullText);
  const endMatch = endRe.exec(fullText);
  const from = startMatch ? startMatch.index + startMatch[0].length : 0;
  const to = endMatch ? endMatch.index : fullText.length;
  return fullText.slice(from, to);
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
