/**
 * 开发工具:验证远程文章合并策略（P1-3 验收用例）。
 *
 * 原始缺陷:每次整批替换 → 旧文章消失 → 「累计读完」缩水、生词来源丢失。
 * 现在断言:旧文章被保留、同一 id 以新内容为准、超过上限才淘汰、新增篇数算得对。
 *
 * 用法:node scripts/verify-article-merge.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'scripts', 'out', 'verify-article-merge');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const src = fs.readFileSync(path.join(ROOT, 'src', 'domain', 'article-merge.ts'), 'utf8');
const js = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const file = path.join(OUT, 'article-merge.mjs');
fs.writeFileSync(file, js, 'utf8');
const { mergeRemoteArticles, countNewArticles, MAX_KEPT_REMOTE_ARTICLES } = await import(
  `file://${file.replace(/\\/g, '/')}`
);

const art = (id, title = id) => ({
  id,
  title,
  summary: '',
  paragraphs: ['x'],
  topicTags: [],
  source: 'gutenberg',
  level: 'B1',
});

let pass = 0;
let fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) {
    pass += 1;
    console.log(`  ✓ ${name}${extra ? `  ${extra}` : ''}`);
  } else {
    fail += 1;
    console.log(`  ✗ ${name}${extra ? `  ${extra}` : ''}`);
  }
};

console.log('\n── 1. 旧文章必须被保留(P1-3 核心)──');
const day1 = [art('g-1'), art('g-2')];
const day2 = [art('g-3'), art('g-4')];
const merged = mergeRemoteArticles(day1, day2);
check('合并后共 4 篇', merged.length === 4, `实际 ${merged.length}`);
check('第一天的文章仍在', merged.some((a) => a.id === 'g-1') && merged.some((a) => a.id === 'g-2'));
check('新文章排在最前', merged[0].id === 'g-3' && merged[1].id === 'g-4');

console.log('\n── 2. 同一 id 以新内容为准(文本可能被重新切分)──');
const reCut = [art('g-1', '新的标题')];
const m2 = mergeRemoteArticles(day1, reCut);
check('不产生重复 id', m2.filter((a) => a.id === 'g-1').length === 1);
check('内容用新的', m2.find((a) => a.id === 'g-1').title === '新的标题');

console.log('\n── 3. 超过上限才淘汰最旧的 ──');
const many = Array.from({ length: MAX_KEPT_REMOTE_ARTICLES + 10 }, (_, i) => art(`n-${i}`));
const capped = mergeRemoteArticles([], many, MAX_KEPT_REMOTE_ARTICLES);
check(`裁到上限 ${MAX_KEPT_REMOTE_ARTICLES}`, capped.length === MAX_KEPT_REMOTE_ARTICLES, `实际 ${capped.length}`);
check('保留的是靠前(较新)的', capped[0].id === 'n-0');

console.log('\n── 4. 新增篇数统计 ──');
check('全新 2 篇 → 2', countNewArticles(day1, day2) === 2);
check('重复上传同一批 → 0', countNewArticles(day2, day2) === 0);
check('部分重复 → 1', countNewArticles(day1, [art('g-1'), art('g-9')]) === 1);

console.log('\n── 5. 空输入不炸 ──');
check('两边都空', mergeRemoteArticles([], []).length === 0);
check('只有旧的', mergeRemoteArticles(day1, []).length === 2);

console.log(`\n========== 结论 ==========\n通过 ${pass} 项,失败 ${fail} 项`);
process.exitCode = fail === 0 ? 0 : 1;
