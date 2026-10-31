/**
 * 存储损坏保护（P2-11）。
 *
 * 报告指出的问题:`getWords()` 等读取函数把**解析失败/IO 失败**和"确实没有数据"
 * 都 `return []`。而 `saveWord` 又是"先 getWords() 再 setItem" —— 一次读取失败
 * 之后的下一次保存,就会把全量生词替换成"仅这一条"。
 * (同类模式出现在 learning / checkins / progress。)
 *
 * 做法:
 *  1. 读取时区分"没有数据"(raw 为空)与"解析失败"(损坏);
 *  2. 发现损坏时把原始值另存到 `readingapp.corrupt.<key>.<时间戳>`,便于排查/恢复;
 *  3. 向调用方抛 `StorageCorruptError`,写操作据此**拒绝覆盖**(宁可不写,也不毁数据)。
 *
 * 为什么不是"自动修复成空数组":那正是数据被覆盖的起点。宁可让上层报错。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export class StorageCorruptError extends Error {
  constructor(
    public readonly key: string,
    public readonly backupKey: string,
  ) {
    super(`本地数据「${key}」读取失败(可能已损坏),已备份到 ${backupKey},暂停写入以免覆盖`);
    this.name = 'StorageCorruptError';
  }
}

/**
 * 安全读取一个 JSON 值。
 * @returns null = 没有数据;否则返回解析后的值
 * @throws StorageCorruptError 解析失败(原始值已另存)
 */
export async function readJsonSafe<T>(key: string): Promise<T | null> {
  let raw: string | null = null;
  try {
    raw = await AsyncStorage.getItem(key);
  } catch {
    // 读不出来属于 IO 故障,没有原始值可备份,直接抛(上层可选择跳过)
    throw new StorageCorruptError(key, '(读取失败,无副本)');
  }
  if (raw == null || raw === '') return null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    const backupKey = `readingapp.corrupt.${key}.${Date.now()}`;
    try {
      await AsyncStorage.setItem(backupKey, raw);
    } catch {
      // 备份失败也要让错误继续抛:至少不要覆盖原数据
    }
    throw new StorageCorruptError(key, backupKey);
  }
}

/** 仅用于日志/诊断:列出曾保存过的损坏副本 */
export async function listCorruptBackups(): Promise<string[]> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    return keys.filter((k) => k.startsWith('readingapp.corrupt.')).sort();
  } catch {
    return [];
  }
}
