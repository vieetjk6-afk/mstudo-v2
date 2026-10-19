-- ══════════════════════════════════════════════════════════════════════════
-- mstudo — ẢNH IN TẶNG — KHÁCH CHỌN ẢNH IN TRONG ALBUM GIAO KHÁCH
--
-- File này do supabase/build-setup-all.mjs sinh ra — ĐỪNG sửa tay.
--
-- Cách dùng: Supabase → SQL Editor → dán TOÀN BỘ file này → Run.
-- Mọi câu lệnh đều idempotent nên chạy lại nhiều lần vô hại.
--
-- Chỉ gồm migration của riêng tính năng này: cột số ảnh in tặng trên hợp
-- đồng, hai mốc thời gian trên album và bảng print_picks. Chỉ cần các bảng
-- hợp đồng / album / ảnh có từ schema nền.
-- ══════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════
-- PHẦN 1 — TẠO BẢNG
-- ══════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/anh_in_tang.sql — Ảnh in tặng: số ảnh in theo hợp đồng + khách chọn ảnh in trong album giao khách
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists public.print_picks (
  id          uuid primary key default gen_random_uuid(),
  album_id    uuid not null references public.albums (id) on delete cascade,
  photo_id    uuid not null references public.photos (id) on delete cascade,
  photo_name  text not null default '',
  created_at  timestamptz not null default now(),
  unique (album_id, photo_id)
);

-- RLS: chủ album (và admin) đọc; khách ghi qua service role trong API route
-- /api/album/[slug]/print — giống selections / dislikes.
alter table public.print_picks enable row level security;


-- ══════════════════════════════════════════════════════════════════════════
-- PHẦN 2 — CỘT BỔ SUNG, CHỈ MỤC, HÀM, TRIGGER, DỮ LIỆU MẶC ĐỊNH
-- ══════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/anh_in_tang.sql — Ảnh in tặng: số ảnh in theo hợp đồng + khách chọn ảnh in trong album giao khách
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- ẢNH IN TẶNG — khách chọn ảnh in ngay trong album giao khách.
--
-- • studio_contracts.print_quota: số ảnh in hợp đồng TẶNG khách (studio nhập ở
--   tab Sản phẩm). Trống / 0 = hợp đồng không tặng in → album giao khách không
--   hiện phần chọn ảnh in.
-- • print_picks: ảnh khách chọn để in (MỘT danh sách mỗi album). Bảng RIÊNG,
--   không gộp vào public.selections: selections là ảnh khách chọn để CHỈNH SỬA,
--   được Lọc ảnh / ZIP / thông báo / thống kê đọc ở cả chục chỗ — trộn vào là ảnh
--   in lẫn sang danh sách chỉnh sửa (cùng lý do public.dislikes tách riêng).
-- • albums.print_sent_at: lần cuối khách bấm "Gửi ảnh in cho studio".
-- • albums.print_copied_at: studio đã chép ảnh in vào thư mục "Ảnh in" trên
--   Drive → khoá phần chọn của khách (studio mở lại được).
--
-- Chạy trên Supabase SQL Editor. An toàn khi chạy lại (idempotent).
-- ============================================================================

alter table public.studio_contracts
  add column if not exists print_quota integer;

alter table public.albums
  add column if not exists print_sent_at   timestamptz,
  add column if not exists print_copied_at timestamptz;

create index if not exists print_picks_album_idx on public.print_picks (album_id);


-- ══════════════════════════════════════════════════════════════════════════
-- PHẦN 3 — PHÂN QUYỀN, RLS & POLICY (chạy sau khi mọi bảng/cột đã có)
-- ══════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/anh_in_tang.sql — Ảnh in tặng: số ảnh in theo hợp đồng + khách chọn ảnh in trong album giao khách
-- ══════════════════════════════════════════════════════════════════════════

drop policy if exists print_picks_owner_rw on public.print_picks;

create policy print_picks_owner_rw on public.print_picks
  for all using (
    exists (select 1 from public.albums a
            where a.id = album_id and (a.owner_id = auth.uid() or public.is_admin()))
  )
  with check (
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

