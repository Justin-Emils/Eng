/**
 * 阅读进度类型层:用于续读与打卡统计(模块 D / G)。
 * 记录用户读到哪段哪句,回到文章时恢复到该位置并可标为"已读完"。
 */

/**
 * 一篇的阅读进度记录。
 * 用 articleId 作主键,缓存最近一次阅读位置。
 */
export interface ReadingProgress {
  /** 文章 id */
  articleId: string;
  /** 最后读到的段落索引(含) */
  paragraphIndex: number;
  /** 最后读到的句子索引(含,段内) */
  sentenceIndex?: number;
  /** 是否已通读完毕(触发过一次打卡) */
  completed: boolean;
  /** 最后阅读时间戳(ms) */
  updatedAt: number;
  /** 累计阅读秒数(模块 G 统计) */
  readSeconds: number;
}
