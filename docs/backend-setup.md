# 在线账号服务配置(Supabase)

App 的注册 / 登录 / 改密 / 忘记密码 / 云端数据同步全部由 Supabase 承担,
客户端只调用它的 HTTP 接口,**不需要自己写任何后端代码、不需要买服务器**。

## 一次性的 6 步

### 1. 注册

打开 https://supabase.com → `Start your project` → 用 GitHub 账号登录最省事
(没有 GitHub 就用邮箱注册)。免费版无需信用卡。

### 2. 建项目

`New project`:

| 字段 | 填什么 |
|---|---|
| Name | `eng-reading` |
| Database Password | 点 `Generate a password` 生成后**存到密码管理器**;App 用不到它,但以后想直连数据库要用 |
| Region | `Southeast Asia (Singapore)`(国内延迟最低,其次 `Northeast Asia (Tokyo)`) |

建好后等 1~2 分钟,状态从 `Setting up project` 变成绿色 `Active`。

### 3. 关掉邮箱验证(注册后立即可用)

`Authentication` → `Sign In / Providers` → 展开 `Email` → 关闭 `Confirm email` → `Save`。

> 关闭后:注册即可登录,不消耗邮件额度,国内也不依赖收邮件。
> 忘记密码功能**不受影响** —— 它走的是另一条 `recover` 邮件通道。

### 4. 拿到 App 需要的两个值

- **Project URL**:`Project Settings` → `Data API` → `Project URL`,形如 `https://abcdefgh.supabase.co`
- **公开密钥**:`Project Settings` → `API Keys`
  - 新项目显示为 **`Publishable key`**(`sb_publishable_...`)
  - 老项目显示为 **`anon` `public`**(`eyJhbGci...` 一长串 JWT)
  - 两者都可以,任选其一复制

> ⚠️ **`service_role` / `Secret key` 绝对不要发给任何人**(包括 AI、包括贴进代码)。
> 它绕过所有行级权限,等于数据库管理员密码。本项目只需要公开密钥。

### 5. 建表

左侧 `SQL Editor` → `New query` → 粘贴本仓库 `supabase/schema.sql` 全文 → `Run`。

看到 `Success. No rows returned` 即成功。`Table Editor` 里会出现 `profiles`、`backups`
两张表并标注 `RLS enabled`。

### 6. 配置忘记密码的邮件验证码

`Authentication` → `Emails`(老版本叫 `Email Templates`)→ `Reset Password` 模板,
把正文替换为下面内容并保存。关键是 **`{{ .Token }}`** —— 它让邮件里带 6 位数字验证码,
用户在 App 里直接输入即可重置,不需要点链接、不需要配置回调网址:

```html
<h2>重置你的密码</h2>
<p>验证码:<strong style="font-size:24px;letter-spacing:4px">{{ .Token }}</strong></p>
<p>10 分钟内有效。如果不是你本人操作,忽略本邮件即可。</p>
```

免费版自带邮件通道有限速(每小时个位数封),自用足够;若想放宽,可在
`Project Settings` → `Auth` → `SMTP Settings` 接自己的邮箱服务。

## 安全与额度说明

- **公开密钥放客户端是设计如此**。它只代表"我是这个 App",能否读到数据由
  `auth.uid()` + RLS 策略决定,偷到密钥也读不到别人的行。
- 免费版:500MB 数据库、5 万月活,自用远远用不完。
- **免费项目连续 7 天无请求会被暂停**(不是删除),控制台点 `Restore` 即可恢复。
  天天用 App 就不会发生。
- 国内访问 `*.supabase.co` 通常正常;若偶发连不上,App 会回退到本地模式继续可用。

## 需要提供给开发者的两样东西

```
Project URL : https://__________________.supabase.co
Publishable : sb_publishable__________________  (或 anon JWT)
```

给了这两样,客户端即可接通全部在线功能。
