-- ============================================================================
-- Ghi chú NỘI BỘ cho hợp đồng
--
-- Hợp đồng trước giờ chỉ có `note` (điều khoản in ra) và `brief_note` (yêu cầu
-- của khách — hiện trong cổng khách, khách còn sửa được). Studio không có chỗ
-- nào ghi những điều chỉ người trong studio nên biết: "khách khó tính về giờ",
-- "bạn của chủ, đã bớt 1tr", "nhớ mang thêm đèn"… nên hay ghi nhầm vào Brief
-- và khách đọc được.
--
-- Cột này KHÔNG được đưa vào bất kỳ API công khai nào (/api/c, /api/form,
-- /api/book…): các route đó chọn cột tường minh, đừng đổi sang select("*").
--
-- Để NULL là không có gì — mọi hợp đồng cũ giữ nguyên.
-- ============================================================================

alter table public.studio_contracts
  add column if not exists internal_note text;

comment on column public.studio_contracts.internal_note is
  'Ghi chú nội bộ của studio về hợp đồng — KHÁCH KHÔNG THẤY. Không đưa vào API cổng khách.';
