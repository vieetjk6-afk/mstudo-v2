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
insert into public.admin_ai_providers (id) values (1) on conflict (id) do nothing;
revoke all on public.admin_ai_providers from anon, authenticated;
alter table public.admin_ai_providers enable row level security;

create table if not exists public.studio_ai_providers (
  owner_id   uuid primary key references public.profiles (id) on delete cascade,
  providers  text,
  updated_at timestamptz not null default now()
);
revoke all on public.studio_ai_providers from anon, authenticated;
alter table public.studio_ai_providers enable row level security;
