-- ─────────────────────────────────────────────────────────────────────────
-- Dịch vụ: gắn LOẠI DỊCH VỤ cho từng dịch vụ của studio
--
-- Vì sao: trước bản này không có sợi dây nào nối `shoot_type` của hợp đồng
-- (photo / makeup / rental / wedding…) với dịch vụ và bảng giá. Hậu quả ở màn
-- tạo hợp đồng: chọn "Trang điểm" xong bảng giá vẫn hiện nguyên các gói chụp
-- cưới, và studio phải tự tay chọn lại điều khoản cho khớp.
--
-- Bảng giá VỐN ĐÃ gắn với dịch vụ (studio_pricelist.list_key có thể là id của
-- một dịch vụ), nên chỉ cần gắn loại vào DỊCH VỤ là cả chuỗi chạy:
--
--   loại dịch vụ → dịch vụ (điều khoản) → bảng giá của dịch vụ đó
--
-- NULL = "mọi loại": dịch vụ dùng chung, luôn hiện ra dù chọn loại nào. Đây là
-- giá trị của MỌI dịch vụ đã có sẵn — cố ý, để studio đang chạy không thấy
-- bảng giá đột nhiên trống. Họ vào Cấu hình → Dịch vụ gắn loại cho từng cái
-- thì lọc mới bắt đầu có tác dụng.
--
-- Không đặt ràng buộc check ở đây: danh sách loại dịch vụ nằm trong
-- studio_contracts.shoot_type và còn nở ra; hai chỗ ràng buộc rời nhau thì
-- thêm loại mới phải nhớ sửa cả hai, sót một là lưu bị từ chối mà không rõ vì
-- sao. App đã chặn bằng ô chọn (SHOOT_TYPES).
--
-- KHÔNG đổi dữ liệu cũ. Chạy được nhiều lần.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.studio_services
  add column if not exists shoot_type text;
