/**
 * 认证表单校验(中文提示,页面共用,保证同一个错误在哪个页面都同一句话)。
 * 这里只做"明显错误就地拦住",不追求复杂规则 —— 真正的强密码策略由后端把关。
 */

import { emailSyntaxError } from '@/domain/email-check';

/** Supabase 默认要求密码至少 6 位;这里按同样下限校验,避免白跑一趟请求 */
export const MIN_PASSWORD_LENGTH = 6;

/**
 * 邮箱格式校验。
 *
 * 实现在 `domain/email-check.ts`:那里除了格式,还有常见错拼的建议
 * (如 `gmial.com` → `gmail.com`),建议会拼进错误信息里,三个页面都能看到。
 * 域名能否收信(MX)是**异步**检查,由注册 / 找回密码页面另外做 —— 见 B1。
 */
export function validateEmail(value: string): string | null {
  return emailSyntaxError(value);
}

export function validatePassword(value: string): string | null {
  if (!value) return '请输入密码';
  if (value.length < MIN_PASSWORD_LENGTH) return `密码至少 ${MIN_PASSWORD_LENGTH} 位`;
  return null;
}

/** 注册/改密时的确认密码 */
export function validatePasswordConfirm(password: string, confirm: string): string | null {
  if (!confirm) return '请再输入一次密码';
  if (password !== confirm) return '两次输入的密码不一致';
  return null;
}

/** 昵称(可选):只限制长度,空也是合法的 */
export function validateNickname(value: string): string | null {
  if (value.trim().length > 12) return '昵称最多 12 个字';
  return null;
}

/**
 * 邮箱验证码。
 *
 * 位数**不写死**:Supabase 的 OTP 长度是后端可配的(常见 6 位,新项目实测 8 位),
 * 之前按 6 位校验导致 8 位验证码被判"格式错误",这里只做"是否纯数字 + 长度合理"的判断,
 * 真正的对错由后端比对。
 */
export function validateCode(value: string): string | null {
  const v = value.trim();
  if (!v) return '请输入邮箱里的验证码';
  if (!/^\d+$/.test(v)) return '验证码只包含数字';
  if (v.length < 6 || v.length > 10) return '验证码位数不对,请照邮件里的原样输入';
  return null;
}
