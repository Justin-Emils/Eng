/**
 * 认证接口客户端(直接调用 Supabase Auth 的 HTTP 接口,不引入额外 SDK)。
 *
 * 为什么手写而不是装 @supabase/supabase-js:
 * 1. 我们只用到 6 个接口,手写有明确边界,出错时栈里全是自己的代码;
 * 2. RN 上那个 SDK 还要拉 url-polyfill 等一堆依赖,体积和坑都不划算;
 * 3. 接口是稳定的 REST(Auth 服务 = GoTrue),字段名见下面各处注释。
 *
 * 本文件只负责"把请求发出去 + 把错误翻译成人话",不保存任何状态。
 */

import { AUTH_BASE, SUPABASE_KEY } from '@/config/backend';

export interface AuthUser {
  id: string;
  email: string;
  createdAt: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  /** 过期时间(秒级时间戳),用于判断是否需要续期 */
  expiresAt: number;
  user: AuthUser;
}

/** 认证类错误:message 已经是给用户看的中文,code 用于 UI 分支判断 */
export class AuthError extends Error {
  readonly code: string;

  constructor(message: string, code = 'unknown') {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}

/** 后端错误码 → 中文提示。表里没有的走兜底(保留后端原文,便于排查) */
const ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: '邮箱或密码不正确',
  email_not_confirmed: '这个邮箱还没完成验证,请先在邮箱里点确认链接',
  user_already_exists: '这个邮箱已经注册过了,直接登录即可',
  email_exists: '这个邮箱已经注册过了,直接登录即可',
  weak_password: '密码太简单了,请换一个更长或更复杂的',
  email_address_invalid: '邮箱格式不正确',
  email_address_not_authorized: '后端未开放向该邮箱发信',
  signup_disabled: '该后端已关闭注册',
  user_not_found: '这个邮箱还没有注册',
  otp_expired: '验证码错误或已过期,请重新获取',
  over_email_send_rate_limit: '邮件发送太频繁了,请等几分钟再试(免费版有小时级限速)',
  over_request_rate_limit: '操作太频繁了,请稍后再试',
  same_password: '新密码不能和当前密码相同',
  session_not_found: '登录状态已失效,请重新登录',
  refresh_token_not_found: '登录状态已失效,请重新登录',
  validation_failed: '填写的内容不符合要求,请检查后重试',
  reauthentication_needed: '为安全起见,请重新登录后再操作',
};

function translateError(status: number, body: unknown): AuthError {
  const raw = (body ?? {}) as Record<string, unknown>;
  const code =
    (typeof raw.error_code === 'string' && raw.error_code) ||
    (typeof raw.code === 'string' && raw.code) ||
    (typeof raw.error === 'string' && raw.error) ||
    `http_${status}`;

  const backendText =
    (typeof raw.msg === 'string' && raw.msg) ||
    (typeof raw.message === 'string' && raw.message) ||
    (typeof raw.error_description === 'string' && raw.error_description) ||
    '';

  const mapped = ERROR_MESSAGES[code];
  if (mapped) return new AuthError(mapped, code);

  if (status === 401 || status === 403) return new AuthError('登录状态已失效,请重新登录', code);
  if (status === 429) return new AuthError('操作太频繁了,请稍后再试', code);
  if (status >= 500) return new AuthError('服务器暂时不可用,请稍后重试', code);
  return new AuthError(backendText || `请求失败(${status})`, code);
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH';
  body?: unknown;
  /** 已登录用户的 access_token;不传则用公开密钥(仅注册/登录/找回密码需要) */
  token?: string;
  timeoutMs?: number;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'POST', body, token, timeoutMs = 15000 } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${AUTH_BASE}${path}`, {
      method,
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${token ?? SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    const aborted = e instanceof Error && e.name === 'AbortError';
    throw new AuthError(aborted ? '请求超时,请检查网络后重试' : '网络连接失败,请检查网络后重试', 'network');
  }
  clearTimeout(timer);

  const text = await response.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }

  if (!response.ok) throw translateError(response.status, parsed);
  return (parsed ?? {}) as T;
}

interface RawSession {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  expires_at?: number;
  user?: { id?: string; email?: string; created_at?: string };
}

function toSession(raw: RawSession): AuthSession | null {
  if (!raw.access_token || !raw.refresh_token || !raw.user?.id) return null;
  const expiresAt =
    typeof raw.expires_at === 'number'
      ? raw.expires_at
      : Math.floor(Date.now() / 1000) + (raw.expires_in ?? 3600);
  return {
    accessToken: raw.access_token,
    refreshToken: raw.refresh_token,
    expiresAt,
    user: {
      id: raw.user.id,
      email: raw.user.email ?? '',
      createdAt: raw.user.created_at ?? new Date().toISOString(),
    },
  };
}

/**
 * 注册。
 * 后端关闭了"邮箱确认"时直接返回登录态;若后端要求确认,则返回 null,
 * 由 UI 提示用户去邮箱确认(本项目已在控制台关掉该开关)。
 */
export async function signUp(
  email: string,
  password: string,
  nickname: string,
): Promise<AuthSession | null> {
  const raw = await request<RawSession>('/signup', {
    body: { email, password, data: { nickname } },
  });
  return toSession(raw);
}

export async function signInWithPassword(email: string, password: string): Promise<AuthSession> {
  const raw = await request<RawSession>('/token?grant_type=password', {
    body: { email, password },
  });
  const session = toSession(raw);
  if (!session) throw new AuthError('登录失败:后端未返回有效登录态', 'no_session');
  return session;
}

export async function refreshSession(refreshToken: string): Promise<AuthSession> {
  const raw = await request<RawSession>('/token?grant_type=refresh_token', {
    body: { refresh_token: refreshToken },
  });
  const session = toSession(raw);
  if (!session) throw new AuthError('登录状态已失效,请重新登录', 'refresh_failed');
  return session;
}

export async function signOutRemote(token: string): Promise<void> {
  await request('/logout', { token });
}

/** 拉取当前用户(用于启动时校验本地 token 是否仍然有效) */
export async function fetchUser(token: string): Promise<AuthUser> {
  const raw = await request<{ id?: string; email?: string; created_at?: string }>('/user', {
    method: 'GET',
    token,
  });
  if (!raw.id) throw new AuthError('登录状态已失效,请重新登录', 'session_not_found');
  return {
    id: raw.id,
    email: raw.email ?? '',
    createdAt: raw.created_at ?? new Date().toISOString(),
  };
}

/** 已登录状态下修改密码(不需要邮箱验证码) */
export async function updatePassword(token: string, password: string): Promise<void> {
  await request('/user', { method: 'PUT', token, body: { password } });
}

/** 忘记密码第一步:向邮箱发送 6 位验证码(需后端邮件模板包含 {{ .Token }}) */
export async function sendRecoveryEmail(email: string): Promise<void> {
  await request('/recover', { body: { email } });
}

/**
 * 忘记密码第二步:用验证码换登录态。
 * 拿到登录态后即可调用 updatePassword 设置新密码 —— 全程不需要点邮件里的链接,
 * 因此在 Android 上不用配置深链回调,国内也最稳。
 */
export async function verifyRecoveryCode(email: string, code: string): Promise<AuthSession> {
  const raw = await request<RawSession>('/verify', {
    body: { type: 'recovery', email, token: code },
  });
  const session = toSession(raw);
  if (!session) throw new AuthError('验证码验证失败,请重新获取', 'verify_failed');
  return session;
}
