/**
 * 本机数据归属的判定(B2)。纯函数,便于在验证脚本里直接跑。
 *
 * 三种状态:
 *   unbound  —— 还没有归属:首次上传时绑定到当前账号(数据是全新的,绑谁都不算错);
 *   same     —— 归属就是当前账号,正常同步;
 *   conflict —— 归属是**另一个**账号:拒绝上传,必须由用户明确选择怎么处理。
 *
 * 关键设计:**不允许静默改绑**。判定本身只给状态与说法,
 * 改绑只能来自用户在账号页的明确操作(见 account.tsx)。
 */

export interface OwnerLike {
  accountId: string;
  email: string;
}

export type OwnershipState = 'unbound' | 'same' | 'conflict';

export interface OwnershipCheck {
  state: OwnershipState;
  /** 归属账号邮箱(展示用) */
  ownerEmail: string;
  /** 给用户看的一句话(界面直接引用,避免各处自己写) */
  message: string;
  /** 是否允许直接上传(只有 unbound / same 允许) */
  canUpload: boolean;
}

export function checkOwnership(input: {
  owner: OwnerLike | null;
  accountId: string;
  accountEmail: string;
  /** 本机是否已有学习数据(有数据才谈得上"归属冲突") */
  localHasData: boolean;
}): OwnershipCheck {
  const { owner, accountId, accountEmail, localHasData } = input;

  // 本机没数据:绑谁都不会造成"把别人的数据推给你",视为未绑定
  if (!owner || !localHasData) {
    return {
      state: 'unbound',
      ownerEmail: owner?.email ?? '',
      message: owner
        ? '本机还没有学习数据,首次上传后会绑定到当前账号'
        : '本机数据还没有归属,首次上传后会绑定到当前账号',
      canUpload: true,
    };
  }

  if (owner.accountId === accountId) {
    return {
      state: 'same',
      ownerEmail: owner.email,
      message: `本机数据属于当前账号${owner.email ? `(${owner.email})` : ''}`,
      canUpload: true,
    };
  }

  return {
    state: 'conflict',
    ownerEmail: owner.email,
    message: `本机数据属于 ${owner.email || '另一个账号'}。本机数据只能绑定一个账号,已阻止上传到当前账号(${accountEmail || '当前账号'})——请先在下面明确选择怎么处理。`,
    canUpload: false,
  };
}
