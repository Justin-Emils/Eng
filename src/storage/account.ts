/**
 * 本地账号信息(模块 F/G)。
 *
 * 现在没有云端:账号只是"本机身份" —— 昵称、头像、加入时间,
 * 用于个人中心展示与设置归属;所有学习数据本来就存在本机。
 * 将来接入云同步时,这里会扩展为真正的用户记录(id 与云端一一对应)。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const ACCOUNT_KEY = 'readingapp.account.v1';

export interface AccountInfo {
  /** 本机账号 id(首次运行时生成,云同步接入后可作为本地锚点) */
  id: string;
  /** 昵称(可为空) */
  nickname: string;
  /** 头像 emoji(默认 📚) */
  avatar: string;
  /** 首次使用时间(ms) */
  createdAt: number;
}

/** 可选头像(足够克制,避免花哨) */
export const AVATAR_CHOICES = [
  '📚',
  '🎯',
  '🧠',
  '🌱',
  '🔥',
  '☕',
  '🧭',
  '🦉',
  '⛰️',
  '🌊',
  '✨',
  '🐧',
] as const;

export const DEFAULT_AVATAR = '📚';

function newId(): string {
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 读取账号(不存在则创建默认账号并落盘) */
export async function getAccount(): Promise<AccountInfo> {
  try {
    const raw = await AsyncStorage.getItem(ACCOUNT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AccountInfo>;
      return {
        id: typeof parsed.id === 'string' && parsed.id ? parsed.id : newId(),
        nickname: typeof parsed.nickname === 'string' ? parsed.nickname : '',
        avatar: typeof parsed.avatar === 'string' && parsed.avatar ? parsed.avatar : DEFAULT_AVATAR,
        createdAt: typeof parsed.createdAt === 'number' ? parsed.createdAt : Date.now(),
      };
    }
  } catch {
    // 读取失败 → 走下面的默认
  }
  const fresh: AccountInfo = {
    id: newId(),
    nickname: '',
    avatar: DEFAULT_AVATAR,
    createdAt: Date.now(),
  };
  try {
    await AsyncStorage.setItem(ACCOUNT_KEY, JSON.stringify(fresh));
  } catch {
    // 写入失败不阻塞使用
  }
  return fresh;
}

/** 局部更新账号信息 */
export async function saveAccount(patch: Partial<Pick<AccountInfo, 'nickname' | 'avatar'>>): Promise<AccountInfo> {
  const current = await getAccount();
  const next: AccountInfo = { ...current, ...patch };
  try {
    await AsyncStorage.setItem(ACCOUNT_KEY, JSON.stringify(next));
  } catch {
    // 忽略
  }
  return next;
}

/** 加入天数(含今天) */
export function joinedDays(account: AccountInfo, now = Date.now()): number {
  const day = 24 * 60 * 60 * 1000;
  return Math.max(1, Math.floor((now - account.createdAt) / day) + 1);
}
