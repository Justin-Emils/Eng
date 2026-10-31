/**
 * 登录时的同步方向决策(纯函数)。
 *
 * 从 sync.ts 的 planLoginSync 里抽出来的原因:这段逻辑决定"会不会覆盖云端",
 * 是全项目最危险的一处判断 —— 必须有可执行用例盯着它。纯函数才能在 Node 里跑。
 *
 * 六种情形(顺序即优先级):
 *   1. **读取云端失败** → 一律问用户,绝不自动上传(否则 GET 失败 + POST 成功
 *      就会把云端备份换成本机旧数据,且没有任何提示);
 *   2. 归属属于另一个账号 → 问用户;
 *   3. 本机空 + 云端有 → 自动恢复;
 *   4. 本机空 + 云端空 → 自动绑定;
 *   5. 本机有 + 云端空 → 自动上传(本机是唯一来源,不存在覆盖别人的风险);
 *   6. 两边都有 → 问用户。
 */

export interface LoginSyncInput {
  localHasData: boolean;
  localWords: number;
  remoteHasBackup: boolean;
  remoteWords: number;
  /** 云端读取失败的原因;空串表示读取成功 */
  remoteError: string;
  ownershipConflict: boolean;
  ownerEmail: string;
}

export interface LoginSyncDecision {
  auto: 'restore' | 'upload' | 'bind' | null;
  message: string;
}

export function decideLoginSync(input: LoginSyncInput): LoginSyncDecision {
  const { localHasData, localWords, remoteHasBackup, remoteWords, remoteError } = input;

  // 1. 读云端失败:不猜,交给用户
  if (remoteError) {
    return {
      auto: null,
      message: `读取云端备份失败(${remoteError})。为了不误覆盖云端,本次不自动同步 —— 请检查网络后重试。`,
    };
  }

  // 2. 归属冲突:把决定权交给用户
  if (input.ownershipConflict) {
    return {
      auto: null,
      message: `本机数据属于 ${input.ownerEmail || '另一个账号'}。请选择用哪边的数据,或先去账号页解除归属。`,
    };
  }

  // 3. 新手机首次登录
  if (!localHasData && remoteHasBackup) {
    return { auto: 'restore', message: `云端有 ${remoteWords} 个生词,本机是空的,将自动恢复` };
  }

  // 4. 全新账号
  if (!localHasData) {
    return { auto: 'bind', message: '本机与云端都没有数据,将从零开始' };
  }

  // 5. 只有本机有数据:上传不会覆盖任何东西
  if (!remoteHasBackup) {
    return { auto: 'upload', message: `本机有 ${localWords} 个生词,云端为空,将自动上传` };
  }

  // 6. 两边都有:必须问
  return {
    auto: null,
    message: `本机有 ${localWords} 个生词,云端有 ${remoteWords} 个 —— 两边都有数据,请选择以哪边为准。`,
  };
}
