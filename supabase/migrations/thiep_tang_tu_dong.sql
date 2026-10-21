-- ============================================================================
-- TỰ TẶNG THIỆP CƯỚI ONLINE TRƯỚC NGÀY CƯỚI
--
-- Luật tự động "Trước ngày cưới → tặng thiệp cưới online" (src/lib/automations.ts,
-- gift_invitation): còn khoảng một tháng tới ngày thực hiện thì cron tự tạo thiệp
-- cưới online cho hợp đồng (điền sẵn tên, ngày, địa điểm) và gửi khách link để tự
-- sửa. Mặc định chỉ tặng hợp đồng GÓI PHÓNG SỰ CƯỚI.
--
-- Cột dưới đây là lựa chọn RIÊNG của studio cho từng hợp đồng:
--   • true  = tặng thiệp (kể cả hợp đồng không phải gói phóng sự)
--   • false = không tặng (kể cả gói phóng sự)
--   • null  = theo gói (gói phóng sự cưới thì tặng) — mặc định
--
-- Studio sửa cột này từ trang hợp đồng (bảng studio_contracts không dùng grant
-- theo cột, RLS của bảng là đủ). Bản web chịu được lúc CHƯA chạy file này: thiếu
-- cột thì mọi hợp đồng coi như "theo gói".
--
-- Chạy 1 lần trong Supabase SQL Editor. An toàn khi chạy lại.
-- ============================================================================

alter table public.studio_contracts
  add column if not exists gift_invitation boolean;

comment on column public.studio_contracts.gift_invitation is
  'Tự tặng thiệp cưới online trước ngày cưới: true = tặng, false = không tặng, null = theo gói (phóng sự cưới thì tặng).';

notify pgrst, 'reload schema';
