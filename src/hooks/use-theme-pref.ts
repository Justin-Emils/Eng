/**
 * 外观偏好(主题 + 深浅模式)的响应式状态。
 *
 * 为什么需要:useTheme() 原本只看系统深浅色,用户在设置里改了不会生效。
 * 这里用模块级状态 + 订阅(与 corpus/status 同一套模式),让所有页面即时响应:
 *  - hydrateThemePrefs():启动时从存储读一次;
 *  - setThemeMode() / setThemeId():写入存储并通知订阅者;
 *  - useThemeMode() / useThemeId():组件订阅当前值。
 *
 * 两个偏好刻意放在同一个模块而不是各开一个:
 * 它们一起决定最终配色,共享一次水化与一份订阅者列表更省事,
 * 也避免"主题水化了、深浅模式还没水化"的中间态导致首帧闪色。
 */

import { useEffect, useReducer } from 'react';

import { DEFAULT_THEME_ID, isThemeId, type ThemeId } from '@/constants/theme';
import { getSettings, saveThemeId, saveThemeMode, type ThemeMode } from '@/storage/settings';

export type { ThemeId, ThemeMode };

let currentMode: ThemeMode = 'system';
let currentThemeId: ThemeId = DEFAULT_THEME_ID;
const listeners = new Set<() => void>();

/** 同步取当前主题模式(供 useTheme 等非 hook 场景) */
export function getThemeMode(): ThemeMode {
  return currentMode;
}

/** 同步取当前主题 id */
export function getThemeId(): ThemeId {
  return currentThemeId;
}

function emit(): void {
  listeners.forEach((l) => l());
}

/** 订阅外观偏好变化 */
export function subscribeThemePrefs(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 启动时从存储水化(在根布局调用一次)。两个值一起读,避免首帧用错配色。 */
export async function hydrateThemePrefs(): Promise<void> {
  try {
    const settings = await getSettings();
    currentMode = settings.theme;
    currentThemeId = settings.themeId;
    emit();
  } catch {
    // 读取失败保持默认
  }
}

/** 切换深浅模式(持久化 + 立即生效) */
export async function setThemeMode(mode: ThemeMode): Promise<void> {
  currentMode = mode;
  emit();
  await saveThemeMode(mode);
}

/** 切换主题(持久化 + 立即生效) */
export async function setThemeId(themeId: ThemeId): Promise<void> {
  if (!isThemeId(themeId)) return;
  currentThemeId = themeId;
  emit();
  await saveThemeId(themeId);
}

/** 组件内订阅当前深浅模式 */
export function useThemeMode(): ThemeMode {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => subscribeThemePrefs(force), []);
  return currentMode;
}

/** 组件内订阅当前主题 */
export function useThemeId(): ThemeId {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => subscribeThemePrefs(force), []);
  return currentThemeId;
}
