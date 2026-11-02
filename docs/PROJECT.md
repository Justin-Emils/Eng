# 项目说明(完整版)

> 适用版本:**1.1.20 / versionCode 22**
> 本文是"从零理解这个项目"的总入口。单点深入请跳到第 15 节的文档索引。
> 文中所有数字与文件路径都来自当前代码库实测,不是估算。

---

## 1. 这是什么

一个**离线优先的考研英语精读 App**:每天读一篇英文短文,App 按**你自己的词汇量**把"该学但还不会"的词标蓝;点词即查义、标记学习、自动进生词本,并按间隔重复(SRS)安排复习。

**技术形态**:React Native + Expo(SDK 57),自用为主,Android 侧载安装;不上架、不做社交、无广告无埋点。

**它明确不做的事**(写清楚是为了避免误解):

| 不做 | 原因 |
|---|---|
| 不抓第三方版权文章 | 内置语料是原创编写;自动更新只取 Project Gutenberg 公版书 |
| 不做账号体系以外的服务端逻辑 | 云端只用于"换手机不丢数据",不是运行前提 |
| 不接广告/埋点/推送服务 | 隐私上更干净;复习提醒是**本地通知**,不走服务端 |
| 不承诺考试效果 | 见 `/legal` 用户协议第 4 条 |

---

## 2. 快速开始

```powershell
# 环境:Node 22 / pnpm 或 npm;Android 侧载需 JDK 21 + Android SDK
npm install
npx expo start            # 开发:手机用 Expo Go 扫码(原生模块需 development build)
```

**只读代码、不装 App 也能验证**——核心逻辑都是纯函数,见第 12 节。

---

## 3. 目录结构

```
article-reading/
├─ src/
│  ├─ app/                 20 个页面(expo-router 文件路由,含 5 个 Tab)
│  ├─ components/          35 个 UI 组件
│  ├─ domain/              49 个纯逻辑模块(可单测,不碰 UI)
│  │  ├─ auth/             注册/登录/改密 API 与状态
│  │  └─ corpus/           每日公版语料抓取、切分、打标、封面
│  ├─ storage/             14 个持久化模块(AsyncStorage / SecureStore)
│  ├─ data/                内置数据:22 篇原创文章、约 6797 条词表、词典
│  ├─ hooks/               use-theme / use-auth / use-completed-articles …
│  ├─ constants/           theme.ts(主题令牌与 13 个 skin 字段)
│  └─ types/               WordItem / Article / UserLevel / UserSettings …
├─ scripts/                41 个脚本:验证、生成、抓取、打包辅助
├─ docs/                   30 个文档(见第 15 节)
└─ app.json / package.json / eas.json
```

规模:**154 个源文件 / 约 78,000 行**;依赖 33 个(含 expo 系列)。

### 分层约定(重要)

- `domain/` **不 import UI**,也不直接读存储(需要数据时由调用方传入)——
  这样才能在 Node 里跑验证脚本(见第 12 节);
- `storage/` 只负责读写,**不含业务规则**;
- `app/` 负责编排:读 storage → 调 domain → 渲染。

---

## 4. 页面与路由(20 个)

| 路由 | 作用 |
|---|---|
| `(tabs)/index` | 首页:问候、连续打卡、今日目标、继续阅读、推荐、快捷入口(生词本计数可点) |
| `(tabs)/library` | 文章库:22 篇内置 + 每日公版;搜索 + 排序(全部/按话题/按难度)+ 吸顶分区 |
| `(tabs)/words` | 生词本:搜索、筛选(全部/待学/已巩固/今日新增)、多选批量(标掌握/移出/删除) |
| `(tabs)/review` | 复习:按每日目标截断队列、两步自评(记得/不记得)、结果说明、继续复习剩余 |
| `(tabs)/profile` | 我的:量化画像、统计、入口(账号/设置/更新日志/检查更新) |
| `article/[id]` | 阅读页:字号、点词查词、读完自动打卡、底部规则说明 |
| `word/[word]` | 词条详情:音标 + 发音、释义、收藏/掌握/删除、来源文章 |
| `account` | 账号与同步:登录态、数据归属、立即同步、删除云端数据、退出 |
| `settings` | 设置:主题、深浅模式、每日目标、复习提醒、导出、清空、隐私政策 |
| `changelog` | 更新日志(内嵌数据,断网可看) |
| `legal` | 隐私政策 / 用户协议 / 数据出境说明(草稿) |
| `assessment` | 词汇量自适应测评(11 档) |
| `welcome` / `onboarding` | 欢迎页与首次引导 |
| `auth/login` `auth/register` `auth/forgot` | 登录 / 注册 / 找回(改密) |
| `dev` | 开发者选项(重测引导、清空数据、预览更新弹窗) |

---

## 5. 核心流程

### 5.1 首次启动
`_layout` 水化(主题 → 复习统计 → 数据归属 → 同步状态 → 时钟偏移)→ 读设置 →
未完成引导则进 `/onboarding`;已登录但本机空则在登录流里**自动从云端恢复**。

### 5.2 阅读一篇文章
1. 点词 → 离线词典查询(内置词典 → ECDICT 词表)→ 弹词卡片;
2. 卡片上「＋ 生词本」= **今日新学 +1**,并写入学习记录(`markLearned`);
3. 进入末段并停留 3 秒,或**所有段落都进过视口且已读超 8 秒** → 自动标记读完 + 打卡;
   底部按钮可手动兜底;
4. 进度按"最靠上的可见段"保存,下次进入自动恢复到该段。

### 5.3 复习
到期词按 `dailyGoal.reviewWords` 截断 → 先只显示单词(回忆)→ 自评 → 详解页:
记得 → `reps+1`,间隔 1/2/4/7/15/30/60/120/240 天推进;不记得 → 等级归零、**10 分钟**后到期(`AGAIN_REVIEW_DELAY_MS`)、
**当场排回队列末尾**。连续答对 5 次转「已巩固」,仍按超长间隔回来(不再永久退出)。

### 5.4 同步(登录后)
- 方向由**登录时**决定:本机空+云端有 → 自动恢复;本机有+云端空 → 自动上传;
  **两边都有 → 必须用户选**;云端读取失败 → **一律问用户**,绝不自动覆盖;
- 之后自动同步:启动 / 回前台 / 每 60 秒,用**业务内容指纹**判断是否变化;
- 上传前比对云端 `updated_at`:若云端更新(另一台设备推过),暂停自动上传并提示。

### 5.5 更新
启动时查 GitHub Releases(6 小时节流):远端版本 > 当前 → 弹窗(可"本次更新前不再提示");
「我的 → 检查更新」手动查(60 秒节流)。下载走系统浏览器 + APK 直链。

---

## 6. 数据模型与本地存储

### 6.1 核心类型(`src/types/`)

| 类型 | 关键字段 |
|---|---|
| `WordItem` | `id / headword / word / pos / zh / en / example / sourceArticleId / status / addedAt / review{reps,ease,interval,dueAt,lapses}` |
| `Article` | `id / title / summary / paragraphs[] / topicTags[] / source / level` |
| `UserLevel` | `vocab / level / assessed / rounds[] (每档答对率) / updatedAt` |
| 设置 | `dailyGoal{articles,reviewWords} / theme / themeId / fontSize / reminderEnabled / reminderHour / onboarded` |

### 6.2 本地存储键(15 个)

| Key | 内容 |
|---|---|
| `readingapp.words.v1` | 生词本(含 SRS 状态) |
| `readingapp.learning.v1` | 每日已学(按日期分组) |
| `readingapp.known.v1` | "我已会"集合 |
| `readingapp.progress.v1` | 每篇文章的阅读进度 |
| `readingapp.checkins.v1` | 打卡(日期 → 文章 id 列表) |
| `readingapp.userlevel.v1` | 词汇量评估结果与本轮明细 |
| `readingapp.settings.v1` | 目标、主题、字号、提醒等 |
| `readingapp.account.v1` | 本机身份(昵称、头像、加入时间) |
| `readingapp.remote.v1` | 远程公版文章缓存(**不进备份**) |
| `readingapp.corpus.recent-books.v1` | 最近抽过的公版书,避免重复 |
| `readingapp.localowner.v1` | 本机数据归属账号 |
| `readingapp.syncstate.v1` | 同步基线(内容指纹 + 时间) |
| `readingapp.reviewstats.v1` | 复习校准(按档位累计记得/作答) |
| `readingapp.clockoffset.v1` | 服务器时间偏移 |
| `readingapp.auth.v1` | 登录态(**SecureStore**,超限回退 AsyncStorage) |

另有 `readingapp.corrupt.<key>.<ts>`:存储损坏时的原始值备份(见第 13 节)。

### 6.3 备份白名单
`BACKUP_KEYS` 共 10 个键(不含远程文章缓存、不含登录态、不含时钟偏移)。
备份是**整份覆盖**:先校验 JSON → 写新值 → 删除"备份里没有"的键 → 热重建内存缓存。

---

## 7. 算法与口径

### 7.1 难度:词 → 门槛 → 文章难度

```
词频名次 rank → 门槛 threshold = 500 + min(rank, 40000)/40000 × 11500
文章难度 = 0.6 × (词门槛的 95 分位) + 0.4 × (最难 5% 的均值)
```
> 为什么 95 分位:均值会被少量极难词拉偏;95 分位更接近"读懂这篇需要多少词"。
> `0.6/0.4` 的权重是经验值,**没有文献支撑**,已在代码注释里标明。

### 7.2 词汇量档位

`VOCAB_BANDS = [1500, 3000, 4200, 5500, 7500, 9500]`,对应 中考 / 高考 / 四级 / 考研+六级 / 托福+雅思 / SAT+GRE。

### 7.3 知识曲线
`pKnown(t)` = "这个用户认识门槛为 t 的词的概率",由评估各档实测答对率拟合
(分段线性 + 两端外推;无评估时退化为以词汇量为中心的 logistic)。
复习结果会**按档位校准**曲线:样本 ≥ 5 才参与,并向评估曲线收缩,避免少量样本带偏。

### 7.4 标蓝(个性化)
```
该标 = 词的 threshold > 用户词汇量 - 300  且  pKnown(threshold) < 0.85
```
没有画像时退回"考研词表 + 词频"口径 —— 保证不会因为缺评估就什么都不标。

### 7.5 推荐
`0.7 × 理解率贴合度 + 0.3 × 可学词占比`,目标理解率 **93%–96%**(生词率 4%–7% 的学习区)。

### 7.6 SRS
`MASTER_THRESHOLD = 5`;间隔 `[1,2,4,7,15,30,60,120,240]` 天;ease 夹在 1.3–3.0;
到期判定用**校准时间**,`ignored`(用户点"我会了")永不进队列。

---

## 8. 云端服务(Supabase)

- 项目:`saqgqexmcrygpyyndknt.supabase.co`,区域 **ap-southeast-1(新加坡)**
- 只用两张表:`backups`(每账号一份整包 JSON)、`profiles`(昵称/头像);**RLS 只允许读写自己的行**
- 客户端只带 **publishable key**(公开无害);`service_role` 绝不出现在客户端
- 建库脚本:`docs/supabase-setup.sql`(canonical);`supabase/schema.sql` 已标注废弃
- 运维(暂停/恢复/保活):`docs/backend-ops.md`

**免费项目的坑**:约 7 天无活动会**暂停**,暂停后域名停止解析 → App 报"连不上云端"。
保活手段:本机计划任务 `EngSupabaseKeepAlive`(每天 10:00)+ GitHub Actions 模板(`docs/ci/`)。

---

## 9. 主题系统(可扩展)

- `ThemePalette`:19 个颜色令牌(`background / text / accent / accentSoft / gold / danger / success / border / annotate…`)
- `ThemeSkin`:13 个版式字段(`displayFont / bodyFont / bodyLineHeight / radiusCard/Panel/Chip / mascot / cardFrame / buttonInsetRule / plateLabels / motifs / coverArt / numericWeight`)
- `Themes` 注册表 + `THEME_META`(Record 保证加主题时类型报错提醒)+ `isThemeId`
- 加新主题的完整步骤与 5 条硬约束:**`docs/add-a-theme.md`**
- 对比度门禁:`node scripts/audit-contrast.mjs`(2 主题 × 2 深浅色 = 80 项组合)

---

## 10. 联网依赖与降级行为

| 功能 | 依赖 | 断网时 |
|---|---|---|
| 阅读、查词、生词本、复习、标蓝、推荐 | **无** | 正常 |
| 每日公版语料更新 | Gutenberg / gutendex | 用已缓存文章 |
| 句/段翻译 | translate.googleapis.com(gtx) | 退回离线逐词 |
| 云端同步 | Supabase | 本地照常,失败静默重试 |
| 检查更新 | api.github.com | 静默失败,可手动重试 |
| 域名 MX 校验(注册/找回) | 阿里/腾讯 DoH | **不阻断**,跳过检查 |
| 时间校准 | Supabase `/auth/v1/health` | 用上次偏移 + 本机时钟 |
| 发音 | 系统 TTS | 设备无引擎时静默无反应 |

---

## 11. 构建与发布

完整步骤见 **`docs/release-howto.md`**,要点:

```powershell
# 1) 版本:app.json 的 version 与 versionCode 同时 +1
# 2) 更新日志:src/data/changelog.ts 顶部加一条(版本号与 app.json 一致)
# 3) 校验
npx tsc --noEmit ; npx eslint src
# 4) prebuild + 还原本机 Gradle 配置 + 补 splash drawable + 正式签名补丁
npx expo prebuild --platform android --no-install
powershell -File scripts/patch-release-signing.ps1
# 5) 构建
cd android ; .\gradlew.bat assembleRelease --no-daemon
```

**签名**:`.artifacts/signing/release.keystore`(不进仓库,`*.keystore` 已 gitignore),
证书 `CN=Article Reading, O=Justin Emils`。⚠️ 换签名后的包**不能覆盖安装**,必须先卸载
(会丢本机数据,先导出备份)。

**发 Release**:GitHub 建 tag `vX.Y.Z` + Release 并挂 APK;App 的"检查更新"只认 Release(不认 tag)。

---

## 12. 验证与测试

项目没有 Jest 测试套件,而是**可执行的验证脚本**(纯逻辑模块转译后在 Node 里跑):

| 命令 | 覆盖 | 断言数 |
|---|---|---|
| `node scripts/verify-fingerprint.mjs` | 同步指纹(不含导出时间) | 7 |
| `node scripts/verify-login-sync.mjs` | 登录同步方向(读失败不得自动上传) | 8 |
| `node scripts/verify-marking.mjs` | 个性化标蓝判定 | 17 |
| `node scripts/verify-article-merge.mjs` | 公版文章按 id 合并 | 12 |
| `node scripts/verify-email.mjs` | 邮箱格式与笔误纠正 | 31 |
| `node scripts/audit-contrast.mjs` | 主题对比度 | 80 |
| `node scripts/verify-profile.mjs` | 量化画像 + 推荐 | — |
| `node scripts/verify-difficulty.mjs` / `verify-theme.mjs` / `verify-corpus-*.mjs` | 难度 / 主题 / 语料 | — |
| `npx tsc --noEmit` + `npx eslint src` | 类型与规范 | 0 错误 |

CI 模板:`docs/ci/ci.yml`(把 5 个 verify + tsc + eslint 接进 GitHub Actions)。

---

## 13. 已知限制(诚实清单)

| 限制 | 现状 |
|---|---|
| 账号注销 | 只能删**云端数据行**;`auth.users` 需服务端权限,`legal` 页写明需人工处理 |
| 自动更新 | 只能跳浏览器下 APK,不做应用内安装 |
| R8/代码压缩 | 试过:构建能过但包体反而 +0.18 MB,且未真机验证运行时 → **交付版保持关闭** |
| 图片头像 | 相册头像只存本机 `file://`,不同步(只同步 emoji) |
| 学习报告/错题本/撤销 | 未做(属独立功能,非缺陷) |
| 法务文本 | `/legal` 是**草稿**,上线前需法务审阅 |
| 语料偏旧 | 自动更新只取 Gutenberg(1920s 前为主),与考研现代文体有差距 |
| 存储损坏 | 会备份原值并抛错拒绝写入,但**没有自动修复 UI**(崩溃日志同理,只能从 `dev` 页看) |
| iOS | 无原生工程,只能 Expo Go 或 EAS 云构建(需付费 Apple 账号) |

---

## 14. 第三方数据与许可

| 来源 | 用途 | 许可/风险 |
|---|---|---|
| ECDICT | 词典释义、词频 | MIT(需保留声明) |
| 考研大纲词表(红宝书系) | 考研词表 | **授权未确认**,仓库公开,存在版权风险(已知并接受) |
| Project Gutenberg | 每日公版文章 | 公有领域 |
| Wikimedia / Unsplash | 封面图 | 需署名/遵守 API 条款;当前只存 URL |
| Literata 字体 | 内嵌展示字体 | OFL |
| Expo / React Native | 框架 | MIT |

> 仓库 `LICENSE` 目前是 Expo 模板的 MIT 文本,**对外发布前需要换成自己的许可**并处理上表。

---

## 15. 文档索引

| 文档 | 内容 |
|---|---|
| `README.md` | 功能表、技术栈、快速开始、打包说明 |
| `docs/PROJECT.md`(本文) | 完整项目说明 |
| `docs/fix-log.md` | 诊断报告逐项修复记录(根因/改动/证据) |
| `docs/诊断报告-商业化差距与逻辑缺陷.md` | 全量诊断报告(P0–P3、产品专项) |
| `docs/feedback-backlog.md` | 27 项使用反馈与分批计划 |
| `docs/release-howto.md` | 发版与 Release 操作手册 |
| `docs/backend-setup.md` / `backend-ops.md` / `supabase-setup.sql` | 云端搭建、运维、建库 SQL |
| `docs/add-a-theme.md` | 加主题的步骤与硬约束 |
| `docs/theme-siracusa.md` | 叙拉古主题设计规格(51 KB) |
| `docs/design-system-inventory.md` | 设计系统清单(146 KB) |
| `docs/ci/*.yml` | CI 与保活 workflow 模板 |
| `docs/mockups/*` | 设计稿与对比图(HTML/PNG) |

---

## 16. 一句话总结

**离线能用的精读工具 + 会用你的词汇量做个性化标记 + 有证据的间隔复习 + 可选云备份**;
代码里所有"经验参数"都标了来源或标注了"无文献支撑",验证脚本覆盖了最容易出错的数据安全路径。
