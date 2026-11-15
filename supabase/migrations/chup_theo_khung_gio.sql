-- ============================================================================
-- CHỤP THEO KHUNG GIỜ (mini-session) — docs/goi-y-tinh-nang-vong-2.md §5
--
-- Ngày Tết / Trung thu studio chụp 20–30 khách, mỗi người 15–20 phút. Form đặt
-- lịch chỉ hỏi MỘT ngày nên studio phải nhắn qua lại để xếp giờ. Ở đây studio
-- mở một "đợt chụp", khách tự chọn khung còn trống rồi cọc.
--
-- MÔ HÌNH
--   studio_mini_sessions  một đợt chụp = ngày + giờ bắt đầu/kết thúc + độ dài
--                         khung + nghỉ giữa khung + giá + cọc + link công khai.
--                         Khung giờ SUY RA từ các số đó, không lưu dòng trống.
--   studio_mini_slots     MỘT dòng cho mỗi khung ĐÃ CÓ NGƯỜI (khoá chỗ).
--                         UNIQUE (session_id, start_min) → hai khách không thể
--                         cùng giữ một khung, kể cả khi bấm cùng một mili-giây.
--   studio_bookings       khách đặt online vẫn là một yêu cầu đặt lịch thường
--                         (+ slot_session_id, slot_start_min) → dùng lại nguyên
--                         bước cọc VietQR, ảnh biên lai, SePay tự xác nhận, và
--                         hiện trong màn "Đặt lịch khách". Studio đặt tay cho
--                         khách vãng lai thì chỉ có dòng khoá, không có yêu cầu.
--
-- GIỜ lưu bằng SỐ PHÚT từ 00:00 (start_min) chứ không phải 'HH:MM': kiểm "có
-- phải khung thật của đợt không" là một phép chia dư, không phải tách chuỗi.
--
-- GIỮ CHỖ CHỜ CỌC
--   Khung cần cọc được giữ tới hold_expires_at (máy chủ truyền số phút, hiện
--   30). Đồng hồ DỪNG (hold_expires_at = null → chắc chỗ) khi cọc của yêu cầu
--   chuyển sang 'paid' (khách báo đã chuyển / gửi biên lai) hoặc 'confirmed'
--   (studio hay SePay xác nhận). Quá hạn mà chưa dừng → mini_release_expired
--   xoá khoá, khung trống lại. Khách chuyển MUỘN: trigger thử lấy lại đúng
--   khung đó nếu còn trống, không thì báo studio qua chuông.
--
-- LỊCH LÀM VIỆC
--   Trigger trên studio_mini_slots là NƠI DUY NHẤT sinh / sửa / xoá dòng
--   studio_appointments (kind 'shoot') của khung — không route nào tự làm.
--
-- QUYỀN
--   Thành viên studio chỉ ĐỌC. Mọi lệnh ghi đi qua route máy chủ (service
--   role) hoặc hàm mini_book_slot — chỉ service_role gọi được. anon không có gì.
--
-- Chạy SAU referral_deposit.sql và studio_appointments.sql. Chạy lại vô hại.
-- ============================================================================

create table if not exists public.studio_mini_sessions (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles (id) on delete cascade,
  -- Mã trong link công khai /book/dot/<token>. Dài, ngẫu nhiên, không đoán được.
  token         text not null unique,
  title         text not null default '',
  session_date  date not null,
  start_min     integer not null check (start_min between 0 and 1439),
  end_min       integer not null check (end_min between 1 and 1439),
  slot_minutes  integer not null check (slot_minutes between 5 and 480),
  gap_minutes   integer not null default 0 check (gap_minutes between 0 and 240),
  price         integer not null default 0 check (price >= 0),
  -- Cọc mỗi khung (VND). 0 = không cần cọc → đặt là chắc chỗ ngay.
  deposit       integer not null default 0 check (deposit >= 0),
  location      text,
  note          text,
  -- false = khách không đặt online được nữa (studio vẫn đặt tay được).
  is_open       boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (end_min > start_min)
);
alter table public.studio_mini_sessions enable row level security;

create table if not exists public.studio_mini_slots (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references public.studio_mini_sessions (id) on delete cascade,
  owner_id        uuid not null references public.profiles (id) on delete cascade,
  start_min       integer not null check (start_min between 0 and 1439),
  -- Yêu cầu đặt lịch của khách online. Xoá yêu cầu → khung tự trống lại.
  booking_id      uuid references public.studio_bookings (id) on delete cascade,
  -- Dòng trên Lịch làm việc do trigger sinh. Nhân viên xoá dòng lịch thì khung
  -- VẪN giữ (set null): thà thiếu một dòng lịch còn hơn hai khách một khung.
  appointment_id  uuid references public.studio_appointments (id) on delete set null,
  customer_name   text not null default '',
  customer_phone  text not null default '',
  note            text,
  -- null = chắc chỗ. Có giá trị = đang giữ chờ cọc tới thời điểm đó.
  hold_expires_at timestamptz,
  source          text not null default 'online' check (source in ('online', 'manual')),
  created_at      timestamptz not null default now(),
  constraint studio_mini_slots_slot_uniq unique (session_id, start_min)
);
alter table public.studio_mini_slots enable row level security;

create index if not exists studio_mini_sessions_owner_idx
  on public.studio_mini_sessions (owner_id, session_date);
create index if not exists studio_mini_slots_booking_idx
  on public.studio_mini_slots (booking_id) where booking_id is not null;
create index if not exists studio_mini_slots_hold_idx
  on public.studio_mini_slots (hold_expires_at) where hold_expires_at is not null;

-- Yêu cầu đặt lịch nhớ khung của mình: để màn "Đặt lịch khách" gắn nhãn, và để
-- khách chuyển cọc muộn (khoá đã nhả) còn biết đường lấy lại khung.
alter table public.studio_bookings add column if not exists slot_session_id uuid
  references public.studio_mini_sessions (id) on delete set null;
alter table public.studio_bookings add column if not exists slot_start_min integer;

-- ── Hàm phụ ─────────────────────────────────────────────────────────────────
-- 545 → '09:05' — đúng dạng studio_appointments.start_time đang lưu.
create or replace function public.mini_hhmm(m integer)
returns text language sql immutable set search_path = public as $$
  select lpad((m / 60)::text, 2, '0') || ':' || lpad((m % 60)::text, 2, '0');
$$;

-- start có phải một khung THẬT của đợt không.
create or replace function public.mini_slot_valid(s public.studio_mini_sessions, p_start integer)
returns boolean language sql immutable set search_path = public as $$
  select p_start is not null
     and p_start >= s.start_min
     and p_start + s.slot_minutes <= s.end_min
     and (p_start - s.start_min) % (s.slot_minutes + s.gap_minutes) = 0;
$$;

-- ── Khoá ↔ Lịch làm việc (nơi DUY NHẤT đồng bộ) ─────────────────────────────
-- security definer: trigger chạy theo người gây ra lệnh (vd nhân viên xác nhận
-- cọc ở màn Đặt lịch) — người đó không có quyền ghi bảng khoá.
create or replace function public.mini_slot_sync_appt()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  s public.studio_mini_sessions;
  v_title text;
  v_note text;
begin
  if tg_op = 'DELETE' then
    if old.appointment_id is not null then
      delete from public.studio_appointments where id = old.appointment_id;
    end if;
    return old;
  end if;

  select * into s from public.studio_mini_sessions where id = new.session_id;
  if not found then return new; end if;
  v_title := 'Khung giờ' || case when coalesce(s.title, '') <> '' then ' · ' || s.title else '' end
             || case when coalesce(new.customer_name, '') <> '' then ' — ' || new.customer_name else '' end
             || case when new.hold_expires_at is not null then ' (chờ cọc)' else '' end;
  v_note := nullif(concat_ws(E'\n',
              case when new.hold_expires_at is not null then 'Đang giữ chỗ chờ khách chuyển cọc.' end,
              nullif(new.note, '')), '');

  if tg_op = 'INSERT' then
    insert into public.studio_appointments
      (owner_id, kind, title, appt_date, start_time, end_time, duration_min,
       location, client_name, client_phone, note, client_visible)
    values
      (new.owner_id, 'shoot', v_title, s.session_date, public.mini_hhmm(new.start_min),
       public.mini_hhmm(new.start_min + s.slot_minutes), s.slot_minutes,
       s.location, nullif(new.customer_name, ''), nullif(new.customer_phone, ''), v_note, false)
    returning id into new.appointment_id;
    return new;
  end if;

  -- UPDATE: hết giữ chỗ / đổi tên, SĐT, ghi chú → sửa đúng dòng lịch đó.
  if new.appointment_id is not null then
    update public.studio_appointments
       set title = v_title, note = v_note,
           client_name = nullif(new.customer_name, ''),
           client_phone = nullif(new.customer_phone, ''),
           updated_at = now()
     where id = new.appointment_id;
  end if;
  return new;
end;
$$;

drop trigger if exists mini_slot_appt_ins on public.studio_mini_slots;
create trigger mini_slot_appt_ins
  before insert on public.studio_mini_slots
  for each row execute function public.mini_slot_sync_appt();
drop trigger if exists mini_slot_appt_upd on public.studio_mini_slots;
create trigger mini_slot_appt_upd
  after update of hold_expires_at, customer_name, customer_phone, note on public.studio_mini_slots
  for each row execute function public.mini_slot_sync_appt();
drop trigger if exists mini_slot_appt_del on public.studio_mini_slots;
create trigger mini_slot_appt_del
  after delete on public.studio_mini_slots
  for each row execute function public.mini_slot_sync_appt();

-- ── Sửa đợt đã có người đặt ─────────────────────────────────────────────────
-- Đổi ngày / giờ bắt đầu / độ dài khung / nghỉ giữa khung khi đã có khách là
-- bỏ rơi khách đó (họ đặt 09:00, lưới mới không còn 09:00). Chặn ở DB để mọi
-- đường ghi đều chịu. Rút ngắn giờ kết thúc chỉ được khi không cắt mất ai.
create or replace function public.mini_session_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if (new.session_date, new.start_min, new.slot_minutes, new.gap_minutes)
       is distinct from (old.session_date, old.start_min, old.slot_minutes, old.gap_minutes)
     and exists (select 1 from public.studio_mini_slots k
                 where k.session_id = old.id
                   and (k.hold_expires_at is null or k.hold_expires_at > now())) then
    raise exception 'mini_session_has_bookings: đợt đã có khách đặt, không đổi được ngày / giờ / độ dài khung'
      using errcode = 'P0001';
  end if;
  if new.end_min is distinct from old.end_min
     and exists (select 1 from public.studio_mini_slots k
                 where k.session_id = old.id
                   and (k.hold_expires_at is null or k.hold_expires_at > now())
                   and k.start_min + new.slot_minutes > new.end_min) then
    raise exception 'mini_session_has_bookings: giờ kết thúc mới cắt mất khung đã có khách đặt'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists mini_session_guard on public.studio_mini_sessions;
create trigger mini_session_guard
  before update on public.studio_mini_sessions
  for each row execute function public.mini_session_guard();

-- Đổi tên đợt / địa điểm → các dòng lịch của đợt đổi theo.
create or replace function public.mini_session_touch_appts()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.studio_appointments a
     set location = new.location, updated_at = now()
    from public.studio_mini_slots k
   where k.session_id = new.id and a.id = k.appointment_id;
  -- Chạm vào khoá để trigger dựng lại tiêu đề (có tên đợt).
  update public.studio_mini_slots set note = note where session_id = new.id;
  return null;
end;
$$;

drop trigger if exists mini_session_touch_appts on public.studio_mini_sessions;
create trigger mini_session_touch_appts
  after update of title, location on public.studio_mini_sessions
  for each row execute function public.mini_session_touch_appts();

-- ── Nhả khung hết hạn giữ ───────────────────────────────────────────────────
-- p_session null = mọi đợt. Yêu cầu đặt lịch được GIỮ LẠI (vẫn là một khách để
-- gọi lại) nhưng ghi rõ đã hết hạn, kẻo studio tưởng khách còn giữ khung.
create or replace function public.mini_release_expired(p_session uuid default null)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_ids uuid[];
  v_n integer;
begin
  with gone as (
    delete from public.studio_mini_slots k
     where k.hold_expires_at is not null and k.hold_expires_at <= now()
       and (p_session is null or k.session_id = p_session)
    returning k.booking_id
  )
  select array_agg(booking_id) filter (where booking_id is not null), count(*)
    into v_ids, v_n from gone;
  if v_ids is not null then
    update public.studio_bookings b
       set note = concat_ws(E'\n', '⏱ Hết hạn giữ chỗ — khung giờ đã mở lại cho khách khác.', nullif(b.note, ''))
     where b.id = any (v_ids) and b.deposit_status = 'awaiting';
  end if;
  return coalesce(v_n, 0);
end;
$$;

-- ── Đặt một khung (nguyên tử) ───────────────────────────────────────────────
-- Khoá dòng đợt (for update) → các lượt đặt của cùng một đợt xếp hàng; ràng
-- buộc UNIQUE vẫn là chốt cuối. Trả jsonb { status: ok | taken | not_found |
-- closed | past | invalid_slot, … }.
--   p_manual      studio đặt tay: không tạo yêu cầu, không giữ chỗ, bỏ qua
--                 "đợt đã đóng / đã qua".
--   p_deposit_*   null → không thu cọc (studio chưa khai tài khoản nhận tiền).
--   Giá và cọc đọc từ ĐỢT, không nhận từ người gọi.
create or replace function public.mini_book_slot(
  p_session uuid, p_start integer, p_name text, p_phone text, p_note text,
  p_manual boolean default false,
  p_deposit_code text default null, p_deposit_token text default null,
  p_hold_minutes integer default 30
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s public.studio_mini_sessions;
  v_now timestamp := now() at time zone 'Asia/Ho_Chi_Minh';
  v_deposit integer := 0;
  v_hold timestamptz;
  v_booking uuid;
  v_slot uuid;
  v_range text;
begin
  select * into s from public.studio_mini_sessions where id = p_session for update;
  if not found then return jsonb_build_object('status', 'not_found'); end if;
  if not public.mini_slot_valid(s, p_start) then return jsonb_build_object('status', 'invalid_slot'); end if;
  if not p_manual then
    if not s.is_open then return jsonb_build_object('status', 'closed'); end if;
    if s.session_date < v_now::date
       or (s.session_date = v_now::date
           and p_start <= extract(hour from v_now)::int * 60 + extract(minute from v_now)::int) then
      return jsonb_build_object('status', 'past');
    end if;
    if s.deposit > 0 and p_deposit_code is not null and p_deposit_token is not null then
      v_deposit := case when s.price > 0 then least(s.deposit, s.price) else s.deposit end;
      v_hold := now() + make_interval(mins => greatest(1, least(coalesce(p_hold_minutes, 30), 1440)));
    end if;
  end if;

  perform public.mini_release_expired(s.id);
  v_range := public.mini_hhmm(p_start) || '–' || public.mini_hhmm(p_start + s.slot_minutes);

  begin
    if not p_manual then
      insert into public.studio_bookings
        (owner_id, name, phone, service, preferred_date, note, package_name, package_price,
         deposit_amount, deposit_status, deposit_code, deposit_token, slot_session_id, slot_start_min)
      values
        (s.owner_id, left(btrim(p_name), 120), left(btrim(p_phone), 30),
         left('Khung giờ ' || v_range || case when s.title <> '' then ' · ' || s.title else '' end, 200),
         s.session_date, nullif(left(btrim(coalesce(p_note, '')), 1000), ''),
         nullif(left(s.title, 160), ''), nullif(s.price, 0),
         nullif(v_deposit, 0), case when v_deposit > 0 then 'awaiting' else 'none' end,
         case when v_deposit > 0 then p_deposit_code end,
         case when v_deposit > 0 then p_deposit_token end,
         s.id, p_start)
      returning id into v_booking;
    end if;
    insert into public.studio_mini_slots
      (session_id, owner_id, start_min, booking_id, customer_name, customer_phone, note, hold_expires_at, source)
    values
      (s.id, s.owner_id, p_start, v_booking, left(btrim(p_name), 120), left(btrim(p_phone), 30),
       nullif(left(btrim(coalesce(p_note, '')), 1000), ''), v_hold,
       case when p_manual then 'manual' else 'online' end)
    returning id into v_slot;
  exception when unique_violation then
    -- Khối begin…exception là một savepoint: yêu cầu vừa chèn cũng được gỡ.
    return jsonb_build_object('status', 'taken');
  end;

  return jsonb_build_object(
    'status', 'ok', 'slot_id', v_slot, 'booking_id', v_booking, 'owner_id', s.owner_id,
    'deposit_amount', v_deposit, 'hold_expires_at', v_hold,
    'title', s.title, 'session_date', s.session_date, 'range', v_range);
end;
$$;

-- ── Yêu cầu đặt lịch đổi → khoá đổi theo ────────────────────────────────────
-- Mọi đường đổi cọc (khách gửi biên lai, studio xác nhận ở màn Đặt lịch, SePay)
-- đều UPDATE studio_bookings, nên bắt ở đây là đủ, không phải sửa từng đường.
create or replace function public.mini_booking_sync()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  s public.studio_mini_sessions;
  v_today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
  if new.slot_session_id is null or new.slot_start_min is null then return null; end if;

  -- Studio từ chối yêu cầu → nhả khung.
  if new.status = 'declined' and old.status is distinct from 'declined' then
    delete from public.studio_mini_slots where booking_id = new.id;
    return null;
  end if;

  if (new.name, new.phone) is distinct from (old.name, old.phone) then
    update public.studio_mini_slots
       set customer_name = new.name, customer_phone = new.phone
     where booking_id = new.id;
  end if;

  if new.deposit_status in ('paid', 'confirmed')
     and old.deposit_status is distinct from new.deposit_status then
    -- Dừng đồng hồ giữ chỗ.
    update public.studio_mini_slots set hold_expires_at = null
     where booking_id = new.id and hold_expires_at is not null;
    if not exists (select 1 from public.studio_mini_slots where booking_id = new.id)
       and new.status not in ('declined', 'archived') then
      -- Chuyển cọc MUỘN, khoá đã nhả: còn trống thì lấy lại, không thì báo studio.
      select * into s from public.studio_mini_sessions where id = new.slot_session_id;
      if found and s.session_date >= v_today and public.mini_slot_valid(s, new.slot_start_min) then
        perform public.mini_release_expired(s.id);
        begin
          insert into public.studio_mini_slots
            (session_id, owner_id, start_min, booking_id, customer_name, customer_phone, note, source)
          values (s.id, s.owner_id, new.slot_start_min, new.id, new.name, new.phone, null, 'online');
        exception when unique_violation then
          insert into public.studio_notifications (owner_id, contract_id, kind, message)
          values (new.owner_id, null, 'payment',
                  left(coalesce(nullif(new.name, ''), 'Khách') || ' chuyển cọc sau khi hết hạn giữ chỗ — khung '
                       || public.mini_hhmm(new.slot_start_min) || ' (' || s.title || ') đã có khách khác. Liên hệ khách để xếp khung khác hoặc hoàn cọc.', 400));
        end;
      end if;
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists mini_booking_sync on public.studio_bookings;
create trigger mini_booking_sync
  after update of deposit_status, status, name, phone on public.studio_bookings
  for each row execute function public.mini_booking_sync();

-- ── Quyền ───────────────────────────────────────────────────────────────────
-- Thành viên studio chỉ đọc; không có policy ghi → mọi lệnh ghi qua máy chủ.
drop policy if exists studio_mini_sessions_member_read on public.studio_mini_sessions;
create policy studio_mini_sessions_member_read on public.studio_mini_sessions
  for select to authenticated using (public.is_studio_member(owner_id));
drop policy if exists studio_mini_slots_member_read on public.studio_mini_slots;
create policy studio_mini_slots_member_read on public.studio_mini_slots
  for select to authenticated using (public.is_studio_member(owner_id));

revoke all on public.studio_mini_sessions from anon;
revoke all on public.studio_mini_slots from anon;
revoke insert, update, delete, truncate on public.studio_mini_sessions from authenticated;
revoke insert, update, delete, truncate on public.studio_mini_slots from authenticated;

revoke all on function public.mini_book_slot(uuid, integer, text, text, text, boolean, text, text, integer) from public, anon, authenticated;
grant execute on function public.mini_book_slot(uuid, integer, text, text, text, boolean, text, text, integer) to service_role;
revoke all on function public.mini_release_expired(uuid) from public, anon, authenticated;
grant execute on function public.mini_release_expired(uuid) to service_role;
