/**
 * 开发工具:验证"语料规模是否决定投入产出比的区分度"。
 *
 * 假设(待验证):内置 22 篇时每档"每词收益"几乎相同(0.014–0.019%/词),
 * 因为平均复现只有 1.1 次;语料变大后,各档的频率差异应当显现出来。
 *
 * 做法:用 scripts/fetch-corpus.mjs 下载的公版书,按 100 / 200 / 全部 三档规模
 * 分别统计各档的未知词数、每词收益、平均复现,并对比"最好档 / 最差档"的比值。
 * 全部计算调用**真实的** thresholdOfWord 与 bandRoi(转译 src 后直接 import)。
 *
 * 用法:node scripts/verify-corpus-scale.mjs [用户词汇量]
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'scripts', 'out', 'verify-corpus');
const CORPUS = path.join(ROOT, '.artifacts', 'corpus');

const SKIP_DIRS = new Set(['app', 'components', 'hooks']);

function collect(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      collect(full, acc);
    } else if (/\.tsx?$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

function transpileAll() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'package.json'), '{"type":"module"}', 'utf8');
  for (const file of collect(SRC)) {
    const relPath = path.relative(SRC, file).replace(/\\/g, '/');
    const outFile = path.join(OUT, relPath.replace(/\.tsx?$/, '.js'));
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    let js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    }).outputText;
    js = js.replace(/(from\s+['"])@\/([^'"]+)(['"])/g, (_m, pre, spec, post) => {
      const target = path.join(OUT, spec);
      const rel = path.relative(path.dirname(outFile), target).replace(/\\/g, '/');
      return `${pre}${rel.startsWith('.') ? rel : `./${rel}`}${post}`;
    });
    fs.writeFileSync(outFile, js, 'utf8');
  }
  const stack = [OUT];
  while (stack.length > 0) {
    const dir = stack.pop();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.name.endsWith('.js')) {
        const text = fs.readFileSync(full, 'utf8');
        const fixed = text.replace(/(from\s+['"])(\.{1,2}\/[^'"]*?)(['"])/g, (_m, a, spec, c) =>
          /\.(js|json)$/.test(spec) ? `${a}${spec}${c}` : `${a}${spec}.js${c}`,
        );
        if (fixed !== text) fs.writeFileSync(full, fixed, 'utf8');
      }
    }
  }
}

transpileAll();

const profileMod = await import(`file://${path.join(OUT, 'domain/profile.js')}`);
const knowledgeMod = await import(`file://${path.join(OUT, 'domain/knowledge.js')}`);
const articlesMod = await import(`file://${path.join(OUT, 'data/articles/index.js')}`);

const userVocab = Number(process.argv[2] ?? 4300);

/** 典型用户的评估锚点(4200 档 80%、5500 档 20%),用于拟合掌握概率曲线 */
const levelWithAnchors = {
  vocab: userVocab,
  level: 'B2',
  assessed: true,
  updatedAt: 0,
  mode: 'quick',
  rounds: [
    { threshold: 1500, total: 5, known: 5 },
    { threshold: 3000, total: 5, known: 5 },
    { threshold: 4200, total: 5, known: 4 },
    { threshold: 5500, total: 5, known: 1 },
  ],
  answers: 20,
  knownAnswers: 15,
};
const curve = knowledgeMod.curveForLevel(levelWithAnchors);

/** 把下载的纯文本包装成 bandRoi 需要的形状(只用到 paragraphs) */
function asArticle(id, text) {
  return {
    id: String(id),
    title: String(id),
    paragraphs: [text],
    topicTags: [],
    difficulty: { wordCount: 0, minutes: 0, level: 'B2' },
  };
}

function loadCorpus(limit) {
  if (!fs.existsSync(CORPUS)) return [];
  const files = fs
    .readdirSync(CORPUS)
    .filter((f) => /^\d+\.txt$/.test(f))
    .sort((a, b) => Number(a.replace('.txt', '')) - Number(b.replace('.txt', '')))
    .slice(0, limit);
  return files.map((f) => asArticle(f.replace('.txt', ''), fs.readFileSync(path.join(CORPUS, f), 'utf8')));
}

function report(label, articles) {
  const roi = profileMod.bandRoi(userVocab, articles, curve);
  const candidates = roi.filter((r) => r.unknownUnique >= 15 && r.gainPerWord > 0);
  const best = candidates.reduce((a, b) => (b.gainPerWord > a.gainPerWord ? b : a), candidates[0]);
  const worst = candidates.reduce((a, b) => (b.gainPerWord < a.gainPerWord ? b : a), candidates[0]);
  const ratio = best && worst && worst.gainPerWord > 0 ? best.gainPerWord / worst.gainPerWord : 0;

  // 全局:总词数与唯一词数(复现次数的分母)
  let tokens = 0;
  const unique = new Set();
  for (const article of articles) {
    for (const w of article.paragraphs[0].toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) ?? []) {
      tokens += 1;
      unique.add(w);
    }
  }

  console.log(`\n【${label}】${articles.length} 篇 · 约 ${(tokens / 1000).toFixed(0)}k 词 · 唯一词 ${unique.size} · 平均复现 ${(tokens / Math.max(1, unique.size)).toFixed(1)} 次`);
  console.log('   档位            期望未知词   每词收益      平均复现');
  for (const r of roi) {
    console.log(
      `   ${r.label.padEnd(14)} ${String(r.unknownUnique).padStart(8)} ${r.gainPerWord.toFixed(4).padStart(11)}%/词 ${r.avgRepetition.toFixed(1).padStart(8)} 次`,
    );
  }
  if (best && worst) {
    console.log(
      `   → 区分度:最高 ${best.label} ${best.gainPerWord.toFixed(4)}%/词 vs 最低 ${worst.label} ${worst.gainPerWord.toFixed(4)}%/词 · 比值 ${ratio.toFixed(2)}×`,
    );
  }
  return ratio;
}

console.log(`\n===== 语料规模 vs 投入产出比区分度(用户词汇量 ${userVocab}) =====`);
const builtin = articlesMod.getAllArticles();
report('内置 22 篇(现状)', builtin);

const available = fs.existsSync(CORPUS)
  ? fs.readdirSync(CORPUS).filter((f) => /^\d+\.txt$/.test(f)).length
  : 0;
console.log(`\n下载目录里的书:${available} 本`);

const ratios = [];
for (const size of [50, 100, 200, 400].filter((n) => n <= available)) {
  ratios.push({ size, ratio: report(`下载语料 ${size} 本`, loadCorpus(size)) });
}

if (available >= 400) {
  report('内置 + 下载 400 本(合并)', [...builtin, ...loadCorpus(400)]);
}

console.log('\n===== 结论 =====');
for (const r of ratios) console.log(`  ${String(r.size).padStart(4)} 本 → 区分度 ${r.ratio.toFixed(2)}×`);
console.log('  区分度 = 性价比最高的档 / 最低的档;越接近 1 说明语料还太小、分不出档次');
