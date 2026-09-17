/**
 * 订阅全局登录态的 Hook。
 * 用 useSyncExternalStore 而不是 Context:状态源头只有一个模块级 store,
 * 任何页面读取到的都是同一份,且不会因为 Context 层级变动而多渲染。
 */

import { useSyncExternalStore } from 'react';

import { getAuthState, subscribeAuth, type AuthState } from '@/domain/auth/store';

export function useAuth(): AuthState {
  return useSyncExternalStore(subscribeAuth, getAuthState, getAuthState);
}
