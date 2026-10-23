-- ============================================================================
-- KẾ HOẠCH CƯỚI CỦA KHÁCH (wedding planner) — /portal/<client_token>/ke-hoach
--
-- Khách book gói chụp cưới thì cổng khách có thêm một trang lên kế hoạch cưới:
-- việc cần làm theo mốc trước ngày cưới, ngân sách, lịch trình ngày cưới. Studio
-- xem được kế hoạch đó trong màn hợp đồng (ê-kíp biết giờ đón dâu, giờ làm lễ).
--
--  1) Bảng `wedding_plans` — MỘT dòng cho mỗi hợp đồng, tạo lúc khách mở trang
--     lần đầu. Ba danh sách để jsonb (xem src/lib/wedding-plan.ts) vì chúng chỉ
--     sống trong trang này, không bảng nào khác tham chiếu tới từng dòng.
--     `rev` tăng mỗi lần ghi: route máy chủ ghi kèm điều kiện `rev = <đã đọc>`,
--     nên cô dâu và chú rể cùng sửa trên hai máy không ghi đè mất việc của nhau.
--  2) Cột `studio_contracts.wedding_planner` — lựa chọn riêng của studio cho
--     từng hợp đồng: true = bật, false = tắt, null = theo gói (gói cưới thì bật).
--
-- Đọc: mọi thành viên studio. Ghi: CHỈ qua route máy chủ (service role) sau khi
-- đã kiểm SĐT khách — không cấp policy ghi nào cho authenticated.
--
-- Bản web chịu được lúc CHƯA chạy file này: thiếu bảng thì cổng khách đơn giản
-- không hiện kế hoạch cưới; thiếu cột thì mọi hợp đồng coi như "theo gói".
--
-- Chạy 1 lần trong Supabase SQL Editor. An toàn khi chạy lại.
-- ============================================================================

do $$
begin
  if to_regclass('public.studio_contracts') is null then
    raise exception 'Thiếu bảng nền studio_contracts. Hãy chạy supabase/setup-all.sql trước.';
  end if;
end $$;

create table if not exists public.wedding_plans (
  id           uuid primary key default gen_random_uuid(),
  contract_id  uuid not null unique references public.studio_contracts (id) on delete cascade,
  owner_id     uuid not null references public.profiles (id) on delete cascade,
  -- Ngày cưới — có thể KHÁC ngày chụp của hợp đồng (prewedding chụp trước vài tháng).
  wedding_date date,
  budget_total bigint not null default 0 check (budget_total >= 0),
  -- [{ id, title, when, done, note?, link? }]
  tasks        jsonb not null default '[]'::jsonb,
  -- [{ id, cat, name, estimate, paid, note? }]
  budget       jsonb not null default '[]'::jsonb,
  -- [{ id, time, title, place?, who? }]
  day_plan     jsonb not null default '[]'::jsonb,
  rev          integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists wedding_plans_owner_idx on public.wedding_plans (owner_id);

drop trigger if exists wedding_plans_set_updated_at on public.wedding_plans;
create trigger wedding_plans_set_updated_at
  before update on public.wedding_plans
  for each row execute function public.set_updated_at();

alter table public.wedding_plans enable row level security;
drop policy if exists wedding_plans_member_read on public.wedding_plans;
create policy wedding_plans_member_read on public.wedding_plans
  for select using (public.is_studio_member(owner_id));

alter table public.studio_contracts
  add column if not exists wedding_planner boolean;

comment on column public.studio_contracts.wedding_planner is
  'Kế hoạch cưới trên cổng khách: true = bật, false = tắt, null = theo gói (gói cưới thì bật).';

notify pgrst, 'reload schema';
