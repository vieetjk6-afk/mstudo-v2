-- ══════════════════════════════════════════════════════════════════════════
-- mstudo — VOUCHER / THẺ QUÀ + VOUCHER ƯU ĐÃI LẦN SAU
--
-- File này do supabase/build-setup-all.mjs sinh ra — ĐỪNG sửa tay.
--
-- Cách dùng: Supabase → SQL Editor → dán TOÀN BỘ file này → Run.
-- Mọi câu lệnh đều idempotent nên chạy lại nhiều lần vô hại.
--
-- Gồm bảng voucher gốc (an toàn khi đã chạy) và phần voucher ưu đãi: giảm
-- theo tiền / %, gắn với hợp đồng đã ký, link QR để khách đặt lịch kèm mã.
-- Chỉ cần các bảng hợp đồng / lần thu / yêu cầu đặt lịch có từ schema nền.
-- ══════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════
-- PHẦN 1 — TẠO BẢNG
-- ══════════════════════════════════════════════════════════════════════════

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
-- PHẦN 2 — CỘT BỔ SUNG, CHỈ MỤC, HÀM, TRIGGER, DỮ LIỆU MẶC ĐỊNH
-- ══════════════════════════════════════════════════════════════════════════

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
-- PHẦN 3 — PHÂN QUYỀN, RLS & POLICY (chạy sau khi mọi bảng/cột đã có)
-- ══════════════════════════════════════════════════════════════════════════

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
-- KIỂM TRA — bảng kết quả dưới đây là BẰNG CHỨNG đã chạy đúng chỗ.
-- Cột `co` phải là `t` (true) hết. Có `f` nào nghĩa là chưa xong.
-- ══════════════════════════════════════════════════════════════════════════
select 'album_people'   as thu, to_regclass('public.album_people')   is not null as co
union all
select 'album_photo_people', to_regclass('public.album_photo_people') is not null
union all
select 'album_faces', to_regclass('public.album_faces') is not null
union all
select 'photos.faces_scanned_at', exists (
  select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'photos' and column_name = 'faces_scanned_at')
union all
select 'albums.faces_clustered_at', exists (
  select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'albums' and column_name = 'faces_clustered_at');

