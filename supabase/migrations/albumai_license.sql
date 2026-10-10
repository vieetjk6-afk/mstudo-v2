-- ============================================================================
-- Bản quyền Album AI (albumai.mstudo.com) TẶNG 1 NĂM cho chủ studio gói Studio
--
-- Album AI là phần mềm riêng; bản quyền gắn với EMAIL tài khoản mstudo. Khi chủ
-- studio đăng nhập Album AI, máy chủ Album AI gọi POST /api/albumai/license —
-- lần gọi ĐẦU TIÊN của một tài khoản Studio đủ điều kiện ghi hai cột dưới đây:
--
--   albumai_activated_at  lúc kích hoạt (bắt đầu đếm 1 năm)
--   albumai_expires_at    hết hạn = kích hoạt + 1 năm
--
-- Đã ghi rồi thì không ghi lại: đăng nhập lại không kéo dài thêm năm nữa, và
-- đổi gói sau đó cũng không thu hồi quà đã tặng.
--
-- Hai cột chỉ service-role ghi (route API ở máy chủ). KHÔNG cấp UPDATE cho
-- authenticated — xem migrations/c1_profiles_column_grants.sql: cột mới không
-- nằm trong danh sách grant nên người dùng không tự gia hạn được.
--
-- Để NULL là chưa kích hoạt — mọi tài khoản cũ giữ nguyên.
-- Chạy trên Supabase SQL Editor. An toàn khi chạy lại (idempotent).
-- ============================================================================

alter table public.profiles add column if not exists albumai_activated_at timestamptz;
alter table public.profiles add column if not exists albumai_expires_at timestamptz;

comment on column public.profiles.albumai_activated_at is
  'Lúc kích hoạt bản quyền Album AI tặng kèm gói Studio (lần đầu đăng nhập Album AI bằng email này). Chỉ service-role ghi.';
comment on column public.profiles.albumai_expires_at is
  'Hết hạn bản quyền Album AI tặng kèm gói Studio (= kích hoạt + 1 năm). Chỉ service-role ghi.';
