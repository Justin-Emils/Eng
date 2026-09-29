# 如何新增一个主题

主题系统已经模块化:**加一个新主题 = 改 2 个地方 + 同步 1 处断言**,其余代码不用动。
本文是这份契约的规格说明 —— 照着做,校验脚本会告诉你漏了什么。

## 一、一个主题由什么组成

```ts
ThemePair = {
  light: ThemePalette,   // 浅色配色
  dark: ThemePalette,    // 深色配色
  skin: ThemeSkin,       // 形态语言(几何 + 字形)
}
```

**颜色**与**形态**必须一起换。只换颜色不换形状,用户会觉得"这不像换了一整套主题" ——
这是当初把 `ThemeSkin` 独立出来的原因。

注册表在 `src/constants/theme.ts`:

```ts
export const Themes = { default: defaultTheme, siracusa: siracusaTheme };  // 加这里
export type ThemeId = keyof typeof Themes;                                  // 自动推导
export const THEME_IDS = Object.keys(Themes) as ThemeId[];                   // 自动推导
export const THEME_META: Record<ThemeId, ThemeMeta> = { ... };              // 加这里(穷尽检查)
```

`THEME_META` 是 `Record<ThemeId, ...>`,**少写一条会直接编译报错** —— 这是故意的,
防止"注册了主题但设置页里没有名字"。

## 二、四步流程

### 1. 写配色(浅 + 深各一套)

`ThemePalette` 共 18 个令牌,**全部必填**,一个都不能少:

| 令牌 | 用途 |
|---|---|
| `background` | 页面底色 |
| `backgroundElement` | 卡片 / 浮起面 |
| `backgroundSelected` | 选中态底色 |
| `text` | 正文 |
| `textSecondary` | 次要文字(说明、元信息) |
| `accent` | 品牌强调色:按钮、导航选中、进度条 |
| `accentStrong` | 实心按钮底色(单独存在是为了保证按钮文字对比度 ≥ 4.5) |
| `onAccentStrong` | 实心按钮上的文字色 |
| `accentSoft` | 品牌色的浅色衬底 |
| `annotate` | 学习标注色:阅读正文里的生词高亮(**与 accent 解耦**) |
| `annotateStrong` | 今日新学词(比 annotate 更重) |
| `annotateSoft` | 标注色的浅色衬底 |
| `gold` | 金:仅 1px 描边 / 角刻线 / 菱形 / 印章 —— **禁止用于文字** |
| `goldSoft` | 金的极浅衬底 |
| `border` | 分隔线 / 描边 |
| `danger` / `dangerSoft` | 错误色与衬底 |
| `success` / `successSoft` | 成功色与衬底 |

> `annotate` 为什么必须和 `accent` 分开:早先标蓝用的是品牌蓝,结果"品牌色一换,
> 阅读区的高亮也跟着变",语义就乱了。标注是**学习语义**,强调色是**品牌语义**。

### 2. 写形态语言(可以基于 `defaultSkin` 覆盖)

`ThemeSkin` 共 13 个字段:

| 字段 | 说明 |
|---|---|
| `displayFont` / `bodyFont` | `'serif'` 或 `'sans'`(具体字体由 `Fonts` 解析) |
| `bodyLineHeight` | 阅读正文行高倍数(衬线需要更多呼吸) |
| `radiusCard` | 卡片 / 列表 / 按钮 / 输入框圆角(原 App 是 16) |
| `radiusPanel` | 次级面板(提示条、译文块)圆角(原来 8~10) |
| `radiusChip` | 芯片 / 徽章圆角(原来 999) |
| `mascot` | 是否使用 App 形象(从启动动画抠出的透明角色) |
| `cardFrame` | 卡片画"节目单"描边 + 对角金刻线 |
| `buttonInsetRule` | 主按钮画内嵌细线(票券感) |
| `plateLabels` | 小标签用铭牌式:全大写 + 大字距 |
| `motifs` | 幕布轨 / 金菱形 / 蜡封印章,并用它们替换 emoji |
| `coverArt` | `'photo'`(多级真实图回退)或 `'playbill'`(程序化生成) |
| `numericWeight` | 统计数字字重(衬线 600,无衬线 800) |

三个圆角拆开而不是一个,是因为**退回默认主题时它们要各自回到各自的原值**。

### 3. 在 `THEME_META` 登记名字与说明

`id` / 名称 / 一句描述 —— 设置页的主题选择器直接读这里。

### 4. 同步校验脚本的期望值 ⚠️

`scripts/verify-theme.mjs` 第 42 行断言了主题 id 数组:

```js
check('THEME_IDS 由 Themes 推导且顺序稳定',
  JSON.stringify(THEME_IDS) === '["default","siracusa"]', ...);
```

**加主题必须改这一行**,否则校验会失败(这是刻意留的"人必须确认一次"的点)。

## 三、硬性约束(违反会出问题)

1. **组件里不许出现颜色字面量。**
   扫描方式:`Get-ChildItem src -Recurse -Include *.ts,*.tsx | Select-String "#[0-9A-Fa-f]{6}\b"`
   —— 现在只剩注释里的实测值记录,代码应为 0 处。

2. **对比度必须过审计。**
   `node scripts/audit-contrast.mjs` —— 文字 ≥ 4.5、装饰金线 ≥ 1.5、描边 ≥ 1.2,
   逐主题 × 浅深共 80+ 项,任一项不过会非零退出。

3. **`theme.ts` 只能有两个 import**(`@/global.css` 和 `react-native` 的 `Platform`)。
   两个校验脚本是把 theme.ts 转译后在 Node 里跑的,用正则替换这两个 import 做桩;
   引入第三个 import 就要同步改桩,否则脚本报错。

4. **素材不能自带宽底色。**
   血泪教训:启动动画最初把角色合成在**不透明的品牌蓝**上,导致它只能待在
   一个"蓝色圆盘"里,换主题时那一块永远不跟着变。现在的动画是**透明通道**的
   (见 `assets/anim/walk-transparent.webp` 与 `scripts/gen-walk-anim*.py`),
   所以舞台底色可以换成 `theme.accentSoft`。
   **新素材一律要透明背景。**

5. **原生启动屏无法跟随运行时主题。**
   `app.json` 里 `expo-splash-screen` 的 `backgroundColor` 是**构建期常量**,
   只能对齐到某一套配色(现在对齐叙拉古)。这是平台限制,不是代码问题。

## 四、检查清单

```bash
npx tsc --noEmit                 # 类型(含 THEME_META 的穷尽检查)
npx eslint src                   # 规范
node scripts/verify-theme.mjs    # 主题系统契约(9 项)
node scripts/audit-contrast.mjs  # 逐主题对比度
node scripts/verify-cover-art.mjs # 程序化封面(若该主题用 playbill)
```

## 五、参考实现

- `default` —— 原 App 那套(16 圆角、无衬线、无描边、照片封面)
- `siracusa` —— 印刷品那套(方直角、衬线、金刻线、程序化节目单封面、启用形象)

完整设计说明与视觉稿见 `docs/theme-siracusa.md` 与 `docs/mockups/`。
