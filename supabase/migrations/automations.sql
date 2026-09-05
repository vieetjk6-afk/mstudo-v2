-- ============================================================================
-- VIỆC TỰ ĐỘNG THEO TRẠNG THÁI HỢP ĐỒNG
--
-- Mọi nhắc nhở trong app đang do NGƯỜI nhớ: ký rồi thì ai nhắc thu cọc, giao ảnh
-- rồi thì ai xin đánh giá, còn ba ngày tới buổi chụp thì ai gọi khách xác nhận.
--
-- HAI bảng, và bảng thứ hai mới là bảng quan trọng:
--
--   studio_automations      — studio bật/tắt từng luật, đổi số ngày và câu chữ.
--   studio_automation_log   — ĐÃ CHẠY những gì. Cron chạy MỖI NGÀY, nên không có
--                             bảng này thì một luật sẽ đẻ ra 30 việc giống nhau
--                             trong một tháng, hoặc gửi khách 30 tin Zalo y hệt.
--
-- CỐ Ý KHÔNG làm bảng luật tự do (điều kiện + hành động tuỳ ý). Tập "khi" và tập
-- "thì" đều ĐÓNG và khai trong code (src/lib/automations.ts, AUTOMATION_RULES);
-- bảng này chỉ giữ CẤU HÌNH cho tám luật đó. Studio cần tám việc đúng, bật/tắt
-- bằng công tắc — không cần một Zapier.
--
-- Chạy 1 lần trong Supabase SQL Editor. An toàn khi chạy lại.
-- ============================================================================

do $$
declare missing text[] := '{}';
begin
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'studio_contracts')
  then missing := missing || 'studio_contracts'; end if;
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'contract_tasks')
  then missing := missing || 'contract_tasks'; end if;
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'studio_notifications')
  then missing := missing || 'studio_notifications'; end if;

  if array_length(missing, 1) > 0 then
    raise exception
      'Thiếu bảng nền: %. Hãy chạy supabase/setup-all.sql trước (nó gồm cả schema nền lẫn migration này).',
      array_to_string(missing, ', ');
  end if;
end $$;

-- ── Cấu hình từng luật ──────────────────────────────────────────────────────
create table if not exists public.studio_automations (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles (id) on delete cascade,

  -- Khoá luật, thuộc TẬP ĐÓNG khai ở src/lib/automations.ts (AUTOMATION_RULES).
  -- KHÔNG đặt check constraint liệt kê tên luật ở đây: thêm luật thứ chín sẽ
  -- phải sửa cả DB, và một dòng cấu hình của luật đã bỏ thì code chỉ đơn giản
  -- không đọc tới. Tập đóng được chốt ở tầng code, nơi nó được dùng.
  rule       text not null,

  enabled    boolean not null default false,
  -- Số ngày cho luật có mốc ngày (trước buổi chụp N ngày, quá hạn N ngày).
  -- null = dùng mặc định của luật.
  offset_days integer,
  -- Ghi đè câu chữ. null/rỗng = dùng câu mặc định của luật.
  message    text,
  updated_at timestamptz not null default now(),

  -- Mỗi studio một dòng cho mỗi luật.
  unique (owner_id, rule)
);
create index if not exists studio_automations_owner_idx on public.studio_automations (owner_id);

-- ── Sổ ĐÃ CHẠY (chống lặp) ──────────────────────────────────────────────────
create table if not exists public.studio_automation_log (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  rule        text not null,
  contract_id uuid references public.studio_contracts (id) on delete cascade,

  -- Khoá chống lặp do src/lib/automations.ts sinh ra: "<luật>:<hợp đồng>" hoặc
  -- "<luật>:<hợp đồng>:<ref>". `ref` là id ĐỢT THANH TOÁN — hợp đồng chia 4 đợt
  -- thì mỗi đợt quá hạn là một lần nhắc riêng, không bị gộp mất ba.
  --
  -- UNIQUE ở đây là hàng rào THẬT, không chỉ để tra nhanh: hai lượt cron chạy
  -- chồng nhau (Vercel gọi lại vì timeout) sẽ bị chính DB chặn ở lượt thứ hai,
  -- chứ không dựa vào việc code kiểm tra trước rồi ghi sau.
  dedupe_key  text not null unique,

  fired_at    timestamptz not null default now()
);
create index if not exists studio_automation_log_owner_idx
  on public.studio_automation_log (owner_id, fired_at desc);
create index if not exists studio_automation_log_contract_idx
  on public.studio_automation_log (contract_id);

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.studio_automations    enable row level security;
alter table public.studio_automation_log enable row level security;

drop policy if exists studio_automations_owner_all on public.studio_automations;
create policy studio_automations_owner_all on public.studio_automations
  for all using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

-- Sổ đã chạy: studio ĐỌC được (để màn cấu hình hiện "đã chạy 12 lần"), nhưng
-- GHI chỉ qua service-role ở cron. Cho client ghi thì một studio có thể tự đánh
-- dấu "đã chạy" để chặn luật của chính mình một cách khó hiểu.
drop policy if exists studio_automation_log_read on public.studio_automation_log;
create policy studio_automation_log_read on public.studio_automation_log
  for select using (owner_id = auth.uid() or public.is_admin());

-- ── Kiểm tra sau khi chạy ───────────────────────────────────────────────────
-- select rule, enabled, offset_days from public.studio_automations order by rule;
-- select rule, count(*) from public.studio_automation_log group by rule;
