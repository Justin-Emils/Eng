-- =====================================================================
-- 考研英语阅读 · 云端数据库初始化脚本(Supabase)
--
-- 用途:重建在线服务(账号注册 / 登录 / 云同步)。
-- 什么时候需要:换了 Supabase 项目,或旧项目被删除/暂停后需要重建。
--
-- 怎么用:
--   1. 打开 https://supabase.com/dashboard → New project
--   2. 左边 SQL Editor → New query → 整份粘贴 → Run
--   3. 把项目 URL 与 anon(publishable)key 填进 App:
--        src/config/backend.ts 的 FALLBACK_URL / FALLBACK_KEY
--      或构建前设环境变量 EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_KEY
--   4. Authentication → Providers → Email:按需设置
--        - 想"注册即可用"(国内收信不可靠):关掉 Confirm email
--        - 想真实校验:保持开启,记得配 SMTP
--
-- 说明:App 只用两张表,字段与 src/domain/sync.ts 一一对应。
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- 1. 学习数据备份表(App 里"上传 / 恢复 / 自动同步"用的就是它)
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.backups (
  -- 与 auth.users.id 一致:一个账号只有一份备份(表主键 = upsert 的依据)
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- 整份备份(备份文件里的 payload 原样存进来)
  payload jsonb not null,
  -- 备份格式版本,将来改结构时用于兼容
  schema_version int not null default 1,
  -- 来源设备(目前固定 'android',留着以后区分)
  device text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.backups is '每个账号一份学习数据备份(生词/进度/设置),整份 JSON';

-- 更新时间自动维护:App 里不显式写 updated_at,靠触发器补
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists backups_touch_updated_at on public.backups;
create trigger backups_touch_updated_at
  before update on public.backups
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────
-- 2. 个人资料表(昵称 / 头像,换手机登录也要带得走)
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text,
  -- 头像:目前存的是 emoji 或短标识,不是图片文件
  avatar text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is '昵称与头像(emoji 或短标识),与 auth.users 一对一';

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────
-- 3. 行级权限(RLS)—— 这是数据安全的核心
--
-- 原则:**只能读写自己的行**。客户端带的 key 是公开的,
-- 真正的隔离靠下面这些策略 + auth.uid()。
-- ─────────────────────────────────────────────────────────────────────
alter table public.backups  enable row level security;
alter table public.profiles enable row level security;

-- backups:四种操作全部限定 user_id = auth.uid()
drop policy if exists "backups_select_own" on public.backups;
create policy "backups_select_own" on public.backups
  for select using (auth.uid() = user_id);

drop policy if exists "backups_insert_own" on public.backups;
create policy "backups_insert_own" on public.backups
  for insert with check (auth.uid() = user_id);

drop policy if exists "backups_update_own" on public.backups;
create policy "backups_update_own" on public.backups
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "backups_delete_own" on public.backups;
create policy "backups_delete_own" on public.backups
  for delete using (auth.uid() = user_id);

-- profiles:同上,只认 id = auth.uid()
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own" on public.profiles
  for delete using (auth.uid() = id);

-- ─────────────────────────────────────────────────────────────────────
-- 4. 索引(数据量很小,这两个是为"按用户查"这条唯一查询路径准备的)
-- ─────────────────────────────────────────────────────────────────────
create index if not exists backups_updated_at_idx on public.backups (updated_at desc);

-- ─────────────────────────────────────────────────────────────────────
-- 5. 自检:跑完这段应该返回两行,且都显示 rowsecurity = true
-- ─────────────────────────────────────────────────────────────────────
select tablename, rowsecurity
from pg_tables
where schemaname = 'public' and tablename in ('backups', 'profiles')
order by tablename;
