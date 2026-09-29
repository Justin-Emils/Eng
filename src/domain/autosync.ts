/**
 * 自动同步(离线优先 + 云端为主)。
 *
 * 设计取向的转变:以前"上传"是用户手动点的动作,本机数据是数据本体;
 * 现在改成 —— **登录并绑定之后,数据自动上云**,用户不需要(也不应该)记着点上传。
 * 本机仍然留一份,但角色是"本地副本":离线可读、断网可写,联网后自动补齐。
 *
 * 三个刻意的设计:
 *  1. **指纹比对**:内容没变就不传(见 storage/sync-state 的 hash);
 *  2. **只在归属允许时传**:归属冲突(本机数据属于另一个账号)时**不自动传**,
 *     交给用户在账号页明确选择 —— 自动同步绝不能替用户做"把数据推给谁"的决定;
 *  3. **失败静默**:自动同步失败(断网、后端不可用)不打扰用户,下次再试;
 *     只有用户主动点"立即同步"时才把错误说出来。
 */

import { exportBackup } from '@/domain/backup';
import { getAuthState } from '@/domain/auth/store';
import { getOwnershipStatus, pushBackup } from '@/domain/sync';
import { getSyncStateSync, hashString, saveSyncState } from '@/storage/sync-state';

export type AutoSyncStatus = 'pushed' | 'unchanged' | 'skipped' | 'blocked' | 'error';

export interface AutoSyncResult {
  status: AutoSyncStatus;
  /** 给用户看的原因(用户主动同步时展示,自动同步时忽略) */
  reason: string;
  /** 本次上传后的时间戳(仅 pushed 时有值) */
  pushedAt?: number;
}

/**
 * 视情况自动同步一次。所有触发点(启动、回到前台、定时、关键操作后)都调它。
 * 幂等且廉价:没变化时只做一次序列化 + 哈希。
 */
export async function maybeAutoSync(): Promise<AutoSyncResult> {
  const auth = getAuthState();
  if (auth.status !== 'authed') {
    return { status: 'skipped', reason: '未登录,数据只存在本机' };
  }

  // 归属冲突时不自动传:这是"把数据给哪个账号"的决定,必须由用户做
  const ownership = await getOwnershipStatus().catch(() => null);
  if (ownership && !ownership.canUpload) {
    return { status: 'blocked', reason: ownership.message };
  }

  const raw = await exportBackup();
  const hash = hashString(raw);
  const state = getSyncStateSync();

  /**
   * **安全边界**:从未同步过(没有基线)时,自动同步不做"第一次上传"。
   *
   * 原因:本机有数据、云端也有备份的情况下,第一次上传等于**静默决定"以本机为准"**,
   * 会把云端那份覆盖掉。这个决定必须由用户在登录时或账号页做出
   * (见 sync.ts 的 planLoginSync)。有了基线之后,自动同步才只是"把后续改动推上去"。
   */
  if (!state.lastHash) {
    return {
      status: 'blocked',
      reason: '首次同步的方向还没确定 —— 请在账号页选择「用本机数据覆盖云端」或「用云端数据覆盖本机」',
    };
  }

  if (state.lastHash === hash) {
    return { status: 'unchanged', reason: '本机数据与上次同步时一致' };
  }

  try {
    await pushBackup();
    const pushedAt = Date.now();
    await saveSyncState({ lastHash: hash, lastPushedAt: pushedAt });
    return { status: 'pushed', reason: '已同步到云端', pushedAt };
  } catch (e) {
    return { status: 'error', reason: e instanceof Error ? e.message : '同步失败' };
  }
}

/**
 * 记录"刚以云端为准"(恢复完成后调用)。
 * 内容此刻与云端一致 → 把当前指纹作为基线,后续改动才会被自动同步推上去。
 */
export async function markPulled(): Promise<void> {
  const raw = await exportBackup();
  await saveSyncState({ lastHash: hashString(raw), lastPulledAt: Date.now() });
}

/** 「上次同步」的人话表述(账号页展示) */
export function describeLastSync(now = Date.now()): string {
  const { lastPushedAt } = getSyncStateSync();
  if (!lastPushedAt) return '还没有同步过';
  const diff = now - lastPushedAt;
  if (diff < 60_000) return '刚刚同步';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前同步`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前同步`;
  return `${Math.floor(diff / 86_400_000)} 天前同步`;
}
