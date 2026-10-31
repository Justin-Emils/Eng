/**
 * 带超时的 fetch（P1-10）。
 *
 * 报告指出的问题:`sync.ts` 的 `rest()` 与 `update.ts` 的 `fetchLatest()` 都直接 `fetch`，
 * 没有 AbortController —— 弱网/运营商劫持 TCP 不返回时，"登录中…"永远不结束，
 * 启动遮罩也可能永远不消失（auth/api.ts 本来就设了 15 秒超时，这两处漏了）。
 *
 * 现在所有网络出口都走这里；超时会抛出一个带可读文案的错误。
 */

export class TimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`请求超时(${Math.round(timeoutMs / 1000)} 秒),请检查网络后重试`);
    this.name = 'TimeoutError';
  }
}

export interface FetchWithTimeoutInit extends RequestInit {
  timeoutMs?: number;
  /** 外部取消信号（可选）：与超时信号合并 */
  signal?: AbortSignal;
}

export async function fetchWithTimeout(
  url: string,
  init: FetchWithTimeoutInit = {},
): Promise<Response> {
  const { timeoutMs = 10_000, signal, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onExternalAbort = () => controller.abort();
  signal?.addEventListener('abort', onExternalAbort);
  try {
    return await fetch(url, { ...rest, signal: controller.signal });
  } catch (e) {
    if (controller.signal.aborted && !signal?.aborted) throw new TimeoutError(timeoutMs);
    throw e;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onExternalAbort);
  }
}
