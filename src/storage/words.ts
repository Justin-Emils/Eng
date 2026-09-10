/**
 * 持久化仓储层(模块 F)。
 * 业务读写统一走这里;页面/组件不直接碰 AsyncStorage,便于未来替换为
 * expo-sqlite 或远端 adapter(repository 只暴露 Promise 接口)。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { makeWordItem, type NewWordInput } from '@/domain/words';
import { isDue } from '@/domain/srs';
import type { WordItem } from '@/types';

/** 存储版本号:结构变更时递增并写迁移钩子 */
export const STORAGE_VERSION = 1;
const WORDS_KEY = 'readingapp.words.v1';
const STORAGE_VERSION_KEY = 'readingapp.storage.version';

/** 读取全部生词(按加入时间倒序,新的在前) */
export async function getWords(): Promise<WordItem[]> {
  try {
    const raw = await AsyncStorage.getItem(WORDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WordItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed.sort((a, b) => b.addedAt - a.addedAt);
  } catch {
    return [];
  }
}

/** 按 id 查一个生词 */
export async function getWordById(id: string): Promise<WordItem | undefined> {
  const words = await getWords();
  return words.find((w) => w.id === id);
}

/** 保存一个生词(存在则覆盖同 id 条目) */
export async function saveWord(word: WordItem): Promise<void> {
  const words = await getWords();
  const idx = words.findIndex((w) => w.id === word.id);
  if (idx >= 0) {
    words[idx] = word;
  } else {
    words.unshift(word);
  }
  await AsyncStorage.setItem(WORDS_KEY, JSON.stringify(words));
}

/** 删除一个生词 */
export async function removeWord(id: string): Promise<void> {
  const words = await getWords();
  const next = words.filter((w) => w.id !== id);
  await AsyncStorage.setItem(WORDS_KEY, JSON.stringify(next));
}

/** 某词是否已在生词本(按 headword 判断,跨来源去重) */
export async function isWordSaved(headword: string): Promise<boolean> {
  const words = await getWords();
  return words.some((w) => w.headword === headword.toLowerCase());
}

/** 到期可复习的词(按到期时间升序;mastered/ignored 不计入) */
export async function getDueWords(now = Date.now()): Promise<WordItem[]> {
  const words = await getWords();
  return words.filter((w) => isDue(w, now)).sort((a, b) => a.review.dueAt - b.review.dueAt);
}

/** 全部"学习中的词"(new/learning),忽略到期时间——用于"立即复习" */
export async function getAllLearningWords(): Promise<WordItem[]> {
  const words = await getWords();
  return words
    .filter((w) => w.status === 'new' || w.status === 'learning')
    .sort((a, b) => a.review.dueAt - b.review.dueAt);
}

/** 更新一个词的调度/状态(复习结果写入) */
export async function updateWordReview(word: WordItem): Promise<void> {
  const words = await getWords();
  const idx = words.findIndex((w) => w.id === word.id);
  if (idx >= 0) {
    words[idx] = { ...word };
    await AsyncStorage.setItem(WORDS_KEY, JSON.stringify(words));
  }
}

/** 直接设置某词状态(标记掌握/忽略),不触碰调度字段 */
export async function setWordStatus(id: string, status: WordItem['status']): Promise<void> {
  const words = await getWords();
  const idx = words.findIndex((w) => w.id === id);
  if (idx < 0) return;
  words[idx] = { ...words[idx], status };
  await AsyncStorage.setItem(WORDS_KEY, JSON.stringify(words));
}

/** 统计各状态数量(复习角标等用) */
export async function countByStatus(): Promise<{
  due: number;
  learning: number;
  mastered: number;
  total: number;
}> {
  const words = await getWords();
  const now = Date.now();
  return {
    due: words.filter((w) => isDue(w, now)).length,
    learning: words.filter((w) => w.status === 'learning' || w.status === 'new').length,
    mastered: words.filter((w) => w.status === 'mastered').length,
    total: words.length,
  };
}

/**
 * 切换收藏:未收藏 → 加入;已收藏 → 移除该词全部条目。
 * 返回切换后的最新收藏态。
 */
export async function toggleWordSave(input: NewWordInput): Promise<boolean> {
  const headword = input.headword.toLowerCase();
  const wasSaved = await isWordSaved(headword);
  const words = await getWords();
  if (wasSaved) {
    const next = words.filter((w) => w.headword !== headword);
    await AsyncStorage.setItem(WORDS_KEY, JSON.stringify(next));
    return false;
  }
  const item = makeWordItem(input);
  await AsyncStorage.setItem(WORDS_KEY, JSON.stringify([item, ...words]));
  return true;
}

/** 清空生词本(二次确认由 UI 层负责) */
export async function clearWords(): Promise<void> {
  await AsyncStorage.removeItem(WORDS_KEY);
}

// 迁移钩子(暂为空实现):未来 STORAGE_VERSION 提升时在此迁移旧结构
export async function migrateStorageIfNeeded(): Promise<void> {
  try {
    const rawVersion = await AsyncStorage.getItem(STORAGE_VERSION_KEY);
    const currentVersion = rawVersion ? Number(rawVersion) : 0;
    if (Number.isFinite(currentVersion) && currentVersion >= STORAGE_VERSION) return;

    // Version 1 already uses the current keys. Record the version without
    // touching user data so future migrations have a stable starting point.
    await AsyncStorage.setItem(STORAGE_VERSION_KEY, String(STORAGE_VERSION));
  } catch {
    // Storage failures should not prevent the app from opening.
  }
}
