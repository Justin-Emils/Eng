/**
 * 校验:程序化封面的外观生成器(`src/domain/cover-art.ts`)。
 *
 * 直接跑**真实代码**(转译 + 重写 '@/ ' 别名,与其它 verify-*.mjs 同一套路),断言:
 *   · 确定性 —— 同一个 id 永远同一套外观(封面不能每次打开都变);
 *   · 对比度 —— 象牙墨色压在版心底色上必须远超 4.5(封面文字是可读性红线);
 *   · 分散度 —— 布局/徽记/色相在大量 id 上分布均匀,不出现"某个布局从不出现";
 *   · 多样性 —— 用"布局+徽记+色相桶"做指纹,断言一屏 30 篇几乎不会撞脸。
 *
 * 同时把真实算出来的样张写到 `docs/mockups/cover-art-preview.html`,
 * 这样"会不会单调"这件事是**看真实输出**判断的,不是靠描述。
 *
 * 用法:node scripts/verify-cover-art.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'scripts', 'out', 'verify-cover-art');

function transpile(relSrc, relOut, rewrites = []) {
  const raw = fs.readFileSync(path.join(ROOT, relSrc), 'utf8');
  let src = raw;
  for (const [from, to] of rewrites) src = src.split(from).join(to);
  const js = ts.transpileModule(src, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  fs.writeFileSync(path.join(OUT, relOut), js, 'utf8');
}

fs.mkdirSync(OUT, { recursive: true });
transpile('src/domain/cover.ts', 'cover.mjs');
transpile('src/domain/cover-art.ts', 'cover-art.mjs', [["'@/domain/cover'", "'./cover.mjs'"]]);

const { coverArtFor, coverFingerprint } = await import(`file://${path.join(OUT, 'cover-art.mjs')}`);

let failed = 0;
function check(label, ok, detail = '') {
  if (!ok) failed += 1;
  console.log(`${ok ? '✓' : '✗'}  ${label}${detail ? `  → ${detail}` : ''}`);
}

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

/** 造一批像真实文章 id 的样本(带前后缀、长度不一) */
const IDS = [];
for (let i = 0; i < 1000; i += 1) {
  IDS.push(`kaoyan-2024-${String(i).padStart(4, '0')}-${(i * 7919) % 997}`);
}

console.log('===== 确定性 =====');
check('同一 id 两次生成完全一致', IDS.slice(0, 50).every((id) => JSON.stringify(coverArtFor(id)) === JSON.stringify(coverArtFor(id))));
check('不同 id 会生成不同外观', IDS[0] !== IDS[1] && JSON.stringify(coverArtFor(IDS[0])) !== JSON.stringify(coverArtFor(IDS[1])));

console.log('\n===== 对比度(象牙墨色 / 版心底色) =====');
let minContrast = Infinity;
let worstId = '';
for (const id of IDS) {
  const s = coverArtFor(id);
  const c = contrast(s.ink, s.base);
  if (c < minContrast) {
    minContrast = c;
    worstId = id;
  }
}
check('墨色压在底色上 ≥ 7(远高于正文门槛 4.5)', minContrast >= 7, `最低 ${minContrast.toFixed(2)} @ ${worstId}`);

console.log('\n===== 分布均匀度 =====');
const layoutCount = new Map();
const markCount = new Map();
for (const id of IDS) {
  const s = coverArtFor(id);
  layoutCount.set(s.layout, (layoutCount.get(s.layout) ?? 0) + 1);
  markCount.set(s.mark, (markCount.get(s.mark) ?? 0) + 1);
}
for (const [k, v] of [...layoutCount.entries()].sort()) {
  const share = v / IDS.length;
  check(`布局 ${k} 占比合理`, Math.abs(share - 0.25) < 0.06, `${(share * 100).toFixed(1)}%`);
}
check('四种徽记都出现过', markCount.size === 4, [...markCount.keys()].join(', '));
for (const [k, v] of [...markCount.entries()].sort()) {
  const share = v / IDS.length;
  check(`徽记 ${k} 占比合理`, Math.abs(share - 0.25) < 0.06, `${(share * 100).toFixed(1)}%`);
}

console.log('\n===== 多样性("会不会单调") =====');
const fps = new Set(IDS.map(coverFingerprint));
check('1000 个 id 至少产生 320 种外观指纹', fps.size >= 320, `${fps.size} 种`);
/** 最该关心的其实是这个:列表一屏 30 篇里撞脸的概率 */
function collisions(list) {
  const seen = new Map();
  for (const id of list) {
    const f = coverFingerprint(id);
    seen.set(f, (seen.get(f) ?? 0) + 1);
  }
  return [...seen.values()].reduce((acc, n) => acc + (n - 1), 0);
}
const firstScreen = IDS.slice(0, 30);
const dup = collisions(firstScreen);
check('首页 30 篇里重复外观不超过 3 张', dup <= 3, `${dup} 张重复`);

console.log('\n===== 生成样张(用真实输出) =====');
const SAMPLE = IDS.slice(0, 18);
const cards = SAMPLE.map((id, i) => {
  const s = coverArtFor(id);
  const blockW = 150;
  const big = 26 * (3.0 + s.jitter * 1.6);
  const small = 26 * (1.8 + s.jitter * 0.8);
  let layoutHtml = '';
  if (s.layout === 0) {
    layoutHtml = `
      <div class="blk" style="background:${s.block};width:${big}px;height:${big}px;border-radius:${big / 2}px;right:${-big * 0.28}px;top:${-big * (0.26 + s.jitter * 0.18)}px"></div>
      <div class="blk" style="background:${s.blockSoft};width:${small}px;height:${small}px;border-radius:${small / 2}px;left:${-small * 0.38}px;bottom:${-small * (0.32 + s.jitter * 0.2)}px"></div>`;
  } else if (s.layout === 1) {
    layoutHtml = `
      <div class="blk" style="background:${s.block};width:${22 + Math.round(s.jitter * 10)}%;top:0;bottom:0;left:0"></div>
      <div class="blk" style="background:${s.blockSoft};width:${big}px;height:${big}px;border-radius:${big / 2}px;right:${-big * 0.42}px;bottom:${-big * (0.3 + s.jitter * 0.2)}px"></div>`;
  } else if (s.layout === 2) {
    layoutHtml = `
      <div class="blk" style="background:${s.blockSoft};height:${30 + Math.round(s.jitter * 12)}%;left:0;right:0;bottom:0"></div>
      <div class="blk" style="background:${s.block};width:${big}px;height:${big}px;border-radius:${big / 2}px;right:${-big * (0.3 + s.jitter * 0.16)}px;top:${-big * 0.36}px"></div>`;
  } else {
    layoutHtml = `
      <div class="blk" style="background:${s.block};width:${big * 1.25}px;height:${big * 1.25}px;border-radius:${big * 0.625}px;right:${-big * 0.5}px;top:${-big * 0.62}px"></div>
      <div class="blk" style="background:${s.blockSoft};height:${Math.round(26 * (0.5 + s.jitter * 0.5))}px;left:0;right:38%;top:${38 + Math.round(s.jitter * 18)}%"></div>`;
  }
  const markHtml =
    s.mark === 'diamond'
      ? `<div style="width:8px;height:8px;background:${s.ink};transform:rotate(45deg)"></div>`
      : s.mark === 'ring'
        ? `<div style="width:26px;height:26px;border-radius:50%;border:1px solid ${s.ink}"></div>`
        : s.mark === 'bars'
          ? `<div style="display:flex;flex-direction:column;gap:4px;align-items:center">${[1, 0.66, 0.34].map((w) => `<div style="width:${26 * w}px;height:2px;background:${s.ink}"></div>`).join('')}</div>`
          : `<div style="position:relative;width:13px;height:13px"><div style="position:absolute;top:6px;left:0;width:13px;height:2px;background:${s.ink}"></div><div style="position:absolute;left:6px;top:0;width:2px;height:13px;background:${s.ink}"></div></div>`;

  const ticks = `<div class="tick tl" style="width:7px;height:7px;border-color:${s.ink}"></div><div class="tick br" style="width:7px;height:7px;border-color:${s.ink}"></div>`;
  const frameHtml =
    s.frame === 1
      ? `<div class="frameLayer" style="inset:8px">${ticks}</div>`
      : s.frame === 2
        ? `<div class="frame" style="inset:8px;border-color:${s.ink}"></div>
           <div class="frame" style="inset:12px;border-color:${s.ink};opacity:.35"></div>${ticks}`
        : `<div class="frame" style="inset:8px;border-color:${s.ink}"></div>${ticks}`;

  const topics = ['科技', '文化', '社会', '科学', '历史', '生活', '新闻', '经济', '环境', '教育'];
  return `
  <figure>
    <div class="cover" style="background:${s.base};width:${blockW}px;height:88px">
      ${layoutHtml}
      ${frameHtml}
      ${markHtml}
      <div class="label" style="left:15px;bottom:15px;color:${s.ink}">
        <div style="width:4px;height:4px;background:${s.ink};transform:rotate(45deg)"></div>${topics[i % topics.length]}
      </div>
    </div>
    <figcaption>#${i} · 布局${s.layout} · ${s.mark} · 边框${s.frame}</figcaption>
  </figure>`;
}).join('');

const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8" />
<title>节目单封面 · 真实生成样张</title>
<style>
  :root{--sans:"Segoe UI","Microsoft YaHei",system-ui,sans-serif}
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#0b0a09;font-family:var(--sans);color:#e8e0d2;padding:24px 28px;width:1180px}
  h1{font-size:20px;font-weight:600;margin-bottom:4px}
  .sub{font-size:10.5px;letter-spacing:2px;color:#9a8a6c;text-transform:uppercase;margin-bottom:20px}
  .grid{display:flex;flex-wrap:wrap;gap:18px 16px}
  figure{display:flex;flex-direction:column;gap:7px}
  .cover{position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;flex:0 0 auto}
  .blk{position:absolute}
  .frame{position:absolute;border:1px solid;opacity:.7}
  .tick{position:absolute;opacity:.9}
  .tick.tl{top:-1px;left:-1px;border-top:1px solid;border-left:1px solid}
  .tick.br{bottom:-1px;right:-1px;border-bottom:1px solid;border-right:1px solid}
  .frameLayer{position:absolute}
  .label{position:absolute;display:flex;align-items:center;gap:6px;font-size:9px;letter-spacing:2.6px;font-weight:600}
  figcaption{font-size:9px;letter-spacing:1.1px;color:#7d6f56;text-align:center;text-transform:uppercase}
</style></head><body>
<h1>节目单封面 · 真实生成样张</h1>
<div class="sub">18 covers · generated by src/domain/cover-art.ts</div>
<div class="grid">${cards}</div>
</body></html>`;

const previewPath = path.join(ROOT, 'docs', 'mockups', 'cover-art-preview.html');
fs.mkdirSync(path.dirname(previewPath), { recursive: true });
fs.writeFileSync(previewPath, html, 'utf8');
console.log(`样张已写入 docs/mockups/cover-art-preview.html(${SAMPLE.length} 张,由真实代码生成)`);

console.log(`\n===== 结论 =====\n失败项:${failed}`);
process.exitCode = failed === 0 ? 0 : 1;
