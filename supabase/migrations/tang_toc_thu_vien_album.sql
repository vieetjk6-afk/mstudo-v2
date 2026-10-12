-- ============================================================================
-- TĂNG TỐC THƯ VIỆN ALBUM (/dashboard/albums, /dashboard)
--
-- Vì sao chậm: thư viện đếm ảnh / lượt chọn / ảnh "không thích" bằng embed
-- `photos(count), selections(count), dislikes(count)` trên MỌI album, qua client
-- có RLS. Policy của ba bảng đó là `exists (select 1 from albums a where … and
-- (a.owner_id = auth.uid() or public.is_admin()))` — Postgres gọi auth.uid() và
-- is_admin() (một câu SELECT trên profiles) LẠI cho TỪNG DÒNG ảnh. Studio vài
-- trăm album × vài trăm ảnh là hàng chục nghìn lần gọi chỉ để ra mấy con số.
--
-- File này làm ba việc, KHÔNG đổi ai được thấy gì:
--   1. Chỉ mục cho đúng các câu thư viện chạy (sắp theo updated_at, ảnh bìa dự
--      phòng theo position, đếm album đã tạo trong tháng).
--   2. Hàm album_library_stats(p_owner): một lượt trả đủ số đếm + ảnh bìa dự
--      phòng cho mọi album của MỘT chủ. Quyền gọi giữ ĐÚNG như RLS hiện tại của
--      albums: chính chủ hoặc admin. Nhân viên studio KHÔNG đọc được album của
--      chủ qua RLS hôm nay, nên hàm này cũng không mở cửa đó.
--   3. Viết lại bốn policy albums / photos / selections / dislikes sang dạng
--      `(select auth.uid())` / `(select public.is_admin())`: Postgres tính MỘT
--      lần mỗi câu (initPlan) thay vì mỗi dòng. Ý nghĩa giữ nguyên từng chữ.
--
-- Chưa chạy file này thì app vẫn chạy như cũ (src/lib/album-rows.ts tự lùi về
-- đường embed). Chạy 1 lần trong Supabase SQL Editor. An toàn khi chạy lại.
-- ============================================================================

-- ── 1) Chỉ mục ──────────────────────────────────────────────────────────────
-- Ảnh bìa dự phòng = ảnh có position nhỏ nhất của album; cũng là thứ tự trang
-- khách đọc ảnh.
create index if not exists photos_album_position_idx on public.photos (album_id, position);
-- Danh sách album của một chủ, mới sửa lên đầu.
create index if not exists albums_owner_updated_idx on public.albums (owner_id, updated_at desc);
-- "Đã tạo N album tháng này" (PlanUsage) và trigger hạn mức enforce_album_quota.
create index if not exists album_creations_user_created_idx on public.album_creations (user_id, created_at);
-- Đã có từ schema nền / album_dislikes.sql — nhắc lại cho database dựng tay.
create index if not exists selections_album_idx on public.selections (album_id);
create index if not exists dislikes_album_idx on public.dislikes (album_id);

-- ── 2) album_library_stats ──────────────────────────────────────────────────
-- SECURITY DEFINER để bỏ qua RLS từng dòng — nên tự kiểm quyền ở đầu hàm, đúng
-- luật của policy albums_owner_all: owner_id = auth.uid() or is_admin().
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
    (select count(*) from public.photos p where p.album_id = a.id),
    (select count(*) from public.selections s where s.album_id = a.id),
    (select count(*) from public.dislikes d where d.album_id = a.id),
    -- Chỉ album CHƯA đặt cover_url mới cần ảnh bìa dự phòng.
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

-- ── 3) Policy dạng initPlan — CÙNG ý nghĩa với schema.sql / album_dislikes.sql ─
drop policy if exists albums_owner_all on public.albums;
create policy albums_owner_all on public.albums
  for all using (owner_id = (select auth.uid()) or (select public.is_admin()))
  with check (owner_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists photos_owner_all on public.photos;
create policy photos_owner_all on public.photos
  for all using (
    exists (select 1 from public.albums a
            where a.id = album_id and (a.owner_id = (select auth.uid()) or (select public.is_admin())))
  )
  with check (
    exists (select 1 from public.albums a
            where a.id = album_id and (a.owner_id = (select auth.uid()) or (select public.is_admin())))
  );

drop policy if exists selections_owner_rw on public.selections;
create policy selections_owner_rw on public.selections
  for all using (
    exists (select 1 from public.albums a
            where a.id = album_id and (a.owner_id = (select auth.uid()) or (select public.is_admin())))
  )
  with check (
    exists (select 1 from public.albums a
            where a.id = album_id and (a.owner_id = (select auth.uid()) or (select public.is_admin())))
  );

drop policy if exists dislikes_owner_rw on public.dislikes;
create policy dislikes_owner_rw on public.dislikes
  for all using (
    exists (select 1 from public.albums a
            where a.id = album_id and (a.owner_id = (select auth.uid()) or (select public.is_admin())))
  )
  with check (
    exists (select 1 from public.albums a
            where a.id = album_id and (a.owner_id = (select auth.uid()) or (select public.is_admin())))
  );
