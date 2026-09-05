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
-- Studio KHÔNG phải bấm gì: mở màn album là app tự quét nền rồi gom nhóm, khách
-- mở link là tìm được theo khuôn mặt ngay. Bảng này là thứ làm cho việc "tự
-- động" đó chịu được đời thực:
--
--  • ĐÓNG TAB GIỮA CHỪNG. Album 800 ảnh quét mất nhiều phút. Không lưu lại từng
--    bước thì mỗi lần mở lại là quét lại từ đầu, và sẽ không bao giờ xong.
--  • ĐỔI NGƯỠNG GOM. Gom lại chỉ là phép tính trên vector đã có — không phải
--    quét lại cả nghìn ảnh.
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

create index if not exists album_faces_album_idx on public.album_faces (album_id);


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

