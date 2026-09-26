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
