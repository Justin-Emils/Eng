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
| P1-2 | "按词汇量标蓝"未实现 | ⏳ |
| P1-3 | 每日远程文章整批替换致统计缩水 | ⏳ |
| P1-4 | 清空生词本清不干净 | ⏳ |
| P1-5 | 备份导入不是覆盖 + 需重启 | ⏳ |
| P1-6 | 云端恢复后不建同步基线 | ⏳ |
| P1-7 | 读完判定过松 | ⏳ |
| P1-8 | 连点竞态(复习重复记账 / 评估重复答题) | ⏳ |
| P1-9 | "每日复习 N 词"是死设置 | ⏳ |
| P1-10 | 同步/更新请求无超时 | ⏳ |
| P1-11 | 已巩固永久退出复习 | ⏳ |
| P1-12 | 跨设备只上不下、整份覆盖 | ⏳ |
| P2 | 合规 / 安全 / 稳定性 / 商业成熟度 | ⏳ |
| P3 | 文档漂移 / 死代码 / 代码卫生 | ⏳ |

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
