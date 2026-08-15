-- ============================================================================
-- BỘ ĐẾM HOẠT ĐỘNG TÀI KHOẢN
--
-- Vì sao cần: admin mstudo không có cách nào biết một studio còn dùng phần mềm
-- hay đã bỏ. Cột created_at chỉ nói lúc họ đăng ký, còn plan_expires_at chỉ nói
-- họ trả tiền tới bao giờ — cả hai đều không nói họ CÓ MỞ APP hay không. Kết quả
-- là không phân biệt được tài khoản đang dùng thật với tài khoản đăng ký rồi bỏ.
--
-- Đo bằng SỐ NGÀY có hoạt động, không phải số lượt mở. Một người mở 50 lần trong
-- một ngày không "dùng nhiều" hơn người mở đúng một lần mỗi ngày suốt 50 ngày —
-- đếm lượt sẽ thưởng nhầm cho hành vi bồn chồn thay vì thói quen dùng đều.
--
-- Chạy 1 lần trong Supabase SQL Editor.
-- ============================================================================

-- Lần cuối tài khoản mở khu quản lý. null = chưa mở lần nào kể từ khi có bộ đếm.
alter table public.profiles add column if not exists last_active_at timestamptz;

-- Ngày (giờ VN) của lần hoạt động gần nhất. Lưu riêng dạng date để biết "đã sang
-- ngày mới chưa" bằng một phép so, không phải tính lại múi giờ mỗi lần ghi.
alter table public.profiles add column if not exists last_active_day date;

-- Tổng số NGÀY KHÁC NHAU có hoạt động. Đây là con số dùng để đánh giá độ gắn bó.
alter table public.profiles add column if not exists active_days integer not null default 0;

-- Tổng số phiên (mỗi lần mở app sau ít nhất 15 phút im lặng tính là một phiên).
-- Giữ để so với active_days: nhiều phiên trên ít ngày = dùng dồn dập rồi bỏ.
alter table public.profiles add column if not exists visit_count integer not null default 0;

-- Admin lọc "ai đã im lặng lâu nhất" → sắp theo cột này, nên đánh index.
-- nulls first để tài khoản CHƯA BAO GIỜ mở app nổi lên đầu — đó chính là nhóm
-- cần gọi điện trước.
create index if not exists profiles_last_active_idx
  on public.profiles (last_active_at desc nulls first);

-- ── KHÔNG cấp quyền UPDATE các cột này cho `authenticated` ──────────────────
-- Cố ý: migrations/c1_profiles_column_grants.sql đã thu hồi UPDATE toàn bảng và
-- chỉ cấp lại theo cột. Bộ đếm hoạt động CHỈ được ghi từ máy chủ qua service-role
-- (src/app/api/activity/ping). Cấp cho client thì người dùng tự bơm số của mình,
-- và số liệu để ra quyết định kinh doanh mà bịa được thì vô dụng.
