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
