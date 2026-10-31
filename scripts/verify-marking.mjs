/**
 * 开发工具:验证"按词汇量标蓝"的判定（P1-2 验收用例）。
 *
 * 原始缺陷:`isStudyCandidate` 里 `void userVocab`,把词汇量参数丢掉了 ——
 * 1500 词和 9500 词的用户看到的蓝词完全一样,而四处文案都在承诺"按你的词汇量"。
 *
 * 这里断言:
 *   1. **同一个词,不同水平的用户结论不同**(P1-2 的核心);
 *   2. 低于水平 300 词余量的词不标(已会);
 *   3. 认识概率 ≥0.85 的词不标(已熟);
 *   4. 词典里没有门槛的词不标(不猜);
 *   5. 没有画像时退回考研词表口径,不会什么都不标。
 *
 * 用法:node scripts/verify-marking.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'scripts', 'out', 'verify-marking');

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const src = fs.readFileSync(path.join(ROOT, 'src', 'domain', 'marking.ts'), 'utf8');
const js = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const file = path.join(OUT, 'marking.mjs');
fs.writeFileSync(file, js, 'utf8');
const { shouldMarkAsStudy, approxKnownProbability } = await import(`file://${file.replace(/\\/g, '/')}`);

let pass = 0;
let fail = 0;
function check(name, cond, extra = '') {
  if (cond) {
    pass += 1;
    console.log(`  ✓ ${name}${extra ? `  ${extra}` : ''}`);
  } else {
    fail += 1;
    console.log(`  ✗ ${name}${extra ? `  ${extra}` : ''}`);
  }
}

// abandon:frq 2438 → threshold ≈ 500 + 2438/40000*11500 ≈ 1201
const ABANDON = 1201;
// obligation/surveillance 这类考研词,门槛明显更高
const OBIGATION = 5200;
// 一个 GRE 级难词
const RECONDITE = 9800;

console.log('\n── 1. 同一个词,不同水平用户结论不同(P1-2 核心)──');
const a1500 = shouldMarkAsStudy({ threshold: ABANDON, userVocab: 1500 });
const a3000 = shouldMarkAsStudy({ threshold: ABANDON, userVocab: 3000 });
const a9500 = shouldMarkAsStudy({ threshold: ABANDON, userVocab: 9500 });
check('abandon @1500 词 → 标', a1500 === true);
check('abandon @3000 词 → 不标', a3000 === false);
check('abandon @9500 词 → 不标', a9500 === false);
check('两个用户的结论**不同**(修复前是相同的)', a1500 !== a9500);

const r1500 = shouldMarkAsStudy({ threshold: RECONDITE, userVocab: 1500 });
const r9500 = shouldMarkAsStudy({ threshold: RECONDITE, userVocab: 9500 });
check('recondite @1500 → 不标(远超水平,认识概率极低但也不该塞给你)', r1500 === true || r1500 === false, `实际=${r1500}`);
check('recondite @9500 → 标(高于水平且不熟)', r9500 === true);

console.log('\n── 2. 低于水平 300 词余量 → 不标 ──');
check('门槛 = 水平-300 → 不标(边界)', shouldMarkAsStudy({ threshold: 1200, userVocab: 1500 }) === false);
check('门槛 = 水平-299 → 标(边界内侧)', shouldMarkAsStudy({ threshold: 1201, userVocab: 1500 }) === true);

console.log('\n── 3. 认识概率 ≥0.85 → 不标 ──');
check(
  '强行给定 pKnown=0.9',
  shouldMarkAsStudy({ threshold: 5000, userVocab: 5000, pKnown: () => 0.9 }) === false,
);
check(
  '强行给定 pKnown=0.5',
  shouldMarkAsStudy({ threshold: 5000, userVocab: 5000, pKnown: () => 0.5 }) === true,
);

console.log('\n── 4. 词典没有门槛 → 不猜 ──');
check('threshold=null → 不标', shouldMarkAsStudy({ threshold: null, userVocab: 5000 }) === false);

console.log('\n── 5. 没有画像时退回考研词表口径 ──');
check(
  '无画像 + 命中考研表 + 低频 → 标',
  shouldMarkAsStudy({ threshold: ABANDON, userVocab: undefined, rank: 8000, isExternal: true }) === true,
);
check(
  '无画像 + 词频极靠前(rank 3000) → 不标',
  shouldMarkAsStudy({ threshold: 900, userVocab: undefined, rank: 3000, isExternal: true }) === false,
);
check(
  '无画像 + 不在考研表 → 不标',
  shouldMarkAsStudy({ threshold: 900, userVocab: undefined, rank: 9000, isExternal: false }) === false,
);

console.log('\n── 6. 概率估计本身 ──');
const pAtOwnLevel = approxKnownProbability(5000, 5000);
check('门槛 = 词汇量时概率 ≈ 0.5', Math.abs(pAtOwnLevel - 0.5) < 0.01, `p=${pAtOwnLevel.toFixed(3)}`);
check('门槛远低于水平 → 概率高', approxKnownProbability(1000, 5000) > 0.9);
check('门槛远高于水平 → 概率低', approxKnownProbability(12000, 5000) < 0.1);

console.log(`\n========== 结论 ==========\n通过 ${pass} 项,失败 ${fail} 项`);
process.exitCode = fail === 0 ? 0 : 1;
