/**
 * 同步指纹(纯函数)。
 *
 * 为什么单独抽出来:自动同步靠"指纹是否相同"判断**内容有没有变**。
 * 这里有一条容易踩的坑 —— 备份 JSON 里带 `exportedAt`(每次导出都不同的时间戳),
 * 如果直接对整份 JSON 求哈希,指纹**永远在变**,于是"没变化就不上传"形同虚设:
 * 每 60 秒全量覆盖一次云端,多设备时旧设备会稳定盖掉新设备。
 *
 * 所以指纹只覆盖:
 *   · 归属账号(数据属于谁,换了账号指纹当然要变);
 *   · 每个业务键的原始字符串值(按键名排序,保证顺序稳定)。
 * 显式**不包含** exportedAt / 导出耗时等元信息。
 *
 * 纯函数的好处:验证脚本可以在 Node 里直接跑,不需要给 AsyncStorage 打桩。
 */

import { hashString } from '@/domain/hash';

/** 一段内容 → 稳定指纹(同一份内容永远同一个值) */
export function businessFingerprint(
  ownerId: string,
  entries: readonly (readonly [string, string | null])[],
): string {
  // 键名排序:multiGet 的返回顺序不应影响指纹
  const sorted = [...entries].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  // 用不可见分隔符拼接,避免 "a=b" 与 "a"+ "=b" 这类歧义
  const body = sorted.map(([key, value]) => `${key}\u0001${value ?? ''}`).join('\u0002');
  return hashString(`${ownerId}\u0003${body}`);
}
