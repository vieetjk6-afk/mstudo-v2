-- ════════════════════════════════════════════════════════════════════════════
-- DÙNG THỬ & HẾT HẠN GÓI
--
-- Hai lỗi, cùng một gốc: gói của tài khoản chỉ được "nhìn" lúc người dùng mở
-- /dashboard.
--
--  1) Tài khoản ĐÃ MUA gói vẫn bấm được "Dùng thử". start_free_trial chỉ chặn
--     khi gói trả phí CÒN HẠN — gói đã hết hạn (và bị layout hạ về free, xoá
--     luôn plan_cycle) thì không còn dấu vết nào cho biết họ từng trả tiền.
--     → Cột mới `paid_plan_at`: mốc LẦN ĐẦU tài khoản được gán gói tháng/năm.
--       Một trigger tự ghi nó ở MỌI lối nâng gói (admin gán, xác nhận chuyển
--       khoản, mã giảm giá 100%) nên không lối nào quên được. Cả hai hàm dùng
--       thử (start_free_trial, redeem_discount_trial) đều trả 'already_paid'.
--
--  2) Dùng thử hết hạn mà KHÔNG bị hạ gói. Việc hạ gói chỉ chạy trong
--     dashboard/layout.tsx — người không mở dashboard (chỉ dùng app desktop,
--     chỉ để khách xem album…) giữ nguyên plan + các cột quyền cũ
--     (monthly_album_limit, can_zip, can_notes, can_galleries) mãi mãi, và
--     trigger enforce_album_quota / trang album khách đọc thẳng các cột đó.
--     → Hàm downgrade_expired_plans() hạ MỌI gói đã hết hạn, gọi bằng cron
--       hằng ngày (/api/cron/plan-expiry).
--     → enforce_album_quota tự coi gói hết hạn là free, kể cả trước khi cron
--       kịp chạy.
--
-- Chạy lại nhiều lần an toàn.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1) Dấu "đã từng mua gói" ────────────────────────────────────────────────
alter table public.profiles add column if not exists paid_plan_at timestamptz; -- null = chưa từng mua gói

-- Cột nhạy cảm: không cấp quyền UPDATE cho client (c1_profiles_column_grants.sql
-- dùng danh sách trắng theo cột, nên cột mới mặc định đã bị khoá — nhắc lại cho
-- chắc nếu database từng được cấp update cả bảng).
revoke update (paid_plan_at) on public.profiles from authenticated, anon;

-- Điền cho dữ liệu cũ: đang ở gói tháng/năm, hoặc có yêu cầu nâng cấp đã nhận tiền.
update public.profiles
   set paid_plan_at = now()
 where paid_plan_at is null
   and plan_cycle in ('month', 'year');

do $$
begin
  if to_regclass('public.upgrade_requests') is not null
     and exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'upgrade_requests'
                   and column_name = 'payment_status') then
    execute $q$
      update public.profiles p
         set paid_plan_at = coalesce(r.first_paid, now())
        from (select user_id, min(coalesce(reviewed_at, created_at)) as first_paid
                from public.upgrade_requests
               where payment_status = 'paid'
               group by user_id) r
       where r.user_id = p.id and p.paid_plan_at is null
    $q$;
  end if;
end $$;

create or replace function public.mark_paid_plan()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.plan_cycle in ('month', 'year') and new.plan is distinct from 'free'
     and new.paid_plan_at is null then
    new.paid_plan_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_mark_paid_plan on public.profiles;
create trigger profiles_mark_paid_plan
  before insert or update of plan, plan_cycle on public.profiles
  for each row execute function public.mark_paid_plan();

-- ── 2) Dùng thử: chặn tài khoản đã mua gói ─────────────────────────────────
-- Trả về 'ok' | 'already_used' | 'already_paid'.
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
  -- Đã từng mua gói (còn hạn hay hết hạn đều vậy) → không dùng thử nữa.
  if exists (
    select 1 from public.profiles
    where id = p_user_id
      and (paid_plan_at is not null or plan_cycle in ('month', 'year'))
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

-- Mã giảm giá dạng "dùng thử tức thì". Trả về
-- 'ok' | 'invalid' | 'expired' | 'used_up' | 'already_used' | 'already_paid'.
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
  if exists (
    select 1 from public.profiles
    where id = p_user_id
      and (paid_plan_at is not null or plan_cycle in ('month', 'year'))
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

  insert into public.discount_redemptions (code, user_id) values (p_code, p_user_id);
  update public.discount_codes set used_count = coalesce(used_count, 0) + 1 where code = p_code;
  return 'ok';
end;
$$;

-- ── 3) Hạ MỌI gói đã hết hạn về free ───────────────────────────────────────
-- Cột quyền cũ lấy đúng giá trị của gói free trong src/lib/plans.ts
-- (PLAN_LIMITS.free). Dùng thử hết hạn được đánh dấu plan_cycle =
-- 'trial_expired' để dashboard còn hiện được băng "dùng thử đã kết thúc" một
-- lần (layout xoá dấu đó sau khi hiện). Trả về số tài khoản đã hạ.
create or replace function public.downgrade_expired_plans()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  update public.profiles set
    plan                = 'free',
    monthly_album_limit = 5,
    can_zip             = false,
    can_notes           = false,
    can_galleries       = false,
    can_watermark_pro   = false,
    plan_cycle          = case when plan_cycle = 'trial' then 'trial_expired' else null end,
    plan_expires_at     = null
  where coalesce(role, '') <> 'admin'
    and coalesce(plan, 'free') <> 'free'
    and plan_expires_at is not null
    and plan_expires_at < now();
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.downgrade_expired_plans() from public, anon, authenticated;
grant execute on function public.downgrade_expired_plans() to service_role;

-- ── 4) Hạn mức album: gói hết hạn = free, kể cả trước khi cron chạy ─────────
-- Giữ nguyên mọi luật của bản trong han_muc_album_may_chu.sql, chỉ thêm nhánh
-- "đã hết hạn".
create or replace function public.enforce_album_quota()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  lim     integer;
  isadm   boolean;
  cangal  boolean;
  expired boolean;
  used    integer;
begin
  -- Album do máy chủ tạo (service-role) — quyền đã chốt ở tầng ứng dụng.
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  select monthly_album_limit, (role = 'admin'), can_galleries,
         (coalesce(plan, 'free') <> 'free' and plan_expires_at is not null and plan_expires_at < now())
    into lim, isadm, cangal, expired
    from public.profiles where id = new.owner_id;

  -- Gói đã hết hạn mà chưa kịp hạ → dùng hạn mức gói free.
  if coalesce(expired, false) and not coalesce(isadm, false) then
    lim := 5;
    cangal := false;
  end if;

  if coalesce(new.is_gallery, false) then
    -- Only admins / permitted accounts may create delivery galleries.
    if not (coalesce(isadm, false) or coalesce(cangal, false)) then
      raise exception 'Tài khoản chưa được cấp quyền tạo gallery khách.'
        using errcode = 'P0001';
    end if;
    return new; -- galleries don't use the selection quota
  end if;
  if coalesce(isadm, false) then return new; end if;
  if lim is null then return new; end if;

  select count(*) into used
    from public.album_creations
    where user_id = new.owner_id
      and created_at >= date_trunc('month', now());

  if used >= lim then
    raise exception 'Đã đạt giới hạn % album trong tháng này.', lim
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- Hạ ngay những tài khoản đã quá hạn từ trước.
select public.downgrade_expired_plans();
