/**
 * 语料自动更新服务(每日):
 * 1. gutendex 随机取若干本公版英文书;
 * 2. 下载正文纯文本(Gutenberg);
 * 3. 清洗切分为"篇"(300–600 词);
 * 4. 按生词密度/篇幅粗筛 + 标注(标题/难度/话题/credit);
 * 5. 入库(AsyncStorage)并水化内存注册表。
 *
 * 说明:公版内容天然偏旧,但书库巨大且随机轮换,保证"每天有新文章"。
 * Expo Go 中无系统后台定时 → 由"每日首次打开 + 手动按钮"触发本服务。
 */

import { buildArticle, type RawArticle } from '@/data/articles/build';
import { hydrateRemoteArticles, remoteArticles } from '@/data/articles/remote-registry';
import { annotateBlock } from '@/domain/corpus/annotate';
import { fetchCoverUrl } from '@/domain/corpus/cover';
import {
  setCorpusDone,
  setCorpusFailed,
  setCorpusNoop,
  setCorpusRunning,
} from '@/domain/corpus/status';
import { fullTextToCandidates } from '@/domain/corpus/split';
import { isUpdatedToday, saveRemoteArticles } from '@/storage/remote-articles';
import type { Article } from '@/types';

const GUTENDEX_RANDOM = 'https://gutendex.com/books/?languages=en&sort=random';
/** 每批尝试的书数 */
const MAX_BOOKS = 3;
/** 每次更新的目标篇数 */
const MAX_ARTICLES = 12;
/** 单篇词数下限/上限(与 split 对齐) */
const MIN_WORDS = 220;
const MAX_WORDS = 700;
/** 防止并发重复更新 */
let updateInFlight: Promise<'updated' | 'skipped' | 'failed'> | null = null;

interface GutendexBook {
  id: number;
  title: string;
  formats?: Record<string, string>;
  download_count?: number;
}

async function fetchJson(url: string, timeoutMs = 30000): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url: string, timeoutMs = 40000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

/** 从 formats 里挑一个可用的 plain-text 地址 */
function pickTxtUrl(book: GutendexBook): string | null {
  const formats = book.formats ?? {};
  // 优先 utf-8 plain
  for (const [type, url] of Object.entries(formats)) {
    if (type.includes('text/plain') && url.includes('utf-8')) return url;
  }
  for (const url of Object.values(formats)) {
    if (typeof url === 'string' && url.includes('/files/')) return url;
  }
  return null;
}

/** 拉一批随机公版书(重试一次) */
async function randomBooks(): Promise<GutendexBook[]> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const json = (await fetchJson(GUTENDEX_RANDOM)) as { results?: GutendexBook[] };
      const list = (json.results ?? []).filter((b) => b.formats && pickTxtUrl(b));
      if (list.length > 0) return list.slice(0, MAX_BOOKS);
    } catch {
      // 下一轮重试
    }
  }
  throw new Error('在线语料源(gutendex)不可达,请稍后再试');
}

/** 封面查询并发数 */
const COVER_CONCURRENCY = 4;

/**
 * 执行一次语料更新。返回新增篇数;失败抛错由 UI 展示。
 * 配图:每篇文章独立按其内容查询 Wikimedia Commons(避免整批同图),
 * 并发分小批执行以免拖慢;查不到则该篇无图(前端回退 emoji)。
 */
export async function runDailyCorpusUpdate(): Promise<number> {
  const books = await randomBooks();
  const raw: RawArticle[] = [];

  for (const book of books) {
    if (raw.length >= MAX_ARTICLES) break;
    const url = pickTxtUrl(book);
    if (!url) continue;
    try {
      const fullText = await fetchText(url);
      const candidates = fullTextToCandidates(fullText);
      let blockIndex = 0;
      for (const block of candidates) {
        if (raw.length >= MAX_ARTICLES) break;
        const joined = block.paragraphs.join(' ');
        const words = (joined.match(/[A-Za-z]+/g) ?? []).length;
        if (words < MIN_WORDS || words > MAX_WORDS) {
          blockIndex += 1;
          continue;
        }
        blockIndex += 1;
        const article = annotateBlock(block, book.title.trim(), `gutenberg-${book.id}-${blockIndex}`);
        // 把书标题并入查询上下文,提高图片相关性(标题启发式可能太短)
        raw.push({ ...article, summary: `${book.title.trim()}. ${article.summary}` });
      }
    } catch {
      // 单本书失败跳过,继续下一本
    }
  }

  if (raw.length === 0) {
    throw new Error('本次未切分到合适文章,换一批试试');
  }

  // 每篇独立查图,小并发分批
  for (let i = 0; i < raw.length; i += COVER_CONCURRENCY) {
    const batch = raw.slice(i, i + COVER_CONCURRENCY);
    await Promise.all(
      batch.map(async (item) => {
        try {
          item.coverUrl =
            (await fetchCoverUrl(item.title, item.summary, item.id)) ?? undefined;
        } catch {
          item.coverUrl = undefined;
        }
      }),
    );
  }

  const articles: Article[] = raw.map(buildArticle);
  await saveRemoteArticles(articles);
  // 水化内存,让文章库/阅读立即可见
  await hydrateRemoteArticles();
  return remoteArticles.length;
}

/**
 * 供 UI:今天未更新时自动触发一次(带全局状态,running/failed 可见)。
 * 已更新则 noop;并发调用共享同一 promise,避免重复拉取。
 */
export function ensureDailyCorpusUpdate(): Promise<'updated' | 'skipped' | 'failed'> {
  if (updateInFlight) {
    return updateInFlight.then(() => 'updated' as const).catch(() => 'failed' as const);
  }
  const run = (async (): Promise<'updated' | 'skipped' | 'failed'> => {
    if (await isUpdatedToday()) {
      setCorpusNoop();
      return 'skipped';
    }
    setCorpusRunning();
    try {
      const count = await runDailyCorpusUpdate();
      setCorpusDone(count);
      return 'updated';
    } catch (e) {
      const msg = e instanceof Error ? e.message : '更新失败,请检查网络';
      setCorpusFailed(msg);
      return 'failed';
    }
  })();
  updateInFlight = run;
  run.finally(() => {
    updateInFlight = null;
  }).catch(() => {});
  return run;
}
