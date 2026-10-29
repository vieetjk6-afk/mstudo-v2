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

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'system_polls_audience_check') then
    alter table public.system_polls
      add constraint system_polls_audience_check check (audience in ('everyone', 'owners'));
  end if;
end $$;

create index if not exists system_polls_active_idx on public.system_polls (active, created_at desc);

-- Mỗi người MỘT phiếu cho mỗi bình chọn (bỏ phiếu lại = sửa phiếu cũ).
create table if not exists public.system_poll_votes (
  poll_id    uuid not null references public.system_polls (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  choices    smallint[] not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);

alter table public.system_polls enable row level security;
alter table public.system_poll_votes enable row level security;
