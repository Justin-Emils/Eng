import { useCallback, useEffect, useState } from 'react';

import type { NewWordInput } from '@/domain/words';
import { isWordSaved, toggleWordSave } from '@/storage/words';

/**
 * 生词收藏状态 hook(词典卡 / 词条详情页共用)。
 * headword 变化时自动查询收藏态;toggle() 切换收藏并返回最新状态。
 */
export function useWordSaved(headword: string | undefined) {
  const [saved, setSaved] = useState(false);

  // 所有 setState 都放在 Promise 回调里(React Compiler 禁止 effect 内同步 setState)
  useEffect(() => {
    let active = true;
    const key = headword?.toLowerCase();
    const query = key ? isWordSaved(key) : Promise.resolve(false);
    query.then((v) => {
      if (active) setSaved(v);
    });
    return () => {
      active = false;
    };
  }, [headword]);

  const toggle = useCallback(async (input: NewWordInput): Promise<boolean> => {
    const next = await toggleWordSave(input);
    setSaved(next);
    return next;
  }, []);

  return { saved, toggle };
}
