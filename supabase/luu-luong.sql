-- ══════════════════════════════════════════════════════════════════════════
-- mstudo — LƯU LƯỢNG THEO NGÀY — CẢNH BÁO TRƯỚC KHI CHẠM HẠN MỨC GÓI FREE
--
-- File này do supabase/build-setup-all.mjs sinh ra — ĐỪNG sửa tay.
--
-- Cách dùng: Supabase → SQL Editor → dán TOÀN BỘ file này → Run.
-- Mọi câu lệnh đều idempotent nên chạy lại nhiều lần vô hại.
--
-- Chỉ gồm migration của riêng việc này: bảng system_usage và hàm usage_add
-- (chỉ service-role gọi). Không phụ thuộc bảng nào khác. Chạy lại an toàn.
-- ══════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════
-- PHẦN 1 — TẠO BẢNG
-- ══════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/luu_luong.sql — Lưu lượng theo ngày: ước tính egress Supabase do app tự đếm + số liệu Vercel (workflow Đo lưu lượng), chỉ service-role
-- ══════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- LƯU LƯỢNG THEO NGÀY — để trang "Sức khoẻ hệ thống" cảnh báo TRƯỚC khi chạm
-- hạn mức gói Free (dự án từng bị Supabase khoá vì vượt 5 GB egress/tháng).
--
--   source = 'supabase-may-chu'    byte app (máy chủ) đọc từ Supabase — tự đếm
--   source = 'supabase-trinh-duyet' byte trình duyệt đọc thẳng từ Supabase — tự đếm
--   source = 'vercel'              số liệu Vercel (API chi phí FOCUS), workflow
--                                  GitHub "Đo lưu lượng" ghi mỗi ngày
--
-- Supabase KHÔNG có API công khai trả số egress, nên hai dòng supabase-* là
-- ƯỚC TÍNH do chính app đếm (không gồm ảnh / file tải thẳng từ Storage).
-- Chỉ service-role đọc ghi (RLS bật, không policy). Chạy lại an toàn.
-- ============================================================================

create table if not exists public.system_usage (
  day        date not null,
  source     text not null,
  metric     text not null,
  quantity   double precision not null default 0,
  unit       text,
  cost       double precision,
  requests   bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (day, source, metric)
);

alter table public.system_usage enable row level security;


-- ══════════════════════════════════════════════════════════════════════════
-- PHẦN 2 — CỘT BỔ SUNG, CHỈ MỤC, HÀM, TRIGGER, DỮ LIỆU MẶC ĐỊNH
-- ══════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/luu_luong.sql — Lưu lượng theo ngày: ước tính egress Supabase do app tự đếm + số liệu Vercel (workflow Đo lưu lượng), chỉ service-role
-- ══════════════════════════════════════════════════════════════════════════

-- Cộng dồn byte + số lượt (bộ đếm của app gọi mỗi khi xả). Chặn số âm / quá lớn
-- (một lượt xả không thể hơn 10 GB) để dòng bẩn không làm hỏng cả tháng.
create or replace function public.usage_add(
  p_day date, p_source text, p_metric text, p_bytes bigint, p_requests bigint
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_bytes is null or p_bytes < 0 or p_bytes > 10737418240 then return; end if;
  if p_requests is null or p_requests < 0 or p_requests > 10000000 then return; end if;
  if p_source not in ('supabase-may-chu', 'supabase-trinh-duyet') then return; end if;
  insert into public.system_usage (day, source, metric, quantity, unit, requests)
  values (p_day, p_source, coalesce(p_metric, 'egress'), p_bytes, 'byte', p_requests)
  on conflict (day, source, metric) do update
    set quantity = public.system_usage.quantity + excluded.quantity,
        requests = public.system_usage.requests + excluded.requests,
        updated_at = now();
  -- Giữ ~4 tháng: dọn thưa (khoảng 1% lượt gọi) cho rẻ.
  if random() < 0.01 then
    delete from public.system_usage where day < (current_date - 120);
  end if;
end;
$$;


-- ══════════════════════════════════════════════════════════════════════════
-- PHẦN 3 — PHÂN QUYỀN, RLS & POLICY (chạy sau khi mọi bảng/cột đã có)
-- ══════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/luu_luong.sql — Lưu lượng theo ngày: ước tính egress Supabase do app tự đếm + số liệu Vercel (workflow Đo lưu lượng), chỉ service-role
-- ══════════════════════════════════════════════════════════════════════════

revoke all on public.system_usage from anon, authenticated;

revoke all on function public.usage_add(date, text, text, bigint, bigint) from public, anon, authenticated;

grant execute on function public.usage_add(date, text, text, bigint, bigint) to service_role;


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

