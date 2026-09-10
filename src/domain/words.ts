/**
 * 生词条目工厂与调度初始化(模块 E)。
 * WordItem 创建时给出默认间隔重复状态。新收藏的词立即可复习(dueAt = now)。
 */

import type { ReviewState, WordItem, WordStatus } from '@/types';

/** 初始复习状态:加入即到期,立即可复习 */
export function initialReviewState(now = Date.now()): ReviewState {
  return {
    dueAt: now,
    ease: 2.5,
    interval: 1,
    reps: 0,
    lapses: 0,
  };
}

export interface NewWordInput {
  word: string;
  headword: string;
  phonetic?: string;
  pos: string;
  zh: string;
  en: string;
  example?: string;
  sourceArticleId: string;
  sourceSentence?: string;
}

/** 用 headword 生成稳定 id(同词同源去重),统一小写 */
export function makeWordId(headword: string, sourceArticleId: string): string {
  return `${headword.toLowerCase()}::${sourceArticleId}`;
}

/** 构建一个新的 WordItem(状态 new) */
export function makeWordItem(input: NewWordInput, now = Date.now()): WordItem {
  return {
    id: makeWordId(input.headword, input.sourceArticleId),
    word: input.word,
    headword: input.headword.toLowerCase(),
    phonetic: input.phonetic,
    pos: input.pos,
    zh: input.zh,
    en: input.en,
    example: input.example,
    sourceArticleId: input.sourceArticleId,
    sourceSentence: input.sourceSentence,
    addedAt: now,
    status: 'new' as WordStatus,
    review: initialReviewState(now),
  };
}
