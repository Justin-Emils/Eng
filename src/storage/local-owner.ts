/**
 * 本机数据的**归属账号**(B2:本地数据只能绑一个账号)。
 *
 * 背景:以前本机数据可以被反复上传到不同账号 —— 实测"两个号轮着登录,内容都一样了"。
 * 根因是没有归属概念:退出登录后本机数据还在,换一个账号登录再点上传,就又推了一份进去。
 *
 * 现在本机数据带一个"归属":首次上传时绑定到当时的账号;此后
 *   · 同一账号 → 正常上传/恢复;
 *   · 另一个账号 → **拒绝上传**,必须先由用户明确选择(见 domain/ownership 与账号页);
 *   · 未绑定 → 视为可自由绑定。
 * 退出登录**不解除归属** —— 数据仍然属于原账号,这样重新登录同一账号能无缝继续。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const OWNER_KEY = 'readingapp.localowner.v1';

export interface LocalOwner {
  accountId: string;
  email: string;
  /** 绑定时间(ms) */
  boundAt: number;
}

/** 进程内缓存:上传前的判断是同步的,不能每次都 await */
let cache: LocalOwner | null = null;
let hydrated = false;

export function getLocalOwnerSync(): LocalOwner | null {
  return cache;
}

export function localOwnerHydrated(): boolean {
  return hydrated;
}

export async function hydrateLocalOwner(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(OWNER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LocalOwner>;
      if (parsed && typeof parsed.accountId === 'string' && parsed.accountId) {
        cache = {
          accountId: parsed.accountId,
          email: typeof parsed.email === 'string' ? parsed.email : '',
          boundAt: typeof parsed.boundAt === 'number' ? parsed.boundAt : 0,
        };
      }
    }
  } catch {
    // 读失败按"未绑定"处理,不会阻塞登录与阅读
  }
  hydrated = true;
}

/** 绑定(或改绑)本机数据的归属 */
export async function bindLocalOwner(input: { accountId: string; email: string }): Promise<LocalOwner> {
  const next: LocalOwner = { ...input, boundAt: Date.now() };
  cache = next;
  hydrated = true;
  try {
    await AsyncStorage.setItem(OWNER_KEY, JSON.stringify(next));
  } catch {
    // 写失败不影响本次使用,只是下次启动会退回未绑定
  }
  return next;
}

/** 解绑(本机数据变回"无归属",可以再绑到任意账号) */
export async function clearLocalOwner(): Promise<void> {
  cache = null;
  hydrated = true;
  try {
    await AsyncStorage.removeItem(OWNER_KEY);
  } catch {
    // 忽略
  }
}
