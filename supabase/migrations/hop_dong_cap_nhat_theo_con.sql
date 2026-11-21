-- ─────────────────────────────────────────────────────────────────────────
-- Sửa hạng mục / đợt thanh toán / khoản thu → hợp đồng "vừa cập nhật"
-- (chạy SAU schema.sql)
--
-- Bản in hợp đồng (PDF/Word mà mstudo desktop lưu về máy) gồm cả hạng mục, kế
-- hoạch thanh toán và các khoản đã thu. Desktop chỉ tải lại khi updated_at của
-- hợp đồng đổi — mà sửa bảng con thì updated_at đứng im, nên file trên máy cứ
-- giữ bản cũ. Cổng khách cũng hiện "Cập nhật lúc…" sai vì cùng lý do.
--
-- Chạm updated_at của hợp đồng cha mỗi khi bảng con đổi. Điều kiện
-- `updated_at is distinct from now()` (now() cố định trong một giao dịch): chèn
-- 20 hạng mục một lượt cũng chỉ ghi hợp đồng cha MỘT lần.
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.touch_contract_from_child()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := coalesce(
    case when tg_op = 'DELETE' then null else new.contract_id end,
    case when tg_op = 'INSERT' then null else old.contract_id end
  );
begin
  if v_id is not null then
    update public.studio_contracts
       set updated_at = now()
     where id = v_id and updated_at is distinct from now();
  end if;
  return null;
end;
$$;

drop trigger if exists touch_contract on public.contract_items;
create trigger touch_contract
  after insert or update or delete on public.contract_items
  for each row execute function public.touch_contract_from_child();

drop trigger if exists touch_contract on public.contract_payments;
create trigger touch_contract
  after insert or update or delete on public.contract_payments
  for each row execute function public.touch_contract_from_child();

drop trigger if exists touch_contract on public.contract_payment_plan;
create trigger touch_contract
  after insert or update or delete on public.contract_payment_plan
  for each row execute function public.touch_contract_from_child();
