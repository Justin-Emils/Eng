/**
 * 外部词表导入器(考研红宝书等自备词表)。
 *
 * 两种模式:
 *  1) 纯词表(只有单词/词组,无释义)——考研词库等:
 *     node scripts/import-wordlist.mjs --plain --in wordlists/kaoyan.txt --source "考研词汇(自备)"
 *     生成 src/data/external-wordlist.ts(仅 headword 数组)。
 *
 *  2) 带释义词表(未来若拿到音标/词性/释义的文件):
 *     默认格式: headword, pos, zh[, en][, example]
 *     带音标:   --has-phonetic → headword, phonetic, pos, zh[, en][, example]
 *     node scripts/import-wordlist.mjs --in wordlists/kaoyan-full.txt --source "…" [--has-phonetic]
 *     生成 src/data/ext-words.ts(完整 DictEntry,自动并入离线词典)。
 *
 * 词表数据版权归你提供来源所有,仅本地离线使用;请勿分发非你所有的内容。
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
function argValue(name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}
const inputFile = argValue('--in');
const sourceName = argValue('--source') ?? 'external';
const hasPhonetic = args.includes('--has-phonetic');
const isPlain = args.includes('--plain');

if (!inputFile) {
  console.error('用法: node scripts/import-wordlist.mjs (--plain | [--has-phonetic]) --in <文件> [--source 来源]');
  process.exit(1);
}

const text = readFileSync(resolve(ROOT, inputFile), 'utf8');
const now = new Date().toISOString();

/* ---------------- 纯词表模式 ---------------- */
if (isPlain) {
  const seen = new Set();
  const list = [];
  for (const raw of text.split(/\r?\n/)) {
    // 去掉可能的"序号 + Tab/空格"前缀(如 "1\tradiate")
    let line = raw.replace(/^\s*\d+\s+/, '').trim();
    if (!line || line.startsWith('#')) continue;
    // 仅保留英文词/词组(字母、空格、连字符、撇号、点)
    if (!/^[A-Za-z][A-Za-z .'\-]*$/.test(line)) continue;
    const lower = line.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    list.push(lower);
  }
  list.sort((a, b) => (a < b ? -1 : 1));

  const out = resolve(ROOT, 'src/data/external-wordlist.ts');
  const body = `/**
 * 外部词表(纯词形,如考研词库) —— 由 scripts/import-wordlist.mjs --plain 自动生成,请勿手改。
 * 来源: ${sourceName}
 * 生成时间: ${now}
 * 词形数: ${list.length}
 */
export const EXTERNAL_WORDLIST_META = {
  generatedAt: '${now}',
  source: '${sourceName.replace(/'/g, "\\'")}',
  count: ${list.length},
};

/** 全部词形(小写,已排序去重) */
export const EXTERNAL_WORDLIST: readonly string[] = ${JSON.stringify(list)};

/** 快速判定的 Set */
export const EXTERNAL_WORDSET: ReadonlySet<string> = new Set(EXTERNAL_WORDLIST);
`;
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, body, 'utf8');
  console.log(`✅ 纯词表:导入 ${list.length} 个唯一词形 → src/data/external-wordlist.ts`);
  process.exit(0);
}

/* ---------------- 带释义模式 ---------------- */
const OUT = resolve(ROOT, 'src/data/ext-words.ts');

function splitField(line) {
  return line.includes('\t') ? line.split('\t').map((s) => s.trim()) : line.split(',').map((s) => s.trim());
}

const entries = {};
let skipped = 0;
for (const raw of text.split(/\r?\n/)) {
  const line = raw.trim();
  if (!line || line.startsWith('#')) continue;
  const parts = splitField(line).filter(Boolean);
  if (parts.length < 3) {
    skipped += 1;
    continue;
  }
  const headword = parts[0].toLowerCase();
  if (!/^[a-z][a-z .'-]*$/.test(headword)) {
    skipped += 1;
    continue;
  }
  if (hasPhonetic) {
    const [head, phonetic, pos, zh, en, example] = parts;
    entries[head] = { headword: head, phonetic, pos, zh, en: en ?? '', example: example ?? undefined };
  } else {
    const [head, pos, zh, en, example] = parts;
    entries[head] = { headword: head, pos, zh, en: en ?? '', example: example ?? undefined };
  }
}

const count = Object.keys(entries).length;

const body = `/**
 * 外部词表(完整释义)入库文件 —— 由 scripts/import-wordlist.mjs 自动生成,请勿手改。
 * 来源: ${sourceName}
 * 生成时间: ${now}
 */
import type { DictEntry } from '@/data/dict-core';

export type ExternalDictEntry = DictEntry;

export const EXTERNAL_DICT_META = {
  generatedAt: '${now}',
  source: '${sourceName.replace(/'/g, "\\'")}',
  count: ${count},
};

export const EXTERNAL_DICT: Record<string, ExternalDictEntry> = {
${Object.entries(entries)
  .sort(([a], [b]) => (a < b ? -1 : 1))
  .map(([head, e]) => {
    const zh = JSON.stringify(e.zh);
    const en = JSON.stringify(e.en ?? '');
    const example = e.example ? JSON.stringify(e.example) : 'undefined';
    const phonetic = e.phonetic ? JSON.stringify(e.phonetic) : 'undefined';
    const pos = JSON.stringify(e.pos);
    return `  ${JSON.stringify(head)}: { headword: ${JSON.stringify(head)}, phonetic: ${phonetic}, pos: ${pos}, zh: ${zh}, en: ${en}, example: ${example} },`;
  })
  .join('\n')}
};
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, body, 'utf8');
console.log(`✅ 完整词表:导入 ${count} 词(跳过 ${skipped} 行)→ src/data/ext-words.ts`);
