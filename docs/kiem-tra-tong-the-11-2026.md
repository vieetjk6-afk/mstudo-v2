# Kiểm tra tổng thể — 11/2026

Lượt kiểm tra trên mstudo.com bằng tài khoản thử (gói Studio), máy tính +
iPhone 13, 44 trang dashboard + trang khách. Cả 88 lượt mở trang không có lỗi
JS, không có request 4xx/5xx, không trang nào tràn ngang.

Đã sửa trên nhánh `claude/kind-mayer-imy5el` (xem từng commit). Dưới đây là
phần **chưa làm**, xếp theo ưu tiên.

## Còn lại — nên làm sớm

| Việc | Vì sao | Chỗ |
| --- | --- | --- |
| Tên nhóm gói báo giá là slug ("goi-a"), khách thấy nguyên slug, kể cả dòng "Ưu đãi gói goi-b" trên hợp đồng | Studio phải tự gõ slug; khách đọc khó hiểu | `quotes/new` (ô "Nhóm gói"), `quote-lines.ts` |
| Màn tạo báo giá lặp lại toàn bộ bảng giá ở "Hạng mục thêm" (trang ~3000px) | Thao tác chậm | `quotes/new/NewQuoteFormV2.tsx` |
| "Tạo & gửi khách" (báo giá) không gửi gì — giống "Lưu nháp" | Gây hiểu nhầm | `useNewQuoteForm.ts` |
| Nút "Tạo hợp đồng" chỉ hiện khi báo giá "Đã đồng ý" | Khách đồng ý qua điện thoại thì phải đổi trạng thái tay trước | `QuoteEditorV2.tsx` |
| Khách đồng ý được báo giá còn "Nháp" | Có thể tạo hợp đồng từ báo giá chưa duyệt | `api/quote/[token]/route.ts:101` |
| Hợp đồng từ đặt lịch / báo giá dùng điều khoản mẫu chung, không theo dịch vụ | Lệch với hợp đồng tạo tay | `useBookings.ts`, `quote-convert.ts` |
| Bản in phía studio và phía khách dựng từ hai bộ dữ liệu riêng | Bản khách thiếu cô dâu/chú rể, nhãn ngày, hạn giao | gộp `useContractEditor.buildPrintData` + `ContractPrintDoc` thành 1 hàm trong `src/lib` |
| "Khách đã duyệt" tự đặt khi ghi thu cọc | Nhãn studio dễ hiểu nhầm là khách đã ký (cổng khách đã sửa thành "Đã chốt lịch") | `CONTRACT_STATUS_LABEL.approved` |
| Album: "Cho phép khách tải ảnh" mặc định bật cả ở giai đoạn chọn ảnh | Khách tải được ảnh thô trước khi thanh toán | `albums/new`, `download_enabled` |
| Album: "Không thích" tự nhảy ảnh kế, ghi chú dễ gắn nhầm ảnh | Sai dữ liệu chọn ảnh | `a/[slug]/CustomerAlbumV2.tsx` |
| Điện thoại: tab đáy thứ 2 của chủ studio là "Của tôi" | Đẩy Khách hàng/Báo giá vào menu | `MobileTabBarV2.tsx:18-28` |
| Tìm hợp đồng theo địa điểm ("tràng an") không ra | | `lib/contract-filter.ts` |

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
