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

create table if not exists public.print_picks (
  id          uuid primary key default gen_random_uuid(),
  album_id    uuid not null references public.albums (id) on delete cascade,
  photo_id    uuid not null references public.photos (id) on delete cascade,
  photo_name  text not null default '',
  created_at  timestamptz not null default now(),
  unique (album_id, photo_id)
);
create index if not exists print_picks_album_idx on public.print_picks (album_id);

-- RLS: chủ album (và admin) đọc; khách ghi qua service role trong API route
-- /api/album/[slug]/print — giống selections / dislikes.
alter table public.print_picks enable row level security;
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
