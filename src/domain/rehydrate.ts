/**
 * 导入/恢复之后的**内存缓存重建**（P1-5）。
 *
 * 为什么需要:很多模块把常用数据缓存在内存里(归属、同步基线、复习统计、时钟偏移、
 * 主题偏好)。`importBackup()` 只写 AsyncStorage,不碰内存 ——
 * 于是"导入成功"以后界面仍显示旧数据,只能杀进程重启(账号页以前就写着"请重启 App 生效")。
 *
 * 这里把各模块的 hydrate 串起来,导入后调一次即可热生效。
 */

import { hydrateClock } from '@/domain/clock';
import { hydrateThemePrefs } from '@/hooks/use-theme-pref';
import { hydrateLocalOwner } from '@/storage/local-owner';
import { hydrateReviewStats } from '@/storage/review-stats';
import { hydrateSyncState } from '@/storage/sync-state';

export async function rehydrateAfterImport(): Promise<void> {
  await Promise.all([
    hydrateLocalOwner(),
    hydrateReviewStats(),
    hydrateSyncState(),
    hydrateClock(),
    hydrateThemePrefs(),
  ]);
}
