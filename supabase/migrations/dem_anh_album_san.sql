-- ============================================================================
-- SỐ ẢNH CỦA TỪNG ALBUM ĐẾM SẴN (thư viện album /dashboard/albums)
--
-- Vì sao: album_library_stats (tang_toc_thu_vien_album.sql) đếm lại TOÀN BỘ
-- bảng photos của studio mỗi lần mở thư viện. Đo thật trên production: 83 album
-- · ~143.000 ảnh → 83 lượt count(*) × ~19ms = ~1,6s, chiếm gần hết thời gian
-- dựng trang (EXPLAIN ANALYZE: Execution Time 1762ms, SubPlan đếm photos 1,6s).
-- Càng thêm ảnh càng chậm.
--
-- Cách làm: bảng album_photo_counts giữ sẵn số ảnh của từng album, trigger
-- CẤP CÂU LỆNH trên photos cộng/trừ theo transition table — một lượt đồng bộ
-- Drive chèn 2.000 ảnh chỉ cập nhật MỘT dòng đếm cho mỗi album, không phải
-- 2.000 lần. Số đếm KHÔNG ghi vào albums: albums có trigger updated_at, mà thư
-- viện sắp theo updated_at → album sẽ nhảy thứ tự mỗi lần thêm ảnh.
--
-- album_library_stats giữ NGUYÊN chữ ký và quyền: app không cần đổi gì. Album
-- chưa có dòng đếm thì hàm lùi về count(*) như cũ, nên kết quả luôn đúng kể cả
-- khi bảng đếm trống.
--
-- Chạy 1 lần trong Supabase SQL Editor. An toàn khi chạy lại (mỗi lần chạy nạp
-- lại số đếm từ đầu).
--
-- Lệch số (ví dụ sau khi chép dữ liệu với trigger bị tắt — xem
-- clone-from-old-project.sql) thì chạy lại file này, hoặc riêng câu nạp ở mục 4.
-- ============================================================================

-- ── 1) Bảng đếm ─────────────────────────────────────────────────────────────
create table if not exists public.album_photo_counts (
  album_id    uuid primary key references public.albums (id) on delete cascade,
  photo_count bigint not null default 0
);
-- Không policy nào: chỉ hàm SECURITY DEFINER bên dưới đọc/ghi bảng này.
alter table public.album_photo_counts enable row level security;
revoke all on table public.album_photo_counts from public, anon, authenticated;

-- ── 2) Trigger cấp câu lệnh trên photos ─────────────────────────────────────
create or replace function public.album_photo_counts_ins()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.album_photo_counts as c (album_id, photo_count)
  select n.album_id, count(*) from new_rows n group by n.album_id
  on conflict (album_id) do update set photo_count = c.photo_count + excluded.photo_count;
  return null;
end;
$$;

create or replace function public.album_photo_counts_del()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Album bị xoá kéo photos theo (on delete cascade): dòng đếm cũng đã/đang bị
  -- xoá theo albums, update không khớp dòng nào — vô hại.
  update public.album_photo_counts c
     set photo_count = greatest(c.photo_count - d.n, 0)
    from (select o.album_id, count(*) as n from old_rows o group by o.album_id) d
   where c.album_id = d.album_id;
  return null;
end;
$$;

-- Ảnh chuyển sang album khác (hiếm). Cấp DÒNG vì Postgres không cho transition
-- table đi cùng danh sách cột `update of album_id`.
create or replace function public.album_photo_counts_move()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.album_photo_counts
     set photo_count = greatest(photo_count - 1, 0)
   where album_id = old.album_id;
  insert into public.album_photo_counts as c (album_id, photo_count)
  values (new.album_id, 1)
  on conflict (album_id) do update set photo_count = c.photo_count + 1;
  return null;
end;
$$;

revoke all on function public.album_photo_counts_ins() from public, anon, authenticated;
revoke all on function public.album_photo_counts_del() from public, anon, authenticated;
revoke all on function public.album_photo_counts_move() from public, anon, authenticated;

drop trigger if exists photos_count_ins on public.photos;
create trigger photos_count_ins
  after insert on public.photos
  referencing new table as new_rows
  for each statement execute function public.album_photo_counts_ins();

drop trigger if exists photos_count_del on public.photos;
create trigger photos_count_del
  after delete on public.photos
  referencing old table as old_rows
  for each statement execute function public.album_photo_counts_del();

drop trigger if exists photos_count_move on public.photos;
create trigger photos_count_move
  after update of album_id on public.photos
  for each row
  when (old.album_id is distinct from new.album_id)
  execute function public.album_photo_counts_move();

-- ── 3) album_library_stats đọc số đếm sẵn ───────────────────────────────────
-- Giống hệt bản trong tang_toc_thu_vien_album.sql, chỉ khác cột photo_count.
create or replace function public.album_library_stats(p_owner uuid)
returns table (
  album_id            uuid,
  photo_count         bigint,
  pick_count          bigint,
  dislike_count       bigint,
  first_drive_file_id text
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and not (p_owner = auth.uid() or public.is_admin()) then
    raise exception 'không có quyền xem thư viện album này' using errcode = '42501';
  end if;

  return query
  select
    a.id,
    -- Chưa có dòng đếm (album chưa từng có ảnh, hoặc bảng đếm vừa tạo) → đếm
    -- thẳng như cũ; album rỗng thì lượt đếm này gần như không tốn gì.
    coalesce(
      (select c.photo_count from public.album_photo_counts c where c.album_id = a.id),
      (select count(*) from public.photos p where p.album_id = a.id)
    ),
    (select count(*) from public.selections s where s.album_id = a.id),
    (select count(*) from public.dislikes d where d.album_id = a.id),
    case when a.cover_url is null then
      (select p.drive_file_id from public.photos p
        where p.album_id = a.id
        order by p.position
        limit 1)
    end
  from public.albums a
  where a.owner_id = p_owner;
end;
$$;

revoke all on function public.album_library_stats(uuid) from public, anon;
grant execute on function public.album_library_stats(uuid) to authenticated, service_role;

-- ── 4) Nạp số đếm từ dữ liệu hiện có ────────────────────────────────────────
-- Khoá photos trước (chặn ghi, vẫn cho đọc) để không lượt chèn ảnh nào lọt vào
-- giữa lúc đếm và lúc trigger có hiệu lực. Giữ tới hết transaction của SQL
-- Editor — vài giây với ~150.000 ảnh.
lock table public.photos in share row exclusive mode;

insert into public.album_photo_counts (album_id, photo_count)
select p.album_id, count(*) from public.photos p group by p.album_id
on conflict (album_id) do update set photo_count = excluded.photo_count;

-- Album từng có ảnh nhưng nay rỗng: câu trên không chạm tới → đưa về 0.
update public.album_photo_counts c
   set photo_count = 0
 where c.photo_count <> 0
   and not exists (select 1 from public.photos p where p.album_id = c.album_id);
