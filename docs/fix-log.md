# 诊断报告修复记录

> 依据:[诊断报告-商业化差距与逻辑缺陷.md](诊断报告-商业化差距与逻辑缺陷.md)
> 记录格式:问题 → 根因 → 改了什么 → **证据** → 状态。

## 进度总览

| 批次 | 项 | 状态 |
|---|---|---|
| P0-1 | 同步指纹含时间戳,每 60 秒全量覆盖云端 | ✅ 完成 |
| P0-2 | 云端读取失败被当成"云端为空",自动覆盖云端 | ✅ 完成 |
| P0-3 | Release 用 debug 证书签名 | ✅ 完成 |
| P1-1 | 打卡用本机时间 / 校准 URL 拼错 / UI 谎称联网 | ✅ 完成 |
| P1-2 | "按词汇量标蓝"未实现 | ✅ 完成 |
| P1-3 | 每日远程文章整批替换致统计缩水 | ✅ 完成 |
| P1-4 | 清空生词本清不干净 | ✅ 完成 |
| P1-5 | 备份导入不是覆盖 + 需重启 | ✅ 完成 |
| P1-6 | 云端恢复后不建同步基线 | ✅ 完成 |
| P1-7 | 读完判定过松 | ✅ 完成 |
| P1-8 | 连点竞态 | ✅ 完成 |
| P1-9 | "每日复习 N 词"是死设置 | ✅ 完成 |
| P1-10 | 同步/更新请求无超时 | ✅ 完成 |
| P1-11 | 已巩固永久退出复习 | ✅ 完成 |
| P1-12 | 跨设备只上不下 | ✅ 完成 |
| P2 | 合规 / 安全 / 稳定性 | ✅ 代码部分完成(法务/后端项见下) |
| P3 | 文档漂移 / 死代码 / 代码卫生 | ✅ 完成(个别项见下) |

---

## P0-1 同步指纹每次都变

**根因**:`exportBackup()` 生成的 JSON 带 `exportedAt`(每次调用都不同),自动同步直接对整份
JSON 求哈希 → 指纹永远在变 → 每 60 秒全量 POST;多设备时旧设备稳定覆盖新设备。

**改动**:
- 新增 `domain/hash.ts`(纯函数,零依赖)与 `domain/fingerprint.ts`:
  `businessFingerprint(ownerId, entries)` 只覆盖「归属账号 + 每个业务键的原始值」,按键名排序。
- `backup.ts` 新增 `backupFingerprint()`;`autosync.ts`、`sync.ts`、`markPulled()` 全部改用它。
- `storage/sync-state.ts` 的 `hashString` 改为从 `domain/hash` 再导出。

**证据**:`node scripts/verify-fingerprint.mjs` → **7/7 通过**(含"同一份内容两次得到同一指纹"
"键顺序无关""换 owner 指纹变""null 与空串等价")。

## P0-2 云端读取失败 → 自动覆盖云端

**根因**:`planLoginSync()` 里 `catch { remote = null }`,把**读取失败**当成**云端没有备份**,
于是本机有数据时进入 `auto: 'upload'` 分支,登录即覆盖云端且无提示。

**改动**:
- 决策逻辑抽成纯函数 `domain/login-sync.ts` 的 `decideLoginSync()`:
  **读取失败 → 一律 `auto: null`(问用户)**,绝不 fallback 到上传。
- `planLoginSync()` 捕获异常后把原因放进 `remoteError`,交给决策函数;类型也加了 `remoteError` 字段。

**证据**:`node scripts/verify-login-sync.mjs` → **8/8 通过**,其中三条是 P0-2 回归:
「本机有 20 词 + 读云端失败」「+ 远端其实有 50 词」「本机空 + 读云端失败」全部返回 `null`(问用户)。

## P0-3 Release 用 debug 证书签名

**根因**:`android/app/build.gradle` 的 `release` 构建类型写成 `signingConfig signingConfigs.debug`,
而 debug keystore 是 AOSP 公开证书(密码 `android`),任何人都能签出同包名同签名的"更新包"。

**改动**:
- 生成正式密钥库 `.artifacts/signing/release.keystore`(RSA 2048,10000 天,
  `CN=Article Reading, O=Justin Emils`),密码写在 `.artifacts/signing/keystore.properties`;
  **两者都在 `.artifacts/` 下,已被 gitignore**;`.gitignore` 另加了 `*.keystore` / `*.jks` / `keystore.properties`。
- 新增 `scripts/patch-release-signing.ps1`(幂等):给 `build.gradle` 注入
  `signingConfigs.release` + `release` 构建类型的三元表达式;每次 prebuild 之后跑一次
  (prebuild 会重新生成 android/,所以不能直接改)。

**证据**:`apksigner verify --print-certs`:
- 修复前:`CN=Android Debug, OU=Android, ...`
- 修复后:`CN=Article Reading, O=Justin Emils, ...` ✅

**⚠️ 换签名的代价**:与已安装的 debug 包签名不同,**不能覆盖安装**,必须先卸载
(会丢本机 AsyncStorage 数据)。迁移方式见 `docs/release-howto.md` 的「换签名迁移」一节。

## P1-1 时间:打卡仍用本机时间 + 校准 URL 拼错 + UI 谎称联网

**根因(三处)**:
1. `storage/checkins.ts` 自己实现了一份 `todayKey()`(设备本机时间),而学习记录用的是校准时间;
2. `domain/clock.ts` 校准地址拼成 `${REST_BASE}/auth/v1/health`(= `/rest/v1/auth/v1/health`),
   实测 **404**,只因 404 响应也带 `Date` 头"碰巧"能用;且没检查 `res.ok`;
3. 账号页「时间来源」写死 `联网校准`,未校准时也这么显示。

**改动**:
- `todayKey` 收敛到 `domain/clock.ts` 一处;`checkins.ts`、`learning.ts` 改为
  `import { todayKey }` + `export { todayKey }`(保持调用方不变),`remote-articles.ts` 的
  `dateKey()` 改为调用 `clock.todayKey()`。
- `clock.ts`:改用 `${SUPABASE_URL}/auth/v1/health`,并**检查 `res.ok`**,非 2xx 明确返回失败。
- 账号页:`value={clockVerified() ? '已联网校准' : '本机时间'}`。

**证据**(真实请求):
```
旧(错误) /rest/v1/auth/v1/health  → HTTP 404（现在会被判失败）
新(修正) /auth/v1/health          → HTTP 200 · Date=Sat, 31 Oct 2026 13:43:51 GMT
```

---

## 复现/验收命令

```powershell
node scripts/verify-fingerprint.mjs    # P0-1
node scripts/verify-login-sync.mjs     # P0-2
node scripts/verify-email.mjs          # B1(之前批次)
npx tsc --noEmit; npx eslint src
apksigner verify --print-certs 考研英语阅读-v1.1.16.apk   # P0-3
```

---

## P1-2 按词汇量标蓝(核心卖点)

**根因**:`isStudyCandidate(word, userVocab)` 里 `void userVocab` —— 参数被丢弃,
判定只取决于"是否在考研词表 + 词频名次 ≥ 4500"。1500 词与 9500 词的用户看到完全相同的蓝词。

**改动**:新增 `domain/marking.ts` 的 `shouldMarkAsStudy()`:
低于水平 300 词余量不标、认识概率 ≥0.85 不标、其余标;没有画像时退回旧口径。
`wordlevel.isStudyCandidate` 改为调用它(可选传入 `pKnown`,页面可传曲线函数)。

**证据**:`node scripts/verify-marking.mjs` → **17/17**。关键用例:
`abandon`(门槛≈1201)@1500 词 → 标,@3000/@9500 → 不标;两个用户结论**不同**(修复前相同)。

## P1-3 远程文章整批替换

**根因**:`saveRemoteArticles` 整份替换 → 旧文章消失 → 「累计读完」缩水、生词来源丢失。

**改动**:新增 `domain/article-merge.ts`(`mergeRemoteArticles` / `countNewArticles`),
按 id 合并、新内容优先、旧文章保留到上限 200;`saveRemoteArticles` 改为合并写入并返回新增篇数。

**证据**:`node scripts/verify-article-merge.mjs` → **12/12**(旧文章保留、去重、上限淘汰)。

## P1-4 清空生词本清不干净

**根因**:`clearWords()` 只删 `readingapp.words.v1`,而 `learning` / `known` / `reviewstats`
仍保留"这个词已学/已会" → 清空后这些词永远不会再被标蓝。

**改动**:`learning.clearLearning()`、`review-stats.clearReviewStats()`(同时清内存缓存)、
`domain/reset.ts` 的 `clearAllLearningData()`;设置页改用它,确认框写明"删哪些、不影响哪些"。

## P1-5 备份导入不是覆盖 + 需重启

**根因**:只 `multiSet`,备份里没有的键会保留本机旧值;也不校验值是否合法 JSON;
导入后内存缓存不更新,所以提示"请重启 App"。

**改动**(`importBackup`):① 先整体校验每个值 `JSON.parse`,失败则中止且不改本机;
② 先写新值、再 `multiRemove` 备份里没有的键(覆盖语义,且避免中途失败清空数据);
③ 导入后调用 `domain/rehydrate.ts` 的 `rehydrateAfterImport()`(归属/同步基线/复习统计/时钟/主题)热生效。

## P1-6 云端恢复后不建基线

**根因**:`restoreFromCloud` 只 `importBackup` + `bindLocalOwner`,没写 sync-state → 自动同步一直卡在"首次同步方向未定"。

**改动**:恢复成功后 `saveSyncState({ lastHash: await backupFingerprint(), lastPulledAt: now() })`;
同时把 autosync 的提示文案改成账号页真实存在的按钮(「立即同步」/「从云端恢复」)。

## P1-7 读完判定过松

**根因**:末段露出 40% 即 `finishArticle()` —— 短文章打开即完成。

**改动**:阈值提到 60%;完成条件改为"所有段落都进过视口 **且** 打开已超过 8 秒";
另加"滑到底停留 3 秒"通道(`onScroll` 检测 near-bottom + 计时);
底部手动按钮保留为兜底。

## P1-8 连点竞态

**改动**(四处同步锁):
- `review.gradeCurrent`:useRef 锁,避免同一旧词重复写库 + 重复记曲线样本;
- `assessment.answer`:250ms 锁,避免同一个词被记两次答案;
- `word/[word].handleToggleMastered`:锁 + finally 释放,避免掌握状态抖动;
- `dict-card.handleSave`:锁 + finally,避免快速连点 toggle 两次(等于没收藏)。

## P1-9 「每日复习 N 词」死设置

**改动**:`startReview` 读取 `settings.dailyGoal.reviewWords` 并截断本次会话,
剩余放进 `overflow`;完成页出现「继续复习剩余 N 词」。

## P1-10 请求无超时

**改动**:新增 `domain/net.ts` 的 `fetchWithTimeout`(含 `TimeoutError`);
`sync.rest()` 10 秒、`update.fetchLatest()` 8 秒。超时给出可行动文案。

## P1-11 已巩固永久退出复习

**改动**:`srs.isDue` 只把 `ignored`(用户主动"我会了")排除,`mastered` 按超长间隔回来;
`INTERVAL_DAYS` 扩到 `[1,2,4,7,15,30,60,120,240]`;`stageOf` 新增 `'ignored'` 阶段,
`WORD_STAGE_LABEL`/`WORD_STAGE_HINT` 区分「已巩固」与「已忽略」;
生词本排序把已忽略排最后。

## P1-12 跨设备只上不下

**改动**:`sync.getRemoteUpdatedAt()`(只取 `updated_at`,不下载 payload);
`maybeAutoSync` 上传前比对:云端时间比本机基线新 5 秒以上 → **不自动上传**,
返回 blocked 并提示"云端有更新的数据,请选择从云端恢复或立即同步"。

---

## 验证汇总(全部可执行)

```powershell
node scripts/verify-fingerprint.mjs     # 7
node scripts/verify-login-sync.mjs      # 8
node scripts/verify-marking.mjs         # 17
node scripts/verify-article-merge.mjs   # 12
node scripts/verify-email.mjs           # 31
npx tsc --noEmit ; npx eslint src       # 0 errors / 0 warnings
```


---

## P2(代码部分)

| 项 | 处置 | 证据 |
|---|---|---|
| P2-11 存储损坏被当空数据 | 新增 `storage/safe-read.ts`:`readJsonSafe` 区分"没有数据"与"解析失败",损坏时把原值另存 `readingapp.corrupt.<key>.<ts>` 并**抛错**(写操作随之中止);`getWords` 已接入 | `npx tsc` 通过;逻辑见文件头注释 |
| P2-12 白屏/无崩溃记录 | 新增 `components/error-boundary.tsx`(捕获渲染异常 + 重试 + 写 `readingapp.crashlog.v1` 最多 20 条),在 `_layout` 包裹整个 App | 已挂载于根布局 |
| P2-1 隐私政策/协议缺失 | 新增 `/legal` 页(隐私政策、用户协议、**数据出境说明**),设置页入口;文中如实写"自助注销尚未提供" | 页面可访问 |
| P2-3b Auto Backup | `app.json` → `android.allowBackup: false` | 配置已生效 |
| P2-3d 多余权限 | `app.json` → `android.blockedPermissions` 屏蔽 SYSTEM_ALERT_WINDOW / READ_EXTERNAL_STORAGE / WRITE_EXTERNAL_STORAGE | 配置已生效 |
| P2-14 依赖漏写 | `package.json` 补 `expo-file-system`(被 avatar.ts import 但没声明) | 依赖数 29 |
| P2-6 登录错误枚举 | 登录错误已是统一文案「邮箱或密码不正确」;注册仍会暴露"已注册",需邮箱验证才能彻底解决 | 见 api.ts |
| P3 死代码 | 删除 `estimateFromPick`、`summarizeGrades`/`SessionSummary`、`fitLabel`/`coverageAt`/`unknownTokenRate`、`isKaoyanHighlightWord`、`resetCorpusStatus`、`clearSyncState`、`getWordById`;删 `src/data/_check.txt` | tsc 0 错误 |
| P3 口径不一致 | `countByStatus` 改用校准时间;`analytics.masteredCount` 与首页统一(含 ignored);`pushBackup` 的 device 改 `Platform.OS` | — |
| P3 多处文档漂移 | README"数据全部本地"→ 离线优先+可选云同步;account 页"同步/导出含头像"→ 不含图片头像;`supabase/schema.sql` 标注废弃、指向 `docs/supabase-setup.sql` | — |
| P3 多选跨筛选残留 | 切换筛选时清空已选 | — |

**受限于外部条件、未完成的项(如实记录)**

| 项 | 为什么没做 | 需要什么 |
|---|---|---|
| P2-2 账号注销 | 需要服务端删除用户的能力(Supabase 需 Edge Function / service_role,客户端拿不到) | 后端加一个删除接口;当前 `legal` 页已写"人工删除" |
| P2-3a Token 存 SecureStore | 需要新增 `expo-secure-store` 依赖并重新安装 | `npx expo install expo-secure-store`(需联网) |
| P2-3c Release 开 R8/minify | 开启后需配套 proguard 规则,当前构建未验证过,贸然开会让线上崩溃 | 单独一轮构建验证 |
| P2-9 应用内自动更新 | 需 `REQUEST_INSTALL_PACKAGES` + FileProvider + 签名一致性,当前走浏览器下载 | 产品决策 |
| P2-13 CI | 加 `.github/workflows` 需要 token 的 `workflow` 权限(当前被 GitHub 拒绝) | 网页创建或换 token |
| P2-15 版本 tag | 已在本地打 tag,推送受网络影响 | 网络恢复后 `git push --tags` |
| 5.3 功能缺口(TTS/提醒/报告/错题/搜索/字号持久化/撤销) | 每项都是独立功能,不属于"修复缺陷" | 排期 |
| 5.1 法务文本 | `legal` 页是**草稿**,上线前需法务审阅 | 法务 |


---

## 第二轮补充(1.1.18 / 1.1.19)

| 项 | 处置 | 证据 |
|---|---|---|
| **发音 / TTS**(报告列为第一优先级缺口) | 新增 `domain/speech.ts`(expo-speech,en-US、词速 0.85、先 stop 再 speak);点词卡片、词条详情、复习卡三处 🔊 可点 | 三处 `speak(` 调用点;包内已含 expo-speech |
| **生词搜索** | 生词本顶部搜索框,按英文/中文/英文释义过滤 | `words.tsx` 的 `search` 状态 + `visible` 过滤 |
| **字号持久化** | `settings.fontSize` + `saveFontSize()`;阅读页挂载读取、A± 写回 | 独立 useEffect 读取,避免污染 Promise.all |
| **删除云端数据**(P2-2 可落地部分) | `sync.deleteCloudData()` 删除 backups / profiles 行并清空同步基线;账号页新增入口,文案如实说明"登录身份需人工删除" | 账号页「删除云端学习数据」 |
| **Token 存安全存储**(P2-3a) | `storage/session.ts` 改用 `expo-secure-store`,自动从旧 AsyncStorage 迁移并删除明文;SecureStore 超限时回退 AsyncStorage(保证能登录) | 包内含 secure_store 备份/提取规则 |
| **CI**(P2-13) | `docs/ci/ci.yml` 模板:tsc + eslint + 5 个 verify 脚本(75 项断言) | 模板已入库(推 `.github/workflows` 需 workflow 权限) |
| **R8 / minify**(P2-3c) | **试了,决定不开**:构建能过,但包体 48.66→48.84 MB(反而略增),且无法真机验证混淆是否破坏运行时。交付版保持 R8 关闭,1.1.18 仅作试验包 | 两版体积对比 |

**仍未做(需要决策或服务端能力)**:账号注销(需 Edge Function/service_role)、应用内自动更新、TTS 语速/口音设置、复习提醒(需 expo-notifications)、学习报告/错题本、撤销、法务文本定稿。


## 第三轮(1.1.20)

| 项 | 处置 |
|---|---|
| **发音排版重做**(按反馈) | 音标小字在下、发音按钮在右;按钮用 `@expo/vector-icons` 的 Feather `volume-2`(细线条,与衬线主题协调)+ 主题色描边小底,替掉 emoji 🔊。词条卡片 / 词条详情 / 复习卡三处统一 |
| **每日复习提醒** | 新增 `domain/reminders.ts`(expo-notifications 本地通知):三档时间 08/12/20 点、**只在该时间有到期词时才排**、复习完成后自动重排;权限被拒时界面如实提示。设置页新增「复习提醒」区块 |
| 依赖 | 新增 `@expo/vector-icons`、`expo-notifications`;app.json 自动加 `expo-notifications` 插件(带 POST_NOTIFICATIONS 权限) |


---

## 第四轮(1.1.21):音标缺失修复

**现象**:大量词条显示「暂无音标」,包括 abandon / ability / abnormal 这类基础词。

**根因(两层,都是"丢弃"而不是"没有")**
1. `scripts/fetch-ecdict-kaoyan.py` 用一个极窄的字符白名单校验音标,不合格就置空。
   但 ECDICT 用的是**西里尔形近字**:`ә`(U+04D9)而非 `ə`(U+0259)、`є` 而非 `ɛ`、
   ASCII `:` 而非 `ː`、`'` 作为重音符号。于是 4434/6798(65%)音标被误判丢弃。
   实测证据:ky 词条抽样 4801 条里 4794 条**有**音标,只是 3131 次 `ә` + 1254 次 `:` 不在白名单里。
2. 词典合并时三层数据(ext-words → CORE_DICT → 文章重点词)后两层覆盖释义时
   **没有 phonetic 字段**,把底层音标一起盖掉;`CORE_DICT` 本身 0 音标(267 条全无),
   所以 the / and 这类最常用的词反而是"暂无音标"。

**修复**
- 新增 `scripts/patch-phonetics.py`:把 ECDICT 音标**归一化**(形近字映射、去 `[]/()`、多写法取第一个)
  后回填 ext-words,只改 phonetic 字段(最小 diff);
- 新增 `scripts/gen-phonetics.py` → `src/data/phonetics.ts`(7706 条 / 202 KB,统一音标表):
  覆盖 ext-words ∪ CORE_DICT ∪ 文章重点词 ∪ 文章正文词 ∪ 考研词形表;
  空格/连字符复合词用部件拼接;派生词按英语音变规则推导
  (`-ed` /d t ɪd/、`-s` /s z ɪz/、`-ing` /ɪŋ/、`-ly` /li/、`-ness` /nəs/、`-ment` /mənt/、`-er` /ə/、`-est` /ɪst/,词根以 ə/ɜ/ɑ 结尾时补连接 r);
- `domain/dictionary.ts`:合并完成后统一用 `PHONETICS` 兜底补齐音标,并导出 `getPhonetic(word)`
  (归一化 + 词形还原),供「未收录词」卡片使用;
- UI:dict-card 与词条详情改用 `entry.phonetic ?? getPhonetic(...)`;真没有音标时**不再显示「暂无音标」**
  (只留发音按钮),不再是满屏占位文字;
- 顺手修好 `fetch-ecdict-kaoyan.py` 的归一化逻辑,以后重新生成不会再丢音标。

**证据**
```
node scripts/verify-phonetics.mjs  → 15/15
  ext-words 覆盖率 99.0%(6797 条中 6726 条有音标;修复前 35%)
  CORE_DICT 239 条全部可查音标
  文章重点词 174 个 100% 有音标
  无西里尔形近字 / 无 ASCII 冒号 / 无包裹符号 / 无「词根(后缀)」占位
  抽样:abandon=əˈbændən · the=ðə · and=ænd · cheaper=tʃiːpə · clearest=kliərɪst
```


---

## 第五轮(1.1.22):真机走查(adb)发现的问题

用 `adb` 在小米 14 Pro 上跑 1.1.20 实测(截图 + uiautomator 树 + logcat),发现并修复:

| # | 现象(实机证据) | 根因 | 修复 |
|---|---|---|---|
| 1 | 文章库公版卡标题是残句:`Across courtesy white palaces fashionable E…`、`I' ve nice place here said eyes flashing ab…` | `annotateBlock(block, bookTitle, …)` **收了书名参数却没用**,标题改成"正文前 8 个词";`titleFromText` 还会拆掉撇号(→ "I' ve") | 用真实书名;撇号保留;并对**已缓存的旧文章**在 `loadRemoteArticles` 里就地修复(书名取自 `credit` 的 `Project Gutenberg · 书名 · Public Domain`) |
| 2 | 复习页自相矛盾:`生词本有 7 词可复习` 配 `只复习到期词 9 个` | `getAllLearningWords()` 只取 new/learning,而 `getDueWords()` 在 P1-11 之后**包含到期的 mastered 词** | 统一为"除 ignored 以外的全部词";到期数==总数时只留一个按钮 |
| 3 | 首页 `继续阅读 · 已读 100%` | `recentReading.find(...)` 没排除已读完 | 优先未读完;全都读完时改称「重读上一篇」 |
| 4 | 「为你挑选」配「太难 · B2+ 需词汇量 5332」自相矛盾 | 库里只有 22 篇内置,不可能总落在 93–96% 区间,但界面不解释 | 低于目标区间时加一句「库里暂时没有更贴合你水平的,这几篇最接近(会偏难)」 |
| 5 | 4460 词的用户被建议「先补 中考水平」 | `roiSuggestion` 只按"每词多认识多少文本"排序,低档词更高频 → 永远胜出,没排除低于用户水平的档位 | 只考虑 `threshold > vocab - 300` 的档位;全部低于时才兜底 |

**顺带确认(设备实测)**
- 查 `the` 的音标显示 `/ðə/` —— 1.1.21 的核心词表兜底生效(CORE_DICT 以前 0 音标)
- 性能:6894 帧中 5 帧掉帧(0.07%),p50 7ms / p99 15ms,0 missed vsync
- 内存 405 MB(Java 35 / Native 122 / Graphics 52)
- 整段会话 0 崩溃、0 ReactNativeJS 警告

**未改但记录在案的观察**
- 文章库分区计数「2 篇」在主题手写体里"2"形似 `)`,可读性差(字体问题,非逻辑 bug)
- 阅读页封面占掉约 1/2 屏,首段要滑到 1500px 才出现;首次读后可考虑收起封面
- 当 `gainPerWord` 很小(实测 0.006%/词)时,"先补 X 水平"的收益有限,可改成"多读比背词更划算"
