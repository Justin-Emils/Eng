/**
 * 语料层统一入口。
 * - 内置语料(人工/Aesop/公版精选)经 buildArticle 构建;
 * - 远程自动更新文章(remote-registry)在运行时并入;
 * 页面/组件只通过这里读语料。
 */

import type { Article, CefrLevel } from '@/types';

import { ADVANCED_ARTICLES } from './advanced';
import { buildArticle } from './build';
import { CULTURE_LIFE_ARTICLES } from './culture-life';
import { KAOYAN_ARTICLES } from './kaoyan-readings';
import { KAOYAN_ARTICLES_2 } from './kaoyan-readings-2';
import { NEWS_SOCIAL_ARTICLES } from './news-social';
import { remoteArticles } from './remote-registry';
import { SCIENCE_ARTICLES } from './science-tech';
import { STORY_ARTICLES } from './stories';

const RAW_ARTICLES = [
  ...STORY_ARTICLES,
  ...SCIENCE_ARTICLES,
  ...CULTURE_LIFE_ARTICLES,
  ...NEWS_SOCIAL_ARTICLES,
  ...ADVANCED_ARTICLES,
  ...KAOYAN_ARTICLES,
  ...KAOYAN_ARTICLES_2,
];

/** 全部内置文章(已构建为完整 Article,含词数/分钟) */
export const ARTICLES: Article[] = RAW_ARTICLES.map(buildArticle);

const byId = new Map<string, Article>(ARTICLES.map((a) => [a.id, a]));

/** 按 id 取文章(内置优先;找不到再查远程自动更新文章) */
export function getArticleById(id: string): Article | undefined {
  return byId.get(id) ?? remoteArticles.find((a) => a.id === id);
}

/** 全部文章(内置 + 远程自动更新) */
export function getAllArticles(): Article[] {
  return [...ARTICLES, ...remoteArticles];
}

/** 按难度过滤;level 传 undefined 时返回全部 */
export function getArticlesByLevel(level?: CefrLevel): Article[] {
  if (!level) {
    return getAllArticles();
  }
  return getAllArticles().filter((a) => a.difficulty.level === level);
}
