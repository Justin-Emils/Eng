/**
 * 开发工具:配色对比度审计(浅色/深色两套主题)。
 *
 * 用途:检查 ThemedText/ThemedView 组合下的实际可读性,避免"深色模式下字看不清"。
 * 判定:WCAG 对比度 —— 正文 ≥ 4.5 合格,≥ 3.0 仅够大字/次要信息,< 3.0 必须修。
 *
 * 用法:node scripts/audit-contrast.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const raw = fs.readFileSync(path.join(ROOT, 'src/constants/theme.ts'), 'utf8');
// theme.ts 依赖 react-native 与全局样式,审计时替换为桩代码
const src = raw
  .replace(/import\s+'@\/global\.css';\s*/g, '')
  .replace(/import\s+\{\s*Platform\s*\}\s+from\s+'react-native';\s*/g, 'const Platform = { select: (o) => o.default, OS: "android" };\n');
const js = ts.transpileModule(src, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const mod = await import(`data:text/javascript;base64,${Buffer.from(js, 'utf8').toString('base64')}`);
const { Colors } = mod;

function luminance(hex) {
  const n = hex.replace('#', '');
  const rgb = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
  const [r, g, b] = rgb.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

const PAIRS = [
  ['text', 'background', '正文 / 页面背景', 4.5],
  ['text', 'backgroundElement', '正文 / 卡片背景', 4.5],
  ['text', 'backgroundSelected', '正文 / 选中背景', 4.5],
  ['textSecondary', 'background', '次要文字 / 页面背景', 4.5],
  ['textSecondary', 'backgroundElement', '次要文字 / 卡片背景', 4.5],
  ['textSecondary', 'backgroundSelected', '次要文字 / 选中背景', 4.5],
  ['accent', 'background', '强调色 / 页面背景', 3.0],
  ['accent', 'backgroundElement', '强调色 / 卡片背景', 3.0],
  ['accent', 'accentSoft', '强调色 / 强调衬底', 3.0],
  ['border', 'backgroundElement', '描边 / 卡片背景', 1.2],
];

let worst = [];
for (const themeName of ['light', 'dark']) {
  const c = Colors[themeName];
  console.log(`\n===== ${themeName} 主题 =====`);
  for (const [fgKey, bgKey, label, min] of PAIRS) {
    const fg = c[fgKey];
    const bg = c[bgKey];
    const ratio = contrast(fg, bg);
    const ok = ratio >= min;
    const flag = ok ? '✓' : ratio >= min * 0.9 ? '! 偏低' : '✗ 差';
    console.log(
      `${flag}  ${ratio.toFixed(2).padStart(5)}  (需≥${min})  ${label.padEnd(18)} ${fg} on ${bg}`,
    );
    if (!ok) worst.push({ theme: themeName, label, ratio, min });
  }
  // 填充按钮:文字 / 按钮底色(修复后用 accentStrong + onAccentStrong)
  const onAccent = contrast(c.onAccentStrong, c.accentStrong);
  console.log(
    `${onAccent >= 4.5 ? '✓' : onAccent >= 3 ? '!' : '✗'}  ${onAccent.toFixed(2).padStart(5)}  (需≥4.5)  按钮文字/按钮底色     ${c.onAccentStrong} on ${c.accentStrong}`,
  );
  if (onAccent < 4.5)
    worst.push({ theme: themeName, label: '按钮文字/按钮底色', ratio: onAccent, min: 4.5 });
  // 记录旧写法的问题(仅提示,不计入结论)
  const legacy = contrast('#ffffff', c.accent);
  console.log(`     ${legacy.toFixed(2).padStart(5)}  (旧写法参考)          #ffffff on accent ${c.accent}`);
}

console.log('\n===== 结论 =====');
if (worst.length === 0) console.log('所有组合均达标');
else for (const w of worst) console.log(`需关注:${w.theme} 主题 · ${w.label} = ${w.ratio.toFixed(2)}(需 ≥ ${w.min})`);

// 按钮配色候选(蓝底按钮文字必须 ≥ 4.5)
console.log('\n===== 按钮配色候选(文字 / 底色 = 对比度)=====');
const BUTTON_CANDIDATES = [
  ['#ffffff', '#208AEF', '现状浅色:白字/现有蓝'],
  ['#ffffff', '#1668C9', '浅色候选:白字/更深的蓝'],
  ['#ffffff', '#12559F', '浅色候选2:白字/更深蓝'],
  ['#ffffff', '#0F5CC0', '浅色候选3'],
  ['#08243D', '#4DA3FF', '深色候选:深墨蓝字/现有亮蓝'],
  ['#0A1D33', '#4DA3FF', '深色候选2'],
  ['#ffffff', '#1B5FA8', '深色候选3:白字/深蓝底'],
  ['#04223F', '#7CBDFF', '深色候选4:深字/更亮蓝'],
];
for (const [fg, bg, label] of BUTTON_CANDIDATES) {
  const r = contrast(fg, bg);
  console.log(`${r >= 4.5 ? '✓' : r >= 3 ? '!' : '✗'}  ${r.toFixed(2).padStart(5)}  ${label.padEnd(26)} ${fg} on ${bg}`);
}
