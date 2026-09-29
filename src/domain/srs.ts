/**
 * 间隔重复调度器(模块 E)——SM-2 简化版。
 * 纯函数,不依赖 UI/存储,便于单元验证。
 *
 * 规则(按需求):
 * - 间隔序列 interval = 1,2,4,7,15,30…(天),按"连续记得次数 reps"推进;
 * - 反馈:ease 初始 2.5,随「记得/模糊/忘记」调整(范围 1.3–3.0);
 * - 忘记(again)→ lapses+1,reps 清零,词回到 learning 并很快再出现;
 * - 连续记得足够次数 → status 变 mastered(不再频繁出现,但不删除)。
 *
 * A1/A2 补充:复习页只有「记得 / 不记得」两键,但两者必须产生**不同且可见**的结果 ——
 *   · 记得   → reps+1,间隔沿 1/2/4/7/15… 阶梯推进,满 MASTER_THRESHOLD 次转「已巩固」;
 *   · 不记得 → reps 清零、lapses+1,10 分钟后重新到期并回到当天队列(当场再考一次)。
 * 结果用 readOutcome() 描述,界面直接照着说,避免"两个按钮看起来做了同一件事"。
 * 生词在 SRS 里的三种阶段(待复习 / 复习中 / 已巩固)由 stageOf() 统一推导,
 * 生词本、首页、复习页共用同一套说法。
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

// ─────────────────────────── 阶段与结果(界面共用的说法) ───────────────────────────

/**
 * 生词在 SRS 里的**阶段**(A2)。
 *
 * 三个阶段由现有字段**推导**,不新增持久化字段 —— 老数据不需要迁移:
 *   · pending      待复习:一次都没答对过(status 为 new,或上次答错被重置成 0 次);
 *   · reviewing    复习中:至少答对过一次,还在 1/2/4/7/15… 的间隔阶梯上;
 *   · consolidated 已巩固:连续答对满 MASTER_THRESHOLD 次,退出常规复习队列。
 *
 * 为什么不加一个新的 WordStatus 枚举值:status 是**持久化**字段,
 * 加值意味着要迁移 storage 里的全部生词,还会牵连 isDue / 各种 filter;
 * 而这三个阶段的全部信息在 status + review.reps 里已经齐了,直接推导更安全。
 */
export type WordStage = 'pending' | 'reviewing' | 'consolidated';

/** 判断一个词当前处于哪个阶段 */
export function stageOf(word: WordItem): WordStage {
  // ignored = 用户标记"我已会",与 mastered 一样退出学习队列
  if (word.status === 'mastered' || word.status === 'ignored') return 'consolidated';
  return word.review.reps > 0 ? 'reviewing' : 'pending';
}

/** 阶段的中文名(生词本徽章、首页说明共用,只此一份) */
export const WORD_STAGE_LABEL: Record<WordStage, string> = {
  pending: '待复习',
  reviewing: '复习中',
  consolidated: '已巩固',
};

/** 阶段说明:徽章旁边要有一句话解释差别,否则用户只能猜(见反馈 D) */
export const WORD_STAGE_HINT: Record<WordStage, string> = {
  pending: '还没答对过,或上次选「不认识」后等级被重置',
  reviewing: '已答对过,正在按 1/2/4/7… 天的间隔推进',
  consolidated: `连续答对 ${MASTER_THRESHOLD} 次,已退出常规复习队列`,
};

/** 一次复习对某个词产生的**实际结果**(给界面展示,不是调度数据) */
export interface ReviewOutcome {
  /** 本次之后的状态 */
  status: WordStatus;
  /** 本次之后所处阶段 */
  stage: WordStage;
  /** 本次之后的连续答对次数 */
  reps: number;
  /** 还要连续答对几次才到「已巩固」(0 表示已巩固) */
  toMastery: number;
  /** 下次到期时间戳(ms) */
  dueAt: number;
  /** 下次复习间隔天数(again 时为 0,因为改成了分钟级) */
  intervalDays: number;
  /** 本次是否刚刚转为「已巩固」 */
  justMastered: boolean;
  /** 本次是否把等级重置了(选了「不认识」) */
  reset: boolean;
}

/**
 * 从一次调度的结果里读出"这次复习发生了什么"。
 * 和 scheduleReview 分开:前者算调度,后者只翻译成人能看懂的结果,便于界面直接引用。
 */
export function readOutcome(prev: WordItem, grade: ReviewGrade, next: ScheduleUpdate): ReviewOutcome {
  const after: WordItem = { ...prev, status: next.status, review: next.review };
  const reset = grade === 'again';
  return {
    status: next.status,
    stage: stageOf(after),
    reps: next.review.reps,
    toMastery: Math.max(0, MASTER_THRESHOLD - next.review.reps),
    dueAt: next.review.dueAt,
    intervalDays: reset ? 0 : next.review.interval,
    justMastered: next.status === 'mastered' && prev.status !== 'mastered',
    reset,
  };
}

/**
 * 距下次到期还有多久,用人话表述。
 * 复习详情页与生词本共用,避免两处各写一套时间格式(会不一致)。
 */
export function describeDue(dueAt: number, now = Date.now()): string {
  const diff = dueAt - now;
  if (diff <= 0) return '现在';
  const minutes = Math.round(diff / 60000);
  if (minutes < 60) return `${Math.max(1, minutes)} 分钟后`;
  const hours = Math.round(minutes / 60);
  if (hours < 36) return `${hours} 小时后`;
  return `${Math.round(hours / 24)} 天后`;
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
