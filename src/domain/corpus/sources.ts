/**
 * 语料源策略(模块:每日语料)。
 *
 * 背景:原实现只依赖 gutendex 这一个第三方 API,它一旦宕机/被墙,
 * 「每日语料」就彻底不可用(手动更新也只会报"gutendex 不可达")。
 *
 * 现在的策略:
 *   1. 首选 gutendex(能拿到"随机书 + 多格式地址",内容更多样);超时压到 8s,
 *      失败不重试,避免像以前那样白等 60s;
 *   2. 失败则改用内置公版书目录(data/corpus/catalog.ts)+ Gutenberg 官方直链,
 *      按镜像依次尝试,任一成功即用;
 *   3. 提供 probeSources() 给 UI 做"测试语料源",手机上可直接看出哪条路通。
 */

import { CORPUS_CATALOG, gutenbergMirrors } from '@/data/corpus/catalog';

/** gutendex 随机书接口 */
const GUTENDEX_RANDOM = 'https://gutendex.com/books/?languages=en&sort=random';
/** gutendex 超时(它常年很慢,给 8s 足够判断"不可用") */
const GUTENDEX_TIMEOUT = 8000;
/** 正文下载超时 */
const TEXT_TIMEOUT = 20000;
/** 探测超时 */
const PROBE_TIMEOUT = 10000;

/** 一本书(含正文候选地址) */
export interface CorpusBook {
  /** 稳定标识(gutendex 用书号,目录用书号) */
  key: string;
  title: string;
  /** 按优先级排列的正文地址 */
  urls: string[];
  /** 来源:gutendex(随机书)或 catalog(内置目录) */
  source: 'gutendex' | 'catalog';
}

/** 单个源的探测结果(供 UI 展示) */
export interface SourceProbe {
  name: string;
  ok: boolean;
  ms: number;
  note: string;
}

/** 带超时的 GET(文本) */
async function getText(url: string, timeoutMs: number): Promise<string> {
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

/** 带超时的 GET(JSON) */
async function getJson(url: string, timeoutMs: number): Promise<unknown> {
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

function hostOf(url: string): string {
  const m = /^https?:\/\/([^/]+)/.exec(url);
  return m ? m[1] : url;
}

function shortErr(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/abort/i.test(msg)) return '超时';
  return msg.slice(0, 40);
}

/** 判断下载到的内容像不像一本 Gutenberg 正文(排除 404 页/HTML) */
function looksLikeBook(text: string): boolean {
  if (text.length < 8000) return false;
  const head = text.slice(0, 8000);
  return /project gutenberg/i.test(head) || /\*\*\*\s*start of/i.test(head);
}

interface GutendexBook {
  id: number;
  title: string;
  formats?: Record<string, string>;
}

/** 从 gutendex formats 里挑一个纯文本地址 */
function pickTxtUrl(book: GutendexBook): string | null {
  const formats = book.formats ?? {};
  for (const [type, url] of Object.entries(formats)) {
    if (type.includes('text/plain') && url.includes('utf-8')) return url;
  }
  for (const url of Object.values(formats)) {
    if (typeof url === 'string' && url.includes('/files/')) return url;
  }
  return null;
}

/** 首选:gutendex 随机书(失败抛错,由上层回退) */
async function gutendexBooks(max: number): Promise<CorpusBook[]> {
  const json = (await getJson(GUTENDEX_RANDOM, GUTENDEX_TIMEOUT)) as { results?: GutendexBook[] };
  const list = (json.results ?? [])
    .map((b) => ({ book: b, url: b.formats ? pickTxtUrl(b) : null }))
    .filter((x) => x.url !== null);
  if (list.length === 0) return [];
  return list.slice(0, max).map((x) => ({
    key: String(x.book.id),
    title: x.book.title.trim(),
    urls: [x.url as string, ...gutenbergMirrors(x.book.id)],
    source: 'gutendex' as const,
  }));
}

/** 洗牌(就地 Fisher–Yates,种子用 Math.random 即可) */
function shuffle<T>(arr: readonly T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * 挑这一批要抓的书。
 * @param max 需要几本
 * @param recentKeys 最近用过的书号(优先跳过,保证每天内容有新鲜感)
 */
export async function pickBooks(
  max: number,
  recentKeys: readonly string[] = [],
): Promise<{ books: CorpusBook[]; notes: string[] }> {
  const notes: string[] = [];
  try {
    const books = await gutendexBooks(max);
    if (books.length > 0) {
      notes.push('来源:gutendex');
      return { books, notes };
    }
    notes.push('gutendex 无结果');
  } catch (e) {
    notes.push(`gutendex 不可用(${shortErr(e)})`);
  }

  // 回退:内置目录 + 官方直链;优先没读过的
  const fresh = CORPUS_CATALOG.filter((b) => !recentKeys.includes(String(b.id)));
  const pool = fresh.length >= max ? fresh : CORPUS_CATALOG;
  const books: CorpusBook[] = shuffle(pool)
    .slice(0, max)
    .map((b) => ({
      key: String(b.id),
      title: b.title,
      urls: gutenbergMirrors(b.id),
      source: 'catalog' as const,
    }));
  notes.push(`改用 Gutenberg 直链(${books.length} 本)`);
  return { books, notes };
}

/** 下载一本书的正文,自动依次尝试各镜像 */
export async function fetchBookText(book: CorpusBook): Promise<{ text: string; via: string }> {
  const errors: string[] = [];
  for (const url of book.urls) {
    try {
      const text = await getText(url, TEXT_TIMEOUT);
      if (!looksLikeBook(text)) {
        errors.push(`${hostOf(url)}(内容异常)`);
        continue;
      }
      return { text, via: hostOf(url) };
    } catch (e) {
      errors.push(`${hostOf(url)}(${shortErr(e)})`);
    }
  }
  throw new Error(`下载失败:${errors.join(' ')}`);
}

/** 探测各语料源是否可用(供「测试语料源」按钮) */
export async function probeSources(): Promise<SourceProbe[]> {
  const out: SourceProbe[] = [];

  const test = async (name: string, url: string, validate?: (t: string) => boolean) => {
    const started = Date.now();
    try {
      const body = await getText(url, PROBE_TIMEOUT);
      const ok = validate ? validate(body) : body.length > 0;
      out.push({ name, ok, ms: Date.now() - started, note: ok ? '可用' : '返回内容异常' });
    } catch (e) {
      out.push({ name, ok: false, ms: Date.now() - started, note: shortErr(e) });
    }
  };

  await test('gutendex', GUTENDEX_RANDOM, (t) => t.trim().startsWith('{'));
  await test('www.gutenberg.org', gutenbergMirrors(11)[0], looksLikeBook);
  await test('gutenberg.pglaf.org', gutenbergMirrors(11)[1], looksLikeBook);
  return out;
}
