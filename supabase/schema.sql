-- ============================================================
--  考研英语阅读 · Supabase 初始化脚本
--  用法:Supabase 控制台 → 左侧 SQL Editor → New query → 粘贴全文 → Run
--  可重复执行(全部语句都是幂等的)
-- ============================================================

-- ------------------------------------------------------------
-- 1. 用户资料表(昵称、头像)
--    与 Supabase 自带的 auth.users 一对一,只存业务字段
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  nickname   text        not null default '',
  avatar     text        not null default '📚',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- 行级权限:任何人只能碰自己那一行。auth.uid() 由 Supabase 从请求的 token 解析,
-- 客户端改不了,所以即使 App 被反编译也拿不到别人的数据。
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_delete_own" on public.profiles;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles_delete_own" on public.profiles
  for delete using (auth.uid() = id);

-- ------------------------------------------------------------
-- 2. 注册时自动建资料行
--    触发器的意义:客户端注册成功后不必再发一次请求去建行,
--    由数据库保证"每个用户必有资料行"。
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nickname, avatar)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nickname', ''),
    coalesce(new.raw_user_meta_data ->> 'avatar', '📚')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- 3. 云端学习数据(整份备份 JSON,跨设备同步用)
--    一个用户一行,客户端把「导出备份」的 JSON 原样放进来。
--    这样换手机时:登录 → 拉取 → 导入,生词本/进度/设置全部回来。
-- ------------------------------------------------------------
create table if not exists public.backups (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  payload        jsonb       not null default '{}'::jsonb,
  schema_version int         not null default 1,
  device         text,
  updated_at     timestamptz not null default now()
);

alter table public.backups enable row level security;

drop policy if exists "backups_select_own" on public.backups;
drop policy if exists "backups_insert_own" on public.backups;
drop policy if exists "backups_update_own" on public.backups;
drop policy if exists "backups_delete_own" on public.backups;

create policy "backups_select_own" on public.backups
  for select using (auth.uid() = user_id);
create policy "backups_insert_own" on public.backups
  for insert with check (auth.uid() = user_id);
create policy "backups_update_own" on public.backups
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "backups_delete_own" on public.backups
  for delete using (auth.uid() = user_id);

-- updated_at 自动维护,避免客户端时钟不准导致同步判断错乱
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

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------
-- 4. 头像存储桶(可选,但自定义头像要跨设备就必须有)
--    相册选的头像是本地文件,只存在手机上;上传到这里才能换手机也在。
--    桶设为 private:读也要凭 token,配合下面策略做到"私有文件"。
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do nothing;

drop policy if exists "avatars_own_read"   on storage.objects;
drop policy if exists "avatars_own_insert" on storage.objects;
drop policy if exists "avatars_own_update" on storage.objects;
drop policy if exists "avatars_own_delete" on storage.objects;

-- 文件路径约定为 <user_id>/avatar.jpg,所以第一段目录名就是属主
create policy "avatars_own_read" on storage.objects
  for select using (
    bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "avatars_own_insert" on storage.objects
  for insert with check (
    bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "avatars_own_update" on storage.objects
  for update using (
    bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "avatars_own_delete" on storage.objects
  for delete using (
    bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================
--  执行完看到 "Success. No rows returned" 即成功。
--  校验:Table Editor 里应出现 profiles 和 backups 两张表,
--        且表名旁显示 "RLS enabled"。
-- ============================================================
