/**
 * 最近用过的公版书号(让每日语料轮换,不总抓同一批书)。
 * 结构简单:一个字符串数组,新的在前,只保留最近 N 个。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'readingapp.corpus.recent-books.v1';
/** 最多记住多少本,避免长期只用少数几本 */
const MAX_KEEP = 24;

export async function getRecentBookKeys(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export async function saveRecentBookKeys(keys: readonly string[]): Promise<void> {
  if (keys.length === 0) return;
  try {
    const prev = await getRecentBookKeys();
    const merged = [...keys, ...prev.filter((k) => !keys.includes(k))].slice(0, MAX_KEEP);
    await AsyncStorage.setItem(KEY, JSON.stringify(merged));
  } catch {
    // 记录失败不影响主流程
  }
}
