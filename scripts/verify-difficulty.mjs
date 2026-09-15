/**
 * 开发工具:验证"难度估计 + 推荐匹配"(不需要打包/手机)。
 *
 * 做法:把 src 下的纯逻辑模块(difficulty/levels/wordlevel/data/recommend)
 * 用 TypeScript API 转译到 scripts/out/verify-build/,重写 '@/' 别名为相对路径,
 * 然后在 Node 里直接调用**真实函数**,输出:
 *   1. 各内置文章的难度值(95% 覆盖率口径)与细分档位
 *   2. 指定词汇量下 recommendFor() 的实际推荐结果与档差
 *
 * 用法:node scripts/verify-difficulty.mjs [用户词汇量]
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'scripts', 'out', 'verify-build');

/** 只转译纯逻辑模块(不碰 app/components/hooks,避免 react-native 依赖) */
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

function toRelImport(fromFile, target) {
  const rel = path.relative(path.dirname(fromFile), target).replace(/\\/g, '/');
  return rel.startsWith('.') ? rel : `./${rel}`;
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

    // '@/data/x' -> 指向**转译产物**的相对路径(第二遍统一补 .js)
    js = js.replace(/(from\s+['"])@\/([^'"]+)(['"])/g, (_m, pre, spec, post) => {
      const target = path.join(OUT, spec);
      const rel = path.relative(path.dirname(outFile), target).replace(/\\/g, '/');
      return `${pre}${rel.startsWith('.') ? rel : `./${rel}`}${post}`;
    });
    js = js.replace(/(from\s+['"])(\.{1,2}\/[^'"]+)(['"])/g, (_m, pre, spec, post) =>
      /\.(js|json)$/.test(spec) ? `${pre}${spec}${post}` : `${pre}${spec}${post}`,
    );

    fs.writeFileSync(outFile, js, 'utf8');
  }
}

function collectAll(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectAll(full, acc);
    else if (entry.name.endsWith('.js')) acc.push(full);
  }
  return acc;
}

transpileAll();
// 统一补扩展名(两遍处理,保证 '@/' 与 './' 都带上 .js)
for (const file of collectAll(OUT)) {
  const text = fs.readFileSync(file, 'utf8');
  const fixed = text.replace(/(from\s+['"])(\.{1,2}\/[^'"]*?)(['"])/g, (_m, a, spec, c) =>
    /\.(js|json)$/.test(spec) ? `${a}${spec}${c}` : `${a}${spec}.js${c}`,
  );
  if (fixed !== text) fs.writeFileSync(file, fixed, 'utf8');
}

const difficultyMod = await import(`file://${path.join(OUT, 'domain/difficulty.js')}`);
const levelsMod = await import(`file://${path.join(OUT, 'domain/levels.js')}`);
const recommendMod = await import(`file://${path.join(OUT, 'domain/recommend.js')}`);
const articlesMod = await import(`file://${path.join(OUT, 'data/articles/index.js')}`);

const userVocab = Number(process.argv[2] ?? 4200);
const articles = articlesMod.getAllArticles();

console.log(`\n=== 内置文章难度(95% 覆盖率口径)| 用户词汇量 ${userVocab} ===`);
const rows = articles
  .map((a) => {
    const info = difficultyMod.difficultyOf(a);
    const rate = difficultyMod.unknownTokenRate(a.paragraphs, userVocab);
    return { a, info, rate };
  })
  .sort((x, y) => x.info.requiredVocab - y.info.requiredVocab);
for (const r of rows) {
  const gap = levelsMod.bandIndexOf(r.info.requiredVocab) - levelsMod.bandIndexOf(userVocab);
  console.log(
    `${String(r.info.requiredVocab).padStart(5)} 词 · ${r.info.band.id.padEnd(4)} · 生词${(r.rate * 100)
      .toFixed(1)
      .padStart(5)}% · 档差${String(gap).padStart(3)}  ${r.a.title.slice(0, 46)}`,
  );
}

console.log(`\n=== recommendFor(userVocab=${userVocab}) 实际推荐 ===`);
const picks = recommendMod.recommendFor({
  articles,
  userVocab,
  learned: new Set(),
  known: new Set(),
  count: 3,
});
for (const p of picks) {
  console.log(`· ${p.article.title.slice(0, 46)}`);
  console.log(`    ${p.reason}`);
}
