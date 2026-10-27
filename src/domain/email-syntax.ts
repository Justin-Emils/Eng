/**
 * 邮箱格式与笔误校验（纯函数,不碰存储与网络）。
 *
 * 单独拆出来的原因:MX 查询需要网络与缓存(见 email-check.ts),
 * 而格式规则是纯计算 —— 拆开后验证脚本可以在 Node 里直接跑,
 * 不用给 AsyncStorage 打桩。
 *
 * 规则比"有个 @ 和点"严:
 *  · 总长 ≤ 254,@ 前 ≤ 64(RFC 5321);
 *  · @ 前只允许常见可打印字符,不能以点开头/结尾,不能有连续两个点;
 *  · 域名至少两段,每段 1–63 字符、字母数字开头结尾、中间可带连字符;
 *  · 顶级域必须是纯字母且 ≥ 2 位。
 */

/** 邮箱总长上限(RFC 5321:路径 254 字符) */
export const EMAIL_MAX_LENGTH = 254;
const LOCAL_MAX_LENGTH = 64;

/** local 部分允许的字符(不含引号形式,那种在自用场景里没有意义) */
const LOCAL_RE = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+$/;
/** 域名的每一段:字母数字开头结尾,中间可带连字符 */
const LABEL_RE = /^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?$/;

/**
 * 高频错拼 → 正确域名。
 * 只收真实见过、且改一两个字符就会发生的错误,不做通用模糊匹配 ——
 * 通用匹配会误改正常域名。
 */
export const TYPO_DOMAINS: Record<string, string> = {
  'gmial.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gmail.cm': 'gmail.com',
  'gmal.com': 'gmail.com',
  'qq.con': 'qq.com',
  'qq.co': 'qq.com',
  'qq.cm': 'qq.com',
  '163.con': '163.com',
  '163.co': '163.com',
  '162.com': '163.com',
  '126.con': '126.com',
  'outlok.com': 'outlook.com',
  'outllook.com': 'outlook.com',
  'hotmial.com': 'hotmail.com',
  'hotmail.con': 'hotmail.com',
  'yaho.com': 'yahoo.com',
  'yahoo.con': 'yahoo.com',
  'iclod.com': 'icloud.com',
  'icloud.con': 'icloud.com',
  'sina.con': 'sina.com',
  'foxmial.com': 'foxmail.com',
  'foxmail.con': 'foxmail.com',
};

/** 顶级域错拼 → 正确写法(只在域名由两段组成时生效) */
const TLD_FIX: Record<string, string> = {
  con: 'com',
  cmo: 'com',
  comm: 'com',
  coom: 'com',
  ocm: 'com',
  cm: 'com',
  co: 'com',
};

/** 规范化:去空白 + 转小写(邮箱域名不区分大小写,local 部分实际也很少区分) */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** 拆成 local / domain;形状不对返回 null */
export function splitEmail(value: string): { local: string; domain: string } | null {
  const v = normalizeEmail(value);
  const at = v.lastIndexOf('@');
  if (at <= 0 || at === v.length - 1) return null;
  const local = v.slice(0, at);
  const domain = v.slice(at + 1);
  if (local.includes('@')) return null;
  return { local, domain };
}

/** 疑似笔误的纠正建议;没有则返回 null */
export function suggestEmail(value: string): string | null {
  const parts = splitEmail(value);
  if (!parts) return null;
  const { local, domain } = parts;

  const mapped = TYPO_DOMAINS[domain];
  if (mapped) return `${local}@${mapped}`;

  const dot = domain.lastIndexOf('.');
  if (dot > 0) {
    const tld = domain.slice(dot + 1);
    const better = TLD_FIX[tld];
    if (better) return `${local}@${domain.slice(0, dot + 1)}${better}`;
  }
  return null;
}

/**
 * 格式校验。返回给用户看的中文错误(符合项目里"同一个错误到处同一句话"的约定),
 * 合法返回 null。有笔误建议时会拼进错误信息里。
 */
export function emailSyntaxError(value: string): string | null {
  const v = normalizeEmail(value);
  if (!v) return '请输入邮箱';
  if (v.length > EMAIL_MAX_LENGTH) return '邮箱太长了,请检查是否输错';
  if (/\s/.test(v)) return '邮箱里不能有空格';

  const parts = splitEmail(v);
  if (!parts) return '邮箱格式不正确,需要形如 name@example.com';
  const { local, domain } = parts;

  const suggestion = suggestEmail(v);
  const hint = suggestion ? `(你是不是想输入 ${suggestion}?)` : '';

  if (local.length > LOCAL_MAX_LENGTH) return `@ 前面太长了${hint}`;
  if (local.startsWith('.') || local.endsWith('.')) return `@ 前面不能以点开头或结尾${hint}`;
  if (local.includes('..')) return `@ 前面不能有连续的两个点${hint}`;
  if (!LOCAL_RE.test(local)) return `邮箱里有不支持的字符${hint}`;

  const labels = domain.split('.');
  if (labels.length < 2) return `邮箱域名不完整,需要形如 example.com${hint}`;
  if (labels.some((label) => label.length === 0)) return `邮箱域名里有空的段,请检查` + hint;
  if (labels.some((label) => label.length > 63)) return '邮箱域名某一段太长了' + hint;
  if (!labels.every((label) => LABEL_RE.test(label))) return '邮箱域名里只能有字母、数字和连字符' + hint;
  const tld = labels[labels.length - 1];
  if (!/^[A-Za-z]{2,}$/.test(tld)) return `邮箱域名结尾不对${hint}`;

  return null;
}
