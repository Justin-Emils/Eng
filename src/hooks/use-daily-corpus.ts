import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { hydrateRemoteArticles } from '@/data/articles/remote-registry';
import { probeSources, type SourceProbe } from '@/domain/corpus/sources';
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
 * - 手动立即更新;
 * - 测试各语料源连通性(手机上排查"抓不到文章"用)。
 */
export function useDailyCorpus() {
  const [remoteCount, setRemoteCount] = useState(0);
  const [updatedToday, setUpdatedToday] = useState(false);
  const [lastUpdate, setLastUpdate] = useState('');
  const [busy, setBusy] = useState(false);
  // 订阅全局状态(running/done/failed),驱动转圈与结果文案
  const [status, setStatus] = useState(() => getCorpusStatus());
  const [manualResult, setManualResult] = useState<string | null>(null);
  // 语料源探测结果
  const [probes, setProbes] = useState<SourceProbe[] | null>(null);
  const [probing, setProbing] = useState(false);

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
      const { count, note } = await runDailyCorpusUpdate();
      setCorpusDone(count, note);
      await refresh();
      setManualResult(`✓ 已入库 ${count} 篇(来源:${note})`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '更新失败';
      setCorpusFailed(msg);
      setManualResult(`✗ ${msg}`);
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  /** 测试各语料源(哪些通、耗时多少) */
  const testSources = useCallback(async (): Promise<void> => {
    setProbing(true);
    setProbes(null);
    try {
      setProbes(await probeSources());
    } catch {
      setProbes([]);
    } finally {
      setProbing(false);
    }
  }, []);

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
    probes,
    probing,
    testSources,
  };
}
