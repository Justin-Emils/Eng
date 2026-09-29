# 设计系统与组件层 · 完整清单

> 本文是**代码事实清单**,不是设计提案。所有标识符、色值、字号、数字都从源码逐行读出。
> 项目根:`E:\code\Eng\article-reading`(Expo SDK 57 / React Native 0.86.3 / React 19.2.3)
> 读取范围:`src/constants/`、`src/hooks/`、`src/components/`(全部)、`src/domain/cover-art.ts`、
> `src/domain/wordmark.ts`、`assets/`、`scripts/`、`docs/`、`app.json`、`package.json`。

---

# PART 1 — 设计系统

## 1. `src/constants/theme.ts`(454 行,16KB)

### 1.1 文件头的两条硬规矩(原文引用)

```
两条硬规矩(scripts/audit-contrast.mjs 会逐条校验):
  1. gold 只做线不做字 —— 金在浅色纸面上的对比度只有 3.09,当正文/小字必然不达标;
  2. annotate(学习标注)与 accent(品牌强调)必须分开 —— 否则正文里的生词高亮
     会和按钮/导航抢同一个颜色,以后想区分"已掌握/待复习/易混词"就没位置了。
```

### 1.2 `ThemePalette` — **19 个令牌**,全部必填

```ts
export interface ThemePalette {
  background: string;          // 页面底色
  backgroundElement: string;   // 卡片/浮起面底色
  backgroundSelected: string;  // 选中态底色
  text: string;                // 正文色
  textSecondary: string;       // 次要文字色(说明、元信息)
  accent: string;              // 品牌强调色:按钮、导航选中、进度条
  accentStrong: string;        // 实心按钮底色(单独存在是为了保证按钮文字对比度 ≥ 4.5)
  onAccentStrong: string;      // 实心按钮上的文字色
  accentSoft: string;          // 品牌色的浅色衬底
  annotate: string;            // 学习标注色:阅读正文里的生词高亮(与 accent 解耦)
  annotateStrong: string;      // 今日新学词(比 annotate 更重)
  annotateSoft: string;        // 标注色的浅色衬底
  gold: string;                // 金:仅 1px 描边 / 角刻线 / 菱形符号 / 印章 —— 禁止用于文字
  goldSoft: string;            // 金的极浅衬底
  border: string;              // 分隔线 / 描边
  danger: string;              // 错误色
  dangerSoft: string;          // 错误衬底
  success: string;             // 成功色
  successSoft: string;         // 成功衬底
}
export type ThemeColor = keyof ThemePalette;
```

> ⚠️ **文档不一致**:`docs/add-a-theme.md` 第 35 行写"共 18 个令牌",并把 `danger`/`dangerSoft`
> 与 `success`/`successSoft` 合并成两行计数。**实际接口是 19 个独立必填字段**(代码为准)。
> `scripts/verify-theme.mjs` 的断言并不检查数量,只检查"所有主题的键集合一致"。

### 1.3 `ThemeSkin` — 形态语言(几何 + 字形),**14 个字段**

```ts
export type FontRole = 'serif' | 'sans';

export interface ThemeSkin {
  displayFont: FontRole;        // 展示层字体:页面标题、卡片标题、文章标题
  bodyFont: FontRole;           // 阅读正文字体
  bodyLineHeight: number;       // 阅读正文的行高倍数(衬线比无衬线需要更多呼吸)
  radiusCard: number;           // 卡片/列表/按钮/输入框(原 App 一律 16)
  radiusPanel: number;          // 次级面板(提示条、译文块)(原来 8~10)
  radiusChip: number;           // 芯片/徽章/进度条(原来 999 胶囊)
  mascot: boolean;              // 是否使用 App 自己的形象(从启动屏动画抠出的透明角色姿势)
  cardFrame: boolean;           // 卡片画"节目单"式描边 + 对角金刻线
  buttonInsetRule: boolean;     // 主按钮画内嵌细线(票券感)
  plateLabels: boolean;         // 小标签用"铭牌"式:全大写 + 大字距
  motifs: boolean;              // 幕布轨、金色菱形符号、蜡封印章,以及用它们替换 emoji
  coverArt: 'photo' | 'playbill'; // 文章封面来源
  numericWeight: '600' | '700' | '800'; // 统计数字的字重
}
```

**文档不一致**:`docs/add-a-theme.md` 第 62 行写"`ThemeSkin` 共 13 个字段",列出的表格
**漏了 `mascot`**。`scripts/verify-theme.mjs` 的 `SKIN_KEYS` 数组列 13 项
(`displayFont, bodyFont, bodyLineHeight, radiusCard, radiusPanel, radiusChip, cardFrame,
buttonInsetRule, plateLabels, motifs, coverArt, mascot, numericWeight`)——
数组里确实有 `mascot`,数量 13;**实际接口 14 个字段**。

**设计意图(源码注释原文摘录)**:拆分三个圆角而不是一个,是因为"退回默认主题时它们要各自回到各自的原值"。
`motifs` 与 `coverArt` 分成两个开关,是因为"封面是'用哪张图'的问题,而随机照片封面在任何主题下
都是缺陷(与文章无关、依赖网络、要处理超时),不该跟'要不要金刻线'共用一个开关"。
`mascot` 独立成开关是因为"形象是'App 层面'的资产(空状态、完成态、引导页),不是某套主题的装饰花纹"。

### 1.4 主题注册表

```ts
export interface ThemePair { light: ThemePalette; dark: ThemePalette; skin: ThemeSkin; }

export const Themes = { default: defaultTheme, siracusa } as const satisfies Record<string, ThemePair>;
export type ThemeId = keyof typeof Themes;                 // 由 Themes 推导 —— 单一事实来源
export const THEME_IDS = Object.keys(Themes) as ThemeId[]; // 顺序即设置页展示顺序
export const DEFAULT_THEME_ID: ThemeId = 'default';
export const THEME_META: Record<ThemeId, ThemeMeta> = {
  default:  { id: 'default',  name: '默认',           tagline: '清爽蓝白,专注阅读本身' },
  siracusa: { id: 'siracusa', name: '叙拉古 · 揭幕者们', tagline: '浅色是节目单,深色是剧院夜场' },
};
export function isThemeId(value: unknown): value is ThemeId
export function getPalette(themeId: ThemeId, scheme: 'light' | 'dark'): ThemePalette
export function getSkin(themeId: ThemeId): ThemeSkin
```

`THEME_META` 是 `Record<ThemeId, ThemeMeta>`,**少写一条会编译报错**(穷尽性检查,故意留的)。
`getPalette` / `getSkin` 对未知 id 都用 `?? Themes[DEFAULT_THEME_ID]` 兜底,避免返回 `undefined` 把界面刷白。

### 1.5 `Themes.default` — 主题 1:「默认 · 清爽蓝白」

**light**:

| 令牌 | 值 | 注释要点 |
|---|---|---|
| `text` | `#000000` | |
| `background` | `#ffffff` | |
| `backgroundElement` | `#F0F0F3` | |
| `backgroundSelected` | `#E0E1E6` | |
| `textSecondary` | `#60646C` | |
| `accent` | `#208AEF` | |
| `accentStrong` | `#0F5CC0` | 白字压 `#208AEF` 对比度只有 3.53 |
| `onAccentStrong` | `#ffffff` | |
| `accentSoft` | `#E3F2FD` | |
| `annotate` | `#1068CC` | 同一族蓝但更深,5.42 余量;原来的 `#208AEF` 只有 3.53 |
| `annotateStrong` | `#0B4E9B` | |
| `annotateSoft` | `#E3F2FD` | |
| `gold` | `#B9C0CA` | 默认主题没有金属色,用中性灰 |
| `goldSoft` | `#EDEFF3` | |
| `border` | `#D5D9DF` | |
| `danger` | `#C62828` | |
| `dangerSoft` | `#FDECEA` | |
| `success` | `#1B5E20` | |
| `successSoft` | `#E8F5E9` | |

**dark**:

| 令牌 | 值 | 注释要点 |
|---|---|---|
| `text` | `#ffffff` | |
| `background` | `#000000` | |
| `backgroundElement` | `#212225` | |
| `backgroundSelected` | `#2E3135` | |
| `textSecondary` | `#B0B4BA` | |
| `accent` | `#4DA3FF` | |
| `accentStrong` | `#4DA3FF` | 深色下按钮:亮蓝底 + 深墨蓝字(6.47),不用白字 |
| `onAccentStrong` | `#0A1D33` | |
| `accentSoft` | `#17324D` | |
| `annotate` | `#4DA3FF` | |
| `annotateStrong` | `#8FC6FF` | |
| `annotateSoft` | `#17324D` | |
| `gold` | `#565C66` | |
| `goldSoft` | `#2A2E34` | |
| `border` | `#3A3D42` | |
| `danger` | `#FF8A80` | |
| `dangerSoft` | `#33191A` | |
| `success` | `#81C784` | |
| `successSoft` | `#132A18` | |

**skin = `defaultSkin`**:

```ts
const defaultSkin: ThemeSkin = {
  displayFont: 'sans', bodyFont: 'sans', bodyLineHeight: 1.7,
  radiusCard: 16, radiusPanel: 8, radiusChip: 999,
  cardFrame: false, buttonInsetRule: false, plateLabels: false,
  motifs: false, mascot: false, coverArt: 'photo', numericWeight: '800',
};
```

### 1.6 `Themes.siracusa` — 主题 2:「叙拉古 · 揭幕者们」

**关键注释**:色值"**不是推出来的,是从活动截图里量出来的**",每个 token 对应
`scripts/analyze-reference.ps1` 的实测结果,完整数据见 `docs/theme-siracusa.md` 第 14 节。
实测结论(7 张活动图,饱和像素占抽样 42%):

- 底色 = **近黑带紫**:`#09080b` / `#0d0b12` / `#050506`,不是暖棕黑;
- 浮起面 = 紫灰 `#17141b` / `#1c1725` / `#201a36` / `#221a28`;
- 最大色族 = **蓝紫 240-255°**(`#332c6c`,占饱和 25.5%)与**紫 255-285°**(`#4d3071`/`#583776`,合计 24.9%);
- 次大色族 = **绯红 345-360°**(`#802132`,占饱和 16.5%),另有酒红 330-345°;
- **暖金只是配角**:30-45° `#e0b987` 占饱和 13%,亮部是奶油 `#f7d8b4`;
- 7 张图暗部占比 48%–78% —— **参考里没有浅色界面**。

**light**(衍生的日间变体,**明确声明"非实测/不当成还原"**):

| 令牌 | 值 | 来源标注 |
|---|---|---|
| `background` | `#F4F1F8` | 淡紫纸(衍生,非实测) |
| `backgroundElement` | `#FFFFFF` | |
| `backgroundSelected` | `#E6E1F2` | |
| `text` | `#0D0B16` | |
| `textSecondary` | `#5B5270` | 实测 `#564957` 往冷里调,保证三种底上 ≥4.5 |
| `accent` | `#3A329B` | 实测蓝紫 `#37299b` / `#3a3370` 的浅色变体 |
| `accentStrong` | `#332C8C` | |
| `onAccentStrong` | `#F7F4FB` | |
| `accentSoft` | `#E6E2F7` | |
| `annotate` | `#A8297A` | **品红**(看宣传页后补的第三个强调色) |
| `annotateStrong` | `#7E1A5B` | |
| `annotateSoft` | `#F6DEEF` | |
| `gold` | `#A8722E` | 实测 `#d8a05d` 压到浅底上要够深才看得见 |
| `goldSoft` | `#EDDFC6` | |
| `border` | `#D5CFE4` | |
| `danger` | `#9C4A12` | 危险用橙(实测 `#e39434` 一族) |
| `dangerSoft` | `#F7E3D2` | |
| `success` | `#2F6B45` | |
| `successSoft` | `#E0EFE3` | |

**dark**(主模式,对齐参考):

| 令牌 | 值 | 来源标注 |
|---|---|---|
| `background` | `#0B0912` | 实测最深底 `#09080b`/`#0d0b12`/`#050506` |
| `backgroundElement` | `#1A1725` | 实测卡片 `#17141b`/`#1c1725` |
| `backgroundSelected` | `#272041` | 实测紫色面 `#201a36`/`#221a28` |
| `text` | `#F5F2FA` | 实测亮部 `#fafafa`/`#fefcfc` |
| `textSecondary` | `#A99CC0` | |
| `accent` | `#8F88F2` | 实测蓝紫 `#4a47d6`/`#5c56d7`(最大色族 240-255°) |
| `accentStrong` | `#8F88F2` | 与 accent 同值 |
| `onAccentStrong` | `#12101F` | |
| `accentSoft` | `#252047` | |
| `annotate` | `#EC6BB6` | **品红**;提亮是因为要压在近黑底上当正文标注 |
| `annotateStrong` | `#F59ACD` | |
| `annotateSoft` | `#3A1030` | |
| `gold` | `#D8A05D` | 实测暖金 —— 只做线,不做字 |
| `goldSoft` | `#3A2A18` | |
| `border` | `#2E2842` | |
| `danger` | `#E8913F` | 实测橙 `#e39434` 一族 |
| `dangerSoft` | `#3A2413` | |
| `success` | `#8FCB9B` | |
| `successSoft` | `#16301E` | |

**skin = `siracusaSkin`**:

```ts
const siracusaSkin: ThemeSkin = {
  displayFont: 'serif', bodyFont: 'serif', bodyLineHeight: 1.8,
  radiusCard: 3, radiusPanel: 2, radiusChip: 2,
  cardFrame: true, buttonInsetRule: true, plateLabels: true,
  motifs: true, mascot: true, coverArt: 'playbill', numericWeight: '600',
};
```

> 注:源码里 `dark.annotate` 是 `#EC6BB6`,而 `docs/theme-siracusa.md` 第 14.5 节的
> 文字片段写的是 `#E0607A`(绯红 `#ae5160` 压亮)。**以代码为准:`#EC6BB6`**,
> 且 `verify-theme.mjs` 已把 `#EC6BB6` 钉成断言。

### 1.7 `Fonts`(Platform.select)

```ts
export const Fonts = Platform.select({
  ios: { sans: 'system-ui', serif: 'ui-serif', rounded: 'ui-rounded', mono: 'ui-monospace' },
  default: { sans: 'normal', serif: 'serif', rounded: 'normal', mono: 'monospace' },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});
```
对应 iOS 的 `UIFontDescriptorSystemDesignDefault/Serif/Rounded/Monospaced`。

### 1.8 `Spacing` — 6 级 + half

```ts
export const Spacing = { half: 2, one: 4, two: 8, three: 16, four: 24, five: 32, six: 64 } as const;
```

### 1.9 `Radii` — 静态兜底(**已标记为"新代码不要再引用"**)

```ts
export const Radii = {
  sharp: 2,   // 极小控件:芯片、按钮、标签
  card: 3,    // 卡片、列表、面板
  round: 999, // 需要正圆的地方(头像、徽章)
} as const;
```

文件头明确警告:"**真正的圆角由主题的 `ThemeSkin` 决定,不是这里**……留着它会让'同一个值有两处来源',
所以新代码不要再引用 —— 直接走 skin。"现实情况:`Radii` 仍被 7 个文件引用
(`dict-card`、`app-tabs.web`、`auth-shell`、`article-card`、`latest-strip`、
`placeholder-screen`、`ui/collapsible`)—— 属未清理的遗留。

### 1.10 布局常量

```ts
export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
```

---

## 2. `src/constants/typography.ts`(120 行)

### 2.1 三条声明式规则(文件头原文摘录)

1. **字号越大,字距越紧;字越小,字距越松。** 34px 的标题用 0 字距会显得松散,10px 的全大写标签用 0 字距会粘成一团 → 每一档都带 `tracking`。
2. **行距按"字号 × 比例"给,不是写死行高。** 衬线正文需要 1.6~1.8,标签类只需 1.3~1.4。
3. **数字用等宽数位(tabular-nums)。** 比例数位会让 "37 → 128" 左右跳动。

### 2.2 `FONT_SLOTS` — 角色 → 实际族名

```ts
export const FONT_SLOTS = {
  reading: SERIF_FAMILY.regular,   // 阅读正文(400)
  display: SERIF_FAMILY.semibold,  // 展示层默认字重(600)
  label:   SANS_FAMILY,            // UI 标签与按钮
  mono:    MONO_FAMILY,            // 音标、词性
} as const;
```

### 2.3 `serifForWeight()`

```ts
export function serifForWeight(weight: TypeStep['weight']): { fontFamily: string; fontWeight: 'normal' } {
  const map = {
    '400': SERIF_FAMILY.regular,   // Literata_400Regular
    '500': SERIF_FAMILY.medium,    // Literata_500Medium
    '600': SERIF_FAMILY.semibold,  // Literata_600SemiBold
    '700': SERIF_FAMILY.bold,      // Literata_700Bold
  };
  return { fontFamily: map[weight], fontWeight: 'normal' };
}
```
**为什么把 `fontWeight` 归零**:族名已经表达了字重(`Literata_600SemiBold`),
再叠加 `fontWeight: '600'` 会让 Android 在这个单一字重的族上**再做一次合成加粗**,笔画会发虚。

### 2.4 `TypeStep` 接口

```ts
export interface TypeStep {
  size: number;      // 字号(dp)
  ratio: number;     // 行高 = size × ratio
  weight: '400' | '500' | '600' | '700';
  tracking: number;  // letterSpacing(dp):大字号负数收紧,小字号正数撑开
  tabular?: boolean; // 是否使用等宽数位
}
```

### 2.5 `TYPE_STEPS` — 10 档完整表

| 名称 | size | ratio | 计算行高 | weight | tracking | tabular | 用途 |
|---|---|---|---|---|---|---|---|
| `display` | 34 | 1.16 | 39 | 600 | **-0.7** | — | 首次引导、欢迎页的大标题 |
| `title` | 26 | 1.24 | 32 | 600 | -0.5 | — | 页面标题、板块大标题 |
| `heading` | 19 | 1.36 | 26 | 600 | -0.2 | — | 卡片标题、文章标题 |
| `reading` | 18 | 1.62 | 29 | 400 | 0 | — | 阅读正文(阅读页另有 A−/A+ 覆盖 size) |
| `body` | 16 | 1.5 | 24 | 500 | 0 | — | 普通 UI 正文 |
| `small` | 14 | 1.42 | 20 | 500 | 0.1 | — | 次要小字 |
| `smallBold` | 14 | 1.42 | 20 | 700 | 0.1 | — | 加粗小字 |
| `caption` | 12 | 1.42 | 17 | 500 | 0.2 | — | 元信息 |
| `label` | 10 | 1.4 | 14 | 600 | **1.8** | — | 铭牌式小标签(全大写 + 大字距) |
| `numeric` | 26 | 1.15 | 30 | 600 | -0.3 | **true** | 统计数字 |

`export type TypeStepName = keyof typeof TYPE_STEPS;`

### 2.6 `typeStyle(name)` 展开函数

```ts
export function typeStyle(name: TypeStepName): {
  fontSize: number; lineHeight: number; fontWeight: TypeStep['weight'];
  letterSpacing: number; fontVariant?: ('tabular-nums')[];
} {
  const step = TYPE_STEPS[name];
  return {
    fontSize: step.size,
    lineHeight: Math.round(step.size * step.ratio),
    fontWeight: step.weight,
    letterSpacing: step.tracking,
    ...(step.tabular ? { fontVariant: ['tabular-nums' as const] } : {}),
  };
}
```

### 2.7 阅读栏行宽上限

```ts
export const READING_MEASURE = 600;  // dp
```
理由:一行 60~75 个字符最好读,超过 90 个字符眼睛回扫时容易串行。
18px 衬线大约 8dp/字符 → 66 字符 ≈ 530dp,留余量取 600。
**原来沿用 `MaxContentWidth = 800`,一行接近 90 字符,偏宽。**

---

## 3. `src/constants/fonts.ts`(57 行)

字体:**Literata**(Google 为**长时间屏幕阅读**设计的衬线体,OFL 授权,可随 App 分发)。
选它的理由:"本 App 的正文在 17~20px 这个区间,Literata 正是为这个尺寸段调过字面与 x-height 的"。

```ts
export const APP_FONTS = {
  Literata_400Regular,
  Literata_500Medium,
  Literata_600SemiBold,
  Literata_700Bold,
} as const;   // 键就是注册后的族名;供 _layout.tsx 的 useFonts 使用

export const SERIF_FAMILY = {
  regular:  'Literata_400Regular',
  medium:   'Literata_500Medium',
  semibold: 'Literata_600SemiBold',
  bold:     'Literata_700Bold',
} as const;

export const SANS_FAMILY =
  Platform.select({ ios: 'system-ui', android: 'sans-serif', default: 'normal' }) ?? 'normal';

export const MONO_FAMILY =
  Platform.select({ ios: 'ui-monospace', android: 'monospace', default: 'monospace' }) ?? 'monospace';
```

**为什么按字重分成四个族名**:`@expo-google-fonts` 的每个字重是**独立的 ttf 文件**,注册后就是四个独立族名。
Android 不会因为 `fontWeight: '600'` 去挑 `Literata_600SemiBold`,反而会拿 400 的文件**合成**假半粗。

**中文为什么不换**:内嵌一套中文字体要 10MB+(常用字集),包体会从 ~30MB 涨到 40MB+。
中文继续走系统字体(Android 的 Noto Sans CJK / iOS 的苹方),只有拉丁字形变化。
依赖:`@expo-google-fonts/literata` `^0.4.3`。

---

## 4. Hooks

### 4.1 `src/hooks/use-theme.ts`(51 行)— 全局唯一取色入口

```ts
export type ColorScheme = 'light' | 'dark';

export function useResolvedScheme(): ColorScheme {
  const systemScheme = useColorScheme();
  const mode = useThemeMode();
  if (mode === 'light' || mode === 'dark') return mode;
  return systemScheme === 'dark' ? 'dark' : 'light';
}

export function useTheme(): ThemePalette {
  return getPalette(useThemeId(), useResolvedScheme());
}

export function useThemeSkin(): ThemeSkin {
  return getSkin(useThemeId());
}

export function useThemeMeta(): ThemeMeta {
  return THEME_META[useThemeId()];
}
```
解析顺序:用户在设置里选的模式优先;选"跟随系统"时看系统深浅色。
只有明确 dark 才用深色,避免系统值为 null/unspecified 时拿到 `undefined`。
**`useTheme()` 与 `useThemeSkin()` 分开的理由**:颜色是"值",形态是"结构";
结构类样式必须内联合并进 style(`StyleSheet.create` 是模块级静态的,拿不到主题)。

### 4.2 `src/hooks/use-theme-pref.ts`(87 行)— 外观偏好响应式状态

模块级单例 + 订阅者集合(与 `domain/auth/store.ts`、`domain/corpus/status.ts` 同一套路,
刻意不用 Context,避免为了换主题把整棵树包一遍 Provider)。

```ts
export type { ThemeId, ThemeMode };

let currentMode: ThemeMode = 'system';
let currentThemeId: ThemeId = DEFAULT_THEME_ID;
const listeners = new Set<() => void>();

export function getThemeMode(): ThemeMode
export function getThemeId(): ThemeId
export function subscribeThemePrefs(listener: () => void): () => void
export async function hydrateThemePrefs(): Promise<void>   // 启动时从存储水化(在根布局调用一次)
export async function setThemeMode(mode: ThemeMode): Promise<void>  // 立即 emit + 持久化
export async function setThemeId(themeId: ThemeId): Promise<void>   // 内部先过 isThemeId 校验
export function useThemeMode(): ThemeMode   // useReducer 强刷 + useEffect 订阅
export function useThemeId(): ThemeId
```
`hydrateThemePrefs()` 两个值**一起读**,避免"主题水化了、深浅模式还没水化"的中间态导致首帧闪色。
存储落点:`@/storage/settings` 的 `getSettings()` / `saveThemeMode()` / `saveThemeId()`。

### 4.3 `src/hooks/use-color-scheme.ts`(1 行)

```ts
export { useColorScheme } from 'react-native';
```

### 4.4 `src/hooks/use-color-scheme.web.ts`(24 行)— Web 变体

```ts
export function useColorScheme() {
  const colorScheme = useRNColorScheme();
  const isClient = useSyncExternalStore(emptySubscribe, () => true, () => false);
  if (!isClient) return 'light';
  return colorScheme === 'dark' ? 'dark' : 'light';
}
```
存在原因(注释原文):"To support **static rendering**(`app.json` → `web.output: "static"`),
this value needs to be re-calculated on the client side for web."用 `useSyncExternalStore`
让 server/static 快照返回 `'light'`(SSR 期间不 hydrate 出 `'dark'`,避免 hydration 不匹配),
客户端快照反映真实配色,挂载后重渲染一次而**不在 effect 里同步 setState**。

---

## 5. `src/global.css`(9 行)

```css
:root {
  --font-display:
    Spline Sans, Inter, ui-sans-serif, system-ui, sans-serif, Apple Color Emoji, Segoe UI Emoji,
    Segoe UI Symbol, Noto Color Emoji;
  --font-mono:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace;
  --font-rounded: 'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif;
  --font-serif: Georgia, 'Times New Roman', serif;
}
```
仅被 `theme.ts` 第一行 `import '@/global.css';` 引入(为 Web 提供 `--font-*` 变量,
供 `Fonts.web` 的 `var(--font-display)` / `var(--font-serif)` 使用)。
⚠️ 注意 `--font-serif` 在 Web 上是 **Georgia / Times New Roman**,而不是 Literata ——
Web 端走 serif 主题时**不会**用内嵌 Literata。

---

## 6. `docs/theme-siracusa.md`(843 行)主题架构与规则

### 6.1 核心概念

> **明暗两套主题 = 揭幕前与揭幕后。**
> 浅色是「节目单」(羊皮纸 + 铅字 + 批注红),深色是「剧院夜场」(黑丝绒 + 聚光灯 + 金)。

取材《明日方舟》SideStory「揭幕者们」(act38side,新沃尔西尼狂欢节 / 叙拉古线)——
**只借叙事、色彩关系与图形语法,不使用任何官方立绘、Logo 或字体**(IP 边界,第 9 节明令)。

### 6.2 三条铁律(第 0 节)

1. **金只做线,不做字。** 金色在浅色纸上的对比度只有 3.09(`gold #A8722E` on `#F4F1F8`)。
   `gold` 令牌只允许出现在 1px 描边、分隔线、角刻线、进度轨道、菱形符号、印章。
2. **强调色与学习标注色拆开。** 否则正文会出现一片红点,像错题本;而且以后想区分
   「已掌握/待复习/易混词」就没位置了。
3. **用"印刷品"取代"圆角灰卡"。** 去掉 `#F0F0F3` 灰块,卡片 = 纸 + 1px 线 + 直角 + 金角刻线。

### 6.3 对比度审计结果(第 3 节)

`scripts/audit-contrast.mjs` 遍历所有主题 × 浅/深,共 **2 主题 × 2 深浅 × 20 项 = 80 项**。
实际断言项数 = `PAIRS.length (19) + 1 (按钮文字/按钮底色) = 20`,故 80 项。

| 组合 | 浅色 | 深色 | 门槛 |
|---|---|---|---|
| 正文 / 页面背景 | 15.80 | 15.87 | ≥4.5 |
| 正文 / 卡片背景 | 17.66 | 14.41 | ≥4.5 |
| 次要文字 / 页面背景 | 5.77 | 8.26 | ≥4.5 |
| 强调色 / 页面背景 | 8.95 | 9.89 | ≥3.0 |
| 生词高亮 / 阅读正文底 | 8.95 | 9.89 | ≥4.5(按正文标准) |
| 今日新学词 / 阅读正文底 | 11.67 | 12.56 | ≥4.5 |
| 错误色 / 错误衬底 | 5.95 | 6.74 | ≥4.5 |
| 成功色 / 成功衬底 | 5.93 | 7.92 | ≥4.5 |
| 按钮文字 / 按钮底色 | 10.52 | 8.52 | ≥4.5 |
| 金线(仅装饰)/ 页面背景 | **3.09** | 8.26 | ≥1.5 |

阈值表(`audit-contrast.mjs` 的 `PAIRS`,19 组 + 1):"凡是**能被当文字读**的令牌都按 4.5;
只有纯装饰(金线、描边)才允许低门槛 —— 这也是'金只做线不做字'的由来。"
`border / backgroundElement ≥ 1.2`。

### 6.4 形态语言 `ThemeSkin` 的由来(第 11.5 节)——"一次真实回归的产物"

**问题**:P1 曾把"衬线 + 方直角 + 金刻线"当成**全局改版**无条件写进组件里,
后果是切回默认主题**只换了颜色,UI 没回到原来的样子** —— 对用户来说那不叫"两套主题",
叫"一套主题加一个调色板开关"。
**修法**:一套主题 = **颜色 + 几何 + 字形**,新增 `ThemeSkin` 与 `ThemePalette` 并列挂在 `ThemePair` 上。

**回归护栏**:`scripts/verify-theme.mjs` 把"默认主题 = 原 App 的样子"钉成断言
(sans、行高 1.7、卡片 16、芯片 999、无描边、无内嵌线、标签非铭牌、motifs false、
coverArt 'photo'、mascot false、numericWeight 800)。以后谁再把衬线或方直角写进组件而不是
skin,脚本直接报红。

### 6.5 `ThemeSkin` 的应用点(只有 5 处,其余组件全部派生)

| 文件 | 负责 |
|---|---|
| `themed-text.tsx` | `displayFont` / `bodyFont` / `plateLabels` / `numericWeight`(覆盖全站排版) |
| `themed-view.tsx` | `radius*` / `cardFrame`。**主题圆角被应用在样式数组最后一位,局部写死会被覆盖** |
| `primary-button.tsx` | `radiusCard` / `buttonInsetRule` |
| `form-field.tsx` + 各页输入框、芯片 | `radiusCard` / `radiusChip` |
| `word-text.tsx` + 阅读页 | `bodyFont` / `bodyLineHeight` |

### 6.6 P2 图形层:一切纹样由 `skin.motifs` 把关(第 13 节)

`src/components/ornaments.tsx` 里每个纹样在 `motifs === false` 时**直接 `return null`**,
所以默认主题不会多出任何装饰:

| 纹样 | 用途 | 替换掉了什么 |
|---|---|---|
| `CurtainBand` | 阅读页工具条与正文之间的幕布轨 | ——(纯新增) |
| `Star`(四角星) | 最小符号单位(绘制盒 10–12px) | 🔥 🎉 💡 🔁 👉 ◆ |
| `Seal` | 金圈 + 强调衬底 + 中央符号 | 打卡/完成态的文字 ✓ |
| `Medallion` | 金圈(含内环)+ 中央四角星 | 📭 📚 🔍 🔁 🎉 📘 |

**刻意不引入 `react-native-svg`**(项目确实没有这个依赖,见 `package.json`),纹样都是圆/方/线。

### 6.7 封面来源是独立开关(第 13.2 节)

一开始把封面绑在 `motifs` 上,后果是"切回默认主题,封面也跟着回到随机照片" ——
但**随机照片不是装饰,是缺陷**(与文章无关、依赖网络、要处理超时)。所以拆成 `coverArt`。

| 主题 | `motifs` | `coverArt` |
|---|---|---|
| 默认 | `false` | `'photo'`(原样) |
| 叙拉古 | `true` | `'playbill'` |

### 6.8 封面不单调:四个正交维度(第 13.3 节)

第一版只让颜色变 —— 8 个色相锚点 × 固定构图。实测 1000 个 id 只产生 **105 种**外观指纹,
一屏 30 篇里撞脸 **7 张**。所以把变化拆成四个正交维度,**全部由 id 的 FNV-1a 哈希决定**:

| 维度 | 取值 |
|---|---|
| 色相锚点 | **12 个**(±16° 抖动)—— ⚠️ 代码实际 10 个,见 §2.5 `cover-art.ts` |
| 布局 | **4 种** |
| 徽记 | **4 种** |
| 边框 | **3 种** |

实测(`scripts/verify-cover-art.mjs`,1000 个合成 id):

| 指标 | 改进前 | 现在 |
|---|---|---|
| 外观指纹种类 | 105 | **422**(第 14.5 节重校准后为 **458**) |
| 首页 30 篇里撞脸 | 7 张 | **2 张**(第 14.5 节后 **0 张**) |
| 墨色/底色最低对比度 | —— | **9.50** |
| 四种布局占比 | —— | 23.4% – 26.4% |
| 四种徽记占比 | —— | 22.1% – 27.4% |

### 6.9 配色重校准(第 14 节,第 3 轮)

用户指出"主题的 UI 和配色与原游戏活动仍天差地别,可能只是做了一个近似的简化构造"——
**这个判断是对的**。前两轮配色"不是从任何真实画面来的",是从几篇**文字**描述推导的。
实测方法:`scripts/analyze-reference.ps1`(WIC 解码 → 自算直方图 → 15° 色相族面积加权)。

实测色族(7 张图,饱和像素占抽样 42.22%):

| 色相族 | 面积加权色 | 占全图 | 占饱和 |
|---|---|---|---|
| **240-255° 蓝紫** | `#332c6c` | 10.76% | **25.5%** |
| **345-360° 绯红** | `#802132` | 6.95% | **16.5%** |
| **255-270° 紫** | `#4d3071` | 6.12% | 14.5% |
| **30-45° 暖金** | `#e0b987` | 5.47% | 13.0% |
| **270-285° 紫** | `#583776` | 4.39% | 10.4% |
| 330-345° 酒红 | `#722640` | 2.52% | 6.0% |
| 15-30° 浅褐 | `#d4a480` | 2.47% | 5.9% |
| 225-240° 靛蓝 | `#5a61b9` | 0.84% | 2.0% |

单图数据(第 14.3 节):

- **028**(1125×6032)`#201a36` 24% + `#573877` 17% + `#4b2e69` 7.5% + `#633b88` 4.5% + 金 `#e39434` 1.7% → **深紫主导 + 金点缀**
- **027**(480×1600)蓝紫 `#4a47d6` 4.7% + `#4744ca` 2.7% + 绯红 `#28030b`/`#390713`/`#460a16` + 金 `#c09957` → **蓝紫 + 绯红 + 金**
- **025**(480×1600)奶油 `#fbdab6` 17.6% + 绯红 `#560c1a`/`#480a16`/`#671425`/`#781528` → **绯红 + 奶油**
- **019**(1000×2324)`#1c1725` 26% + `#231835` 8.9% + `#1d1433` 2.4% + 绯红 `#932738` → **紫罗兰底**
- **020**(1357×11460)`#080808` 21.8% + `#191919` 18.2% + `#282828` 9.7% + `#353535` 7.1% → **纯灰阶文字长图**
- **001 / 002**(1920×1080)紫灰 `#281926`/`#473947`/`#362937` + 亮部 `#fefcfc` + 蓝紫 `#37299b`/`#323b99`

三个结构性错判(第 14.4 节):

| | 编的 | 实测 |
|---|---|---|
| 深色底 | `#131010` **暖棕黑** | `#09080b` / `#0d0b12` **冷紫黑** |
| 浮起面 | `#201A17` 暖棕 | `#17141b` / `#1c1725` / `#201a36` **紫灰** |
| 主强调 | `#E4B45A` **金** | **蓝紫 `#4a47d6`/`#5c56d7`**(最大色族 25.5%) |
| 次强调 | —— | **绯红 `#802132`/`#932738`**(16.5%) |
| 紫罗兰 | **完全没有** | 紫 255-285° 合计 **24.9%** |
| 金 | 当主色用 | 只是配角(13%),亮部是奶油 `#f7d8b4` |
| 浅色 | `#F5EFE2` 羊皮纸 | **参考里根本没有浅色界面** |

即:① **色温反了**(编的是暖,实测是冷);② **主色选错了**(把金当主色,实测最大色族是蓝紫);
③ **明暗关系反了**(把"浅色羊皮纸"当主模式,而参考全是深色主导)。

伴随改动:封面生成器的色相锚点也从"均匀铺满 360°"改成实测的
**绯红→品红→紫→靛蓝**弧 + 暖金;封面底色明度从 12–16% 压到 **8–14%**、
色块从 27–36% 调到 **26–36%**。校验:`audit-contrast` 80 项一次通过;
`verify-cover-art` 指纹 **458** 种、首页 30 篇 **0** 重复。

**第 14.6 节的诚实声明**:配色可以从像素可靠量出,**形态不行**——描边粗细、角标形状、
字距节奏、字体族、装饰线的组合方式是**语义**,直方图恢复不了。所以衬线正文 + 大字距拉丁标签、
方直角 + 1px 描边 + 对角金刻线、幕布轨、金菱形、蜡封印章、勋章、"节目单"式封面构图
**仍然是我按"印刷品"编的,可能同样偏离**。

### 6.10 已知的素材限制与待办(第 12、13.8 节)

- ⚠️ **原生启动屏是构建期常量**,无法跟随运行时主题。`app.json` 里 `expo-splash-screen`
  的 `backgroundColor` 只能对齐到一套配色。**实测当前 `app.json` 对齐的是品牌蓝
  `#208AEF`(dark `#0B0F14`),而不是文档说的叙拉古羊皮纸 `#F5EFE2` / `#131010`** ——
  文档与代码在此处**已经脱节**。
- **两处已知的素材限制**(原文):① **角色动画没有透明通道**(旧素材),
  ② **App 图标仍是 Expo 模板素材**(`assets/images/icon.png` 实测 72% 是白色)。
- ⬜ **P2 Tab 图标重绘未做**(工具链已就绪,卡在"换成哪套字形"这个设计决定)。
  只装了 Material Symbols 的 **400 静态字重**,没有可变字体,所以"线宽降到 1.5"做不到。
- ⬜ **P3 App 图标 / 文案语气 / 动画素材重制未开始**。
- ⚠️ 旧样张(`siracusa-theme.png`、`settings-page.png`、`p2-motifs.png`、
  `recommend-cover-fix.png`、`cover-art-preview` 前四个)**已过期**,以 `palette-recalibration` 为准。

---

## 7. `docs/add-a-theme.md`(136 行)文档化的约定

### 7.1 契约:一个主题 = `ThemePair`

```ts
ThemePair = { light: ThemePalette; dark: ThemePalette; skin: ThemeSkin }
```
> **颜色与形态必须一起换。** 只换颜色不换形状,用户会觉得"这不像换了一整套主题"。

### 7.2 四步流程

1. **写配色**(浅 + 深各一套)。`ThemePalette` **全部必填,一个都不能少**。
   (文档写"共 18 个令牌",**实际 19 个** —— 见 §1.2 的不一致提示。)
2. **写形态语言**(可基于 `defaultSkin` 覆盖)。文档列 13 个字段表(**漏了 `mascot`**;
   实际 14 个 —— 见 §1.3)。
3. **在 `THEME_META` 登记 `name` / `tagline`**(漏写编译不过)。
4. **同步校验脚本的期望值** ⚠️ `scripts/verify-theme.mjs` 第 42 行断言了主题 id 数组:
   ```js
   check('THEME_IDS 由 Themes 推导且顺序稳定',
     JSON.stringify(THEME_IDS) === '["default","siracusa"]', ...);
   ```
   **加主题必须改这一行**,否则校验失败(刻意留的"人必须确认一次"的点)。

`THEME_IDS` 由 `Object.keys(Themes)` 推导,设置页预览卡是 `THEME_IDS.map(...)` ——
**不需要改任何 UI 代码,新主题会自动出现在设置页里。**

设置页主题选择器的做法(第 11.4 节):预览卡**用它自己那套配色渲染**(`getPalette(id, scheme)`),
而不是当前主题的配色。卡片内容是缩微的一屏:卡片底 + 标题条 + 正文条 + 强调点 + 标注条 + 金线,
下面一行 **5 个色板方块**(`background` / `backgroundElement` / `accent` / `annotate` / `gold`)。
好处:"跟随系统"的用户切到深色的那一刻,两张预览卡会一起变成各自的深色版本。

### 7.3 五条硬性约束

1. **组件里不许出现颜色字面量。**
   扫描方式:`Get-ChildItem src -Recurse -Include *.ts,*.tsx | Select-String "#[0-9A-Fa-f]{6}\b"`
   —— 现在只剩注释里的实测值记录,代码应为 0 处。
2. **对比度必须过审计。** `node scripts/audit-contrast.mjs` —— 文字 ≥ 4.5、
   装饰金线 ≥ 1.5、描边 ≥ 1.2,逐主题 × 浅深共 80+ 项,任一项不过非零退出。
3. **`theme.ts` 只能有两个 import**(`@/global.css` 和 `react-native` 的 `Platform`)。
   两个校验脚本是把 theme.ts 转译后在 Node 里跑的,用正则替换这两个 import 做桩;
   **引入第三个 import 就要同步改桩**,否则脚本报错。
4. **素材不能自带宽底色。** 血泪教训:启动动画最初把角色合成在**不透明的品牌蓝**上。
   **新素材一律要透明背景。**
5. **原生启动屏无法跟随运行时主题。** `app.json` 里 `expo-splash-screen` 的
   `backgroundColor` 是**构建期常量**。

### 7.4 检查清单

```bash
npx tsc --noEmit                  # 类型(含 THEME_META 的穷尽检查)
npx eslint src                    # 规范
node scripts/verify-theme.mjs     # 主题系统契约(9 项)
node scripts/audit-contrast.mjs   # 逐主题对比度
node scripts/verify-cover-art.mjs # 程序化封面(若该主题用 playbill)
```

---

## 8. 设计系统的校验脚本(设计系统的一部分)

| 脚本 | 校验内容 | 项数 |
|---|---|---|
| `scripts/audit-contrast.mjs`(122 行) | WCAG 对比度:`PAIRS` 19 组 + 按钮文字/底色 1 组 | 2 主题 × 2 深浅 × 20 = **80** |
| `scripts/verify-theme.mjs`(177 行) | 注册表自洽(4)+ 令牌完整性(2)+ 取色与兜底(7)+ 形态语言(default 12 条 + siracusa 9 条 + 2 条关系断言) | 约 **36** 条 check |
| `scripts/verify-cover-art.mjs` | 1000 个合成 id 的外观指纹数、撞脸、墨色对比度、布局/徽记占比分布 | —— |

`audit-contrast.mjs` 的 `PAIRS` 全表(逐条,含门槛):

```
['text', 'background', '正文 / 页面背景', 4.5]
['text', 'backgroundElement', '正文 / 卡片背景', 4.5]
['text', 'backgroundSelected', '正文 / 选中背景', 4.5]
['textSecondary', 'background', '次要文字 / 页面背景', 4.5]
['textSecondary', 'backgroundElement', '次要文字 / 卡片背景', 4.5]
['textSecondary', 'backgroundSelected', '次要文字 / 选中背景', 4.5]
['accent', 'background', '强调色 / 页面背景', 3.0]
['accent', 'backgroundElement', '强调色 / 卡片背景', 3.0]
['accent', 'accentSoft', '强调色 / 强调衬底', 3.0]
['annotate', 'background', '生词高亮 / 阅读正文底', 4.5]
['annotateStrong', 'background', '今日新学词 / 阅读正文底', 4.5]
['annotate', 'annotateSoft', '生词高亮 / 标注衬底', 3.0]
['danger', 'background', '错误色 / 页面背景', 4.5]
['danger', 'dangerSoft', '错误色 / 错误衬底', 4.5]
['success', 'background', '成功色 / 页面背景', 4.5]
['success', 'successSoft', '成功色 / 成功衬底', 4.5]
['gold', 'background', '金线(仅装饰)/ 页面背景', 1.5]
['gold', 'backgroundElement', '金线(仅装饰)/ 卡片背景', 1.5]
['border', 'backgroundElement', '描边 / 卡片背景', 1.2]
+ contrast(onAccentStrong, accentStrong) >= 4.5   '按钮文字 / 按钮底色'
```

`verify-theme.mjs` 的 `SKIN_KEYS`(13 项,用于"字段齐全"断言):
`displayFont, bodyFont, bodyLineHeight, radiusCard, radiusPanel, radiusChip, cardFrame,
buttonInsetRule, plateLabels, motifs, coverArt, mascot, numericWeight`。

---

# PART 2 — 组件层(32 个文件)

## 2.1 总览

`src/components/` 共 **32 个文件**(含 `ui/` 子目录 1 个,`.web.tsx` 变体 2 个)。

| 文件 | 行数 | 大小 | 被 app/ 引用 |
|---|---|---|---|
| `themed-text.tsx` | 94 | 3.9 KB | 全部页面 |
| `themed-view.tsx` | 87 | 3.4 KB | 全部页面 |
| `animated-icon.tsx` | 206 | 7.7 KB | `_layout.tsx` |
| `animated-icon.web.tsx` | 8 | 0.4 KB | Web 变体 |
| `app-tabs.tsx` | 85 | 3.8 KB | `(tabs)/_layout.tsx` |
| `app-tabs.web.tsx` | 95 | 2.7 KB | Web 变体 |
| `article-card.tsx` | 88 | 3.2 KB | `(tabs)/library.tsx` |
| `article-cover.tsx` | 271 | 10.6 KB | `(tabs)/index.tsx`、`article/[id].tsx`(经 `article-card` / `recommend-card` / `latest-strip`) |
| `auth-shell.tsx` | 110 | 3.6 KB | `auth/login|register|forgot.tsx` |
| `avatar.tsx` | 49 | 1.4 KB | `account.tsx`、`(tabs)/profile.tsx` |
| `chip.tsx` | 50 | 1.4 KB | `article-card.tsx`、`article/[id].tsx` |
| `dict-card.tsx` | 295 | 9.6 KB | `article/[id].tsx` |
| `empty-state.tsx` | 101 | 3.4 KB | `(tabs)/index|library|words|review.tsx` |
| `external-link.tsx` | 25 | 0.8 KB | **未被引用** |
| `form-field.tsx` | 124 | 3.7 KB | `auth/login|register|forgot.tsx` |
| `heading-translate.tsx` | 149 | 4.6 KB | `article/[id].tsx` |
| `hint-row.tsx` | 34 | 0.9 KB | **未被引用**(Expo 模板遗留) |
| `latest-strip.tsx` | 93 | 2.7 KB | `(tabs)/library.tsx` |
| `learner-profile-card.tsx` | 241 | 9.8 KB | `(tabs)/profile.tsx`、`assessment.tsx` |
| `mascot.tsx` | 69 | 2.3 KB | `empty-state.tsx` |
| `motion.tsx` | 157 | 5.5 KB | `(tabs)/index.tsx`(Enter)、`recommend-card.tsx`(PressScale)、`skeleton.tsx`(Shimmer) |
| `ornaments.tsx` | 178 | 5.7 KB | `article/[id].tsx`、`welcome.tsx`、`(tabs)/index|words|review.tsx` |
| `placeholder-screen.tsx` | 120 | 3.4 KB | **未被引用**(M0 遗留) |
| `playbill-cover.tsx` | 375 | 10.8 KB | 经 `article-cover.tsx` |
| `primary-button.tsx` | 105 | 3.2 KB | `welcome.tsx`、`onboarding.tsx`、`account.tsx`、`auth/*` |
| `recommend-card.tsx` | 124 | 4.8 KB | `(tabs)/index.tsx` |
| `sentence-block.tsx` | 139 | 4.1 KB | `article/[id].tsx` |
| `setting-row.tsx` | 77 | 2.1 KB | `(tabs)/profile.tsx`、`settings.tsx`、`dev.tsx`、`account.tsx` |
| `skeleton.tsx` | 82 | 2.5 KB | `(tabs)/index|words.tsx` |
| `status-note.tsx` | 48 | 1.5 KB | `account.tsx`、`dev.tsx`、`auth/*` |
| `web-badge.tsx` | 43 | 1.0 KB | **未被引用** |
| `word-text.tsx` | 81 | 2.9 KB | 经 `sentence-block.tsx` |
| `ui/collapsible.tsx` | 65 | 1.9 KB | **未被引用** |

`.web.tsx` 变体只有 2 个:`animated-icon.web.tsx` 与 `app-tabs.web.tsx`。

---

## 2.2 视觉基元(themed-*)

### `themed-text.tsx` — `ThemedText`

```ts
export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'subtitle' | 'heading' | 'small' | 'smallBold'
       | 'label' | 'caption' | 'numeric' | 'read' | 'link' | 'linkPrimary' | 'code';
  themeColor?: ThemeColor;
};
```

**两条分工**:字号 / 字距 / 数字对齐 = App 层面资产(`TYPE_STEPS`,与主题无关);
衬线还是无衬线 = 主题资产(`skin.displayFont` / `skin.bodyFont`)。

```ts
function displayStyle(step: TypeStepName, serif: boolean) {
  return [typeStyle(step), serif ? serifForWeight(TYPE_STEPS[step].weight) : { fontFamily: FONT_SLOTS.label }];
}
```

**type → 实际样式映射**(精确):

| `type` | 应用 |
|---|---|
| `default` | `typeStyle('body')`(16/24/500/0),无衬线 |
| `title` | `displayStyle('display')` → 34/39/600/-0.7 |
| `subtitle` | `displayStyle('title')` → 26/32/600/-0.5 |
| `heading` | `displayStyle('heading')` → 19/26/600/-0.2 |
| `small` | `typeStyle('small')` → 14/20/500/0.1 |
| `smallBold` | `typeStyle('smallBold')` → 14/20/700/0.1 |
| `label` | `skin.plateLabels ? typeStyle('label') : typeStyle('smallBold')`(10/14/600/**1.8** vs 14/20/700/0.1) |
| `caption` | `typeStyle('caption')` → 12/17/500/0.2 |
| `numeric` | `displayStyle('numeric')` → 26/30/600/-0.3 + `fontVariant: ['tabular-nums']` |
| `read` | `typeStyle('reading')` + 衬线族或 sans + `lineHeight = Math.round(18 * skin.bodyLineHeight)`(**运行时按 skin 覆盖**) |
| `link` / `linkPrimary` | `typeStyle('small')` |
| `code` | `styles.code`:mono / 12 / 17 / 0.2 |

**颜色**:`const colorKey = themeColor ?? (type === 'linkPrimary' ? 'accent' : 'text');`
注释:"以前这里写死了 `#3c87f7`,换主题时它不会跟着变"。

保留 `default` 这个名字的理由:"它在全站用了上百处,语义是'普通正文'。
改名会带来一次纯机械的全仓替换,收益为零、风险不小。"

### `themed-view.tsx` — `ThemedView`

```ts
export type SurfaceRadius = 'card' | 'panel' | 'chip' | 'none';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
  type?: ThemeColor;
  frame?: 'plain' | 'playbill';   // 声明"这是一个卡片表面"
  radius?: SurfaceRadius;         // 默认 'card'
};

const TICK = 9;   // 角刻线的长度
```

**行为**:
- `const isPlaybill = frame === 'playbill' && skin.cardFrame;` —— **是否真的画成节目单描边由主题决定**,默认主题下就是一块普通卡片。
- `radiusValue` 映射:`'none'` → `undefined`;`'card'` → `skin.radiusCard`;`'panel'` → `skin.radiusPanel`;`'chip'` → `skin.radiusChip`。
- style 数组顺序:`[{ backgroundColor: theme[type ?? 'background'] }, isPlaybill && { borderWidth: 1, borderColor: theme.border }, style, radiusValue === undefined ? null : { borderRadius: radiusValue }]` —— **主题圆角放最后一位,局部写死会被覆盖**。
- `isPlaybill` 时渲染 **四个**角刻线 View,都是 `pointerEvents="none"`、`borderColor: theme.gold`、`width/height = TICK(9)`、偏移 `top/left/right/bottom: 1`(注释:"括号刻意向内留 1px,和边框错开,才有'括号'而不是'加粗的角'"),每个只画两条相邻的 1px border(`tickTL/TR/BL/BR`)。

**注释里的设计史**:起初只放了对角两点,理由是"四角都放会太吵"——那是"**我自己编的**"。
看了活动页之后改成四角:参考里的道具格、面板框都是四角括号(深藏青方块 + 四角金色 L 形)。

### `word-text.tsx` — `WordText`

```ts
export const WordText = memo(function WordText({
  text, fontSize, lineHeight, candidateSet, todayLearnedSet, onWordPress,
}: {
  text: string;
  fontSize: number;
  lineHeight: number;
  candidateSet?: ReadonlySet<string>;     // 候选生词(按用户词汇量判定、未学未会)——标 annotate 色
  todayLearnedSet?: ReadonlySet<string>;  // 今日新学的词——标 annotateStrong 色并加粗
  onWordPress?: (word: string) => void;
})
```

**渲染**:`tokenize(text)`(来自 `@/domain/wordmark`)→ map 成 token;
非词 token 直接返回字符串(保留原始空白与标点,保证换行自然);
词 token 包一层 `<Text suppressHighlighting onPress>`。

**高亮优先级**(精确):
1. `todayLearnedSet?.has(lower)` → `{ color: theme.annotateStrong, fontWeight: '700' }`
2. `else if (candidateSet?.has(lower))` → `{ color: theme.annotate }`

```ts
const wordStyle: TextStyle = {
  fontFamily: skin.bodyFont === 'serif' ? SERIF_FAMILY.regular : SANS_FAMILY,
  ...(skin.bodyFont === 'serif' ? { fontWeight: 'normal' as const } : {}),
  fontSize, lineHeight, color: theme.text,
};
```

**`memo` 的理由**:未变的句子不随父级状态(如词典卡开关)重渲染 —— 这是点词后卡片能否"秒开"的关键。
**用 `annotate` 而不是 `accent`**:标注是"学习语义",品牌色是"UI 语义"。

### `ui/collapsible.tsx` — `Collapsible`(**未被引用**)

```ts
export function Collapsible({ children, title }: PropsWithChildren & { title: string })
```
- 导入:`expo-symbols` 的 `SymbolView`、`react-native-reanimated` 的 `Animated` + `FadeIn`。
- 渲染:`Pressable` 行 = `ThemedView type="backgroundElement"` 内一个 `SymbolView`
  (`name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}`,
  `size={14}`,`weight="bold"`,`tintColor={theme.text}`,
  `style={{ transform: [{ rotate: isOpen ? '-90deg' : '90deg' }] }}`)+ `ThemedText type="small"`。
- 展开内容:`Animated.View entering={FadeIn.duration(200)}` 包 `ThemedView type="backgroundElement"`。
- 样式:`button` 是 `Spacing.four × Spacing.four`(24×24),`borderRadius: 12`(**唯一没走 skin 的圆角字面量**);
  `content` 用 `Radii.card`(=3)+ `marginLeft: Spacing.four` + `padding: Spacing.four`。
- 这是**唯一使用 `expo-symbols` 的组件**。

---

## 2.3 词典与阅读交互

### `dict-card.tsx` — `DictCard`(295 行,单词概要卡)

```ts
export interface WordSource { articleId: string; sentence?: string; }

export function DictCard({
  result, visible, source, onOpenDetail, onClose, kaoyan = false,
}: {
  result: LookupResult | null;
  visible: boolean;
  source: WordSource;                  // 加入生词本所需的来源上下文
  onOpenDetail: (headword: string) => void;
  onClose: () => void;
  kaoyan?: boolean;                    // 是否命中考研/外部词表(旧标记,保持兼容)
})
```

**文件头的设计意图**:"屏幕居中悬浮框:居中展示,避开底部对齐的各平台差异(Android 导航条/安全区);
淡遮罩 + 卡片轻微缩放淡入(无位移,无抖动);主体为词条概要,底部一行小按钮:详情 / ＋生词本 / 关闭。"

**渲染结构**:`<Modal visible transparent animationType="none" onRequestClose={onClose}>`
→ `View style={styles.root}`(`flex:1`, `alignItems/justifyContent: 'center'`,
`paddingHorizontal: Spacing.four` = 24)
→ `<Pressable style={styles.backdrop} onPress={onClose} />`(绝对填充,`backgroundColor: 'rgba(0,0,0,0.3)'`)
→ `<Animated.View style={[styles.centerWrap, { opacity: fade, transform: [{ scale }] }]}>`
→ `<ThemedView style={styles.card}>`。

**动画**(一次,无 overshoot):
```ts
const [scale] = useState(() => new Animated.Value(0.92));
const [fade]  = useState(() => new Animated.Value(0));
useEffect(() => {
  if (visible) {
    scale.setValue(0.92); fade.setValue(0);
    Animated.parallel([
      Animated.timing(scale, { toValue: 1, duration: 110, useNativeDriver: true }),
      Animated.timing(fade,  { toValue: 1, duration: 110, useNativeDriver: true }),
    ]).start();
  }
}, [visible, scale, fade]);
```
注释:"缩放 + 淡入(一次,无 overshoot)。`useState` 惰性持有 `Animated.Value`(React Compiler 友好)"。

**内容分支**:
- 命中词条(`entry` 存在):`headRow` = 左列(`ThemedText type="subtitle"` 词 + `/phonetic/`)
  + 右侧 `ThemedText type="smallBold" themeColor="accent"` 的词性;若 `result.status === 'inflected'`
  追加"原文词形 "{query}" · 已还原为 {headword}";中文释义 `numberOfLines={4}`(17/26/600)、
  英文 `numberOfLines={3}`。
- 未收录:若 `kaoyan` 显示 `ThemedView type="backgroundSelected" radius="chip"` 徽章"考研词 · 已收录词形";
  否则显示 `result?.query` + `result?.hint ?? '离线词典未收录该词。'`,若 `kaoyan` 副标题为
  "该词高于你当前水平,建议标记学习。"

**`displayWord` 逻辑**:`entry ? entry.headword : (result?.query ?? '')` ——
"未收录也要能加入生词本 / 标记学习(否则按钮看起来能点却毫无反应)"。

**底部按钮行**(右对齐,`gap: Spacing.two`,`marginTop: Spacing.three`):
`详情 ›` / `＋ 生词本`(已收藏时 `✓ 已收藏 · 点按移出`)/ `关闭`,
都是 `ThemedView type="backgroundSelected"|"backgroundElement"` + `ThemedText type="smallBold"`,
`smallBtn` 为 `paddingHorizontal: Spacing.three`, `paddingVertical: Spacing.two`, `borderRadius: Radii.card`(=3)。

**卡片样式**:`borderRadius: Spacing.four`(=24,**不是** `Radii.card`)、
`paddingHorizontal: Spacing.four`、`paddingTop/Bottom: Spacing.three`、`gap: Spacing.two`,
投影 `shadowColor: '#000'`, `shadowOpacity: 0.18`, `shadowRadius: 24`, `shadowOffset: { width: 0, height: 8 }`, `elevation: 10`。
顶部 `handle` 条:`alignSelf: 'center'`, `width: 40`, `height: 4`, `borderRadius: 2`。
`centerWrap`:`width: '100%'`, `maxWidth: 480`。
`flagBadge`:`Radii.sharp`(=2), `paddingHorizontal: Spacing.two`, `paddingVertical: Spacing.half`。
`pressed: { opacity: 0.6 }`。

**关键业务注释**:这里原来有「＋ 今日学习」「我会了」两个按钮,现已删除 ——
"加入生词本即等于今日新学 +1(见 `storage/words.ts` 的 `toggleWordSave`),不再需要一个专门标记
'今日学习'的按钮;「我会了」的判定改由复习流程承担 —— 生词本只负责'收',是否掌握由复习的自评结果决定
(见 `domain/srs` 与复习页),这样知识曲线才有一个可信的数据来源"。

**导入**:`react`(useEffect, useState)、`react-native`(Animated, Modal, Pressable, StyleSheet, View)、
`@/components/themed-text`、`@/components/themed-view`、`@/constants/theme`(Radii, Spacing)、
`@/domain/dictionary`(type LookupResult)、`@/hooks/use-theme`、`@/hooks/use-word-saved`。

### `sentence-block.tsx` — `SentenceBlock`(139 行)

```ts
export const SentenceBlock = memo(function SentenceBlock({
  sentence, fontSize, lineHeight, candidateSet, todayLearnedSet, onWordPress,
}: {
  sentence: string;
  fontSize: number;
  lineHeight: number;
  candidateSet?: ReadonlySet<string>;
  todayLearnedSet?: ReadonlySet<string>;
  onWordPress: (word: string, sentence: string) => void;   // 带上本句作为上下文
})
```

**渲染**:`View style={styles.block}`(`gap: Spacing.one`)→
`<WordText .../>` + `actionsRow`(`flexDirection: 'row'`, `justifyContent: 'flex-end'`,
`marginTop: Spacing.half`)内一个 `Pressable hitSlop={8}` 显示
`ThemedText type="smallBold" themeColor="accent"` 的 `译` / `收起译 ›`。
展开时:`<ThemedView type="backgroundElement" radius="panel" style={styles.translation}>`
(`paddingHorizontal: Spacing.three`, `paddingVertical: Spacing.two`, `gap: Spacing.half`)。
内部:标签(`result.mode === 'online' ? '整句翻译' : '离线兜底(非整句)'`,11/14/0.5)+
译文(16/24)+ 可选 note(lineHeight 18);`result` 为空时显示"翻译中…"。
失败回退:`{ text: '', mode: 'offline-wordwise', missingCount: 0, note: '翻译失败,请重试' }`。
末尾 `<View style={{ height: Spacing.two }} />`(段间距)。

**`memo` 的理由**:"点词弹出词典卡会更新阅读页状态,若不 memo,
整篇文章每个句子的所有词节点都会重渲染 → 卡片出现明显变慢。
因此 `onWordPress` 必须是**稳定引用**(父级用 `useCallback`),句子由本组件内部拼进回调。"
翻译结果有模块级缓存(见 `@/domain/translate`),重复展开不重复计算。

**导入**:`react`(memo, useCallback, useState)、`react-native`、themed-text、themed-view、
`@/components/word-text`、`@/constants/theme`(Spacing)、`@/domain/translate`(translateSentence, type TranslationResult)。

### `heading-translate.tsx` — `HeadingTranslate`(149 行)

```ts
export function HeadingTranslate({ title, summary }: { title: string; summary?: string })
```
文章头部(标题 + 简介)整段翻译。交互与 `SentenceBlock` 一致(右侧 `译` / `收起 ›` 小按钮)。
展开时**同时**翻译标题与简介(在线优先,失败自动离线兜底,带缓存),
译文里分别标注 `标题` / `简介`(`partLabel` 是 `smallBold` `textSecondary`,12/16)。
`failed()` 辅助返回 `{ text: '', mode: 'offline-wordwise', missingCount: 0, note: '翻译失败,请重试' }`。
`loading = (title.trim() && !titleRes) || (Boolean(summary?.trim()) && !summaryRes)`。
`offline = titleRes?.mode === 'offline-wordwise' || summaryRes?.mode === 'offline-wordwise'`。
样式与 `sentence-block` 几乎相同(card 用 `radius="panel"`,`gap: Spacing.two`)。
**导入**:`react`(useState)、`react-native`、themed-text、themed-view、`@/constants/theme`、`@/domain/translate`。

---

## 2.4 封面与卡片

### `article-cover.tsx` — `ArticleCover`(271 行)

```ts
export function ArticleCover({ article, size = 'banner' }: { article: Article; size?: 'thumb' | 'banner' | 'hero' })
```

**按主题分两条路**:
```ts
const usePlaybill = skin.coverArt === 'playbill';   // 判定放在 hooks 之后、条件 return 之前
...
if (usePlaybill) return <PlaybillCover article={article} size={size} style={[frame, radius]} />;
```
⚠️ 注释明确警告:如果写成 `if (skin.motifs) return …` 放在 `useState`/`useEffect` **之前**,
换主题时 hook 调用数量会变化 → React 直接报错。

**默认主题(photo) → 多级真实图回退**:
1. `article.coverUrl`(Wikimedia Commons 开放许可图)—— 注释:"Wikimedia 在国内常被墙,
   一旦确认不可达,以后直接跳过本层";
2. `picsum.photos` seed 图:`https://picsum.photos/seed/${encodeURIComponent(id)}/800/450`;
3. Unsplash CDN:`https://images.unsplash.com/${photo}?auto=format&fit=crop&w=800&q=60`,
   通过 `h = (h * 31 + id.charCodeAt(i)) >>> 0` 从 **20 个 `UNSPLASH_IDS`** 里选
   (森林阳光、湖面山景、晨雾山峦、林间光柱、雪原山川、原野、湖边栈道、山巅云海、远山、
   暮色山峰、海滩、星空雪山、湖上独木舟、湖畔码头、林间光、沙漠、城市街道、城市夜景、
   城市黄昏、书桌/学习);
4. 全部失败 → id 稳定渐变 + 话题 emoji。

**超时与记忆**:`const LOAD_TIMEOUT_MS = 6000;` 每层超时(挂死的请求不会一直灰着);
`onError` 立即跳级;Wikimedia 不可达用 `BLOCK_KEY = 'readingapp.cover.commons-blocked.v1'`
做 AsyncStorage 持久化 + 模块级 `commonsBlocked` 记忆。
`buildTiersFor(id, coverUrl)` 组装队列并去重。
进度按 `${article.id}|${article.coverUrl}` 记忆,用「渲染期修正状态」重置
(`if (progress.key !== cacheKey) setProgress({ key: cacheKey, idx: 0 });`,React 官方模式,不在 effect 里 setState)。
图片 `transition={150}`。

**尺寸与圆角**:
```ts
thumb:  { height: 80,  alignItems: 'center', justifyContent: 'center' }
banner: { height: 88,  alignItems: 'center', justifyContent: 'center' }
hero:   { height: 180, borderBottomLeftRadius: 20, borderBottomRightRadius: 20, alignItems: 'center', justifyContent: 'center' }
// 运行时覆盖:
const radius = isHero
  ? { borderBottomLeftRadius: skin.radiusCard, borderBottomRightRadius: skin.radiusCard }
  : { borderRadius: skin.radiusPanel };
```
注释:"与原值(10 / 12 / 20)有几像素出入,肉眼不可辨,换来的是'圆角只有一个来源'。"

**最终回退视觉**:`mixWithWhite(main, light)` —— `light` 时 `v + (255-v)*0.86`,否则 `v*0.22`;
`tint = light ? 0.14 : 0.3`;`orb`(右上大圆 `140×140`, `borderRadius: 70`, `right: -30, top: -40`)、
`orbSmall`(左下 `90×90`, `borderRadius: 45`, `left: -16, bottom: -24`,`opacity: light ? 0.1 : 0.22`);
emoji 字号 `thumb 30/40`、`banner 40/52`、`hero 84/100`。

**已修的 bug**(注释原文):"曾经这里是 `theme.background === '#ffffff'` —— 拿底色当'是不是浅色'的探针。
只要主题的浅色底不是纯白(比如叙拉古的羊皮纸),这个判断就永远为 false,浅色模式会静默走深色分支。
深浅色就该问深浅色本身。"

**导入**:`@react-native-async-storage/async-storage`、`expo-image`、`react`(useEffect, useMemo, useRef, useState)、
`react-native`、`@/components/playbill-cover`、`@/components/themed-text`、`@/domain/cover`(articleEmoji, coverColor)、
`@/hooks/use-theme`(useResolvedScheme, useTheme, useThemeSkin)、`@/types`。

**宽度契约(踩过一次,已写进注释)**:封面**只提供高度,宽度一律由父容器决定**。
"列(默认)→ `alignItems: 'stretch'` 自动撑满 ✅;行 → 子元素的**内容**宽度,
退化成'内部唯一有固有宽度的元素'的宽度 ❌"。三个 `size="thumb"` 调用点已核对:
`recommend-card.tsx`(行,已补 `cover: { width: 60 }`)、`(tabs)/index.tsx` 继续阅读(行,已有 `continueCover: { width: 72 }`)、
`latest-strip.tsx`(列,靠 `CARD_WIDTH` stretch)。

### `playbill-cover.tsx` — `PlaybillCover`(375 行,程序化"节目单"封面)

```ts
export type CoverSize = 'thumb' | 'banner' | 'hero';

export function PlaybillCover({ article, size = 'banner', style }: {
  article: Article; size?: CoverSize; style?: StyleProp<ViewStyle>;
})

const METRICS: Record<CoverSize, { pad: number; mark: number; tick: number; label: number }> = {
  thumb:  { pad: 6,  mark: 20, tick: 6,  label: 0 },   // label 0 = 不显示题签(缩略图上会糊成一团)
  banner: { pad: 8,  mark: 26, tick: 7,  label: 9 },
  hero:   { pad: 14, mark: 52, tick: 12, label: 10 },
};
```

**内部子组件**:
- `Layout({ spec, layout, m, j })` — 4 种模板:
  - `layout 0`:右上大圆 + 左下小圆(`big = m.mark * (3.0 + j*1.6)`, `small = m.mark * (1.8 + j*0.8)`);
  - `layout 1`:左侧竖向色带(`width: ${22 + Math.round(j*10)}%`)+ 右下圆弧;
  - `layout 2`:底部横向色带(`height: ${30 + Math.round(j*12)}%`)+ 右上圆;
  - `layout 3`:对角 —— 大圆压右上(`big*1.25`)+ 中部横向色带(`right: '38%'`, `top: ${38 + Math.round(j*18)}%`)。
- `Frame({ spec, frame, pad, tick })` — 3 种:
  - `0`:内框(`borderWidth: StyleSheet.hairlineWidth`, `opacity: 0.7`)+ 对角刻线 `tickTL`/`tickBR`(`top/left: -1`, `opacity: 0.9`);
  - `1`:**只有**对角刻线;
  - `2`:双线内框(外框 + 内缩 4px、`opacity: 0.35` 的细框)+ 刻线。
- `Mark({ mark, size, color })` — 4 种徽记:
  - `diamond`:`size*0.3` 方形 + `transform: [{ rotate: '45deg' }]`;
  - `ring`:`size × size`, `borderRadius: size/2`, `borderWidth: 1`;
  - `bars`:3 条横线,宽度比 `[1, 0.66, 0.34]`, `gap: size*0.16`, 高 `StyleSheet.hairlineWidth + 1`;
  - `cross`:`size*0.5` 的容器 + 一横一竖各 `StyleSheet.hairlineWidth + 1` 粗。

**题签**:`m.label > 0 && label` 时(即 banner/hero)左下角渲染
`labelWrap`(`flexDirection: 'row'`, `alignItems: 'center'`, `gap: 6`,偏移 `left: m.pad + 7`, `bottom: m.pad + 7`)
+ `labelDot`(`4×4` 旋转 45° 的菱形)+ `labelText`
(`letterSpacing: 2.6`, `textTransform: 'uppercase'`, `fontWeight: '600'`,字号 = `m.label`)。
`const label = article.topicTags[0] ?? '';`

**开发期护栏**:
```ts
const warnedWidth = new Set<string>();   // 已经提醒过的"封面被压窄"组合,避免列表里刷屏

const handleLayout = __DEV__ ? (e: LayoutChangeEvent) => {
  const w = Math.round(e.nativeEvent.layout.width);
  const key = `${article.id}|${size}`;
  if (w > 0 && w < 24 && !warnedWidth.has(key)) {
    warnedWidth.add(key);
    console.warn(`[ArticleCover] ${size} 封面宽度只有 ${w}px —— 行布局的父容器必须自己包一层固定宽度的 View(见 recommend-card.tsx 的 cover)。`);
  }
} : undefined;
```

**`styles.wrap` 的关键注释**:**不要加 `flex: 1`**。
"RN 的 `flex` 简写会展开成 `flexBasis: 0%` —— 主轴尺寸一旦由 basis 决定,显式的 height 就被忽略,
在一列自动高度的父容器里 flexGrow 也没东西可分,**封面会直接塌成 0 高**。
默认主题不走这条路径所以看不出来,叙拉古主题会中招。"

**导入**:`react-native`(StyleSheet, View, type LayoutChangeEvent/StyleProp/ViewStyle)、
`@/components/themed-text`、`@/domain/cover-art`(coverArtFor, type CoverFrame/CoverLayout/CoverMark)、`@/types`。
形状全是圆/方/线,**不引入 `react-native-svg`**;**刻意不用渐变**
(`experimental_backgroundImage` 在部分平台不生效,"而封面是最不该出岔子的地方")。

### `src/domain/cover-art.ts`(98 行)— 节目单封面的纯逻辑

**为什么逻辑与渲染分开**:① 这里全是可测的纯函数,`scripts/verify-cover-art.mjs` 可以直接跑它,
断言"色调够分散、对比度够高、布局不会全撞在一起",不需要渲染;
② 渲染层只负责把规格画出来,换成别的画法不用动这里。

```ts
export type CoverLayout = 0 | 1 | 2 | 3;
export type CoverMark = 'diamond' | 'ring' | 'bars' | 'cross';
export type CoverFrame = 0 | 1 | 2;   // 0 内框+对角刻线 · 1 只有对角刻线 · 2 双线内框

export interface CoverArtSpec {
  base: string;      // 版心底色
  block: string;     // 主要色块(大圆/色带)
  blockSoft: string; // 次要色块(小圆/副带),比 block 更暗
  ink: string;       // 线条与文字色(象牙调,压在底色上保证高对比)
  layout: CoverLayout;
  mark: CoverMark;
  frame: CoverFrame;
  jitter: number;    // 0–1 的抖动系数:给色块的位置与尺寸做微差
}

const HUE_ANCHORS = [352, 338, 324, 308, 292, 276, 258, 242, 228, 40];   // 10 个锚点

/** FNV-1a 32 位:分布比"乘法累加取模"好,而且逐位可用 */
function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function coverArtFor(id: string): CoverArtSpec {
  const h = hash32(id);
  const anchor = HUE_ANCHORS[h % HUE_ANCHORS.length];
  const hue = (anchor + ((h >>> 3) % 33) - 16 + 360) % 360;   // ±16° 抖动
  const baseL = 8 + ((h >>> 7) % 7);                          // 底色明度 8–14%
  const blockL = 26 + ((h >>> 11) % 11);                      // 色块明度 26–36%
  const blockSoftL = Math.max(6, baseL - 3 - ((h >>> 13) % 3));
  return {
    base:      hslToHex(hue, 40 + ((h >>> 5) % 12), baseL),
    block:     hslToHex(hue, 38 + ((h >>> 9) % 16), blockL),
    blockSoft: hslToHex((hue + 12) % 360, 34, blockSoftL),
    ink:       hslToHex(hue, 20, 90),        // 带一点色相,像同色系的印刷墨
    layout: ((h >>> 15) % 4) as CoverLayout,
    mark: (['diamond', 'ring', 'bars', 'cross'] as const)[(h >>> 17) % 4],
    frame: ((h >>> 21) % 3) as CoverFrame,
    jitter: ((h >>> 19) % 1000) / 1000,
  };
}

/** 供校验脚本用:某个 id 的"外观指纹"(布局 + 徽记 + 边框 + 色相桶) */
export function coverFingerprint(id: string): string {
  const spec = coverArtFor(id);
  const hueBucket = Math.round(Number.parseInt(spec.base.slice(1, 3), 16) / 4);
  return `${spec.layout}-${spec.mark}-${spec.frame}-${hueBucket}`;
}
```

**色相锚点的理由**(注释):"**不是均匀铺满色环,而是照活动截图的实测色族取的**……
也就是说活动的色域是一条 **绯红 → 品红 → 紫 → 靛蓝** 的弧,再加一点暖金,
完全没有青绿、亮黄这些。所以锚点也只取这条弧 —— 早先均匀铺满 360° 的版本
会生成橄榄绿、青色的封面,那些颜色在活动里根本不存在。"

⚠️ **文档与代码不一致**:`docs/theme-siracusa.md` 第 13.3 节说色相锚点 **12 个**,
第 14.5 节列出 `352/338/324/308/292/276/258/242/228 + 暖金 40`,**实际数组只有 10 个值**。
组合维度因此是 **10 × 4 × 4 × 3 = 480**(而非 12 × 4 × 4 × 3 = 576)。
实测指纹仍达 422/458,是因为 `jitter` 与 `blockSoft` 的色相偏移额外拉开了差异。

**导入**:`@/domain/cover`(hslToHex)。

### `recommend-card.tsx` — `RecommendCard`(124 行)

```ts
export interface RecommendCardData {
  article: Article;
  bandId: string;         // 参考档位(如 B1+)—— 只作参考层展示
  requiredVocab: number;  // 所需词汇量
  coverage: number;       // 预测理解率(0–1):你大约能认识这篇多少比例的词
  fit: string;            // 一句人话评价:刚好合适 / 略有挑战 …(按理解率判定)
  learnableCount: number; // 值得学的去重新词数
  sampleNewWords: string[];
}
export function RecommendCard({ data }: { data: RecommendCardData })
```

**渲染**:外层 `<PressScale onPress={() => router.push('/article/' + article.id)}>` →
`<ThemedView type="backgroundElement" frame="playbill" style={styles.card}>`
(`flexDirection: 'row'`, `alignItems: 'center'`, `gap: Spacing.three`, `padding: Spacing.two + 2` = 10)
- `<View style={styles.cover}>`(`width: 60`)包 `<ArticleCover size="thumb" />` → **60×80 海报比例**
- `body`(`flex: 1`, `gap: Spacing.one`):`ThemedText type="heading" numberOfLines={2}`(`fontSize: 15`, `lineHeight: 21`)
  + `chips` 行 + `reasonRow`
- 右侧箭头 `ThemedText type="small" themeColor="textSecondary"`(`›`, `fontSize: 18`)

**芯片**:内部私有组件 `Chip({ text })` = `View`(`backgroundColor: theme.accentSoft`,
`borderRadius: skin.radiusChip`, `paddingHorizontal: Spacing.two`, `paddingVertical: 2`)+
`ThemedText type="caption" themeColor="accent"`(11/16)。三个芯片:
`认识约 {coverageText}` / `新词 {learnableCount}` / `{minutes} 分钟`,
其中 `coverageText = ${(coverage * 100).toFixed(1)}%`。

**推荐理由行**(主题分叉):
```tsx
{skin.motifs ? (
  <Star size={5} />
) : (
  <ThemedText type="caption" themeColor={isStretch ? 'accent' : 'textSecondary'}>
    {isStretch ? '✓' : '💡'}
  </ThemedText>
)}
```
描述文字 `{fit} · {bandId} 需词汇量 {requiredVocab}{samples ? ` · 新词 ${samples}` : ''}`,
`samples = sampleNewWords.slice(0, 2).join(' / ')`,`isStretch = fit === '略有挑战' || fit === '刚好合适'`。
**注释警告**:"这里给的是'读懂本文所需词汇量',不是文章长度 —— 别写成「约 N 词」"。

`reason: { fontSize: 11.5, lineHeight: 16, flexShrink: 1 }`(全仓唯一的非整数字号)。
**导入**:`expo-router`(useRouter)、`react-native`、article-cover、motion(PressScale)、
ornaments(Star)、themed-text、themed-view、`@/constants/theme`、`@/hooks/use-theme`(useTheme, useThemeSkin)、`@/types`。

### `article-card.tsx` — `ArticleCard`(88 行)

```ts
export function ArticleCard({ article, completed }: { article: Article; completed?: boolean })
```
`Pressable`(`pressed && { opacity: 0.92 }`)→
`ThemedView type="backgroundElement" frame="playbill" style={styles.card}`
(`borderRadius: Radii.card`, `overflow: 'hidden'`)→ `ArticleCover size="banner"` +
`body`(`padding: Spacing.three`, `gap: Spacing.two`)。
头行:`ThemedText type="label" themeColor="textSecondary"`(话题 `article.topicTags.join(' · ')`)+
`completed` 时右侧 `ThemedText type="smallBold" themeColor="accent"` 显示 `已读 ✓`。
然后 `heading` 标题、`small textSecondary numberOfLines={2}` 摘要(`lineHeight: 20`)、
`ChipRow`、可选来源行(`caption`,`opacity: 0.8`,`来源:{article.credit}`, `numberOfLines={1}`)。
芯片内容:`难度 {diff.band.id}` / `需词汇量 {diff.requiredVocab}` / `{d.wordCount} 词` / `约 {d.minutes} 分钟`。
**关键注释**:两个"词"的指标含义完全不同,标签不能混 ——
`diff.requiredVocab` = **读懂本文所需的词汇量**(如 4600),是"你的词汇量要到多少";
`d.wordCount` = **本文实际长度**(如 460),是"这篇文章有多少词"。
"旧实现把前者写成「约 4600 词」并与「N 分钟」并排,读者会算成 4600 词 / 3 分钟 ≈ 一分钟一千多词,
看起来像时长估算坏了 —— 其实是指标标错了名。"
**导入**:`expo-router`、`react-native`、article-cover、chip(ChipRow)、themed-text、themed-view、
`@/constants/theme`、`@/domain/difficulty`、`@/types`。

### `latest-strip.tsx` — `LatestStrip`(93 行)

```ts
export function LatestStrip({ articles, date }: { articles: Article[]; date?: string })
```
`if (articles.length === 0) return null;` —— **整体不渲染**。
`wrap`(`alignSelf: 'center'`, `width: '100%'`, `maxWidth: MaxContentWidth`)→
`headRow`(`flexDirection: 'row'`, `alignItems: 'baseline'`, `justifyContent: 'space-between'`,
`marginBottom: Spacing.two`):左"最新更新"(`smallBold`),右 `date ? '更新于 {date}' : '{articles.length} 篇'`。
横向 `ScrollView`(`showsHorizontalScrollIndicator={false}`,
`contentContainerStyle: { gap: Spacing.three, paddingBottom: Spacing.one }`)。
每张卡:`Pressable`(`pressed && { opacity: 0.9 }`)→
`ThemedView type="backgroundElement" style={styles.card}`
(`width: CARD_WIDTH`, `borderRadius: Radii.card`, `overflow: 'hidden'`)
→ `ArticleCover size="thumb"`(列布局,靠 stretch 撑满宽度)+
`cardBody`(`padding: Spacing.two`, `gap: Spacing.one`)
→ `small numberOfLines={2}`(`minHeight: 40`, `lineHeight: 20`)+
`small textSecondary numberOfLines={1}`(`${difficultyOf(a).band.id} · ${a.difficulty.minutes} 分钟`)。

```ts
const CARD_WIDTH = 172;
```
**导入**:`expo-router`、`react-native`(Pressable, ScrollView, StyleSheet, View)、article-cover、
themed-text、themed-view、`@/constants/theme`(Radii, MaxContentWidth, Spacing)、`@/domain/difficulty`、`@/types`。

### `learner-profile-card.tsx` — `LearnerProfileCard`(241 行,"单块布局")

```ts
const SCALE_MIN = 300;      // 词汇量展示量程(与 wordlevel 的门槛刻度一致)
const SCALE_MAX = 12000;

export interface ReadingSummary {
  totalWordsRead: number;
  avgPerArticle: number | null;
  masteredCount: number;
  topics: string;   // 已格式化的常读话题,如 "科技(4) · 社会(3)"
}

export function LearnerProfileCard({
  profile, reading, onAssess,
}: { profile: LearnerProfile; reading?: ReadingSummary; onAssess?: () => void })
```
**设计史(文件头)**:"之前的版本内部拆成 4 张卡(词汇量 / 曲线 / 标签 / 参考层),
外面还挂着一张阅读统计卡,一屏下来 5 个方块,视觉上非常碎。现在合并为**一个功能区**,内部用细线分隔。"
`const divider = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border };`

**四个分区**:
1. **词汇量 + 区间**:`headerRow`(左"估计词汇量" + 右 `去评估 ›` / `重新评估 ›`,
   判定看 `profile.bands.length === 0`,`hitSlop={8}`)→ `vocabRow`(`alignItems: 'baseline'`, `gap: Spacing.one + 2`)
   内 `ThemedText type="title" themeColor="accent"`(**`fontSize: 42`, `lineHeight: 50`**)+ `词`(`smallBold textSecondary`)+
   `参考 {cefr}` 芯片 → 区间文字 `区间 {low}–{high} 词 · 可信度{confidence} · {modeText}`,其中
   `modeText = mode === 'fine' ? '精细评估' : mode === 'pick' ? '自选档位' : '快速评估'`。
   区间条:`track`(`height: 6`, `overflow: 'hidden'`, `marginTop: Spacing.one`, `borderRadius: skin.radiusChip`, `backgroundColor: theme.backgroundSelected`)
   + `range`(`backgroundColor: theme.accentSoft`, `left/width` 百分比,最小宽度 2%)
   + `point`(`width: 2`, `height: 12`, `top: -3`, `backgroundColor: theme.accent`, `left: pointPct%`)。
   百分比:`span = 12000 - 300`;`lowPct = max(0, ((low-300)/span)*100)`;
   `highPct = min(100, ((high-300)/span)*100)`;`pointPct = clamp(((vocab-300)/span)*100)`。
2. **分频段掌握曲线**(`profile.bands.length > 0` 时):标题 `分频段掌握`(`smallBold`);
   每行 `bandLabel`(`width: 92`, 12/16)+
   `bandTrack`(`flex: 1`, `height: 5`, `overflow: 'hidden'`, `borderRadius: skin.radiusChip`, `backgroundColor: theme.backgroundSelected`)+
   `bandFill`(`width: max(2, rate*100)%`, `backgroundColor: rate >= 0.5 ? theme.accent : theme.textSecondary`,
   `opacity: rate >= 0.8 ? 1 : rate >= 0.5 ? 0.7 : 0.45`)+
   `bandPct`(`width: 38`, `textAlign: 'right'`, 12)+ `bandCount`(`width: 42`, `textAlign: 'right'`, 11, `{known}/{total}`)。
3. **派生标签 + 建议**:`traitColors = { strength: theme.success, gap: theme.danger, note: theme.textSecondary }`;
   标记字形 `trait.kind === 'strength' ? '✓' : trait.kind === 'gap' ? '!' : '·'`
   (`traitMark: { width: 16, fontWeight: '700' }`)。
   建议行分叉:`skin.motifs ? <View style={styles.traitMarkWrap}><Star size={6} /></View> : <ThemedText style={[styles.traitMark, { color: theme.accent }]}>👉</ThemedText>`
   (`traitMarkWrap = { width: 16, paddingTop: 5 }`,注释:"纹样菱形与 emoji 对齐:同样的 16px 列宽")。
4. **阅读统计 / 话题 / 参考档位**(`reading` 存在时):"累计阅读 {totalWordsRead} 词 · 篇均 {avgPerArticle} 词 · 已掌握 {masteredCount} 词"、
   "常读话题:{topics}"或"读完几篇后,这里会显示你偏好的话题"、
   "参考档位:{bandLabel}(仅作对照,推荐按预测理解率匹配)"。

**样式**:`card: { padding: Spacing.three }`,`block: { gap: Spacing.two }`,
`blockTop: { marginTop: Spacing.three, paddingTop: Spacing.three }`,`footer: { gap: Spacing.one + 2 }`,
`traitText: { flex: 1, lineHeight: 19 }`,`pressed: { opacity: 0.6 }`。
**导入**:`react-native`(Pressable, StyleSheet, View)、ornaments(Star)、themed-text、themed-view、
`@/constants/theme`、`@/domain/profile`(type LearnerProfile)、`@/hooks/use-theme`(useTheme, useThemeSkin)。

---

## 2.5 纹样、形象与动效

### `motion.tsx` — `Enter` / `PressScale` / `Shimmer`(157 行)

**文件头的动效设计意图**:"让界面'有重量'" ——
卡片是"被放上去"的而不是"突然出现" → `Enter` 错开入场;
手指按下去有反馈,不是"点了个寂寞" → `PressScale` 按压回弹;
加载中的内容在"流动",不是一块死灰 → `Shimmer`。
"动效是 **App 层面的资产**(和配色/几何那套主题正交)"。

**三条纪律**:
1. **时长都在 90~360ms**:低于 90ms 感觉不到,高于 400ms 会显得迟钝;
2. **入场只错开 60ms 一档**:总时长超过约 0.5s 就会让人觉得"App 卡"。一屏最多 6 档,后面的直接跟随最后一档;
3. **用 reanimated 的 UI 线程动画**:按压与入场都不触发 React 重渲染,列表滚动时不会掉帧。

```ts
const STAGGER_MS = 60;
const MAX_STEPS = 6;

// 1) 错开入场:淡入 + 从下方 10px 浮起
export function Enter({ step = 0, children, style }: { step?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const delay = Math.min(step, MAX_STEPS) * STAGGER_MS;
  return <Animated.View style={style} entering={FadeInDown.delay(delay).duration(340)}>{children}</Animated.View>;
}

// 2) 可按压容器:按下时轻微缩小 + 变暗,松开回弹
export function PressScale({
  children, onPress, disabled = false, style,
  scaleTo = 0.975,          // 按下时的缩放比。卡片用 0.975,小按钮用 0.94
  accessibilityLabel,       // 无障碍标签(只有图标没有文字时必填)
}: { children: ReactNode; onPress?: () => void; disabled?: boolean;
     style?: StyleProp<ViewStyle>; scaleTo?: number; accessibilityLabel?: string })
```
`PressScale` 内部用 **RN 自带的 Animated**(`useMemo(() => new RNAnimated.Value(1), [])` 持有 `scale` 与 `dim`):
- 按下:`RNAnimated.spring(scale, { toValue: scaleTo, damping: 18, stiffness: 340, useNativeDriver: true })`
  ∥ `RNAnimated.timing(dim, { toValue: 0.9, duration: 90, useNativeDriver: true })`;
- 松开:`RNAnimated.spring(scale, { toValue: 1, damping: 16, stiffness: 240, useNativeDriver: true })`
  ∥ `RNAnimated.timing(dim, { toValue: 1, duration: 140, useNativeDriver: true })`。

渲染:`<Pressable onPress disabled accessibilityLabel onPressIn={toPressed} onPressOut={toRest}>` 包**单层**
`<RNAnimated.View style={[style, { transform: [{ scale }], opacity: dim }]}>`。

**为什么不用 reanimated 的 `useSharedValue` 做按压**(注释原文):"项目开了 React Compiler
(`app.json` 的 `experiments.reactCompiler`),它的 `react-hooks/immutability` 规则
**不允许在事件回调里写 `sharedValue.value`** —— 那是 reanimated 的标准写法,却过不了这个 lint。
好消息是 transform/opacity 配 `useNativeDriver: true` 本来就跑在 UI 线程,手感与 reanimated 没差别。"
另外:"用 `useMemo` 而不是 `useRef(...).current`:`react-hooks/refs` 规则禁止在渲染期读 ref 当前值
(`skeleton.tsx` 里已经踩过同一条规则,项目统一用这个写法)。"
还有:"注意这里**只包一层 Pressable**(项目里踩过'嵌套 Pressable 抢触摸'的坑,见 `primary-button.tsx` 的文件头说明)。"

```ts
// 3) 加载微光:一条高光带从左到右扫过
export function Shimmer({ style }: { style?: StyleProp<ViewStyle> }) {
  const x = useSharedValue(0);
  useEffect(() => {
    x.value = withRepeat(withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }), -1, false);
  }, [x]);
  const animated = useAnimatedStyle(() => ({ transform: [{ translateX: -160 + x.value * 920 }] }));
  return (
    <Animated.View pointerEvents="none" style={[{
      position: 'absolute', top: 0, bottom: 0, left: 0, width: 140,
      experimental_backgroundImage:
        'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.55) 50%, rgba(255,255,255,0) 100%)',
    }, animated, style]} />
  );
}
```
注释:"扫光用**渐变**而不是纯色块 —— 纯色块扫过去像'有个方块在移动',渐变才像光";
"扫描范围给的是固定值(-160 → 760):骨架块宽度未知,但一个屏最多也就 800dp 上下,
用固定范围比去测 `onLayout` 简单得多,而且扫到屏幕外也看不出来。"

> ⚠️ 注释里"`experimental_backgroundImage` 项目里已经在用,见 `animated-icon.tsx`"**是过时的**:
> 全仓只有 `motion.tsx` 一处使用该属性。

**导入**:`react`(useCallback, useEffect, useMemo, type ReactNode)、
`react-native`(Animated as RNAnimated, Pressable, type StyleProp, type ViewStyle)、
`react-native-reanimated`(Animated, Easing, FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withTiming)。

### `ornaments.tsx` — `CurtainBand` / `Star` / `Seal` / `Medallion`(178 行)

**文件头声明**:"这些形状来自**参考图实测**,不是推的。活动宣传页里反复出现的符号是
**四角星 ✦**(标题旁、页脚、火花)与爆炸星芒,不是早先我自己编的'旋转 45° 菱形'。"

**三个约束**:
1. **不引入 `react-native-svg`** —— 四角星用字体里的 `✦`(U+2726),其余是圆/方/线,普通 View 足够;
2. **每个纹样在 `skin.motifs === false` 时渲染 `null`** —— 默认主题不该多出任何装饰,
   这是"切回默认主题要完全回到原样"的硬要求;
3. 尺寸都按传入的 `size` 等比算,同一个纹样要能用在 16px 的芯片里和 180px 的封面上。

```ts
// 幕布轨:通栏的一条强调色横带 + 下方 1px 金线
export function CurtainBand({ style }: { style?: StyleProp<ViewStyle>)
```
`curtainWrap: { height: 3, borderBottomWidth: 1, overflow: 'hidden', borderBottomColor: theme.gold }`,
内部 `curtainStripes`(`flexDirection: 'row'`, `height: 3`)渲染 **16 个 View**,每个 `flex: 1`,
`backgroundColor: theme.accent`,`opacity: i % 2 === 0 ? 1 : 0.62`(交替深浅做出"幕布褶皱")。
注释:"参考图里的幕布是插画中的红色丝绒、不是界面元件;这里保留它是因为'揭幕'这个动作
对本 App 的叙事仍然成立,但**颜色跟主题走**。"

```ts
export function Star({ size = 9, color, style }: { size?: number; color?: string; style?: StyleProp<ImageStyle> })
const box = Math.max(10, Math.round(size * 1.6));
```
渲染 `<Image source={require('@/assets/art/star4.png')} style={[{ width: box, height: box }, style]}
contentFit="contain" tintColor={color ?? theme.gold} />`。
**用生成的 PNG 素材,不是字体字形**。早先用 `✦`(U+2726) 顶替过一阵,两个问题:
① 依赖 ROM 的字体覆盖,缺字形就变成方框;② 字形是正立的印刷符号,凹边弧度与参考里的星芒不同,
而且**不能按主题染色**。"现在的素材由 `scripts/gen-art.ps1` 用三次贝塞尔画出凹边星形,
白色 + alpha,运行时用 `tintColor` 上色 —— 所以它能跟着主题的 `gold` 走。"
`size` 是**绘制盒子的边长**——"调用点原来按字形尺寸传 5–7(字形自带大片内边距),
换成绘制素材后要放大到 10–12 才等效,所以这里做一次换算并设下限。"
注意 `style` 类型是 `ImageStyle`(这是 expo-image 不是 View)。

```ts
export function Seal({ size = 22, label, style }: { size?: number; label?: string; style?: StyleProp<ViewStyle> })
```
蜡封印章:金圈(`borderWidth: 1`, `borderColor: theme.gold`)+ 强调衬底(`backgroundColor: theme.accentSoft`)
+ 中央符号(`ThemedText themeColor="accent"`,字号 `Math.round(size * 0.5)`,行高 `Math.round(size * 0.62)`),
`borderRadius: size / 2`, `alignItems/justifyContent: 'center'`。
用在"连续打卡"和"已完成阅读"这类**有仪式感的完成态**上。
> ⚠️ **`Seal` 当前没有任何调用点** —— 打卡徽章在 `(tabs)/index.tsx` 里改用 `Star size={6}` 实现。

```ts
export function Medallion({ size = 56, style }: { size?: number; style?: StyleProp<ViewStyle> })
const inner = Math.max(7, Math.round(size * 0.34));
```
金圈(含一圈内环:`position: 'absolute'`, `top/left/right/bottom: 2`, `borderRadius: size/2`,
`borderWidth: StyleSheet.hairlineWidth`, `borderColor: theme.gold`, `opacity: 0.5`)+ 中央 `<Star size={inner} />`。
"给空状态这类'没有具体图标'的位置用。不试图还原原来那个 emoji 的含义 —— 含义由旁边的标题与说明文字承担。"
`seal` / `medallion` 都是 `alignItems/justifyContent: 'center'`, `borderWidth: 1`。

**导入**:`expo-image`(Image)、`react-native`(StyleSheet, View, type ImageStyle/StyleProp/ViewStyle)、
`@/components/themed-text`、`@/hooks/use-theme`(useTheme, useThemeSkin)。

### `mascot.tsx` — `Mascot`(69 行)

```ts
const POSE_W = 229;   // 裁切后的原始尺寸,用来算宽高比
const POSE_H = 361;

const POSES = [
  require('@/assets/mascot/pose-00.png'),
  require('@/assets/mascot/pose-16.png'),
  require('@/assets/mascot/pose-32.png'),
  require('@/assets/mascot/pose-48.png'),
  require('@/assets/mascot/pose-64.png'),
  require('@/assets/mascot/pose-80.png'),
] as const;

export type MascotPose = 'walk-a' | 'walk-b' | 'walk-c' | 'walk-d' | 'walk-e' | 'walk-f';
const POSE_INDEX: Record<MascotPose, number> = {
  'walk-a': 0, 'walk-b': 1, 'walk-c': 2, 'walk-d': 3, 'walk-e': 4, 'walk-f': 5,
};

export function Mascot({ pose = 'walk-a', height = 110, style }: {
  pose?: MascotPose; height?: number; style?: StyleProp<ImageStyle>;
})
```
`if (!skin.mascot) return null;`
`const width = Math.round(height * (POSE_W / POSE_H));`(229/361 ≈ 0.6343,所以 110 → 70)
渲染 `<Image source={src} style={[{ width, height }, style]} contentFit="contain" transition={0} />`。
注释:"形象是插画,放大时不要糊 —— expo-image 默认双线性,这里显式声明高质量重采样"(通过 `transition={0}`)。

**素材来源(文件头)**:"姿势图是从启动屏那段行走动画里抠出来的 —— 原动画帧被合成在**不透明的品牌蓝**上,
所以之前只能在启动屏用,App 内部一次都用不到。`scripts/extract-mascot.ps1` 用
'边框环取背景色 + 距离分档求 alpha + 反预乘还原边缘'把它抠成了带透明通道的姿势图:
· 背景噪声实测为 0(14400 个背景像素通道差全为 0),所以没有雾化;
· 边缘反预乘解决了抠图常见的'蓝毛边';
· 六个姿势取自 96 帧行走循环的等距采样,裁切尺寸一致(229×361),便于对齐。"
"素材归项目自己(是用户提供的原始素材派生的),不涉及第三方版权。"

`pose` 用字符串而不是数字的理由:"调用点写 `<Mascot pose="study" />` 比写 `pose={2}` 可读得多,
而且以后换姿势不用去数数组下标。"(注:注释里的 `"study"` 只是示例,实际联合类型只有 `walk-a`…`walk-f`。)

**导入**:`expo-image`(Image)、`react-native`(type StyleProp, type ImageStyle)、`@/hooks/use-theme`(useThemeSkin)。

### `skeleton.tsx` — `SkeletonBlock` / `SkeletonList`(82 行)

```ts
export function SkeletonBlock({ width = '100%', height = 16, radius = 6, style }: {
  width?: number | `${number}%`; height?: number; radius?: number; style?: ViewStyle;
})
```
**两种效果叠在一起**(文件头):"整块**呼吸**(透明度 0.45↔0.9)—— 表示'这块在等数据';
一条**高光带从左扫到右**(见 `motion.tsx` 的 `Shimmer`)—— 表示'正在加载'。
只用呼吸会像'在闪烁',只用扫光在慢网络下会像'卡住了'。两者叠加才是加载态该有的样子。"
"注意:高光要能被裁掉,所以块必须 `overflow: 'hidden'`。"

```ts
const opacity = useMemo(() => new Animated.Value(0.5), []);   // 注释:React 规则禁止在渲染期读取 ref 当前值
useEffect(() => {
  const loop = Animated.loop(Animated.sequence([
    Animated.timing(opacity, { toValue: 0.92, duration: 780, useNativeDriver: true }),
    Animated.timing(opacity, { toValue: 0.5,  duration: 780, useNativeDriver: true }),
  ]));
  loop.start();
  return () => loop.stop();
}, [opacity]);
```
实际呼吸区间是 **0.5 ↔ 0.92**(文件头摘要写 0.45↔0.9,与代码略有出入)。
渲染 `Animated.View`(`width`, `height`, `borderRadius: radius`, `backgroundColor: theme.backgroundElement`,
`opacity`, `overflow: 'hidden'`)内含 `<Shimmer />`。

```ts
export function SkeletonList({ count = 3 }: { count?: number })
```
每张卡渲染三个 `SkeletonBlock`:`{ height: 13, width: '42%', radius: 3 }` /
`{ height: 10, width: '76%', radius: 3 }` / `{ height: 10, width: '58%', radius: 3 }`,
卡片 `backgroundColor: 'transparent'`, `gap: Spacing.two`, `marginBottom: Spacing.three`。
注释:"一张卡里放几行长短不一的条 —— 比一个等高灰块更像'内容正在来'"。

**导入**:`react`(useEffect, useMemo)、`react-native`(Animated, StyleSheet, View, type ViewStyle)、
`@/components/motion`(Shimmer)、`@/constants/theme`(Spacing)、`@/hooks/use-theme`(useTheme)。

### `animated-icon.tsx` — `AnimatedSplashOverlay`(206 行)

```ts
const MIN_SHOW_MS = 1300;   // 启动遮罩最短展示时长:原来没有下限,原生启动页一收起就淡出,只看到"闪一下"
const STAGE_SIZE = Math.min(Math.round(Dimensions.get('screen').width * 0.68), 280);
const WALK_ASPECT = 235 / 333;

export function AnimatedSplashOverlay({ ready = true }: { ready?: boolean })
```

**渲染结构**(`content`):
1. **幕布轨**:`styles.curtain`(`position: 'absolute'`, `left: 0`, `right: 0`, `height: 3`, `borderBottomWidth: 1`),
   `top: topInset`, `backgroundColor: theme.accent`, `borderBottomColor: theme.gold`
   —— 注释:"像剧院幕布上方的横梁"。
2. **舞台圆盘**:`width/height: STAGE_SIZE`,`borderRadius: STAGE_SIZE / 2`,`borderColor: theme.gold`,
   `backgroundColor: theme.accentSoft`,`overflow: 'hidden'`, `borderWidth: 1`,
   `alignItems/justifyContent: 'center'`;
   内部 `<Image source={require('@/assets/anim/walk-transparent.webp')}
   style={{ height: STAGE_SIZE * 0.82, width: STAGE_SIZE * 0.82 * WALK_ASPECT }} contentFit="contain" />`。
   注释:"底色取主题的 `accentSoft`(以前这里写死品牌蓝 —— 因为那时动画自带宽底;
   现在动画是透明的,圆盘只是一个设计元素,自然跟着主题走)。"
3. `ThemedText type="subtitle"` 的 `考研英语阅读`(`appName: { marginTop: Spacing.four }`)。
4. `loadingRow`(`flexDirection: 'row'`, `alignItems: 'center'`, `marginTop: Spacing.half`):
   `Text` "加载中"(`fontFamily: Fonts.sans`, `fontSize: 12`, `letterSpacing: 2.4`, `fontWeight: '500'`,
   `opacity: 0.92`, `color: theme.textSecondary`)+ `<LoadingDots color={theme.accent} />`。

`content: { alignItems: 'center', gap: Spacing.one }`。

**安全区**:用 `useContext(SafeAreaInsetsContext)` 而**不是** `useSafeAreaInsets()` ——
"后者在没有 `SafeAreaProvider` 时会**抛错**,而这个遮罩渲染在导航器**之外**
(`_layout.tsx` 里是 `<Stack>` 的兄弟节点),是否处在 Provider 之内取决于 expo-router 的内部实现 ——
不能赌。"读到就用,读不到退回 0(幕布轨贴到屏幕最上沿,也不难看)。

**隐藏逻辑**:
```ts
const canHide = ready && minElapsed;   // 两个条件都满足才淡出:启动数据就绪 + 已展示够时间

const splashKeyframe = new Keyframe({
  0:   { transform: [{ scale: 1 }], opacity: 1 },
  20:  { opacity: 1 },
  70:  { opacity: 0, easing: Easing.elastic(0.7) },
  100: { opacity: 0, transform: [{ scale: 1 }], easing: Easing.elastic(0.7) },
});
```
`canHide` 时渲染 `Animated.View`(`entering={splashKeyframe.duration(600).withCallback((finished) => { 'worklet'; if (finished) { scheduleOnRN(setVisible, false); } })}`);
否则渲染普通 `View`,其 `onLayout` 里调 `void SplashScreen.hideAsync()`。
`splashOverlay`:`StyleSheet.absoluteFill`, `alignItems/justifyContent: 'center'`, `zIndex: 1000`,
`backgroundColor: theme.background`。

**`LoadingDots` / `Dot`**:三个 `Dot`,delay 依次 `0 / 180 / 360`;
每个 `Dot` 用 `useSharedValue(0.25)` + `withDelay(delay, withRepeat(withTiming(1, { duration: 420, easing: Easing.inOut(Easing.ease) }), -1, true))`;
样式 `dot: { width: 4, height: 4, borderRadius: 2 }`,`dotsRow: { flexDirection: 'row', alignItems: 'center', marginLeft: 5, gap: 4 }`。
注释:"用 Reanimated 而不是 setInterval + setState:不触发 React 重渲染,也不会在遮罩卸载后残留定时器。"

**与原生启动屏的关系(文件头)**:"⚠️ 与它配套的**原生**启动屏(`app.json` 里 `expo-splash-screen`
的 `backgroundColor`)是构建期常量,**无法跟随运行时主题**,只能对齐到一套配色。"

**导入**:`expo-image`、`expo-splash-screen`(as SplashScreen)、`react`(useContext, useEffect, useState)、
`react-native`(Dimensions, StyleSheet, Text, View)、`react-native-reanimated`(Animated, Easing, Keyframe,
useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming)、`react-native-safe-area-context`(SafeAreaInsetsContext)、
`react-native-worklets`(scheduleOnRN)、`@/components/themed-text`、`@/constants/theme`(Fonts, Spacing)、`@/hooks/use-theme`。

### `animated-icon.web.tsx`(8 行)— Web 变体

```ts
/**
 * Web 端的启动遮罩替身。
 *   原生端有一个覆盖全屏的品牌启动动画(见 animated-icon.tsx),但 Web 上:
 *     · 没有原生启动页需要遮盖;
 *     · 那套动画素材是给移动端准备的,回落到 Web 上只会拖慢首屏。
 *   所以这里直接不渲染,保持行为与之前一致。
 */
export function AnimatedSplashOverlay() { return null; }
```
⚠️ 注意签名差异:Web 版**不接收 `ready` prop**(原生版是 `{ ready = true }: { ready?: boolean }`)。
由于返回 `null`,多余 prop 在 Web 上被静默忽略,不会报错。

---

## 2.6 导航

### `app-tabs.tsx` — `AppTabs`(原生,85 行)

```ts
import { NativeTabs } from 'expo-router/unstable-native-tabs';
declare const require: (path: string) => number;

const ICONS = {
  index:   { default: require('../../assets/tab-icons/today.png'),   selected: require('../../assets/tab-icons/today-active.png')  },
  library: { default: require('../../assets/tab-icons/library.png'), selected: require('../../assets/tab-icons/library-active.png') },
  words:   { default: require('../../assets/tab-icons/words.png'),   selected: require('../../assets/tab-icons/words-active.png')  },
  review:  { default: require('../../assets/tab-icons/review.png'),  selected: require('../../assets/tab-icons/review-active.png') },
  profile: { default: require('../../assets/tab-icons/profile.png'), selected: require('../../assets/tab-icons/profile-active.png') },
} as const;
```
**图标映射**(注释原文):"今日=today · 文章库=menu_book(打开的书) · 生词本=bookmark · 复习=refresh · 我的=person"。
**为什么用 PNG 资源而不是 `md` 图标名**:"expo-router 的 `md` 路径要在运行时用 expo-font
把字形渲染成图片(`unstable_getMaterialSymbolSourceAsync`),**实测在 Expo Go 里不显示**。
直接把字形渲染成 PNG 并用 `src` 引用,Expo Go 与独立安装版都稳定,且完全离线。
每套图标提供 default(未选中灰)/ selected(选中蓝)两张。"

```tsx
<NativeTabs
  backgroundColor={theme.background}
  iconColor={{ default: theme.textSecondary, selected: theme.accent }}
  /* 不要指示胶囊:原来 indicatorColor 用强调色,而选中图标/文字也是强调色,
     结果是"蓝底压蓝图标"→ 选中图标看不见。选中态靠颜色 + 加粗标签表达即可。 */
  disableIndicator
  /* 关掉 Android 的水波纹:圆形波纹会超出 tab 项高度被裁成"缺了顶部的圆",很丑;
     点击反馈改由选中态(图标/文字变蓝 + 加粗)表达 */
  rippleColor="transparent"
  labelVisibilityMode="labeled"
  labelStyle={{
    default:  { color: theme.textSecondary },
    selected: { color: theme.accent, fontWeight: '600' },
  }}>
```
**`labelVisibilityMode="labeled"` 的理由**(注释):"Android 的 Material 底部导航在 tab 数 ≥ 4 时,
`labelVisibilityMode` 默认 `auto` 只会给选中项显示文字、其它项只显示图标 ——
这正是之前'非选中标签看不见、但能点'的原因。"
5 个 `NativeTabs.Trigger`,name 与路由文件名一一对应:
`index`(今日)/ `library`(文章库)/ `words`(生词本)/ `review`(复习)/ `profile`(我的)。

⚠️ **`backgroundColor={theme.background}`** —— 而 `docs/theme-siracusa.md` 第 7 节的改造清单
曾计划改成 `backgroundElement` + 顶部 1px 金线 + label 加字距,该计划**未实装**。

**导入**:`expo-router/unstable-native-tabs`(NativeTabs)、`@/hooks/use-theme`。

### `app-tabs.web.tsx` — `AppTabs` / `TabButton` / `CustomTabList`(Web,95 行)

```ts
import { Tabs, TabList, TabTrigger, TabSlot, TabTriggerSlotProps, TabListProps } from 'expo-router/ui';
export default function AppTabs()
export function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps)
export function CustomTabList(props: TabListProps)
```
**结构**:`<Tabs>` → `<TabSlot style={{ height: '100%' }} />` → `<TabList asChild><CustomTabList>`
5 个 `<TabTrigger name=… href=… asChild><TabButton>…</TabButton></TabTrigger>`:
`today`→`/`、`library`→`/library`、`words`→`/words`、`review`→`/review`、`profile`→`/profile`。
(注:原生版第一个触发器的 name 是 `index`,Web 版是 `today` —— 文件头"配合 native 版保持 5 个同名路由"
的注释与代码在此处有出入,`today` 对应的 `href` 是 `/`。)

`TabButton`:`Pressable`(`pressed && { opacity: 0.7 }`)→
`ThemedView type={isFocused ? 'backgroundSelected' : 'backgroundElement'}`
(`paddingVertical: Spacing.one`, `paddingHorizontal: Spacing.three`, `borderRadius: Radii.card`)→
`ThemedText type="small" themeColor={isFocused ? 'text' : 'textSecondary'}`。

`CustomTabList`:`View`(`position: 'absolute'`, `width: '100%'`, `padding: Spacing.three`,
`justifyContent: 'center'`, `alignItems: 'center'`, `flexDirection: 'row'`)→
`ThemedView type="backgroundElement"`(`paddingVertical: Spacing.two`, `paddingHorizontal: Spacing.four`,
`borderRadius: Spacing.five` = 32, `flexDirection: 'row'`, `alignItems: 'center'`, `flexGrow: 1`,
`gap: Spacing.two`, `maxWidth: MaxContentWidth`)→
`ThemedText type="smallBold"` 的**品牌字"英语阅读"**(`marginRight: 'auto'`)+ children。

**导入**:`expo-router/ui`、`react-native`(Pressable, View, StyleSheet)、`./themed-text`、`./themed-view`、
`@/constants/theme`(Radii, MaxContentWidth, Spacing)。

---

## 2.7 表单与反馈

### `primary-button.tsx` — `PrimaryButton`(105 行)

```ts
const INSET = 3;   // 内嵌细线离按钮边的距离

export function PrimaryButton({ label, onPress, loading = false, disabled = false, style, variant = 'solid' }: {
  label: string; onPress: () => void; loading?: boolean; disabled?: boolean;
  style?: ViewStyle;
  variant?: 'solid' | 'outline';   // solid = 实心主操作;outline = 描边次操作(用在同一屏里有两个并列按钮时)
})
```
**触摸安全的注释**(文件头):"这里必须只用**一层** Pressable。曾经写成外层 Pressable 包内层 Pressable,
内层没有 onPress 但同样会抢走触摸响应,导致按钮'点不动'(要点很多次才偶尔生效)。
下面那圈内嵌细线是普通 View + `pointerEvents="none"`,不参与触摸,不会重蹈覆辙。"
"文字色用 `onAccentStrong`,保证浅色/深色下对比度都 ≥ 4.5(见 `scripts/audit-contrast.mjs`)。"

样式数组:`styles.button` + `isOutline && styles.outline` + 内联对象:
```ts
borderRadius: skin.radiusCard,
backgroundColor: isDisabled ? theme.backgroundSelected : isOutline ? 'transparent' : theme.accentStrong,
borderColor: isDisabled ? theme.border : theme.accent,
```
+ `pressed && !isDisabled && styles.pressed`(`opacity: 0.85`)+ 调用方 `style`。

内嵌细线(`skin.buttonInsetRule && !isDisabled` 才画):
`position: 'absolute'`, `top/left/right/bottom: INSET(3)`, `borderWidth: 1`, `opacity: 0.4`,
`borderColor: isOutline ? theme.accent : theme.onAccentStrong`, `borderRadius: skin.radiusCard`。

内容:`loading` 时 `<ActivityIndicator size="small" color={isOutline ? theme.accent : theme.onAccentStrong} />`,
否则 `ThemedText type="smallBold" themeColor={isOutline ? 'accent' : 'onAccentStrong'}`
(`label: { fontSize: 15, letterSpacing: 0.6 }`)。
`button: { minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.four }`;
`outline: { borderWidth: 1 }`(注释:"只加边框,宽度靠 borderWidth 与实心款对齐(避免两按钮高度差 1px)")。
按钮外层 `Pressable` 带 `hitSlop={6}`。

**导入**:`react-native`(ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle)、
themed-text、`@/constants/theme`(Spacing)、`@/hooks/use-theme`(useTheme, useThemeSkin)。

### `form-field.tsx` — `FormField`(124 行)

```ts
export function FormField({
  label, value, onChangeText, placeholder, secure = false, hint, error, editable = true,
  keyboardType, autoCapitalize, autoComplete, returnKeyType, maxLength, onSubmitEditing,
}: {
  label: string;
  value: string;
  onChangeText: (next: string) => void;
  placeholder?: string;
  secure?: boolean;          // 密码类输入:自动隐藏内容并显示「显示/隐藏」切换
  hint?: string;
  error?: string | null;
  editable?: boolean;
  keyboardType?: TextInputProps['keyboardType'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoComplete?: TextInputProps['autoComplete'];
  returnKeyType?: TextInputProps['returnKeyType'];
  maxLength?: number;
  onSubmitEditing?: () => void;
})
```
**渲染**:标签(`small textSecondary`, `lineHeight: 18`)→ `inputRow`(`flexDirection: 'row'`,
`alignItems: 'center'`, `gap: Spacing.two`)→ `TextInput` +
`secure` 时的显示/隐藏 `Pressable`(`hitSlop={10}`,`ThemedText type="small" themeColor="accent"` 显示 `隐藏`/`显示`)。
输入框内联样式:`borderRadius: skin.radiusCard`(**"与 PrimaryButton 用同一个控件圆角,视觉上成对"**),
`color: theme.text`, `backgroundColor: theme.background`, `borderColor: error ? danger : theme.border`;
`styles.input: { flex: 1, minHeight: 48, borderWidth: 1, paddingHorizontal: Spacing.three, fontSize: 15 }`。
`placeholderTextColor={theme.textSecondary}`, `autoCorrect={false}`, `autoCapitalize ?? 'none'`。
帮助/错误行:`error` 时用内联 `color: danger`,否则 `hint` 用 `textSecondary`
(`help: { lineHeight: 18, paddingHorizontal: Spacing.one }`)。
注释:"错误文字用主题的 danger 令牌,每套主题的深浅色都各自保证 ≥4.5 对比度"(原先写死 `#FF8A80` / `#C62828`)。
**导入**:`react`(useState)、`react-native`(Pressable, StyleSheet, TextInput, View, type TextInputProps)、
themed-text、`@/constants/theme`、`@/hooks/use-theme`。

### `status-note.tsx` — `StatusNote`(48 行)

```ts
export type StatusKind = 'info' | 'success' | 'error';
export function StatusNote({ kind = 'info', children }: { kind?: StatusKind; children: ReactNode })
```
颜色映射:
```ts
const color = kind === 'info' ? theme.textSecondary : kind === 'success' ? theme.success : theme.danger;
const background = kind === 'info' ? theme.backgroundElement : kind === 'success' ? theme.successSoft : theme.dangerSoft;
```
渲染 `View`(`backgroundColor: background`, `borderColor: theme.border`, `borderRadius: skin.radiusPanel`,
`borderWidth: StyleSheet.hairlineWidth`, `paddingHorizontal: Spacing.three`, `paddingVertical: Spacing.two`)
内含 `ThemedText type="small"`(`lineHeight: 20`, 内联 `color`)。
注释:"原来内置一份 `PALETTE` 写死的绿/红 —— 写死的话换主题时这块会掉队,
而且每套主题的深浅色都要各自调一遍。"
"保证'出错时说人话、颜色在深色模式下也读得清'。"
**导入**:`react`(type ReactNode)、`react-native`、themed-text、`@/constants/theme`(Spacing)、`@/hooks/use-theme`。

### `setting-row.tsx` — `SettingRow`(77 行)

```ts
export function SettingRow({ label, sublabel, value, right, onPress, last = false }: {
  label: string;
  sublabel?: string;
  value?: string;        // 右侧文字值(如 "每天 2 篇")
  right?: ReactNode;     // 自定义右侧(如开关、色块)
  onPress?: () => void;
  last?: boolean;        // 最后一行不画分隔线
})
```
`row`(`flexDirection: 'row'`, `alignItems: 'center'`, `justifyContent: 'space-between'`,
`gap: Spacing.three`, `paddingVertical: Spacing.three`, `minHeight: 52`),
非 `last` 时加 `borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border`。
`textCol`(`flex: 1`, `gap: 2`):`ThemedText type="small"` label + 可选 `sublabel`(`small textSecondary`, `lineHeight: 18`)。
右侧:优先 `right`,否则 `rightCol`(`gap: Spacing.two`)里 `value` + (`onPress` 时)`›`。
有 `onPress` 时外面包 `Pressable`(`pressed && { opacity: 0.7 }`),否则直接返回内容。
**导入**:`react`(type ReactNode)、`react-native`、themed-text、`@/constants/theme`、`@/hooks/use-theme`。

### `avatar.tsx` — `Avatar`(49 行)

```ts
export function Avatar({ source, size = 56 }: { source: string; size?: number })
```
`isImageAvatar(source)`(`@/domain/avatar`)判定是图片 URI(`file/content/http/data`)还是 emoji。
渲染 `View`(`width/height: size`, `borderRadius: size / 2`, `backgroundColor: theme.backgroundSelected`,
`borderColor: theme.border`, `borderWidth: StyleSheet.hairlineWidth`, `overflow: 'hidden'`)内含:
图片 → `<Image source={{ uri: source }} style={{ width: size, height: size }} contentFit="cover" transition={120} />`;
emoji → `ThemedText`(`fontSize: size * 0.5`, `lineHeight: size * 0.62`)。
文件头:"用主题色衬底 + 细描边,深浅色下都清晰。"
**导入**:`expo-image`、`react-native`、themed-text、`@/domain/avatar`(isImageAvatar)、`@/hooks/use-theme`。

### `chip.tsx` — `Chip` / `ChipRow`(50 行)

```ts
export function Chip({ children, style }: { children: string; style?: ViewStyle })
export function ChipRow({ items }: { items: string[] })
```
`Chip` = `ThemedView type="backgroundSelected" radius="chip"`(`paddingHorizontal: Spacing.two`,
`paddingVertical: Spacing.half`, `borderWidth: 1`, `borderColor: theme.border`)内含
`ThemedText type="smallBold" themeColor="textSecondary"`(12/16)。
注释:"小徽章:文章库 / 阅读页 里展示 CEFR 等级等标签。形状交给主题:默认主题是胶囊,叙拉古是方直角
(印刷品的标签语言)。"
`ChipRow` = `View`(`flexDirection: 'row'`, `flexWrap: 'wrap'`, `gap: Spacing.two`)map 出多个 `Chip`。
**导入**:`react-native`、themed-text、themed-view、`@/constants/theme`、`@/hooks/use-theme`。

### `empty-state.tsx` — `EmptyState`(101 行)

```ts
export function EmptyState({ emoji = '📭', title, description, actionLabel, onAction }: {
  emoji?: string; title: string; description?: string; actionLabel?: string; onAction?: () => void;
})
```
**三档回退**(注释原文:"优先级从'最像成品'到'最保底'"):
1. `skin.mascot` → `<Mascot height={132} style={styles.badgeGap} />`
2. `else skin.motifs` → `<Medallion size={64} style={styles.badgeGap} />`
3. 否则 → `ThemedView type="backgroundElement" radius="none"` 的圆底(`64×64`, `borderRadius: 32`,
   `alignItems/justifyContent: 'center'`, `marginBottom: Spacing.one`)+ emoji(`fontSize: 30`, `lineHeight: 38`)
   (`radius="none"` 是为了不让主题卡片圆角盖掉正圆)

然后 `ThemedText type="smallBold"` 标题(居中)+ 可选 `small textSecondary` 说明
(`lineHeight: 20`, `maxWidth: 280`, 居中)+ 可选按钮
(`Pressable` → `View` 带 `borderRadius: skin.radiusCard`, `backgroundColor: theme.accentStrong`,
`paddingHorizontal: Spacing.four`, `paddingVertical: Spacing.two + 2` = 10,
文字 `ThemedText type="smallBold" themeColor="onAccentStrong"`,`pressed: { opacity: 0.85 }`)。
`wrap`:`alignItems/justifyContent: 'center'`, `paddingVertical: Spacing.six`(64),
`paddingHorizontal: Spacing.four`, `gap: Spacing.two`。

文件头:"正常 App 不会给白屏 —— 一律给图标 + 一句解释 + 一个可点的下一步。"
"emoji 的含义是'话题提示',而空状态的含义本来就在标题与说明文字里,
所以这里不试图把 emoji 翻译成某个具体符号,直接换成语汇统一的纹样。"
⚠️ 注意这个按钮是**自绘的**,没有复用 `PrimaryButton`,所以**不会**有 `buttonInsetRule` 票券内嵌线。
**导入**:`react-native`、`@/components/mascot`、`@/components/ornaments`(Medallion)、themed-text、themed-view、
`@/constants/theme`、`@/hooks/use-theme`。

### `auth-shell.tsx` — `AuthShell`(110 行)

```ts
export function AuthShell({ title, subtitle, children, footer }: {
  title: string; subtitle?: string; children: ReactNode; footer?: ReactNode;   // footer:底部链接区(如"还没有账号?去注册")
})
```
文件头:"这三个页面(登录/注册/忘记密码)结构完全一致(返回栏 + 标题 + 表单 + 底部链接),
各写一份必然出现间距/字号不一致;统一在这里改。"

顶栏(`topBar`:`flexDirection: 'row'`, `alignItems: 'center'`, `paddingHorizontal: Spacing.three`,
`paddingBottom: Spacing.two`, `gap: Spacing.two`, `paddingTop: insets.top + Spacing.two`,
`borderBottomWidth: StyleSheet.hairlineWidth`, `borderBottomColor: theme.border`):
返回按钮(`Pressable onPress={() => router.back()} hitSlop={12}`;
`backBtn` 是 `36×36`, `borderRadius: 18`;字形 `‹` 用 `ThemedText themeColor="accent"`,
`fontSize: 34`, `lineHeight: 36`, `marginTop: -4`)+ 居中标题(`ThemedText type="smallBold"`)
+ 右侧占位 `View`(`width: 36`)。

主体:`KeyboardAvoidingView`(`behavior={Platform.OS === 'ios' ? 'padding' : undefined}`)
包 `ScrollView`(`keyboardShouldPersistTaps="always"`, `keyboardDismissMode="on-drag"`,
`contentContainerStyle: [styles.content, { paddingBottom: insets.bottom + Spacing.six }]`):
- 可选 subtitle(`small textSecondary`, `lineHeight: 20`)
- `<ThemedView type="backgroundElement" style={styles.card}>` —— `borderRadius: Radii.card`,
  `padding: Spacing.three`, `gap: Spacing.three`, `marginTop: Spacing.two` —— 装表单
- 可选 `footer`(`gap: Spacing.two`, `alignItems: 'center'`, `marginTop: Spacing.two`)
- 一段固定说明:"说明:账号只用于把学习数据同步到云端。不登录也能完整使用全部功能,
  数据一直存在这台手机上。"(`lineHeight: 20`, `paddingHorizontal: Spacing.one`, `marginTop: Spacing.two`)

`content`:`alignSelf: 'center'`, `width: '100%'`, `maxWidth: MaxContentWidth`,
`paddingHorizontal: Spacing.four`, `gap: Spacing.three`;`flex: { flex: 1 }`。
**导入**:`expo-router`(useRouter)、`react`(type ReactNode)、
`react-native`(KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View)、
`react-native-safe-area-context`(useSafeAreaInsets)、themed-text、themed-view、
`@/constants/theme`(Radii, MaxContentWidth, Spacing)、`@/hooks/use-theme`。

### `web-badge.tsx` — `WebBadge`(43 行,**未被引用**)

```ts
export function WebBadge()
```
用 `useColorScheme()`(**直接来自 `react-native`,不是项目的 `@/hooks/use-color-scheme`**)
决定用 `@/assets/images/expo-badge-white.png`(dark)还是 `@/assets/images/expo-badge.png`(light)。
渲染 `ThemedView`(`padding: Spacing.five`, `alignItems: 'center'`, `gap: Spacing.two`)内含
`ThemedText type="code" themeColor="textSecondary"` 的 `v{version}`
(`version` 从 `expo/package.json` 读,`textAlign: 'center'`)
+ `Image`(`width: 123`, `aspectRatio: 123 / 24`)。逐字保留的 Expo 模板组件。

---

## 2.8 未引用的遗留组件(4 个)

| 文件 | 说明 |
|---|---|
| `hint-row.tsx`(34 行) | Expo 模板遗留。`HintRow({ title = 'Try editing', hint = 'app/index.tsx' })`。渲染 `View`(`flexDirection: 'row'`, `justifyContent: 'space-between'`)内含 `ThemedText type="small"` + `ThemedView type="backgroundSelected" radius="panel"`(`paddingVertical: Spacing.half`, `paddingHorizontal: Spacing.two`)包的 `ThemedText themeColor="textSecondary"`。类型 `HintRowProps` **未导出**。 |
| `placeholder-screen.tsx`(120 行) | M0 占位主页。`PlaceholderScreen({ title, badge, description, moduleHint })`。平台化 padding(`Platform.select({ android, default, web })`),web 用 `paddingTop: Spacing.five / paddingBottom: Spacing.four`,原生用 `insets.top/left/right + insets.bottom + BottomTabInset + Spacing.two`。`badgeCircle` `96×96` `borderRadius: 48` `backgroundColor: theme.accentSoft`,内含 `ThemedText type="subtitle"` 的 `badge ?? '📘'`;`title` 覆盖 `fontSize: 36, lineHeight: 44`;`hintCard` 用 `Radii.card` + `padding: Spacing.four` + `marginTop: Spacing.four`。 |
| `external-link.tsx`(25 行) | Expo 模板遗留。`ExternalLink({ href, ...rest })` 包 `expo-router` 的 `Link`(`target="_blank"`),非 web 时(`process.env.EXPO_OS !== 'web'`)`event.preventDefault()` 并 `openBrowserAsync(href, { presentationStyle: WebBrowserPresentationStyle.AUTOMATIC })`。 |
| `ui/collapsible.tsx`(65 行) | 见 §2.2。**唯一使用 `expo-symbols` 的组件**。 |

---

## 2.9 平台特定(`.web.tsx`)变体汇总

| 原生 | Web | 为什么存在 |
|---|---|---|
| `animated-icon.tsx`(`AnimatedSplashOverlay({ ready })`,完整启动遮罩 + `walk-transparent.webp` + `LoadingDots`) | `animated-icon.web.tsx`(返回 `null`,**不接收 props**) | ① Web 没有原生启动页需要遮盖;② 那套动画素材是给移动端准备的,**回落到 Web 上只会拖慢首屏** |
| `app-tabs.tsx`(`NativeTabs` 来自 `expo-router/unstable-native-tabs`,5 个 PNG 图标 + `labelVisibilityMode`/`disableIndicator`/`rippleColor`) | `app-tabs.web.tsx`(`Tabs`/`TabList`/`TabTrigger`/`TabSlot` 来自 `expo-router/ui`,纯文字自绘胶囊 tab + 品牌字) | `NativeTabs` 只存在于原生;Web 用 `expo-router/ui` 的 headless Tabs 自绘 |
| `src/hooks/use-color-scheme.ts`(re-export RN) | `src/hooks/use-color-scheme.web.ts`(`useSyncExternalStore`) | 支持 `web.output: "static"` 的**静态渲染**:SSR 快照固定 `'light'`,避免 hydration 不匹配 |

---

## 2.10 `src/components/` 的依赖拓扑(谁导入谁)

```
themed-text  ← 被 21 个组件/页面导入(最广泛)
themed-view  ← 被 19 个组件/页面导入
constants/theme(Spacing / Radii / Fonts / MaxContentWidth / BottomTabInset) ← 所有组件
hooks/use-theme(useTheme / useThemeSkin / useResolvedScheme) ← 所有视觉组件

themed-text ──→ constants/typography(FONT_SLOTS, TYPE_STEPS, typeStyle, serifForWeight)
            └─→ constants/theme(ThemeColor)
themed-view ──→ constants/theme, hooks/use-theme
word-text   ──→ constants/fonts(SANS_FAMILY, SERIF_FAMILY), domain/wordmark(tokenize), hooks/use-theme
sentence-block ──→ word-text, themed-text, themed-view, domain/translate
heading-translate ──→ themed-text, themed-view, domain/translate
dict-card   ──→ themed-text, themed-view, domain/dictionary, hooks/use-word-saved
article-cover ──→ playbill-cover, domain/cover, hooks/use-theme, AsyncStorage
playbill-cover ──→ domain/cover-art(coverArtFor), themed-text
recommend-card ──→ article-cover, motion(PressScale), ornaments(Star), themed-text, themed-view
article-card ──→ article-cover, chip(ChipRow), themed-text, themed-view, domain/difficulty
latest-strip ──→ article-cover, themed-text, themed-view, domain/difficulty
learner-profile-card ──→ ornaments(Star), themed-text, themed-view, domain/profile
empty-state ──→ mascot, ornaments(Medallion), themed-text, themed-view
skeleton    ──→ motion(Shimmer)
motion      ──→ react-native-reanimated
ornaments   ──→ expo-image, themed-text, assets/art/star4.png
mascot      ──→ expo-image, assets/mascot/pose-*.png
animated-icon ──→ expo-image, expo-splash-screen, reanimated, safe-area-context, react-native-worklets
app-tabs    ──→ expo-router/unstable-native-tabs, assets/tab-icons/*
app-tabs.web ──→ expo-router/ui
```

---

## 2.11 组件层中残留的"非令牌"硬编码(设计系统的一致性缺口)

`docs/add-a-theme.md` 硬性约束 1 声明"组件里不许出现颜色字面量……代码应为 0 处"。
实际仍有以下**运行期颜色字面量**(不含注释):

| 文件 | 位置 | 值 |
|---|---|---|
| `dict-card.tsx` | `styles.backdrop` | `'rgba(0,0,0,0.3)'` |
| `dict-card.tsx` | `styles.card` 投影 | `shadowColor: '#000'` |
| `motion.tsx` | `Shimmer` 的 `experimental_backgroundImage` | `'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.55) 50%, rgba(255,255,255,0) 100%)'` |
| `animated-icon.tsx` | (无) | 已全部改用 `theme.*` —— 曾经的品牌蓝硬编码已清理 |

**非令牌的几何字面量**(圆角/尺寸写死,不走 skin):

| 文件 | 位置 | 值 |
|---|---|---|
| `dict-card.tsx` | `styles.card` | `borderRadius: Spacing.four`(=24) |
| `dict-card.tsx` | `styles.smallBtn` / `styles.flagBadge` | `Radii.card`(=3)/ `Radii.sharp`(=2) |
| `dict-card.tsx` | `styles.handle` | `borderRadius: 2` |
| `auth-shell.tsx` | `styles.backBtn` / `styles.card` | `borderRadius: 18` / `Radii.card` |
| `article-card.tsx` | `styles.card` | `borderRadius: Radii.card` |
| `latest-strip.tsx` | `styles.card` | `borderRadius: Radii.card` |
| `placeholder-screen.tsx` | `styles.hintCard` / `badgeCircle` | `Radii.card` / `borderRadius: 48` |
| `ui/collapsible.tsx` | `styles.button` / `styles.content` | `borderRadius: 12` / `Radii.card` |
| `article-cover.tsx` | `styles.hero` | `borderBottomLeftRadius/RightRadius: 20`(运行时被 skin 覆盖,仅静态兜底) |
| `skeleton.tsx` | `SkeletonBlock` 默认 `radius = 6` | —— |
| `empty-state.tsx` | `badgeCircle` | `borderRadius: 32`(正圆,`radius="none"`) |

> `Radii` 常量本身在 `theme.ts` 里已被标记为"**新代码不要再引用**",但这 **7 个文件**仍在用 ——
> 这是设计系统里**最明确的一处未清理债务**。

---

# PART 3 — 素材与美术管线

## 3.1 `assets/` 完整清单(含文件大小)

**`assets/art/`(装饰素材,由 `scripts/gen-art.ps1` 生成)**

| 文件 | 大小 | 说明 | 是否被 App 使用 |
|---|---|---|---|
| `star4.png` | 2.6 KB | 四角星(凹边),`256×256`,纯白 + alpha | ✅ `ornaments.tsx` |
| `starburst.png` | 6.9 KB | 爆炸星芒(16 尖),`256×256` | ❌ 未被 App 引用 |
| `bracket.png` | 0.3 KB | 角括号(L 形,末端斜切),`64×64` | ❌ 未被 App 引用 |
| `rule.png` | 0.8 KB | 分隔线饰(两端收细横线 + 中间小四角星),`480×48` | ❌ 未被 App 引用 |
| `halftone.png` | 0.2 KB | 半调网点,**可平铺**,`32×32` | ❌ 未被 App 引用 |
| `pinstripe.png` | 0.1 KB | 45° 斜细纹,**可平铺**,`16×16` | ❌ 未被 App 引用 |
| `grain.png` | 4.3 KB | 颗粒噪点,**可平铺**,`64×64` | ❌ 未被 App 引用 |
| `plate-a.png` | 46.9 KB | 封面版 A:丝绒 + 金色纹章,`720×440` | ❌ 未被 App 引用 |
| `plate-b.png` | **415.8 KB** | 封面版 B:深红 + 斜切条 + 星芒,`720×440` | ❌ 未被 App 引用 |

**`assets/anim/`**

| 文件 | 大小 | 说明 |
|---|---|---|
| `walk-transparent.webp` | **881.1 KB** | ✅ **当前使用**:带透明通道的角色行走动画,裁到 `235×333` |
| `walk-blue.webp` | 1,010.3 KB | 旧版:96 帧 `720×720`,角色合成在**不透明品牌蓝** RGB(30,137,237) 上 |
| `preview-zoom.png` | 123.7 KB | 人工核对用的放大预览 |

**`assets/mascot/`(`scripts/extract-mascot.ps1` 生成)**

| 文件 | 大小 | 对应帧 |
|---|---|---|
| `pose-00.png` | 96.9 KB | frame 0 |
| `pose-16.png` | 86.8 KB | frame 16 |
| `pose-32.png` | 97.4 KB | frame 32 |
| `pose-48.png` | 93.1 KB | frame 48 |
| `pose-64.png` | 86.8 KB | frame 64 |
| `pose-80.png` | 96.9 KB | frame 80 |

六张裁切尺寸一致 **229×361**,带透明通道。

**`assets/tab-icons/`(`scripts/gen-tab-icons.py` 生成)**

| 文件 | 大小 | 字形 |
|---|---|---|
| `today.png` / `today-active.png` | 0.8 KB each | `today` |
| `library.png` / `library-active.png` | 1.6 KB each | `menu_book` |
| `words.png` / `words-active.png` | 0.7 KB each | `bookmark` |
| `review.png` / `review-active.png` | 1.2 KB each | `refresh` |
| `profile.png` / `profile-active.png` | 1.1 KB each | `person` |
| `preview.html` | 1.7 KB | 人工核对页(浅底 + 深底各一行,左未选中/右选中) |

全部 `96×96`(= **24dp @4x**),PNG + alpha。
未选中色 `#8A8F98`(RGB 138,143,152),选中色 `#2F8FF0`(RGB 47,143,240)。

**`assets/images/`(`scripts/gen-icons.py` 生成 + Expo 模板遗留)**

| 文件 | 大小 | 说明 |
|---|---|---|
| `icon.png` | 258.0 KB | 1024²,白底 + 居中留边(标准图标) |
| `favicon.png` | 3.8 KB | 64² |
| `android-icon-foreground.png` | 252.1 KB | 1024²,透明底、深色图形(自适应前景) |
| `android-icon-background.png` | 5.2 KB | 1024²,纯色 `(230, 244, 254)` = `#E6F4FE` |
| `android-icon-monochrome.png` | 89.8 KB | 1024²,白色剪影 + 透明底(Android 13 主题图标) |
| `splash-icon.png` | 39.1 KB | 512²,白色图形 + 透明底 |
| `expo-badge.png` / `expo-badge-white.png` | 4.0 KB each | 仅 `web-badge.tsx` 用(**该组件未被引用**) |
| `expo-logo.png` / `logo-glow.png` / `react-logo{,@2x,@3x}.png` / `tutorial-web.png` | 3.2–323.9 KB | Expo 模板遗留 |
| `tabIcons/`(6 个:`explore`/`home` 各 `@1x/@2x/@3x`) | 0.2–0.5 KB | **Expo 模板遗留**,与 `assets/tab-icons/` 无关 |

**`assets/expo.icon/`**:iOS 图标(Expo SDK 54+ 的 `.icon` 格式)。
`icon.json` 0.8 KB、`Assets/grid.png` 52.4 KB、`Assets/expo-symbol 2.svg` 0.6 KB。
⚠️ 这仍是 **Expo 模板素材** —— `docs/theme-siracusa.md` 第 12 节记录
`assets/images/icon.png` 实测 **72% 是白色**,是模板遗留,"与叙拉古主题无关"。

**`assets/fonts/`**:只有一个 `README.md`(2.1 KB),**没有任何 .ttf**。
Literata 实际通过 npm 包 `@expo-google-fonts/literata` 加载,不走这个目录。
该 README 是一份"把字体放到这个目录然后告诉 AI"的操作手册,与 `src/constants/fonts.ts` 的实现
**有出入**:README 说三个字重(`Literata-Regular/SemiBold/Bold.ttf`),代码实际加载**四个**字重
(`400/500/600/700`);README 说文件放 `assets/fonts/`,实际走 npm 包。
README 里还有一段字体选型表(备选:Source Serif 4 / Spectral / EB Garamond / Newsreader,
全部 OFL 授权),以及"为什么不用中文字体"(10MB+ 包体,从 ~30MB 涨到 40MB+)。

> ⚠️ **任务描述中提到的 `assets/README.md` 与 `assets/images/README.md` 不存在** ——
> 全仓 `assets/` 下唯一的 README 是 `assets/fonts/README.md`。

## 3.2 `scripts/gen-art.ps1`(398 行)— 原创美术资源生成器

**文件头的动机**(整个纹样层的立项理由):

> 为什么要它:早先的"纹样"其实是**拿现成零件凑的** —— 四角星是字体里的 ✦ 字形,
> 括号是四条 border,封面是几个色块叠圆。**那不是美术,是拼装。**

**技术栈**:纯 PowerShell + `System.Drawing`(零外部依赖)。
`Add-Type -AssemblyName System.Drawing`;画布 `Format32bppArgb`;
渲染设置 `SmoothingMode.AntiAlias` / `CompositingQuality.HighQuality` /
`InterpolationMode.HighQualityBicubic` / `PixelOffsetMode.HighQuality`。

**关键能力**:
- `GraphicsPath` + `AddBezier` —— **真实曲线**(四角星的凹边、爆炸星芒、括号的斜切);
- `LinearGradientBrush` —— 渐变;
- `TextureBrush` + `WrapMode.Tile` —— 可平铺纹理;
- `CompositingMode.SourceCopy` + 透明多边形 —— 真正的"缺口/撕裂"边缘。

**核心函数**:
```powershell
$TAU = [Math]::PI * 2
function Deg([double]$d) { return $d * [Math]::PI / 180.0 }
function New-Canvas { param([int]$w, [int]$h) }        # 统一渲染设置 + Clear(Transparent)
function Save-Png { param($canvas, [string]$name) }    # 保存并打印 KB
function New-Brush { param([int]$a,[int]$r,[int]$g,[int]$b) }   # SolidBrush(alpha, r, g, b)
function New-Star4Path { param([double]$cx,[double]$cy,[double]$R,[double]$pull) }
    # 四角星:四个尖角在上下左右(270° + 90°*k),四条边用三次贝塞尔向内凹
    # 控制点 = (cx + pull*cos(mid), cy + pull*sin(mid)),mid = 270 + 90k + 45
function New-BurstPath { param([double]$cx,[double]$cy,[double]$outerR,[double]$innerR,[int]$spikes) }
    # 爆炸星芒:尖角与内凹点交替的多角形,像"火花"
```

**逐项产出规格**(精确参数):

| # | 输出 | 画布 | 关键参数 |
|---|---|---|---|
| 1 | `star4.png` | 256×256 | `New-Star4Path 128 128 118 56`(R=118, pull=56),纯白 `(255,255,255,255)` |
| 2 | `starburst.png` | 256×256 | `New-BurstPath 128 128 124 46 16`(outer 124, inner 46, **16 尖**),纯白 |
| 3 | `bracket.png` | 64×64 | 折线 `(6,44)→(6,6)→(44,6)→(44,12)→(12,12)→(12,44)` —— L 形,末端斜切,内角带一道小台阶 |
| 4 | `rule.png` | 480×48 | 中间星 `New-Star4Path 240 24 19 9`;两侧各两段线:`Pen(235,255,255,255, 1.7)` 从 `240±34` 到 `240±150`,再 `Pen(120,255,255,255, 1.0)` 到 `240±214`(三段拼出"由粗到细"的收尾) |
| 5 | `halftone.png` | 32×32 | 4 个圆 `(8,8) (24,8) (8,24) (24,24)`,半径 `2.2`(直径 4.4),`SolidBrush(210,255,255,255)` |
| 6 | `pinstripe.png` | 16×16 | `Pen([FromArgb(64,255,255,255)], 1.0)` 画 `(-16,-16)→(32,32)` —— 16×16 一个周期的 45° 细线。**alpha 只给 64**:"这是**纹理**,不是线 —— 满 alpha 铺上去会和画面打架" |
| 7 | `grain.png` | 64×64 | `Random(20260921)`(**固定种子**,可复现),逐像素 `$a = rnd.Next(0, 30)`,`if ($a -gt 4)` 才写入 `FromArgb($a, 255,255,255)` |
| 8 | `plate-a.png` | 720×440 | 见下 |
| 9 | `plate-b.png` | 720×440 | 见下 |
| 10 | `art-assets-contact-sheet.png` | `200×5 × 200×3` = 1000×600 | 总览图,深底 `(255,12,11,10)`,平铺类垫 `(255,30,28,34)` 底色,`Arial 9` 标注,写进 `docs/mockups/` |

**`plate-a.png`(丝绒 + 金色纹章)**:
1. 底:`LinearGradientBrush(rect, FromArgb(255,34,22,58), FromArgb(255,12,10,24), 60.0°)` —— 紫 → 近黑;
2. 左下 **3 条同心弧**:`Pen(245,226,176,104, 2.0)`,`r = 210 + i*26`,起点 `(30-r, H-40-r)`,直径 `2r`,角度从 `268°` 扫 `64°`;
3. 右上半调网点块:目标矩形 `(430, 20, 260, 180)`,`ColorMatrix.Matrix33 = 0.55`(压暗);
4. 中央金四角星:`SolidBrush(250,232,182,106)`,`New-Star4Path 360 206 122 58`;
5. 内金线框:`Pen(150,226,176,104, 1.0)`,`DrawRectangle(14, 14, W-28, H-28)`;
6. 四角括号:位置 `(8,8) (W-72,8) (W-72,H-72) (8,H-72)`,旋转 `0 / 90 / 180 / 270`(`TranslateTransform` + `RotateTransform` + `ResetTransform`);
7. **右下角撕口**:`CompositingMode.SourceCopy` + 透明多边形 `(W,330)→(W-92,H)→(W,H)` 挖掉一块,再恢复 `SourceOver`。

**`plate-b.png`(深红 + 斜切条 + 星芒)**:
1. 底:`LinearGradientBrush(rect, FromArgb(255,118,20,40), FromArgb(255,34,8,18), 110.0°)`;
2. **斜细纹只压下方三分之一**:`TextureBrush(pinstripe, Tile)` 填充 `(0, 244, W, 196)`。
   注释原文:"第一版铺满之后整个版面变成斜纹墙,和中间的斜切条互相打架 ——
   **纹理要用在'局部气氛'上,不能当成背景底色**";
3. 斜切黑条(平行四边形):`(70,176)→(W-40,176)→(W-78,268)→(32,268)`,`SolidBrush(235,8,6,12)`;
4. 斜条下的金色细线:`Pen(230,226,176,104, 2.0)`,`(32,272)→(W-78,272)`;
5. 左上星芒:`New-BurstPath 92 86 46 16 12`(12 尖),`SolidBrush(240,232,182,106)`;
6. 右下小四角星:`New-Star4Path (W-84) (H-78) 30 14`,`SolidBrush(235,238,208,150)`;
7. 颗粒:`TextureBrush(grain, Tile)` 铺满整幅;
8. 四角括号(奶白),位置 `(10,10) (W-74,10) (W-74,H-74) (10,H-74)`。

**设计约束(文件头)**:饰件一律是**纯白 + alpha 的遮罩**,运行时用 `tintColor` 上色,
所以同一张素材能跟着主题变色。
**IP 边界**:"只借参考里的**构图规律**(四角星、四角括号、斜切条、半调、金线框),
**不复制它的任何具体造型** —— 立绘、Logo、图标一律不做。"
**用法**:`& scripts/gen-art.ps1`(参数 `-OutDir`,默认 `E:\code\Eng\article-reading\assets\art`)。

## 3.3 `scripts/gen-icons.py`(72 行)— App 图标全套

```python
SRC = r'E:\code\Eng\素材\0376bc27c7a393a1294f3fd46d32b20b.jpg'
OUT = r'E:\code\Eng\article-reading\assets\images'
BG_COLOR = (230, 244, 254)     # 与 app.json 现有 adaptiveIcon.backgroundColor 一致
```
**技术栈**:Pillow + numpy("用 Pillow,不依赖外部工具")。

**流程**:
1. **找内容边界**:`diff = 255 - a.min(axis=2)`;`mask = diff > 18`;
   `ys, xs = np.where(mask)` 取 min/max。文件头记录源图内容边界 **782×791**(约 13.4% 非白像素);
2. **`square(img, pad_ratio=0.06, fill=(255,255,255))`** —— 内容贴成正方形,留白 6%:
   `side = int(max(w, h) * (1 + pad_ratio * 2))`,`paste` 居中;
3. `icon.png` = `square(art).resize((1024,1024), Image.LANCZOS)`;
   `favicon.png` = 同图 `resize((64,64), LANCZOS)`;
4. **自适应前景**:`lum = arr.mean(axis=2)`,`alpha = clip((255 - lum - 10) / (255 - 10), 0, 1)`
   —— **亮度作 alpha**,保留原色(暗部不透明,亮部透明),"并去掉极轻微的白噪";
   `dstack([arr, alpha * 255]).astype(np.uint8)` → RGBA `1024²`;
5. **自适应背景**:`Image.new('RGB', (1024,1024), BG_COLOR)`;
6. **单色图标**(Android 13 主题图标):`alpha_only = (alpha * 255).astype(np.uint8)`;
   `np.full_like(alpha_only, 255)` 填纯白 RGB + 同一 alpha;
7. **启动页图标**:同样白 + alpha,`resize((512,512))`。
   注释:"白色图形压在品牌蓝上(深色图形直接放蓝底会看不清)"。

**产出**(即 `app.json` 引用的**全部**文件):
`icon.png` / `favicon.png` / `android-icon-foreground.png` /
`android-icon-background.png` / `android-icon-monochrome.png` / `splash-icon.png`。

## 3.4 `scripts/gen-tab-icons.py`(108 行)— Tab 图标

```python
ROOT = Path(__file__).resolve().parent.parent
FONT = ROOT / "node_modules" / "@expo-google-fonts" / "material-symbols" / "400Regular" / "MaterialSymbols_400Regular.ttf"
OUT  = ROOT / "assets" / "tab-icons"
SIZE = 96                                 # 24dp @4x
COLOR_IDLE   = (138, 143, 152, 255)       # #8A8F98:浅色/深色背景都看得清
COLOR_ACTIVE = (47, 143, 240, 255)        # #2F8FF0:强调蓝

ICONS = { "today": "today", "library": "menu_book", "words": "bookmark",
          "review": "refresh", "profile": "person" }
```
**技术栈**:`fontTools.ttLib.TTFont` 读 cmap(`getBestCmap()`,按 `name → codepoint` 建索引,
用 `by_name.setdefault(name, cp)`)+ Pillow `ImageFont.truetype(str(FONT), int(size * 0.72))` 渲染字形
→ 用 `draw.textbbox((0,0), ch, font=font)` 量出包围盒并把字形**居中**
(`x = (size - (right - left)) / 2 - left`,`y = (size - (bottom - top)) / 2 - top`)。
每个字形渲染两遍(未选中灰 / 选中蓝),再生成 `preview.html`
(`.cell img { width: 48px; height: 48px }`,浅底 + 深底各一行)。

**存在理由(文件头)**:"expo-router 的 NativeTabs 在 Android 上支持 md 图标,但那条路径要在运行时
用 expo-font 把字形渲染成图片,**实测在 Expo Go 里不显示**。改为直接用字体取出字形,
生成 24dp 的 PNG 资源(2 套颜色:未选中/选中),用 `src` 引用 —— 稳定且离线。"
**用法**:`python scripts/gen-tab-icons.py`。

⚠️ **已知限制**(`docs/theme-siracusa.md` 第 13.8 节):只装了 Material Symbols 的 **400 静态字重**,
没有可变字体(`MaterialSymbols[FILL,GRAD,opsz,wght].ttf`),所以"线宽降到 1.5"这一项做不到,
P2 的 Tab 图标重绘**卡在设计决定上**(换成哪套字形),不是技术上。

⚠️ 另有一个**未上机验证**的点(第 7 节末尾):`app-tabs.tsx` 同时给了 `iconColor` 和预染色的
`-active.png` 资源 —— 深色模式下未选中图标显示成 `#B0B4BA`(主题值)而不是资源里的
`#8A8F98`,说明 **Android 的 Material 底部导航会用 `iconColor` 去 tint 这些 PNG**。
如果 tint 生效,选中图标会自动跟着主题变成金色;如果不生效,选中图标会仍是资源里的品牌蓝
而标签是金色。"**这条必须在真机上看一眼。**"

## 3.5 `scripts/gen-walk-anim{,2,3,4}.py` — 透明行走动画的四轮体积攻坚

这条管线有**四代脚本**,每一代记录一次失败。

### `gen-walk-anim.py`(57 行,第 1 代)
- 输入:`.artifacts/anim-frames/f*.png`(ffmpeg 逐帧导出的 PNG,**亮度已作 alpha**)
- 常量:`PAD = 16`,`FPS = 30`,`duration = int(1000/30)` = 33ms,`loop = 0`(无限循环)
- 第 1 步:求所有帧的**并集包围盒**(`alpha > 40` 的像素),再统一 `crop`。
  注释原文:"角色只占 720×720 画面的约 6%……走动时会左右摆,**不能按单帧裁**"
- 第 2 步:**质量扫描** `[(85,6), (78,6), (70,6), (62,6)]`,打印每个组合的 KB
- 第 3 步:以 `quality=78, method=6` 落盘
- 问题:`method=6` 对 96 帧要跑十几分钟

### `gen-walk-anim2.py`(64 行,第 2 代,快速版)
- 去掉质量扫描;改用 `method=4`(默认压缩)
- **两遍处理**:第一遍只求并集包围盒(不保留图像,省内存),
  第二遍**逐帧读入后立即裁切并保存为临时 PNG** 到 `.artifacts/anim-crops/c{NNNN}.png`
  —— 注释:"避免同时持有 96 张 720×720 的 RGBA(约 200MB)"
- 结果:**裁到 235×333(原像素的 15%)后体积仍有 2855 KB**

### `gen-walk-anim3.py`(54 行,第 3 代,体积/画质平衡)
- 扫描 **6 个组合**:`[(1.0,78), (1.0,60), (1.0,50), (0.8,60), (0.72,65), (0.72,55)]`(缩放 × quality)
- 选择策略:`if best is None or (kb <= 1200 and kb > best[0])` —— **在 ≤1200 KB 里挑最大的**(画质最好)
- 目标:压到 **1.2 MB 以内**

### `gen-walk-anim4.py`(85 行,第 4 代,终版,"透明动画的体积攻坚")
**关键发现(文件头)**:"Pillow 写动图 WebP 时 `quality` 基本不起作用(实测 **78→50 只从 2855→2644 KB**),
说明走了**无损**路径。alpha 又来自亮度渐变、软边多,无损压缩率极差。"

**三种策略对比**:

| 变体 | alpha 处理 | 编码 |
|---|---|---|
| A | 保留原 alpha | `lossless=False, quality=70`(看能否强制有损) |
| **B** | **二值化**(`np.where(alpha >= 110, 255, 0)`) | `lossless=False, quality=80` |
| **B2** | 二值化 | `lossless=True` |
| C | 量化 4 级(`(alpha // 85) * 85`) | `lossless=False, quality=80` |

**选择逻辑**:
```python
if kb_b2 <= 1000:  → 落盘 B2(无损二值 alpha)   # 注释:"通常同时做到体积小与边缘干净"
elif kb_b <= 1000: → 落盘 B(有损二值 alpha)
else:              → 落盘 C(四级量化 alpha)
```
**最终结果**:**881.1 KB**(即 `assets/anim/walk-transparent.webp`,通过 B2 路径)。

**为什么不能用 ffmpeg 直接转 WebP**(`animated-icon.tsx` 注释原文):
"动图 WebP 的帧间混合**不会擦除上一帧的透明区**,会出现'每一帧叠加'的鬼影
(旧版 `walk-white`/`walk-dark` 就是这么坏的:`walk-alpha-lossless.webp` 实测内容像素
从 **14582 单调涨到 19060**,而且 alpha 全 255 —— 并没有真透明)。
所以改用 **Pillow 逐帧完整写入**。"

**四步管线(完整)**:
1. 素材 `character.webm` 是「浅色角色 + 纯黑背景」的 **AV1 视频**,没有 alpha;
2. ffmpeg(Anaconda 的 `imageio_ffmpeg` 里带了一个)逐帧导出 PNG,用**亮度作 alpha**:
   `alphamerge` 把灰度通道并成透明度 —— 黑底自然全透明,角色边缘保留抗锯齿;
3. **不能用 ffmpeg 直接转 WebP**(原因见上),改用 Pillow 逐帧完整写入;
4. Pillow 的 `quality` 基本不起作用,**把 alpha 二值化**后从 2.8 MB 降到 881 KB。

**逐帧实测对比表**(`docs/theme-siracusa.md` 第 12.3 节):

| 文件 | 帧数 | 尺寸 | 内容 | alpha | 平坦底色 |
|---|---|---|---|---|---|
| `walk-blue.webp` | 96 | 720² | **有角色**(非底色像素 7.1%) | 全 255 | **RGB(30,137,237)** |
| `walk-white.webp` | 48 | 480² | **空白**(整帧最大偏差 0–3) | 全 255 | RGB(255,255,255) |
| `walk-dark.webp` | 48 | 480² | **空白**(最大偏差 10) | 全 255 | RGB(17,21,22) |
| `walk-alpha-lossless.webp` | 48 | 480² | 有角色(7–8.6%) | **全 255(并没有真透明)** | 黑 |

(`walk-transparent.webp` 是后续产物;仓库当前只保留 `walk-blue.webp`、`walk-transparent.webp`、
`preview-zoom.png` 三个 anim 文件。)逐帧实测的角色包围盒为 **x246–427 / y278–577**,
角色视觉中心比画布中心**低约 9.4%**。

## 3.6 `scripts/extract-mascot.ps1`(204 行)— 从启动屏动画抠出角色

**输入**:
```powershell
param(
  [string]$Src = "E:\code\Eng\article-reading\assets\anim\walk-blue.webp",
  [string]$OutDir = "E:\code\Eng\article-reading\assets\mascot",
  [int]$Poses = 6,
  [int]$T0 = 6,       # 距离阈值下界:纯背景
  [int]$T1 = 36       # 距离阈值上界:纯角色
)
```
**技术栈**:`PresentationCore`(WIC `BitmapDecoder` 逐帧解码 → `FormatConvertedBitmap` 到 `Bgra32`)
+ `System.Drawing`(输出 PNG)。

**算法(四步)**:
1. **从边框环取背景色**:采样 `y ∈ {1, 3, H-4, H-2}` 四行的所有 x,
   用**众数**(`Sort-Object Value -Descending | Select -First 1`)而非平均 ——
   注释:"避免被角色碰到边缘的少数像素带偏"。命中率打印为占边框环的百分比
   (`$W * 4` 个采样点)。**实测背景色 RGB(30,137,237) 在边框环上 100% 一致**;
2. **粗略找角色包围盒**:每 4 像素抽样一次,`d = max(|dR|, |dG|, |dB|)` 与 `T1` 比较;
   若找不到(`$maxX -lt 0`)打印"没找到角色(整帧都是背景色)"并 `exit 1`;
3. **取姿势帧**:`$step = [Math]::Floor($n / $Poses)`,`$chosen += (($p * $step) % $n)`
   —— 96 帧 / 6 姿势 → `step = 16` → 帧 **0, 16, 32, 48, 64, 80**(与文件名 `pose-XX.png` 完全对应);
4. **逐像素分三档处理**:
   ```
   d <= T0(6)              → alpha 0(纯背景)
   d >= T1(36)             → alpha 255(纯角色),颜色原样
   中间                    → alpha 按 d 线性映射,
                             并把颜色**反预乘**回真实色:X = C + (P - C) / alpha
   ```
   反预乘代码:`$rr = $bgR + ($pr - $bgR) / $a;`(其中 `$a = ($d - $T0) / ($T1 - $T0)`,
   alpha 取 `[int][Math]::Round($a * 255)`),最后对 R/G/B 做 `[0, 255]` 钳位。
   注释:"不做反预乘的话,边缘会留一圈蓝边,抠图常见的'蓝毛边'"。

**裁切边距**:`$padX = 26`,`$padTop = 30`,`$padBottom = 34` ——
"留出边距,并保证宽高一致,这样各姿势能对齐"。最终裁切尺寸 **229×361**。

**核对图**(第 4 步):`sheetW = cw * Poses`,`sheetH = ch * 2 + 46`,
三行背景:**深底 `(255,12,11,10)`**(叙拉古深色底)、**浅底 `(255,244,241,248)`**(叙拉古浅色纸)、
**绯红条 `(255,118,20,40)`** —— "方便看透明边缘有没有蓝毛边"。
输出到 `docs/mockups/mascot-poses.png`。
每个姿势还会打印"帧 N · 非背景像素 N · KB"。

**版权声明(文件头)**:"这是**用户自己的素材**,不涉及第三方版权。"
**用法**:`& scripts/extract-mascot.ps1`。

## 3.7 `scripts/analyze-reference.ps1`(238 行)— 参考图配色测量 v2

**用途**:从活动截图中**量出**配色,而不是猜。这是 `siracusa` 主题色值的唯一权威来源。

**v1 的两个问题(文件头)**:
1. 主色只报"量化桶中心"(如 `#221133`)—— 那不是真实像素值,只是 **4bit 桶的格点**;
2. "最高饱和色"按**单个像素**取,会被面积极小的杂色带偏(001 报出 `#462900` 就是个例子)。

**v2 的两条修正**:
- 主色按桶**累加真实 RGB 再求平均**,报出真实均值色;
- 强调色按**色相族**(每 15°)聚合,只统计 `S >= 0.30` 且 `V >= 0.20` 的像素,
  报每个色族的**面积加权均色 / 占全图比例 / 占饱和像素比例** ——
  "这才看得出'哪个颜色是活动的强调色',而不是哪个像素偶然最艳"。

**参数**:
```powershell
param(
  [string]$Dir = "E:\code\Eng\素材\揭幕者",
  [int]$Top = 12,
  [int]$MaxFiles = 12,
  [double]$SatMin = 0.30,
  [double]$ValMin = 0.20
)
```
**技术栈**:`PresentationCore` 的 WIC `BitmapDecoder`(自述"png/jpg/webp/gif 都能读")+ 自算 HSL。
**采样**:`$step` 递增直到 `(w/step) * (h/step) <= 500000`(上限 50 万像素)。
**暗部统计**:`lum = 0.2126*r + 0.7152*g + 0.0722*b < 64`。
**色相族**:`$hk = [Math]::Floor($hsl.h / 15)`,`if ($hk -ge 24) { $hk = 23 }`。
**产出**:每个文件打印尺寸/抽样数/暗部百分比 + 主色表(面积加权真实均值 hex + 百分比)
+ 强调色族表(色相范围 + 面积加权 hex + 占全图 + 占饱和),并为每张图输出色板 PNG
`{BaseName}-palette.png` 到 `palette-report/` 子目录(色板高 46px、每格 120px 宽、底色 `(11,10,9)`)。
最后打印**汇总**:所有图的饱和像素总占比 + 每个色族的全局占比
(过滤掉占饱和 < 1% 的族)。
**用法**:`& scripts/analyze-reference.ps1 -Dir "E:\path\to\refs"`。

**实测结果**:7 张图,饱和像素占抽样 **42.22%**,全部 7 张暗部占比 **48%–78%**
(详细数据见 §6.9)。

## 3.8 `scripts/analyze-structure.ps1`(225 行)— 参考图**结构量化**

**定位(文件头)**:"不需要视觉模型,从像素里量出界面的几何节奏。"

**能可靠量出来的**:
- 分隔线/边框的**粗细**(像素)以及占图宽的比例 —— 直接对应到 App 里该用几 dp;
- 水平/垂直分隔线的**位置分布** —— 反映布局网格与栏高;
- 正文带的**行高与行间距** —— 反映字号层级与排版节奏;
- 文字/线条的**笔画宽度**(游程中位数) —— 反映线重;
- 内容**留白边距**(上下左右占图比例);
- 高频能量(噪点/纹理的有无)。

**量不出来的(明确声明)**:"角标是什么形状、字体家族、装饰母题是什么 —— 那是语义,需要视觉模型或人。"

**参数**:`[string]$Dir = "E:\code\Eng\素材\揭幕者"`,`[int]$MaxFiles = 12`。

**算法**:
1. 灰度化:`gray = 0.2126*r + 0.7152*g + 0.0722*b`,分析分辨率压到长边 ≤ **900**
   (`$MaxDim = 900`,`$step` 递增直到 `max(w0,h0)/step <= 900`);
2. 全局阈值:取抽样像素的 **P50 / P70 / P90**;
3. **水平贯通线**:该行前景(`> P70`)占比 `> 55%` 的连续游程(`$rowInk[$y] -gt ($w * 0.55)`);
   **垂直贯通线**同理(`$colInk[$x] -gt ($h * 0.55)`);
4. **文字带**:行前景占比在 **3%–45%** 之间且连续长度 `>= 3` 的段;
5. **笔画宽度**:在文字带里找 `> P90` 的连续亮游程,取**中位数**(`Median $runs`),
   样本来自前 **40** 个带;
6. **内容边距**:前景像素(`rowInk/colInk > 1`)的最小/最大行列,换算成占图百分比;
7. **高频能量**:相邻像素差的均值(`|gray[x+1] - gray[x]|`,每 2 像素抽样),
   注释"噪点/纹理的粗略指标,越大越花"。

**输出**:每张图打印原图/分析尺寸与抽样步长、亮度分位(P50/P70/P90)、
水平/垂直贯通线数量与前 6 条(位置 + 占图比例 + 厚度 px)、文字带数量与前 10 段
(位置 + 高度 + 占高%)、笔画游程中位数(含样本数)、内容四边留白 %、高频能量。
**用法**:`& scripts/analyze-structure.ps1 -Dir "E:\code\Eng\素材\揭幕者"`。

**诚实声明(与第 14.6 节呼应)**:"补上这半需要二选一:**视觉模型恢复**,或**你给文字描述**。
`analyze-structure.ps1` 也能量一部分结构量(扫描线游程估描边粗细、边缘扫描估圆角),
但量不出'三段式斜切角标'这种形态语义。"

---

## 3.9 设计语言与美学总结

### 名称与叙事

**「叙拉古 · 揭幕者们」**。取材《明日方舟》SideStory「act38side」—— 新沃尔西尼狂欢节 / 叙拉古线。

**一句话方案**:"把 App 当成一场戏:**每一篇文章是一幕,"读完打卡"就是谢幕。**"

### 明暗对照(整个主题的骨架)

| | 浅色 · 节目单 | 深色 · 剧院夜场 |
|---|---|---|
| 隐喻 | 白天、印刷品、贴在墙上的海报 | 夜里、黑丝绒、一束聚光灯 |
| 现实取材 | 老海报/节目单的**铅字排版** | 剧院幕布与金线 |
| 底色 | 淡紫纸 `#F4F1F8`(衍生) | 近黑带紫 `#0B0912`(实测) |
| 卡片 | `#FFFFFF` + 淡紫细线 `#D5CFE4` | 紫灰 `#1A1725` + 冷紫线 `#2E2842` |
| 强调 | **靛紫** `#3A329B`(衍生) | **亮蓝紫** `#8F88F2`(实测最大色族) |
| 标注 | **品红** `#A8297A` | **品红** `#EC6BB6` |
| 装饰 | 金线 `#A8722E` | 金线 `#D8A05D`(实测暖金) |

其他现实取材(用于**自绘**图形,不用官方素材):西西里狂欢节的彩车与彩旗、
**commedia dell'arte 假面**、柠檬与马约利卡陶砖、剧院幕布与金线、老海报/节目单的铅字排版。

### 从"组件库默认样式"到设计语言的诊断

`docs/theme-siracusa.md` 第 1 节把问题定性为"**不是配色问题,是**没有设计语言**",
逐条对应代码:

| 症状 | 位置 | 说明 |
|---|---|---|
| 纯黑白 + 中性灰 | `theme.ts` | `#000000` / `#ffffff` / `#F0F0F3` —— "任何 App 都长这样",没有材质、没有温度 |
| 唯一品牌色是默认蓝 | `accent: #208AEF` | 一个孤立的蓝色令牌,不承载任何叙事 |
| 卡片 = 圆角灰矩形 | `Spacing.three = 16` 半径 | 就是 Cupertino/Material 默认卡片,层级全靠"灰一点/浅一点" |
| 字体没有声音 | 系统字体 | 全站没有一套字形层级,"标题"只是"更大的字" |
| 图标完全通用 | Material Symbols | 任何素材库都能生成的图标 |
| emoji 当图标用 | 🔥🎉💡✓👉 | "emoji 的渲染随系统而变,是'未完成品'最明显的信号" |
| 封面是随机真实照片 | `article-cover.tsx` | "**每次刷新都不同、与主题零关系,是最大的'素材拼凑感'来源**" |
| 启动屏是品牌蓝纯色 | `animated-icon.tsx` | 和 App 内视觉是两套东西 |
| 圆角到处都是 999 | 徽章、进度条、芯片 | "胶囊是'移动端默认审美',与印刷品/剧院的方直语言冲突" |

**结论原文**:"**换色只能解决 30%,剩下 70% 在形状、字体、图形、材质四层。**"

### 美学手段清单(已实装)

| 手法 | 实现 | 出处 |
|---|---|---|
| **四角星 ✦**(凹边,不是菱形) | `Star` 用 `assets/art/star4.png` + `tintColor`;取代 🔥 🎉 💡 🔁 👉 ◆ | `ornaments.tsx` |
| **四角金括号** | `ThemedView frame="playbill"` 的 `TICK = 9` 四个 L 形刻线,内缩 1px | `themed-view.tsx` |
| **节目单卡框** | `borderWidth: 1` + `borderColor: theme.border` + 四角金刻线 | `themed-view.tsx` |
| **票券内嵌细线** | 主按钮 `INSET = 3` 的 1px 内框,`opacity: 0.4` | `primary-button.tsx` |
| **幕布轨** | `CurtainBand` = 16 段交替透明度的强调色横带(高 3) + 1px 金线 | `ornaments.tsx` |
| **蜡封印章** | `Seal` = 金圈 + 强调衬底 + 中央符号 | `ornaments.tsx` |
| **勋章** | `Medallion` = 金圈 + `hairlineWidth` 内环(`opacity: 0.5`) + 中央星 | `ornaments.tsx` |
| **铭牌式标签** | `plateLabels: true` → `TYPE_STEPS.label`(10px / **letterSpacing 1.8** / 600) | `typography.ts` |
| **衬线正文** | Literata,`bodyLineHeight` 从 1.7 → **1.8** | `theme.ts` + `word-text.tsx` |
| **方直角** | `radiusCard: 3` / `radiusPanel: 2` / `radiusChip: 2`(替代 16 / 8 / 999) | `theme.ts` |
| **程序化节目单封面** | 10 色相锚点(实测色域弧)× 4 布局 × 4 徽记 × 3 边框 + FNV-1a 抖动 | `domain/cover-art.ts` |
| **App 形象** | `Mascot` 六姿势,从行走动画抠出的透明 PNG(229×361) | `mascot.tsx` |
| **"有重量"的动效** | 60ms 错开入场(≤6 档,340ms)、`scaleTo 0.975` 按压回弹、1500ms 循环扫光 | `motion.tsx` |
| **加载态双重表达** | 0.5↔0.92 呼吸(780ms×2) + 渐变扫光(固定 -160→760) | `skeleton.tsx` + `motion.tsx` |
| **剧场语气文案** | "已完成阅读,谢幕" / "连续 N 天" | `article/[id].tsx`、`(tabs)/index.tsx` |

### 明确**不做**的事(IP 边界与可读性红线)

- ❌ **不要用官方立绘、Logo、活动 UI 截图或方正字体**。"只借叙事、色彩关系与图形语法。这是 IP 边界。"
- ❌ **不要给阅读正文区加任何纹样**("装饰只允许出现在卡片外框、页边、页首。可读性永远优先")。
- ❌ **不要把主题做成"第三套深浅色"**(主题与深浅模式是两个正交偏好:`themeId` 决定用哪套配色,
  `theme` 决定用它的浅色还是深色)。
- ❌ **不要在 NativeTabs 上继续加自定义未选中指示器**(已记录"蓝底压蓝图标"和"圆角水波纹被裁"两个坑;
  它能改的只有 `backgroundColor` / `iconColor` / `labelStyle` / `disableIndicator`)。
- ❌ **不引入 `react-native-svg`**(全部纹样都用普通 `View` / `Image` 实现)。
- ❌ 封面**刻意不用渐变**(`experimental_backgroundImage` 在部分平台不生效,"而封面是最不该出岔子的地方")。

### 性能提醒(第 9 节)

"纸纹/聚光灯不要用多层绝对定位 View 叠,用 1 张可平铺 PNG 或 `expo-linear-gradient`;
深色模式下若用 `expo-glass-effect` 做词典卡,务必测 Android 低端机的降级表现。"
(`expo-glass-effect` `~57.0.1` 已在 `package.json` 依赖里,但当前代码**没有使用**。)

### 关于"真实性"的一段自我修正(最值得记住的工程习惯)

`docs/theme-siracusa.md` 第 14.1 节记录了用户的一次关键反馈与作者的自我修正:

> 用户指出:"主题的 UI 和配色与原游戏活动仍天差地别,可能只是做了一个近似的简化构造。"
> **这个判断是对的。** 前两轮的配色**不是从任何真实画面来的** —— 它是从几篇**文字**描述
> (现实原型:西西里/维亚雷焦狂欢节、commedia dell'arte 假面、剧院、家族)里自己推导出来的。
> 我从没看过活动的主界面、没看过主视觉、没从任何一张官方图里取过色。
> 所以那是"从叙事出发的再创作",不是对视觉语言的还原。

修正后:**配色改为像素实测**(`analyze-reference.ps1`);**形态仍然承认是编的**(第 14.6 节)。
这个"哪些部分是量出来的、哪些部分是编的"的诚实分层,是这份设计系统里最值得复制的做法。

---

# 附:本报告发现的不一致清单(供报告撰写时留意)

| # | 类型 | 位置 | 事实 |
|---|---|---|---|
| 1 | 文档 vs 代码 | `docs/add-a-theme.md:35` vs `theme.ts:23-60` | 文档写"18 个令牌",实际 **19 个** |
| 2 | 文档 vs 代码 | `docs/add-a-theme.md:62` vs `theme.ts:81-136` | 文档写"13 个字段"且表格**漏了 `mascot`**,实际 **14 个** |
| 3 | 文档 vs 代码 | `docs/theme-siracusa.md` §14.5 vs `theme.ts:322` | 文档文字写 `annotate #E0607A`,实际 **`#EC6BB6`** |
| 4 | 文档 vs 代码 | `docs/theme-siracusa.md:13.3` 说 12 个色相锚点 | `cover-art.ts:29` 实际 **10 个** |
| 5 | 文档 vs 代码 | `docs/theme-siracusa.md:12.3` 说 `app.json` 启动屏对齐叙拉古 (`#F5EFE2`/`#131010`) | `app.json:33-37` 实际是 **`#208AEF` / `#0B0F14`**(品牌蓝) |
| 6 | 文档 vs 代码 | `docs/add-a-theme.md:16` 写 `siracusa: siracusaTheme` | 实际变量名是 `siracusa` |
| 7 | 代码 vs 代码 | `motion.tsx:134` 注释"`experimental_backgroundImage` 项目里已经在用,见 `animated-icon.tsx`" | 全仓**只有 `motion.tsx` 一处**使用,`animated-icon.tsx` 已不用 |
| 8 | 代码 vs 代码 | `animated-icon.tsx` 接收 `{ ready }` | `animated-icon.web.tsx` **不接收任何 props** |
| 9 | 代码 vs 代码 | `app-tabs.tsx` 首个触发器 name 是 `index` | `app-tabs.web.tsx` 首个是 `today`(href `/`),与"保持 5 个同名路由"的注释有出入 |
| 10 | 代码内注释 | `skeleton.tsx` 文件头说呼吸区间 0.45↔0.9 | 代码实际是 **0.5 ↔ 0.92** |
| 11 | 冗余 | `Radii` 在 `theme.ts:444` 被标记"新代码不要再引用" | 仍有 **7 个文件**引用 |
| 12 | 未清理 | `docs/add-a-theme.md` 约束 1"代码应为 0 处颜色字面量" | 仍有 3 处运行期字面量(见 §2.11) |
| 13 | 未清理 | `assets/art/` 9 个素材由 `gen-art.ps1` 生成 | **只有 `star4.png` 被引用**,其余 8 个(含 415.8 KB 的 `plate-b.png`)未被 App 使用 |
| 14 | 缺失 | 任务提到 `assets/README.md` 与 `assets/images/README.md` | **两个文件都不存在**;唯一的 README 是 `assets/fonts/README.md` |
| 15 | 文档 vs 代码 | `assets/fonts/README.md` 说三个字重放 `assets/fonts/` | 代码加载 **四个**字重,走 npm 包 `@expo-google-fonts/literata` |
| 16 | 未引用组件 | 4 个 | `hint-row.tsx`、`placeholder-screen.tsx`、`web-badge.tsx`、`external-link.tsx`、`ui/collapsible.tsx`(共 5 个) |
| 17 | 未引用导出 | `ornaments.tsx` 的 `Seal` | 无任何调用点(打卡改用 `Star` 实现) |
| 18 | 未实装计划 | `docs/theme-siracusa.md` §7 改造清单 | `app-tabs.tsx` 的"`backgroundElement` + 顶部 1px 金线 + label 加字距"未做 |
