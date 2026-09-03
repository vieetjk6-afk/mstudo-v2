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
  add column if not exists landing_path text;   -- trang khách đang đứng lúc gửi

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
