-- ============================================================================
-- KHO KHUÔN MẶT ĐÃ QUÉT
--
-- Studio KHÔNG phải bấm gì: mở màn album là app tự quét nền rồi gom nhóm, khách
-- mở link là tìm được theo khuôn mặt ngay. Bảng này là thứ làm cho việc "tự
-- động" đó chịu được đời thực:
--
--  • ĐÓNG TAB GIỮA CHỪNG. Album 800 ảnh quét mất nhiều phút. Không lưu lại từng
--    bước thì mỗi lần mở lại là quét lại từ đầu, và sẽ không bao giờ xong.
--  • ĐỔI NGƯỠNG GOM. Gom lại chỉ là phép tính trên vector đã có — không phải
--    quét lại cả nghìn ảnh.
--  • THÊM ẢNH SAU. Studio bổ sung ảnh thì chỉ quét phần mới.
--
-- Chỗ chiếm: mỗi khuôn mặt ~600 byte (128 số float4 + khung + khoá). Album 800
-- ảnh, trung bình 1,5 mặt/ảnh → ~700 KB. Đổi lấy ba điều trên thì đáng.
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

/*
 * Dấu "ảnh này đã quét rồi".
 *
 * Phải có RIÊNG, không suy ra từ album_faces được: ảnh KHÔNG CÓ khuôn mặt nào
 * (ảnh cổng hoa, ảnh bàn tiệc) sẽ không sinh hàng nào cả, nên nếu lấy "có hàng
 * trong album_faces" làm dấu thì những tấm đó bị quét lại mãi mãi — và lượt quét
 * không bao giờ kết thúc.
 */
alter table public.photos
  add column if not exists faces_scanned_at timestamptz;
create index if not exists photos_faces_pending_idx
  on public.photos (album_id) where faces_scanned_at is null;

create table if not exists public.album_faces (
  album_id   uuid not null references public.albums (id) on delete cascade,
  photo_id   uuid not null references public.photos (id) on delete cascade,
  -- Khuôn mặt thứ mấy TRONG tấm ảnh đó. Một tấm ảnh cưới có nhiều người.
  at         int  not null,
  /** Khung khuôn mặt [x, y, rộng, cao], chuẩn hoá 0…1 theo cạnh ảnh. */
  box        real[] not null check (array_length(box, 1) = 4),
  /** Vector đặc trưng 128 chiều, ĐỂ NGUYÊN như mô hình trả về. */
  descriptor real[] not null check (array_length(descriptor, 1) = 128),
  /** Điểm nét vùng mặt — để chọn ảnh đại diện cho mỗi người. */
  sharpness  real not null default 0,
  primary key (photo_id, at)
);
create index if not exists album_faces_album_idx on public.album_faces (album_id);

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Chủ album (và admin) đọc/ghi. Khách KHÔNG cần quyền gì: trang khách chỉ đọc
-- album_people/album_photo_people, và đọc bằng service role trên máy chủ.
alter table public.album_faces enable row level security;
drop policy if exists album_faces_owner_rw on public.album_faces;
create policy album_faces_owner_rw on public.album_faces
  for all using (
    exists (select 1 from public.albums a
            where a.id = album_id and (a.owner_id = auth.uid() or public.is_admin()))
  )
  with check (
    -- Cũng là hàng rào toàn vẹn: ảnh phải thuộc ĐÚNG album đã ghi, giống policy
    -- của album_photo_people. Khoá ngoại không kiểm được điều đó.
    exists (
      select 1
      from public.albums a
      join public.photos ph on ph.id = photo_id
      where a.id = album_faces.album_id
        and ph.album_id = album_faces.album_id
        and (a.owner_id = auth.uid() or public.is_admin())
    )
  );
