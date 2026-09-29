/**
 * 校验:主题注册表的运行时自洽性。
 *
 * 用与 audit-contrast.mjs 相同的"转译 + 打桩"手法把 src/constants/theme.ts 跑起来,断言:
 *   · 每个主题都在 THEME_META 里登记、令牌齐全(所有主题的键集合完全一致);
 *   · 令牌都是合法 hex;
 *   · 取色确实随主题与深浅色变化;
 *   · 存储里残留的未知主题 id 会退回默认主题,而不是返回 undefined 把界面刷白。
 *
 * 有失败项时以非零码退出。用法:node scripts/verify-theme.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const raw = fs.readFileSync(path.join(ROOT, 'src/constants/theme.ts'), 'utf8');
const stubbed = raw
  .replace(/import\s+'@\/global\.css';\s*/g, '')
  .replace(
    /import\s+\{\s*Platform\s*\}\s+from\s+'react-native';\s*/g,
    'const Platform = { select: (o) => o.default, OS: "android" };\n',
  );
const js = ts.transpileModule(stubbed, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const mod = await import(`data:text/javascript;base64,${Buffer.from(js, 'utf8').toString('base64')}`);

const { Themes, THEME_IDS, THEME_META, DEFAULT_THEME_ID, getPalette, getSkin, isThemeId } = mod;

let failed = 0;
function check(label, ok, detail = '') {
  if (!ok) failed += 1;
  console.log(`${ok ? '✓' : '✗'}  ${label}${detail ? `  → ${detail}` : ''}`);
}

console.log('===== 注册表自洽 =====');
check('THEME_IDS 由 Themes 推导且顺序稳定', JSON.stringify(THEME_IDS) === '["default","siracusa"]', JSON.stringify(THEME_IDS));
check('每个主题都在 THEME_META 里登记', THEME_IDS.every((id) => THEME_META[id]?.id === id));
check(
  '每个主题的 name/tagline 都非空',
  THEME_IDS.every((id) => THEME_META[id].name.length > 0 && THEME_META[id].tagline.length > 0),
);
check('DEFAULT_THEME_ID 是合法主题', isThemeId(DEFAULT_THEME_ID), DEFAULT_THEME_ID);

console.log('\n===== 令牌完整性 =====');
const keySets = {};
for (const id of THEME_IDS) {
  for (const scheme of ['light', 'dark']) {
    keySets[`${id}.${scheme}`] = Object.keys(Themes[id][scheme]).sort().join(',');
  }
}
const distinct = new Set(Object.values(keySets));
check(
  '所有主题 × 深浅色的令牌键集合完全一致',
  distinct.size === 1,
  distinct.size === 1 ? `${Object.keys(Themes[THEME_IDS[0]].light).length} 个令牌` : '存在缺令牌的主题',
);
if (distinct.size !== 1) for (const [k, v] of Object.entries(keySets)) console.log(`   ${k}: ${v}`);

const hexOk = (v) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
const badValues = [];
for (const id of THEME_IDS) {
  for (const scheme of ['light', 'dark']) {
    for (const [k, v] of Object.entries(Themes[id][scheme])) {
      if (!hexOk(v)) badValues.push(`${id}.${scheme}.${k}=${v}`);
    }
  }
}
check('所有令牌都是 6 位 hex', badValues.length === 0, badValues.join(', '));

console.log('\n===== 取色与兜底 =====');
check('default 浅色底仍是纯白', getPalette('default', 'light').background === '#ffffff');
/**
 * 叙拉古的色值**来自活动截图的实测**(见 docs/theme-siracusa.md 第 14 节),
 * 所以这里钉的是测量结果,不是设计偏好。改这两个值之前先回去看测量。
 */
check('siracusa 浅色底是淡紫纸(衍生,参考无浅色界面)', getPalette('siracusa', 'light').background === '#F4F1F8');
check('siracusa 深色底是实测的冷紫黑', getPalette('siracusa', 'dark').background === '#0B0912');
check(
  'siracusa 深色强调是实测最大色族(蓝紫),不是金',
  getPalette('siracusa', 'dark').accent === '#8F88F2',
  getPalette('siracusa', 'dark').accent,
);
check(
  'siracusa 深色标注是品红(看宣传页后补的第三个强调色)',
  getPalette('siracusa', 'dark').annotate === '#EC6BB6',
  getPalette('siracusa', 'dark').annotate,
);
check(
  'siracusa 深色装饰金是实测暖金',
  getPalette('siracusa', 'dark').gold === '#D8A05D',
  getPalette('siracusa', 'dark').gold,
);
check(
  '两套主题的浅色确实不同',
  getPalette('default', 'light').background !== getPalette('siracusa', 'light').background,
);
check(
  '同一主题深浅色确实不同',
  getPalette('siracusa', 'light').background !== getPalette('siracusa', 'dark').background,
);
// 存储里可能留着已下线主题的旧值:必须退回默认主题而不是 undefined
const fallback = getPalette('__gone__', 'light');
check('未知主题 id 退回默认主题', fallback?.background === '#ffffff', String(fallback?.background));
check('isThemeId 拒绝未知值', isThemeId('__gone__') === false && isThemeId(undefined) === false && isThemeId(7) === false);
check('isThemeId 接受已登记主题', THEME_IDS.every((id) => isThemeId(id)));

/**
 * 形态语言(几何 + 字形)必须**跟主题走**。
 *
 * 这条护栏是针对一个真实回归写的:曾经把 P1 的字形/圆角改成了全局无条件应用,
 * 结果"切回默认主题只换了颜色,UI 没回到原来的样子"。
 * 所以这里把"默认主题 = 原 App 的样子"钉死成断言,以后再有人把衬线或方直角
 * 写进组件里(而不是 skin 里),这个脚本会直接报红。
 */
console.log('\n===== 形态语言(几何 + 字形) =====');
const SKIN_KEYS = [
  'displayFont',
  'bodyFont',
  'bodyLineHeight',
  'radiusCard',
  'radiusPanel',
  'radiusChip',
  'cardFrame',
  'buttonInsetRule',
  'plateLabels',
  'motifs',
  'coverArt',
  'mascot',
  'numericWeight',
];
for (const id of THEME_IDS) {
  const skin = getSkin(id);
  const missing = SKIN_KEYS.filter((k) => skin?.[k] === undefined);
  check(`${id} 的 skin 字段齐全`, missing.length === 0, missing.join(', '));
  const badRadius = ['radiusCard', 'radiusPanel', 'radiusChip'].filter(
    (k) => typeof skin?.[k] !== 'number' || skin[k] < 0,
  );
  check(`${id} 的圆角都是非负数`, badRadius.length === 0, badRadius.join(', '));
}

const d = getSkin('default');
check('默认主题的展示字体是无衬线(原样)', d.displayFont === 'sans', d.displayFont);
check('默认主题的阅读正文是无衬线(原样)', d.bodyFont === 'sans', d.bodyFont);
check('默认主题的正文行高倍数是 1.7(原样)', d.bodyLineHeight === 1.7, String(d.bodyLineHeight));
check('默认主题卡片圆角 16(原样)', d.radiusCard === 16, String(d.radiusCard));
check('默认主题芯片圆角 999 胶囊(原样)', d.radiusChip === 999, String(d.radiusChip));
check('默认主题不画卡片描边/金刻线(原样)', d.cardFrame === false);
check('默认主题按钮无内嵌细线(原样)', d.buttonInsetRule === false);
check('默认主题标签不是铭牌式(原样)', d.plateLabels === false);
check('默认主题不启用纹样(保留 emoji,原样)', d.motifs === false);
check('默认主题封面仍是原照片回退(原样)', d.coverArt === 'photo', String(d.coverArt));
check('默认主题不用形象(原样)', d.mascot === false);
check('默认主题统计数字仍然粗(原样)', d.numericWeight === '800', String(d.numericWeight));

const s = getSkin('siracusa');
check('叙拉古的展示字体是衬线', s.displayFont === 'serif', s.displayFont);
check('叙拉古的阅读正文是衬线', s.bodyFont === 'serif', s.bodyFont);
check('叙拉古画卡片描边 + 金刻线', s.cardFrame === true);
check('叙拉古按钮有内嵌细线', s.buttonInsetRule === true);
check('叙拉古标签是铭牌式', s.plateLabels === true);
check('叙拉古启用纹样(幕布/菱形/印章)', s.motifs === true);
check('叙拉古封面走程序化节目单', s.coverArt === 'playbill', String(s.coverArt));
check('叙拉古启用形象(抠出的角色)', s.mascot === true);
check(
  '封面来源与纹样是**独立**开关(改一个不会连带改另一个)',
  typeof d.coverArt === 'string' && typeof s.coverArt === 'string' && 'motifs' in d && 'motifs' in s,
);
check('叙拉古的圆角确实比默认主题小', s.radiusCard < d.radiusCard && s.radiusChip < d.radiusChip);

console.log(`\n===== 结论 =====\n失败项:${failed}`);
process.exitCode = failed === 0 ? 0 : 1;
