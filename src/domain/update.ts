/**
 * 检查更新（C3）。
 *
 * 数据来源:GitHub Releases（仓库是公开的,不需要 token）。
 * 判定:远端最新 release 的版本号 **大于** 当前 App 版本时才算"有新版本" ——
 * 本地构建的版本号可能反而比线上 release 新（开发期很常见）,这种情况不提示。
 *
 * 三个刻意的设计:
 *  1. **节流**:启动时最多 6 小时查一次,省 GitHub 的匿名配额(每小时 60 次);
 *     手动点「检查更新」走 force,不受节流限制;
 *  2. **"本次更新前不再提示"**:记录被跳过的版本号,只有出现**更高**的版本才会再问;
 *  3. **失败静默**:查不到就是查不到,不弹错误打扰用户;手动检查时才把原因说出来。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { APP_VERSION, compareVersions } from '@/domain/app-version';
import { now } from '@/domain/clock';

const STATE_KEY = 'readingapp.update.v1';
/** 自动检查的最小间隔(6 小时) */
export const AUTO_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
/** 手动检查的最小间隔(60 秒):保护 GitHub 匿名配额(每小时 60 次,按 IP 共享) */
export const MANUAL_MIN_INTERVAL_MS = 60 * 1000;
const REPO = 'Justin-Emils/Eng';

interface UpdateState {
  /** 用户选择"本次更新前不再提示"的版本号 */
  skippedVersion: string;
  /** 上次检查时间(用校准后的时间,避免改系统时间反复触发) */
  lastCheckedAt: number;
}

const EMPTY_STATE: UpdateState = { skippedVersion: '', lastCheckedAt: 0 };

let state: UpdateState = EMPTY_STATE;
let hydrated = false;

export interface LatestRelease {
  version: string;
  title: string;
  /** 更新说明(已按行拆好) */
  notes: string[];
  /** 发布页(浏览器打开,GitHub Release 页面) */
  pageUrl: string;
  /** 直接下载地址(优先 APK 资源,没有就退回发布页) */
  downloadUrl: string;
  publishedAt: string;
}

export type UpdateStatus = 'available' | 'none' | 'throttled' | 'error';

export interface UpdateCheck {
  status: UpdateStatus;
  /** 当前 App 版本 */
  current: string;
  /** 远端最新 release(排队/失败时为空) */
  latest?: LatestRelease;
  /** 给用户看的说明 */
  message: string;
}

async function hydrate(): Promise<void> {
  if (hydrated) return;
  try {
    const raw = await AsyncStorage.getItem(STATE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<UpdateState>;
      state = {
        skippedVersion: typeof parsed.skippedVersion === 'string' ? parsed.skippedVersion : '',
        lastCheckedAt: typeof parsed.lastCheckedAt === 'number' ? parsed.lastCheckedAt : 0,
      };
    }
  } catch {
    // 读失败按"从未检查"处理
  }
  hydrated = true;
}

async function persist(patch: Partial<UpdateState>): Promise<void> {
  state = { ...state, ...patch };
  hydrated = true;
  try {
    await AsyncStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    // 忽略
  }
}

export function skippedVersion(): string {
  return state.skippedVersion;
}

/** 用户点了"本次更新前不再提示":记住这个版本 */
export async function skipVersion(version: string): Promise<void> {
  await hydrate();
  await persist({ skippedVersion: version });
}

interface RawAsset {
  name?: string;
  browser_download_url?: string;
}
interface RawRelease {
  tag_name?: string;
  name?: string;
  body?: string;
  html_url?: string;
  published_at?: string;
  draft?: boolean;
  prerelease?: boolean;
  assets?: RawAsset[];
}

/** 把 release body 的 markdown 拆成一行行要点(去掉标题、分隔线、多余空行) */
function toNotes(body: string | undefined, title: string): string[] {
  if (!body) return [];
  const lines = body
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*+]\s+/, '').replace(/^#+\s*/, '').trim())
    .filter((line) => line.length > 0 && !/^-{3,}$/.test(line));
  /**
   * 常见写法是第一行重复版本标题(「v1.1.0 · 在线账号与云同步」),
   * 而弹窗里已经单独显示了版本与标题 —— 不去掉会显得啰嗦。
   */
  if (lines.length > 0) {
    const head = lines[0].toLowerCase();
    const t = title.toLowerCase();
    if ((t && (head === t || t.includes(head) || head.includes(t))) || /^v?[\d.]+\s*[·:]/.test(lines[0])) {
      lines.shift();
    }
  }
  return lines.slice(0, 12);
}

async function fetchLatest(): Promise<LatestRelease | null> {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=10`, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) {
    /**
     * 把状态码翻译成人话。实测教训:匿名访问 api.github.com 每小时只有 60 次
     * (按 IP 共享,同一网络下所有设备共用),超了返回 403 —— 以前这里直接抛
     * "GitHub 返回 403",用户完全不知道该怎么办。
     */
    if (res.status === 403 || res.status === 429) {
      throw new Error('查询太频繁了(GitHub 限制每小时 60 次),请过一小时再试');
    }
    if (res.status === 404) {
      throw new Error('仓库不存在或还没有发布过版本');
    }
    throw new Error(`查询失败(GitHub 返回 ${res.status})`);
  }
  const list = (await res.json()) as RawRelease[];
  const candidates = (Array.isArray(list) ? list : [])
    .filter((r) => !r.draft && !r.prerelease && typeof r.tag_name === 'string')
    .map((r) => ({ ...r, version: (r.tag_name ?? '').replace(/^v/i, '') }))
    .filter((r) => r.version.length > 0)
    .sort((a, b) => compareVersions(b.version, a.version));
  const top = candidates[0];
  if (!top) return null;

  const apk = (top.assets ?? []).find((a) => (a.name ?? '').toLowerCase().endsWith('.apk'));
  const title =
    (top.name ?? '').replace(/^v?[\d.]+\s*[·:]?\s*/, '') || `v${top.version}`;
  return {
    version: top.version,
    title,
    notes: toNotes(top.body, title),
    pageUrl: top.html_url ?? `https://github.com/${REPO}/releases`,
    downloadUrl:
      apk?.browser_download_url ?? top.html_url ?? `https://github.com/${REPO}/releases`,
    publishedAt: top.published_at ?? '',
  };
}

/**
 * 检查更新。
 * @param options.force 跳过 6 小时节流(用户手动点「检查更新」时用)
 */
export async function checkForUpdate(options: { force?: boolean } = {}): Promise<UpdateCheck> {
  await hydrate();
  const current = APP_VERSION;

  if (!options.force && state.lastCheckedAt > 0 && now() - state.lastCheckedAt < AUTO_CHECK_INTERVAL_MS) {
    return { status: 'throttled', current, message: '刚检查过,稍后再试' };
  }
  // 手动检查也节流:保护共享配额,并且能立刻告诉用户"其实刚查过"
  if (options.force && state.lastCheckedAt > 0 && now() - state.lastCheckedAt < MANUAL_MIN_INTERVAL_MS) {
    return { status: 'throttled', current, message: '刚检查过,约一分钟后再试' };
  }

  try {
    const latest = await fetchLatest();
    await persist({ lastCheckedAt: now() });
    if (!latest) {
      return { status: 'none', current, message: '还没有发布过版本' };
    }
    if (compareVersions(latest.version, current) <= 0) {
      return {
        status: 'none',
        current,
        latest,
        message: `已是最新版本(${current})`,
      };
    }
    if (latest.version === state.skippedVersion && !options.force) {
      return {
        status: 'none',
        current,
        latest,
        message: `新版本 v${latest.version} 已被你跳过`,
      };
    }
    return {
      status: 'available',
      current,
      latest,
      message: `发现新版本 v${latest.version}`,
    };
  } catch (e) {
    return {
      status: 'error',
      current,
      message: e instanceof Error ? e.message : '检查失败,请稍后再试',
    };
  }
}
