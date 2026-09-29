/**
 * 同步状态(自动同步用):记住"上次推到云端的指纹与时间"。
 *
 * 为什么需要指纹而不是时间戳:时间戳只能说明"什么时候同步过",
 * 不能说明"本机数据从那以后有没有变过"。指纹是备份内容的哈希 ——
 * 内容一致就跳过上传,省流量也省 Supabase 的额度(免费版有额度限制)。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const SYNC_STATE_KEY = 'readingapp.syncstate.v1';

export interface SyncState {
  /** 上次成功上传的备份内容指纹(djb2 哈希) */
  lastHash: string;
  /** 上次成功上传的时间(ms) */
  lastPushedAt: number;
  /** 上次从云端恢复的时间(ms) */
  lastPulledAt: number;
}

const EMPTY: SyncState = { lastHash: '', lastPushedAt: 0, lastPulledAt: 0 };

let cache: SyncState = EMPTY;
let hydrated = false;

export function getSyncStateSync(): SyncState {
  return cache;
}

export async function hydrateSyncState(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(SYNC_STATE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SyncState>;
      cache = {
        lastHash: typeof parsed.lastHash === 'string' ? parsed.lastHash : '',
        lastPushedAt: typeof parsed.lastPushedAt === 'number' ? parsed.lastPushedAt : 0,
        lastPulledAt: typeof parsed.lastPulledAt === 'number' ? parsed.lastPulledAt : 0,
      };
    }
  } catch {
    // 读失败按"从未同步"处理:下一次会自动传一次,不会丢数据
  }
  hydrated = true;
}

export async function saveSyncState(patch: Partial<SyncState>): Promise<void> {
  cache = { ...cache, ...patch };
  hydrated = true;
  try {
    await AsyncStorage.setItem(SYNC_STATE_KEY, JSON.stringify(cache));
  } catch {
    // 忽略:写失败只会让下次多传一次
  }
}

export async function clearSyncState(): Promise<void> {
  cache = EMPTY;
  try {
    await AsyncStorage.removeItem(SYNC_STATE_KEY);
  } catch {
    // 忽略
  }
}

export function syncStateHydrated(): boolean {
  return hydrated;
}

/**
 * 内容指纹(djb2):同一份备份永远得到同一个值。
 * 不追求抗碰撞 —— 它只用来判断"本机数据有没有变",不是安全校验。
 */
export function hashString(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16);
}
