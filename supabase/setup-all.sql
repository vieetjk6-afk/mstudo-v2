-- ══════════════════════════════════════════════════════════════════════════
-- mstudo — CÀI ĐẶT MỘT LẦN CHO PROJECT SUPABASE MỚI
--
-- File này do supabase/build-setup-all.mjs sinh ra — ĐỪNG sửa tay, sửa file
-- gốc rồi chạy lại: node supabase/build-setup-all.mjs
--
-- Cách dùng: mở Supabase → SQL Editor → dán toàn bộ file này → Run.
-- Mọi câu lệnh đều idempotent nên chạy lại nhiều lần vô hại.
--
-- Bố cục: PHẦN 1 tạo bảng, PHẦN 2 vá cột/chỉ mục/hàm/seed, PHẦN 3 cấp quyền.
-- Bộ sinh tự xếp lại theo 3 nhịp đó (giữ nguyên thứ tự tương đối trong mỗi
-- nhịp) vì trong file gốc nhiều policy/grant và `alter table add column` đứng
-- TRƯỚC bảng mà chúng tham chiếu — chạy trên database trắng sẽ lỗi.
-- ══════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════
-- PHẦN 1 — TẠO BẢNG
-- ══════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════
-- ▶ schema.sql — Nền: profiles, albums, hợp đồng, studio, site_settings, storage buckets
-- ══════════════════════════════════════════════════════════════════════════

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

-- ============================================================================
-- Monthly album-creation quota. Counted from an append-only creation log so
-- that DELETING an album does NOT free up the monthly quota. Admins exempt.
-- ============================================================================
create table if not exists public.album_creations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- null = chưa dùng thử lần nào

-- Per-month "filter tool" usage log (free = 10/month).
create table if not exists public.filter_usages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- final price after discount (VND)

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

-- Per-account redemption log: each code can be used at most once per user.
create table if not exists public.discount_redemptions (
  id         uuid primary key default gen_random_uuid(),
  code       text not null,
  user_id    uuid references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (code, user_id)
);

create table if not exists public.compress_usages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users (id) on delete cascade,
  kind       text not null default 'basic',   -- 'basic' | 'picker'
  created_at timestamptz not null default now()
);

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

-- Client requests to amend a contract -----------------------------------------
create table if not exists public.contract_edit_requests (
  id          uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.studio_contracts (id) on delete cascade,
  message     text not null,
  status      text not null default 'open' check (status in ('open', 'resolved')),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);

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

-- Saved message templates (mẫu tin nhắn) for quick copy into Zalo/Messenger/email.
create table if not exists public.message_templates (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  title      text not null default '',
  body       text not null default '',
  created_at timestamptz not null default now()
);

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

create table if not exists public.contract_equipment (
  id           uuid primary key default gen_random_uuid(),
  contract_id  uuid not null references public.studio_contracts (id) on delete cascade,
  equipment_id uuid references public.studio_equipment (id) on delete set null,
  name         text not null default '',
  created_at   timestamptz not null default now()
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

-- Per-contract checklist (đặt cọc, chụp, chọn ảnh, retouch, in album, giao…).
create table if not exists public.contract_tasks (
  id          uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.studio_contracts (id) on delete cascade,
  label       text not null default '',
  done        boolean not null default false,
  position    integer not null default 0,
  created_at  timestamptz not null default now()
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

create table if not exists public.contract_template_items (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.contract_templates (id) on delete cascade,
  name        text not null default '',
  qty         integer not null default 1,
  unit_price  integer not null default 0,
  position    integer not null default 0
);

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

-- Ca công ty của thợ freelancer (Hòa Phát A/B/C). Chỉ nhớ thợ thuộc ca nào; các
-- ca cụ thể được TÍNH lúc hiển thị (src/lib/crew-shift.ts), không sinh sẵn dòng.
create table if not exists public.crew_shift_plan (
  phone      text primary key,
  company    text not null default 'hoa_phat',
  shift      text not null check (shift in ('A', 'B', 'C')),
  updated_at timestamptz not null default now()
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

-- Client-submitted payment proof images (uploaded via the public contract portal).
create table if not exists public.contract_client_proofs (
  id          uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.studio_contracts (id) on delete cascade,
  url         text not null,
  note        text,
  uploaded_at timestamptz not null default now()
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

-- Client-submitted adjustment requests on a quote (chat-style messages).
create table if not exists public.quote_adjustments (
  id         uuid primary key default gen_random_uuid(),
  quote_id   uuid not null references public.studio_quotes (id) on delete cascade,
  author     text not null default 'client' check (author in ('client','studio')),
  message    text not null,
  resolved   boolean not null default false,
  created_at timestamptz not null default now()
);

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

create table if not exists public.story_wishes (
  id         uuid primary key default gen_random_uuid(),
  story_id   uuid not null references public.story_pages (id) on delete cascade,
  guest_name text not null default '',
  wish       text not null default '',
  created_at timestamptz not null default now()
);

-- app-created folder id for guest uploads

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

-- ─── Google Drive của ADMIN (lưu nội dung người dùng) — refresh token BÍ MẬT ───
-- Tách khỏi site_settings (bảng có policy đọc công khai). RLS bật + revoke → chỉ
-- service-role (API server) đọc/ghi được. Xem src/lib/mstudo-drive.ts.
create table if not exists public.admin_drive (
  id            int primary key default 1 check (id = 1),
  refresh_token text,
  folder_id     text,
  updated_at    timestamptz not null default now()
);

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


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ push_subscriptions.sql — Web Push (thông báo đẩy)
-- ══════════════════════════════════════════════════════════════════════════

-- Web Push subscriptions. Run this in Supabase → SQL Editor.
create table if not exists push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null,          -- the studio owner who receives notifications
  user_id     uuid not null,          -- the device's logged-in user (owner or staff)
  endpoint    text not null unique,   -- unique per device/browser
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz default now()
);


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ wedding_invitations.sql — Thiệp cưới online
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- THIỆP CƯỚI ONLINE (online wedding invitation)
-- A free gift attached to a wedding contract. The studio creates a draft from
-- the contract; the client edits it via a token link (no account, like /c/),
-- and guests view it at thiep.<domain>/<slug>.
--
-- Run this in the Supabase SQL editor (it is also folded into schema.sql).
-- ============================================================================

create table if not exists public.wedding_invitations (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles (id) on delete cascade,
  contract_id  uuid references public.studio_contracts (id) on delete set null,
  slug         text not null unique,            -- thiep.<domain>/<slug>
  edit_token   text not null unique,            -- /thiep/sua/<edit_token> (client edits, no login)
  template     text not null default 'classic',
  config       jsonb not null default '{}'::jsonb,  -- toàn bộ nội dung thiệp (xem WeddingConfig)
  published    boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Guest RSVPs (khách mời xác nhận tham dự + lời chúc). Written by the public
-- page via the service-role API; read by the studio/owner.
create table if not exists public.wedding_rsvps (
  id            uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.wedding_invitations (id) on delete cascade,
  guest_name    text not null default '',
  side          text not null default 'both' check (side in ('groom', 'bride', 'both')),
  attending     boolean not null default true,
  num_guests    integer not null default 1,
  wish          text,                            -- lời chúc
  created_at    timestamptz not null default now()
);


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ story_pages.sql — Trang Love Story
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- TRANG LOVE STORY (wedding story / share page)
-- A studio gift like the wedding invitation, but Instagram-style: photos & video
-- come from a Google Drive FOLDER the couple provides (read-only), the couple
-- edits the content, guests view + leave wishes. QR/print reuse the invite flow.
--
-- Run in the Supabase SQL editor (also folded into schema.sql).
-- ============================================================================

create table if not exists public.story_pages (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles (id) on delete cascade,
  contract_id  uuid references public.studio_contracts (id) on delete set null,
  slug         text not null unique,          -- thiep.<domain>/story/<slug> (or /story/<slug>)
  edit_token   text not null unique,          -- /story/sua/<edit_token> (client edits, no login)
  config       jsonb not null default '{}'::jsonb,  -- xem StoryConfig (drive_folder, video, story…)
  published    boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Guest wishes (lời chúc) — written by the public page via the service-role API.
create table if not exists public.story_wishes (
  id         uuid primary key default gen_random_uuid(),
  story_id   uuid not null references public.story_pages (id) on delete cascade,
  guest_name text not null default '',
  wish       text not null default '',
  created_at timestamptz not null default now()
);

-- app-created folder id for guest uploads

create table if not exists public.story_uploads (
  id            uuid primary key default gen_random_uuid(),
  story_id      uuid not null references public.story_pages (id) on delete cascade,
  drive_file_id text not null,                 -- file id trên Drive của cặp đôi
  name          text not null default '',
  is_video      boolean not null default false,
  guest_name    text not null default '',
  approved      boolean not null default true, -- tự duyệt; cặp đôi có thể gỡ trong trình sửa
  created_at    timestamptz not null default now()
);


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/admin_drive.sql — Vá bảo mật: tách refresh_token Drive của admin
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- VÁ BẢO MẬT — di chuyển refresh_token Google Drive của admin ra khỏi
-- site_settings (bảng có policy đọc CÔNG KHAI using(true) → anon bằng anon key có
-- thể đọc được token) sang bảng riêng public.admin_drive chỉ service-role.
-- Đồng thời khóa quyền đọc công khai của album_shares (chống duyệt token share).
-- Chạy trên Supabase (SQL Editor). An toàn khi chạy lại (idempotent).
-- ============================================================================

create table if not exists public.admin_drive (
  id            int primary key default 1 check (id = 1),
  refresh_token text,
  folder_id     text,
  updated_at    timestamptz not null default now()
);


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/album_designs.sql — Thiết kế Album
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- Album Designer — bảng lưu album đã thiết kế. Chạy trên Supabase SQL Editor.
-- An toàn khi chạy lại (idempotent).
-- ============================================================================
create table if not exists public.album_designs (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  name        text not null default 'Album chưa đặt tên',
  size        jsonb not null default '{}'::jsonb,
  tpl         jsonb not null default '{}'::jsonb,
  spreads     jsonb not null default '[]'::jsonb,
  folder      text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/crew_schedule.sql — Lịch thợ (phải chạy TRƯỚC crew_profile_show)
-- ══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────
-- Ca công ty của thợ freelancer (Hòa Phát: 3 ca A/B/C).
--
-- KHÔNG lưu từng ca vào lịch — chu kỳ là công thức thuần tuý (xem
-- src/lib/crew-shift.ts) nên chỉ cần nhớ thợ thuộc ca nào, còn lịch thì tính ra
-- lúc hiển thị. Nhờ vậy lịch đúng ở mọi tháng, quá khứ lẫn tương lai, mà không
-- phải sinh sẵn dòng nào.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.crew_shift_plan (
  phone      text primary key,
  company    text not null default 'hoa_phat',
  shift      text not null check (shift in ('A', 'B', 'C')),
  updated_at timestamptz not null default now()
);


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/crew_profile_show.sql — Hồ sơ thợ & thông tin show
-- ══════════════════════════════════════════════════════════════════════════

-- 5) Tài khoản nhẹ của thợ: giữ token feed lịch (.ics) để thợ tự đăng ký vào
--    Google Calendar. Không OAuth, không tài khoản — thợ chỉ có số điện thoại.
create table if not exists public.crew_account (
  phone          text primary key,
  calendar_token text unique,
  created_at     timestamptz not null default now()
);


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/rental.sql — Phòng váy: kho trang phục & đơn thuê
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- RENTAL MODULE (Thuê đồ) — quản lý kho trang phục (váy cưới, vest, áo dài,
-- phụ kiện) và đơn cho thuê. Theo pattern studio_*: owner_id + RLS owner/admin.
-- Mọi thao tác đăng nhập đi qua RLS; đơn thuê liên kết tùy chọn với hợp đồng.
-- Chạy 1 lần trong Supabase SQL Editor.
-- ============================================================================

-- Kho trang phục -------------------------------------------------------------
create table if not exists public.rental_items (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles (id) on delete cascade,
  name          text not null default '',
  category      text not null default 'dress'
                  check (category in ('dress', 'vest', 'ao_dai', 'accessory', 'other')),
  code          text,                          -- mã sản phẩm (SKU)
  size          text,
  color         text,
  rental_price  integer not null default 0,    -- giá thuê / lần (VND)
  deposit       integer not null default 0,    -- tiền cọc (VND)
  quantity      integer not null default 1,    -- số lượng sở hữu
  cover_url     text,                          -- ảnh minh hoạ
  status        text not null default 'available'
                  check (status in ('available', 'maintenance', 'retired')),
  note          text,
  created_at    timestamptz not null default now()
);

-- Đơn thuê -------------------------------------------------------------------
create table if not exists public.rental_orders (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles (id) on delete cascade,
  contract_id   uuid references public.studio_contracts (id) on delete set null,
  client_name   text not null default '',
  client_phone  text,
  pickup_date   date,                          -- ngày nhận
  return_date   date,                          -- ngày trả (hẹn)
  returned_at   date,                          -- ngày trả thực tế (null = chưa trả)
  total_price   integer not null default 0,    -- tổng tiền thuê (VND)
  deposit_paid  integer not null default 0,    -- cọc đã thu (VND)
  status        text not null default 'booked'
                  check (status in ('booked', 'picked_up', 'returned', 'overdue', 'canceled')),
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Dòng đơn thuê (nối đơn ↔ trang phục) ---------------------------------------
create table if not exists public.rental_order_items (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.rental_orders (id) on delete cascade,
  item_id    uuid references public.rental_items (id) on delete set null,
  name       text not null default '',         -- snapshot tên món (giữ khi item bị xoá)
  price      integer not null default 0,        -- giá tại thời điểm thuê (VND)
  qty        integer not null default 1,
  created_at timestamptz not null default now()
);


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/site_views.sql — Đếm lượt xem website studio
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- MStudo — Đếm lượt xem website studio (mỗi ngày một dòng).
--
-- Studio đang không biết trang mình có ai vào. Bảng này giữ số lượt xem theo
-- NGÀY cho từng site (không lưu IP, không theo dõi cá nhân — chỉ đếm).
-- Chỉ service-role (API server) được GHI; chủ studio ĐỌC số của site mình.
-- Chạy được nhiều lần (idempotent).
-- ============================================================================

create table if not exists public.site_views (
  site_id uuid not null references public.sites (id) on delete cascade,
  day     date not null default current_date,
  views   integer not null default 0,
  primary key (site_id, day)
);


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/studio_drive_sync.sql — Đồng bộ Google Drive cho hợp đồng
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- MStudo Desktop · Đồng bộ ảnh/video hợp đồng lên Google Drive của studio
-- Chạy trên Supabase (SQL Editor). An toàn khi chạy lại (idempotent).
--
-- Mô hình: khi hợp đồng ĐÃ KÝ, client MStudo Desktop tạo cây thư mục trên máy
-- (Photo/{JPG Goc,Raw,File ChinhSua}, Video/{Video Goc,Video HoanThien}), tạo
-- cây thư mục tương ứng trên Google Drive của studio rồi TẢI LÊN (1 chiều).
-- "JPG Goc" tự thành album chọn ảnh, "File ChinhSua" tự thành gallery giao khách.
--
-- Refresh token của studio là BÍ MẬT → để trong bảng RIÊNG, RLS bật, KHÔNG cấp
-- quyền cho anon/authenticated (chỉ service-role ở API server đọc/ghi được).
-- ============================================================================

create table if not exists public.studio_drive (
  owner_id         uuid primary key references public.profiles (id) on delete cascade,
  refresh_token    text,        -- OAuth Google Drive của studio (scope drive.file) — CHỈ SERVER
  root_folder_id   text,        -- thư mục gốc do app tạo trong Drive studio (studio có thể tự kéo đi nơi khác — vẫn nhận theo ID)
  root_folder_name text,        -- tên thư mục gốc studio đặt (null → "MStudo")
  folder_template  jsonb,       -- mẫu thư mục con mặc định (null → mặc định trong mã)
  connected_at     timestamptz,
  updated_at       timestamptz not null default now()
);


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/studio_zalo.sql — Tự động nhắn Zalo theo từng studio
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- MStudo — Tự động nhắn tin Zalo (per-studio). CHỈ dành cho gói `studio`.
--
-- Mỗi studio tự KẾT NỐI kênh Zalo của họ (giống studio_drive):
--   • channel = 'oa'       → Official Account (chính thống): gửi ZNS / tin OA.
--   • channel = 'personal' → tài khoản Zalo cá nhân (đăng nhập QR, dùng zca-js).
--
-- Token OA + phiên đăng nhập cá nhân là BÍ MẬT → bảng riêng, RLS bật + REVOKE mọi
-- quyền của anon/authenticated ⇒ CHỈ service-role (API server) đọc/ghi được.
-- Phiên cá nhân còn được mã hoá AES-256-GCM trước khi lưu (src/lib/zalo/crypto.ts).
-- Chạy được nhiều lần (idempotent).
-- ============================================================================

create table if not exists public.studio_zalo (
  owner_id             uuid primary key references public.profiles (id) on delete cascade,
  channel              text not null default 'personal' check (channel in ('oa', 'personal')),
  display_name         text,                 -- tên OA / tên tài khoản cá nhân (hiển thị trong UI)
  status               text not null default 'disconnected'
                         check (status in ('disconnected', 'connected', 'expired', 'error')),

  -- ── Kênh OA (chính thống) — ZNS / tin OA ─────────────────────────────────
  oa_id                text,
  oa_access_token      text,
  oa_access_expires_at timestamptz,
  oa_refresh_token     text,

  -- ── Kênh cá nhân (zca-js) — { cookie, imei, userAgent } đã MÃ HOÁ ────────
  personal_session     text,                 -- ciphertext AES-256-GCM, KHÔNG bao giờ lưu thô
  personal_self        jsonb,                -- { id, name, avatar } của tài khoản đã đăng nhập

  -- ── Cấu hình tự động gửi theo mốc vòng đời hợp đồng ──────────────────────
  -- { "<event_key>": { "client": true, "crew": false, "templateId": "..." }, ... }
  auto_events          jsonb not null default '{}'::jsonb,

  last_error           text,
  connected_at         timestamptz,
  updated_at           timestamptz not null default now()
);

-- ── Hàng đợi + nhật ký tin Zalo đã gửi ─────────────────────────────────────
-- Chủ studio ĐỌC được tin của mình (hiển thị lịch sử); chỉ service-role GHI
-- (việc gửi luôn chạy phía máy chủ).
create table if not exists public.zalo_messages (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles (id) on delete cascade,
  channel      text not null default 'personal',
  audience     text,                          -- 'client' | 'crew' | null
  to_phone     text,
  to_uid       text,                          -- Zalo user id đã phân giải (nếu có)
  to_name      text,
  body         text not null default '',
  template_id  text,                          -- template ZNS đã dùng (nếu là OA)
  kind         text,                          -- mốc vòng đời: booking_confirm, shoot_reminder, …
  contract_id  uuid references public.studio_contracts (id) on delete set null,
  status       text not null default 'pending'
                 check (status in ('pending', 'sent', 'failed', 'skipped')),
  error        text,
  attempts     int not null default 0,
  created_at   timestamptz not null default now(),
  sent_at      timestamptz
);


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/website_chat_config.sql — Cấu hình chatbox website
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- MStudo — Cấu hình chatbox tư vấn website (mỗi studio tự chỉnh câu trả lời).
--
-- Chủ studio gõ lời chào + kiến thức/FAQ/luật riêng trong dashboard → lưu ở đây.
-- API chat đọc (service-role) và ghép vào system prompt để bot trả lời theo ý.
-- Chủ studio đọc/ghi cấu hình CỦA MÌNH (RLS). Chạy được nhiều lần (idempotent).
-- ============================================================================

create table if not exists public.website_chat_config (
  owner_id      uuid primary key references public.profiles (id) on delete cascade,
  -- Lời chào mở đầu (để trống → dùng mặc định trong code).
  greeting      text,
  -- Kiến thức / FAQ / chính sách / giọng văn / luật riêng — văn bản tự do.
  instructions  text,
  updated_at    timestamptz not null default now()
);


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/website_leads.sql — Lead & hội thoại từ chatbox
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- MStudo — Lead & hội thoại từ chatbox tư vấn trên website (vieetjk.com).
--
-- Khách nhắn qua chatbox → khi để lại SĐT (tự nhập hoặc bot xin được) thì lưu
-- một "lead" kèm toàn bộ hội thoại. Chủ studio xem trong dashboard và được báo
-- qua Zalo. Chỉ service-role (API server) GHI; chủ studio ĐỌC/cập nhật của mình.
-- Chạy được nhiều lần (idempotent).
-- ============================================================================

create table if not exists public.website_leads (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  source      text not null default 'vieetjk',       -- nguồn (site nào)
  session_id  text,                                   -- gom các tin cùng 1 phiên chat
  name        text,
  phone       text,
  interest    text,                                   -- khách quan tâm gì (tóm tắt)
  -- Toàn bộ hội thoại: [{ role: 'user'|'assistant', content: '...' }, ...]
  transcript  jsonb not null default '[]'::jsonb,
  status      text not null default 'new'
                check (status in ('new', 'contacted', 'closed')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/album_dislikes.sql — Ảnh khách 'không thích' trong album chọn ảnh
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- Ảnh khách KHÔNG THÍCH trong album chọn ảnh.
-- Khách bấm "không thích" → ảnh bị ẩn khỏi lưới chọn và chuyển sang tab riêng;
-- studio xem danh sách đó rồi xoá thẳng các file trên link Drive gốc nếu khách
-- yêu cầu.
--
-- Bảng RIÊNG (không gộp vào public.selections) để danh sách "khách chọn" dùng ở
-- công cụ Lọc ảnh / ZIP / thông báo không bao giờ lẫn ảnh bị loại.
-- Chạy trên Supabase SQL Editor. An toàn khi chạy lại (idempotent).
-- ============================================================================
create table if not exists public.dislikes (
  id           uuid primary key default gen_random_uuid(),
  album_id     uuid not null references public.albums (id) on delete cascade,
  photo_id     uuid not null references public.photos (id) on delete cascade,
  photo_name   text not null default '',
  session_id   text not null,
  client_note  text,           -- lý do khách không thích (tuỳ chọn)
  created_at   timestamptz not null default now(),
  unique (album_id, photo_id, session_id)
);


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/referral_deposit.sql — Khách giới thiệu khách · đặt cọc giữ ngày (chạy sau lifecycle_followup)
-- ══════════════════════════════════════════════════════════════════════════

-- ── 3) Sổ giới thiệu ───────────────────────────────────────────────────────
create table if not exists public.studio_referrals (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references public.profiles (id) on delete cascade,
  -- Người giới thiệu: khách CŨ của chính studio này. Lưu cả tên đã biết lúc đó
  -- để sổ vẫn đọc được nếu sau này hợp đồng cũ bị xoá.
  referrer_phone  text not null default '',
  referrer_name   text,
  -- Khách mới.
  referred_phone  text not null default '',
  referred_name   text,
  booking_id      uuid references public.studio_bookings (id) on delete set null,
  -- Hợp đồng chốt được từ lời giới thiệu này (nếu có). Chốt hợp đồng mới là mốc
  -- đáng thưởng, chứ không phải chỉ gửi yêu cầu đặt lịch.
  contract_id     uuid references public.studio_contracts (id) on delete set null,
  reward_amount   integer not null default 0,
  -- pending   — chờ khách mới chốt hợp đồng
  -- earned    — đã chốt, tới lúc tặng thưởng
  -- granted   — studio đã tặng xong
  -- cancelled — không thành (khách huỷ, trùng khách cũ…)
  status          text not null default 'pending'
                    check (status in ('pending', 'earned', 'granted', 'cancelled')),
  note            text,
  created_at      timestamptz not null default now(),
  granted_at      timestamptz
);


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/studio_appointments.sql — Lịch studio: lịch trang điểm / thử đồ / tư vấn, phòng & nguồn lực
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- LỊCH STUDIO — lịch trang điểm / thử đồ / chụp pre-wedding / tư vấn
--
-- Vì sao là bảng MỚI chứ không nhồi thêm vào `studio_events`:
--   `studio_events` là "mốc thời gian của hợp đồng" (ngày đãi trước, ngày cưới…)
--   — mỗi dòng chỉ có ngày + giờ + ghi chú, không có người phụ trách, không có
--   phòng, không có check-in. Lịch studio cần đủ 4 thứ đó để xếp ekip và cảnh
--   báo trùng lịch, nên nó là một MODEL riêng. `studio_events` giữ nguyên nhiệm
--   vụ cũ; cả hai cùng hiện trên màn Lịch làm việc.
--
-- Cùng một bảng phục vụ BA màn (bản thiết kế "Cổng nhân viên & khách hàng"):
--   /dashboard/studio/schedule — lịch tuần cấp studio
--   /staff                     — lịch hôm nay của người được phân công
--   /portal/<client_token>     — lịch trình khách xem (chỉ dòng client_visible)
--
-- Chạy 1 lần trong Supabase SQL Editor (idempotent, chạy lại vẫn an toàn).
-- ============================================================================

create table if not exists public.studio_appointments (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles (id) on delete cascade,
  contract_id   uuid references public.studio_contracts (id) on delete set null,

  -- Loại lịch — quyết định màu/nhãn/icon ở cả ba màn (xem APPOINTMENT_KIND_META
  -- trong src/lib/appointments.ts). 'pre' = chụp pre-wedding, 'shoot' = buổi
  -- chụp/quay khác, để lịch studio dùng chung được với hợp đồng thường.
  kind          text not null default 'makeup'
                  check (kind in ('makeup', 'fitting', 'pre', 'consult', 'shoot', 'delivery', 'other')),
  title         text not null default '',
  appt_date     date not null,
  -- Giờ lưu dạng text 'HH:MM' — GIỐNG studio_contracts.event_time và
  -- studio_events.event_time, để mọi màn định dạng giờ theo một cách duy nhất.
  start_time    text,
  end_time      text,
  duration_min  integer,

  location      text,
  -- Phòng / nguồn lực chiếm dụng (Phòng trang điểm 1, Phòng váy tầng 2, Phim
  -- trường…). Lưu TÊN chứ không phải khoá ngoại: studio đổi tên phòng thì lịch
  -- cũ vẫn đọc được, và phòng là danh sách rất ngắn do studio tự khai.
  room          text,

  -- Người phụ trách. Hai đường vì studio có hai loại người làm:
  --   crew_id  → sổ thợ freelancer (studio_crew, không có tài khoản đăng nhập)
  --   staff_id → nhân viên có tài khoản (profiles.studio_owner_id = owner_id)
  -- crew_name giữ tên đã hiển thị để lịch cũ không trống khi thợ bị xoá khỏi sổ.
  crew_id       uuid references public.studio_crew (id) on delete set null,
  staff_id      uuid references public.profiles (id) on delete set null,
  crew_name     text,

  client_name   text,
  client_phone  text,

  status        text not null default 'scheduled'
                  check (status in ('scheduled', 'checked_in', 'done', 'cancelled')),
  checked_in_at timestamptz,
  done_at       timestamptz,
  note          text,

  -- Khách có thấy mốc này trên cổng khách hàng không. Lịch nội bộ (họp ekip,
  -- giữ phòng) đặt false để cổng khách khỏi hiện thứ không liên quan tới họ.
  client_visible boolean not null default true,
  position      integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ============================================================================
-- PHÒNG & NGUỒN LỰC — danh sách phòng để lịch studio vẽ thanh công suất
--
-- `capacity_week` = số buổi phòng nhận được trong MỘT TUẦN. Thanh công suất =
-- số lịch đã xếp / capacity_week, nên studio tự quyết mức nào là "đầy" thay vì
-- code đoán hộ.
-- ============================================================================

create table if not exists public.studio_rooms (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles (id) on delete cascade,
  name          text not null default '',
  -- Loại phòng: gợi ý loại lịch nào nên xếp vào đây (chỉ để lọc/gợi ý, không chặn).
  kind          text not null default 'other'
                  check (kind in ('makeup', 'fitting', 'studio', 'meeting', 'other')),
  capacity_week integer not null default 10,
  note          text,
  active        boolean not null default true,
  position      integer not null default 0,
  created_at    timestamptz not null default now()
);


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/studio_branches.sql — Chi nhánh studio: nhiều cơ sở trong một tài khoản (chạy SAU studio_appointments)
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- CHI NHÁNH STUDIO — nhiều cơ sở trong CÙNG một tài khoản
--
-- Studio lớn có 2–5 cơ sở: mỗi nơi một ê-kíp, một phòng chụp, một sổ thu chi,
-- nhưng CHUNG một tài khoản, chung bảng giá, chung thư viện album. Vì vậy chi
-- nhánh là một CHIỀU PHÂN LOẠI thêm vào dữ liệu sẵn có, KHÔNG phải một tài
-- khoản studio thứ hai: không nhân bản bảng nào, chỉ thêm cột `branch_id`.
--
-- Hệ quả quan trọng: `branch_id` LUÔN cho phép NULL, nghĩa là "chưa gán chi
-- nhánh". Studio một cơ sở (đa số) không khai chi nhánh nào thì mọi dòng đều
-- NULL và mọi màn hoạt động y như trước — tính năng này không được phép làm
-- studio đang chạy phải đi gán lại dữ liệu cũ.
--
-- Chạy 1 lần trong Supabase SQL Editor (idempotent, chạy lại vẫn an toàn).
-- ============================================================================

create table if not exists public.studio_branches (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  name        text not null default '',
  -- Mã ngắn studio tự đặt (Q1, GV, HN…) — hiện trên chip chi nhánh ở chỗ chật
  -- và dùng làm tiền tố mã hợp đồng nếu studio muốn.
  code        text,
  address     text,
  phone       text,
  -- Người quản lý cơ sở: một tài khoản nhân viên của chính studio này. Xoá tài
  -- khoản đó thì chi nhánh vẫn còn, chỉ trống ô quản lý.
  manager_id  uuid references public.profiles (id) on delete set null,
  note        text,
  active      boolean not null default true,
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/inbox_unified.sql — Hộp thư hợp nhất: gom tin Zalo/Facebook/Instagram/website về một chỗ
-- ══════════════════════════════════════════════════════════════════════════

-- ── 1. KÊNH ĐÃ NỐI ─────────────────────────────────────────────────────────
-- `external_id` là định danh của kênh trên nền tảng đó: page_id của Facebook,
-- ig business id của Instagram, oa_id của Zalo OA, uid của tài khoản Zalo cá
-- nhân. Với chatbox website thì dùng chính owner_id (mỗi studio một widget).
--
-- `unique (platform, external_id)` là CỐ Ý ở phạm vi toàn hệ thống, không phải
-- theo từng studio: webhook Facebook chỉ đưa page_id, ta phải tra ngược ra chủ
-- studio từ đó. Một page thuộc về đúng một studio — studio thứ hai nối cùng
-- page sẽ bị chặn ngay ở đây thay vì âm thầm cướp tin của nhau.
create table if not exists public.inbox_channels (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles (id) on delete cascade,
  platform      text not null
                  check (platform in ('website', 'zalo_oa', 'zalo_personal', 'facebook', 'instagram', 'tiktok')),
  external_id   text not null default 'default',
  name          text,                         -- tên hiển thị (tên page/OA) cho UI
  status        text not null default 'connected'
                  check (status in ('connected', 'disconnected', 'error')),

  -- Bí mật của kênh — AES-256-GCM (src/lib/zalo/crypto.ts), KHÔNG bao giờ lưu thô.
  -- Facebook/Instagram: { pageAccessToken }. Zalo OA/cá nhân đọc lại từ
  -- studio_zalo nên để null.
  secret        text,

  -- Chế độ AI của kênh: 'auto' = bot tự trả lời, 'off' = chỉ người trả lời.
  -- Từng hội thoại còn công tắc riêng (inbox_conversations.ai_enabled) đè lên đây.
  ai_mode       text not null default 'auto' check (ai_mode in ('auto', 'off')),

  last_error    text,
  connected_at  timestamptz default now(),
  updated_at    timestamptz not null default now(),
  unique (platform, external_id)
);

-- ── 2. NGƯỜI NHẮN ──────────────────────────────────────────────────────────
create table if not exists public.inbox_contacts (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references public.profiles (id) on delete cascade,
  channel_id       uuid not null references public.inbox_channels (id) on delete cascade,
  -- Id của người này trên nền tảng đó (psid Facebook, uid Zalo, sessionId website).
  external_user_id text not null,
  name             text,
  avatar_url       text,
  phone            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (channel_id, external_user_id)
);

-- ── 3. HỘI THOẠI ───────────────────────────────────────────────────────────
-- Một người trên một kênh = một hội thoại chạy dài (không cắt theo phiên), để
-- lần sau khách nhắn lại thì nhân viên còn thấy nguyên lịch sử đã tư vấn.
create table if not exists public.inbox_conversations (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references public.profiles (id) on delete cascade,
  channel_id     uuid not null references public.inbox_channels (id) on delete cascade,
  contact_id     uuid not null references public.inbox_contacts (id) on delete cascade,

  status         text not null default 'open' check (status in ('open', 'closed')),
  -- Công tắc AI của RIÊNG hội thoại này. Nhân viên bấm "Tôi tiếp quản" → false,
  -- AI ngừng trả lời cho tới khi bật lại. Đây là lời hứa quan trọng nhất của
  -- màn hình: đã có người vào thì bot không được chen ngang.
  ai_enabled     boolean not null default true,
  -- Ai đang phụ trách (tài khoản nhân viên). null = chưa ai nhận.
  assignee_id    uuid references public.profiles (id) on delete set null,

  -- Bản xem trước cho danh sách bên trái — nhân đôi dữ liệu có chủ đích, để vẽ
  -- danh sách 300 hội thoại bằng MỘT truy vấn thay vì 300 lần lấy tin cuối.
  last_message      text,
  last_message_at   timestamptz not null default now(),
  last_direction    text check (last_direction in ('in', 'out')),
  -- Mốc tin CUỐI CÙNG của khách. Tách riêng khỏi last_message_at vì nó quyết
  -- định chuyện khác hẳn: Facebook cho nhắn lại trong 24 giờ, Zalo OA 48 giờ,
  -- tính từ tin của KHÁCH — chứ không phải từ tin studio vừa gửi. Nhân đôi ở
  -- đây để danh sách hội thoại biết ngay ô soạn tin còn mở hay đã khoá, khỏi
  -- phải quét bảng tin cho từng dòng.
  last_inbound_at   timestamptz,
  -- Số tin của khách chưa ai đọc. Nhân viên mở hội thoại → về 0.
  unread            int not null default 0,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (contact_id)
);

-- ── 4. TIN NHẮN ────────────────────────────────────────────────────────────
-- `sender` phân biệt AI với người: khách phải biết mình đang nói với ai, và
-- studio phải xem lại được bot đã hứa gì với khách.
create table if not exists public.inbox_messages (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references public.profiles (id) on delete cascade,
  conversation_id uuid not null references public.inbox_conversations (id) on delete cascade,
  direction       text not null check (direction in ('in', 'out')),
  sender          text not null check (sender in ('customer', 'ai', 'staff', 'system')),
  -- Nhân viên nào gửi (khi sender = 'staff').
  sender_id       uuid references public.profiles (id) on delete set null,
  sender_name     text,
  body            text not null default '',
  -- [{ type: 'image'|'file'|'sticker', url, name }, ...]
  attachments     jsonb not null default '[]'::jsonb,
  -- Id tin trên nền tảng gốc — chống ghi trùng khi webhook bắn lại.
  external_id     text,
  status          text not null default 'sent' check (status in ('sent', 'failed')),
  error           text,
  created_at      timestamptz not null default now()
);


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/automations.sql — Việc tự động theo trạng thái hợp đồng (chạy SAU album_selection_done)
-- ══════════════════════════════════════════════════════════════════════════

-- ── Cấu hình từng luật ──────────────────────────────────────────────────────
create table if not exists public.studio_automations (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles (id) on delete cascade,

  -- Khoá luật, thuộc TẬP ĐÓNG khai ở src/lib/automations.ts (AUTOMATION_RULES).
  -- KHÔNG đặt check constraint liệt kê tên luật ở đây: thêm luật thứ chín sẽ
  -- phải sửa cả DB, và một dòng cấu hình của luật đã bỏ thì code chỉ đơn giản
  -- không đọc tới. Tập đóng được chốt ở tầng code, nơi nó được dùng.
  rule       text not null,

  enabled    boolean not null default false,
  -- Số ngày cho luật có mốc ngày (trước buổi chụp N ngày, quá hạn N ngày).
  -- null = dùng mặc định của luật.
  offset_days integer,
  -- Ghi đè câu chữ. null/rỗng = dùng câu mặc định của luật.
  message    text,
  updated_at timestamptz not null default now(),

  -- Mỗi studio một dòng cho mỗi luật.
  unique (owner_id, rule)
);

-- ── Sổ ĐÃ CHẠY (chống lặp) ──────────────────────────────────────────────────
create table if not exists public.studio_automation_log (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  rule        text not null,
  contract_id uuid references public.studio_contracts (id) on delete cascade,

  -- Khoá chống lặp do src/lib/automations.ts sinh ra: "<luật>:<hợp đồng>" hoặc
  -- "<luật>:<hợp đồng>:<ref>". `ref` là id ĐỢT THANH TOÁN — hợp đồng chia 4 đợt
  -- thì mỗi đợt quá hạn là một lần nhắc riêng, không bị gộp mất ba.
  --
  -- UNIQUE ở đây là hàng rào THẬT, không chỉ để tra nhanh: hai lượt cron chạy
  -- chồng nhau (Vercel gọi lại vì timeout) sẽ bị chính DB chặn ở lượt thứ hai,
  -- chứ không dựa vào việc code kiểm tra trước rồi ghi sau.
  dedupe_key  text not null unique,

  fired_at    timestamptz not null default now()
);


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/crew_timesheet.sql — Chấm công thợ & khoảng rảnh (chạy SAU studio_appointments)
-- ══════════════════════════════════════════════════════════════════════════

-- ── Dòng chấm công ──────────────────────────────────────────────────────────
create table if not exists public.crew_timesheet (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles (id) on delete cascade,

  -- Định danh thợ. `phone` là khoá thật (thợ không có tài khoản); `crew_id` chỉ
  -- là tiện tra tên/vai trò khi thợ CÓ trong sổ. Thợ rời sổ thì dòng chấm công
  -- cũ vẫn còn để đối soát — nên `on delete set null`, không cascade.
  phone       text not null,
  crew_id     uuid references public.studio_crew (id) on delete set null,
  name        text,

  contract_id     uuid references public.studio_contracts (id) on delete set null,
  appointment_id  uuid references public.studio_appointments (id) on delete set null,

  -- Ngày làm, tách khỏi started_at: buổi chụp tiệc bắt đầu 19:00 và xong 02:00
  -- hôm sau vẫn phải nằm trong kỳ của NGÀY CHỤP, không nhảy sang tháng sau.
  work_date   date not null default current_date,

  started_at  timestamptz,
  -- null = ĐANG LÀM (chưa bấm xong). Số giờ của dòng này là `null`, KHÔNG phải
  -- 0 — xem `sessionHours`.
  ended_at    timestamptz,

  note        text,
  -- 'crew' = thợ tự bấm ở cổng thợ; 'studio' = studio nhập bù.
  source      text not null default 'crew' check (source in ('crew', 'studio')),
  created_at  timestamptz not null default now()
);

-- ── Khoảng RẢNH thợ tự đăng ký ──────────────────────────────────────────────
-- Ngược của crew_unavailable. Cố ý là bảng RIÊNG chứ không thêm cột `kind` vào
-- crew_unavailable: bảng kia đã có RLS, index và một cổng ghi riêng, và "bận"
-- với "rảnh" có luật ưu tiên khác nhau (báo bận THẮNG khai rảnh — xem
-- `availabilityOn`). Trộn hai nghĩa vào một bảng là cách chắc chắn để một ngày
-- nào đó đọc sai chiều.
create table if not exists public.crew_available (
  id         uuid primary key default gen_random_uuid(),
  phone      text not null,
  date       date not null,
  start_time time,
  end_time   time,
  note       text,
  owner_id   uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (phone, date, start_time)
);


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/vendors.sql — Nhà cung cấp & đơn đặt ngoài
-- ══════════════════════════════════════════════════════════════════════════

-- ── Sổ nhà cung cấp ─────────────────────────────────────────────────────────
create table if not exists public.studio_vendors (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  name       text not null default '',
  kind       text not null default 'other'
               check (kind in ('album', 'makeup', 'dress', 'car', 'venue', 'print', 'other')),
  phone      text,
  contact    text,
  note       text,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- ── Đơn đặt ngoài ───────────────────────────────────────────────────────────
create table if not exists public.vendor_orders (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles (id) on delete cascade,

  -- Nhà cung cấp rời sổ thì đơn CŨ vẫn phải đọc được để đối soát → set null,
  -- không cascade. `vendor_name` giữ lại tên tại thời điểm đặt.
  vendor_id   uuid references public.studio_vendors (id) on delete set null,
  vendor_name text,

  -- Đơn có thể không gắn hợp đồng nào (mua phông nền, in card studio).
  contract_id uuid references public.studio_contracts (id) on delete set null,

  title       text not null default '',
  amount      integer not null default 0,  -- VND
  -- đã gửi → đang làm → đã nhận → đã giao khách. KHÔNG có "đã huỷ": đơn huỷ thì
  -- xoá, vì một đơn huỷ còn nằm đây sẽ tiếp tục được cộng tiền và tiếp tục bị
  -- đếm là trễ hẹn (xem src/lib/vendors.ts).
  status      text not null default 'sent'
                check (status in ('sent', 'doing', 'received', 'delivered')),
  due_date    date,
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/accounting.sql — Phiếu thu có số & khoá sổ kế toán
-- ══════════════════════════════════════════════════════════════════════════

-- ── Bộ đếm số phiếu theo studio × năm ───────────────────────────────────────
-- Cấp số bằng UPDATE ... RETURNING trên một dòng (xem hàm bên dưới) nên hai lần
-- bấm in cùng lúc KHÔNG thể nhận cùng một số.
create table if not exists public.studio_receipt_seq (
  owner_id uuid not null references public.profiles (id) on delete cascade,
  year     integer not null,
  last_no  integer not null default 0,
  primary key (owner_id, year)
);


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/album_people.sql — Gom ảnh theo từng người trong album (chạy SAU schema.sql — cần albums + photos)
-- ══════════════════════════════════════════════════════════════════════════

-- ── Người ───────────────────────────────────────────────────────────────────
create table if not exists public.album_people (
  id             uuid primary key default gen_random_uuid(),
  album_id       uuid not null references public.albums (id) on delete cascade,
  -- Tên studio đặt. Rỗng = chưa đặt tên → không hiện chip cho khách.
  name           text not null default '' check (char_length(name) <= 60),
  -- Số khuôn mặt gom được. Chỉ để studio xếp thứ tự và nhìn ra cụm rác.
  face_count     int  not null default 0,
  -- Ảnh đại diện + khuôn mặt thứ mấy trong ảnh đó (một tấm có nhiều người).
  cover_photo_id uuid references public.photos (id) on delete set null,
  cover_at       int  not null default 0,
  /*
   * Tâm cụm: trung bình các vector 128 chiều của người này.
   *
   * Để làm gì: studio thật KHÔNG quét một lần rồi xong. Họ giao đợt đầu, chụp
   * thêm, rồi quét đợt hai. Không có vector lưu lại thì lần quét sau ra một bộ
   * người HOÀN TOÀN MỚI, studio phải đặt tên lại từ đầu và chip của khách đứt.
   * Có nó thì cụm mới ghép được vào người cũ (src/lib/face-people.ts).
   *
   * real[] chứ không phải jsonb: 128 số float4 = ~540 byte, jsonb numeric gấp
   * gần ba. Sai số float4 (~7 chữ số) không đáng kể so với ngưỡng 0,6.
   *
   * Ràng buộc độ dài là hàng rào thật: một vector sai chiều vẫn ghi được nhưng
   * làm mọi phép ghép sai lặng lẽ về sau.
   */
  descriptor     real[] check (descriptor is null or array_length(descriptor, 1) = 128),
  position       int  not null default 0,
  created_at     timestamptz not null default now()
);

-- ── Ảnh nào có ai ───────────────────────────────────────────────────────────
create table if not exists public.album_photo_people (
  -- album_id là bản sao CÓ CHỦ Ý của album_people.album_id: câu truy vấn duy
  -- nhất mà khách chạy là "lấy hết theo album", không cần join.
  album_id  uuid not null references public.albums (id) on delete cascade,
  person_id uuid not null references public.album_people (id) on delete cascade,
  photo_id  uuid not null references public.photos (id) on delete cascade,
  primary key (person_id, photo_id)
);


-- ══════════════════════════════════════════════════════════════════════════
-- PHẦN 2 — CỘT BỔ SUNG, CHỈ MỤC, HÀM, TRIGGER, DỮ LIỆU MẶC ĐỊNH
-- ══════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════
-- ▶ schema.sql — Nền: profiles, albums, hợp đồng, studio, site_settings, storage buckets
-- ══════════════════════════════════════════════════════════════════════════

-- For databases created before these existed:
alter table public.profiles add column if not exists monthly_album_limit integer default 5;

alter table public.profiles add column if not exists can_notes boolean not null default false;

alter table public.profiles alter column can_zip set default false;

create index if not exists albums_owner_idx on public.albums (owner_id);

create index if not exists album_sources_album_idx on public.album_sources (album_id);

create index if not exists photos_album_idx on public.photos (album_id);

create unique index if not exists photos_album_file_uidx
  on public.photos (album_id, drive_file_id);

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

create index if not exists album_shares_album_idx on public.album_shares (album_id);

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
-- Showcase / pinned flags for the public profile homepage
-- ============================================================================
alter table public.albums add column if not exists is_showcase boolean not null default false;

alter table public.albums add column if not exists is_pinned   boolean not null default false;

-- Drop the legacy fixed-brand watermark default; the app now falls back to the
-- studio's OWN name when watermark_text is null.
alter table public.albums alter column watermark_text drop default;

alter table public.albums add column if not exists kind        text;

-- e.g. "Phóng sự cưới"

-- ============================================================================
-- Delivery galleries (vieetjk.com/album) — reuse the albums/sources/photos
-- infrastructure with is_gallery = true. View password = the client's phone.
-- ============================================================================
alter table public.albums add column if not exists is_gallery     boolean not null default false;

alter table public.albums add column if not exists client_name    text;

alter table public.albums add column if not exists client_phone   text;

-- view password; never sent to the public client
alter table public.albums add column if not exists event_date     date;

-- wedding / engagement date
alter table public.albums add column if not exists category        text;

-- cuoi-hoi | su-kien | gia-dinh | video | khac
alter table public.albums add column if not exists category_label text;

-- custom label
alter table public.albums add column if not exists gallery_pinned  boolean not null default false;

-- pinned to homepage (no password)
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
alter table public.profiles add column if not exists plan_cycle text;

-- 'month' | 'year' | 'trial' | null
alter table public.profiles add column if not exists plan_expires_at timestamptz;

-- null = no expiry (free / lifetime)
-- Dùng thử: mỗi tài khoản chỉ được kích hoạt dùng thử MỘT lần (mọi gói / mọi mã).
alter table public.profiles add column if not exists trial_used_at timestamptz;

create index if not exists filter_usages_user_idx on public.filter_usages (user_id, created_at);

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

alter table public.upgrade_requests add column if not exists amount integer;

alter table public.discount_codes add column if not exists max_uses integer;

alter table public.discount_codes add column if not exists used_count integer not null default 0;

alter table public.discount_codes add column if not exists expires_at timestamptz;

-- null = no expiry
alter table public.discount_codes add column if not exists cycle text;

-- null = any cycle, else 'month' | 'year'
alter table public.discount_codes add column if not exists trial_days integer;

alter table public.compress_usages add column if not exists kind text not null default 'basic';

create index if not exists compress_usages_user_idx
  on public.compress_usages (user_id, kind, created_at);

create index if not exists studio_contracts_owner_idx on public.studio_contracts (owner_id);

drop trigger if exists studio_contracts_set_updated_at on public.studio_contracts;

create trigger studio_contracts_set_updated_at
  before update on public.studio_contracts
  for each row execute function public.set_updated_at();

create index if not exists contract_items_contract_idx on public.contract_items (contract_id);

create index if not exists contract_crew_contract_idx on public.contract_crew (contract_id);

create index if not exists contract_crew_phone_idx on public.contract_crew (phone);

create index if not exists contract_edit_requests_contract_idx on public.contract_edit_requests (contract_id);

create index if not exists studio_crew_owner_idx on public.studio_crew (owner_id);

create index if not exists studio_events_owner_idx on public.studio_events (owner_id, event_date);

-- ── Studio: e-signature, payments, payroll, expenses ────────────────────────

-- Client e-signature on a contract (signed via the public /c/[token] portal).
alter table public.studio_contracts add column if not exists client_signed_name text;

alter table public.studio_contracts add column if not exists client_signature  text;

-- PNG data URL
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

alter table public.studio_contracts add column if not exists studio_signature  text;

-- PNG data URL
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

alter table public.contract_products add column if not exists assigned_to uuid references public.profiles (id) on delete set null;

create index if not exists contract_products_contract_idx on public.contract_products (contract_id);

create index if not exists contract_quote_options_contract_idx on public.contract_quote_options (contract_id);

alter table public.studio_contracts add column if not exists chosen_quote_option_id uuid;

alter table public.studio_contracts add column if not exists chosen_quote_at timestamptz;

-- Pre-shoot brief (khách điền concept/yêu cầu qua cổng).
alter table public.studio_contracts add column if not exists brief_concept text;

alter table public.studio_contracts add column if not exists brief_outfit text;

alter table public.studio_contracts add column if not exists brief_refs text;

alter table public.studio_contracts add column if not exists brief_note text;

alter table public.studio_contracts add column if not exists brief_submitted_at timestamptz;

-- Lead source (nguồn khách) for the CRM + per-contract direct expenses.
alter table public.studio_contracts add column if not exists source text;

-- facebook | referral | google | walk_in | returning | other
-- Reuse studio_expenses for per-contract costs too (null contract_id = general).
alter table public.studio_expenses add column if not exists contract_id uuid references public.studio_contracts (id) on delete set null;

create index if not exists studio_expenses_contract_idx on public.studio_expenses (contract_id);

-- Whether a per-contract expense is a client-facing surcharge (shown + billed on
-- the client portal) or an internal-only cost (profit/loss only). Defaults true
-- to preserve existing billing; uncheck to keep a cost private to the studio.
alter table public.studio_expenses add column if not exists client_visible boolean not null default true;

create index if not exists studio_packages_owner_idx on public.studio_packages (owner_id);

alter table public.studio_pricelist add column if not exists list_key text not null default 'cuoi';

alter table public.studio_pricelist add column if not exists show_on_home boolean not null default true;

create index if not exists studio_pricelist_owner_idx on public.studio_pricelist (owner_id, list_key, position);

create index if not exists message_templates_owner_idx on public.message_templates (owner_id);

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

alter table public.profiles add column if not exists pl_bank_bin     text;

-- VietQR (NAPAS) bank code, for payment QR generation
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

alter table public.profiles add column if not exists auto_client_emails boolean not null default false;

-- opt-in: auto-email clients (shoot reminder, review request)

-- Widen the shoot_type check to the fuller service list (idempotent).
alter table public.studio_contracts drop constraint if exists studio_contracts_shoot_type_check;

alter table public.studio_contracts add constraint studio_contracts_shoot_type_check
  check (shoot_type in ('photo', 'video', 'both', 'psc', 'makeup', 'rental', 'prewedding', 'wedding', 'other'));

alter table public.contract_templates drop constraint if exists contract_templates_shoot_type_check;

alter table public.contract_templates add constraint contract_templates_shoot_type_check
  check (shoot_type in ('photo', 'video', 'both', 'psc', 'makeup', 'rental', 'prewedding', 'wedding', 'other'));

alter table public.studio_bookings add column if not exists package_name  text;

alter table public.studio_bookings add column if not exists package_price integer;

alter table public.studio_bookings add column if not exists facebook      text;

create index if not exists studio_bookings_owner_idx on public.studio_bookings (owner_id, status);

create index if not exists studio_equipment_owner_idx on public.studio_equipment (owner_id);

create index if not exists contract_equipment_contract_idx on public.contract_equipment (contract_id);

-- Link an installment to the actual payment recorded when it is marked collected.
alter table public.contract_payment_plan add column if not exists payment_id uuid references public.contract_payments (id) on delete set null;

create index if not exists contract_payment_plan_contract_idx on public.contract_payment_plan (contract_id);

create index if not exists studio_notifications_owner_idx on public.studio_notifications (owner_id, read, created_at);

-- Thông báo hệ thống quan trọng: hiện popup nổi bắt buộc xác nhận (do admin bật).
alter table public.studio_notifications add column if not exists important boolean not null default false;

-- Album liên quan (vd khách chọn ảnh xong) → bấm thông báo mở thẳng album đó.
alter table public.studio_notifications add column if not exists album_id uuid references public.albums (id) on delete cascade;

create index if not exists contract_tasks_contract_idx on public.contract_tasks (contract_id);

create index if not exists contract_templates_owner_idx on public.contract_templates (owner_id);

create index if not exists contract_template_items_tpl_idx on public.contract_template_items (template_id);

create index if not exists crew_unavailable_phone_idx on public.crew_unavailable (phone, date);

-- Lịch thợ: mở rộng crew_unavailable từ "ngày bận" thành "mốc lịch có giờ".
-- Xem supabase/migrations/crew_schedule.sql.
alter table public.crew_unavailable add column if not exists start_time time;

alter table public.crew_unavailable add column if not exists end_time   time;

alter table public.crew_unavailable add column if not exists overnight  boolean not null default false;

alter table public.crew_unavailable add column if not exists title      text;

alter table public.crew_unavailable add column if not exists owner_id   uuid references public.profiles (id) on delete set null;

alter table public.crew_unavailable drop constraint if exists crew_unavailable_phone_date_key;

create index if not exists contract_payments_contract_idx on public.contract_payments (contract_id);

-- Optional proof-of-transfer image (uploaded to the payment-proofs bucket).
alter table public.contract_payments add column if not exists proof_url text;

create index if not exists contract_client_proofs_contract_idx on public.contract_client_proofs (contract_id);

alter table public.contract_client_proofs add column if not exists plan_id uuid references public.contract_payment_plan(id) on delete set null;

create index if not exists studio_expenses_owner_idx on public.studio_expenses (owner_id, spent_at);

-- ============================================================================
-- STORAGE: payment-proofs bucket (transfer screenshots attached to payments)
-- Public read (so receipts/links work); only signed-in studio users may write.
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', true)
on conflict (id) do nothing;

-- ============================================================================
-- MULTI-ACCOUNT / STAFF PERMISSIONS
-- A studio owner (studio plan) can create staff sub-accounts. Staff rows have
-- studio_owner_id = the owner's profile id + a studio_role. Staff act on the
-- OWNER's data, so RLS allows any member of the studio.
-- ============================================================================
alter table public.profiles add column if not exists studio_owner_id uuid references public.profiles (id) on delete cascade;

alter table public.profiles add column if not exists studio_role text;

-- manager | staff | accountant
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

create index if not exists studio_services_owner_idx on public.studio_services (owner_id);

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

create index if not exists sites_subdomain_idx on public.sites (subdomain);

create index if not exists sites_custom_domain_idx on public.sites (custom_domain);

-- Custom domain (studio.com) — only used as the customer host once DNS is
-- verified & the domain is added to the hosting project.
alter table public.sites add column if not exists custom_domain_verified boolean not null default false;

create index if not exists site_blocks_site_idx on public.site_blocks (site_id, position);

create index if not exists album_designs_owner_idx on public.album_designs (owner_id, updated_at desc);

create index if not exists studio_quotes_owner_idx on public.studio_quotes (owner_id);

drop trigger if exists studio_quotes_set_updated_at on public.studio_quotes;

create trigger studio_quotes_set_updated_at
  before update on public.studio_quotes
  for each row execute function public.set_updated_at();

create index if not exists quote_items_quote_idx on public.quote_items (quote_id);

create index if not exists quote_adjustments_quote_idx on public.quote_adjustments (quote_id, created_at);

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

-- Track which affiliate code referred each user (set on first sign-up/visit).
alter table public.profiles add column if not exists referred_by text;

-- affiliate code

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

create index if not exists wedding_invitations_owner_idx on public.wedding_invitations (owner_id);

create index if not exists wedding_invitations_contract_idx on public.wedding_invitations (contract_id);

create index if not exists wedding_invitations_slug_idx on public.wedding_invitations (slug);

drop trigger if exists wedding_invitations_set_updated_at on public.wedding_invitations;

create trigger wedding_invitations_set_updated_at
  before update on public.wedding_invitations
  for each row execute function public.set_updated_at();

create index if not exists wedding_rsvps_invitation_idx on public.wedding_rsvps (invitation_id);

-- Chứa cả ảnh bìa/album LẪN nhạc nền (.mp3…). Trần 12MB, không giới hạn MIME
-- (allowed_mime_types = null) để không chặn nhầm audio. on conflict do update để
-- chạy lại migration sửa được bucket cũ nếu trước đây lỡ đặt chỉ cho ảnh.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wedding-photos', 'wedding-photos', true, 12582912, null)
on conflict (id) do update
  set public = true,
      file_size_limit = 12582912,
      allowed_mime_types = null;

-- STORAGE: logos bucket (studio brand logo + price-list poster logo).
-- Public read; only signed-in studio users upload their own logo.
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

create index if not exists story_pages_owner_idx on public.story_pages (owner_id);

create index if not exists story_pages_contract_idx on public.story_pages (contract_id);

create index if not exists story_pages_slug_idx on public.story_pages (slug);

drop trigger if exists story_pages_set_updated_at on public.story_pages;

create trigger story_pages_set_updated_at before update on public.story_pages
  for each row execute function public.set_updated_at();

create index if not exists story_wishes_story_idx on public.story_wishes (story_id);

-- Love Story: guest contributions written to the COUPLE's own Google Drive.
alter table public.story_pages add column if not exists drive_refresh_token text;

-- couple's Drive OAuth (drive.file)
alter table public.story_pages add column if not exists drive_upload_folder text;

create index if not exists story_uploads_story_idx on public.story_uploads (story_id, approved, created_at);

create index if not exists desktop_devices_owner_idx on public.desktop_devices (owner_id);

-- Kết nối Drive TOÀN QUYỀN (scope drive) cho công cụ Lọc ảnh: chép ảnh vào bất
-- kỳ link studio có quyền sửa, tự động không cần đăng nhập lại. Tách riêng khỏi
-- refresh_token (drive.file) của luồng đồng bộ hợp đồng.
alter table public.studio_drive add column if not exists filter_refresh_token text;

-- Mỗi hợp đồng: thư mục Drive đã tạo + sơ đồ cây (local ↔ Drive) + mốc đồng bộ.
-- drive_tree = [{ path, id, role: 'selection'|'delivery'|null, excluded }]
alter table public.studio_contracts add column if not exists drive_folder_id text;

alter table public.studio_contracts add column if not exists drive_tree      jsonb;

alter table public.studio_contracts add column if not exists drive_synced_at timestamptz;

-- Studio chọn khi TẠO hợp đồng: tạo thư mục ảnh / video (chọn riêng).
alter table public.studio_contracts add column if not exists drive_make_photo boolean not null default true;

alter table public.studio_contracts add column if not exists drive_make_video boolean not null default false;

insert into public.admin_drive (id) values (1) on conflict (id) do nothing;

create index if not exists zalo_messages_owner_idx on public.zalo_messages (owner_id, created_at desc);

create index if not exists zalo_messages_pending_idx on public.zalo_messages (status) where status = 'pending';

-- ─── Form điền thông tin trước buổi chụp (gửi kèm nhắc lịch Zalo) ───────────
-- Khách mở bằng link riêng không mật khẩu (intake_token). intake = jsonb dữ liệu
-- (PSC: 2 phần nhà gái/nhà trai + vị trí lat/lng + link Maps). Xem migration
-- supabase/migrations/contract_intake.sql.
alter table public.studio_contracts add column if not exists intake_token       text unique;

alter table public.studio_contracts add column if not exists intake              jsonb;

alter table public.studio_contracts add column if not exists intake_submitted_at timestamptz;


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ push_subscriptions.sql — Web Push (thông báo đẩy)
-- ══════════════════════════════════════════════════════════════════════════

create index if not exists push_subscriptions_owner_idx on push_subscriptions (owner_id);


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ wedding_invitations.sql — Thiệp cưới online
-- ══════════════════════════════════════════════════════════════════════════

create index if not exists wedding_invitations_owner_idx on public.wedding_invitations (owner_id);

create index if not exists wedding_invitations_contract_idx on public.wedding_invitations (contract_id);

create index if not exists wedding_invitations_slug_idx on public.wedding_invitations (slug);

drop trigger if exists wedding_invitations_set_updated_at on public.wedding_invitations;

create trigger wedding_invitations_set_updated_at
  before update on public.wedding_invitations
  for each row execute function public.set_updated_at();

create index if not exists wedding_rsvps_invitation_idx on public.wedding_rsvps (invitation_id);

-- ============================================================================
-- STORAGE: wedding-photos bucket (ảnh bìa + album thiệp). Public read; writes
-- go through the service-role API (token-gated), so no authenticated policy.
-- ============================================================================
-- Chứa cả ảnh bìa/album LẪN nhạc nền (.mp3…). Trần 12MB (nhạc tối đa 10MB) và
-- KHÔNG giới hạn MIME (allowed_mime_types = null) để không chặn nhầm audio.
-- on conflict do update: chạy lại migration sẽ SỬA bucket cũ nếu trước đây lỡ
-- bị đặt chỉ cho ảnh (nguyên nhân "tải mp3 không được").
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wedding-photos', 'wedding-photos', true, 12582912, null)
on conflict (id) do update
  set public = true,
      file_size_limit = 12582912,
      allowed_mime_types = null;


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ story_pages.sql — Trang Love Story
-- ══════════════════════════════════════════════════════════════════════════

create index if not exists story_pages_owner_idx on public.story_pages (owner_id);

create index if not exists story_pages_contract_idx on public.story_pages (contract_id);

create index if not exists story_pages_slug_idx on public.story_pages (slug);

drop trigger if exists story_pages_set_updated_at on public.story_pages;

create trigger story_pages_set_updated_at
  before update on public.story_pages
  for each row execute function public.set_updated_at();

create index if not exists story_wishes_story_idx on public.story_wishes (story_id);

-- ============================================================================
-- CÁCH 1: khách gửi ảnh/video → lưu vào Google Drive CỦA CHÍNH CẶP ĐÔI.
-- Cặp đôi nối Drive (OAuth drive.file) ngay trong trình sửa; file khách tải lên
-- được ghi vào một thư mục app tự tạo trên Drive của họ. Chạy phần dưới nếu bạn
-- đã có bảng story_pages từ trước.
-- ============================================================================
alter table public.story_pages add column if not exists drive_refresh_token text;

-- couple's Drive OAuth refresh token
alter table public.story_pages add column if not exists drive_upload_folder text;

create index if not exists story_uploads_story_idx on public.story_uploads (story_id, approved, created_at);


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/c1_profiles_column_grants.sql — Vá C1: chặn leo thang đặc quyền trên profiles
-- ══════════════════════════════════════════════════════════════════════════

-- ── Kiểm tra sau khi chạy: liệt kê các cột authenticated còn được UPDATE ──────
-- Kết quả PHẢI chỉ gồm các cột an toàn ở trên (KHÔNG có role, is_active, plan…).
--
-- select column_name
-- from information_schema.column_privileges
-- where table_schema = 'public'
--   and table_name = 'profiles'
--   and grantee = 'authenticated'
--   and privilege_type = 'UPDATE'
-- order by column_name;


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/admin_drive.sql — Vá bảo mật: tách refresh_token Drive của admin
-- ══════════════════════════════════════════════════════════════════════════

insert into public.admin_drive (id) values (1) on conflict (id) do nothing;

-- Copy giá trị cũ từ site_settings (nếu còn) rồi XÓA 2 cột bí mật khỏi bảng công khai.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'site_settings' and column_name = 'drive_refresh_token'
  ) then
    update public.admin_drive a
      set refresh_token = s.drive_refresh_token, folder_id = s.drive_folder_id, updated_at = now()
      from public.site_settings s
      where a.id = 1 and s.id = 1;
    alter table public.site_settings drop column if exists drive_refresh_token;
    alter table public.site_settings drop column if exists drive_folder_id;
  end if;
end $$;


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/atomic_redemptions.sql — Chống race condition khi dùng mã giảm giá / bản dùng thử
-- ══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────
-- Atomic redemption / trial claiming
--
-- Vá race condition trong các luồng đọc-rồi-ghi (read-modify-write) ở API:
--   • discount/redeem: "kiểm tra used_count < max_uses rồi +1" — hai request
--     đồng thời cùng đọc used_count cũ → vượt max_uses và mất lượt đếm.
--   • trial/start & redeem: "một lần dùng thử / tài khoản" chốt bằng
--     trial_used_at — hai request song song cùng thấy null → cấp 2 lần.
--   • affiliate/code: sinh mã ngẫu nhiên rồi select-kiểm-tra-trùng rồi insert —
--     không atomic; và lỗi insert bị nuốt → trả về mã chưa hề được lưu.
--
-- Cách vá: khoá hàng (SELECT … FOR UPDATE) để tuần tự hoá theo tài khoản/mã và
-- gộp toàn bộ kiểm tra + cập nhật vào MỘT transaction trong function. Các cột
-- gói (plan/limits) được truyền vào từ tầng ứng dụng để cấu hình gói vẫn nằm ở
-- JS (lib/plans.ts), function chỉ lo phần atomic.
-- ─────────────────────────────────────────────────────────────────────────

-- Đổi mã giảm giá dạng "dùng thử tức thì" (trial_days > 0). Trả về chuỗi trạng
-- thái: 'ok' | 'invalid' | 'expired' | 'used_up' | 'already_used'.
create or replace function public.redeem_discount_trial(
  p_code           text,
  p_user_id        uuid,
  p_expires        timestamptz,
  p_plan           text,
  p_album_limit    integer,
  p_can_zip        boolean,
  p_can_notes      boolean,
  p_can_galleries  boolean,
  p_watermark_pro  boolean
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.discount_codes;
begin
  -- Tuần tự hoá mọi lượt claim của CÙNG tài khoản (chốt "1 trial/account") và
  -- của CÙNG mã (chốt max_uses).
  perform 1 from public.profiles where id = p_user_id for update;
  select * into v_row from public.discount_codes where code = p_code for update;

  if not found or not v_row.active or coalesce(v_row.trial_days, 0) <= 0 then
    return 'invalid';
  end if;
  if v_row.expires_at is not null and v_row.expires_at < now() then
    return 'expired';
  end if;
  if v_row.max_uses is not null and coalesce(v_row.used_count, 0) >= v_row.max_uses then
    return 'used_up';
  end if;
  if exists (select 1 from public.profiles where id = p_user_id and trial_used_at is not null) then
    return 'already_used';
  end if;
  if exists (select 1 from public.discount_redemptions where code = p_code and user_id = p_user_id) then
    return 'already_used';
  end if;

  update public.profiles set
    plan               = p_plan,
    monthly_album_limit = p_album_limit,
    can_zip            = p_can_zip,
    can_notes          = p_can_notes,
    can_galleries      = p_can_galleries,
    can_watermark_pro  = p_watermark_pro,
    plan_cycle         = 'trial',
    plan_expires_at    = p_expires,
    trial_used_at      = now()
  where id = p_user_id;

  insert into public.discount_redemptions (code, user_id) values (p_code, p_user_id);
  update public.discount_codes set used_count = coalesce(used_count, 0) + 1 where code = p_code;
  return 'ok';
end;
$$;

-- Dùng thử miễn phí (không cần mã). Trả về 'ok' | 'already_used' | 'already_paid'.
create or replace function public.start_free_trial(
  p_user_id        uuid,
  p_expires        timestamptz,
  p_plan           text,
  p_album_limit    integer,
  p_can_zip        boolean,
  p_can_notes      boolean,
  p_can_galleries  boolean,
  p_watermark_pro  boolean
) returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  perform 1 from public.profiles where id = p_user_id for update;

  if exists (select 1 from public.profiles where id = p_user_id and trial_used_at is not null) then
    return 'already_used';
  end if;
  if exists (
    select 1 from public.profiles
    where id = p_user_id and plan <> 'free' and coalesce(plan_cycle, '') <> 'trial'
      and plan_expires_at is not null and plan_expires_at > now()
  ) then
    return 'already_paid';
  end if;

  update public.profiles set
    plan               = p_plan,
    monthly_album_limit = p_album_limit,
    can_zip            = p_can_zip,
    can_notes          = p_can_notes,
    can_galleries      = p_can_galleries,
    can_watermark_pro  = p_watermark_pro,
    plan_cycle         = 'trial',
    plan_expires_at    = p_expires,
    trial_used_at      = now()
  where id = p_user_id;

  insert into public.discount_redemptions (code, user_id)
  values ('TRIAL_' || upper(p_plan), p_user_id)
  on conflict (code, user_id) do nothing;
  return 'ok';
end;
$$;

-- Tăng used_count có điều kiện (dùng cho luồng nâng cấp trả phí có mã giảm giá).
-- Một câu UPDATE … WHERE … RETURNING là atomic: nếu vượt max_uses/ hết hạn/
-- tắt thì không có hàng nào được cập nhật → trả về false.
create or replace function public.consume_discount_code(p_code text)
returns boolean
language sql
security definer
set search_path = public
as $$
  with bumped as (
    update public.discount_codes
    set used_count = coalesce(used_count, 0) + 1
    where code = p_code
      and active
      and (max_uses is null or coalesce(used_count, 0) < max_uses)
      and (expires_at is null or expires_at > now())
    returning 1
  )
  select exists (select 1 from bumped);
$$;

-- Lấy hoặc tạo mã affiliate của một user, atomic. Trả về mã cuối cùng.
-- Chống cả hai race: hai request cùng user (unique khi tạo) và trùng mã ngẫu
-- nhiên giữa các user (retry khi vướng ràng buộc unique của code).
create or replace function public.get_or_create_affiliate_code(p_user_id uuid, p_prefix text)
returns table(code text, active boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code   text;
  v_active boolean;
  v_try    text;
  i        integer := 0;
begin
  -- Tuần tự hoá theo user để hai request đồng thời không tạo hai mã.
  perform 1 from public.profiles where id = p_user_id for update;

  select ac.code, ac.active into v_code, v_active
  from public.affiliate_codes ac where ac.user_id = p_user_id limit 1;
  if found then
    return query select v_code, v_active;
    return;
  end if;

  loop
    i := i + 1;
    -- Mã = tiền tố (tối đa 5 ký tự) + 4 ký tự ngẫu nhiên A-Z0-9.
    v_try := upper(left(regexp_replace(coalesce(p_prefix, 'USER'), '[^a-zA-Z0-9]', '', 'g'), 5))
             || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4));
    begin
      insert into public.affiliate_codes (user_id, code) values (p_user_id, v_try);
      return query select v_try, true;
      return;
    exception when unique_violation then
      -- Có thể là trùng mã (thử lại) hoặc user vừa được tạo bởi request song
      -- song khác — kiểm tra lại rồi trả về mã đã có.
      select ac.code, ac.active into v_code, v_active
      from public.affiliate_codes ac where ac.user_id = p_user_id limit 1;
      if found then
        return query select v_code, v_active;
        return;
      end if;
      if i >= 8 then
        raise exception 'could not allocate unique affiliate code';
      end if;
    end;
  end loop;
end;
$$;


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/album_designs.sql — Thiết kế Album
-- ══════════════════════════════════════════════════════════════════════════

create index if not exists album_designs_owner_idx on public.album_designs (owner_id, updated_at desc);


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/contract_intake.sql — Form điền thông tin trước buổi chụp
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- Form điền thông tin trước buổi chụp (gửi kèm nhắc lịch qua Zalo).
-- Khách mở bằng LINK RIÊNG không cần mật khẩu (intake_token — khó đoán).
-- Dữ liệu điền lưu vào jsonb `intake`; hợp đồng PSC gồm 2 phần (nhà gái/nhà trai)
-- với SĐT, các mốc giờ và VỊ TRÍ (lat/lng + link Google Maps do khách chọn).
-- Idempotent.
-- ============================================================================

alter table public.studio_contracts add column if not exists intake_token       text unique;

alter table public.studio_contracts add column if not exists intake              jsonb;

alter table public.studio_contracts add column if not exists intake_submitted_at timestamptz;


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/crew_schedule.sql — Lịch thợ (phải chạy TRƯỚC crew_profile_show)
-- ══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────
-- Lịch thợ (sổ thợ → lịch)
--
-- `crew_unavailable` vốn chỉ ghi "ngày này thợ bận" (một dòng / ngày). Lịch thợ
-- cần hơn thế: thợ đã nhận việc ngày 15/8 TỪ MẤY GIỜ ĐẾN MẤY GIỜ, và một ngày
-- có thể nhận nhiều việc. Nên mở rộng chính bảng này thay vì đẻ thêm bảng thứ
-- hai cùng ý nghĩa — dữ liệu cũ vẫn dùng được, chỉ là không có giờ (cả ngày).
--
-- Chạy trước khi deploy.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.crew_unavailable add column if not exists start_time time;

alter table public.crew_unavailable add column if not exists end_time   time;

-- Ca đêm vắt qua nửa đêm (20:00 → 08:00 hôm sau): giờ kết thúc NHỎ HƠN giờ bắt
-- đầu. Cờ này để đọc/hiển thị khỏi phải đoán.
alter table public.crew_unavailable add column if not exists overnight  boolean not null default false;

alter table public.crew_unavailable add column if not exists title      text;

-- null = thợ tự thêm; có giá trị = studio thêm hộ (studio nào thêm).
alter table public.crew_unavailable add column if not exists owner_id   uuid references public.profiles (id) on delete set null;

-- Một ngày có thể có nhiều mốc lịch → bỏ ràng buộc duy nhất theo (phone, date).
-- Chỉ số tra cứu ở dưới vẫn giữ nguyên nên truy vấn không chậm đi.
alter table public.crew_unavailable drop constraint if exists crew_unavailable_phone_date_key;


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/crew_profile_show.sql — Hồ sơ thợ & thông tin show
-- ══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────
-- Hồ sơ thợ · thông tin show · đăng ký theo studio · feed lịch
--
-- Chạy SAU crew_schedule.sql. Idempotent, chạy lại nhiều lần vô hại.
-- ─────────────────────────────────────────────────────────────────────────

-- 1) Hồ sơ thợ — studio nhập, hoặc thợ tự điền nếu studio để trống.
--    Gọn đúng những gì cần để xếp việc và trả lương; SĐT đã có sẵn trong bảng
--    và là danh tính của thợ nên không thêm gì cho nó.
alter table public.studio_crew add column if not exists email        text;

alter table public.studio_crew add column if not exists address      text;

alter table public.studio_crew add column if not exists bank_name    text;

-- tên ngân hàng của STK
alter table public.studio_crew add column if not exists bank_account text;

alter table public.studio_crew add column if not exists skills       text;

-- kỹ năng (chụp, quay, dựng…)
alter table public.studio_crew add column if not exists equipment    text;

-- thiết bị mang theo được
-- Thợ tự điền lúc nào (để studio biết dòng nào do thợ khai).
alter table public.studio_crew add column if not exists self_filled_at timestamptz;

-- 'active'  = studio đã nhận vào sổ
-- 'pending' = thợ tự đăng ký qua link của studio, chờ studio duyệt
alter table public.studio_crew add column if not exists status         text not null default 'active';

-- 2) Thông tin SHOW trên từng phân công — studio gán gì thì thợ thấy đúng thế.
--    task: chụp / quay / cả hai · side: nhà trai / nhà gái / sắp xếp sau
alter table public.contract_crew add column if not exists task       text;

alter table public.contract_crew add column if not exists side       text;

alter table public.contract_crew add column if not exists start_time time;

alter table public.contract_crew add column if not exists end_time   time;

-- 3) Nối mốc lịch với phân công: gỡ thợ khỏi hợp đồng thì mốc lịch tự biến mất
--    (on delete cascade), khỏi để lại lịch ma.
alter table public.crew_unavailable
  add column if not exists contract_crew_id uuid references public.contract_crew (id) on delete cascade;

create index if not exists crew_unavailable_assign_idx on public.crew_unavailable (contract_crew_id);

-- 4) Link đăng ký riêng của mỗi studio: /crew/<crew_token>.
--    Tách khỏi booking_token (dành cho KHÁCH đặt lịch) để hai đối tượng không
--    dùng chung một bí mật — đổi cái này không làm hỏng cái kia.
alter table public.profiles add column if not exists crew_token text unique;

-- ─────────────────────────────────────────────────────────────────────────
-- 6) Cách ly HOÀN TOÀN lịch bận theo studio.
--
-- crew_unavailable khoá theo SĐT nên một mốc vốn hiện với MỌI studio mà thợ đó
-- thuộc về. Nay mỗi mốc phải thuộc đúng một studio (owner_id), kể cả mốc thợ tự
-- báo — thợ chạy cho ba nơi thì báo bận riêng cho từng nơi.
--
-- owner_id đã có sẵn nhưng trước đây mang nghĩa "studio xếp hộ" (null = thợ tự
-- thêm), nên cần cột riêng để biết AI viết ra mốc đó — dùng cho quyền xoá: thợ
-- chỉ gỡ được mốc mình tự thêm, studio chỉ gỡ được mốc mình xếp.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'crew_unavailable' and column_name = 'created_by'
  ) then
    alter table public.crew_unavailable add column created_by text not null default 'crew';
    -- Dữ liệu cũ: có owner_id nghĩa là studio đã xếp hộ.
    update public.crew_unavailable set created_by = 'studio' where owner_id is not null;
  end if;
end $$;

create index if not exists crew_unavailable_owner_idx on public.crew_unavailable (owner_id, date);


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/photographer_plus_pricing.sql — Cột giá còn thiếu của gói Photographer Plus
-- ══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────
-- Photographer Plus: cột giá/hoa hồng còn thiếu
--
-- Gói photographer_plus đã tồn tại trong hệ thống nhưng thiếu 2 cột cấu hình
-- (kiểu cũ, áp cho cả tháng/năm) khiến trang chủ & affiliate không đọc được:
--   • photographer_plus_discount_percent — % giảm giá chung (trang chủ dùng).
--   • affiliate_commission_photographer_plus — % hoa hồng affiliate.
-- Chạy migration này trước khi deploy để trang chủ hiển thị giá đúng và hoa
-- hồng cho gói Photographer Plus được ghi nhận.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.site_settings add column if not exists photographer_plus_discount_percent integer not null default 0;

alter table public.site_settings add column if not exists affiliate_commission_photographer_plus int not null default 10;


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/rental.sql — Phòng váy: kho trang phục & đơn thuê
-- ══════════════════════════════════════════════════════════════════════════

create index if not exists rental_items_owner_idx on public.rental_items (owner_id, category);

create index if not exists rental_orders_owner_idx on public.rental_orders (owner_id, status);

create index if not exists rental_orders_contract_idx on public.rental_orders (contract_id);

drop trigger if exists rental_orders_set_updated_at on public.rental_orders;

create trigger rental_orders_set_updated_at
  before update on public.rental_orders
  for each row execute function public.set_updated_at();

create index if not exists rental_order_items_order_idx on public.rental_order_items (order_id);

create index if not exists rental_order_items_item_idx on public.rental_order_items (item_id);


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/site_views.sql — Đếm lượt xem website studio
-- ══════════════════════════════════════════════════════════════════════════

create index if not exists site_views_site_day_idx on public.site_views (site_id, day desc);

-- Không có policy insert/update cho người dùng: chỉ service-role ghi được, qua
-- hàm bump_site_view() bên dưới.

-- Tăng bộ đếm của ngày hôm nay. Dùng upsert nguyên tử nên nhiều lượt truy cập
-- cùng lúc không ghi đè nhau.
create or replace function public.bump_site_view(p_site uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.site_views (site_id, day, views)
  values (p_site, current_date, 1)
  on conflict (site_id, day) do update set views = public.site_views.views + 1;
$$;


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/studio_drive_sync.sql — Đồng bộ Google Drive cho hợp đồng
-- ══════════════════════════════════════════════════════════════════════════

alter table public.studio_drive add column if not exists root_folder_name text;

-- Mỗi hợp đồng: thư mục Drive đã tạo + sơ đồ cây (local ↔ Drive) + mốc đồng bộ.
-- drive_tree = [{ "path": "Photo/JPG Goc", "id": "<driveFolderId>",
--                 "role": "selection"|"delivery"|null, "excluded": bool }]
alter table public.studio_contracts add column if not exists drive_folder_id text;

alter table public.studio_contracts add column if not exists drive_tree      jsonb;

alter table public.studio_contracts add column if not exists drive_synced_at timestamptz;

-- Studio chọn ngay khi TẠO hợp đồng có tạo thư mục nào không (video chọn riêng).
alter table public.studio_contracts add column if not exists drive_make_photo boolean not null default true;

alter table public.studio_contracts add column if not exists drive_make_video boolean not null default false;


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/studio_zalo.sql — Tự động nhắn Zalo theo từng studio
-- ══════════════════════════════════════════════════════════════════════════

create index if not exists zalo_messages_owner_idx on public.zalo_messages (owner_id, created_at desc);

create index if not exists zalo_messages_pending_idx on public.zalo_messages (status) where status = 'pending';


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/website_leads.sql — Lead & hội thoại từ chatbox
-- ══════════════════════════════════════════════════════════════════════════

create index if not exists website_leads_owner_idx
  on public.website_leads (owner_id, created_at desc);


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/album_dislikes.sql — Ảnh khách 'không thích' trong album chọn ảnh
-- ══════════════════════════════════════════════════════════════════════════

create index if not exists dislikes_album_idx on public.dislikes (album_id);

create index if not exists dislikes_session_idx on public.dislikes (album_id, session_id);

-- Realtime cho dashboard studio (giống selections) — chỉ thêm nếu chưa publish.
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


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/lifecycle_followup.sql — Theo đuổi khách chưa chọn ảnh · hạn lưu trữ ảnh gốc · hạn hiệu lực báo giá
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- THEO ĐUỔI & VÒNG ĐỜI — ba chỗ dữ liệu bị bỏ trống khiến việc rơi vào im lặng:
--
--   1) Khách nhận link chọn ảnh rồi quên → không có mốc nào để biết đã im bao
--      lâu, nên không nhắc lại được.
--   2) Ảnh gốc trên Drive không có hạn lưu trữ → Drive đầy dần, không ai biết
--      album nào giữ được nữa.
--   3) Báo giá gửi đi không có hạn hiệu lực thực thi → khách quay lại đòi giá cũ.
--      (Cột studio_quotes.expires_at ĐÃ có sẵn trong schema nhưng chưa từng được
--      ghi hay đọc ở đâu — migration này chỉ thêm chính sách mặc định.)
--
-- Chạy 1 lần trong Supabase SQL Editor.
-- ============================================================================

-- ── 1) Vòng đời lưu trữ ảnh gốc ────────────────────────────────────────────
-- delivered_at: lần ĐẦU album chuyển sang giai đoạn giao khách. Mốc đếm hạn lưu
-- trữ tính từ đây chứ không phải created_at — album chọn ảnh có thể mở hàng
-- tháng trước khi giao.
alter table public.albums add column if not exists delivered_at timestamptz;

-- storage_until: ngày studio dự định dọn ảnh gốc khỏi Drive. null = giữ vô hạn
-- (studio đặt chính sách 0 tháng). Studio gia hạn được bất cứ lúc nào.
alter table public.albums add column if not exists storage_until date;

-- storage_notice_at: lần cuối đã nhắc studio về album này. Chống nhắc lặp mỗi
-- ngày trong suốt cửa sổ cảnh báo.
alter table public.albums add column if not exists storage_notice_at timestamptz;

-- Cron quét album sắp hết hạn: lọc theo hạn, nên đánh index theo hạn.
create index if not exists albums_storage_until_idx
  on public.albums (storage_until)
  where storage_until is not null;

-- ── 2) Chính sách của studio ───────────────────────────────────────────────
-- Giữ ảnh gốc bao nhiêu tháng sau khi giao khách. 0 = không đặt hạn (giữ mãi).
-- Mặc định 6 tháng: đủ dài cho khách in lại, đủ ngắn để Drive không phình vô hạn.
alter table public.profiles
  add column if not exists storage_months integer not null default 6;

-- Hạn hiệu lực mặc định của báo giá, tính bằng ngày kể từ lúc gửi khách.
-- 0 = không đặt hạn. Mặc định 15 ngày — đủ để khách suy nghĩ, đủ ngắn để bảng
-- giá mùa sau không bị ràng buộc bởi báo giá mùa trước.
alter table public.profiles
  add column if not exists quote_valid_days integer not null default 15;

-- ── 3) Theo đuổi khách chưa chọn ảnh ───────────────────────────────────────
-- Cột select_invited_at trên hợp đồng: lần đầu mời khách chọn ảnh. Cron dựa vào
-- đây để biết đã im lặng bao nhiêu ngày.
--
-- Vì sao không đọc thẳng zalo_messages: studio CHƯA kết nối Zalo vẫn cần thấy
-- hợp đồng đang tắc trên Tổng quan, mà lúc đó bảng zalo_messages rỗng.
alter table public.studio_contracts
  add column if not exists select_invited_at timestamptz;

-- Số lần đã nhắc lại (0–3). Tách khỏi zalo_messages vì lời nhắc có thể đi qua
-- kênh khác (thông báo trong app) chứ không riêng Zalo.
alter table public.studio_contracts
  add column if not exists select_nudges integer not null default 0;

alter table public.studio_contracts
  add column if not exists select_nudged_at timestamptz;

-- ── 4) Mốc "khách đã xem" cho báo giá đã có sẵn (viewed_at) ────────────────
-- Chỉ thêm index phục vụ cron tự đóng báo giá quá hạn.
create index if not exists studio_quotes_expiry_idx
  on public.studio_quotes (expires_at)
  where expires_at is not null;


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/referral_deposit.sql — Khách giới thiệu khách · đặt cọc giữ ngày (chạy sau lifecycle_followup)
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- KHÁCH GIỚI THIỆU KHÁCH + ĐẶT CỌC GIỮ NGÀY
--
-- 1) Giới thiệu: đã có affiliate cho studio giới thiệu STUDIO, nhưng không có gì
--    cho KHÁCH giới thiệu KHÁCH — kênh mạnh nhất của studio ảnh cưới ở VN.
--    Nhận diện người giới thiệu bằng SĐT chứ không bằng mã sinh sẵn: khách cũ
--    nào cũng dùng được ngay, không phải phát mã cho từng người.
--
-- 2) Đặt cọc giữ ngày: khách đặt lịch xong studio mới liên hệ, mà mùa cưới khách
--    hỏi 3–4 studio cùng lúc. Cho chuyển cọc ngay lúc đặt thì ngày mới thật sự
--    được giữ.
--
-- Chạy 1 lần trong Supabase SQL Editor. Chạy SAU lifecycle_followup.sql.
-- ============================================================================

-- ── 1) Chính sách của studio ───────────────────────────────────────────────
-- Thưởng cho NGƯỜI GIỚI THIỆU khi khách mới chốt hợp đồng (VND). 0 = tắt.
alter table public.profiles
  add column if not exists referral_reward integer not null default 0;

-- Ưu đãi cho KHÁCH MỚI được giới thiệu (VND) — hiện ngay trên form đặt lịch để
-- khách có lý do nhập SĐT người giới thiệu. 0 = không có ưu đãi.
alter table public.profiles
  add column if not exists referral_discount integer not null default 0;

-- Cọc giữ ngày (VND). 0 = tắt, form đặt lịch không hiện bước chuyển cọc.
alter table public.profiles
  add column if not exists booking_deposit integer not null default 0;

-- ── 2) Cọc giữ ngày trên yêu cầu đặt lịch ──────────────────────────────────
-- Số tiền cọc CHỐT LẠI lúc khách đặt. Lưu riêng chứ không đọc lại
-- profiles.booking_deposit khi hiển thị: studio đổi chính sách sau đó không
-- được phép làm đổi số tiền của một yêu cầu đã gửi đi.
alter table public.studio_bookings add column if not exists deposit_amount integer;

-- none     — studio tắt cọc, hoặc khách chọn không cọc
-- awaiting — đã hiện QR, đang chờ khách chuyển
-- paid     — khách báo đã chuyển (kèm ảnh), CHỜ studio xác nhận
-- confirmed— studio đã đối chiếu và xác nhận nhận được tiền
alter table public.studio_bookings add column if not exists deposit_status text not null default 'none'
  check (deposit_status in ('none', 'awaiting', 'paid', 'confirmed'));

alter table public.studio_bookings add column if not exists deposit_proof_url text;

alter table public.studio_bookings add column if not exists deposit_paid_at timestamptz;

-- Mã nội dung chuyển khoản (vd "COC-7F3A"). Ngắn, không dấu, dễ đọc trên sao kê
-- ngân hàng — đây là thứ studio dùng để đối chiếu.
alter table public.studio_bookings add column if not exists deposit_code text;

-- Token riêng để khách quay lại trang cọc mà không phải đặt lịch lại. KHÔNG
-- dùng id: id lộ ra là đoán được các bản ghi khác.
alter table public.studio_bookings add column if not exists deposit_token text unique;

create index if not exists studio_bookings_deposit_token_idx
  on public.studio_bookings (deposit_token) where deposit_token is not null;

-- SĐT người giới thiệu, lưu ngay trên yêu cầu đặt lịch để studio thấy nguồn
-- khách kể cả khi chưa tạo bản ghi giới thiệu.
alter table public.studio_bookings add column if not exists referrer_phone text;

create index if not exists studio_referrals_owner_idx
  on public.studio_referrals (owner_id, status, created_at desc);

-- Một yêu cầu đặt lịch chỉ sinh ĐÚNG MỘT bản ghi giới thiệu, kể cả khi API bị
-- gọi lặp (khách bấm gửi hai lần, mạng lỗi rồi thử lại).
create unique index if not exists studio_referrals_booking_uniq
  on public.studio_referrals (booking_id) where booking_id is not null;


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/activity_tracking.sql — Bộ đếm hoạt động tài khoản (lần cuối mở app, số ngày dùng)
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- BỘ ĐẾM HOẠT ĐỘNG TÀI KHOẢN
--
-- Vì sao cần: admin mstudo không có cách nào biết một studio còn dùng phần mềm
-- hay đã bỏ. Cột created_at chỉ nói lúc họ đăng ký, còn plan_expires_at chỉ nói
-- họ trả tiền tới bao giờ — cả hai đều không nói họ CÓ MỞ APP hay không. Kết quả
-- là không phân biệt được tài khoản đang dùng thật với tài khoản đăng ký rồi bỏ.
--
-- Đo bằng SỐ NGÀY có hoạt động, không phải số lượt mở. Một người mở 50 lần trong
-- một ngày không "dùng nhiều" hơn người mở đúng một lần mỗi ngày suốt 50 ngày —
-- đếm lượt sẽ thưởng nhầm cho hành vi bồn chồn thay vì thói quen dùng đều.
--
-- Chạy 1 lần trong Supabase SQL Editor.
-- ============================================================================

-- Lần cuối tài khoản mở khu quản lý. null = chưa mở lần nào kể từ khi có bộ đếm.
alter table public.profiles add column if not exists last_active_at timestamptz;

-- Ngày (giờ VN) của lần hoạt động gần nhất. Lưu riêng dạng date để biết "đã sang
-- ngày mới chưa" bằng một phép so, không phải tính lại múi giờ mỗi lần ghi.
alter table public.profiles add column if not exists last_active_day date;

-- Tổng số NGÀY KHÁC NHAU có hoạt động. Đây là con số dùng để đánh giá độ gắn bó.
alter table public.profiles add column if not exists active_days integer not null default 0;

-- Tổng số phiên (mỗi lần mở app sau ít nhất 15 phút im lặng tính là một phiên).
-- Giữ để so với active_days: nhiều phiên trên ít ngày = dùng dồn dập rồi bỏ.
alter table public.profiles add column if not exists visit_count integer not null default 0;

-- Admin lọc "ai đã im lặng lâu nhất" → sắp theo cột này, nên đánh index.
-- nulls first để tài khoản CHƯA BAO GIỜ mở app nổi lên đầu — đó chính là nhóm
-- cần gọi điện trước.
create index if not exists profiles_last_active_idx
  on public.profiles (last_active_at desc nulls first);

-- ── KHÔNG cấp quyền UPDATE các cột này cho `authenticated` ──────────────────
-- Cố ý: migrations/c1_profiles_column_grants.sql đã thu hồi UPDATE toàn bảng và
-- chỉ cấp lại theo cột. Bộ đếm hoạt động CHỈ được ghi từ máy chủ qua service-role
-- (src/app/api/activity/ping). Cấp cho client thì người dùng tự bơm số của mình,
-- và số liệu để ra quyết định kinh doanh mà bịa được thì vô dụng.


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/studio_appointments.sql — Lịch studio: lịch trang điểm / thử đồ / tư vấn, phòng & nguồn lực
-- ══════════════════════════════════════════════════════════════════════════

-- Tra cứu chính: lịch tuần của một studio (owner + khoảng ngày).
create index if not exists studio_appointments_owner_idx
  on public.studio_appointments (owner_id, appt_date);

-- Lịch trình của một hợp đồng (cổng khách + màn chi tiết hợp đồng).
create index if not exists studio_appointments_contract_idx
  on public.studio_appointments (contract_id, appt_date);

-- "Việc hôm nay của tôi" ở cổng nhân viên.
create index if not exists studio_appointments_staff_idx
  on public.studio_appointments (staff_id, appt_date);

create index if not exists studio_appointments_crew_idx
  on public.studio_appointments (crew_id, appt_date);

create index if not exists studio_rooms_owner_idx on public.studio_rooms (owner_id, position);

-- ============================================================================
-- Thông báo: ba loại mới của cổng nhân viên (nhắc lịch, hợp đồng đổi, phân công).
-- `studio_notifications.kind` là text KHÔNG có check constraint nên không phải
-- sửa gì ở DB — ghi lại đây để người đọc migration biết ba khoá này tồn tại:
--   schedule_reminder | contract_changed | assigned
-- (nhãn & icon: NOTIFICATION_KIND_META trong src/lib/types.ts)
-- ============================================================================


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/studio_branches.sql — Chi nhánh studio: nhiều cơ sở trong một tài khoản (chạy SAU studio_appointments)
-- ══════════════════════════════════════════════════════════════════════════

create index if not exists studio_branches_owner_idx on public.studio_branches (owner_id, position);

-- ============================================================================
-- Cột branch_id trên những bảng THẬT SỰ thuộc về một cơ sở.
--
-- `on delete set null` ở mọi nơi: xoá một chi nhánh KHÔNG được xoá theo hợp
-- đồng, lịch hay khoản thu chi của nó — dữ liệu chỉ quay về trạng thái "chưa
-- gán". Đây là ràng buộc quan trọng nhất của cả migration này.
--
-- Cố ý KHÔNG thêm branch_id vào: albums/photos (thư viện dùng chung),
-- studio_pricelist / studio_packages / studio_services (bảng giá và điều khoản
-- chung toàn studio), contract_* (đã thuộc hợp đồng, hợp đồng đã có chi nhánh),
-- studio_notifications (thông báo của chủ tài khoản).
-- ============================================================================

alter table public.studio_contracts    add column if not exists branch_id uuid references public.studio_branches (id) on delete set null;

alter table public.studio_bookings     add column if not exists branch_id uuid references public.studio_branches (id) on delete set null;

alter table public.studio_expenses     add column if not exists branch_id uuid references public.studio_branches (id) on delete set null;

alter table public.studio_equipment    add column if not exists branch_id uuid references public.studio_branches (id) on delete set null;

alter table public.studio_crew         add column if not exists branch_id uuid references public.studio_branches (id) on delete set null;

-- Báo giá: cần chi nhánh vì vai trò "Toàn quyền chi nhánh" bị ghim phạm vi, mà
-- báo giá là thông tin thương mại — để chung thì người phụ trách cơ sở A đọc
-- được giá chào của cơ sở B. `quote-convert` chuyển giá trị này sang hợp đồng.
alter table public.studio_quotes       add column if not exists branch_id uuid references public.studio_branches (id) on delete set null;

-- Hai bảng dưới đến từ migration studio_appointments.sql — bọc trong khối điều
-- kiện để chạy được cả khi migration đó CHƯA chạy (thứ tự hai file không quan
-- trọng, và studio nào chưa dùng Lịch studio vẫn cài được chi nhánh).
do $$
begin
  if to_regclass('public.studio_appointments') is not null then
    alter table public.studio_appointments add column if not exists branch_id uuid references public.studio_branches (id) on delete set null;
    create index if not exists studio_appointments_branch_idx on public.studio_appointments (branch_id, appt_date);
  end if;
  if to_regclass('public.studio_rooms') is not null then
    alter table public.studio_rooms add column if not exists branch_id uuid references public.studio_branches (id) on delete set null;
    create index if not exists studio_rooms_branch_idx on public.studio_rooms (branch_id, position);
  end if;
  if to_regclass('public.rental_items') is not null then
    alter table public.rental_items add column if not exists branch_id uuid references public.studio_branches (id) on delete set null;
    create index if not exists rental_items_branch_idx on public.rental_items (branch_id, category);
  end if;
end $$;

-- Chỉ số theo (chi nhánh, ngày): mọi màn lọc theo chi nhánh đều kèm khoảng ngày.
create index if not exists studio_contracts_branch_idx on public.studio_contracts (branch_id, event_date);

create index if not exists studio_bookings_branch_idx  on public.studio_bookings (branch_id, created_at);

create index if not exists studio_expenses_branch_idx  on public.studio_expenses (branch_id, spent_at);

create index if not exists studio_quotes_branch_idx    on public.studio_quotes (branch_id, created_at);

-- ============================================================================
-- Nhân viên thuộc chi nhánh nào.
--
-- Đặt trên `profiles` chứ không phải bảng nối riêng: một nhân viên làm ở MỘT cơ
-- sở (đó là ý nghĩa của "chi nhánh"); ai chạy nhiều nơi thì để trống và họ thấy
-- toàn studio.
--
-- CHÚ Ý BẢO MẬT: vá C1 (c1_profiles_column_grants.sql) đã thu hồi quyền UPDATE
-- toàn bảng profiles của `authenticated` và chỉ cấp lại một danh sách cột an
-- toàn. Cột này CỐ Ý không nằm trong danh sách đó — nếu cấp, một nhân viên có
-- thể tự đổi chi nhánh của mình. Việc gán chi nhánh đi qua service-role ở
-- /api/studio/staff, giống như gán vai trò.
-- ============================================================================
alter table public.profiles add column if not exists studio_branch_id uuid references public.studio_branches (id) on delete set null;

create index if not exists profiles_studio_branch_idx on public.profiles (studio_branch_id);

-- ── Kiểm tra sau khi chạy ────────────────────────────────────────────────────
-- select table_name from information_schema.columns
-- where table_schema='public' and column_name in ('branch_id','studio_branch_id')
-- order by table_name;


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/upgrade_payment.sql — Thanh toán gói dịch vụ: QR chuyển khoản, studio báo đã chuyển, admin xác nhận
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- Thanh toán gói dịch vụ MStudo bằng chuyển khoản (VietQR)
--
-- Luồng: studio chọn gói → trang thanh toán hiện mã QR đúng số tiền + nội dung
-- riêng của yêu cầu đó → studio chuyển rồi bấm "Tôi đã chuyển khoản" → admin
-- nhận thông báo đẩy → admin đối chiếu sao kê rồi bấm "Đã nhận tiền" (tự nâng
-- cấp gói) hoặc "Chưa nhận được" (giao dịch thất bại).
--
-- KHÔNG có cổng thanh toán tự động, và đó là cố ý — giống hệt cọc giữ ngày của
-- studio: "studio BÁO đã chuyển" tách hẳn khỏi "MStudo ĐÃ NHẬN". Tiền chỉ được
-- coi là nhận khi người thật nhìn thấy nó trong sao kê.
-- ============================================================================

alter table public.upgrade_requests
  add column if not exists payment_status text not null default 'none';

-- Ràng buộc rời để chạy lại được trên DB đã có cột.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'upgrade_requests_payment_status_check'
  ) then
    alter table public.upgrade_requests
      add constraint upgrade_requests_payment_status_check
      check (payment_status in ('none', 'awaiting_confirm', 'paid', 'failed'));
  end if;
end $$;

-- Nội dung chuyển khoản của yêu cầu này ("MS-4K7Q") — admin dò sao kê bằng nó.
alter table public.upgrade_requests add column if not exists payment_code text;

-- Số tiền CHỐT phía máy chủ lúc tạo yêu cầu (đã trừ giảm giá). Cột `amount` cũ
-- nhận từ trình duyệt nên không tin được để thu tiền.
alter table public.upgrade_requests add column if not exists payment_amount integer;

alter table public.upgrade_requests add column if not exists declared_at timestamptz;

alter table public.upgrade_requests add column if not exists reviewed_at timestamptz;

alter table public.upgrade_requests add column if not exists reviewed_by uuid references auth.users (id) on delete set null;

alter table public.upgrade_requests add column if not exists review_note text;

create unique index if not exists upgrade_requests_payment_code_key
  on public.upgrade_requests (payment_code) where payment_code is not null;

create index if not exists upgrade_requests_payment_status_idx
  on public.upgrade_requests (payment_status, created_at desc);

-- ============================================================================
-- Tài khoản NHẬN tiền của MStudo — nguồn của mã QR trên trang thanh toán.
-- site_settings đọc công khai được, nhưng số tài khoản nhận tiền vốn đã in trên
-- mọi mã QR gửi cho studio nên không phải bí mật.
-- ============================================================================
alter table public.site_settings add column if not exists pay_bank_bin     text;

alter table public.site_settings add column if not exists pay_bank_account text;

alter table public.site_settings add column if not exists pay_bank_holder  text;

alter table public.site_settings add column if not exists pay_bank_name    text;


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/crew_phone_digits.sql — Tra thợ theo SĐT bằng chỉ mục (bỏ quét toàn bảng ở cổng /crew)
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- Tra thợ theo SĐT bằng CHỈ MỤC thay vì quét cả bảng
--
-- Vấn đề: SĐT trong sổ thợ lưu đúng như người ta gõ ("0912 345 678", "+84912…"),
-- nên cổng /crew không .eq() được, đành TẢI TOÀN BỘ contract_crew của MỌI studio
-- rồi lọc bằng JavaScript. Mỗi lần một thợ mở cổng là một lần đọc cả bảng — chi
-- phí tăng theo số studio trên nền tảng chứ không theo số việc của thợ đó, và
-- dữ liệu studio khác (tên khách, địa điểm) bị kéo vào bộ nhớ tiến trình dù
-- không bao giờ được trả ra.
--
-- Cách sửa: thêm cột SINH TỰ ĐỘNG chứa SĐT chỉ-số + chỉ mục trên nó. Postgres
-- tự cập nhật mỗi khi phone đổi, app chỉ việc .eq("phone_digits", …).
-- ============================================================================

alter table public.contract_crew
  add column if not exists phone_digits text
  generated always as (regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g')) stored;

create index if not exists contract_crew_phone_digits_idx
  on public.contract_crew (phone_digits);

alter table public.studio_crew
  add column if not exists phone_digits text
  generated always as (regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g')) stored;

create index if not exists studio_crew_phone_digits_idx
  on public.studio_crew (phone_digits);


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/contract_deposit_percent.sql — % cọc hợp đồng do studio tự đặt
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- % cọc hợp đồng do studio tự đặt
--
-- Trước đây mức cọc mặc định của một hợp đồng viết cứng 25% trong mã nguồn
-- (làm tròn lên bội của 500k, tối thiểu 500k). Mỗi studio một chính sách —
-- người lấy 30%, người lấy 50% với hợp đồng cưới — nên con số này phải nằm ở
-- chỗ studio sửa được, cạnh cọc giữ ngày và hạn giữ ảnh trong "Chính sách
-- studio".
--
-- 0 = TẮT gợi ý cọc (studio tự nhập số tiền từng đợt).
-- ============================================================================

alter table public.profiles
  add column if not exists contract_deposit_percent smallint not null default 25;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_contract_deposit_percent_check') then
    alter table public.profiles
      add constraint profiles_contract_deposit_percent_check
      check (contract_deposit_percent >= 0 and contract_deposit_percent <= 100);
  end if;
end $$;


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/inbox_unified.sql — Hộp thư hợp nhất: gom tin Zalo/Facebook/Instagram/website về một chỗ
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- MStudo — HỘP THƯ HỢP NHẤT (một chỗ trả lời khách từ mọi mạng xã hội).
--
-- Khách nhắn từ Zalo OA, Zalo cá nhân, Facebook Messenger, Instagram DM hay
-- chatbox website đều đổ về cùng một hộp thư. AI trả lời trước; nhân viên bấm
-- "Tôi tiếp quản" thì AI im, người trả lời tiếp trong cùng khung chat đó.
--
-- BỐN BẢNG, đọc theo thứ tự phễu:
--   inbox_channels      — studio đã nối những kênh nào (1 dòng = 1 trang/OA/tài khoản)
--   inbox_contacts      — người nhắn, định danh theo (kênh, id trên nền tảng đó)
--   inbox_conversations — một cuộc trò chuyện với một người trên một kênh
--   inbox_messages      — từng tin, cả tin vào lẫn tin ra
--
-- PHÂN QUYỀN
--   Ba bảng sau: RLS `is_studio_member(owner_id)` — cả studio đọc/ghi được, vì
--   trực điện thoại là việc tập thể (khác `studio_zalo` chỉ chủ studio).
--   `inbox_channels` thì KHOÁ hẳn anon/authenticated: mỗi dòng chứa page access
--   token của Facebook/Instagram → chỉ service-role đọc. Dashboard xem trạng
--   thái kênh qua API (đã lọc bí mật), không đọc thẳng bảng.
--
-- Chạy được nhiều lần (idempotent).
-- ============================================================================

-- Hàm kiểm tra thành viên studio (khai lại cho chắc — DB cũ có thể chưa có).
create or replace function public.is_studio_member(target uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select
    target = auth.uid()
    or exists (select 1 from public.profiles where id = auth.uid() and studio_owner_id = target)
    or public.is_admin();
$$;

create index if not exists inbox_channels_owner_idx on public.inbox_channels (owner_id);

create index if not exists inbox_contacts_owner_idx on public.inbox_contacts (owner_id);

create index if not exists inbox_conversations_owner_idx
  on public.inbox_conversations (owner_id, last_message_at desc);

create index if not exists inbox_conversations_unread_idx
  on public.inbox_conversations (owner_id) where unread > 0;

create index if not exists inbox_messages_conv_idx
  on public.inbox_messages (conversation_id, created_at);

-- Webhook của Facebook/Zalo bắn lại tin cũ khi ta trả lời chậm → khoá theo id gốc.
create unique index if not exists inbox_messages_external_uidx
  on public.inbox_messages (conversation_id, external_id) where external_id is not null;

-- ── Realtime: khung chat tự chạy khi có tin mới ─────────────────────────────
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'inbox_messages'
    ) then
      alter publication supabase_realtime add table public.inbox_messages;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'inbox_conversations'
    ) then
      alter publication supabase_realtime add table public.inbox_conversations;
    end if;
  end if;
end $$;


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/inbox_tiktok.sql — Hộp thư: thêm kênh TikTok (chạy SAU inbox_unified)
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- MStudo — Thêm kênh TIKTOK vào hộp thư hợp nhất.
--
-- TikTok nối qua CẦU NỐI chứ không phải webhook thẳng: TikTok Business
-- Messaging API còn ở giai đoạn beta và trên thực tế đi qua các đối tác nhắn
-- tin được TikTok công nhận. Cầu nối đẩy tin vào /api/inbox/ingest; MStudo gửi
-- ra bằng cách POST tới URL cầu nối (lưu mã hoá trong inbox_channels.secret,
-- không cần cột mới).
--
-- Vì vậy migration này chỉ phải nới ĐÚNG MỘT ràng buộc: danh sách nền tảng hợp
-- lệ. Toàn bộ bảng, RLS và chỉ mục của hộp thư giữ nguyên.
--
-- Chạy SAU inbox_unified.sql. Chạy được nhiều lần (idempotent) — và nếu bạn cài
-- mới hoàn toàn thì inbox_unified.sql đã có sẵn 'tiktok', migration này chỉ dựng
-- lại đúng ràng buộc đó, không đổi gì.
-- ============================================================================

do $$
begin
  if to_regclass('public.inbox_channels') is null then
    raise notice 'bỏ qua: chưa có bảng inbox_channels — chạy inbox_unified.sql trước';
    return;
  end if;

  -- Ràng buộc inline trong `create table` được Postgres tự đặt tên
  -- <bảng>_<cột>_check. Bỏ rồi tạo lại với danh sách đã có 'tiktok'.
  alter table public.inbox_channels drop constraint if exists inbox_channels_platform_check;
  alter table public.inbox_channels add constraint inbox_channels_platform_check
    check (platform in ('website', 'zalo_oa', 'zalo_personal', 'facebook', 'instagram', 'tiktok'));

  raise notice 'inbox_channels: đã cho phép platform = tiktok';
end $$;


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/danh_gia_khach.sql — Đánh giá khách: studio duyệt & trả lời (chạy SAU schema.sql)
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- ĐÁNH GIÁ KHÁCH — studio xem, duyệt và TRẢ LỜI được
--
-- Bảng `feedback` đã có sẵn từ schema.sql: khách gửi cảm nhận ở cuối trang album
-- giao khách, website studio đọc ra để khoe. Thiếu ba thứ khiến nó gần như vô
-- dụng với chủ studio:
--
--   1. Không có chỗ nào trong khu quản lý để XEM — dữ liệu nằm im trong bảng.
--   2. `approved` mặc định `true`, nên một đánh giá 1 sao lên thẳng trang chủ
--      trước khi studio kịp biết. Đổi mặc định thành `false`: từ nay đánh giá
--      phải được duyệt mới hiện. Hàng CŨ giữ nguyên trạng thái đang có —
--      `alter column … set default` chỉ áp cho bản ghi mới, không đụng dữ liệu
--      đã lên website (nếu ép hết về chờ duyệt thì mọi studio đang chạy sẽ mất
--      sạch đánh giá trên trang chủ trong một đêm).
--   3. Không trả lời được. Một lời cảm ơn dưới đánh giá là thứ khách hàng sau
--      đọc nhiều nhất, nên `reply` hiện CÔNG KHAI cùng đánh giá.
--
-- Không thêm `owner_id`: policy sẵn có đã nối qua `albums` để xác định chủ, và
-- màn quản lý đọc bằng inner-join đúng đường đó. Thêm cột trùng nghĩa chỉ tạo
-- thêm một nguồn sự thật nữa phải giữ đồng bộ.
--
-- Chạy 1 lần trong Supabase SQL Editor.
-- ============================================================================

-- ── Kiểm tra điều kiện trước ────────────────────────────────────────────────
-- Migration chỉ VÁ bảng đã có. Thiếu bảng nền thì Postgres chỉ nói
-- `42P01: relation "..." does not exist` — đúng, nhưng không nói phải làm gì.
-- Khối này nói thẳng. (Chạy qua setup-all.sql thì khối `do $$` rơi vào PHẦN 2,
-- tức là SAU khi PHẦN 1 đã tạo hết bảng, nên nó luôn qua.)
do $$
declare thieu text[] := '{}';
begin
  if to_regclass('public.feedback') is null then thieu := thieu || 'feedback'::text; end if;
  if array_length(thieu, 1) > 0 then
    raise exception E'Thiếu bảng: %.\n\nProject chưa có schema nền của bản 2.0 nên migration không vá vào đâu được.\nChạy MỘT file duy nhất: supabase/setup-all.sql — nó gồm cả schema nền lẫn chính migration này,\nvà mọi câu lệnh đều "if not exists" nên không xoá gì của project đang chạy.\n\nMuốn biết project đang thiếu những gì: chạy supabase/kiem-tra-truoc-khi-chay-migration.sql',
      array_to_string(thieu, ', ');
  end if;
end $$;

alter table public.feedback
  add column if not exists reply        text,
  add column if not exists replied_at   timestamptz,
  -- Dấu vết studio ĐÃ QUYẾT về hàng này (bấm duyệt hoặc bấm ẩn). Cần một cột
  -- RIÊNG chứ không dùng ké `replied_at`: "chờ duyệt" và "đã ẩn" trong DB đều
  -- là approved=false, mà studio hoàn toàn có thể trả lời một đánh giá xấu rồi
  -- vẫn chưa quyết cho hiện hay không — dùng ké thì hàng đó tự nhảy sang "đã
  -- ẩn" chỉ vì được trả lời.
  add column if not exists moderated_at timestamptz;

-- Hàng CŨ: đang hiện trên website nghĩa là studio (theo mặc định trước đây) đã
-- để nó hiện — đánh dấu đã quyết luôn, để chúng không đổ hết vào tab "Chờ
-- duyệt" ngay lần đầu studio mở màn hình.
update public.feedback set moderated_at = coalesce(moderated_at, created_at) where approved;

-- Từ nay: đánh giá mới phải được studio duyệt mới lên website.
alter table public.feedback alter column approved set default false;

-- Màn quản lý lọc theo trạng thái duyệt và xếp mới nhất trước; trang album đọc
-- theo album. Khoá ngoại KHÔNG tự tạo chỉ mục trong Postgres nên phải khai tay.
create index if not exists feedback_album_idx on public.feedback (album_id, created_at desc);

create index if not exists feedback_approved_idx on public.feedback (approved, created_at desc);

create index if not exists feedback_moderation_idx on public.feedback (approved, moderated_at);

-- Policy giữ nguyên như schema.sql: công khai đọc bản đã duyệt, chủ album (và
-- admin) toàn quyền. `reply` đi theo hàng nên tự hiện công khai cùng đánh giá —
-- đúng ý: lời studio trả lời là để khách sau đọc.


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/nguon_khach.sql — Nguồn khách & phễu chuyển đổi (chạy SAU website_leads)
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- NGUỒN KHÁCH & PHỄU CHUYỂN ĐỔI
--
-- `studio_contracts.source` đã có từ trước (schema.sql) và màn Thu chi đã gom
-- doanh thu theo nguồn. Vấn đề: cột đó phải GÕ TAY, mà lúc lập hợp đồng thì
-- không ai nhớ ba tuần trước khách bấm vào quảng cáo nào — nên nó gần như luôn
-- rỗng và biểu đồ theo nguồn gần như luôn trống.
--
-- Migration này vá đúng ba chỗ làm đứt chuỗi:
--
--   1. Yêu cầu đặt lịch KHÔNG ghi nguồn. Đây mới là lúc biết được: trình duyệt
--      của khách đang mang sẵn utm_* / fbclid / referrer.
--   2. Lead từ chatbox cũng vậy. (`website_leads.source` đã có nhưng mang nghĩa
--      KHÁC — "site nào" — nên kênh tiếp thị phải là một cột riêng `channel`,
--      không được đè lên.)
--   3. Bấm "Tạo hợp đồng" từ một yêu cầu đặt lịch thì nguồn RƠI MẤT: hợp đồng
--      mới không giữ lại gì nối về yêu cầu gốc. `booking_id` nối lại chuỗi để
--      đếm được phễu khách hỏi → đặt lịch → hợp đồng.
--
-- Chỉ lưu nhãn kênh + tham số quảng cáo thô. KHÔNG cookie, không id theo dõi,
-- không lịch sử duyệt web.
--
-- Chạy 1 lần trong Supabase SQL Editor.
-- ============================================================================

-- ── Kiểm tra điều kiện trước ────────────────────────────────────────────────
-- Migration chỉ VÁ bảng đã có. Thiếu bảng nền thì Postgres chỉ nói
-- `42P01: relation "..." does not exist` — đúng, nhưng không nói phải làm gì.
-- Khối này nói thẳng. (Chạy qua setup-all.sql thì khối `do $$` rơi vào PHẦN 2,
-- tức là SAU khi PHẦN 1 đã tạo hết bảng, nên nó luôn qua.)
do $$
declare thieu text[] := '{}';
begin
  if to_regclass('public.studio_bookings') is null then thieu := thieu || 'studio_bookings'::text; end if;
  if to_regclass('public.website_leads') is null then thieu := thieu || 'website_leads'::text; end if;
  if to_regclass('public.studio_contracts') is null then thieu := thieu || 'studio_contracts'::text; end if;
  if array_length(thieu, 1) > 0 then
    raise exception E'Thiếu bảng: %.\n\nProject chưa có schema nền của bản 2.0 nên migration không vá vào đâu được.\nChạy MỘT file duy nhất: supabase/setup-all.sql — nó gồm cả schema nền lẫn chính migration này,\nvà mọi câu lệnh đều "if not exists" nên không xoá gì của project đang chạy.\n\nMuốn biết project đang thiếu những gì: chạy supabase/kiem-tra-truoc-khi-chay-migration.sql',
      array_to_string(thieu, ', ');
  end if;
end $$;

-- 1. Yêu cầu đặt lịch -------------------------------------------------------
alter table public.studio_bookings
  add column if not exists source       text,   -- facebook | referral | google | walk_in | returning | other
  add column if not exists utm          jsonb,  -- {source,medium,campaign,content,term} thô
  add column if not exists landing_path text;

-- trang khách đang đứng lúc gửi

create index if not exists studio_bookings_source_idx
  on public.studio_bookings (owner_id, source);

-- 2. Lead từ chatbox --------------------------------------------------------
alter table public.website_leads
  add column if not exists channel text,  -- kênh tiếp thị (KHÁC cột `source` = site nào)
  add column if not exists utm     jsonb;

create index if not exists website_leads_channel_idx
  on public.website_leads (owner_id, channel);

-- 3. Nối hợp đồng về yêu cầu đặt lịch đã sinh ra nó --------------------------
-- `on delete set null`: studio xoá một yêu cầu đặt lịch cũ thì hợp đồng (và
-- tiền của nó) phải sống tiếp, chỉ mất phần quy nguồn.
alter table public.studio_contracts
  add column if not exists booking_id uuid references public.studio_bookings (id) on delete set null;

create index if not exists studio_contracts_booking_idx
  on public.studio_contracts (booking_id);

create index if not exists studio_contracts_source_idx
  on public.studio_contracts (owner_id, source);

-- RLS: cả ba bảng đã bật sẵn với policy owner/admin — cột mới đi theo hàng nên
-- không cần policy riêng.


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/album_selection_done.sql — Mốc 'khách đã chọn xong ảnh' trên album
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- Mốc "KHÁCH ĐÃ CHỌN XONG" cho album.
--
-- VÌ SAO
-- Khách bấm nút "Đã chọn xong" trên trang album thì studio nhận được chuông +
-- push + Zalo (xem src/app/api/a/[slug]/done/route.ts) — nhưng CHÍNH ALBUM thì
-- không ghi lại gì cả. Hệ quả: mở Thư viện album ra, không có cách nào phân
-- biệt "khách đang chọn dở" với "khách đã chốt, tới lượt mình lọc ảnh". Một
-- thông báo lướt qua rồi trôi mất là không đủ — thứ studio cần là NHÌN VÀO
-- THƯ VIỆN là thấy album nào đến lượt mình.
--
-- Cột này biến việc đó thành trạng thái bền: có mốc ⇒ album được đẩy lên đầu
-- thư viện và đeo nhãn "Khách đã chọn xong".
--
-- Vì sao là timestamptz chứ không phải boolean: còn dùng để xếp album nào chốt
-- trước lên trước, và để biết khách chốt lúc nào khi cần đối chiếu.
--
-- Khách bấm lại lần nữa (chọn thêm ảnh rồi chốt lại) thì mốc được CẬP NHẬT
-- sang lần mới nhất — đúng ý "album này vừa mới chốt", chứ không giữ lần đầu.
--
-- AN TOÀN KHI CHẠY LẠI: chỉ thêm cột, không sửa dữ liệu cũ. Album đã chốt từ
-- trước ngày chạy migration sẽ có mốc NULL (không có cách nào truy ngược) —
-- chúng nằm đúng chỗ cũ trong thư viện cho tới khi khách chốt lần sau.
-- ============================================================================

alter table albums add column if not exists selection_done_at timestamptz;

-- Thư viện lọc/sắp theo cột này cho từng chủ album.
create index if not exists albums_selection_done_idx
  on albums (owner_id, selection_done_at desc nulls last);

comment on column albums.selection_done_at is
  'Lần gần nhất khách bấm "Đã chọn xong" trên trang album. NULL = chưa chốt.';


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/watermark_opt_in.sql — Watermark phải do studio TỰ BẬT, không mặc định bật
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- Đóng dấu chìm chuyển thành TỰ CHỌN (opt-in) thay vì mặc định bật.
--
-- VÌ SAO
-- Cột `albums.watermark_enabled` trước đây `default true`, nên MỌI album chọn
-- ảnh đều bật watermark kể cả khi studio không hề chạm vào cài đặt đó. Hệ quả
-- về băng thông rất lớn:
--
--   Có watermark   khách bấm tải → ảnh 2560px phải chảy qua máy chủ (canvas /
--                  nay là /api/img/watermark cần đọc được pixel, mà Google
--                  Drive không gửi header CORS nên không chuyển hướng được).
--   Không watermark khách bấm tải → 302 thẳng sang Google Drive.
--                  Máy chủ tốn ĐÚNG 0 byte.
--
-- Đo trên Vercel: Fast Origin Transfer 11,54 GB / 10 GB, gần như toàn bộ dồn
-- vào 4 ngày có người tải album hàng loạt (một ngày 4,42 GB đi ra).
--
-- Cột `watermark_delivery` (gallery giao hàng) vốn đã `default false` — đúng
-- rồi, không đụng tới.
--
-- TÌNH TRẠNG: đã chạy trên production ngày 17/08/2026 — cả phần đổi mặc định
-- lẫn phần tắt cho album cũ (92 album selection đều về false). File giữ lại để
-- bản cài mới và môi trường thử có cùng trạng thái.
--
-- Chạy trên Supabase SQL Editor. An toàn khi chạy lại (idempotent).
-- ============================================================================

-- 1. Album mới từ nay mặc định KHÔNG đóng dấu. Studio muốn thì tự bật trong
--    phần cài đặt album.
alter table public.albums alter column watermark_enabled set default false;

-- ============================================================================
-- 2. (TUỲ CHỌN — ĐỌC KỸ TRƯỚC KHI CHẠY) Tắt watermark cho album ĐANG CÓ.
--
-- Phần trên chỉ đổi mặc định cho album TẠO MỚI. Các album đã tạo vẫn giữ
-- watermark_enabled = true, nên vẫn tiếp tục tốn băng thông.
--
-- Vấn đề: không phân biệt được chắc chắn "studio cố ý bật" với "nó tự bật do
-- mặc định cũ". Cách phỏng đoán hợp lý nhất là nhìn `watermark_text`:
--   • watermark_text IS NULL  → studio chưa từng gõ chữ riêng, gần như chắc
--                               chắn chưa bao giờ mở cài đặt này ra
--   • watermark_text có giá trị → studio đã chủ động cấu hình, ĐỪNG tắt
--
-- Xem trước sẽ ảnh hưởng bao nhiêu album:
--
--     select count(*) filter (where watermark_text is null)  as se_tat,
--            count(*) filter (where watermark_text is not null) as giu_nguyen
--     from public.albums
--     where watermark_enabled = true and phase = 'selection';
--
-- Thấy số hợp lý rồi thì bỏ dấu chú thích ở khối dưới và chạy:
--
-- update public.albums
--    set watermark_enabled = false
--  where watermark_enabled = true
--    and phase = 'selection'
--    and watermark_text is null;
--
-- Muốn tắt sạch không chừa album nào (kể cả studio đã cấu hình) thì bỏ dòng
-- `and watermark_text is null`. Cân nhắc: làm vậy là gỡ lớp bảo vệ ảnh mà một
-- số studio thật sự cần — nên báo cho họ trước.
--
-- Đảo ngược lúc nào cũng được: studio tự bật lại trong cài đặt album, hoặc
--     update public.albums set watermark_enabled = true where id = '<id>';
-- ============================================================================


-- ============================================================================
-- 3. Gallery giao hàng (`watermark_delivery`) — 17/08/2026
--
-- Cột này vốn đã `default false`, nhưng vẫn phải rà: gallery giao hàng là nơi
-- khách tải ảnh NHIỀU NHẤT (download_enabled bật mặc định), nên một album bật
-- đóng dấu ở đây tốn băng thông hơn hẳn một album chọn ảnh.
--
-- Đo được lúc rà: 47 album delivery tắt đóng dấu, 1 album bật.
-- Chủ dự án quyết định tắt nốt album đó.
-- ============================================================================
update public.albums
   set watermark_delivery = false
 where phase = 'delivery'
   and watermark_delivery = true;

-- Kiểm tra lại — cả hai cột phải sạch:
--
--     select phase, watermark_enabled, watermark_delivery, count(*)
--     from public.albums
--     group by 1, 2, 3
--     order by 1, 2, 3;
--
-- Từ giờ mọi lượt khách bấm tải đều 302 thẳng sang Google Drive → máy chủ tốn
-- 0 byte. Studio nào cần đóng dấu thì tự bật lại trong cài đặt album.


-- ============================================================================
-- GHI CHÚ: schema `old_public`
--
-- Lúc rà phát hiện có HAI bảng tên `albums`: `public.albums` (đang dùng) và
-- `old_public.albums` (bản sao lưu còn sót từ lần chuyển sang bản 2.0, xem
-- supabase/clone-from-old-project.sql). App chỉ đọc `public` nên vô hại.
--
-- Lưu ý khi viết truy vấn kiểm tra: lọc theo `table_schema`, nếu không
-- information_schema sẽ trả về cả hai và dễ đọc nhầm kết quả.
--
-- Khi chắc chắn không cần bản cũ nữa:  drop schema old_public cascade;
-- ============================================================================


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/rls_thanh_vien_hop_dong.sql — Vá quyền: thành viên studio lưu được hạng mục hợp đồng (chạy SAU studio_branches)
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- VÁ QUYỀN ĐỌC/GHI HẠNG MỤC HỢP ĐỒNG CHO THÀNH VIÊN STUDIO
--
-- TRIỆU CHỨNG
--   Quản lý chi nhánh tạo hợp đồng, chọn hạng mục, bấm lưu → hợp đồng có, hạng
--   mục KHÔNG có, tổng tiền 0đ. Chủ studio sửa hạng mục thì quản lý chi nhánh
--   vẫn thấy 0đ. Chủ studio thì mọi thứ bình thường.
--
-- NGUYÊN NHÂN
--   schema.sql khai policy cho các bảng con của hợp đồng HAI LẦN:
--
--     ~dòng 845  contract_items_owner_all …  using (c.owner_id = auth.uid())
--                → CHỈ chủ studio. Nhân viên, quản lý, quản lý chi nhánh đều
--                  không đọc và không ghi được.
--     ~dòng 1462 khối do $$ … $$ chạy lại policy đó với is_studio_member(c.owner_id)
--                → đúng: mọi thành viên của studio.
--
--   Bản đúng nằm SAU nên khi chạy trọn schema.sql thì nó thắng. Nhưng khối
--   do $$ … $$ đặt tất cả các bảng con trong MỘT lệnh: chỉ cần một bảng trong
--   danh sách chưa tồn tại (tính năng thêm sau) là cả khối văng lỗi và MỌI bảng
--   sau đó giữ nguyên bản chỉ-chủ-studio. Chạy schema.sql theo từng đoạn, hoặc
--   dừng giữa chừng vì một lỗi khác, cũng cho ra đúng hậu quả đó.
--
--   Hạng mục nằm ở bảng con, còn hợp đồng nằm ở bảng cha — nên hợp đồng thì
--   thấy mà tiền thì không. Đúng như triệu chứng.
--
-- CÁCH VÁ
--   Chạy lại policy cho TỪNG bảng, mỗi bảng một lệnh độc lập và bỏ qua bảng
--   chưa tồn tại. Một bảng thiếu không còn kéo theo những bảng khác.
--
-- AN TOÀN KHI CHẠY LẠI: chỉ thay policy, không đụng dữ liệu. Chạy bao nhiêu lần
-- cũng ra cùng một kết quả.
-- ============================================================================

-- Hàm kiểm tra thành viên (khai lại cho chắc — DB cũ có thể chưa có).
create or replace function public.is_studio_member(target uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select
    target = auth.uid()
    or exists (select 1 from public.profiles where id = auth.uid() and studio_owner_id = target)
    or public.is_admin();
$$;

-- Bảng CHA: hợp đồng và báo giá.
do $$
declare t text;
begin
  foreach t in array array['studio_contracts', 'studio_quotes'] loop
    -- to_regclass trả NULL khi bảng chưa có ⇒ bỏ qua, không làm hỏng cả lượt.
    if to_regclass('public.' || t) is null then
      raise notice 'bỏ qua %: bảng chưa tồn tại', t;
      continue;
    end if;
    begin
      execute format('alter table public.%I enable row level security', t);
      execute format('drop policy if exists %1$s_owner_all on public.%1$s', t);
      execute format(
        'create policy %1$s_owner_all on public.%1$s for all '
        'using (public.is_studio_member(owner_id)) '
        'with check (public.is_studio_member(owner_id))', t);
      raise notice 'đã vá %', t;
    exception when others then
      -- Một bảng hỏng KHÔNG được kéo theo các bảng còn lại — đó chính là lỗi
      -- của khối cũ trong schema.sql mà migration này sinh ra để sửa.
      raise notice 'lỗi khi vá %: %', t, sqlerrm;
    end;
  end loop;
end $$;

-- Bảng CON của hợp đồng: quyền lấy theo chủ của hợp đồng cha.
do $$
declare t text;
begin
  foreach t in array array[
    'contract_items', 'contract_crew', 'contract_edit_requests', 'contract_payments',
    'contract_payment_plan', 'contract_tasks', 'contract_equipment', 'contract_products',
    'contract_quote_options'
  ] loop
    if to_regclass('public.' || t) is null then
      raise notice 'bỏ qua %: bảng chưa tồn tại', t;
      continue;
    end if;
    begin
      execute format('alter table public.%I enable row level security', t);
      execute format('drop policy if exists %1$s_owner_all on public.%1$s', t);
      execute format(
        'create policy %1$s_owner_all on public.%1$s for all '
        'using (exists (select 1 from public.studio_contracts c '
        '               where c.id = contract_id and public.is_studio_member(c.owner_id))) '
        'with check (exists (select 1 from public.studio_contracts c '
        '                    where c.id = contract_id and public.is_studio_member(c.owner_id)))', t);
      raise notice 'đã vá %', t;
    exception when others then
      raise notice 'lỗi khi vá %: %', t, sqlerrm;
    end;
  end loop;
end $$;

-- Hạng mục báo giá: quyền lấy theo chủ của báo giá cha.
do $$
begin
  if to_regclass('public.quote_items') is not null then
    alter table public.quote_items enable row level security;
    drop policy if exists quote_items_owner_all on public.quote_items;
    create policy quote_items_owner_all on public.quote_items for all
      using (exists (select 1 from public.studio_quotes q
                     where q.id = quote_id and public.is_studio_member(q.owner_id)))
      with check (exists (select 1 from public.studio_quotes q
                          where q.id = quote_id and public.is_studio_member(q.owner_id)));
  end if;
end $$;

-- ── Kiểm tra sau khi chạy ───────────────────────────────────────────────────
-- Câu này phải trả về is_studio_member cho MỌI bảng con. Chỗ nào còn
-- "auth.uid()" trần là chỗ chưa vá được.
--
--   select tablename, policyname, qual
--   from pg_policies
--   where schemaname = 'public'
--     and tablename in ('contract_items','contract_crew','contract_payments','studio_contracts')
--   order by tablename;


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/automations.sql — Việc tự động theo trạng thái hợp đồng (chạy SAU album_selection_done)
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- VIỆC TỰ ĐỘNG THEO TRẠNG THÁI HỢP ĐỒNG
--
-- Mọi nhắc nhở trong app đang do NGƯỜI nhớ: ký rồi thì ai nhắc thu cọc, giao ảnh
-- rồi thì ai xin đánh giá, còn ba ngày tới buổi chụp thì ai gọi khách xác nhận.
--
-- HAI bảng, và bảng thứ hai mới là bảng quan trọng:
--
--   studio_automations      — studio bật/tắt từng luật, đổi số ngày và câu chữ.
--   studio_automation_log   — ĐÃ CHẠY những gì. Cron chạy MỖI NGÀY, nên không có
--                             bảng này thì một luật sẽ đẻ ra 30 việc giống nhau
--                             trong một tháng, hoặc gửi khách 30 tin Zalo y hệt.
--
-- CỐ Ý KHÔNG làm bảng luật tự do (điều kiện + hành động tuỳ ý). Tập "khi" và tập
-- "thì" đều ĐÓNG và khai trong code (src/lib/automations.ts, AUTOMATION_RULES);
-- bảng này chỉ giữ CẤU HÌNH cho tám luật đó. Studio cần tám việc đúng, bật/tắt
-- bằng công tắc — không cần một Zapier.
--
-- Chạy 1 lần trong Supabase SQL Editor. An toàn khi chạy lại.
-- ============================================================================

do $$
declare missing text[] := '{}';
begin
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'studio_contracts')
  then missing := missing || 'studio_contracts'; end if;
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'contract_tasks')
  then missing := missing || 'contract_tasks'; end if;
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'studio_notifications')
  then missing := missing || 'studio_notifications'; end if;

  if array_length(missing, 1) > 0 then
    raise exception
      'Thiếu bảng nền: %. Hãy chạy supabase/setup-all.sql trước (nó gồm cả schema nền lẫn migration này).',
      array_to_string(missing, ', ');
  end if;
end $$;

create index if not exists studio_automations_owner_idx on public.studio_automations (owner_id);

create index if not exists studio_automation_log_owner_idx
  on public.studio_automation_log (owner_id, fired_at desc);

create index if not exists studio_automation_log_contract_idx
  on public.studio_automation_log (contract_id);

-- ── Kiểm tra sau khi chạy ───────────────────────────────────────────────────
-- select rule, enabled, offset_days from public.studio_automations order by rule;
-- select rule, count(*) from public.studio_automation_log group by rule;


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/crew_timesheet.sql — Chấm công thợ & khoảng rảnh (chạy SAU studio_appointments)
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- CHẤM CÔNG & KHOẢNG RẢNH CỦA THỢ
--
-- App đã có PHÂN CÔNG (contract_crew, crew_shift_plan) nhưng không ghi THỰC TẾ:
-- thợ có đi không, đến lúc mấy giờ, xong lúc mấy giờ. Nên màn Đối soát tiền công
-- vẫn phải nhập tay từng dòng và không đối chiếu được với bất cứ gì.
--
-- Thợ KHÔNG có tài khoản đăng nhập (xem studio_crew: khoá theo số điện thoại),
-- nên hai bảng dưới đây cũng khoá theo SĐT — giống crew_unavailable đã làm. Thợ
-- bấm từ cổng thợ công khai /crew; studio nhập bù được từ khu quản lý.
--
-- Chạy 1 lần trong Supabase SQL Editor. An toàn khi chạy lại.
-- ============================================================================

do $$
declare missing text[] := '{}';
begin
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'studio_crew')
  then missing := missing || 'studio_crew'; end if;
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'studio_contracts')
  then missing := missing || 'studio_contracts'; end if;

  if array_length(missing, 1) > 0 then
    raise exception
      'Thiếu bảng nền: %. Hãy chạy supabase/setup-all.sql trước (nó gồm cả schema nền lẫn migration này).',
      array_to_string(missing, ', ');
  end if;
end $$;

-- ── Đơn giá giờ của thợ ─────────────────────────────────────────────────────
-- 0 = chưa khai. Lúc đó màn Đối soát KHÔNG đề xuất tiền công (xem `suggestPay`
-- trong src/lib/timesheet.ts): đề xuất 0₫ rồi có người bấm áp dụng sẽ xoá mất
-- số studio đã nhập tay.
alter table public.studio_crew add column if not exists hourly_rate integer not null default 0;

create index if not exists crew_timesheet_owner_idx  on public.crew_timesheet (owner_id, work_date desc);

create index if not exists crew_timesheet_phone_idx  on public.crew_timesheet (phone, work_date desc);

create index if not exists crew_timesheet_contract_idx on public.crew_timesheet (contract_id);

-- Mỗi thợ chỉ được có MỘT dòng đang mở tại một thời điểm. Không có hàng rào này
-- thì thợ bấm "đã đến" hai lần (mạng chậm, bấm lại) sẽ đẻ ra hai dòng mở và giờ
-- làm bị tính đôi.
create unique index if not exists crew_timesheet_one_open_idx
  on public.crew_timesheet (phone)
  where ended_at is null;

create index if not exists crew_available_phone_idx on public.crew_available (phone, date);

-- ── Kiểm tra sau khi chạy ───────────────────────────────────────────────────
-- select phone, work_date, started_at, ended_at from public.crew_timesheet
-- order by work_date desc limit 20;


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/vendors.sql — Nhà cung cấp & đơn đặt ngoài
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- NHÀ CUNG CẤP & ĐƠN ĐẶT NGOÀI
--
-- Album in, makeup thuê ngoài, xe hoa, địa điểm — tất cả đang chỉ là MỘT DÒNG
-- CHI trong studio_expenses. Nên không ai trả lời được câu hỏi hằng ngày của
-- studio: "đơn album của khách A đã in xong chưa?".
--
-- Chạy 1 lần trong Supabase SQL Editor. An toàn khi chạy lại.
-- ============================================================================

do $$
declare missing text[] := '{}';
begin
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'studio_contracts')
  then missing := missing || 'studio_contracts'; end if;
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'studio_expenses')
  then missing := missing || 'studio_expenses'; end if;

  if array_length(missing, 1) > 0 then
    raise exception
      'Thiếu bảng nền: %. Hãy chạy supabase/setup-all.sql trước (nó gồm cả schema nền lẫn migration này).',
      array_to_string(missing, ', ');
  end if;
end $$;

create index if not exists studio_vendors_owner_idx on public.studio_vendors (owner_id, active);

create index if not exists vendor_orders_owner_idx    on public.vendor_orders (owner_id, status, due_date);

create index if not exists vendor_orders_contract_idx on public.vendor_orders (contract_id);

-- ── Nối sang sổ chi, KHÔNG đếm tiền hai lần ─────────────────────────────────
-- Mỗi đơn sinh ĐÚNG MỘT dòng studio_expenses mang vendor_order_id của nó. Mọi
-- lần sửa đơn CẬP NHẬT chính dòng đó (upsert theo cột unique bên dưới) chứ
-- không thêm dòng mới — nếu không, sửa giá đơn ba lần là ba dòng chi và báo cáo
-- lợi nhuận sai gấp ba.
alter table public.studio_expenses
  add column if not exists vendor_order_id uuid references public.vendor_orders (id) on delete cascade;

-- UNIQUE (chứ không chỉ index tra nhanh): đây là hàng rào thật chặn dòng chi
-- trùng, kể cả khi hai tab cùng bấm lưu một đơn.
create unique index if not exists studio_expenses_vendor_order_uidx
  on public.studio_expenses (vendor_order_id)
  where vendor_order_id is not null;

-- ── Kiểm tra sau khi chạy ───────────────────────────────────────────────────
-- select v.name, o.title, o.status, o.due_date, o.amount
-- from public.vendor_orders o left join public.studio_vendors v on v.id = o.vendor_id
-- order by o.due_date;


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/accounting.sql — Phiếu thu có số & khoá sổ kế toán
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- HOÁ ĐƠN & XUẤT KẾ TOÁN
--
-- Studio có doanh thu thật cần hai thứ app chưa có:
--   1. PHIẾU THU đưa khách cho mỗi lần nhận tiền — cần một SỐ PHIẾU bền, đánh
--      theo năm, không trùng.
--   2. KHOÁ SỔ: báo cáo tháng trước đã gửi kế toán, rồi ai đó sửa một hợp đồng
--      cũ và con số tháng trước đổi mà không ai biết. Mốc khoá sổ biến "đừng sửa
--      số cũ" từ lời dặn miệng thành hàng rào.
--
-- Chạy 1 lần trong Supabase SQL Editor. An toàn khi chạy lại.
-- ============================================================================

do $$
begin
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'contract_payments')
  then
    raise exception
      'Thiếu bảng nền: contract_payments. Hãy chạy supabase/setup-all.sql trước.';
  end if;
end $$;

-- ── Số phiếu thu ────────────────────────────────────────────────────────────
-- Đánh theo NĂM ('PT-2026-0007'), nếp sổ sách Việt Nam, và giữ số ngắn sau
-- mười năm. Định dạng do src/lib/accounting.ts (receiptNo) lo; ở đây chỉ lưu.
--
-- null = chưa in phiếu cho lần thu này. Số chỉ được cấp KHI IN, không cấp sẵn
-- cho mọi lần thu: studio ghi nhận một khoản rồi sửa/xoá là chuyện thường, mà
-- một dãy số phiếu thủng lỗ chỗ thì kế toán không giải thích được.
alter table public.contract_payments add column if not exists receipt_no  text;

alter table public.contract_payments add column if not exists receipt_at  timestamptz;

-- Số phiếu không được trùng TRONG MỘT studio. Ràng buộc phải qua hợp đồng vì
-- contract_payments không có owner_id — nên dùng bảng đếm riêng bên dưới thay vì
-- một unique index không biểu diễn được.
create index if not exists contract_payments_receipt_idx
  on public.contract_payments (receipt_no)
  where receipt_no is not null;

/**
 * Cấp số phiếu thu kế tiếp cho một studio trong một năm.
 *
 * `insert ... on conflict do update` là một câu lệnh nguyên tử: hai người cùng
 * bấm in một lúc thì Postgres tuần tự hoá chúng và mỗi người nhận một số khác
 * nhau. Đọc-rồi-ghi ở tầng ứng dụng KHÔNG làm được điều đó.
 */
create or replace function public.next_receipt_no(p_owner uuid, p_year integer)
returns integer
language sql
security definer
set search_path = public
as $$
  insert into public.studio_receipt_seq (owner_id, year, last_no)
  values (p_owner, p_year, 1)
  on conflict (owner_id, year)
  do update set last_no = public.studio_receipt_seq.last_no + 1
  returning last_no;
$$;

-- ── Khoá sổ ─────────────────────────────────────────────────────────────────
-- Ngày CUỐI CÙNG đã chốt. Mọi bút toán có ngày ≤ mốc này là bất biến (luật ở
-- src/lib/accounting.ts, isLocked). null = chưa khoá kỳ nào.
alter table public.profiles add column if not exists books_closed_until date;

-- ── Kiểm tra sau khi chạy ───────────────────────────────────────────────────
-- select owner_id, year, last_no from public.studio_receipt_seq;
-- select receipt_no, receipt_at, amount from public.contract_payments
--   where receipt_no is not null order by receipt_at desc limit 10;

-- ── HÀNG RÀO KHOÁ SỔ (trigger) ──────────────────────────────────────────────
--
-- Mốc `books_closed_until` ở trên mới chỉ là một CON SỐ. Không có phần dưới đây
-- thì nó chỉ là lời dặn miệng có màu: giao diện nhắc, còn ai bấm sửa vẫn sửa
-- được, và đúng cái tình huống cần chặn (sửa một hợp đồng cũ làm đổi số của kỳ
-- đã gửi kế toán) vẫn xảy ra y như trước.
--
-- Chặn ở DB chứ không ở giao diện: RLS cho phép studio ghi thẳng vào hai bảng
-- này bằng anon key, nên một kiểm tra ở React không phải hàng rào.
--
-- CHỈ chặn thay đổi ĐỘNG TỚI TIỀN. Đóng dấu số phiếu thu (`receipt_no`), đính
-- ảnh chuyển khoản, sửa ghi chú… đều không làm đổi con số nào của kỳ, mà lại là
-- việc studio hay làm trên phiếu cũ — chặn cả những thứ đó thì studio sẽ đi mở
-- khoá sổ để in một tờ phiếu, và cái khoá thành vô nghĩa.

create or replace function public.guard_books_closed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner   uuid;
  v_closed  date;
  v_old_day date;
  v_new_day date;
  v_money_changed boolean := true;
begin
  -- Chủ sở hữu + ngày của bút toán, tuỳ bảng.
  if tg_table_name = 'studio_expenses' then
    v_owner   := coalesce(new.owner_id, old.owner_id);
    v_old_day := (case when tg_op <> 'INSERT' then old.spent_at end);
    v_new_day := (case when tg_op <> 'DELETE' then new.spent_at end);
    if tg_op = 'UPDATE' then
      v_money_changed := (new.amount is distinct from old.amount)
                      or (new.spent_at is distinct from old.spent_at)
                      or (new.category is distinct from old.category)
                      or (new.contract_id is distinct from old.contract_id);
    end if;
  else -- contract_payments
    select c.owner_id into v_owner
    from public.studio_contracts c
    where c.id = coalesce(new.contract_id, old.contract_id);
    v_old_day := (case when tg_op <> 'INSERT' then old.paid_at::date end);
    v_new_day := (case when tg_op <> 'DELETE' then new.paid_at::date end);
    if tg_op = 'UPDATE' then
      v_money_changed := (new.amount is distinct from old.amount)
                      or (new.paid_at is distinct from old.paid_at)
                      or (new.kind is distinct from old.kind)
                      or (new.contract_id is distinct from old.contract_id);
    end if;
  end if;

  if v_owner is null then
    return coalesce(new, old);
  end if;

  select p.books_closed_until into v_closed from public.profiles p where p.id = v_owner;
  if v_closed is null or not v_money_changed then
    return coalesce(new, old);
  end if;

  -- Xét CẢ hai mốc ngày: dời một bút toán RA KHỎI kỳ đã khoá cũng là làm đổi số
  -- của kỳ đó, y như sửa tại chỗ.
  if (v_old_day is not null and v_old_day <= v_closed)
     or (v_new_day is not null and v_new_day <= v_closed) then
    raise exception
      'Sổ đã khoá tới %. Bút toán trong kỳ đã chốt không sửa/xoá/thêm được. Mở khoá kỳ ở màn Thu chi & công nợ nếu thật sự cần.',
      to_char(v_closed, 'DD/MM/YYYY')
      using errcode = 'check_violation';
  end if;

  return coalesce(new, old);
end $$;

drop trigger if exists guard_books_closed_expenses on public.studio_expenses;

create trigger guard_books_closed_expenses
  before insert or update or delete on public.studio_expenses
  for each row execute function public.guard_books_closed();

drop trigger if exists guard_books_closed_payments on public.contract_payments;

create trigger guard_books_closed_payments
  before insert or update or delete on public.contract_payments
  for each row execute function public.guard_books_closed();

-- ── Kiểm tra hàng rào sau khi chạy ──────────────────────────────────────────
-- update public.profiles set books_closed_until = current_date where id = auth.uid();
-- insert into public.studio_expenses (owner_id, title, amount, spent_at)
--   values (auth.uid(), 'thử', 1000, current_date - 1);   -- PHẢI báo lỗi
-- update public.profiles set books_closed_until = null where id = auth.uid();


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/weather.sql — Toạ độ điểm chụp cho dự báo thời tiết (chạy SAU studio_appointments)
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- THỜI TIẾT & ĐƯỜNG ĐI CHO BUỔI CHỤP NGOẠI CẢNH
--
-- Rủi ro lớn nhất của studio ngoại cảnh là mưa, mà app chưa nói gì về nó dù đã
-- lưu ngày giờ (studio_appointments) và địa điểm (dạng chữ) của từng buổi.
--
-- Để tra dự báo cần TOẠ ĐỘ. Hiện toạ độ chỉ nằm rải rác trong
-- studio_contracts.intake (jsonb do khách điền qua LocationPicker) — không đọc
-- được nhanh, và không có gì cho những buổi studio tự tạo. Migration này thêm
-- hai cột toạ độ vào đúng nơi cần, cộng MỘT vị trí studio làm điểm xuất phát để
-- ước lượng đường đi.
--
-- Không thêm bảng nào. Chạy 1 lần trong Supabase SQL Editor; an toàn khi chạy lại.
-- ============================================================================

-- ── Kiểm tra điều kiện ──────────────────────────────────────────────────────
-- Cùng cách làm với các migration khác: thiếu bảng nền thì nói rõ phải làm gì,
-- thay vì để Postgres trả về 42P01 trần trụi.
do $$
declare missing text[] := '{}';
begin
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'studio_appointments')
  then missing := missing || 'studio_appointments'; end if;
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'studio_contracts')
  then missing := missing || 'studio_contracts'; end if;

  if array_length(missing, 1) > 0 then
    raise exception
      'Thiếu bảng nền: %. Hãy chạy supabase/setup-all.sql trước (nó gồm cả schema nền lẫn migration này).',
      array_to_string(missing, ', ');
  end if;
end $$;

-- ── Toạ độ điểm chụp ────────────────────────────────────────────────────────
-- Kiểu double precision (không phải numeric): đây là toạ độ để tra dự báo và
-- ước lượng đường đi, độ chính xác dấu phẩy động là quá đủ, và nhẹ hơn.
--
-- null = chưa biết. Lúc đó lớp đọc dự báo tự thử hai đường khác: đọc toạ độ nằm
-- sẵn trong chuỗi địa điểm (link Google Maps studio dán vào), rồi mới tra tên
-- địa danh — xem `coordsInText` / `placeQuery` trong src/lib/weather.ts.
alter table public.studio_appointments add column if not exists lat double precision;

alter table public.studio_appointments add column if not exists lng double precision;

alter table public.studio_contracts add column if not exists lat double precision;

alter table public.studio_contracts add column if not exists lng double precision;

-- ── Vị trí studio (điểm xuất phát) ──────────────────────────────────────────
-- Một studio một địa chỉ: dùng làm điểm bắt đầu để ước lượng thời gian di
-- chuyển tới điểm chụp. Studio nhiều chi nhánh thì đây là cơ sở chính; ước
-- lượng đường đi vốn chỉ để xếp lịch trong ngày nên không cần chính xác hơn.
alter table public.profiles add column if not exists studio_lat double precision;

alter table public.profiles add column if not exists studio_lng double precision;

alter table public.profiles add column if not exists studio_address text;

-- ── Kiểm tra sau khi chạy ───────────────────────────────────────────────────
-- select column_name from information_schema.columns
-- where table_schema = 'public' and table_name = 'studio_appointments'
--   and column_name in ('lat', 'lng');


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/album_people.sql — Gom ảnh theo từng người trong album (chạy SAU schema.sql — cần albums + photos)
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- NGƯỜI TRONG ALBUM (gom ảnh theo từng người)
--
-- Studio quét MỘT LẦN trên máy mình: mạng nhận dạng 128 chiều chạy trong trình
-- duyệt, gom khuôn mặt thành từng người, studio đặt tên ("Cô dâu", "Mẹ chú rể")
-- rồi lưu kết quả xuống đây. Khách chỉ ĐỌC hai bảng này.
--
-- Vì sao phải có bảng, thay vì để trình duyệt khách tự gom:
--   mô hình nặng 26 MB. Bắt mỗi điện thoại trong nhà tải 26 MB qua 3G rồi chạy
--   nhận dạng trên từng ảnh là đánh đổi tệ — trong khi studio chỉ phải làm một
--   lần. Lưu xuống DB thì khách tải THÊM 0 byte mô hình: chỉ vài KB JSON.
--
-- Chạy 1 lần trong Supabase SQL Editor. An toàn khi chạy lại.
-- ============================================================================

do $$
declare missing text[] := '{}';
begin
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'albums')
  then missing := missing || 'albums'; end if;
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'photos')
  then missing := missing || 'photos'; end if;

  if array_length(missing, 1) > 0 then
    raise exception
      'Thiếu bảng nền: %. Hãy chạy supabase/setup-all.sql trước (nó gồm cả schema nền lẫn migration này).',
      array_to_string(missing, ', ');
  end if;
end $$;

create index if not exists album_people_album_idx on public.album_people (album_id, position);

-- Hai người cùng tên trong một album là lỗi nhập, không phải dữ liệu. Cũng chặn
-- luôn cú lưu lặp khi studio bấm hai lần. Tên rỗng thì không tính (nhiều cụm
-- chưa đặt tên là chuyện thường).
create unique index if not exists album_people_name_uk
  on public.album_people (album_id, lower(name)) where name <> '';

create index if not exists album_photo_people_album_idx on public.album_photo_people (album_id);


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/fix_google_signup_trigger.sql — Vá đăng nhập Google báo server_error
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- VÁ — Đăng nhập Google báo "server_error"
-- Chạy MỘT LẦN trên Supabase (SQL Editor). An toàn khi chạy lại (idempotent).
--
-- Vì sao cần: khi Google trả người dùng về, Supabase INSERT một dòng vào
-- auth.users; trigger on_auth_user_created chạy NGAY TRONG cùng transaction đó
-- để tạo hồ sơ ở public.profiles. Nếu insert hồ sơ lỗi (thiếu cột sau khi đổi
-- schema, ràng buộc check/unique, email null…) thì CẢ transaction bị rollback:
-- tài khoản không được lưu, và Supabase trả về
--     ?error=server_error&error_code=unexpected_failure
--      &error_description=Database+error+saving+new+user
-- — đúng chữ "server_error" mà người dùng nhìn thấy ở màn hình đăng nhập.
--
-- Bản vá này làm hai việc:
--   1. Không để email null làm vỡ ràng buộc NOT NULL (tài khoản Google hiếm khi
--      thiếu email, nhưng vẫn có thể).
--   2. Bọc exception: nếu tạo hồ sơ hỏng thì GHI CẢNH BÁO rồi cho đăng nhập đi
--      tiếp, thay vì huỷ luôn việc tạo tài khoản. Hồ sơ thiếu có thể vá sau
--      (xem phần backfill ở cuối file) — mất hồ sơ vẫn hơn mất tài khoản.
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role, is_active)
  values (
    new.id,
    -- profiles.email là NOT NULL; auth.users.email có thể null với một số
    -- provider, nên luôn có giá trị dự phòng.
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
    -- KHÔNG raise lại: raise sẽ rollback cả việc tạo auth.users và biến thành
    -- "Database error saving new user" → server_error ở màn hình đăng nhập.
    raise warning 'handle_new_user failed for % : % (%)', new.id, sqlerrm, sqlstate;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Backfill: tạo hồ sơ cho các tài khoản đã đăng ký nhưng chưa có profile ────
-- (gồm cả những tài khoản từng bị lỗi trigger trước khi chạy bản vá này)
insert into public.profiles (id, email, full_name, role, is_active)
select
  u.id,
  coalesce(u.email, u.raw_user_meta_data ->> 'email', u.id::text),
  coalesce(
    u.raw_user_meta_data ->> 'full_name',
    u.raw_user_meta_data ->> 'name',
    u.email,
    ''
  ),
  'photographer',
  true
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;

-- ── Kiểm tra sau khi chạy: phải trả về 0 dòng ────────────────────────────────
-- select u.id, u.email
-- from auth.users u
-- left join public.profiles p on p.id = u.id
-- where p.id is null;


-- ══════════════════════════════════════════════════════════════════════════
-- PHẦN 3 — PHÂN QUYỀN, RLS & POLICY (chạy sau khi mọi bảng/cột đã có)
-- ══════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════
-- ▶ schema.sql — Nền: profiles, albums, hợp đồng, studio, site_settings, storage buckets
-- ══════════════════════════════════════════════════════════════════════════

alter table public.album_shares enable row level security;

-- Đọc qua service-role (trang share dùng createAdminClient). KHÔNG mở đọc công khai:
-- policy using(true) trước đây cho phép anon (bằng anon key) DUYỆT toàn bộ token
-- share của mọi studio. Thu hồi quyền đọc của anon/authenticated.
drop policy if exists album_shares_public_read on public.album_shares;

revoke select on public.album_shares from anon, authenticated;

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

alter table public.site_settings enable row level security;

drop policy if exists site_settings_public_read on public.site_settings;

create policy site_settings_public_read on public.site_settings
  for select using (true);

drop policy if exists site_settings_admin_write on public.site_settings;

create policy site_settings_admin_write on public.site_settings
  for all using (public.is_admin()) with check (public.is_admin());

alter table public.bookings enable row level security;

-- Only admins read/manage; customer inserts happen through the service role.
drop policy if exists bookings_admin_all on public.bookings;

create policy bookings_admin_all on public.bookings
  for all using (public.is_admin()) with check (public.is_admin());

alter table public.upgrade_requests enable row level security;

drop policy if exists upgrade_admin_all on public.upgrade_requests;

create policy upgrade_admin_all on public.upgrade_requests
  for all using (public.is_admin()) with check (public.is_admin());

alter table public.album_creations enable row level security;

drop policy if exists album_creations_read on public.album_creations;

create policy album_creations_read on public.album_creations
  for select using (user_id = auth.uid() or public.is_admin());

alter table public.filter_usages enable row level security;

drop policy if exists filter_usages_read on public.filter_usages;

create policy filter_usages_read on public.filter_usages
  for select using (user_id = auth.uid() or public.is_admin());

-- >0 = instant self-serve trial of `plan` for N days
alter table public.discount_codes enable row level security;

-- Only admins read/manage directly; customers validate a code via the API (service role).
drop policy if exists discount_codes_admin on public.discount_codes;

create policy discount_codes_admin on public.discount_codes
  for all using (public.is_admin()) with check (public.is_admin());

alter table public.discount_redemptions enable row level security;

drop policy if exists discount_redemptions_read on public.discount_redemptions;

create policy discount_redemptions_read on public.discount_redemptions
  for select using (user_id = auth.uid() or public.is_admin());

alter table public.compress_usages enable row level security;

-- Users read their own usage; admins read all. Inserts happen via the service
-- role through the /api/compress/use route, so no public insert policy needed.
drop policy if exists compress_usages_read on public.compress_usages;

create policy compress_usages_read on public.compress_usages
  for select using (user_id = auth.uid() or public.is_admin());

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

alter table public.studio_packages enable row level security;

drop policy if exists studio_packages_owner_all on public.studio_packages;

create policy studio_packages_owner_all on public.studio_packages
  for all using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

alter table public.studio_pricelist enable row level security;

drop policy if exists studio_pricelist_owner_all on public.studio_pricelist;

create policy studio_pricelist_owner_all on public.studio_pricelist
  for all using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

alter table public.message_templates enable row level security;

drop policy if exists message_templates_owner_all on public.message_templates;

create policy message_templates_owner_all on public.message_templates
  for all using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

alter table public.studio_bookings enable row level security;

-- Owner/admin manage; public inserts go through the service role API.
drop policy if exists studio_bookings_owner_all on public.studio_bookings;

create policy studio_bookings_owner_all on public.studio_bookings
  for all using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

alter table public.studio_equipment enable row level security;

drop policy if exists studio_equipment_owner_all on public.studio_equipment;

create policy studio_equipment_owner_all on public.studio_equipment
  for all using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

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

alter table public.studio_notifications enable row level security;

drop policy if exists studio_notifications_owner_all on public.studio_notifications;

create policy studio_notifications_owner_all on public.studio_notifications
  for all using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

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

alter table public.crew_unavailable enable row level security;

-- Authenticated studios may read (for conflict detection); writes go through the
-- service role from the crew portal, so no insert/update/delete policy is needed.
drop policy if exists crew_unavailable_read on public.crew_unavailable;

create policy crew_unavailable_read on public.crew_unavailable
  for select using (auth.role() = 'authenticated');

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

alter table public.contract_client_proofs enable row level security;

drop policy if exists contract_client_proofs_owner on public.contract_client_proofs;

create policy contract_client_proofs_owner on public.contract_client_proofs
  for all using (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and c.owner_id = auth.uid())
  );

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

alter table public.studio_services enable row level security;

drop policy if exists studio_services_owner_all on public.studio_services;

create policy studio_services_owner_all on public.studio_services
  for all using (public.is_studio_member(owner_id)) with check (public.is_studio_member(owner_id));

-- Template items: gated via parent template owner.
drop policy if exists contract_template_items_owner_all on public.contract_template_items;

create policy contract_template_items_owner_all on public.contract_template_items
  for all using (exists (select 1 from public.contract_templates t where t.id = template_id and public.is_studio_member(t.owner_id)))
  with check (exists (select 1 from public.contract_templates t where t.id = template_id and public.is_studio_member(t.owner_id)));

alter table public.sites enable row level security;

drop policy if exists sites_owner_all on public.sites;

create policy sites_owner_all on public.sites
  for all using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

alter table public.site_blocks enable row level security;

drop policy if exists site_blocks_owner_all on public.site_blocks;

create policy site_blocks_owner_all on public.site_blocks
  for all using (exists (select 1 from public.sites s where s.id = site_id and (s.owner_id = auth.uid() or public.is_admin())))
  with check (exists (select 1 from public.sites s where s.id = site_id and (s.owner_id = auth.uid() or public.is_admin())));

alter table public.album_designs enable row level security;

drop policy if exists album_designs_owner_all on public.album_designs;

create policy album_designs_owner_all on public.album_designs
  for all using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

alter table public.studio_quotes enable row level security;

drop policy if exists studio_quotes_owner_all on public.studio_quotes;

create policy studio_quotes_owner_all on public.studio_quotes
  for all using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

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

alter table public.affiliate_codes enable row level security;

drop policy if exists affiliate_codes_owner on public.affiliate_codes;

create policy affiliate_codes_owner on public.affiliate_codes
  for all using (user_id = auth.uid());

drop policy if exists affiliate_codes_admin on public.affiliate_codes;

create policy affiliate_codes_admin on public.affiliate_codes
  for all using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

alter table public.affiliate_commissions enable row level security;

drop policy if exists affiliate_commissions_owner on public.affiliate_commissions;

create policy affiliate_commissions_owner on public.affiliate_commissions
  for select using (referrer_id = auth.uid());

drop policy if exists affiliate_commissions_admin on public.affiliate_commissions;

create policy affiliate_commissions_admin on public.affiliate_commissions
  for all using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

alter table public.wedding_invitations enable row level security;

drop policy if exists wedding_invitations_owner_all on public.wedding_invitations;

create policy wedding_invitations_owner_all on public.wedding_invitations
  for all using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

alter table public.wedding_rsvps enable row level security;

drop policy if exists wedding_rsvps_owner_read on public.wedding_rsvps;

create policy wedding_rsvps_owner_read on public.wedding_rsvps
  for select using (exists (
    select 1 from public.wedding_invitations w
    where w.id = invitation_id and (w.owner_id = auth.uid() or public.is_admin())
  ));

drop policy if exists wedding_photos_read on storage.objects;

create policy wedding_photos_read on storage.objects
  for select using (bucket_id = 'wedding-photos');

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

alter table public.story_pages enable row level security;

drop policy if exists story_pages_owner_all on public.story_pages;

create policy story_pages_owner_all on public.story_pages
  for all using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

alter table public.story_wishes enable row level security;

drop policy if exists story_wishes_owner_read on public.story_wishes;

create policy story_wishes_owner_read on public.story_wishes
  for select using (exists (
    select 1 from public.story_pages s
    where s.id = story_id and (s.owner_id = auth.uid() or public.is_admin())
  ));

alter table public.story_uploads enable row level security;

drop policy if exists story_uploads_owner_read on public.story_uploads;

create policy story_uploads_owner_read on public.story_uploads
  for select using (exists (
    select 1 from public.story_pages s
    where s.id = story_id and (s.owner_id = auth.uid() or public.is_admin())
  ));

alter table public.desktop_devices enable row level security;

drop policy if exists desktop_devices_owner on public.desktop_devices;

create policy desktop_devices_owner on public.desktop_devices
  for all using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

revoke all on public.studio_drive from anon, authenticated;

alter table public.studio_drive enable row level security;

revoke all on public.admin_drive from anon, authenticated;

alter table public.admin_drive enable row level security;

revoke all on public.studio_zalo from anon, authenticated;

alter table public.studio_zalo enable row level security;

alter table public.zalo_messages enable row level security;

drop policy if exists zalo_messages_owner_read on public.zalo_messages;

create policy zalo_messages_owner_read on public.zalo_messages
  for select using (owner_id = auth.uid() or public.is_admin());


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ push_subscriptions.sql — Web Push (thông báo đẩy)
-- ══════════════════════════════════════════════════════════════════════════

-- Writes go through the service-role key (server API routes), so RLS can stay
-- enabled with no public policies — clients never touch this table directly.
alter table push_subscriptions enable row level security;


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ wedding_invitations.sql — Thiệp cưới online
-- ══════════════════════════════════════════════════════════════════════════

alter table public.wedding_invitations enable row level security;

-- Studio owner manages their own invitations from the dashboard. Public reads
-- (the guest-facing page) and client edits (via edit_token) go through the
-- service-role API, so no anon policy is needed here.
drop policy if exists wedding_invitations_owner_all on public.wedding_invitations;

create policy wedding_invitations_owner_all on public.wedding_invitations
  for all using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

alter table public.wedding_rsvps enable row level security;

drop policy if exists wedding_rsvps_owner_read on public.wedding_rsvps;

create policy wedding_rsvps_owner_read on public.wedding_rsvps
  for select using (exists (
    select 1 from public.wedding_invitations w
    where w.id = invitation_id and (w.owner_id = auth.uid() or public.is_admin())
  ));

drop policy if exists wedding_photos_read on storage.objects;

create policy wedding_photos_read on storage.objects
  for select using (bucket_id = 'wedding-photos');


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ story_pages.sql — Trang Love Story
-- ══════════════════════════════════════════════════════════════════════════

alter table public.story_pages enable row level security;

drop policy if exists story_pages_owner_all on public.story_pages;

create policy story_pages_owner_all on public.story_pages
  for all using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

alter table public.story_wishes enable row level security;

drop policy if exists story_wishes_owner_read on public.story_wishes;

create policy story_wishes_owner_read on public.story_wishes
  for select using (exists (
    select 1 from public.story_pages s
    where s.id = story_id and (s.owner_id = auth.uid() or public.is_admin())
  ));

alter table public.story_uploads enable row level security;

drop policy if exists story_uploads_owner_read on public.story_uploads;

create policy story_uploads_owner_read on public.story_uploads
  for select using (exists (
    select 1 from public.story_pages s
    where s.id = story_id and (s.owner_id = auth.uid() or public.is_admin())
  ));


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/c1_profiles_column_grants.sql — Vá C1: chặn leo thang đặc quyền trên profiles
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- VÁ C1 — Chống leo thang đặc quyền trên bảng profiles
-- Chạy MỘT LẦN trên Supabase (SQL Editor). An toàn khi chạy lại (idempotent).
--
-- Vì sao cần: RLS chỉ lọc theo DÒNG chứ không theo CỘT. Nếu authenticated có
-- quyền UPDATE toàn bảng, một user có thể tự đặt role='admin' / đổi plan /
-- studio_owner_id… trên chính dòng của mình. Ta thu hồi UPDATE toàn bảng rồi
-- CHỈ cấp lại các cột cấu hình an toàn; mọi cột nhạy cảm chỉ sửa được qua
-- service-role ở API server.
-- ============================================================================

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


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/admin_drive.sql — Vá bảo mật: tách refresh_token Drive của admin
-- ══════════════════════════════════════════════════════════════════════════

revoke all on public.admin_drive from anon, authenticated;

alter table public.admin_drive enable row level security;

-- album_shares: đọc qua service-role, thu hồi quyền đọc của anon/authenticated.
drop policy if exists album_shares_public_read on public.album_shares;

revoke select on public.album_shares from anon, authenticated;


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/album_designs.sql — Thiết kế Album
-- ══════════════════════════════════════════════════════════════════════════

alter table public.album_designs enable row level security;

drop policy if exists album_designs_owner_all on public.album_designs;

create policy album_designs_owner_all on public.album_designs
  for all using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/crew_schedule.sql — Lịch thợ (phải chạy TRƯỚC crew_profile_show)
-- ══════════════════════════════════════════════════════════════════════════

alter table public.crew_shift_plan enable row level security;

-- Studio đã đăng nhập đọc được để xem lịch đội; ghi đi qua service role từ cổng
-- thợ (thợ không có tài khoản) — giống hệt cách crew_unavailable đang làm.
drop policy if exists crew_shift_plan_read on public.crew_shift_plan;

create policy crew_shift_plan_read on public.crew_shift_plan
  for select using (auth.role() = 'authenticated');


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/crew_profile_show.sql — Hồ sơ thợ & thông tin show
-- ══════════════════════════════════════════════════════════════════════════

alter table public.crew_account enable row level security;

-- Ghi đi qua service role từ cổng thợ; studio đã đăng nhập chỉ cần đọc.
drop policy if exists crew_account_read on public.crew_account;

create policy crew_account_read on public.crew_account
  for select using (auth.role() = 'authenticated');


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/rental.sql — Phòng váy: kho trang phục & đơn thuê
-- ══════════════════════════════════════════════════════════════════════════

-- RLS: owner (studio đăng nhập) + admin.
alter table public.rental_items       enable row level security;

alter table public.rental_orders      enable row level security;

alter table public.rental_order_items enable row level security;

drop policy if exists rental_items_owner_all on public.rental_items;

create policy rental_items_owner_all on public.rental_items
  for all using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists rental_orders_owner_all on public.rental_orders;

create policy rental_orders_owner_all on public.rental_orders
  for all using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

-- Dòng đơn: gated theo quyền sở hữu đơn cha.
drop policy if exists rental_order_items_owner_all on public.rental_order_items;

create policy rental_order_items_owner_all on public.rental_order_items
  for all using (
    exists (select 1 from public.rental_orders o
            where o.id = order_id and (o.owner_id = auth.uid() or public.is_admin()))
  ) with check (
    exists (select 1 from public.rental_orders o
            where o.id = order_id and (o.owner_id = auth.uid() or public.is_admin()))
  );


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/site_views.sql — Đếm lượt xem website studio
-- ══════════════════════════════════════════════════════════════════════════

alter table public.site_views enable row level security;

-- Chủ studio (và admin) chỉ ĐỌC số liệu của site mình.
drop policy if exists site_views_owner_read on public.site_views;

create policy site_views_owner_read on public.site_views
  for select using (
    exists (
      select 1 from public.sites s
      where s.id = site_id and (s.owner_id = auth.uid() or public.is_admin())
    )
  );

revoke all on function public.bump_site_view(uuid) from public, anon, authenticated;

grant execute on function public.bump_site_view(uuid) to service_role;


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/studio_drive_sync.sql — Đồng bộ Google Drive cho hợp đồng
-- ══════════════════════════════════════════════════════════════════════════

-- Không để lộ refresh token ra trình duyệt: khóa mọi quyền của anon/authenticated,
-- bật RLS mà KHÔNG tạo policy → chỉ service-role (bỏ qua RLS) mới truy cập được.
revoke all on public.studio_drive from anon, authenticated;

alter table public.studio_drive enable row level security;


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/studio_zalo.sql — Tự động nhắn Zalo theo từng studio
-- ══════════════════════════════════════════════════════════════════════════

-- Không để lộ token/cookie ra trình duyệt: khoá mọi quyền của anon/authenticated,
-- bật RLS mà KHÔNG tạo policy → chỉ service-role (bỏ qua RLS) mới truy cập được.
revoke all on public.studio_zalo from anon, authenticated;

alter table public.studio_zalo enable row level security;

alter table public.zalo_messages enable row level security;

drop policy if exists zalo_messages_owner_read on public.zalo_messages;

create policy zalo_messages_owner_read on public.zalo_messages
  for select using (owner_id = auth.uid() or public.is_admin());


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/website_chat_config.sql — Cấu hình chatbox website
-- ══════════════════════════════════════════════════════════════════════════

alter table public.website_chat_config enable row level security;

drop policy if exists website_chat_config_owner_read on public.website_chat_config;

create policy website_chat_config_owner_read on public.website_chat_config
  for select using (owner_id = auth.uid() or public.is_admin());

drop policy if exists website_chat_config_owner_insert on public.website_chat_config;

create policy website_chat_config_owner_insert on public.website_chat_config
  for insert with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists website_chat_config_owner_update on public.website_chat_config;

create policy website_chat_config_owner_update on public.website_chat_config
  for update using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/website_leads.sql — Lead & hội thoại từ chatbox
-- ══════════════════════════════════════════════════════════════════════════

alter table public.website_leads enable row level security;

-- Chủ studio (và admin) ĐỌC lead của mình.
drop policy if exists website_leads_owner_read on public.website_leads;

create policy website_leads_owner_read on public.website_leads
  for select using (owner_id = auth.uid() or public.is_admin());

-- Chủ studio (và admin) cập nhật trạng thái lead của mình (đã liên hệ / đóng).
drop policy if exists website_leads_owner_update on public.website_leads;

create policy website_leads_owner_update on public.website_leads
  for update using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

-- GHI (insert) chỉ qua service-role: không cấp quyền insert cho anon/authenticated.
revoke insert on public.website_leads from anon, authenticated;


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/album_dislikes.sql — Ảnh khách 'không thích' trong album chọn ảnh
-- ══════════════════════════════════════════════════════════════════════════

-- RLS: chủ album (và admin) đọc/ghi; khách ghi qua service role trong API route.
alter table public.dislikes enable row level security;

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


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/lifecycle_followup.sql — Theo đuổi khách chưa chọn ảnh · hạn lưu trữ ảnh gốc · hạn hiệu lực báo giá
-- ══════════════════════════════════════════════════════════════════════════

-- BẮT BUỘC: migrations/c1_profiles_column_grants.sql đã THU HỒI quyền UPDATE
-- toàn bảng profiles và chỉ cấp lại theo từng cột. Không cấp thêm hai cột này
-- thì thẻ "Chính sách studio" lưu sẽ im lặng không đổi được gì.
-- Cả hai đều là cấu hình vô hại (số tháng / số ngày), không phải cột nhạy cảm
-- như role hay plan.
grant update (storage_months, quote_valid_days) on public.profiles to authenticated;


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/referral_deposit.sql — Khách giới thiệu khách · đặt cọc giữ ngày (chạy sau lifecycle_followup)
-- ══════════════════════════════════════════════════════════════════════════

-- c1_profiles_column_grants.sql đã THU HỒI quyền UPDATE toàn bảng profiles và
-- chỉ cấp lại theo cột. Không có dòng này thì thẻ chính sách lưu sẽ im lặng
-- không đổi được gì. Ba cột này đều là số tiền cấu hình, không nhạy cảm.
grant update (referral_reward, referral_discount, booking_deposit)
  on public.profiles to authenticated;

alter table public.studio_referrals enable row level security;

drop policy if exists studio_referrals_owner_all on public.studio_referrals;

create policy studio_referrals_owner_all on public.studio_referrals
  for all using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/studio_appointments.sql — Lịch studio: lịch trang điểm / thử đồ / tư vấn, phòng & nguồn lực
-- ══════════════════════════════════════════════════════════════════════════

alter table public.studio_appointments enable row level security;

-- Cùng luật với studio_events: mọi thành viên của studio đều dùng được. Cổng
-- khách và cổng thợ (không đăng nhập) đi qua service-role như các cổng khác.
drop policy if exists studio_appointments_owner_all on public.studio_appointments;

create policy studio_appointments_owner_all on public.studio_appointments
  for all using (public.is_studio_member(owner_id))
  with check (public.is_studio_member(owner_id));

alter table public.studio_rooms enable row level security;

drop policy if exists studio_rooms_owner_all on public.studio_rooms;

create policy studio_rooms_owner_all on public.studio_rooms
  for all using (public.is_studio_member(owner_id))
  with check (public.is_studio_member(owner_id));


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/studio_branches.sql — Chi nhánh studio: nhiều cơ sở trong một tài khoản (chạy SAU studio_appointments)
-- ══════════════════════════════════════════════════════════════════════════

alter table public.studio_branches enable row level security;

drop policy if exists studio_branches_owner_all on public.studio_branches;

create policy studio_branches_owner_all on public.studio_branches
  for all using (public.is_studio_member(owner_id))
  with check (public.is_studio_member(owner_id));


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/upgrade_payment.sql — Thanh toán gói dịch vụ: QR chuyển khoản, studio báo đã chuyển, admin xác nhận
-- ══════════════════════════════════════════════════════════════════════════

-- Chủ tài khoản ĐỌC yêu cầu của chính mình: trang thanh toán phải hiện được số
-- tiền, mã nội dung và trạng thái duyệt. Chính sách cũ chỉ cho admin đọc.
-- (Ghi vẫn chỉ qua service-role — studio không được tự đổi trạng thái.)
drop policy if exists upgrade_requests_owner_read on public.upgrade_requests;

create policy upgrade_requests_owner_read on public.upgrade_requests
  for select using (user_id = auth.uid() or public.is_admin());


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/contract_deposit_percent.sql — % cọc hợp đồng do studio tự đặt
-- ══════════════════════════════════════════════════════════════════════════

-- Chủ studio tự sửa được (giống booking_deposit ở migration referral_deposit).
-- Cấp quyền theo CỘT: vá C1 chặn UPDATE cả bảng profiles để không ai tự nâng
-- vai trò của mình.
grant update (contract_deposit_percent) on public.profiles to authenticated;


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/inbox_unified.sql — Hộp thư hợp nhất: gom tin Zalo/Facebook/Instagram/website về một chỗ
-- ══════════════════════════════════════════════════════════════════════════

-- Token page nằm trong bảng này ⇒ khoá trước, rồi cấp lại ĐÚNG những cột không
-- bí mật. Không thể khoá sạch như `studio_zalo`: màn hộp thư join sang đây để
-- lấy tên kênh và nền tảng của từng hội thoại, khoá hết thì câu join bị từ chối
-- quyền và cả danh sách trống. RLS lọc theo DÒNG, grant lọc theo CỘT — cần cả
-- hai: policy cho thành viên studio đọc dòng của mình, grant để `secret` không
-- bao giờ nằm trong tập cột đọc được, kể cả khi ai đó gọi thẳng PostgREST.
-- GHI vẫn chỉ service-role: không cấp insert/update/delete cho ai.
revoke all on public.inbox_channels from anon, authenticated;

grant select (
  id, owner_id, platform, external_id, name, status, ai_mode,
  last_error, connected_at, updated_at
) on public.inbox_channels to authenticated;

alter table public.inbox_channels enable row level security;

drop policy if exists inbox_channels_member_read on public.inbox_channels;

create policy inbox_channels_member_read on public.inbox_channels
  for select using (public.is_studio_member(owner_id));

alter table public.inbox_contacts enable row level security;

drop policy if exists inbox_contacts_member_all on public.inbox_contacts;

create policy inbox_contacts_member_all on public.inbox_contacts
  for all using (public.is_studio_member(owner_id))
  with check (public.is_studio_member(owner_id));

alter table public.inbox_conversations enable row level security;

drop policy if exists inbox_conversations_member_all on public.inbox_conversations;

create policy inbox_conversations_member_all on public.inbox_conversations
  for all using (public.is_studio_member(owner_id))
  with check (public.is_studio_member(owner_id));

alter table public.inbox_messages enable row level security;

drop policy if exists inbox_messages_member_all on public.inbox_messages;

create policy inbox_messages_member_all on public.inbox_messages
  for all using (public.is_studio_member(owner_id))
  with check (public.is_studio_member(owner_id));


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/automations.sql — Việc tự động theo trạng thái hợp đồng (chạy SAU album_selection_done)
-- ══════════════════════════════════════════════════════════════════════════

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.studio_automations    enable row level security;

alter table public.studio_automation_log enable row level security;

drop policy if exists studio_automations_owner_all on public.studio_automations;

create policy studio_automations_owner_all on public.studio_automations
  for all using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

-- Sổ đã chạy: studio ĐỌC được (để màn cấu hình hiện "đã chạy 12 lần"), nhưng
-- GHI chỉ qua service-role ở cron. Cho client ghi thì một studio có thể tự đánh
-- dấu "đã chạy" để chặn luật của chính mình một cách khó hiểu.
drop policy if exists studio_automation_log_read on public.studio_automation_log;

create policy studio_automation_log_read on public.studio_automation_log
  for select using (owner_id = auth.uid() or public.is_admin());


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/crew_timesheet.sql — Chấm công thợ & khoảng rảnh (chạy SAU studio_appointments)
-- ══════════════════════════════════════════════════════════════════════════

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.crew_timesheet  enable row level security;

alter table public.crew_available  enable row level security;

-- Chấm công: studio đọc/sửa dòng của CHÍNH mình (nhập bù, sửa giờ sai). Thợ ghi
-- qua service-role ở cổng thợ công khai, nên không cần policy cho anon.
drop policy if exists crew_timesheet_owner_all on public.crew_timesheet;

create policy crew_timesheet_owner_all on public.crew_timesheet
  for all using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

-- Khoảng rảnh: mọi studio đã đăng nhập ĐỌC được (để phân công thấy ai trống),
-- giống hệt cách crew_unavailable đang làm — đây là thông tin xếp lịch, không
-- nhạy cảm. Ghi đi qua service-role từ cổng thợ.
drop policy if exists crew_available_read on public.crew_available;

create policy crew_available_read on public.crew_available
  for select using (auth.role() = 'authenticated');


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/vendors.sql — Nhà cung cấp & đơn đặt ngoài
-- ══════════════════════════════════════════════════════════════════════════

-- Xoá đơn thì dòng chi đi theo (on delete cascade ở trên) — tiền của một đơn
-- không còn tồn tại thì cũng không được nằm lại trong báo cáo.

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.studio_vendors enable row level security;

alter table public.vendor_orders  enable row level security;

drop policy if exists studio_vendors_owner_all on public.studio_vendors;

create policy studio_vendors_owner_all on public.studio_vendors
  for all using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists vendor_orders_owner_all on public.vendor_orders;

create policy vendor_orders_owner_all on public.vendor_orders
  for all using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/accounting.sql — Phiếu thu có số & khoá sổ kế toán
-- ══════════════════════════════════════════════════════════════════════════

alter table public.studio_receipt_seq enable row level security;

drop policy if exists studio_receipt_seq_owner_all on public.studio_receipt_seq;

create policy studio_receipt_seq_owner_all on public.studio_receipt_seq
  for all using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

revoke all on function public.next_receipt_no(uuid, integer) from public, anon;

grant execute on function public.next_receipt_no(uuid, integer) to authenticated;

-- BẮT BUỘC: c1_profiles_column_grants.sql đã thu hồi UPDATE toàn bảng profiles.
-- Không cấp cột này thì nút "Khoá sổ" bấm xong im lặng không đổi gì.
grant update (books_closed_until) on public.profiles to authenticated;


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/weather.sql — Toạ độ điểm chụp cho dự báo thời tiết (chạy SAU studio_appointments)
-- ══════════════════════════════════════════════════════════════════════════

-- BẮT BUỘC: migrations/c1_profiles_column_grants.sql đã THU HỒI quyền UPDATE
-- toàn bảng profiles và chỉ cấp lại theo từng cột. Không cấp ba cột này thì thẻ
-- "Vị trí studio" lưu sẽ im lặng không đổi được gì.
-- Cả ba đều vô hại (toạ độ + địa chỉ), không phải cột nhạy cảm như role/plan.
grant update (studio_lat, studio_lng, studio_address) on public.profiles to authenticated;


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/album_people.sql — Gom ảnh theo từng người trong album (chạy SAU schema.sql — cần albums + photos)
-- ══════════════════════════════════════════════════════════════════════════

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Chủ album (và admin) đọc/ghi. KHÔNG mở đọc công khai: trang khách
-- (src/app/a/[slug]/page.tsx) chạy trên máy chủ bằng service role, nên khách
-- không cần quyền gì trên bảng này.
alter table public.album_people enable row level security;

drop policy if exists album_people_owner_rw on public.album_people;

create policy album_people_owner_rw on public.album_people
  for all using (
    exists (select 1 from public.albums a
            where a.id = album_id and (a.owner_id = auth.uid() or public.is_admin()))
  )
  with check (
    exists (select 1 from public.albums a
            where a.id = album_id and (a.owner_id = auth.uid() or public.is_admin()))
  );

alter table public.album_photo_people enable row level security;

drop policy if exists album_photo_people_owner_rw on public.album_photo_people;

/*
 * Ngoài quyền sở hữu, policy này còn là HÀNG RÀO TOÀN VẸN cho hai chỗ mà khoá
 * ngoại không với tới được: người và ảnh phải thuộc ĐÚNG album_id đã ghi. Không
 * có nó, một lỗi lập trình trộn album A với album B vẫn ghi được, và khách album
 * A sẽ thấy chip lọc ra ảnh của album B.
 */
create policy album_photo_people_owner_rw on public.album_photo_people
  for all using (
    exists (select 1 from public.albums a
            where a.id = album_id and (a.owner_id = auth.uid() or public.is_admin()))
  )
  with check (
    exists (
      select 1
      from public.album_people p
      join public.albums a on a.id = p.album_id
      join public.photos ph on ph.id = photo_id
      where p.id = person_id
        and p.album_id = album_photo_people.album_id
        and ph.album_id = album_photo_people.album_id
        and (a.owner_id = auth.uid() or public.is_admin())
    )
  );

