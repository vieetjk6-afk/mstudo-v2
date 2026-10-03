-- ============================================================================
-- LINK ALBUM & VIDEO HOÀN THIỆN TRÊN HỢP ĐỒNG
--
-- Studio dán link album hoàn thiện (Drive / Google Photos / album mstudo…) và
-- link video (YouTube / Drive / Vimeo — mỗi dòng một link, có thể "Tên | link")
-- ngay ở tab Sản phẩm của hợp đồng. Cổng khách /portal/<token> hiện chúng ra.
-- Chưa chạy file này thì mọi thứ khác vẫn chạy, chỉ là chưa lưu được 2 ô này.
-- Chạy 1 lần trong Supabase SQL Editor. An toàn khi chạy lại.
-- ============================================================================

alter table public.studio_contracts
  add column if not exists final_album_url  text,
  add column if not exists final_video_urls text;
