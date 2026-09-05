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
create index if not exists album_people_album_idx on public.album_people (album_id, position);

-- Hai người cùng tên trong một album là lỗi nhập, không phải dữ liệu. Cũng chặn
-- luôn cú lưu lặp khi studio bấm hai lần. Tên rỗng thì không tính (nhiều cụm
-- chưa đặt tên là chuyện thường).
create unique index if not exists album_people_name_uk
  on public.album_people (album_id, lower(name)) where name <> '';

-- ── Ảnh nào có ai ───────────────────────────────────────────────────────────
create table if not exists public.album_photo_people (
  -- album_id là bản sao CÓ CHỦ Ý của album_people.album_id: câu truy vấn duy
  -- nhất mà khách chạy là "lấy hết theo album", không cần join.
  album_id  uuid not null references public.albums (id) on delete cascade,
  person_id uuid not null references public.album_people (id) on delete cascade,
  photo_id  uuid not null references public.photos (id) on delete cascade,
  primary key (person_id, photo_id)
);
create index if not exists album_photo_people_album_idx on public.album_photo_people (album_id);

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
