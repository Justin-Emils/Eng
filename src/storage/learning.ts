/**
 * 单词学习记录(模块:范围化学习 + 当日新学词)。
 * - 学习中(headword)在"点词/标记学习"后记录,归入当天;
 * - 全部已学 = 跨日期合并,用于"该词是否已会/不再当作生词"判断;
 * - 当日新学 = 今天学到的,用于推荐文正文加粗。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { nowDate } from '@/domain/clock';

const LEARNING_KEY = 'readingapp.learning.v1';
const KNOWN_KEY = 'readingapp.known.v1';

/**
 * 今天的日期键(YYYY-MM-DD)。
 *
 * **时间来自网络校准的服务器时间**(见 domain/clock):打卡与连续天数建立在
 * "今天是哪天"之上,不能由用户改系统时间来左右;离线时用上次校准的偏移 + 本机时钟。
 */
export function todayKey(date = nowDate()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
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

/**
 * 撤销"今日已学"(从生词本移出时调用)。
 *
 * 为什么需要:"今日新学"与"加入生词本"绑定之后,用户可能在加错后立刻移出,
 * 计数器不该留着那一笔。只撤销**今天**的记录 —— 昨天学过的词今天移出,
 * 不该影响昨天的历史。
 */
export async function unmarkLearnedToday(headword: string, dateKey = todayKey()): Promise<void> {
  const key = headword.toLowerCase();
  const map = await readLearning();
  const list = map[dateKey] ?? [];
  if (!list.includes(key)) return;
  const next = { ...map, [dateKey]: list.filter((w) => w !== key) };
  await AsyncStorage.setItem(LEARNING_KEY, JSON.stringify(next));
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
