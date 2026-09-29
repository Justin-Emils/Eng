/**
 * 开发工具:配色对比度审计(遍历**所有主题** × 浅色/深色)。
 *
 * 用途:检查 ThemedText/ThemedView 组合下的实际可读性,避免"深色模式下字看不清",
 * 以及新增主题时不小心引入不达标的令牌。
 * 判定:WCAG 对比度 —— 正文 ≥ 4.5 合格,≥ 3.0 仅够大字/次要信息,< 3.0 必须修。
 *
 * 有失败项时以非零码退出,便于接进 CI。
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
/**
 * theme.ts 依赖 react-native 与全局样式,审计时替换为桩代码。
 * 注意:theme.ts 必须保持**只有这两个 import**,否则这里要同步补桩。
 */
const src = raw
  .replace(/import\s+'@\/global\.css';\s*/g, '')
  .replace(
    /import\s+\{\s*Platform\s*\}\s+from\s+'react-native';\s*/g,
    'const Platform = { select: (o) => o.default, OS: "android" };\n',
  );
const js = ts.transpileModule(src, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const mod = await import(`data:text/javascript;base64,${Buffer.from(js, 'utf8').toString('base64')}`);
const { Themes, THEME_IDS, THEME_META } = mod;

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

/**
 * 需要校验的组合。[前景令牌, 背景令牌, 说明, 最低对比度]
 * 门槛的取法:凡是"能被当文字读"的令牌都按 4.5;
 * 只有纯装饰(金线、描边)才允许低门槛 —— 这也是"金只做线不做字"的由来。
 */
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
  // 生词高亮是压在正文上的**文字**,所以按正文标准要求,而不是 3.0
  ['annotate', 'background', '生词高亮 / 阅读正文底', 4.5],
  ['annotateStrong', 'background', '今日新学词 / 阅读正文底', 4.5],
  ['annotate', 'annotateSoft', '生词高亮 / 标注衬底', 3.0],
  ['danger', 'background', '错误色 / 页面背景', 4.5],
  ['danger', 'dangerSoft', '错误色 / 错误衬底', 4.5],
  ['success', 'background', '成功色 / 页面背景', 4.5],
  ['success', 'successSoft', '成功色 / 成功衬底', 4.5],
  // 装饰:只要求"看得出来",不要求可读
  ['gold', 'background', '金线(仅装饰)/ 页面背景', 1.5],
  ['gold', 'backgroundElement', '金线(仅装饰)/ 卡片背景', 1.5],
  ['border', 'backgroundElement', '描边 / 卡片背景', 1.2],
];

const failures = [];

for (const themeId of THEME_IDS) {
  const meta = THEME_META[themeId];
  console.log(`\n========== 主题:${meta.name}(${themeId}) ==========`);
  console.log(`           ${meta.tagline}`);

  for (const scheme of ['light', 'dark']) {
    const c = Themes[themeId][scheme];
    console.log(`\n----- ${scheme} -----`);
    for (const [fgKey, bgKey, label, min] of PAIRS) {
      const fg = c[fgKey];
      const bg = c[bgKey];
      const ratio = contrast(fg, bg);
      const ok = ratio >= min;
      const flag = ok ? '✓' : '✗ 不达标';
      console.log(
        `${flag}  ${ratio.toFixed(2).padStart(5)}  (需≥${min})  ${label.padEnd(20)} ${fg} on ${bg}`,
      );
      if (!ok) failures.push({ theme: meta.name, scheme, label, ratio, min });
    }
    // 填充按钮:文字 / 按钮底色
    const onAccent = contrast(c.onAccentStrong, c.accentStrong);
    console.log(
      `${onAccent >= 4.5 ? '✓' : '✗ 不达标'}  ${onAccent.toFixed(2).padStart(5)}  (需≥4.5)  按钮文字 / 按钮底色    ${c.onAccentStrong} on ${c.accentStrong}`,
    );
    if (onAccent < 4.5) {
      failures.push({ theme: meta.name, scheme, label: '按钮文字/按钮底色', ratio: onAccent, min: 4.5 });
    }
  }
}

console.log('\n========== 结论 ==========');
if (failures.length === 0) {
  const n = THEME_IDS.length * 2 * (PAIRS.length + 1);
  console.log(`全部通过(${THEME_IDS.length} 个主题 × 2 种深浅色,共 ${n} 项组合)`);
} else {
  for (const f of failures) {
    console.log(`需关注:${f.theme} · ${f.scheme} · ${f.label} = ${f.ratio.toFixed(2)}(需 ≥ ${f.min})`);
  }
  process.exitCode = 1;
}
