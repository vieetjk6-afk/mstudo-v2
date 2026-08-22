-- ============================================================================
-- Mốc "KHÁCH ĐÃ CHỌN XONG" cho album.
--
-- VÌ SAO
-- Khách bấm nút "Đã chọn xong" trên trang album thì studio nhận được chuông +
-- push + Zalo (xem src/app/api/a/[slug]/done/route.ts) — nhưng CHÍNH ALBUM thì
-- không ghi lại gì cả. Hệ quả: mở Thư viện album ra, không có cách nào phân
-- biệt "khách đang chọn dở" với "khách đã chốt, tới lượt mình lọc ảnh". Một
-- thông báo lướt qua rồi trôi mất là không đủ — thứ studio cần là NHÌN VÀO
-- THƯ VIỆN là thấy album nào đến lượt mình.
--
-- Cột này biến việc đó thành trạng thái bền: có mốc ⇒ album được đẩy lên đầu
-- thư viện và đeo nhãn "Khách đã chọn xong".
--
-- Vì sao là timestamptz chứ không phải boolean: còn dùng để xếp album nào chốt
-- trước lên trước, và để biết khách chốt lúc nào khi cần đối chiếu.
--
-- Khách bấm lại lần nữa (chọn thêm ảnh rồi chốt lại) thì mốc được CẬP NHẬT
-- sang lần mới nhất — đúng ý "album này vừa mới chốt", chứ không giữ lần đầu.
--
-- AN TOÀN KHI CHẠY LẠI: chỉ thêm cột, không sửa dữ liệu cũ. Album đã chốt từ
-- trước ngày chạy migration sẽ có mốc NULL (không có cách nào truy ngược) —
-- chúng nằm đúng chỗ cũ trong thư viện cho tới khi khách chốt lần sau.
-- ============================================================================

alter table albums add column if not exists selection_done_at timestamptz;

-- Thư viện lọc/sắp theo cột này cho từng chủ album.
create index if not exists albums_selection_done_idx
  on albums (owner_id, selection_done_at desc nulls last);

comment on column albums.selection_done_at is
  'Lần gần nhất khách bấm "Đã chọn xong" trên trang album. NULL = chưa chốt.';
