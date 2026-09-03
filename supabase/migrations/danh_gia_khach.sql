-- ============================================================================
-- ĐÁNH GIÁ KHÁCH — studio xem, duyệt và TRẢ LỜI được
--
-- Bảng `feedback` đã có sẵn từ schema.sql: khách gửi cảm nhận ở cuối trang album
-- giao khách, website studio đọc ra để khoe. Thiếu ba thứ khiến nó gần như vô
-- dụng với chủ studio:
--
--   1. Không có chỗ nào trong khu quản lý để XEM — dữ liệu nằm im trong bảng.
--   2. `approved` mặc định `true`, nên một đánh giá 1 sao lên thẳng trang chủ
--      trước khi studio kịp biết. Đổi mặc định thành `false`: từ nay đánh giá
--      phải được duyệt mới hiện. Hàng CŨ giữ nguyên trạng thái đang có —
--      `alter column … set default` chỉ áp cho bản ghi mới, không đụng dữ liệu
--      đã lên website (nếu ép hết về chờ duyệt thì mọi studio đang chạy sẽ mất
--      sạch đánh giá trên trang chủ trong một đêm).
--   3. Không trả lời được. Một lời cảm ơn dưới đánh giá là thứ khách hàng sau
--      đọc nhiều nhất, nên `reply` hiện CÔNG KHAI cùng đánh giá.
--
-- Không thêm `owner_id`: policy sẵn có đã nối qua `albums` để xác định chủ, và
-- màn quản lý đọc bằng inner-join đúng đường đó. Thêm cột trùng nghĩa chỉ tạo
-- thêm một nguồn sự thật nữa phải giữ đồng bộ.
--
-- Chạy 1 lần trong Supabase SQL Editor.
-- ============================================================================

-- ── Kiểm tra điều kiện trước ────────────────────────────────────────────────
-- Migration chỉ VÁ bảng đã có. Thiếu bảng nền thì Postgres chỉ nói
-- `42P01: relation "..." does not exist` — đúng, nhưng không nói phải làm gì.
-- Khối này nói thẳng. (Chạy qua setup-all.sql thì khối `do $$` rơi vào PHẦN 2,
-- tức là SAU khi PHẦN 1 đã tạo hết bảng, nên nó luôn qua.)
do $$
declare thieu text[] := '{}';
begin
  if to_regclass('public.feedback') is null then thieu := thieu || 'feedback'::text; end if;
  if array_length(thieu, 1) > 0 then
    raise exception E'Thiếu bảng: %.\n\nProject chưa có schema nền của bản 2.0 nên migration không vá vào đâu được.\nChạy MỘT file duy nhất: supabase/setup-all.sql — nó gồm cả schema nền lẫn chính migration này,\nvà mọi câu lệnh đều "if not exists" nên không xoá gì của project đang chạy.\n\nMuốn biết project đang thiếu những gì: chạy supabase/kiem-tra-truoc-khi-chay-migration.sql',
      array_to_string(thieu, ', ');
  end if;
end $$;

alter table public.feedback
  add column if not exists reply        text,
  add column if not exists replied_at   timestamptz,
  -- Dấu vết studio ĐÃ QUYẾT về hàng này (bấm duyệt hoặc bấm ẩn). Cần một cột
  -- RIÊNG chứ không dùng ké `replied_at`: "chờ duyệt" và "đã ẩn" trong DB đều
  -- là approved=false, mà studio hoàn toàn có thể trả lời một đánh giá xấu rồi
  -- vẫn chưa quyết cho hiện hay không — dùng ké thì hàng đó tự nhảy sang "đã
  -- ẩn" chỉ vì được trả lời.
  add column if not exists moderated_at timestamptz;

-- Hàng CŨ: đang hiện trên website nghĩa là studio (theo mặc định trước đây) đã
-- để nó hiện — đánh dấu đã quyết luôn, để chúng không đổ hết vào tab "Chờ
-- duyệt" ngay lần đầu studio mở màn hình.
update public.feedback set moderated_at = coalesce(moderated_at, created_at) where approved;

-- Từ nay: đánh giá mới phải được studio duyệt mới lên website.
alter table public.feedback alter column approved set default false;

-- Màn quản lý lọc theo trạng thái duyệt và xếp mới nhất trước; trang album đọc
-- theo album. Khoá ngoại KHÔNG tự tạo chỉ mục trong Postgres nên phải khai tay.
create index if not exists feedback_album_idx on public.feedback (album_id, created_at desc);
create index if not exists feedback_approved_idx on public.feedback (approved, created_at desc);
create index if not exists feedback_moderation_idx on public.feedback (approved, moderated_at);

-- Policy giữ nguyên như schema.sql: công khai đọc bản đã duyệt, chủ album (và
-- admin) toàn quyền. `reply` đi theo hàng nên tự hiện công khai cùng đánh giá —
-- đúng ý: lời studio trả lời là để khách sau đọc.
