/**
 * 开发工具:验证"量化画像 + 按理解率推荐"(不需要打包/手机)。
 *
 * 做法与 verify-difficulty.mjs 相同:把 src 下的纯逻辑模块用 TypeScript API
 * 转译到 scripts/out/verify-build/,重写 '@/' 别名,然后在 Node 里调用**真实函数**。
 *
 * 输出四块:
 *   1. 三种典型评估结果 → 量化画像(词汇量/区间/曲线/标签/建议)
 *   2. 快速评估 vs 精细评估:同样是"答对 60%",区间宽度差多少
 *   3. **档差口径的缺陷演示**:同样"差 1 档"的文章,预测理解率能差多少
 *   4. 学习区(93%–96%)推荐结果 + 当前语料的 corpusFit
 *
 * 用法:node scripts/verify-profile.mjs [用户词汇量]
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'scripts', 'out', 'verify-profile');

const SKIP_DIRS = new Set(['app', 'components', 'hooks']);

function collect(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      collect(full, acc);
    } else if (/\.tsx?$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

function transpileAll() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'package.json'), '{"type":"module"}', 'utf8');

  for (const file of collect(SRC)) {
    const srcText = fs.readFileSync(file, 'utf8');
    const relPath = path.relative(SRC, file).replace(/\\/g, '/');
    const outFile = path.join(OUT, relPath.replace(/\.tsx?$/, '.js'));
    fs.mkdirSync(path.dirname(outFile), { recursive: true });

    let js = ts.transpileModule(srcText, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    }).outputText;

    js = js.replace(/(from\s+['"])@\/([^'"]+)(['"])/g, (_m, pre, spec, post) => {
      const target = path.join(OUT, spec);
      const rel = path.relative(path.dirname(outFile), target).replace(/\\/g, '/');
      return `${pre}${rel.startsWith('.') ? rel : `./${rel}`}${post}`;
    });

    fs.writeFileSync(outFile, js, 'utf8');
  }

  // 统一补 .js 扩展名(ESM 要求显式扩展名)
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
const difficultyMod = await import(`file://${path.join(OUT, 'domain/difficulty.js')}`);
const recommendMod = await import(`file://${path.join(OUT, 'domain/recommend.js')}`);
const levelsMod = await import(`file://${path.join(OUT, 'domain/levels.js')}`);
const articlesMod = await import(`file://${path.join(OUT, 'data/articles/index.js')}`);

const articles = articlesMod.getAllArticles();
const userVocab = Number(process.argv[2] ?? 5000);

function show(id, level) {
  const p = profileMod.buildLearnerProfile(level);
  console.log(`\n【${id}】`);
  console.log(`  词汇量 ${p.vocab} 词 · 区间 ${p.low}–${p.high}(±${p.margin})· 可信度${p.confidence}`);
  console.log(`  作答 ${p.answers} 词 / 正确率 ${(p.accuracy * 100).toFixed(1)}% · 模式 ${p.mode}`);
  console.log(`  参考档位 ${p.bandLabel} · ${p.cefr}`);
  if (p.bands.length > 0) {
    console.log('  分频段掌握:');
    for (const b of p.bands) {
      const bar = '█'.repeat(Math.round(b.rate * 20)).padEnd(20, '·');
      console.log(`    ${b.label.padEnd(14)} ${bar} ${(b.rate * 100).toFixed(0).padStart(3)}%  (${b.known}/${b.total})`);
    }
  }
  for (const t of p.traits) console.log(`  [${t.kind}] ${t.text}`);
  console.log(`  建议:${p.suggestion}`);
  return p;
}

console.log('\n================ 1. 三种典型用户的量化画像 ================');

// A. 高频扎实但 5500 断层(常见:四级过了、考研词没背)
show('A · 高频扎实 / 5500 断层(快速评估 20 词)', {
  vocab: 4300,
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
});

// B. 精细评估的均匀型(同一个人多答几轮,区间应变窄)
show('B · 同一人做精细评估(40 词)', {
  vocab: 4300,
  level: 'B2',
  assessed: true,
  updatedAt: 0,
  mode: 'fine',
  rounds: [
    { threshold: 3000, total: 8, known: 7 },
    { threshold: 4200, total: 8, known: 6 },
    { threshold: 5500, total: 8, known: 3 },
    { threshold: 4200, total: 8, known: 6 },
    { threshold: 5500, total: 8, known: 2 },
  ],
  answers: 40,
  knownAnswers: 24,
});

// C. 自选档位(没有作答明细)
show('C · 自选档位(没做评估)', {
  vocab: undefined,
  level: 'C1',
  assessed: true,
  updatedAt: 0,
});

console.log('\n================ 2. 精度对比:同样的正确率,区间差多少 ================');
const pQuick = profileMod.buildLearnerProfile({
  vocab: 5000,
  level: 'B2',
  assessed: true,
  updatedAt: 0,
  mode: 'quick',
  rounds: [{ threshold: 4200, total: 15, known: 9 }],
  answers: 15,
  knownAnswers: 9,
});
const pFine = profileMod.buildLearnerProfile({
  vocab: 5000,
  level: 'B2',
  assessed: true,
  updatedAt: 0,
  mode: 'fine',
  rounds: [{ threshold: 4200, total: 40, known: 24 }],
  answers: 40,
  knownAnswers: 24,
});
console.log(`  快速评估(15 词):${pQuick.low}–${pQuick.high}  区间宽 ${pQuick.high - pQuick.low}`);
console.log(`  精细评估(40 词):${pFine.low}–${pFine.high}  区间宽 ${pFine.high - pFine.low}`);
console.log(`  → 收窄 ${Math.round((1 - (pFine.high - pFine.low) / (pQuick.high - pQuick.low)) * 100)}%`);

console.log(`\n================ 3. 档差口径的缺陷(用户 ${userVocab} 词) ================`);
const userBandIdx = levelsMod.bandIndexOf(userVocab);
const rows = articles.map((a) => {
  const info = difficultyMod.difficultyOf(a);
  const band = levelsMod.bandOf(info.requiredVocab);
  return {
    title: a.title,
    required: info.requiredVocab,
    band,
    gap: levelsMod.bandIndexOf(info.requiredVocab) - userBandIdx,
    coverage: difficultyMod.coverageAt(a.paragraphs, userVocab),
  };
});

// 3a. 同一个档位标签下,实际难度值跨度有多大
console.log('  3a. 同一档位标签内的实际难度跨度(标签相同 = 旧模型视为同一难度):');
const byBand = new Map();
for (const r of rows) {
  const list = byBand.get(r.band.id) ?? [];
  list.push(r);
  byBand.set(r.band.id, list);
}
for (const [bandId, list] of [...byBand.entries()]) {
  const values = list.map((r) => r.required).sort((a, b) => a - b);
  const min = values[0];
  const max = values[values.length - 1];
  console.log(
    `    ${bandId.padEnd(4)} ${String(list.length).padStart(2)} 篇 · 难度值 ${String(min).padStart(5)}–${String(max).padStart(5)} 词(跨度 ${max - min})`,
  );
}
console.log('    → 跨度就是"标签丢掉的精度":同为 B2+,难度值可能相差上千词');

// 3b. 该用户附近:档差相同的文章,预测理解率是否真的等价
const nearby = rows
  .filter((r) => r.gap >= 0 && r.gap <= 2)
  .sort((a, b) => b.coverage - a.coverage);
if (nearby.length >= 2) {
  console.log(`\n  3b. 档差 0～+2 的文章(${nearby.length} 篇)按理解率排序:`);
  for (const r of nearby) {
    console.log(
      `    ${String(r.required).padStart(5)} 词 · 档差 ${String(r.gap).padStart(2)} · 预计认识 ${(r.coverage * 100).toFixed(1).padStart(5)}% · ${difficultyMod.coverageFitLabel(r.coverage).padEnd(5)} ${r.title.slice(0, 38)}`,
    );
  }
  const spread = (nearby[0].coverage - nearby[nearby.length - 1].coverage) * 100;
  console.log(`    → 这些文章在旧模型里都被判为"合适到略难",但理解率跨度 ${spread.toFixed(1)} 个百分点`);
  const byGap = new Map();
  for (const r of nearby) {
    const arr = byGap.get(r.gap) ?? [];
    arr.push(r);
    byGap.set(r.gap, arr);
  }
  for (const [gap, list] of [...byGap.entries()].sort((a, b) => a[0] - b[0])) {
    const covs = list.map((r) => r.coverage);
    console.log(
      `    档差 +${gap}:${list.length} 篇,理解率 ${(Math.min(...covs) * 100).toFixed(1)}%–${(Math.max(...covs) * 100).toFixed(1)}%`,
    );
  }
}

console.log(`\n================ 4. 学习区推荐(目标理解率 93%–96%) ================`);
const picks = recommendMod.recommendFor({
  articles,
  userVocab,
  learned: new Set(),
  known: new Set(),
  count: 5,
});
for (const p of picks) {
  console.log(`  · ${p.article.title.slice(0, 44)}`);
  console.log(`      ${p.reason}`);
  console.log(
    `      理解率 ${(p.coverage * 100).toFixed(1)}% · 可学新词 ${p.learnableCount}(考研词 ${p.examWordCount}) · 噪音词 ${p.noisyCount} · ${p.inRange ? '✔ 在目标区间' : '不在目标区间(兜底)'}`,
  );
}

const fit = profileMod.corpusFit(userVocab, articles);
console.log(`\n  语料适配(基于 ${fit.sampleSize} 篇实测):`);
console.log(`    舒适阅读上限:所需词汇量 ≤ ${fit.comfortCeiling} 词的文章,预测理解率 ≥ 96%`);
console.log(`    学习区(93%–96%):所需词汇量 ${fit.zoneFrom}–${fit.zoneTo} 词`);

console.log(`\n================ 5. 补词顺序:缺口大小 vs 性价比(用户 ${userVocab} 词) ================`);
const roi = profileMod.bandRoi(userVocab, articles);
console.log('  档位            未知去重词  学完可提升覆盖率   每词收益      平均复现');
for (const r of roi) {
  console.log(
    `    ${r.label.padEnd(14)} ${String(r.unknownUnique).padStart(5)} 个 ${r.coverageGainPct.toFixed(2).padStart(9)}% ${r.gainPerWord.toFixed(3).padStart(10)}%/词 ${r.avgRepetition.toFixed(1).padStart(8)} 次`,
  );
}

const candidates = roi.filter((r) => r.unknownUnique >= 15);
if (candidates.length > 0) {
  const best = candidates.reduce((a, b) => (b.gainPerWord > a.gainPerWord ? b : a));
  console.log(`\n  → 性价比最高:${best.label}(每学 1 个词约多认识 ${best.gainPerWord.toFixed(3)}% 文本)`);

  // 模拟"评估曲线显示 5500 档断层"的典型用户,对比两种口径给出的建议
  const level = {
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
  const naive = profileMod.buildLearnerProfile(level);
  const withRoi = profileMod.buildLearnerProfile(level, { roi });

  const gapRoi = roi.find((r) => r.threshold === 5500);
  console.log('\n  同一个用户(曲线显示 5500 档只有 20%):');
  if (gapRoi) {
    console.log(
      `    5500 档:未知 ${gapRoi.unknownUnique} 个 · 每词收益 ${gapRoi.gainPerWord.toFixed(3)}% · 平均复现 ${gapRoi.avgRepetition.toFixed(1)} 次`,
    );
    if (gapRoi.gainPerWord > 0) {
      console.log(`    性价比差距:${best.label} 每词收益是它的 ${(best.gainPerWord / gapRoi.gainPerWord).toFixed(1)} 倍`);
    }
  }
  console.log(`\n    [旧口径 · 只看缺口] ${naive.suggestion}`);
  console.log(`    [新口径 · 算性价比] ${withRoi.suggestion}`);
  for (const t of withRoi.traits) {
    if (t.kind === 'note') console.log(`      note: ${t.text}`);
  }
}
