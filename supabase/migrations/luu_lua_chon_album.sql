-- ============================================================================
-- LƯU LỰA CHỌN CỦA KHÁCH THEO KIỂU "CHÊNH LỆCH", TRONG MỘT TRANSACTION
--
-- Vì sao cần: POST /api/a/[slug]/select trước đây XOÁ SẠCH lựa chọn của phiên
-- rồi CHÈN LẠI toàn bộ — mỗi lần khách bấm (client gửi sau ~250ms). Khách chọn
-- 500 ảnh là mỗi cú bấm ghi lại 500 dòng (O(n²) tổng cộng), bắn ~1000 sự kiện
-- Realtime sang dashboard studio, và KHÔNG nguyên tử: xoá xong mà chèn hỏng là
-- khách mất sạch lựa chọn. Thêm nữa, xoá-chèn lại làm mất `photographer_note`
-- studio đã ghi trên từng ảnh khách chọn.
--
-- Hàm này làm trong MỘT transaction:
--   • bỏ qua mã ảnh không thuộc album (khỏi phải gửi hàng nghìn UUID qua URL
--     PostgREST bằng `.in()` — URL đó gãy khi quá ~300 ảnh);
--   • chèn dòng còn thiếu (on conflict do nothing theo unique sẵn có
--     (album_id, photo_id, session_id));
--   • cập nhật dòng đã có CHỈ KHI tên ảnh / tên khách / ghi chú đổi;
--   • xoá dòng khách đã bỏ.
-- `p_dislike_ids` null = client cũ không gửi danh sách "không thích" → KHÔNG
-- đụng bảng dislikes (giữ đúng luật của route).
--
-- Chỉ máy chủ (service_role) được gọi: route đã kiểm album công khai, mật khẩu,
-- hạn mức trước khi gọi. Chưa chạy file này thì route tự lùi về đường cũ.
-- Chạy 1 lần trong Supabase SQL Editor. An toàn khi chạy lại.
-- ============================================================================

create or replace function public.save_album_selection(
  p_album       uuid,
  p_session     text,
  p_photo_ids   uuid[],
  p_dislike_ids uuid[] default null,
  p_client_name text default null,
  p_notes       jsonb default '{}'::jsonb
)
returns table (selected integer, disliked integer)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_notes   jsonb := coalesce(p_notes, '{}'::jsonb);
  v_name    text  := nullif(p_client_name, '');
  v_sel_ids uuid[];
  v_dis_ids uuid[];
  v_sel     integer := 0;
  v_dis     integer := 0;
begin
  if p_album is null or coalesce(p_session, '') = '' then
    raise exception 'thiếu album hoặc phiên' using errcode = '22023';
  end if;

  -- Hai lượt lưu của CÙNG phiên chạy chồng nhau (tab cũ + tab mới, mạng chập
  -- chờn gửi lại) thì xếp hàng — không để hai bản chênh lệch đan xen.
  perform pg_advisory_xact_lock(hashtextextended(p_album::text || ':' || p_session, 0));

  -- Ảnh khách chọn, đã lọc: chỉ ảnh thuộc album, bỏ trùng, và trừ ảnh nằm trong
  -- "không thích" (cùng luật excludeDisliked phía route). Giữ trong biến mảng,
  -- KHÔNG dùng bảng tạm: mỗi lần tạo bảng tạm là ghi vào catalog, mà hàm này
  -- chạy sau mỗi cú bấm của khách.
  v_sel_ids := array(
    select p.id from public.photos p
    where p.album_id = p_album
      and p.id = any(coalesce(p_photo_ids, '{}'::uuid[]))
      and not (p.id = any(coalesce(p_dislike_ids, '{}'::uuid[])))
  );
  v_sel := cardinality(v_sel_ids);

  delete from public.selections s
  where s.album_id = p_album and s.session_id = p_session
    and not (s.photo_id = any(v_sel_ids));

  -- Chỉ cập nhật dòng thật sự đổi → không bắn sự kiện Realtime thừa, và không
  -- đụng photographer_note của studio.
  update public.selections s
     set photo_name  = coalesce(p.name, ''),
         client_name = v_name,
         client_note = nullif(v_notes ->> p.id::text, '')
    from public.photos p
   where p.id = any(v_sel_ids) and p.album_id = p_album
     and s.album_id = p_album and s.session_id = p_session and s.photo_id = p.id
     and (s.photo_name, s.client_name, s.client_note)
         is distinct from (coalesce(p.name, ''), v_name, nullif(v_notes ->> p.id::text, ''));

  insert into public.selections (album_id, photo_id, photo_name, session_id, client_name, client_note)
  select p_album, p.id, coalesce(p.name, ''), p_session, v_name, nullif(v_notes ->> p.id::text, '')
  from public.photos p
  where p.id = any(v_sel_ids) and p.album_id = p_album
  on conflict (album_id, photo_id, session_id) do nothing;

  if p_dislike_ids is not null then
    v_dis_ids := array(
      select p.id from public.photos p
      where p.album_id = p_album and p.id = any(p_dislike_ids)
    );
    v_dis := cardinality(v_dis_ids);

    delete from public.dislikes d
    where d.album_id = p_album and d.session_id = p_session
      and not (d.photo_id = any(v_dis_ids));

    update public.dislikes d
       set photo_name  = coalesce(p.name, ''),
           client_note = nullif(v_notes ->> p.id::text, '')
      from public.photos p
     where p.id = any(v_dis_ids) and p.album_id = p_album
       and d.album_id = p_album and d.session_id = p_session and d.photo_id = p.id
       and (d.photo_name, d.client_note)
           is distinct from (coalesce(p.name, ''), nullif(v_notes ->> p.id::text, ''));

    insert into public.dislikes (album_id, photo_id, photo_name, session_id, client_note)
    select p_album, p.id, coalesce(p.name, ''), p_session, nullif(v_notes ->> p.id::text, '')
    from public.photos p
    where p.id = any(v_dis_ids) and p.album_id = p_album
    on conflict (album_id, photo_id, session_id) do nothing;
  end if;

  return query select v_sel, v_dis;
end;
$$;

-- Supabase mặc định cấp execute cho anon/authenticated trên hàm mới trong
-- public — hàm này bỏ qua RLS nên phải thu lại, chỉ để máy chủ gọi.
revoke all on function public.save_album_selection(uuid, text, uuid[], uuid[], text, jsonb) from public, anon, authenticated;
grant execute on function public.save_album_selection(uuid, text, uuid[], uuid[], text, jsonb) to service_role;
