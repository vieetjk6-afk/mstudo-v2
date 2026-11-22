# Tổng hợp thay đổi — nhánh `claude/kind-mayer-imy5el` (11/2026)

16 commit, 81 file. Bộ kiểm thử `npm test`: 116 đạt · 0 hỏng (5 bài tự bỏ qua
vì thiếu môi trường). Chưa merge, chưa deploy.

Cột **Cách kiểm tra** là thao tác để tự xác nhận sau khi deploy. Đánh dấu
**(đã xem)** = đã bấm thử bằng trình duyệt với dữ liệu thật; **(mã)** = chỉ kiểm
qua kiểu dữ liệu + kiểm thử tự động.

---

## 1. Đăng nhập MStudo Desktop

| Sửa | Cách kiểm tra |
| --- | --- |
| Nút "Đăng nhập" ở trang xác nhận `/auth/desktop` luôn lỗi `desktop_bad_origin` (thẻ `no-referrer` làm trình duyệt gửi `Origin: null`). Đổi sang `strict-origin`. **(đã xem)** | App desktop → đăng nhập tự động → bấm "Đăng nhập" → vào được dashboard. |

## 2. Bản in (hợp đồng, phiếu thu, báo giá)

| Sửa / tối ưu | Cách kiểm tra |
| --- | --- |
| **Logo đã tải lên không hiện** (bộ in loại đường dẫn `/api/img…`) — nay hiện logo thật; bản in app desktop dùng link tuyệt đối. **(đã xem với logo mẫu)** | Studio có logo → hợp đồng → Xuất PDF → góc trái có logo, không còn ô chữ cái. |
| Chân mỗi trang: "Hợp đồng HD-…" + "Trang x/y". **(đã xem)** | Xuất PDF hợp đồng 2 trang → xem chân trang. |
| Điều khoản tách theo từng điều, không cắt ngang giữa trang. **(đã xem)** | Điều khoản dài → tiêu đề điều không nằm lẻ cuối trang. |
| Quốc hiệu, đoạn căn cứ BLDS 2015, dòng "Ngày … tháng … năm …" ngay trên chỗ ký. **(đã xem)** | Xem đầu và cuối bản in. |
| Dưới chữ ký điện tử: "Ký điện tử lúc HH:mm dd/mm/yyyy". **(đã xem)** | Hợp đồng khách đã ký → Xuất PDF. |
| Bỏ nhãn trạng thái trên giấy; bản nháp có chữ chìm "BẢN NHÁP". **(mã)** | In hợp đồng nháp. |
| Ngày chụp kèm âm lịch; QR nhỏ hơn có chú thích; hình thức thu ghi "Tiền mặt" thay vì "cash". **(đã xem)** | Bảng "Các khoản đã thanh toán". |
| Phiếu thu dùng nhãn riêng: "Số phiếu", "Đơn vị thu tiền / Người nộp tiền", "Nội dung thu". **(mã)** | Tab Thanh toán → in phiếu thu. |
| Bản in trên trang khách (`/c/…`) có đủ thông tin như bản studio: cô dâu/chú rể, tên ngày, ghi chú ngày, hạn giao, ngày lập, hình thức thu. **(mã)** | Mở link khách → "Tải PDF / In". |
| **Báo giá in lại hoàn toàn** trên cùng khung: đầu trang studio, cột đơn giá, gói đã chọn tách khỏi "Tuỳ chọn thêm (chưa tính vào tổng)", bằng chữ, tài khoản + QR, hiệu lực, chỗ ký. **(đã xem)** | Báo giá → ⋯ → Xuất PDF. |

## 3. Báo giá

| Sửa / tối ưu | Cách kiểm tra |
| --- | --- |
| Nhiều gói "chọn 1" bị tick sẵn hết → tổng cộng dồn. Nay chỉ tick gói đầu; báo giá cũ tự chuẩn hoá. **(mã + kiểm thử)** | Tạo báo giá 2 nhóm gói → trang khách chỉ tick 1 gói, tổng đúng. |
| Danh sách báo giá: hết "Chưa có ngày", "Không giới hạn"; báo giá quá hạn không tính "đang chờ"; giá trị trừ ưu đãi gói. **(đã xem)** | Danh sách Báo giá. |
| Trình sửa: "Tổng hạng mục"/"Giảm giá" chỉ cộng dòng đang tính tiền. **(mã)** | Bỏ tick 1 tuỳ chọn → tổng hạng mục giảm theo. |
| Cọc theo % studio cài (màn tạo, trình sửa, trang khách, hợp đồng sinh ra). **(đã xem màn tạo)** | Đặt % cọc 30% → tạo báo giá → cọc ~30%. |
| "Tạo & gửi khách" mở luôn hộp gửi (trước giống "Lưu nháp"). **(mã)** | Tạo báo giá bằng nút này. |
| "Tạo hợp đồng ngay" trong menu ⋯ khi khách đồng ý qua điện thoại; còn thay đổi chưa lưu thì nhắc lưu. **(mã)** | Báo giá "Đã gửi" → ⋯ → Tạo hợp đồng ngay. |
| Khách mở link báo giá còn nháp → tính là đã gửi/đã xem + đặt hạn (chủ studio xem thử thì không tính). **(mã)** | Mở `/q/…` ở trình duyệt ẩn danh. |
| Không ra 2 hợp đồng khi khách và studio cùng bấm chuyển. **(mã)** | — |
| Tên mặc định "Báo giá [dịch vụ] — [khách] · [ngày chụp]" (bỏ ngày hôm nay). **(mã)** | Để trống tên khi tạo. |
| Ô "Nhóm gói" gợi ý tên đọc được + danh sách gói đã có. **(mã)** | Thêm nhóm gói cho hạng mục. |
| "Hạng mục thêm" chỉ hiện ≤ 6 mục cùng bảng giá + ô tìm + "Xem tất cả". **(mã)** | Màn tạo báo giá. |
| **"Báo giá từ yêu cầu"** trên yêu cầu đặt lịch: điền sẵn khách, SĐT, Facebook, ngày, gói; lưu xong yêu cầu thành "đã xử lý". **(đã xem)** | Đặt lịch khách → ⋯ → Báo giá từ yêu cầu. |
| `/banggia`, `/gia/…`: tab hiện tên dịch vụ thay vì UUID. **(mã)** | Mở bảng giá công khai. |

## 4. Hợp đồng

| Sửa / tối ưu | Cách kiểm tra |
| --- | --- |
| Hợp đồng nháp sinh từ báo giá: khách **chưa ký được**; trang khách ghi "Studio đang hoàn thiện". Bấm "Đánh dấu đã gửi" là mở ký. Hợp đồng nháp tự tạo vẫn ký như cũ. **(mã)** | Khách đồng ý báo giá → mở link hợp đồng → không có nút ký. |
| Hộp "Gửi hợp đồng": nút "Đánh dấu đã gửi" nổi bật cho bản nháp. **(mã)** | Hợp đồng nháp → Gửi khách. |
| Hợp đồng "đã gửi" chưa ký không tự chuyển "Đang thực hiện" tới ngày chụp. **(mã)** | — (chạy theo cron hằng ngày). |
| Trang khách: ghi thu cọc không còn hiện "Đã ký" khi khách chưa ký ("Đã chốt lịch"). **(mã)** | Ghi thu cọc cho HĐ chưa ký → mở link khách. |
| "Tạo giống HĐ này": có mã mới, giữ dịch vụ, nhãn/giờ ngày, cô dâu chú rể, kế hoạch thanh toán. **(mã)** | Nhân bản một hợp đồng. |
| Trang khách đếm đúng số điều khoản; điền sẵn họ tên người ký; "Bạn đã ký lúc 02:35 22/11/2026". **(mã)** | Trang khách. |
| **Việc cần làm** thêm: "Đã ký nhưng chưa nhận cọc" (Ghi thu), "Chưa gửi link chọn ảnh", "Đã giao và thu đủ → Hoàn thành". **(mã)** | Thẻ Việc cần làm ở tab Thông tin. |
| Thanh tiến độ: Ký → **Nhận cọc** → Phân công. **(đã xem)** | Đầu màn hợp đồng. |
| Hoàn thành khi khách còn nợ → hỏi lại. **(mã)** | Đổi trạng thái sang Hoàn thành. |
| Kế hoạch thu: đợt cọc mặc định có hạn (hôm nay + 3, không muộn hơn ngày trước buổi chụp); đặt ngày chụp thì đợt đầu còn trống hạn tự nhận hạn. **(mã + kiểm thử)** | Tạo hợp đồng → bước thanh toán. |
| Báo giá → hợp đồng: kế hoạch đủ 2 đợt (cọc có hạn + còn lại). Đặt lịch có cọc đã xác nhận → hợp đồng có sẵn lần thu cọc + kế hoạch. **(mã)** | — |
| Đặt lịch → hợp đồng dùng điều khoản + dịch vụ của gói khách chọn. **(mã)** | — |
| Gắn album đang thuộc hợp đồng khác → hỏi rồi gỡ khỏi HĐ cũ. **(mã)** | Tab Album → chọn album của HĐ khác. |
| Tìm hợp đồng theo địa điểm. **(mã)** | Gõ "tràng an". |

## 5. Khách hàng & trang khách

| Sửa | Cách kiểm tra |
| --- | --- |
| Gộp khách theo SĐT chuẩn hoá (`0901…`, `+84901…` là một khách); tên lấy theo hợp đồng mới nhất. **(mã)** | Danh bạ khách. |
| Hồ sơ khách: chặn kế toán, nhân viên chỉ thấy HĐ được giao, lọc chi nhánh; tổng bỏ HĐ huỷ. **(mã)** | Đăng nhập vai trò kế toán → mở URL hồ sơ khách. |
| "Hợp đồng mới" từ hồ sơ / ô xem nhanh khách điền sẵn tên + SĐT. **(mã)** | Khách hàng → chọn khách → Hợp đồng mới. |
| ⌘K tìm không dấu ("hanh" ra "Hạnh"). **(mã)** | Ô tìm ⌘K. |
| Trang theo dõi `/portal/…`: ngày chụp trên hợp đồng hiện thành "Buổi chụp". **(mã)** | Trang theo dõi của khách. |
| Điều khoản mẫu không còn ghi cứng "cọc 30%". **(mã)** | Tạo hợp đồng không chọn dịch vụ. |

## 6. Album

| Sửa / tối ưu | Cách kiểm tra |
| --- | --- |
| Thêm nguồn / link giao khách chỉ nhận link Google Drive; link sai báo rõ cách sửa. **(mã + kiểm thử)** | Dán `https://example.com` vào ô nguồn ảnh. |
| Trang khách không còn nút "Tải ảnh gốc" trỏ link hỏng; tên "Folder/File" → "Thư mục ảnh". **(mã + kiểm thử)** | — |
| Lỗi đồng bộ Drive thành câu dễ hiểu, hiện 8–9 giây. **(mã)** | Thêm link thư mục chưa chia sẻ. |
| Tab "Khách chọn": "Lựa chọn của khách" thay vì "Mã SHARED". **(mã)** | — |
| Album chọn ảnh tạo tay mặc định không cho khách tải (album giao vẫn cho). **(mã)** | Tạo album chọn ảnh. |
| Khung xem ảnh của khách: "Không thích" không tự nhảy ảnh; thông báo lên đầu màn. **(mã)** | Trang chọn ảnh → mở ảnh → Không thích → Ghi chú. |
| Tên album cắt khoảng trắng; menu "Tải ảnh gốc" đóng bằng Esc. **(mã)** | — |

## 7. Giao diện chung & tốc độ

| Sửa / tối ưu | Cách kiểm tra |
| --- | --- |
| Bé thú cưng chế độ gọn ở màn chi tiết và trên điện thoại: nhỏ hơn, ẩn ô "Ra lệnh", không tự nói, lánh đi khi cuộn. "Ra lệnh" mở từ bảng của bé. **(mã — chưa xem được)** | Điện thoại → mở hợp đồng → bé không che nút. |
| Tổng quan · Cần xử lý ngay: thêm "N yêu cầu đặt lịch mới", "Hợp đồng còn là bản nháp" (> 2 ngày). **(đã xem)** | Tổng quan. |
| Tổng quan bớt tải trước ~11 trang mỗi lần mở. **(mã)** | — |
| Thanh tab điện thoại: Tổng quan · Hợp đồng · Lịch · Album · Khách. **(mã)** | Điện thoại, chưa ghim mục nào. |

---

## Chưa xem được bằng mắt

Trang khách `/c/…`, `/portal/…`, `/a/…` và bé thú cưng cần khoá quản trị nên
không chạy được ở môi trường kiểm tra — nên bấm thử các mục **(mã)** ở mục 4–7
sau khi deploy.

## Dữ liệu thử trên tài khoản `test`

HĐ-11-2026-002, -003, -004 · BG-11-2026-001, -002 · album "TEST Album Lan &
Minh" · yêu cầu đặt lịch "TEST WF Lan Anh". Xoá được nếu không cần.

Việc còn lại và đề xuất tính năng: `docs/kiem-tra-tong-the-11-2026.md`.
