/**
 * 生词本 / 间隔复习类型层(模块 E)。
 * WordItem 描述一个被收藏的单词,含出处与 SM-2 简化的复习调度字段。
 * 调度纯函数在 src/domain/srs.ts(下一里程碑),这里的类型只定义数据形状。
 */

/** 单词掌握状态 */
export type WordStatus = 'new' | 'learning' | 'mastered' | 'ignored';

/** 一次复习反馈(自评) */
export type ReviewGrade = 'again' | 'hard' | 'good' | 'easy';
// again=忘记/不认识  hard=模糊  good=记得  easy=很熟(可选细粒度)

/**
 * 间隔重复调度数据(SM-2 简化)。
 * - dueAt:下次到期复习时间戳(ms)
 * - ease:易度因子(初始 2.5,随反馈升降)
 * - interval:当前间隔天数(初始 1)
 * - reps:连续"记得"的次数
 * - lapses:忘记次数(被打断的记忆次数)
 */
export interface ReviewState {
  dueAt: number;
  ease: number;
  interval: number;
  reps: number;
  lapses: number;
}

/**
 * 生词本条目。
 */
export interface WordItem {
  /** 唯一标识(用 headword + sourceArticleId 组合去重,写入存储时给稳定 id) */
  id: string;
  /** 词形(原文命中的形态,如 "ran") */
  word: string;
  /** 词形还原后的 headword(用于查词典/归并,如 "run") */
  headword: string;
  /** 音标(可选) */
  phonetic?: string;
  /** 词性缩写 */
  pos: string;
  /** 中文释义 */
  zh: string;
  /** 英英释义 */
  en: string;
  /** 例句 */
  example?: string;
  /** 来源文章 id */
  sourceArticleId: string;
  /** 来源句(用于深链高亮回到原文) */
  sourceSentence?: string;
  /** 加入时间戳(ms) */
  addedAt: number;
  /** 掌握状态 */
  status: WordStatus;
  /** 复习调度 */
  review: ReviewState;
  /** 用户自填备注 */
  note?: string;
}
