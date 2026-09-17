# 考研英语阅读(article-reading)

一个**离线优先**的考研英语精读 App:每天给你一篇篇幅适中的英文短文,按**你自己的词汇量**把"该学的生词"标蓝,点词即查义、标记学习、自动进生词本并用间隔重复复习。

用 React Native(Expo)写成,数据全部存在手机本地,不需要后端服务器。

## 功能

| 模块 | 说明 |
|---|---|
| 词汇量测评 | 自适应抽词测评,得出你的词汇量档位与 CEFR 估计(`/assessment`) |
| 蓝词标注 | 按词汇量门槛 + 考研词表 + 词频,自动标出"该学但还不会"的词;今日新学词加粗 |
| 点词查义 | 语料重点词 > 内置词典 > ECDICT(离线);可标记「学习 / 我已会」 |
| 句子 / 标题 / 简介翻译 | 在线整句翻译(Google gtx → MyMemory),失败自动离线逐词兜底 |
| 生词本 | 收藏、掌握度、来源文章回溯 |
| 复习 | 基于间隔重复(SRS)的到期队列,记得 / 不记得两键评价 |
| 文章库 | 22 篇内置语料 + 每日自动更新的公版短文;按话题/难度分组、搜索、「最新更新」横条 |
| 每日公版更新 | 启动时从 gutendex(Gutenberg)随机取书 → 切分 220–700 词 → 自动标注 → 入库 |
| 打卡与统计 | 阅读进度续读、读完打卡、连续天数、累计词数 |

## 技术栈

- **Expo SDK 57** / React Native 0.86 / React 19(React Compiler 已开启)
- **expo-router** 文件式路由,**TypeScript** strict 模式
- **AsyncStorage** 本地持久化(无后端)
- **expo-image** 封面加载(多级回退:文章配图 → picsum → Unsplash → 渐变 emoji)
- 词表数据:**ECDICT**(MIT,词频/标签/释义)+ 自备考研词表

## 快速开始

```bash
npm install
npx expo start          # 手机装 Expo Go 扫码 / 连 exp://<电脑IP>:8081
```

改代码后手机摇一摇 → Reload 即可,不需要重新打包。

质量检查:

```bash
npx tsc --noEmit        # 类型检查
npx expo lint           # 代码规范
```

## 打包 Android APK(独立安装版)

需要 JDK 17/21 + Android SDK(NDK 27.1、CMake 3.22、build-tools 35/36)。

```bash
npx expo prebuild --platform android --no-install   # 生成 android/ 原生工程(已被 gitignore)
cd android
./gradlew assembleRelease                            # 产物:app/build/outputs/apk/release/app-release.apk
```

> Windows 上请把 `JAVA_HOME` 指向 JDK 17/21(JDK 24 与 Android Gradle 插件不兼容)。
> Release 默认用 debug 签名,自用安装可直接侧载;上架需换正式 keystore。

## 首次启动流程

```
启动动画 → 判断是否已有本机学习档案(onboarded)
  ├─ 有   → 直接进首页(老用户,不打扰)
  └─ 没有
       ├─ 未登录 → /welcome(登录 / 注册 / 先不登录)
       │    ├─ 注册 → 登录态建立 → /onboarding(完善个人信息 → 学习计划 → 词汇量评估)
       │    └─ 登录 → 自动同步一次云端数据 → 有备份就直接进首页,没有则补完引导
       └─ 已登录 → 补一次自动同步;失败再补完引导
```

- **登录后自动同步**遵循"只补不覆盖":本机为空(没有生词、没完成过引导)才导入云端备份,
  本机已有数据时只合并昵称/头像,把是否覆盖的决定权留给用户(账号页的「从云端恢复」)。
- **「先不登录」是明确保留的次路径**:App 离线优先,后端不可用或没网时不该把人挡在门外,
  代价(数据只在本机)在按钮下方写清楚了。

## 发版约定

- **每次改动都 `git commit`** —— 提交是代码轨迹,不代表发版。
- **自用验证不发 Release**:本地 `assembleRelease` 出 APK 直接装到手机上,不产生版本号、不打扰关注者。
- **只有明确说"发版"时才发布 Release**,版本号按 SemVer 递增:
  - 修 bug / 打磨 UI → PATCH(`v1.0.13`)
  - 新增功能(如云同步、账号体系) → MINOR(`v1.1.0`)
  - 数据结构不兼容(备份格式、存储键重构) → MAJOR(`v2.0.0`)
- **发版时必须同步改三处**,否则「关于」里显示的是假版本(曾经 tag 发到 v1.0.12、App 里还写着 1.0.0):
  1. `app.json` 的 `version`
  2. `app.json` 的 `android.versionCode`(每次发版 +1,否则新 APK 装不上旧版之上)
  3. 重新 `npx expo prebuild --platform android` 让 `android/` 里的 versionName / versionCode 跟着更新
- Release 说明只写"这一版相比上一版新增/修了什么",不累积历史。

> GitHub 上只保留两个版本:`v1.0.0`(起点)与最新一个;中间过程版本不长期留存。

## 水平模型(量化)

用户水平**不再只是一个档位标签**,而是连续量三件套(见 `src/domain/profile.ts`):

| 量 | 说明 |
|---|---|
| **词汇量点估计** | 自适应评估的档内插值,如 5230 词 |
| **置信区间** | 由作答数、正确率与评估模式算出(启发式,常数标定在代码注释里);快评 15 词约 ±700,精细 40 词约 ±250 |
| **分频段掌握曲线** | 每档正确率。曲线**形状**才是画像:同为 4300 词,"高频扎实 + 5500 断层"与"整体均匀"是两种人 |

文章侧同样是连续量:`requiredVocab`(认识 95% 词所需词汇量)+ **预测理解率**(这个词汇量下能认识该篇多少比例的词)+ 可学词数(门槛在 +2000 以内)/噪音词数(超过 +3000)。

**推荐按理解率匹配**(`src/domain/recommend.ts`):目标区间 = 学习区 **93%–96%**(生词率 4%–7%),权重 0.7 给理解率贴合度、0.3 给可学词适配。细分档位只在展示与兜底排序时使用。

为什么弃用"档差 ±1":档位宽 400–1200 词,同一档标签下实测难度值跨度可达 947 词(内置语料 B2+ 档:4847–5794);且档差与理解率并不总一致 —— 实测出现过"档差 0 的文章(93.8%)比档差 +1 的(94.0%)更难"。用 `node scripts/verify-profile.mjs 5000` 可复现这些数字。

## 目录结构

```
src/
├── app/          页面(文件式路由):今日 / 文章库 / 生词本 / 复习 / 我的 / 阅读页
├── components/   复用 UI 组件(封面、词典卡、句子块、底部 Tab 等)
├── domain/       业务逻辑纯函数:蓝词判定、词典、翻译、推荐、SRS、语料更新
├── data/         语料与词表(内置文章、核心词典、词频元数据)
├── storage/      AsyncStorage 持久化(唯一碰存储的地方)
├── hooks/        连接 domain/storage 与页面
├── types/        全项目类型定义
└── constants/    主题色、间距、字体
```

分层约定:`app/`(UI)→ `hooks/` → `domain/`(纯逻辑)+ `storage/`(持久化);
`domain` 不依赖 React,页面不直接调用 AsyncStorage。

核心数据流:
`词汇量 → isStudyCandidate() 标蓝 → 点词查义 → 标记学习 → 生词本 → SRS 复习`。

## 数据与许可

- 词典/词频数据来自 [ECDICT](https://github.com/skywind3000/ECDICT)(MIT License © Linwei)。
- 每日更新文章来自 [Project Gutenberg](https://www.gutenberg.org/)(公有领域),经 gutendex API 获取。
- 考研词表为用户自备资料,公开发布前请自行确认授权。
- 仓库**不含**体积较大的原始词典 CSV(`wordlists/ecdict.csv`,约 66MB)。
  需要重新生成词频数据时,运行 `scripts/fetch-ecdict-meta.py` 自行下载。

## 已知限制

- 在线翻译依赖公开端点;部分网络下 Google 端点会超时,自动回退(约有几秒等待)。
- Wikimedia 图片在部分网络不可达,已做多级回退到可用的图库。
- 配图来自开放许可图库,可能与文章主题不严格相关。
- 内容仅用于个人学习。
