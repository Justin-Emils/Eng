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
import { Platform } from 'react-native';

import { backupFingerprint, exportBackup, importBackup } from '@/domain/backup';
import { TimeoutError, fetchWithTimeout } from '@/domain/net';
import { decideLoginSync } from '@/domain/login-sync';
import { checkOwnership, type OwnershipCheck } from '@/domain/ownership';
import { DEFAULT_AVATAR, getAccount, saveAccount } from '@/storage/account';
import { bindLocalOwner, getLocalOwnerSync } from '@/storage/local-owner';
import { getSettings } from '@/storage/settings';
import { saveSyncState } from '@/storage/sync-state';
import { now } from '@/domain/clock';
import { getWords } from '@/storage/words';

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
    // **P1-10**:统一超时。以前这里裸 fetch,弱网下"登录中…"会永远转圈。
    response = await fetchWithTimeout(`${REST_BASE}${path}`, {
      timeoutMs: 10_000,
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
  } catch (e) {
    if (e instanceof TimeoutError) throw e;
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

/**
 * 本机数据归属不匹配时抛出的错误(B2)。
 * 带上判定结果,界面可以直接引用里面的说法,不必自己拼文案。
 */
export class OwnershipError extends Error {
  readonly check: OwnershipCheck;

  constructor(check: OwnershipCheck) {
    super(check.message);
    this.name = 'OwnershipError';
    this.check = check;
  }
}

function accountEmail(): string {
  return getAuthState().session?.user.email ?? '';
}

/**
 * 当前登录账号与本机数据的归属关系(供上传前的校验与账号页展示复用)。
 * 「本机有没有数据」用生词数量判断:有生词才谈得上"把谁的数据推到谁的账号"。
 */
export async function getOwnershipStatus(): Promise<OwnershipCheck> {
  const words = await getWords();
  return checkOwnership({
    owner: getLocalOwnerSync(),
    accountId: currentUserId(),
    accountEmail: accountEmail(),
    localHasData: words.length > 0,
  });
}

/** 把本机数据整份上传(已存在则覆盖) */
export async function pushBackup(): Promise<void> {
  const userId = currentUserId();
  const check = await getOwnershipStatus();
  /**
   * **B2 硬约束**:本机数据只能属于一个账号。
   * 归属是另一个账号时拒绝上传 —— 这正是以前"两个号内容一样"的根因:
   * 本机数据能反复推到不同账号。要改归属必须由用户在账号页明确选择。
   */
  if (!check.canUpload) throw new OwnershipError(check);
  // 首次上传:数据还没有归属,绑定到当前账号
  if (check.state === 'unbound') {
    await bindLocalOwner({ accountId: userId, email: accountEmail() });
  }

  const raw = await exportBackup();
  await rest('/backups', {
    method: 'POST',
    // 表主键是 user_id:冲突时合并覆盖,即 upsert,不必先查再决定插还是改
    prefer: 'resolution=merge-duplicates,return=minimal',
    body: {
      user_id: userId,
      payload: JSON.parse(raw) as Record<string, unknown>,
      schema_version: 1,
      device: Platform.OS,  // 以前写死 'android'，iOS 用户云端也显示 android
    },
  });
  /**
   * 上传成功即建立**同步基线**(内容指纹 + 时间)。
   * 自动同步靠它判断"本机从那以后有没有改动";没有基线时自动同步不会做第一次上传
   * —— 那等于静默决定"以本机为准",必须由用户先定方向(见 domain/autosync)。
   */
  await saveSyncState({ lastHash: await backupFingerprint(), lastPushedAt: now() });
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

/**
 * 只取云端备份的更新时间（P1-12 冲突检测用，不下载整份 payload）。
 * 返回 null 表示云端还没有备份。
 */
export async function getRemoteUpdatedAt(): Promise<string | null> {
  const userId = currentUserId();
  const rows = await rest<{ updated_at?: string }[]>(
    `/backups?select=updated_at&user_id=eq.${userId}`,
    { method: 'GET' },
  );
  return Array.isArray(rows) ? (rows[0]?.updated_at ?? null) : null;
}
/** 用云端备份覆盖本机(返回写入的键数量);覆盖后本机数据的归属改绑到该账号 */
export async function restoreFromCloud(backup: RemoteBackup): Promise<number> {
  const userId = currentUserId();
  const count = await importBackup(backup.raw);
  // 本机内容现在等于这个账号的备份,归属随之改绑(这是**恢复**的语义,不是静默改绑)
  await bindLocalOwner({ accountId: userId, email: accountEmail() });
  /**
   * **P1-6**:恢复成功 = "以云端为准",必须同时建立同步基线。
   * 以前这里不写 sync-state,于是新手机登录自动恢复之后,自动同步一直卡在
   * "首次同步方向还没确定",直到用户手动点一次「立即同步」。
   */
  await saveSyncState({ lastHash: await backupFingerprint(), lastPulledAt: now() });
  return count;
}

/**
 * 把本机数据改归当前账号并上传(账号页的明确操作,对应 B2 的"改绑")。
 * 与 pushBackup 的区别:这里**先改绑再上传**,所以能通过归属校验 ——
 * 换句话说,"把本机数据给另一个账号"这件事只能由用户主动点这一下。
 */
export async function adoptLocalDataToCurrentAccount(): Promise<void> {
  const userId = currentUserId();
  await bindLocalOwner({ accountId: userId, email: accountEmail() });
  await pushBackup();
}

/**
 * 登录后的同步方案(B2/自动同步):判断"该问用户,还是可以自动决定"。
 *
 * 四种情形:
 *   本机无数据 + 云端有备份 → 自动恢复(新手机首次登录的典型路径)
 *   本机无数据 + 云端无备份 → 自动绑定(从零开始)
 *   本机有数据 + 云端无备份 → 自动上传(本机是唯一来源,不存在丢数据的风险)
 *   本机有数据 + 云端有备份 → **必须问用户**:用哪边?这是唯一会丢数据的分支,
 *                             不允许自动决定(见 autosync.ts 的首次同步安全边界)
 *
 * 归属属于另一个账号时,也一律走"问用户"的分支。
 */
export interface LoginSyncPlan {
  localHasData: boolean;
  localWords: number;
  remoteHasBackup: boolean;
  remoteWords: number;
  remoteUpdatedAt: string;
  /** 本机数据的归属与当前账号冲突 */
  ownershipConflict: boolean;
  /** 读取云端失败的原因(空串=读取成功)。读失败时**绝不能**当作"云端为空" */
  remoteError: string;
  /** 云端备份原文(取用云端时直接用它恢复,避免再请求一次) */
  remoteRaw: string;
  /** 无需询问时的自动动作;为 null 表示必须问用户 */
  auto: 'restore' | 'upload' | 'bind' | null;
  /** 给用户看的说明 */
  message: string;
}

export async function planLoginSync(): Promise<LoginSyncPlan> {
  const words = await getWords();
  const localWords = words.length;
  const localHasData = localWords > 0;

  let remote: RemoteBackup | null = null;
  let remoteError = '';
  try {
    remote = await pullBackup();
  } catch (e) {
    /**
     * **P0-2**:以前这里把读失败当成"云端没有备份"(remote = null),
     * 于是下一次判断进入"自动上传"分支 —— 一次 GET 抖动就把云端备份换成本机旧数据,
     * 还提示"已同步到云端"。现在把失败原因带出去,决策层会一律转成"问用户"。
     */
    remoteError = e instanceof Error ? e.message : '网络异常';
  }

  const ownership = await getOwnershipStatus().catch(() => null);
  const ownershipConflict = ownership ? !ownership.canUpload : false;

  const base = {
    localHasData,
    localWords,
    remoteHasBackup: Boolean(remote),
    remoteWords: remote?.wordCount ?? 0,
    remoteUpdatedAt: remote?.updatedAt ?? '',
    ownershipConflict,
    remoteError,
    remoteRaw: remote?.raw ?? '',
  };

  // 决策逻辑是纯函数(见 domain/login-sync.ts),有可执行用例盯着
  const decision = decideLoginSync({
    localHasData,
    localWords,
    remoteHasBackup: base.remoteHasBackup,
    remoteWords: base.remoteWords,
    remoteError,
    ownershipConflict,
    ownerEmail: ownership?.ownerEmail ?? '',
  });
  return { ...base, ...decision };
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

/**
 * 登录成功后自动同步一次(登录页 / 启动时都会调)。
 *
 * 这里的策略是**只补不覆盖**,因为"自动"意味着用户没有确认过:
 * - 昵称 / 头像:本机空的才用云端的填(换新手机的典型场景);
 * - 学习数据:只有本机完全为空(还没有生词、也没完成过引导)时才自动导入 ——
 *   这正是"新手机登录后数据自动回来"的预期行为;
 * - 本机已有数据时不自动覆盖,而是把决定权交回用户(账号页的「从云端恢复」会显示
 *   云端与本机各有多少词,再由用户确认)。
 */
export async function autoSyncAfterLogin(): Promise<{ restored: boolean; note: string }> {
  // 资料先合(失败不影响后面的数据同步判断)
  try {
    await mergeProfileFromCloud();
  } catch {
    // 忽略:资料合并失败不该阻断登录
  }

  const [words, settings] = await Promise.all([getWords(), getSettings()]);
  const localIsEmpty = words.length === 0 && !settings.onboarded;

  if (!localIsEmpty) {
    return {
      restored: false,
      note: '本机已有学习数据,未自动覆盖;需要时可在账号页点「从云端恢复」',
    };
  }

  const remote = await pullBackup();
  if (!remote) {
    return { restored: false, note: '云端还没有备份,完成引导后可以在账号页上传' };
  }

  const count = await importBackup(remote.raw);
  // 本机内容已等于该账号的备份 → 归属绑定到这个账号(新手机首次登录的典型路径)
  await bindLocalOwner({ accountId: currentUserId(), email: accountEmail() });
  return {
    restored: true,
    note: `已从云端恢复 ${count} 项数据(${remote.wordCount} 个生词)`,
  };
}


/**
 * 删除当前账号在云端的**数据行**(备份 + 资料)(P2-2)。
 *
 * 能删到哪一步:backups / profiles 两张表的行可以删(RLS 允许用户删自己的行)。
 * **删不掉的是 auth.users 里的登录身份** —— 那需要 service_role 或 Edge Function。
 * 所以界面上写的是「删除云端学习数据」而不是「注销账号」,不夸大能力。
 */
export async function deleteCloudData(): Promise<void> {
  const userId = currentUserId();
  await rest(`/backups?user_id=eq.${userId}`, { method: 'DELETE' });
  await rest(`/profiles?id=eq.${userId}`, { method: 'DELETE' });
  // 云端已空 → 清掉同步基线,避免下次自动同步又把本机推上去
  await saveSyncState({ lastHash: '', lastPushedAt: 0, lastPulledAt: 0 });
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
