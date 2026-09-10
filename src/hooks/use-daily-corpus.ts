import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { hydrateRemoteArticles } from '@/data/articles/remote-registry';
import { runDailyCorpusUpdate } from '@/domain/corpus/update';
import { isUpdatedToday, loadRemoteArticles } from '@/storage/remote-articles';
import {
  getCorpusStatus,
  setCorpusDone,
  setCorpusFailed,
  setCorpusRunning,
  subscribeCorpusStatus,
} from '@/domain/corpus/status';

/**
 * 「每日语料」状态 hook:
 * - 聚焦时刷新展示数据(篇数/今日更新状态);
 * - 订阅全局更新状态(running 时转圈);
 * - 手动立即更新。
 */
export function useDailyCorpus() {
  const [remoteCount, setRemoteCount] = useState(0);
  const [updatedToday, setUpdatedToday] = useState(false);
  const [lastUpdate, setLastUpdate] = useState('');
  const [busy, setBusy] = useState(false);
  // 订阅全局状态(running/done/failed),驱动转圈与结果文案
  const [status, setStatus] = useState(() => getCorpusStatus());
  const [manualResult, setManualResult] = useState<string | null>(null);

  useEffect(() => {
    return subscribeCorpusStatus(() => setStatus(getCorpusStatus()));
  }, []);

  const refresh = useCallback(async () => {
    const [shape, today] = await Promise.all([loadRemoteArticles(), isUpdatedToday()]);
    setRemoteCount(shape.articles.length);
    setUpdatedToday(today);
    setLastUpdate(shape.updatedDate);
    setManualResult(null);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh().catch(() => {});
    }, [refresh]),
  );

  /** 手动立即更新(成功后刷新计数并重水化) */
  const updateNow = useCallback(async (): Promise<void> => {
    setBusy(true);
    setManualResult(null);
    setCorpusRunning();
    try {
      const count = await runDailyCorpusUpdate();
      setCorpusDone(count);
      await refresh();
      setManualResult(`✓ 已入库 ${count} 篇`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '更新失败';
      setCorpusFailed(msg);
      setManualResult(`✗ ${msg}`);
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  return {
    remoteCount,
    updatedToday,
    lastUpdate,
    busy,
    status,
    manualResult,
    refresh,
    updateNow,
    hydrate: hydrateRemoteArticles,
  };
}
