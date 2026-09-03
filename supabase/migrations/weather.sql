-- ============================================================================
-- THỜI TIẾT & ĐƯỜNG ĐI CHO BUỔI CHỤP NGOẠI CẢNH
--
-- Rủi ro lớn nhất của studio ngoại cảnh là mưa, mà app chưa nói gì về nó dù đã
-- lưu ngày giờ (studio_appointments) và địa điểm (dạng chữ) của từng buổi.
--
-- Để tra dự báo cần TOẠ ĐỘ. Hiện toạ độ chỉ nằm rải rác trong
-- studio_contracts.intake (jsonb do khách điền qua LocationPicker) — không đọc
-- được nhanh, và không có gì cho những buổi studio tự tạo. Migration này thêm
-- hai cột toạ độ vào đúng nơi cần, cộng MỘT vị trí studio làm điểm xuất phát để
-- ước lượng đường đi.
--
-- Không thêm bảng nào. Chạy 1 lần trong Supabase SQL Editor; an toàn khi chạy lại.
-- ============================================================================

-- ── Kiểm tra điều kiện ──────────────────────────────────────────────────────
-- Cùng cách làm với các migration khác: thiếu bảng nền thì nói rõ phải làm gì,
-- thay vì để Postgres trả về 42P01 trần trụi.
do $$
declare missing text[] := '{}';
begin
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'studio_appointments')
  then missing := missing || 'studio_appointments'; end if;
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'studio_contracts')
  then missing := missing || 'studio_contracts'; end if;

  if array_length(missing, 1) > 0 then
    raise exception
      'Thiếu bảng nền: %. Hãy chạy supabase/setup-all.sql trước (nó gồm cả schema nền lẫn migration này).',
      array_to_string(missing, ', ');
  end if;
end $$;

-- ── Toạ độ điểm chụp ────────────────────────────────────────────────────────
-- Kiểu double precision (không phải numeric): đây là toạ độ để tra dự báo và
-- ước lượng đường đi, độ chính xác dấu phẩy động là quá đủ, và nhẹ hơn.
--
-- null = chưa biết. Lúc đó lớp đọc dự báo tự thử hai đường khác: đọc toạ độ nằm
-- sẵn trong chuỗi địa điểm (link Google Maps studio dán vào), rồi mới tra tên
-- địa danh — xem `coordsInText` / `placeQuery` trong src/lib/weather.ts.
alter table public.studio_appointments add column if not exists lat double precision;
alter table public.studio_appointments add column if not exists lng double precision;

alter table public.studio_contracts add column if not exists lat double precision;
alter table public.studio_contracts add column if not exists lng double precision;

-- ── Vị trí studio (điểm xuất phát) ──────────────────────────────────────────
-- Một studio một địa chỉ: dùng làm điểm bắt đầu để ước lượng thời gian di
-- chuyển tới điểm chụp. Studio nhiều chi nhánh thì đây là cơ sở chính; ước
-- lượng đường đi vốn chỉ để xếp lịch trong ngày nên không cần chính xác hơn.
alter table public.profiles add column if not exists studio_lat double precision;
alter table public.profiles add column if not exists studio_lng double precision;
alter table public.profiles add column if not exists studio_address text;

-- BẮT BUỘC: migrations/c1_profiles_column_grants.sql đã THU HỒI quyền UPDATE
-- toàn bảng profiles và chỉ cấp lại theo từng cột. Không cấp ba cột này thì thẻ
-- "Vị trí studio" lưu sẽ im lặng không đổi được gì.
-- Cả ba đều vô hại (toạ độ + địa chỉ), không phải cột nhạy cảm như role/plan.
grant update (studio_lat, studio_lng, studio_address) on public.profiles to authenticated;

-- ── Kiểm tra sau khi chạy ───────────────────────────────────────────────────
-- select column_name from information_schema.columns
-- where table_schema = 'public' and table_name = 'studio_appointments'
--   and column_name in ('lat', 'lng');
