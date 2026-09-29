/**
 * 数据导出(模块 G):生词本导出 CSV 文本。
 * 纯函数生成内容,由 UI 调用 Clipboard 复制。
 *
 * 默认导出**精简列**:以前把英文释义(en)与例句(example)也塞进去,每行几百字符,
 * 粘到 Excel 里根本没法看 —— 那份 CSV 的用途是"看自己收了哪些词、状态如何",
 * 不是背释义(释义在 App 里看)。需要完整数据时传 `{ detailed: true }`。
 */

import type { WordItem } from '@/types';

/** 转义 CSV 字段(引号翻倍包裹,防止乱码/逗号问题) */
function csvCell(value: string): string {
  const s = (value ?? '').replace(/"/g, '""');
  return `"${s}"`;
}

/**
 * 生词列表 → CSV 文本(UTF-8 BOM 由 UI 层决定是否加)。
 *
 * @param words 生词列表
 * @param options.detailed 是否附上英文释义与例句(默认否,只导出人看得懂的列)
 */
export function wordsToCsv(words: WordItem[], options: { detailed?: boolean } = {}): string {
  const { detailed = false } = options;

  const header = detailed
    ? ['单词', '原形', '词性', '中文', '英文释义', '例句', '来源文章', '状态']
    : ['单词', '词性', '中文', '来源文章', '状态'];

  const rows = words.map((w) => {
    const cells = detailed
      ? [w.headword, w.word, w.pos, w.zh, w.en, w.example ?? '', w.sourceArticleId, w.status]
      : [w.headword, w.pos, w.zh, w.sourceArticleId, w.status];
    return cells.map((c) => csvCell(String(c))).join(',');
  });

  return [header.join(','), ...rows].join('\n');
}
