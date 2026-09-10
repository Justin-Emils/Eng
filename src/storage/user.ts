/**
 * 用户水平持久化(模块 B)。
 * 默认未评估;首次评估后写入,可随时重测。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { UserLevel } from '@/types';

const USER_LEVEL_KEY = 'readingapp.userlevel.v1';

/** 未评估时的默认值(模块 B:跳过 → 默认 B1) */
export const DEFAULT_USER_LEVEL: UserLevel = {
  vocab: undefined,
  level: 'B1',
  assessed: false,
  updatedAt: 0,
};

export async function getUserLevel(): Promise<UserLevel> {
  try {
    const raw = await AsyncStorage.getItem(USER_LEVEL_KEY);
    if (!raw) return DEFAULT_USER_LEVEL;
    const parsed = JSON.parse(raw) as UserLevel;
    return {
      vocab: typeof parsed.vocab === 'number' ? parsed.vocab : undefined,
      level: parsed.level ?? 'B1',
      assessed: Boolean(parsed.assessed),
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
    };
  } catch {
    return DEFAULT_USER_LEVEL;
  }
}

export async function saveUserLevel(level: UserLevel): Promise<void> {
  await AsyncStorage.setItem(
    USER_LEVEL_KEY,
    JSON.stringify({ ...level, assessed: true, updatedAt: Date.now() }),
  );
}
