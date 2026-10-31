/**
 * 云端服务可用性探测。
 *
 * 为什么单独做:登录页拿到「网络连接失败」时,用户无法区分
 *   · 自己的网不好;
 *   · 云端项目被暂停 / 删除(域名都已经不存在了)。
 * 提前探一次就能把话说清楚,并且明确告诉用户「离线仍可用」。
 */

import { AUTH_BASE, SUPABASE_KEY, isBackendConfigured } from '@/config/backend';

export type BackendState = 'ok' | 'unreachable' | 'unconfigured';

export interface BackendProbe {
  state: BackendState;
  detail: string;
}

export async function probeBackend(timeoutMs = 6000): Promise<BackendProbe> {
  if (!isBackendConfigured) {
    return { state: 'unconfigured', detail: '还没有配置云端地址' };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${AUTH_BASE}/health`, {
      headers: { apikey: SUPABASE_KEY },
      signal: controller.signal,
    });
    if (res.ok) return { state: 'ok', detail: '云端服务正常' };
    // 有响应但状态码不对:服务在,但配置/权限有问题
    return { state: 'unreachable', detail: `云端服务返回 ${res.status}` };
  } catch {
    return {
      state: 'unreachable',
      detail: '连不上云端服务(域名无法解析或网络异常)',
    };
  } finally {
    clearTimeout(timer);
  }
}
