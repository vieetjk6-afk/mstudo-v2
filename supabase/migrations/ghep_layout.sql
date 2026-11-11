-- ============================================================================
-- GHÉP LAYOUT ẢNH ĐĂNG MẠNG XÃ HỘI — khách tự ghép ảnh trong album giao khách.
--
-- • studio_contracts.collage_enabled: studio bật / tắt cho từng hợp đồng.
--   MẶC ĐỊNH BẬT: hợp đồng tạo mới là khách có ngay; hợp đồng đã có cũng được
--   bật khi chạy file này. Chỉ có tác dụng với studio gói Photographer Plus /
--   Studio (planAllowsCollage trong src/lib/plans.ts) — gói khác album không
--   hiện nút ghép layout dù cột này là true.
-- • albums.collage_enabled: như trên nhưng cho ALBUM LẺ (album không thuộc hợp
--   đồng nào) — studio bật / tắt ở tab Giao khách của album, MẶC ĐỊNH BẬT.
--   Album thuộc hợp đồng thì theo cột của hợp đồng, cột này bỏ qua.
-- • album_collages: bộ layout khách đang ghép (ảnh nào nằm khung nào, chữ gì,
--   khổ gì). GIỮ 1 NGÀY kể từ lần lưu cuối (`expires_at`); trong thời gian đó
--   khách mở lại sửa tiếp được, kể cả trên máy khác (xác minh SĐT lại). Chỉ là
--   JSON nhỏ (vài KB): ảnh vẫn là ảnh studio đã giao, tham chiếu bằng id ảnh —
--   không có byte ảnh nào nằm ở đây, khách cũng không đưa được ảnh ngoài vào.
--   Hết hạn thì route máy chủ tự xoá ở lượt đọc/ghi của album đó, và cron
--   /api/cron/cleanup-proofs dọn toàn bộ mỗi ngày.
--
-- Khách ghi qua service role trong /api/album/[slug]/collage sau khi xác minh
-- SĐT khách / cô dâu / chú rể của hợp đồng (cùng vé với chọn ảnh in) — không
-- cấp policy ghi nào cho anon / authenticated. Chủ album (và admin) đọc được.
--
-- • profiles.collage_brand: cài đặt ghép ảnh của STUDIO (mọi album): ký tên
--   studio trên ảnh ghép (tắt / tên / logo, góc nào), slide cuối "Xem cả album"
--   (trang studio / album / tắt), khoá màu ảnh (khách không đổi bộ lọc màu).
--   Chủ studio tự sửa → cấp quyền UPDATE đúng cột này (bảng profiles chỉ cho
--   sửa từng cột — xem c1_profiles_column_grants.sql).
-- • album_collage_events: thống kê cho studio — mỗi lượt khách tạo bộ ghép,
--   tải ảnh, tạo video (kèm mẫu đã dùng). Ghi qua service role trong API.
--
-- Bản web chịu được lúc CHƯA chạy file này: thiếu cột / bảng thì album giao
-- khách đơn giản không hiện phần ghép layout.
--
-- Chạy trên Supabase SQL Editor. An toàn khi chạy lại (idempotent).
-- ============================================================================

do $$
declare missing text[] := '{}';
begin
  if to_regclass('public.albums') is null then missing := missing || 'albums'; end if;
  if to_regclass('public.studio_contracts') is null then missing := missing || 'studio_contracts'; end if;
  if array_length(missing, 1) > 0 then
    raise exception
      'Thiếu bảng nền: %. Hãy chạy supabase/setup-all.sql trước.',
      array_to_string(missing, ', ');
  end if;
end $$;

alter table public.studio_contracts
  add column if not exists collage_enabled boolean not null default true;

alter table public.albums
  add column if not exists collage_enabled boolean not null default true;

create table if not exists public.album_collages (
  id          uuid primary key default gen_random_uuid(),
  album_id    uuid not null references public.albums (id) on delete cascade,
  title       text not null default '' check (char_length(title) <= 80),
  -- { v, format, pages: [{ id, format?, background, frames: [...] }] } — xem
  -- src/lib/collage/types.ts. Trần ~200 KB để một lượt ghi lỗi không phình bảng.
  data        jsonb not null check (octet_length(data::text) <= 200000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- Lưu lại là gia hạn: route máy chủ đặt lại = now() + 1 ngày mỗi lần ghi.
  expires_at  timestamptz not null default (now() + interval '1 day')
);
create index if not exists album_collages_album_idx on public.album_collages (album_id, updated_at desc);
create index if not exists album_collages_expires_idx on public.album_collages (expires_at);

-- RLS: chủ album (và admin) đọc; khách đọc / ghi qua service role trong API
-- route /api/album/[slug]/collage — giống print_picks.
alter table public.album_collages enable row level security;
drop policy if exists album_collages_owner_read on public.album_collages;
create policy album_collages_owner_read on public.album_collages
  for select using (
    exists (select 1 from public.albums a
            where a.id = album_id and (a.owner_id = auth.uid() or public.is_admin()))
  );

-- ── Cài đặt ghép ảnh của studio ────────────────────────────────────────────
alter table public.profiles
  add column if not exists collage_brand jsonb not null default '{}'::jsonb;
grant update (collage_brand) on public.profiles to authenticated;

-- ── Thống kê ghép ảnh (studio xem ở tab Giao khách của album) ───────────────
create table if not exists public.album_collage_events (
  id          bigint generated always as identity primary key,
  album_id    uuid not null references public.albums (id) on delete cascade,
  -- set = khách tạo một bộ ghép mới; export = tải ảnh (n = số ảnh); video = tạo video.
  kind        text not null check (kind in ('set', 'export', 'video')),
  n           int  not null default 1 check (n between 0 and 1000),
  -- Mẫu đã dùng (họ bố cục, phong cách, mẫu chữ…) — vài trăm byte.
  meta        jsonb not null default '{}'::jsonb check (octet_length(meta::text) <= 4000),
  created_at  timestamptz not null default now()
);
create index if not exists album_collage_events_album_idx on public.album_collage_events (album_id, created_at desc);
alter table public.album_collage_events enable row level security;
drop policy if exists album_collage_events_owner_read on public.album_collage_events;
create policy album_collage_events_owner_read on public.album_collage_events
  for select using (
    exists (select 1 from public.albums a
            where a.id = album_id and (a.owner_id = auth.uid() or public.is_admin()))
  );
