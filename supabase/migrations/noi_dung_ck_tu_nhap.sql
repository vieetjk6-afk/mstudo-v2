-- ============================================================================
-- Nội dung chuyển khoản trên QR hợp đồng: thêm lựa chọn studio TỰ NHẬP
--
-- profiles.qr_note_template — null / rỗng = dùng lựa chọn có sẵn (chỉ số HĐ,
-- hoặc số HĐ + ngày theo qr_note_date). Có nội dung = dùng đúng chữ studio
-- nhập, chèn được {so_hd} và {ngay}; app tự bỏ dấu tiếng Việt. Studio đã bật
-- SePay thì mã đợt MS… vẫn tự thêm ở đầu.
--
-- Chạy trên Supabase SQL Editor. An toàn khi chạy lại (idempotent).
-- ============================================================================

alter table public.profiles add column if not exists qr_note_template text;

-- Vá C1 đã thu hồi quyền UPDATE cả bảng profiles — cấp riêng cột mới.
grant update (qr_note_template) on public.profiles to authenticated;
