/**
 * 间隔重复调度器(模块 E)——SM-2 简化版。
 * 纯函数,不依赖 UI/存储,便于单元验证。
 *
 * 规则(按需求):
 * - 间隔序列 interval = 1,2,4,7,15,30…(天),按"连续记得次数 reps"推进;
 * - 反馈:ease 初始 2.5,随「记得/模糊/忘记」调整(范围 1.3–3.0);
 * - 忘记(again)→ lapses+1,reps 清零,词回到 learning 并很快再出现;
 * - 连续记得足够次数 → status 变 mastered(不再频繁出现,但不删除)。
 */

import type { ReviewGrade, ReviewState, WordItem, WordStatus } from '@/types';

export const DAY_MS = 24 * 60 * 60 * 1000;
/** 忘记后多久再出现(演示用 10 分钟;正式可改 1 小时) */
export const AGAIN_REVIEW_DELAY_MS = 10 * 60 * 1000;
/** 连续"记得"(good/easy)达到该次数视为掌握 */
export const MASTER_THRESHOLD = 5;

/** 间隔天数序列(按 reps 推进):第 n 次记住后的下次间隔 */
const INTERVAL_DAYS = [1, 2, 4, 7, 15, 30, 60];

/** 反馈 → ease 增量 */
const EASE_DELTA: Record<ReviewGrade, number> = {
  again: -0.2,
  hard: -0.1,
  good: 0,
  easy: 0.15,
};

export interface ScheduleUpdate {
  status: WordStatus;
  review: ReviewState;
}

function clampEase(ease: number): number {
  return Math.min(3.0, Math.max(1.3, ease));
}

/**
 * 根据一次复习反馈计算新的状态与调度。
 * @param word 当前词条(读 review/status)
 * @param grade 用户自评
 * @param now 时间戳
 */
export function scheduleReview(word: WordItem, grade: ReviewGrade, now = Date.now()): ScheduleUpdate {
  const prev = word.review;
  const ease = clampEase(prev.ease + EASE_DELTA[grade]);

  if (grade === 'again') {
    return {
      status: 'learning',
      review: {
        dueAt: now + AGAIN_REVIEW_DELAY_MS,
        ease,
        interval: 1,
        reps: 0,
        lapses: prev.lapses + 1,
      },
    };
  }

  // good / hard / easy 都算"记住"(hard 间隔退一档)
  const reps = prev.reps + 1;
  const intervalDays = (() => {
    if (grade === 'hard') {
      // 模糊:回到上一档(至少 1 天)
      const prevSlot = Math.max(0, INTERVAL_DAYS.indexOf(prev.interval));
      return Math.max(1, INTERVAL_DAYS[Math.max(0, prevSlot - 1)] ?? 1);
    }
    const slot = Math.min(INTERVAL_DAYS.length - 1, reps - 1);
    return INTERVAL_DAYS[slot];
  })();

  const mastered = reps >= MASTER_THRESHOLD;

  return {
    status: mastered ? 'mastered' : 'learning',
    review: {
      dueAt: now + intervalDays * DAY_MS,
      ease,
      interval: intervalDays,
      reps,
      lapses: prev.lapses,
    },
  };
}

/**
 * 判断一个词现在是否"到期可复习"。
 * mastered/ignored 默认不进入常规复习队列。
 */
export function isDue(word: WordItem, now = Date.now()): boolean {
  if (word.status === 'mastered' || word.status === 'ignored') return false;
  return word.review.dueAt <= now;
}

/**
 * 复习会话结束时的小结输入。
 */
export interface SessionSummary {
  total: number;
  remembered: number; // good/easy 次数
  fuzzy: number; // hard 次数
  forgotten: number; // again 次数
  masteredNew: number;
}

/** 由一次会话内的反馈序列汇总出总结 */
export function summarizeGrades(grades: ReviewGrade[]): SessionSummary {
  let remembered = 0;
  let fuzzy = 0;
  let forgotten = 0;
  for (const g of grades) {
    if (g === 'again') forgotten += 1;
    else if (g === 'hard') fuzzy += 1;
    else remembered += 1;
  }
  return {
    total: grades.length,
    remembered,
    fuzzy,
    forgotten,
    masteredNew: 0,
  };
}
