/**
 * 复习结果的**分档统计** —— 复习校准知识曲线的数据来源。
 *
 * 为什么需要它:用户词汇量最初来自一次评估(15~40 个词),那是个很窄的样本。
 * 而复习是**真实发生的学习行为**:每个词都被问过"记不记得",这就是一条关于
 * "这个人到底会不会这个词"的证据。把它按门槛档位累积起来,就能反哺曲线 ——
 * 复习得越多,pKnown 越接近真实,而不是永远停在评估那一天。
 *
 * 两个刻意的设计:
 *  1. **按档位累积,不按词累积**:个人词表里的词是"当时不会的词"(有偏样本),
 *     用它去估整体水平会偏低;只有按档位统计"这一档答对了多少",才能与评估曲线对齐;
 *  2. **收缩(shrinking)后才参与**:样本少时向评估曲线靠拢(见 domain/knowledge),
 *     避免答了 3 个词就把整条曲线拽歪。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { thresholdOfWord } from '@/domain/difficulty';
import { VOCAB_BANDS } from '@/domain/wordlevel';

const REVIEW_STATS_KEY = 'readingapp.reviewstats.v1';

/** 每一档的复习战况 */
export interface BandReviewStat {
  /** 答"记得"的次数 */
  known: number;
  /** 总作答次数 */
  total: number;
}

export type ReviewStats = Record<number, BandReviewStat>;

/** 词 → 档位:取第一个不低于它门槛的档(与评估、难度计算同一套刻度) */
function bandOfThreshold(threshold: number): number {
  return VOCAB_BANDS.find((b) => threshold <= b) ?? VOCAB_BANDS[VOCAB_BANDS.length - 1];
}

/**
 * 进程内缓存:曲线是**同步**计算的(在 useMemo 里),不能每次都 await。
 * 启动时 hydrateReviewStats() 读一次,写入时同步更新这份缓存。
 */
let cache: ReviewStats = {};
let hydrated = false;

export function getReviewStatsSync(): ReviewStats {
  return cache;
}

export async function hydrateReviewStats(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(REVIEW_STATS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ReviewStats;
      if (parsed && typeof parsed === 'object') cache = parsed;
    }
  } catch {
    // 读失败就当没有:曲线退回只用评估数据
  }
  hydrated = true;
}

async function persist(): Promise<void> {
  try {
    await AsyncStorage.setItem(REVIEW_STATS_KEY, JSON.stringify(cache));
  } catch {
    // 写失败不影响本次复习
  }
}

/**
 * 记一笔复习结果。
 *
 * @param headword 词形
 * @param remembered 是否选了"记得"
 * @param undo 是否**撤销**一笔同类记录(用于详情页的「记错了,标为不记得」改判:
 *             先撤掉刚才那笔"记得",再记一笔"不记得",账才对得上)
 */
export async function recordReviewResult(
  headword: string,
  remembered: boolean,
  undo = false,
): Promise<void> {
  if (!hydrated) await hydrateReviewStats();
  const threshold = thresholdOfWord(headword);
  if (threshold == null) return; // 词典没收的词不参与校准(判断不了档位)

  const band = bandOfThreshold(threshold);
  const prev = cache[band] ?? { known: 0, total: 0 };
  const known = prev.known + (remembered ? (undo ? -1 : 1) : 0);
  const total = prev.total + (undo ? -1 : 1);

  if (total <= 0) {
    delete cache[band];
  } else {
    cache = { ...cache, [band]: { known: Math.max(0, known), total } };
  }
  await persist();
}

/** 是否已经读过一次(供调试面板展示) */
export function reviewStatsHydrated(): boolean {
  return hydrated;
}
