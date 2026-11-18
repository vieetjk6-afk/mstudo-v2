-- ============================================================================
-- BÉ MÁY ẢNH — thú ảo trong dashboard, để người dùng mstudo quay lại mỗi ngày.
--
-- Mỗi TÀI KHOẢN đăng nhập (chủ studio lẫn nhân viên) nuôi một bé riêng. Bé lớn
-- lên nhờ điểm danh hằng ngày và làm việc thật trong app (tạo album, tạo hợp
-- đồng, ghi khoản thu). Luật chơi nằm ở src/lib/pet.ts, API ở /api/pet.
--
-- Vì sao KHÔNG lưu cột xp / streak trên bảng bé: hai lượt bấm cùng lúc sẽ đọc
-- cùng một số cũ rồi ghi đè nhau. Ở đây mỗi lần nhận thưởng là MỘT DÒNG trong
-- pet_claims với khoá chính (user_id, day, task) — Postgres tự chặn nhận trùng,
-- còn tổng XP và chuỗi ngày được TÍNH LẠI từ các dòng đó. Không có gì để lệch.
--
-- Cả hai bảng chỉ đi qua API máy chủ (service-role). Bật RLS mà KHÔNG mở policy
-- nào: trình duyệt không tự cộng XP cho mình được.
--
-- Chạy 1 lần trong Supabase SQL Editor; an toàn khi chạy lại.
-- ============================================================================

create table if not exists public.pets (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  -- Tên người dùng đặt cho bé. Giới hạn độ dài ở tầng API (cleanName).
  name       text not null default 'Bé Chớp',
  -- Phụ kiện đang đeo — khoá thuộc tập đóng OUTFITS trong src/lib/pet.ts.
  -- null = không đeo gì. Không đặt check constraint: thêm phụ kiện mới không
  -- phải sửa DB, khoá lạ thì code bỏ qua.
  outfit     text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pet_claims (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  -- Ngày theo giờ Việt Nam (todayVN) — sang ngày mới là nhận lại được.
  day        date not null,
  -- 'feed' (điểm danh) hoặc một nhiệm vụ trong TASKS của src/lib/pet.ts.
  task       text not null,
  -- XP đã cộng ở lần nhận này (gồm cả thưởng chuỗi ngày nếu có).
  xp         integer not null check (xp >= 0 and xp <= 500),
  created_at timestamptz not null default now(),
  primary key (user_id, day, task)
);

-- Đọc toàn bộ lượt nhận của một người, mới nhất trước.
create index if not exists pet_claims_user_day_idx on public.pet_claims (user_id, day desc);

alter table public.pets       enable row level security;
alter table public.pet_claims enable row level security;
