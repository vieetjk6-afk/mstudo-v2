-- ══════════════════════════════════════════════════════════════════════════
-- mstudo — GIỚI HẠN TẦN SUẤT BỀN — CHỐNG DÒ MẬT KHẨU ALBUM / SĐT KHÔNG CẦN UPSTASH
--
-- File này do supabase/build-setup-all.mjs sinh ra — ĐỪNG sửa tay.
--
-- Cách dùng: Supabase → SQL Editor → dán TOÀN BỘ file này → Run.
-- Mọi câu lệnh đều idempotent nên chạy lại nhiều lần vô hại.
--
-- Chỉ gồm migration của riêng việc này: bảng rate_limit_hits và hàm
-- rate_limit_hit (chỉ service-role gọi). Không phụ thuộc bảng nào khác.
-- Đã cấu hình Upstash thì không cần chạy — chạy cũng vô hại.
-- ══════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════
-- PHẦN 1 — TẠO BẢNG
-- ══════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/gioi_han_tan_suat.sql — Giới hạn tần suất bền không cần Upstash: bộ đếm chống dò mật khẩu album / SĐT trong Postgres
-- ══════════════════════════════════════════════════════════════════════════

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

alter table public.rate_limit_hits enable row level security;


-- ══════════════════════════════════════════════════════════════════════════
-- PHẦN 2 — CỘT BỔ SUNG, CHỈ MỤC, HÀM, TRIGGER, DỮ LIỆU MẶC ĐỊNH
-- ══════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/gioi_han_tan_suat.sql — Giới hạn tần suất bền không cần Upstash: bộ đếm chống dò mật khẩu album / SĐT trong Postgres
-- ══════════════════════════════════════════════════════════════════════════

create index if not exists rate_limit_hits_window_idx on public.rate_limit_hits (window_start);

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


-- ══════════════════════════════════════════════════════════════════════════
-- PHẦN 3 — PHÂN QUYỀN, RLS & POLICY (chạy sau khi mọi bảng/cột đã có)
-- ══════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════
-- ▶ migrations/gioi_han_tan_suat.sql — Giới hạn tần suất bền không cần Upstash: bộ đếm chống dò mật khẩu album / SĐT trong Postgres
-- ══════════════════════════════════════════════════════════════════════════

revoke all on table public.rate_limit_hits from public, anon, authenticated;

revoke all on function public.rate_limit_hit(text, int) from public, anon, authenticated;

grant execute on function public.rate_limit_hit(text, int) to service_role;


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

