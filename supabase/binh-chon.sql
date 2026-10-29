-- ══════════════════════════════════════════════════════════════════════════
-- mstudo — BÌNH CHỌN HỆ THỐNG — ADMIN HỎI Ý KIẾN MỌI TÀI KHOẢN
--
-- File này do supabase/build-setup-all.mjs sinh ra — ĐỪNG sửa tay.
--
-- Cách dùng: Supabase → SQL Editor → dán TOÀN BỘ file này → Run.
-- Mọi câu lệnh đều idempotent nên chạy lại nhiều lần vô hại.
--
-- Chỉ gồm migration của riêng tính năng này: bảng system_polls (câu hỏi,
-- phương án) và system_poll_votes (mỗi người một phiếu). Chỉ cần bảng
-- `profiles` có từ schema nền. Chạy lại cả file này cũng an toàn.
-- ══════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════
-- PHẦN 1 — TẠO BẢNG
-- ══════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/binh_chon.sql — Bình chọn hệ thống: admin hỏi ý kiến mọi tài khoản, người dùng bỏ phiếu trong dashboard
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- Bình chọn hệ thống — admin hỏi ý kiến mọi tài khoản (vd. "Chuyển giao diện
-- mới thành mặc định?"). Người dùng thấy một thẻ nổi trong dashboard, chọn một
-- hay nhiều phương án, bấm "Bình chọn" rồi xem kết quả.
--
-- Cả hai bảng chỉ đi qua API máy chủ (service-role): /api/polls (người dùng) và
-- /api/admin/polls (admin). Bật RLS mà KHÔNG mở policy nào — client trình duyệt
-- không đọc/ghi thẳng được, nên không ai sửa phiếu của người khác hay xem ai
-- chọn gì.
-- ============================================================================

create table if not exists public.system_polls (
  id         uuid primary key default gen_random_uuid(),
  question   text not null,
  -- Danh sách phương án, theo thứ tự hiển thị. Phiếu lưu CHỈ SỐ (0, 1, 2…).
  options    text[] not null,
  -- true = chọn được nhiều phương án.
  multi      boolean not null default false,
  -- everyone = mọi tài khoản đang hoạt động (kể cả nhân viên);
  -- owners   = chỉ chủ tài khoản.
  audience   text not null default 'everyone',
  -- Đang mở thì người dùng thấy thẻ bình chọn; đóng thì không ai bỏ phiếu nữa.
  active     boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  closed_at  timestamptz
);

alter table public.system_polls enable row level security;

-- Mỗi người MỘT phiếu cho mỗi bình chọn (bỏ phiếu lại = sửa phiếu cũ).
create table if not exists public.system_poll_votes (
  poll_id    uuid not null references public.system_polls (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  choices    smallint[] not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);

alter table public.system_poll_votes enable row level security;


-- ══════════════════════════════════════════════════════════════════════════
-- PHẦN 2 — CỘT BỔ SUNG, CHỈ MỤC, HÀM, TRIGGER, DỮ LIỆU MẶC ĐỊNH
-- ══════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/binh_chon.sql — Bình chọn hệ thống: admin hỏi ý kiến mọi tài khoản, người dùng bỏ phiếu trong dashboard
-- ══════════════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'system_polls_audience_check') then
    alter table public.system_polls
      add constraint system_polls_audience_check check (audience in ('everyone', 'owners'));
  end if;
end $$;

create index if not exists system_polls_active_idx on public.system_polls (active, created_at desc);


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

