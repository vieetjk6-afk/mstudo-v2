-- ─────────────────────────────────────────────────────────────────────────
-- Atomic redemption / trial claiming
--
-- Vá race condition trong các luồng đọc-rồi-ghi (read-modify-write) ở API:
--   • discount/redeem: "kiểm tra used_count < max_uses rồi +1" — hai request
--     đồng thời cùng đọc used_count cũ → vượt max_uses và mất lượt đếm.
--   • trial/start & redeem: "một lần dùng thử / tài khoản" chốt bằng
--     trial_used_at — hai request song song cùng thấy null → cấp 2 lần.
--   • affiliate/code: sinh mã ngẫu nhiên rồi select-kiểm-tra-trùng rồi insert —
--     không atomic; và lỗi insert bị nuốt → trả về mã chưa hề được lưu.
--
-- Cách vá: khoá hàng (SELECT … FOR UPDATE) để tuần tự hoá theo tài khoản/mã và
-- gộp toàn bộ kiểm tra + cập nhật vào MỘT transaction trong function. Các cột
-- gói (plan/limits) được truyền vào từ tầng ứng dụng để cấu hình gói vẫn nằm ở
-- JS (lib/plans.ts), function chỉ lo phần atomic.
-- ─────────────────────────────────────────────────────────────────────────

-- Đổi mã giảm giá dạng "dùng thử tức thì" (trial_days > 0). Trả về chuỗi trạng
-- thái: 'ok' | 'invalid' | 'expired' | 'used_up' | 'already_used'.
create or replace function public.redeem_discount_trial(
  p_code           text,
  p_user_id        uuid,
  p_expires        timestamptz,
  p_plan           text,
  p_album_limit    integer,
  p_can_zip        boolean,
  p_can_notes      boolean,
  p_can_galleries  boolean,
  p_watermark_pro  boolean
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.discount_codes;
begin
  -- Tuần tự hoá mọi lượt claim của CÙNG tài khoản (chốt "1 trial/account") và
  -- của CÙNG mã (chốt max_uses).
  perform 1 from public.profiles where id = p_user_id for update;
  select * into v_row from public.discount_codes where code = p_code for update;

  if not found or not v_row.active or coalesce(v_row.trial_days, 0) <= 0 then
    return 'invalid';
  end if;
  if v_row.expires_at is not null and v_row.expires_at < now() then
    return 'expired';
  end if;
  if v_row.max_uses is not null and coalesce(v_row.used_count, 0) >= v_row.max_uses then
    return 'used_up';
  end if;
  if exists (select 1 from public.profiles where id = p_user_id and trial_used_at is not null) then
    return 'already_used';
  end if;
  if exists (select 1 from public.discount_redemptions where code = p_code and user_id = p_user_id) then
    return 'already_used';
  end if;

  update public.profiles set
    plan               = p_plan,
    monthly_album_limit = p_album_limit,
    can_zip            = p_can_zip,
    can_notes          = p_can_notes,
    can_galleries      = p_can_galleries,
    can_watermark_pro  = p_watermark_pro,
    plan_cycle         = 'trial',
    plan_expires_at    = p_expires,
    trial_used_at      = now()
  where id = p_user_id;

  insert into public.discount_redemptions (code, user_id) values (p_code, p_user_id);
  update public.discount_codes set used_count = coalesce(used_count, 0) + 1 where code = p_code;
  return 'ok';
end;
$$;

-- Dùng thử miễn phí (không cần mã). Trả về 'ok' | 'already_used' | 'already_paid'.
create or replace function public.start_free_trial(
  p_user_id        uuid,
  p_expires        timestamptz,
  p_plan           text,
  p_album_limit    integer,
  p_can_zip        boolean,
  p_can_notes      boolean,
  p_can_galleries  boolean,
  p_watermark_pro  boolean
) returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  perform 1 from public.profiles where id = p_user_id for update;

  if exists (select 1 from public.profiles where id = p_user_id and trial_used_at is not null) then
    return 'already_used';
  end if;
  if exists (
    select 1 from public.profiles
    where id = p_user_id and plan <> 'free' and coalesce(plan_cycle, '') <> 'trial'
      and plan_expires_at is not null and plan_expires_at > now()
  ) then
    return 'already_paid';
  end if;

  update public.profiles set
    plan               = p_plan,
    monthly_album_limit = p_album_limit,
    can_zip            = p_can_zip,
    can_notes          = p_can_notes,
    can_galleries      = p_can_galleries,
    can_watermark_pro  = p_watermark_pro,
    plan_cycle         = 'trial',
    plan_expires_at    = p_expires,
    trial_used_at      = now()
  where id = p_user_id;

  insert into public.discount_redemptions (code, user_id)
  values ('TRIAL_' || upper(p_plan), p_user_id)
  on conflict (code, user_id) do nothing;
  return 'ok';
end;
$$;

-- Tăng used_count có điều kiện (dùng cho luồng nâng cấp trả phí có mã giảm giá).
-- Một câu UPDATE … WHERE … RETURNING là atomic: nếu vượt max_uses/ hết hạn/
-- tắt thì không có hàng nào được cập nhật → trả về false.
create or replace function public.consume_discount_code(p_code text)
returns boolean
language sql
security definer
set search_path = public
as $$
  with bumped as (
    update public.discount_codes
    set used_count = coalesce(used_count, 0) + 1
    where code = p_code
      and active
      and (max_uses is null or coalesce(used_count, 0) < max_uses)
      and (expires_at is null or expires_at > now())
    returning 1
  )
  select exists (select 1 from bumped);
$$;

-- Lấy hoặc tạo mã affiliate của một user, atomic. Trả về mã cuối cùng.
-- Chống cả hai race: hai request cùng user (unique khi tạo) và trùng mã ngẫu
-- nhiên giữa các user (retry khi vướng ràng buộc unique của code).
create or replace function public.get_or_create_affiliate_code(p_user_id uuid, p_prefix text)
returns table(code text, active boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code   text;
  v_active boolean;
  v_try    text;
  i        integer := 0;
begin
  -- Tuần tự hoá theo user để hai request đồng thời không tạo hai mã.
  perform 1 from public.profiles where id = p_user_id for update;

  select ac.code, ac.active into v_code, v_active
  from public.affiliate_codes ac where ac.user_id = p_user_id limit 1;
  if found then
    return query select v_code, v_active;
    return;
  end if;

  loop
    i := i + 1;
    -- Mã = tiền tố (tối đa 5 ký tự) + 4 ký tự ngẫu nhiên A-Z0-9.
    v_try := upper(left(regexp_replace(coalesce(p_prefix, 'USER'), '[^a-zA-Z0-9]', '', 'g'), 5))
             || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4));
    begin
      insert into public.affiliate_codes (user_id, code) values (p_user_id, v_try);
      return query select v_try, true;
      return;
    exception when unique_violation then
      -- Có thể là trùng mã (thử lại) hoặc user vừa được tạo bởi request song
      -- song khác — kiểm tra lại rồi trả về mã đã có.
      select ac.code, ac.active into v_code, v_active
      from public.affiliate_codes ac where ac.user_id = p_user_id limit 1;
      if found then
        return query select v_code, v_active;
        return;
      end if;
      if i >= 8 then
        raise exception 'could not allocate unique affiliate code';
      end if;
    end;
  end loop;
end;
$$;

-- ── Quyền gọi: CHỈ service-role ─────────────────────────────────────────────
-- Cả bốn hàm nhận `p_user_id` / mã từ người gọi và chạy với quyền chủ hàm, mà
-- Supabase mặc định cấp EXECUTE cho anon + authenticated → ai cầm anon key cũng
-- gọi thẳng được qua /rest/v1/rpc (kích hoạt dùng thử cho tài khoản người khác,
-- đốt lượt mã giảm giá…). App chỉ gọi chúng từ API route bằng service-role sau
-- khi đã tự kiểm đăng nhập. Xem thêm migrations/bao_mat_quyen_rpc_storage.sql.
revoke all on function public.redeem_discount_trial(text, uuid, timestamptz, text, integer, boolean, boolean, boolean, boolean) from public, anon, authenticated;
revoke all on function public.start_free_trial(uuid, timestamptz, text, integer, boolean, boolean, boolean, boolean) from public, anon, authenticated;
revoke all on function public.consume_discount_code(text) from public, anon, authenticated;
revoke all on function public.get_or_create_affiliate_code(uuid, text) from public, anon, authenticated;
grant execute on function public.redeem_discount_trial(text, uuid, timestamptz, text, integer, boolean, boolean, boolean, boolean) to service_role;
grant execute on function public.start_free_trial(uuid, timestamptz, text, integer, boolean, boolean, boolean, boolean) to service_role;
grant execute on function public.consume_discount_code(text) to service_role;
grant execute on function public.get_or_create_affiliate_code(uuid, text) to service_role;
