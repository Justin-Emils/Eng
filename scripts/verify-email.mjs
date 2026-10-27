/**
 * 开发工具:验证邮箱格式与笔误纠正(B1)。
 *
 * 做法与 verify-profile.mjs 相同:把 `src/domain/email-syntax.ts` 用 TypeScript API
 * 转译到 scripts/out/verify-email/,再在 Node 里调用**真实函数**做断言。
 * (纯逻辑模块不 import AsyncStorage,所以不需要打桩。)
 *
 * 用法:node scripts/verify-email.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'scripts', 'out', 'verify-email');

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// 只转译这一个纯模块
const srcFile = path.join(SRC, 'domain', 'email-syntax.ts');
const code = fs.readFileSync(srcFile, 'utf8');
const out = ts.transpileModule(code, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const outFile = path.join(OUT, 'email-syntax.mjs');
fs.writeFileSync(outFile, out.outputText, 'utf8');

const mod = await import(`file://${outFile.replace(/\\/g, '/')}`);
const { emailSyntaxError, suggestEmail, normalizeEmail } = mod;

let pass = 0;
let fail = 0;

/** 期望"合法" */
function valid(value) {
  const err = emailSyntaxError(value);
  if (err === null) {
    pass += 1;
    console.log(`  ✓ 合法  ${value}`);
  } else {
    fail += 1;
    console.log(`  ✗ 合法但被判错  ${value}  →  ${err}`);
  }
}

/** 期望"不合法",并可选校验错误里包含某个关键词 */
function invalid(value, keyword) {
  const err = emailSyntaxError(value);
  if (err === null) {
    fail += 1;
    console.log(`  ✗ 非法但被放行  ${value}`);
  } else if (keyword && !err.includes(keyword)) {
    fail += 1;
    console.log(`  ✗ 提示不含「${keyword}」 ${value}  →  ${err}`);
  } else {
    pass += 1;
    console.log(`  ✓ 拦下  ${value.padEnd(34)} → ${err}`);
  }
}

console.log('\n── 合法邮箱 ──');
valid('a@b.com');
valid('first.last+tag@gmail.com');
valid('user_1-test@qq.com');
valid('  MiXeD@Example.COM  '); // 允许大小写与空白,内部会规范化
valid('a@sub.domain.co.uk');

console.log('\n── 非法邮箱 ──');
invalid('', '请输入邮箱');
invalid('abc', '格式不正确');
invalid('a@b', '域名不完整');
invalid('a@.com', '空的段');
invalid('a@b..com', '空的段');
invalid('a@-b.com', '连字符');
invalid('a@b.c', '结尾不对');
invalid('a@b.1com', '结尾不对');
invalid('.a@b.com', '以点开头');
invalid('a.@b.com', '以点');
invalid('a..b@b.com', '连续的两个点');
invalid('a b@b.com', '不能有空格');
invalid('a@b.com extra', '不能有空格');
invalid(`${'x'.repeat(65)}@b.com`, '太长了');
invalid(`${'x'.repeat(250)}@b.com`, '太长了');

console.log('\n── 笔误建议 ──');
const typos = [
  ['foo@gmial.com', 'foo@gmail.com'],
  ['a@163.con', 'a@163.com'],
  ['b@qq.co', 'b@qq.com'],
  ['c@gmail.con', 'c@gmail.com'],
  ['d@hotmial.com', 'd@hotmail.com'],
];
for (const [input, expect] of typos) {
  const got = suggestEmail(input);
  if (got === expect) {
    pass += 1;
    console.log(`  ✓ ${input.padEnd(22)} → ${got}`);
  } else {
    fail += 1;
    console.log(`  ✗ ${input.padEnd(22)} → ${got}(期望 ${expect})`);
  }
}
// 正常域名不应被"纠正"
for (const ok of ['a@gmail.com', 'b@qq.com', 'c@163.com', 'd@company.cn']) {
  const got = suggestEmail(ok);
  if (got === null) {
    pass += 1;
    console.log(`  ✓ ${ok.padEnd(22)} → 不误改`);
  } else {
    fail += 1;
    console.log(`  ✗ ${ok.padEnd(22)} → 被误改成 ${got}`);
  }
}

console.log('\n── 笔误提示是否拼进错误信息 ──');
const typoErr = emailSyntaxError('foo..bar@gmial.com');
if (typoErr && typoErr.includes('foo..bar@gmail.com')) {
  pass += 1;
  console.log(`  ✓ ${typoErr}`);
} else {
  fail += 1;
  console.log(`  ✗ 错误信息里没有建议:${typoErr}`);
}

console.log('\n── 规范化 ──');
const norm = normalizeEmail('  Foo@Bar.COM ');
if (norm === 'foo@bar.com') {
  pass += 1;
  console.log(`  ✓ "  Foo@Bar.COM " → ${norm}`);
} else {
  fail += 1;
  console.log(`  ✗ 规范化结果不对:${norm}`);
}

console.log(`\n========== 结论 ==========\n通过 ${pass} 项,失败 ${fail} 项`);
process.exitCode = fail === 0 ? 0 : 1;
