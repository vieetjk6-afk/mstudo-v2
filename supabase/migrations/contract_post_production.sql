-- ─────────────────────────────────────────────────────────────────────────
-- Hợp đồng: thêm trạng thái 'post_production' ("Đang hậu kỳ")
--
-- Chen vào giữa 'in_progress' và 'completed'. Vòng đời sau bản này:
--
--   draft → sent → approved → in_progress → post_production → completed
--                                    │                            ▲
--                                    └──── cancelled ─────────────┘
--
-- Ai chuyển: autoAdvanceToPostProduction() trong src/lib/contract-status.ts,
-- chạy trong cron hằng ngày (/api/cron/reminders) và mỗi lần studio mở danh
-- sách hợp đồng. Điều kiện: đã QUA ngày chụp CUỐI CÙNG — max(event_date, mọi
-- mốc studio_events). Lấy ngày muộn nhất chứ không phải sớm nhất, vì đám cưới
-- thường nhiều buổi; lấy sớm nhất thì hợp đồng nhảy sang hậu kỳ trong khi vẫn
-- còn buổi chưa chụp.
--
-- KHÔNG đổi dữ liệu cũ: hợp đồng đang 'in_progress' mà đã qua ngày chụp sẽ tự
-- sang 'post_production' ở lần cron chạy kế tiếp, không cần UPDATE ở đây.
--
-- Chạy được nhiều lần.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.studio_contracts
  drop constraint if exists studio_contracts_status_check;

alter table public.studio_contracts
  add constraint studio_contracts_status_check
  check (status in ('draft', 'sent', 'approved', 'in_progress',
                    'post_production', 'completed', 'cancelled'));
