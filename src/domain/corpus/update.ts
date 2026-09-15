/**
 * 语料自动更新服务(每日):
 * 1. 取书:sources.ts —— gutendex 随机优先,不可用则回退内置公版书目录;
 * 2. 下载正文:Gutenberg 官方直链 / 镜像自动切换,带内容校验;
 * 3. 清洗切分为"篇"(220–700 词);
 * 4. 按生词密度/篇幅粗筛 + 标注(标题/难度/话题/credit);
 * 5. 入库(AsyncStorage)并水化内存注册表。
 *
 * 说明:公版内容天然偏旧,但书库巨大且随机轮换(并记住最近用过的书),保证每天有新文章。
 * Expo Go / 独立安装版都无系统后台定时 → 由"每日首次打开 + 手动按钮"触发本服务。
 */

import { buildArticle, type RawArticle } from '@/data/articles/build';
import { hydrateRemoteArticles, remoteArticles } from '@/data/articles/remote-registry';
import { annotateBlock } from '@/domain/corpus/annotate';
import { fetchCoverUrl } from '@/domain/corpus/cover';
import { fetchBookText, pickBooks } from '@/domain/corpus/sources';
import {
  setCorpusDone,
  setCorpusFailed,
  setCorpusNoop,
  setCorpusRunning,
} from '@/domain/corpus/status';
import { fullTextToCandidates } from '@/domain/corpus/split';
import { getRecentBookKeys, saveRecentBookKeys } from '@/storage/corpus-history';
import { isUpdatedToday, saveRemoteArticles } from '@/storage/remote-articles';
import type { Article } from '@/types';

/** 每批尝试的书数 */
const MAX_BOOKS = 3;
/** 每次更新的目标篇数 */
const MAX_ARTICLES = 12;
/** 单篇词数下限/上限(与 split 对齐) */
const MIN_WORDS = 220;
const MAX_WORDS = 700;
/** 封面查询并发数 */
const COVER_CONCURRENCY = 4;
/** 防止并发重复更新 */
let updateInFlight: Promise<'updated' | 'skipped' | 'failed'> | null = null;

/** 一次更新的结果(篇数 + 用的哪条源,便于 UI 说明) */
export interface UpdateResult {
  count: number;
  /** 例:gutendex / Gutenberg 直链 */
  note: string;
}

/**
 * 执行一次语料更新;失败抛错由 UI 展示。
 * 配图:每篇文章独立按其内容查询 Wikimedia Commons(避免整批同图),
 * 并发分小批执行以免拖慢;查不到则前端回退。
 */
export async function runDailyCorpusUpdate(): Promise<UpdateResult> {
  const recent = await getRecentBookKeys();
  const { books, notes } = await pickBooks(MAX_BOOKS, recent);
  const raw: RawArticle[] = [];
  const failures: string[] = [];

  for (const book of books) {
    if (raw.length >= MAX_ARTICLES) break;
    try {
      const { text } = await fetchBookText(book);
      const candidates = fullTextToCandidates(text);
      let blockIndex = 0;
      for (const block of candidates) {
        if (raw.length >= MAX_ARTICLES) break;
        blockIndex += 1;
        const joined = block.paragraphs.join(' ');
        const words = (joined.match(/[A-Za-z]+/g) ?? []).length;
        if (words < MIN_WORDS || words > MAX_WORDS) continue;
        const article = annotateBlock(block, book.title.trim(), `gutenberg-${book.key}-${blockIndex}`);
        // 把书标题并入摘要上下文,提高配图相关性(标题启发式可能太短)
        raw.push({ ...article, summary: `${book.title.trim()}. ${article.summary}` });
      }
    } catch (e) {
      failures.push(e instanceof Error ? e.message : '未知错误');
    }
  }

  if (raw.length === 0) {
    const detail = failures.length > 0 ? failures.slice(0, 2).join(' / ') : notes.join(' · ');
    throw new Error(`没有抓到可用文章。${detail || '请检查网络后重试'}`);
  }

  // 每篇独立查图,小并发分批
  for (let i = 0; i < raw.length; i += COVER_CONCURRENCY) {
    const batch = raw.slice(i, i + COVER_CONCURRENCY);
    await Promise.all(
      batch.map(async (item) => {
        try {
          item.coverUrl = (await fetchCoverUrl(item.title, item.summary, item.id)) ?? undefined;
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
  // 记住这批书,下次优先换别的
  await saveRecentBookKeys(books.map((b) => b.key));

  const viaGutendex = books.some((b) => b.source === 'gutendex');
  return { count: remoteArticles.length, note: viaGutendex ? 'gutendex' : 'Gutenberg 直链' };
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
      const { count, note } = await runDailyCorpusUpdate();
      setCorpusDone(count, note);
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
