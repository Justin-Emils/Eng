import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { getCompletedArticleIds } from '@/storage/progress';

/**
 * 已完成(读完)文章 id 集合;页面每次聚焦刷新,
 * 用于文章卡/推荐卡展示「已读 ✓」。
 */
export function useCompletedArticleIds() {
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getCompletedArticleIds().then((ids) => {
        if (active) setCompletedIds(ids);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  return completedIds;
}
