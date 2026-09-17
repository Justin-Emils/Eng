/**
 * 云端同步(模块 G):把本机学习数据与账号资料放进 Supabase。
 *
 * 同步的东西就是「导出备份」那一份 JSON —— 和剪贴板备份用**同一套 key 白名单**,
 * 这样"云同步"和"手动备份"永远是同一份数据的两种搬运方式,不会出现两套逻辑打架。
 *
 * 全部操作都是显式的(上传 / 恢复按钮),不做后台偷偷上传:
 * 自用 App 里,用户知道数据什么时候离开手机比"自动"更重要。
 */

import { REST_BASE, SUPABASE_KEY } from '@/config/backend';
import { AuthError } from '@/domain/auth/api';
import { ensureAccessToken, getAuthState } from '@/domain/auth/store';
import { exportBackup, importBackup } from '@/domain/backup';
import { DEFAULT_AVATAR, getAccount, saveAccount } from '@/storage/account';

export interface RemoteBackup {
  /** 备份 JSON 原文(可直接交给 importBackup) */
  raw: string;
  updatedAt: string;
  device: string;
  /** 备份里的生词数量,用于 UI 展示对比 */
  wordCount: number;
}

interface RawRow {
  payload?: unknown;
  updated_at?: string;
  device?: string | null;
}

/** 当前登录用户 id;未登录直接抛错(调用方负责 catch 后提示) */
function currentUserId(): string {
  const session = getAuthState().session;
  if (!session) throw new AuthError('还没有登录', 'not_signed_in');
  return session.user.id;
}

/** PostgREST 错误 → 中文提示(尤其把"表没建"这类配置问题说清楚) */
function translateRestError(status: number, body: unknown): Error {
  const raw = (body ?? {}) as Record<string, unknown>;
  const code = typeof raw.code === 'string' ? raw.code : '';
  const message = typeof raw.message === 'string' ? raw.message : '';

  if (code === 'PGRST205' || /could not find the table/i.test(message)) {
    return new Error('云端还没建表:请在 Supabase 的 SQL Editor 里执行 supabase/schema.sql');
  }
  if (status === 401 || status === 403 || code === '42501') {
    return new Error('没有权限访问云端数据,请重新登录');
  }
  if (status === 404) return new Error('云端接口不存在,请检查后端地址配置');
  if (status === 429) return new Error('请求太频繁,请稍后再试');
  if (status >= 500) return new Error('云端服务暂时不可用,请稍后重试');
  return new Error(message || `云端请求失败(${status})`);
}

async function rest<T>(
  path: string,
  options: { method?: string; body?: unknown; prefer?: string } = {},
): Promise<T | null> {
  const token = await ensureAccessToken();
  const { method = 'GET', body, prefer } = options;

  let response: Response;
  try {
    response = await fetch(`${REST_BASE}${path}`, {
      method,
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(prefer ? { Prefer: prefer } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error('网络连接失败,请检查网络后重试');
  }

  const text = await response.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }

  if (!response.ok) throw translateRestError(response.status, parsed);
  return (parsed ?? null) as T | null;
}

/** 从备份 JSON 里数一下生词数量(用于 UI 上"云端 128 个词 · 本机 130 个词"这类对比) */
function countWords(raw: string): number {
  try {
    const parsed = JSON.parse(raw) as { data?: Record<string, string> };
    const words = parsed.data?.['readingapp.words.v1'];
    if (!words) return 0;
    const list = JSON.parse(words) as unknown;
    return Array.isArray(list) ? list.length : 0;
  } catch {
    return 0;
  }
}

/** 把本机数据整份上传(已存在则覆盖) */
export async function pushBackup(): Promise<void> {
  const userId = currentUserId();
  const raw = await exportBackup();
  await rest('/backups', {
    method: 'POST',
    // 表主键是 user_id:冲突时合并覆盖,即 upsert,不必先查再决定插还是改
    prefer: 'resolution=merge-duplicates,return=minimal',
    body: {
      user_id: userId,
      payload: JSON.parse(raw) as Record<string, unknown>,
      schema_version: 1,
      device: 'android',
    },
  });
}

/** 读取云端备份(没有则返回 null) */
export async function pullBackup(): Promise<RemoteBackup | null> {
  const userId = currentUserId();
  const rows = await rest<RawRow[]>(
    `/backups?select=payload,updated_at,device&user_id=eq.${userId}`,
    { method: 'GET' },
  );
  const row = Array.isArray(rows) ? rows[0] : undefined;
  if (!row?.payload) return null;

  const raw = JSON.stringify(row.payload);
  return {
    raw,
    updatedAt: row.updated_at ?? '',
    device: row.device ?? '',
    wordCount: countWords(raw),
  };
}

/** 用云端备份覆盖本机(返回写入的键数量) */
export async function restoreFromCloud(backup: RemoteBackup): Promise<number> {
  return importBackup(backup.raw);
}

/** 上传昵称 / 头像(登录后个人资料也进云端,换手机才带得走) */
export async function pushProfile(patch: { nickname?: string; avatar?: string }): Promise<void> {
  const userId = currentUserId();
  const body: Record<string, unknown> = { id: userId };
  if (patch.nickname !== undefined) body.nickname = patch.nickname;
  // 相册选的本地文件路径在别的手机上无效,只同步 emoji 头像
  if (patch.avatar !== undefined && !patch.avatar.startsWith('file:')) body.avatar = patch.avatar;

  await rest('/profiles', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=minimal',
    body,
  });
}

/**
 * 登录成功后调用:把云端资料补到本机。
 * 原则是"本机已有的优先" —— 用户在这台手机上设过昵称/头像就不覆盖,
 * 只有本机还是空/默认值时才用云端资料填上(典型场景:换了新手机第一次登录)。
 */
export async function mergeProfileFromCloud(): Promise<void> {
  const remote = await pullProfile();
  if (!remote) return;

  const local = await getAccount();
  const patch: { nickname?: string; avatar?: string } = {};
  if (!local.nickname && remote.nickname) patch.nickname = remote.nickname;
  if (local.avatar === DEFAULT_AVATAR && remote.avatar && !remote.avatar.startsWith('file:')) {
    patch.avatar = remote.avatar;
  }
  if (Object.keys(patch).length > 0) await saveAccount(patch);
}

/** 读取云端昵称 / 头像(没有则返回 null) */
export async function pullProfile(): Promise<{ nickname: string; avatar: string } | null> {
  const userId = currentUserId();
  const rows = await rest<{ nickname?: string; avatar?: string }[]>(
    `/profiles?select=nickname,avatar&id=eq.${userId}`,
    { method: 'GET' },
  );
  const row = Array.isArray(rows) ? rows[0] : undefined;
  if (!row) return null;
  return { nickname: row.nickname ?? '', avatar: row.avatar ?? '' };
}
