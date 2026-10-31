/**
 * 打卡持久化仓储(模块 G 打卡)。
 * 结构:Record<dateKey('YYYY-MM-DD'), articleId[]> —— 每天读完了哪些文章。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { todayKey } from '@/domain/clock';

/**
 * 日期键统一从 `domain/clock` 来（P1-1）。
 *
 * 以前这里有一份自己的 `todayKey()`，用**设备本机时间** —— 这正是"改系统日期就能刷
 * 连续打卡"的漏洞：学习记录用的是校准时间，打卡却用本机时间。
 * 现在全项目只有一个定义，改系统时间不再影响打卡日期。
 */
export { todayKey };

const CHECKINS_KEY = 'readingapp.checkins.v1';

/** 全部打卡 map */
async function getAllCheckins(): Promise<Record<string, string[]>> {
  try {
    const raw = await AsyncStorage.getItem(CHECKINS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
  } catch {
    return {};
  }
}

/** 某篇在今天是否已打卡 */
export async function isCheckedInToday(articleId: string): Promise<boolean> {
  const map = await getAllCheckins();
  return (map[todayKey()] ?? []).includes(articleId);
}

/** 添加一次打卡(读完一篇);重复打卡幂等 */
export async function addCheckin(articleId: string, dateKey = todayKey()): Promise<void> {
  const map = await getAllCheckins();
  const list = map[dateKey] ?? [];
  if (!list.includes(articleId)) {
    map[dateKey] = [...list, articleId];
    await AsyncStorage.setItem(CHECKINS_KEY, JSON.stringify(map));
  }
}

/** 今天读完了多少篇(打卡计数) */
export async function getTodayCheckinCount(): Promise<number> {
  const map = await getAllCheckins();
  return (map[todayKey()] ?? []).length;
}

/** 某天(YYYY-MM-DD)打卡过的文章 id 列表 */
export async function getCheckedArticleIdsOn(dateKey: string): Promise<string[]> {
  const map = await getAllCheckins();
  return map[dateKey] ?? [];
}

/** 有打卡记录的所有日期(用于连续天数计算),含日期键数组 */
export async function getCheckinDateKeys(): Promise<string[]> {
  const map = await getAllCheckins();
  return Object.keys(map).sort();
}

/** 全部打过卡的文章 id(去重),供"已读标记"用 */
export async function getAllCheckedArticleIds(): Promise<Set<string>> {
  const map = await getAllCheckins();
  const ids = new Set<string>();
  for (const list of Object.values(map)) {
    for (const id of list) ids.add(id);
  }
  return ids;
}
