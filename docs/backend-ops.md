# 云端服务运维(暂停 / 恢复 / 保活)

> 适用对象:这个 App 的 Supabase 项目 `eng-reading`(ap-southeast-1)。
> 相关文件:`src/config/backend.ts`(地址与公钥)、`docs/supabase-setup.sql`(建库脚本)。

## 1. 现象:登录报「网络连接失败」

先别怀疑自己的网络。按顺序查:

| 检查 | 命令 / 位置 | 结果含义 |
|---|---|---|
| 域名还能解析吗 | `Resolve-DnsName saqgqexmcrygpyyndknt.supabase.co` | `does not exist` → 项目停了/没了 |
| 公共 DNS 一致吗 | 阿里 DoH:`https://dns.alidns.com/resolve?name=<域名>&type=A` | `Status=3` = NXDOMAIN(确认不是本机 DNS 问题) |
| 项目状态 | https://supabase.com/dashboard | `Paused` / 不存在 / 正常 |

**判定**:域名解析不到 + dashboard 显示 `Paused` = **项目被暂停**(不是删除,数据还在)。
域名解析不到 + dashboard 里没有该项目 = 已被删除(数据不可恢复,见第 4 节)。

## 2. 恢复被暂停的项目

1. dashboard → 项目卡片右下角 **⋮** → **Restore project**(或点「Project is paused」提示)
2. 按提示确认(可能要求输入项目名 `eng-reading`)
3. 等 1–5 分钟,dashboard 状态变为 Active/Healthy
4. 回到 App 重新登录(无需重装、无需改配置)

> 暂停期间 Supabase 只保留约 **90 天**,超期会真正删除。所以要尽快恢复。

## 3. 为什么会被暂停 / 怎么不再暂停

免费项目的规则:**约 7 天没有活动就暂停**。
这个 App 的"活动"只发生在**打开 App 且已登录**(自动同步会写一次 `/backups`)。

三种应对,按省事程度排:

### ① 保活 workflow(已配好,推荐)

`docs/ci/supabase-keepalive.yml` —— 每 2 天用 GitHub Actions 打一次
`/auth/v1/health`(不需要密钥,公开端点),让项目保持活跃。

- 公共仓库的 Actions 分钟数**免费**
- 手动触发:Actions → supabase-keepalive → Run workflow
- ⚠️ 两个已知限制:
  - **仓库连续 60 天没有任何提交**,GitHub 会自动停用定时 workflow(GitHub 会提前发邮件)
  - 每天/隔天一次的 ping 只是最小活动量;如果 Supabase 调整规则,以官方为准

### ② 定期打开 App

自动同步会在启动时检查并上传(6 小时节流),也算活动。适合"本来就会用"的情况。

### ③ 升级 Pro

$25/月起,不暂停。自用没必要。

## 4. 如果项目已被删除(数据不可恢复)

云端账号与备份随项目一起消失,本机数据不受影响(App 离线优先)。

重建步骤:

1. dashboard → **New project**(区域建议 `ap-southeast-1` 或 `ap-northeast-1`)
2. SQL Editor → 粘贴 `docs/supabase-setup.sql` → Run
3. Authentication → Providers → Email:
   - **Confirm email 关掉**(国内收信不可靠;关掉后注册即登录)
4. Settings → API 里复制 `Project URL` 与 `anon public key`
5. 改 `src/config/backend.ts` 的 `FALLBACK_URL` / `FALLBACK_KEY`(或构建时设
   `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_KEY`),重新打包
6. 更新本文件的域名(如果项目 ref 变了)与 keepalive workflow 里的地址

## 5. 数据安全边界(重建时别搞错)

- 客户端里的 key 是 **publishable/anon**,公开无害;隔离靠 **RLS**(SQL 里已配好)
- **service_role / secret key 绝不能进客户端**
- 备份是"整份 JSON 覆盖",没有增量合并 —— 冲突策略见登录时的方向选择
