/**
 * 阅读进度持久化仓储(模块 D 进度记忆 / F 数据层)。
 * 每篇文章一条进度,重启不丢,回来续读。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ReadingProgress } from '@/types';

const PROGRESS_KEY = 'readingapp.progress.v1';

/** 读取某篇的阅读进度;无则 undefined */
export async function getReadingProgress(articleId: string): Promise<ReadingProgress | undefined> {
  try {
    const raw = await AsyncStorage.getItem(PROGRESS_KEY);
    if (!raw) return undefined;
    const map = JSON.parse(raw) as Record<string, ReadingProgress>;
    return map[articleId];
  } catch {
    return undefined;
  }
}

/** 合并保存某篇进度(局部更新,保留其余字段) */
export async function saveReadingProgress(
  articleId: string,
  patch: Partial<Omit<ReadingProgress, 'articleId'>> & { readSeconds?: number },
): Promise<void> {
  const prev = (await getReadingProgress(articleId)) ?? {
    articleId,
    paragraphIndex: 0,
    completed: false,
    updatedAt: Date.now(),
    readSeconds: 0,
  };
  const now = Date.now();
  const deltaSeconds =
    patch.readSeconds !== undefined ? patch.readSeconds : Math.round((now - prev.updatedAt) / 1000);
  const next: ReadingProgress = {
    ...prev,
    ...patch,
    articleId,
    updatedAt: now,
    readSeconds: Math.max(0, (prev.readSeconds ?? 0) + Math.max(0, deltaSeconds)),
  };
  const raw = await AsyncStorage.getItem(PROGRESS_KEY).catch(() => null);
  const map = raw ? (JSON.parse(raw) as Record<string, ReadingProgress>) : {};
  map[articleId] = next;
  await AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify(map));
}

/** 标记一篇完成(读完);不在这里写打卡,打卡见 storage/checkins */
export async function markArticleCompleted(articleId: string): Promise<void> {
  await saveReadingProgress(articleId, { completed: true });
}

/** 全部已完成文章的 id 集合 */
export async function getCompletedArticleIds(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(PROGRESS_KEY);
    if (!raw) return new Set();
    const map = JSON.parse(raw) as Record<string, ReadingProgress>;
    const ids = Object.values(map)
      .filter((p) => p.completed)
      .map((p) => p.articleId);
    return new Set(ids);
  } catch {
    return new Set();
  }
}
