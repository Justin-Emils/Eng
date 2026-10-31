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

import { backupFingerprint } from '@/domain/backup';
import { getAuthState } from '@/domain/auth/store';
import { getOwnershipStatus, getRemoteUpdatedAt, pushBackup } from '@/domain/sync';
import { now as clockNow } from '@/domain/clock';
import { getSyncStateSync, saveSyncState } from '@/storage/sync-state';

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

  // 只对**业务内容**求指纹(排除 exportedAt,否则每次都会"检测到变化")
  const hash = await backupFingerprint();
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
      reason: '首次同步的方向还没确定 —— 去账号页点「立即同步」(以本机为准)或「从云端恢复」(以云端为准)',
    };
  }

  if (state.lastHash === hash) {
    return { status: 'unchanged', reason: '本机数据与上次同步时一致' };
  }

  /**
   * **P1-12 冲突检测**:上传前先看一眼云端更新时间。
   *
   * 以前只有"上传"没有"下载",两台设备登录同一账号时,后打开 App 的那台会把
   * 前一台的进度整份覆盖掉,而且没有任何提示。这里做最小拦截:
   * 如果云端备份的时间晚于本机上次同步时间(说明**另一台设备推过更新的数据**),
   * 就暂停自动上传,让用户自己决定用哪边。
   */
  try {
    const remoteUpdatedAt = await getRemoteUpdatedAt();
    if (remoteUpdatedAt) {
      const remoteMs = Date.parse(remoteUpdatedAt);
      const localMs = Math.max(state.lastPushedAt, state.lastPulledAt);
      // 允许 5 秒时钟误差/往返延迟
      if (Number.isFinite(remoteMs) && remoteMs > localMs + 5_000) {
        return {
          status: 'blocked',
          reason:
            '云端有更新的数据(可能来自另一台设备),已暂停自动上传以免覆盖。请到账号页选择「从云端恢复」或「立即同步」。',
        };
      }
    }
  } catch {
    // 读不到云端时间就不拦(不能因为一次查询失败就停止同步)
  }

  try {
    await pushBackup();
    const pushedAt = clockNow();
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
  await saveSyncState({ lastHash: await backupFingerprint(), lastPulledAt: clockNow() });
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
