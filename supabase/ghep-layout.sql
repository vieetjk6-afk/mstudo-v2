-- ══════════════════════════════════════════════════════════════════════════
-- mstudo — GHÉP LAYOUT ẢNH ĐĂNG MẠNG XÃ HỘI TRONG ALBUM GIAO KHÁCH
--
-- File này do supabase/build-setup-all.mjs sinh ra — ĐỪNG sửa tay.
--
-- Cách dùng: Supabase → SQL Editor → dán TOÀN BỘ file này → Run.
-- Mọi câu lệnh đều idempotent nên chạy lại nhiều lần vô hại.
--
-- Chỉ gồm migration của riêng tính năng này: cột bật/tắt ghép layout trên
-- hợp đồng (mặc định bật) và bảng album_collages giữ bộ layout khách đang
-- ghép trong 1 ngày. Chỉ cần bảng hợp đồng / album có từ schema nền. Chạy
-- lại cả file này cũng an toàn.
-- ══════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════
-- PHẦN 1 — TẠO BẢNG
-- ══════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/ghep_layout.sql — Ghép layout ảnh đăng mạng xã hội trong album giao khách: bật/tắt theo hợp đồng + bộ layout khách giữ 1 ngày
-- ══════════════════════════════════════════════════════════════════════════

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

-- RLS: chủ album (và admin) đọc; khách đọc / ghi qua service role trong API
-- route /api/album/[slug]/collage — giống print_picks.
alter table public.album_collages enable row level security;


-- ══════════════════════════════════════════════════════════════════════════
-- PHẦN 2 — CỘT BỔ SUNG, CHỈ MỤC, HÀM, TRIGGER, DỮ LIỆU MẶC ĐỊNH
-- ══════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/ghep_layout.sql — Ghép layout ảnh đăng mạng xã hội trong album giao khách: bật/tắt theo hợp đồng + bộ layout khách giữ 1 ngày
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- GHÉP LAYOUT ẢNH ĐĂNG MẠNG XÃ HỘI — khách tự ghép ảnh trong album giao khách.
--
-- • studio_contracts.collage_enabled: studio bật / tắt cho từng hợp đồng.
--   MẶC ĐỊNH BẬT: hợp đồng tạo mới là khách có ngay; hợp đồng đã có cũng được
--   bật khi chạy file này. Chỉ có tác dụng với studio gói Photographer Plus /
--   Studio (planAllowsCollage trong src/lib/plans.ts) — gói khác album không
--   hiện nút ghép layout dù cột này là true.
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

create index if not exists album_collages_album_idx on public.album_collages (album_id, updated_at desc);

create index if not exists album_collages_expires_idx on public.album_collages (expires_at);


-- ══════════════════════════════════════════════════════════════════════════
-- PHẦN 3 — PHÂN QUYỀN, RLS & POLICY (chạy sau khi mọi bảng/cột đã có)
-- ══════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/ghep_layout.sql — Ghép layout ảnh đăng mạng xã hội trong album giao khách: bật/tắt theo hợp đồng + bộ layout khách giữ 1 ngày
-- ══════════════════════════════════════════════════════════════════════════

drop policy if exists album_collages_owner_read on public.album_collages;

create policy album_collages_owner_read on public.album_collages
  for select using (
    exists (select 1 from public.albums a
            where a.id = album_id and (a.owner_id = auth.uid() or public.is_admin()))
  );


-- ══════════════════════════════════════════════════════════════════════════
-- KIỂM TRA — bảng kết quả dưới đây là BẰNG CHỨNG đã chạy đúng chỗ.
-- Cột `co` phải là `t` (true) hết. Có `f` nào nghĩa là chưa xong.
-- ══════════════════════════════════════════════════════════════════════════
select 'album_people'   as thu, to_regclass('public.album_people')   is not null as co
union all
select 'album_photo_people', to_regclass('public.album_photo_people') is not null
union all
select 'album_faces', to_regclass('public.album_faces') is not null
union all
select 'photos.faces_scanned_at', exists (
  select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'photos' and column_name = 'faces_scanned_at')
union all
select 'albums.faces_clustered_at', exists (
  select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'albums' and column_name = 'faces_clustered_at');

