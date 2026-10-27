/**
 * 邮箱域名的**收信能力**检查（B1），走 DNS-over-HTTPS。
 *
 * 为什么需要:假邮箱也能注册,于是「忘记密码」对那些账号形同虚设 ——
 * 验证码发到一个不存在的域名,用户会一直等一封永远不会来的邮件。
 *
 * 为什么用 DoH 而不是系统 DNS:React Native 没有 DNS API;
 * Cloudflare 的 `dns-query` 公开、免 key、返回 JSON,一条 GET 就能查 MX。
 *
 * 三条纪律:
 *  · **离线不阻断**:查不到就返回 unknown 让用户继续 —— 不能因为网络问题把人挡在门外;
 *  · **结果缓存 7 天**:同一域名不反复查;
 *  · **只给提示,不替用户决定**:没有 MX 时由界面二次确认
 *    (少数域名确实用 A 记录兜底收信)。
 *
 * 纯格式规则在 `email-syntax.ts`(那里不碰网络,验证脚本可直接跑)。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { splitEmail } from '@/domain/email-syntax';

export {
  emailSyntaxError,
  normalizeEmail,
  suggestEmail,
  splitEmail,
  TYPO_DOMAINS,
} from '@/domain/email-syntax';

const MX_CACHE_KEY = 'readingapp.emailmx.v1';
const MX_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MX_TIMEOUT_MS = 4000;

export type MxStatus = 'ok' | 'a-only' | 'no-records' | 'unknown';

export interface MxResult {
  status: MxStatus;
  /** 给用户看的一句话 */
  detail: string;
}

interface CacheEntry extends MxResult {
  checkedAt: number;
}
type CacheMap = Record<string, CacheEntry>;

let cache: CacheMap | null = null;

async function readCache(): Promise<CacheMap> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(MX_CACHE_KEY);
    cache = raw ? (JSON.parse(raw) as CacheMap) : {};
  } catch {
    cache = {};
  }
  return cache;
}

async function writeCache(domain: string, entry: CacheEntry): Promise<void> {
  const map = await readCache();
  map[domain] = entry;
  try {
    await AsyncStorage.setItem(MX_CACHE_KEY, JSON.stringify(map));
  } catch {
    // 忽略
  }
}

interface DohAnswer {
  type?: number;
  data?: string;
}
interface DohResponse {
  Status?: number;
  Answer?: DohAnswer[];
}

/**
 * DoH 提供方,**按顺序尝试**。
 *
 * 顺序不是随便排的:实测这台机器(国内网络)访问 cloudflare-dns.com 会 ECONNRESET,
 * 而阿里与腾讯的 DoH 都正常 —— 所以国内两家排前面,Cloudflare 只作海外兜底。
 * 三家返回的都是同一套 JSON 形状(Status + Answer[].type),解析逻辑可以共用。
 */
const DOH_PROVIDERS: { name: string; url: string }[] = [
  { name: '阿里', url: 'https://dns.alidns.com/resolve' },
  { name: '腾讯', url: 'https://doh.pub/dns-query' },
  { name: 'Cloudflare', url: 'https://cloudflare-dns.com/dns-query' },
];

/** 查一条记录;依次尝试各提供方,全失败返回 null(交给调用方降级) */
async function dohQuery(name: string, type: 'MX' | 'A'): Promise<DohResponse | null> {
  for (const provider of DOH_PROVIDERS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), MX_TIMEOUT_MS);
    try {
      const res = await fetch(
        `${provider.url}?name=${encodeURIComponent(name)}&type=${type}`,
        { headers: { accept: 'application/dns-json' }, signal: controller.signal },
      );
      if (!res.ok) continue;
      const json = (await res.json()) as DohResponse;
      // Status 缺失说明这不是我们认识的 DoH 响应,换下一家
      if (typeof json.Status !== 'number') continue;
      return json;
    } catch {
      // 超时 / 被拦截:换下一家
      continue;
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

/**
 * 查邮箱域名的收信能力。
 *
 *   ok         有 MX 记录 —— 正常可以收信
 *   a-only     没有 MX 但域名能解析(理论上可兜底收信,提示但允许继续)
 *   no-records 域名不存在(几乎肯定是拼错了)
 *   unknown    查询失败(离线 / 被拦截)—— **不阻断注册**
 */
export async function checkEmailDomain(email: string): Promise<MxResult> {
  const parts = splitEmail(email);
  if (!parts) return { status: 'unknown', detail: '邮箱格式无法解析' };
  const { domain } = parts;

  const map = await readCache();
  const cached = map[domain];
  if (cached && Date.now() - cached.checkedAt < MX_TTL_MS) {
    return { status: cached.status, detail: cached.detail };
  }

  const mx = await dohQuery(domain, 'MX');
  let result: MxResult;
  if (!mx) {
    result = { status: 'unknown', detail: '域名查询失败(可能离线),已跳过检查' };
  } else if (mx.Status === 3) {
    result = { status: 'no-records', detail: `${domain} 这个域名不存在,请检查拼写` };
  } else if ((mx.Answer ?? []).some((a) => a.type === 15)) {
    result = { status: 'ok', detail: '域名有邮件服务器' };
  } else {
    const a = await dohQuery(domain, 'A');
    if (!a) {
      result = { status: 'unknown', detail: '域名查询失败(可能离线),已跳过检查' };
    } else if (a.Status === 3) {
      result = { status: 'no-records', detail: `${domain} 这个域名不存在,请检查拼写` };
    } else if ((a.Answer ?? []).some((x) => x.type === 1)) {
      result = {
        status: 'a-only',
        detail: `${domain} 没有独立的邮件服务器,可能收不到验证码`,
      };
    } else {
      result = { status: 'no-records', detail: `${domain} 查不到任何记录,请检查拼写` };
    }
  }

  await writeCache(domain, { ...result, checkedAt: Date.now() });
  return result;
}
