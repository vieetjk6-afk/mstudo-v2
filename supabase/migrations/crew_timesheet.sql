-- ============================================================================
-- CHẤM CÔNG & KHOẢNG RẢNH CỦA THỢ
--
-- App đã có PHÂN CÔNG (contract_crew, crew_shift_plan) nhưng không ghi THỰC TẾ:
-- thợ có đi không, đến lúc mấy giờ, xong lúc mấy giờ. Nên màn Đối soát tiền công
-- vẫn phải nhập tay từng dòng và không đối chiếu được với bất cứ gì.
--
-- Thợ KHÔNG có tài khoản đăng nhập (xem studio_crew: khoá theo số điện thoại),
-- nên hai bảng dưới đây cũng khoá theo SĐT — giống crew_unavailable đã làm. Thợ
-- bấm từ cổng thợ công khai /crew; studio nhập bù được từ khu quản lý.
--
-- Chạy 1 lần trong Supabase SQL Editor. An toàn khi chạy lại.
-- ============================================================================

do $$
declare missing text[] := '{}';
begin
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'studio_crew')
  then missing := missing || 'studio_crew'; end if;
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'studio_contracts')
  then missing := missing || 'studio_contracts'; end if;

  if array_length(missing, 1) > 0 then
    raise exception
      'Thiếu bảng nền: %. Hãy chạy supabase/setup-all.sql trước (nó gồm cả schema nền lẫn migration này).',
      array_to_string(missing, ', ');
  end if;
end $$;

-- ── Đơn giá giờ của thợ ─────────────────────────────────────────────────────
-- 0 = chưa khai. Lúc đó màn Đối soát KHÔNG đề xuất tiền công (xem `suggestPay`
-- trong src/lib/timesheet.ts): đề xuất 0₫ rồi có người bấm áp dụng sẽ xoá mất
-- số studio đã nhập tay.
alter table public.studio_crew add column if not exists hourly_rate integer not null default 0;

-- ── Dòng chấm công ──────────────────────────────────────────────────────────
create table if not exists public.crew_timesheet (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles (id) on delete cascade,

  -- Định danh thợ. `phone` là khoá thật (thợ không có tài khoản); `crew_id` chỉ
  -- là tiện tra tên/vai trò khi thợ CÓ trong sổ. Thợ rời sổ thì dòng chấm công
  -- cũ vẫn còn để đối soát — nên `on delete set null`, không cascade.
  phone       text not null,
  crew_id     uuid references public.studio_crew (id) on delete set null,
  name        text,

  contract_id     uuid references public.studio_contracts (id) on delete set null,
  appointment_id  uuid references public.studio_appointments (id) on delete set null,

  -- Ngày làm, tách khỏi started_at: buổi chụp tiệc bắt đầu 19:00 và xong 02:00
  -- hôm sau vẫn phải nằm trong kỳ của NGÀY CHỤP, không nhảy sang tháng sau.
  work_date   date not null default current_date,

  started_at  timestamptz,
  -- null = ĐANG LÀM (chưa bấm xong). Số giờ của dòng này là `null`, KHÔNG phải
  -- 0 — xem `sessionHours`.
  ended_at    timestamptz,

  note        text,
  -- 'crew' = thợ tự bấm ở cổng thợ; 'studio' = studio nhập bù.
  source      text not null default 'crew' check (source in ('crew', 'studio')),
  created_at  timestamptz not null default now()
);
create index if not exists crew_timesheet_owner_idx  on public.crew_timesheet (owner_id, work_date desc);
create index if not exists crew_timesheet_phone_idx  on public.crew_timesheet (phone, work_date desc);
create index if not exists crew_timesheet_contract_idx on public.crew_timesheet (contract_id);

-- Mỗi thợ chỉ được có MỘT dòng đang mở tại một thời điểm. Không có hàng rào này
-- thì thợ bấm "đã đến" hai lần (mạng chậm, bấm lại) sẽ đẻ ra hai dòng mở và giờ
-- làm bị tính đôi.
create unique index if not exists crew_timesheet_one_open_idx
  on public.crew_timesheet (phone)
  where ended_at is null;

-- ── Khoảng RẢNH thợ tự đăng ký ──────────────────────────────────────────────
-- Ngược của crew_unavailable. Cố ý là bảng RIÊNG chứ không thêm cột `kind` vào
-- crew_unavailable: bảng kia đã có RLS, index và một cổng ghi riêng, và "bận"
-- với "rảnh" có luật ưu tiên khác nhau (báo bận THẮNG khai rảnh — xem
-- `availabilityOn`). Trộn hai nghĩa vào một bảng là cách chắc chắn để một ngày
-- nào đó đọc sai chiều.
create table if not exists public.crew_available (
  id         uuid primary key default gen_random_uuid(),
  phone      text not null,
  date       date not null,
  start_time time,
  end_time   time,
  note       text,
  owner_id   uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (phone, date, start_time)
);
create index if not exists crew_available_phone_idx on public.crew_available (phone, date);

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.crew_timesheet  enable row level security;
alter table public.crew_available  enable row level security;

-- Chấm công: studio đọc/sửa dòng của CHÍNH mình (nhập bù, sửa giờ sai). Thợ ghi
-- qua service-role ở cổng thợ công khai, nên không cần policy cho anon.
drop policy if exists crew_timesheet_owner_all on public.crew_timesheet;
create policy crew_timesheet_owner_all on public.crew_timesheet
  for all using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

-- Khoảng rảnh: mọi studio đã đăng nhập ĐỌC được (để phân công thấy ai trống),
-- giống hệt cách crew_unavailable đang làm — đây là thông tin xếp lịch, không
-- nhạy cảm. Ghi đi qua service-role từ cổng thợ.
drop policy if exists crew_available_read on public.crew_available;
create policy crew_available_read on public.crew_available
  for select using (auth.role() = 'authenticated');

-- ── Kiểm tra sau khi chạy ───────────────────────────────────────────────────
-- select phone, work_date, started_at, ended_at from public.crew_timesheet
-- order by work_date desc limit 20;
