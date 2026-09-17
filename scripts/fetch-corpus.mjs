/**
 * 开发工具:批量下载 Project Gutenberg 公版书正文,用于"扩大语料规模"的验证。
 *
 * 目的:现在的内置语料只有 22 篇(约 1 万 token),算不出"哪些档的词更常见",
 * 平均复现只有 1.1 次。要验证"语料变大后投入产出比能否区分档次",先得有量。
 *
 * 做法:按 ID 顺序抓 Gutenberg 的纯文本版(多镜像回退),剥离版权声明,
 * 过滤掉非英文/过短/抓取失败的,存到 .artifacts/corpus/(已被 .gitignore 忽略),
 * 并写 manifest.json 记录每篇的字节数与标题。
 *
 * 用法:node scripts/fetch-corpus.mjs [目标篇数] [起始ID] [步长]
 *   例:node scripts/fetch-corpus.mjs 400 1000 2
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, '.artifacts', 'corpus');
const MANIFEST = path.join(OUT_DIR, 'manifest.json');

const TARGET = Number(process.argv[2] ?? 300);
const START_ID = Number(process.argv[3] ?? 1000);
const STRIDE = Number(process.argv[4] ?? 2);
const CONCURRENCY = 4;
const TIMEOUT_MS = 25000;
const MIN_BYTES = 20000;
/** 常见英文虚词:用来快速判断"这是不是英文书"(非英文书直接丢) */
const EN_MARKERS = [' the ', ' and ', ' of ', ' to ', ' that ', ' is '];

function mirrorsFor(id) {
  return [
    `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`,
    `https://gutenberg.pglaf.org/cache/epub/${id}/pg${id}.txt`,
    `https://www.gutenberg.org/files/${id}/${id}-0.txt`,
  ];
}

/** 剥离 Gutenberg 的头尾声明,只留正文 */
function stripBoilerplate(text) {
  const start = text.search(/\*\*\*\s*START OF (THE|THIS) PROJECT GUTENBERG/i);
  const end = text.search(/\*\*\*\s*END OF (THE|THIS) PROJECT GUTENBERG/i);
  if (start >= 0) {
    const from = text.indexOf('\n', start);
    const to = end > start ? text.lastIndexOf('\n', end) : text.length;
    return text.slice(from < 0 ? start : from, to < 0 ? text.length : to);
  }
  return text;
}

function looksEnglish(text) {
  const head = text.slice(0, 20000).toLowerCase();
  let hits = 0;
  for (const marker of EN_MARKERS) if (head.includes(marker)) hits += 1;
  // 同时要求 ASCII 占比足够高(挡住法语/德语等带重音的语言)
  let ascii = 0;
  for (let i = 0; i < Math.min(text.length, 20000); i += 1) {
    if (text.charCodeAt(i) < 128) ascii += 1;
  }
  const ratio = ascii / Math.min(text.length, 20000);
  return hits >= 4 && ratio > 0.95;
}

async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: 'follow' });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function downloadOne(id) {
  const file = path.join(OUT_DIR, `${id}.txt`);
  if (fs.existsSync(file)) {
    const size = fs.statSync(file).size;
    if (size >= MIN_BYTES) return { id, bytes: size, skipped: true };
  }
  for (const url of mirrorsFor(id)) {
    const raw = await fetchText(url);
    if (!raw) continue;
    const body = stripBoilerplate(raw);
    if (body.length < MIN_BYTES || !looksEnglish(body)) continue;
    fs.writeFileSync(file, body, 'utf8');
    return { id, bytes: body.length, skipped: false };
  }
  return null;
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const ids = [];
for (let id = START_ID; ids.length < TARGET * 3; id += STRIDE) ids.push(id);

const manifest = [];
let done = 0;
let ok = 0;
let idx = 0;

async function worker() {
  while (idx < ids.length && ok < TARGET) {
    const id = ids[idx];
    idx += 1;
    const result = await downloadOne(id);
    done += 1;
    if (result) {
      ok += 1;
      manifest.push(result);
      if (ok % 25 === 0) console.log(`  已获取 ${ok}/${TARGET} 篇(尝试 ${done} 个 ID)`);
    } else if (done % 50 === 0) {
      console.log(`  已尝试 ${done} 个 ID,成功 ${ok} 篇`);
    }
  }
}

console.log(`开始下载:目标 ${TARGET} 篇,ID 从 ${START_ID} 起、步长 ${STRIDE}`);
const started = Date.now();
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

fs.writeFileSync(MANIFEST, JSON.stringify(manifest.sort((a, b) => a.id - b.id), null, 2), 'utf8');
const totalBytes = manifest.reduce((sum, m) => sum + m.bytes, 0);
console.log(
  `\n完成:${manifest.length} 篇 · 共 ${(totalBytes / 1024 / 1024).toFixed(1)} MB · 用时 ${((Date.now() - started) / 1000).toFixed(0)}s`,
);
console.log(`目录:${OUT_DIR}`);
