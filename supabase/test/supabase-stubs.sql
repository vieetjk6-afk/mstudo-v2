-- Stub tối thiểu để chạy thử SQL của dự án trên Postgres thường.
-- Mô phỏng đúng những gì Supabase cung cấp sẵn: role, schema auth/storage,
-- bảng auth.users, storage.buckets/objects và các hàm auth.uid()/auth.role().
-- KHÔNG dùng cho production — chỉ để bắt lỗi thứ tự / tham chiếu cột.

create extension if not exists "pgcrypto";

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then create role supabase_auth_admin nologin; end if;
end $$;

create schema if not exists auth;
create schema if not exists storage;
create schema if not exists extensions;

create table if not exists auth.users (
  id                  uuid primary key default gen_random_uuid(),
  email               text,
  raw_user_meta_data  jsonb default '{}'::jsonb,
  created_at          timestamptz not null default now()
);

-- Supabase lấy user id từ JWT; ở đây trả null là đủ để câu lệnh hợp lệ.
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create or replace function auth.role() returns text language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon');
$$;

create table if not exists storage.buckets (
  id                 text primary key,
  name               text not null,
  public             boolean not null default false,
  file_size_limit    bigint,
  allowed_mime_types text[],
  created_at         timestamptz not null default now()
);

create table if not exists storage.objects (
  id         uuid primary key default gen_random_uuid(),
  bucket_id  text references storage.buckets (id),
  name       text,
  owner      uuid,
  metadata   jsonb,
  created_at timestamptz not null default now()
);
alter table storage.objects enable row level security;

grant usage on schema auth, storage, public to anon, authenticated, service_role;
create publication supabase_realtime;
