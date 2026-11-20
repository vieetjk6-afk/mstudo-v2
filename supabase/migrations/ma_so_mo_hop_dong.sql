-- ============================================================================
-- MÃ SỐ MỞ HỢP ĐỒNG — cho khách KHÔNG dùng điện thoại
--
-- Trang hợp đồng / trang riêng của khách (/c/<token>, /portal/<token>) lấy SĐT
-- khách làm mật khẩu. Khách không có (hoặc không muốn đưa) SĐT thì studio đặt
-- một MÃ SỐ ở đây; khách gõ mã đó vào đúng ô nhập SĐT để mở. Có cả hai thì
-- nhập cái nào cũng mở được.
--
-- Chỉ lưu chữ số (app tự bỏ ký tự khác). Chỉ cần bảng studio_contracts có từ
-- schema nền. Chạy lại an toàn.
-- ============================================================================

alter table public.studio_contracts
  add column if not exists client_passcode text;
