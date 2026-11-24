/**
 * 开发工具:验证音标覆盖率(本次修复的验收)。
 *
 * 原始缺陷:词典三层(ext-words → CORE_DICT → 文章重点词)里,后两层覆盖释义时
 * 没有音标字段,把底层音标一起盖掉;CORE_DICT 本身 0 音标;ext-words 又因为一个
 * 过窄的字符白名单把 65% 的音标当成"非法字符"丢弃(ECDICT 用的是西里尔形近字
 * ә/є 和 ASCII 冒号)。
 *
 * 断言:
 *   1. ext-words 的音标覆盖率 ≥ 98%;
 *   2. CORE_DICT 的每个词都能从 PHONETICS 查到音标(合并后会兜底);
 *   3. 文章重点词(keyWords)≥ 95% 有音标来源;
 *   4. 音标里不含西里尔形近字 / ASCII 冒号(必须是标准 IPA);
 *   5. 抽样:abandon / the / and 的音标正确。
 *
 * 用法:node scripts/verify-phonetics.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'scripts', 'out', 'verify-phonetics');

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// ── 加载 PHONETICS(纯数据文件,可直接转译)──
const src = fs.readFileSync(path.join(ROOT, 'src', 'data', 'phonetics.ts'), 'utf8');
const js = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const file = path.join(OUT, 'phonetics.mjs');
fs.writeFileSync(file, js, 'utf8');
const { PHONETICS } = await import(`file://${file.replace(/\\/g, '/')}`);

const extSrc = fs.readFileSync(path.join(ROOT, 'src', 'data', 'ext-words.ts'), 'utf8');
const coreSrc = fs.readFileSync(path.join(ROOT, 'src', 'data', 'dict-core.ts'), 'utf8');

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

console.log('\n── 1. ext-words 覆盖率 ──');
const extEntries = [...extSrc.matchAll(/\{[^{}]*"headword"[^{}]*\}/g)].map((m) => m[0]);
const extWith = extEntries.filter((e) => /"phonetic":\s*"[^"]+"/.test(e));
const extCoverage = extWith.length / extEntries.length;
console.log(
  `  条目 ${extEntries.length} · 有音标 ${extWith.length} · ${(extCoverage * 100).toFixed(1)}%`,
);
check('ext-words 覆盖率 ≥ 98%', extCoverage >= 0.98, `实际 ${(extCoverage * 100).toFixed(1)}%`);
check('ext-words 条目数 ≥ 6700', extEntries.length >= 6700, `实际 ${extEntries.length}`);

console.log('\n── 2. CORE_DICT 可兜底 ──');
const coreKeys = [...coreSrc.matchAll(/^ {2}([a-zA-Z][a-zA-Z'-]*): \{/gm)].map((m) => m[1].toLowerCase());
const coreMissing = coreKeys.filter((k) => !PHONETICS[k]);
console.log(`  CORE_DICT ${coreKeys.length} 条 · 能从 PHONETICS 取到 ${coreKeys.length - coreMissing.length}`);
check('CORE_DICT 全部可查音标', coreMissing.length === 0, coreMissing.length ? `缺 ${coreMissing.slice(0, 6).join(',')}` : '');

console.log('\n── 3. 文章重点词 ──');
const artDir = path.join(ROOT, 'src', 'data', 'articles');
let kwTotal = 0;
let kwHit = 0;
for (const f of fs.readdirSync(artDir)) {
  if (!f.endsWith('.ts') || ['index.ts', 'build.ts', 'remote-registry.ts'].includes(f)) continue;
  const text = fs.readFileSync(path.join(artDir, f), 'utf8');
  for (const m of text.matchAll(/headword: '([^']+)'/g)) {
    kwTotal += 1;
    if (PHONETICS[m[1].toLowerCase()]) kwHit += 1;
  }
}
const kwCoverage = kwTotal ? kwHit / kwTotal : 0;
console.log(`  重点词 ${kwTotal} 个 · 有音标 ${kwHit} · ${(kwCoverage * 100).toFixed(1)}%`);
check('重点词覆盖率 ≥ 95%', kwCoverage >= 0.95, `实际 ${(kwCoverage * 100).toFixed(1)}%`);

console.log('\n── 4. 音标必须是标准 IPA ──');
const values = Object.values(PHONETICS);
const cyrillic = values.filter((v) => /[әєӘЄөӨа-яА-Я]/.test(v));
const asciiColon = values.filter((v) => v.includes(':'));
const bracket = values.filter((v) => /[[\]/()]/.test(v));
check('无西里尔形近字', cyrillic.length === 0, cyrillic.length ? `样例 ${cyrillic.slice(0, 3).join(' | ')}` : '');
check('无 ASCII 冒号(应为长音符 ː)', asciiColon.length === 0, asciiColon.length ? `样例 ${asciiColon.slice(0, 3).join(' | ')}` : '');
check('无包裹括号/斜杠', bracket.length === 0, bracket.length ? `样例 ${bracket.slice(0, 3).join(' | ')}` : '');
const cjkBracket = values.filter((v) => /[（）]/.test(v));
check('无「词根（后缀）」这种占位写法', cjkBracket.length === 0, cjkBracket.length ? `样例 ${cjkBracket.slice(0, 3).join(' | ')}` : '');

console.log('\n── 5. 抽样正确性 ──');
const samples = [
  ['abandon', 'əˈbændən'],
  ['ability', 'əˈbiliti'],
];
for (const [w, expect] of samples) {
  check(`${w} = ${expect}`, PHONETICS[w] === expect, `实际 ${PHONETICS[w] ?? '(无)'}`);
}
// the/and 是 CORE_DICT 里的词,必须能兜底
for (const w of ['the', 'and', 'but', 'with']) {
  check(`${w} 有音标(${PHONETICS[w] ?? '缺'})`, Boolean(PHONETICS[w]));
}
check('音标总数 ≥ 7000', Object.keys(PHONETICS).length >= 7000, `实际 ${Object.keys(PHONETICS).length}`);

console.log('\n========== 结论 ==========');
console.log(`通过 ${pass} 项,失败 ${fail} 项`);
process.exit(fail === 0 ? 0 : 1);
