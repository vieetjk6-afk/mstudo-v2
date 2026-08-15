-- ============================================================================
-- KHÁCH GIỚI THIỆU KHÁCH + ĐẶT CỌC GIỮ NGÀY
--
-- 1) Giới thiệu: đã có affiliate cho studio giới thiệu STUDIO, nhưng không có gì
--    cho KHÁCH giới thiệu KHÁCH — kênh mạnh nhất của studio ảnh cưới ở VN.
--    Nhận diện người giới thiệu bằng SĐT chứ không bằng mã sinh sẵn: khách cũ
--    nào cũng dùng được ngay, không phải phát mã cho từng người.
--
-- 2) Đặt cọc giữ ngày: khách đặt lịch xong studio mới liên hệ, mà mùa cưới khách
--    hỏi 3–4 studio cùng lúc. Cho chuyển cọc ngay lúc đặt thì ngày mới thật sự
--    được giữ.
--
-- Chạy 1 lần trong Supabase SQL Editor. Chạy SAU lifecycle_followup.sql.
-- ============================================================================

-- ── 1) Chính sách của studio ───────────────────────────────────────────────
-- Thưởng cho NGƯỜI GIỚI THIỆU khi khách mới chốt hợp đồng (VND). 0 = tắt.
alter table public.profiles
  add column if not exists referral_reward integer not null default 0;

-- Ưu đãi cho KHÁCH MỚI được giới thiệu (VND) — hiện ngay trên form đặt lịch để
-- khách có lý do nhập SĐT người giới thiệu. 0 = không có ưu đãi.
alter table public.profiles
  add column if not exists referral_discount integer not null default 0;

-- Cọc giữ ngày (VND). 0 = tắt, form đặt lịch không hiện bước chuyển cọc.
alter table public.profiles
  add column if not exists booking_deposit integer not null default 0;

-- c1_profiles_column_grants.sql đã THU HỒI quyền UPDATE toàn bảng profiles và
-- chỉ cấp lại theo cột. Không có dòng này thì thẻ chính sách lưu sẽ im lặng
-- không đổi được gì. Ba cột này đều là số tiền cấu hình, không nhạy cảm.
grant update (referral_reward, referral_discount, booking_deposit)
  on public.profiles to authenticated;

-- ── 2) Cọc giữ ngày trên yêu cầu đặt lịch ──────────────────────────────────
-- Số tiền cọc CHỐT LẠI lúc khách đặt. Lưu riêng chứ không đọc lại
-- profiles.booking_deposit khi hiển thị: studio đổi chính sách sau đó không
-- được phép làm đổi số tiền của một yêu cầu đã gửi đi.
alter table public.studio_bookings add column if not exists deposit_amount integer;

-- none     — studio tắt cọc, hoặc khách chọn không cọc
-- awaiting — đã hiện QR, đang chờ khách chuyển
-- paid     — khách báo đã chuyển (kèm ảnh), CHỜ studio xác nhận
-- confirmed— studio đã đối chiếu và xác nhận nhận được tiền
alter table public.studio_bookings add column if not exists deposit_status text not null default 'none'
  check (deposit_status in ('none', 'awaiting', 'paid', 'confirmed'));

alter table public.studio_bookings add column if not exists deposit_proof_url text;
alter table public.studio_bookings add column if not exists deposit_paid_at timestamptz;

-- Mã nội dung chuyển khoản (vd "COC-7F3A"). Ngắn, không dấu, dễ đọc trên sao kê
-- ngân hàng — đây là thứ studio dùng để đối chiếu.
alter table public.studio_bookings add column if not exists deposit_code text;

-- Token riêng để khách quay lại trang cọc mà không phải đặt lịch lại. KHÔNG
-- dùng id: id lộ ra là đoán được các bản ghi khác.
alter table public.studio_bookings add column if not exists deposit_token text unique;
create index if not exists studio_bookings_deposit_token_idx
  on public.studio_bookings (deposit_token) where deposit_token is not null;

-- SĐT người giới thiệu, lưu ngay trên yêu cầu đặt lịch để studio thấy nguồn
-- khách kể cả khi chưa tạo bản ghi giới thiệu.
alter table public.studio_bookings add column if not exists referrer_phone text;

-- ── 3) Sổ giới thiệu ───────────────────────────────────────────────────────
create table if not exists public.studio_referrals (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references public.profiles (id) on delete cascade,
  -- Người giới thiệu: khách CŨ của chính studio này. Lưu cả tên đã biết lúc đó
  -- để sổ vẫn đọc được nếu sau này hợp đồng cũ bị xoá.
  referrer_phone  text not null default '',
  referrer_name   text,
  -- Khách mới.
  referred_phone  text not null default '',
  referred_name   text,
  booking_id      uuid references public.studio_bookings (id) on delete set null,
  -- Hợp đồng chốt được từ lời giới thiệu này (nếu có). Chốt hợp đồng mới là mốc
  -- đáng thưởng, chứ không phải chỉ gửi yêu cầu đặt lịch.
  contract_id     uuid references public.studio_contracts (id) on delete set null,
  reward_amount   integer not null default 0,
  -- pending   — chờ khách mới chốt hợp đồng
  -- earned    — đã chốt, tới lúc tặng thưởng
  -- granted   — studio đã tặng xong
  -- cancelled — không thành (khách huỷ, trùng khách cũ…)
  status          text not null default 'pending'
                    check (status in ('pending', 'earned', 'granted', 'cancelled')),
  note            text,
  created_at      timestamptz not null default now(),
  granted_at      timestamptz
);
create index if not exists studio_referrals_owner_idx
  on public.studio_referrals (owner_id, status, created_at desc);
-- Một yêu cầu đặt lịch chỉ sinh ĐÚNG MỘT bản ghi giới thiệu, kể cả khi API bị
-- gọi lặp (khách bấm gửi hai lần, mạng lỗi rồi thử lại).
create unique index if not exists studio_referrals_booking_uniq
  on public.studio_referrals (booking_id) where booking_id is not null;

alter table public.studio_referrals enable row level security;
drop policy if exists studio_referrals_owner_all on public.studio_referrals;
create policy studio_referrals_owner_all on public.studio_referrals
  for all using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());
