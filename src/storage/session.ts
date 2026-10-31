/**
 * 登录态本地持久化。
 *
 * **P2-3a**:以前 token 明文存在 AsyncStorage 里,Root 或备份提取即可拿到 refresh token。
 * 现在优先用 `expo-secure-store`(Android 走 Keystore 加密的 SharedPreferences,
 * iOS 走 Keychain);读不到时自动从旧的 AsyncStorage 迁移一次并删除旧副本。
 *
 * 为什么还保留 AsyncStorage 兜底:SecureStore 对单条值有大小限制(部分平台 ~2 KB),
 * 而整份 session(access token JWT + refresh token + user)可能超出。写入失败时
 * 退回 AsyncStorage,**保证不会因为加密存储失败而登不上**,但会优先用更安全的那条路。
 *
 * 注意:token **不在**备份/云同步的 key 白名单里(见 domain/backup.ts),
 * 它只跟这台手机走 —— 云备份被复制到别处也不会连带泄露账号。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

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

/** 读原始字符串:先安全存储,再兼容旧版 AsyncStorage,并顺手迁移 */
async function readRaw(): Promise<string | null> {
  try {
    const secure = await SecureStore.getItemAsync(SESSION_KEY);
    if (secure) return secure;
  } catch {
    // SecureStore 不可用(如 Web / 模拟器缺 Keystore):走兜底
  }
  try {
    const legacy = await AsyncStorage.getItem(SESSION_KEY);
    if (!legacy) return null;
    // 一次性迁移:写进安全存储成功后删掉明文副本
    try {
      await SecureStore.setItemAsync(SESSION_KEY, legacy);
      await AsyncStorage.removeItem(SESSION_KEY);
    } catch {
      // 迁移失败就继续用明文副本(功能优先)
    }
    return legacy;
  } catch {
    return null;
  }
}

async function writeRaw(value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(SESSION_KEY, value);
    // 迁移完成后清掉可能残留的明文
    await AsyncStorage.removeItem(SESSION_KEY).catch(() => {});
    return;
  } catch {
    // 超出 SecureStore 大小限制或不可用:退回明文存储(至少能登录)
  }
  try {
    await AsyncStorage.setItem(SESSION_KEY, value);
  } catch {
    // 写入失败不影响本次使用,只是下次要重新登录
  }
}

async function removeRaw(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(SESSION_KEY);
  } catch {
    // 忽略
  }
  try {
    await AsyncStorage.removeItem(SESSION_KEY);
  } catch {
    // 忽略
  }
}

export async function getStoredSession(): Promise<AuthSession | null> {
  try {
    const raw = await readRaw();
    if (!raw) return null;
    return normalize(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export async function saveStoredSession(session: AuthSession): Promise<void> {
  await writeRaw(JSON.stringify(session));
}

export async function clearStoredSession(): Promise<void> {
  await removeRaw();
}
