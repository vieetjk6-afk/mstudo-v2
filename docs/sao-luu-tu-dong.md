# Sao lưu toàn hệ thống tự động

Mỗi đêm (~03h15 giờ VN) cron `/api/cron/backup` xuất **toàn bộ dữ liệu ứng dụng**
của mọi studio → nén `.json.gz` → đưa lên thư mục **riêng tư**
`mstudo · Sao lưu hệ thống` trên Google Drive của admin, giữ 14 bản gần nhất.

## Bật (làm một lần)

1. Vercel đã có `CRON_SECRET` và bộ biến Google OAuth của mục "Lưu trữ Drive"
   (`NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
   `GOOGLE_ADMIN_DRIVE_REDIRECT_URI`).
2. Vào **Quản trị hệ thống → Lưu trữ Drive → Kết nối Google Drive**. Đã kết nối
   rồi thì bỏ qua.
3. Deploy bản có `vercel.json` mới (thêm cron `/api/cron/backup`).
4. Bấm **Sao lưu ngay** ở mục Sao lưu để thử một lượt. Thấy dòng bản sao lưu đầu
   tiên trong bảng là xong.

**Muốn file tự về máy admin:** cài *Google Drive cho máy tính* (Drive for
desktop) trên máy admin, đăng nhập đúng tài khoản Google đã kết nối ở bước 2.
Thư mục `mstudo · Sao lưu hệ thống` tự đồng bộ về ổ máy mỗi ngày, máy không cần
bật lúc cron chạy.

## Tuỳ chỉnh (biến môi trường, không bắt buộc)

| Biến | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `SYSTEM_BACKUP_KEEP` | 14 | Giữ bao nhiêu bản gần nhất trên Drive (tối đa 90) |
| `SYSTEM_BACKUP_EVERY_DAYS` | 1 | Bao nhiêu ngày sao lưu một lần |

Mỗi bản đọc **toàn bộ database** qua API, tính vào **egress của Supabase**
(gói Free: 5 GB/tháng, dự án từng bị khoá vì vượt mức này). Xem dung lượng mỗi
bản trong bảng ở trang Quản trị: bản nén khoảng 3 MB thì 30 bản/tháng tốn chừng
vài trăm MB egress (byte đọc ra chưa nén, lớn hơn file nén nhiều lần). Database
lớn lên thì đặt `SYSTEM_BACKUP_EVERY_DAYS=2` hoặc `3`.

## Khi có sự cố

- Sao lưu hỏng (Drive bị ngắt, token hết hạn, bảng đọc lỗi) → admin nhận thông
  báo ở chuông và web push.
- Bản mới nhất cũ hơn 2 chu kỳ → trang Quản trị hiện nhãn vàng "Bản mới nhất đã cũ".

## Có gì và không có gì trong bản sao lưu

**Có:** mọi bảng dữ liệu trong `supabase/setup-all.sql`, gồm hợp đồng, khách,
báo giá, thu chi, album, lịch hẹn, voucher, chi nhánh, chấm công, sao kê, kế
hoạch cưới, hộp thư… Danh sách nằm ở `src/lib/admin/backup-tables.ts`.
`npm run test:system-backup` báo đỏ khi có bảng mới chưa được xếp vào danh sách.

**Không có** (cố ý):

- Mật khẩu đăng nhập (bảng `auth.users` của Supabase).
- Ảnh gốc: ảnh nằm trên Google Drive của studio.
- Token và khoá bí mật: refresh token Drive, phiên Zalo, khoá webhook SePay, API
  key AI. Lộ file sao lưu thì không lộ theo quyền vào Drive hay Zalo của studio.
  Sau khi khôi phục một bản ghi bị xoá hẳn, studio kết nối lại những mục đó.
- Dữ liệu dựng lại được: vector khuôn mặt (quét lại được), bảng đếm ảnh, thiết bị
  nhận push, nháp ghép ảnh 1 ngày.

## Khôi phục

**Quản trị hệ thống → Khôi phục → Chọn file.** Chọn được file `.json.gz` tải từ
Drive hoặc bằng nút "Tải về máy", và cả file `.json` bản cũ.

- Bước chọn file chỉ đọc thử và hiện số dòng từng bảng.
- Bấm **Khôi phục toàn bộ** để ghi. Dữ liệu được gửi lên từng lô nhỏ, theo thứ
  tự bảng cha rồi tới bảng con.
- Bản ghi trùng khoá được cập nhật, bản ghi thiếu được tạo lại. Dữ liệu nằm ngoài
  file không bị xoá.

Bản sao lưu này để **cứu dữ liệu bị xoá nhầm** trong cùng project Supabase. Muốn
dựng lại cả project từ đầu (kể cả tài khoản đăng nhập) thì cần backup của chính
Supabase (gói Pro có sẵn hằng ngày) hoặc `pg_dump`.
