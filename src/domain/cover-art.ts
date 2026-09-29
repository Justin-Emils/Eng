/**
 * 「节目单」封面的**纯逻辑**(按 id 确定性生成一套外观规格)。
 *
 * 为什么把逻辑和渲染分开:
 *  1. 这里全是可测的纯函数 —— `scripts/verify-cover-art.mjs` 可以直接跑它,
 *     断言"色调够分散、对比度够高、布局不会全撞在一起",不需要渲染;
 *  2. 渲染层(`components/playbill-cover.tsx`)只负责把规格画出来,
 *     换成别的画法不用动这里。
 *
 * 设计目标:**一屏 30 篇不能看起来像同一张图**。
 * 只让颜色变是不够的 —— 六个预设循环下来每种要重复 5 次,列表会很单调。
 * 所以这里变三个正交的维度:
 *   色相锚点(8) × 布局模板(4) × 徽记(4),再叠上色相/明度/位置的抖动。
 * 组合数远超文章总数,列表里几乎看不到两张一样的。
 */

import { hslToHex } from '@/domain/cover';

/**
 * 色相锚点。**不是均匀铺满色环,而是照活动截图的实测色族取的**。
 *
 * `scripts/analyze-reference.ps1` 对 7 张活动图的面积加权统计(占饱和像素):
 *   240-255° 蓝紫 25.5% · 345-360° 绯红 16.5% · 255-270° 紫 14.5%
 *   30-45° 暖金 13.0% · 270-285° 紫 10.4% · 330-345° 酒红 6.0%
 * 也就是说活动的色域是一条 **绯红 → 品红 → 紫 → 靛蓝** 的弧,再加一点暖金,
 * 完全没有青绿、亮黄这些。所以锚点也只取这条弧 —— 早先均匀铺满 360° 的版本
 * 会生成橄榄绿、青色的封面,那些颜色在活动里根本不存在。
 */
const HUE_ANCHORS = [352, 338, 324, 308, 292, 276, 258, 242, 228, 40];

/** 布局模板 */
export type CoverLayout = 0 | 1 | 2 | 3;
/** 中央徽记 */
export type CoverMark = 'diamond' | 'ring' | 'bars' | 'cross';
/** 边框画法 */
export type CoverFrame = 0 | 1 | 2;

export interface CoverArtSpec {
  /** 版心底色 */
  base: string;
  /** 主要色块(大圆/色带) */
  block: string;
  /** 次要色块(小圆/副带),比 block 更暗 */
  blockSoft: string;
  /** 线条与文字色(象牙调,压在底色上保证高对比) */
  ink: string;
  layout: CoverLayout;
  mark: CoverMark;
  /** 边框画法:0 内框+对角刻线 · 1 只有对角刻线 · 2 双线内框 */
  frame: CoverFrame;
  /** 0–1 的抖动系数:给色块的位置与尺寸做微差 */
  jitter: number;
}

/** FNV-1a 32 位:分布比"乘法累加取模"好,而且逐位可用 */
function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 按文章 id 生成一套封面外观 */
export function coverArtFor(id: string): CoverArtSpec {
  const h = hash32(id);

  const anchor = HUE_ANCHORS[h % HUE_ANCHORS.length];
  /** 色相抖动:让同一锚点下的不同文章也能分辨 */
  const hue = (anchor + ((h >>> 3) % 33) - 16 + 360) % 360;

  // 底色压得很暗:**对齐实测值** —— 活动图里最深的底是 #09080b / #0d0b12,
  // 浮起面是 #17141b / #1c1725 / #201a36(明度约 6%–16%)
  const baseL = 8 + ((h >>> 7) % 7);
  // 色块明度对齐实测的紫色面 #553878 / #4d3071 / #573877(明度约 26%–36%)
  const blockL = 26 + ((h >>> 11) % 11);
  const blockSoftL = Math.max(6, baseL - 3 - ((h >>> 13) % 3));

  return {
    base: hslToHex(hue, 40 + ((h >>> 5) % 12), baseL),
    block: hslToHex(hue, 38 + ((h >>> 9) % 16), blockL),
    blockSoft: hslToHex((hue + 12) % 360, 34, blockSoftL),
    /** 墨色带一点点色相,像同色系的印刷墨,比纯象牙白更有质感 */
    ink: hslToHex(hue, 20, 90),
    layout: ((h >>> 15) % 4) as CoverLayout,
    mark: (['diamond', 'ring', 'bars', 'cross'] as const)[(h >>> 17) % 4],
    frame: ((h >>> 21) % 3) as CoverFrame,
    jitter: ((h >>> 19) % 1000) / 1000,
  };
}

/** 供校验脚本用:某个 id 的"外观指纹"(布局 + 徽记 + 边框 + 色相桶) */
export function coverFingerprint(id: string): string {
  const spec = coverArtFor(id);
  const hueBucket = Math.round(Number.parseInt(spec.base.slice(1, 3), 16) / 4);
  return `${spec.layout}-${spec.mark}-${spec.frame}-${hueBucket}`;
}
