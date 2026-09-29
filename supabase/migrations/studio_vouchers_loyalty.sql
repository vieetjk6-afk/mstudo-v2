-- ============================================================================
-- VOUCHER ƯU ĐÃI LẦN SAU (tặng khách đã ký hợp đồng)
--
-- Khác thẻ quà (studio_vouchers.sql) ở chỗ: studio TẶNG, không bán. Nên:
--   · Không có tiền vào lúc tặng (paid = true, price = 0 cho mọi màn tính trạng
--     thái "còn hiệu lực" dùng chung một luật).
--   · Dùng ở hợp đồng sau = một DÒNG GIẢM GIÁ (contract_items, unit_price âm),
--     KHÔNG phải khoản thu. Ghi thành khoản thu thì báo cáo doanh thu / quỹ
--     tiền mặt đếm cả tiền chưa bao giờ vào túi.
--   · Giảm theo số tiền (amount) HOẶC theo % tổng hợp đồng (percent, có thể
--     chặn trần max_discount).
--   · Không dùng được ở chính hợp đồng đã tặng nó (source_contract_id).
--   · public_token: link /voucher/<token> in trong mã QR — khách quét để đặt
--     lịch kèm mã, hoặc lưu ảnh voucher về điện thoại.
--
-- Đặt lịch kèm voucher: studio_bookings.voucher_code. Chỉ GHI NHỚ mã, chưa trừ;
-- trừ khi studio chuyển yêu cầu thành hợp đồng (lúc đó mới có tổng để tính %).
--
-- Chạy SAU studio_vouchers.sql. Chạy 1 lần trong Supabase SQL Editor. An toàn
-- khi chạy lại.
-- ============================================================================

do $$
begin
  if to_regclass('public.studio_vouchers') is null then
    raise exception 'Thiếu bảng studio_vouchers. Hãy chạy supabase/migrations/studio_vouchers.sql trước.';
  end if;
end $$;

alter table public.studio_vouchers add column if not exists kind text not null default 'gift';
alter table public.studio_vouchers add column if not exists discount_type text not null default 'amount';
alter table public.studio_vouchers add column if not exists percent smallint;
alter table public.studio_vouchers add column if not exists max_discount integer;
alter table public.studio_vouchers add column if not exists source_contract_id uuid references public.studio_contracts (id) on delete set null;
alter table public.studio_vouchers add column if not exists public_token text;

alter table public.studio_vouchers drop constraint if exists studio_vouchers_kind_check;
alter table public.studio_vouchers add constraint studio_vouchers_kind_check check (kind in ('gift', 'loyalty'));
alter table public.studio_vouchers drop constraint if exists studio_vouchers_discount_type_check;
alter table public.studio_vouchers add constraint studio_vouchers_discount_type_check check (discount_type in ('amount', 'percent'));

-- Voucher % không có mệnh giá cố định → nới "amount > 0" thành luật theo loại.
alter table public.studio_vouchers drop constraint if exists studio_vouchers_amount_check;
alter table public.studio_vouchers drop constraint if exists studio_vouchers_value_check;
alter table public.studio_vouchers add constraint studio_vouchers_value_check check (
  (discount_type = 'amount' and amount > 0)
  or (discount_type = 'percent' and percent between 1 and 100 and amount >= 0 and (max_discount is null or max_discount > 0))
);

create unique index if not exists studio_vouchers_public_token_key on public.studio_vouchers (public_token) where public_token is not null;
create index if not exists studio_vouchers_source_idx on public.studio_vouchers (source_contract_id) where source_contract_id is not null;

alter table public.studio_bookings add column if not exists voucher_code text;
