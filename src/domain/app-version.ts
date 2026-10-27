/**
 * 当前 App 版本号(单一来源)。
 *
 * 为什么不直接在界面里写字符串:版本号有两个用途 —— 展示和"和云端最新版比较",
 * 两处必须一致。这里统一从 `app.json` 读(发版时只改 app.json 一处),
 * 读不到再退回 expo-constants,最后兜底 '0.0.0'。
 */

import Constants from 'expo-constants';

import appJson from '../../app.json';

/** 形如 "1.1.11" */
export const APP_VERSION: string =
  (appJson as { expo?: { version?: string } }).expo?.version ??
  Constants.expoConfig?.version ??
  '0.0.0';

/** 版本号比较:a>b 返回 1,a<b 返回 -1,相等 0(按数字段比较,不按字符串) */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string): number[] =>
    v
      .replace(/^v/i, '')
      .split('.')
      .map((seg) => {
        const n = Number.parseInt(seg.replace(/\D.*$/, ''), 10);
        return Number.isFinite(n) ? n : 0;
      });
  const pa = parse(a);
  const pb = parse(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}
