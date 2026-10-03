-- ============================================================================
-- LINK TOÀN BỘ FILE GỐC + DẤU ĐÃ GỬI LINK TRANG RIÊNG CHO KHÁCH
--
-- • final_originals_url: link thư mục toàn bộ file gốc (Drive / Google Photos /
--   Fshare…) studio dán ở tab Sản phẩm của hợp đồng — khách tải ở mục "Tải về"
--   của trang riêng /portal/<token>.
-- • portal_link_sent_at: lần đầu hệ thống gửi link trang riêng cho khách khi
--   hợp đồng chuyển sang Hoàn thành — để đổi trạng thái qua lại không gửi lặp.
-- Chạy SAU contract_final_links.sql. Chạy 1 lần trong Supabase SQL Editor.
-- An toàn khi chạy lại.
-- ============================================================================

alter table public.studio_contracts
  add column if not exists final_originals_url text,
  add column if not exists portal_link_sent_at timestamptz;
