/**
 * 用户设置持久化(模块 F / G)。
 * 默认:每天读 1 篇 + 复习 10 词(需求 G 三默认值);主题跟随系统。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface DailyGoal {
  /** 每日待读篇数 */
  articles: number;
  /** 每日待复习词数 */
  reviewWords: number;
}

/** 主题模式:跟随系统 / 固定浅色 / 固定深色 */
export type ThemeMode = 'system' | 'light' | 'dark';

const SETTINGS_KEY = 'readingapp.settings.v1';

export const DEFAULT_DAILY_GOAL: DailyGoal = { articles: 1, reviewWords: 10 };
export const DEFAULT_THEME_MODE: ThemeMode = 'system';

interface SettingsStore {
  dailyGoal: DailyGoal;
  /** 主题模式(默认跟随系统) */
  theme: ThemeMode;
  /** 是否已完成首次引导 */
  onboarded: boolean;
  /** 本地昵称(无账号体系,纯本地展示) */
  nickname?: string;
}

const DEFAULTS: SettingsStore = {
  dailyGoal: DEFAULT_DAILY_GOAL,
  theme: DEFAULT_THEME_MODE,
  onboarded: false,
};

function normalizeTheme(value: unknown): ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system' ? value : DEFAULT_THEME_MODE;
}

/** 读取设置(含默认值) */
export async function getSettings(): Promise<SettingsStore> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<SettingsStore>;
    return {
      dailyGoal: { ...DEFAULT_DAILY_GOAL, ...(parsed.dailyGoal ?? {}) },
      theme: normalizeTheme(parsed.theme),
      onboarded: parsed.onboarded === true,
      nickname: typeof parsed.nickname === 'string' ? parsed.nickname : undefined,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

async function patch(part: Partial<SettingsStore>): Promise<void> {
  const current = await getSettings();
  const next: SettingsStore = { ...current, ...part };
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
}

/** 更新每日目标 */
export async function saveDailyGoal(goal: DailyGoal): Promise<void> {
  await patch({ dailyGoal: { ...goal } });
}

/** 更新主题模式 */
export async function saveThemeMode(theme: ThemeMode): Promise<void> {
  await patch({ theme });
}

/** 标记首次引导已完成 */
export async function saveOnboarded(onboarded = true): Promise<void> {
  await patch({ onboarded });
}

/** 保存本地昵称(无账号体系) */
export async function saveNickname(nickname: string): Promise<void> {
  await patch({ nickname: nickname.trim() });
}
