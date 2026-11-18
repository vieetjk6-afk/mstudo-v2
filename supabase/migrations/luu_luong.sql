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
revoke all on public.system_usage from anon, authenticated;

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
revoke all on function public.usage_add(date, text, text, bigint, bigint) from public, anon, authenticated;
grant execute on function public.usage_add(date, text, text, bigint, bigint) to service_role;
