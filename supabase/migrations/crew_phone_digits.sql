-- ============================================================================
-- Tra thợ theo SĐT bằng CHỈ MỤC thay vì quét cả bảng
--
-- Vấn đề: SĐT trong sổ thợ lưu đúng như người ta gõ ("0912 345 678", "+84912…"),
-- nên cổng /crew không .eq() được, đành TẢI TOÀN BỘ contract_crew của MỌI studio
-- rồi lọc bằng JavaScript. Mỗi lần một thợ mở cổng là một lần đọc cả bảng — chi
-- phí tăng theo số studio trên nền tảng chứ không theo số việc của thợ đó, và
-- dữ liệu studio khác (tên khách, địa điểm) bị kéo vào bộ nhớ tiến trình dù
-- không bao giờ được trả ra.
--
-- Cách sửa: thêm cột SINH TỰ ĐỘNG chứa SĐT chỉ-số + chỉ mục trên nó. Postgres
-- tự cập nhật mỗi khi phone đổi, app chỉ việc .eq("phone_digits", …).
-- ============================================================================

alter table public.contract_crew
  add column if not exists phone_digits text
  generated always as (regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g')) stored;
create index if not exists contract_crew_phone_digits_idx
  on public.contract_crew (phone_digits);

alter table public.studio_crew
  add column if not exists phone_digits text
  generated always as (regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g')) stored;
create index if not exists studio_crew_phone_digits_idx
  on public.studio_crew (phone_digits);
