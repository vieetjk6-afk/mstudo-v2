# Gợi ý hoàn thiện app quản lý studio

File này **không phải hướng dẫn cài đặt**. Nó là danh sách những chỗ mstudo đang
còn thiếu để trở thành một app quản lý studio *đủ vòng*, xếp theo thứ tự nên làm
trước. Mỗi mục ghi rõ: hiện app có gì, thiếu gì, và làm thì phải chạm vào đâu.

**Năm mục (✅) đã làm xong** — xem mục "Đã làm" ở cuối file: ba mục nhỏ đầu
tiên, cùng hai mục lớn nhất của danh sách là **lọc ảnh bằng AI** và **ứng dụng
khách**. Năm mục còn lại vẫn là đề xuất.

Cơ sở đối chiếu: 29 mục sidebar trong [`src/lib/studio-nav.ts`](../src/lib/studio-nav.ts)
và 75 bảng nghiệp vụ trong [`supabase/schema.sql`](../supabase/schema.sql) + các migration.
Những gì app **đã có** thì không nhắc lại ở đây.

---

## 0. Bảng tra 1 phút

| # | Tính năng | Vì sao cần | Công sức | Đã có nền tảng gì |
|---|---|---|---|---|
| 1 | ✅ **Thu đánh giá khách sau giao ảnh** | Bảng `feedback` đã có nhưng studio không có màn nào để xem/duyệt | Nhỏ | `feedback`, `/api/feedback`, website đã hiện review |
| 2 | ✅ **Nguồn khách & phễu chuyển đổi** | Không biết tiền quảng cáo ra hợp đồng hay không | Nhỏ | `website_leads`, `studio_bookings`, `studio_contracts` |
| 3 | ✅ **Nhắc kỷ niệm & chụp lại** | Khách cưới là khách quay lại có giá trị cao nhất, hiện không ai nhắc | Nhỏ | `studio_contracts.shoot_date`, `message_templates`, push |
| 4 | **Việc tự động theo trạng thái** | Mọi nhắc nhở hiện là thủ công | Trung bình | `contract_tasks`, `studio_notifications`, cron Vercel |
| 5 | **Chấm công & lịch rảnh của thợ** | Có lịch phân công, chưa có "ai thực sự đi làm" | Trung bình | `crew_shift_plan`, `crew_unavailable`, `studio_crew` |
| 6 | **Nhà cung cấp & đơn in ấn** | Album in / makeup / xe hoa đang nằm ngoài hệ thống | Trung bình | `studio_expenses`, `contract_products` |
| 7 | **Hoá đơn & xuất kế toán** | Studio có doanh thu thật cần chứng từ | Trung bình | `contract_payments`, `studio_expenses`, `src/lib/xlsx.ts` |
| 8 | **Thời tiết & đường đi cho buổi chụp ngoại** | Huỷ/đổi lịch vì mưa là rủi ro lớn nhất của studio | Nhỏ | `studio_contracts` (địa điểm), `LocationPicker` |
| 9 | ✅ **Lọc ảnh bằng AI (chọn nét, gom ảnh trùng)** | Việc tốn nhiều giờ nhất của hậu kỳ | Lớn | `FilterTool`, `photos`, `selections` |
| 10 | ✅ **Ứng dụng khách (PWA): chọn ảnh & theo dõi hợp đồng** | Khách chọn ảnh chủ yếu trên điện thoại | Trung bình | `manifest.ts`, service worker, `PhotoZoom` |

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

## 9. Lọc ảnh bằng AI — ✅ đã làm, xem mục 4 phần "ĐÃ LÀM"

## 10. Ứng dụng khách (PWA) — ✅ đã làm, xem mục 5 phần "ĐÃ LÀM"

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


---

# ĐÃ LÀM

## ✅ 1. Đánh giá khách — `/dashboard/studio/reviews`

Khách vẫn viết cảm nhận ở cuối trang album giao khách như trước, nhưng từ giờ:

* **Phải được duyệt mới lên website.** `feedback.approved` đổi mặc định thành
  `false`. Ba trạng thái (chờ duyệt · đang hiện · đã ẩn) nằm trên hai cột
  `approved` + `moderated_at` — cần cột riêng vì "chờ duyệt" và "đã ẩn" trong DB
  đều là `approved=false`, và studio hoàn toàn có thể *trả lời* một đánh giá xấu
  rồi vẫn chưa quyết cho hiện. Hàng cũ đang hiện được migration đóng
  `moderated_at` sẵn nên không đổ vào tab Chờ duyệt.
* **Trả lời được**, và lời trả lời hiện công khai dưới đánh giá — cả trên trang
  album lẫn khối "Khách hàng nói gì" của website studio.
* **Đi xin đánh giá**: khối "Album đã giao, chưa ai đánh giá" kèm nút chia sẻ
  link (mang tên miền riêng của studio nếu có).
* Badge sidebar + một dòng trong "Cần xử lý ngay" ở Tổng quan, cả hai chỉ đếm
  bản CHƯA QUYẾT nên tự về 0 khi làm xong.

Sửa kèm: `/api/feedback` đang chặn bằng cờ cũ `is_gallery`, trái với luật
"`phase` thắng `is_gallery`" ở `@/lib/album-phase` — album studio tự tạo rồi bấm
"Giao khách" thì khách gửi cảm nhận bị chối, còn album đã kéo ngược về giai đoạn
chọn ảnh thì vẫn nhận. Giờ dùng `isDeliveryPhase()` + bắt buộc `published`.

Migration `supabase/migrations/danh_gia_khach.sql` · test `npm run test:reviews`
· xem trước `/uipreview/danh-gia`.

## ✅ 2. Nguồn khách & phễu chuyển đổi

Điều chỉnh so với đề xuất ban đầu: `studio_contracts.source` **đã có sẵn** và màn
Thu chi **đã** gom doanh thu theo nguồn. Chỗ hỏng thật nằm ở ba mắt xích khác:

* **Không ai điền cột đó.** Lúc lập hợp đồng thì không ai nhớ ba tuần trước khách
  bấm vào đâu. Giờ nguồn được **đoán ngay lúc khách gửi yêu cầu đặt lịch**, từ
  `utm_*` / `gclid` / `fbclid` / `document.referrer` mà trình duyệt vốn mang sẵn
  (`@/lib/lead-source`). Đoán không ra thì để trống — thà trống còn hơn dồn vào
  "Khác" rồi studio tưởng là số thật.
* **Bấm "Tạo hợp đồng" từ một yêu cầu là nguồn rơi mất.** Giờ hợp đồng chép lại
  `source` và giữ `booking_id` trỏ về yêu cầu gốc.
* **Không có phễu.** Màn Thu chi → tab *Biểu đồ & mục tiêu* có khối mới: khách
  hỏi → gửi yêu cầu → ký hợp đồng → tiền về, kèm tỉ lệ giữa từng bậc. Mỗi dòng
  nguồn cũng nói thêm "22 yêu cầu → 5 HĐ (23%)".

Sửa kèm: hợp đồng bỏ trống nguồn trước đây bị gộp vào `other` rồi hiện nhãn
"Khác" — studio đọc biểu đồ tưởng đã biết nguồn của những khách đó. Giờ tách
thành nhóm riêng "Không rõ nguồn".

Chỉ lưu nhãn kênh + tham số quảng cáo thô, **không cookie, không id theo dõi**.
Nguồn do client gửi lên nên server lọc lại theo tập đóng trước khi ghi.

Migration `supabase/migrations/nguon_khach.sql` · test `npm run test:lead-source`.

## ✅ 3. Nhắc kỷ niệm & chụp lại

Khối "Nên liên hệ tháng này" ở Tổng quan: khách cũ tới mốc 1 · 3 · 5 · 10 năm
(2 và 4 cố ý bỏ — nhắc mọi năm thì thành làm phiền và studio ngưng đọc), kèm lời
chúc soạn sẵn theo loại buổi chụp (cưới / bé / chung) và nút gửi.

Không thêm bảng nào và **không thêm truy vấn nào**: mốc suy ra từ `event_date` +
loại dịch vụ trên chính danh sách hợp đồng mà màn Tổng quan đã tải. Bật lên là
chạy ngay trên dữ liệu cũ.

Cửa sổ là −7 → +45 ngày. Phần lùi về quá khứ là cố ý: studio mở app hai tuần một
lần, mốc vừa qua hôm kia vẫn kịp một câu chúc muộn.

Test `npm run test:anniversary` (có ca 29/2 — cộng năm ngây thơ sẽ ra 01/3 và
nhắc sai ngày).

## ✅ 4. Lọc ảnh bằng AI — trong công cụ *Lọc ảnh*

Khối **“Lọc ảnh bằng AI”** nằm giữa bước 1 (nguồn ảnh) và bước 2 (danh sách cần
lọc) của công cụ Lọc ảnh, gập lại mặc định. Nó ăn đúng nguồn ảnh bước 1 đã nạp
(thư mục trên máy *hoặc* link Drive) và đẻ ra danh sách của bước 2 — nên mọi nút
sẵn có (chép sang thư mục riêng, xoá khỏi Drive) hoạt động y như khi studio dán
danh sách của khách.

**Ba việc nó làm:** điểm nét (phương sai Laplacian) · phơi sáng và khung chụp lỡ
· gom chuỗi bấm liên tiếp rồi chỉ ra bản nét nhất.

**Chạy trên máy, không upload.** Giải mã bằng `createImageBitmap` +
`OffscreenCanvas` ngay trong trình duyệt studio, thu về cạnh dài 480px rồi mới
đo. Không có endpoint nào, không byte ảnh nào rời khỏi máy — ảnh cưới là dữ liệu
riêng của khách, và một buổi chụp 3.000 file thì upload là chuyện không xảy ra.
Quét 4 ảnh song song, nhường luồng vẽ mỗi 8 ảnh, dừng được giữa đường.

**Ngưỡng cố ý lệch về phía KHÔNG loại.** Hai chiều sai không bằng giá nhau: loại
oan là studio xoá mất một tấm không có bản thứ hai, còn bỏ sót chỉ là mất mấy
giây bấm tay. Nên một tấm chỉ bị xếp *nên loại* khi nó tệ **cả tuyệt đối lẫn
tương đối** so với chính lô ảnh đó (dưới 60 điểm *và* dưới 35% trung vị lô). Nhờ
vậy một lô cố ý mềm (chụp phim, bokeh dày) không bị loại sạch, mà một lô siêu nét
cũng không loại oan tấm 300 điểm chỉ vì cả lô ở 900. Tối/cháy sáng chỉ là *xem
lại*, không phải loại — ảnh ngược sáng và high-key là bố cục có thật.

**Không tự xoá gì.** Màn hình nói **lý do kèm số đo** cho từng tấm, cho bỏ tick
từng tấm, rồi mới đưa danh sách sang bước 2. Việc xoá vẫn là một cú bấm có ý thức
của studio ở bước sau.

**Một chỗ tinh nhưng quyết định độ an toàn: mã nhận dạng khung phải HAI CHIỀU.**
dHash cổ điển chỉ so hai điểm cạnh nhau *theo hàng*. Với ảnh có độ sáng đổi đều
một chiều từ trái sang phải — nền trời lúc chiều, một mảng tường, hắt sáng từ cửa
sổ — thì không cặp nào có bên trái sáng hơn và mã ra **toàn số 0**. Hai tấm khác
nhau hoàn toàn đều cho mã đó, khoảng cách Hamming bằng 0, và bị kết luận là
trùng. Thêm 64 bit so *theo cột* chữa đúng gốc: dải chuyển sáng ngang thì nửa
ngang suy biến nhưng nửa dọc vẫn đầy thông tin. Chỉ khung phẳng thật (đen thui,
chụp lỡ) mới suy biến cả hai nửa — mà loại đó đã bị gạt từ bước đầu. `hashBits`
là chốt cuối cho đúng những khung đó.

*(Hai chốt SAI đã thử trước khi tới đây, ghi lại để đừng ai làm lại: “đếm số cặp
điểm chênh nhau đủ nhiều” không bắt được ca này — một dải chuyển sáng tương phản
cao thì mọi cặp đều chênh rõ mà mã vẫn toàn số 0, vì cái hỏng không phải thiếu
tương phản mà là mọi phép so đều cùng một chiều; còn chỉ nâng ngưỡng trên mã một
chiều thì phải nâng cao đến mức gạt luôn cả ảnh thật ra khỏi việc gom nhóm.)*

**Ba việc CỐ Ý chưa làm**, vì cả ba đòi một mô hình học sâu (vài chục MB tải về và
một lớp phụ thuộc mới cho cả dự án) chứ không phải số học: **phát hiện nhắm
mắt**, **gom ảnh theo từng người** (nhận diện mặt), và chấm *“ảnh nào đẹp hơn”*.
Đề xuất ban đầu xếp nhắm mắt vào ưu tiên 1; sau khi dựng thì rõ là nó thuộc một
lớp công nghệ khác, nên để riêng thay vì làm nửa vời. File RAW cũng không quét
được (không trình duyệt nào giải mã RAW) — màn hình nói thẳng số file bị bỏ qua
thay vì lặng lẽ quét một nửa thư mục.

Thư viện `src/lib/photo-ai.ts` (thuần, không phụ thuộc) · giải mã
`src/lib/photo-ai-scan.ts` · màn hình `src/components/AiFilterPanel.tsx`.
Test `npm run test:photo-ai` (60 ca trên ảnh dựng bằng số học) và
`npm run test:photo-ai-browser` — bài thứ hai chạy **Chromium thật**, sinh ảnh
PNG cỡ 1200×800 rồi đi đúng đường giải mã của bộ quét, để trả lời câu mà kiểm thử
đơn vị không trả lời được: *một tấm nhoè thật có rơi xuống dưới ngưỡng không?*
(đo được: nét 833 · nhoè 7 · khung đen 0). Chính bài này là chỗ lộ ra cả cái bẫy
`ImageBitmap.close()` xoá `width/height` lẫn chuyện mã hash một chiều bị suy biến.

## ✅ 5. Ứng dụng khách: chọn ảnh & theo dõi hợp đồng

Ba trang khách — album chọn ảnh `/a/<slug>`, album giao khách `/album/<slug>`, và
cổng hợp đồng `/portal/<token>` — giờ **cài được lên màn hình chính như một app**,
mang tên album (hoặc tên khách) và **logo studio**, không phải thương hiệu mstudo.
Mỗi album/hợp đồng có `manifest` riêng với `id` riêng, nên khách cài hai album của
hai studio thì được hai icon chứ không phải một icon ghi đè lên icon kia. Album
chọn ảnh và album giao khách của cùng một dự án dùng **chung `id`** — cố ý: một dự
án chỉ có một app, và khi studio bấm *Giao khách* thì icon đã cài mở ra trang ảnh
hoàn thiện.

### Chọn ảnh: ghi xuống máy trước, mạng chỉ là bước sau

Trước đây mỗi lượt bấm là một `POST` thẳng lên máy chủ. Mạng rớt là lượt bấm bay
mất, và khách **không hề biết** — trạng thái lưu được đặt trong code nhưng chưa
bao giờ được vẽ ra màn hình. Giờ mọi lượt bấm ghi vào **sổ trên máy**
(IndexedDB, có đường lui localStorage cho Safari riêng tư và trình duyệt trong app
chat), rồi mới hẹn giờ gửi lên; mất mạng thì thử lại với nhịp lùi dần 3s → 60s và
gửi ngay khi có mạng lại.

**Viên trạng thái không nói dối theo cả hai chiều:** còn thay đổi chờ thì cấm hiện
*“Đã lưu”* (dù `fetch` vừa trả 200 cho một bản cũ hơn), mà đã đồng bộ hết thì cũng
không hiện *“chờ mạng”* chỉ vì trình duyệt báo offline. Kèm số thay đổi đang chờ.

**Hoà giải BA BÊN, không phải “bản trên máy luôn thắng”.** Một album chỉ có một
lựa chọn dùng chung, nhưng cả nhà cùng mở một link trên hai ba điện thoại là
chuyện thường. Nếu máy nào lưu sau cũng ghi đè thì nó xoá sạch lựa chọn của máy
kia. Nên sổ giữ thêm `base` — bản mà máy này và máy chủ đã từng khớp — và hoà giải
theo **từng ảnh**: ảnh nào máy này vừa đổi thì lấy máy này, ảnh nào máy này không
chạm tới thì lấy máy chủ (tức lấy của người kia). Kể cả khi máy kia chuyển một ảnh
sang *không thích* — tôn trọng, vì đó là ý muốn mới nhất về tấm đó.

**Chỉ báo studio “đã chọn xong” khi lựa chọn THẬT SỰ đã lên máy chủ.** Trước đây
lượt lưu hỏng vẫn gửi thông báo, nên studio nhận tin *“khách chọn xong 42 ảnh”*
rồi mở ra thấy danh sách cũ — tệ hơn cả không báo gì.

### Theo dõi hợp đồng: nhớ máy, và đọc được khi mất mạng

Cổng khách chặn bằng số điện thoại ở **mọi** lần gọi, nên trước đây khách phải gõ
lại số mỗi lần mở trang. Một hợp đồng cưới chạy 3–6 tháng và khách mở lại hàng
chục lần để xem hôm nào thử đồ, còn nợ bao nhiêu — gõ số mười lần thì khách thôi
không mở nữa, và studio mất đúng cái kênh mình vừa dựng ra. Giờ máy **nhớ hộ** số
đã mở khoá (90 ngày, có nút *Thoát máy này* cho máy dùng chung). Đây **không phải
đăng nhập**: server vẫn kiểm số từng lần gọi, và số nằm cùng chỗ với token vốn đã
ở trong URL trên máy đó.

Mất mạng thì cổng mở ở **chế độ đọc** từ bản chụp lần trước, kèm một dải nói rõ
*“bạn đang xem bản lưu 2 giờ trước”* — vì trên đó có **số tiền còn nợ**, và để
khách nhìn một con số cũ mà không nói gì là lỗi của app, không phải của khách. Mọi
thao tác **ghi** (báo đã chuyển khoản, gửi đánh giá) vẫn đòi mạng và nói thẳng khi
chưa gửi được, thay vì nhận rồi đánh mất — hai chỗ đó trước đây `fetch` ném ra
ngoài không ai bắt, nút kẹt vĩnh viễn ở *“Đang gửi…”*.

### Service worker: mở lại được khi mất mạng

Hai ngoại lệ được thêm, **chỉ cho trang của khách**: ảnh (`/api/img`) lấy từ máy
trước (địa chỉ gắn theo file id + chiều rộng nên trên thực tế là bất biến), trần
600 tấm; và HTML trang khách vẫn mạng-trước nhưng bản tải thành công được giữ lại
để lần mất mạng sau còn cái mà mở. Cố ý **không** làm mới ảnh ngầm: album vài
nghìn ảnh mà cứ xem là gọi lại thì đốt hạn mức, đúng cái bẫy vòng poll 5 giây
trước đây đã sa vào. Lựa chọn nhúng trong bản HTML cũ đó có thể cũ — không sao,
sổ trên máy hoà giải theo từng ảnh nên thay đổi khách chưa gửi lên không bị đè.

Sổ ngoại tuyến `src/lib/album-offline.ts` (thuần) · chỗ cất
`src/lib/album-store.ts` · manifest `src/lib/client-manifest.ts` · cổng khách
`src/lib/portal-device.ts`.
Test `npm run test:album-offline` (42 ca, gồm đúng ba tình huống dễ vỡ: poll đè
mất lựa chọn vừa bấm, hai điện thoại cùng một link, và viên trạng thái nói dối) ·
`npm run test:portal-device`.
