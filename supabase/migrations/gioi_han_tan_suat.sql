-- ============================================================================
-- Giới hạn tần suất BỀN mà không cần Upstash — bộ đếm cửa sổ cố định nằm ngay
-- trong Postgres của Supabase.
--
-- Vì sao: các cửa dò "mật khẩu" ít chữ số (mật khẩu album, SĐT mở hợp đồng,
-- SĐT cô dâu / chú rể chọn ảnh in, ghép ảnh) cần một bộ đếm CHUNG cho mọi máy
-- chủ. Chưa cấu hình Upstash thì trước đây mỗi máy chủ serverless đếm riêng
-- trong bộ nhớ — kẻ dò chỉ cần gửi dồn để các lượt rơi vào nhiều máy chủ là
-- vượt giới hạn. Hàm dưới đây cho src/lib/rate-limit.ts một bộ đếm chung khi
-- thiếu Upstash (chỉ dùng cho các cửa nhạy cảm, nên rất ít lượt gọi).
--
-- Khoá là băm SHA-256 của "bucket:ip" (app băm trước khi gửi) — bảng không
-- chứa IP hay token thô. Chỉ service-role gọi được hàm; bật RLS, không policy.
-- Dòng cũ hơn 1 ngày tự được dọn dần ở ~2% lượt gọi, không cần cron.
--
-- Chạy trên Supabase SQL Editor. An toàn khi chạy lại (idempotent).
-- ============================================================================

create table if not exists public.rate_limit_hits (
  key          text primary key,
  window_start timestamptz not null default now(),
  hits         int not null default 0
);

create index if not exists rate_limit_hits_window_idx on public.rate_limit_hits (window_start);

alter table public.rate_limit_hits enable row level security;

revoke all on table public.rate_limit_hits from public, anon, authenticated;

-- Tăng bộ đếm của `p_key` và trả về số lượt trong cửa sổ hiện tại. Cửa sổ đã
-- hết hạn thì bắt đầu lại từ 1 — cùng ngữ nghĩa INCR + EXPIRE NX của Upstash.
-- Cả hai vế SET đọc giá trị CŨ của dòng nên luôn nhất quán; ON CONFLICT khoá
-- đúng một dòng nên các lượt gọi đồng thời không đếm sót.
create or replace function public.rate_limit_hit(p_key text, p_window_seconds int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hits int;
  v_win  interval := make_interval(secs => greatest(coalesce(p_window_seconds, 60), 1));
begin
  insert into public.rate_limit_hits as r (key, window_start, hits)
  values (p_key, now(), 1)
  on conflict (key) do update
    set hits         = case when r.window_start <= now() - v_win then 1 else r.hits + 1 end,
        window_start = case when r.window_start <= now() - v_win then now() else r.window_start end
  returning hits into v_hits;

  if random() < 0.02 then
    delete from public.rate_limit_hits where window_start < now() - interval '1 day';
  end if;

  return v_hits;
end;
$$;

revoke all on function public.rate_limit_hit(text, int) from public, anon, authenticated;

grant execute on function public.rate_limit_hit(text, int) to service_role;
