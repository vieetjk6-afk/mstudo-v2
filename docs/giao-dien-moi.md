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
- **Khung mới**: menu tài khoản → "Về giao diện cũ". Bấm vào sẽ hỏi nhanh điều gì
  chưa ổn (chọn lý do hoặc gõ, không bắt buộc) rồi mới chuyển.

Trang gửi khách (hợp đồng, báo giá, album, cổng khách…) không có công tắc riêng:
chúng theo studio sở hữu trang, chỉ vẽ bản mới khi cờ là `default` hoặc studio
của tài khoản admin (`customerUiV2` trong `src/lib/ui-server.ts`). Ở mức `beta`,
studio dùng thử chỉ đổi khu quản lý, khách của họ vẫn thấy bản cũ.

## Góp ý của studio dùng thử

Menu tài khoản của khung mới có mục "Góp ý giao diện mới"; lúc bấm "Về giao diện
cũ" cũng hỏi lý do. Góp ý gửi qua `POST /api/studio/ui-feedback` (cần đăng nhập,
5 lượt / 10 phút mỗi người), ghi vào bảng `feedbacks` (Cấu hình mstudo → "Góp ý &
liên hệ", mở đầu bằng `[Giao diện mới]`) và gửi thông báo kèm nội dung cho mọi
admin. Mỗi góp ý ghi kèm trang đang mở và loại máy (điện thoại / máy tính).

## Menu trái: mục hay dùng

Phần "Hay dùng" trên cùng do studio tự chọn: rê chuột vào một mục rồi bấm biểu
tượng ghim, hoặc bấm "Tùy chỉnh" để ghim, bỏ ghim và đổi thứ tự (tối đa 10 mục).
Mọi mục còn lại nằm trong các nhóm thu gọn bên dưới. Thanh tab dưới đáy trên
điện thoại lấy 5 mục ghim đầu tiên.

Lưu theo từng máy trong cookie `mstudo_nav_pins` (`src/lib/nav-pins.ts`), đọc ở
layout nên menu vẽ đúng ngay lần đầu. Cookie chỉ nhận đường dẫn có thật trong
menu. Test: `npm run test:nav-pins`.

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
4. Mở cho người dùng: `beta` (đang ở bước này: mọi studio thấy gợi ý dùng thử,
   gửi góp ý được) → `default` → gỡ khung cũ và công tắc.

   Các khối dùng chung cũng đã có bản V2: ô tên miền riêng, thẻ cài đặt (xuất kế
   toán, việc tự động, chuyển khoản tự xác nhận, chính sách studio), ⌘K, chọn chi
   nhánh, lọc ảnh AI, chèn điều khoản, tải logo, nút gửi Zalo/Messenger/Email, thông
   báo nhỏ (toast); các thẻ phụ trong chi tiết hợp đồng (phụ lục, thuê đồ, voucher,
   lịch hẹn, album, thiệp, love story, kế hoạch cưới) và trang `buoi-chup/`.
   Trang khách (hợp đồng, báo giá, album, cổng khách, kế hoạch cưới, đặt lịch, form,
   voucher, bảng giá, cổng nhân viên và thợ) và trình sửa thiệp / love story của
   khách cũng theo bộ màu mới, bật theo studio sở hữu trang (`customerUiV2`).

Còn giữ kiểu cũ bên trong khung mới (ít gặp, chưa vẽ lại): bảng chỉnh khối của
trình dựng website, nút cài ứng dụng (`InstallPwaButton`) cho gói chưa có bản máy
tính.

Hoa hồng theo bộ phận (Bán hàng / Sản xuất) là tính năng mới cần dữ liệu mới,
làm riêng sau.
