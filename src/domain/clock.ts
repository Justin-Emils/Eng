/**
 * 网络时间(服务器时间)。
 *
 * 为什么不能直接用系统时间:打卡、连续天数、复习到期这些都建立在"今天是哪天"上,
 * 而系统时间**用户可以随手改** —— 改一下日期就能刷出连续打卡,复习计划也会乱掉。
 * 所以时间的权威来源是**网络**:
 *
 *   1. 校准:向 Supabase 发一个不需要登录的探针请求(`/auth/v1/health`),
 *      从响应的 `Date` 头拿到服务器时间;用往返时延的一半补偿传输耗时;
 *      得到的是**偏移量** offset = 服务器时间 - 本机时间,而不是绝对时间 ——
 *      这样即使断网,也能用"上次校准的偏移 + 本机时钟"继续算,且不会跳变;
 *   2. 缓存:偏移量写入本地,启动时水化(见 hydrateClock);
 *   3. 刷新:启动后校准一次;回到前台且距上次校准超过 CLOCK_MAX_AGE_MS 时再校一次。
 *
 * 离线时的态度要诚实:能用上次校准的偏移就用,但**不会假装时间已校准**
 * (clockVerified() 会如实回答),需要展示"时间来源"的地方可以据此说明。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { REST_BASE, SUPABASE_KEY } from '@/config/backend';

const OFFSET_KEY = 'readingapp.clockoffset.v1';

/** 距上次校准超过这个时长,回到前台就再校一次(6 小时) */
export const CLOCK_MAX_AGE_MS = 6 * 60 * 60 * 1000;

/** 服务器时间 - 本机时间 */
let offsetMs = 0;
/** 上次成功校准的**本机**时刻(用于判断新旧;0 表示从未校准) */
let verifiedAtDevice = 0;
let hydrated = false;

/** 当前时间(已按最近一次校准的偏移修正) */
export function now(): number {
  return Date.now() + offsetMs;
}

/** 当前时间的 Date 对象 */
export function nowDate(): Date {
  return new Date(now());
}

export function clockOffsetMs(): number {
  return offsetMs;
}

export function clockVerifiedAt(): number {
  return verifiedAtDevice;
}

/** 是否已校准过(不代表此刻在线,只代表历史上校准成功过) */
export function clockVerified(): boolean {
  return verifiedAtDevice > 0;
}

export function clockHydrated(): boolean {
  return hydrated;
}

/**
 * 今天的日期键(YYYY-MM-DD)—— 基于**校准后的时间**。
 * 放在这里而不是各存储模块里,是为了让"今天"只有一个定义。
 */
export function todayKey(date: Date = nowDate()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function hydrateClock(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(OFFSET_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { offsetMs?: number; verifiedAtDevice?: number };
      if (typeof parsed.offsetMs === 'number' && Number.isFinite(parsed.offsetMs)) {
        // 偏移量大得离谱(超过 30 天)说明数据坏了,宁可不用
        if (Math.abs(parsed.offsetMs) < 30 * 24 * 60 * 60 * 1000) {
          offsetMs = parsed.offsetMs;
          verifiedAtDevice = typeof parsed.verifiedAtDevice === 'number' ? parsed.verifiedAtDevice : 0;
        }
      }
    }
  } catch {
    // 读失败就用本机时间
  }
  hydrated = true;
}

export interface ClockSyncResult {
  ok: boolean;
  /** 本次算出的偏移量(ms) */
  offsetMs: number;
  /** 探测到的服务器时间(可读) */
  serverTime: string;
  /** 失败原因 */
  error: string;
}

/**
 * 联网校准一次。失败不抛异常(调用方多半是启动流程或后台触发),
 * 失败时保持原有偏移量不变。
 */
export async function syncClock(): Promise<ClockSyncResult> {
  const t0 = Date.now();
  try {
    const res = await fetch(`${REST_BASE}/auth/v1/health`, {
      method: 'GET',
      headers: { apikey: SUPABASE_KEY },
    });
    const t1 = Date.now();
    const header = res.headers.get('date');
    if (!header) {
      return { ok: false, offsetMs, serverTime: '', error: '服务器未返回 Date 头' };
    }
    const serverMs = Date.parse(header);
    if (!Number.isFinite(serverMs)) {
      return { ok: false, offsetMs, serverTime: '', error: 'Date 头无法解析' };
    }
    // 服务器在 t0 与 t1 之间给了时间:按往返时延的一半补偿
    const rtt = t1 - t0;
    const estimatedServerAtT1 = serverMs + rtt / 2;
    const next = Math.round(estimatedServerAtT1 - t1);

    offsetMs = next;
    verifiedAtDevice = Date.now();
    hydrated = true;
    try {
      await AsyncStorage.setItem(
        OFFSET_KEY,
        JSON.stringify({ offsetMs, verifiedAtDevice }),
      );
    } catch {
      // 写失败:本次仍按内存里的偏移用
    }
    return {
      ok: true,
      offsetMs,
      serverTime: new Date(serverMs).toISOString(),
      error: '',
    };
  } catch (e) {
    return { ok: false, offsetMs, serverTime: '', error: e instanceof Error ? e.message : '校准失败' };
  }
}

/**
 * 需要时校准(启动 / 回到前台调用):距上次成功校准超过 CLOCK_MAX_AGE_MS 才真的发请求。
 * @returns 本次是否发起了校准
 */
export async function ensureFreshClock(): Promise<boolean> {
  if (verifiedAtDevice > 0 && Date.now() - verifiedAtDevice < CLOCK_MAX_AGE_MS) return false;
  await syncClock();
  return true;
}

/** 给界面用的一句话(账号页 / 设置页展示"时间来源") */
export function describeClock(): string {
  if (!clockVerified()) return '尚未联网校准,暂用本机时间';
  const age = Date.now() - verifiedAtDevice;
  const drift = Math.abs(offsetMs);
  const driftText =
    drift < 60_000
      ? '与本机时间一致'
      : `本机时间${offsetMs > 0 ? '慢' : '快'}约 ${Math.round(drift / 1000)} 秒`;
  const ageText =
    age < 60_000
      ? '刚刚校准'
      : age < 3_600_000
        ? `${Math.floor(age / 60_000)} 分钟前校准`
        : `${Math.floor(age / 3_600_000)} 小时前校准`;
  return `${ageText} · ${driftText}`;
}
