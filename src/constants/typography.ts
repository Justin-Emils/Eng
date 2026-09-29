/**
 * 排版层:字体族插槽 + 字号层级 + 字距/行距/数字规则。
 *
 * 为什么单独成文件:排版是**App 层面**的资产(和配色/几何那套主题正交)。
 *
 * 三个刻意的规则:
 *  1. **字号越大,字距越紧;字越小,字距越松。** 这是排版的常识,但代码里最容易漏:
 *     34px 的标题用 0 字距会显得松散,10px 的全大写标签用 0 字距会粘成一团。
 *     所以下面每一档都带 `tracking`,而不是全局一个值。
 *  2. **行距按"字号 × 比例"给,不是写死行高。** 衬线正文需要 1.6~1.8,
 *     标签类只需要 1.3~1.4 —— 差别很大,用一个固定值会两头都不对。
 *  3. **数字用等宽数位(tabular-nums)。** 统计数字会随数据变化,
 *     比例数位会让"37 → 128"这类数字左右跳动,等宽数位才不会。
 */

import { MONO_FAMILY, SANS_FAMILY, SERIF_FAMILY } from '@/constants/fonts';

/**
 * 字体族插槽(角色 → 实际族名)。
 *
 * 衬线族来自内嵌的 **Literata**(见 `constants/fonts.ts` 的说明),
 * 无衬线与等宽继续用系统字体 —— 中文字形占 UI 的绝大多数,内嵌西文无衬线只会让
 * 中英混排更不统一,而中文字体又要 10MB+ 包体。
 *
 * ⚠️ 衬线族**按字重分成四个族名**。`@expo-google-fonts` 每个字重是独立 ttf,
 * 注册后就是独立族名;Android 不会按 `fontWeight` 去挑文件,而是拿 400 去合成假粗体。
 * 所以取族名要用下面的 `serifForWeight`,不要只写 `FONT_SLOTS.display`。
 */
export const FONT_SLOTS = {
  /** 阅读正文(400) */
  reading: SERIF_FAMILY.regular,
  /** 展示层默认字重(600) */
  display: SERIF_FAMILY.semibold,
  /** UI 标签与按钮 */
  label: SANS_FAMILY,
  /** 音标、词性 */
  mono: MONO_FAMILY,
} as const;

/**
 * 按字重取衬线族名,并把 `fontWeight` 归零。
 *
 * 为什么要回归零:族名已经表达了字重(Literata_600SemiBold),再叠加 `fontWeight: '600'`
 * 会让 Android 在这个单一字重的族上**再做一次合成加粗**,笔画会发虚。
 */
export function serifForWeight(weight: TypeStep['weight']): {
  fontFamily: string;
  fontWeight: 'normal';
} {
  const map: Record<TypeStep['weight'], string> = {
    '400': SERIF_FAMILY.regular,
    '500': SERIF_FAMILY.medium,
    '600': SERIF_FAMILY.semibold,
    '700': SERIF_FAMILY.bold,
  };
  return { fontFamily: map[weight], fontWeight: 'normal' };
}

/** 字号层级(单位 dp)。`tracking` 是 letterSpacing,`ratio` 是行高倍数 */
export interface TypeStep {
  size: number;
  /** 行高 = size × ratio */
  ratio: number;
  weight: '400' | '500' | '600' | '700';
  /** 字距(dp)。大字号用负数收紧,小字号用正数撑开 */
  tracking: number;
  /** 是否使用等宽数位 */
  tabular?: boolean;
}

export const TYPE_STEPS = {
  /** 首次引导、欢迎页的大标题 */
  display: { size: 34, ratio: 1.16, weight: '600', tracking: -0.7 },
  /** 页面标题、板块大标题 */
  title: { size: 26, ratio: 1.24, weight: '600', tracking: -0.5 },
  /** 卡片标题、文章标题 */
  heading: { size: 19, ratio: 1.36, weight: '600', tracking: -0.2 },
  /** 阅读正文(阅读页另有 A−/A+ 覆盖 size) */
  reading: { size: 18, ratio: 1.62, weight: '400', tracking: 0 },
  /** 普通 UI 正文 */
  body: { size: 16, ratio: 1.5, weight: '500', tracking: 0 },
  /** 次要小字 */
  small: { size: 14, ratio: 1.42, weight: '500', tracking: 0.1 },
  smallBold: { size: 14, ratio: 1.42, weight: '700', tracking: 0.1 },
  /** 元信息 */
  caption: { size: 12, ratio: 1.42, weight: '500', tracking: 0.2 },
  /** 铭牌式小标签(全大写 + 大字距) */
  label: { size: 10, ratio: 1.4, weight: '600', tracking: 1.8 },
  /** 统计数字 */
  numeric: { size: 26, ratio: 1.15, weight: '600', tracking: -0.3, tabular: true },
} as const satisfies Record<string, TypeStep>;

export type TypeStepName = keyof typeof TYPE_STEPS;

/** 把一档字号展开成可直接放进 style 的对象 */
export function typeStyle(name: TypeStepName): {
  fontSize: number;
  lineHeight: number;
  fontWeight: TypeStep['weight'];
  letterSpacing: number;
  fontVariant?: ('tabular-nums')[];
} {
  const step: TypeStep = TYPE_STEPS[name];
  return {
    fontSize: step.size,
    lineHeight: Math.round(step.size * step.ratio),
    fontWeight: step.weight,
    letterSpacing: step.tracking,
    ...(step.tabular ? { fontVariant: ['tabular-nums' as const] } : {}),
  };
}

/**
 * 阅读栏的**行宽上限**(dp)。
 *
 * 这是排版里最容易被忽略、但影响最大的一条:一行 60~75 个字符最好读,
 * 超过 90 个字符眼睛回扫时容易串行。18px 衬线大约 8dp/字符 → 66 字符 ≈ 530dp,
 * 留一点余量取 600。原来沿用 `MaxContentWidth = 800`,一行接近 90 字符,偏宽。
 */
export const READING_MEASURE = 600;
