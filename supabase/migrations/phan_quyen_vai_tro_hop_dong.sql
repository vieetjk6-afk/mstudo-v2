-- ============================================================================
-- PHÂN QUYỀN THEO VAI TRÒ CHO HỢP ĐỒNG — ĐƯA LUẬT CỦA API XUỐNG DATABASE
--
-- VẤN ĐỀ
--   Vai trò (manager / branch_manager / staff / accountant) và chi nhánh chỉ
--   được kiểm trong route API và trang server. Policy RLS của cả họ hợp đồng thì
--   chỉ hỏi `public.is_studio_member(owner_id)` — "có phải người của studio này
--   không" — nên MỌI thành viên làm được MỌI thứ trên dữ liệu studio.
--
--   Trình duyệt có anon key + JWT của người dùng, nên gọi thẳng PostgREST là
--   lách được hết các chốt ở API:
--     • nhân viên / kế toán / quản lý chi nhánh đọc được mọi hợp đồng, mọi khoản thu;
--     • đặt status = 'cancelled' (huỷ / hoàn tiền là việc riêng của chủ studio —
--       xem src/app/api/studio/contracts/[id]/cancel/route.ts);
--     • chèn khoản thu vào bất kỳ hợp đồng nào;
--     • quản lý chi nhánh đọc / ghi hợp đồng của cơ sở khác.
--   Và is_studio_member không nhìn profiles.is_active: tài khoản đã bị khoá vẫn
--   giữ nguyên quyền với database.
--
-- LUẬT (khớp src/lib/studio-roles.ts + các trang / route đang chạy)
--
--   vai trò          đọc hợp đồng                     ghi hợp đồng & bảng con
--   ───────────────  ───────────────────────────────  ─────────────────────────────
--   chủ / admin      toàn studio                      toàn studio (cả huỷ, hoàn tiền)
--   manager          toàn studio                      toàn studio, TRỪ huỷ / hoàn tiền
--   branch_manager   branch_id = chi nhánh của mình   như cột đọc, TRỪ huỷ / hoàn tiền
--   staff            assigned_to = mình (+ hợp đồng   assigned_to = mình, TRỪ huỷ /
--                    có hạng mục hậu kỳ giao cho mình) hoàn tiền
--   accountant       toàn studio (màn Thu chi cần)    KHÔNG — chỉ đánh dấu đã trả lương
--                                                      (contract_crew.paid / paid_at)
--
--   Quản lý chi nhánh CHƯA được gán chi nhánh thì không thấy hợp đồng nào
--   (fail-closed, cùng tinh thần forcedBranchScope).
--
-- HIỆU NĂNG
--   Mọi điều kiện về "người đang gọi" đi qua hàm `stable security definer` bọc
--   trong `(select …)`: Postgres tính MỘT lần mỗi câu lệnh (initPlan) chứ không
--   gọi lại cho từng dòng — cùng cách tang_toc_thu_vien_album.sql đã làm.
--
-- VÌ SAO VIẾT TỪNG POLICY RA, KHÔNG DÙNG KHỐI do $$ … $$
--   build-setup-all.mjs xếp khối do $$ vào PHẦN 2, còn `create policy` vào PHẦN 3.
--   Khối do $$ của rls_thanh_vien_hop_dong.sql vì thế bị chính các policy
--   chỉ-chủ-studio của schema.sql ở PHẦN 3 ghi đè trên project mới. Câu lệnh
--   trần thì nằm đúng PHẦN 3, và file này đứng CUỐI ORDER nên thắng.
--
-- Chạy SAU mọi migration tạo bảng hợp đồng (contract_cancel_reschedule,
-- contract_addenda, studio_vouchers…). An toàn khi chạy lại.
-- ============================================================================


-- ── 1) Thành viên studio phải còn ĐANG HOẠT ĐỘNG ─────────────────────────────
-- Người gọi bị khoá → hết quyền. Nhân viên mà CHỦ studio bị khoá → cũng hết
-- (requireStudio đã từ chối cả hai trường hợp; database giờ nói cùng một câu).
create or replace function public.is_studio_member(target uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select
    exists (
      select 1 from public.profiles me
      where me.id = auth.uid()
        and me.is_active
        and (
          target = me.id
          or (me.studio_owner_id = target
              and exists (select 1 from public.profiles o where o.id = target and o.is_active))
        )
    )
    or public.is_admin();
$$;


-- ── 2) Hàm "người đang gọi là ai" — dùng dạng (select …) trong policy ────────

-- Trả id CHỦ studio mà người gọi được hành động với một năng lực `cap`, hoặc
-- NULL nếu không có năng lực đó (NULL so sánh với owner_id luôn ra false).
--   'member'     mọi thành viên đang hoạt động (kể cả chủ)
--   'owner'      chính chủ studio (không phải nhân viên)
--   'all_read'   đọc toàn studio: chủ, manager, accountant
--   'all_write'  ghi toàn studio: chủ, manager
--   'branch'     branch_manager — phải so thêm branch_id với studio_my_branch()
--   'assigned'   staff — phải so thêm assigned_to với auth.uid()
--   'accountant' kế toán
-- Vai trò lạ / để trống được coi là 'staff' — đúng như requireStudio
-- (`me.studio_role || "staff"`), và là mức hẹp nhất.
create or replace function public.studio_scope_owner(cap text)
returns uuid language sql stable security definer set search_path = public as $$
  select case
           when cap = 'member'
             or (cap = 'owner'      and m.role = 'owner')
             or (cap = 'all_read'   and m.role in ('owner', 'manager', 'accountant'))
             or (cap = 'all_write'  and m.role in ('owner', 'manager'))
             or (cap = 'branch'     and m.role = 'branch_manager')
             or (cap = 'assigned'   and m.role = 'staff')
             or (cap = 'accountant' and m.role = 'accountant')
           then m.owner_id
         end
  from (
    select coalesce(me.studio_owner_id, me.id) as owner_id,
           case
             when me.studio_owner_id is null then 'owner'
             when me.studio_role in ('manager', 'branch_manager', 'accountant') then me.studio_role
             else 'staff'
           end as role
    from public.profiles me
    where me.id = auth.uid()
      and me.is_active
      and (me.studio_owner_id is null
           or exists (select 1 from public.profiles o where o.id = me.studio_owner_id and o.is_active))
  ) m;
$$;

-- Chi nhánh của chính người đang đăng nhập (chỉ có nghĩa với branch_manager).
create or replace function public.studio_my_branch()
returns uuid language sql stable security definer set search_path = public as $$
  select studio_branch_id from public.profiles where id = auth.uid();
$$;

-- Hợp đồng có hạng mục hậu kỳ (contract_products) giao cho CHÍNH nhân viên này.
-- Cổng /staff hiện hàng đợi hậu kỳ theo contract_products.assigned_to, và người
-- chỉnh ảnh thường KHÔNG phải người phụ trách hợp đồng — thiếu dòng này thì
-- việc được giao biến mất khỏi hàng đợi của họ. Chỉ mở ĐỌC, không mở ghi.
-- security definer → đọc contract_products không qua RLS, nên không vòng lặp
-- policy studio_contracts ↔ contract_products.
create or replace function public.studio_my_product_contracts()
returns uuid[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct p.contract_id), '{}'::uuid[])
  from public.contract_products p
  join public.studio_contracts c on c.id = p.contract_id
  where p.assigned_to = auth.uid()
    and c.owner_id = public.studio_scope_owner('assigned');
$$;


-- ── 3) Số thứ tự mã hợp đồng không phụ thuộc RLS ────────────────────────────
-- nextContractCode() đếm hợp đồng đã có trong tháng để ra HD-MM-YYYY-NNN. Nhân
-- viên / quản lý chi nhánh giờ chỉ THẤY một phần hợp đồng, đếm qua RLS sẽ ra số
-- nhỏ hơn thật và cấp trùng mã. Hàm này đếm toàn studio nhưng chỉ trả một con số.
create or replace function public.contract_code_count(p_owner uuid, p_prefix text)
returns bigint language plpgsql stable security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_studio_member(p_owner) then
    raise exception 'không có quyền với studio này' using errcode = '42501';
  end if;
  return (select count(*) from public.studio_contracts
          where owner_id = p_owner and code like p_prefix || '%');
end;
$$;

revoke all on function public.contract_code_count(uuid, text) from public, anon;
grant execute on function public.contract_code_count(uuid, text) to authenticated, service_role;


-- ── 4) Huỷ hợp đồng: chỉ chủ studio ──────────────────────────────────────────
-- Policy không thấy được giá trị CŨ của dòng nên không phân biệt được "đang huỷ"
-- với "sửa ghi chú của hợp đồng đã huỷ" — việc đó cần trigger. Máy chủ
-- (service role, auth.uid() NULL) đi qua: route huỷ đã tự kiểm vai trò.
create or replace function public.guard_contract_cancel()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if new.status = 'cancelled'
     and (tg_op = 'INSERT' or old.status is distinct from 'cancelled')
     -- coalesce: studio_scope_owner('owner') là NULL với nhân viên, và
     -- `not (false or NULL)` là NULL — if bỏ qua, hàng rào thủng im lặng.
     and not coalesce(public.is_admin() or new.owner_id = public.studio_scope_owner('owner'), false) then
    raise exception 'contract_cancel_owner_only: chỉ chủ studio được huỷ hợp đồng'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_contract_cancel on public.studio_contracts;
create trigger guard_contract_cancel
  before insert or update of status on public.studio_contracts
  for each row execute function public.guard_contract_cancel();


-- ── 5) Kế toán chỉ được đánh dấu đã trả lương ───────────────────────────────
-- Màn Bảng lương (PayrollView) cập nhật contract_crew.paid / paid_at ngay từ
-- trình duyệt. Policy cho kế toán UPDATE, trigger này giữ cho UPDATE đó không
-- đụng được cột nào khác (lương, vai trò, SĐT…). AFTER để thấy dòng cuối cùng,
-- kể cả cột sinh tự động phone_digits.
create or replace function public.guard_contract_crew_accountant()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null
     and public.studio_scope_owner('accountant') is not null
     and not public.is_admin()
     and (to_jsonb(new) - 'paid' - 'paid_at') is distinct from (to_jsonb(old) - 'paid' - 'paid_at') then
    raise exception 'payroll_paid_only: kế toán chỉ được đánh dấu đã trả lương'
      using errcode = '42501';
  end if;
  return null;
end;
$$;

drop trigger if exists guard_contract_crew_accountant on public.contract_crew;
create trigger guard_contract_crew_accountant
  after update on public.contract_crew
  for each row execute function public.guard_contract_crew_accountant();


-- ── 6) Policy ────────────────────────────────────────────────────────────────
-- Mỗi bảng hai policy: `…_member_read` (SELECT) và `…_member_write` (mọi lệnh
-- ghi). Bảng con lấy quyền theo hợp đồng cha qua contract_id.

-- studio_contracts
drop policy if exists studio_contracts_owner_all on public.studio_contracts;
drop policy if exists studio_contracts_member_read on public.studio_contracts;
create policy studio_contracts_member_read on public.studio_contracts
  for select using (
    (select public.is_admin())
    or owner_id = (select public.studio_scope_owner('all_read'))
    or (owner_id = (select public.studio_scope_owner('branch')) and branch_id = (select public.studio_my_branch()))
    or (owner_id = (select public.studio_scope_owner('assigned'))
        and (assigned_to = (select auth.uid()) or id = any ((select public.studio_my_product_contracts())::uuid[])))
  );
drop policy if exists studio_contracts_member_write on public.studio_contracts;
create policy studio_contracts_member_write on public.studio_contracts
  for all using (
    (select public.is_admin())
    or owner_id = (select public.studio_scope_owner('all_write'))
    or (owner_id = (select public.studio_scope_owner('branch')) and branch_id = (select public.studio_my_branch()))
    or (owner_id = (select public.studio_scope_owner('assigned')) and assigned_to = (select auth.uid()))
  ) with check (
    (select public.is_admin())
    or owner_id = (select public.studio_scope_owner('all_write'))
    or (owner_id = (select public.studio_scope_owner('branch')) and branch_id = (select public.studio_my_branch()))
    or (owner_id = (select public.studio_scope_owner('assigned')) and assigned_to = (select auth.uid()))
  );

-- contract_items
drop policy if exists contract_items_owner_all on public.contract_items;
drop policy if exists contract_items_member_read on public.contract_items;
create policy contract_items_member_read on public.contract_items
  for select using (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and (
      (select public.is_admin())
      or c.owner_id = (select public.studio_scope_owner('all_read'))
      or (c.owner_id = (select public.studio_scope_owner('branch')) and c.branch_id = (select public.studio_my_branch()))
      or (c.owner_id = (select public.studio_scope_owner('assigned'))
          and (c.assigned_to = (select auth.uid()) or c.id = any ((select public.studio_my_product_contracts())::uuid[])))))
  );
drop policy if exists contract_items_member_write on public.contract_items;
create policy contract_items_member_write on public.contract_items
  for all using (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and (
      (select public.is_admin())
      or c.owner_id = (select public.studio_scope_owner('all_write'))
      or (c.owner_id = (select public.studio_scope_owner('branch')) and c.branch_id = (select public.studio_my_branch()))
      or (c.owner_id = (select public.studio_scope_owner('assigned')) and c.assigned_to = (select auth.uid()))))
  ) with check (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and (
      (select public.is_admin())
      or c.owner_id = (select public.studio_scope_owner('all_write'))
      or (c.owner_id = (select public.studio_scope_owner('branch')) and c.branch_id = (select public.studio_my_branch()))
      or (c.owner_id = (select public.studio_scope_owner('assigned')) and c.assigned_to = (select auth.uid()))))
  );

-- contract_crew (+ kế toán đánh dấu đã trả lương — xem trigger ở mục 5)
drop policy if exists contract_crew_owner_all on public.contract_crew;
drop policy if exists contract_crew_member_read on public.contract_crew;
create policy contract_crew_member_read on public.contract_crew
  for select using (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and (
      (select public.is_admin())
      or c.owner_id = (select public.studio_scope_owner('all_read'))
      or (c.owner_id = (select public.studio_scope_owner('branch')) and c.branch_id = (select public.studio_my_branch()))
      or (c.owner_id = (select public.studio_scope_owner('assigned'))
          and (c.assigned_to = (select auth.uid()) or c.id = any ((select public.studio_my_product_contracts())::uuid[])))))
  );
drop policy if exists contract_crew_member_write on public.contract_crew;
create policy contract_crew_member_write on public.contract_crew
  for all using (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and (
      (select public.is_admin())
      or c.owner_id = (select public.studio_scope_owner('all_write'))
      or (c.owner_id = (select public.studio_scope_owner('branch')) and c.branch_id = (select public.studio_my_branch()))
      or (c.owner_id = (select public.studio_scope_owner('assigned')) and c.assigned_to = (select auth.uid()))))
  ) with check (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and (
      (select public.is_admin())
      or c.owner_id = (select public.studio_scope_owner('all_write'))
      or (c.owner_id = (select public.studio_scope_owner('branch')) and c.branch_id = (select public.studio_my_branch()))
      or (c.owner_id = (select public.studio_scope_owner('assigned')) and c.assigned_to = (select auth.uid()))))
  );
drop policy if exists contract_crew_payroll_update on public.contract_crew;
create policy contract_crew_payroll_update on public.contract_crew
  for update using (
    exists (select 1 from public.studio_contracts c
            where c.id = contract_id and c.owner_id = (select public.studio_scope_owner('accountant')))
  ) with check (
    exists (select 1 from public.studio_contracts c
            where c.id = contract_id and c.owner_id = (select public.studio_scope_owner('accountant')))
  );

-- contract_edit_requests
drop policy if exists contract_edit_requests_owner_all on public.contract_edit_requests;
drop policy if exists contract_edit_requests_member_read on public.contract_edit_requests;
create policy contract_edit_requests_member_read on public.contract_edit_requests
  for select using (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and (
      (select public.is_admin())
      or c.owner_id = (select public.studio_scope_owner('all_read'))
      or (c.owner_id = (select public.studio_scope_owner('branch')) and c.branch_id = (select public.studio_my_branch()))
      or (c.owner_id = (select public.studio_scope_owner('assigned'))
          and (c.assigned_to = (select auth.uid()) or c.id = any ((select public.studio_my_product_contracts())::uuid[])))))
  );
drop policy if exists contract_edit_requests_member_write on public.contract_edit_requests;
create policy contract_edit_requests_member_write on public.contract_edit_requests
  for all using (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and (
      (select public.is_admin())
      or c.owner_id = (select public.studio_scope_owner('all_write'))
      or (c.owner_id = (select public.studio_scope_owner('branch')) and c.branch_id = (select public.studio_my_branch()))
      or (c.owner_id = (select public.studio_scope_owner('assigned')) and c.assigned_to = (select auth.uid()))))
  ) with check (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and (
      (select public.is_admin())
      or c.owner_id = (select public.studio_scope_owner('all_write'))
      or (c.owner_id = (select public.studio_scope_owner('branch')) and c.branch_id = (select public.studio_my_branch()))
      or (c.owner_id = (select public.studio_scope_owner('assigned')) and c.assigned_to = (select auth.uid()))))
  );

-- contract_payments: thêm hàng rào HOÀN TIỀN — khoản kind='refund' hay số âm chỉ
-- chủ studio ghi được (route huỷ ghi bằng service role, không qua đây).
drop policy if exists contract_payments_owner_all on public.contract_payments;
drop policy if exists contract_payments_member_read on public.contract_payments;
create policy contract_payments_member_read on public.contract_payments
  for select using (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and (
      (select public.is_admin())
      or c.owner_id = (select public.studio_scope_owner('all_read'))
      or (c.owner_id = (select public.studio_scope_owner('branch')) and c.branch_id = (select public.studio_my_branch()))
      or (c.owner_id = (select public.studio_scope_owner('assigned'))
          and (c.assigned_to = (select auth.uid()) or c.id = any ((select public.studio_my_product_contracts())::uuid[])))))
  );
drop policy if exists contract_payments_member_write on public.contract_payments;
create policy contract_payments_member_write on public.contract_payments
  for all using (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and (
      (select public.is_admin())
      or c.owner_id = (select public.studio_scope_owner('all_write'))
      or (c.owner_id = (select public.studio_scope_owner('branch')) and c.branch_id = (select public.studio_my_branch()))
      or (c.owner_id = (select public.studio_scope_owner('assigned')) and c.assigned_to = (select auth.uid()))))
  ) with check (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and (
      (select public.is_admin())
      or c.owner_id = (select public.studio_scope_owner('all_write'))
      or (c.owner_id = (select public.studio_scope_owner('branch')) and c.branch_id = (select public.studio_my_branch()))
      or (c.owner_id = (select public.studio_scope_owner('assigned')) and c.assigned_to = (select auth.uid()))))
    and (
      (kind is distinct from 'refund' and coalesce(amount, 0) >= 0)
      or (select public.is_admin())
      or exists (select 1 from public.studio_contracts c
                 where c.id = contract_id and c.owner_id = (select public.studio_scope_owner('owner')))
    )
  );

-- contract_payment_plan
drop policy if exists contract_payment_plan_owner_all on public.contract_payment_plan;
drop policy if exists contract_payment_plan_member_read on public.contract_payment_plan;
create policy contract_payment_plan_member_read on public.contract_payment_plan
  for select using (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and (
      (select public.is_admin())
      or c.owner_id = (select public.studio_scope_owner('all_read'))
      or (c.owner_id = (select public.studio_scope_owner('branch')) and c.branch_id = (select public.studio_my_branch()))
      or (c.owner_id = (select public.studio_scope_owner('assigned'))
          and (c.assigned_to = (select auth.uid()) or c.id = any ((select public.studio_my_product_contracts())::uuid[])))))
  );
drop policy if exists contract_payment_plan_member_write on public.contract_payment_plan;
create policy contract_payment_plan_member_write on public.contract_payment_plan
  for all using (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and (
      (select public.is_admin())
      or c.owner_id = (select public.studio_scope_owner('all_write'))
      or (c.owner_id = (select public.studio_scope_owner('branch')) and c.branch_id = (select public.studio_my_branch()))
      or (c.owner_id = (select public.studio_scope_owner('assigned')) and c.assigned_to = (select auth.uid()))))
  ) with check (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and (
      (select public.is_admin())
      or c.owner_id = (select public.studio_scope_owner('all_write'))
      or (c.owner_id = (select public.studio_scope_owner('branch')) and c.branch_id = (select public.studio_my_branch()))
      or (c.owner_id = (select public.studio_scope_owner('assigned')) and c.assigned_to = (select auth.uid()))))
  );

-- contract_tasks
drop policy if exists contract_tasks_owner_all on public.contract_tasks;
drop policy if exists contract_tasks_member_read on public.contract_tasks;
create policy contract_tasks_member_read on public.contract_tasks
  for select using (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and (
      (select public.is_admin())
      or c.owner_id = (select public.studio_scope_owner('all_read'))
      or (c.owner_id = (select public.studio_scope_owner('branch')) and c.branch_id = (select public.studio_my_branch()))
      or (c.owner_id = (select public.studio_scope_owner('assigned'))
          and (c.assigned_to = (select auth.uid()) or c.id = any ((select public.studio_my_product_contracts())::uuid[])))))
  );
drop policy if exists contract_tasks_member_write on public.contract_tasks;
create policy contract_tasks_member_write on public.contract_tasks
  for all using (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and (
      (select public.is_admin())
      or c.owner_id = (select public.studio_scope_owner('all_write'))
      or (c.owner_id = (select public.studio_scope_owner('branch')) and c.branch_id = (select public.studio_my_branch()))
      or (c.owner_id = (select public.studio_scope_owner('assigned')) and c.assigned_to = (select auth.uid()))))
  ) with check (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and (
      (select public.is_admin())
      or c.owner_id = (select public.studio_scope_owner('all_write'))
      or (c.owner_id = (select public.studio_scope_owner('branch')) and c.branch_id = (select public.studio_my_branch()))
      or (c.owner_id = (select public.studio_scope_owner('assigned')) and c.assigned_to = (select auth.uid()))))
  );

-- contract_equipment
drop policy if exists contract_equipment_owner_all on public.contract_equipment;
drop policy if exists contract_equipment_member_read on public.contract_equipment;
create policy contract_equipment_member_read on public.contract_equipment
  for select using (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and (
      (select public.is_admin())
      or c.owner_id = (select public.studio_scope_owner('all_read'))
      or (c.owner_id = (select public.studio_scope_owner('branch')) and c.branch_id = (select public.studio_my_branch()))
      or (c.owner_id = (select public.studio_scope_owner('assigned'))
          and (c.assigned_to = (select auth.uid()) or c.id = any ((select public.studio_my_product_contracts())::uuid[])))))
  );
drop policy if exists contract_equipment_member_write on public.contract_equipment;
create policy contract_equipment_member_write on public.contract_equipment
  for all using (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and (
      (select public.is_admin())
      or c.owner_id = (select public.studio_scope_owner('all_write'))
      or (c.owner_id = (select public.studio_scope_owner('branch')) and c.branch_id = (select public.studio_my_branch()))
      or (c.owner_id = (select public.studio_scope_owner('assigned')) and c.assigned_to = (select auth.uid()))))
  ) with check (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and (
      (select public.is_admin())
      or c.owner_id = (select public.studio_scope_owner('all_write'))
      or (c.owner_id = (select public.studio_scope_owner('branch')) and c.branch_id = (select public.studio_my_branch()))
      or (c.owner_id = (select public.studio_scope_owner('assigned')) and c.assigned_to = (select auth.uid()))))
  );

-- contract_products (+ người được giao hạng mục hậu kỳ đẩy được trạng thái của nó
-- từ cổng /staff, kể cả khi hợp đồng không giao cho họ)
drop policy if exists contract_products_owner_all on public.contract_products;
drop policy if exists contract_products_member_read on public.contract_products;
create policy contract_products_member_read on public.contract_products
  for select using (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and (
      (select public.is_admin())
      or c.owner_id = (select public.studio_scope_owner('all_read'))
      or (c.owner_id = (select public.studio_scope_owner('branch')) and c.branch_id = (select public.studio_my_branch()))
      or (c.owner_id = (select public.studio_scope_owner('assigned'))
          and (c.assigned_to = (select auth.uid()) or c.id = any ((select public.studio_my_product_contracts())::uuid[])))))
  );
drop policy if exists contract_products_member_write on public.contract_products;
create policy contract_products_member_write on public.contract_products
  for all using (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and (
      (select public.is_admin())
      or c.owner_id = (select public.studio_scope_owner('all_write'))
      or (c.owner_id = (select public.studio_scope_owner('branch')) and c.branch_id = (select public.studio_my_branch()))
      or (c.owner_id = (select public.studio_scope_owner('assigned')) and c.assigned_to = (select auth.uid()))))
  ) with check (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and (
      (select public.is_admin())
      or c.owner_id = (select public.studio_scope_owner('all_write'))
      or (c.owner_id = (select public.studio_scope_owner('branch')) and c.branch_id = (select public.studio_my_branch()))
      or (c.owner_id = (select public.studio_scope_owner('assigned')) and c.assigned_to = (select auth.uid()))))
  );
drop policy if exists contract_products_assignee_update on public.contract_products;
create policy contract_products_assignee_update on public.contract_products
  for update using (
    assigned_to = (select auth.uid())
    and exists (select 1 from public.studio_contracts c
                where c.id = contract_id and c.owner_id = (select public.studio_scope_owner('member')))
  ) with check (
    assigned_to = (select auth.uid())
    and exists (select 1 from public.studio_contracts c
                where c.id = contract_id and c.owner_id = (select public.studio_scope_owner('member')))
  );

-- contract_quote_options
drop policy if exists contract_quote_options_owner_all on public.contract_quote_options;
drop policy if exists contract_quote_options_member_read on public.contract_quote_options;
create policy contract_quote_options_member_read on public.contract_quote_options
  for select using (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and (
      (select public.is_admin())
      or c.owner_id = (select public.studio_scope_owner('all_read'))
      or (c.owner_id = (select public.studio_scope_owner('branch')) and c.branch_id = (select public.studio_my_branch()))
      or (c.owner_id = (select public.studio_scope_owner('assigned'))
          and (c.assigned_to = (select auth.uid()) or c.id = any ((select public.studio_my_product_contracts())::uuid[])))))
  );
drop policy if exists contract_quote_options_member_write on public.contract_quote_options;
create policy contract_quote_options_member_write on public.contract_quote_options
  for all using (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and (
      (select public.is_admin())
      or c.owner_id = (select public.studio_scope_owner('all_write'))
      or (c.owner_id = (select public.studio_scope_owner('branch')) and c.branch_id = (select public.studio_my_branch()))
      or (c.owner_id = (select public.studio_scope_owner('assigned')) and c.assigned_to = (select auth.uid()))))
  ) with check (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and (
      (select public.is_admin())
      or c.owner_id = (select public.studio_scope_owner('all_write'))
      or (c.owner_id = (select public.studio_scope_owner('branch')) and c.branch_id = (select public.studio_my_branch()))
      or (c.owner_id = (select public.studio_scope_owner('assigned')) and c.assigned_to = (select auth.uid()))))
  );

-- contract_client_proofs: ảnh chuyển khoản khách tải lên (khách ghi qua route
-- service role). Trước đây chỉ chủ studio đọc được — nhưng màn hợp đồng hiện
-- chúng cho mọi vai trò mở được hợp đồng, nên giờ theo cùng luật hợp đồng.
drop policy if exists contract_client_proofs_owner on public.contract_client_proofs;
drop policy if exists contract_client_proofs_member_read on public.contract_client_proofs;
create policy contract_client_proofs_member_read on public.contract_client_proofs
  for select using (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and (
      (select public.is_admin())
      or c.owner_id = (select public.studio_scope_owner('all_read'))
      or (c.owner_id = (select public.studio_scope_owner('branch')) and c.branch_id = (select public.studio_my_branch()))
      or (c.owner_id = (select public.studio_scope_owner('assigned'))
          and (c.assigned_to = (select auth.uid()) or c.id = any ((select public.studio_my_product_contracts())::uuid[])))))
  );
drop policy if exists contract_client_proofs_member_write on public.contract_client_proofs;
create policy contract_client_proofs_member_write on public.contract_client_proofs
  for all using (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and (
      (select public.is_admin())
      or c.owner_id = (select public.studio_scope_owner('all_write'))
      or (c.owner_id = (select public.studio_scope_owner('branch')) and c.branch_id = (select public.studio_my_branch()))
      or (c.owner_id = (select public.studio_scope_owner('assigned')) and c.assigned_to = (select auth.uid()))))
  ) with check (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and (
      (select public.is_admin())
      or c.owner_id = (select public.studio_scope_owner('all_write'))
      or (c.owner_id = (select public.studio_scope_owner('branch')) and c.branch_id = (select public.studio_my_branch()))
      or (c.owner_id = (select public.studio_scope_owner('assigned')) and c.assigned_to = (select auth.uid()))))
  );

-- contract_reschedules / contract_addenda: chỉ ĐỌC từ trình duyệt (ghi đi qua
-- route service role), nay theo phạm vi hợp đồng thay vì chỉ-chủ / cả-studio.
drop policy if exists contract_reschedules_owner_read on public.contract_reschedules;
drop policy if exists contract_reschedules_member_read on public.contract_reschedules;
create policy contract_reschedules_member_read on public.contract_reschedules
  for select using (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and (
      (select public.is_admin())
      or c.owner_id = (select public.studio_scope_owner('all_read'))
      or (c.owner_id = (select public.studio_scope_owner('branch')) and c.branch_id = (select public.studio_my_branch()))
      or (c.owner_id = (select public.studio_scope_owner('assigned'))
          and (c.assigned_to = (select auth.uid()) or c.id = any ((select public.studio_my_product_contracts())::uuid[])))))
  );

drop policy if exists contract_addenda_member_read on public.contract_addenda;
create policy contract_addenda_member_read on public.contract_addenda
  for select using (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and (
      (select public.is_admin())
      or c.owner_id = (select public.studio_scope_owner('all_read'))
      or (c.owner_id = (select public.studio_scope_owner('branch')) and c.branch_id = (select public.studio_my_branch()))
      or (c.owner_id = (select public.studio_scope_owner('assigned'))
          and (c.assigned_to = (select auth.uid()) or c.id = any ((select public.studio_my_product_contracts())::uuid[])))))
  );

-- studio_crew (sổ thợ): mọi thành viên đọc được để chọn thợ cho hợp đồng; quản
-- lý chi nhánh chỉ thấy thợ của cơ sở mình + thợ chưa gán cơ sở (thợ tự do dùng
-- chung). Ghi: chủ, manager, và branch_manager với thợ của cơ sở mình — đúng
-- nhóm MANAGERS của trang Nhân sự.
drop policy if exists studio_crew_owner_all on public.studio_crew;
drop policy if exists studio_crew_member_read on public.studio_crew;
create policy studio_crew_member_read on public.studio_crew
  for select using (
    (select public.is_admin())
    or owner_id = (select public.studio_scope_owner('all_read'))
    or owner_id = (select public.studio_scope_owner('assigned'))
    or (owner_id = (select public.studio_scope_owner('branch'))
        and (branch_id = (select public.studio_my_branch()) or branch_id is null))
  );
drop policy if exists studio_crew_member_write on public.studio_crew;
create policy studio_crew_member_write on public.studio_crew
  for all using (
    (select public.is_admin())
    or owner_id = (select public.studio_scope_owner('all_write'))
    or (owner_id = (select public.studio_scope_owner('branch')) and branch_id = (select public.studio_my_branch()))
  ) with check (
    (select public.is_admin())
    or owner_id = (select public.studio_scope_owner('all_write'))
    or (owner_id = (select public.studio_scope_owner('branch')) and branch_id = (select public.studio_my_branch()))
  );

-- ── Kiểm tra sau khi chạy ───────────────────────────────────────────────────
-- Mỗi bảng phải có `…_member_read` + `…_member_write` (contract_reschedules,
-- contract_addenda chỉ có read), và KHÔNG còn `…_owner_all`:
--
--   select tablename, policyname, cmd from pg_policies
--   where schemaname = 'public'
--     and (tablename like 'contract\_%' or tablename in ('studio_contracts','studio_crew'))
--   order by tablename, policyname;
