/**
 * 远程文章内存注册表。
 * App 启动/更新后把存储中的远程文章装入此数组,
 * 现有查询(getAllArticles/getArticleById)会合并它们。
 */

import { loadRemoteArticles } from '@/storage/remote-articles';
import type { Article } from '@/types';

/** 远程(自动更新)文章,内存驻留 */
export const remoteArticles: Article[] = [];

/** 从存储水化注册表(启动/更新后调用) */
export async function hydrateRemoteArticles(): Promise<void> {
  const { articles } = await loadRemoteArticles();
  remoteArticles.length = 0;
  remoteArticles.push(...articles);
}
