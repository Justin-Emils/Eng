/**
 * 每日语料更新的全局状态(供 UI 订阅显示:转圈/成功/失败)。
 * 模块级单例 + 订阅:任意页面可读取/订阅,更新服务写入。
 */

export type CorpusStatusKind = 'idle' | 'running' | 'done' | 'failed' | 'noop';

export interface CorpusStatus {
  kind: CorpusStatusKind;
  /** done 时的篇数;failed 时错误信息 */
  detail: string;
  updatedAt: number;
}

const DEFAULT_STATUS: CorpusStatus = { kind: 'idle', detail: '', updatedAt: 0 };

let status: CorpusStatus = DEFAULT_STATUS;
const listeners = new Set<() => void>();

export function getCorpusStatus(): CorpusStatus {
  return status;
}

export function subscribeCorpusStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function setStatus(next: CorpusStatus) {
  status = next;
  listeners.forEach((l) => l());
}

export function setCorpusRunning() {
  setStatus({ kind: 'running', detail: '正在抓取公版短文并切分入库…', updatedAt: Date.now() });
}

export function setCorpusDone(count: number) {
  setStatus({ kind: 'done', detail: `已入库 ${count} 篇`, updatedAt: Date.now() });
}

export function setCorpusNoop() {
  setStatus({ kind: 'noop', detail: '今日已更新', updatedAt: Date.now() });
}

export function setCorpusFailed(message: string) {
  setStatus({ kind: 'failed', detail: message || '更新失败,请检查网络后重试', updatedAt: Date.now() });
}

export function resetCorpusStatus() {
  status = DEFAULT_STATUS;
  listeners.forEach((l) => l());
}
