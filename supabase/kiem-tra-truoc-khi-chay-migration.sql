-- ============================================================================
-- CHẠY CÁI NÀY TRƯỚC khi chạy bất kỳ file nào trong supabase/migrations/.
--
-- Migration chỉ VÁ (alter/add column) những bảng đã có. Project thiếu bảng nền
-- thì Postgres báo `42P01: relation "..." does not exist` — một câu không nói
-- cho bạn biết phải làm gì tiếp.
--
-- Query này trả về đúng một bảng: mỗi dòng là một bảng nền, cột `tinh_trang`
-- nói CÓ hay THIẾU. Đọc xong là biết nên chạy `setup-all.sql` hay chạy lẻ từng
-- migration.
--
-- Chỉ ĐỌC, không sửa gì.
-- ============================================================================

select
  t.ten_bang,
  case when to_regclass('public.' || t.ten_bang) is null then '❌ THIẾU' else '✅ có' end as tinh_trang,
  t.thuoc_ve
from (values
  -- Nền của bản 2.0 (schema.sql)
  ('profiles',          'nền — mọi thứ phụ thuộc'),
  ('albums',            'album & giao ảnh'),
  ('feedback',          'đánh giá khách  → danh_gia_khach.sql cần bảng này'),
  ('studio_contracts',  'hợp đồng        → nguon_khach.sql cần bảng này'),
  ('studio_bookings',   'đặt lịch khách  → nguon_khach.sql cần bảng này'),
  ('website_leads',     'lead chatbox    → nguon_khach.sql cần bảng này'),
  ('inbox_conversations', 'hộp thư hợp nhất — phễu đếm bậc "khách hỏi" ở đây')
) as t(ten_bang, thuoc_ve)
order by (to_regclass('public.' || t.ten_bang) is null) desc, t.ten_bang;

-- ── Đọc kết quả ─────────────────────────────────────────────────────────────
--
-- • THIẾU nhiều bảng (kể cả studio_contracts / studio_bookings)
--   → project này chưa lên bản 2.0. ĐỪNG chạy lẻ từng migration.
--     Chạy MỘT file duy nhất: supabase/setup-all.sql — nó gồm cả schema nền lẫn
--     toàn bộ migration (đã bao gồm danh_gia_khach.sql và nguon_khach.sql), và
--     mọi câu lệnh đều `if not exists` nên chạy trên project đã có dữ liệu cũng
--     không xoá gì.
--
-- • CÓ đủ cả 7 bảng
--   → chạy lẻ hai file mới là được:
--       supabase/migrations/danh_gia_khach.sql
--       supabase/migrations/nguon_khach.sql
--
-- • CÓ feedback nhưng THIẾU studio_* (hay gặp nhất)
--   → đây là project của bản CŨ (album + feedback), chưa có khu quản lý studio.
--     danh_gia_khach.sql chạy được, nguon_khach.sql thì chưa.
--     Chạy setup-all.sql để lên đủ bản 2.0.
