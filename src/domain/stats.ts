/**
 * 打卡统计纯函数(模块 G)。
 * streak(连续打卡天数):规则 = 不补卡,以"今天或昨天"为锚向前数。
 * - 今天已打卡 → 从今天往前连续数;
 * - 今天未打卡但昨天有 → streak 仍成立(昨天为止的连续,今天还没断);
 * - 今天昨天都没有 → 0。
 */

import { todayKey } from '@/storage/checkins';

/** 把 dateKey 转成 Date(本地 0 点) */
function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** dateKey 的前一天 */
function previousKey(key: string): string {
  const date = parseDateKey(key);
  date.setDate(date.getDate() - 1);
  const y = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

/**
 * 计算连续打卡天数。
 * @param dateKeys 全部打过卡的日期键(可无序)
 * @param anchor 锚点日期键,默认今天
 */
export function computeStreak(dateKeys: string[], anchor = todayKey()): number {
  const set = new Set(dateKeys);
  if (set.size === 0) return 0;
  // 今天没打、昨天打了 → 从昨天开始数(今天还没断)
  let cursor = set.has(anchor) ? anchor : previousKey(anchor);
  if (!set.has(cursor)) return 0;
  let streak = 0;
  while (set.has(cursor)) {
    streak += 1;
    cursor = previousKey(cursor);
  }
  return streak;
}
