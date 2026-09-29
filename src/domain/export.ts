/**
 * 数据导出(模块 G):生词本导出 CSV 文本。
 *
 * **只导出词形一列。** 理由:词形本身就是内置词典的主键(`headword`),
 * 词性、释义、例句都能用它去查 —— 导出时再抄一遍是冗余,而且那份 CSV 会大到没法看
 * (以前把英文释义与例句也塞进去,每行几百字符,粘到 Excel 里根本读不了)。
 * 需要完整快照时用 { detailed: true }。
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
 * @param options.detailed 是否导出完整字段(默认只导出词形这一列)
 */
export function wordsToCsv(words: WordItem[], options: { detailed?: boolean } = {}): string {
  if (!options.detailed) {
    return ['单词', ...words.map((w) => csvCell(w.headword))].join('\n');
  }

  const header = ['单词', '原形', '词性', '中文', '英文释义', '例句', '来源文章', '状态'];
  const rows = words.map((w) =>
    [w.headword, w.word, w.pos, w.zh, w.en, w.example ?? '', w.sourceArticleId, w.status]
      .map((c) => csvCell(String(c)))
      .join(','),
  );
  return [header.join(','), ...rows].join('\n');
}