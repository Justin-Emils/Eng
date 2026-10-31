/**
 * 开发工具:验证登录同步方向的决策(P0-2 的验收用例)。
 *
 * 原始缺陷:云端**读取失败**被当成"云端没有备份",于是本机有数据时会自动上传,
 * 一次 GET 抖动就把云端备份换成本机旧数据,还提示"已同步到云端"。
 *
 * 这里断言六种情形,重点是第 1 条:读取失败必须转成"问用户",绝不能 fallback 到上传。
 *
 * 用法:node scripts/verify-login-sync.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'scripts', 'out', 'verify-login-sync');

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const src = fs.readFileSync(path.join(ROOT, 'src', 'domain', 'login-sync.ts'), 'utf8');
const js = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const file = path.join(OUT, 'login-sync.mjs');
fs.writeFileSync(file, js, 'utf8');

const { decideLoginSync } = await import(`file://${file.replace(/\\/g, '/')}`);

let pass = 0;
let fail = 0;
function expect(name, input, wantAuto, msgKeyword) {
  const got = decideLoginSync({
    localHasData: false,
    localWords: 0,
    remoteHasBackup: false,
    remoteWords: 0,
    remoteError: '',
    ownershipConflict: false,
    ownerEmail: '',
    ...input,
  });
  const autoOk = got.auto === wantAuto;
  const msgOk = !msgKeyword || got.message.includes(msgKeyword);
  if (autoOk && msgOk) {
    pass += 1;
    console.log(`  ✓ ${name} → auto=${got.auto ?? 'null(问用户)'}`);
  } else {
    fail += 1;
    console.log(`  ✗ ${name} → auto=${got.auto ?? 'null'}(期望 ${wantAuto ?? 'null'})`);
    console.log(`      message: ${got.message}`);
  }
}

console.log('\n── P0-2 回归:读取云端失败时绝不能自动上传 ──');
expect(
  '本机有 20 词 + 读云端失败',
  { localHasData: true, localWords: 20, remoteError: '请求超时' },
  null,
  '读取云端备份失败',
);
expect(
  '本机有 20 词 + 读云端失败(哪怕远端其实有备份)',
  { localHasData: true, localWords: 20, remoteHasBackup: true, remoteWords: 50, remoteError: 'HTTP 500' },
  null,
  '不自动同步',
);
expect(
  '本机空 + 读云端失败(也不能擅自 bind 后覆盖)',
  { localHasData: false, localWords: 0, remoteError: 'Network request failed' },
  null,
  '读取云端备份失败',
);

console.log('\n── 正常分支 ──');
expect('本机空 + 云端有 50 词', { remoteHasBackup: true, remoteWords: 50 }, 'restore');
expect('本机空 + 云端空', {}, 'bind');
expect('本机有 20 词 + 云端空', { localHasData: true, localWords: 20 }, 'upload');
expect('两边都有(20 vs 50)', { localHasData: true, localWords: 20, remoteHasBackup: true, remoteWords: 50 }, null, '请选择');
expect(
  '归属属于另一个账号',
  { localHasData: true, localWords: 20, remoteHasBackup: true, remoteWords: 50, ownershipConflict: true, ownerEmail: 'a@b.com' },
  null,
  'a@b.com',
);

console.log(`\n========== 结论 ==========\n通过 ${pass} 项,失败 ${fail} 项`);
process.exitCode = fail === 0 ? 0 : 1;
