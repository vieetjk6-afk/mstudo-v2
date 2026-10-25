# Giao diện mới (thử nghiệm)

Làm mới giao diện khu quản lý studio theo từng phần. Giao diện mới **chỉ đổi
lớp hiển thị**: dữ liệu, route, server action và phân quyền dùng chung với bản
cũ, nên người dùng chuyển qua lại không mất gì.

## Ai được dùng

Cờ `ui_v2` trong `site_settings.feature_flags`, chỉnh ở **Cấu hình mstudo →
Tính năng → Giao diện mới (thử nghiệm)**:

| Giá trị | Ý nghĩa |
|---|---|
| *(trống)* | Chỉ admin dùng thử. Mặc định. |
| `beta` | Mọi studio thấy thẻ gợi ý "Thử giao diện mới" và tự bật. |
| `default` | Mọi studio vào giao diện mới, vẫn quay về bản cũ được. |

Lựa chọn của từng người nằm trong cookie `mstudo_ui` (`v2` / `v1`). Layout đọc
cookie ở server nên vẽ đúng khung ngay lần đầu. Cookie chỉ là mong muốn: không
đủ quyền theo cờ thì cookie `v2` bị bỏ qua. Luật nằm ở `src/lib/ui-version.ts`,
test ở `npm run test:ui-version`.

Bật/tắt:

- **Khung cũ**: thẻ gợi ý ở góc màn hình ("Để sau" ẩn 3 ngày) và mục
  "Dùng giao diện mới" trong menu tài khoản.
- **Khung mới**: menu tài khoản → "Về giao diện cũ".

## Màu chủ đạo

Mặc định xanh dương `#0b5cc4`. Người dùng chọn 1 trong 8 màu ở menu tài khoản,
lưu trong cookie `mstudo_accent`. Cookie chỉ nhận **khoá** trong `ACCENTS`, không
nhận mã màu tuỳ ý.

## Cấu trúc

- `src/components/v2/StudioShellV2.tsx`: khung mới gồm menu trái (ghim 6 màn
  hằng ngày, các nhóm còn lại thu gọn), topbar (tìm Ctrl+K, nút "Tạo mới",
  chuông, menu tài khoản) và ngăn kéo menu trên điện thoại.
- `src/components/v2/MobileTabBarV2.tsx`: thanh 5 tab dưới đáy và nút + nổi.
- `src/app/globals.css`, khối `.studio-shell.ui-v2`: bộ màu mới, chỉ ghi đè
  token. Vì vậy mọi màn cũ chạy trong khung mới tự đổi màu theo.
- Màn nào chưa làm lại thì vẫn hiện nội dung cũ trong khung mới.

Xem trước ở bản dev: `/uipreview/khung-moi-thu-chi`,
`/uipreview/khung-moi-hop-dong`, `/uipreview/khung-cu-goi-y`. Mở bằng
`http://localhost:3333`, không mở bằng `127.0.0.1`: Next 16 chặn tài nguyên
dev từ origin lạ nên trang sẽ không chạy được JavaScript.

## Lộ trình

0. ✅ Nền móng: công tắc, cờ, bộ màu, màu cá nhân, bộ khối V2 (`src/components/v2/kit*.tsx`).
1. ✅ Khung: menu trái, topbar, thanh tab điện thoại.
2. ✅ Mọi màn trong khu quản lý đều có bản V2: Tổng quan, Hợp đồng (danh sách,
   chi tiết, tạo mới), Báo giá (danh sách, tạo, sửa), Lịch, Album (thư viện, chi
   tiết, lựa chọn khách, tạo, loại album), Công cụ ảnh (lọc ảnh, nén, watermark),
   Thu chi, Tiền công, Khách hàng, Yêu cầu mới, Đặt lịch, Đánh giá, Sản xuất, Bảng
   công việc, Phòng váy, Thiết bị, Nhà cung cấp, Thiệp, Love Story, Slide, Thiết
   kế album, Nhân sự, Chi nhánh, Thẻ buổi, Dịch vụ & điều khoản, Bảng giá, Mẫu tin
   nhắn, Chatbox, Voucher, Nhật ký, Thông báo, Website, Hộp thư, Kết nối kênh, Đồng
   bộ Drive, Ứng dụng máy tính, Google Lịch, Tài khoản, Gói phần mềm, Thanh toán,
   Affiliate, Quản trị, Cấu hình.
   Mỗi màn: logic ở hook dùng chung (`use*.ts`), bản cũ giữ nguyên giao diện, bản
   mới ở file `*V2.tsx` cạnh bản cũ. Xem trước: `/uipreview` các màn `v2-*`.
3. Thiết lập ban đầu 5 bước cho studio mới và popup cập nhật cho studio cũ.
4. Mở cho người dùng: `beta` → `default` → gỡ khung cũ và công tắc.

Còn giữ kiểu cũ bên trong khung mới (dùng chung với nơi khác, chưa vẽ lại): ô
tên miền riêng, bảng chỉnh khối của trình dựng website, vài thẻ phụ trong chi
tiết hợp đồng (phụ lục, thuê đồ, voucher), trang `buoi-chup/` của hợp đồng.

Hoa hồng theo bộ phận (Bán hàng / Sản xuất) là tính năng mới cần dữ liệu mới,
làm riêng sau.
