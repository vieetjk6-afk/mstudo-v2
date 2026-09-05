-- ══════════════════════════════════════════════════════════════════════════
-- mstudo — TÌM ẢNH THEO KHUÔN MẶT
--
-- File này do supabase/build-setup-all.mjs sinh ra — ĐỪNG sửa tay.
--
-- Cách dùng: Supabase → SQL Editor → dán TOÀN BỘ file này → Run.
-- Mọi câu lệnh đều idempotent nên chạy lại nhiều lần vô hại.
--
-- Chỉ gồm hai migration của riêng tính năng này, và chúng chỉ cần `albums`
-- với `photos` — hai bảng chắc chắn đã có. Cố ý KHÔNG gộp chung với các
-- migration khác: SQL Editor chạy cả file trong MỘT transaction, nên một
-- hàng rào của tính năng khác bật lên là cuốn theo cả tính năng này.
-- ══════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════
-- PHẦN 1 — TẠO BẢNG
-- ══════════════════════════════════════════════════════════════════════════

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
-- ▶ migrations/album_faces.sql — Kho khuôn mặt đã quét — để lượt quét tự động chạy tiếp được (chạy SAU album_people)
-- ══════════════════════════════════════════════════════════════════════════

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


-- ══════════════════════════════════════════════════════════════════════════
-- PHẦN 2 — CỘT BỔ SUNG, CHỈ MỤC, HÀM, TRIGGER, DỮ LIỆU MẶC ĐỊNH
-- ══════════════════════════════════════════════════════════════════════════

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

/*
 * Khung của chính khuôn mặt đại diện: [x, y, rộng, cao], chuẩn hoá 0…1 theo
 * cạnh ảnh.
 *
 * Đây là thứ cho phép KHÁCH tìm ảnh theo khuôn mặt mà KHÔNG tải mô hình nào:
 * có khung thì cắt ra ảnh mặt bằng CSS ngay trên thumbnail album đã có sẵn.
 * Không có nó, ảnh thẻ đành lấy cả tấm — mà một tấm ảnh cưới thì có hai ba
 * người, nên khách không chỉ được vào mặt mình.
 *
 * Thêm bằng ALTER (không sửa CREATE TABLE ở trên) để những project đã chạy
 * migration này rồi chỉ cần chạy lại là có cột mới.
 */
alter table public.album_people
  add column if not exists cover_box real[];

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.album_people'::regclass and conname = 'album_people_cover_box_len'
  ) then
    alter table public.album_people
      add constraint album_people_cover_box_len
      check (cover_box is null or array_length(cover_box, 1) = 4);
  end if;
end $$;

-- Hai người cùng tên trong một album là lỗi nhập, không phải dữ liệu. Cũng chặn
-- luôn cú lưu lặp khi studio bấm hai lần. Tên rỗng thì không tính (nhiều cụm
-- chưa đặt tên là chuyện thường).
create unique index if not exists album_people_name_uk
  on public.album_people (album_id, lower(name)) where name <> '';

create index if not exists album_photo_people_album_idx on public.album_photo_people (album_id);


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/album_faces.sql — Kho khuôn mặt đã quét — để lượt quét tự động chạy tiếp được (chạy SAU album_people)
-- ══════════════════════════════════════════════════════════════════════════

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

create index if not exists album_faces_album_idx on public.album_faces (album_id);


-- ══════════════════════════════════════════════════════════════════════════
-- PHẦN 3 — PHÂN QUYỀN, RLS & POLICY (chạy sau khi mọi bảng/cột đã có)
-- ══════════════════════════════════════════════════════════════════════════

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


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/album_faces.sql — Kho khuôn mặt đã quét — để lượt quét tự động chạy tiếp được (chạy SAU album_people)
-- ══════════════════════════════════════════════════════════════════════════

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

