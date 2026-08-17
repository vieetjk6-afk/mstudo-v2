-- ============================================================================
-- Đóng dấu chìm chuyển thành TỰ CHỌN (opt-in) thay vì mặc định bật.
--
-- VÌ SAO
-- Cột `albums.watermark_enabled` trước đây `default true`, nên MỌI album chọn
-- ảnh đều bật watermark kể cả khi studio không hề chạm vào cài đặt đó. Hệ quả
-- về băng thông rất lớn:
--
--   Có watermark   khách bấm tải → ảnh 2560px phải chảy qua máy chủ (canvas /
--                  nay là /api/img/watermark cần đọc được pixel, mà Google
--                  Drive không gửi header CORS nên không chuyển hướng được).
--   Không watermark khách bấm tải → 302 thẳng sang Google Drive.
--                  Máy chủ tốn ĐÚNG 0 byte.
--
-- Đo trên Vercel: Fast Origin Transfer 11,54 GB / 10 GB, gần như toàn bộ dồn
-- vào 4 ngày có người tải album hàng loạt (một ngày 4,42 GB đi ra).
--
-- Cột `watermark_delivery` (gallery giao hàng) vốn đã `default false` — đúng
-- rồi, không đụng tới.
--
-- TÌNH TRẠNG: đã chạy trên production ngày 17/08/2026 — cả phần đổi mặc định
-- lẫn phần tắt cho album cũ (92 album selection đều về false). File giữ lại để
-- bản cài mới và môi trường thử có cùng trạng thái.
--
-- Chạy trên Supabase SQL Editor. An toàn khi chạy lại (idempotent).
-- ============================================================================

-- 1. Album mới từ nay mặc định KHÔNG đóng dấu. Studio muốn thì tự bật trong
--    phần cài đặt album.
alter table public.albums alter column watermark_enabled set default false;


-- ============================================================================
-- 2. (TUỲ CHỌN — ĐỌC KỸ TRƯỚC KHI CHẠY) Tắt watermark cho album ĐANG CÓ.
--
-- Phần trên chỉ đổi mặc định cho album TẠO MỚI. Các album đã tạo vẫn giữ
-- watermark_enabled = true, nên vẫn tiếp tục tốn băng thông.
--
-- Vấn đề: không phân biệt được chắc chắn "studio cố ý bật" với "nó tự bật do
-- mặc định cũ". Cách phỏng đoán hợp lý nhất là nhìn `watermark_text`:
--   • watermark_text IS NULL  → studio chưa từng gõ chữ riêng, gần như chắc
--                               chắn chưa bao giờ mở cài đặt này ra
--   • watermark_text có giá trị → studio đã chủ động cấu hình, ĐỪNG tắt
--
-- Xem trước sẽ ảnh hưởng bao nhiêu album:
--
--     select count(*) filter (where watermark_text is null)  as se_tat,
--            count(*) filter (where watermark_text is not null) as giu_nguyen
--     from public.albums
--     where watermark_enabled = true and phase = 'selection';
--
-- Thấy số hợp lý rồi thì bỏ dấu chú thích ở khối dưới và chạy:
--
-- update public.albums
--    set watermark_enabled = false
--  where watermark_enabled = true
--    and phase = 'selection'
--    and watermark_text is null;
--
-- Muốn tắt sạch không chừa album nào (kể cả studio đã cấu hình) thì bỏ dòng
-- `and watermark_text is null`. Cân nhắc: làm vậy là gỡ lớp bảo vệ ảnh mà một
-- số studio thật sự cần — nên báo cho họ trước.
--
-- Đảo ngược lúc nào cũng được: studio tự bật lại trong cài đặt album, hoặc
--     update public.albums set watermark_enabled = true where id = '<id>';
-- ============================================================================


-- ============================================================================
-- 3. Gallery giao hàng (`watermark_delivery`) — 17/08/2026
--
-- Cột này vốn đã `default false`, nhưng vẫn phải rà: gallery giao hàng là nơi
-- khách tải ảnh NHIỀU NHẤT (download_enabled bật mặc định), nên một album bật
-- đóng dấu ở đây tốn băng thông hơn hẳn một album chọn ảnh.
--
-- Đo được lúc rà: 47 album delivery tắt đóng dấu, 1 album bật.
-- Chủ dự án quyết định tắt nốt album đó.
-- ============================================================================
update public.albums
   set watermark_delivery = false
 where phase = 'delivery'
   and watermark_delivery = true;

-- Kiểm tra lại — cả hai cột phải sạch:
--
--     select phase, watermark_enabled, watermark_delivery, count(*)
--     from public.albums
--     group by 1, 2, 3
--     order by 1, 2, 3;
--
-- Từ giờ mọi lượt khách bấm tải đều 302 thẳng sang Google Drive → máy chủ tốn
-- 0 byte. Studio nào cần đóng dấu thì tự bật lại trong cài đặt album.


-- ============================================================================
-- GHI CHÚ: schema `old_public`
--
-- Lúc rà phát hiện có HAI bảng tên `albums`: `public.albums` (đang dùng) và
-- `old_public.albums` (bản sao lưu còn sót từ lần chuyển sang bản 2.0, xem
-- supabase/clone-from-old-project.sql). App chỉ đọc `public` nên vô hại.
--
-- Lưu ý khi viết truy vấn kiểm tra: lọc theo `table_schema`, nếu không
-- information_schema sẽ trả về cả hai và dễ đọc nhầm kết quả.
--
-- Khi chắc chắn không cần bản cũ nữa:  drop schema old_public cascade;
-- ============================================================================
