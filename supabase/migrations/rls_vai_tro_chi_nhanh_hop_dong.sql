-- ============================================================================
-- HÀNG RÀO VAI TRÒ & CHI NHÁNH CHO HỢP ĐỒNG — ĐẶT Ở RLS, KHÔNG CHỈ Ở ROUTE API
--
-- VÌ SAO CẦN
--   Luật "Toàn quyền chi nhánh chỉ thấy chi nhánh mình", "kế toán không sửa hợp
--   đồng", "tài khoản bị khoá không vào được" hôm nay chỉ nằm trong code trang /
--   route (requireStudio, forcedBranchScope, isBranchScopedRole). Còn RLS của
--   studio_contracts và các bảng con chỉ hỏi `is_studio_member(owner_id)` — tức
--   là "có phải người của studio này không". Bất kỳ nhân viên nào cầm anon key
--   (nằm sẵn trong trình duyệt) + JWT của chính mình đều gọi thẳng PostgREST
--   được: đọc hợp đồng của chi nhánh khác, sửa / xoá khoản thu, thêm mình vào
--   bảng tiền công. Hàng rào chỉ ở tầng giao diện thì không phải hàng rào.
--
--   Thêm nữa: is_studio_member KHÔNG xem profiles.is_active. Chủ studio khoá một
--   nhân viên nghỉ việc → app (requireStudio) chặn, nhưng JWT còn hạn của người
--   đó vẫn đọc / ghi thẳng được toàn bộ dữ liệu studio qua PostgREST.
--
-- FILE NÀY LÀM BỐN VIỆC
--   1. Ba hàm ngữ cảnh studio_staff_owner / _role / _branch: trả về "người đang
--      gọi là nhân viên CÒN HOẠT ĐỘNG của studio nào, vai trò gì, chi nhánh nào".
--      Policy gọi chúng dạng `(select public.studio_staff_owner())` để Postgres
--      tính MỘT lần mỗi câu (initPlan) thay vì mỗi dòng — cùng kiểu với
--      tang_toc_thu_vien_album.sql.
--   2. is_studio_member viết lại trên hàm (1): thêm điều kiện is_active cho
--      PHÍA NHÂN VIÊN, áp cho MỌI bảng đang dùng nó (không riêng hợp đồng).
--   3. Ghim chi nhánh cho branch_manager trên hợp đồng + mọi bảng con.
--   4. Siết GHI theo vai trò — chỉ đúng những chỗ không luồng hợp lệ nào trên
--      trình duyệt cần (xem bảng quyết định từng bảng ở dưới).
--
-- KHOÁ TÀI KHOẢN — bắt chước đúng requireStudio (src/lib/auth-guards.ts)
--   requireStudio từ chối khi: (a) chính người đăng nhập is_active = false, hoặc
--   (b) họ là nhân viên mà CHỦ studio is_active = false. Phía nhân viên ở đây làm
--   đúng hai điều đó.
--   Phía CHỦ (target = auth.uid()) cố ý GIỮ NGUYÊN, không thêm is_active: mọi bảng
--   khác của chủ (albums, photos, sites…) đều là `owner_id = auth.uid()` trần, nên
--   thêm điều kiện ở riêng đây không khoá được chủ khỏi dữ liệu của mình — chỉ
--   sinh ra một nửa hàng rào khó đoán. Chủ bị khoá vẫn bị chặn ở tầng app
--   (requireStudio, dashboard/layout), và quan trọng hơn: nhân viên của chủ đó
--   mất quyền ngay ở đây.
--
-- BRANCH_MANAGER — bắt chước forcedBranchScope (src/lib/studio-roles.ts)
--   Được gán chi nhánh X  → chỉ hợp đồng branch_id = X.
--   CHƯA được gán         → forcedBranchScope trả "none", applyBranch biến nó
--                           thành `branch_id IS NULL`: chỉ phần CHƯA GÁN. Ở đây
--                           dùng `branch_id is not distinct from studio_branch_id`
--                           nên ra đúng y như vậy — fail-closed theo nghĩa KHÔNG
--                           BAO GIỜ mở ra toàn studio, khớp từng chữ với app.
--   Bảng con (hạng mục, thu tiền, nhân sự…) lấy quyền qua hợp đồng cha: policy
--   con hỏi `exists (select 1 from studio_contracts c where c.id = contract_id)`,
--   và vì câu con đó CŨNG chịu RLS của studio_contracts nên nó thừa hưởng nguyên
--   luật chủ / admin / nhân viên / chi nhánh ở trên — một luật, một chỗ. (Nếu sau
--   này thêm một policy permissive mới trên studio_contracts, ví dụ cho cổng
--   khách, thì nó cũng mở luôn các bảng con — phải xem lại file này.)
--
--   Hợp đồng mới do branch_manager tạo mà KHÔNG mang branch_id (vd. "Tạo hợp
--   đồng" từ yêu cầu đặt lịch — BookingsView không gửi branch_id) sẽ được trigger
--   ghim vào chi nhánh của họ. Không có trigger này thì luật trên chối lệnh
--   insert và branch_manager không chuyển được yêu cầu đặt lịch thành hợp đồng.
--
-- CHỨNG CỨ: các luồng GHI từ TRÌNH DUYỆT (createClient của @/lib/supabase/client)
--   và vai trò tới được màn đó (studio-nav.ts + chốt ở page.tsx):
--     ContractEditor / NewContractForm (contracts — STAFF_OK, kế toán bị chặn ở
--       page): studio_contracts insert/update/delete; contract_items,
--       contract_crew, contract_payments, contract_payment_plan, contract_tasks,
--       contract_products, contract_edit_requests, contract_reschedules.
--       → Nhân viên (staff) dùng TOÀN BỘ, kể cả nút xoá hợp đồng và gỡ khoản thu.
--     BookingsView (MANAGER_OK): studio_contracts, contract_items, contract_tasks insert.
--     CalendarView (STAFF_OK): studio_contracts.calendar_color.
--     ProductionView (STAFF_OK), /staff TaskQueue (MỌI vai trò): contract_products update.
--     /staff TodayView (MỌI vai trò): contract_tasks update.
--     PayrollView (MONEY_OK — có kế toán): contract_crew update (đã trả công).
--     CrewManager (tab thợ của "Nhân viên & phân quyền" — page chỉ cho
--       owner/admin/manager/branch_manager): studio_crew insert/update/delete.
--   Ghi phía máy chủ (route API, cron, cổng khách) đều qua service-role → bỏ qua
--   RLS, không bị ảnh hưởng. Trigger trên các bảng này đều SECURITY DEFINER.
--
-- QUYẾT ĐỊNH TỪNG BẢNG
--   studio_contracts      ĐỌC: chủ, admin, nhân viên còn hoạt động (bm: chỉ chi
--                         nhánh mình). GHI: như đọc, TRỪ kế toán — kế toán không
--                         có màn nào ghi hợp đồng (trang hợp đồng chặn kế toán).
--   contract_items, contract_payments, contract_payment_plan,
--   contract_edit_requests, contract_equipment, contract_quote_options
--                         ĐỌC: theo hợp đồng cha. GHI: theo hợp đồng cha, TRỪ kế
--                         toán. Kế toán vẫn ĐỌC được khoản thu (Thu chi, xuất kế
--                         toán) — chỉ không tự thêm / sửa / xoá khoản thu; ghi thu
--                         của màn Thu chi đi qua /api/studio/payment-plan/collect
--                         (service-role).
--   contract_crew, contract_tasks, contract_products
--                         Như nhóm trên, NHƯNG kế toán được UPDATE: Đối soát tiền
--                         công đánh dấu đã trả (contract_crew), cổng /staff tích
--                         việc xong / đổi trạng thái hậu kỳ (tasks, products).
--                         Kế toán KHÔNG insert / delete được — tức là không tự
--                         thêm mình vào bảng tiền công được.
--   contract_addenda, wedding_plans
--                         Vốn chỉ có policy ĐỌC cho thành viên (ghi qua máy chủ).
--                         Giữ chỉ-đọc, chuyển sang theo hợp đồng cha để
--                         branch_manager không đọc phụ lục / kế hoạch cưới của chi
--                         nhánh khác.
--   studio_crew           ĐỌC: mọi thành viên còn hoạt động — KHÔNG ghim chi nhánh:
--                         thợ tự do thường để branch_id trống và làm cho mọi cơ sở,
--                         ghim thì ô chọn thợ trong hợp đồng của branch_manager mất
--                         họ. GHI: chỉ owner/admin/manager/branch_manager — đúng
--                         những người mở được CrewManager. Thợ tự cập nhật hồ sơ
--                         qua /api/crew/profile (service-role).
--
-- CÒN MỞ (cố ý — siết thì vỡ luồng thật, ghi lại để khỏi tưởng đã kín)
--   • Nhân viên (staff) vẫn ĐỌC / GHI mọi hợp đồng của studio qua PostgREST, dù
--     app chỉ cho họ thấy hợp đồng được giao (assigned_to). Không siết được ở RLS:
--     người hậu kỳ được giao SẢN PHẨM (contract_products.assigned_to) trên hợp
--     đồng giao cho người khác, cổng /staff đọc qua hợp đồng cha; và trang hợp
--     đồng còn đọc hợp đồng khác cùng ngày để báo trùng lịch thợ.
--   • Kế toán UPDATE được contract_crew / tasks / products ở MỌI cột (RLS không
--     chặn theo cột được) — vd. sửa tiền công một dòng có sẵn.
--   • branch_manager đổi ô "Chi nhánh" của hợp đồng sang cơ sở khác / bỏ trống thì
--     nay bị chối (WITH CHECK) — đó là chủ đích, nhưng màn hình vẫn đưa lựa chọn.
--   • Cảnh báo trùng lịch thợ ở trang hợp đồng chạy bằng client của người dùng →
--     với branch_manager nay chỉ thấy trùng trong chi nhánh mình.
--   • studio_quotes / quote_items, studio_events, studio_expenses… chưa ghim chi
--     nhánh (ngoài phạm vi file này) — nhưng đã hưởng điều kiện is_active qua
--     is_studio_member.
--
-- THỨ TỰ CHẠY: SAU studio_branches.sql (cần studio_contracts.branch_id và
-- profiles.studio_branch_id), SAU rls_thanh_vien_hop_dong.sql, ke_hoach_cuoi.sql,
-- contract_addenda.sql. Chạy lại schema.sql hoặc rls_thanh_vien_hop_dong.sql
-- SAU file này sẽ dựng lại policy `*_owner_all` mở rộng — khi đó chạy lại file này.
--
-- AN TOÀN KHI CHẠY LẠI: chỉ thay hàm / trigger / policy, không đụng dữ liệu.
-- ============================================================================

-- Hàng rào: thiếu cột chi nhánh thì DỪNG với lời nhắn rõ ràng, thay vì để
-- `create policy` văng "column branch_id does not exist" khó hiểu ở giữa file.
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'studio_contracts' and column_name = 'branch_id')
     or not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'profiles' and column_name = 'studio_branch_id') then
    raise exception 'Cần chạy supabase/migrations/studio_branches.sql TRƯỚC file này (thiếu cột branch_id / studio_branch_id).';
  end if;
end $$;

-- ── 1) Ngữ cảnh của người đang gọi ─────────────────────────────────────────
-- SECURITY DEFINER: nhân viên không đọc được dòng profiles của CHỦ qua RLS (xem
-- getProfileByIdAdmin trong auth-guards.ts), mà ta cần is_active của chủ.
-- Trả NULL cho mọi người KHÔNG phải nhân viên còn hiệu lực: chủ studio, thợ
-- ảnh độc lập, người chưa đăng nhập, nhân viên bị khoá, nhân viên của chủ bị khoá.

-- Studio mà người đang gọi làm nhân viên (chủ của họ), nếu cả hai còn hoạt động.
create or replace function public.studio_staff_owner()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select me.studio_owner_id
  from public.profiles me
  join public.profiles o on o.id = me.studio_owner_id
  where me.id = auth.uid()
    and me.is_active
    and o.is_active;
$$;

-- Vai trò của nhân viên đó. Rỗng / NULL coi là 'staff' — đúng như requireStudio
-- (`me.studio_role || "staff"`): thiếu vai trò thì nhận quyền THẤP, không phải cao.
create or replace function public.studio_staff_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(nullif(me.studio_role, ''), 'staff')
  from public.profiles me
  join public.profiles o on o.id = me.studio_owner_id
  where me.id = auth.uid()
    and me.is_active
    and o.is_active;
$$;

-- Chi nhánh được gán cho chính nhân viên đó (NULL = chưa gán).
create or replace function public.studio_staff_branch()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select me.studio_branch_id
  from public.profiles me
  join public.profiles o on o.id = me.studio_owner_id
  where me.id = auth.uid()
    and me.is_active
    and o.is_active;
$$;

-- ── 2) is_studio_member: thêm is_active cho phía nhân viên ─────────────────
-- Giữ chữ ký cũ để mọi policy / RPC đang gọi nó (inbox, lịch hẹn, kế toán…) tự
-- hưởng điều kiện mới mà không phải viết lại.
create or replace function public.is_studio_member(target uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    target = auth.uid()
    or target = public.studio_staff_owner()
    or public.is_admin();
$$;

-- ── 3) Ghim chi nhánh khi branch_manager tạo hợp đồng không kèm chi nhánh ──
-- Chạy TRƯỚC khi Postgres kiểm WITH CHECK của RLS (trigger BEFORE luôn đi trước),
-- nên dòng mới đã mang đúng chi nhánh lúc bị kiểm. Service-role (auth.uid() NULL)
-- và chủ studio: studio_staff_role() trả NULL → không đổi gì.
create or replace function public.studio_contracts_ghim_chi_nhanh()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.branch_id is null and public.studio_staff_role() = 'branch_manager' then
    new.branch_id := public.studio_staff_branch();
  end if;
  return new;
end;
$$;

drop trigger if exists studio_contracts_ghim_chi_nhanh on public.studio_contracts;
create trigger studio_contracts_ghim_chi_nhanh
  before insert on public.studio_contracts
  for each row execute function public.studio_contracts_ghim_chi_nhanh();

-- ── 4) Quyền gọi hàm ───────────────────────────────────────────────────────
-- anon PHẢI gọi được: policy áp cho mọi role, nên một câu anon chạm tới bảng mà
-- không gọi được hàm sẽ nổ "permission denied for function" thay vì trả rỗng.
-- Hàm chỉ trả ngữ cảnh của CHÍNH người gọi, với anon là NULL — không lộ gì.
revoke all on function public.studio_staff_owner() from public;
revoke all on function public.studio_staff_role() from public;
revoke all on function public.studio_staff_branch() from public;
grant execute on function public.studio_staff_owner() to anon, authenticated, service_role;
grant execute on function public.studio_staff_role() to anon, authenticated, service_role;
grant execute on function public.studio_staff_branch() to anon, authenticated, service_role;

-- ── 5) studio_contracts ────────────────────────────────────────────────────
-- Bỏ policy mở rộng cũ (schema.sql + rls_thanh_vien_hop_dong.sql). Policy
-- permissive cộng bằng OR — để sót nó là mọi luật dưới đây vô nghĩa.
drop policy if exists studio_contracts_owner_all on public.studio_contracts;

drop policy if exists studio_contracts_member_read on public.studio_contracts;
create policy studio_contracts_member_read on public.studio_contracts
  for select using (
    owner_id = (select auth.uid())
    or (select public.is_admin())
    or (
      owner_id = (select public.studio_staff_owner())
      and (
        (select public.studio_staff_role()) <> 'branch_manager'
        or branch_id is not distinct from (select public.studio_staff_branch())
      )
    )
  );

-- FOR ALL: phần SELECT của nó trùng với policy đọc ở trên (OR) nên kế toán vẫn
-- đọc được; còn insert / update / delete thì kế toán không qua được câu này.
drop policy if exists studio_contracts_member_write on public.studio_contracts;
create policy studio_contracts_member_write on public.studio_contracts
  for all using (
    owner_id = (select auth.uid())
    or (select public.is_admin())
    or (
      owner_id = (select public.studio_staff_owner())
      and (select public.studio_staff_role()) <> 'accountant'
      and (
        (select public.studio_staff_role()) <> 'branch_manager'
        or branch_id is not distinct from (select public.studio_staff_branch())
      )
    )
  )
  with check (
    owner_id = (select auth.uid())
    or (select public.is_admin())
    or (
      owner_id = (select public.studio_staff_owner())
      and (select public.studio_staff_role()) <> 'accountant'
      and (
        (select public.studio_staff_role()) <> 'branch_manager'
        or branch_id is not distinct from (select public.studio_staff_branch())
      )
    )
  );

-- ── 6) Bảng con: theo hợp đồng cha, kế toán chỉ đọc ────────────────────────
-- `exists (… studio_contracts c where c.id = contract_id)` chịu RLS của
-- studio_contracts (mục 5) → thừa hưởng nguyên luật chủ / nhân viên / chi nhánh.
-- coalesce(…, '') vì với chủ / admin studio_staff_role() là NULL, và
-- `NULL <> 'accountant'` là NULL chứ không phải true.

-- contract_items
drop policy if exists contract_items_owner_all on public.contract_items;
drop policy if exists contract_items_member_read on public.contract_items;
create policy contract_items_member_read on public.contract_items
  for select using (exists (select 1 from public.studio_contracts c where c.id = contract_id));
drop policy if exists contract_items_member_write on public.contract_items;
create policy contract_items_member_write on public.contract_items
  for all using (
    coalesce((select public.studio_staff_role()), '') <> 'accountant'
    and exists (select 1 from public.studio_contracts c where c.id = contract_id)
  )
  with check (
    coalesce((select public.studio_staff_role()), '') <> 'accountant'
    and exists (select 1 from public.studio_contracts c where c.id = contract_id)
  );

-- contract_payments
drop policy if exists contract_payments_owner_all on public.contract_payments;
drop policy if exists contract_payments_member_read on public.contract_payments;
create policy contract_payments_member_read on public.contract_payments
  for select using (exists (select 1 from public.studio_contracts c where c.id = contract_id));
drop policy if exists contract_payments_member_write on public.contract_payments;
create policy contract_payments_member_write on public.contract_payments
  for all using (
    coalesce((select public.studio_staff_role()), '') <> 'accountant'
    and exists (select 1 from public.studio_contracts c where c.id = contract_id)
  )
  with check (
    coalesce((select public.studio_staff_role()), '') <> 'accountant'
    and exists (select 1 from public.studio_contracts c where c.id = contract_id)
  );

-- contract_payment_plan
drop policy if exists contract_payment_plan_owner_all on public.contract_payment_plan;
drop policy if exists contract_payment_plan_member_read on public.contract_payment_plan;
create policy contract_payment_plan_member_read on public.contract_payment_plan
  for select using (exists (select 1 from public.studio_contracts c where c.id = contract_id));
drop policy if exists contract_payment_plan_member_write on public.contract_payment_plan;
create policy contract_payment_plan_member_write on public.contract_payment_plan
  for all using (
    coalesce((select public.studio_staff_role()), '') <> 'accountant'
    and exists (select 1 from public.studio_contracts c where c.id = contract_id)
  )
  with check (
    coalesce((select public.studio_staff_role()), '') <> 'accountant'
    and exists (select 1 from public.studio_contracts c where c.id = contract_id)
  );

-- contract_edit_requests
drop policy if exists contract_edit_requests_owner_all on public.contract_edit_requests;
drop policy if exists contract_edit_requests_member_read on public.contract_edit_requests;
create policy contract_edit_requests_member_read on public.contract_edit_requests
  for select using (exists (select 1 from public.studio_contracts c where c.id = contract_id));
drop policy if exists contract_edit_requests_member_write on public.contract_edit_requests;
create policy contract_edit_requests_member_write on public.contract_edit_requests
  for all using (
    coalesce((select public.studio_staff_role()), '') <> 'accountant'
    and exists (select 1 from public.studio_contracts c where c.id = contract_id)
  )
  with check (
    coalesce((select public.studio_staff_role()), '') <> 'accountant'
    and exists (select 1 from public.studio_contracts c where c.id = contract_id)
  );

-- contract_equipment
drop policy if exists contract_equipment_owner_all on public.contract_equipment;
drop policy if exists contract_equipment_member_read on public.contract_equipment;
create policy contract_equipment_member_read on public.contract_equipment
  for select using (exists (select 1 from public.studio_contracts c where c.id = contract_id));
drop policy if exists contract_equipment_member_write on public.contract_equipment;
create policy contract_equipment_member_write on public.contract_equipment
  for all using (
    coalesce((select public.studio_staff_role()), '') <> 'accountant'
    and exists (select 1 from public.studio_contracts c where c.id = contract_id)
  )
  with check (
    coalesce((select public.studio_staff_role()), '') <> 'accountant'
    and exists (select 1 from public.studio_contracts c where c.id = contract_id)
  );

-- contract_quote_options
drop policy if exists contract_quote_options_owner_all on public.contract_quote_options;
drop policy if exists contract_quote_options_member_read on public.contract_quote_options;
create policy contract_quote_options_member_read on public.contract_quote_options
  for select using (exists (select 1 from public.studio_contracts c where c.id = contract_id));
drop policy if exists contract_quote_options_member_write on public.contract_quote_options;
create policy contract_quote_options_member_write on public.contract_quote_options
  for all using (
    coalesce((select public.studio_staff_role()), '') <> 'accountant'
    and exists (select 1 from public.studio_contracts c where c.id = contract_id)
  )
  with check (
    coalesce((select public.studio_staff_role()), '') <> 'accountant'
    and exists (select 1 from public.studio_contracts c where c.id = contract_id)
  );

-- ── 7) Bảng con kế toán được UPDATE (tiền công, việc, hậu kỳ) ──────────────
-- Ba policy: đọc (mọi người thấy hợp đồng cha), ghi đủ (trừ kế toán), và
-- UPDATE riêng cho kế toán. Kế toán vẫn không insert / delete được.

-- contract_crew — Đối soát tiền công đánh dấu "đã trả".
drop policy if exists contract_crew_owner_all on public.contract_crew;
drop policy if exists contract_crew_member_read on public.contract_crew;
create policy contract_crew_member_read on public.contract_crew
  for select using (exists (select 1 from public.studio_contracts c where c.id = contract_id));
drop policy if exists contract_crew_member_write on public.contract_crew;
create policy contract_crew_member_write on public.contract_crew
  for all using (
    coalesce((select public.studio_staff_role()), '') <> 'accountant'
    and exists (select 1 from public.studio_contracts c where c.id = contract_id)
  )
  with check (
    coalesce((select public.studio_staff_role()), '') <> 'accountant'
    and exists (select 1 from public.studio_contracts c where c.id = contract_id)
  );
drop policy if exists contract_crew_accountant_update on public.contract_crew;
create policy contract_crew_accountant_update on public.contract_crew
  for update using (
    (select public.studio_staff_role()) = 'accountant'
    and exists (select 1 from public.studio_contracts c where c.id = contract_id)
  )
  with check (
    (select public.studio_staff_role()) = 'accountant'
    and exists (select 1 from public.studio_contracts c where c.id = contract_id)
  );

-- contract_tasks — cổng /staff tích "xong việc".
drop policy if exists contract_tasks_owner_all on public.contract_tasks;
drop policy if exists contract_tasks_member_read on public.contract_tasks;
create policy contract_tasks_member_read on public.contract_tasks
  for select using (exists (select 1 from public.studio_contracts c where c.id = contract_id));
drop policy if exists contract_tasks_member_write on public.contract_tasks;
create policy contract_tasks_member_write on public.contract_tasks
  for all using (
    coalesce((select public.studio_staff_role()), '') <> 'accountant'
    and exists (select 1 from public.studio_contracts c where c.id = contract_id)
  )
  with check (
    coalesce((select public.studio_staff_role()), '') <> 'accountant'
    and exists (select 1 from public.studio_contracts c where c.id = contract_id)
  );
drop policy if exists contract_tasks_accountant_update on public.contract_tasks;
create policy contract_tasks_accountant_update on public.contract_tasks
  for update using (
    (select public.studio_staff_role()) = 'accountant'
    and exists (select 1 from public.studio_contracts c where c.id = contract_id)
  )
  with check (
    (select public.studio_staff_role()) = 'accountant'
    and exists (select 1 from public.studio_contracts c where c.id = contract_id)
  );

-- contract_products — cổng /staff đổi trạng thái việc hậu kỳ.
drop policy if exists contract_products_owner_all on public.contract_products;
drop policy if exists contract_products_member_read on public.contract_products;
create policy contract_products_member_read on public.contract_products
  for select using (exists (select 1 from public.studio_contracts c where c.id = contract_id));
drop policy if exists contract_products_member_write on public.contract_products;
create policy contract_products_member_write on public.contract_products
  for all using (
    coalesce((select public.studio_staff_role()), '') <> 'accountant'
    and exists (select 1 from public.studio_contracts c where c.id = contract_id)
  )
  with check (
    coalesce((select public.studio_staff_role()), '') <> 'accountant'
    and exists (select 1 from public.studio_contracts c where c.id = contract_id)
  );
drop policy if exists contract_products_accountant_update on public.contract_products;
create policy contract_products_accountant_update on public.contract_products
  for update using (
    (select public.studio_staff_role()) = 'accountant'
    and exists (select 1 from public.studio_contracts c where c.id = contract_id)
  )
  with check (
    (select public.studio_staff_role()) = 'accountant'
    and exists (select 1 from public.studio_contracts c where c.id = contract_id)
  );

-- ── 8) Bảng con chỉ-đọc: phụ lục, kế hoạch cưới ────────────────────────────
-- Ghi đi qua máy chủ (service-role) nên vẫn KHÔNG có policy ghi.
drop policy if exists contract_addenda_member_read on public.contract_addenda;
create policy contract_addenda_member_read on public.contract_addenda
  for select using (exists (select 1 from public.studio_contracts c where c.id = contract_id));

drop policy if exists wedding_plans_member_read on public.wedding_plans;
create policy wedding_plans_member_read on public.wedding_plans
  for select using (exists (select 1 from public.studio_contracts c where c.id = contract_id));

-- ── 9) studio_crew: mọi thành viên đọc, chỉ cấp quản lý ghi ────────────────
drop policy if exists studio_crew_owner_all on public.studio_crew;

drop policy if exists studio_crew_member_read on public.studio_crew;
create policy studio_crew_member_read on public.studio_crew
  for select using (
    owner_id = (select auth.uid())
    or owner_id = (select public.studio_staff_owner())
    or (select public.is_admin())
  );

drop policy if exists studio_crew_manager_write on public.studio_crew;
create policy studio_crew_manager_write on public.studio_crew
  for all using (
    owner_id = (select auth.uid())
    or (select public.is_admin())
    or (
      owner_id = (select public.studio_staff_owner())
      and (select public.studio_staff_role()) in ('manager', 'branch_manager')
    )
  )
  with check (
    owner_id = (select auth.uid())
    or (select public.is_admin())
    or (
      owner_id = (select public.studio_staff_owner())
      and (select public.studio_staff_role()) in ('manager', 'branch_manager')
    )
  );

-- ── Kiểm tra sau khi chạy ───────────────────────────────────────────────────
-- Không còn dòng `*_owner_all` nào trên các bảng hợp đồng:
--
--   select tablename, policyname, cmd from pg_policies
--   where schemaname = 'public'
--     and (tablename like 'contract%' or tablename in ('studio_contracts','studio_crew','wedding_plans'))
--   order by tablename, policyname;
