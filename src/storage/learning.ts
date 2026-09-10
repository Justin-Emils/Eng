/**
 * 单词学习记录(模块:范围化学习 + 当日新学词)。
 * - 学习中(headword)在"点词/标记学习"后记录,归入当天;
 * - 全部已学 = 跨日期合并,用于"该词是否已会/不再当作生词"判断;
 * - 当日新学 = 今天学到的,用于推荐文正文加粗。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const LEARNING_KEY = 'readingapp.learning.v1';
const KNOWN_KEY = 'readingapp.known.v1';

/** 与 checkins 一致:本地日期键 YYYY-MM-DD */
export function todayKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function readLearning(): Promise<Record<string, string[]>> {
  try {
    const raw = await AsyncStorage.getItem(LEARNING_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
  } catch {
    return {};
  }
}

/** 标记某词"今天学习过"(幂等) */
export async function markLearned(headword: string, dateKey = todayKey()): Promise<void> {
  const key = headword.toLowerCase();
  const map = await readLearning();
  const list = map[dateKey] ?? [];
  if (!list.includes(key)) {
    map[dateKey] = [...list, key];
    await AsyncStorage.setItem(LEARNING_KEY, JSON.stringify(map));
  }
}

/** 今天学到的词(小写 set) */
export async function getLearnedToday(dateKey = todayKey()): Promise<Set<string>> {
  const map = await readLearning();
  return new Set(map[dateKey] ?? []);
}

/** 全部学过的词(跨日期,小写 set) */
export async function getAllLearned(): Promise<Set<string>> {
  const map = await readLearning();
  const all = new Set<string>();
  for (const list of Object.values(map)) for (const w of list) all.add(w);
  return all;
}

/** 今天学了多少词 */
export async function countLearnedToday(dateKey = todayKey()): Promise<number> {
  const s = await getLearnedToday(dateKey);
  return s.size;
}

/* ---------------- 已认识(主动标记"我会了") ---------------- */

async function readKnown(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KNOWN_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

/** 标记某词为"已认识/已会"(从生词范围移除) */
export async function markKnown(headword: string): Promise<void> {
  const key = headword.toLowerCase();
  const known = await readKnown();
  if (!known.includes(key)) {
    known.push(key);
    await AsyncStorage.setItem(KNOWN_KEY, JSON.stringify(known));
  }
}

/** 是否为"已认识/已会"词 */
export async function isKnown(headword: string): Promise<boolean> {
  const known = await readKnown();
  return known.includes(headword.toLowerCase());
}

/** 全部"已认识/已会"词(小写 set) */
export async function getAllKnown(): Promise<Set<string>> {
  const known = await readKnown();
  return new Set(known);
}
