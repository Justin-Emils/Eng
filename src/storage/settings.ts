/**
 * 用户设置持久化(模块 F / G):每日目标等。
 * 默认:每天读 1 篇 + 复习 10 词(需求 G 三默认值)。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface DailyGoal {
  /** 每日待读篇数 */
  articles: number;
  /** 每日待复习词数 */
  reviewWords: number;
}

const SETTINGS_KEY = 'readingapp.settings.v1';

export const DEFAULT_DAILY_GOAL: DailyGoal = { articles: 1, reviewWords: 10 };

interface SettingsStore {
  dailyGoal: DailyGoal;
}

/** 读取设置(含默认值) */
export async function getSettings(): Promise<SettingsStore> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return { dailyGoal: DEFAULT_DAILY_GOAL };
    const parsed = JSON.parse(raw) as Partial<SettingsStore>;
    return {
      dailyGoal: {
        ...DEFAULT_DAILY_GOAL,
        ...(parsed.dailyGoal ?? {}),
      },
    };
  } catch {
    return { dailyGoal: DEFAULT_DAILY_GOAL };
  }
}

/** 更新每日目标 */
export async function saveDailyGoal(goal: DailyGoal): Promise<void> {
  const current = await getSettings();
  const next: SettingsStore = { ...current, dailyGoal: { ...goal } };
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
}
