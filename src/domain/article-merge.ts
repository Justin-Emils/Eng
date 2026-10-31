/**
 * 远程文章集合的合并策略（P1-3）。纯函数,便于用 Node 直接验证。
 *
 * 报告指出的缺陷:`saveRemoteArticles` 每次都**整份替换** ——
 * 今天读了 3 篇,明天这 3 篇被新一批顶掉,于是
 *   · 「累计读完 12 篇」变成 9 篇(统计按"文章还能否解析"算);
 *   · 生词本里「来源:《…》」集体消失。
 *
 * 现在改成**按 id 合并**:新文章进来,旧文章保留(最新的在前),
 * 超过上限时才从最旧的开始淘汰 —— 上限存在的意义是避免存储无限膨胀。
 */

import type { Article } from '@/types';

/** 保留上限:足够覆盖"统计里还会引用到的历史",又不会无限增长 */
export const MAX_KEPT_REMOTE_ARTICLES = 200;

/**
 * 合并两批文章。
 * @param existing 已有的(可能来自更早的批次)
 * @param incoming 新抓到的
 * @param cap 保留上限
 * @returns 去重并按"新的在前"排列的结果
 */
export function mergeRemoteArticles(
  existing: readonly Article[],
  incoming: readonly Article[],
  cap: number = MAX_KEPT_REMOTE_ARTICLES,
): Article[] {
  // 新文章优先:同一 id 以 incoming 为准(内容可能被重新切分)
  const byId = new Map<string, Article>();
  for (const a of incoming) byId.set(a.id, a);
  for (const a of existing) if (!byId.has(a.id)) byId.set(a.id, a);

  const merged = [...byId.values()];
  // 稳定排序:保持 incoming 的相对顺序在前,其余按原顺序追加(不做时间排序,
  // 因为 Article 没有可靠的入库时间字段,ids 里也没有单调时间戳)
  const order = new Map<string, number>();
  incoming.forEach((a, i) => order.set(a.id, i));
  existing.forEach((a, i) => {
    if (!order.has(a.id)) order.set(a.id, incoming.length + i);
  });
  merged.sort((x, y) => (order.get(x.id) ?? 0) - (order.get(y.id) ?? 0));

  return merged.slice(0, Math.max(0, cap));
}

/** 这次入库实际新增了多少篇(给更新提示用) */
export function countNewArticles(
  existing: readonly Article[],
  incoming: readonly Article[],
): number {
  const had = new Set(existing.map((a) => a.id));
  return incoming.reduce((n, a) => (had.has(a.id) ? n : n + 1), 0);
}
