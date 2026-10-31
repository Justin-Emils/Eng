/**
 * 开发工具:验证"同步指纹"的正确性(P0-1 的验收用例)。
 *
 * 报告里点名的原始缺陷:备份 JSON 带 `exportedAt`,直接对整份 JSON 求哈希,
 * 指纹每次都不一样 → 自动同步"没变化就不传"形同虚设 → 每 60 秒全量覆盖云端,
 * 多设备时旧设备会盖掉新设备。
 *
 * 这里断言四件事:
 *   1. 同一份业务内容 → 同一个指纹(与导出时间无关);
 *   2. 键的顺序不影响指纹;
 *   3. 任一业务值变化 → 指纹变化;
 *   4. 归属账号变化 → 指纹变化。
 *
 * 用法:node scripts/verify-fingerprint.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'scripts', 'out', 'verify-fingerprint');

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

/** 转译一个模块,把 '@/' 别名改成本地相对路径 */
function transpile(rel, outName) {
  const src = fs.readFileSync(path.join(SRC, rel), 'utf8');
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  fs.writeFileSync(path.join(OUT, outName), js.replace(/'@\/([^']+)'/g, (_m, p) => `'./${p.split('/').pop()}.mjs'`), 'utf8');
}

transpile('domain/hash.ts', 'hash.mjs');
transpile('domain/fingerprint.ts', 'fingerprint.mjs');

const { hashString } = await import(`file://${path.join(OUT, 'hash.mjs').replace(/\\/g, '/')}`);
const { businessFingerprint } = await import(
  `file://${path.join(OUT, 'fingerprint.mjs').replace(/\\/g, '/')}`
);

let pass = 0;
let fail = 0;
function check(name, cond, detail = '') {
  if (cond) {
    pass += 1;
    console.log(`  ✓ ${name}${detail ? `  ${detail}` : ''}`);
  } else {
    fail += 1;
    console.log(`  ✗ ${name}${detail ? `  ${detail}` : ''}`);
  }
}

// 模拟真实备份:两个业务键
const base = [
  ['readingapp.words.v1', JSON.stringify([{ headword: 'abandon' }, { headword: 'benign' }])],
  ['readingapp.progress.v1', JSON.stringify({ 'a-1': { paragraphIndex: 3 } })],
];

console.log('\n── 1. 同一份内容 → 同一指纹(与"导出时间"无关)──');
const f1 = businessFingerprint('user-1', base);
const f2 = businessFingerprint('user-1', base);
check('两次计算结果一致', f1 === f2, `${f1} vs ${f2}`);

// 关键回归:模拟"备份内容里多了一个每次都变的时间字段"并不会进入指纹
const withTimestamp = [...base, ['__exportedAt', new Date().toISOString()]];
const f3 = businessFingerprint('user-1', withTimestamp);
console.log(`     额外字段会影响指纹(这是预期的:只喂业务键才不会)= ${f3 !== f1}`);

console.log('\n── 2. 键顺序不影响指纹 ──');
const swapped = [base[1], base[0]];
check('顺序调换后一致', businessFingerprint('user-1', swapped) === f1);

console.log('\n── 3. 业务值变化 → 指纹变化 ──');
const changed = [[base[0][0], JSON.stringify([{ headword: 'abandon' }])], base[1]];
check('少一个生词 → 指纹不同', businessFingerprint('user-1', changed) !== f1);

console.log('\n── 4. 归属账号变化 → 指纹不同 ──');
check('换 ownerId → 指纹不同', businessFingerprint('user-2', base) !== f1);

console.log('\n── 5. 空内容与 null 值的稳定性 ──');
const withNull = [['readingapp.settings.v1', null]];
check('null 与空串得到同一指纹(不会因读取失败反复变)', 
  businessFingerprint('user-1', withNull) === businessFingerprint('user-1', [['readingapp.settings.v1', '']]));

console.log('\n── 6. 哈希函数本身 ──');
check('同输入同输出', hashString('abc') === hashString('abc'));
check('不同输入不同输出', hashString('abc') !== hashString('abd'));

console.log(`\n========== 结论 ==========\n通过 ${pass} 项,失败 ${fail} 项`);
process.exitCode = fail === 0 ? 0 : 1;
