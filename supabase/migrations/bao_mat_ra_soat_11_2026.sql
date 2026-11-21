-- ─────────────────────────────────────────────────────────────────────────
-- Rà soát bảo mật 11/2026 — ba lỗ RLS (chạy SAU crew_timesheet, crew_schedule)
--
-- 1) crew_available / crew_shift_plan: thôi cho MỌI tài khoản đọc toàn bảng.
--    Policy cũ `auth.role() = 'authenticated'` = ai đăng ký một tài khoản
--    miễn phí cũng gọi thẳng REST lấy được SĐT mọi thợ kèm owner_id studio
--    — đúng lỗi đã vá cho crew_unavailable (crew_unavailable_rls_rieng_tu.sql)
--    mà hai bảng anh em này bị sót. Mọi chỗ đọc từ trình duyệt đã tự lọc:
--      • StudioTab.tsx: crew_available .eq("owner_id", profile.id)
--      • TeamTab.tsx:   crew_shift_plan .in("phone", <SĐT thợ trong sổ studio>)
--    Đọc liên studio (cổng thợ) đi service role, không chịu RLS.
--
-- 2) sites.subdomain / custom_domain / custom_domain_verified: chỉ ghi được
--    qua route máy chủ (service role). RLS sites_owner_all cho chủ site sửa MỌI
--    cột, nên PATCH thẳng REST là vượt được danh sách tên dành riêng
--    (login., billing.…) và tự đặt custom_domain_verified = true, bỏ qua cả
--    kiểm tra gói. /api/site/subdomain và /api/site/domain đã chuyển sang ghi
--    bằng service role nên không bị trigger này chặn.
-- ─────────────────────────────────────────────────────────────────────────

drop policy if exists crew_available_read on public.crew_available;
create policy crew_available_read on public.crew_available
  for select using (owner_id = auth.uid() or public.is_admin());

-- crew_shift_plan không có owner_id: studio (kể cả nhân viên của studio) đọc
-- được ca của những SĐT có trong sổ thợ của mình.
drop policy if exists crew_shift_plan_read on public.crew_shift_plan;
create policy crew_shift_plan_read on public.crew_shift_plan
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.studio_crew sc
      where sc.phone = crew_shift_plan.phone
        and public.is_studio_member(sc.owner_id)
    )
  );

create or replace function public.sites_guard_domain()
returns trigger
language plpgsql
as $$
begin
  -- Chỉ chặn lượt gọi từ trình duyệt (JWT người dùng / anon). Service role
  -- (route máy chủ) và chạy SQL trực tiếp không có role này nên đi qua.
  -- coalesce: is_admin() là NULL khi không có phiên — `not NULL` làm if bỏ qua.
  if coalesce(auth.role(), '') in ('authenticated', 'anon') and not coalesce(public.is_admin(), false) then
    if tg_op = 'INSERT' then
      new.subdomain := null;
      new.custom_domain := null;
      new.custom_domain_verified := false;
    else
      new.subdomain := old.subdomain;
      new.custom_domain := old.custom_domain;
      new.custom_domain_verified := old.custom_domain_verified;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists sites_guard_domain on public.sites;
create trigger sites_guard_domain
  before insert or update on public.sites
  for each row execute function public.sites_guard_domain();

-- ── Kiểm tra sau khi chạy ───────────────────────────────────────────────────
-- select policyname, qual from pg_policies
--  where tablename in ('crew_available', 'crew_shift_plan');
-- select tgname from pg_trigger where tgname = 'sites_guard_domain';
