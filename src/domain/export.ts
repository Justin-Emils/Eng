/**
 * 数据导出(模块 G):生词本导出 CSV 文本。
 * 纯函数生成内容,由 UI 调用 Clipboard 复制。
 */

import type { WordItem } from '@/types';

/** 转义 CSV 字段(引号翻倍包裹,防止乱码/逗号问题) */
function csvCell(value: string): string {
  const s = (value ?? '').replace(/"/g, '""');
  return `"${s}"`;
}

/** 生词列表 → CSV 文本(UTF-8 BOM 由 UI 层决定是否加) */
export function wordsToCsv(words: WordItem[]): string {
  const header = ['headword', 'word', 'pos', 'zh', 'en', 'example', 'sourceArticleId', 'status'];
  const rows = words.map((w) =>
    [
      w.headword,
      w.word,
      w.pos,
      w.zh,
      w.en,
      w.example ?? '',
      w.sourceArticleId,
      w.status,
    ]
      .map((c) => csvCell(String(c)))
      .join(','),
  );
  return [header.join(','), ...rows].join('\n');
}
