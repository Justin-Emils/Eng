# 怎么发一个版本(让「检查更新」能发现它)

> 一句话:**App 只看 GitHub 的 Release,不看 tag、不看 git log。**
> 所以"我推送了代码"不等于"用户能检查到新版本"——必须建一个 Release 并挂上 APK。

---

## 0. 先搞清楚三个东西的区别

| 东西 | 谁会看 | 不建会怎样 |
|---|---|---|
| **git commit / push** | 开发者 | 用户完全无感 |
| **git tag `v1.1.14`** | 开发者、`git describe` | Git 页面能看到 tag,但**不会出现在 releases 列表里** |
| **GitHub Release(挂 APK)** | **App 的检查更新** | 检查结果永远是"已是最新" |

App 的判定逻辑(`src/domain/update.ts`):

```
GET https://api.github.com/repos/Justin-Emils/Eng/releases
取"非 draft、非 prerelease"里版本号最大的一个
若 它 > 当前 App 版本  → 弹「发现新版本」
否则                  → 「已是最新版本(当前版本)」
```

**下载地址** = 该 Release 里**第一个以 `.apk` 结尾的附件**;
没有附件就退回 Release 页面本身。

---

## 1. 准备 APK(本机)

构建完成后产物在:

```
E:\code\Eng\article-reading\考研英语阅读-v1.1.14.apk
```

同一个文件也有一份在 `.artifacts\serve2\Eng-v1.1.14.apk`(局域网下载用),
**上传 GitHub 用哪个都行**(两者内容相同)。

---

## 2. 在 GitHub 网页上建 Release(推荐,不需要 token)

1. 浏览器打开(需要能访问 github.com,国内通常要代理):
   `https://github.com/Justin-Emils/Eng/releases/new`
2. **Choose a tag** 填 `v1.1.14` → 点 **Create new tag: v1.1.14 on publish**
   - 版本号必须和 `app.json` 里的 `version` 一致(App 就是拿它比大小的)
3. **Release title** 填:`v1.1.14 · 检查更新的可用性改进`
4. **Describe this release** 粘贴下面的模板(这段文字会**原样出现在手机弹窗里**)
5. **Attach binaries** 选那个 48 MB 的 `.apk`
   - 文件名最好带版本号,例如 `article-reading-v1.1.14-arm64.apk`
   - **必须以 `.apk` 结尾**,App 靠这个后缀找下载地址
6. 确认 **Set as the latest release** 勾上、**This is a pre-release** 不勾
7. 点 **Publish release**

### 可粘贴的 Release 说明模板

```markdown
- 查询被 GitHub 限流时给出人话提示(每小时 60 次,按网络共享),不再只显示 403
- 「检查更新」一分钟内重复点击会直接提示刚查过,避免把配额刷光
- 更新弹窗新增「复制链接」:github.com 打不开时可以把直链粘到别的工具里下载
- 打开链接失败时自动复制地址并说明原因,不再静默失败
```

> 弹窗只显示前 6 条要点,第一行若是"v版本号 · 标题"会被自动去掉(避免和弹窗标题重复)。

---

## 3. 验证发成功了

**在旧版本设备上**(比如 1.1.13):

1. 我的 → 检查更新 → 应弹「发现新版本 v1.1.14」,带 4 条说明
2. 勾「本次更新前不再提示」→ 去下载 → 再次点检查更新 → 应提示"新版本已被你跳过"
3. 换回不勾 → 下次启动应自动弹出(6 小时节流,冷启动才查)

**在新版本设备上**(1.1.14):检查更新应显示「已是最新版本(1.1.14)」。

**不开 GitHub 也能验样式**:开发者选项 → 「预览『发现新版本』弹窗」。

---

## 4. 命令行的替代做法(需要 token)

`gh` 没有安装,装了之后:

```powershell
winget install GitHub.cli
gh auth login                       # 浏览器授权一次
gh release create v1.1.14 `
  "E:\code\Eng\article-reading\考研英语阅读-v1.1.14.apk" `
  --title "v1.1.14 · 检查更新的可用性改进" `
  --notes-file .artifacts\release-notes.md
```

或者只推 tag 再回网页补 Release:

```powershell
git tag v1.1.14
git push origin v1.1.14
```

> ⚠️ **只推 tag 不够** —— App 查的是 releases 列表,不是 tags。

---

## 5. 三个已知限制(实测)

| 限制 | 表现 | 现状 |
|---|---|---|
| GitHub API 匿名配额 | 每小时 60 次,**按 IP 共享**(同一 WiFi 下所有设备共用) | 自动检查 6 小时一次;手动检查 60 秒一次;超了给明确提示 |
| `github.com` 国内常打不开 | 「去下载」可能停在超时页 | 弹窗有「复制链接」;打开失败会自动复制地址 |
| 下载走 `objects.githubusercontent.com` | 该域名可达,但要先过 github.com 的跳转 | 同上:复制链接可绕过 |

---

## 6. 每次发版的固定动作

1. 改 `app.json`:`version` +1(补丁位)、`versionCode` +1
2. 在 `src/data/changelog.ts` 顶部加一条(版本号与 `app.json` 一致)
3. `tsc --noEmit` + `eslint src` 必须全绿
4. 构建:`prebuild` → 还原 Gradle 配置 → 补 `splashscreen_logo` → `assembleRelease`
5. 按本文第 2 节发 Release
6. 在旧版本设备上验一次弹窗
