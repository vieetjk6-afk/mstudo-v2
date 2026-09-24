-- ══════════════════════════════════════════════════════════════════════════
-- mstudo — TỰ XÁC NHẬN CHUYỂN KHOẢN QUA SEPAY
--
-- File này do supabase/build-setup-all.mjs sinh ra — ĐỪNG sửa tay.
--
-- Cách dùng: Supabase → SQL Editor → dán TOÀN BỘ file này → Run.
-- Mọi câu lệnh đều idempotent nên chạy lại nhiều lần vô hại.
--
-- Chỉ gồm migration của riêng tính năng này. Nó chỉ cần các bảng hợp đồng,
-- đợt thanh toán và yêu cầu đặt lịch (có từ schema nền). Tách riêng để
-- hàng rào của tính năng khác không kéo nó rollback theo.
-- ══════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════
-- PHẦN 1 — TẠO BẢNG
-- ══════════════════════════════════════════════════════════════════════════

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
-- PHẦN 2 — CỘT BỔ SUNG, CHỈ MỤC, HÀM, TRIGGER, DỮ LIỆU MẶC ĐỊNH
-- ══════════════════════════════════════════════════════════════════════════

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

notify pgrst, 'reload schema';


-- ══════════════════════════════════════════════════════════════════════════
-- PHẦN 3 — PHÂN QUYỀN, RLS & POLICY (chạy sau khi mọi bảng/cột đã có)
-- ══════════════════════════════════════════════════════════════════════════

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

