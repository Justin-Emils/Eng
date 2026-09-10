/**
 * 语料类型层:一篇文章在 App 内的完整描述。
 * 字段命名贯穿全 App(index/library/阅读页/生词本来源跳转),保持一致。
 */

/**
 * CEFR 语言等级刻度。
 * 作为文章难度与用户水平的公共语言,后续换算成词汇量/蓝思时用 src/domain/levels.ts(下一里程碑)。
 */
export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

/** 文章话题标签,用于文章库的分类与筛选。 */
export type TopicTag =
  | '科技'
  | '文化'
  | '生活'
  | '新闻'
  | '故事'
  | '科学'
  | '历史'
  | '社会'
  | '教育'
  | '经济'
  | '环境';

/**
 * 重点词标注(模块 C 自动标注 + 人工复核产物)。
 * 每篇约 8–15 个,附中文释义与一句英英解释,供阅读页高亮与词典卡使用。
 */
export interface KeyWord {
  /** 原文中的基础词形,如 "abandon" */
  headword: string;
  /** 词性缩写,如 "v." "n." "adj." */
  pos: string;
  /** 中文释义 */
  zh: string;
  /** 简单英英解释(便于英语学习语境) */
  en: string;
  /** 可选:例句,用来做额外上下文(未提供时阅读页可不展示) */
  example?: string;
}

/**
 * 一篇文章的难度描述(模块 B 三)。
 * 语料入库时必须带齐这些字段。
 */
export interface ArticleDifficulty {
  /** 主难度 CEFR */
  level: CefrLevel;
  /** 估计所需词汇量,如 4600 */
  vocab: number;
  /** 正文词数 */
  wordCount: number;
  /** 估算阅读分钟(按 120–180 wpm) */
  minutes: number;
}

/**
 * 一篇文章(语料)。
 */
export interface Article {
  /** 稳定 id,如 "aesop-tortoise-hare"。生词来源跳转会反查它。 */
  id: string;
  /** 标题 */
  title: string;
  /** 一句话摘要 */
  summary: string;
  /** 难度信息 */
  difficulty: ArticleDifficulty;
  /** 话题标签,至少一个 */
  topicTags: TopicTag[];
  /** 正文按段落组织的英文文本(完整语料,禁止占位假文本) */
  paragraphs: string[];
  /** 该篇的重点词预标注(可为空数组,后续里程碑由 wordmark 生成后人工复核填充) */
  keyWords: KeyWord[];
  /** 可选出处说明(公版/署名) */
  credit?: string;
  /** 可选配图 URL(远程自动更新文章用;来源需开放许可) */
  coverUrl?: string;
}
