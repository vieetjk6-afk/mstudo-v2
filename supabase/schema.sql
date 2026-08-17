-- ============================================================================
-- Vieetjk Photo Collection — Supabase schema
-- Run this in the Supabase SQL Editor (or via the CLI) once per project.
-- ============================================================================

-- Extensions ----------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ============================================================================
-- profiles: one row per authenticated user (admin or photographer)
-- ============================================================================
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text not null,
  full_name     text,
  role          text not null default 'photographer'
                  check (role in ('admin', 'photographer')),
  -- per-photographer limits / permissions
  max_albums    integer,                 -- null = unlimited (hard total cap)
  monthly_album_limit integer default 5, -- albums creatable per calendar month (null = unlimited)
  can_zip       boolean not null default false, -- may customers download (ZIP)?
  can_notes     boolean not null default false, -- may customers add notes?
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);
-- For databases created before these existed:
alter table public.profiles add column if not exists monthly_album_limit integer default 5;
alter table public.profiles add column if not exists can_notes boolean not null default false;
alter table public.profiles alter column can_zip set default false;

-- ============================================================================
-- albums
-- ============================================================================
create table if not exists public.albums (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references public.profiles (id) on delete cascade,
  slug            text not null unique,
  title           text not null,
  description     text,
  cover_url       text,
  -- album access password (bcrypt hash, nullable = no password)
  password_hash   text,
  -- max photos a customer may select (null = unlimited)
  selection_limit integer,
  watermark_enabled boolean not null default false,   -- tự chọn: studio tự bật (xem migrations/watermark_opt_in.sql)
  watermark_text  text,   -- null → app falls back to the studio's own name
  status          text not null default 'draft'
                    check (status in ('draft', 'published')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists albums_owner_idx on public.albums (owner_id);

-- ============================================================================
-- album_sources: each album can have several Google Drive sources (groups),
-- which can be displayed separately or merged together.
-- ============================================================================
create table if not exists public.album_sources (
  id          uuid primary key default gen_random_uuid(),
  album_id    uuid not null references public.albums (id) on delete cascade,
  name        text not null default 'Untitled',
  drive_url   text not null,
  kind        text not null default 'file' check (kind in ('file', 'folder')),
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists album_sources_album_idx on public.album_sources (album_id);

-- ============================================================================
-- photos: individual images resolved from sources
-- ============================================================================
create table if not exists public.photos (
  id            uuid primary key default gen_random_uuid(),
  album_id      uuid not null references public.albums (id) on delete cascade,
  source_id     uuid references public.album_sources (id) on delete cascade,
  drive_file_id text not null,
  name          text not null default '',
  position      integer not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists photos_album_idx on public.photos (album_id);
create unique index if not exists photos_album_file_uidx
  on public.photos (album_id, drive_file_id);

-- ============================================================================
-- selections: photos chosen by customers (no login required).
-- A customer "session" is identified by a client-generated session_id.
-- ============================================================================
create table if not exists public.selections (
  id               uuid primary key default gen_random_uuid(),
  album_id         uuid not null references public.albums (id) on delete cascade,
  photo_id         uuid not null references public.photos (id) on delete cascade,
  photo_name       text not null default '',
  session_id       text not null,
  client_name      text,
  client_note      text,            -- note left by the customer on this photo
  photographer_note text,           -- note added by the photographer
  created_at       timestamptz not null default now(),
  unique (album_id, photo_id, session_id)
);
create index if not exists selections_album_idx on public.selections (album_id);
create index if not exists selections_session_idx on public.selections (album_id, session_id);

-- For databases created before client notes existed:
alter table public.selections add column if not exists client_note text;

-- Enable Supabase Realtime on selections (live updates on the photographer's
-- dashboard). Idempotent — only adds the table if not already published.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'selections'
  ) then
    alter publication supabase_realtime add table public.selections;
  end if;
end $$;

-- ============================================================================
-- dislikes: photos the customer explicitly does NOT want (selection albums).
-- Bấm "không thích" → ảnh ẩn khỏi lưới chọn, chuyển sang tab riêng; studio dùng
-- danh sách này để xoá file trên link Drive gốc nếu khách yêu cầu.
-- Bảng riêng để danh sách "khách chọn" (Lọc ảnh, ZIP, thông báo) không lẫn ảnh
-- bị loại. Xem supabase/migrations/album_dislikes.sql.
-- ============================================================================
create table if not exists public.dislikes (
  id           uuid primary key default gen_random_uuid(),
  album_id     uuid not null references public.albums (id) on delete cascade,
  photo_id     uuid not null references public.photos (id) on delete cascade,
  photo_name   text not null default '',
  session_id   text not null,
  client_note  text,
  created_at   timestamptz not null default now(),
  unique (album_id, photo_id, session_id)
);
create index if not exists dislikes_album_idx on public.dislikes (album_id);
create index if not exists dislikes_session_idx on public.dislikes (album_id, session_id);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'dislikes'
  ) then
    alter publication supabase_realtime add table public.dislikes;
  end if;
end $$;

-- ============================================================================
-- album_shares: short-token links to a hand-picked subset of an album's photos.
-- Lets "share N selected photos" produce a short URL (?s=token) instead of
-- cramming every photo id into the query string.
-- ============================================================================
create table if not exists public.album_shares (
  token       text primary key,
  album_id    uuid not null references public.albums (id) on delete cascade,
  photo_ids   text[] not null default '{}',
  created_at  timestamptz not null default now()
);
create index if not exists album_shares_album_idx on public.album_shares (album_id);
alter table public.album_shares enable row level security;
-- Đọc qua service-role (trang share dùng createAdminClient). KHÔNG mở đọc công khai:
-- policy using(true) trước đây cho phép anon (bằng anon key) DUYỆT toàn bộ token
-- share của mọi studio. Thu hồi quyền đọc của anon/authenticated.
drop policy if exists album_shares_public_read on public.album_shares;
revoke select on public.album_shares from anon, authenticated;

-- ============================================================================
-- updated_at trigger for albums
-- ============================================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists albums_set_updated_at on public.albums;
create trigger albums_set_updated_at
  before update on public.albums
  for each row execute function public.set_updated_at();

-- ============================================================================
-- New auth user -> profile (default photographer, inactive until admin enables)
-- ============================================================================
-- Trigger này chạy TRONG cùng transaction với insert vào auth.users: nếu nó
-- lỗi thì tài khoản mới KHÔNG được lưu và Supabase trả về
-- "Database error saving new user" → màn hình đăng nhập báo server_error.
-- Vì vậy mọi lỗi tạo hồ sơ chỉ ghi cảnh báo, không chặn việc đăng ký/đăng nhập.
-- Xem thêm supabase/migrations/fix_google_signup_trigger.sql (kèm backfill).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role, is_active)
  values (
    new.id,
    -- profiles.email là NOT NULL, còn auth.users.email có thể null.
    coalesce(new.email, new.raw_user_meta_data ->> 'email', new.id::text),
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      new.email,
      ''
    ),
    'photographer',
    true   -- self-serve: new sign-ups (incl. Google) can create albums right away
  )
  on conflict (id) do nothing;
  return new;
exception
  when others then
    raise warning 'handle_new_user failed for % : % (%)', new.id, sqlerrm, sqlstate;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- Helper: is the current user an admin?
-- ============================================================================
create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_active
  );
$$;

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.profiles       enable row level security;
alter table public.albums         enable row level security;
alter table public.album_sources  enable row level security;
alter table public.photos         enable row level security;
alter table public.selections     enable row level security;
alter table public.dislikes       enable row level security;

-- profiles -------------------------------------------------------------------
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- ── Chống leo thang đặc quyền (C1) ──────────────────────────────────────────
-- RLS chỉ lọc theo DÒNG, không theo CỘT. Nếu để authenticated có UPDATE toàn
-- bảng, một user có thể tự sửa role='admin' / plan / studio_owner_id trên chính
-- dòng của mình qua anon client. Vì vậy: thu hồi UPDATE toàn bảng rồi CHỈ cấp
-- lại các cột cấu hình an toàn. Mọi cột nhạy cảm (role, is_active, plan*,
-- studio_owner_id, studio_role, *_limit, can_*, trial_used_at, referred_by,
-- google_refresh_token) chỉ được sửa qua service-role ở API server.
revoke update on public.profiles from authenticated, anon;
grant update (
  full_name,
  monthly_revenue_target,
  pl_show_clauses,
  booking_token, calendar_token,
  pl_phone, pl_facebook,
  pl_bank_holder, pl_bank_account, pl_bank_name, pl_bank_bin,
  pl_bg, pl_text, pl_accent, pl_logo_url,
  studio_logo_url, studio_brand_name,
  pl_hidden_lists, pl_list_labels,
  auto_client_emails
) on public.profiles to authenticated;

-- albums ---------------------------------------------------------------------
-- Owners (and admins) manage their albums.
drop policy if exists albums_owner_all on public.albums;
create policy albums_owner_all on public.albums
  for all using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

-- album_sources & photos: tied to album ownership ---------------------------
drop policy if exists sources_owner_all on public.album_sources;
create policy sources_owner_all on public.album_sources
  for all using (
    exists (select 1 from public.albums a
            where a.id = album_id and (a.owner_id = auth.uid() or public.is_admin()))
  )
  with check (
    exists (select 1 from public.albums a
            where a.id = album_id and (a.owner_id = auth.uid() or public.is_admin()))
  );

drop policy if exists photos_owner_all on public.photos;
create policy photos_owner_all on public.photos
  for all using (
    exists (select 1 from public.albums a
            where a.id = album_id and (a.owner_id = auth.uid() or public.is_admin()))
  )
  with check (
    exists (select 1 from public.albums a
            where a.id = album_id and (a.owner_id = auth.uid() or public.is_admin()))
  );

-- selections: owners read/update (notes); customer writes happen via the
-- service role through API routes, so no public insert policy is needed.
drop policy if exists selections_owner_rw on public.selections;
create policy selections_owner_rw on public.selections
  for all using (
    exists (select 1 from public.albums a
            where a.id = album_id and (a.owner_id = auth.uid() or public.is_admin()))
  )
  with check (
    exists (select 1 from public.albums a
            where a.id = album_id and (a.owner_id = auth.uid() or public.is_admin()))
  );

-- dislikes: same shape as selections — owners read/delete, customer writes go
-- through the service role in the public API route.
drop policy if exists dislikes_owner_rw on public.dislikes;
create policy dislikes_owner_rw on public.dislikes
  for all using (
    exists (select 1 from public.albums a
            where a.id = album_id and (a.owner_id = auth.uid() or public.is_admin()))
  )
  with check (
    exists (select 1 from public.albums a
            where a.id = album_id and (a.owner_id = auth.uid() or public.is_admin()))
  );

-- ============================================================================
-- Showcase / pinned flags for the public profile homepage
-- ============================================================================
alter table public.albums add column if not exists is_showcase boolean not null default false;
alter table public.albums add column if not exists is_pinned   boolean not null default false;
-- Drop the legacy fixed-brand watermark default; the app now falls back to the
-- studio's OWN name when watermark_text is null.
alter table public.albums alter column watermark_text drop default;
alter table public.albums add column if not exists kind        text;  -- e.g. "Phóng sự cưới"

-- ============================================================================
-- Delivery galleries (vieetjk.com/album) — reuse the albums/sources/photos
-- infrastructure with is_gallery = true. View password = the client's phone.
-- ============================================================================
alter table public.albums add column if not exists is_gallery     boolean not null default false;
alter table public.albums add column if not exists client_name    text;
alter table public.albums add column if not exists client_phone   text;   -- view password; never sent to the public client
alter table public.albums add column if not exists event_date     date;   -- wedding / engagement date
alter table public.albums add column if not exists category        text;   -- cuoi-hoi | su-kien | gia-dinh | video | khac
alter table public.albums add column if not exists category_label text;   -- custom label
alter table public.albums add column if not exists gallery_pinned  boolean not null default false; -- pinned to homepage (no password)
create index if not exists albums_gallery_idx on public.albums (is_gallery, status);

-- Video support + per-account gallery permission + admin-curated featured photos
alter table public.photos add column if not exists is_video boolean not null default false;
alter table public.profiles add column if not exists can_galleries boolean not null default false;
alter table public.site_settings add column if not exists featured_images text[] not null default '{}';
alter table public.albums add column if not exists download_enabled boolean not null default true;

-- ============================================================================
-- Unified project model (gộp Album + Gallery): one album record can carry BOTH
-- a "selection" phase (original photos the client picks from) and a "delivery"
-- phase (finished photos to download). Each Drive source is tagged with its
-- stage; the album exposes one stage at a time to the client via `phase`.
-- Legacy records keep working unchanged: an old album = a project with only
-- selection sources, an old gallery = a project with only delivery sources.
-- ============================================================================
alter table public.album_sources add column if not exists stage text not null default 'selection'
  check (stage in ('selection', 'delivery'));
alter table public.albums add column if not exists phase text not null default 'selection'
  check (phase in ('selection', 'delivery'));
-- Watermark for the delivery phase (selection phase keeps using watermark_enabled).
alter table public.albums add column if not exists watermark_delivery boolean not null default false;

-- Backfill so existing rows behave exactly as before (idempotent):
--   galleries (is_gallery=true) -> phase 'delivery' and their sources -> 'delivery'
--   albums    (is_gallery=false) -> phase 'selection' (the column default)
update public.albums set phase = 'delivery' where is_gallery = true and phase <> 'delivery';
update public.album_sources s set stage = 'delivery'
  from public.albums a
  where s.album_id = a.id and a.is_gallery = true and s.stage <> 'delivery';

create index if not exists album_sources_stage_idx on public.album_sources (album_id, stage);
create index if not exists albums_phase_idx on public.albums (phase, status);

-- ============================================================================
-- feedback: client testimonials for a gallery / the photographer
-- ============================================================================
create table if not exists public.feedback (
  id          uuid primary key default gen_random_uuid(),
  album_id    uuid references public.albums (id) on delete cascade,
  client_name text,
  rating      integer,
  content     text not null,
  approved    boolean not null default true,
  created_at  timestamptz not null default now()
);
alter table public.feedback enable row level security;
-- Public can read approved feedback (homepage / gallery); owner & admin manage.
drop policy if exists feedback_public_read on public.feedback;
create policy feedback_public_read on public.feedback
  for select using (
    approved
    or exists (select 1 from public.albums a where a.id = album_id and (a.owner_id = auth.uid() or public.is_admin()))
  );
drop policy if exists feedback_owner_manage on public.feedback;
create policy feedback_owner_manage on public.feedback
  for all using (
    exists (select 1 from public.albums a where a.id = album_id and (a.owner_id = auth.uid() or public.is_admin()))
  ) with check (
    exists (select 1 from public.albums a where a.id = album_id and (a.owner_id = auth.uid() or public.is_admin()))
  );

-- ============================================================================
-- site_settings: single-row studio profile + contact info (public read)
-- ============================================================================
create table if not exists public.site_settings (
  id               smallint primary key default 1 check (id = 1),
  profile_name     text not null default 'Vieetjk',
  profile_role     text not null default 'Nhiếp ảnh gia cưới & chân dung · Studio',
  profile_location text not null default 'Hà Nội · Việt Nam',
  profile_bio      text not null default 'Mình là Vieetjk — kể chuyện qua từng khung hình cưới và chân dung. Mỗi buổi chụp được lưu thành một album riêng, nơi bạn thong thả xem lại, đánh dấu những tấm ưng ý nhất và tải về bản gốc bất cứ lúc nào.',
  profile_avatar_url text,
  profile_cover_url  text,
  stat_years       integer not null default 8,
  contact_phone    text not null default '0987 654 321',
  contact_email    text not null default 'hello@vieetjk.studio',
  contact_instagram text not null default '@vieetjk.studio',
  contact_facebook text,
  contact_tiktok   text,
  contact_youtube  text,
  contact_address  text not null default '12 Nhà Thờ, Hoàn Kiếm, Hà Nội',
  contact_hours    text not null default 'Thứ 2 – Chủ nhật · 8:00–20:00',
  updated_at       timestamptz not null default now()
);
insert into public.site_settings (id) values (1) on conflict (id) do nothing;
-- Social links for databases created before these existed:
alter table public.site_settings add column if not exists contact_facebook text;
alter table public.site_settings add column if not exists contact_tiktok   text;
alter table public.site_settings add column if not exists contact_youtube  text;
-- Browser tab / SEO: custom <title>, meta description and favicon shown on the tab.
alter table public.site_settings add column if not exists site_title       text;
alter table public.site_settings add column if not exists site_description text;
alter table public.site_settings add column if not exists favicon_url      text;
-- Editable content of the upgrade page (headline, plan labels/features, the
-- feature-comparison table, coming-soon list). Falls back to code defaults when
-- empty. See src/lib/upgrade-content.ts.
alter table public.site_settings add column if not exists upgrade_content  jsonb;

-- Cờ bật/tắt tính năng toàn hệ thống (admin điều khiển). Ví dụ:
--   { "story": "coming_soon" }  → Love Story hiện nhãn "Sắp ra mắt" & tạm khoá.
alter table public.site_settings add column if not exists feature_flags jsonb not null default '{}'::jsonb;

-- Google Drive của ADMIN để lưu nội dung người dùng (logo, ảnh) thay cho dung
-- lượng Supabase. Kết nối 1 lần trong Cài đặt hệ thống → app lưu refresh_token
-- và id thư mục đã tạo. Xem src/lib/mstudo-drive.ts.
-- BẢO MẬT: refresh_token Drive admin ĐÃ CHUYỂN sang bảng riêng public.admin_drive
-- (chỉ service-role). site_settings có policy đọc công khai nên KHÔNG chứa bí mật.
-- (Migration admin_drive.sql copy giá trị cũ rồi drop 2 cột này.)
alter table public.site_settings drop column if exists drive_refresh_token;
alter table public.site_settings drop column if exists drive_folder_id;

alter table public.site_settings enable row level security;
drop policy if exists site_settings_public_read on public.site_settings;
create policy site_settings_public_read on public.site_settings
  for select using (true);
drop policy if exists site_settings_admin_write on public.site_settings;
create policy site_settings_admin_write on public.site_settings
  for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- bookings: leads from the homepage booking form (insert via service role)
-- ============================================================================
create table if not exists public.bookings (
  id          uuid primary key default gen_random_uuid(),
  service     text not null default 'other',
  name        text not null,
  phone       text not null,
  date        text,
  note        text,
  handled     boolean not null default false,
  created_at  timestamptz not null default now()
);
alter table public.bookings enable row level security;
-- Only admins read/manage; customer inserts happen through the service role.
drop policy if exists bookings_admin_all on public.bookings;
create policy bookings_admin_all on public.bookings
  for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- upgrade_requests: photographers asking to lift the free-tier limits
-- (inserted via the service role; admins read/manage)
-- ============================================================================
create table if not exists public.upgrade_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users (id) on delete cascade,
  email       text,
  note        text,
  handled     boolean not null default false,
  created_at  timestamptz not null default now()
);
alter table public.upgrade_requests enable row level security;
drop policy if exists upgrade_admin_all on public.upgrade_requests;
create policy upgrade_admin_all on public.upgrade_requests
  for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- Monthly album-creation quota. Counted from an append-only creation log so
-- that DELETING an album does NOT free up the monthly quota. Admins exempt.
-- ============================================================================
create table if not exists public.album_creations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.album_creations enable row level security;
drop policy if exists album_creations_read on public.album_creations;
create policy album_creations_read on public.album_creations
  for select using (user_id = auth.uid() or public.is_admin());

-- One-time backfill from existing albums.
do $$
begin
  if not exists (select 1 from public.album_creations) then
    insert into public.album_creations (user_id, created_at)
    select owner_id, created_at from public.albums;
  end if;
end $$;

create or replace function public.enforce_album_quota()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  lim   integer;
  isadm boolean;
  cangal boolean;
  used  integer;
begin
  select monthly_album_limit, (role = 'admin'), can_galleries
    into lim, isadm, cangal
    from public.profiles where id = new.owner_id;

  if coalesce(new.is_gallery, false) then
    -- Only admins / permitted accounts may create delivery galleries.
    if not (coalesce(isadm, false) or coalesce(cangal, false)) then
      raise exception 'Tài khoản chưa được cấp quyền tạo gallery khách.'
        using errcode = 'P0001';
    end if;
    return new; -- galleries don't use the selection quota
  end if;
  if coalesce(isadm, false) then return new; end if;
  if lim is null then return new; end if;

  select count(*) into used
    from public.album_creations
    where user_id = new.owner_id
      and created_at >= date_trunc('month', now());

  if used >= lim then
    raise exception 'Đã đạt giới hạn % album trong tháng này.', lim
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists albums_quota on public.albums;
create trigger albums_quota
  before insert on public.albums
  for each row execute function public.enforce_album_quota();

-- Log each creation (append-only; survives album deletion).
create or replace function public.log_album_creation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.is_gallery, false) then return new; end if; -- galleries don't count
  insert into public.album_creations (user_id, created_at) values (new.owner_id, now());
  return new;
end;
$$;

drop trigger if exists albums_log_creation on public.albums;
create trigger albums_log_creation
  after insert on public.albums
  for each row execute function public.log_album_creation();

-- ============================================================================
-- Image-compress tool (img.vieetjk.com) — per-account usage limits.
--   compress_daily_limit  : "basic" compress (local files + public Drive link),
--                           counted PER DAY (Vietnam time). Free = 2/day.
--   compress_picker_limit : compress via the Google Picker (writes back to the
--                           user's own Drive), counted LIFETIME. Free = 1 (trial).
-- null = unlimited; admins are always exempt. Counted from an append-only log.
-- ============================================================================
alter table public.profiles add column if not exists compress_daily_limit integer default 2;
alter table public.profiles alter column compress_daily_limit set default 2;
-- Bump accounts still on the old default (1) to the new free allowance (2).
update public.profiles set compress_daily_limit = 2 where compress_daily_limit = 1;
alter table public.profiles add column if not exists compress_picker_limit integer default 1;
-- "Pro" watermark features (image/logo watermark + compressing in the watermark
-- tab): false for free accounts, admins always allowed.
alter table public.profiles add column if not exists can_watermark_pro boolean not null default false;

-- ============================================================================
-- Subscription plan (free | basic | studio). The plan drives the monthly
-- quotas in code; assigning a plan also syncs the legacy columns above.
-- ============================================================================
alter table public.profiles add column if not exists plan text not null default 'free';
-- Allow the Photographer tier (recreate the check constraint).
alter table public.profiles drop constraint if exists profiles_plan_check;
alter table public.profiles add constraint profiles_plan_check
  check (plan in ('free', 'basic', 'photographer', 'photographer_plus', 'studio'));
-- Billing cycle + auto-expiry. When the plan expires it is treated as 'free'.
alter table public.profiles add column if not exists plan_cycle text;            -- 'month' | 'year' | 'trial' | null
alter table public.profiles add column if not exists plan_expires_at timestamptz; -- null = no expiry (free / lifetime)
-- Dùng thử: mỗi tài khoản chỉ được kích hoạt dùng thử MỘT lần (mọi gói / mọi mã).
alter table public.profiles add column if not exists trial_used_at timestamptz;   -- null = chưa dùng thử lần nào

-- Per-month "filter tool" usage log (free = 10/month).
create table if not exists public.filter_usages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists filter_usages_user_idx on public.filter_usages (user_id, created_at);
alter table public.filter_usages enable row level security;
drop policy if exists filter_usages_read on public.filter_usages;
create policy filter_usages_read on public.filter_usages
  for select using (user_id = auth.uid() or public.is_admin());

-- Admin-configurable plan prices (VND) + discounts shown on the pricing page.
alter table public.site_settings add column if not exists basic_discount_percent integer not null default 0;
alter table public.site_settings add column if not exists price_basic_month  integer not null default 50000;
alter table public.site_settings add column if not exists price_basic_year   integer not null default 500000;
alter table public.site_settings add column if not exists price_studio_month integer not null default 300000;
alter table public.site_settings add column if not exists price_studio_year  integer not null default 3000000;
alter table public.site_settings add column if not exists studio_promo_percent integer not null default 50;
alter table public.site_settings add column if not exists price_photographer_month integer not null default 100000;
alter table public.site_settings add column if not exists price_photographer_year  integer not null default 999000;
-- Gói Photographer Plus (báo giá + hợp đồng + tên miền riêng).
alter table public.site_settings add column if not exists price_photographer_plus_month integer not null default 129000;
alter table public.site_settings add column if not exists price_photographer_plus_year  integer not null default 1249000;
-- Per-plan general discount (%) applied to both billing cycles. (Cũ — giữ để tương thích.)
alter table public.site_settings add column if not exists basic_discount_percent             integer not null default 0;
alter table public.site_settings add column if not exists photographer_discount_percent      integer not null default 0;
alter table public.site_settings add column if not exists photographer_plus_discount_percent integer not null default 0;
alter table public.site_settings add column if not exists studio_discount_percent            integer not null default 0;

-- Giảm giá RIÊNG theo chu kỳ (tháng / năm) cho từng gói — dùng ở trang nâng cấp.
alter table public.site_settings add column if not exists basic_discount_month_percent             integer not null default 0;
alter table public.site_settings add column if not exists basic_discount_year_percent              integer not null default 0;
alter table public.site_settings add column if not exists photographer_discount_month_percent      integer not null default 0;
alter table public.site_settings add column if not exists photographer_discount_year_percent       integer not null default 0;
alter table public.site_settings add column if not exists photographer_plus_discount_month_percent integer not null default 0;
alter table public.site_settings add column if not exists photographer_plus_discount_year_percent  integer not null default 0;
alter table public.site_settings add column if not exists studio_discount_month_percent            integer not null default 0;
alter table public.site_settings add column if not exists studio_discount_year_percent             integer not null default 50;

-- Desired plan / billing cycle / discount code / contact phone on an upgrade request.
alter table public.upgrade_requests add column if not exists plan text;
alter table public.upgrade_requests add column if not exists cycle text;
alter table public.upgrade_requests add column if not exists discount_code text;
alter table public.upgrade_requests add column if not exists phone text;
alter table public.upgrade_requests add column if not exists amount integer; -- final price after discount (VND)

-- ============================================================================
-- Discount codes (admin-created). Validated server-side; admins manage.
-- ============================================================================
create table if not exists public.discount_codes (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  percent    integer not null default 0,
  plan       text,            -- null = any paid plan, else 'basic' | 'studio'
  active     boolean not null default true,
  max_uses   integer,         -- null = unlimited; 1 = single use
  used_count integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.discount_codes add column if not exists max_uses integer;
alter table public.discount_codes add column if not exists used_count integer not null default 0;
alter table public.discount_codes add column if not exists expires_at timestamptz; -- null = no expiry
alter table public.discount_codes add column if not exists cycle text;            -- null = any cycle, else 'month' | 'year'
alter table public.discount_codes add column if not exists trial_days integer;     -- >0 = instant self-serve trial of `plan` for N days
alter table public.discount_codes enable row level security;
-- Only admins read/manage directly; customers validate a code via the API (service role).
drop policy if exists discount_codes_admin on public.discount_codes;
create policy discount_codes_admin on public.discount_codes
  for all using (public.is_admin()) with check (public.is_admin());

-- Per-account redemption log: each code can be used at most once per user.
create table if not exists public.discount_redemptions (
  id         uuid primary key default gen_random_uuid(),
  code       text not null,
  user_id    uuid references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (code, user_id)
);
alter table public.discount_redemptions enable row level security;
drop policy if exists discount_redemptions_read on public.discount_redemptions;
create policy discount_redemptions_read on public.discount_redemptions
  for select using (user_id = auth.uid() or public.is_admin());

create table if not exists public.compress_usages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users (id) on delete cascade,
  kind       text not null default 'basic',   -- 'basic' | 'picker'
  created_at timestamptz not null default now()
);
alter table public.compress_usages add column if not exists kind text not null default 'basic';
create index if not exists compress_usages_user_idx
  on public.compress_usages (user_id, kind, created_at);
alter table public.compress_usages enable row level security;
-- Users read their own usage; admins read all. Inserts happen via the service
-- role through the /api/compress/use route, so no public insert policy needed.
drop policy if exists compress_usages_read on public.compress_usages;
create policy compress_usages_read on public.compress_usages
  for select using (user_id = auth.uid() or public.is_admin());

-- ============================================================================
-- STUDIO MODULE (studio.vieetjk.com) — contracts, crew, salaries, schedule.
-- Studio-plan accounts (and admins) manage contracts; clients view their own
-- contract via an unguessable token (+ phone), crew see their jobs by phone.
-- All public-facing reads/writes go through the service role in API routes,
-- so RLS only needs to cover the owner (logged-in studio) + admin.
-- ============================================================================

-- Contracts -------------------------------------------------------------------
create table if not exists public.studio_contracts (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles (id) on delete cascade,
  code          text,                       -- human reference, e.g. HD-2026-001
  title         text not null default 'Hợp đồng',
  client_name   text,
  client_phone  text,                       -- also the client's view password
  client_email  text,
  shoot_type    text not null default 'photo'
                  check (shoot_type in ('photo', 'video', 'both', 'psc', 'makeup', 'rental', 'prewedding', 'wedding', 'other')),
  event_date    date,
  event_time    text,
  location      text,
  status        text not null default 'draft'
                  check (status in ('draft', 'sent', 'approved', 'in_progress', 'completed', 'cancelled')),
  deposit       integer not null default 0, -- tiền cọc (VND)
  note          text,
  client_token  text not null unique,       -- /c/[token]
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists studio_contracts_owner_idx on public.studio_contracts (owner_id);

drop trigger if exists studio_contracts_set_updated_at on public.studio_contracts;
create trigger studio_contracts_set_updated_at
  before update on public.studio_contracts
  for each row execute function public.set_updated_at();

-- Contract line items (hạng mục tự nhập + đơn giá) ----------------------------
create table if not exists public.contract_items (
  id          uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.studio_contracts (id) on delete cascade,
  name        text not null default '',
  qty         integer not null default 1,
  unit_price  integer not null default 0,   -- VND
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists contract_items_contract_idx on public.contract_items (contract_id);

-- Crew assigned to a contract (photographer / cameraman) + salary -------------
create table if not exists public.contract_crew (
  id           uuid primary key default gen_random_uuid(),
  contract_id  uuid not null references public.studio_contracts (id) on delete cascade,
  name         text not null default '',
  phone        text,                          -- crew identify themselves by phone
  role         text not null default 'photographer'
                 check (role in ('photographer', 'cameraman', 'assistant', 'editor', 'other')),
  salary       integer not null default 0,    -- lương theo hợp đồng (VND)
  status       text not null default 'pending'
                 check (status in ('pending', 'accepted', 'declined')),
  note         text,                          -- yêu cầu riêng gửi cho thợ này
  responded_at timestamptz,
  position     integer not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists contract_crew_contract_idx on public.contract_crew (contract_id);
create index if not exists contract_crew_phone_idx on public.contract_crew (phone);

-- Client requests to amend a contract -----------------------------------------
create table if not exists public.contract_edit_requests (
  id          uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.studio_contracts (id) on delete cascade,
  message     text not null,
  status      text not null default 'open' check (status in ('open', 'resolved')),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists contract_edit_requests_contract_idx on public.contract_edit_requests (contract_id);

-- Studio crew roster (sổ thợ, quản lý theo SĐT) -------------------------------
create table if not exists public.studio_crew (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  name       text not null default '',
  phone      text not null,
  role       text not null default 'photographer',
  note       text,
  created_at timestamptz not null default now(),
  unique (owner_id, phone)
);
create index if not exists studio_crew_owner_idx on public.studio_crew (owner_id);

-- Calendar notes / reminders (lịch ghi chú hợp đồng) --------------------------
create table if not exists public.studio_events (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  contract_id uuid references public.studio_contracts (id) on delete set null,
  title       text not null default '',
  event_date  date not null,
  event_time  text,
  note        text,
  remind      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists studio_events_owner_idx on public.studio_events (owner_id, event_date);

-- RLS: owner (logged-in studio) + admin only. Public access is service-role.
alter table public.studio_contracts      enable row level security;
alter table public.contract_items        enable row level security;
alter table public.contract_crew         enable row level security;
alter table public.contract_edit_requests enable row level security;
alter table public.studio_crew           enable row level security;
alter table public.studio_events         enable row level security;

drop policy if exists studio_contracts_owner_all on public.studio_contracts;
create policy studio_contracts_owner_all on public.studio_contracts
  for all using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

-- Child tables: gated on owning the parent contract.
drop policy if exists contract_items_owner_all on public.contract_items;
create policy contract_items_owner_all on public.contract_items
  for all using (
    exists (select 1 from public.studio_contracts c
            where c.id = contract_id and (c.owner_id = auth.uid() or public.is_admin()))
  ) with check (
    exists (select 1 from public.studio_contracts c
            where c.id = contract_id and (c.owner_id = auth.uid() or public.is_admin()))
  );

drop policy if exists contract_crew_owner_all on public.contract_crew;
create policy contract_crew_owner_all on public.contract_crew
  for all using (
    exists (select 1 from public.studio_contracts c
            where c.id = contract_id and (c.owner_id = auth.uid() or public.is_admin()))
  ) with check (
    exists (select 1 from public.studio_contracts c
            where c.id = contract_id and (c.owner_id = auth.uid() or public.is_admin()))
  );

drop policy if exists contract_edit_requests_owner_all on public.contract_edit_requests;
create policy contract_edit_requests_owner_all on public.contract_edit_requests
  for all using (
    exists (select 1 from public.studio_contracts c
            where c.id = contract_id and (c.owner_id = auth.uid() or public.is_admin()))
  ) with check (
    exists (select 1 from public.studio_contracts c
            where c.id = contract_id and (c.owner_id = auth.uid() or public.is_admin()))
  );

drop policy if exists studio_crew_owner_all on public.studio_crew;
create policy studio_crew_owner_all on public.studio_crew
  for all using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists studio_events_owner_all on public.studio_events;
create policy studio_events_owner_all on public.studio_events
  for all using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

-- ── Studio: e-signature, payments, payroll, expenses ────────────────────────

-- Client e-signature on a contract (signed via the public /c/[token] portal).
alter table public.studio_contracts add column if not exists client_signed_name text;
alter table public.studio_contracts add column if not exists client_signature  text; -- PNG data URL
alter table public.studio_contracts add column if not exists client_signed_at  timestamptz;

-- Crew payroll: mark a crew member's salary as paid.
alter table public.contract_crew add column if not exists paid    boolean not null default false;
alter table public.contract_crew add column if not exists paid_at timestamptz;

-- Unified client portal: link a contract to a delivery gallery + track when the
-- client first opened their portal link.
alter table public.studio_contracts add column if not exists gallery_album_id uuid references public.albums (id) on delete set null;
alter table public.studio_contracts add column if not exists client_viewed_at timestamptz;

-- Studio counter-signature (Bên A) shown on the contract PDF.
alter table public.studio_contracts add column if not exists studio_signed_name text;
alter table public.studio_contracts add column if not exists studio_signature  text; -- PNG data URL
alter table public.studio_contracts add column if not exists studio_signed_at  timestamptz;

-- Photo-delivery deadline (for the late-delivery warning on the overview).
alter table public.studio_contracts add column if not exists delivery_due date;

-- Client's Facebook/Messenger link (so the studio can message them via Messenger).
-- The client can set this themselves from the portal, or the studio can enter it.
alter table public.studio_contracts add column if not exists client_messenger text;

-- Link a contract to a photo-selection album (/a/[slug]) so the client can pick
-- their photos straight from the unified portal.
alter table public.studio_contracts add column if not exists selection_album_id uuid references public.albums (id) on delete set null;

-- Per-contract calendar colour (hex) so multiple shoots on the same day are
-- easy to tell apart. Null = use the default gold marker.
alter table public.studio_contracts add column if not exists calendar_color text;

-- Monthly revenue target (mục tiêu doanh thu) per studio account.
alter table public.profiles add column if not exists monthly_revenue_target integer not null default 0;

-- Show the service's contract clauses on the public price list (studio toggle).
alter table public.profiles add column if not exists pl_show_clauses boolean not null default false;

-- Print / physical product orders per contract (album in, ảnh ép gỗ…).
create table if not exists public.contract_products (
  id          uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.studio_contracts (id) on delete cascade,
  name        text not null default '',
  qty         integer not null default 1,
  cost        integer not null default 0,
  status      text not null default 'ordered' check (status in ('ordered', 'in_progress', 'done')),
  note        text,
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);
alter table public.contract_products add column if not exists assigned_to uuid references public.profiles (id) on delete set null;
create index if not exists contract_products_contract_idx on public.contract_products (contract_id);
alter table public.contract_products enable row level security;
drop policy if exists contract_products_owner_all on public.contract_products;
create policy contract_products_owner_all on public.contract_products
  for all using (
    exists (select 1 from public.studio_contracts c
            where c.id = contract_id and (c.owner_id = auth.uid() or public.is_admin()))
  ) with check (
    exists (select 1 from public.studio_contracts c
            where c.id = contract_id and (c.owner_id = auth.uid() or public.is_admin()))
  );

-- Multi-option quote (báo giá nhiều phương án) — client picks one in the portal.
create table if not exists public.contract_quote_options (
  id          uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.studio_contracts (id) on delete cascade,
  name        text not null default '',
  price       integer not null default 0,
  description text,
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists contract_quote_options_contract_idx on public.contract_quote_options (contract_id);
alter table public.contract_quote_options enable row level security;
drop policy if exists contract_quote_options_owner_all on public.contract_quote_options;
create policy contract_quote_options_owner_all on public.contract_quote_options
  for all using (
    exists (select 1 from public.studio_contracts c
            where c.id = contract_id and (c.owner_id = auth.uid() or public.is_admin()))
  ) with check (
    exists (select 1 from public.studio_contracts c
            where c.id = contract_id and (c.owner_id = auth.uid() or public.is_admin()))
  );
alter table public.studio_contracts add column if not exists chosen_quote_option_id uuid;
alter table public.studio_contracts add column if not exists chosen_quote_at timestamptz;

-- Pre-shoot brief (khách điền concept/yêu cầu qua cổng).
alter table public.studio_contracts add column if not exists brief_concept text;
alter table public.studio_contracts add column if not exists brief_outfit text;
alter table public.studio_contracts add column if not exists brief_refs text;
alter table public.studio_contracts add column if not exists brief_note text;
alter table public.studio_contracts add column if not exists brief_submitted_at timestamptz;

-- Lead source (nguồn khách) for the CRM + per-contract direct expenses.
alter table public.studio_contracts add column if not exists source text; -- facebook | referral | google | walk_in | returning | other
-- Reuse studio_expenses for per-contract costs too (null contract_id = general).
alter table public.studio_expenses add column if not exists contract_id uuid references public.studio_contracts (id) on delete set null;
create index if not exists studio_expenses_contract_idx on public.studio_expenses (contract_id);
-- Whether a per-contract expense is a client-facing surcharge (shown + billed on
-- the client portal) or an internal-only cost (profit/loss only). Defaults true
-- to preserve existing billing; uncheck to keep a cost private to the studio.
alter table public.studio_expenses add column if not exists client_visible boolean not null default true;

-- Prepaid session packages / combo cards (thẻ buổi trả trước) per client.
create table if not exists public.studio_packages (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references public.profiles (id) on delete cascade,
  client_name    text not null default '',
  client_phone   text,
  name           text not null default 'Thẻ buổi',
  total_sessions integer not null default 1,
  used_sessions  integer not null default 0,
  price          integer not null default 0,
  paid           boolean not null default false,
  note           text,
  created_at     timestamptz not null default now()
);
create index if not exists studio_packages_owner_idx on public.studio_packages (owner_id);
alter table public.studio_packages enable row level security;
drop policy if exists studio_packages_owner_all on public.studio_packages;
create policy studio_packages_owner_all on public.studio_packages
  for all using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

-- Public price list / rate card (bảng giá gửi khách). Shared via booking_token.
create table if not exists public.studio_pricelist (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  list_key    text not null default 'cuoi',  -- 'cuoi' | 'dinh-hon' | custom
  name        text not null default '',
  price       integer not null default 0,
  unit        text,            -- e.g. "/ buổi", "/ giờ"
  category    text,
  description text,
  active      boolean not null default true,
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);
alter table public.studio_pricelist add column if not exists list_key text not null default 'cuoi';
alter table public.studio_pricelist add column if not exists show_on_home boolean not null default true;
create index if not exists studio_pricelist_owner_idx on public.studio_pricelist (owner_id, list_key, position);
alter table public.studio_pricelist enable row level security;
drop policy if exists studio_pricelist_owner_all on public.studio_pricelist;
create policy studio_pricelist_owner_all on public.studio_pricelist
  for all using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

-- Saved message templates (mẫu tin nhắn) for quick copy into Zalo/Messenger/email.
create table if not exists public.message_templates (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  title      text not null default '',
  body       text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists message_templates_owner_idx on public.message_templates (owner_id);
alter table public.message_templates enable row level security;
drop policy if exists message_templates_owner_all on public.message_templates;
create policy message_templates_owner_all on public.message_templates
  for all using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

-- Online booking: a public per-studio link where prospective clients request a
-- date. Each studio gets a booking_token; requests land in studio_bookings.
alter table public.profiles add column if not exists booking_token text unique;
-- Secret token for the read-only .ics calendar feed (Google Calendar subscribe).
alter table public.profiles add column if not exists calendar_token text unique;
-- Contact + bank info shown on the public price list / booking pages.
alter table public.profiles add column if not exists pl_phone        text;
alter table public.profiles add column if not exists pl_facebook     text;
alter table public.profiles add column if not exists pl_bank_holder  text;
alter table public.profiles add column if not exists pl_bank_account text;
alter table public.profiles add column if not exists pl_bank_name    text;
alter table public.profiles add column if not exists pl_bank_bin     text;  -- VietQR (NAPAS) bank code, for payment QR generation
-- Price-list poster appearance: custom background / text / accent colours + logo.
alter table public.profiles add column if not exists pl_bg           text;
alter table public.profiles add column if not exists pl_text         text;
alter table public.profiles add column if not exists pl_accent       text;
alter table public.profiles add column if not exists pl_logo_url     text;
-- Studio brand: logo + display name shown to customers (white-label). Falls back
-- to pl_logo_url / full_name when unset. See src/lib/studio-brand.ts.
alter table public.profiles add column if not exists studio_logo_url  text;
alter table public.profiles add column if not exists studio_brand_name text;
-- Built-in price lists (e.g. 'cuoi', 'dinh-hon') the studio has hidden/removed.
alter table public.profiles add column if not exists pl_hidden_lists text[] not null default '{}';
-- Per-user custom labels for price list tabs (built-in + custom), key → label.
alter table public.profiles add column if not exists pl_list_labels  jsonb not null default '{}';
alter table public.profiles add column if not exists auto_client_emails boolean not null default false;  -- opt-in: auto-email clients (shoot reminder, review request)

-- Widen the shoot_type check to the fuller service list (idempotent).
alter table public.studio_contracts drop constraint if exists studio_contracts_shoot_type_check;
alter table public.studio_contracts add constraint studio_contracts_shoot_type_check
  check (shoot_type in ('photo', 'video', 'both', 'psc', 'makeup', 'rental', 'prewedding', 'wedding', 'other'));
alter table public.contract_templates drop constraint if exists contract_templates_shoot_type_check;
alter table public.contract_templates add constraint contract_templates_shoot_type_check
  check (shoot_type in ('photo', 'video', 'both', 'psc', 'makeup', 'rental', 'prewedding', 'wedding', 'other'));

create table if not exists public.studio_bookings (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references public.profiles (id) on delete cascade,
  name           text not null default '',
  phone          text not null default '',
  service        text,
  preferred_date date,
  note           text,
  status         text not null default 'new' check (status in ('new', 'handled', 'archived')),
  created_at     timestamptz not null default now()
);
alter table public.studio_bookings add column if not exists package_name  text;
alter table public.studio_bookings add column if not exists package_price integer;
alter table public.studio_bookings add column if not exists facebook      text;
create index if not exists studio_bookings_owner_idx on public.studio_bookings (owner_id, status);
alter table public.studio_bookings enable row level security;
-- Owner/admin manage; public inserts go through the service role API.
drop policy if exists studio_bookings_owner_all on public.studio_bookings;
create policy studio_bookings_owner_all on public.studio_bookings
  for all using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

-- Equipment roster (sổ thiết bị) + per-contract assignment (tránh trùng máy/lens).
create table if not exists public.studio_equipment (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  name       text not null default '',
  category   text,
  note       text,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists studio_equipment_owner_idx on public.studio_equipment (owner_id);
alter table public.studio_equipment enable row level security;
drop policy if exists studio_equipment_owner_all on public.studio_equipment;
create policy studio_equipment_owner_all on public.studio_equipment
  for all using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

create table if not exists public.contract_equipment (
  id           uuid primary key default gen_random_uuid(),
  contract_id  uuid not null references public.studio_contracts (id) on delete cascade,
  equipment_id uuid references public.studio_equipment (id) on delete set null,
  name         text not null default '',
  created_at   timestamptz not null default now()
);
create index if not exists contract_equipment_contract_idx on public.contract_equipment (contract_id);
alter table public.contract_equipment enable row level security;
drop policy if exists contract_equipment_owner_all on public.contract_equipment;
create policy contract_equipment_owner_all on public.contract_equipment
  for all using (
    exists (select 1 from public.studio_contracts c
            where c.id = contract_id and (c.owner_id = auth.uid() or public.is_admin()))
  ) with check (
    exists (select 1 from public.studio_contracts c
            where c.id = contract_id and (c.owner_id = auth.uid() or public.is_admin()))
  );

-- Planned payment schedule (lịch thu nhiều đợt có ngày đến hạn). Separate from
-- contract_payments (actual receipts) — drives the "sắp đến hạn thu" reminder.
create table if not exists public.contract_payment_plan (
  id          uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.studio_contracts (id) on delete cascade,
  label       text not null default 'Đợt thanh toán',
  amount      integer not null default 0,
  due_date    date,
  paid        boolean not null default false,
  paid_at     timestamptz,
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);
-- Link an installment to the actual payment recorded when it is marked collected.
alter table public.contract_payment_plan add column if not exists payment_id uuid references public.contract_payments (id) on delete set null;
create index if not exists contract_payment_plan_contract_idx on public.contract_payment_plan (contract_id);
alter table public.contract_payment_plan enable row level security;
drop policy if exists contract_payment_plan_owner_all on public.contract_payment_plan;
create policy contract_payment_plan_owner_all on public.contract_payment_plan
  for all using (
    exists (select 1 from public.studio_contracts c
            where c.id = contract_id and (c.owner_id = auth.uid() or public.is_admin()))
  ) with check (
    exists (select 1 from public.studio_contracts c
            where c.id = contract_id and (c.owner_id = auth.uid() or public.is_admin()))
  );

-- ============================================================================
-- Studio notifications (chuông): events worth the studio's attention. Inserted
-- both by the owner's own client (RLS) and the service role (client/crew portals).
-- ============================================================================
create table if not exists public.studio_notifications (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  contract_id uuid references public.studio_contracts (id) on delete cascade,
  kind        text not null default 'info',  -- signed | edit_request | crew_accepted | crew_declined | review | payment
  message     text not null default '',
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists studio_notifications_owner_idx on public.studio_notifications (owner_id, read, created_at);
-- Thông báo hệ thống quan trọng: hiện popup nổi bắt buộc xác nhận (do admin bật).
alter table public.studio_notifications add column if not exists important boolean not null default false;
-- Album liên quan (vd khách chọn ảnh xong) → bấm thông báo mở thẳng album đó.
alter table public.studio_notifications add column if not exists album_id uuid references public.albums (id) on delete cascade;
alter table public.studio_notifications enable row level security;
drop policy if exists studio_notifications_owner_all on public.studio_notifications;
create policy studio_notifications_owner_all on public.studio_notifications
  for all using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

-- Per-contract checklist (đặt cọc, chụp, chọn ảnh, retouch, in album, giao…).
create table if not exists public.contract_tasks (
  id          uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.studio_contracts (id) on delete cascade,
  label       text not null default '',
  done        boolean not null default false,
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists contract_tasks_contract_idx on public.contract_tasks (contract_id);
alter table public.contract_tasks enable row level security;
drop policy if exists contract_tasks_owner_all on public.contract_tasks;
create policy contract_tasks_owner_all on public.contract_tasks
  for all using (
    exists (select 1 from public.studio_contracts c
            where c.id = contract_id and (c.owner_id = auth.uid() or public.is_admin()))
  ) with check (
    exists (select 1 from public.studio_contracts c
            where c.id = contract_id and (c.owner_id = auth.uid() or public.is_admin()))
  );

-- Reusable contract templates (mẫu hợp đồng): a named set of line items + terms.
create table if not exists public.contract_templates (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  name       text not null default 'Mẫu',
  shoot_type text not null default 'photo' check (shoot_type in ('photo', 'video', 'both', 'psc', 'makeup', 'rental', 'prewedding', 'wedding', 'other')),
  note       text,
  created_at timestamptz not null default now()
);
create index if not exists contract_templates_owner_idx on public.contract_templates (owner_id);

create table if not exists public.contract_template_items (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.contract_templates (id) on delete cascade,
  name        text not null default '',
  qty         integer not null default 1,
  unit_price  integer not null default 0,
  position    integer not null default 0
);
create index if not exists contract_template_items_tpl_idx on public.contract_template_items (template_id);

-- Crew busy/unavailable days (keyed by phone — crew have no login). Crew add
-- these via the public portal (service role); studios read them to avoid
-- double-booking. Low-sensitivity scheduling info → readable by any studio.
create table if not exists public.crew_unavailable (
  id         uuid primary key default gen_random_uuid(),
  phone      text not null,
  date       date not null,
  note       text,
  created_at timestamptz not null default now(),
  unique (phone, date)
);
create index if not exists crew_unavailable_phone_idx on public.crew_unavailable (phone, date);
alter table public.crew_unavailable enable row level security;
-- Authenticated studios may read (for conflict detection); writes go through the
-- service role from the crew portal, so no insert/update/delete policy is needed.
drop policy if exists crew_unavailable_read on public.crew_unavailable;
create policy crew_unavailable_read on public.crew_unavailable
  for select using (auth.role() = 'authenticated');

-- Lịch thợ: mở rộng crew_unavailable từ "ngày bận" thành "mốc lịch có giờ".
-- Xem supabase/migrations/crew_schedule.sql.
alter table public.crew_unavailable add column if not exists start_time time;
alter table public.crew_unavailable add column if not exists end_time   time;
alter table public.crew_unavailable add column if not exists overnight  boolean not null default false;
alter table public.crew_unavailable add column if not exists title      text;
alter table public.crew_unavailable add column if not exists owner_id   uuid references public.profiles (id) on delete set null;
alter table public.crew_unavailable drop constraint if exists crew_unavailable_phone_date_key;

-- Ca công ty của thợ freelancer (Hòa Phát A/B/C). Chỉ nhớ thợ thuộc ca nào; các
-- ca cụ thể được TÍNH lúc hiển thị (src/lib/crew-shift.ts), không sinh sẵn dòng.
create table if not exists public.crew_shift_plan (
  phone      text primary key,
  company    text not null default 'hoa_phat',
  shift      text not null check (shift in ('A', 'B', 'C')),
  updated_at timestamptz not null default now()
);
alter table public.crew_shift_plan enable row level security;
drop policy if exists crew_shift_plan_read on public.crew_shift_plan;
create policy crew_shift_plan_read on public.crew_shift_plan
  for select using (auth.role() = 'authenticated');

alter table public.contract_templates      enable row level security;
alter table public.contract_template_items enable row level security;

drop policy if exists contract_templates_owner_all on public.contract_templates;
create policy contract_templates_owner_all on public.contract_templates
  for all using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists contract_template_items_owner_all on public.contract_template_items;
create policy contract_template_items_owner_all on public.contract_template_items
  for all using (
    exists (select 1 from public.contract_templates t
            where t.id = template_id and (t.owner_id = auth.uid() or public.is_admin()))
  ) with check (
    exists (select 1 from public.contract_templates t
            where t.id = template_id and (t.owner_id = auth.uid() or public.is_admin()))
  );

-- Payments collected from the client (deposit / installments / final).
create table if not exists public.contract_payments (
  id          uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.studio_contracts (id) on delete cascade,
  amount      integer not null default 0,   -- VND
  method      text,                          -- 'cash' | 'transfer' | ...
  kind        text not null default 'installment'
                check (kind in ('deposit', 'installment', 'final', 'other')),
  note        text,
  paid_at     date not null default current_date,
  created_at  timestamptz not null default now()
);
create index if not exists contract_payments_contract_idx on public.contract_payments (contract_id);
-- Optional proof-of-transfer image (uploaded to the payment-proofs bucket).
alter table public.contract_payments add column if not exists proof_url text;

-- Client-submitted payment proof images (uploaded via the public contract portal).
create table if not exists public.contract_client_proofs (
  id          uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.studio_contracts (id) on delete cascade,
  url         text not null,
  note        text,
  uploaded_at timestamptz not null default now()
);
create index if not exists contract_client_proofs_contract_idx on public.contract_client_proofs (contract_id);
alter table public.contract_client_proofs add column if not exists plan_id uuid references public.contract_payment_plan(id) on delete set null;
alter table public.contract_client_proofs enable row level security;
drop policy if exists contract_client_proofs_owner on public.contract_client_proofs;
create policy contract_client_proofs_owner on public.contract_client_proofs
  for all using (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and c.owner_id = auth.uid())
  );

-- Misc studio expenses (chi phí khác ngoài lương) for the monthly report.
create table if not exists public.studio_expenses (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  title      text not null default '',
  amount     integer not null default 0,    -- VND
  category   text,                           -- 'equipment' | 'rent' | 'marketing' | ...
  note       text,
  spent_at   date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists studio_expenses_owner_idx on public.studio_expenses (owner_id, spent_at);

alter table public.contract_payments enable row level security;
alter table public.studio_expenses   enable row level security;

drop policy if exists contract_payments_owner_all on public.contract_payments;
create policy contract_payments_owner_all on public.contract_payments
  for all using (
    exists (select 1 from public.studio_contracts c
            where c.id = contract_id and (c.owner_id = auth.uid() or public.is_admin()))
  ) with check (
    exists (select 1 from public.studio_contracts c
            where c.id = contract_id and (c.owner_id = auth.uid() or public.is_admin()))
  );

drop policy if exists studio_expenses_owner_all on public.studio_expenses;
create policy studio_expenses_owner_all on public.studio_expenses
  for all using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

-- ============================================================================
-- STORAGE: payment-proofs bucket (transfer screenshots attached to payments)
-- Public read (so receipts/links work); only signed-in studio users may write.
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', true)
on conflict (id) do nothing;

drop policy if exists payment_proofs_read on storage.objects;
create policy payment_proofs_read on storage.objects
  for select using (bucket_id = 'payment-proofs');
drop policy if exists payment_proofs_insert on storage.objects;
create policy payment_proofs_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'payment-proofs');
drop policy if exists payment_proofs_update on storage.objects;
create policy payment_proofs_update on storage.objects
  for update to authenticated using (bucket_id = 'payment-proofs');
drop policy if exists payment_proofs_delete on storage.objects;
create policy payment_proofs_delete on storage.objects
  for delete to authenticated using (bucket_id = 'payment-proofs');

-- ============================================================================
-- MULTI-ACCOUNT / STAFF PERMISSIONS
-- A studio owner (studio plan) can create staff sub-accounts. Staff rows have
-- studio_owner_id = the owner's profile id + a studio_role. Staff act on the
-- OWNER's data, so RLS allows any member of the studio.
-- ============================================================================
alter table public.profiles add column if not exists studio_owner_id uuid references public.profiles (id) on delete cascade;
alter table public.profiles add column if not exists studio_role text; -- manager | staff | accountant
alter table public.studio_contracts add column if not exists assigned_to uuid references public.profiles (id) on delete set null;
create index if not exists profiles_studio_owner_idx on public.profiles (studio_owner_id);

-- True if the current user is the owner, a member of that studio, or an admin.
create or replace function public.is_studio_member(target uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select
    target = auth.uid()
    or exists (select 1 from public.profiles where id = auth.uid() and studio_owner_id = target)
    or public.is_admin();
$$;

-- Owner-scoped tables: any studio member may access.
drop policy if exists studio_contracts_owner_all on public.studio_contracts;
create policy studio_contracts_owner_all on public.studio_contracts
  for all using (public.is_studio_member(owner_id)) with check (public.is_studio_member(owner_id));
drop policy if exists studio_crew_owner_all on public.studio_crew;
create policy studio_crew_owner_all on public.studio_crew
  for all using (public.is_studio_member(owner_id)) with check (public.is_studio_member(owner_id));
drop policy if exists studio_events_owner_all on public.studio_events;
create policy studio_events_owner_all on public.studio_events
  for all using (public.is_studio_member(owner_id)) with check (public.is_studio_member(owner_id));
drop policy if exists studio_expenses_owner_all on public.studio_expenses;
create policy studio_expenses_owner_all on public.studio_expenses
  for all using (public.is_studio_member(owner_id)) with check (public.is_studio_member(owner_id));
drop policy if exists studio_equipment_owner_all on public.studio_equipment;
create policy studio_equipment_owner_all on public.studio_equipment
  for all using (public.is_studio_member(owner_id)) with check (public.is_studio_member(owner_id));
drop policy if exists studio_bookings_owner_all on public.studio_bookings;
create policy studio_bookings_owner_all on public.studio_bookings
  for all using (public.is_studio_member(owner_id)) with check (public.is_studio_member(owner_id));
drop policy if exists studio_notifications_owner_all on public.studio_notifications;
create policy studio_notifications_owner_all on public.studio_notifications
  for all using (public.is_studio_member(owner_id)) with check (public.is_studio_member(owner_id));
drop policy if exists contract_templates_owner_all on public.contract_templates;
create policy contract_templates_owner_all on public.contract_templates
  for all using (public.is_studio_member(owner_id)) with check (public.is_studio_member(owner_id));
drop policy if exists message_templates_owner_all on public.message_templates;
create policy message_templates_owner_all on public.message_templates
  for all using (public.is_studio_member(owner_id)) with check (public.is_studio_member(owner_id));
drop policy if exists studio_packages_owner_all on public.studio_packages;
create policy studio_packages_owner_all on public.studio_packages
  for all using (public.is_studio_member(owner_id)) with check (public.is_studio_member(owner_id));
drop policy if exists studio_pricelist_owner_all on public.studio_pricelist;
create policy studio_pricelist_owner_all on public.studio_pricelist
  for all using (public.is_studio_member(owner_id)) with check (public.is_studio_member(owner_id));

-- Studio-defined service types (loại dịch vụ) with their own contract clauses.
-- Picking a service in a contract/quote loads that service's clauses.
create table if not exists public.studio_services (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  name       text not null default 'Dịch vụ',
  clauses    text not null default '',
  position   integer not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists studio_services_owner_idx on public.studio_services (owner_id);
alter table public.studio_services enable row level security;
drop policy if exists studio_services_owner_all on public.studio_services;
create policy studio_services_owner_all on public.studio_services
  for all using (public.is_studio_member(owner_id)) with check (public.is_studio_member(owner_id));

-- Link a contract / quote to the chosen studio service (for its clauses & label).
alter table public.studio_contracts add column if not exists service_id uuid references public.studio_services (id) on delete set null;
alter table public.studio_quotes    add column if not exists service_id uuid references public.studio_services (id) on delete set null;

-- Contract-child tables: gated via the parent contract's owner.
do $$
declare t text;
begin
  foreach t in array array['contract_items','contract_crew','contract_edit_requests','contract_payments','contract_payment_plan','contract_tasks','contract_equipment','contract_products','contract_quote_options']
  loop
    execute format('drop policy if exists %1$s_owner_all on public.%1$s', t);
    execute format($f$create policy %1$s_owner_all on public.%1$s for all using (exists (select 1 from public.studio_contracts c where c.id = contract_id and public.is_studio_member(c.owner_id))) with check (exists (select 1 from public.studio_contracts c where c.id = contract_id and public.is_studio_member(c.owner_id)))$f$, t);
  end loop;
end $$;

-- Template items: gated via parent template owner.
drop policy if exists contract_template_items_owner_all on public.contract_template_items;
create policy contract_template_items_owner_all on public.contract_template_items
  for all using (exists (select 1 from public.contract_templates t where t.id = template_id and public.is_studio_member(t.owner_id)))
  with check (exists (select 1 from public.contract_templates t where t.id = template_id and public.is_studio_member(t.owner_id)));

-- ============================================================================
-- Site builder (multi-tenant portfolio sites on <sub>.vieetjk.com)
-- ============================================================================
-- One public site per account (photographer / studio plans).
create table if not exists public.sites (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null unique references public.profiles (id) on delete cascade,
  subdomain     text unique,                 -- <subdomain>.vieetjk.com
  custom_domain text unique,                 -- phase 2 (studio)
  template      text not null default 'classic',
  theme         jsonb not null default '{}'::jsonb,   -- { accent, bg, font, ... }
  seo           jsonb not null default '{}'::jsonb,   -- { title, description, og_image }
  published     boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists sites_subdomain_idx on public.sites (subdomain);
create index if not exists sites_custom_domain_idx on public.sites (custom_domain);
-- Custom domain (studio.com) — only used as the customer host once DNS is
-- verified & the domain is added to the hosting project.
alter table public.sites add column if not exists custom_domain_verified boolean not null default false;
alter table public.sites enable row level security;
drop policy if exists sites_owner_all on public.sites;
create policy sites_owner_all on public.sites
  for all using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

-- Ordered content blocks that make up a site (the drag-and-drop builder model).
create table if not exists public.site_blocks (
  id          uuid primary key default gen_random_uuid(),
  site_id     uuid not null references public.sites (id) on delete cascade,
  type        text not null,                 -- hero | gallery | about | pricing | testimonials | contact | gap | ...
  position    integer not null default 0,
  visible     boolean not null default true,
  config      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists site_blocks_site_idx on public.site_blocks (site_id, position);
alter table public.site_blocks enable row level security;
drop policy if exists site_blocks_owner_all on public.site_blocks;
create policy site_blocks_owner_all on public.site_blocks
  for all using (exists (select 1 from public.sites s where s.id = site_id and (s.owner_id = auth.uid() or public.is_admin())))
  with check (exists (select 1 from public.sites s where s.id = site_id and (s.owner_id = auth.uid() or public.is_admin())));

-- ============================================================================
-- Album Designer — album đã lưu (thiết kế dàn trang để in)
-- Mỗi bản là một cuốn album: khổ + bộ mẫu + danh sách spread (jsonb) + link
-- folder Drive để nạp lại thư viện ảnh. Studio (và nhân viên) sửa album của mình.
-- ============================================================================
create table if not exists public.album_designs (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  name        text not null default 'Album chưa đặt tên',
  size        jsonb not null default '{}'::jsonb,   -- { name, w, h }
  tpl         jsonb not null default '{}'::jsonb,   -- { id, name, page, ink, font }
  spreads     jsonb not null default '[]'::jsonb,   -- Spread[]
  folder      text,                                 -- link folder Drive (nạp lại thư viện)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists album_designs_owner_idx on public.album_designs (owner_id, updated_at desc);
alter table public.album_designs enable row level security;
drop policy if exists album_designs_owner_all on public.album_designs;
create policy album_designs_owner_all on public.album_designs
  for all using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

-- ============================================================================
-- Customer quotes (báo giá gửi khách trước khi ký hợp đồng)
-- Studio creates a quote with line items, shares a public /q/[token] link.
-- Client can check/uncheck optional items, request adjustments, or accept.
-- On accept, the studio one-clicks "Tạo hợp đồng" to spawn a studio_contracts
-- row + contract_items copied from the selected quote items.
-- ============================================================================
create table if not exists public.studio_quotes (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references public.profiles (id) on delete cascade,
  code            text,                                -- BG-2026-001
  title           text not null default 'Báo giá',
  client_name     text,
  client_phone    text,
  client_email    text,
  event_date      date,
  location        text,
  intro           text,                                -- lời mở đầu / lời chào khách
  note            text,                                -- ghi chú nội bộ studio
  deposit_percent integer not null default 30,         -- gợi ý cọc khi chuyển sang HĐ
  status          text not null default 'draft'
                    check (status in ('draft','sent','viewed','adjust_requested','accepted','converted','expired','cancelled')),
  client_token    text not null unique,                -- /q/[token]
  expires_at      timestamptz,
  contract_id     uuid references public.studio_contracts (id) on delete set null,
  viewed_at       timestamptz,
  accepted_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists studio_quotes_owner_idx on public.studio_quotes (owner_id);

drop trigger if exists studio_quotes_set_updated_at on public.studio_quotes;
create trigger studio_quotes_set_updated_at
  before update on public.studio_quotes
  for each row execute function public.set_updated_at();

alter table public.studio_quotes enable row level security;
drop policy if exists studio_quotes_owner_all on public.studio_quotes;
create policy studio_quotes_owner_all on public.studio_quotes
  for all using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

-- Quote line items. is_optional=false items are required (client can't deselect).
create table if not exists public.quote_items (
  id           uuid primary key default gen_random_uuid(),
  quote_id     uuid not null references public.studio_quotes (id) on delete cascade,
  name         text not null default '',
  description  text,
  qty          integer not null default 1,
  unit_price   integer not null default 0,             -- VND
  is_optional  boolean not null default true,          -- false = bắt buộc
  selected     boolean not null default true,          -- client's pick
  position     integer not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists quote_items_quote_idx on public.quote_items (quote_id);
alter table public.quote_items enable row level security;
drop policy if exists quote_items_owner_all on public.quote_items;
create policy quote_items_owner_all on public.quote_items
  for all using (
    exists (select 1 from public.studio_quotes q
            where q.id = quote_id and (q.owner_id = auth.uid() or public.is_admin()))
  ) with check (
    exists (select 1 from public.studio_quotes q
            where q.id = quote_id and (q.owner_id = auth.uid() or public.is_admin()))
  );

-- Client-submitted adjustment requests on a quote (chat-style messages).
create table if not exists public.quote_adjustments (
  id         uuid primary key default gen_random_uuid(),
  quote_id   uuid not null references public.studio_quotes (id) on delete cascade,
  author     text not null default 'client' check (author in ('client','studio')),
  message    text not null,
  resolved   boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists quote_adjustments_quote_idx on public.quote_adjustments (quote_id, created_at);
alter table public.quote_adjustments enable row level security;
drop policy if exists quote_adjustments_owner_all on public.quote_adjustments;
create policy quote_adjustments_owner_all on public.quote_adjustments
  for all using (
    exists (select 1 from public.studio_quotes q
            where q.id = quote_id and (q.owner_id = auth.uid() or public.is_admin()))
  ) with check (
    exists (select 1 from public.studio_quotes q
            where q.id = quote_id and (q.owner_id = auth.uid() or public.is_admin()))
  );


-- Quote-specific additions: capture client identity at the accept step.
alter table public.studio_quotes add column if not exists client_facebook       text;
alter table public.studio_quotes add column if not exists auto_create_contract  boolean not null default false;

-- Contracts now also keep a Facebook link (auto-filled when spawned from a quote).
alter table public.studio_contracts add column if not exists client_facebook text;

-- Mark a quote_item as a discount/combo line: it is subtracted from the total
-- instead of added. The same row stays in quote_items so the studio can edit
-- the name (e.g. "Giảm combo cưới"), amount, and whether it is optional.
alter table public.quote_items add column if not exists is_discount boolean not null default false;


-- ============================================================================
-- Promote your first admin (replace the email), run AFTER signing up once:
--   update public.profiles set role = 'admin', is_active = true,
--     can_zip = true, can_notes = true, monthly_album_limit = null
--   where email = 'you@example.com';
-- ============================================================================

-- Package grouping for quote items: items with the same package_group string
-- form a selectable bundle. The client picks the whole bundle at once.
alter table public.quote_items add column if not exists package_group text null;

-- Automatic bulk-select discount: when the client picks >= bulk_discount_min_items
-- optional items, knock bulk_discount_amount off the total.
-- Set bulk_discount_min_items = 0 to disable (default).
alter table public.studio_quotes add column if not exists bulk_discount_amount    bigint not null default 0;
alter table public.studio_quotes add column if not exists bulk_discount_min_items int    not null default 0;

-- Package-tied discount: packages are mutually exclusive (the client picks one
-- package). If the client selects the studio's designated package
-- (discount_package_group), bulk_discount_amount is knocked off the total.
alter table public.studio_quotes add column if not exists discount_package_group text null;

-- ============================================================================
-- Affiliate / referral system
-- ============================================================================

-- Each user gets one affiliate code (generated on demand).
create table if not exists public.affiliate_codes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  code        text not null unique,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
alter table public.affiliate_codes enable row level security;
drop policy if exists affiliate_codes_owner on public.affiliate_codes;
create policy affiliate_codes_owner on public.affiliate_codes
  for all using (user_id = auth.uid());
drop policy if exists affiliate_codes_admin on public.affiliate_codes;
create policy affiliate_codes_admin on public.affiliate_codes
  for all using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Commission records: created when a referred user buys a plan.
create table if not exists public.affiliate_commissions (
  id                  uuid primary key default gen_random_uuid(),
  referrer_id         uuid not null references public.profiles(id) on delete cascade,
  referred_user_id    uuid references public.profiles(id) on delete set null,
  referred_email      text,
  plan                text not null,
  cycle               text not null default 'month',
  sale_amount         bigint not null default 0,  -- VND
  commission_pct      int not null default 0,      -- %
  commission_amount   bigint not null default 0,   -- VND
  status              text not null default 'pending', -- pending | paid | cancelled
  upgrade_request_id  uuid,
  note                text,
  created_at          timestamptz not null default now(),
  paid_at             timestamptz
);
alter table public.affiliate_commissions enable row level security;
drop policy if exists affiliate_commissions_owner on public.affiliate_commissions;
create policy affiliate_commissions_owner on public.affiliate_commissions
  for select using (referrer_id = auth.uid());
drop policy if exists affiliate_commissions_admin on public.affiliate_commissions;
create policy affiliate_commissions_admin on public.affiliate_commissions
  for all using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Track which affiliate code referred each user (set on first sign-up/visit).
alter table public.profiles add column if not exists referred_by text; -- affiliate code

-- Commission % per plan (stored in site_settings).
alter table public.site_settings add column if not exists affiliate_commission_basic             int not null default 10;
alter table public.site_settings add column if not exists affiliate_commission_photographer      int not null default 10;
alter table public.site_settings add column if not exists affiliate_commission_photographer_plus int not null default 10;
alter table public.site_settings add column if not exists affiliate_commission_studio            int not null default 10;

-- ============================================================================
-- Google Calendar integration
-- ============================================================================
-- Encrypted OAuth2 refresh token for each user who connects Google Calendar.
alter table public.profiles add column if not exists google_refresh_token text;
-- Which Google Calendar ID to sync to (default: 'primary').
alter table public.profiles add column if not exists google_calendar_id   text;

-- Store the Google Calendar event ID on each local event so we can update/delete it.
alter table public.studio_events    add column if not exists gcal_event_id text;
alter table public.studio_contracts add column if not exists gcal_event_id text;

-- Auto-cleanup of client transfer-proof images: stamp when a contract is marked
-- completed; a daily cron purges its payment-proof images ~1 month later and
-- records when it did so (and notifies the studio).
alter table public.studio_contracts add column if not exists completed_at      timestamptz;
alter table public.studio_contracts add column if not exists proofs_purged_at  timestamptz;

-- ============================================================================
-- THIỆP CƯỚI ONLINE (online wedding invitation) — see supabase/wedding_invitations.sql
-- A free gift attached to a wedding contract. Studio creates a draft; the
-- client edits via a token link (no account); guests view at thiep.<domain>/<slug>.
-- ============================================================================
create table if not exists public.wedding_invitations (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles (id) on delete cascade,
  contract_id  uuid references public.studio_contracts (id) on delete set null,
  slug         text not null unique,
  edit_token   text not null unique,
  template     text not null default 'classic',
  config       jsonb not null default '{}'::jsonb,
  published    boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists wedding_invitations_owner_idx on public.wedding_invitations (owner_id);
create index if not exists wedding_invitations_contract_idx on public.wedding_invitations (contract_id);
create index if not exists wedding_invitations_slug_idx on public.wedding_invitations (slug);

drop trigger if exists wedding_invitations_set_updated_at on public.wedding_invitations;
create trigger wedding_invitations_set_updated_at
  before update on public.wedding_invitations
  for each row execute function public.set_updated_at();

alter table public.wedding_invitations enable row level security;
drop policy if exists wedding_invitations_owner_all on public.wedding_invitations;
create policy wedding_invitations_owner_all on public.wedding_invitations
  for all using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

create table if not exists public.wedding_rsvps (
  id            uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.wedding_invitations (id) on delete cascade,
  guest_name    text not null default '',
  side          text not null default 'both' check (side in ('groom', 'bride', 'both')),
  attending     boolean not null default true,
  num_guests    integer not null default 1,
  wish          text,
  created_at    timestamptz not null default now()
);
create index if not exists wedding_rsvps_invitation_idx on public.wedding_rsvps (invitation_id);

alter table public.wedding_rsvps enable row level security;
drop policy if exists wedding_rsvps_owner_read on public.wedding_rsvps;
create policy wedding_rsvps_owner_read on public.wedding_rsvps
  for select using (exists (
    select 1 from public.wedding_invitations w
    where w.id = invitation_id and (w.owner_id = auth.uid() or public.is_admin())
  ));

-- Chứa cả ảnh bìa/album LẪN nhạc nền (.mp3…). Trần 12MB, không giới hạn MIME
-- (allowed_mime_types = null) để không chặn nhầm audio. on conflict do update để
-- chạy lại migration sửa được bucket cũ nếu trước đây lỡ đặt chỉ cho ảnh.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wedding-photos', 'wedding-photos', true, 12582912, null)
on conflict (id) do update
  set public = true,
      file_size_limit = 12582912,
      allowed_mime_types = null;

drop policy if exists wedding_photos_read on storage.objects;
create policy wedding_photos_read on storage.objects
  for select using (bucket_id = 'wedding-photos');

-- STORAGE: logos bucket (studio brand logo + price-list poster logo).
-- Public read; only signed-in studio users upload their own logo.
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

drop policy if exists logos_read on storage.objects;
create policy logos_read on storage.objects
  for select using (bucket_id = 'logos');
drop policy if exists logos_write on storage.objects;
create policy logos_write on storage.objects
  for insert to authenticated with check (bucket_id = 'logos');
drop policy if exists logos_update on storage.objects;
create policy logos_update on storage.objects
  for update to authenticated using (bucket_id = 'logos');
drop policy if exists logos_delete on storage.objects;
create policy logos_delete on storage.objects
  for delete to authenticated using (bucket_id = 'logos');

-- ============================================================================
-- TRANG LOVE STORY — see supabase/story_pages.sql
-- ============================================================================
create table if not exists public.story_pages (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles (id) on delete cascade,
  contract_id  uuid references public.studio_contracts (id) on delete set null,
  slug         text not null unique,
  edit_token   text not null unique,
  config       jsonb not null default '{}'::jsonb,
  published    boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists story_pages_owner_idx on public.story_pages (owner_id);
create index if not exists story_pages_contract_idx on public.story_pages (contract_id);
create index if not exists story_pages_slug_idx on public.story_pages (slug);
drop trigger if exists story_pages_set_updated_at on public.story_pages;
create trigger story_pages_set_updated_at before update on public.story_pages
  for each row execute function public.set_updated_at();
alter table public.story_pages enable row level security;
drop policy if exists story_pages_owner_all on public.story_pages;
create policy story_pages_owner_all on public.story_pages
  for all using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

create table if not exists public.story_wishes (
  id         uuid primary key default gen_random_uuid(),
  story_id   uuid not null references public.story_pages (id) on delete cascade,
  guest_name text not null default '',
  wish       text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists story_wishes_story_idx on public.story_wishes (story_id);
alter table public.story_wishes enable row level security;
drop policy if exists story_wishes_owner_read on public.story_wishes;
create policy story_wishes_owner_read on public.story_wishes
  for select using (exists (
    select 1 from public.story_pages s
    where s.id = story_id and (s.owner_id = auth.uid() or public.is_admin())
  ));

-- Love Story: guest contributions written to the COUPLE's own Google Drive.
alter table public.story_pages add column if not exists drive_refresh_token text;   -- couple's Drive OAuth (drive.file)
alter table public.story_pages add column if not exists drive_upload_folder text;   -- app-created folder id for guest uploads

create table if not exists public.story_uploads (
  id            uuid primary key default gen_random_uuid(),
  story_id      uuid not null references public.story_pages (id) on delete cascade,
  drive_file_id text not null,
  name          text not null default '',
  is_video      boolean not null default false,
  guest_name    text not null default '',
  approved      boolean not null default true,
  created_at    timestamptz not null default now()
);
create index if not exists story_uploads_story_idx on public.story_uploads (story_id, approved, created_at);
alter table public.story_uploads enable row level security;
drop policy if exists story_uploads_owner_read on public.story_uploads;
create policy story_uploads_owner_read on public.story_uploads
  for select using (exists (
    select 1 from public.story_pages s
    where s.id = story_id and (s.owner_id = auth.uid() or public.is_admin())
  ));

-- ─── MStudo Desktop (client Windows) ──────────────────────────────────────────
-- Thiết bị đã đăng ký của chủ studio — tối đa 2 máy hoạt động / tài khoản.
create table if not exists public.desktop_devices (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles (id) on delete cascade,
  name         text not null default '',          -- tên máy (VD: PC-Studio-01)
  token_hash   text not null unique,              -- sha256 của token thiết bị (token chỉ trả về 1 lần)
  app_version  text,
  last_sync_at timestamptz,                       -- lần đồng bộ cuối
  revoked_at   timestamptz,                       -- null = đang hoạt động
  created_at   timestamptz not null default now()
);
create index if not exists desktop_devices_owner_idx on public.desktop_devices (owner_id);
alter table public.desktop_devices enable row level security;
drop policy if exists desktop_devices_owner on public.desktop_devices;
create policy desktop_devices_owner on public.desktop_devices
  for all using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

-- ─── MStudo Desktop · Đồng bộ ảnh/video hợp đồng lên Google Drive ─────────────
-- Khi hợp đồng ĐÃ KÝ, client tạo cây thư mục trên máy + trên Drive studio rồi tải
-- lên (1 chiều). "JPG Goc" → album chọn ảnh; "File ChinhSua" → gallery giao khách.
-- Refresh token của studio là BÍ MẬT → bảng riêng, RLS bật, KHÔNG cấp quyền cho
-- anon/authenticated (chỉ service-role ở API server đọc/ghi).
create table if not exists public.studio_drive (
  owner_id         uuid primary key references public.profiles (id) on delete cascade,
  refresh_token    text,        -- OAuth Google Drive của studio (scope drive.file) — CHỈ SERVER
  root_folder_id   text,        -- thư mục gốc app tạo trong Drive studio (studio có thể tự kéo đi nơi khác — vẫn nhận theo ID)
  root_folder_name text,        -- tên thư mục gốc studio đặt (null → "MStudo")
  folder_template  jsonb,       -- mẫu thư mục con mặc định (null → mặc định trong mã)
  connected_at     timestamptz,
  updated_at       timestamptz not null default now()
);
-- Kết nối Drive TOÀN QUYỀN (scope drive) cho công cụ Lọc ảnh: chép ảnh vào bất
-- kỳ link studio có quyền sửa, tự động không cần đăng nhập lại. Tách riêng khỏi
-- refresh_token (drive.file) của luồng đồng bộ hợp đồng.
alter table public.studio_drive add column if not exists filter_refresh_token text;
revoke all on public.studio_drive from anon, authenticated;
alter table public.studio_drive enable row level security;

-- Mỗi hợp đồng: thư mục Drive đã tạo + sơ đồ cây (local ↔ Drive) + mốc đồng bộ.
-- drive_tree = [{ path, id, role: 'selection'|'delivery'|null, excluded }]
alter table public.studio_contracts add column if not exists drive_folder_id text;
alter table public.studio_contracts add column if not exists drive_tree      jsonb;
alter table public.studio_contracts add column if not exists drive_synced_at timestamptz;
-- Studio chọn khi TẠO hợp đồng: tạo thư mục ảnh / video (chọn riêng).
alter table public.studio_contracts add column if not exists drive_make_photo boolean not null default true;
alter table public.studio_contracts add column if not exists drive_make_video boolean not null default false;

-- ─── Google Drive của ADMIN (lưu nội dung người dùng) — refresh token BÍ MẬT ───
-- Tách khỏi site_settings (bảng có policy đọc công khai). RLS bật + revoke → chỉ
-- service-role (API server) đọc/ghi được. Xem src/lib/mstudo-drive.ts.
create table if not exists public.admin_drive (
  id            int primary key default 1 check (id = 1),
  refresh_token text,
  folder_id     text,
  updated_at    timestamptz not null default now()
);
insert into public.admin_drive (id) values (1) on conflict (id) do nothing;
revoke all on public.admin_drive from anon, authenticated;
alter table public.admin_drive enable row level security;

-- ─── Tự động nhắn tin Zalo (per-studio) — CHỈ gói `studio` ──────────────────
-- Xem supabase/migrations/studio_zalo.sql. Token OA + phiên cá nhân là BÍ MẬT →
-- RLS bật + REVOKE anon/authenticated (chỉ service-role đọc/ghi). Phiên cá nhân
-- còn được mã hoá AES-256-GCM (src/lib/zalo/crypto.ts).
create table if not exists public.studio_zalo (
  owner_id             uuid primary key references public.profiles (id) on delete cascade,
  channel              text not null default 'personal' check (channel in ('oa', 'personal')),
  display_name         text,
  status               text not null default 'disconnected'
                         check (status in ('disconnected', 'connected', 'expired', 'error')),
  oa_id                text,
  oa_access_token      text,
  oa_access_expires_at timestamptz,
  oa_refresh_token     text,
  personal_session     text,
  personal_self        jsonb,
  auto_events          jsonb not null default '{}'::jsonb,
  last_error           text,
  connected_at         timestamptz,
  updated_at           timestamptz not null default now()
);
revoke all on public.studio_zalo from anon, authenticated;
alter table public.studio_zalo enable row level security;

create table if not exists public.zalo_messages (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles (id) on delete cascade,
  channel      text not null default 'personal',
  audience     text,
  to_phone     text,
  to_uid       text,
  to_name      text,
  body         text not null default '',
  template_id  text,
  kind         text,
  contract_id  uuid references public.studio_contracts (id) on delete set null,
  status       text not null default 'pending'
                 check (status in ('pending', 'sent', 'failed', 'skipped')),
  error        text,
  attempts     int not null default 0,
  created_at   timestamptz not null default now(),
  sent_at      timestamptz
);
create index if not exists zalo_messages_owner_idx on public.zalo_messages (owner_id, created_at desc);
create index if not exists zalo_messages_pending_idx on public.zalo_messages (status) where status = 'pending';
alter table public.zalo_messages enable row level security;
drop policy if exists zalo_messages_owner_read on public.zalo_messages;
create policy zalo_messages_owner_read on public.zalo_messages
  for select using (owner_id = auth.uid() or public.is_admin());

-- ─── Form điền thông tin trước buổi chụp (gửi kèm nhắc lịch Zalo) ───────────
-- Khách mở bằng link riêng không mật khẩu (intake_token). intake = jsonb dữ liệu
-- (PSC: 2 phần nhà gái/nhà trai + vị trí lat/lng + link Maps). Xem migration
-- supabase/migrations/contract_intake.sql.
alter table public.studio_contracts add column if not exists intake_token       text unique;
alter table public.studio_contracts add column if not exists intake              jsonb;
alter table public.studio_contracts add column if not exists intake_submitted_at timestamptz;
