-- ══════════════════════════════════════════════════════════════════════════
-- mstudo — API KEY AI NHẬP TRONG TRANG QUẢN TRỊ
--
-- File này do supabase/build-setup-all.mjs sinh ra — ĐỪNG sửa tay.
--
-- Cách dùng: Supabase → SQL Editor → dán TOÀN BỘ file này → Run.
-- Mọi câu lệnh đều idempotent nên chạy lại nhiều lần vô hại.
--
-- Chỉ gồm migration của riêng tính năng này: bảng key chung của admin và
-- bảng key riêng của từng studio. Chỉ cần bảng `profiles` có từ schema nền.
-- Tách riêng để hàng rào của tính năng khác không kéo nó rollback theo.
-- ══════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════
-- PHẦN 1 — TẠO BẢNG
-- ══════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/ai_providers.sql — API key AI nhập trong trang quản trị: key chung của admin + key riêng của từng studio (đã mã hoá)
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- MStudo — API key AI nhập trong trang quản trị (thay cho biến CHAT_PROVIDERS).
--
-- Hai nơi lưu, bot thử theo thứ tự:
--   1. studio_ai_providers — key RIÊNG của từng studio (trang Chatbox). Studio
--      tự trả tiền AI; hỏng/hết hạn mức thì bot rơi xuống key chung.
--   2. admin_ai_providers  — key CHUNG do admin nhập (Quản trị hệ thống), dùng
--      cho mọi studio. Để trống thì code dùng CHAT_PROVIDERS trên Vercel như cũ.
--
-- Cột `providers` là danh sách nguồn ĐÃ MÃ HOÁ (AES-256-GCM, src/lib/zalo/crypto.ts)
-- — API key là tiền thật, lộ dump DB / backup cũng không đọc được. Cả hai bảng
-- REVOKE anon/authenticated, bật RLS không policy → chỉ service-role đọc/ghi;
-- mọi lượt đọc/ghi đi qua /api/admin/ai-providers và /api/studio/ai-providers.
--
-- Chạy trên Supabase (SQL Editor). An toàn khi chạy lại (idempotent).
-- ============================================================================

create table if not exists public.admin_ai_providers (
  id         int primary key default 1 check (id = 1),
  providers  text,
  updated_at timestamptz not null default now()
);

alter table public.admin_ai_providers enable row level security;

create table if not exists public.studio_ai_providers (
  owner_id   uuid primary key references public.profiles (id) on delete cascade,
  providers  text,
  updated_at timestamptz not null default now()
);

alter table public.studio_ai_providers enable row level security;


-- ══════════════════════════════════════════════════════════════════════════
-- PHẦN 2 — CỘT BỔ SUNG, CHỈ MỤC, HÀM, TRIGGER, DỮ LIỆU MẶC ĐỊNH
-- ══════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/ai_providers.sql — API key AI nhập trong trang quản trị: key chung của admin + key riêng của từng studio (đã mã hoá)
-- ══════════════════════════════════════════════════════════════════════════

insert into public.admin_ai_providers (id) values (1) on conflict (id) do nothing;


-- ══════════════════════════════════════════════════════════════════════════
-- PHẦN 3 — PHÂN QUYỀN, RLS & POLICY (chạy sau khi mọi bảng/cột đã có)
-- ══════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/ai_providers.sql — API key AI nhập trong trang quản trị: key chung của admin + key riêng của từng studio (đã mã hoá)
-- ══════════════════════════════════════════════════════════════════════════

revoke all on public.admin_ai_providers from anon, authenticated;

revoke all on public.studio_ai_providers from anon, authenticated;


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

