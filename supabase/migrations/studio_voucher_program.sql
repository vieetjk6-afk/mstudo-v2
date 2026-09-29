-- ============================================================================
-- CHƯƠNG TRÌNH VOUCHER ƯU ĐÃI (tự gắn vào mọi hợp đồng)
--
-- Studio cài MỘT lần ở màn Voucher & thẻ quà: tặng khách X% giá trị hợp đồng
-- (có trần), dùng cho hợp đồng lần sau. Chương trình TẮT sẵn — studio bật mới
-- có hiệu lực.
--
-- Vòng đời trên từng hợp đồng (không cần studio bấm gì):
--   · Chưa ký       → cổng khách hiện "nhận voucher lên đến …" để thu hút chốt.
--   · Khách đã ký, chưa đủ điều kiện → "voucher kích hoạt khi studio xác nhận cọc".
--   · Khách ký + studio xác nhận cọc (có lần thu) + studio ký → máy chủ PHÁT
--     voucher thật (studio_vouchers, kind 'loyalty', program_issued) với số tiền
--     = % × tổng hợp đồng lúc đó.
--   · Hợp đồng bị huỷ → voucher chưa dùng tự huỷ (trigger bên dưới).
--
-- Từng hợp đồng chỉnh được: studio_contracts.loyalty_percent
--   null = theo chương trình · 0 = tắt cho hợp đồng này · n = n% riêng.
--
-- Chạy SAU studio_vouchers_loyalty.sql. An toàn khi chạy lại.
-- ============================================================================

do $$
begin
  if to_regclass('public.studio_vouchers') is null then
    raise exception 'Thiếu bảng studio_vouchers. Hãy chạy supabase/voucher-uu-dai.sql trước.';
  end if;
end $$;

create table if not exists public.studio_voucher_program (
  owner_id      uuid primary key references public.profiles (id) on delete cascade,
  enabled       boolean not null default false,
  percent       smallint not null default 5 check (percent between 1 and 100),
  max_discount  integer check (max_discount is null or max_discount > 0),
  -- null = không giới hạn thời gian
  valid_months  smallint check (valid_months is null or valid_months between 1 and 120),
  title         text not null default 'Voucher ưu đãi lần sau',
  updated_at    timestamptz not null default now()
);
alter table public.studio_voucher_program enable row level security;

drop policy if exists studio_voucher_program_member_read on public.studio_voucher_program;
create policy studio_voucher_program_member_read on public.studio_voucher_program
  for select using (public.is_studio_member(owner_id));

alter table public.studio_contracts add column if not exists loyalty_percent smallint;
alter table public.studio_contracts drop constraint if exists studio_contracts_loyalty_percent_check;
alter table public.studio_contracts add constraint studio_contracts_loyalty_percent_check
  check (loyalty_percent is null or loyalty_percent between 0 and 100);

-- Voucher do chương trình phát: mỗi hợp đồng đúng MỘT cái, kể cả khi cổng khách
-- và màn studio cùng mở một lúc (insert trùng thì chỉ một bên thắng).
alter table public.studio_vouchers add column if not exists program_issued boolean not null default false;
create unique index if not exists studio_vouchers_program_one_per_contract
  on public.studio_vouchers (source_contract_id) where program_issued;

-- Hợp đồng bị huỷ → voucher ưu đãi CHƯA DÙNG của nó tự huỷ.
create or replace function public.voucher_void_on_contract_cancel()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    update public.studio_vouchers
       set status = 'void'
     where source_contract_id = new.id and kind = 'loyalty' and status = 'active';
  end if;
  return new;
end $$;
drop trigger if exists voucher_void_on_contract_cancel on public.studio_contracts;
create trigger voucher_void_on_contract_cancel after update of status on public.studio_contracts
  for each row execute function public.voucher_void_on_contract_cancel();

-- ── Phạm vi áp dụng ─────────────────────────────────────────────────────────
-- wedding_only: chương trình chỉ cho dùng voucher ở hợp đồng GÓI PHÓNG SỰ CƯỚI.
-- applies_to trên từng voucher chốt luật lúc phát ('wedding' | null = mọi gói),
-- để studio đổi cài đặt sau này không làm đổi voucher khách đang cầm.
alter table public.studio_voucher_program add column if not exists wedding_only boolean not null default true;
alter table public.studio_vouchers add column if not exists applies_to text;
alter table public.studio_vouchers drop constraint if exists studio_vouchers_applies_to_check;
alter table public.studio_vouchers add constraint studio_vouchers_applies_to_check check (applies_to is null or applies_to in ('wedding'));

-- ── Gói được áp dụng (studio tự chọn) ───────────────────────────────────────
-- package_names: tên các gói trong bảng giá (studio_pricelist.name) mà voucher
-- được dùng. Rỗng / null = mọi gói. Voucher chốt danh sách lúc phát
-- (applies_packages) — studio đổi cài đặt sau không đổi voucher khách đang cầm.
-- (wedding_only / applies_to của bản trước không còn dùng.)
alter table public.studio_voucher_program add column if not exists package_names text[];
alter table public.studio_vouchers add column if not exists applies_packages text[];
