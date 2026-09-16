-- ============================================================================
-- Mô tả cho từng hạng mục hợp đồng
--
-- Một hạng mục trước giờ chỉ có TÊN, số lượng và đơn giá. Tên thì phải ngắn để
-- bảng in không vỡ dòng, nên studio hay phải nhét cả phạm vi công việc vào đó:
--
--     "Chụp phóng sự cả ngày (2 thợ, 8h, 300 ảnh sửa màu, giao trong 20 ngày)"
--
-- Đọc trên bản in thì rối, mà khách vẫn hay hỏi lại "gói này gồm những gì".
-- Thêm một ô mô tả tự do cho mỗi hạng mục: tên giữ ngắn, chi tiết xuống dòng
-- dưới, in nhỏ hơn và nhạt hơn ở cả bản in lẫn cổng khách.
--
-- Để NULL / để trống là không hiện gì — mọi hợp đồng cũ giữ nguyên như trước.
-- ============================================================================

alter table public.contract_items
  add column if not exists description text;

comment on column public.contract_items.description is
  'Mô tả chi tiết hạng mục (phạm vi công việc, số lượng ảnh, thời gian giao…). Để trống thì không hiện.';
