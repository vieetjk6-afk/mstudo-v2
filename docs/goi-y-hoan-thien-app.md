# Gợi ý hoàn thiện app quản lý studio

File này **không phải hướng dẫn cài đặt**. Nó là danh sách những chỗ mstudo đang
còn thiếu để trở thành một app quản lý studio *đủ vòng*, xếp theo thứ tự nên làm
trước. Mỗi mục ghi rõ: hiện app có gì, thiếu gì, và làm thì phải chạm vào đâu.

Cơ sở đối chiếu: 29 mục sidebar trong [`src/lib/studio-nav.ts`](../src/lib/studio-nav.ts)
và 75 bảng nghiệp vụ trong [`supabase/schema.sql`](../supabase/schema.sql) + các migration.
Những gì app **đã có** thì không nhắc lại ở đây.

---

## 0. Bảng tra 1 phút

| # | Tính năng | Vì sao cần | Công sức | Đã có nền tảng gì |
|---|---|---|---|---|
| 1 | **Thu đánh giá khách sau giao ảnh** | Bảng `feedback` đã có nhưng studio không có màn nào để xem/duyệt | Nhỏ | `feedback`, `/api/feedback`, website đã hiện review |
| 2 | **Nguồn khách & phễu chuyển đổi** | Không biết tiền quảng cáo ra hợp đồng hay không | Nhỏ | `website_leads`, `studio_bookings`, `studio_contracts` |
| 3 | **Nhắc kỷ niệm & chụp lại** | Khách cưới là khách quay lại có giá trị cao nhất, hiện không ai nhắc | Nhỏ | `studio_contracts.shoot_date`, `message_templates`, push |
| 4 | **Việc tự động theo trạng thái** | Mọi nhắc nhở hiện là thủ công | Trung bình | `contract_tasks`, `studio_notifications`, cron Vercel |
| 5 | **Chấm công & lịch rảnh của thợ** | Có lịch phân công, chưa có "ai thực sự đi làm" | Trung bình | `crew_shift_plan`, `crew_unavailable`, `studio_crew` |
| 6 | **Nhà cung cấp & đơn in ấn** | Album in / makeup / xe hoa đang nằm ngoài hệ thống | Trung bình | `studio_expenses`, `contract_products` |
| 7 | **Hoá đơn & xuất kế toán** | Studio có doanh thu thật cần chứng từ | Trung bình | `contract_payments`, `studio_expenses`, `src/lib/xlsx.ts` |
| 8 | **Thời tiết & đường đi cho buổi chụp ngoại** | Huỷ/đổi lịch vì mưa là rủi ro lớn nhất của studio | Nhỏ | `studio_contracts` (địa điểm), `LocationPicker` |
| 9 | **Lọc ảnh bằng AI (chọn nét, gom theo mặt)** | Việc tốn nhiều giờ nhất của hậu kỳ | Lớn | `FilterTool`, `photos`, `selections` |
| 10 | **Ứng dụng khách (PWA) cho phần chọn ảnh** | Khách chọn ảnh chủ yếu trên điện thoại | Trung bình | `manifest.ts`, service worker, `PhotoZoom` |

---

## 1. Thu đánh giá khách sau khi giao ảnh

**Hiện có.** Bảng `feedback (album_id, client_name, rating, content, approved)`
đã tồn tại, `POST /api/feedback` đã nhận, và [`site-loader.ts`](../src/lib/site-loader.ts)
đã đọc ra để hiện trên website studio.

**Thiếu.** Không có màn nào trong `/dashboard/studio` để studio *xem, duyệt, trả
lời* đánh giá; và không có gì tự nhắc khách đánh giá. Nghĩa là bảng có dữ liệu
mà chủ studio không biết, còn website thì hiện tất cả vì `approved` mặc định
`true` — một đánh giá 1 sao lên thẳng trang chủ.

**Làm.**
- Thêm mục sidebar `Đánh giá khách` trong nhóm *Kinh doanh*, dùng lại `Panel` /
  `PanelHead` / `Pill` của [`components/studio/ui.tsx`](../src/components/studio/ui.tsx).
- Đổi `approved` mặc định thành `false` + nút duyệt/ẩn từng đánh giá.
- Khi album chuyển sang giai đoạn *đã giao*, gửi link đánh giá qua Zalo bằng
  `message_templates` (giống cách `shootReminderMessage` đang làm).
- Điểm trung bình 30 ngày lên `StatCard` ở màn Tổng quan.

---

## 2. Nguồn khách & phễu chuyển đổi

**Hiện có.** `website_leads` ghi khách từ website/chatbox, `studio_bookings` ghi
yêu cầu đặt lịch, `studio_contracts` ghi hợp đồng. Ba bảng rời nhau.

**Thiếu.** Không có cột *nguồn* (Facebook, TikTok, Google, giới thiệu, khách cũ)
và không có gì nối `lead → booking → hợp đồng`. Studio đang chạy quảng cáo mà
không biết mỗi kênh ra bao nhiêu hợp đồng và giá mỗi hợp đồng là bao nhiêu.

**Làm.**
- Thêm `source` + `utm_*` vào `website_leads` và `studio_bookings`; đọc từ query
  string của website studio (SiteRenderer đã là điểm vào duy nhất).
- Thêm `source_lead_id` vào `studio_contracts` để nối chuỗi.
- Màn *Thu chi & công nợ* thêm một khối phễu: số lead → số đặt lịch → số hợp
  đồng → doanh thu, tách theo nguồn. `RevenueChart` đã có sẵn hình khối cột.

---

## 3. Nhắc kỷ niệm & chụp lại

**Thiếu hẳn.** Studio cưới có một mỏ vàng bỏ không: cặp đôi chụp năm nay là
khách *kỷ niệm 1 năm*, *có em bé*, *sinh nhật* của năm sau. Hiện không có gì
nhắc.

**Làm.**
- Từ `studio_contracts.shoot_date` + loại dịch vụ, sinh mốc nhắc (1 năm, 3 năm,
  5 năm) — tính khi đọc, không cần bảng mới.
- Thêm `birthday` vào danh bạ khách hàng.
- Một khối *Nên liên hệ tháng này* ở màn Tổng quan, mỗi dòng có nút gửi Zalo
  bằng mẫu tin sẵn (`ZaloSendButton` đã có).
- Cron Vercel đẩy push mỗi tuần một lần cho các mốc trong 30 ngày tới.

---

## 4. Việc tự động theo trạng thái

**Hiện có.** `contract_tasks`, `studio_notifications`, push (`web-push`), cron
Vercel, và [`lifecycle_followup.sql`](../supabase/migrations/lifecycle_followup.sql)
đã có mầm của ý này.

**Thiếu.** Mọi việc vẫn do người nhớ: hợp đồng ký rồi thì ai nhắc đặt cọc, giao
ảnh rồi thì ai xin đánh giá, còn 3 ngày tới buổi chụp thì ai gọi khách xác nhận.

**Làm.** Một bảng `studio_automations (owner_id, khi, thì, bật)` với tập *khi*
đóng (trạng thái hợp đồng đổi, còn N ngày tới buổi chụp, quá hạn thanh toán N
ngày, album chuyển giai đoạn) và tập *thì* đóng (tạo việc trong `contract_tasks`,
gửi push, gửi Zalo theo mẫu, gửi email). Cố ý **không** làm trình dựng luật tự
do — studio không cần Zapier, cần 8 luật đúng việc, bật/tắt bằng công tắc.

---

## 5. Chấm công & lịch rảnh của thợ

**Hiện có.** `crew_shift_plan` (phân công), `crew_unavailable` (báo nghỉ),
`studio_crew` (sổ thợ), `/staff` (trang của thợ), `payroll` (đối soát tiền công).

**Thiếu.** Đã phân công nhưng không ghi *thực tế*: thợ có đi không, đến lúc mấy
giờ, xong lúc mấy giờ. Nên `payroll` vẫn phải nhập tay.

**Làm.**
- Nút *Nhận việc / Đã đến / Đã xong* trên `/staff` ghi vào một bảng
  `crew_timesheet (shift_id, crew_id, started_at, ended_at, note)`.
- Cho thợ tự đăng ký khoảng rảnh (ngược của `crew_unavailable` hiện tại) để lúc
  phân công thấy ngay ai trống.
- `payroll` cộng từ `crew_timesheet` thay vì nhập tay.

---

## 6. Nhà cung cấp & đơn in ấn

**Thiếu hẳn.** Không có bảng nào cho nhà cung cấp. Album in, makeup thuê ngoài,
xe hoa, địa điểm — tất cả đang chỉ là một dòng chi trong `studio_expenses`, nên
không ai trả lời được "đơn album của khách A đã in xong chưa".

**Làm.**
- `studio_vendors (loại, tên, liên hệ, ghi chú)`.
- `vendor_orders (vendor_id, contract_id, nội dung, tiền, trạng thái, hẹn xong)`
  với trạng thái: *đã gửi → đang làm → đã nhận → đã giao khách*.
- Nối vào màn *Xử lý hình ảnh* để tiến độ in nằm cùng chỗ với tiến độ hậu kỳ.
- Mỗi `vendor_order` sinh một dòng trong `studio_expenses` để tiền không đếm hai lần.

---

## 7. Hoá đơn & xuất kế toán

**Hiện có.** `contract_payments`, `studio_expenses`, VietQR, và
[`src/lib/xlsx.ts`](../src/lib/xlsx.ts) đã biết xuất Excel.

**Thiếu.** Không có phiếu thu / hoá đơn để đưa khách, và không có bản xuất theo
kỳ để đưa kế toán.

**Làm.**
- Phiếu thu in được cho mỗi `contract_payment` — dùng lại đúng khung in của
  [`contract-print.ts`](../src/lib/contract-print.ts) để không sinh hệ thống in thứ hai.
- Xuất Excel *thu / chi / công nợ* theo khoảng ngày, một sheet mỗi loại.
- Chốt kỳ: khoá sổ một tháng để số liệu quá khứ không đổi khi ai đó sửa hợp đồng cũ.
- Nếu studio có mã số thuế: chỗ nối hoá đơn điện tử (VNPT / Viettel / MISA meInvoice)
  nên là *một* module bên ngoài `src/lib/`, không rải vào từng màn.

---

## 8. Thời tiết & đường đi cho buổi chụp ngoại

**Hiện có.** `LocationPicker` (Leaflet) đã lưu địa điểm buổi chụp, `studio_appointments`
đã có ngày giờ.

**Thiếu.** Rủi ro lớn nhất của studio ngoại cảnh là mưa, mà app không nói gì.

**Làm.** Gọi một API dự báo miễn phí (Open-Meteo không cần khoá) cho các buổi
chụp trong 7 ngày tới, hiện một dòng nhỏ trên thẻ lịch: nhiệt độ, xác suất mưa,
giờ mặt trời lặn (giờ vàng). Kèm thời gian di chuyển từ studio tới điểm chụp để
xếp lịch trong ngày cho khớp. Đây là mục *rẻ nhất mà khách nhìn thấy ngay* trong
cả danh sách.

---

## 9. Lọc ảnh bằng AI

**Hiện có.** `FilterTool` (33k) lọc ảnh khách đã chọn, `compress` nén & watermark.

**Thiếu.** Việc tốn giờ nhất của hậu kỳ vẫn thủ công: loại ảnh nhoè, loại ảnh
nhắm mắt, gom ảnh theo từng người, chọn bản nét nhất trong một chuỗi ảnh liên
tiếp.

**Làm.** Chạy **trên máy** (`desktop/`) chứ không trên server: ảnh cưới là dữ
liệu riêng của khách, và một buổi chụp 3.000 ảnh RAW thì upload là không khả
thi. Ưu tiên theo thứ tự giá trị: (1) điểm nét + phát hiện nhắm mắt, (2) gom
ảnh trùng để chọn một bản, (3) gom theo mặt để tách ảnh gia đình.

---

## 10. Ứng dụng khách (PWA) cho phần chọn ảnh

**Hiện có.** `manifest.ts`, service worker, `InstallPwaButton`, `PhotoZoom` đã
hỗ trợ chụm hai ngón.

**Thiếu.** Khách chọn ảnh gần như 100% trên điện thoại, thường ngồi lâu và mạng
kém. Trang album là web thường: mất mạng là mất lựa chọn đang làm.

**Làm.** Cho `/album/[slug]` cài được như app (manifest riêng theo album), lưu
lựa chọn vào IndexedDB trước rồi mới đồng bộ lên, và hiện rõ *đã lưu / chờ mạng*.
Đây là thứ khách cảm nhận trực tiếp về chất lượng studio.

---

## Ba việc cố ý KHÔNG đề xuất

| Việc | Vì sao không |
|---|---|
| Trình dựng luật tự động kiểu Zapier | Studio cần 8 luật đúng việc, không cần một ngôn ngữ lập trình bằng chuột |
| App di động native cho studio | Shell hiện tại đã responsive; native là hai bản phải nuôi mà không thêm năng lực gì |
| Nhiều loại tiền tệ / đa quốc gia | Toàn bộ nghiệp vụ (VietQR, hoá đơn, Zalo, âm lịch) là của Việt Nam; thêm tiền tệ chỉ làm nặng mọi màn tiền |

---

## Phụ lục — hai việc giao diện còn để ngỏ (cần bạn quyết)

Cả hai đều là **quyết định về màu thương hiệu**, nên tôi để nguyên chứ không tự
sửa. Mở `/uipreview/bang-mau` ở bản dev là thấy cả hai bằng mắt.

**1. Ngoài shell studio, màu "cảnh báo" trùng y hệt màu nhấn.**
`:root` đang khai `--am: var(--gold)` và `--ac: var(--gold)` — cùng một màu
vàng. Nên trên landing, trang đăng nhập, và dashboard gói free (`BookingOverview`
dùng cả `tone="brand"` lẫn `deltaTone="amber"`), một viên *cảnh báo* và một viên
*thương hiệu* nhìn giống nhau hoàn toàn. Trong shell studio thì không bị, vì ở
đó màu nhấn là xanh `#1e9e72` còn cảnh báo là `#a9740a`.

Sửa thì phải chọn một màu cảnh báo riêng cho bảng màu vàng ngoài shell — đó là
màu thương hiệu của bạn nên bạn chọn, không phải tôi.

**2. Thanh tiến độ điều hướng trên cùng luôn màu vàng, kể cả trong khu studio.**
`NavProgress` được gắn ở [`dashboard/layout.tsx`](../src/app/dashboard/layout.tsx)
như **em ruột** của `DashboardChrome`, tức là nằm NGOÀI `.studio-shell`, nên
`var(--gold)` của nó là vàng `#b8893a` chứ không bao giờ là xanh `#1e9e72` của
khu quản lý. Không thể sửa bằng CSS vì thanh này nằm trên shell trong cây DOM,
mà cũng không dồn vào trong được: `<main>` mang `.page-in` (animation
`transform` + `fill-mode: both`) nên nó là containing block của mọi phần tử
`position: fixed` bên trong — ghi chú trong `globals.css` đã cảnh báo đúng bẫy
này. Cách gọn nhất là `DashboardChrome` (nó đã biết `isStudio`) truyền màu
xuống cho `NavProgress`. Việc nhỏ, nhưng vẫn là chọn màu nên để bạn gật đầu.
