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

-- ── Ảnh nào có ai ───────────────────────────────────────────────────────────
create table if not exists public.album_photo_people (
  -- album_id là bản sao CÓ CHỦ Ý của album_people.album_id: câu truy vấn duy
  -- nhất mà khách chạy là "lấy hết theo album", không cần join.
  album_id  uuid not null references public.albums (id) on delete cascade,
  person_id uuid not null references public.album_people (id) on delete cascade,
  photo_id  uuid not null references public.photos (id) on delete cascade,
  primary key (person_id, photo_id)
);


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
create or replace function public.next_receipt_no(p_owner uuid, p_year integer)
returns integer
language sql
security definer
set search_path = public
as $$
  insert into public.studio_receipt_seq (owner_id, year, last_no)
  values (p_owner, p_year, 1)
  on conflict (owner_id, year)
  do update set last_no = public.studio_receipt_seq.last_no + 1
  returning last_no;
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
-- PHẦN 3 — PHÂN QUYỀN, RLS & POLICY (chạy sau khi mọi bảng/cột đã có)
-- ══════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/automations.sql — Việc tự động theo trạng thái hợp đồng (chạy SAU album_selection_done)
-- ══════════════════════════════════════════════════════════════════════════

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


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/crew_timesheet.sql — Chấm công thợ & khoảng rảnh (chạy SAU studio_appointments)
-- ══════════════════════════════════════════════════════════════════════════

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


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/vendors.sql — Nhà cung cấp & đơn đặt ngoài
-- ══════════════════════════════════════════════════════════════════════════

-- Xoá đơn thì dòng chi đi theo (on delete cascade ở trên) — tiền của một đơn
-- không còn tồn tại thì cũng không được nằm lại trong báo cáo.

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.studio_vendors enable row level security;

alter table public.vendor_orders  enable row level security;

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

alter table public.studio_receipt_seq enable row level security;

drop policy if exists studio_receipt_seq_owner_all on public.studio_receipt_seq;

create policy studio_receipt_seq_owner_all on public.studio_receipt_seq
  for all using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

revoke all on function public.next_receipt_no(uuid, integer) from public, anon;

grant execute on function public.next_receipt_no(uuid, integer) to authenticated;

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

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Chủ album (và admin) đọc/ghi. KHÔNG mở đọc công khai: trang khách
-- (src/app/a/[slug]/page.tsx) chạy trên máy chủ bằng service role, nên khách
-- không cần quyền gì trên bảng này.
alter table public.album_people enable row level security;

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

alter table public.album_photo_people enable row level security;

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

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Chủ album (và admin) đọc/ghi. Khách KHÔNG cần quyền gì: trang khách chỉ đọc
-- album_people/album_photo_people, và đọc bằng service role trên máy chủ.
alter table public.album_faces enable row level security;

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

alter table public.studio_bank_hooks enable row level security;

-- Chỉ chủ studio (và admin) đọc được khoá. Tạo và đổi khoá đi qua
-- /api/studio/bank-hook để khoá luôn do máy chủ sinh ngẫu nhiên, nên RLS chỉ
-- cho đọc.
drop policy if exists studio_bank_hooks_owner_read on public.studio_bank_hooks;

create policy studio_bank_hooks_owner_read on public.studio_bank_hooks
  for select using (owner_id = auth.uid() or public.is_admin());

alter table public.studio_bank_transactions enable row level security;

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

alter table public.contract_reschedules enable row level security;

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

-- Đọc: mọi thành viên studio. Ghi: CHỈ qua route máy chủ (service role) — không
-- cấp policy ghi nào cho authenticated.
alter table public.contract_addenda enable row level security;

drop policy if exists contract_addenda_member_read on public.contract_addenda;

create policy contract_addenda_member_read on public.contract_addenda
  for select using (public.is_studio_member(owner_id));


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/studio_vouchers.sql — Voucher / thẻ quà tặng của studio (chạy SAU contract_cancel_reschedule)
-- ══════════════════════════════════════════════════════════════════════════

alter table public.studio_vouchers enable row level security;

drop policy if exists studio_vouchers_member_read on public.studio_vouchers;

create policy studio_vouchers_member_read on public.studio_vouchers
  for select using (public.is_studio_member(owner_id));


-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/studio_audit_log.sql — Nhật ký thao tác tiền & hợp đồng
-- ══════════════════════════════════════════════════════════════════════════

alter table public.studio_audit_log enable row level security;

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

