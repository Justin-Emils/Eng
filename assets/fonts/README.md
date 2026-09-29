# assets/fonts

把内嵌字体放到这个目录。**放好之后告诉 AI 一声，它会接上加载代码。**

## 需要哪些文件

推荐 **Literata**（Google 为长时间屏幕阅读设计的衬线体，OFL 授权，可随 App 自由分发）：

| 文件名 | 用途 |
| --- | --- |
| `Literata-Regular.ttf` | 阅读正文、普通文字 |
| `Literata-SemiBold.ttf` | 文章标题、卡片标题、统计数字 |
| `Literata-Bold.ttf` | 强调、加粗 |

只需要这三个。**不需要**斜体、不需要完整字重家族 —— 每多一个文件包体就多约 300KB。

## 怎么拿

1. 打开 <https://fonts.google.com/specimen/Literata>
2. 右上角「Get font」→「Download all」
3. 解压，进 `static/` 子目录取上面三个 `.ttf`
4. 复制到本目录（`assets/fonts/`）

## 备选字体（想换风格的话）

| 字体 | 性格 | 适合 |
| --- | --- | --- |
| **Literata** | 温和、字面开阔、专为屏幕阅读调过 | 默认推荐 |
| **Source Serif 4** | 更中性、Adobe 出品 | 想要"标准专业"感 |
| **Spectral** | 笔画对比更强、更有文学味 | 想让正文"有声音" |
| **EB Garamond** | 经典旧式衬线、优雅 | 想要书卷气，但小字号偏细 |
| **Newsreader** | 报纸味、紧凑 | 想让一屏放更多字 |

都是 OFL 授权，同样三个字重即可。

## 为什么不用中文字体

内嵌一套中文字体要 **10MB+**（常用字集），包体会从 ~30MB 涨到 40MB 以上。
所以中文继续用系统字体（Android 的 Noto Sans CJK / iOS 的苹方），
**只有拉丁字形会换成内嵌字体** —— 这对一个英语阅读 App 来说正是想要的效果。

## 放好之后会发生什么

AI 会做三件事（都在 `src/app/_layout.tsx` 与 `src/constants/typography.ts`）：

1. 用 `expo-font` 在启动时加载这三个文件，**字体没加载完不隐藏启动遮罩**（否则会闪一下系统字体）；
2. 把 `FONT_SLOTS` 里的 `reading` / `display` 从系统衬线换成 `Literata` 系列；
3. 顺手把标签类文字换成同族或系统无衬线，保证层级对比。

其余代码一行都不用改。
