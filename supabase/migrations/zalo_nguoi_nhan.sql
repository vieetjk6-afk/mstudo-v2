-- ============================================================================
-- NHỚ NGƯỜI NHẬN ZALO CHO HỢP ĐỒNG / ALBUM
--
-- Khách tắt "cho phép tìm bằng SĐT" (hoặc SĐT trên hợp đồng không phải số
-- Zalo) thì "Gửi Zalo" theo SĐT báo không tìm thấy, studio phải mở danh sách
-- bạn chọn tay — MỖI LẦN gửi. Lưu người đã chọn lên hợp đồng/album để lần sau
-- nút thành "Gửi Zalo cho <tên>", một cú bấm là tới đúng người. Tin tự động
-- (autoNotify, cron) cũng dùng luôn người đã lưu.
--
-- • zalo_uid : uid Zalo người nhận (theo tài khoản Zalo của studio)
-- • zalo_name: tên bạn Zalo lúc chọn (hiện trên nút)
-- • zalo_self: personal_self.id của tài khoản Zalo studio lúc lưu — uid Zalo
--   chỉ có nghĩa với đúng tài khoản đã tra ra nó; studio đổi sang số Zalo khác
--   thì uid cũ bị bỏ qua, gửi lại theo SĐT như thường.
--
-- Chỉ máy chủ ghi các cột này (service-role, src/lib/zalo/send.ts) sau khi đã
-- lọc owner_id — không cần grant cột riêng (hai bảng không dùng grant theo cột).
-- Bản web chịu được lúc CHƯA chạy file này: thiếu cột thì không nhớ gì, gửi
-- như cũ.
--
-- Chạy 1 lần trong Supabase SQL Editor. An toàn khi chạy lại.
-- ============================================================================

alter table public.studio_contracts
  add column if not exists zalo_uid  text,
  add column if not exists zalo_name text,
  add column if not exists zalo_self text;

alter table public.albums
  add column if not exists zalo_uid  text,
  add column if not exists zalo_name text,
  add column if not exists zalo_self text;

-- Tra "hợp đồng khác cùng khách đã có người nhận" (lọc owner + tài khoản Zalo).
create index if not exists studio_contracts_zalo_saved_idx
  on public.studio_contracts (owner_id, zalo_self, updated_at desc)
  where zalo_uid is not null;

notify pgrst, 'reload schema';
