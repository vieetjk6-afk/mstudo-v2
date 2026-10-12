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
create index if not exists wedding_invitations_owner_idx on public.wedding_invitations (owner_id);
create index if not exists wedding_invitations_contract_idx on public.wedding_invitations (contract_id);
create index if not exists wedding_invitations_slug_idx on public.wedding_invitations (slug);

drop trigger if exists wedding_invitations_set_updated_at on public.wedding_invitations;
create trigger wedding_invitations_set_updated_at
  before update on public.wedding_invitations
  for each row execute function public.set_updated_at();

alter table public.wedding_invitations enable row level security;
-- Studio owner manages their own invitations from the dashboard. Public reads
-- (the guest-facing page) and client edits (via edit_token) go through the
-- service-role API, so no anon policy is needed here.
drop policy if exists wedding_invitations_owner_all on public.wedding_invitations;
create policy wedding_invitations_owner_all on public.wedding_invitations
  for all using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

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
create index if not exists wedding_rsvps_invitation_idx on public.wedding_rsvps (invitation_id);

alter table public.wedding_rsvps enable row level security;
drop policy if exists wedding_rsvps_owner_read on public.wedding_rsvps;
create policy wedding_rsvps_owner_read on public.wedding_rsvps
  for select using (exists (
    select 1 from public.wedding_invitations w
    where w.id = invitation_id and (w.owner_id = auth.uid() or public.is_admin())
  ));

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

-- Bucket PUBLIC: khách xem ảnh bằng URL công khai, không cần policy SELECT nào.
-- Một policy SELECT chỉ mở thêm đường LIỆT KÊ toàn bucket → cố ý không có.
drop policy if exists wedding_photos_read on storage.objects;
