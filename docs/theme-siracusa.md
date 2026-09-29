# 主题规格：叙拉古 · 揭幕者们

> 目标：把「考研英语阅读」从"组件库默认样式"改造成有完整设计语言的成品。
> 主题取材《明日方舟》SideStory「揭幕者们」（act38side，新沃尔西尼狂欢节 / 叙拉古线）——
> 只借**叙事、色彩关系与图形语法**，不使用任何官方立绘、Logo 或字体。
> 视觉稿：`docs/mockups/siracusa-theme.html`（主题本身）、`docs/mockups/settings-page.html`（设置页与「我的」页）

---

## 实施状态

| 阶段 | 状态 | 说明 |
| --- | --- | --- |
| **主题系统**（注册表 + 可切换） | ✅ 已完成 | 见第 11 节 |
| **设置页**（含主题选择器）与「我的」瘦身 | ✅ 已完成 | 见第 11 节 |
| **P0 换色 + 令牌** | ✅ 已完成 | 19 个令牌；`annotate` 与 `accent` 解耦；硬编码色值全部收编 |
| **P1 字体 + 形状** | ✅ 已完成 | 见第 4 节与第 12 节；方直 + 细线 + 角刻线已铺到全站卡片/芯片/按钮 |
| **形态语言随主题切换**（`ThemeSkin`） | ✅ 已完成 | 见第 11.5 节。修掉"切回默认主题只换颜色、UI 没回原样"的回归 |
| **启动屏主题适配** | ✅ 已完成（含一处素材限制） | 见第 12 节 |
| **对比度审计** | ✅ 已完成 | 从"单主题 12 项"升级为"逐主题 80 项"，失败时非零退出 |
| **P2 图形层**（幕布条、印章、程序化封面、去 emoji） | ✅ 已完成 | 见第 13 节。样张：`docs/mockups/p2-motifs.html` |
| **P2 Tab 图标重绘** | ⬜ 未做（工具链已就绪） | 见第 13.5 节 —— 只差"换成哪套字形"这个设计决定 |
| **P3 App 图标 / 文案语气 / 动画素材重制** | ⬜ 未开始 | 见第 12 节末尾 |

> **两处已知的素材限制**（都不是代码问题，是素材本身）：
> 1. **角色动画没有透明通道**，底色是烤死的品牌蓝 —— 启动屏只能把它当"设计元素"处理；
> 2. **App 图标仍是 Expo 模板素材**（`assets/images/icon.png` 实测 72% 是白色，是模板遗留）。
> 两者的共同前提是**手上有可用的 ffmpeg / 原始素材**，见第 12 节末尾的清单。

---

## 0. 一句话方案

**明暗两套主题 = 揭幕前与揭幕后。**
浅色是「节目单」（羊皮纸 + 铅字 + 批注红），深色是「剧院夜场」（黑丝绒 + 聚光灯 + 金）。

三条铁律：

1. **金只做线，不做字。** 金色在浅色纸上的对比度只有 3.09，做正文/小字必然翻车。`gold` 令牌只允许出现在 1px 描边、分隔线、角刻线、进度轨道、菱形符号、印章。
2. **强调色与学习标注色拆开。** 现在 `theme.accent` 同时是品牌色、按钮底色和生词高亮色。主题化之后这三者必须解耦，否则正文会出现一片红点，像错题本。
3. **用"印刷品"取代"圆角灰卡"。** 去掉 `#F0F0F3` 灰块，卡片 = 纸 + 1px 暖褐线 + 直角 + 金角刻线。

---

## 1. 诊断：为什么现在"框架感重"

不是配色问题，是**没有设计语言**。逐条对应代码：

| 症状 | 位置 | 说明 |
| --- | --- | --- |
| 纯黑白 + 中性灰 | `src/constants/theme.ts` | 浅色 `#000000` / `#ffffff` / `#F0F0F3`。这是"任何 App 都长这样"的底色，没有材质、没有温度。 |
| 唯一品牌色是默认蓝 | 同上，`accent: #208AEF` | 一个孤立的蓝色令牌，不承载任何叙事。 |
| 卡片 = 圆角灰矩形 | `Spacing.three = 16` 半径，`backgroundElement` 灰底，无边框 | 就是 Cupertino/Material 默认卡片，层级全靠"灰一点/浅一点"。 |
| 字体没有声音 | `Fonts` 走 `Platform.select` 系统字体；`themed-text.tsx` 标题 48px/600 无衬线 | 全站没有一套字形层级，"标题"只是"更大的字"。 |
| 图标完全通用 | `scripts/gen-tab-icons.py` 从 Material Symbols 取字形 | 今日/文章库/生词本/复习/我的，是任何素材库都能生成的图标。 |
| emoji 当图标用 | `(tabs)/index.tsx` 🔥🎉 、`recommend-card.tsx` 💡✓ 、`empty-state.tsx` | emoji 的渲染随系统而变，是"未完成品"最明显的信号。 |
| 封面是随机真实照片 | `article-cover.tsx` 三级回退到 `picsum.photos` / Unsplash | 每次刷新都不同、与主题零关系，是**最大的"素材拼凑感"来源**。 |
| 启动屏是品牌蓝纯色 | `animated-icon.tsx`，`#208AEF` + `walk-blue.webp` | 和 App 内视觉是两套东西。 |
| 圆角到处都是 999 | 徽章、进度条、芯片一律 `borderRadius: 999` | 胶囊是"移动端默认审美"，与印刷品/剧院的方直语言冲突。 |

**结论**：换色只能解决 30%，剩下 70% 在**形状、字体、图形、材质**四层。

---

## 2. 主题概念

### 叙事
把 App 当成一场戏：**每一篇文章是一幕，"读完打卡"就是谢幕。**

现实取材（用于自绘图形，不用官方素材）：西西里狂欢节的彩车与彩旗、commedia dell'arte 假面、柠檬与马约利卡陶砖、剧院幕布与金线、老海报/节目单的铅字排版。

### 明暗对照（这是整个主题的骨架）

| | 浅色 · 节目单 | 深色 · 剧院夜场 |
| --- | --- | --- |
| 隐喻 | 白天、印刷品、贴在墙上的海报 | 夜里、黑丝绒、一束聚光灯 |
| 底色 | 羊皮纸 `#F5EFE2` | 近黑暖调 `#131010` |
| 卡片 | 更亮的纸 `#FFFCF4` + 暖褐细线 | 丝绒/木 `#201A17` + 暗金线 |
| 强调 | **批注红** `#7C1B2B`（= 老师红笔批注，语义自洽） | **聚光金** `#E4B45A` |
| 装饰 | 金线 `#A8823C` | 金线 `#C9A75A` |

**浅色用红、深色用金**，既满足对比度门槛，又正好复刻活动"扔下黑伞、戴上面具"的明暗对照。

---

## 3. 配色令牌（已实装：主题注册表）

`src/constants/theme.ts` 现在是一个**主题注册表**，不再是一套写死的 `Colors`：

```ts
export interface ThemePalette { /* 19 个令牌 */ }
export type ThemeColor = keyof ThemePalette;

export const Themes = {
  default: defaultTheme,   // 原有蓝白，观感保持不变 —— 也是"退回原样"的兜底
  siracusa,                // 叙拉古 · 揭幕者们
} as const satisfies Record<string, ThemePair>;

export type ThemeId = keyof typeof Themes;            // 由 Themes 推导：单一事实来源
export const THEME_IDS = Object.keys(Themes) as ThemeId[];
export const DEFAULT_THEME_ID: ThemeId = 'default';
export const THEME_META: Record<ThemeId, ThemeMeta> = { /* 名字 + 一句话说明 */ };

export function getPalette(themeId: ThemeId, scheme: 'light' | 'dark'): ThemePalette;
```

**为什么 id 从 `Themes` 推导、而不是手写一份列表**：手写列表的话，加主题时忘了登记，
设置页会静默少一个主题，而且不会有任何编译错误。现在唯一可能漏登记的是 `THEME_META` ——
它是 `Record<ThemeId, ThemeMeta>`，穷尽性检查会让漏写直接编译不过。

19 个令牌：`background` `backgroundElement` `backgroundSelected` `text` `textSecondary`
`accent` `accentStrong` `onAccentStrong` `accentSoft` `annotate` `annotateStrong` `annotateSoft`
`gold` `goldSoft` `border` `danger` `dangerSoft` `success` `successSoft`

具体色值见 `src/constants/theme.ts`（逐条带注释），这里只记分组意图：

| 令牌组 | 意图 |
| --- | --- |
| `background` / `backgroundElement` / `backgroundSelected` | 浅色是"纸 + 贴上去的纸"，深色是"夜 + 丝绒" |
| `accent*` | **UI 语义**：按钮、导航选中、进度条 |
| `annotate*` | **学习语义**：正文里的生词高亮。与 `accent` 解耦的理由见第 6 节 |
| `gold*` | 金属装饰线。**只做线不做字**（浅色底上只有 3.09） |
| `danger*` / `success*` | 收编自 `status-note.tsx` / `form-field.tsx` 里原本硬编码的深绿/深红 |
| `border` | 描边与分隔线 |

### 对比度校验结果

`scripts/audit-contrast.mjs` 已改为**遍历所有主题 × 浅色/深色**，有失败项时以非零码退出。
当前 **2 个主题 × 2 种深浅色 × 20 项 = 80 项组合全部通过**。

叙拉古主题的关键几项：

| 组合 | 浅色 | 深色 | 门槛 |
| --- | --- | --- | --- |
| 正文 / 页面背景 | 15.80 | 15.87 | ≥4.5 |
| 正文 / 卡片背景 | 17.66 | 14.41 | ≥4.5 |
| 次要文字 / 页面背景 | 5.77 | 8.26 | ≥4.5 |
| 强调色 / 页面背景 | 8.95 | 9.89 | ≥3.0 |
| 生词高亮 / 阅读正文底 | 8.95 | 9.89 | ≥4.5（按正文标准，不是 3.0） |
| 今日新学词 / 阅读正文底 | 11.67 | 12.56 | ≥4.5 |
| 错误色 / 错误衬底 | 5.95 | 6.74 | ≥4.5 |
| 成功色 / 成功衬底 | 5.93 | 7.92 | ≥4.5 |
| 按钮文字 / 按钮底色 | 10.52 | 8.52 | ≥4.5 |
| 金线（仅装饰）/ 页面背景 | 3.09 | 8.26 | ≥1.5 |

**金在浅色底上 3.09 说明它只能做线**——这就是铁律 1 的量化依据。

### 顺带修掉的一个既有问题

审计加严后立刻暴露：**默认主题的生词蓝 `#208AEF` 在白底上只有 3.53**，
低于正文标准的 4.5（原审计对强调色只要求 3.0，所以一直没被发现）。
已改为 `#1068CC`（同族蓝、对比度 5.42）。这是本次唯一一处对原有观感的改动。

`scripts/verify-theme.mjs` 另外校验注册表的运行时自洽：所有主题的令牌键集合完全一致、
令牌都是合法 hex、取色确实随主题与深浅色变化、
**存储里残留的未知主题 id 会退回默认主题而不是返回 `undefined`**（后者会把界面刷白）。

---

## 4. 字体与排版

这是"成品感"提升最大、成本最低的一项。

### 三个角色

| 角色 | 用途 | 实现 |
| --- | --- | --- |
| **衬线 Serif** | 英文正文、文章标题、统计数字 | 先用系统：iOS `ui-serif` / Android `serif`。若要精确控制，用 `expo-font` 内嵌 Source Serif 4 或 Literata（+ Noto Serif SC 子集），代价 +1–2MB 包体 |
| **无衬线 Sans** | UI 标签、按钮、芯片 | 保留系统无衬线，但**加字距 + 全大写**做出"铭牌感"：`fontSize: 10, letterSpacing: 2, textTransform: 'uppercase'` |
| **等宽 Mono** | 音标、词性 | 保留现状 |

英文阅读类产品用衬线正文是专业阅读器的标志，同时贴合"铅字印刷品"的隐喻——这一项改动就能让阅读页从"网页"变成"书"。

### 字号层级（替换 `themed-text.tsx` 的 8 个 type）

| type | size / lineHeight / weight | 字体 | 用途 |
| --- | --- | --- | --- |
| `title` | 30 / 38 / 600 | serif | 首次引导、欢迎页大标题 |
| `subtitle` | 22 / 30 / 600 | serif | 页面问候、板块标题 |
| `heading` | 17 / 25 / 600 | serif | 阅读页文章标题、卡片标题 |
| `body` | 16 / 26 / 400 | serif | 正文（阅读页另由 A−/A+ 控 16–28） |
| `label` | 10 / 14 / 600 + `letterSpacing: 2` | sans | 卡片小标题（"今日目标"）、日期、章节标签 |
| `caption` | 11 / 16 / 500 | sans | 元信息（时间、来源、提示） |
| `numeric` | 26 / 30 / 600 + `letterSpacing: .5` | serif | 统计数字（待复习 37、新学 12） |
| `code` | 12 / 16 | mono | 音标/词性 |

**顺手要修的硬编码**：`themed-text.tsx:66` 的 `linkPrimary` 用了写死的 `'#3c87f7'`，必须换成 `theme.accent`。

**数字改衬线**：`src/app/(tabs)/index.tsx` 的 `statNum` 现在是 `fontSize: 24 / fontWeight: '800'` 无衬线粗体——换成 serif + 600 + letterSpacing，单这一处就很"贵"。

---

## 5. 图形与材质

真正拉开差距的一层。全部可自绘，零版权风险。

| 元素 | 做法 | 用在 |
| --- | --- | --- |
| **幕布条** | 5px 高竖条纹理（红丝绒 `repeating-linear-gradient` 或 8 个 View 拼）+ 下方 1px 金线 | 阅读页顶部；`article/[id].tsx` 顶栏上方 |
| **菱形符号 ◆** | 5px 旋转 45° 的金色方块 | 取代 `recommend-card.tsx` 的 `💡`/`✓`、分隔符 `·`、列表项前导符 |
| **角刻线** | 卡片四角的 9px L 形金线（两个 absolute View，各带 `borderTop`/`borderLeft`） | 所有卡片；取代灰底圆角 |
| **蜡封印章** | 金圈 + 酒红底 + ✓ 的圆形 | 连续打卡徽章（`(tabs)/index.tsx` 的 `streakBadge`，现在是一个 emoji 🔥）；"已完成阅读"（`article/[id].tsx:309`） |
| **聚光灯** | 顶部径向暖金渐变（`expo-linear-gradient` 或 512×512 平铺 PNG），仅深色模式 | 深色页首，营造"舞台上有一束光" |
| **纸纹** | 极淡 1px 横线，`opacity ≤ .05` | 仅浅色页面底，**不可进入阅读正文区** |
| **抽象假面 / 彩旗串** | 几何自绘 SVG：假面 = 对称双眼弧 + 中央菱形；彩旗 = 三角旗串 | 空状态、评估完成、封面符号 |

> **依赖提醒**：项目当前**没有** `react-native-svg`。若走 SVG 路线需 `npx expo install react-native-svg`。
> 想零依赖，就把这些符号预渲染成 PNG 放进 `assets/ornaments/`（`scripts/gen-icons.py` 已经在做同类事情，可扩展）。

### 封面改造（优先级最高）

`article-cover.tsx` 现在三级回退到 `picsum.photos` / Unsplash 的**随机真实照片**——这是"最不像成品"的一处，而且带网络超时、墙、加载态三份复杂度。

改成**程序化生成的"节目单封面"**：

1. 用 `article.id` 哈希取色相 → 双色丝绒渐变底（深酒红 / 墨绿 / 藏蓝 / 赭石四选一）；
2. 内侧 1px 金线框；
3. 中央一个 24×24 的抽象假面或星形符号（金色）；
4. 底部一行小号大写拉丁字母：文章 topic 或 `ACT — <序号>`。

收益：完全离线、零版权风险、每篇不同但风格绝对统一、**顺手删掉三层网络回退和 6 秒超时逻辑**。
`ArticleCover` 的 `size: 'thumb' | 'banner' | 'hero'` 接口不用动，调用点零改动。

### Tab 图标

`scripts/gen-tab-icons.py` 现在从 Material Symbols 取字形。主题化 = 换字形集合并把线宽降到 1.5、形态更"雕版"一些；选中态 PNG 直接用 `accent` 色渲染。脚本已有，改字形名 + 重跑一次即可。

---

## 6. 两个关键决策（均已落地）

### 决策 1：品牌色与学习标注色拆开 ✅ 已实装

改造前：`word-text.tsx` 用 `theme.accent` 标生词，`recommend-card.tsx` 用 `accent` 做"刚好合适"，
`primary-button.tsx` 用 `accentStrong` 做按钮。
**也就是：品牌色 = 生词色 = 按钮色。**

主题化后浅色 `accent` 变成酒红 → 正文里一片红点，像错题本；而且将来想区分「已掌握 / 待复习 / 易混词」多色标注时没有位置了。

→ 已新增 `annotate` / `annotateStrong` / `annotateSoft`：`annotate` 只管正文标注，
`accent` 只管按钮与导航。`word-text.tsx` 已切到 `annotate` / `annotateStrong`。
两边现在可以独立演进。

### 决策 2：浅色强调色用酒红而不是金 ✅ 已实装

金在 `#F5EFE2` 上只有 3.09 —— 只够线条。所以"浅色红、深色金"。
这既是对比度决定的，也正好构成主题的明暗叙事。

---

## 7. 组件级改造清单

状态列：✅ 本次已完成 ／ ⬜ 属于 P1–P3，尚未开始。

| 文件 | 现状 → 目标 | 状态 |
| --- | --- | --- |
| `src/constants/theme.ts` | 写死的 12 令牌 `Colors` → 主题注册表 + 19 令牌 + `ThemeMeta` | ✅ |
| `src/storage/settings.ts` | 只有深浅模式 → 增加 `themeId` 持久化与未知值兜底 | ✅ |
| `src/hooks/use-theme-pref.ts` | 新增：主题 + 深浅模式共用一个订阅与水化 | ✅ |
| `src/hooks/use-theme.ts` | `Colors[scheme]` → `getPalette(themeId, scheme)`，另加 `useThemeMeta()` | ✅ |
| `src/hooks/use-theme-mode.ts` | 已删除，被 `use-theme-pref.ts` 取代（3 处引用同步更新） | ✅ |
| `src/app/settings.tsx` | 新增设置页：外观 / 学习 / 内容 / 数据 / 关于 | ✅ |
| `src/app/(tabs)/profile.tsx` | 一页塞满设置 → 只留"关于我"，其余搬到设置页 | ✅ |
| `src/app/_layout.tsx` | `Colors.dark.background` 写死；只水化深浅模式 | ✅ |
| `src/components/word-text.tsx` | 生词用 `accent` → 改用 `annotate` / `annotateStrong` | ✅ |
| `src/components/status-note.tsx` | 内置一份 `PALETTE` 写死绿/红 → 改用主题令牌 | ✅ |
| `src/components/form-field.tsx` | 写死 `#FF8A80` / `#C62828` → `theme.danger` | ✅ |
| `src/components/learner-profile-card.tsx` | 内置 `TRAIT_COLORS` → `theme.success` / `danger` / `textSecondary` | ✅ |
| `src/components/themed-text.tsx` | `linkPrimary` 写死 `#3c87f7` → 默认取 `theme.accent` | ✅ |
| `src/components/article-cover.tsx` | `theme.background === '#ffffff'` 当深浅色探针（真 bug）→ `useResolvedScheme()` | ✅ |
| `src/app/article/[id].tsx` | 图例写死"蓝=生词" → 用当前主题的标注色渲染图例 | ✅ |
| `src/components/themed-text.tsx` | 8 个 type / 全系统字体 | 第 4 节的层级 + 衬线正文 | ⬜ P1 |
| `src/components/themed-view.tsx` | 只有 `type?: ThemeColor` | 新增 `frame?: 'plain' \| 'playbill'`（1px 线 + 角刻线） | ⬜ P1 |
| `src/components/primary-button.tsx` | `borderRadius: 16` 圆角实心块 | 直角 2px + 内嵌细线（票券感） | ⬜ P1 |
| `src/components/app-tabs.tsx` | 背景 `theme.background` | `backgroundElement` + 顶部 1px 金线 + label 加字距 | ⬜ P1 |
| `src/components/article-cover.tsx` | 3 层网络回退 → 随机照片 | 程序化节目单封面（第 5 节） | ⬜ P2 |
| `src/components/chip.tsx` / `recommend-card.tsx` | 胶囊 + emoji | 直角 1px + 金描边；emoji → 金菱形 | ⬜ P2 |
| `src/components/empty-state.tsx` | emoji 大图标 | 抽象假面 / 彩旗 + 剧场语气文案 | ⬜ P2 |
| `src/components/animated-icon.tsx` | 品牌蓝纯色 + `walk-blue.webp` | 主题化启动屏（需重新生成动画素材） | ⬜ P3 |
| `src/app/(tabs)/index.tsx` | 灰卡 + emoji + 无衬线粗数字 | 节目单框卡片；统计数字改衬线；streak 改蜡封印章 | ⬜ P1/P2 |
| `scripts/gen-tab-icons.py` / `gen-icons.py` | Material Symbols 字形 | 换字形集合，线宽 1.5 | ⬜ P2 |
| `app.json` + `assets/images/icon.png` | Expo 默认 React logo 系列 | 换成主题图标与启动屏配色 | ⬜ P3 |

> **Tab 图标有个待上机验证的点**：`app-tabs.tsx` 同时给了 `iconColor` 和预染色的 `-active.png`
> 资源。既然深色模式下未选中图标要显示成 `#B0B4BA` 而不是资源里的灰，说明
> Android 的 Material 底部导航**会**用 `iconColor` 去 tint 这些 PNG。
> 如果是这样，选中图标会自动跟着主题变成金色；但如果 tint 没生效，
> 选中图标会仍是资源里的品牌蓝、而标签是金色。**这条必须在真机上看一眼。**

---

## 8. 落地路线

| 阶段 | 状态 | 内容 | 验收 |
| --- | --- | --- | --- |
| **主题系统 + 设置页** | ✅ 完成 | 主题注册表；`themeId` 持久化；`use-theme-pref` 统一水化与订阅；新增 `/settings`；「我的」瘦身 | `tsc --noEmit`、`expo lint`、`audit-contrast`、`verify-theme` 全绿 |
| **P0 换色 + 令牌** | ✅ 完成 | 19 令牌；`annotate` 与 `accent` 解耦；审计扩到逐主题 80 项；`linkPrimary` 去硬编码；硬编码色值全部收编 | 同上 + 浅/深截图；**零布局风险** |
| **P1 字体 + 形状** | ⬜ 未开始 | 字号层级重写；卡片改直角 + 1px 线 + 角刻线；按钮去胶囊；统计数字改衬线 | 首页 / 阅读页 before-after 截图对比 |
| **P2 图形层** | ⬜ 未开始 | 幕布条、菱形符号、蜡封印章、Tab 图标重绘、**程序化封面** | 飞行模式下封面/图标全部正常；全 App 无 emoji 残留 |
| **P3 收尾** | ⬜ 未开始 | Splash + App 图标 + `app.json`；空状态/错误态文案统一为剧场语气 | 冷启动全程截图；文案通读一遍 |

**P0 做完用户感知到的是"换了个 App"，P2 做完别人才会觉得"这是个成品"。**

---

## 9. 别做的事 / 风险

- ❌ **不要用官方立绘、Logo、活动 UI 截图或方正字体**。只借叙事、色彩关系与图形语法。这是 IP 边界。
- ❌ **不要给阅读正文区加任何纹样**。装饰只允许出现在卡片外框、页边、页首。可读性永远优先。
- ❌ **不要把主题做成"第三套深浅色"**。主题（配色方案）与深浅模式是两个正交偏好：
  `themeId` 决定用哪套配色，`theme` 决定用它的浅色还是深色。用户设置里仍是
  跟随系统/浅色/深色（`use-theme-pref.ts`），加主题不需要动这块。
- ❌ **不要在 NativeTabs 上继续加自定义未选中指示器**。`app-tabs.tsx` 已经记录过"蓝底压蓝图标"和"圆角水波纹被裁"两个坑；它能改的只有 `backgroundColor` / `iconColor` / `labelStyle` / `disableIndicator`。想要更自由的 Tab 栏必须换成自绘 Tab（成本高，建议不做）。
- ⚠️ **性能**：纸纹/聚光灯不要用多层绝对定位 View 叠，用 1 张可平铺 PNG 或 `expo-linear-gradient`；深色模式下若用 `expo-glass-effect` 做词典卡，务必测 Android 低端机的降级表现。
- ⚠️ **窗口背景色已跟随主题**（`src/app/_layout.tsx` 的 `SystemUI.setBackgroundColorAsync(palette.background)`，依赖是 `palette.background` 而不是 `isDark`，所以换主题时也会重设）。Android 导航栏与小窗背景仍需上机确认。
- ⚠️ **`article-cover.tsx` 的深浅色探针 bug 已修**（`theme.background === '#ffffff'` → `useResolvedScheme() === 'light'`）。
  这类"拿某个颜色值反推状态"的写法要留神：**换主题后它会静默失效，而且不报错。**
- ⚠️ **首帧配色**：`hydrateThemePrefs()` 在启动 effect 里 await，所以第一帧一定是默认主题。
  目前启动遮罩盖住了整个界面，用户看不到这一帧；但如果以后把遮罩去掉或变透明，
  选叙拉古的用户会看到一帧默认配色再跳变。届时要改成"水化完成前不渲染内容"。

---

## 10. 验收标准

- [x] `node scripts/audit-contrast.mjs` 0 项不达标（2 主题 × 2 深浅色 × 20 项 = 80 项）
- [x] `node scripts/verify-theme.mjs` 注册表自洽、未知主题 id 兜底
- [x] `npx tsc --noEmit` 与 `npx expo lint` 干净
- [x] `scripts/verify-profile.mjs` / `verify-difficulty.mjs` 等既有校验脚本仍通过
- [x] 除 `constants/theme.ts`、启动屏舞台底色、`app.json` 原生启动屏外，`src/` 无硬编码色值
- [x] P1：全站卡片/芯片/按钮的圆角统一到 `Radii`，无 `999` 胶囊残留（真圆除外）
- [x] P1：阅读正文改为衬线，行高 1.8
- [x] **切回默认主题后 UI 完整回到原样**：字体 sans、行高 1.7、卡片 16 圆角、芯片胶囊、无描边金刻线、按钮无内嵌细线、emoji 与照片封面照旧 —— 由 `scripts/verify-theme.mjs` 断言
- [x] P2：纹样（幕布轨/菱形/印章/勋章/节目单封面）全部由 `skin.motifs` 把关，默认主题零装饰
- [x] P2：叙拉古主题下封面走程序化生成，不发起任何网络请求
- [ ] **真机验证**：切换主题后 Tab 选中图标是否为金色（见第 7 节末尾）
- [ ] **真机验证**：冷启动时窗口底色、状态栏、启动遮罩到首屏的过渡
- [ ] **真机验证**：衬线体在 Android 上是否落到 Noto Serif（而不是回退成无衬线）
- [ ] **真机验证**：`CurtainBand` 的 16 段交替色块在窄屏上会不会出现摩尔纹
- [ ] 叙拉古主题下首页/文章库首屏不出现任何 emoji（已改，待上机确认）
- [ ] 浅色 / 深色 × 5 个主页面截图（今日 / 文章库 / 生词本 / 复习 / 阅读）人工过一遍
- [ ] 阅读页 19px 衬线正文在 320dp 宽、A+ 到 28px 时不裁切、无横向滚动
- [ ] **飞行模式冷启动**：叙拉古主题下封面与启动屏全部正常（程序化封面已不依赖网络）

---

## 11. 主题系统与页面信息架构（本次实装）

### 11.1 数据流

```
storage/settings.ts            AsyncStorage
  theme:   'system'|'light'|'dark'      ──┐
  themeId: 'default'|'siracusa'         ──┤
                                          │  hydrateThemePrefs()  启动时一次
                                          ▼
hooks/use-theme-pref.ts        模块级状态 + 订阅者集合(与 domain/auth/store 同一套路)
  useThemeMode() / useThemeId()          │
  setThemeMode() / setThemeId()          │  写入存储 + 立即 emit
                                          ▼
hooks/use-theme.ts
  useResolvedScheme()  → 'light' | 'dark'      (mode 优先,否则看系统)
  useTheme()           → getPalette(themeId, scheme)
  useThemeMeta()       → 当前主题的名字与说明
                                          │
                                          ▼
constants/theme.ts             Themes[themeId][scheme] → ThemePalette
```

**为什么把主题与深浅模式放进同一个模块**：它们一起决定最终配色，共享一次水化与一份订阅者列表。
分成两个模块会出现"主题已水化、模式还没水化"的中间态，首帧会用错配色。

**为什么用模块级单例 + 订阅而不是 Context**：项目里 `domain/auth/store.ts`、
`domain/corpus/status.ts` 已经是这个套路，保持一致；也避免为了换主题把整棵树包一遍 Provider。
组件侧 `useThemeMode()` / `useThemeId()` 各用一个 `useReducer` 强刷，订阅的是同一份 listener 集合。

### 11.2 加一个新主题需要改什么

1. 在 `constants/theme.ts` 里按 `ThemePair` 写 `light` / `dark` 两套（19 个令牌，**少一个编译不过**）；
2. 加进 `Themes`；
3. 在 `THEME_META` 里补 `name` / `tagline`（**漏写编译不过**）。

`THEME_IDS` 由 `Object.keys(Themes)` 推导，设置页的预览卡也是 `THEME_IDS.map(...)` ——
所以不需要改任何 UI 代码，新主题会自动出现在设置页里。

### 11.3 信息架构：「我的」与「设置」的划分

| 页面 | 承载 | 内容 |
| --- | --- | --- |
| **我的** `/profile` | 关于**"我"** | 个人卡（头像 / 昵称 / 水平 / 连续打卡 / 累计读完 / 生词本）、学习画像（含量化数据与评估入口）、入口行（账号与同步、设置） |
| **设置** `/settings` | 关于**"App 怎么表现"** | 外观（主题、深浅模式）、学习（每日目标、推荐匹配口径）、内容（每日语料、测试语料源）、数据（导出生词本、清空生词本）、关于（当前主题、版本 + 隐藏开发者入口、词典来源、开源仓库） |

改造前两者混在一页：找一个开关要在一屏个人信息里翻。划分原则是
**"这件事是关于我还是关于 App"**，不是"这个控件长得像不像设置项"。

### 11.4 主题选择器的做法

设置页的主题预览卡**用它自己那套配色渲染**（`getPalette(id, scheme)`），而不是当前主题的配色。
用户还没点下去就能看到这个主题长什么样，不用来回切着试。
卡片内容是缩微的一屏：卡片底 + 标题条 + 正文条 + 强调点 + 标注条 + 金线，
下面一行 5 个色板方块（`background` / `backgroundElement` / `accent` / `annotate` / `gold`）。

**顺带的一个好处**：预览卡渲染的是目标主题在**当前深浅模式**下的配色。
所以"跟随系统"的用户切到深色的那一刻，两张预览卡会一起变成各自的深色版本 ——
一眼就能看出两套主题的深色取向完全不同（默认是中性黑，叙拉古是暖黑 + 金）。

### 11.5 形态语言：`ThemeSkin`（一次真实回归的产物）

**问题**：P1 曾经把"衬线 + 方直角 + 金刻线"当成**全局改版**无条件写进了组件里。
后果是切回默认主题**只换了颜色，UI 没回到原来的样子** —— 衬线、方直角、角刻线全都留着。
对用户来说，那不叫"两套主题"，叫"一套主题加一个调色板开关"。

**修法**：一套主题 = **颜色 + 几何 + 字形**。新增 `ThemeSkin`，与 `ThemePalette` 并列挂在
`ThemePair` 上：

```ts
export interface ThemePair {
  light: ThemePalette;
  dark: ThemePalette;
  skin: ThemeSkin;      // 几何 + 字形
}

export interface ThemeSkin {
  displayFont: 'serif' | 'sans';   // 页面标题、卡片标题、文章标题
  bodyFont: 'serif' | 'sans';      // 阅读正文
  bodyLineHeight: number;          // 正文行高倍数
  radiusCard: number;              // 卡片 / 列表 / 按钮 / 输入框
  radiusPanel: number;             // 次级面板(提示条、译文块)
  radiusChip: number;              // 芯片 / 徽章 / 进度条
  cardFrame: boolean;              // 画不画"节目单"描边 + 金刻线
  buttonInsetRule: boolean;        // 主按钮画不画内嵌细线
  plateLabels: boolean;            // 小标签是否"铭牌"式(全大写 + 大字距)
  numericWeight: '600' | '700' | '800';
}
```

取值是从**原 App 的真实取值**反推的，不是拍脑袋：

| 角色 | 默认主题（原样） | 叙拉古 |
| --- | --- | --- |
| `displayFont` / `bodyFont` | `sans` | `serif` |
| `bodyLineHeight` | 1.7 | 1.8 |
| `radiusCard`（卡片/按钮/输入框） | 16 | 3 |
| `radiusPanel`（提示条/译文块） | 8 | 2 |
| `radiusChip`（芯片/徽章/进度条） | 999（胶囊） | 2 |
| `cardFrame` / `buttonInsetRule` / `plateLabels` | 全部 `false` | 全部 `true` |
| `numericWeight` | `800` | `600` |

> 为什么要拆成**三个**圆角而不是一个：原来的 App 里就存在三种值
> （卡片/按钮/输入框 = 16、次级面板 = 8~10、芯片/徽章/进度条 = 999）。
> 一开始我只拆了一个 `radiusControl`，结果默认主题下按钮变成了胶囊 —— 与原样不符。
> 拆开之后每个角色才能各自回到各自的原值。

**应用点只有五处**，其余组件都从它们派生：

| 文件 | 负责 |
| --- | --- |
| `themed-text.tsx` | `displayFont` / `bodyFont` / `plateLabels` / `numericWeight`（覆盖全站排版） |
| `themed-view.tsx` | `radius*` / `cardFrame`。**主题圆角被应用在样式数组最后一位，局部写死会被覆盖** |
| `primary-button.tsx` | `radiusCard` / `buttonInsetRule` |
| `form-field.tsx` + 各页输入框、芯片 | `radiusCard` / `radiusChip` |
| `word-text.tsx` + 阅读页 | `bodyFont` / `bodyLineHeight` |

`ThemedView` 新增 `radius` 属性（`'card' | 'panel' | 'chip' | 'none'`，默认 `'card'`）：
调用方只说"这是什么表面"，圆角由主题决定。`frame="playbill"` 现在只是**声明**
"这是卡片表面"，**是否真的画成节目单描边 + 金刻线由 `skin.cardFrame` 决定** ——
所以同一个组件在默认主题下就是一块普通卡片。

**回归护栏**：`scripts/verify-theme.mjs` 把"默认主题 = 原 App 的样子"钉成了断言
（字体 sans、行高 1.7、卡片圆角 16、芯片 999、不画描边与内嵌线、标签非铭牌、数字 800）。
以后谁再把衬线或方直角写进组件而不是 skin，这个脚本会直接报红。

---

## 12. P1 实施细节与启动屏

### 12.1 字号层级（`themed-text.tsx`）

三个角色分工，这是"成品感"里成本最低、收益最大的一项：

| 角色 | 用途 | 字体 | type |
| --- | --- | --- | --- |
| 展示 + 阅读 | 页面标题、文章标题、阅读正文、统计数字 | **衬线** | `title` `subtitle` `heading` `read` `numeric` |
| UI | 按钮、芯片、说明 | 无衬线 | `default` `small` `smallBold` `caption` |
| 铭牌 | 卡片小标题、日期这类"标签" | 无衬线 + 字距 1.8 + 全大写 | `label` |
| 数据 | 音标、词性 | 等宽 | `code` |

**关键一步是阅读正文换衬线**：`word-text.tsx` 把 `Fonts.serif` 加进 `wordStyle`，
行高从 `fontSize × 1.7` 提到 `× 1.8`（衬线比无衬线需要更多呼吸）。
英文长文用衬线是专业阅读器的做法，也让阅读页从"网页"变成"书"。

**为什么保留 `default` / `small` / `smallBold` 这些旧名字**：它们在全站用了上百处，
语义就是"普通正文"。改名会带来一次纯机械的全仓替换，收益为零、风险不小。

### 12.2 形态语言（去"框架感"的主要手法）

- **`ThemedView frame="playbill"`**：1px 暖色描边 + **左上/右下两点金刻线** + 方直角。
  只用对角两点 —— 四角都放会太吵，反而像"选中态"。已铺到首页卡片、文章卡、推荐卡、
  画像卡、设置页与「我的」页的所有列表。
- **`Radii` 令牌**：卡片 3、控件 2、真圆 999。全站 20 个文件的 `borderRadius: Spacing.three`
  与 6 处胶囊芯片已统一改写，`form-field` 输入框也跟着对齐。
- **`PrimaryButton`**：16 圆角实心块 → 方直角 + `inset 3` 的一圈细线（票券感）。
  这圈线是 `pointerEvents="none"` 的普通 View，**不会抢触摸** —— 该文件顶部记录的
  "嵌套 Pressable 导致按钮点不动"那个坑不会再犯。
- **统计数字改衬线**：首页「今日新学词 / 待复习」、画像卡的词汇量、`StatTile` 都换成
  `numeric` / `heading`。单这一处的气质变化就很明显。

### 12.3 启动屏：素材限制与解法

**先说结论：角色动画没有透明通道。** 逐个像素实测了 `assets/anim/` 下 4 个文件：

| 文件 | 帧数 | 尺寸 | 内容 | alpha | 平坦底色 |
| --- | --- | --- | --- | --- | --- |
| `walk-blue.webp` | 96 | 720² | **有角色**（非底色像素 7.1%） | 全 255 | **RGB(30,137,237)** |
| `walk-white.webp` | 48 | 480² | **空白**（整帧最大偏差 0–3） | 全 255 | RGB(255,255,255) |
| `walk-dark.webp` | 48 | 480² | **空白**（最大偏差 10） | 全 255 | RGB(17,21,22) |
| `walk-alpha-lossless.webp` | 48 | 480² | 有角色（7–8.6%） | **全 255（并没有真透明）** | 黑 |

所以：**能用的只有 `walk-blue.webp`**，而它把角色合成在了不透明的品牌蓝上。
逐帧实测的平坦色是 RGB(30,137,237)（编码意图是 `#208AEF`，差 2/255，肉眼不可见）。
本机没有 ffmpeg，无法重新编码。

**解法：把它当成设计元素，而不是假装它是背景。**
角色待在一个**金线描边的圆形"舞台"**里（`STAGE_SIZE` = 屏宽 68%、上限 280），
圆形裁剪把方形色块的边收干净，容器底色就是动画自身的底色。
再加上逐帧实测的角色包围盒（x246–427 / y278–577）用来把角色摆正、放大到占满圆盘：

- `STAGE_ZOOM = 1.55`：角色原本只占画布 25% 宽，直接摆进圆盘会小得可怜；
- `STAGE_NUDGE_RATIO = 0.145`：角色的视觉中心比画布中心**低约 9.4%**，不修就明显偏下。
  （位移与缩放拆到两层 View 上做，避免 `transform` 组合顺序踩坑。）

于是**整屏的背景、顶部幕布轨、标题、加载点全部来自主题**，只有圆盘内部是素材自带的蓝。
换主题时启动屏跟着变；以后若拿到带透明通道的动画，去掉圆形裁剪、
把容器底色换成 `theme.background` 即可，布局不用动。

**原生启动屏是构建期常量，无法跟随运行时主题。** `app.json` 里
`expo-splash-screen` 的 `backgroundColor` 只能在编译时定一个值，所以它对齐到了叙拉古
（浅色 `#F5EFE2` / 深色 `#131010`），并**移除了 `image`**：模板那张 `splash-icon.png`
实测是**白色不透明图形**（512²，主色 RGB(255,255,255)），压在羊皮纸上等于看不见。
现在它是一个干净的纯色启动页，随后交给带角色的 JS 遮罩。

> 建议：如果希望新用户默认就落在叙拉古主题（冷启动在两个层面完全无缝），
> 把 `src/constants/theme.ts` 的 `DEFAULT_THEME_ID` 从 `'default'` 改成 `'siracusa'` 即可。
> 目前保持 `'default'`，所以选默认主题的用户冷启动会看到羊皮纸 → 纯白的一次跳变。

### 12.4 要真正"擦干净"这块蓝，需要什么

1. **ffmpeg**（本机没有）；或一份带 alpha 的原始素材。
2. 用 `素材/character.webm` 重出一版**带透明通道**的动画。
   注意 `walk-alpha-lossless.webp` 已经试过这条路但 alpha 丢了（实测全 255），
   说明当初的转换管线有问题 —— 建议用 `ffmpeg -c:v libwebp_anim` 直接输出，
   并**在真机上验证透明区不会残留上一帧**（这是该文件注释里记录的原始问题）。
3. 顺带处理 App 图标：`assets/images/icon.png` 实测 72% 是白色，是 Expo 模板遗留，
   与叙拉古主题无关。

---

## 13. P2 图形层实施细节

样张：`docs/mockups/p2-motifs.html`（渲染图 `p2-motifs.png`）。

### 13.1 一切纹样都由 `skin.motifs` 把关

P2 全是**装饰**，最容易重演第 11.5 节那个回归 —— 装饰一旦无条件渲染，切回默认主题就回不到原样。
所以 `ThemeSkin` 新增一个总开关：

```ts
motifs: boolean;   // 默认主题 false，叙拉古 true
```

它和 `cardFrame` 分成两个开关，是因为纹样影响面更大：它会**替换内容里的符号**、
还会**改变封面来源**（见 13.2）。混在一个开关里，以后想单独关掉某一项会很别扭。

`src/components/ornaments.tsx` 里的每个纹样在 `motifs === false` 时**直接 `return null`**，
所以默认主题不会多出任何装饰：

| 纹样 | 用途 | 替换掉了什么 |
| --- | --- | --- |
| `CurtainBand` | 阅读页工具条与正文之间的幕布轨 | ——（纯新增） |
| `Diamond` | 最小符号单位（7/6/5px 三档） | 🔥 🎉 💡 🔁 👉 ◆ |
| `Seal` | 金圈 + 强调衬底 + 中央符号 | 打卡/完成态的文字 ✓ |
| `Medallion` | 金圈（含内环）+ 中央菱形 | 📭 📚 🔍 🔁 🎉 📘 |

**刻意不引入 `react-native-svg`**：项目现在没有这个依赖，而纹样本身都是圆/方/线，
普通 `View` 足够，也少一个原生依赖。

### 13.2 程序化「节目单」封面

`article-cover.tsx` 原来最后一级回退是"渐变 + 话题 emoji"，前三级是
Wikimedia / picsum / Unsplash 的**随机真实照片** —— 每次网络不同、与文章无关、
还要处理超时与"墙"。这是"素材拼凑感"最大的来源。

**封面来源是独立开关，不跟随 `motifs`。** 一开始图省事把封面绑在了装饰总开关上，
后果是"切回默认主题，封面也跟着回到随机照片" —— 但**随机照片不是装饰，是缺陷**：
它在任何主题下都与文章无关、依赖网络、要处理超时。所以拆成独立字段：

```ts
coverArt: 'photo' | 'playbill';
```

| 主题 | `motifs` | `coverArt` |
| --- | --- | --- |
| 默认 | `false` | `'photo'`（原样） |
| 叙拉古 | `true` | `'playbill'` |

> **待定**：要不要把默认主题也切到 `'playbill'`（淘汰随机照片）。
> 改一个词即可。它只影响封面，不会把任何叙拉古的纹样/字体带进默认主题。

### 13.3 封面不单调：四个正交维度

**第一版只让颜色变** —— 8 个色相锚点 × 固定构图。实测 1000 个 id 只产生
**105 种**外观指纹，一屏 30 篇里撞脸 **7 张**。列表看上去就是"同一种封面换了个色"，
这一点被用户直接指出来了。

所以把变化拆成四个正交维度，**全部由 id 的 FNV-1a 哈希决定**（逐位取用，分布比
"乘法累加取模"更均匀）：

| 维度 | 取值 | 说明 |
| --- | --- | --- |
| 色相锚点 | **12 个**（±16° 抖动） | 色相是眼睛最容易分辨的维度，所以先加密 |
| 布局 | **4 种** | 右上大圆+左下小圆 / 左侧竖带+右下弧 / 底部横带+右上圆 / 对角大圆+横带 |
| 徽记 | **4 种** | 菱形 / 圆环 / 三横线 / 十字 |
| 边框 | **3 种** | 内框+对角刻线 / 只有对角刻线 / 双线内框 |

再叠上底色明度（12–16%）、色块明度（27–36%）、色块位置与尺寸的连续抖动。

**实测（`scripts/verify-cover-art.mjs`，1000 个合成 id）：**

| 指标 | 改进前 | 现在 |
| --- | --- | --- |
| 外观指纹种类 | 105 | **422** |
| 首页 30 篇里撞脸 | 7 张 | **2 张** |
| 墨色/底色最低对比度 | —— | **9.50**（正文门槛 4.5） |
| 四种布局占比 | —— | 23.4% – 26.4% |
| 四种徽记占比 | —— | 22.1% – 27.4% |

样张：`docs/mockups/cover-art-preview.html`（渲染图 `cover-art-preview.png`）。
**样张是脚本跑真实代码生成的，不是手画的** —— "会不会单调"应该看真实输出判断。

设计上另外两个刻意选择：

1. **层次用"底色 + 色块"而不是渐变** —— 不依赖 `experimental_backgroundImage`
   （那个在部分平台上不生效，而封面是最不该出岔子的地方）；
2. **只用普通 `View`**，不引入 `react-native-svg`；形状都是圆/方/线，足够。

逻辑与渲染分开：纯函数在 `src/domain/cover-art.ts`（可被脚本直接跑、可断言），
渲染在 `src/components/playbill-cover.tsx`。

### 13.4 三个在这一轮修掉的真实缺陷

1. **封面被绑在装饰开关上**（上面 13.2 已说明）。
2. **`playbill-cover.tsx` 的容器同时写了 `flex: 1` 和由调用方传入的 `height`** ——
   RN 的 `flex` 简写会展开成 `flexBasis: 0%`，主轴尺寸一旦由 basis 决定，
   显式的 `height` 就被忽略；在一列自动高度的父容器里 `flexGrow` 也没东西可分，
   **封面会直接塌成 0 高**。默认主题不走这条路径所以看不出来，叙拉古主题会中招。
   已去掉 `flex: 1` 并写了注释。
3. **「为你挑选」的封面宽度塌成窄条**（用户实测报上来的）。

#### 13.4.1 封面宽度契约（踩过一次，写清楚）

`ArticleCover` / `PlaybillCover` **只提供高度，宽度一律由父容器决定**。
这是有意的：同一个 `thumb` 在列表里要撑满卡片、在行内要固定成海报比例，
写死一个值两头都不对。但**漏了包裹层不会报错**：

| 父容器布局 | 宽度的来源 | 结果 |
| --- | --- | --- |
| **列**（默认） | `alignItems: 'stretch'` | 自动撑满 ✅ |
| **行** | 子元素的**内容**宽度 | 退化成"内部唯一有固有宽度的元素"的宽度 ❌ |

封面内部的色块、边框都是绝对定位（不参与布局），唯一有固有宽度的是**中央徽记** ——
所以宽度会静默塌成**徽记的宽度**：菱形 6px、圆环/横线 20px、十字 10px，
而且**每张卡还不一样**。照片路径没这么明显，是因为绝对定位的 `<Image>` 完全不参与布局、
宽度直接是 0。

已核对全部三个 `size="thumb"` 调用点：

| 调用点 | 布局 | 处理 |
| --- | --- | --- |
| `recommend-card.tsx` | **行** | ❌ 原来没有包裹层 → **已补 `cover: { width: 60 }`**（60×80 海报比例） |
| `(tabs)/index.tsx`（继续阅读） | 行 | ✅ 已有 `continueCover: { width: 72 }` |
| `latest-strip.tsx`（最新短文条） | 列 | ✅ 卡片本身 `width: CARD_WIDTH`，靠 stretch 撑满 |

另外在 `playbill-cover.tsx` 加了一道**开发期护栏**：`onLayout` 量到宽度 >0 且 <24px 时
打一条 `console.warn`（`__DEV__` 之外被短路、只提醒一次）。
这类布局错误是**静默**的 —— 不报错、只是变窄，所以值得让它响一声。

对照图：`docs/mockups/recommend-cover-fix.html`（`recommend-cover-fix.png`）。

### 13.5 元素尺寸与题签

元素尺寸按 `thumb / banner / hero` 三档缩放（`METRICS`），
题签只在 hero 上显示 —— 缩略图上会糊成一团。

### 13.6 一处必须注意的实现细节

`article-cover.tsx` 里把"走不走程序化封面"的判定放在 **hooks 之后、条件 return 之前**：

```tsx
const usePlaybill = skin.coverArt === 'playbill';
if (usePlaybill) return <PlaybillCover … />;
```

如果写成 `if (skin.motifs) return …` 放在 `useState` / `useEffect` 之前，
换主题时 hook 调用数量会变化 → React 直接报错。这类"按主题分叉渲染"的地方都要留神。

### 13.7 默认主题的 emoji 去哪了

**没删。** 默认主题仍然是原来的 emoji（`motifs: false` → 纹样渲染 `null`，
原 emoji 分支照常走）。叙拉古主题下才换成金色菱形/勋章。
数据里的 emoji 字符串（如 `welcome.tsx` 的 `FEATURES`）保留着，只是不渲染。

### 13.8 Tab 图标：工具链查清了，差一个设计决定

`scripts/gen-tab-icons.py` 的依赖都具备：Python + Pillow 11.3 + fontTools 4.60，
字体在 `node_modules/@expo-google-fonts/material-symbols/400Regular/MaterialSymbols_400Regular.ttf`。

**但只装了 400 静态字重**，没有可变字体，所以"线宽降到 1.5"这一项做不到 ——
要那个效果得先拿到 `MaterialSymbols[FILL,GRAD,opsz,wght].ttf` 并用 fontTools 做实例化。

所以这一步卡在**设计决定**而不是技术上：换成哪一套字形（更"雕版"的形态）需要先定，
否则只是把同名图标重新生成一遍，视觉收益为零。
当前 Material Symbols 的形状本身是中性通用的，不冲突，因此暂不动。
---

## 14. 配色重校准：从活动截图实测（第 3 轮）

### 14.1 为什么必须重做

用户指出："主题的 UI 和配色与原游戏活动仍天差地别，可能只是做了一个近似的简化构造。"

**这个判断是对的。** 前两轮的配色**不是从任何真实画面来的** ——
它是从几篇**文字**描述（活动的现实原型：西西里/维亚雷焦狂欢节、commedia dell'arte 假面、
剧院、家族）里自己推导出来的。我从没看过活动的主界面、没看过主视觉、
没从任何一张官方图里取过色。所以那是"从叙事出发的再创作"，不是对视觉语言的还原。

被编出来的部分：**整套配色**、幕布轨、金菱形、蜡封印章、勋章、节目单封面构图、
衬线正文 + 大字距拉丁标签。

### 14.2 测量方法（不依赖视觉模型）

`scripts/analyze-reference.ps1`：WIC 解码（png/jpg/webp/gif 都能读）→ 自己算直方图 →
按 15° 色相族做**面积加权**统计。

两个刻意的设计，避免被数据骗：

1. **主色报"真实均值"而不是量化桶中心** —— 桶中心（如 `#221133`）不是真实像素值，只是 4bit 桶的格点；
2. **强调色按面积加权，而不是取"最饱和的那个像素"** —— 后者会被面积极小的杂色带偏
   （v1 就因此给 001 报出了 `#462900`，一个几乎看不见的暗棕）。

### 14.3 实测结果（7 张活动图，饱和像素占抽样 42.22%）

按色相族汇总（面积加权色 · 占全图 · 占饱和像素）：

| 色相族 | 面积加权色 | 占全图 | 占饱和 |
| --- | --- | --- | --- |
| **240-255° 蓝紫** | `#332c6c` | 10.76% | **25.5%** |
| **345-360° 绯红** | `#802132` | 6.95% | **16.5%** |
| **255-270° 紫** | `#4d3071` | 6.12% | 14.5% |
| **30-45° 暖金** | `#e0b987` | 5.47% | 13.0% |
| **270-285° 紫** | `#583776` | 4.39% | 10.4% |
| 330-345° 酒红 | `#722640` | 2.52% | 6.0% |
| 15-30° 浅褐 | `#d4a480` | 2.47% | 5.9% |
| 225-240° 靛蓝 | `#5a61b9` | 0.84% | 2.0% |

单图（更直观）：

- **028**（1125×6032）`#201a36` 24% + `#573877` 17% + `#4b2e69` 7.5% + `#633b88` 4.5% + 金 `#e39434` 1.7% → **深紫主导 + 金点缀**
- **027**（480×1600）蓝紫 `#4a47d6` 4.7% + `#4744ca` 2.7% + 绯红 `#28030b`/`#390713`/`#460a16` + 金 `#c09957` → **蓝紫 + 绯红 + 金**
- **025**（480×1600）奶油 `#fbdab6` 17.6% + 绯红 `#560c1a`/`#480a16`/`#671425`/`#781528` → **绯红 + 奶油**
- **019**（1000×2324）`#1c1725` 26% + `#231835` 8.9% + `#1d1433` 2.4% + 绯红 `#932738` → **紫罗兰底**
- **020**（1357×11460）`#080808` 21.8% + `#191919` 18.2% + `#282828` 9.7% + `#353535` 7.1% → **纯灰阶文字长图**
- **001 / 002**（1920×1080）紫灰 `#281926`/`#473947`/`#362937` + 亮部 `#fefcfc` + 蓝紫 `#37299b`/`#323b99`

**全部 7 张暗部占比 48%–78%。**

### 14.4 结论：我的配色错在哪

| | 我的（编的） | 实测 |
| --- | --- | --- |
| 深色底 | `#131010` **暖棕黑** | `#09080b` / `#0d0b12` **冷紫黑** |
| 浮起面 | `#201A17` 暖棕 | `#17141b` / `#1c1725` / `#201a36` **紫灰** |
| 主强调 | `#E4B45A` **金** | **蓝紫 `#4a47d6`/`#5c56d7`**（最大色族 25.5%） |
| 次强调 | —— | **绯红 `#802132`/`#932738`**（16.5%） |
| 紫罗兰 | **完全没有** | 紫 255-285° 合计 **24.9%** |
| 金 | 当主色用 | 只是配角（13%），亮部是奶油 `#f7d8b4` |
| 浅色 | `#F5EFE2` 羊皮纸 | **参考里根本没有浅色界面** |

三个结构性错判：

1. **色温反了**：我用暖（棕/红/金），实测是**冷**（紫/蓝紫/靛）；
2. **主色选错了**：我把金当主色，而实测**最大的色族是蓝紫**，金只是点缀；
3. **明暗关系反了**：我把"浅色羊皮纸"当主模式，而**参考全是深色主导**。

### 14.5 新配色（照实测重写）

`siracusa.dark`（主模式）：

```
background #0B0912   ← 实测 #09080b/#0d0b12/#050506
backgroundElement #1A1725   ← 实测 #17141b/#1c1725
backgroundSelected #272041  ← 实测 #201a36/#221a28
text #F5F2FA                ← 实测亮部 #fafafa/#fefcfc
textSecondary #A99CC0       ← 实测 #564957 往冷调
accent #8F88F2              ← 实测蓝紫 #4a47d6/#5c56d7（最大色族）
annotate #E0607A            ← 实测绯红 #ae5160（压亮到能当正文标注）
gold #D8A05D                ← 实测暖金（只做线）
danger #E8913F              ← 实测橙 #e39434 一族
```

`siracusa.light`：**衍生**的日间变体（`#F4F1F8` 淡紫纸 + `#3A329B` 靛紫强调 +
`#8E2338` 绯红标注 + `#A8722E` 金线）。参考里没有浅色界面可依据，所以**不当成还原**。

配套改动：

- **封面生成器的色相锚点也收到了实测色域内** —— 从"均匀铺满 360°"改成
  实测的**绯红→品红→紫→靛蓝**弧（`352/338/324/308/292/276/258/242/228`）+ 暖金 `40`。
  早先均匀铺满的版本会生成橄榄绿、青色的封面，**那些颜色在活动里根本不存在**；
- 封面底色明度从 12–16% 压到 **8–14%**、色块从 27–36% 调到 **26–36%**，对齐实测的
  `#09080b`–`#201a36`（底）与 `#553878`/`#4d3071`（面）。

**校验：`audit-contrast` 80 项一次通过；`verify-cover-art` 指纹 458 种、首页 30 篇 0 重复。**

对照样张：`docs/mockups/palette-recalibration.html`。

### 14.6 还没做的：形态（这半量不出来）

配色可以从像素可靠量出。**形态不行** —— 描边粗细、角标形状、字距节奏、字体族、
装饰线的组合方式，这些是**语义**，直方图恢复不了。

所以以下**仍然是我按"印刷品"编的，可能同样偏离**：

- 衬线正文 + 大字距拉丁标签；
- 方直角 + 1px 描边 + 左上/右下对角金刻线；
- 幕布轨、金色菱形、蜡封印章、勋章；
- "节目单"式封面构图（4 布局 × 4 徽记 × 3 边框）。

补上这半需要二选一：**视觉模型恢复**，或**你给文字描述**。
`scripts/analyze-reference.ps1` 也能量一部分结构量（扫描线游程估描边粗细、
边缘扫描估圆角），但量不出"三段式斜切角标"这种形态语义。

> ⚠️ **旧样张已过期**：`siracusa-theme.png`、`settings-page.png`、`p2-motifs.png`、
> `recommend-cover-fix.png`、`cover-art-preview` 里的前四个都是**重校准之前**画的，
> 色值是旧的那套。以 `palette-recalibration` 为准。