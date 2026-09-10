/**
 * 远程(自动更新)文章存储。
 * 结构:key → { updatedDate: 'YYYY-MM-DD', articles: Article[] }
 * 数据由"每日语料更新"服务写入,App 启动时水化到内存注册表。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Article } from '@/types';

const KEY = 'readingapp.remote.v1';

export function dateKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

interface StoreShape {
  updatedDate: string;
  articles: Article[];
}

/** 读取远程文章 + 最近更新时间 */
export async function loadRemoteArticles(): Promise<StoreShape> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { updatedDate: '', articles: [] };
    const parsed = JSON.parse(raw) as StoreShape;
    if (!Array.isArray(parsed.articles)) return { updatedDate: '', articles: [] };
    return parsed;
  } catch {
    return { updatedDate: '', articles: [] };
  }
}

/** 保存一批远程文章并记录更新日期 */
export async function saveRemoteArticles(articles: Article[]): Promise<void> {
  const shape: StoreShape = { updatedDate: dateKey(), articles };
  await AsyncStorage.setItem(KEY, JSON.stringify(shape));
}

/** 今天是否已更新过 */
export async function isUpdatedToday(now = new Date()): Promise<boolean> {
  const shape = await loadRemoteArticles();
  return shape.updatedDate === dateKey(now);
}
