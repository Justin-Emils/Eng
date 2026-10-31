/**
 * 统一的"清空学习数据"（P1-4）。
 *
 * 报告指出的缺陷:`clearWords()` 只删 `readingapp.words.v1`,而"这个词学过/已会"
 * 记录在另外两个 key(`learning` / `known`),复习校准在 `reviewstats`。
 * 于是"清空生词本"之后界面显示 0 个词,但正文里这些词**仍然是已学**、
 * 永远不会再被标蓝 —— 用户会以为标蓝坏了;隐私上也没删干净。
 */

import { clearLearning } from '@/storage/learning';
import { clearReviewStats } from '@/storage/review-stats';
import { clearWords } from '@/storage/words';

/** 生词 + 已学 + 已会 + 复习校准,一次性删干净 */
export async function clearAllLearningData(): Promise<void> {
  await Promise.all([clearWords(), clearLearning(), clearReviewStats()]);
}
