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

-- Dựng theo ĐÚNG danh sách cột của auth.users trên Supabase hosted, kể cả cột
-- GENERATED. Cột generated là chỗ dễ vấp nhất khi chép dữ liệu giữa hai project
-- (Postgres cấm insert giá trị vào cột generated) — stub phải có thì test ở máy
-- mới bắt được lỗi đó, thay vì để nó nổ trên Supabase thật.
create table if not exists auth.users (
  instance_id                 uuid,
  id                          uuid primary key default gen_random_uuid(),
  aud                         varchar(255),
  role                        varchar(255),
  email                       varchar(255) unique,
  encrypted_password          varchar(255),
  email_confirmed_at          timestamptz,
  invited_at                  timestamptz,
  confirmation_token          varchar(255),
  confirmation_sent_at        timestamptz,
  recovery_token              varchar(255),
  recovery_sent_at            timestamptz,
  email_change_token_new      varchar(255),
  email_change                varchar(255),
  email_change_sent_at        timestamptz,
  last_sign_in_at             timestamptz,
  raw_app_meta_data           jsonb default '{}'::jsonb,
  raw_user_meta_data          jsonb default '{}'::jsonb,
  is_super_admin              boolean,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz,
  phone                       text unique default null,
  phone_confirmed_at          timestamptz,
  phone_change                text default '',
  phone_change_token          varchar(255) default '',
  phone_change_sent_at        timestamptz,
  confirmed_at                timestamptz generated always as (least(email_confirmed_at, phone_confirmed_at)) stored,
  email_change_token_current  varchar(255) default '',
  email_change_confirm_status smallint default 0,
  banned_until                timestamptz,
  reauthentication_token      varchar(255) default '',
  reauthentication_sent_at    timestamptz,
  is_sso_user                 boolean not null default false,
  deleted_at                  timestamptz,
  is_anonymous                boolean not null default false
);

-- identities cũng có một cột generated (email lấy ra từ identity_data).
create table if not exists auth.identities (
  provider_id     text not null,
  user_id         uuid not null references auth.users (id) on delete cascade,
  identity_data   jsonb not null,
  provider        text not null,
  last_sign_in_at timestamptz,
  created_at      timestamptz,
  updated_at      timestamptz,
  email           text generated always as (lower(identity_data ->> 'email')) stored,
  id              uuid primary key default gen_random_uuid(),
  unique (provider_id, provider)
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
