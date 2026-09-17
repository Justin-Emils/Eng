/**
 * 用户水平持久化(模块 B)。
 * 默认未评估;首次评估后写入,可随时重测。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AssessmentRound, UserLevel } from '@/types';

const USER_LEVEL_KEY = 'readingapp.userlevel.v1';

/** 未评估时的默认值(模块 B:跳过 → 默认 B1) */
export const DEFAULT_USER_LEVEL: UserLevel = {
  vocab: undefined,
  level: 'B1',
  assessed: false,
  updatedAt: 0,
};

/** 只保留形状正确的档位记录(脏数据会让画像算出 NaN) */
function normalizeRounds(raw: unknown): AssessmentRound[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: AssessmentRound[] = [];
  for (const item of raw) {
    const r = item as Partial<AssessmentRound>;
    if (typeof r.threshold !== 'number' || typeof r.total !== 'number') continue;
    if (r.total <= 0) continue;
    out.push({
      threshold: r.threshold,
      total: r.total,
      known: typeof r.known === 'number' ? Math.max(0, Math.min(r.total, r.known)) : 0,
    });
  }
  return out.length > 0 ? out : undefined;
}

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
      rounds: normalizeRounds(parsed.rounds),
      answers: typeof parsed.answers === 'number' ? parsed.answers : undefined,
      knownAnswers: typeof parsed.knownAnswers === 'number' ? parsed.knownAnswers : undefined,
      mode: parsed.mode === 'fine' || parsed.mode === 'quick' ? parsed.mode : undefined,
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
