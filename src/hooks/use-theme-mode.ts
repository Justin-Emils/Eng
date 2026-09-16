/**
 * 主题模式(跟随系统 / 浅色 / 深色)的响应式状态。
 *
 * 为什么需要:useTheme() 原本只看系统值,用户在"我的 → 主题"里改了也不会生效。
 * 这里用模块级状态 + 订阅(与 corpus/status 同一套模式),让所有页面即时响应:
 *  - hydrateThemeMode():启动时从存储读一次;
 *  - setThemeMode():写入存储并通知订阅者;
 *  - useThemeMode():组件订阅当前值。
 */

import { useEffect, useReducer } from 'react';

import { getSettings, saveThemeMode, type ThemeMode } from '@/storage/settings';

export type { ThemeMode };

let current: ThemeMode = 'system';
const listeners = new Set<() => void>();

/** 同步取当前主题模式(供 useTheme 等非 hook 场景) */
export function getThemeMode(): ThemeMode {
  return current;
}

function emit(): void {
  listeners.forEach((l) => l());
}

/** 订阅主题变化 */
export function subscribeThemeMode(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 启动时从存储水化(在根布局调用一次) */
export async function hydrateThemeMode(): Promise<void> {
  try {
    const settings = await getSettings();
    current = settings.theme;
    emit();
  } catch {
    // 读取失败保持默认
  }
}

/** 切换主题模式(持久化 + 立即生效) */
export async function setThemeMode(mode: ThemeMode): Promise<void> {
  current = mode;
  emit();
  await saveThemeMode(mode);
}

/** 组件内订阅当前主题模式 */
export function useThemeMode(): ThemeMode {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => subscribeThemeMode(force), []);
  return current;
}
