/**
 * 认证表单校验(中文提示,页面共用,保证同一个错误在哪个页面都同一句话)。
 * 这里只做"明显错误就地拦住",不追求复杂规则 —— 真正的强密码策略由后端把关。
 */

/** 邮箱:够用的形状校验(不追求 RFC 完整实现) */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;

/** Supabase 默认要求密码至少 6 位;这里按同样下限校验,避免白跑一趟请求 */
export const MIN_PASSWORD_LENGTH = 6;

export function validateEmail(value: string): string | null {
  const v = value.trim();
  if (!v) return '请输入邮箱';
  if (!EMAIL_RE.test(v)) return '邮箱格式不正确';
  return null;
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

/** 邮箱验证码:后端发的是 6 位数字 */
export function validateCode(value: string): string | null {
  const v = value.trim();
  if (!v) return '请输入邮箱里的验证码';
  if (!/^\d{6}$/.test(v)) return '验证码是 6 位数字';
  return null;
}
