/**
 * 开发工具:验证"每日语料"的切分质量(不需要打包/手机)。
 *
 * 做法:把 src/domain/corpus/split.ts 转译后直接调用真实函数,
 * 对若干本内置目录里的公版书跑一遍,打印:
 *   - 切出多少篇、其中符合 220–700 词的有几篇
 *   - 第一篇的开头(用来确认没有把许可声明/目录当成正文)
 *
 * 用法:node scripts/verify-corpus-split.mjs
 */
import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const splitSrc = fs.readFileSync(path.join(ROOT, 'src/domain/corpus/split.ts'), 'utf8');
const splitJs = ts.transpileModule(splitSrc, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const split = await import(`data:text/javascript;base64,${Buffer.from(splitJs, 'utf8').toString('base64')}`);

/** 与 update.ts 保持一致的单篇词数区间 */
const MIN_WORDS = 220;
const MAX_WORDS = 700;

function get(url, timeoutMs = 25000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'LearnReadingApp-verify/1.0' } }, (res) => {
      if (res.statusCode && res.statusCode >= 400) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error('timeout')));
  });
}

function countWords(text) {
  const m = text.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g);
  return m ? m.length : 0;
}

const IDS = process.argv.slice(2).map(Number);
const targets = IDS.length > 0 ? IDS : [11, 45, 2680, 64317, 35, 108];

for (const id of targets) {
  const url = `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`;
  try {
    const text = await get(url);
    const candidates = split.fullTextToCandidates(text);
    const usable = candidates.filter((c) => {
      const w = countWords(c.paragraphs.join(' '));
      return w >= MIN_WORDS && w <= MAX_WORDS;
    });
    const first = usable[0] ?? candidates[0];
    const firstWords = first ? countWords(first.paragraphs.join(' ')) : 0;
    console.log(
      `id ${id}: 候选 ${candidates.length} 篇 / 可用 ${usable.length} 篇;首篇 ${firstWords} 词`,
    );
    if (first) console.log(`   开头: ${first.paragraphs[0].slice(0, 140)}`);
  } catch (e) {
    console.log(`id ${id}: 失败 ${e.message}`);
  }
}
