/**
 * 全局登录态(模块 G · 在线账号)。
 *
 * 设计原则:**离线优先**。登录是可选的增强,没登录 / 没网时 App 全部功能照常,
 * 所以任何网络失败都不会让界面卡住或白屏,只把错误交给调用方展示。
 *
 * 状态放在模块级单例里(与 hooks/use-theme-mode.ts 同一套路),由 use-auth 订阅,
 * 这样任何页面都能读到同一份登录态,不需要 Context 包裹整棵树。
 */

import {
  AuthError,
  signInWithPassword,
  signUp as signUpRemote,
  signOutRemote,
  updatePassword as updatePasswordRemote,
  fetchUser,
  refreshSession,
  sendRecoveryEmail,
  verifyRecoveryCode,
  type AuthSession,
} from '@/domain/auth/api';
import { clearStoredSession, getStoredSession, saveStoredSession } from '@/storage/session';

export type AuthStatus = 'loading' | 'anon' | 'authed';

export interface AuthState {
  status: AuthStatus;
  session: AuthSession | null;
}

let state: AuthState = { status: 'loading', session: null };
const listeners = new Set<() => void>();

/** 距离过期不足这么久(秒)就先续期,避免请求发到一半正好过期 */
const REFRESH_MARGIN_SECONDS = 120;

function emit(): void {
  for (const listener of listeners) listener();
}

function setState(next: AuthState): void {
  state = next;
  emit();
}

export function getAuthState(): AuthState {
  return state;
}

export function subscribeAuth(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

async function adopt(session: AuthSession): Promise<AuthSession> {
  await saveStoredSession(session);
  setState({ status: 'authed', session });
  return session;
}

/**
 * 启动时调用一次:恢复上次的登录态。
 * - 本地没有 token → 未登录
 * - token 快过期 → 用 refresh_token 换新的
 * - 续期失败(比如密码改了、token 被撤销)→ 清掉,退回未登录,不打扰用户
 */
export async function hydrateAuth(): Promise<AuthState> {
  const stored = await getStoredSession();
  if (!stored) {
    setState({ status: 'anon', session: null });
    return state;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (stored.expiresAt - nowSeconds > REFRESH_MARGIN_SECONDS) {
    setState({ status: 'authed', session: stored });
    // 后台静默核对一次用户是否仍然有效(网络失败就沿用本地判断)
    void (async () => {
      try {
        const user = await fetchUser(stored.accessToken);
        await adopt({ ...stored, user });
      } catch (e) {
        if (e instanceof AuthError && e.code !== 'network') {
          await clearStoredSession();
          setState({ status: 'anon', session: null });
        }
      }
    })();
    return state;
  }

  try {
    await adopt(await refreshSession(stored.refreshToken));
  } catch {
    await clearStoredSession();
    setState({ status: 'anon', session: null });
  }
  return state;
}

/**
 * 取一个还没过期的 access_token(必要时先续期)。
 * 云同步等所有需要身份的请求都走这里,避免各处重复处理续期。
 */
export async function ensureAccessToken(): Promise<string> {
  const current = state.session;
  if (!current) throw new AuthError('还没有登录', 'not_signed_in');

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (current.expiresAt - nowSeconds > REFRESH_MARGIN_SECONDS) return current.accessToken;

  try {
    const fresh = await adopt(await refreshSession(current.refreshToken));
    return fresh.accessToken;
  } catch (e) {
    await clearStoredSession();
    setState({ status: 'anon', session: null });
    throw e instanceof AuthError ? e : new AuthError('登录状态已失效,请重新登录', 'refresh_failed');
  }
}

export async function signIn(email: string, password: string): Promise<AuthSession> {
  return adopt(await signInWithPassword(email.trim(), password));
}

/** 注册;返回 null 表示后端要求先验证邮箱(本项目已关闭该开关) */
export async function register(
  email: string,
  password: string,
  nickname: string,
): Promise<AuthSession | null> {
  const session = await signUpRemote(email.trim(), password, nickname.trim());
  if (session) await adopt(session);
  return session;
}

export async function signOut(): Promise<void> {
  const current = state.session;
  // 先清本地:即使网络失败(比如离线),用户点的"退出登录"也必须立刻生效
  await clearStoredSession();
  setState({ status: 'anon', session: null });
  if (current) {
    try {
      await signOutRemote(current.accessToken);
    } catch {
      // 后端撤销失败不影响本地退出;token 到期后自然失效
    }
  }
}

/** 已登录时直接改密码(需要当前密码由后端二次确认) */
export async function changePassword(password: string): Promise<void> {
  await updatePasswordRemote(await ensureAccessToken(), password);
}

/** 忘记密码第一步:发验证码邮件 */
export async function requestPasswordReset(email: string): Promise<void> {
  await sendRecoveryEmail(email.trim());
}

/** 忘记密码第二步:验证码换新密码(顺带完成登录) */
export async function resetPasswordWithCode(
  email: string,
  code: string,
  newPassword: string,
): Promise<void> {
  const session = await verifyRecoveryCode(email.trim(), code.trim());
  await updatePasswordRemote(session.accessToken, newPassword);
  await adopt(session);
}
