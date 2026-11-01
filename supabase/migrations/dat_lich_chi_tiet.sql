-- ============================================================================
-- Đặt lịch chi tiết + SĐT / địa chỉ cô dâu, chú rể trên hợp đồng
--
-- 1) studio_bookings.details (jsonb) — phần khách điền thêm ở form /book:
--      { packages: [{name, price}],            -- khách chọn NHIỀU gói
--        event_label: "Lễ nhà gái",            -- tên ngày chính (khách tự đặt)
--        extra_days: [{label, date}],          -- ngày phụ
--        bride: {name, phone, address},        -- đám cưới
--        groom: {name, phone, address} }
--    Một cột jsonb thay vì cả chục cột: đây là dữ liệu khách gửi, studio đọc
--    rồi chuyển thành hợp đồng — không lọc / sắp xếp theo từng trường.
--    package_name / package_price / preferred_date vẫn được ghi như cũ (tên
--    các gói nối lại, tổng giá, ngày chính) để mọi màn cũ vẫn đúng.
--
-- 2) studio_contracts.bride_phone / bride_address / groom_phone / groom_address.
--
-- Chạy trên Supabase SQL Editor. An toàn khi chạy lại (idempotent).
-- ============================================================================

alter table public.studio_bookings add column if not exists details jsonb;

alter table public.studio_contracts add column if not exists bride_phone   text;
alter table public.studio_contracts add column if not exists bride_address text;
alter table public.studio_contracts add column if not exists groom_phone   text;
alter table public.studio_contracts add column if not exists groom_address text;
