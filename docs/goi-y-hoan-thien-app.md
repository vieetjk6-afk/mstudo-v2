# Gợi ý hoàn thiện app quản lý studio

File này **không phải hướng dẫn cài đặt**. Nó là danh sách những chỗ mstudo đang
còn thiếu để trở thành một app quản lý studio *đủ vòng*, xếp theo thứ tự nên làm
trước. Mỗi mục ghi rõ: hiện app có gì, thiếu gì, và làm thì phải chạm vào đâu.

**CẢ MƯỜI MỤC ĐÃ LÀM XONG** — xem phần "ĐÃ LÀM" ở cuối file. Hai việc giao diện
ở phụ lục cũng đã xử lý (màu cảnh báo và thanh tiến độ), ghi chú ngay tại đó.

Giữ lại phần mô tả từng mục ở trên vì nó nói **vấn đề** — thứ không cũ đi khi
code đã viết xong. Muốn biết đã dựng ra sao và **vì sao dựng như thế**, đọc phần
"ĐÃ LÀM".

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
| 4 | ✅ **Việc tự động theo trạng thái** | Mọi nhắc nhở hiện là thủ công | Trung bình | `contract_tasks`, `studio_notifications`, cron Vercel |
| 5 | ✅ **Chấm công & lịch rảnh của thợ** | Có lịch phân công, chưa có "ai thực sự đi làm" | Trung bình | `crew_shift_plan`, `crew_unavailable`, `studio_crew` |
| 6 | ✅ **Nhà cung cấp & đơn in ấn** | Album in / makeup / xe hoa đang nằm ngoài hệ thống | Trung bình | `studio_expenses`, `contract_products` |
| 7 | ✅ **Hoá đơn & xuất kế toán** | Studio có doanh thu thật cần chứng từ | Trung bình | `contract_payments`, `studio_expenses`, `src/lib/xlsx.ts` |
| 8 | ✅ **Thời tiết & đường đi cho buổi chụp ngoại** | Huỷ/đổi lịch vì mưa là rủi ro lớn nhất của studio | Nhỏ | `studio_contracts` (địa điểm), `LocationPicker` |
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

## Phụ lục — hai việc giao diện (✅ đã làm)

Cả hai từng để ngỏ vì là **quyết định về màu thương hiệu**. Bạn đã bảo làm nốt,
nên tôi chọn phương án ít phát minh nhất và ghi rõ chỗ đổi lại. Mở
`/uipreview/bang-mau` ở bản dev là thấy cả hai bằng mắt.

**1. Ngoài shell studio, màu "cảnh báo" trùng y hệt màu nhấn.**
`:root` đang khai `--am: var(--gold)` và `--ac: var(--gold)` — cùng một màu
vàng. Nên trên landing, trang đăng nhập, và dashboard gói free (`BookingOverview`
dùng cả `tone="brand"` lẫn `deltaTone="amber"`), một viên *cảnh báo* và một viên
*thương hiệu* nhìn giống nhau hoàn toàn. Trong shell studio thì không bị, vì ở
đó màu nhấn là xanh `#1e9e72` còn cảnh báo là `#a9740a`.

**Đã sửa.** `--am` ngoài shell giờ là `#a9740a` (nền tối: `#d99a2b`) thay vì
`var(--gold)`. Cố ý lấy ĐÚNG màu mà `.client-doc` đã dùng cho trang khách chứ
không bịa màu mới: nó vốn được chọn để đứng cạnh nền ấm, đủ khác vàng thương
hiệu `#b8893a` để phân biệt, mà vẫn cùng họ màu. **Muốn đổi thì sửa một dòng**
`--am` trong `:root` của `src/app/globals.css` (và dòng tương ứng trong
`:root[data-theme="dark"]`).

**2. Thanh tiến độ điều hướng trên cùng luôn màu vàng, kể cả trong khu studio.**
`NavProgress` được gắn ở [`dashboard/layout.tsx`](../src/app/dashboard/layout.tsx)
như **em ruột** của `DashboardChrome`, tức là nằm NGOÀI `.studio-shell`, nên
`var(--gold)` của nó là vàng `#b8893a` chứ không bao giờ là xanh `#1e9e72` của
khu quản lý. Không thể sửa bằng CSS vì thanh này nằm trên shell trong cây DOM,
mà cũng không dồn vào trong được: `<main>` mang `.page-in` (animation
`transform` + `fill-mode: both`) nên nó là containing block của mọi phần tử
`position: fixed` bên trong — ghi chú trong `globals.css` đã cảnh báo đúng bẫy
này.

**Đã sửa, nhưng KHÔNG theo cách đề xuất ban đầu.** `DashboardChrome` không
truyền màu xuống được: hai component là **anh em** trong `dashboard/layout.tsx`
và `NavProgress` còn đứng *trước*. Nên luật "đường dẫn nào thuộc khu studio" được
rút ra thành `src/lib/studio-shell-paths.ts`, và **cả hai cùng gọi** — một luật,
hai nơi dùng, không lệch nhau được. `NavProgress` nhận `tier` từ layout rồi tự
tính màu: xanh `#1e9e72` trong khu quản lý, vàng ngoài đó.


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

## ✅ 4c. Lọc theo khuôn mặt

Bộ đo ở mục 4 đo CẢ KHUNG ẢNH. Nó trả lời tốt câu "hai tấm này có phải một chuỗi
bấm không", nhưng mù trước đúng hai thứ khiến studio vẫn phải xem lại từng tấm
bằng mắt:

**Ai đó nhắm mắt.** Một tấm nét căng, bố cục đẹp, cô dâu chớp mắt — bộ đo cả
khung chấm nó điểm cao nhất chuỗi và chọn nó làm *bản nên giữ*. Chớp mắt không
làm ảnh kém nét một chút nào. Đây là lỗi số một của mọi công cụ lọc ảnh tự động
và là lý do studio không tin chúng.

**Mặt nhoè trong khi nền nét.** Lấy nét trượt ra sau lưng xảy ra hằng buổi. Điểm
nét cả khung của tấm đó vẫn **cao** — cạnh lá cây, hoa văn tường, ren váy đều
sắc — nên bộ đo cũ không những không bắt được mà còn xếp nó **trên** tấm lấy nét
đúng.

**Nên thứ tự chọn bản nên giữ đổi hẳn: mắt mở trước → mặt nét → mới tới khung
nét.** Một tấm mắt mở luôn thắng mọi tấm có người nhắm mắt, kém nét bao nhiêu
cũng thắng: ảnh hơi mềm còn cứu được bằng hậu kỳ, mắt nhắm thì không.

Vài ranh giới cố ý:

* **Mặt nhỏ hơn 0,8% khung bị bỏ qua hoàn toàn.** Khách qua đường phía sau, người
  bàn tiệc thứ tư — họ nhắm mắt thì cũng không ai loại tấm ảnh vì thế. Xét cả họ
  là mọi ảnh đám đông đều dính nhãn "có người nhắm mắt", tức nhãn ấy thành vô nghĩa.
* **Ngưỡng nhắm 0,5, không thấp hơn.** Nhíu mắt khi cười là biểu cảm đẹp, không
  phải lỗi. Bài kiểm tra trong Chromium đo được mắt mở 0,001 và mắt nhắm 0,640 —
  ngưỡng nằm giữa với biên rộng, không sát mép.
* **"Mặt nhoè" phải đạt CẢ HAI: kém hẳn so với nền VÀ thấp tuyệt đối.** Chỉ xét
  tương đối thì chân dung nền trơn bị báo oan; chỉ xét tuyệt đối thì mọi ảnh
  thiếu sáng đều dính.
* **Tấm ĐỨNG RIÊNG nhắm mắt chỉ hạ xuống *xem lại*, không bao giờ *nên loại*.**
  Đứng riêng nghĩa là không có bản nào khác của khoảnh khắc đó — loại đi là mất
  hẳn khoảnh khắc.
* **Không bao giờ NÂNG hạng.** Một khung đen thui vẫn là "nên loại" kể cả khi mô
  hình tình cờ thấy một khuôn mặt trong đó.
* **Chuỗi không có mặt nào thì khuôn mặt không được quyền nói.** Ảnh phong cảnh,
  ảnh chi tiết váy — ép nó nói sẽ ra một thứ tự tuỳ tiện; giữ nguyên kết quả cũ.

**TẮT SẴN, và nói thẳng cái giá.** Bộ nhận diện nặng ~13 MB tải lần đầu, và lượt
quét chậm hơn nhiều lần vì mô hình chạy **tuần tự** (một `FaceLandmarker` là một
phiên WASM có trạng thái; gọi chồng nhau cho ra kết quả lẫn giữa các ảnh). Bật nó
sau lưng studio rồi để họ ngồi chờ gấp mười lần mà không biết vì sao là cách chắc
nhất để họ bỏ công cụ. Vì cùng lý do đó, tính năng này **chỉ ở công cụ của
studio**, không đưa vào album khách: 13 MB trên 3G để tìm ảnh chớp mắt là một
trao đổi tồi.

**Ảnh vẫn không rời khỏi máy.** Mô hình chạy bằng WASM ngay trong trình duyệt
studio. Thứ duy nhất đi qua mạng là chính mô hình.

Hai quyết định hạ tầng có lý do cụ thể. **WASM tự phục vụ từ `/mediapipe`**, không
lấy từ jsdelivr như hướng dẫn của MediaPipe: CSP của repo chỉ cho `script-src
'self'` cộng vài host Google, nạp từ CDN khác sẽ bị chặn **âm thầm** — bộ nhận
diện đơn giản không bao giờ khởi động. File chép ra ở `postinstall`
(`scripts/chep-mediapipe.mjs`), không commit vào git vì nặng 18,5 MB. **Mô hình**
lấy từ storage.googleapis.com — khớp `connect-src https://*.googleapis.com` của
CSP siết chặt, và đỡ 3,7 MB cho mỗi lần triển khai. Mạng studio chặn Google thì
thông báo nói đúng điều đó bằng tiếng Việt, kèm câu "bỏ tick là quét bình thường
vẫn chạy" — chứ không phải một dòng `Failed to fetch`.

Đo nét vùng mặt dùng lại **đúng** `laplacianVariance` của bộ đo cũ, chỉ khác là
chạy trên ô cắt khuôn mặt (`subGray`). Nhờ vậy "nét mặt" và "nét khung" cùng một
thang và đặt cạnh nhau so được — đó cũng là hai con số hiện trong lý do.

Bài kiểm tra ở `/uipreview/khuon-mat` vẽ hai khuôn mặt bằng canvas (mắt mở / mắt
nhắm) rồi cho chạy qua đúng `detectOne()` của code thật. Chính nó bắt được một
lỗi đang có sẵn trong màn lọc ảnh: `scanSupported()` gọi lúc dựng cho ra `false`
ở máy chủ và `true` ở trình duyệt — mà **React 18 không sửa lệch THUỘC TÍNH khi
hydrate**, nó chỉ cảnh báo rồi giữ giá trị của máy chủ, nên nút "Quét" ở lại
trạng thái vô hiệu vĩnh viễn. Nay hỏi trong effect.

Luật `src/lib/face-ai.ts` (58 ca, `npm run test:face-ai`) · phần trình duyệt
`src/lib/face-detect.ts` · đầu-cuối `npm run test:face-browser` (11 ca trong
Chromium thật).

## ✅ 4d. Gom ảnh theo từng người

Câu khách hỏi ngay khi mở album 800 tấm là *"ảnh của tôi đâu"*, và câu studio hỏi
lúc lọc là *"còn tấm nào có mẹ cô dâu không"*. Bộ nhận diện ở mục 4c chỉ biết
"có một khuôn mặt ở đây", không biết đó là **ai** — việc đó cần một mô hình khác
hẳn: mạng nhận dạng danh tính, biến mỗi khuôn mặt thành một vector sao cho hai
tấm cùng một người thì hai vector gần nhau.

**Căn chỉnh là phần dễ sai nhất, và sai thì hỏng âm thầm** — vector vẫn ra 128 số
trông rất hợp lệ, chỉ là vô nghĩa. Mạng được huấn luyện trên khuôn mặt đã xoay
cho hai mắt nằm ngang và cắt ở một tỉ lệ cố định; đưa vào một ô cắt thô theo
khung bao thì cùng một người nghiêng đầu 15° ra hai vector khác hẳn. Nên phép căn
chỉnh dựng từ hai tâm mắt (dùng **góc mắt**, không dùng tâm mống mắt: mống mắt di
chuyển theo hướng nhìn).

**Thước đo là khoảng cách Euclid trên vector THÔ, không phải cosine.** Đây là chỗ
suýt sai. Vector của dòng mô hình này nằm gọn trong một hình nón, nên cosine giữa
hai vector *bất kỳ* đã là ~0,94. Đo thật ở `/uipreview/gom-theo-nguoi`: cùng
người 0,996, khác người 0,939 — khe vỏn vẹn **0,017**, và mọi thứ gom vào một
cụm. Đổi sang Euclid trên vector thô: cùng người 0,106, khác người 0,439, khe
**0,130** — tách rõ. Bài kiểm chứng ấy chính là thứ bắt được lỗi này trước khi nó
ra tới studio.

**Gom bằng Chinese Whispers, không phải union-find.** Với ảnh trùng (mục 4) thì
union-find đúng, vì hai tấm bấm liên tiếp gần như giống hệt. Với khuôn mặt thì đó
là bẫy dây chuyền kinh điển: A giống B, B giống C, nhưng A và C là hai người —
nối liên thông gộp cả ba, rồi từ C sang D, và cuối cùng cả đám cưới thành một
người. Chinese Whispers cho mỗi khuôn mặt nhận nhãn của **nhóm láng giềng mạnh
nhất**, nên một cây cầu mỏng giữa hai cụm dày không kéo được chúng vào nhau — có
test dựng đúng tình huống đó. Hạt giống cố định nên chạy lại ra cùng kết quả:
studio bấm quét lại mà các nhóm nhảy lung tung thì họ sẽ không tin.

**Máy gom sai là chuyện SẼ xảy ra**, nên phải có đường sửa ngay tại chỗ: thanh
**chặt/rộng** gom lại **tức thì** trên vector đã có trong bộ nhớ (không quét lại
— bắt quét lại cả nghìn ảnh để nới một ngưỡng là cách chắc chắn để không ai chỉnh
nó), và nút **gộp** hai nhóm. Ngưỡng mặc định 0,6 là con số nhà làm mô hình công
bố cho **ảnh chụp thật**; bài kiểm chứng ở đây chạy trên mặt vẽ bằng hình học nên
**không hiệu chỉnh được** con số đó — nó chỉ chứng minh hai phân bố tách rời và
thuật toán khôi phục đúng từng người khi ngưỡng nằm trong khe.

Thư viện nạp bằng thẻ `<script>` tự phục vụ từ `/face-model`, **không** `import`:
bản ESM của nó gọi `require()` theo kiểu webpack không phân tích tĩnh được, kéo
cả nhánh TensorFlow-cho-Node vào gói trình duyệt và trang chết ngay ở lượt dựng.
Và phải tự chọn nền tính toán (`webgl` rồi lùi `cpu`) trước khi nạp trọng số —
bản UMD ưu tiên nền `wasm` mà ta không phục vụ, không chọn tay thì chết với đúng
một câu khó hiểu.

**Khách tự tìm mặt mình — hai đường, hai cái giá khác hẳn.**

Đây mới là thứ khách thật sự hỏi khi mở album 800 tấm: *"ảnh của tôi đâu"*. Bản
đầu bắt họ chờ studio ĐẶT TÊN rồi chọn theo tên — sai chỗ: studio đặt tên cô dâu
chú rể là cùng, còn mẹ cô dâu, cô bạn thân, đứa cháu thì không ai ngồi đặt hết,
mà đó đúng là những người cần chức năng này nhất.

Nên giờ hàng khuôn mặt hiện **cả người chưa đặt tên**, và khách nhận ra bằng
MẶT. Muốn cắt được ảnh mặt thì phải lưu thêm **khung khuôn mặt** (`cover_box`,
chuẩn hoá 0…1) — có nó thì cắt bằng CSS ngay trên thumbnail album đã tải sẵn,
**không thêm một byte nào**. Không có nó thì ảnh thẻ đành lấy cả tấm, mà một tấm
ảnh cưới có hai ba người nên khách không chỉ được vào mặt mình.

Phép cắt là chỗ dễ sai và khó nhìn ra: `transform: scale(1/w) translate(-x%, -y%)`
với `transform-origin: 0 0`. Nó đúng nhờ một tính chất của CSS — phần trăm trong
`translate` ăn theo **kích thước chính thẻ ảnh**, nên `-y%` dịch đúng
`y × chiều cao ảnh` mà **không cần biết tỉ lệ ảnh**. Điều đó quan trọng vì lúc
dựng trang thì trình duyệt còn chưa tải xong ảnh: mọi cách tính cần tới tỉ lệ đều
nhảy một nhịp khi ảnh về. Phóng một hệ số cho cả hai chiều nên mặt không méo. Có
bài đo lại bằng `getBoundingClientRect()` trong Chromium thật, vì mô phỏng ngữ
nghĩa CSS chỉ chứng minh tôi hiểu đúng cái tôi tự viết ra.

Đường thứ hai, **khách tải ảnh của mình lên**, bắt buộc phải có mô hình trên máy
họ (~20 MB) — nên nó chỉ tải khi khách tự bấm, và nói trước dung lượng. Ảnh khách
chọn **không rời khỏi máy**: nhận diện chạy trong trình duyệt, thứ duy nhất được
so là vector 128 số, và cũng chỉ so ngay tại chỗ. Đổi lại, tâm cụm của những
người trong album được gửi xuống máy khách (~3 KB) — mà ảnh của chính họ thì link
album vốn đã cho xem. Đánh đổi đó đáng hơn là bắt khách gửi ảnh mặt mình lên máy
chủ, và cũng không tốn một lượt gọi hàm serverless nào.

Ảnh khách tải lên có nhiều người thì lấy **mặt to nhất** — ảnh họ tự chọn để "tìm
tôi" gần như luôn là ảnh họ đứng gần máy nhất — và màn hình nói thẳng ra là đã
chọn mặt lớn nhất. Không tìm thấy ai đủ gần thì trả về **không tìm thấy**, chứ
không đưa người gần nhất kèm lời cảnh báo: đưa nhầm bộ ảnh của người khác là hỏng
nặng hơn, và khách vẫn còn đường tự chọn mặt.

**Studio quét một lần, khách không tải gì.** Đây là phần quyết định tính năng này
có dùng được thật hay chỉ hay trên máy studio. Mô hình nặng 26 MB; bắt mỗi điện
thoại trong nhà tải 26 MB qua 3G rồi chạy nhận dạng trên 800 tấm là đánh đổi tệ,
trong khi studio chỉ phải làm một lần. Nên studio đặt tên từng người ("Cô dâu",
"Mẹ chú rể") và **lưu xuống DB**; khách mở album thấy hàng **chip lọc** và tải
thêm đúng vài KB JSON — không một byte mô hình nào. Bảng
`supabase/migrations/album_people.sql`; ghi thẳng bằng anon key + RLS, **không**
qua API route, nên không tốn một lượt gọi hàm serverless nào.

Ba chỗ dễ hỏng âm thầm ở phần lưu này, và cách chặn:

- **Ghép ảnh với album.** Lúc quét, ảnh là file trên đĩa/Drive; trong DB nó là
  một hàng `photos` có uuid. Luật ghép duy nhất là **tên file bỏ phần mở rộng** —
  studio lọc trên RAW mà giao khách JPG là chuyện thường. Đúng luật mà công cụ
  Lọc ảnh đã dùng, nên nó là **một hàm dùng chung** (`matchKey`) chứ không phải
  hai luật gần giống nhau ở hai file. Ảnh quét được mà không có trong album thì
  **hiện số ra**, vì đó cũng là dấu hiệu studio đang quét sai thư mục.
- **Quét đợt hai.** Studio không quét một lần rồi xong: giao đợt đầu, chụp thêm,
  quét lại. Không lưu vector thì lượt sau ra một bộ người hoàn toàn mới, studio
  đặt tên lại từ đầu và chip của khách đứt. Nên mỗi người lưu kèm **tâm cụm**
  (trung bình các vector — nằm gần mọi thành viên hơn là các thành viên gần nhau,
  nên cùng ngưỡng 0,6 thì vừa ít nhận nhầm vừa ít bỏ sót), và lượt sau **ghép
  một-đối-một** với người cũ. Một-đối-một là bắt buộc: khi một người bị tách
  thành hai cụm, chỉ cụm gần hơn thừa hưởng cái tên — cho cả hai cùng tên thì
  album có hai "Cô dâu", đúng thứ chỉ mục UNIQUE của DB từ chối.
- **Chip bấm vào ra lưới trống.** Studio xoá ảnh khỏi album sau khi lưu là chuyện
  bình thường. Nên chip chỉ dựng từ người **đã đặt tên** và ảnh **còn hiện trong
  lưới**, và người không còn ảnh nào thì không thành chip.

Người studio đã lưu mà lượt quét sau không thấy thì **giữ nguyên** — quét một thư
mục nhỏ hơn không nên xoá công đặt tên của lần trước; muốn bỏ thì có nút xoá riêng.

Luật `src/lib/face-group.ts` (`npm run test:face-group`) · căn chỉnh + mô hình
`src/lib/face-embed.ts` · phần lưu & chip `src/lib/face-people.ts`
(`npm run test:face-people`) · kiểm chứng `/uipreview/gom-theo-nguoi` và
`/uipreview/loc-theo-nguoi` (`npm run test:people-chip`, chạy trong Chromium thật
— hai lỗi hydrate của repo này đều thuộc loại chỉ lộ ra ở đó).

## ✅ 4b. Xem đủ lớn để CHỌN — khung so sánh ảnh

Bản đầu của bộ lọc AI vẽ kết quả ở ô vuông 128px. Cỡ đó đủ để **biết** hai tấm
khác nhau, nhưng không đủ để **chọn** giữa chúng — mà chọn mới là việc studio
ngồi đó để làm. Hai tấm cách nhau 1/8 giây thì ở 128px chúng là một, nên lời hứa
"bỏ tick được từng tấm" thành ra vô nghĩa: bỏ tick một tấm không nhìn rõ cũng chỉ
là đoán.

Nay ô ảnh chỉnh được **ba cỡ** cho cả bảng, và **bấm vào một tấm** mở khung so
sánh có ba nấc — cả ba đều cần:

1. **Một ảnh lớn** — thấy bố cục, biểu cảm, ai nhắm mắt.
2. **Hai ảnh cạnh nhau** với *bản đề xuất* của chuỗi. Đây là câu hỏi thật:
   "bản máy chọn có hơn tấm tôi thích không?" Đang xem chính bản đề xuất thì nó
   đặt cạnh tấm liền trước — so một tấm với chính nó là một ô trống vô nghĩa.
3. **Cắt 1:1 điểm ảnh gốc** — nấc quyết định. Thu về màn hình thì hai tấm trong
   một chuỗi trông y hệt; độ nét chỉ hiện ra ở tỉ lệ 100%, đúng cách người ta soi
   ảnh trong Lightroom. Bấm vào chỗ nào trên ảnh là soi đúng chỗ đó, và ở chế độ
   hai ảnh thì **cả hai cắt cùng một điểm** — so hai chỗ khác nhau trên hai tấm
   thì không kết luận được gì.

Phím: `←` `→` đổi tấm · `C` so hai ảnh · `Z` soi 1:1 · `Space` bỏ tấm khỏi danh
sách loại · `Esc` đóng.

Ảnh lớn và ô cắt **giải mã đúng lúc mở** rồi nhớ lại, chứ không dựng sẵn cho cả
lô: giữ ảnh 1600px cho 3.000 tấm là vài GB. Mọi object URL được thu hồi khi đóng.

Phép kẹp ô cắt tách thành `cropRect()` ở `src/lib/photo-ai.ts` — số học thuần,
kiểm thử bằng node — vì kẹp thiếu một đầu thì Chrome trả ô cắt có viền trong
suốt, mà lỗi đó chỉ lộ ra khi kéo con trỏ ra sát mép ảnh, tức là muộn. Còn hợp
đồng của trình duyệt (`createImageBitmap(blob, sx, sy, sw, sh)` phải trả **đúng**
ô điểm ảnh gốc, không thu nhỏ) được kiểm trong Chromium thật ở
`npm run test:photo-ai-browser`: nếu nó thu nhỏ thì nút "soi 1:1" hiện một tấm mờ
y hệt ảnh lớn và cả nấc quyết định thành vô nghĩa **mà không có lỗi nào**.

Khung này khó mở bằng tay (phải đăng nhập, mở công cụ, trỏ vào thư mục có chuỗi
bấm, quét xong mới bấm được), nên có màn xem trước `/uipreview/so-sanh-anh` với
ảnh mẫu sinh ngay trong trình duyệt — bốn tấm cùng cảnh, khác nhau đúng thứ khung
này sinh ra để phân biệt: độ nét.

`src/components/AiCompareView.tsx` · `npm run test:photo-ai`,
`npm run test:photo-ai-browser`.

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

### Gợi ý ảnh na ná nhau — cùng bộ lọc AI, nhưng chỉ một nửa của nó

Việc mệt nhất của khách không phải chọn ảnh đẹp. Là cuộn qua bảy tấm giống hệt
nhau, không thấy chúng khác nhau ở đâu, rồi chọn đại — hoặc chọn cả bảy. Máy ảnh
bấm liên tiếp nên một album 800 tấm thật ra chỉ có chừng 500 khoảnh khắc.

Nên album chọn ảnh có một khối *"Ảnh na ná nhau"*: nhóm các tấm gần như giống
hệt nhau lại, chỉ ra **bản nét nhất** của từng nhóm, cho chọn một phát cả loạt,
và **ẩn bớt bản trùng khỏi lưới**.

**Dùng chung bộ đo với studio nhưng CỐ Ý chỉ lấy một nửa.** `duplicateGroups()`
gom nhóm và chỉ bản nét nhất — **không** dùng `judge()`. Bộ ấy còn kết luận
"nhoè", "chụp lỡ", "nên loại": đúng cho studio đang dọn thư mục, nhưng nói câu đó
với khách là chuyện khác hẳn. Chê ảnh cưới của khách là việc của studio nếu họ
muốn, không phải của phần mềm, và một dòng chữ *"ảnh này nhoè"* dưới tấm ảnh cưới
sẽ làm hỏng đúng cái việc đáng ra là vui nhất. Ở đây chỉ có một câu: mấy tấm này
giống nhau, tấm này nét nhất.

**Ba ràng buộc vì đây là máy của KHÁCH, không phải máy studio.**

*Không tự chạy* — quét là việc nặng và tốn 3G, khách phải bấm mới chạy (trần 600
tấm một lượt, nói rõ số).

*Không bao giờ động vào lựa chọn.* Quét xong, máy chỉ **tách riêng** các tấm
trùng ra khỏi lưới và bày chúng thành từng chuỗi trong khối gợi ý; **không tấm
nào được thêm vào lựa chọn**. Khách bấm tấm nào thì tấm đó mới vào — và đó là
đường **duy nhất** một tấm đi vào lựa chọn từ khối này. Cố ý **không** có nút
*"chọn hết bản đề xuất"*: một cú bấm thêm sáu chục tấm vào danh sách rồi khách
phải ngồi gỡ ra thì tệ hơn hẳn là tự bấm sáu chục lần có chủ ý. Việc tách riêng
có công tắc tắt ngay cạnh, và **ảnh khách đã chọn thì không bao giờ bị tách khỏi
lưới** (một tấm biến mất ngay sau khi vừa bấm chọn là lỗi khó chịu nhất tính năng
này có thể gây ra). Ảnh khách đã đánh dấu *không thích* cũng không bày lại ở đây
— cả album theo một luật.

*Phải XEM ĐƯỢC trước khi chọn.* Không nhìn rõ thì "khách tự chọn" cũng chỉ là bấm
đại. Nên bấm vào một tấm trong khối này mở **đúng khung xem ảnh của lưới** —
phóng to, thả tim, ghi chú, đánh dấu không thích — và lật qua **cả chuỗi** bằng
mũi tên. Dùng lại khung xem sẵn có chứ không dựng khung thứ hai: một khung riêng
cho ảnh trùng sẽ thiếu mất vài thứ trong số đó mà không ai nhớ ra. Trái tim ở góc
ô là đường tắt cho tấm đã nhìn đủ; hai thao tác đó nằm chồng lên nhau trong một ô
128px nên có bài kiểm tra riêng ghim rằng bấm ô ảnh **mở xem**, còn trái tim mới
**chọn**. Mỗi chuỗi có một dòng đếm *đã chọn mấy tấm* để cuộn qua hai chục chuỗi
xong còn nhớ chuỗi nào đã xử lý.

Khung xem ảnh vì thế nhận **một danh sách** thay vì luôn bám vào lưới: `null` là
lưới, một mảng id là một chuỗi. Mở từ lưới luôn xoá chuỗi đang giữ — quên bước đó
thì mở một tấm ở lưới ngay sau khi vừa xem một chuỗi sẽ lật nhầm danh sách.

Màn xem trước `/uipreview/anh-trung-khach` mở được khối này mà không cần album
thật (`groups` vốn đã là prop có kiểm soát nên không phải thêm cửa hậu nào vào
code chạy thật). Chính nó bắt được một lỗi thật: `scanSupported()` đọc `window`
nên gọi lúc dựng cho ra `false` ở máy chủ và `true` ở lượt hydrate đầu — React
vứt toàn bộ HTML máy chủ và vẽ lại cả trang album bằng JavaScript, kèm một loạt
lỗi hydrate trong console. Nay hỏi trong effect.

*Không tốn tài nguyên máy chủ.* Toàn bộ phép đo chạy trong trình duyệt khách —
không có route nào, không hàm serverless nào được gọi để tính. Ảnh dùng để quét
là **chính ảnh xem trước của lưới** (`/api/img`, cùng file id + cùng chiều rộng),
mà route đó trả `s-maxage=31536000, immutable` nên CDN của Vercel phục vụ lượt
lặp **không đánh thức hàm**, và service worker còn giữ sẵn 600 tấm trên máy. Quét
một album khách đã cuộn qua gần như không phát sinh yêu cầu nào.

### Bỏ chọn tất cả

Trước đây khách chọn nhầm cả trăm tấm thì chỉ có cách bấm bỏ từng tấm. Nay có
*Tác vụ → Bỏ chọn tất cả*, xoá cả ảnh đã chọn, ảnh không thích lẫn ghi chú.

**Hai bước, và nói rõ số sắp mất** (*"Bỏ hết lựa chọn? Sẽ mất 87 ảnh đã chọn"*)
chứ không hỏi chung chung *"bạn chắc chứ?"*: xoá một buổi chiều ngồi chọn ảnh
cưới bằng một cú bấm nhầm là thứ không có đường lùi — sổ trên máy ghi đè ngay, và
bản trên máy chủ bị đè ở lượt lưu kế tiếp.

Nó đi qua **đúng đường của một lượt sửa bình thường** (`recordEdit`) chứ không
gọi thẳng máy chủ: nhờ vậy cũng được sổ trên máy ghi lại, cũng thử lại khi mất
mạng, và cũng hoà giải đúng nếu album đang mở trên một điện thoại khác. Hai tính
chất đó được ghim bằng test: một vòng đọc lại chạy xen vào **không** kéo lựa chọn
vừa xoá quay về, và "xoá hết" **không** phải quyền phủ quyết — tấm mà máy kia vừa
chọn thêm vẫn được giữ.

Sổ ngoại tuyến `src/lib/album-offline.ts` (thuần) · chỗ cất
`src/lib/album-store.ts` · manifest `src/lib/client-manifest.ts` · cổng khách
`src/lib/portal-device.ts` · gợi ý ảnh trùng `AlbumDuplicateFinder.tsx` +
`duplicateGroups()`/`duplicatesToHide()` ở `src/lib/photo-ai.ts`.
Test `npm run test:album-offline` (42 ca, gồm đúng ba tình huống dễ vỡ: poll đè
mất lựa chọn vừa bấm, hai điện thoại cùng một link, và viên trạng thái nói dối) ·
`npm run test:portal-device`.

## ✅ 6. Việc tự động theo trạng thái

**Tám luật**, mỗi luật một công tắc, ở *Dịch vụ & điều khoản → Việc tự động*.
Chạy mỗi ngày lúc 6:30 sáng (`/api/cron/automations`, đặt trước nhịp email nhắc
việc 7:00 để việc sinh ra kịp vào email đó).

Ký xong → nhắc thu cọc · trước buổi chụp N ngày → chốt ê-kíp · sát buổi chụp →
gọi khách xác nhận · sát buổi chụp → nhắn khách · quá hạn thanh toán N ngày →
báo chuông · khách chọn xong ảnh → bắt đầu hậu kỳ · giao ảnh xong → xin đánh giá
· hoàn thành → cảm ơn & xin giới thiệu.

**Cố ý KHÔNG làm trình dựng luật.** Tập *khi* và tập *thì* đều ĐÓNG và khai
trong code; bảng DB chỉ giữ cấu hình cho tám luật đó. Studio cần tám việc đúng,
bật/tắt bằng công tắc — không cần một Zapier.

**Ba luật gửi Zalo cho KHÁCH đều TẮT sẵn.** Một tin nhắn tự động gửi sai lúc là
thứ khách nhìn thấy, nên studio phải tự đọc lại câu chữ rồi mới bật. Năm luật
còn lại chỉ sinh việc/chuông trong nhà nên bật sẵn được.

**Email là kênh DỰ PHÒNG của ba luật đó — gửi một trong hai, không bao giờ cả
hai.** Khách Việt đọc Zalo, nên Zalo là kênh chính. Nhưng gửi Zalo đòi studio nối
OA hoặc phiên cá nhân, mà phần lớn studio chưa làm: không có dự phòng thì ba luật
bật lên vẫn không tới được ai, còn studio thì tưởng đã nhắn rồi. Nay chưa nối
Zalo (hoặc khách chỉ để email — khách công ty, khách nước ngoài) thì thư đi thay.

Và khi **không còn đường nào** (chưa nối Zalo, khách không email) thì việc đó
**không được đánh dấu** đã chạy — để mai studio nối Zalo hoặc điền email khách là
nó đi được. Đánh dấu một việc chưa có đường ra chính là cách làm mất hẳn nó.

**Điều quan trọng nhất là CHẠY MỘT LẦN**, và nó có hai lớp. Cron chạy mỗi ngày;
một luật thiếu chống lặp sẽ đẻ ra 30 việc giống nhau trong một tháng — studio sẽ
tắt cả tính năng, và đúng ra là họ nên tắt. Lớp một: nạp khoá đã chạy rồi truyền
vào bộ luật. Lớp hai: `studio_automation_log.dedupe_key` là UNIQUE, và cron **ghi
dấu TRƯỚC khi làm**. Thứ tự đó lệch với trực giác nhưng cố ý: làm trước rồi ghi
sau, một lỗi giữa hai bước sẽ khiến việc đã làm mà không có dấu → ngày mai làm
lại; với một tin Zalo gửi khách thì gửi hai lần tệ hơn hẳn không gửi lần nào.

Luật "còn N ngày tới buổi chụp" dùng `≤ N` chứ không `= N`: cron có thể lỡ một
nhịp (Vercel lỗi, project mới bật), và đòi khớp chính xác là mất hẳn việc đó.
Khoá chống lặp lo phần "chỉ một lần". Mỗi đợt thanh toán quá hạn là một khoá
riêng (`ref` = id đợt), nên hợp đồng chia 4 đợt không bị gộp mất ba.

Migration `supabase/migrations/automations.sql` · luật `src/lib/automations.ts` ·
test `npm run test:automations` (60 ca, phần lớn là "chạy lần hai không sinh gì").

## ✅ 7. Chấm công & lịch rảnh của thợ

Thợ **không có tài khoản đăng nhập** (sổ thợ khoá theo số điện thoại), nên chấm
công đi qua **cổng thợ công khai** `/crew`: đúng **hai cái nút** — *Đã đến* khi
tới, *Đã xong* khi rời. Thợ mở nó trên điện thoại, ở phim trường, một tay đang
cầm máy.

Màn Đối soát tiền công giờ hiện **giờ làm thực tế** ngay cạnh tiền, lọc đúng kỳ
đang xem, kèm đề xuất *"≈ 640.000₫ theo giờ"* khi studio đã khai đơn giá giờ cho
thợ đó.

**Đề xuất, KHÔNG tự ghi vào sổ lương.** Tiền trả cho người thật; studio phải nhìn
số giờ, đối chiếu, rồi tự áp dụng. Một phép nhân tự động ghi thẳng vào
`contract_crew.salary` là cách nhanh nhất để mất lòng tin của cả thợ lẫn chủ.

**Dòng còn hở không được tính là 0 giờ.** Thợ bấm bắt đầu rồi quên bấm xong thì
`sessionHours` trả `null`, và bảng lương **đếm riêng** ("2 buổi chưa chốt giờ")
thay vì cộng 0. Tính 0 nghĩa là bảng báo thợ đi làm cả ngày mà không được đồng
nào, và không ai phát hiện ra vì con số vẫn "có". Buổi dài quá 16 giờ cũng vào
nhóm đó — gần như chắc chắn là quên bấm, không phải làm thật.

Chụp tiệc 19:00 → 02:00 hôm sau tính đúng 7 giờ, và nằm trong kỳ của **ngày
chụp** (cột `work_date` tách khỏi `started_at`) chứ không nhảy sang tháng sau.
Ràng buộc DB chỉ cho **một dòng đang mở** mỗi thợ, nên bấm hai lần vì mạng chậm
không làm giờ bị tính đôi.

Thợ cũng tự đăng ký **khoảng rảnh** được (ngược của "báo bận"), bằng một thẻ gọn
ở cổng thợ — **không** dựng thêm một lịch tháng thứ hai cạnh cái đã có để báo bận.

Luật ưu tiên: **báo bận THẮNG khai rảnh**, và **chưa khai gì = "chưa rõ"**, không
phải "rảnh" — phần lớn thợ sẽ không bao giờ vào khai, mà coi im lặng là rảnh sẽ
khiến màn phân công tự tin gán việc cho người đang đi làm chỗ khác.

**Và nửa còn lại của tính năng nằm ở chỗ phân công**, không ở cổng thợ: ô *Người
phụ trách* trong hộp thoại lịch studio giờ ghi thẳng *"— đã báo bận"* / *"— đang
rảnh"* vào từng dòng, theo đúng ngày của buổi đó. Một bảng "ai rảnh" để riêng
bên cạnh thì không ai mở; người xếp lịch quyết định ngay tại ô chọn, và một cảnh
báo hiện ra sau khi đã chọn thì đã muộn. Người "chưa rõ" để **trơn** — thêm chữ
cho cả ba trạng thái thì dòng nào cũng có đuôi và mắt không còn bắt được hai
trạng thái đáng chú ý.

Migration `supabase/migrations/crew_timesheet.sql` · luật `src/lib/timesheet.ts` ·
test `npm run test:timesheet`.

## ✅ 8. Nhà cung cấp & đơn đặt ngoài

Màn mới **Kho → Nhà cung cấp**, trả lời đúng câu studio hỏi mỗi ngày: *"đơn album
của khách A đã in xong chưa?"*. Nên danh sách xếp theo **mức cần chú ý** (quá hẹn
lên đầu), không theo ngày tạo.

Bốn trạng thái đúng đường đi: đã gửi → đang làm → đã nhận → đã giao khách. **Không
có "đã huỷ"**: đơn huỷ thì xoá, vì một đơn huỷ còn nằm trong danh sách sẽ tiếp
tục được cộng tiền và tiếp tục bị đếm là trễ hẹn.

**Tiền không đếm hai lần.** Mỗi đơn sinh ĐÚNG MỘT dòng `studio_expenses` mang
`vendor_order_id`, và sửa đơn thì **upsert** chính dòng đó — sửa giá ba lần vẫn
một dòng chi, không phải ba. Cột đó có UNIQUE index làm hàng rào thật, kể cả khi
hai tab cùng bấm lưu. Xoá đơn thì dòng chi đi theo (`on delete cascade`). Ngày
chi lấy theo **ngày hẹn xong**, không phải ngày tạo: chi phí thuộc kỳ mà công
việc được giao.

Đơn **đã giao khách** thì luôn "ok" dù hẹn đã qua từ lâu — để nó đỏ mãi là cách
chắc chắn để studio ngưng nhìn màu đỏ.

**Nối vào màn *Xử lý hình ảnh*** như mục 6 của bản gợi ý đòi: một khối *"Đơn đặt
ngoài đang chạy"* nằm cùng chỗ với tiến độ hậu kỳ, xếp theo mức cần chú ý, chỉ
những đơn **chưa giao khách**. Vì một hợp đồng chỉ xong khi cả hậu kỳ lẫn album
in cùng xong; bắt studio mở hai màn để ghép hai nửa đó là cách bỏ sót nửa thứ hai.

Migration `supabase/migrations/vendors.sql` · luật `src/lib/vendors.ts` ·
test `npm run test:vendors`.

## ✅ 9. Hoá đơn & xuất kế toán

**Phiếu thu** dùng CHUNG khung in với hợp đồng (`@/lib/contract-print`) — đúng
như đề xuất nói, không dựng hệ thống in thứ hai.

Hoá ra đã có một bản in phiếu thu tự ghép HTML tay, và nó **sai hai chỗ khách
cầm giấy về sẽ thấy**:

* *"Số phiếu"* là 8 ký tự đầu của UUID — không phải số, không theo thứ tự, kế
  toán không dùng được. Giờ số do DB cấp **nguyên tử** theo studio × năm
  (`PT-2026-0007`, hàm `next_receipt_no`) và **lưu lại**, nên in lại phiếu cũ vẫn
  ra đúng số cũ. Số chỉ cấp **khi in**, không cấp sẵn: studio ghi rồi xoá một
  khoản là chuyện thường, mà dãy số phiếu thủng lỗ chỗ thì kế toán không giải
  thích được.
* *"Đã thu luỹ kế"* lấy tổng của MỌI lần thu tính tới **hôm nay**. In lại một
  phiếu của ba tháng trước sẽ hiện số luỹ kế của hôm nay — sai. Giờ cộng đúng
  những lần thu **tới thời điểm của phiếu đó**.

Thêm dòng **"bằng chữ"** và kẹp *"còn lại"* ở 0 (khách trả dư thì tờ giấy không
được ghi số âm).

**Xuất kế toán**: một file Excel ba sheet — Thu · Chi · Công nợ — theo khoảng
ngày tuỳ ý (quý, nửa năm), không bó theo tháng như màn Thu chi. Sheet Công nợ ghi
rõ *"tại ngày …, không theo kỳ"* để kế toán không đọc nó như số của kỳ.

**Khoá sổ**: đánh một mốc ngày, mọi bút toán trước mốc coi như đã chốt. Báo cáo
tháng trước đã gửi kế toán rồi ai đó sửa một hợp đồng cũ là con số tháng trước
đổi mà không ai biết. Khoá **không xoá gì**, chỉ chặn ghi.

**Hàng rào nằm ở DB, không ở giao diện.** Một mốc ngày mà chỉ có React kiểm thì
vẫn là lời dặn miệng có màu: RLS cho studio ghi thẳng vào `studio_expenses` và
`contract_payments` bằng anon key, nên đúng cái tình huống cần chặn vẫn xảy ra y
như trước. Nay trigger `guard_books_closed()` chặn thêm/sửa/xoá trong kỳ đã chốt,
và xét **cả hai** mốc ngày cũ lẫn mới — dời một bút toán RA KHỎI kỳ đã khoá cũng
là làm đổi số của kỳ đó.

Trigger chỉ chặn thay đổi **động tới tiền** (số tiền, ngày, loại, hợp đồng). Đóng
dấu số phiếu thu, đính ảnh chuyển khoản, sửa ghi chú vẫn làm được trên phiếu cũ:
chặn cả những thứ đó thì studio sẽ đi mở khoá sổ chỉ để in một tờ phiếu, và cái
khoá thành vô nghĩa. Luật này được chép lại thành `blocksWrite()` trong
`src/lib/accounting.ts` để giao diện báo trước bằng tiếng Việt thay vì để khách
gặp lỗi Postgres — **sửa luật thì phải sửa cả hai nơi**, và test giữ hai bên khớp
nhau.

Migration `supabase/migrations/accounting.sql` · luật `src/lib/accounting.ts` ·
test `npm run test:accounting`.

## ✅ 10. Thời tiết & đường đi cho buổi chụp ngoại

Một dòng nhỏ trên thẻ lịch tuần (*Lịch làm việc → Lịch studio*): trời, khoảng
nhiệt, xác suất mưa — và khối đầy đủ trong hộp thoại lịch, ngay dưới ô địa điểm,
đúng lúc studio đang nghĩ về nơi chụp.

Nguồn: **Open-Meteo** — miễn phí, **không cần khoá API**. Chọn nó chính vì thế:
studio không phải đăng ký gì, và không có khoá nào để hết hạn giữa mùa cưới.

**Chỉ hiện cho lịch ngoài trời và chỉ trong 7 ngày.** Hiện dự báo mưa cho buổi
trang điểm trong phòng là nhiễu; hiện cho buổi chụp tháng sau là **bịa** —
Open-Meteo không có số thật ngoài 7 ngày, và studio sẽ xếp lịch theo con số đó.

**Gió giật tính CÙNG HẠNG với mưa.** Studio ngoại cảnh mất buổi vì gió cũng nhiều
như vì mưa: váy không giữ nếp, đèn đổ, phông bay. Đó là thứ studio biết mà một
bảng dự báo thông thường không nói. Dông thì rủi ro cao bất kể xác suất mưa.

Kèm **giờ vàng** (75→15 phút trước lúc lặn, theo giờ địa phương của điểm chụp) và
nói thẳng buổi này nằm trong hay ngoài giờ vàng.

**Thời gian di chuyển là ƯỚC LƯỢNG, và chữ đó nghiêm túc.** Repo không gọi API
chỉ đường (Google/Mapbox đều cần khoá và tính tiền theo lượt, mà tính năng này
chỉ để xếp lịch trong ngày). Đây là đường chim bay × 1,35 chia tốc độ trung bình
theo quãng đường. Đủ để trả lời *"sáng chụp chỗ này, chiều kịp chỗ kia không"*, và
**không đủ** để hẹn giờ với khách — nên màn hình luôn hiện kèm dấu `≈` và chữ
"ước lượng". Đừng bao giờ bỏ hai thứ đó đi.

Toạ độ tìm theo thứ tự rẻ-và-đúng trước: toạ độ đã lưu → toạ độ nằm sẵn trong
chuỗi địa điểm (link Google Maps studio dán vào) → tra tên địa danh. Vị trí
studio khai ở *Dịch vụ & điều khoản → Chính sách studio*; bỏ trống thì vẫn có dự
báo, chỉ không có dòng ước lượng đường đi.

Migration `supabase/migrations/weather.sql` · luật `src/lib/weather.ts` ·
test `npm run test:weather`.

## ✅ 11. Hai chỗ hở đã vá cùng đợt


**`setup-all.sql` thiếu tám migration.** File này là thứ dựng một project Supabase
MỚI, và nó được gộp từ mảng `ORDER` trong `supabase/build-setup-all.mjs`. Thêm
file SQL mà quên thêm dòng vào `ORDER` là **lỗi im lặng**: repo có bảng, project
mới thì không, và app chạy được tới lúc ai đó mở đúng màn dùng bảng ấy.

Tám file đã bị bỏ quên như thế (`album_selection_done`, `watermark_opt_in`,
`rls_thanh_vien_hop_dong`, `automations`, `crew_timesheet`, `vendors`,
`accounting`, `weather`). Đã thêm và dựng lại.

Và để nó **không tái diễn**: script giờ tự đối chiếu `ORDER` với thư mục
`migrations/` rồi DỪNG nếu thiếu file nào, còn `npm run test:setup-all` kiểm
thêm rằng `setup-all.sql` trên đĩa chưa cũ so với các file SQL.

**Tài liệu chỉ ghi TÊN các migration cần chạy.** `setup-all.sql` là để dựng
project TRẮNG; chủ studio đã có database chạy thật thì phải chạy đúng phần mới, và
chỗ duy nhất nói phần mới gồm những gì là một dòng liệt kê **tên file**. Chuyện
xảy ra đúng như phải xảy ra: người dùng dán chính dòng tên đó vào SQL Editor và
nhận `syntax error at or near "accounting"`. Kể cả khi hiểu đúng, mở tám file rồi
dán tám lượt cũng là tám cơ hội bỏ sót một cái — mà bỏ sót một migration thì lại
đúng kiểu hỏng âm thầm ở trên.

Nay có [`supabase/cap-nhat.sql`](../supabase/cap-nhat.sql): **một file, dán một
lần**. Nó sinh ra từ cùng bộ máy với `setup-all.sql` (cùng cách xếp lại ba nhịp
bảng → vá cột → phân quyền, vì trong file gốc nhiều policy đứng trước bảng chúng
tham chiếu) và cùng chịu `--check`, nên không thể cũ đi trong im lặng. Danh sách
nằm ở mảng `MOI`; bộ sinh **từ chối** chạy nếu `MOI` có file không nằm trong
`ORDER`, hoặc nếu thứ tự trong `MOI` lệch thứ tự chạy của `ORDER` — hàng rào ấy
bắt được lỗi ngay lần đầu tôi viết mảng đó.

**Và không file SQL nào từng được CHẠY THỬ.** `test:setup-all` chỉ đối chiếu văn
bản: nó chứng minh file khớp với các migration trong repo, không chứng minh chuỗi
ấy chạy được. Một lỗi cú pháp, một cột trỏ tới bảng chưa tạo, một thứ tự sai —
tất cả lọt qua bài đối chiếu và chỉ lộ ra khi chủ studio dán vào SQL Editor, giữa
chừng, sau khi đã ghi được một nửa. `npm run test:sql-chay-that` dựng một
PostgreSQL trắng rồi chạy thật cả hai tình huống: project mới tinh nuốt trọn
`setup-all.sql`, và project đang chạy (dựng bằng `ORDER` trừ `MOI`) nuốt trọn
`cap-nhat.sql` — hai lần liên tiếp, để chứng minh chạy lại vô hại. Rồi kiểm đúng
thứ mỗi migration hứa tạo ra: bảng, chỉ mục duy nhất, ràng buộc 128 chiều, policy
RLS, trigger khoá sổ, và từng cột. Máy không có PostgreSQL thì bài này **bỏ qua**
chứ không báo hỏng.

**Lỗi DB bị nuốt ở các bút toán tiền.** Thêm/xoá một khoản chi và xoá một lần thu
đều bỏ qua `error` trả về: dòng biến khỏi màn hình (hoặc form đứng im) nhưng DB
không đổi, và studio chỉ biết khi tải lại trang — hoặc không bao giờ. Hàng rào
khoá sổ vừa thêm ở mục 9 làm đúng những lệnh đó bị chối, nên chúng **phải** nói
ra được. Giờ cả hai hiện đúng câu lỗi của DB, và màn Thu chi báo trước bằng
`blocksWrite()` (bản sao ở tầng code của trigger) thay vì để studio đâm vào lỗi
Postgres.

Nặng hơn: bốn chỗ ở màn hợp đồng ghi `contract_payments` rồi **ghi tiếp**
`contract_payment_plan` bất kể vế đầu có thành công hay không. Vế đầu bị chối là
hai bảng lệch nhau ngay — đợt hiện *"đã thu"* mà không có lần thu nào phía sau,
hoặc gỡ dấu *"đã thu"* trong khi lần thu vẫn nằm trong sổ (**doanh thu đếm hai
lần**), và không màn nào nói ra. Giờ vế đầu hỏng là **dừng**, kèm câu lỗi.
