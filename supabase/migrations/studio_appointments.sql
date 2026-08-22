-- ============================================================================
-- LỊCH STUDIO — lịch trang điểm / thử đồ / chụp pre-wedding / tư vấn
--
-- Vì sao là bảng MỚI chứ không nhồi thêm vào `studio_events`:
--   `studio_events` là "mốc thời gian của hợp đồng" (ngày đãi trước, ngày cưới…)
--   — mỗi dòng chỉ có ngày + giờ + ghi chú, không có người phụ trách, không có
--   phòng, không có check-in. Lịch studio cần đủ 4 thứ đó để xếp ekip và cảnh
--   báo trùng lịch, nên nó là một MODEL riêng. `studio_events` giữ nguyên nhiệm
--   vụ cũ; cả hai cùng hiện trên màn Lịch làm việc.
--
-- Cùng một bảng phục vụ BA màn (bản thiết kế "Cổng nhân viên & khách hàng"):
--   /dashboard/studio/schedule — lịch tuần cấp studio
--   /staff                     — lịch hôm nay của người được phân công
--   /portal/<client_token>     — lịch trình khách xem (chỉ dòng client_visible)
--
-- Chạy 1 lần trong Supabase SQL Editor (idempotent, chạy lại vẫn an toàn).
-- ============================================================================

create table if not exists public.studio_appointments (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles (id) on delete cascade,
  contract_id   uuid references public.studio_contracts (id) on delete set null,

  -- Loại lịch — quyết định màu/nhãn/icon ở cả ba màn (xem APPOINTMENT_KIND_META
  -- trong src/lib/appointments.ts). 'pre' = chụp pre-wedding, 'shoot' = buổi
  -- chụp/quay khác, để lịch studio dùng chung được với hợp đồng thường.
  kind          text not null default 'makeup'
                  check (kind in ('makeup', 'fitting', 'pre', 'consult', 'shoot', 'delivery', 'other')),
  title         text not null default '',
  appt_date     date not null,
  -- Giờ lưu dạng text 'HH:MM' — GIỐNG studio_contracts.event_time và
  -- studio_events.event_time, để mọi màn định dạng giờ theo một cách duy nhất.
  start_time    text,
  end_time      text,
  duration_min  integer,

  location      text,
  -- Phòng / nguồn lực chiếm dụng (Phòng trang điểm 1, Phòng váy tầng 2, Phim
  -- trường…). Lưu TÊN chứ không phải khoá ngoại: studio đổi tên phòng thì lịch
  -- cũ vẫn đọc được, và phòng là danh sách rất ngắn do studio tự khai.
  room          text,

  -- Người phụ trách. Hai đường vì studio có hai loại người làm:
  --   crew_id  → sổ thợ freelancer (studio_crew, không có tài khoản đăng nhập)
  --   staff_id → nhân viên có tài khoản (profiles.studio_owner_id = owner_id)
  -- crew_name giữ tên đã hiển thị để lịch cũ không trống khi thợ bị xoá khỏi sổ.
  crew_id       uuid references public.studio_crew (id) on delete set null,
  staff_id      uuid references public.profiles (id) on delete set null,
  crew_name     text,

  client_name   text,
  client_phone  text,

  status        text not null default 'scheduled'
                  check (status in ('scheduled', 'checked_in', 'done', 'cancelled')),
  checked_in_at timestamptz,
  done_at       timestamptz,
  note          text,

  -- Khách có thấy mốc này trên cổng khách hàng không. Lịch nội bộ (họp ekip,
  -- giữ phòng) đặt false để cổng khách khỏi hiện thứ không liên quan tới họ.
  client_visible boolean not null default true,
  position      integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Tra cứu chính: lịch tuần của một studio (owner + khoảng ngày).
create index if not exists studio_appointments_owner_idx
  on public.studio_appointments (owner_id, appt_date);
-- Lịch trình của một hợp đồng (cổng khách + màn chi tiết hợp đồng).
create index if not exists studio_appointments_contract_idx
  on public.studio_appointments (contract_id, appt_date);
-- "Việc hôm nay của tôi" ở cổng nhân viên.
create index if not exists studio_appointments_staff_idx
  on public.studio_appointments (staff_id, appt_date);
create index if not exists studio_appointments_crew_idx
  on public.studio_appointments (crew_id, appt_date);

alter table public.studio_appointments enable row level security;
-- Cùng luật với studio_events: mọi thành viên của studio đều dùng được. Cổng
-- khách và cổng thợ (không đăng nhập) đi qua service-role như các cổng khác.
drop policy if exists studio_appointments_owner_all on public.studio_appointments;
create policy studio_appointments_owner_all on public.studio_appointments
  for all using (public.is_studio_member(owner_id))
  with check (public.is_studio_member(owner_id));

-- ============================================================================
-- PHÒNG & NGUỒN LỰC — danh sách phòng để lịch studio vẽ thanh công suất
--
-- `capacity_week` = số buổi phòng nhận được trong MỘT TUẦN. Thanh công suất =
-- số lịch đã xếp / capacity_week, nên studio tự quyết mức nào là "đầy" thay vì
-- code đoán hộ.
-- ============================================================================

create table if not exists public.studio_rooms (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles (id) on delete cascade,
  name          text not null default '',
  -- Loại phòng: gợi ý loại lịch nào nên xếp vào đây (chỉ để lọc/gợi ý, không chặn).
  kind          text not null default 'other'
                  check (kind in ('makeup', 'fitting', 'studio', 'meeting', 'other')),
  capacity_week integer not null default 10,
  note          text,
  active        boolean not null default true,
  position      integer not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists studio_rooms_owner_idx on public.studio_rooms (owner_id, position);

alter table public.studio_rooms enable row level security;
drop policy if exists studio_rooms_owner_all on public.studio_rooms;
create policy studio_rooms_owner_all on public.studio_rooms
  for all using (public.is_studio_member(owner_id))
  with check (public.is_studio_member(owner_id));

-- ============================================================================
-- Thông báo: ba loại mới của cổng nhân viên (nhắc lịch, hợp đồng đổi, phân công).
-- `studio_notifications.kind` là text KHÔNG có check constraint nên không phải
-- sửa gì ở DB — ghi lại đây để người đọc migration biết ba khoá này tồn tại:
--   schedule_reminder | contract_changed | assigned
-- (nhãn & icon: NOTIFICATION_KIND_META trong src/lib/types.ts)
-- ============================================================================
