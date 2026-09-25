-- ============================================================================
-- NHẬT KÝ THAO TÁC — tiền & hợp đồng
--
-- Studio có nhiều vai trò cùng ghi thu, sửa giá, đổi trạng thái. Một khoản thu
-- biến mất hay một giá bị sửa thì trước đây không ai biết là ai, lúc nào.
--
-- HAI ĐƯỜNG GHI, vì app ghi dữ liệu bằng hai cách:
--
--  1) Trigger dưới DB — cho mọi thao tác NGƯỜI DÙNG ghi thẳng từ trình duyệt
--     (ContractEditor ghi contract_payments / contract_items / studio_contracts
--     bằng supabase client). Người thao tác = auth.uid().
--  2) logAction() trong src/lib/audit-log.ts — cho các route MÁY CHỦ chạy bằng
--     service role (huỷ, dời lịch, đổi trạng thái, phụ lục, voucher…). Ở đó
--     auth.uid() là null nên trigger TỰ BỎ QUA, và route ghi kèm người thao tác
--     thật mà nó đã xác minh. Không ghi trùng, không mất người.
--
-- Bất biến: không có policy insert/update/delete cho authenticated — người dùng
-- chỉ ĐỌC được, không ai sửa hay xoá được dấu vết của chính mình.
-- Đọc: chủ studio, kế toán của studio, admin nền tảng.
--
-- Chạy 1 lần trong Supabase SQL Editor. An toàn khi chạy lại.
-- ============================================================================

create table if not exists public.studio_audit_log (
  id          bigint generated always as identity primary key,
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  actor_id    uuid references public.profiles (id) on delete set null,
  action      text not null,          -- 'payment.insert', 'contract.status', 'addendum.confirm'…
  entity      text not null,          -- 'payment' | 'expense' | 'contract' | 'voucher' | 'account'
  entity_id   uuid,
  -- Không khoá ngoại: nhật ký phải sống lâu hơn hợp đồng đã xoá.
  contract_id uuid,
  summary     text,
  before      jsonb,
  after       jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists studio_audit_log_owner_idx on public.studio_audit_log (owner_id, created_at desc);
create index if not exists studio_audit_log_contract_idx on public.studio_audit_log (contract_id, created_at desc);

alter table public.studio_audit_log enable row level security;
drop policy if exists studio_audit_log_read on public.studio_audit_log;
create policy studio_audit_log_read on public.studio_audit_log
  for select using (
    owner_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from public.profiles p
               where p.id = auth.uid() and p.studio_owner_id = studio_audit_log.owner_id
                 and p.studio_role = 'accountant')
  );
revoke insert, update, delete on public.studio_audit_log from authenticated, anon;

create or replace function public.audit_write(
  p_owner uuid, p_action text, p_entity text, p_entity_id uuid, p_contract uuid,
  p_summary text, p_before jsonb, p_after jsonb
) returns void language sql security definer set search_path = public as $$
  insert into public.studio_audit_log (owner_id, actor_id, action, entity, entity_id, contract_id, summary, before, after)
  values (p_owner, auth.uid(), p_action, p_entity, p_entity_id, p_contract, p_summary, p_before, p_after);
$$;
revoke execute on function public.audit_write(uuid, text, text, uuid, uuid, text, jsonb, jsonb) from public, anon, authenticated;

create or replace function public.audit_vnd(n bigint) returns text language sql immutable as $$
  select replace(to_char(coalesce(n, 0), 'FM999,999,999,999,990'), ',', '.') || 'đ';
$$;

-- ── Khoản thu ───────────────────────────────────────────────────────────────
create or replace function public.audit_contract_payments()
returns trigger language plpgsql security definer set search_path = public as $$
declare r public.contract_payments; o uuid; s text;
begin
  if auth.uid() is null then return null; end if;
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  if tg_op = 'UPDATE' and (old.amount, old.kind, old.paid_at, old.method)
     is not distinct from (new.amount, new.kind, new.paid_at, new.method) then
    return null;  -- chỉ đổi ảnh chứng từ / số phiếu: không phải thay đổi tiền
  end if;
  select owner_id into o from public.studio_contracts where id = r.contract_id;
  if o is null then return null; end if;
  s := case tg_op
         when 'INSERT' then 'Ghi thu ' || audit_vnd(new.amount)
         when 'DELETE' then 'Xoá khoản thu ' || audit_vnd(old.amount) || ' ngày ' || to_char(old.paid_at, 'DD/MM/YYYY')
         else 'Sửa khoản thu ' || audit_vnd(old.amount) || ' → ' || audit_vnd(new.amount)
       end;
  perform audit_write(o, 'payment.' || lower(tg_op), 'payment', r.id, r.contract_id, s,
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return null;
end $$;
drop trigger if exists audit_contract_payments on public.contract_payments;
create trigger audit_contract_payments after insert or update or delete on public.contract_payments
  for each row execute function public.audit_contract_payments();

-- ── Khoản chi ───────────────────────────────────────────────────────────────
create or replace function public.audit_studio_expenses()
returns trigger language plpgsql security definer set search_path = public as $$
declare r public.studio_expenses; s text;
begin
  if auth.uid() is null then return null; end if;
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  if tg_op = 'UPDATE' and (old.amount, old.title, old.spent_at, old.category)
     is not distinct from (new.amount, new.title, new.spent_at, new.category) then
    return null;
  end if;
  s := case tg_op
         when 'INSERT' then 'Ghi chi ' || audit_vnd(new.amount) || ' · ' || coalesce(nullif(new.title, ''), 'không tên')
         when 'DELETE' then 'Xoá khoản chi ' || audit_vnd(old.amount) || ' · ' || coalesce(nullif(old.title, ''), 'không tên')
         else 'Sửa khoản chi ' || audit_vnd(old.amount) || ' → ' || audit_vnd(new.amount)
       end;
  perform audit_write(r.owner_id, 'expense.' || lower(tg_op), 'expense', r.id, r.contract_id, s,
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return null;
end $$;
drop trigger if exists audit_studio_expenses on public.studio_expenses;
create trigger audit_studio_expenses after insert or update or delete on public.studio_expenses
  for each row execute function public.audit_studio_expenses();

-- ── Hợp đồng: chỉ những trường có hệ quả (trạng thái, ngày, tiền, khách) ──────
create or replace function public.audit_studio_contracts()
returns trigger language plpgsql security definer set search_path = public as $$
declare parts text[] := '{}';
begin
  if auth.uid() is null then return null; end if;
  if tg_op = 'DELETE' then
    perform audit_write(old.owner_id, 'contract.delete', 'contract', old.id, old.id,
      'Xoá hợp đồng ' || coalesce(old.code || ' · ', '') || coalesce(old.title, ''), to_jsonb(old), null);
    return null;
  end if;
  if old.status is distinct from new.status then parts := parts || ('trạng thái ' || old.status || ' → ' || new.status); end if;
  if old.event_date is distinct from new.event_date then
    parts := parts || ('ngày chụp ' || coalesce(to_char(old.event_date, 'DD/MM/YYYY'), '—') || ' → ' || coalesce(to_char(new.event_date, 'DD/MM/YYYY'), '—'));
  end if;
  if old.deposit is distinct from new.deposit then parts := parts || ('cọc ' || audit_vnd(old.deposit) || ' → ' || audit_vnd(new.deposit)); end if;
  if old.client_name is distinct from new.client_name then parts := parts || ('tên khách “' || coalesce(old.client_name, '') || '” → “' || coalesce(new.client_name, '') || '”'); end if;
  if old.client_phone is distinct from new.client_phone then parts := parts || 'SĐT khách'::text; end if;
  if array_length(parts, 1) is null then return null; end if;
  perform audit_write(new.owner_id, 'contract.update', 'contract', new.id, new.id,
    'Sửa ' || array_to_string(parts, ', '),
    jsonb_build_object('status', old.status, 'event_date', old.event_date, 'deposit', old.deposit, 'client_name', old.client_name, 'client_phone', old.client_phone),
    jsonb_build_object('status', new.status, 'event_date', new.event_date, 'deposit', new.deposit, 'client_name', new.client_name, 'client_phone', new.client_phone));
  return null;
end $$;
drop trigger if exists audit_studio_contracts on public.studio_contracts;
create trigger audit_studio_contracts after update or delete on public.studio_contracts
  for each row execute function public.audit_studio_contracts();

-- ── Hạng mục: MỘT dòng nhật ký cho mỗi lần lưu, không phải mỗi hạng mục ─────
-- Trình sửa hợp đồng lưu bằng "xoá hết rồi chèn lại", nên ghi theo từng dòng
-- sẽ ra 20 dòng nhật ký cho một cú bấm Lưu. Trigger mức câu lệnh gom lại.
create or replace function public.audit_contract_items_stmt()
returns trigger language plpgsql security definer set search_path = public as $$
declare g record;
begin
  if auth.uid() is null then return null; end if;
  if tg_op = 'INSERT' then
    for g in
      select n.contract_id, c.owner_id, count(*) as cnt, sum(n.qty::bigint * n.unit_price)::bigint as tot,
             jsonb_agg(jsonb_build_object('name', n.name, 'qty', n.qty, 'unit_price', n.unit_price) order by n.position) as lines
        from new_rows n join public.studio_contracts c on c.id = n.contract_id
       group by n.contract_id, c.owner_id
    loop
      perform audit_write(g.owner_id, 'items.save', 'contract', g.contract_id, g.contract_id,
        'Lưu ' || g.cnt || ' hạng mục · tổng ' || audit_vnd(g.tot), null, jsonb_build_object('lines', g.lines));
    end loop;
  else
    for g in
      select o.contract_id, c.owner_id, count(*) as cnt, sum(o.qty::bigint * o.unit_price)::bigint as tot,
             jsonb_agg(jsonb_build_object('name', o.name, 'qty', o.qty, 'unit_price', o.unit_price) order by o.position) as lines
        from old_rows o join public.studio_contracts c on c.id = o.contract_id
       group by o.contract_id, c.owner_id
    loop
      perform audit_write(g.owner_id, 'items.clear', 'contract', g.contract_id, g.contract_id,
        'Gỡ ' || g.cnt || ' hạng mục cũ · tổng ' || audit_vnd(g.tot), jsonb_build_object('lines', g.lines), null);
    end loop;
  end if;
  return null;
end $$;
drop trigger if exists audit_contract_items_ins on public.contract_items;
create trigger audit_contract_items_ins after insert on public.contract_items
  referencing new table as new_rows for each statement execute function public.audit_contract_items_stmt();
drop trigger if exists audit_contract_items_del on public.contract_items;
create trigger audit_contract_items_del after delete on public.contract_items
  referencing old table as old_rows for each statement execute function public.audit_contract_items_stmt();
