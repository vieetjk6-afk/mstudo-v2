# Kiểm tra tổng thể — 11/2026

Lượt kiểm tra trên mstudo.com bằng tài khoản thử (gói Studio), máy tính +
iPhone 13, 44 trang dashboard + trang khách. Cả 88 lượt mở trang không có lỗi
JS, không có request 4xx/5xx, không trang nào tràn ngang.

Đã sửa trên nhánh `claude/kind-mayer-imy5el` (xem từng commit). Dưới đây là
phần **chưa làm**, xếp theo ưu tiên.

## Còn lại — nên làm sớm

Lượt 2 đã xử lý gần hết bảng cũ (nhóm gói, "Tạo & gửi khách", tạo hợp đồng
trước khi khách đồng ý, báo giá nháp, điều khoản theo dịch vụ, bản in khách,
tải ảnh mặc định, "Không thích", tab điện thoại, tìm theo địa điểm) và các điểm
từ lượt chạy thử trọn quy trình (ký hợp đồng nháp từ báo giá, tự chuyển hợp
đồng chưa ký, việc chờ trên Tổng quan, kế hoạch thu có hạn, báo giá từ yêu cầu
đặt lịch, thứ tự tiến độ, hoàn thành khi còn nợ). Còn lại:

| Việc | Vì sao | Chỗ |
| --- | --- | --- |
| Nguồn khách mất trên đường đặt lịch → báo giá → hợp đồng | `studio_quotes` chưa có cột `source`/`booking_id` — cần migration | `quote-convert.ts`, `useNewQuoteForm.ts` |
| Ngày chụp trên form báo giá nằm cuối, không kiểm tra trùng lịch; khách không đề xuất ngày trên `/q` | Hợp đồng sinh ra hay thiếu ngày | `NewQuoteFormV2.tsx`, `q/[token]` |
| Thêm yêu cầu đặt lịch bằng tay (khách gọi điện / nhắn) | Hiện chỉ có link form | `bookings/BookingsV2.tsx` |
| "Khách đã duyệt" (studio) tự đặt khi ghi thu cọc | Dễ hiểu nhầm là khách đã ký | `CONTRACT_STATUS_LABEL.approved` |
| Ghi rõ cạnh trạng thái khi nào tự chuyển ("Tự chuyển sang Đang chụp ngày …") | Studio không biết bước nào tự động | `contract-status.ts`, đầu màn hợp đồng |
| Gộp hai bộ dựng dữ liệu bản in (studio / khách) thành một hàm trong `src/lib` | Nay đã cùng thông số nhưng vẫn là hai chỗ phải sửa song song | `useContractEditor.buildPrintData`, `ContractPrintDoc.tsx` |

## Tính năng đề xuất

**Hợp đồng & pháp lý**
- Trường địa chỉ + CCCD của khách; địa chỉ, MST, người đại diện của studio —
  in vào phần hai bên (cần migration `client_address`, `client_id_no`,
  `pl_address`, `pl_tax_code`, `pl_representative`).
- Biến trong điều khoản: `{ten_khach}`, `{ngay_chup}`, `{tien_coc}`,
  `{phan_tram_coc}` — điều khoản luôn khớp kế hoạch thanh toán.
- Biên bản nghiệm thu/bàn giao và thanh lý hợp đồng, in từ hợp đồng.
- Trang chứng nhận ký điện tử cuối PDF (thời điểm, SĐT xác thực, IP, mã băm).
- Xuất Word (.docx) ngay trên web; phiếu thu khổ A5 / 2 liên.
- Hạn mặc định cho các đợt thanh toán (cọc = ngày tạo + 3, đợt cuối = ngày
  giao) + nhắc tự động.

**Báo giá**
- Nhân bản báo giá, mẫu báo giá theo gói.
- VAT (đã gồm / cộng x%), giảm giá theo %.
- Báo cho studio khi khách mở báo giá; tự nhắc trước khi hết hạn.
- So sánh gói A/B/C cạnh nhau trên trang khách; nút "Tải PDF" cho khách.
- Đặt lịch → báo giá.

**Album**
- Kiểm tra link Drive ngay khi dán (hiện tên thư mục + số ảnh trước khi thêm).
- Tải ảnh lên trực tiếp (không cần Drive).
- Khách để lại lời nhắn khi chốt; màn xác nhận tóm tắt trước khi gửi.
- Mở lại cho khách chọn thêm, lịch sử các lượt chọn; hạn chọn ảnh + nhắc.
- Xuất danh sách ảnh đã chọn cho Lightroom (.txt/.csv).

**Khách hàng**
- Gộp khách trùng (một khách nhiều SĐT), hồ sơ khách không cần hợp đồng (ghi
  chú, ngày sinh, ngày cưới, nhãn).
- Dòng thời gian trong hồ sơ khách: báo giá, album, đánh giá, thanh toán.
- Xuất danh bạ.
