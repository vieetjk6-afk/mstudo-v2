-- ============================================================================
-- LƯU LỰA CHỌN ẢNH CỦA KHÁCH THEO PHẦN CHÊNH (POST /api/a/[slug]/select)
--
-- Vì sao: trang khách gửi lại TOÀN BỘ danh sách chọn mỗi ~250 ms khi khách bấm.
-- Bản cũ xoá sạch selections / dislikes của phiên rồi chèn lại hết:
--   • n lượt ghi cho mỗi lần bấm → O(n²) cả buổi chọn;
--   • xoá và chèn là hai lượt gọi rời — chèn hỏng là MẤT lựa chọn của khách;
--   • ~2n sự kiện Realtime mỗi lần lưu dội vào màn SelectionsView của studio;
--   • kiểm ảnh bằng `.in("id", …)` hàng nghìn UUID trên URL — gãy từ ~300 ảnh.
--
-- Hàm save_album_selection làm trọn trong MỘT transaction, mảng đi trong thân
-- POST (không qua URL):
--   1. Chỉ giữ ảnh THẬT SỰ thuộc album (join với photos theo album_id).
--   2. Xoá đúng những ảnh khách đã bỏ.
--   3. Upsert theo unique (album_id, photo_id, session_id) — dòng không đổi gì
--      thì KHÔNG bị ghi lại, nên không sinh sự kiện Realtime.
-- Như vậy mỗi lần bấm chỉ ghi đúng một hai dòng thay đổi.
--
-- Chỉ service_role gọi được (route dùng admin client, đã kiểm mật khẩu album).
-- Chưa chạy file này thì route tự lùi về đường cũ (đã sửa để ghi theo phần chênh).
-- Chạy 1 lần trong Supabase SQL Editor. An toàn khi chạy lại.
-- ============================================================================

-- Đã có từ schema nền / album_dislikes.sql — nhắc lại cho database dựng tay.
create index if not exists selections_session_idx on public.selections (album_id, session_id);
create index if not exists dislikes_session_idx on public.dislikes (album_id, session_id);

create or replace function public.save_album_selection(
  p_album_id     uuid,
  p_session_id   text,
  p_client_name  text,
  p_photo_ids    uuid[],
  p_notes        jsonb default '{}'::jsonb,
  -- null = client cũ không gửi danh sách "không thích" → không đụng bảng dislikes.
  p_disliked_ids uuid[] default null
)
returns table (pick_count integer, dislike_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_notes jsonb := coalesce(p_notes, '{}'::jsonb);
  v_want  uuid[];
  v_dis   uuid[];
begin
  -- Hai lượt lưu của cùng một phiên chạy lần lượt, không xen nhau.
  perform pg_advisory_xact_lock(hashtextextended(p_album_id::text || ':' || p_session_id, 0));

  -- ── Ảnh chọn ──────────────────────────────────────────────────────────────
  -- Chỉ giữ ảnh thuộc ĐÚNG album này; id lạ / của album khác bị bỏ qua.
  v_want := array(
    select distinct p.id
    from unnest(coalesce(p_photo_ids, '{}'::uuid[])) as u(id)
    join public.photos p on p.id = u.id and p.album_id = p_album_id
  );

  delete from public.selections s
  where s.album_id = p_album_id
    and s.session_id = p_session_id
    and not exists (select 1 from unnest(v_want) as w(id) where w.id = s.photo_id);

  insert into public.selections as s
    (album_id, photo_id, photo_name, session_id, client_name, client_note)
  select p_album_id, p.id, coalesce(p.name, ''), p_session_id,
         nullif(p_client_name, ''), nullif(v_notes ->> p.id::text, '')
  from public.photos p
  where p.album_id = p_album_id and p.id = any (v_want)
  on conflict (album_id, photo_id, session_id) do update
    set photo_name  = excluded.photo_name,
        client_name = excluded.client_name,
        client_note = excluded.client_note
    -- Dòng không đổi gì thì không ghi lại → không có sự kiện Realtime thừa.
    where (s.photo_name, s.client_name, s.client_note)
          is distinct from (excluded.photo_name, excluded.client_name, excluded.client_note);

  -- ── Ảnh không thích ───────────────────────────────────────────────────────
  if p_disliked_ids is not null then
    v_dis := array(
      select distinct p.id
      from unnest(p_disliked_ids) as u(id)
      join public.photos p on p.id = u.id and p.album_id = p_album_id
    );

    delete from public.dislikes d
    where d.album_id = p_album_id
      and d.session_id = p_session_id
      and not exists (select 1 from unnest(v_dis) as w(id) where w.id = d.photo_id);

    insert into public.dislikes as d
      (album_id, photo_id, photo_name, session_id, client_note)
    select p_album_id, p.id, coalesce(p.name, ''), p_session_id,
           nullif(v_notes ->> p.id::text, '')
    from public.photos p
    where p.album_id = p_album_id and p.id = any (v_dis)
    on conflict (album_id, photo_id, session_id) do update
      set photo_name  = excluded.photo_name,
          client_note = excluded.client_note
      where (d.photo_name, d.client_note)
            is distinct from (excluded.photo_name, excluded.client_note);
  end if;

  return query select cardinality(v_want), coalesce(cardinality(v_dis), 0);
end;
$$;

revoke all on function public.save_album_selection(uuid, text, text, uuid[], jsonb, uuid[]) from public, anon, authenticated;
grant execute on function public.save_album_selection(uuid, text, text, uuid[], jsonb, uuid[]) to service_role;
