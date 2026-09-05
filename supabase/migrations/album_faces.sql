-- ============================================================================
-- KHO KHUÔN MẶT ĐÃ QUÉT
--
-- Studio KHÔNG phải mở hay bấm gì: MÁY CHỦ tự quét (cron /api/cron/face-scan),
-- khách mở link là tìm được theo khuôn mặt ngay. Bảng này là thứ làm cho việc
-- "tự động" đó chịu được đời thực:
--
--  • HẾT GIỜ GIỮA CHỪNG. Một lượt serverless có trần 300 giây, mà album 800 ảnh
--    tốn ~10 phút CPU. Không lưu lại từng mẻ thì mỗi lượt cron lại quét từ đầu,
--    và sẽ không bao giờ xong.
--  • GOM LẠI. Gom lại chỉ là phép tính trên vector đã có — không phải quét lại
--    cả nghìn ảnh.
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

/*
 * Dấu "album này đã gom nhóm rồi", và cũng là HÀNG ĐỢI GOM NHÓM.
 *
 * Bộ quét đặt lại về null mỗi khi ghi thêm khuôn mặt mới; lượt gom đặt lại
 * thành now(). Nhờ vậy câu hỏi "album nào cần gom lại?" chỉ là một truy vấn có
 * chỉ mục, thay vì phải đếm khuôn mặt của từng album mỗi 5 phút.
 *
 * Không có nó thì có một lỗ thật: lượt cron quét xong tấm cuối rồi HẾT GIỜ đúng
 * trước bước gom — lượt sau thấy không còn gì để quét nên bỏ qua album, và album
 * đó nằm mãi ở trạng thái "đã quét, chưa có người nào".
 */
alter table public.albums
  add column if not exists faces_clustered_at timestamptz;
create index if not exists albums_faces_pending_idx
  on public.albums (id) where faces_clustered_at is null;

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
