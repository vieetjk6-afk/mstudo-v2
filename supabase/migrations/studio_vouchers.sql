-- ============================================================================
-- VOUCHER / THẺ QUÀ TẶNG CỦA STUDIO
--
-- Mùa 14/2, 8/3, 20/10, Tết là mùa bán thẻ quà "Voucher chụp ảnh 2 triệu".
-- Trước đây studio ghi sổ tay: không biết thẻ nào đã dùng, thẻ nào hết hạn,
-- và khách mang thẻ tới thì trừ tiền hợp đồng bằng cách… sửa giá.
--
-- CÁCH HẠCH TOÁN (quan trọng — sai là đếm tiền hai lần):
--   · Bán thẻ: tiền vào nhưng CHƯA phải doanh thu — studio còn nợ khách một
--     buổi chụp. Ghi ở studio_vouchers (price, paid), KHÔNG ghi contract_payments.
--   · Khách dùng thẻ ở hợp đồng: ghi MỘT khoản thu kind = 'voucher' bằng mệnh
--     giá. Lúc đó mới là doanh thu, và công nợ hợp đồng tự trừ đúng.
--   · Xoá khoản thu voucher → trigger trả thẻ về "còn hiệu lực" (dùng lại được).
--
-- Ghi thẻ CHỈ qua route máy chủ /api/studio/vouchers (service role) để mọi thao
-- tác vào nhật ký kèm người thật. Thành viên studio chỉ đọc.
--
-- Chạy SAU contract_cancel_reschedule.sql (cùng sửa ràng buộc kind của
-- contract_payments — bản ở đây là tập cha, gồm cả 'refund').
-- Chạy 1 lần trong Supabase SQL Editor. An toàn khi chạy lại.
-- ============================================================================

do $$
begin
  if to_regclass('public.contract_payments') is null or to_regclass('public.studio_contracts') is null then
    raise exception 'Thiếu bảng nền contract_payments / studio_contracts. Hãy chạy supabase/setup-all.sql trước.';
  end if;
end $$;

create table if not exists public.studio_vouchers (
  id                   uuid primary key default gen_random_uuid(),
  owner_id             uuid not null references public.profiles (id) on delete cascade,
  code                 text not null,
  title                text not null default 'Voucher chụp ảnh',
  amount               integer not null check (amount > 0),      -- mệnh giá (VND)
  price                integer not null default 0 check (price >= 0), -- giá bán thực thu
  buyer_name           text,
  buyer_phone          text,
  recipient_name       text,
  paid                 boolean not null default false,
  paid_method          text,
  paid_at              date,
  expires_on           date,
  status               text not null default 'active' check (status in ('active', 'redeemed', 'void')),
  redeemed_contract_id uuid references public.studio_contracts (id) on delete set null,
  redeemed_payment_id  uuid references public.contract_payments (id) on delete set null,
  redeemed_at          timestamptz,
  note                 text,
  created_by           uuid references public.profiles (id) on delete set null,
  created_at           timestamptz not null default now(),
  unique (owner_id, code)
);
create index if not exists studio_vouchers_owner_idx on public.studio_vouchers (owner_id, created_at desc);

alter table public.studio_vouchers enable row level security;
drop policy if exists studio_vouchers_member_read on public.studio_vouchers;
create policy studio_vouchers_member_read on public.studio_vouchers
  for select using (public.is_studio_member(owner_id));

-- Khoản thu loại 'voucher'.
alter table public.contract_payments drop constraint if exists contract_payments_kind_check;
alter table public.contract_payments add constraint contract_payments_kind_check
  check (kind in ('deposit', 'installment', 'final', 'other', 'refund', 'voucher'));

-- Xoá khoản thu voucher (ghi nhầm hợp đồng…) → thẻ quay về "còn hiệu lực".
create or replace function public.voucher_release_on_payment_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.kind = 'voucher' then
    update public.studio_vouchers
       set status = 'active', redeemed_contract_id = null, redeemed_payment_id = null, redeemed_at = null
     where redeemed_payment_id = old.id and status = 'redeemed';
  end if;
  return old;
end $$;
drop trigger if exists voucher_release_on_payment_delete on public.contract_payments;
create trigger voucher_release_on_payment_delete before delete on public.contract_payments
  for each row execute function public.voucher_release_on_payment_delete();
