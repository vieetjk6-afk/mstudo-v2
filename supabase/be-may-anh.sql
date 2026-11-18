-- ══════════════════════════════════════════════════════════════════════════
-- mstudo — BÉ MÁY ẢNH — THÚ ẢO ĐIỂM DANH HẰNG NGÀY
--
-- File này do supabase/build-setup-all.mjs sinh ra — ĐỪNG sửa tay.
--
-- Cách dùng: Supabase → SQL Editor → dán TOÀN BỘ file này → Run.
-- Mọi câu lệnh đều idempotent nên chạy lại nhiều lần vô hại.
--
-- Chỉ gồm migration của riêng tính năng này: bảng pets (tên, phụ kiện) và
-- pet_claims (mỗi lần điểm danh / làm nhiệm vụ một dòng). Chỉ cần bảng
-- `profiles` có từ schema nền. Chạy lại cả file này cũng an toàn.
-- ══════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════
-- PHẦN 1 — TẠO BẢNG
-- ══════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/be_may_anh.sql — Bé Máy Ảnh: thú ảo trong dashboard — điểm danh & nhiệm vụ hằng ngày (chỉ cần profiles)
-- ══════════════════════════════════════════════════════════════════════════

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

alter table public.pets       enable row level security;

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

alter table public.pet_claims enable row level security;


-- ══════════════════════════════════════════════════════════════════════════
-- PHẦN 2 — CỘT BỔ SUNG, CHỈ MỤC, HÀM, TRIGGER, DỮ LIỆU MẶC ĐỊNH
-- ══════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/be_may_anh.sql — Bé Máy Ảnh: thú ảo trong dashboard — điểm danh & nhiệm vụ hằng ngày (chỉ cần profiles)
-- ══════════════════════════════════════════════════════════════════════════

-- Đọc toàn bộ lượt nhận của một người, mới nhất trước.
create index if not exists pet_claims_user_day_idx on public.pet_claims (user_id, day desc);


-- ══════════════════════════════════════════════════════════════════════════
-- PHẦN 3 — PHÂN QUYỀN, RLS & POLICY (chạy sau khi mọi bảng/cột đã có)
-- ══════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════
-- KIỂM TRA — bảng kết quả dưới đây là BẰNG CHỨNG đã chạy đúng chỗ.
-- Cột `co` phải là `t` (true) hết. Có `f` nào nghĩa là chưa xong.
-- ══════════════════════════════════════════════════════════════════════════
select 'album_people'   as thu, to_regclass('public.album_people')   is not null as co
union all
select 'album_photo_people', to_regclass('public.album_photo_people') is not null
union all
select 'album_faces', to_regclass('public.album_faces') is not null
union all
select 'photos.faces_scanned_at', exists (
  select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'photos' and column_name = 'faces_scanned_at')
union all
select 'albums.faces_clustered_at', exists (
  select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'albums' and column_name = 'faces_clustered_at');

