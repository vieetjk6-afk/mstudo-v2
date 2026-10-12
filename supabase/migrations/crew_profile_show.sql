-- ─────────────────────────────────────────────────────────────────────────
-- Hồ sơ thợ · thông tin show · đăng ký theo studio · feed lịch
--
-- Chạy SAU crew_schedule.sql. Idempotent, chạy lại nhiều lần vô hại.
-- ─────────────────────────────────────────────────────────────────────────

-- 1) Hồ sơ thợ — studio nhập, hoặc thợ tự điền nếu studio để trống.
--    Gọn đúng những gì cần để xếp việc và trả lương; SĐT đã có sẵn trong bảng
--    và là danh tính của thợ nên không thêm gì cho nó.
alter table public.studio_crew add column if not exists email        text;
alter table public.studio_crew add column if not exists address      text;
alter table public.studio_crew add column if not exists bank_name    text;   -- tên ngân hàng của STK
alter table public.studio_crew add column if not exists bank_account text;
alter table public.studio_crew add column if not exists skills       text;   -- kỹ năng (chụp, quay, dựng…)
alter table public.studio_crew add column if not exists equipment    text;   -- thiết bị mang theo được
-- Thợ tự điền lúc nào (để studio biết dòng nào do thợ khai).
alter table public.studio_crew add column if not exists self_filled_at timestamptz;
-- 'active'  = studio đã nhận vào sổ
-- 'pending' = thợ tự đăng ký qua link của studio, chờ studio duyệt
alter table public.studio_crew add column if not exists status         text not null default 'active';

-- 2) Thông tin SHOW trên từng phân công — studio gán gì thì thợ thấy đúng thế.
--    task: chụp / quay / cả hai · side: nhà trai / nhà gái / sắp xếp sau
alter table public.contract_crew add column if not exists task       text;
alter table public.contract_crew add column if not exists side       text;
alter table public.contract_crew add column if not exists start_time time;
alter table public.contract_crew add column if not exists end_time   time;

-- 3) Nối mốc lịch với phân công: gỡ thợ khỏi hợp đồng thì mốc lịch tự biến mất
--    (on delete cascade), khỏi để lại lịch ma.
alter table public.crew_unavailable
  add column if not exists contract_crew_id uuid references public.contract_crew (id) on delete cascade;
create index if not exists crew_unavailable_assign_idx on public.crew_unavailable (contract_crew_id);

-- 4) Link đăng ký riêng của mỗi studio: /crew/<crew_token>.
--    Tách khỏi booking_token (dành cho KHÁCH đặt lịch) để hai đối tượng không
--    dùng chung một bí mật — đổi cái này không làm hỏng cái kia.
alter table public.profiles add column if not exists crew_token text unique;

-- 5) Tài khoản nhẹ của thợ: giữ token feed lịch (.ics) để thợ tự đăng ký vào
--    Google Calendar. Không OAuth, không tài khoản — thợ chỉ có số điện thoại.
create table if not exists public.crew_account (
  phone          text primary key,
  calendar_token text unique,
  created_at     timestamptz not null default now()
);
alter table public.crew_account enable row level security;
-- Đọc/ghi CHỈ qua service role (/api/crew, /api/crew-calendar). Cố ý KHÔNG có
-- policy nào: bảng giữ calendar_token — ai có token là tải được feed lịch của
-- thợ (tên khách, địa điểm). Policy cũ cho mọi tài khoản đăng nhập đọc cả bảng.
drop policy if exists crew_account_read on public.crew_account;

-- ─────────────────────────────────────────────────────────────────────────
-- 6) Cách ly HOÀN TOÀN lịch bận theo studio.
--
-- crew_unavailable khoá theo SĐT nên một mốc vốn hiện với MỌI studio mà thợ đó
-- thuộc về. Nay mỗi mốc phải thuộc đúng một studio (owner_id), kể cả mốc thợ tự
-- báo — thợ chạy cho ba nơi thì báo bận riêng cho từng nơi.
--
-- owner_id đã có sẵn nhưng trước đây mang nghĩa "studio xếp hộ" (null = thợ tự
-- thêm), nên cần cột riêng để biết AI viết ra mốc đó — dùng cho quyền xoá: thợ
-- chỉ gỡ được mốc mình tự thêm, studio chỉ gỡ được mốc mình xếp.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'crew_unavailable' and column_name = 'created_by'
  ) then
    alter table public.crew_unavailable add column created_by text not null default 'crew';
    -- Dữ liệu cũ: có owner_id nghĩa là studio đã xếp hộ.
    update public.crew_unavailable set created_by = 'studio' where owner_id is not null;
  end if;
end $$;

create index if not exists crew_unavailable_owner_idx on public.crew_unavailable (owner_id, date);
