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

/** 需要备份的存储键(与各 storage 模块保持一致) */
export const BACKUP_KEYS = [
  'readingapp.words.v1',
  'readingapp.learning.v1',
  'readingapp.known.v1',
  'readingapp.progress.v1',
  'readingapp.checkins.v1',
  'readingapp.userlevel.v1',
  'readingapp.settings.v1',
  'readingapp.account.v1',
  'readingapp.remote.v1',
  'readingapp.corpus.recent-books.v1',
  'readingapp.storage.version',
] as const;

/** 备份文件格式版本 */
const BACKUP_VERSION = 1;

export interface BackupPayload {
  app: 'article-reading';
  version: number;
  exportedAt: string;
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
  return `包含 ${parts.length > 0 ? parts.join(' · ') : '基础设置'} · 约 ${sizeKb} KB`;
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
export async function importBackup(raw: string): Promise<number> {
  const payload = parseBackup(raw);
  if (!payload) throw new Error('备份内容无法识别(请确认是从本 App 导出的)');
  const entries = Object.entries(payload.data);
  await AsyncStorage.multiSet(entries);
  return entries.length;
}
