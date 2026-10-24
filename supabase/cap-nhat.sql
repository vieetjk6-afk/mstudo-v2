-- ══════════════════════════════════════════════════════════════════════════
-- mstudo — CẬP NHẬT CHO PROJECT SUPABASE ĐANG CHẠY
--
-- File này do supabase/build-setup-all.mjs sinh ra — ĐỪNG sửa tay, sửa file
-- gốc rồi chạy lại: node supabase/build-setup-all.mjs
--
-- Cách dùng: mở Supabase → SQL Editor → dán TOÀN BỘ file này → Run. Một lần.
-- Mọi câu lệnh đều idempotent nên chạy lại nhiều lần vô hại.
--
-- Project MỚI TINH thì đừng dùng file này — dùng supabase/setup-all.sql, nó
-- gồm cả schema nền. File này CHỈ có phần mới, nó giả định database của bạn
-- đã có sẵn albums, photos, profiles, studio_contracts…
-- ══════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════
-- PHẦN 1 — TẠO BẢNG
-- ══════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/automations.sql — Việc tự động theo trạng thái hợp đồng (chạy SAU album_selection_done)
-- ══════════════════════════════════════════════════════════════════════════

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

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.studio_automations    enable row level security;

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

alter table public.studio_automation_log enable row level security;


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/crew_timesheet.sql — Chấm công thợ & khoảng rảnh (chạy SAU studio_appointments)
-- ══════════════════════════════════════════════════════════════════════════

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

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.crew_timesheet  enable row level security;

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

alter table public.crew_available  enable row level security;


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/vendors.sql — Nhà cung cấp & đơn đặt ngoài
-- ══════════════════════════════════════════════════════════════════════════

-- ── Sổ nhà cung cấp ─────────────────────────────────────────────────────────
create table if not exists public.studio_vendors (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  name       text not null default '',
  kind       text not null default 'other'
               check (kind in ('album', 'makeup', 'dress', 'car', 'venue', 'print', 'other')),
  phone      text,
  contact    text,
  note       text,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- Xoá đơn thì dòng chi đi theo (on delete cascade ở trên) — tiền của một đơn
-- không còn tồn tại thì cũng không được nằm lại trong báo cáo.

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.studio_vendors enable row level security;

-- ── Đơn đặt ngoài ───────────────────────────────────────────────────────────
create table if not exists public.vendor_orders (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles (id) on delete cascade,

  -- Nhà cung cấp rời sổ thì đơn CŨ vẫn phải đọc được để đối soát → set null,
  -- không cascade. `vendor_name` giữ lại tên tại thời điểm đặt.
  vendor_id   uuid references public.studio_vendors (id) on delete set null,
  vendor_name text,

  -- Đơn có thể không gắn hợp đồng nào (mua phông nền, in card studio).
  contract_id uuid references public.studio_contracts (id) on delete set null,

  title       text not null default '',
  amount      integer not null default 0,  -- VND
  -- đã gửi → đang làm → đã nhận → đã giao khách. KHÔNG có "đã huỷ": đơn huỷ thì
  -- xoá, vì một đơn huỷ còn nằm đây sẽ tiếp tục được cộng tiền và tiếp tục bị
  -- đếm là trễ hẹn (xem src/lib/vendors.ts).
  status      text not null default 'sent'
                check (status in ('sent', 'doing', 'received', 'delivered')),
  due_date    date,
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.vendor_orders  enable row level security;


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/accounting.sql — Phiếu thu có số & khoá sổ kế toán
-- ══════════════════════════════════════════════════════════════════════════

-- ── Bộ đếm số phiếu theo studio × năm ───────────────────────────────────────
-- Cấp số bằng UPDATE ... RETURNING trên một dòng (xem hàm bên dưới) nên hai lần
-- bấm in cùng lúc KHÔNG thể nhận cùng một số.
create table if not exists public.studio_receipt_seq (
  owner_id uuid not null references public.profiles (id) on delete cascade,
  year     integer not null,
  last_no  integer not null default 0,
  primary key (owner_id, year)
);

alter table public.studio_receipt_seq enable row level security;


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/album_people.sql — Gom ảnh theo từng người trong album (chạy SAU schema.sql — cần albums + photos)
-- ══════════════════════════════════════════════════════════════════════════

-- ── Người ───────────────────────────────────────────────────────────────────
create table if not exists public.album_people (
  id             uuid primary key default gen_random_uuid(),
  album_id       uuid not null references public.albums (id) on delete cascade,
  -- Tên studio đặt. Rỗng = chưa đặt tên → không hiện chip cho khách.
  name           text not null default '' check (char_length(name) <= 60),
  -- Số khuôn mặt gom được. Chỉ để studio xếp thứ tự và nhìn ra cụm rác.
  face_count     int  not null default 0,
  -- Ảnh đại diện + khuôn mặt thứ mấy trong ảnh đó (một tấm có nhiều người).
  cover_photo_id uuid references public.photos (id) on delete set null,
  cover_at       int  not null default 0,
  /*
   * Tâm cụm: trung bình các vector 128 chiều của người này.
   *
   * Để làm gì: studio thật KHÔNG quét một lần rồi xong. Họ giao đợt đầu, chụp
   * thêm, rồi quét đợt hai. Không có vector lưu lại thì lần quét sau ra một bộ
   * người HOÀN TOÀN MỚI, studio phải đặt tên lại từ đầu và chip của khách đứt.
   * Có nó thì cụm mới ghép được vào người cũ (src/lib/face-people.ts).
   *
   * real[] chứ không phải jsonb: 128 số float4 = ~540 byte, jsonb numeric gấp
   * gần ba. Sai số float4 (~7 chữ số) không đáng kể so với ngưỡng 0,6.
   *
   * Ràng buộc độ dài là hàng rào thật: một vector sai chiều vẫn ghi được nhưng
   * làm mọi phép ghép sai lặng lẽ về sau.
   */
  descriptor     real[] check (descriptor is null or array_length(descriptor, 1) = 128),
  position       int  not null default 0,
  created_at     timestamptz not null default now()
);

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Chủ album (và admin) đọc/ghi. KHÔNG mở đọc công khai: trang khách
-- (src/app/a/[slug]/page.tsx) chạy trên máy chủ bằng service role, nên khách
-- không cần quyền gì trên bảng này.
alter table public.album_people enable row level security;

-- ── Ảnh nào có ai ───────────────────────────────────────────────────────────
create table if not exists public.album_photo_people (
  -- album_id là bản sao CÓ CHỦ Ý của album_people.album_id: câu truy vấn duy
  -- nhất mà khách chạy là "lấy hết theo album", không cần join.
  album_id  uuid not null references public.albums (id) on delete cascade,
  person_id uuid not null references public.album_people (id) on delete cascade,
  photo_id  uuid not null references public.photos (id) on delete cascade,
  primary key (person_id, photo_id)
);

alter table public.album_photo_people enable row level security;


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/album_faces.sql — Kho khuôn mặt đã quét — để lượt quét tự động chạy tiếp được (chạy SAU album_people)
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists public.album_faces (
  album_id   uuid not null references public.albums (id) on delete cascade,
  photo_id   uuid not null references public.photos (id) on delete cascade,
  -- Khuôn mặt thứ mấy TRONG tấm ảnh đó. Một tấm ảnh cưới có nhiều người.
  at         int  not null,
  /** Khung khuôn mặt [x, y, rộng, cao], chuẩn hoá 0…1 theo cạnh ảnh. */
  box        real[] not null check (array_length(box, 1) = 4),
  /** Vector đặc trưng 128 chiều, ĐỂ NGUYÊN như mô hình trả về. */
  descriptor real[] not null check (array_length(descriptor, 1) = 128),
  /** Điểm nét vùng mặt — để chọn ảnh đại diện cho mỗi người. */
  sharpness  real not null default 0,
  primary key (photo_id, at)
);

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Chủ album (và admin) đọc/ghi. Khách KHÔNG cần quyền gì: trang khách chỉ đọc
-- album_people/album_photo_people, và đọc bằng service role trên máy chủ.
alter table public.album_faces enable row level security;


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/bank_auto_reconcile.sql — Tự xác nhận chuyển khoản qua SePay: mã đợt, khoá webhook, sổ giao dịch (chạy SAU referral_deposit)
-- ══════════════════════════════════════════════════════════════════════════

-- ── 2) Khoá webhook của từng studio ─────────────────────────────────────────
create table if not exists public.studio_bank_hooks (
  owner_id      uuid primary key references public.profiles (id) on delete cascade,
  provider      text not null default 'sepay' check (provider in ('sepay')),
  secret        text not null,
  enabled       boolean not null default true,
  last_event_at timestamptz,
  created_at    timestamptz not null default now()
);

alter table public.studio_bank_hooks enable row level security;

-- ── 3) Sổ giao dịch ngân hàng ──────────────────────────────────────────────
-- matched   — đã tự ghi vào đúng đợt / đúng cọc giữ ngày
-- unmatched — nội dung không có mã nào của studio, chờ studio gán tay
-- mismatch  — có mã nhưng không tự ghi được (đợt đã thu rồi, cọc chuyển thiếu…)
-- ignored   — studio bấm "Bỏ qua" (tiền riêng, không liên quan hợp đồng)
create table if not exists public.studio_bank_transactions (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references public.profiles (id) on delete cascade,
  provider        text not null default 'sepay',
  provider_txn_id text not null,
  amount          bigint not null default 0,
  content         text,
  account_number  text,
  gateway         text,
  reference_code  text,
  txn_at          timestamptz,
  status          text not null default 'unmatched'
                    check (status in ('matched', 'unmatched', 'mismatch', 'ignored')),
  note            text,
  plan_id         uuid references public.contract_payment_plan (id) on delete set null,
  booking_id      uuid references public.studio_bookings (id) on delete set null,
  contract_id     uuid references public.studio_contracts (id) on delete set null,
  payment_id      uuid references public.contract_payments (id) on delete set null,
  created_at      timestamptz not null default now(),
  unique (owner_id, provider, provider_txn_id)
);

alter table public.studio_bank_transactions enable row level security;


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/contract_cancel_reschedule.sql — Huỷ hợp đồng (hoàn / giữ cọc, chính sách huỷ) + lịch sử dời lịch
-- ══════════════════════════════════════════════════════════════════════════

-- ── 4) Lịch sử dời lịch ─────────────────────────────────────────────────────
create table if not exists public.contract_reschedules (
  id          uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.studio_contracts (id) on delete cascade,
  old_date    date,
  old_time    text,
  new_date    date not null,
  new_time    text,
  reason      text,
  fee         integer not null default 0,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

alter table public.contract_reschedules enable row level security;


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/contract_addenda.sql — Khoá giá sau khi khách ký + phụ lục hợp đồng
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists public.contract_addenda (
  id          uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.studio_contracts (id) on delete cascade,
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  no          smallint not null default 1,
  title       text not null default '',
  note        text,
  -- Dòng nháp: [{ name, description, qty, unit_price }] — unit_price âm = giảm giá.
  lines       jsonb not null default '[]'::jsonb,
  signed_at   timestamptz,
  signed_by   text check (signed_by in ('client', 'studio')),
  signed_name text,
  signature   text,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (contract_id, no)
);

-- Đọc: mọi thành viên studio. Ghi: CHỈ qua route máy chủ (service role) — không
-- cấp policy ghi nào cho authenticated.
alter table public.contract_addenda enable row level security;


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/studio_vouchers.sql — Voucher / thẻ quà tặng của studio (chạy SAU contract_cancel_reschedule)
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists public.studio_vouchers (
  id                   uuid primary key default gen_random_uuid(),
  owner_id             uuid not null references public.profiles (id) on delete cascade,
  code                 text not null,
  title                text not null default 'Voucher chụp ảnh',
  amount               integer not null check (amount > 0),      -- mệnh giá (VND)
  price                integer not null default 0 check (price >= 0), -- giá bán thực thu
  buyer_name           text,
  buyer_phone          text,
  recipient_name       text,
  paid                 boolean not null default false,
  paid_method          text,
  paid_at              date,
  expires_on           date,
  status               text not null default 'active' check (status in ('active', 'redeemed', 'void')),
  redeemed_contract_id uuid references public.studio_contracts (id) on delete set null,
  redeemed_payment_id  uuid references public.contract_payments (id) on delete set null,
  redeemed_at          timestamptz,
  note                 text,
  created_by           uuid references public.profiles (id) on delete set null,
  created_at           timestamptz not null default now(),
  unique (owner_id, code)
);

alter table public.studio_vouchers enable row level security;


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/studio_voucher_program.sql — Chương trình voucher ưu đãi tự gắn mọi hợp đồng (chạy SAU studio_vouchers_loyalty)
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists public.studio_voucher_program (
  owner_id      uuid primary key references public.profiles (id) on delete cascade,
  enabled       boolean not null default false,
  percent       smallint not null default 5 check (percent between 1 and 100),
  max_discount  integer check (max_discount is null or max_discount > 0),
  -- null = không giới hạn thời gian
  valid_months  smallint check (valid_months is null or valid_months between 1 and 120),
  title         text not null default 'Voucher ưu đãi lần sau',
  updated_at    timestamptz not null default now()
);

alter table public.studio_voucher_program enable row level security;


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/studio_saved_signature.sql — Lưu chữ ký Bên A của studio để ký hợp đồng một chạm
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- CHỮ KÝ BÊN A ĐÃ LƯU CỦA STUDIO
--
-- Studio ký xác nhận hợp đồng rất nhiều lần — mỗi lần vẽ lại chữ ký trên màn
-- hình vừa mất công vừa mỗi lần một khác. Lưu MỘT chữ ký (tên người đại diện +
-- ảnh chữ ký) cho cả studio; lần sau bấm "Ký bằng chữ ký đã lưu" là xong.
--
-- Chỉ ghi qua route /api/studio/signature (chủ / quản lý), để một tài khoản
-- nhân viên bất kỳ không thay được chữ ký đại diện của studio. Thành viên
-- studio đọc được (màn hợp đồng cần hiện ra để ký).
-- Chạy 1 lần trong Supabase SQL Editor. An toàn khi chạy lại.
-- ============================================================================

create table if not exists public.studio_saved_signature (
  owner_id    uuid primary key references public.profiles (id) on delete cascade,
  signer_name text not null,
  signature   text not null,              -- ảnh PNG data URL
  updated_by  uuid references public.profiles (id) on delete set null,
  updated_at  timestamptz not null default now()
);

alter table public.studio_saved_signature enable row level security;


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/studio_audit_log.sql — Nhật ký thao tác tiền & hợp đồng
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- NHẬT KÝ THAO TÁC — tiền & hợp đồng
--
-- Studio có nhiều vai trò cùng ghi thu, sửa giá, đổi trạng thái. Một khoản thu
-- biến mất hay một giá bị sửa thì trước đây không ai biết là ai, lúc nào.
--
-- HAI ĐƯỜNG GHI, vì app ghi dữ liệu bằng hai cách:
--
--  1) Trigger dưới DB — cho mọi thao tác NGƯỜI DÙNG ghi thẳng từ trình duyệt
--     (ContractEditor ghi contract_payments / contract_items / studio_contracts
--     bằng supabase client). Người thao tác = auth.uid().
--  2) logAction() trong src/lib/audit-log.ts — cho các route MÁY CHỦ chạy bằng
--     service role (huỷ, dời lịch, đổi trạng thái, phụ lục, voucher…). Ở đó
--     auth.uid() là null nên trigger TỰ BỎ QUA, và route ghi kèm người thao tác
--     thật mà nó đã xác minh. Không ghi trùng, không mất người.
--
-- Bất biến: không có policy insert/update/delete cho authenticated — người dùng
-- chỉ ĐỌC được, không ai sửa hay xoá được dấu vết của chính mình.
-- Đọc: chủ studio, kế toán của studio, admin nền tảng.
--
-- Chạy 1 lần trong Supabase SQL Editor. An toàn khi chạy lại.
-- ============================================================================

create table if not exists public.studio_audit_log (
  id          bigint generated always as identity primary key,
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  actor_id    uuid references public.profiles (id) on delete set null,
  action      text not null,          -- 'payment.insert', 'contract.status', 'addendum.confirm'…
  entity      text not null,          -- 'payment' | 'expense' | 'contract' | 'voucher' | 'account'
  entity_id   uuid,
  -- Không khoá ngoại: nhật ký phải sống lâu hơn hợp đồng đã xoá.
  contract_id uuid,
  summary     text,
  before      jsonb,
  after       jsonb,
  created_at  timestamptz not null default now()
);

alter table public.studio_audit_log enable row level security;


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/vai_tro_tho_tu_dat.sql — Vai trò thợ studio tự đặt (đổi tên / ẩn / thêm vai trò) + bỏ ràng buộc vai trò contract_crew (chạy SAU crew_role_makeup)
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists public.studio_crew_roles (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  key        text not null check (length(key) between 1 and 40),
  -- Rỗng trên dòng đè vai trò có sẵn = giữ tên mặc định của app.
  label      text not null default '' check (length(label) <= 60),
  kinds      text[] not null default '{shoot,makeup,combo}'
               check (kinds <@ array['shoot', 'makeup', 'combo']::text[]),
  active     boolean not null default true,
  position   integer not null default 0,
  created_at timestamptz not null default now(),
  unique (owner_id, key)
);

alter table public.studio_crew_roles enable row level security;


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
-- ▶ migrations/anh_in_tang.sql — Ảnh in tặng: số ảnh in theo hợp đồng + khách chọn ảnh in trong album giao khách
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists public.print_picks (
  id          uuid primary key default gen_random_uuid(),
  album_id    uuid not null references public.albums (id) on delete cascade,
  photo_id    uuid not null references public.photos (id) on delete cascade,
  photo_name  text not null default '',
  created_at  timestamptz not null default now(),
  unique (album_id, photo_id)
);

-- RLS: chủ album (và admin) đọc; khách ghi qua service role trong API route
-- /api/album/[slug]/print — giống selections / dislikes.
alter table public.print_picks enable row level security;


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/ke_hoach_cuoi.sql — Kế hoạch cưới của khách trên cổng khách: việc cần làm, ngân sách, lịch trình ngày cưới + bật/tắt theo hợp đồng
-- ══════════════════════════════════════════════════════════════════════════

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

alter table public.wedding_plans enable row level security;


-- ══════════════════════════════════════════════════════════════════════════
-- PHẦN 2 — CỘT BỔ SUNG, CHỈ MỤC, HÀM, TRIGGER, DỮ LIỆU MẶC ĐỊNH
-- ══════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/danh_gia_khach.sql — Đánh giá khách: studio duyệt & trả lời (chạy SAU schema.sql)
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- ĐÁNH GIÁ KHÁCH — studio xem, duyệt và TRẢ LỜI được
--
-- Bảng `feedback` đã có sẵn từ schema.sql: khách gửi cảm nhận ở cuối trang album
-- giao khách, website studio đọc ra để khoe. Thiếu ba thứ khiến nó gần như vô
-- dụng với chủ studio:
--
--   1. Không có chỗ nào trong khu quản lý để XEM — dữ liệu nằm im trong bảng.
--   2. `approved` mặc định `true`, nên một đánh giá 1 sao lên thẳng trang chủ
--      trước khi studio kịp biết. Đổi mặc định thành `false`: từ nay đánh giá
--      phải được duyệt mới hiện. Hàng CŨ giữ nguyên trạng thái đang có —
--      `alter column … set default` chỉ áp cho bản ghi mới, không đụng dữ liệu
--      đã lên website (nếu ép hết về chờ duyệt thì mọi studio đang chạy sẽ mất
--      sạch đánh giá trên trang chủ trong một đêm).
--   3. Không trả lời được. Một lời cảm ơn dưới đánh giá là thứ khách hàng sau
--      đọc nhiều nhất, nên `reply` hiện CÔNG KHAI cùng đánh giá.
--
-- Không thêm `owner_id`: policy sẵn có đã nối qua `albums` để xác định chủ, và
-- màn quản lý đọc bằng inner-join đúng đường đó. Thêm cột trùng nghĩa chỉ tạo
-- thêm một nguồn sự thật nữa phải giữ đồng bộ.
--
-- Chạy 1 lần trong Supabase SQL Editor.
-- ============================================================================

-- ── Kiểm tra điều kiện trước ────────────────────────────────────────────────
-- Migration chỉ VÁ bảng đã có. Thiếu bảng nền thì Postgres chỉ nói
-- `42P01: relation "..." does not exist` — đúng, nhưng không nói phải làm gì.
-- Khối này nói thẳng. (Chạy qua setup-all.sql thì khối `do $$` rơi vào PHẦN 2,
-- tức là SAU khi PHẦN 1 đã tạo hết bảng, nên nó luôn qua.)
do $$
declare thieu text[] := '{}';
begin
  if to_regclass('public.feedback') is null then thieu := thieu || 'feedback'::text; end if;
  if array_length(thieu, 1) > 0 then
    raise exception E'Thiếu bảng: %.\n\nProject chưa có schema nền của bản 2.0 nên migration không vá vào đâu được.\nChạy MỘT file duy nhất: supabase/setup-all.sql — nó gồm cả schema nền lẫn chính migration này,\nvà mọi câu lệnh đều "if not exists" nên không xoá gì của project đang chạy.\n\nMuốn biết project đang thiếu những gì: chạy supabase/kiem-tra-truoc-khi-chay-migration.sql',
      array_to_string(thieu, ', ');
  end if;
end $$;

alter table public.feedback
  add column if not exists reply        text,
  add column if not exists replied_at   timestamptz,
  -- Dấu vết studio ĐÃ QUYẾT về hàng này (bấm duyệt hoặc bấm ẩn). Cần một cột
  -- RIÊNG chứ không dùng ké `replied_at`: "chờ duyệt" và "đã ẩn" trong DB đều
  -- là approved=false, mà studio hoàn toàn có thể trả lời một đánh giá xấu rồi
  -- vẫn chưa quyết cho hiện hay không — dùng ké thì hàng đó tự nhảy sang "đã
  -- ẩn" chỉ vì được trả lời.
  add column if not exists moderated_at timestamptz;

-- Hàng CŨ: đang hiện trên website nghĩa là studio (theo mặc định trước đây) đã
-- để nó hiện — đánh dấu đã quyết luôn, để chúng không đổ hết vào tab "Chờ
-- duyệt" ngay lần đầu studio mở màn hình.
update public.feedback set moderated_at = coalesce(moderated_at, created_at) where approved;

-- Từ nay: đánh giá mới phải được studio duyệt mới lên website.
alter table public.feedback alter column approved set default false;

-- Màn quản lý lọc theo trạng thái duyệt và xếp mới nhất trước; trang album đọc
-- theo album. Khoá ngoại KHÔNG tự tạo chỉ mục trong Postgres nên phải khai tay.
create index if not exists feedback_album_idx on public.feedback (album_id, created_at desc);

create index if not exists feedback_approved_idx on public.feedback (approved, created_at desc);

create index if not exists feedback_moderation_idx on public.feedback (approved, moderated_at);

-- Policy giữ nguyên như schema.sql: công khai đọc bản đã duyệt, chủ album (và
-- admin) toàn quyền. `reply` đi theo hàng nên tự hiện công khai cùng đánh giá —
-- đúng ý: lời studio trả lời là để khách sau đọc.


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/nguon_khach.sql — Nguồn khách & phễu chuyển đổi (chạy SAU website_leads)
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- NGUỒN KHÁCH & PHỄU CHUYỂN ĐỔI
--
-- `studio_contracts.source` đã có từ trước (schema.sql) và màn Thu chi đã gom
-- doanh thu theo nguồn. Vấn đề: cột đó phải GÕ TAY, mà lúc lập hợp đồng thì
-- không ai nhớ ba tuần trước khách bấm vào quảng cáo nào — nên nó gần như luôn
-- rỗng và biểu đồ theo nguồn gần như luôn trống.
--
-- Migration này vá đúng ba chỗ làm đứt chuỗi:
--
--   1. Yêu cầu đặt lịch KHÔNG ghi nguồn. Đây mới là lúc biết được: trình duyệt
--      của khách đang mang sẵn utm_* / fbclid / referrer.
--   2. Lead từ chatbox cũng vậy. (`website_leads.source` đã có nhưng mang nghĩa
--      KHÁC — "site nào" — nên kênh tiếp thị phải là một cột riêng `channel`,
--      không được đè lên.)
--   3. Bấm "Tạo hợp đồng" từ một yêu cầu đặt lịch thì nguồn RƠI MẤT: hợp đồng
--      mới không giữ lại gì nối về yêu cầu gốc. `booking_id` nối lại chuỗi để
--      đếm được phễu khách hỏi → đặt lịch → hợp đồng.
--
-- Chỉ lưu nhãn kênh + tham số quảng cáo thô. KHÔNG cookie, không id theo dõi,
-- không lịch sử duyệt web.
--
-- Chạy 1 lần trong Supabase SQL Editor.
-- ============================================================================

-- ── Kiểm tra điều kiện trước ────────────────────────────────────────────────
-- Migration chỉ VÁ bảng đã có. Thiếu bảng nền thì Postgres chỉ nói
-- `42P01: relation "..." does not exist` — đúng, nhưng không nói phải làm gì.
-- Khối này nói thẳng. (Chạy qua setup-all.sql thì khối `do $$` rơi vào PHẦN 2,
-- tức là SAU khi PHẦN 1 đã tạo hết bảng, nên nó luôn qua.)
do $$
declare thieu text[] := '{}';
begin
  if to_regclass('public.studio_bookings') is null then thieu := thieu || 'studio_bookings'::text; end if;
  if to_regclass('public.website_leads') is null then thieu := thieu || 'website_leads'::text; end if;
  if to_regclass('public.studio_contracts') is null then thieu := thieu || 'studio_contracts'::text; end if;
  if array_length(thieu, 1) > 0 then
    raise exception E'Thiếu bảng: %.\n\nProject chưa có schema nền của bản 2.0 nên migration không vá vào đâu được.\nChạy MỘT file duy nhất: supabase/setup-all.sql — nó gồm cả schema nền lẫn chính migration này,\nvà mọi câu lệnh đều "if not exists" nên không xoá gì của project đang chạy.\n\nMuốn biết project đang thiếu những gì: chạy supabase/kiem-tra-truoc-khi-chay-migration.sql',
      array_to_string(thieu, ', ');
  end if;
end $$;

-- 1. Yêu cầu đặt lịch -------------------------------------------------------
alter table public.studio_bookings
  add column if not exists source       text,   -- facebook | referral | google | walk_in | returning | other
  add column if not exists utm          jsonb,  -- {source,medium,campaign,content,term} thô
  add column if not exists landing_path text;

-- trang khách đang đứng lúc gửi

create index if not exists studio_bookings_source_idx
  on public.studio_bookings (owner_id, source);

-- 2. Lead từ chatbox --------------------------------------------------------
alter table public.website_leads
  add column if not exists channel text,  -- kênh tiếp thị (KHÁC cột `source` = site nào)
  add column if not exists utm     jsonb;

create index if not exists website_leads_channel_idx
  on public.website_leads (owner_id, channel);

-- 3. Nối hợp đồng về yêu cầu đặt lịch đã sinh ra nó --------------------------
-- `on delete set null`: studio xoá một yêu cầu đặt lịch cũ thì hợp đồng (và
-- tiền của nó) phải sống tiếp, chỉ mất phần quy nguồn.
alter table public.studio_contracts
  add column if not exists booking_id uuid references public.studio_bookings (id) on delete set null;

create index if not exists studio_contracts_booking_idx
  on public.studio_contracts (booking_id);

create index if not exists studio_contracts_source_idx
  on public.studio_contracts (owner_id, source);

-- RLS: cả ba bảng đã bật sẵn với policy owner/admin — cột mới đi theo hàng nên
-- không cần policy riêng.


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/automations.sql — Việc tự động theo trạng thái hợp đồng (chạy SAU album_selection_done)
-- ══════════════════════════════════════════════════════════════════════════

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

create index if not exists studio_automations_owner_idx on public.studio_automations (owner_id);

create index if not exists studio_automation_log_owner_idx
  on public.studio_automation_log (owner_id, fired_at desc);

create index if not exists studio_automation_log_contract_idx
  on public.studio_automation_log (contract_id);

-- ── Kiểm tra sau khi chạy ───────────────────────────────────────────────────
-- select rule, enabled, offset_days from public.studio_automations order by rule;
-- select rule, count(*) from public.studio_automation_log group by rule;


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/crew_timesheet.sql — Chấm công thợ & khoảng rảnh (chạy SAU studio_appointments)
-- ══════════════════════════════════════════════════════════════════════════

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

create index if not exists crew_timesheet_owner_idx  on public.crew_timesheet (owner_id, work_date desc);

create index if not exists crew_timesheet_phone_idx  on public.crew_timesheet (phone, work_date desc);

create index if not exists crew_timesheet_contract_idx on public.crew_timesheet (contract_id);

-- Mỗi thợ chỉ được có MỘT dòng đang mở tại một thời điểm. Không có hàng rào này
-- thì thợ bấm "đã đến" hai lần (mạng chậm, bấm lại) sẽ đẻ ra hai dòng mở và giờ
-- làm bị tính đôi.
create unique index if not exists crew_timesheet_one_open_idx
  on public.crew_timesheet (phone)
  where ended_at is null;

create index if not exists crew_available_phone_idx on public.crew_available (phone, date);

-- ── Kiểm tra sau khi chạy ───────────────────────────────────────────────────
-- select phone, work_date, started_at, ended_at from public.crew_timesheet
-- order by work_date desc limit 20;


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/vendors.sql — Nhà cung cấp & đơn đặt ngoài
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- NHÀ CUNG CẤP & ĐƠN ĐẶT NGOÀI
--
-- Album in, makeup thuê ngoài, xe hoa, địa điểm — tất cả đang chỉ là MỘT DÒNG
-- CHI trong studio_expenses. Nên không ai trả lời được câu hỏi hằng ngày của
-- studio: "đơn album của khách A đã in xong chưa?".
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
                 where table_schema = 'public' and table_name = 'studio_expenses')
  then missing := missing || 'studio_expenses'; end if;

  if array_length(missing, 1) > 0 then
    raise exception
      'Thiếu bảng nền: %. Hãy chạy supabase/setup-all.sql trước (nó gồm cả schema nền lẫn migration này).',
      array_to_string(missing, ', ');
  end if;
end $$;

create index if not exists studio_vendors_owner_idx on public.studio_vendors (owner_id, active);

create index if not exists vendor_orders_owner_idx    on public.vendor_orders (owner_id, status, due_date);

create index if not exists vendor_orders_contract_idx on public.vendor_orders (contract_id);

-- ── Nối sang sổ chi, KHÔNG đếm tiền hai lần ─────────────────────────────────
-- Mỗi đơn sinh ĐÚNG MỘT dòng studio_expenses mang vendor_order_id của nó. Mọi
-- lần sửa đơn CẬP NHẬT chính dòng đó (upsert theo cột unique bên dưới) chứ
-- không thêm dòng mới — nếu không, sửa giá đơn ba lần là ba dòng chi và báo cáo
-- lợi nhuận sai gấp ba.
alter table public.studio_expenses
  add column if not exists vendor_order_id uuid references public.vendor_orders (id) on delete cascade;

-- UNIQUE (chứ không chỉ index tra nhanh): đây là hàng rào thật chặn dòng chi
-- trùng, kể cả khi hai tab cùng bấm lưu một đơn.
create unique index if not exists studio_expenses_vendor_order_uidx
  on public.studio_expenses (vendor_order_id)
  where vendor_order_id is not null;

-- ── Kiểm tra sau khi chạy ───────────────────────────────────────────────────
-- select v.name, o.title, o.status, o.due_date, o.amount
-- from public.vendor_orders o left join public.studio_vendors v on v.id = o.vendor_id
-- order by o.due_date;


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/accounting.sql — Phiếu thu có số & khoá sổ kế toán
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- HOÁ ĐƠN & XUẤT KẾ TOÁN
--
-- Studio có doanh thu thật cần hai thứ app chưa có:
--   1. PHIẾU THU đưa khách cho mỗi lần nhận tiền — cần một SỐ PHIẾU bền, đánh
--      theo năm, không trùng.
--   2. KHOÁ SỔ: báo cáo tháng trước đã gửi kế toán, rồi ai đó sửa một hợp đồng
--      cũ và con số tháng trước đổi mà không ai biết. Mốc khoá sổ biến "đừng sửa
--      số cũ" từ lời dặn miệng thành hàng rào.
--
-- Chạy 1 lần trong Supabase SQL Editor. An toàn khi chạy lại.
-- ============================================================================

do $$
begin
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'contract_payments')
  then
    raise exception
      'Thiếu bảng nền: contract_payments. Hãy chạy supabase/setup-all.sql trước.';
  end if;
end $$;

-- ── Số phiếu thu ────────────────────────────────────────────────────────────
-- Đánh theo NĂM ('PT-2026-0007'), nếp sổ sách Việt Nam, và giữ số ngắn sau
-- mười năm. Định dạng do src/lib/accounting.ts (receiptNo) lo; ở đây chỉ lưu.
--
-- null = chưa in phiếu cho lần thu này. Số chỉ được cấp KHI IN, không cấp sẵn
-- cho mọi lần thu: studio ghi nhận một khoản rồi sửa/xoá là chuyện thường, mà
-- một dãy số phiếu thủng lỗ chỗ thì kế toán không giải thích được.
alter table public.contract_payments add column if not exists receipt_no  text;

alter table public.contract_payments add column if not exists receipt_at  timestamptz;

-- Số phiếu không được trùng TRONG MỘT studio. Ràng buộc phải qua hợp đồng vì
-- contract_payments không có owner_id — nên dùng bảng đếm riêng bên dưới thay vì
-- một unique index không biểu diễn được.
create index if not exists contract_payments_receipt_idx
  on public.contract_payments (receipt_no)
  where receipt_no is not null;

/**
 * Cấp số phiếu thu kế tiếp cho một studio trong một năm.
 *
 * `insert ... on conflict do update` là một câu lệnh nguyên tử: hai người cùng
 * bấm in một lúc thì Postgres tuần tự hoá chúng và mỗi người nhận một số khác
 * nhau. Đọc-rồi-ghi ở tầng ứng dụng KHÔNG làm được điều đó.
 */
/*
 * Người gọi phải là chủ / nhân viên của studio `p_owner` (is_studio_member —
 * nhân viên in phiếu với p_owner = id chủ studio), hoặc service-role. Không có
 * chốt này thì bất kỳ tài khoản nào cũng đẩy được bộ đếm của studio khác.
 * Cùng định nghĩa với migrations/bao_mat_quyen_rpc_storage.sql — sửa thì sửa cả hai.
 */
create or replace function public.next_receipt_no(p_owner uuid, p_year integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_no integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_studio_member(p_owner) then
    raise exception 'không có quyền cấp số phiếu cho studio này' using errcode = '42501';
  end if;
  insert into public.studio_receipt_seq (owner_id, year, last_no)
  values (p_owner, p_year, 1)
  on conflict (owner_id, year)
  do update set last_no = public.studio_receipt_seq.last_no + 1
  returning last_no into v_no;
  return v_no;
end;
$$;

-- ── Khoá sổ ─────────────────────────────────────────────────────────────────
-- Ngày CUỐI CÙNG đã chốt. Mọi bút toán có ngày ≤ mốc này là bất biến (luật ở
-- src/lib/accounting.ts, isLocked). null = chưa khoá kỳ nào.
alter table public.profiles add column if not exists books_closed_until date;

-- ── Kiểm tra sau khi chạy ───────────────────────────────────────────────────
-- select owner_id, year, last_no from public.studio_receipt_seq;
-- select receipt_no, receipt_at, amount from public.contract_payments
--   where receipt_no is not null order by receipt_at desc limit 10;

-- ── HÀNG RÀO KHOÁ SỔ (trigger) ──────────────────────────────────────────────
--
-- Mốc `books_closed_until` ở trên mới chỉ là một CON SỐ. Không có phần dưới đây
-- thì nó chỉ là lời dặn miệng có màu: giao diện nhắc, còn ai bấm sửa vẫn sửa
-- được, và đúng cái tình huống cần chặn (sửa một hợp đồng cũ làm đổi số của kỳ
-- đã gửi kế toán) vẫn xảy ra y như trước.
--
-- Chặn ở DB chứ không ở giao diện: RLS cho phép studio ghi thẳng vào hai bảng
-- này bằng anon key, nên một kiểm tra ở React không phải hàng rào.
--
-- CHỈ chặn thay đổi ĐỘNG TỚI TIỀN. Đóng dấu số phiếu thu (`receipt_no`), đính
-- ảnh chuyển khoản, sửa ghi chú… đều không làm đổi con số nào của kỳ, mà lại là
-- việc studio hay làm trên phiếu cũ — chặn cả những thứ đó thì studio sẽ đi mở
-- khoá sổ để in một tờ phiếu, và cái khoá thành vô nghĩa.

create or replace function public.guard_books_closed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner   uuid;
  v_closed  date;
  v_old_day date;
  v_new_day date;
  v_money_changed boolean := true;
begin
  -- Chủ sở hữu + ngày của bút toán, tuỳ bảng.
  if tg_table_name = 'studio_expenses' then
    v_owner   := coalesce(new.owner_id, old.owner_id);
    v_old_day := (case when tg_op <> 'INSERT' then old.spent_at end);
    v_new_day := (case when tg_op <> 'DELETE' then new.spent_at end);
    if tg_op = 'UPDATE' then
      v_money_changed := (new.amount is distinct from old.amount)
                      or (new.spent_at is distinct from old.spent_at)
                      or (new.category is distinct from old.category)
                      or (new.contract_id is distinct from old.contract_id);
    end if;
  else -- contract_payments
    select c.owner_id into v_owner
    from public.studio_contracts c
    where c.id = coalesce(new.contract_id, old.contract_id);
    v_old_day := (case when tg_op <> 'INSERT' then old.paid_at::date end);
    v_new_day := (case when tg_op <> 'DELETE' then new.paid_at::date end);
    if tg_op = 'UPDATE' then
      v_money_changed := (new.amount is distinct from old.amount)
                      or (new.paid_at is distinct from old.paid_at)
                      or (new.kind is distinct from old.kind)
                      or (new.contract_id is distinct from old.contract_id);
    end if;
  end if;

  if v_owner is null then
    return coalesce(new, old);
  end if;

  select p.books_closed_until into v_closed from public.profiles p where p.id = v_owner;
  if v_closed is null or not v_money_changed then
    return coalesce(new, old);
  end if;

  -- Xét CẢ hai mốc ngày: dời một bút toán RA KHỎI kỳ đã khoá cũng là làm đổi số
  -- của kỳ đó, y như sửa tại chỗ.
  if (v_old_day is not null and v_old_day <= v_closed)
     or (v_new_day is not null and v_new_day <= v_closed) then
    raise exception
      'Sổ đã khoá tới %. Bút toán trong kỳ đã chốt không sửa/xoá/thêm được. Mở khoá kỳ ở màn Thu chi & công nợ nếu thật sự cần.',
      to_char(v_closed, 'DD/MM/YYYY')
      using errcode = 'check_violation';
  end if;

  return coalesce(new, old);
end $$;

drop trigger if exists guard_books_closed_expenses on public.studio_expenses;

create trigger guard_books_closed_expenses
  before insert or update or delete on public.studio_expenses
  for each row execute function public.guard_books_closed();

drop trigger if exists guard_books_closed_payments on public.contract_payments;

create trigger guard_books_closed_payments
  before insert or update or delete on public.contract_payments
  for each row execute function public.guard_books_closed();

-- ── Kiểm tra hàng rào sau khi chạy ──────────────────────────────────────────
-- update public.profiles set books_closed_until = current_date where id = auth.uid();
-- insert into public.studio_expenses (owner_id, title, amount, spent_at)
--   values (auth.uid(), 'thử', 1000, current_date - 1);   -- PHẢI báo lỗi
-- update public.profiles set books_closed_until = null where id = auth.uid();


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/weather.sql — Toạ độ điểm chụp cho dự báo thời tiết (chạy SAU studio_appointments)
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- THỜI TIẾT & ĐƯỜNG ĐI CHO BUỔI CHỤP NGOẠI CẢNH
--
-- Rủi ro lớn nhất của studio ngoại cảnh là mưa, mà app chưa nói gì về nó dù đã
-- lưu ngày giờ (studio_appointments) và địa điểm (dạng chữ) của từng buổi.
--
-- Để tra dự báo cần TOẠ ĐỘ. Hiện toạ độ chỉ nằm rải rác trong
-- studio_contracts.intake (jsonb do khách điền qua LocationPicker) — không đọc
-- được nhanh, và không có gì cho những buổi studio tự tạo. Migration này thêm
-- hai cột toạ độ vào đúng nơi cần, cộng MỘT vị trí studio làm điểm xuất phát để
-- ước lượng đường đi.
--
-- Không thêm bảng nào. Chạy 1 lần trong Supabase SQL Editor; an toàn khi chạy lại.
-- ============================================================================

-- ── Kiểm tra điều kiện ──────────────────────────────────────────────────────
-- Cùng cách làm với các migration khác: thiếu bảng nền thì nói rõ phải làm gì,
-- thay vì để Postgres trả về 42P01 trần trụi.
do $$
declare missing text[] := '{}';
begin
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'studio_appointments')
  then missing := missing || 'studio_appointments'; end if;
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'studio_contracts')
  then missing := missing || 'studio_contracts'; end if;

  if array_length(missing, 1) > 0 then
    raise exception
      'Thiếu bảng nền: %. Hãy chạy supabase/setup-all.sql trước (nó gồm cả schema nền lẫn migration này).',
      array_to_string(missing, ', ');
  end if;
end $$;

-- ── Toạ độ điểm chụp ────────────────────────────────────────────────────────
-- Kiểu double precision (không phải numeric): đây là toạ độ để tra dự báo và
-- ước lượng đường đi, độ chính xác dấu phẩy động là quá đủ, và nhẹ hơn.
--
-- null = chưa biết. Lúc đó lớp đọc dự báo tự thử hai đường khác: đọc toạ độ nằm
-- sẵn trong chuỗi địa điểm (link Google Maps studio dán vào), rồi mới tra tên
-- địa danh — xem `coordsInText` / `placeQuery` trong src/lib/weather.ts.
alter table public.studio_appointments add column if not exists lat double precision;

alter table public.studio_appointments add column if not exists lng double precision;

alter table public.studio_contracts add column if not exists lat double precision;

alter table public.studio_contracts add column if not exists lng double precision;

-- ── Vị trí studio (điểm xuất phát) ──────────────────────────────────────────
-- Một studio một địa chỉ: dùng làm điểm bắt đầu để ước lượng thời gian di
-- chuyển tới điểm chụp. Studio nhiều chi nhánh thì đây là cơ sở chính; ước
-- lượng đường đi vốn chỉ để xếp lịch trong ngày nên không cần chính xác hơn.
alter table public.profiles add column if not exists studio_lat double precision;

alter table public.profiles add column if not exists studio_lng double precision;

alter table public.profiles add column if not exists studio_address text;

-- ── Kiểm tra sau khi chạy ───────────────────────────────────────────────────
-- select column_name from information_schema.columns
-- where table_schema = 'public' and table_name = 'studio_appointments'
--   and column_name in ('lat', 'lng');


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/album_people.sql — Gom ảnh theo từng người trong album (chạy SAU schema.sql — cần albums + photos)
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- NGƯỜI TRONG ALBUM (gom ảnh theo từng người)
--
-- Studio quét MỘT LẦN trên máy mình: mạng nhận dạng 128 chiều chạy trong trình
-- duyệt, gom khuôn mặt thành từng người, studio đặt tên ("Cô dâu", "Mẹ chú rể")
-- rồi lưu kết quả xuống đây. Khách chỉ ĐỌC hai bảng này.
--
-- Vì sao phải có bảng, thay vì để trình duyệt khách tự gom:
--   mô hình nặng 26 MB. Bắt mỗi điện thoại trong nhà tải 26 MB qua 3G rồi chạy
--   nhận dạng trên từng ảnh là đánh đổi tệ — trong khi studio chỉ phải làm một
--   lần. Lưu xuống DB thì khách tải THÊM 0 byte mô hình: chỉ vài KB JSON.
--
-- Chạy 1 lần trong Supabase SQL Editor. An toàn khi chạy lại.
-- ============================================================================

do $$
declare missing text[] := '{}';
begin
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'albums')
  then missing := missing || 'albums'; end if;
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'photos')
  then missing := missing || 'photos'; end if;

  if array_length(missing, 1) > 0 then
    raise exception
      'Thiếu bảng nền: %. Hãy chạy supabase/setup-all.sql trước (nó gồm cả schema nền lẫn migration này).',
      array_to_string(missing, ', ');
  end if;
end $$;

create index if not exists album_people_album_idx on public.album_people (album_id, position);

/*
 * Khung của chính khuôn mặt đại diện: [x, y, rộng, cao], chuẩn hoá 0…1 theo
 * cạnh ảnh.
 *
 * Đây là thứ cho phép KHÁCH tìm ảnh theo khuôn mặt mà KHÔNG tải mô hình nào:
 * có khung thì cắt ra ảnh mặt bằng CSS ngay trên thumbnail album đã có sẵn.
 * Không có nó, ảnh thẻ đành lấy cả tấm — mà một tấm ảnh cưới thì có hai ba
 * người, nên khách không chỉ được vào mặt mình.
 *
 * Thêm bằng ALTER (không sửa CREATE TABLE ở trên) để những project đã chạy
 * migration này rồi chỉ cần chạy lại là có cột mới.
 */
alter table public.album_people
  add column if not exists cover_box real[];

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.album_people'::regclass and conname = 'album_people_cover_box_len'
  ) then
    alter table public.album_people
      add constraint album_people_cover_box_len
      check (cover_box is null or array_length(cover_box, 1) = 4);
  end if;
end $$;

-- Hai người cùng tên trong một album là lỗi nhập, không phải dữ liệu. Cũng chặn
-- luôn cú lưu lặp khi studio bấm hai lần. Tên rỗng thì không tính (nhiều cụm
-- chưa đặt tên là chuyện thường).
create unique index if not exists album_people_name_uk
  on public.album_people (album_id, lower(name)) where name <> '';

create index if not exists album_photo_people_album_idx on public.album_photo_people (album_id);


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/album_faces.sql — Kho khuôn mặt đã quét — để lượt quét tự động chạy tiếp được (chạy SAU album_people)
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- KHO KHUÔN MẶT ĐÃ QUÉT
--
-- Studio KHÔNG phải mở hay bấm gì: MÁY CHỦ tự quét (cron /api/cron/face-scan),
-- khách mở link là tìm được theo khuôn mặt ngay. Bảng này là thứ làm cho việc
-- "tự động" đó chịu được đời thực:
--
--  • HẾT GIỜ GIỮA CHỪNG. Một lượt serverless có trần 300 giây, mà album 800 ảnh
--    tốn ~10 phút CPU. Không lưu lại từng mẻ thì mỗi lượt cron lại quét từ đầu,
--    và sẽ không bao giờ xong.
--  • GOM LẠI. Gom lại chỉ là phép tính trên vector đã có — không phải quét lại
--    cả nghìn ảnh.
--  • THÊM ẢNH SAU. Studio bổ sung ảnh thì chỉ quét phần mới.
--
-- Chỗ chiếm: mỗi khuôn mặt ~600 byte (128 số float4 + khung + khoá). Album 800
-- ảnh, trung bình 1,5 mặt/ảnh → ~700 KB. Đổi lấy ba điều trên thì đáng.
--
-- Chạy 1 lần trong Supabase SQL Editor. An toàn khi chạy lại.
-- ============================================================================

do $$
declare missing text[] := '{}';
begin
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'albums')
  then missing := missing || 'albums'; end if;
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'photos')
  then missing := missing || 'photos'; end if;

  if array_length(missing, 1) > 0 then
    raise exception
      'Thiếu bảng nền: %. Hãy chạy supabase/setup-all.sql trước (nó gồm cả schema nền lẫn migration này).',
      array_to_string(missing, ', ');
  end if;
end $$;

/*
 * Dấu "ảnh này đã quét rồi".
 *
 * Phải có RIÊNG, không suy ra từ album_faces được: ảnh KHÔNG CÓ khuôn mặt nào
 * (ảnh cổng hoa, ảnh bàn tiệc) sẽ không sinh hàng nào cả, nên nếu lấy "có hàng
 * trong album_faces" làm dấu thì những tấm đó bị quét lại mãi mãi — và lượt quét
 * không bao giờ kết thúc.
 */
alter table public.photos
  add column if not exists faces_scanned_at timestamptz;

create index if not exists photos_faces_pending_idx
  on public.photos (album_id) where faces_scanned_at is null;

/*
 * Dấu "album này đã gom nhóm rồi", và cũng là HÀNG ĐỢI GOM NHÓM.
 *
 * Bộ quét đặt lại về null mỗi khi ghi thêm khuôn mặt mới; lượt gom đặt lại
 * thành now(). Nhờ vậy câu hỏi "album nào cần gom lại?" chỉ là một truy vấn có
 * chỉ mục, thay vì phải đếm khuôn mặt của từng album mỗi 5 phút.
 *
 * Không có nó thì có một lỗ thật: lượt cron quét xong tấm cuối rồi HẾT GIỜ đúng
 * trước bước gom — lượt sau thấy không còn gì để quét nên bỏ qua album, và album
 * đó nằm mãi ở trạng thái "đã quét, chưa có người nào".
 */
alter table public.albums
  add column if not exists faces_clustered_at timestamptz;

create index if not exists albums_faces_pending_idx
  on public.albums (id) where faces_clustered_at is null;

create index if not exists album_faces_album_idx on public.album_faces (album_id);


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/contract_item_description.sql — Mô tả chi tiết cho từng hạng mục hợp đồng
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- Mô tả cho từng hạng mục hợp đồng
--
-- Một hạng mục trước giờ chỉ có TÊN, số lượng và đơn giá. Tên thì phải ngắn để
-- bảng in không vỡ dòng, nên studio hay phải nhét cả phạm vi công việc vào đó:
--
--     "Chụp phóng sự cả ngày (2 thợ, 8h, 300 ảnh sửa màu, giao trong 20 ngày)"
--
-- Đọc trên bản in thì rối, mà khách vẫn hay hỏi lại "gói này gồm những gì".
-- Thêm một ô mô tả tự do cho mỗi hạng mục: tên giữ ngắn, chi tiết xuống dòng
-- dưới, in nhỏ hơn và nhạt hơn ở cả bản in lẫn cổng khách.
--
-- Để NULL / để trống là không hiện gì — mọi hợp đồng cũ giữ nguyên như trước.
-- ============================================================================

alter table public.contract_items
  add column if not exists description text;

comment on column public.contract_items.description is
  'Mô tả chi tiết hạng mục (phạm vi công việc, số lượng ảnh, thời gian giao…). Để trống thì không hiện.';


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/contract_internal_note.sql — Ghi chú nội bộ cho hợp đồng (khách không thấy)
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- Ghi chú NỘI BỘ cho hợp đồng
--
-- Hợp đồng trước giờ chỉ có `note` (điều khoản in ra) và `brief_note` (yêu cầu
-- của khách — hiện trong cổng khách, khách còn sửa được). Studio không có chỗ
-- nào ghi những điều chỉ người trong studio nên biết: "khách khó tính về giờ",
-- "bạn của chủ, đã bớt 1tr", "nhớ mang thêm đèn"… nên hay ghi nhầm vào Brief
-- và khách đọc được.
--
-- Cột này KHÔNG được đưa vào bất kỳ API công khai nào (/api/c, /api/form,
-- /api/book…): các route đó chọn cột tường minh, đừng đổi sang select("*").
--
-- Để NULL là không có gì — mọi hợp đồng cũ giữ nguyên.
-- ============================================================================

alter table public.studio_contracts
  add column if not exists internal_note text;

comment on column public.studio_contracts.internal_note is
  'Ghi chú nội bộ của studio về hợp đồng — KHÁCH KHÔNG THẤY. Không đưa vào API cổng khách.';


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/bank_auto_reconcile.sql — Tự xác nhận chuyển khoản qua SePay: mã đợt, khoá webhook, sổ giao dịch (chạy SAU referral_deposit)
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- TỰ XÁC NHẬN CHUYỂN KHOẢN QUA SEPAY
--
-- Trước đây tiền đã vào tài khoản studio nhưng app vẫn nằm im cho tới khi có
-- người mở app ngân hàng, dò sao kê rồi bấm "Đã thu". SePay (gói miễn phí được)
-- đọc biến động số dư rồi bắn webhook về /api/bank/sepay. Nếu nội dung chuyển
-- khoản có MÃ ĐỢT thì app tự ghi lần thu, đóng dấu đợt đã thu, báo studio và
-- nhắn Zalo xác nhận cọc cho khách.
--
--  1) contract_payment_plan.pay_code: mỗi đợt có một mã ngắn riêng (MS + 8 ký
--     tự), in vào nội dung VietQR. Mã hợp đồng không dùng được vì nó có thể trống
--     và có dấu gạch ngang, mà nhiều ngân hàng lại xoá dấu gạch trên sao kê.
--  2) studio_bank_hooks: khoá bí mật của từng studio. SePay gửi khoá này trong
--     header "Authorization: Apikey …", nhờ đó biết tiền vào của studio nào.
--  3) studio_bank_transactions: mọi giao dịch SePay báo về, đã khớp hay chưa.
--     Unique theo mã giao dịch nên SePay gửi lại cũng không bị ghi thu hai lần.
--
-- Chạy 1 lần trong Supabase SQL Editor. An toàn khi chạy lại.
-- ============================================================================

do $$
declare missing text[] := '{}';
begin
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'contract_payment_plan')
  then missing := missing || 'contract_payment_plan'; end if;
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'studio_bookings')
  then missing := missing || 'studio_bookings'; end if;

  if array_length(missing, 1) > 0 then
    raise exception
      'Thiếu bảng nền: %. Hãy chạy supabase/setup-all.sql trước (nó gồm cả schema nền lẫn migration này).',
      array_to_string(missing, ', ');
  end if;
end $$;

-- ── 1) Mã đợt thanh toán ────────────────────────────────────────────────────
-- Bảng chữ trùng với src/lib/bank-reconcile.ts (PAY_CODE_ALPHABET): bỏ 0/O,
-- 1/I/L vì khách có lúc phải gõ tay mã này vào app ngân hàng.
create or replace function public.gen_pay_code()
returns text
language plpgsql
volatile
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  out text := 'MS';
  i integer;
begin
  for i in 1..8 loop
    out := out || substr(alphabet, 1 + floor(random() * length(alphabet))::integer, 1);
  end loop;
  return out;
end $$;

alter table public.contract_payment_plan add column if not exists pay_code text;

-- Đợt đã có từ trước cũng phải có mã, nếu không các QR đang gửi cho khách vẫn
-- là loại chỉ đối soát bằng tay được.
update public.contract_payment_plan set pay_code = public.gen_pay_code() where pay_code is null;

alter table public.contract_payment_plan alter column pay_code set default public.gen_pay_code();

create unique index if not exists contract_payment_plan_pay_code_idx
  on public.contract_payment_plan (pay_code) where pay_code is not null;

create unique index if not exists studio_bank_hooks_secret_idx on public.studio_bank_hooks (secret);

create index if not exists studio_bank_transactions_owner_idx
  on public.studio_bank_transactions (owner_id, created_at desc);

-- Ghi (webhook, gán tay, bỏ qua) đều đi qua API bằng service-role: gán một giao
-- dịch vào đợt là ghi TIỀN, không để client tự sửa trạng thái.

-- ── 4) Gỡ khoản thu → giao dịch về lại hàng chờ ─────────────────────────────
-- Studio gỡ dấu "Đã thu" hoặc xoá đợt ở màn hợp đồng, tức là xoá dòng
-- contract_payments mà webhook đã ghi. Tiền thì vẫn nằm trong tài khoản, nên
-- giao dịch phải quay về "chưa rõ của ai" để gán lại hoặc bỏ qua. Nếu không nó
-- cứ hiện "Đã tự ghi thu" mà sổ thu không có đồng nào.
--
-- BEFORE DELETE chứ không AFTER: khoá ngoại payment_id `on delete set null` chạy
-- trong lúc xoá, nên tới AFTER thì không còn dòng nào trỏ về khoản thu này để tìm.
-- security definer vì người xoá (client của studio) không có quyền UPDATE bảng
-- giao dịch; trigger chỉ đụng đúng các dòng trỏ vào khoản thu đang bị xoá.
create or replace function public.bank_txn_release_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.studio_bank_transactions
     set status = 'unmatched', note = 'unlinked', payment_id = null, plan_id = null, contract_id = null
   where payment_id = old.id;
  return old;
end $$;

drop trigger if exists bank_txn_release_payment on public.contract_payments;

create trigger bank_txn_release_payment
  before delete on public.contract_payments
  for each row execute function public.bank_txn_release_payment();

notify pgrst, 'reload schema';


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/contract_cancel_reschedule.sql — Huỷ hợp đồng (hoàn / giữ cọc, chính sách huỷ) + lịch sử dời lịch
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- HUỶ HỢP ĐỒNG (HOÀN / GIỮ CỌC) + DỜI LỊCH HỢP ĐỒNG
--
-- Khách huỷ cưới, dời ngày là chuyện hằng tuần của studio ảnh cưới. Trước đây
-- app chỉ có trạng thái "Đã huỷ" mà KHÔNG có chỗ ghi tiền trả lại khách, nên
-- hoàn 50% cọc thì báo cáo vẫn đếm đủ 100% doanh thu. Dời ngày thì chỉ sửa ô
-- ngày, không ai biết ngày cũ là gì, lịch thợ và hạn thu không đổi theo.
--
--  1) contract_payments.kind thêm 'refund': một lần thu mang số ÂM. Mọi chỗ
--     cộng tiền (công nợ, báo cáo, két tiền mặt, xuất kế toán) tự trừ đúng mà
--     không phải sửa từng nơi.
--  2) Chính sách huỷ của studio (profiles): huỷ trước ≥ N ngày hoàn X% số đã
--     thu, muộn hơn hoàn Y%. App chỉ GỢI Ý số hoàn, studio sửa được.
--  3) studio_contracts.cancelled_at / cancel_reason: huỷ khi nào, vì sao.
--  4) contract_reschedules: lịch sử dời ngày (ngày cũ → ngày mới, lý do, phí).
--
-- Chạy 1 lần trong Supabase SQL Editor. An toàn khi chạy lại.
-- ============================================================================

do $$
declare missing text[] := '{}';
begin
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'contract_payments')
  then missing := missing || 'contract_payments'; end if;
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'studio_contracts')
  then missing := missing || 'studio_contracts'; end if;

  if array_length(missing, 1) > 0 then
    raise exception
      'Thiếu bảng nền: %. Hãy chạy supabase/setup-all.sql trước (nó gồm cả schema nền lẫn migration này).',
      array_to_string(missing, ', ');
  end if;
end $$;

-- ── 1) Khoản hoàn tiền ──────────────────────────────────────────────────────
alter table public.contract_payments drop constraint if exists contract_payments_kind_check;

alter table public.contract_payments add constraint contract_payments_kind_check
  check (kind in ('deposit', 'installment', 'final', 'other', 'refund'));

-- ── 2) Chính sách huỷ ───────────────────────────────────────────────────────
alter table public.profiles add column if not exists cancel_early_days smallint not null default 30;

alter table public.profiles add column if not exists cancel_early_refund_pct smallint not null default 50;

alter table public.profiles add column if not exists cancel_late_refund_pct smallint not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_cancel_policy_check') then
    alter table public.profiles
      add constraint profiles_cancel_policy_check
      check (cancel_early_days between 0 and 365
             and cancel_early_refund_pct between 0 and 100
             and cancel_late_refund_pct between 0 and 100);
  end if;
end $$;

-- ── 3) Huỷ khi nào, vì sao ──────────────────────────────────────────────────
alter table public.studio_contracts add column if not exists cancelled_at timestamptz;

alter table public.studio_contracts add column if not exists cancel_reason text;

create index if not exists contract_reschedules_contract_idx
  on public.contract_reschedules (contract_id, created_at desc);

notify pgrst, 'reload schema';


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/contract_addenda.sql — Khoá giá sau khi khách ký + phụ lục hợp đồng
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- KHOÁ GIÁ SAU KHI KHÁCH KÝ + PHỤ LỤC HỢP ĐỒNG
--
-- Trước đây khách ký xong, studio vẫn sửa tự do bảng hạng mục: tổng tiền đổi,
-- bản khách đã ký không còn khớp, và không có dấu vết nào. Sau migration này:
--
--  1) Hợp đồng khách ĐÃ KÝ → hạng mục gốc (addendum_id is null) bất biến. Hàng
--     rào là trigger dưới DB, không chỉ là nút bị ẩn trên giao diện.
--  2) Muốn thêm/bớt dịch vụ → tạo PHỤ LỤC. Phụ lục chưa ký chỉ là bản nháp
--     (cột `lines` jsonb), KHÔNG nằm trong contract_items, nên mọi chỗ cộng tổng
--     tiền của app (công nợ, báo cáo, cổng khách, xuất kế toán) không đếm nó.
--  3) Khách ký phụ lục ở cổng khách (hoặc studio xác nhận thay khi đã thoả
--     thuận qua điện thoại) → máy chủ chép các dòng nháp thành contract_items
--     mang addendum_id. Từ lúc đó tổng hợp đồng = gốc + các phụ lục đã ký, và
--     các dòng ấy cũng bất biến.
--
-- Người đi qua được hàng rào: lời gọi KHÔNG có người dùng đăng nhập
-- (auth.uid() is null) — tức service role của các route máy chủ (đã tự kiểm
-- quyền, và là đường duy nhất chép phụ lục đã ký) và SQL Editor của chủ project.
--
-- Chạy 1 lần trong Supabase SQL Editor. An toàn khi chạy lại.
-- ============================================================================

do $$
begin
  if to_regclass('public.contract_items') is null or to_regclass('public.studio_contracts') is null then
    raise exception 'Thiếu bảng nền contract_items / studio_contracts. Hãy chạy supabase/setup-all.sql trước.';
  end if;
end $$;

create index if not exists contract_addenda_contract_idx on public.contract_addenda (contract_id);

alter table public.contract_items
  add column if not exists addendum_id uuid references public.contract_addenda (id) on delete cascade;

-- ── Hàng rào: hạng mục của hợp đồng đã ký là bất biến ───────────────────────
create or replace function public.guard_signed_contract_items()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  rows_to_check public.contract_items[];
  r public.contract_items;
  signed timestamptz;
  found_contract boolean;
begin
  if auth.uid() is null then
    return coalesce(new, old);
  end if;
  -- Xoá DÂY CHUYỀN (xoá hợp đồng / phụ lục → ON DELETE CASCADE): lệnh xoá hạng
  -- mục do trigger khoá ngoại của Postgres chạy, nên độ sâu trigger > 1. Lúc đó
  -- dòng hợp đồng cha VẪN còn thấy được, nên không dựa vào "cha còn không" được.
  -- Người dùng xoá hạng mục trực tiếp thì độ sâu = 1 → vẫn bị xét như thường.
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;

  if tg_op = 'INSERT' then rows_to_check := array[new];
  elsif tg_op = 'DELETE' then rows_to_check := array[old];
  else rows_to_check := array[old, new];
  end if;

  foreach r in array rows_to_check loop
    signed := null;
    found_contract := false;
    select client_signed_at, true into signed, found_contract
      from public.studio_contracts where id = r.contract_id;
    -- Không thấy hợp đồng cha → không có gì để giữ.
    if not found_contract then
      continue;
    end if;
    -- Dòng của phụ lục đã ký: luôn khoá (phụ lục chưa ký không có dòng nào ở đây).
    if r.addendum_id is not null then
      raise exception 'contract_signed_locked' using hint = 'Hạng mục của phụ lục đã ký không sửa được.';
    end if;
    if signed is not null then
      raise exception 'contract_signed_locked' using hint = 'Khách đã ký hợp đồng — thêm/bớt dịch vụ bằng phụ lục.';
    end if;
  end loop;
  return coalesce(new, old);
end $$;

drop trigger if exists guard_signed_contract_items on public.contract_items;

create trigger guard_signed_contract_items
  before insert or update or delete on public.contract_items
  for each row execute function public.guard_signed_contract_items();


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/studio_vouchers.sql — Voucher / thẻ quà tặng của studio (chạy SAU contract_cancel_reschedule)
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- VOUCHER / THẺ QUÀ TẶNG CỦA STUDIO
--
-- Mùa 14/2, 8/3, 20/10, Tết là mùa bán thẻ quà "Voucher chụp ảnh 2 triệu".
-- Trước đây studio ghi sổ tay: không biết thẻ nào đã dùng, thẻ nào hết hạn,
-- và khách mang thẻ tới thì trừ tiền hợp đồng bằng cách… sửa giá.
--
-- CÁCH HẠCH TOÁN (quan trọng — sai là đếm tiền hai lần):
--   · Bán thẻ: tiền vào nhưng CHƯA phải doanh thu — studio còn nợ khách một
--     buổi chụp. Ghi ở studio_vouchers (price, paid), KHÔNG ghi contract_payments.
--   · Khách dùng thẻ ở hợp đồng: ghi MỘT khoản thu kind = 'voucher' bằng mệnh
--     giá. Lúc đó mới là doanh thu, và công nợ hợp đồng tự trừ đúng.
--   · Xoá khoản thu voucher → trigger trả thẻ về "còn hiệu lực" (dùng lại được).
--
-- Ghi thẻ CHỈ qua route máy chủ /api/studio/vouchers (service role) để mọi thao
-- tác vào nhật ký kèm người thật. Thành viên studio chỉ đọc.
--
-- Chạy SAU contract_cancel_reschedule.sql (cùng sửa ràng buộc kind của
-- contract_payments — bản ở đây là tập cha, gồm cả 'refund').
-- Chạy 1 lần trong Supabase SQL Editor. An toàn khi chạy lại.
-- ============================================================================

do $$
begin
  if to_regclass('public.contract_payments') is null or to_regclass('public.studio_contracts') is null then
    raise exception 'Thiếu bảng nền contract_payments / studio_contracts. Hãy chạy supabase/setup-all.sql trước.';
  end if;
end $$;

create index if not exists studio_vouchers_owner_idx on public.studio_vouchers (owner_id, created_at desc);

-- Khoản thu loại 'voucher'.
alter table public.contract_payments drop constraint if exists contract_payments_kind_check;

alter table public.contract_payments add constraint contract_payments_kind_check
  check (kind in ('deposit', 'installment', 'final', 'other', 'refund', 'voucher'));

-- Xoá khoản thu voucher (ghi nhầm hợp đồng…) → thẻ quay về "còn hiệu lực".
create or replace function public.voucher_release_on_payment_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.kind = 'voucher' then
    update public.studio_vouchers
       set status = 'active', redeemed_contract_id = null, redeemed_payment_id = null, redeemed_at = null
     where redeemed_payment_id = old.id and status = 'redeemed';
  end if;
  return old;
end $$;

drop trigger if exists voucher_release_on_payment_delete on public.contract_payments;

create trigger voucher_release_on_payment_delete before delete on public.contract_payments
  for each row execute function public.voucher_release_on_payment_delete();


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/studio_vouchers_loyalty.sql — Voucher ưu đãi lần sau: giảm theo tiền / %, QR đặt lịch (chạy SAU studio_vouchers)
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- VOUCHER ƯU ĐÃI LẦN SAU (tặng khách đã ký hợp đồng)
--
-- Khác thẻ quà (studio_vouchers.sql) ở chỗ: studio TẶNG, không bán. Nên:
--   · Không có tiền vào lúc tặng (paid = true, price = 0 cho mọi màn tính trạng
--     thái "còn hiệu lực" dùng chung một luật).
--   · Dùng ở hợp đồng sau = một DÒNG GIẢM GIÁ (contract_items, unit_price âm),
--     KHÔNG phải khoản thu. Ghi thành khoản thu thì báo cáo doanh thu / quỹ
--     tiền mặt đếm cả tiền chưa bao giờ vào túi.
--   · Giảm theo số tiền (amount) HOẶC theo % tổng hợp đồng (percent, có thể
--     chặn trần max_discount).
--   · Không dùng được ở chính hợp đồng đã tặng nó (source_contract_id).
--   · public_token: link /voucher/<token> in trong mã QR — khách quét để đặt
--     lịch kèm mã, hoặc lưu ảnh voucher về điện thoại.
--
-- Đặt lịch kèm voucher: studio_bookings.voucher_code. Chỉ GHI NHỚ mã, chưa trừ;
-- trừ khi studio chuyển yêu cầu thành hợp đồng (lúc đó mới có tổng để tính %).
--
-- Chạy SAU studio_vouchers.sql. Chạy 1 lần trong Supabase SQL Editor. An toàn
-- khi chạy lại.
-- ============================================================================

do $$
begin
  if to_regclass('public.studio_vouchers') is null then
    raise exception 'Thiếu bảng studio_vouchers. Hãy chạy supabase/migrations/studio_vouchers.sql trước.';
  end if;
end $$;

alter table public.studio_vouchers add column if not exists kind text not null default 'gift';

alter table public.studio_vouchers add column if not exists discount_type text not null default 'amount';

alter table public.studio_vouchers add column if not exists percent smallint;

alter table public.studio_vouchers add column if not exists max_discount integer;

alter table public.studio_vouchers add column if not exists source_contract_id uuid references public.studio_contracts (id) on delete set null;

alter table public.studio_vouchers add column if not exists public_token text;

alter table public.studio_vouchers drop constraint if exists studio_vouchers_kind_check;

alter table public.studio_vouchers add constraint studio_vouchers_kind_check check (kind in ('gift', 'loyalty'));

alter table public.studio_vouchers drop constraint if exists studio_vouchers_discount_type_check;

alter table public.studio_vouchers add constraint studio_vouchers_discount_type_check check (discount_type in ('amount', 'percent'));

-- Voucher % không có mệnh giá cố định → nới "amount > 0" thành luật theo loại.
alter table public.studio_vouchers drop constraint if exists studio_vouchers_amount_check;

alter table public.studio_vouchers drop constraint if exists studio_vouchers_value_check;

alter table public.studio_vouchers add constraint studio_vouchers_value_check check (
  (discount_type = 'amount' and amount > 0)
  or (discount_type = 'percent' and percent between 1 and 100 and amount >= 0 and (max_discount is null or max_discount > 0))
);

create unique index if not exists studio_vouchers_public_token_key on public.studio_vouchers (public_token) where public_token is not null;

create index if not exists studio_vouchers_source_idx on public.studio_vouchers (source_contract_id) where source_contract_id is not null;

alter table public.studio_bookings add column if not exists voucher_code text;


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/studio_voucher_program.sql — Chương trình voucher ưu đãi tự gắn mọi hợp đồng (chạy SAU studio_vouchers_loyalty)
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- CHƯƠNG TRÌNH VOUCHER ƯU ĐÃI (tự gắn vào mọi hợp đồng)
--
-- Studio cài MỘT lần ở màn Voucher & thẻ quà: tặng khách X% giá trị hợp đồng
-- (có trần), dùng cho hợp đồng lần sau. Chương trình TẮT sẵn — studio bật mới
-- có hiệu lực.
--
-- Vòng đời trên từng hợp đồng (không cần studio bấm gì):
--   · Chưa ký       → cổng khách hiện "nhận voucher lên đến …" để thu hút chốt.
--   · Khách đã ký, chưa đủ điều kiện → "voucher kích hoạt khi studio xác nhận cọc".
--   · Khách ký + studio xác nhận cọc (có lần thu) + studio ký → máy chủ PHÁT
--     voucher thật (studio_vouchers, kind 'loyalty', program_issued) với số tiền
--     = % × tổng hợp đồng lúc đó.
--   · Hợp đồng bị huỷ → voucher chưa dùng tự huỷ (trigger bên dưới).
--
-- Từng hợp đồng chỉnh được: studio_contracts.loyalty_percent
--   null = theo chương trình · 0 = tắt cho hợp đồng này · n = n% riêng.
--
-- Chạy SAU studio_vouchers_loyalty.sql. An toàn khi chạy lại.
-- ============================================================================

do $$
begin
  if to_regclass('public.studio_vouchers') is null then
    raise exception 'Thiếu bảng studio_vouchers. Hãy chạy supabase/voucher-uu-dai.sql trước.';
  end if;
end $$;

alter table public.studio_contracts add column if not exists loyalty_percent smallint;

alter table public.studio_contracts drop constraint if exists studio_contracts_loyalty_percent_check;

alter table public.studio_contracts add constraint studio_contracts_loyalty_percent_check
  check (loyalty_percent is null or loyalty_percent between 0 and 100);

-- Voucher do chương trình phát: mỗi hợp đồng đúng MỘT cái, kể cả khi cổng khách
-- và màn studio cùng mở một lúc (insert trùng thì chỉ một bên thắng).
alter table public.studio_vouchers add column if not exists program_issued boolean not null default false;

create unique index if not exists studio_vouchers_program_one_per_contract
  on public.studio_vouchers (source_contract_id) where program_issued;

-- Hợp đồng bị huỷ → voucher ưu đãi CHƯA DÙNG của nó tự huỷ.
create or replace function public.voucher_void_on_contract_cancel()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    update public.studio_vouchers
       set status = 'void'
     where source_contract_id = new.id and kind = 'loyalty' and status = 'active';
  end if;
  return new;
end $$;

drop trigger if exists voucher_void_on_contract_cancel on public.studio_contracts;

create trigger voucher_void_on_contract_cancel after update of status on public.studio_contracts
  for each row execute function public.voucher_void_on_contract_cancel();

-- ── Phạm vi áp dụng ─────────────────────────────────────────────────────────
-- wedding_only: chương trình chỉ cho dùng voucher ở hợp đồng GÓI PHÓNG SỰ CƯỚI.
-- applies_to trên từng voucher chốt luật lúc phát ('wedding' | null = mọi gói),
-- để studio đổi cài đặt sau này không làm đổi voucher khách đang cầm.
alter table public.studio_voucher_program add column if not exists wedding_only boolean not null default true;

alter table public.studio_vouchers add column if not exists applies_to text;

alter table public.studio_vouchers drop constraint if exists studio_vouchers_applies_to_check;

alter table public.studio_vouchers add constraint studio_vouchers_applies_to_check check (applies_to is null or applies_to in ('wedding'));

-- ── Gói được áp dụng (studio tự chọn) ───────────────────────────────────────
-- package_names: tên các gói trong bảng giá (studio_pricelist.name) mà voucher
-- được dùng. Rỗng / null = mọi gói. Voucher chốt danh sách lúc phát
-- (applies_packages) — studio đổi cài đặt sau không đổi voucher khách đang cầm.
-- (wedding_only / applies_to của bản trước không còn dùng.)
alter table public.studio_voucher_program add column if not exists package_names text[];

alter table public.studio_vouchers add column if not exists applies_packages text[];

-- ── Mốc % theo giá trị hợp đồng khách chốt ──────────────────────────────────
-- tiers = [{ "min": 0, "percent": 5 }, { "min": 15000000, "percent": 7 }, …]:
-- hợp đồng CHỐT từ `min` đồng trở lên được tặng voucher `percent`%. Lúc phát,
-- % được chốt vào voucher (cột percent) — hợp đồng sau dùng đúng % đó, tính
-- trên giá trị hợp đồng sau, có trần max_discount.
alter table public.studio_voucher_program add column if not exists tiers jsonb;


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/studio_audit_log.sql — Nhật ký thao tác tiền & hợp đồng
-- ══════════════════════════════════════════════════════════════════════════

create index if not exists studio_audit_log_owner_idx on public.studio_audit_log (owner_id, created_at desc);

create index if not exists studio_audit_log_contract_idx on public.studio_audit_log (contract_id, created_at desc);

create or replace function public.audit_write(
  p_owner uuid, p_action text, p_entity text, p_entity_id uuid, p_contract uuid,
  p_summary text, p_before jsonb, p_after jsonb
) returns void language sql security definer set search_path = public as $$
  insert into public.studio_audit_log (owner_id, actor_id, action, entity, entity_id, contract_id, summary, before, after)
  values (p_owner, auth.uid(), p_action, p_entity, p_entity_id, p_contract, p_summary, p_before, p_after);
$$;

create or replace function public.audit_vnd(n bigint) returns text language sql immutable as $$
  select replace(to_char(coalesce(n, 0), 'FM999,999,999,999,990'), ',', '.') || 'đ';
$$;

-- ── Khoản thu ───────────────────────────────────────────────────────────────
create or replace function public.audit_contract_payments()
returns trigger language plpgsql security definer set search_path = public as $$
declare r public.contract_payments; o uuid; s text;
begin
  if auth.uid() is null then return null; end if;
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  if tg_op = 'UPDATE' and (old.amount, old.kind, old.paid_at, old.method)
     is not distinct from (new.amount, new.kind, new.paid_at, new.method) then
    return null;  -- chỉ đổi ảnh chứng từ / số phiếu: không phải thay đổi tiền
  end if;
  select owner_id into o from public.studio_contracts where id = r.contract_id;
  if o is null then return null; end if;
  s := case tg_op
         when 'INSERT' then 'Ghi thu ' || audit_vnd(new.amount)
         when 'DELETE' then 'Xoá khoản thu ' || audit_vnd(old.amount) || ' ngày ' || to_char(old.paid_at, 'DD/MM/YYYY')
         else 'Sửa khoản thu ' || audit_vnd(old.amount) || ' → ' || audit_vnd(new.amount)
       end;
  perform audit_write(o, 'payment.' || lower(tg_op), 'payment', r.id, r.contract_id, s,
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return null;
end $$;

drop trigger if exists audit_contract_payments on public.contract_payments;

create trigger audit_contract_payments after insert or update or delete on public.contract_payments
  for each row execute function public.audit_contract_payments();

-- ── Khoản chi ───────────────────────────────────────────────────────────────
create or replace function public.audit_studio_expenses()
returns trigger language plpgsql security definer set search_path = public as $$
declare r public.studio_expenses; s text;
begin
  if auth.uid() is null then return null; end if;
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  if tg_op = 'UPDATE' and (old.amount, old.title, old.spent_at, old.category)
     is not distinct from (new.amount, new.title, new.spent_at, new.category) then
    return null;
  end if;
  s := case tg_op
         when 'INSERT' then 'Ghi chi ' || audit_vnd(new.amount) || ' · ' || coalesce(nullif(new.title, ''), 'không tên')
         when 'DELETE' then 'Xoá khoản chi ' || audit_vnd(old.amount) || ' · ' || coalesce(nullif(old.title, ''), 'không tên')
         else 'Sửa khoản chi ' || audit_vnd(old.amount) || ' → ' || audit_vnd(new.amount)
       end;
  perform audit_write(r.owner_id, 'expense.' || lower(tg_op), 'expense', r.id, r.contract_id, s,
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return null;
end $$;

drop trigger if exists audit_studio_expenses on public.studio_expenses;

create trigger audit_studio_expenses after insert or update or delete on public.studio_expenses
  for each row execute function public.audit_studio_expenses();

-- ── Hợp đồng: chỉ những trường có hệ quả (trạng thái, ngày, tiền, khách) ──────
create or replace function public.audit_studio_contracts()
returns trigger language plpgsql security definer set search_path = public as $$
declare parts text[] := '{}';
begin
  if auth.uid() is null then return null; end if;
  if tg_op = 'DELETE' then
    perform audit_write(old.owner_id, 'contract.delete', 'contract', old.id, old.id,
      'Xoá hợp đồng ' || coalesce(old.code || ' · ', '') || coalesce(old.title, ''), to_jsonb(old), null);
    return null;
  end if;
  if old.status is distinct from new.status then parts := parts || ('trạng thái ' || old.status || ' → ' || new.status); end if;
  if old.event_date is distinct from new.event_date then
    parts := parts || ('ngày chụp ' || coalesce(to_char(old.event_date, 'DD/MM/YYYY'), '—') || ' → ' || coalesce(to_char(new.event_date, 'DD/MM/YYYY'), '—'));
  end if;
  if old.deposit is distinct from new.deposit then parts := parts || ('cọc ' || audit_vnd(old.deposit) || ' → ' || audit_vnd(new.deposit)); end if;
  if old.client_name is distinct from new.client_name then parts := parts || ('tên khách “' || coalesce(old.client_name, '') || '” → “' || coalesce(new.client_name, '') || '”'); end if;
  if old.client_phone is distinct from new.client_phone then parts := parts || 'SĐT khách'::text; end if;
  if array_length(parts, 1) is null then return null; end if;
  perform audit_write(new.owner_id, 'contract.update', 'contract', new.id, new.id,
    'Sửa ' || array_to_string(parts, ', '),
    jsonb_build_object('status', old.status, 'event_date', old.event_date, 'deposit', old.deposit, 'client_name', old.client_name, 'client_phone', old.client_phone),
    jsonb_build_object('status', new.status, 'event_date', new.event_date, 'deposit', new.deposit, 'client_name', new.client_name, 'client_phone', new.client_phone));
  return null;
end $$;

drop trigger if exists audit_studio_contracts on public.studio_contracts;

create trigger audit_studio_contracts after update or delete on public.studio_contracts
  for each row execute function public.audit_studio_contracts();

-- ── Hạng mục: MỘT dòng nhật ký cho mỗi lần lưu, không phải mỗi hạng mục ─────
-- Trình sửa hợp đồng lưu bằng "xoá hết rồi chèn lại", nên ghi theo từng dòng
-- sẽ ra 20 dòng nhật ký cho một cú bấm Lưu. Trigger mức câu lệnh gom lại.
create or replace function public.audit_contract_items_stmt()
returns trigger language plpgsql security definer set search_path = public as $$
declare g record;
begin
  if auth.uid() is null then return null; end if;
  if tg_op = 'INSERT' then
    for g in
      select n.contract_id, c.owner_id, count(*) as cnt, sum(n.qty::bigint * n.unit_price)::bigint as tot,
             jsonb_agg(jsonb_build_object('name', n.name, 'qty', n.qty, 'unit_price', n.unit_price) order by n.position) as lines
        from new_rows n join public.studio_contracts c on c.id = n.contract_id
       group by n.contract_id, c.owner_id
    loop
      perform audit_write(g.owner_id, 'items.save', 'contract', g.contract_id, g.contract_id,
        'Lưu ' || g.cnt || ' hạng mục · tổng ' || audit_vnd(g.tot), null, jsonb_build_object('lines', g.lines));
    end loop;
  else
    for g in
      select o.contract_id, c.owner_id, count(*) as cnt, sum(o.qty::bigint * o.unit_price)::bigint as tot,
             jsonb_agg(jsonb_build_object('name', o.name, 'qty', o.qty, 'unit_price', o.unit_price) order by o.position) as lines
        from old_rows o join public.studio_contracts c on c.id = o.contract_id
       group by o.contract_id, c.owner_id
    loop
      perform audit_write(g.owner_id, 'items.clear', 'contract', g.contract_id, g.contract_id,
        'Gỡ ' || g.cnt || ' hạng mục cũ · tổng ' || audit_vnd(g.tot), jsonb_build_object('lines', g.lines), null);
    end loop;
  end if;
  return null;
end $$;

drop trigger if exists audit_contract_items_ins on public.contract_items;

create trigger audit_contract_items_ins after insert on public.contract_items
  referencing new table as new_rows for each statement execute function public.audit_contract_items_stmt();

drop trigger if exists audit_contract_items_del on public.contract_items;

create trigger audit_contract_items_del after delete on public.contract_items
  referencing old table as old_rows for each statement execute function public.audit_contract_items_stmt();


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/contract_crew_milestone.sql — Phân công thợ theo mốc thời gian của hợp đồng (chạy SAU crew_profile_show)
-- ══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────
-- Phân công thợ theo MỐC THỜI GIAN của hợp đồng
--
-- Một hợp đồng có nhiều mốc (đãi trước, thử đồ, lễ gia tiên…) nằm trong
-- studio_events. Trước đây thợ chỉ gán được vào buổi chính (event_date của hợp
-- đồng). Nay mỗi phân công có thể trỏ tới một mốc: lịch của thợ lấy ngày/giờ
-- của mốc đó và tên hiện là "<tên mốc> · <tên hợp đồng>".
--
-- event_id null = buổi chính như cũ. Xoá mốc thì phân công KHÔNG mất theo —
-- chỉ rơi về buổi chính (on delete set null).
--
-- Chạy SAU crew_profile_show.sql. Idempotent.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.contract_crew
  add column if not exists event_id uuid references public.studio_events (id) on delete set null;

create index if not exists contract_crew_event_idx on public.contract_crew (event_id);

-- Nhớ: Supabase → Settings → API → Reload schema cache sau khi chạy.


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/contract_item_tier_milestone.sql — Hạng mục chính/phụ và gắn hạng mục vào mốc lịch
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- Hạng mục CHÍNH / PHỤ và gắn hạng mục vào MỐC LỊCH
--
-- tier: 'main' = hạng mục chính (vd: Chụp phóng sự ngày cưới), 'sub' = hạng
--       mục phụ đi kèm (album, ảnh phóng, đãi trước…). NULL = chưa phân loại —
--       hợp đồng cũ giữ nguyên như trước.
--
-- event_id: hạng mục này đã được thêm thành một mốc trong studio_events (vd:
--       hạng mục "Đãi trước" → mốc "Đãi trước" ngày 18/10). Xoá mốc thì hạng
--       mục vẫn còn, chỉ mất liên kết (on delete set null).
--
-- Idempotent, chạy lại nhiều lần vô hại.
-- ============================================================================

alter table public.contract_items add column if not exists tier text;

alter table public.contract_items
  add column if not exists event_id uuid references public.studio_events (id) on delete set null;

create index if not exists contract_items_event_idx on public.contract_items (event_id);

comment on column public.contract_items.tier is
  'main = hạng mục chính, sub = hạng mục phụ; NULL = chưa phân loại.';

comment on column public.contract_items.event_id is
  'Mốc lịch (studio_events) tạo từ hạng mục này; NULL = không gắn mốc.';

-- Nhớ: Supabase → Settings → API → Reload schema cache sau khi chạy.


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/contract_final_links.sql — Link album & video hoàn thiện dán tay trên hợp đồng
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- LINK ALBUM & VIDEO HOÀN THIỆN TRÊN HỢP ĐỒNG
--
-- Studio dán link album hoàn thiện (Drive / Google Photos / album mstudo…) và
-- link video (YouTube / Drive / Vimeo — mỗi dòng một link, có thể "Tên | link")
-- ngay ở tab Sản phẩm của hợp đồng. Cổng khách /portal/<token> hiện chúng ra.
-- Chưa chạy file này thì mọi thứ khác vẫn chạy, chỉ là chưa lưu được 2 ô này.
-- Chạy 1 lần trong Supabase SQL Editor. An toàn khi chạy lại.
-- ============================================================================

alter table public.studio_contracts
  add column if not exists final_album_url  text,
  add column if not exists final_video_urls text;


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/contract_final_originals.sql — Link toàn bộ file gốc + dấu đã gửi link trang riêng cho khách
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- LINK TOÀN BỘ FILE GỐC + DẤU ĐÃ GỬI LINK TRANG RIÊNG CHO KHÁCH
--
-- • final_originals_url: link thư mục toàn bộ file gốc (Drive / Google Photos /
--   Fshare…) studio dán ở tab Sản phẩm của hợp đồng — khách tải ở mục "Tải về"
--   của trang riêng /portal/<token>.
-- • portal_link_sent_at: lần đầu hệ thống gửi link trang riêng cho khách khi
--   hợp đồng chuyển sang Hoàn thành — để đổi trạng thái qua lại không gửi lặp.
-- Chạy SAU contract_final_links.sql. Chạy 1 lần trong Supabase SQL Editor.
-- An toàn khi chạy lại.
-- ============================================================================

alter table public.studio_contracts
  add column if not exists final_originals_url text,
  add column if not exists portal_link_sent_at timestamptz;


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/bao_mat_quyen_rpc_storage.sql — Vá bảo mật: RPC chỉ service-role, số phiếu thu, storage, crew_account, affiliate_codes
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- VÁ BẢO MẬT — quyền gọi RPC, bộ đếm số phiếu thu, storage, crew_account,
-- affiliate_codes.
-- Chạy MỘT LẦN trên Supabase (SQL Editor). An toàn khi chạy lại (idempotent).
--
-- Các file gốc (atomic_redemptions.sql, accounting.sql, schema.sql,
-- wedding_invitations.sql, crew_profile_show.sql) cũng đã được sửa y như dưới
-- đây — để project MỚI dựng ra đúng ngay, và chạy lại một file gốc cũ không mở
-- lại lỗ. File này là phần vá cho project ĐANG CHẠY.
-- ============================================================================

-- ── 1) RPC SECURITY DEFINER chỉ cho service-role ─────────────────────────────
-- Bốn hàm này nhận `p_user_id` từ người gọi và chạy với quyền chủ hàm (bỏ qua
-- RLS). Supabase mặc định cấp EXECUTE cho anon + authenticated, nên bất kỳ ai
-- cầm anon key đều gọi thẳng được qua /rest/v1/rpc: tự kích hoạt dùng thử cho
-- tài khoản người khác, đốt lượt dùng của mã giảm giá, sinh mã affiliate hộ
-- người khác… App chỉ gọi chúng từ API route bằng service-role (sau khi đã tự
-- kiểm đăng nhập), nên thu hồi hết quyền của client là không vỡ gì.
--
-- Bọc trong to_regprocedure: database chưa có hàm nào thì bỏ qua hàm đó, không
-- làm hỏng cả lượt chạy.
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.redeem_discount_trial(text, uuid, timestamptz, text, integer, boolean, boolean, boolean, boolean)',
    'public.start_free_trial(uuid, timestamptz, text, integer, boolean, boolean, boolean, boolean)',
    'public.consume_discount_code(text)',
    'public.get_or_create_affiliate_code(uuid, text)'
  ] loop
    if to_regprocedure(fn) is null then
      raise notice 'bỏ qua %: hàm chưa tồn tại', fn;
      continue;
    end if;
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end $$;

-- ── 2) next_receipt_no: chỉ cấp số cho studio CỦA MÌNH ───────────────────────
-- Bản cũ nhận `p_owner` tuỳ ý: một tài khoản bất kỳ đăng nhập rồi gọi RPC với
-- id của studio khác là đẩy được bộ đếm số phiếu của họ (dãy số thủng lỗ chỗ —
-- đúng thứ kế toán không giải thích được). Giờ người gọi phải là chủ hoặc nhân
-- viên của studio đó (is_studio_member — nhân viên in phiếu với p_owner là id
-- chủ studio), hoặc là service-role.
create or replace function public.next_receipt_no(p_owner uuid, p_year integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_no integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_studio_member(p_owner) then
    raise exception 'không có quyền cấp số phiếu cho studio này' using errcode = '42501';
  end if;
  insert into public.studio_receipt_seq (owner_id, year, last_no)
  values (p_owner, p_year, 1)
  on conflict (owner_id, year)
  do update set last_no = public.studio_receipt_seq.last_no + 1
  returning last_no into v_no;
  return v_no;
end;
$$;

-- ── Kiểm tra sau khi chạy ───────────────────────────────────────────────────
-- 1) Bốn hàm RPC KHÔNG còn anon/authenticated (chỉ postgres, service_role):
-- select p.proname, r.rolname
-- from pg_proc p
-- cross join lateral aclexplode(p.proacl) a
-- join pg_roles r on r.oid = a.grantee
-- where p.proname in ('start_free_trial', 'redeem_discount_trial',
--                     'consume_discount_code', 'get_or_create_affiliate_code')
-- order by 1, 2;
--
-- 2) Policy storage còn lại:
-- select policyname, cmd, roles from pg_policies
-- where schemaname = 'storage' and tablename = 'objects' order by 1;


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/vai_tro_tho_tu_dat.sql — Vai trò thợ studio tự đặt (đổi tên / ẩn / thêm vai trò) + bỏ ràng buộc vai trò contract_crew (chạy SAU crew_role_makeup)
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- VAI TRÒ THỢ STUDIO TỰ ĐẶT (tab "Đội ngũ thợ")
--
-- Vì sao: bảy vai trò có sẵn (Photographer, Cameraman, Trang điểm, Làm tóc,
-- Trợ lý, Sửa ảnh / Dựng phim, Khác) không đủ cho mọi studio — có nơi cần
-- "Flycam", "Stylist", "MC", "Thợ in album". Trước bản này họ chỉ còn cách chọn
-- "Khác", rồi bảng lương, cổng thợ, tin Zalo gửi thợ đều hiện "Khác".
--
-- Bảng studio_crew_roles giữ HAI loại dòng (xem src/lib/crew-roles.ts):
--   • key = khoá có sẵn (vd 'makeup') → ĐÈ vai trò có sẵn: đổi tên (label khác
--     rỗng), ẩn khỏi ô chọn (active = false), đổi thứ tự (position).
--   • key = 'c_xxxxxxxx'              → vai trò studio tự thêm; `kinds` = nhóm
--     hợp đồng (shoot / makeup / combo) mà nó hiện trong ô chọn.
-- Xoá vai trò tự thêm là xoá MỀM (active = false): hợp đồng cũ đã gán vẫn tra
-- ra đúng tên.
--
-- contract_crew.role trước đây có CHECK chỉ nhận bảy khoá có sẵn → BỎ ràng buộc
-- đó (không tạo lại). studio_crew.role vốn là chữ tự do, không cần sửa.
--
-- Quyền: thành viên studio ĐỌC được (ô chọn ở hợp đồng cần); chỉ chủ studio và
-- quản lý toàn studio được SỬA — cùng mức với "gán chi nhánh" (canAssignBranch).
--
-- Chạy 1 lần trong Supabase SQL Editor. An toàn khi chạy lại.
-- ============================================================================

do $$
declare missing text[] := '{}';
begin
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'profiles')
  then missing := missing || 'profiles'; end if;
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'contract_crew')
  then missing := missing || 'contract_crew'; end if;

  if array_length(missing, 1) > 0 then
    raise exception
      'Thiếu bảng nền: %. Hãy chạy supabase/setup-all.sql trước (nó gồm cả schema nền lẫn migration này).',
      array_to_string(missing, ', ');
  end if;
end $$;

create index if not exists studio_crew_roles_owner_idx on public.studio_crew_roles (owner_id, position);

-- Vai trò tự đặt phải ghi được vào hợp đồng → bỏ ràng buộc bảy khoá cũ.
-- (crew_role_makeup.sql cũng không tạo lại nó khi bảng trên đã có.)
alter table public.contract_crew drop constraint if exists contract_crew_role_check;


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/zalo_nguoi_nhan.sql — Nhớ người nhận Zalo cho hợp đồng/album
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- NHỚ NGƯỜI NHẬN ZALO CHO HỢP ĐỒNG / ALBUM
--
-- Khách tắt "cho phép tìm bằng SĐT" (hoặc SĐT trên hợp đồng không phải số
-- Zalo) thì "Gửi Zalo" theo SĐT báo không tìm thấy, studio phải mở danh sách
-- bạn chọn tay — MỖI LẦN gửi. Lưu người đã chọn lên hợp đồng/album để lần sau
-- nút thành "Gửi Zalo cho <tên>", một cú bấm là tới đúng người. Tin tự động
-- (autoNotify, cron) cũng dùng luôn người đã lưu.
--
-- • zalo_uid : uid Zalo người nhận (theo tài khoản Zalo của studio)
-- • zalo_name: tên bạn Zalo lúc chọn (hiện trên nút)
-- • zalo_self: personal_self.id của tài khoản Zalo studio lúc lưu — uid Zalo
--   chỉ có nghĩa với đúng tài khoản đã tra ra nó; studio đổi sang số Zalo khác
--   thì uid cũ bị bỏ qua, gửi lại theo SĐT như thường.
--
-- Chỉ máy chủ ghi các cột này (service-role, src/lib/zalo/send.ts) sau khi đã
-- lọc owner_id — không cần grant cột riêng (hai bảng không dùng grant theo cột).
-- Bản web chịu được lúc CHƯA chạy file này: thiếu cột thì không nhớ gì, gửi
-- như cũ.
--
-- Chạy 1 lần trong Supabase SQL Editor. An toàn khi chạy lại.
-- ============================================================================

alter table public.studio_contracts
  add column if not exists zalo_uid  text,
  add column if not exists zalo_name text,
  add column if not exists zalo_self text;

alter table public.albums
  add column if not exists zalo_uid  text,
  add column if not exists zalo_name text,
  add column if not exists zalo_self text;

-- Tra "hợp đồng khác cùng khách đã có người nhận" (lọc owner + tài khoản Zalo).
create index if not exists studio_contracts_zalo_saved_idx
  on public.studio_contracts (owner_id, zalo_self, updated_at desc)
  where zalo_uid is not null;

notify pgrst, 'reload schema';


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/tang_toc_thu_vien_album.sql — Tăng tốc thư viện album: chỉ mục, hàm đếm album_library_stats, policy RLS dạng initPlan (chạy SAU album_dislikes)
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- TĂNG TỐC THƯ VIỆN ALBUM (/dashboard/albums, /dashboard)
--
-- Vì sao chậm: thư viện đếm ảnh / lượt chọn / ảnh "không thích" bằng embed
-- `photos(count), selections(count), dislikes(count)` trên MỌI album, qua client
-- có RLS. Policy của ba bảng đó là `exists (select 1 from albums a where … and
-- (a.owner_id = auth.uid() or public.is_admin()))` — Postgres gọi auth.uid() và
-- is_admin() (một câu SELECT trên profiles) LẠI cho TỪNG DÒNG ảnh. Studio vài
-- trăm album × vài trăm ảnh là hàng chục nghìn lần gọi chỉ để ra mấy con số.
--
-- File này làm ba việc, KHÔNG đổi ai được thấy gì:
--   1. Chỉ mục cho đúng các câu thư viện chạy (sắp theo updated_at, ảnh bìa dự
--      phòng theo position, đếm album đã tạo trong tháng).
--   2. Hàm album_library_stats(p_owner): một lượt trả đủ số đếm + ảnh bìa dự
--      phòng cho mọi album của MỘT chủ. Quyền gọi giữ ĐÚNG như RLS hiện tại của
--      albums: chính chủ hoặc admin. Nhân viên studio KHÔNG đọc được album của
--      chủ qua RLS hôm nay, nên hàm này cũng không mở cửa đó.
--   3. Viết lại bốn policy albums / photos / selections / dislikes sang dạng
--      `(select auth.uid())` / `(select public.is_admin())`: Postgres tính MỘT
--      lần mỗi câu (initPlan) thay vì mỗi dòng. Ý nghĩa giữ nguyên từng chữ.
--
-- Chưa chạy file này thì app vẫn chạy như cũ (src/lib/album-rows.ts tự lùi về
-- đường embed). Chạy 1 lần trong Supabase SQL Editor. An toàn khi chạy lại.
-- ============================================================================

-- ── 1) Chỉ mục ──────────────────────────────────────────────────────────────
-- Ảnh bìa dự phòng = ảnh có position nhỏ nhất của album; cũng là thứ tự trang
-- khách đọc ảnh.
create index if not exists photos_album_position_idx on public.photos (album_id, position);

-- Danh sách album của một chủ, mới sửa lên đầu.
create index if not exists albums_owner_updated_idx on public.albums (owner_id, updated_at desc);

-- "Đã tạo N album tháng này" (PlanUsage) và trigger hạn mức enforce_album_quota.
create index if not exists album_creations_user_created_idx on public.album_creations (user_id, created_at);

-- Đã có từ schema nền / album_dislikes.sql — nhắc lại cho database dựng tay.
create index if not exists selections_album_idx on public.selections (album_id);

create index if not exists dislikes_album_idx on public.dislikes (album_id);

-- ── 2) album_library_stats ──────────────────────────────────────────────────
-- SECURITY DEFINER để bỏ qua RLS từng dòng — nên tự kiểm quyền ở đầu hàm, đúng
-- luật của policy albums_owner_all: owner_id = auth.uid() or is_admin().
create or replace function public.album_library_stats(p_owner uuid)
returns table (
  album_id            uuid,
  photo_count         bigint,
  pick_count          bigint,
  dislike_count       bigint,
  first_drive_file_id text
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and not (p_owner = auth.uid() or public.is_admin()) then
    raise exception 'không có quyền xem thư viện album này' using errcode = '42501';
  end if;

  return query
  select
    a.id,
    (select count(*) from public.photos p where p.album_id = a.id),
    (select count(*) from public.selections s where s.album_id = a.id),
    (select count(*) from public.dislikes d where d.album_id = a.id),
    -- Chỉ album CHƯA đặt cover_url mới cần ảnh bìa dự phòng.
    case when a.cover_url is null then
      (select p.drive_file_id from public.photos p
        where p.album_id = a.id
        order by p.position
        limit 1)
    end
  from public.albums a
  where a.owner_id = p_owner;
end;
$$;


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/han_muc_album_may_chu.sql — Hạn mức album: bỏ qua khi máy chủ (service-role) tạo album cho hợp đồng — hết lỗi hợp đồng hoàn thành mà không có album giao khách
-- ══════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
-- Hạn mức album: bỏ qua khi album được tạo PHÍA MÁY CHỦ (service_role).
--
-- Vì sao: luồng hợp đồng (khách ký → đang thực hiện → hoàn thành, app desktop,
-- cron) tạo album "Chọn ảnh · …" / "Giao khách · …" bằng service-role key ở máy
-- chủ (src/lib/studio-drive.ts → createAlbumFromFolder). Trigger
-- enforce_album_quota chặn mọi album is_gallery khi profiles.can_galleries tắt
-- — cột cũ, chỉ được đồng bộ từ gói khi admin gán gói — nên studio đã trả tiền
-- gói Studio vẫn có thể bị chặn ÂM THẦM: hợp đồng hoàn thành mà không có album
-- giao khách, màn hợp đồng còn báo nhầm "chưa có thư mục Drive".
--
-- Có mở lỗ hổng không: KHÔNG. `auth.role()` đọc claim `role` của JWT mà
-- PostgREST đã kiểm chữ ký; chỉ service-role key (chỉ nằm ở máy chủ, không bao
-- giờ xuống trình duyệt) mới mang role 'service_role'. Người dùng đăng nhập
-- (authenticated) và khách (anon) vẫn qua đủ hai chốt: quyền gallery + hạn mức
-- album/tháng. Máy chủ đã tự chốt quyền ở tầng ứng dụng trước khi tới đây
-- (requireStudio, xác thực desktop). Cùng cách nhận diện service-role với
-- accounting.sql / bao_mat_quyen_rpc_storage.sql.
--
-- Trigger albums_log_creation KHÔNG đổi: album tạo phía máy chủ vẫn được ghi
-- vào album_creations như cũ.
-- Chạy lại nhiều lần an toàn (create or replace).
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.enforce_album_quota()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  lim   integer;
  isadm boolean;
  cangal boolean;
  used  integer;
begin
  -- Album do máy chủ tạo (service-role) — quyền đã chốt ở tầng ứng dụng.
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  select monthly_album_limit, (role = 'admin'), can_galleries
    into lim, isadm, cangal
    from public.profiles where id = new.owner_id;

  if coalesce(new.is_gallery, false) then
    -- Only admins / permitted accounts may create delivery galleries.
    if not (coalesce(isadm, false) or coalesce(cangal, false)) then
      raise exception 'Tài khoản chưa được cấp quyền tạo gallery khách.'
        using errcode = 'P0001';
    end if;
    return new; -- galleries don't use the selection quota
  end if;
  if coalesce(isadm, false) then return new; end if;
  if lim is null then return new; end if;

  select count(*) into used
    from public.album_creations
    where user_id = new.owner_id
      and created_at >= date_trunc('month', now());

  if used >= lim then
    raise exception 'Đã đạt giới hạn % album trong tháng này.', lim
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/che_do_album_hop_dong.sql — Chế độ album của hợp đồng: album mặc định (mstudo desktop) hoặc nhập link ảnh riêng
-- ══════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
-- Chế độ album của hợp đồng: studio_contracts.album_mode
--
--   'desktop' — Album mặc định: app mstudo desktop đổ ảnh lên cây thư mục Drive
--               của hợp đồng, máy chủ tự tạo album chọn ảnh và tự chuyển sang
--               giao khách (src/lib/studio-drive.ts).
--   'manual'  — Nhập link ảnh riêng: KHÔNG dựng thư mục Drive. Khách xác nhận
--               hợp đồng (ký / nhận cọc / studio duyệt) thì tạo MỘT album trống;
--               studio dán link Drive ảnh chọn, rồi link ảnh hoàn thiện vào CHÍNH
--               album đó — cùng một album đi từ chọn ảnh sang giao khách.
--   NULL      — hợp đồng tạo trước bản này: giữ nguyên hành vi tự động cũ.
--
-- Mã nguồn chịu được việc CHƯA chạy file này (đọc cột riêng, lỗi thiếu cột thì
-- coi như NULL) — xem src/lib/missing-column.ts.
-- Chạy lại nhiều lần an toàn.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.studio_contracts
  add column if not exists album_mode text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'studio_contracts_album_mode_check'
      and conrelid = 'public.studio_contracts'::regclass
  ) then
    alter table public.studio_contracts
      add constraint studio_contracts_album_mode_check
      check (album_mode is null or album_mode in ('desktop', 'manual'));
  end if;
end $$;

comment on column public.studio_contracts.album_mode is
  'Chế độ album: desktop = album mặc định đồng bộ từ mstudo desktop; manual = studio tự dán link ảnh; NULL = hợp đồng cũ (hành vi tự động cũ).';


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/ai_providers.sql — API key AI nhập trong trang quản trị: key chung của admin + key riêng của từng studio (đã mã hoá)
-- ══════════════════════════════════════════════════════════════════════════

insert into public.admin_ai_providers (id) values (1) on conflict (id) do nothing;


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/anh_in_tang.sql — Ảnh in tặng: số ảnh in theo hợp đồng + khách chọn ảnh in trong album giao khách
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- ẢNH IN TẶNG — khách chọn ảnh in ngay trong album giao khách.
--
-- • studio_contracts.print_quota: số ảnh in hợp đồng TẶNG khách (studio nhập ở
--   tab Sản phẩm). Trống / 0 = hợp đồng không tặng in → album giao khách không
--   hiện phần chọn ảnh in.
-- • print_picks: ảnh khách chọn để in (MỘT danh sách mỗi album). Bảng RIÊNG,
--   không gộp vào public.selections: selections là ảnh khách chọn để CHỈNH SỬA,
--   được Lọc ảnh / ZIP / thông báo / thống kê đọc ở cả chục chỗ — trộn vào là ảnh
--   in lẫn sang danh sách chỉnh sửa (cùng lý do public.dislikes tách riêng).
-- • albums.print_sent_at: lần cuối khách bấm "Gửi ảnh in cho studio".
-- • albums.print_copied_at: studio đã chép ảnh in vào thư mục "Ảnh in" trên
--   Drive → khoá phần chọn của khách (studio mở lại được).
--
-- Chạy trên Supabase SQL Editor. An toàn khi chạy lại (idempotent).
-- ============================================================================

alter table public.studio_contracts
  add column if not exists print_quota integer;

alter table public.albums
  add column if not exists print_sent_at   timestamptz,
  add column if not exists print_copied_at timestamptz;

create index if not exists print_picks_album_idx on public.print_picks (album_id);


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/anh_in_album_le.sql — Ảnh in tặng cho album lẻ: số ảnh in nhập ngay trong album (chạy SAU anh_in_tang)
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- ẢNH IN TẶNG CHO ALBUM LẺ (không thuộc hợp đồng nào).
--
-- albums.print_quota: số ảnh in tặng nhập ngay trong album (tab Giao khách).
-- Album của hợp đồng vẫn lấy số ở hợp đồng (studio_contracts.print_quota) —
-- máy chủ lấy số LỚN HƠN của hai nơi (src/lib/album-print.ts).
-- Chạy SAU anh_in_tang.sql. Chạy trên Supabase SQL Editor. An toàn khi chạy lại.
-- ============================================================================

alter table public.albums
  add column if not exists print_quota integer;


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/thiep_tang_tu_dong.sql — Tự tặng thiệp cưới online trước ngày cưới: lựa chọn tặng / không tặng của từng hợp đồng
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- TỰ TẶNG THIỆP CƯỚI ONLINE TRƯỚC NGÀY CƯỚI
--
-- Luật tự động "Trước ngày cưới → tặng thiệp cưới online" (src/lib/automations.ts,
-- gift_invitation): còn khoảng một tháng tới ngày thực hiện thì cron tự tạo thiệp
-- cưới online cho hợp đồng (điền sẵn tên, ngày, địa điểm) và gửi khách link để tự
-- sửa. Mặc định chỉ tặng hợp đồng GÓI PHÓNG SỰ CƯỚI.
--
-- Cột dưới đây là lựa chọn RIÊNG của studio cho từng hợp đồng:
--   • true  = tặng thiệp (kể cả hợp đồng không phải gói phóng sự)
--   • false = không tặng (kể cả gói phóng sự)
--   • null  = theo gói (gói phóng sự cưới thì tặng) — mặc định
--
-- Studio sửa cột này từ trang hợp đồng (bảng studio_contracts không dùng grant
-- theo cột, RLS của bảng là đủ). Bản web chịu được lúc CHƯA chạy file này: thiếu
-- cột thì mọi hợp đồng coi như "theo gói".
--
-- Chạy 1 lần trong Supabase SQL Editor. An toàn khi chạy lại.
-- ============================================================================

alter table public.studio_contracts
  add column if not exists gift_invitation boolean;

comment on column public.studio_contracts.gift_invitation is
  'Tự tặng thiệp cưới online trước ngày cưới: true = tặng, false = không tặng, null = theo gói (phóng sự cưới thì tặng).';

notify pgrst, 'reload schema';


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/ke_hoach_cuoi.sql — Kế hoạch cưới của khách trên cổng khách: việc cần làm, ngân sách, lịch trình ngày cưới + bật/tắt theo hợp đồng
-- ══════════════════════════════════════════════════════════════════════════

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

create index if not exists wedding_plans_owner_idx on public.wedding_plans (owner_id);

drop trigger if exists wedding_plans_set_updated_at on public.wedding_plans;

create trigger wedding_plans_set_updated_at
  before update on public.wedding_plans
  for each row execute function public.set_updated_at();

alter table public.studio_contracts
  add column if not exists wedding_planner boolean;

comment on column public.studio_contracts.wedding_planner is
  'Kế hoạch cưới trên cổng khách: true = bật, false = tắt, null = theo gói (gói cưới thì bật).';

notify pgrst, 'reload schema';


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/ke_hoach_cuoi_mo_rong.sql — Kế hoạch cưới mở rộng: khách mời & xếp bàn, nhà cung cấp, đội hỗ trợ, đồ cần mang, ảnh cần chụp, phong cách (chạy SAU ke_hoach_cuoi)
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- KẾ HOẠCH CƯỚI — MỞ RỘNG: khách mời & xếp bàn, nhà cung cấp, đội hỗ trợ ngày
-- cưới, đồ cần mang, ảnh cần chụp, phong cách (bảng màu, concept), cài đặt.
--
-- Thêm MỘT cột jsonb `extra` cho tất cả, thay vì một cột cho mỗi danh sách: cả
-- kế hoạch luôn được đọc và ghi trọn một dòng (kèm điều kiện `rev`), nên tách cột
-- không được gì, mà mỗi danh sách mới sau này lại phải thêm một migration.
-- Hình dạng (xem normalizePlan ở src/lib/wedding-plan.ts):
--   { guests: [...], vendors: [...], people: [...], packing: [...], shots: [...],
--     style: { colors, concept, links }, settings: { table_size, guests_expected } }
--
-- Bản web chịu được lúc CHƯA chạy file này: ba danh sách gốc (việc cần làm, ngân
-- sách, lịch trình ngày cưới) vẫn lưu được; các mục mới tạm ẩn với khách.
--
-- Chạy SAU migrations/ke_hoach_cuoi.sql. An toàn khi chạy lại.
-- ============================================================================

do $$
begin
  if to_regclass('public.wedding_plans') is null then
    raise exception 'Thiếu bảng wedding_plans. Hãy chạy supabase/migrations/ke_hoach_cuoi.sql trước.';
  end if;
end $$;

alter table public.wedding_plans
  add column if not exists extra jsonb not null default '{}'::jsonb;

comment on column public.wedding_plans.extra is
  'Kế hoạch cưới mở rộng: guests, vendors, people, packing, shots, style, settings (xem src/lib/wedding-plan.ts).';

notify pgrst, 'reload schema';


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/luu_chon_anh_tung_phan.sql — Lưu lựa chọn ảnh của khách theo phần chênh trong một transaction: hàm save_album_selection (chạy SAU album_dislikes)
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- LƯU LỰA CHỌN ẢNH CỦA KHÁCH THEO PHẦN CHÊNH (POST /api/a/[slug]/select)
--
-- Vì sao: trang khách gửi lại TOÀN BỘ danh sách chọn mỗi ~250 ms khi khách bấm.
-- Bản cũ xoá sạch selections / dislikes của phiên rồi chèn lại hết:
--   • n lượt ghi cho mỗi lần bấm → O(n²) cả buổi chọn;
--   • xoá và chèn là hai lượt gọi rời — chèn hỏng là MẤT lựa chọn của khách;
--   • ~2n sự kiện Realtime mỗi lần lưu dội vào màn SelectionsView của studio;
--   • kiểm ảnh bằng `.in("id", …)` hàng nghìn UUID trên URL — gãy từ ~300 ảnh.
--
-- Hàm save_album_selection làm trọn trong MỘT transaction, mảng đi trong thân
-- POST (không qua URL):
--   1. Chỉ giữ ảnh THẬT SỰ thuộc album (join với photos theo album_id).
--   2. Xoá đúng những ảnh khách đã bỏ.
--   3. Upsert theo unique (album_id, photo_id, session_id) — dòng không đổi gì
--      thì KHÔNG bị ghi lại, nên không sinh sự kiện Realtime.
-- Như vậy mỗi lần bấm chỉ ghi đúng một hai dòng thay đổi.
--
-- Chỉ service_role gọi được (route dùng admin client, đã kiểm mật khẩu album).
-- Chưa chạy file này thì route tự lùi về đường cũ (đã sửa để ghi theo phần chênh).
-- Chạy 1 lần trong Supabase SQL Editor. An toàn khi chạy lại.
-- ============================================================================

-- Đã có từ schema nền / album_dislikes.sql — nhắc lại cho database dựng tay.
create index if not exists selections_session_idx on public.selections (album_id, session_id);

create index if not exists dislikes_session_idx on public.dislikes (album_id, session_id);

create or replace function public.save_album_selection(
  p_album_id     uuid,
  p_session_id   text,
  p_client_name  text,
  p_photo_ids    uuid[],
  p_notes        jsonb default '{}'::jsonb,
  -- null = client cũ không gửi danh sách "không thích" → không đụng bảng dislikes.
  p_disliked_ids uuid[] default null
)
returns table (pick_count integer, dislike_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_notes jsonb := coalesce(p_notes, '{}'::jsonb);
  v_want  uuid[];
  v_dis   uuid[];
begin
  -- Hai lượt lưu của cùng một phiên chạy lần lượt, không xen nhau.
  perform pg_advisory_xact_lock(hashtextextended(p_album_id::text || ':' || p_session_id, 0));

  -- ── Ảnh chọn ──────────────────────────────────────────────────────────────
  -- Chỉ giữ ảnh thuộc ĐÚNG album này; id lạ / của album khác bị bỏ qua.
  v_want := array(
    select distinct p.id
    from unnest(coalesce(p_photo_ids, '{}'::uuid[])) as u(id)
    join public.photos p on p.id = u.id and p.album_id = p_album_id
  );

  delete from public.selections s
  where s.album_id = p_album_id
    and s.session_id = p_session_id
    and not exists (select 1 from unnest(v_want) as w(id) where w.id = s.photo_id);

  insert into public.selections as s
    (album_id, photo_id, photo_name, session_id, client_name, client_note)
  select p_album_id, p.id, coalesce(p.name, ''), p_session_id,
         nullif(p_client_name, ''), nullif(v_notes ->> p.id::text, '')
  from public.photos p
  where p.album_id = p_album_id and p.id = any (v_want)
  on conflict (album_id, photo_id, session_id) do update
    set photo_name  = excluded.photo_name,
        client_name = excluded.client_name,
        client_note = excluded.client_note
    -- Dòng không đổi gì thì không ghi lại → không có sự kiện Realtime thừa.
    where (s.photo_name, s.client_name, s.client_note)
          is distinct from (excluded.photo_name, excluded.client_name, excluded.client_note);

  -- ── Ảnh không thích ───────────────────────────────────────────────────────
  if p_disliked_ids is not null then
    v_dis := array(
      select distinct p.id
      from unnest(p_disliked_ids) as u(id)
      join public.photos p on p.id = u.id and p.album_id = p_album_id
    );

    delete from public.dislikes d
    where d.album_id = p_album_id
      and d.session_id = p_session_id
      and not exists (select 1 from unnest(v_dis) as w(id) where w.id = d.photo_id);

    insert into public.dislikes as d
      (album_id, photo_id, photo_name, session_id, client_note)
    select p_album_id, p.id, coalesce(p.name, ''), p_session_id,
           nullif(v_notes ->> p.id::text, '')
    from public.photos p
    where p.album_id = p_album_id and p.id = any (v_dis)
    on conflict (album_id, photo_id, session_id) do update
      set photo_name  = excluded.photo_name,
          client_note = excluded.client_note
      where (d.photo_name, d.client_note)
            is distinct from (excluded.photo_name, excluded.client_note);
  end if;

  return query select cardinality(v_want), coalesce(cardinality(v_dis), 0);
end;
$$;


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/chi_muc_bo_sung.sql — Chỉ mục bổ sung: tìm hợp đồng theo album, khoá ngoại photo_id, sự kiện theo hợp đồng, doanh thu theo ngày thu
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- CHỈ MỤC BỔ SUNG cho các câu lọc nóng và khoá ngoại chưa có chỉ mục
--
-- Không đổi dữ liệu, không đổi ai được thấy gì — chỉ thêm chỉ mục:
--
--   • studio_contracts(selection_album_id / gallery_album_id): trang khách
--     /a/[slug] và trang album trong dashboard tìm hợp đồng theo album. Hai cột
--     này còn là khoá ngoại `on delete set null` → mỗi lần XOÁ một album,
--     Postgres quét toàn bảng studio_contracts hai lượt để gỡ liên kết.
--   • selections / dislikes / album_photo_people (photo_id): khoá ngoại `on
--     delete cascade` tới photos mà chỉ mục hiện có đều KHÔNG bắt đầu bằng
--     photo_id → đồng bộ Drive xoá ảnh theo lô 200, mỗi ảnh quét toàn bảng.
--   • studio_events(contract_id): cổng khách và trang hợp đồng lọc theo cột này.
--   • studio_contracts(owner_id, event_date): danh sách hợp đồng của studio sắp
--     theo ngày, tra trùng lịch cùng ngày.
--   • contract_payments(paid_at): doanh thu theo tháng ở Tổng quan.
--
-- Bảng chưa có (project chưa chạy migration tương ứng) thì bỏ qua, để file này
-- không làm rollback cả cap-nhat.sql. Chạy lại nhiều lần vô hại.
-- ============================================================================

do $$
declare
  ix record;
begin
  for ix in
    select * from (values
      ('studio_contracts', 'studio_contracts_selection_album_idx', '(selection_album_id) where selection_album_id is not null', 'selection_album_id'),
      ('studio_contracts', 'studio_contracts_gallery_album_idx',   '(gallery_album_id) where gallery_album_id is not null',     'gallery_album_id'),
      ('studio_contracts', 'studio_contracts_owner_event_idx',     '(owner_id, event_date)',                                     'event_date'),
      ('selections',       'selections_photo_idx',                 '(photo_id)',                                                 'photo_id'),
      ('dislikes',         'dislikes_photo_idx',                   '(photo_id)',                                                 'photo_id'),
      ('album_photo_people','album_photo_people_photo_idx',        '(photo_id)',                                                 'photo_id'),
      ('studio_events',    'studio_events_contract_idx',           '(contract_id) where contract_id is not null',               'contract_id'),
      ('contract_payments','contract_payments_paid_at_idx',        '(paid_at)',                                                  'paid_at')
    ) as t(tbl, name, def, col)
  loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = ix.tbl and column_name = ix.col
    ) then
      execute format('create index if not exists %I on public.%I %s', ix.name, ix.tbl, ix.def);
    end if;
  end loop;
end $$;


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/phan_quyen_vai_tro_hop_dong.sql — Phân quyền theo vai trò cho hợp đồng: staff chỉ hợp đồng được giao, quản lý chi nhánh chỉ chi nhánh mình, kế toán chỉ đọc, chỉ chủ studio huỷ / hoàn tiền, tài khoản bị khoá mất quyền (chạy CUỐI)
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- PHÂN QUYỀN THEO VAI TRÒ CHO HỢP ĐỒNG — ĐƯA LUẬT CỦA API XUỐNG DATABASE
--
-- VẤN ĐỀ
--   Vai trò (manager / branch_manager / staff / accountant) và chi nhánh chỉ
--   được kiểm trong route API và trang server. Policy RLS của cả họ hợp đồng thì
--   chỉ hỏi `public.is_studio_member(owner_id)` — "có phải người của studio này
--   không" — nên MỌI thành viên làm được MỌI thứ trên dữ liệu studio.
--
--   Trình duyệt có anon key + JWT của người dùng, nên gọi thẳng PostgREST là
--   lách được hết các chốt ở API:
--     • nhân viên / kế toán / quản lý chi nhánh đọc được mọi hợp đồng, mọi khoản thu;
--     • đặt status = 'cancelled' (huỷ / hoàn tiền là việc riêng của chủ studio —
--       xem src/app/api/studio/contracts/[id]/cancel/route.ts);
--     • chèn khoản thu vào bất kỳ hợp đồng nào;
--     • quản lý chi nhánh đọc / ghi hợp đồng của cơ sở khác.
--   Và is_studio_member không nhìn profiles.is_active: tài khoản đã bị khoá vẫn
--   giữ nguyên quyền với database.
--
-- LUẬT (khớp src/lib/studio-roles.ts + các trang / route đang chạy)
--
--   vai trò          đọc hợp đồng                     ghi hợp đồng & bảng con
--   ───────────────  ───────────────────────────────  ─────────────────────────────
--   chủ / admin      toàn studio                      toàn studio (cả huỷ, hoàn tiền)
--   manager          toàn studio                      toàn studio, TRỪ huỷ / hoàn tiền
--   branch_manager   branch_id = chi nhánh của mình   như cột đọc, TRỪ huỷ / hoàn tiền
--   staff            assigned_to = mình (+ hợp đồng   assigned_to = mình, TRỪ huỷ /
--                    có hạng mục hậu kỳ giao cho mình) hoàn tiền
--   accountant       toàn studio (màn Thu chi cần)    KHÔNG — chỉ đánh dấu đã trả lương
--                                                      (contract_crew.paid / paid_at)
--
--   Quản lý chi nhánh CHƯA được gán chi nhánh thì không thấy hợp đồng nào
--   (fail-closed, cùng tinh thần forcedBranchScope).
--
-- HIỆU NĂNG
--   Mọi điều kiện về "người đang gọi" đi qua hàm `stable security definer` bọc
--   trong `(select …)`: Postgres tính MỘT lần mỗi câu lệnh (initPlan) chứ không
--   gọi lại cho từng dòng — cùng cách tang_toc_thu_vien_album.sql đã làm.
--
-- VÌ SAO VIẾT TỪNG POLICY RA, KHÔNG DÙNG KHỐI do $$ … $$
--   build-setup-all.mjs xếp khối do $$ vào PHẦN 2, còn `create policy` vào PHẦN 3.
--   Khối do $$ của rls_thanh_vien_hop_dong.sql vì thế bị chính các policy
--   chỉ-chủ-studio của schema.sql ở PHẦN 3 ghi đè trên project mới. Câu lệnh
--   trần thì nằm đúng PHẦN 3, và file này đứng CUỐI ORDER nên thắng.
--
-- Chạy SAU mọi migration tạo bảng hợp đồng (contract_cancel_reschedule,
-- contract_addenda, studio_vouchers…). An toàn khi chạy lại.
-- ============================================================================


-- ── 1) Thành viên studio phải còn ĐANG HOẠT ĐỘNG ─────────────────────────────
-- Người gọi bị khoá → hết quyền. Nhân viên mà CHỦ studio bị khoá → cũng hết
-- (requireStudio đã từ chối cả hai trường hợp; database giờ nói cùng một câu).
create or replace function public.is_studio_member(target uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select
    exists (
      select 1 from public.profiles me
      where me.id = auth.uid()
        and me.is_active
        and (
          target = me.id
          or (me.studio_owner_id = target
              and exists (select 1 from public.profiles o where o.id = target and o.is_active))
        )
    )
    or public.is_admin();
$$;

-- ── 2) Hàm "người đang gọi là ai" — dùng dạng (select …) trong policy ────────

-- Trả id CHỦ studio mà người gọi được hành động với một năng lực `cap`, hoặc
-- NULL nếu không có năng lực đó (NULL so sánh với owner_id luôn ra false).
--   'member'     mọi thành viên đang hoạt động (kể cả chủ)
--   'owner'      chính chủ studio (không phải nhân viên)
--   'all_read'   đọc toàn studio: chủ, manager, accountant
--   'all_write'  ghi toàn studio: chủ, manager
--   'branch'     branch_manager — phải so thêm branch_id với studio_my_branch()
--   'assigned'   staff — phải so thêm assigned_to với auth.uid()
--   'accountant' kế toán
-- Vai trò lạ / để trống được coi là 'staff' — đúng như requireStudio
-- (`me.studio_role || "staff"`), và là mức hẹp nhất.
create or replace function public.studio_scope_owner(cap text)
returns uuid language sql stable security definer set search_path = public as $$
  select case
           when cap = 'member'
             or (cap = 'owner'      and m.role = 'owner')
             or (cap = 'all_read'   and m.role in ('owner', 'manager', 'accountant'))
             or (cap = 'all_write'  and m.role in ('owner', 'manager'))
             or (cap = 'branch'     and m.role = 'branch_manager')
             or (cap = 'assigned'   and m.role = 'staff')
             or (cap = 'accountant' and m.role = 'accountant')
           then m.owner_id
         end
  from (
    select coalesce(me.studio_owner_id, me.id) as owner_id,
           case
             when me.studio_owner_id is null then 'owner'
             when me.studio_role in ('manager', 'branch_manager', 'accountant') then me.studio_role
             else 'staff'
           end as role
    from public.profiles me
    where me.id = auth.uid()
      and me.is_active
      and (me.studio_owner_id is null
           or exists (select 1 from public.profiles o where o.id = me.studio_owner_id and o.is_active))
  ) m;
$$;

-- Chi nhánh của chính người đang đăng nhập (chỉ có nghĩa với branch_manager).
create or replace function public.studio_my_branch()
returns uuid language sql stable security definer set search_path = public as $$
  select studio_branch_id from public.profiles where id = auth.uid();
$$;

-- Hợp đồng có hạng mục hậu kỳ (contract_products) giao cho CHÍNH nhân viên này.
-- Cổng /staff hiện hàng đợi hậu kỳ theo contract_products.assigned_to, và người
-- chỉnh ảnh thường KHÔNG phải người phụ trách hợp đồng — thiếu dòng này thì
-- việc được giao biến mất khỏi hàng đợi của họ. Chỉ mở ĐỌC, không mở ghi.
-- security definer → đọc contract_products không qua RLS, nên không vòng lặp
-- policy studio_contracts ↔ contract_products.
create or replace function public.studio_my_product_contracts()
returns uuid[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct p.contract_id), '{}'::uuid[])
  from public.contract_products p
  join public.studio_contracts c on c.id = p.contract_id
  where p.assigned_to = auth.uid()
    and c.owner_id = public.studio_scope_owner('assigned');
$$;

-- ── 3) Số thứ tự mã hợp đồng không phụ thuộc RLS ────────────────────────────
-- nextContractCode() đếm hợp đồng đã có trong tháng để ra HD-MM-YYYY-NNN. Nhân
-- viên / quản lý chi nhánh giờ chỉ THẤY một phần hợp đồng, đếm qua RLS sẽ ra số
-- nhỏ hơn thật và cấp trùng mã. Hàm này đếm toàn studio nhưng chỉ trả một con số.
create or replace function public.contract_code_count(p_owner uuid, p_prefix text)
returns bigint language plpgsql stable security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_studio_member(p_owner) then
    raise exception 'không có quyền với studio này' using errcode = '42501';
  end if;
  return (select count(*) from public.studio_contracts
          where owner_id = p_owner and code like p_prefix || '%');
end;
$$;

-- ── 4) Huỷ hợp đồng: chỉ chủ studio ──────────────────────────────────────────
-- Policy không thấy được giá trị CŨ của dòng nên không phân biệt được "đang huỷ"
-- với "sửa ghi chú của hợp đồng đã huỷ" — việc đó cần trigger. Máy chủ
-- (service role, auth.uid() NULL) đi qua: route huỷ đã tự kiểm vai trò.
create or replace function public.guard_contract_cancel()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if new.status = 'cancelled'
     and (tg_op = 'INSERT' or old.status is distinct from 'cancelled')
     -- coalesce: studio_scope_owner('owner') là NULL với nhân viên, và
     -- `not (false or NULL)` là NULL — if bỏ qua, hàng rào thủng im lặng.
     and not coalesce(public.is_admin() or new.owner_id = public.studio_scope_owner('owner'), false) then
    raise exception 'contract_cancel_owner_only: chỉ chủ studio được huỷ hợp đồng'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_contract_cancel on public.studio_contracts;

create trigger guard_contract_cancel
  before insert or update of status on public.studio_contracts
  for each row execute function public.guard_contract_cancel();

-- ── 5) Kế toán chỉ được đánh dấu đã trả lương ───────────────────────────────
-- Màn Bảng lương (PayrollView) cập nhật contract_crew.paid / paid_at ngay từ
-- trình duyệt. Policy cho kế toán UPDATE, trigger này giữ cho UPDATE đó không
-- đụng được cột nào khác (lương, vai trò, SĐT…). AFTER để thấy dòng cuối cùng,
-- kể cả cột sinh tự động phone_digits.
create or replace function public.guard_contract_crew_accountant()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null
     and public.studio_scope_owner('accountant') is not null
     and not public.is_admin()
     and (to_jsonb(new) - 'paid' - 'paid_at') is distinct from (to_jsonb(old) - 'paid' - 'paid_at') then
    raise exception 'payroll_paid_only: kế toán chỉ được đánh dấu đã trả lương'
      using errcode = '42501';
  end if;
  return null;
end;
$$;

drop trigger if exists guard_contract_crew_accountant on public.contract_crew;

create trigger guard_contract_crew_accountant
  after update on public.contract_crew
  for each row execute function public.guard_contract_crew_accountant();

-- ── Kiểm tra sau khi chạy ───────────────────────────────────────────────────
-- Mỗi bảng phải có `…_member_read` + `…_member_write` (contract_reschedules,
-- contract_addenda chỉ có read), và KHÔNG còn `…_owner_all`:
--
--   select tablename, policyname, cmd from pg_policies
--   where schemaname = 'public'
--     and (tablename like 'contract\_%' or tablename in ('studio_contracts','studio_crew'))
--   order by tablename, policyname;


-- ══════════════════════════════════════════════════════════════════════════
-- PHẦN 3 — PHÂN QUYỀN, RLS & POLICY (chạy sau khi mọi bảng/cột đã có)
-- ══════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/automations.sql — Việc tự động theo trạng thái hợp đồng (chạy SAU album_selection_done)
-- ══════════════════════════════════════════════════════════════════════════

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


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/crew_timesheet.sql — Chấm công thợ & khoảng rảnh (chạy SAU studio_appointments)
-- ══════════════════════════════════════════════════════════════════════════

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


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/vendors.sql — Nhà cung cấp & đơn đặt ngoài
-- ══════════════════════════════════════════════════════════════════════════

drop policy if exists studio_vendors_owner_all on public.studio_vendors;

create policy studio_vendors_owner_all on public.studio_vendors
  for all using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists vendor_orders_owner_all on public.vendor_orders;

create policy vendor_orders_owner_all on public.vendor_orders
  for all using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/accounting.sql — Phiếu thu có số & khoá sổ kế toán
-- ══════════════════════════════════════════════════════════════════════════

drop policy if exists studio_receipt_seq_owner_all on public.studio_receipt_seq;

create policy studio_receipt_seq_owner_all on public.studio_receipt_seq
  for all using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

revoke all on function public.next_receipt_no(uuid, integer) from public, anon;

grant execute on function public.next_receipt_no(uuid, integer) to authenticated, service_role;

-- BẮT BUỘC: c1_profiles_column_grants.sql đã thu hồi UPDATE toàn bảng profiles.
-- Không cấp cột này thì nút "Khoá sổ" bấm xong im lặng không đổi gì.
grant update (books_closed_until) on public.profiles to authenticated;


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/weather.sql — Toạ độ điểm chụp cho dự báo thời tiết (chạy SAU studio_appointments)
-- ══════════════════════════════════════════════════════════════════════════

-- BẮT BUỘC: migrations/c1_profiles_column_grants.sql đã THU HỒI quyền UPDATE
-- toàn bảng profiles và chỉ cấp lại theo từng cột. Không cấp ba cột này thì thẻ
-- "Vị trí studio" lưu sẽ im lặng không đổi được gì.
-- Cả ba đều vô hại (toạ độ + địa chỉ), không phải cột nhạy cảm như role/plan.
grant update (studio_lat, studio_lng, studio_address) on public.profiles to authenticated;


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/album_people.sql — Gom ảnh theo từng người trong album (chạy SAU schema.sql — cần albums + photos)
-- ══════════════════════════════════════════════════════════════════════════

drop policy if exists album_people_owner_rw on public.album_people;

create policy album_people_owner_rw on public.album_people
  for all using (
    exists (select 1 from public.albums a
            where a.id = album_id and (a.owner_id = auth.uid() or public.is_admin()))
  )
  with check (
    exists (select 1 from public.albums a
            where a.id = album_id and (a.owner_id = auth.uid() or public.is_admin()))
  );

drop policy if exists album_photo_people_owner_rw on public.album_photo_people;

/*
 * Ngoài quyền sở hữu, policy này còn là HÀNG RÀO TOÀN VẸN cho hai chỗ mà khoá
 * ngoại không với tới được: người và ảnh phải thuộc ĐÚNG album_id đã ghi. Không
 * có nó, một lỗi lập trình trộn album A với album B vẫn ghi được, và khách album
 * A sẽ thấy chip lọc ra ảnh của album B.
 */
create policy album_photo_people_owner_rw on public.album_photo_people
  for all using (
    exists (select 1 from public.albums a
            where a.id = album_id and (a.owner_id = auth.uid() or public.is_admin()))
  )
  with check (
    exists (
      select 1
      from public.album_people p
      join public.albums a on a.id = p.album_id
      join public.photos ph on ph.id = photo_id
      where p.id = person_id
        and p.album_id = album_photo_people.album_id
        and ph.album_id = album_photo_people.album_id
        and (a.owner_id = auth.uid() or public.is_admin())
    )
  );


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/album_faces.sql — Kho khuôn mặt đã quét — để lượt quét tự động chạy tiếp được (chạy SAU album_people)
-- ══════════════════════════════════════════════════════════════════════════

drop policy if exists album_faces_owner_rw on public.album_faces;

create policy album_faces_owner_rw on public.album_faces
  for all using (
    exists (select 1 from public.albums a
            where a.id = album_id and (a.owner_id = auth.uid() or public.is_admin()))
  )
  with check (
    -- Cũng là hàng rào toàn vẹn: ảnh phải thuộc ĐÚNG album đã ghi, giống policy
    -- của album_photo_people. Khoá ngoại không kiểm được điều đó.
    exists (
      select 1
      from public.albums a
      join public.photos ph on ph.id = photo_id
      where a.id = album_faces.album_id
        and ph.album_id = album_faces.album_id
        and (a.owner_id = auth.uid() or public.is_admin())
    )
  );


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/bank_auto_reconcile.sql — Tự xác nhận chuyển khoản qua SePay: mã đợt, khoá webhook, sổ giao dịch (chạy SAU referral_deposit)
-- ══════════════════════════════════════════════════════════════════════════

-- Chỉ chủ studio (và admin) đọc được khoá. Tạo và đổi khoá đi qua
-- /api/studio/bank-hook để khoá luôn do máy chủ sinh ngẫu nhiên, nên RLS chỉ
-- cho đọc.
drop policy if exists studio_bank_hooks_owner_read on public.studio_bank_hooks;

create policy studio_bank_hooks_owner_read on public.studio_bank_hooks
  for select using (owner_id = auth.uid() or public.is_admin());

drop policy if exists studio_bank_transactions_owner_read on public.studio_bank_transactions;

create policy studio_bank_transactions_owner_read on public.studio_bank_transactions
  for select using (owner_id = auth.uid() or public.is_admin());


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/contract_cancel_reschedule.sql — Huỷ hợp đồng (hoàn / giữ cọc, chính sách huỷ) + lịch sử dời lịch
-- ══════════════════════════════════════════════════════════════════════════

-- c1_profiles_column_grants.sql thu hồi UPDATE toàn bảng profiles, chỉ cấp lại
-- theo cột. Thiếu dòng này thì thẻ chính sách lưu im lặng không đổi gì.
grant update (cancel_early_days, cancel_early_refund_pct, cancel_late_refund_pct)
  on public.profiles to authenticated;

-- Đọc: chủ hợp đồng + admin. Ghi đi qua /api/studio/contracts/[id]/reschedule
-- (service-role) vì một lần dời còn kéo theo lịch thợ, hạn thu, lịch hẹn.
drop policy if exists contract_reschedules_owner_read on public.contract_reschedules;

create policy contract_reschedules_owner_read on public.contract_reschedules
  for select using (
    exists (select 1 from public.studio_contracts c
            where c.id = contract_id and (c.owner_id = auth.uid() or public.is_admin()))
  );


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/contract_addenda.sql — Khoá giá sau khi khách ký + phụ lục hợp đồng
-- ══════════════════════════════════════════════════════════════════════════

drop policy if exists contract_addenda_member_read on public.contract_addenda;

create policy contract_addenda_member_read on public.contract_addenda
  for select using (public.is_studio_member(owner_id));


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/studio_vouchers.sql — Voucher / thẻ quà tặng của studio (chạy SAU contract_cancel_reschedule)
-- ══════════════════════════════════════════════════════════════════════════

drop policy if exists studio_vouchers_member_read on public.studio_vouchers;

create policy studio_vouchers_member_read on public.studio_vouchers
  for select using (public.is_studio_member(owner_id));


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/studio_voucher_program.sql — Chương trình voucher ưu đãi tự gắn mọi hợp đồng (chạy SAU studio_vouchers_loyalty)
-- ══════════════════════════════════════════════════════════════════════════

drop policy if exists studio_voucher_program_member_read on public.studio_voucher_program;

create policy studio_voucher_program_member_read on public.studio_voucher_program
  for select using (public.is_studio_member(owner_id));


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/studio_saved_signature.sql — Lưu chữ ký Bên A của studio để ký hợp đồng một chạm
-- ══════════════════════════════════════════════════════════════════════════

drop policy if exists studio_saved_signature_member_read on public.studio_saved_signature;

create policy studio_saved_signature_member_read on public.studio_saved_signature
  for select using (public.is_studio_member(owner_id));


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/studio_audit_log.sql — Nhật ký thao tác tiền & hợp đồng
-- ══════════════════════════════════════════════════════════════════════════

drop policy if exists studio_audit_log_read on public.studio_audit_log;

create policy studio_audit_log_read on public.studio_audit_log
  for select using (
    owner_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from public.profiles p
               where p.id = auth.uid() and p.studio_owner_id = studio_audit_log.owner_id
                 and p.studio_role = 'accountant')
  );

revoke insert, update, delete on public.studio_audit_log from authenticated, anon;

revoke execute on function public.audit_write(uuid, text, text, uuid, uuid, text, jsonb, jsonb) from public, anon, authenticated;


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/bao_mat_quyen_rpc_storage.sql — Vá bảo mật: RPC chỉ service-role, số phiếu thu, storage, crew_account, affiliate_codes
-- ══════════════════════════════════════════════════════════════════════════

revoke all on function public.next_receipt_no(uuid, integer) from public, anon;

grant execute on function public.next_receipt_no(uuid, integer) to authenticated, service_role;

-- ── 3) Storage: bỏ quyền LIỆT KÊ công khai, ghi chỉ trong thư mục của mình ───
-- Ba bucket đều PUBLIC: ảnh vẫn mở được bằng URL công khai mà không cần policy
-- SELECT nào. Policy SELECT chỉ mở thêm đường LIỆT KÊ toàn bucket — với
-- payment-proofs nghĩa là ai cũng duyệt được ảnh chuyển khoản (tên, số tài
-- khoản, số tiền) của mọi studio.
--
-- Đường dẫn thật trong app (đã đối chiếu):
--   • /api/upload (client của user)      → `<user_id>/<ts>.<ext>`
--   • /api/upload/large (URL ký sẵn)     → `tmp/<user_id>/<uuid>.<ext>`
--   • /api/c/[token]/proof, /api/book/deposit (service-role) → `client/…`, `booking/…`
--   • thiệp cưới (service-role / URL ký sẵn) → wedding-photos, không qua RLS
-- Service-role và URL ký sẵn bỏ qua RLS, nên chỉ hai dạng đầu cần policy.
--
-- Vẫn giữ SELECT trong thư mục của chính mình: Storage đòi quyền SELECT cho
-- `upload(…, { upsert: true })` và `remove()` (ContractEditor xoá ảnh CK cũ).
--
-- Dùng split_part thay cho storage.foldername(): cùng nghĩa (đoạn trước dấu
-- '/' đầu tiên) mà không phụ thuộc hàm riêng của Supabase.

-- payment-proofs
drop policy if exists payment_proofs_read on storage.objects;

create policy payment_proofs_read on storage.objects
  for select to authenticated using (
    bucket_id = 'payment-proofs'
    and (split_part(name, '/', 1) = auth.uid()::text
         or (split_part(name, '/', 1) = 'tmp' and split_part(name, '/', 2) = auth.uid()::text))
  );

drop policy if exists payment_proofs_insert on storage.objects;

create policy payment_proofs_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'payment-proofs'
    and (split_part(name, '/', 1) = auth.uid()::text
         or (split_part(name, '/', 1) = 'tmp' and split_part(name, '/', 2) = auth.uid()::text))
  );

drop policy if exists payment_proofs_update on storage.objects;

create policy payment_proofs_update on storage.objects
  for update to authenticated using (
    bucket_id = 'payment-proofs'
    and (split_part(name, '/', 1) = auth.uid()::text
         or (split_part(name, '/', 1) = 'tmp' and split_part(name, '/', 2) = auth.uid()::text))
  ) with check (
    bucket_id = 'payment-proofs'
    and (split_part(name, '/', 1) = auth.uid()::text
         or (split_part(name, '/', 1) = 'tmp' and split_part(name, '/', 2) = auth.uid()::text))
  );

drop policy if exists payment_proofs_delete on storage.objects;

create policy payment_proofs_delete on storage.objects
  for delete to authenticated using (
    bucket_id = 'payment-proofs'
    and (split_part(name, '/', 1) = auth.uid()::text
         or (split_part(name, '/', 1) = 'tmp' and split_part(name, '/', 2) = auth.uid()::text))
  );

-- logos
drop policy if exists logos_read on storage.objects;

create policy logos_read on storage.objects
  for select to authenticated using (
    bucket_id = 'logos'
    and (split_part(name, '/', 1) = auth.uid()::text
         or (split_part(name, '/', 1) = 'tmp' and split_part(name, '/', 2) = auth.uid()::text))
  );

drop policy if exists logos_write on storage.objects;

create policy logos_write on storage.objects
  for insert to authenticated with check (
    bucket_id = 'logos'
    and (split_part(name, '/', 1) = auth.uid()::text
         or (split_part(name, '/', 1) = 'tmp' and split_part(name, '/', 2) = auth.uid()::text))
  );

drop policy if exists logos_update on storage.objects;

create policy logos_update on storage.objects
  for update to authenticated using (
    bucket_id = 'logos'
    and (split_part(name, '/', 1) = auth.uid()::text
         or (split_part(name, '/', 1) = 'tmp' and split_part(name, '/', 2) = auth.uid()::text))
  ) with check (
    bucket_id = 'logos'
    and (split_part(name, '/', 1) = auth.uid()::text
         or (split_part(name, '/', 1) = 'tmp' and split_part(name, '/', 2) = auth.uid()::text))
  );

drop policy if exists logos_delete on storage.objects;

create policy logos_delete on storage.objects
  for delete to authenticated using (
    bucket_id = 'logos'
    and (split_part(name, '/', 1) = auth.uid()::text
         or (split_part(name, '/', 1) = 'tmp' and split_part(name, '/', 2) = auth.uid()::text))
  );

-- wedding-photos: mọi thao tác đi qua service-role / URL ký sẵn; khách xem ảnh
-- bằng URL công khai. Policy đọc chỉ còn tác dụng cho phép liệt kê → bỏ.
drop policy if exists wedding_photos_read on storage.objects;

-- ── 4) crew_account: không cho client đọc ────────────────────────────────────
-- Bảng giữ `calendar_token` — ai có token là tải được feed lịch (.ics) của thợ,
-- gồm tên khách và địa điểm. Policy cũ cho MỌI tài khoản đăng nhập đọc cả bảng.
-- App chỉ đọc/ghi nó qua service-role (/api/crew, /api/crew-calendar), nên bỏ
-- hẳn policy: RLS bật mà không có policy = chỉ service-role chạm được.
drop policy if exists crew_account_read on public.crew_account;

-- ── 5) affiliate_codes: chủ mã chỉ được ĐỌC ──────────────────────────────────
-- `for all` cho phép người dùng tự sửa `code` (giành mã đẹp của người khác khi
-- mã cũ bị tắt) hay tự bật lại `active` mà admin đã tắt. Mọi thao tác ghi đều
-- đi qua service-role (RPC get_or_create_affiliate_code, upgrade-activate).
drop policy if exists affiliate_codes_owner on public.affiliate_codes;

create policy affiliate_codes_owner on public.affiliate_codes
  for select using (user_id = auth.uid());


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/vai_tro_tho_tu_dat.sql — Vai trò thợ studio tự đặt (đổi tên / ẩn / thêm vai trò) + bỏ ràng buộc vai trò contract_crew (chạy SAU crew_role_makeup)
-- ══════════════════════════════════════════════════════════════════════════

drop policy if exists studio_crew_roles_member_read on public.studio_crew_roles;

create policy studio_crew_roles_member_read on public.studio_crew_roles
  for select using (public.is_studio_member(owner_id));

drop policy if exists studio_crew_roles_manager_write on public.studio_crew_roles;

create policy studio_crew_roles_manager_write on public.studio_crew_roles
  for all
  using (
    owner_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from public.profiles p
               where p.id = auth.uid() and p.studio_owner_id = owner_id and p.studio_role = 'manager')
  )
  with check (
    owner_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from public.profiles p
               where p.id = auth.uid() and p.studio_owner_id = owner_id and p.studio_role = 'manager')
  );


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/tang_toc_thu_vien_album.sql — Tăng tốc thư viện album: chỉ mục, hàm đếm album_library_stats, policy RLS dạng initPlan (chạy SAU album_dislikes)
-- ══════════════════════════════════════════════════════════════════════════

revoke all on function public.album_library_stats(uuid) from public, anon;

grant execute on function public.album_library_stats(uuid) to authenticated, service_role;

-- ── 3) Policy dạng initPlan — CÙNG ý nghĩa với schema.sql / album_dislikes.sql ─
drop policy if exists albums_owner_all on public.albums;

create policy albums_owner_all on public.albums
  for all using (owner_id = (select auth.uid()) or (select public.is_admin()))
  with check (owner_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists photos_owner_all on public.photos;

create policy photos_owner_all on public.photos
  for all using (
    exists (select 1 from public.albums a
            where a.id = album_id and (a.owner_id = (select auth.uid()) or (select public.is_admin())))
  )
  with check (
    exists (select 1 from public.albums a
            where a.id = album_id and (a.owner_id = (select auth.uid()) or (select public.is_admin())))
  );

drop policy if exists selections_owner_rw on public.selections;

create policy selections_owner_rw on public.selections
  for all using (
    exists (select 1 from public.albums a
            where a.id = album_id and (a.owner_id = (select auth.uid()) or (select public.is_admin())))
  )
  with check (
    exists (select 1 from public.albums a
            where a.id = album_id and (a.owner_id = (select auth.uid()) or (select public.is_admin())))
  );

drop policy if exists dislikes_owner_rw on public.dislikes;

create policy dislikes_owner_rw on public.dislikes
  for all using (
    exists (select 1 from public.albums a
            where a.id = album_id and (a.owner_id = (select auth.uid()) or (select public.is_admin())))
  )
  with check (
    exists (select 1 from public.albums a
            where a.id = album_id and (a.owner_id = (select auth.uid()) or (select public.is_admin())))
  );


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/ai_providers.sql — API key AI nhập trong trang quản trị: key chung của admin + key riêng của từng studio (đã mã hoá)
-- ══════════════════════════════════════════════════════════════════════════

revoke all on public.admin_ai_providers from anon, authenticated;

revoke all on public.studio_ai_providers from anon, authenticated;


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/anh_in_tang.sql — Ảnh in tặng: số ảnh in theo hợp đồng + khách chọn ảnh in trong album giao khách
-- ══════════════════════════════════════════════════════════════════════════

drop policy if exists print_picks_owner_rw on public.print_picks;

create policy print_picks_owner_rw on public.print_picks
  for all using (
    exists (select 1 from public.albums a
            where a.id = album_id and (a.owner_id = auth.uid() or public.is_admin()))
  )
  with check (
    exists (select 1 from public.albums a
            where a.id = album_id and (a.owner_id = auth.uid() or public.is_admin()))
  );


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/ke_hoach_cuoi.sql — Kế hoạch cưới của khách trên cổng khách: việc cần làm, ngân sách, lịch trình ngày cưới + bật/tắt theo hợp đồng
-- ══════════════════════════════════════════════════════════════════════════

drop policy if exists wedding_plans_member_read on public.wedding_plans;

create policy wedding_plans_member_read on public.wedding_plans
  for select using (public.is_studio_member(owner_id));


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/luu_chon_anh_tung_phan.sql — Lưu lựa chọn ảnh của khách theo phần chênh trong một transaction: hàm save_album_selection (chạy SAU album_dislikes)
-- ══════════════════════════════════════════════════════════════════════════

revoke all on function public.save_album_selection(uuid, text, text, uuid[], jsonb, uuid[]) from public, anon, authenticated;

grant execute on function public.save_album_selection(uuid, text, text, uuid[], jsonb, uuid[]) to service_role;


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/phan_quyen_vai_tro_hop_dong.sql — Phân quyền theo vai trò cho hợp đồng: staff chỉ hợp đồng được giao, quản lý chi nhánh chỉ chi nhánh mình, kế toán chỉ đọc, chỉ chủ studio huỷ / hoàn tiền, tài khoản bị khoá mất quyền (chạy CUỐI)
-- ══════════════════════════════════════════════════════════════════════════

revoke all on function public.contract_code_count(uuid, text) from public, anon;

grant execute on function public.contract_code_count(uuid, text) to authenticated, service_role;

-- ── 6) Policy ────────────────────────────────────────────────────────────────
-- Mỗi bảng hai policy: `…_member_read` (SELECT) và `…_member_write` (mọi lệnh
-- ghi). Bảng con lấy quyền theo hợp đồng cha qua contract_id.

-- studio_contracts
drop policy if exists studio_contracts_owner_all on public.studio_contracts;

drop policy if exists studio_contracts_member_read on public.studio_contracts;

create policy studio_contracts_member_read on public.studio_contracts
  for select using (
    (select public.is_admin())
    or owner_id = (select public.studio_scope_owner('all_read'))
    or (owner_id = (select public.studio_scope_owner('branch')) and branch_id = (select public.studio_my_branch()))
    or (owner_id = (select public.studio_scope_owner('assigned'))
        and (assigned_to = (select auth.uid()) or id = any ((select public.studio_my_product_contracts())::uuid[])))
  );

drop policy if exists studio_contracts_member_write on public.studio_contracts;

create policy studio_contracts_member_write on public.studio_contracts
  for all using (
    (select public.is_admin())
    or owner_id = (select public.studio_scope_owner('all_write'))
    or (owner_id = (select public.studio_scope_owner('branch')) and branch_id = (select public.studio_my_branch()))
    or (owner_id = (select public.studio_scope_owner('assigned')) and assigned_to = (select auth.uid()))
  ) with check (
    (select public.is_admin())
    or owner_id = (select public.studio_scope_owner('all_write'))
    or (owner_id = (select public.studio_scope_owner('branch')) and branch_id = (select public.studio_my_branch()))
    or (owner_id = (select public.studio_scope_owner('assigned')) and assigned_to = (select auth.uid()))
  );

-- contract_items
drop policy if exists contract_items_owner_all on public.contract_items;

drop policy if exists contract_items_member_read on public.contract_items;

create policy contract_items_member_read on public.contract_items
  for select using (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and (
      (select public.is_admin())
      or c.owner_id = (select public.studio_scope_owner('all_read'))
      or (c.owner_id = (select public.studio_scope_owner('branch')) and c.branch_id = (select public.studio_my_branch()))
      or (c.owner_id = (select public.studio_scope_owner('assigned'))
          and (c.assigned_to = (select auth.uid()) or c.id = any ((select public.studio_my_product_contracts())::uuid[])))))
  );

drop policy if exists contract_items_member_write on public.contract_items;

create policy contract_items_member_write on public.contract_items
  for all using (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and (
      (select public.is_admin())
      or c.owner_id = (select public.studio_scope_owner('all_write'))
      or (c.owner_id = (select public.studio_scope_owner('branch')) and c.branch_id = (select public.studio_my_branch()))
      or (c.owner_id = (select public.studio_scope_owner('assigned')) and c.assigned_to = (select auth.uid()))))
  ) with check (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and (
      (select public.is_admin())
      or c.owner_id = (select public.studio_scope_owner('all_write'))
      or (c.owner_id = (select public.studio_scope_owner('branch')) and c.branch_id = (select public.studio_my_branch()))
      or (c.owner_id = (select public.studio_scope_owner('assigned')) and c.assigned_to = (select auth.uid()))))
  );

-- contract_crew (+ kế toán đánh dấu đã trả lương — xem trigger ở mục 5)
drop policy if exists contract_crew_owner_all on public.contract_crew;

drop policy if exists contract_crew_member_read on public.contract_crew;

create policy contract_crew_member_read on public.contract_crew
  for select using (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and (
      (select public.is_admin())
      or c.owner_id = (select public.studio_scope_owner('all_read'))
      or (c.owner_id = (select public.studio_scope_owner('branch')) and c.branch_id = (select public.studio_my_branch()))
      or (c.owner_id = (select public.studio_scope_owner('assigned'))
          and (c.assigned_to = (select auth.uid()) or c.id = any ((select public.studio_my_product_contracts())::uuid[])))))
  );

drop policy if exists contract_crew_member_write on public.contract_crew;

create policy contract_crew_member_write on public.contract_crew
  for all using (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and (
      (select public.is_admin())
      or c.owner_id = (select public.studio_scope_owner('all_write'))
      or (c.owner_id = (select public.studio_scope_owner('branch')) and c.branch_id = (select public.studio_my_branch()))
      or (c.owner_id = (select public.studio_scope_owner('assigned')) and c.assigned_to = (select auth.uid()))))
  ) with check (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and (
      (select public.is_admin())
      or c.owner_id = (select public.studio_scope_owner('all_write'))
      or (c.owner_id = (select public.studio_scope_owner('branch')) and c.branch_id = (select public.studio_my_branch()))
      or (c.owner_id = (select public.studio_scope_owner('assigned')) and c.assigned_to = (select auth.uid()))))
  );

drop policy if exists contract_crew_payroll_update on public.contract_crew;

create policy contract_crew_payroll_update on public.contract_crew
  for update using (
    exists (select 1 from public.studio_contracts c
            where c.id = contract_id and c.owner_id = (select public.studio_scope_owner('accountant')))
  ) with check (
    exists (select 1 from public.studio_contracts c
            where c.id = contract_id and c.owner_id = (select public.studio_scope_owner('accountant')))
  );

-- contract_edit_requests
drop policy if exists contract_edit_requests_owner_all on public.contract_edit_requests;

drop policy if exists contract_edit_requests_member_read on public.contract_edit_requests;

create policy contract_edit_requests_member_read on public.contract_edit_requests
  for select using (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and (
      (select public.is_admin())
      or c.owner_id = (select public.studio_scope_owner('all_read'))
      or (c.owner_id = (select public.studio_scope_owner('branch')) and c.branch_id = (select public.studio_my_branch()))
      or (c.owner_id = (select public.studio_scope_owner('assigned'))
          and (c.assigned_to = (select auth.uid()) or c.id = any ((select public.studio_my_product_contracts())::uuid[])))))
  );

drop policy if exists contract_edit_requests_member_write on public.contract_edit_requests;

create policy contract_edit_requests_member_write on public.contract_edit_requests
  for all using (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and (
      (select public.is_admin())
      or c.owner_id = (select public.studio_scope_owner('all_write'))
      or (c.owner_id = (select public.studio_scope_owner('branch')) and c.branch_id = (select public.studio_my_branch()))
      or (c.owner_id = (select public.studio_scope_owner('assigned')) and c.assigned_to = (select auth.uid()))))
  ) with check (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and (
      (select public.is_admin())
      or c.owner_id = (select public.studio_scope_owner('all_write'))
      or (c.owner_id = (select public.studio_scope_owner('branch')) and c.branch_id = (select public.studio_my_branch()))
      or (c.owner_id = (select public.studio_scope_owner('assigned')) and c.assigned_to = (select auth.uid()))))
  );

-- contract_payments: thêm hàng rào HOÀN TIỀN — khoản kind='refund' hay số âm chỉ
-- chủ studio ghi được (route huỷ ghi bằng service role, không qua đây).
drop policy if exists contract_payments_owner_all on public.contract_payments;

drop policy if exists contract_payments_member_read on public.contract_payments;

create policy contract_payments_member_read on public.contract_payments
  for select using (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and (
      (select public.is_admin())
      or c.owner_id = (select public.studio_scope_owner('all_read'))
      or (c.owner_id = (select public.studio_scope_owner('branch')) and c.branch_id = (select public.studio_my_branch()))
      or (c.owner_id = (select public.studio_scope_owner('assigned'))
          and (c.assigned_to = (select auth.uid()) or c.id = any ((select public.studio_my_product_contracts())::uuid[])))))
  );

drop policy if exists contract_payments_member_write on public.contract_payments;

create policy contract_payments_member_write on public.contract_payments
  for all using (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and (
      (select public.is_admin())
      or c.owner_id = (select public.studio_scope_owner('all_write'))
      or (c.owner_id = (select public.studio_scope_owner('branch')) and c.branch_id = (select public.studio_my_branch()))
      or (c.owner_id = (select public.studio_scope_owner('assigned')) and c.assigned_to = (select auth.uid()))))
  ) with check (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and (
      (select public.is_admin())
      or c.owner_id = (select public.studio_scope_owner('all_write'))
      or (c.owner_id = (select public.studio_scope_owner('branch')) and c.branch_id = (select public.studio_my_branch()))
      or (c.owner_id = (select public.studio_scope_owner('assigned')) and c.assigned_to = (select auth.uid()))))
    and (
      (kind is distinct from 'refund' and coalesce(amount, 0) >= 0)
      or (select public.is_admin())
      or exists (select 1 from public.studio_contracts c
                 where c.id = contract_id and c.owner_id = (select public.studio_scope_owner('owner')))
    )
  );

-- contract_payment_plan
drop policy if exists contract_payment_plan_owner_all on public.contract_payment_plan;

drop policy if exists contract_payment_plan_member_read on public.contract_payment_plan;

create policy contract_payment_plan_member_read on public.contract_payment_plan
  for select using (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and (
      (select public.is_admin())
      or c.owner_id = (select public.studio_scope_owner('all_read'))
      or (c.owner_id = (select public.studio_scope_owner('branch')) and c.branch_id = (select public.studio_my_branch()))
      or (c.owner_id = (select public.studio_scope_owner('assigned'))
          and (c.assigned_to = (select auth.uid()) or c.id = any ((select public.studio_my_product_contracts())::uuid[])))))
  );

drop policy if exists contract_payment_plan_member_write on public.contract_payment_plan;

create policy contract_payment_plan_member_write on public.contract_payment_plan
  for all using (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and (
      (select public.is_admin())
      or c.owner_id = (select public.studio_scope_owner('all_write'))
      or (c.owner_id = (select public.studio_scope_owner('branch')) and c.branch_id = (select public.studio_my_branch()))
      or (c.owner_id = (select public.studio_scope_owner('assigned')) and c.assigned_to = (select auth.uid()))))
  ) with check (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and (
      (select public.is_admin())
      or c.owner_id = (select public.studio_scope_owner('all_write'))
      or (c.owner_id = (select public.studio_scope_owner('branch')) and c.branch_id = (select public.studio_my_branch()))
      or (c.owner_id = (select public.studio_scope_owner('assigned')) and c.assigned_to = (select auth.uid()))))
  );

-- contract_tasks
drop policy if exists contract_tasks_owner_all on public.contract_tasks;

drop policy if exists contract_tasks_member_read on public.contract_tasks;

create policy contract_tasks_member_read on public.contract_tasks
  for select using (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and (
      (select public.is_admin())
      or c.owner_id = (select public.studio_scope_owner('all_read'))
      or (c.owner_id = (select public.studio_scope_owner('branch')) and c.branch_id = (select public.studio_my_branch()))
      or (c.owner_id = (select public.studio_scope_owner('assigned'))
          and (c.assigned_to = (select auth.uid()) or c.id = any ((select public.studio_my_product_contracts())::uuid[])))))
  );

drop policy if exists contract_tasks_member_write on public.contract_tasks;

create policy contract_tasks_member_write on public.contract_tasks
  for all using (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and (
      (select public.is_admin())
      or c.owner_id = (select public.studio_scope_owner('all_write'))
      or (c.owner_id = (select public.studio_scope_owner('branch')) and c.branch_id = (select public.studio_my_branch()))
      or (c.owner_id = (select public.studio_scope_owner('assigned')) and c.assigned_to = (select auth.uid()))))
  ) with check (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and (
      (select public.is_admin())
      or c.owner_id = (select public.studio_scope_owner('all_write'))
      or (c.owner_id = (select public.studio_scope_owner('branch')) and c.branch_id = (select public.studio_my_branch()))
      or (c.owner_id = (select public.studio_scope_owner('assigned')) and c.assigned_to = (select auth.uid()))))
  );

-- contract_equipment
drop policy if exists contract_equipment_owner_all on public.contract_equipment;

drop policy if exists contract_equipment_member_read on public.contract_equipment;

create policy contract_equipment_member_read on public.contract_equipment
  for select using (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and (
      (select public.is_admin())
      or c.owner_id = (select public.studio_scope_owner('all_read'))
      or (c.owner_id = (select public.studio_scope_owner('branch')) and c.branch_id = (select public.studio_my_branch()))
      or (c.owner_id = (select public.studio_scope_owner('assigned'))
          and (c.assigned_to = (select auth.uid()) or c.id = any ((select public.studio_my_product_contracts())::uuid[])))))
  );

drop policy if exists contract_equipment_member_write on public.contract_equipment;

create policy contract_equipment_member_write on public.contract_equipment
  for all using (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and (
      (select public.is_admin())
      or c.owner_id = (select public.studio_scope_owner('all_write'))
      or (c.owner_id = (select public.studio_scope_owner('branch')) and c.branch_id = (select public.studio_my_branch()))
      or (c.owner_id = (select public.studio_scope_owner('assigned')) and c.assigned_to = (select auth.uid()))))
  ) with check (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and (
      (select public.is_admin())
      or c.owner_id = (select public.studio_scope_owner('all_write'))
      or (c.owner_id = (select public.studio_scope_owner('branch')) and c.branch_id = (select public.studio_my_branch()))
      or (c.owner_id = (select public.studio_scope_owner('assigned')) and c.assigned_to = (select auth.uid()))))
  );

-- contract_products (+ người được giao hạng mục hậu kỳ đẩy được trạng thái của nó
-- từ cổng /staff, kể cả khi hợp đồng không giao cho họ)
drop policy if exists contract_products_owner_all on public.contract_products;

drop policy if exists contract_products_member_read on public.contract_products;

create policy contract_products_member_read on public.contract_products
  for select using (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and (
      (select public.is_admin())
      or c.owner_id = (select public.studio_scope_owner('all_read'))
      or (c.owner_id = (select public.studio_scope_owner('branch')) and c.branch_id = (select public.studio_my_branch()))
      or (c.owner_id = (select public.studio_scope_owner('assigned'))
          and (c.assigned_to = (select auth.uid()) or c.id = any ((select public.studio_my_product_contracts())::uuid[])))))
  );

drop policy if exists contract_products_member_write on public.contract_products;

create policy contract_products_member_write on public.contract_products
  for all using (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and (
      (select public.is_admin())
      or c.owner_id = (select public.studio_scope_owner('all_write'))
      or (c.owner_id = (select public.studio_scope_owner('branch')) and c.branch_id = (select public.studio_my_branch()))
      or (c.owner_id = (select public.studio_scope_owner('assigned')) and c.assigned_to = (select auth.uid()))))
  ) with check (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and (
      (select public.is_admin())
      or c.owner_id = (select public.studio_scope_owner('all_write'))
      or (c.owner_id = (select public.studio_scope_owner('branch')) and c.branch_id = (select public.studio_my_branch()))
      or (c.owner_id = (select public.studio_scope_owner('assigned')) and c.assigned_to = (select auth.uid()))))
  );

drop policy if exists contract_products_assignee_update on public.contract_products;

create policy contract_products_assignee_update on public.contract_products
  for update using (
    assigned_to = (select auth.uid())
    and exists (select 1 from public.studio_contracts c
                where c.id = contract_id and c.owner_id = (select public.studio_scope_owner('member')))
  ) with check (
    assigned_to = (select auth.uid())
    and exists (select 1 from public.studio_contracts c
                where c.id = contract_id and c.owner_id = (select public.studio_scope_owner('member')))
  );

-- contract_quote_options
drop policy if exists contract_quote_options_owner_all on public.contract_quote_options;

drop policy if exists contract_quote_options_member_read on public.contract_quote_options;

create policy contract_quote_options_member_read on public.contract_quote_options
  for select using (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and (
      (select public.is_admin())
      or c.owner_id = (select public.studio_scope_owner('all_read'))
      or (c.owner_id = (select public.studio_scope_owner('branch')) and c.branch_id = (select public.studio_my_branch()))
      or (c.owner_id = (select public.studio_scope_owner('assigned'))
          and (c.assigned_to = (select auth.uid()) or c.id = any ((select public.studio_my_product_contracts())::uuid[])))))
  );

drop policy if exists contract_quote_options_member_write on public.contract_quote_options;

create policy contract_quote_options_member_write on public.contract_quote_options
  for all using (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and (
      (select public.is_admin())
      or c.owner_id = (select public.studio_scope_owner('all_write'))
      or (c.owner_id = (select public.studio_scope_owner('branch')) and c.branch_id = (select public.studio_my_branch()))
      or (c.owner_id = (select public.studio_scope_owner('assigned')) and c.assigned_to = (select auth.uid()))))
  ) with check (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and (
      (select public.is_admin())
      or c.owner_id = (select public.studio_scope_owner('all_write'))
      or (c.owner_id = (select public.studio_scope_owner('branch')) and c.branch_id = (select public.studio_my_branch()))
      or (c.owner_id = (select public.studio_scope_owner('assigned')) and c.assigned_to = (select auth.uid()))))
  );

-- contract_client_proofs: ảnh chuyển khoản khách tải lên (khách ghi qua route
-- service role). Trước đây chỉ chủ studio đọc được — nhưng màn hợp đồng hiện
-- chúng cho mọi vai trò mở được hợp đồng, nên giờ theo cùng luật hợp đồng.
drop policy if exists contract_client_proofs_owner on public.contract_client_proofs;

drop policy if exists contract_client_proofs_member_read on public.contract_client_proofs;

create policy contract_client_proofs_member_read on public.contract_client_proofs
  for select using (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and (
      (select public.is_admin())
      or c.owner_id = (select public.studio_scope_owner('all_read'))
      or (c.owner_id = (select public.studio_scope_owner('branch')) and c.branch_id = (select public.studio_my_branch()))
      or (c.owner_id = (select public.studio_scope_owner('assigned'))
          and (c.assigned_to = (select auth.uid()) or c.id = any ((select public.studio_my_product_contracts())::uuid[])))))
  );

drop policy if exists contract_client_proofs_member_write on public.contract_client_proofs;

create policy contract_client_proofs_member_write on public.contract_client_proofs
  for all using (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and (
      (select public.is_admin())
      or c.owner_id = (select public.studio_scope_owner('all_write'))
      or (c.owner_id = (select public.studio_scope_owner('branch')) and c.branch_id = (select public.studio_my_branch()))
      or (c.owner_id = (select public.studio_scope_owner('assigned')) and c.assigned_to = (select auth.uid()))))
  ) with check (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and (
      (select public.is_admin())
      or c.owner_id = (select public.studio_scope_owner('all_write'))
      or (c.owner_id = (select public.studio_scope_owner('branch')) and c.branch_id = (select public.studio_my_branch()))
      or (c.owner_id = (select public.studio_scope_owner('assigned')) and c.assigned_to = (select auth.uid()))))
  );

-- contract_reschedules / contract_addenda: chỉ ĐỌC từ trình duyệt (ghi đi qua
-- route service role), nay theo phạm vi hợp đồng thay vì chỉ-chủ / cả-studio.
drop policy if exists contract_reschedules_owner_read on public.contract_reschedules;

drop policy if exists contract_reschedules_member_read on public.contract_reschedules;

create policy contract_reschedules_member_read on public.contract_reschedules
  for select using (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and (
      (select public.is_admin())
      or c.owner_id = (select public.studio_scope_owner('all_read'))
      or (c.owner_id = (select public.studio_scope_owner('branch')) and c.branch_id = (select public.studio_my_branch()))
      or (c.owner_id = (select public.studio_scope_owner('assigned'))
          and (c.assigned_to = (select auth.uid()) or c.id = any ((select public.studio_my_product_contracts())::uuid[])))))
  );

drop policy if exists contract_addenda_member_read on public.contract_addenda;

create policy contract_addenda_member_read on public.contract_addenda
  for select using (
    exists (select 1 from public.studio_contracts c where c.id = contract_id and (
      (select public.is_admin())
      or c.owner_id = (select public.studio_scope_owner('all_read'))
      or (c.owner_id = (select public.studio_scope_owner('branch')) and c.branch_id = (select public.studio_my_branch()))
      or (c.owner_id = (select public.studio_scope_owner('assigned'))
          and (c.assigned_to = (select auth.uid()) or c.id = any ((select public.studio_my_product_contracts())::uuid[])))))
  );

-- studio_crew (sổ thợ): mọi thành viên đọc được để chọn thợ cho hợp đồng; quản
-- lý chi nhánh chỉ thấy thợ của cơ sở mình + thợ chưa gán cơ sở (thợ tự do dùng
-- chung). Ghi: chủ, manager, và branch_manager với thợ của cơ sở mình — đúng
-- nhóm MANAGERS của trang Nhân sự.
drop policy if exists studio_crew_owner_all on public.studio_crew;

drop policy if exists studio_crew_member_read on public.studio_crew;

create policy studio_crew_member_read on public.studio_crew
  for select using (
    (select public.is_admin())
    or owner_id = (select public.studio_scope_owner('all_read'))
    or owner_id = (select public.studio_scope_owner('assigned'))
    or (owner_id = (select public.studio_scope_owner('branch'))
        and (branch_id = (select public.studio_my_branch()) or branch_id is null))
  );

drop policy if exists studio_crew_member_write on public.studio_crew;

create policy studio_crew_member_write on public.studio_crew
  for all using (
    (select public.is_admin())
    or owner_id = (select public.studio_scope_owner('all_write'))
    or (owner_id = (select public.studio_scope_owner('branch')) and branch_id = (select public.studio_my_branch()))
  ) with check (
    (select public.is_admin())
    or owner_id = (select public.studio_scope_owner('all_write'))
    or (owner_id = (select public.studio_scope_owner('branch')) and branch_id = (select public.studio_my_branch()))
  );

