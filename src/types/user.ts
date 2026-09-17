/**
 * 用户水平 / 设置类型层。
 * UserLevel 由首次启动引导产生(或默认中级 B1),UserSettings 存可调偏好。
 */

import type { CefrLevel } from './article';

/**
 * 评估中的一轮结果(某一档位答了几个词、认识几个)。
 * 落盘用途:算置信区间与"分频段掌握曲线",这是量化画像的数据来源 ——
 * 只存 vocab 一个数的话,曲线和区间都无从还原。
 */
export interface AssessmentRound {
  threshold: number;
  total: number;
  known: number;
}

/**
 * 用户的当前英语水平。
 * vocab 为估计词汇量,主刻度(连续值);level 为对应 CEFR,只作为**参考层**;
 * 推荐与画像都以 vocab + rounds 算出的量化模型为准(见 src/domain/profile)。
 */
export interface UserLevel {
  /** 估计词汇量主值(如 4600)。缺失未知时允许只给 CEFR。 */
  vocab?: number;
  /** CEFR 等级(参考层,不再是主判据) */
  level: CefrLevel;
  /** 用户是否做过正式评估(首启引导里完成勾选/自选) */
  assessed: boolean;
  /** 评估/最近一次更新的时间戳(ms) */
  updatedAt: number;
  /** 各档作答明细;自选档位或旧数据可能缺失 */
  rounds?: AssessmentRound[];
  /** 总作答词数(用于二项误差估计) */
  answers?: number;
  /** 答"认识"的词数 */
  knownAnswers?: number;
  /** 评估模式:quick ≈ 15 词;fine ≈ 40 词(区间更窄) */
  mode?: 'quick' | 'fine';
}

/** 首页推荐时允许的文本语言偏好(wpm/阅读速度也放这附近) */
export type UiLanguage = 'zh' | 'en';

/**
 * 用户设置(混入学习偏好与界面偏好)。
 * 与 UserSettings 拆开:这里只放会持久化并影响多处逻辑的偏好。
 */
export interface UserSettings {
  /** UI 文案语言(先中文界面) */
  uiLanguage: UiLanguage;
  /** 阅读速度 wpm,用于分钟估算与统计 */
  readingWpm: number;
  /** 每日目标 */
  dailyGoal: {
    /** 每日待读篇数 */
    articles: number;
    /** 每日待复习词数 */
    reviewWords: number;
  };
  /** 阅读字号偏好(基准倍数,默认 1) */
  fontSizeScale: number;
  /** 是否开启重点词高亮 */
  highlightKeyWords: boolean;
  /** 词典服务开关(默认离线) */
  useOnlineLookup: boolean;
  /** 本地复习提醒开关(占位,true 表示期望提醒) */
  reviewReminderEnabled: boolean;
}
