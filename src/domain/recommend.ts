/**
 * 推荐文章筛选(模块 B/学习闭环):
 *  1. 每篇统计"候选生词"(超过用户词汇量且未学/未会的词)密度;
 *  2. 已读文章(excludeIds)默认不参与推荐(读过的短文不再推荐);
 *  3. 密度贴近理想区间(3%–8%)优先;
 *  4. 附带"新词示例",供首页展示(让用户看到会学到什么词)。
 */

import { isStudyCandidate } from '@/domain/wordlevel';
import { extractWords } from '@/domain/wordmark';
import type { Article } from '@/types';

/** 理想生词密度区间(模块 B:3%–8%) */
export const IDEAL_DENSITY = { min: 0.03, max: 0.08 };

export interface RecommendInput {
  articles: Article[];
  /** 用户词汇量 */
  userVocab: number;
  /** 已学过的词(小写) */
  learned: ReadonlySet<string>;
  /** 已认识(用户标"我会了",小写) */
  known: ReadonlySet<string>;
  /** 希望返回的篇数 */
  count?: number;
  /** 已读文章 id(不推荐) */
  excludeIds?: ReadonlySet<string>;
  /** 是否允许在全部文章已读/密度均不合时兜底返回(默认 true) */
  allowFallback?: boolean;
}

export interface Recommendation {
  article: Article;
  /** 该篇对用户而言的候选生词密度(0–1) */
  newWordDensity: number;
  /** 候选生词数 */
  newWordCount: number;
  /** 生词密度在理想区间则为 true */
  idealDensity: boolean;
  /** 该篇里"新词示例"(最多 3 个),供理由展示 */
  sampleNewWords: string[];
  /** 是否已读(仅兜底时可能出现) */
  read?: boolean;
  /** 推荐理由 */
  reason: string;
}

/** 判断是否"该用户尚未掌握的词"(供密度统计) */
export function isNewForUser(
  word: string,
  userVocab: number,
  learned: ReadonlySet<string>,
  known: ReadonlySet<string>,
): boolean {
  const w = word.toLowerCase();
  if (learned.has(w) || known.has(w)) return false;
  return isStudyCandidate(word, userVocab);
}

/** 统计一篇的候选生词:密度 + 示例词 */
export function computeArticleNewWords(
  article: Article,
  userVocab: number,
  learned: ReadonlySet<string>,
  known: ReadonlySet<string>,
): { density: number; newCount: number; samples: string[] } {
  const words = extractWords(article.paragraphs.join(' '));
  const unique = [...new Set(words.map((w) => w.toLowerCase()))];
  if (unique.length === 0) return { density: 0, newCount: 0, samples: [] };
  const newWords: string[] = [];
  for (const w of unique) {
    if (isNewForUser(w, userVocab, learned, known)) newWords.push(w);
  }
  return {
    density: newWords.length / unique.length,
    newCount: newWords.length,
    samples: newWords.slice(0, 3),
  };
}

/**
 * 生成推荐:
 * - 排除已读文章(excludeIds);
 * - 密度贴近中值优先;若理想区间为空,用最近中值的(含偏难/偏简)兜底;
 * - 附带推荐理由与新词示例。
 */
export function recommendFor(input: RecommendInput): Recommendation[] {
  const count = input.count ?? 3;
  const mid = (IDEAL_DENSITY.min + IDEAL_DENSITY.max) / 2;
  const fallback = input.allowFallback ?? true;

  const rows = input.articles
    .map((article) => {
      const { density, newCount, samples } = computeArticleNewWords(
        article,
        input.userVocab,
        input.learned,
        input.known,
      );
      const read = input.excludeIds?.has(article.id) ?? false;
      const ideal = density >= IDEAL_DENSITY.min && density <= IDEAL_DENSITY.max;
      return { article, density, newCount, samples, ideal, read };
    })
    .sort(
      (a, b) =>
        // 已读最后;未读中:理想优先,其次按距中值距离升序
        Number(a.read) - Number(b.read) ||
        Number(b.ideal) - Number(a.ideal) ||
        Math.abs(a.density - mid) - Math.abs(b.density - mid) ||
        a.article.difficulty.wordCount - b.article.difficulty.wordCount,
    );

  // 未读优先取前 count;不足时允许用已读兜底(fallback)
  const unread = rows.filter((r) => !r.read);
  const pickedSrc = unread.length >= count ? unread : fallback ? rows : unread;

  // 话题多样性贪心:在已按密度排序的基础上,优先挑与已选主题不同的文章,
  // 使首页推荐不会全是同一话题(如 3 篇都讲科技)。
  const picked: typeof rows = [];
  const usedTopics = new Set<string>();
  const rest = [...pickedSrc];
  while (picked.length < count && rest.length > 0) {
    // 找第一个 topic 尚未出现的候选
    const idx = rest.findIndex((r) => !r.article.topicTags.some((t) => usedTopics.has(t)));
    const chosen = idx >= 0 ? rest.splice(idx, 1)[0] : rest.shift()!;
    for (const t of chosen.article.topicTags) usedTopics.add(t);
    picked.push(chosen);
  }

  return picked.map((r) => {
    const sampleText = r.samples.length > 0 ? ` · 新词如 ${r.samples.join('/')}` : '';
    let reason: string;
    if (r.read) {
      reason = '已读回顾(其余文章都已读完)';
    } else if (r.ideal) {
      reason = `生词密度 ${(r.density * 100).toFixed(0)}%,正合适${sampleText}`;
    } else if (r.density < IDEAL_DENSITY.min) {
      reason = `偏简单(新词 ${(r.density * 100).toFixed(0)}%)${sampleText}`;
    } else {
      reason = `偏难(新词 ${(r.density * 100).toFixed(0)}%),需要查词${sampleText}`;
    }
    return {
      article: r.article,
      newWordDensity: r.density,
      newWordCount: r.newCount,
      idealDensity: r.ideal,
      sampleNewWords: r.samples,
      read: r.read || undefined,
      reason,
    };
  });
}
