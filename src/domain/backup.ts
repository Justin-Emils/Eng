/**
 * 本地数据备份 / 恢复(模块 F)。
 *
 * 用途:换手机、重装 App 时把学习数据带走 —— 这是"没有云端"时最实用的迁移方式,
 * 也是将来接云同步时同步内容的白名单(同一批 key)。
 *
 * 形式:把所有相关 key 打包成一个 JSON 字符串,导出到剪贴板 / 从剪贴板导入。
 * 刻意不做成"导出文件":Android 上应用私有目录不好取,剪贴板粘贴到微信/备忘录最省事。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { bindLocalOwner, getLocalOwnerSync } from '@/storage/local-owner';

/** 需要备份的存储键(与各 storage 模块保持一致) */
/**
 * 备份的键白名单 —— **只放用户数据**。
 *
 * 以前这里还包含 readingapp.remote.v1(远程文章缓存),那份内容带着整篇正文,
 * 一次导出 56 KB,剪贴板根本粘不完整。文章属于「可以重新下载的缓存」,不是用户资产:
 * 备份里只留进度与生词,换设备后重新拉取即可。
 */
export const BACKUP_KEYS = [
  'readingapp.words.v1',
  'readingapp.learning.v1',
  'readingapp.known.v1',
  'readingapp.progress.v1',
  'readingapp.checkins.v1',
  'readingapp.userlevel.v1',
  'readingapp.settings.v1',
  'readingapp.account.v1',
  'readingapp.corpus.recent-books.v1',
  'readingapp.storage.version',
] as const;

/** 备份文件格式版本 */
const BACKUP_VERSION = 1;

export interface BackupPayload {
  app: 'article-reading';
  version: number;
  exportedAt: string;
  /**
   * 这份数据原本属于哪个账号(B2/B5 的跨设备校验)。
   *
   * 为什么必须带:备份是可以随便转发的 JSON —— 把导出的备份发给别人导入,
   * 对方就能凭空得到一份完全相同的数据。有了归属 id,导入时就能判断
   * "这份备份是不是你的";不一致时默认拒绝,要求明确确认。
   */
  ownerId?: string | null;
  ownerEmail?: string;
  /** key → 原始字符串值 */
  data: Record<string, string>;
}

/** 生成备份 JSON 字符串 */
export async function exportBackup(): Promise<string> {
  const pairs = await AsyncStorage.multiGet([...BACKUP_KEYS]);
  const data: Record<string, string> = {};
  for (const [key, value] of pairs) {
    if (typeof value === 'string') data[key] = value;
  }
  const payload: BackupPayload = {
    app: 'article-reading',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    ownerId: getLocalOwnerSync()?.accountId ?? null,
    ownerEmail: getLocalOwnerSync()?.email ?? '',
    data,
  };
  return JSON.stringify(payload);
}

/** 备份摘要(给 UI 展示:包含哪些内容、多大) */
export function describeBackup(raw: string): string {
  const payload = parseBackup(raw);
  if (!payload) return '内容不是本 App 的备份';
  const sizeKb = Math.max(1, Math.round(raw.length / 1024));
  const parts: string[] = [];
  const count = (key: string, label: string) => {
    const v = payload.data[key];
    if (!v) return;
    try {
      const parsed = JSON.parse(v) as unknown;
      const n = Array.isArray(parsed)
        ? parsed.length
        : typeof parsed === 'object' && parsed !== null
          ? Object.keys(parsed as Record<string, unknown>).length
          : 0;
      if (n > 0) parts.push(`${label} ${n}`);
    } catch {
      // 忽略解析失败项
    }
  };
  count('readingapp.words.v1', '生词');
  count('readingapp.learning.v1', '已学记录');
  count('readingapp.progress.v1', '阅读进度');
  count('readingapp.checkins.v1', '打卡记录');
  // 归属信息要一起报出来:导入前用户最该知道的就是"这份数据是谁的"
  const owner = payload.ownerEmail
    ? `归属 ${payload.ownerEmail}`
    : payload.ownerId
      ? '归属另一个账号'
      : '归属:未绑定账号';
  return `包含 ${parts.length > 0 ? parts.join(' · ') : '基础设置'} · 约 ${sizeKb} KB · ${owner}`;
}

/** 解析并校验备份内容 */
export function parseBackup(raw: string): BackupPayload | null {
  try {
    const parsed = JSON.parse(raw.trim()) as Partial<BackupPayload>;
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.app !== 'article-reading') return null;
    if (!parsed.data || typeof parsed.data !== 'object') return null;
    const data: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed.data)) {
      if (BACKUP_KEYS.includes(k as (typeof BACKUP_KEYS)[number]) && typeof v === 'string') {
        data[k] = v;
      }
    }
    if (Object.keys(data).length === 0) return null;
    return {
      app: 'article-reading',
      version: typeof parsed.version === 'number' ? parsed.version : BACKUP_VERSION,
      exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : '',
      ownerId: typeof parsed.ownerId === 'string' ? parsed.ownerId : null,
      ownerEmail: typeof parsed.ownerEmail === 'string' ? parsed.ownerEmail : '',
      data,
    };
  } catch {
    return null;
  }
}

/**
 * 用备份覆盖本机数据。
 * @returns 写入了多少个键(0 表示备份里没有可识别的数据)
 */
export async function importBackup(
  raw: string,
  options: { adoptOwner?: boolean } = {},
): Promise<number> {
  const payload = parseBackup(raw);
  if (!payload) throw new Error('备份内容无法识别(请确认是从本 App 导出的)');

  /**
   * 归属校验:备份带来源账号、且与本机数据归属不同时,**默认拒绝导入**。
   * 这挡住了"同一份备份发给多人导入 → 凭空复制出多份相同数据"的情况;
   * 确实需要强制导入时,由调用方带 adoptOwner 明确表示。
   */
  const local = getLocalOwnerSync();
  if (payload.ownerId && local && payload.ownerId !== local.accountId && !options.adoptOwner) {
    throw new Error(
      `这份备份属于 ${payload.ownerEmail || '另一个账号'},与本机数据的归属不一致,已拒绝导入。` +
        '确实要强制导入时,请先在账号页解除本机归属(或确认改用该备份)。',
    );
  }

  const entries = Object.entries(payload.data);
  await AsyncStorage.multiSet(entries);
  // 强制导入后,本机数据的归属改为备份的来源账号(内容已经变成它的了)
  if (options.adoptOwner && payload.ownerId) {
    await bindLocalOwner({ accountId: payload.ownerId, email: payload.ownerEmail ?? '' });
  }
  return entries.length;
}
