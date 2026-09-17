/**
 * 登录态本地持久化。
 *
 * 注意:登录 token **不在**备份/云同步的 key 白名单里(见 domain/backup.ts),
 * 它只跟着这台手机走 —— 云备份文件被复制到别处也不会连带泄露账号。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AuthSession } from '@/domain/auth/api';

const SESSION_KEY = 'readingapp.auth.v1';

function normalize(raw: unknown): AuthSession | null {
  const v = (raw ?? {}) as Partial<AuthSession>;
  if (!v.accessToken || !v.refreshToken || !v.user?.id) return null;
  return {
    accessToken: v.accessToken,
    refreshToken: v.refreshToken,
    expiresAt: typeof v.expiresAt === 'number' ? v.expiresAt : 0,
    user: {
      id: v.user.id,
      email: v.user.email ?? '',
      createdAt: v.user.createdAt ?? '',
    },
  };
}

export async function getStoredSession(): Promise<AuthSession | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return normalize(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export async function saveStoredSession(session: AuthSession): Promise<void> {
  try {
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // 写入失败不影响本次使用,只是下次要重新登录
  }
}

export async function clearStoredSession(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SESSION_KEY);
  } catch {
    // 忽略
  }
}
