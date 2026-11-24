/**
 * 远程(自动更新)文章存储。
 * 结构:key → { updatedDate: 'YYYY-MM-DD', articles: Article[] }
 * 数据由"每日语料更新"服务写入,App 启动时水化到内存注册表。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { countNewArticles, mergeRemoteArticles } from '@/domain/article-merge';
import { todayKey } from '@/domain/clock';
import type { Article } from '@/types';

const KEY = 'readingapp.remote.v1';

/**
 * 日期键。与打卡/学习记录共用 `domain/clock` 的**校准时间**（P1-1）。
 * 以前这里是第三份本机时间副本，导致"语料更新日期"与"学习日期"可能对不上。
 */
export const dateKey = (now: Date = new Date()) => todayKey(now);

interface StoreShape {
  updatedDate: string;
  articles: Article[];
}

/** 读取远程文章 + 最近更新时间 */
/**
 * 修复已缓存的公版文章标题。
 *
 * 旧版本的标题是"正文前 8 个词"(如 "I' ve nice place here said eyes flashing ab…"),
 * 因为 `annotateBlock` 收了 `bookTitle` 参数却没有使用(已修)。
 * 但**已经缓存在本机的文章不会因为改代码自动变好** —— 合又是按 id 保留旧的。
 *
 * 书名其实就在数据里:`source` 形如 "Project Gutenberg · The Great Gatsby · Public Domain"。
 * 所以这里在读取时做一次就地修复(不需要联网、不需要清缓存)。
 */
function repairGutenbergTitles(articles: Article[]): { articles: Article[]; changed: number } {
  let changed = 0;
  const out = articles.map((a) => {
    if (!a.id.startsWith('gutenberg-')) return a;
    // 优先从 source 里取书名(格式最稳定)
    let book: string | undefined;
    const creditParts = (a.credit ?? '').split(' · ').map((x: string) => x.trim());
    if (creditParts.length >= 2 && creditParts[1]) book = creditParts[1];
    // 退化:summary 以 "书名. 正文…" 开头
    if (!book) {
      const m = /^([^.\n]{2,90})\.\s/.exec(a.summary ?? '');
      if (m) book = m[1].trim();
    }
    if (!book || book === a.title) return a;
    changed += 1;
    return { ...a, title: book };
  });
  return { articles: out, changed };
}

export async function loadRemoteArticles(): Promise<StoreShape> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { updatedDate: '', articles: [] };
    const parsed = JSON.parse(raw) as StoreShape;
    if (!Array.isArray(parsed.articles)) return { updatedDate: '', articles: [] };
    // 修复旧缓存里"正文片段当标题"的文章(见 repairGutenbergTitles)
    const repaired = repairGutenbergTitles(parsed.articles);
    return { updatedDate: parsed.updatedDate, articles: repaired.articles };
  } catch {
    return { updatedDate: '', articles: [] };
  }
}

/**
 * 保存一批远程文章并记录更新日期。
 *
 * **P1-3**:以前这是**整份替换** —— 昨天读的文章今天被顶掉,于是
 * 「累计读完」会缩水、生词本里的「来源:《…》」也会消失。
 * 现在改为按 id 合并(见 domain/article-merge.ts),旧文章保留到上限为止。
 *
 * @returns 本次实际新增的篇数(0 表示内容没变)
 */
export async function saveRemoteArticles(articles: Article[]): Promise<number> {
  const current = await loadRemoteArticles();
  const merged = mergeRemoteArticles(current.articles, articles);
  const newCount = countNewArticles(current.articles, articles);
  const shape: StoreShape = { updatedDate: dateKey(), articles: merged };
  await AsyncStorage.setItem(KEY, JSON.stringify(shape));
  return newCount;
}

/** 今天是否已更新过 */
export async function isUpdatedToday(now = new Date()): Promise<boolean> {
  const shape = await loadRemoteArticles();
  return shape.updatedDate === dateKey(now);
}
