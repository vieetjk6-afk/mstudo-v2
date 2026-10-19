-- ============================================================================
-- ẢNH IN TẶNG CHO ALBUM LẺ (không thuộc hợp đồng nào).
--
-- albums.print_quota: số ảnh in tặng nhập ngay trong album (tab Giao khách).
-- Album của hợp đồng vẫn lấy số ở hợp đồng (studio_contracts.print_quota) —
-- máy chủ lấy số LỚN HƠN của hai nơi (src/lib/album-print.ts).
-- Chạy SAU anh_in_tang.sql. Chạy trên Supabase SQL Editor. An toàn khi chạy lại.
-- ============================================================================

alter table public.albums
  add column if not exists print_quota integer;
