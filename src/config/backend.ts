/**
 * 在线服务(Supabase)配置 —— 全项目唯一读取后端地址的地方。
 *
 * 关于密钥:这里的 key 是 Supabase 的**公开密钥**(publishable / anon),
 * 设计上就是放进客户端分发的,它不是机密。能不能读到数据由数据库的
 * 行级权限(RLS)+ 用户 token 决定:拿到这个 key 也读不到别人的数据。
 * 真正机密的 service_role / secret key 绝不能出现在客户端代码里。
 *
 * 想换项目(比如自建 Supabase),改下面两行或设环境变量
 * EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_KEY 即可。
 */

const FALLBACK_URL = 'https://saqgqexmcrygpyyndknt.supabase.co';
const FALLBACK_KEY = 'sb_publishable_cwDnleuQwfo4O1igX5sBnw_gh4QwvY6';

export const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? FALLBACK_URL).replace(/\/+$/, '');
export const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? FALLBACK_KEY;

/** Auth 服务(注册/登录/改密)基地址 */
export const AUTH_BASE = `${SUPABASE_URL}/auth/v1`;
/** 数据库自动生成的 REST 接口基地址 */
export const REST_BASE = `${SUPABASE_URL}/rest/v1`;

/** 是否已经配置了在线服务(没配置时 UI 明确提示,而不是假装能用) */
export const isBackendConfigured = SUPABASE_URL.length > 0 && SUPABASE_KEY.length > 0;
