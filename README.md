# Handoff: Nâng cấp giao diện quản lý studio (mstudo)

> **Đọc file này trước.** Nó tự đủ — một dev chưa từng tham gia cuộc trao đổi vẫn làm được.

## Tóm tắt

Thiết kế lại toàn bộ khu **quản lý studio** của repo `vieetjk01/Studio` (branch `claude/stoic-fermi-gf0pg4`): 46 màn desktop + 11 màn mobile, gộp nav từ ~40 mục rời rạc xuống 24 mục / 7 nhóm, thêm 14 tính năng mới. Trang chủ / landing **không** thuộc phạm vi này.

## Về file thiết kế trong gói

`Quản lý Studio.dc.html` là **bản thiết kế tham chiếu viết bằng HTML**, không phải code để chép thẳng. Nhiệm vụ là **dựng lại các màn này trong môi trường sẵn có của repo** — Next.js App Router + React + TypeScript + Tailwind — theo đúng quy ước đang dùng ở đó, chứ không phải nhúng file HTML vào.

File chạy được: mở trực tiếp trong trình duyệt, bấm qua lại được mọi màn, có modal / filter / tab / ⌘K / dark mode chạy thật. Dùng nó làm nguồn tra cứu trực quan trong lúc code.

## Độ hoàn thiện: **Hi-fi**

Màu, chữ, khoảng cách, bo góc, trạng thái hover đều là giá trị cuối. Dựng lại **đúng pixel**, dùng thư viện và pattern sẵn có của repo. Dữ liệu trong file là dữ liệu mẫu — thay bằng dữ liệu thật từ Prisma/API.

---

## Thứ tự triển khai đề xuất

Làm theo đúng thứ tự này, mỗi bước là một PR:

1. **Design token** → `src/app/globals.css`. Một lần, ảnh hưởng toàn bộ.
2. **Khung app** → `src/components/StudioShell.tsx` (sidebar + topbar + ⌘K + dark mode). Sau bước này cả 46 màn cũ đã trông mới.
3. **Tổng quan** → `src/app/dashboard/studio/page.tsx`.
4. **Hợp đồng + Chi tiết hợp đồng** → nhóm màn dùng nhiều nhất.
5. **Lịch, Khách hàng, Tài chính, Đối soát**.
6. Phần còn lại theo bảng ánh xạ.

---

## Design token

Đặt trong `:root` của `globals.css`. Bản dark ghi đè bằng `[data-theme="dark"]`.

### Màu

| Biến | Sáng | Tối | Dùng cho |
| --- | --- | --- | --- |
| `--ac` | `#AF2BB8` | giữ nguyên | Màu nhấn thương hiệu |
| `--acS` | `color-mix(in srgb, var(--ac) 10%, #fff)` | `color-mix(in srgb, var(--ac) 22%, #1D1B23)` | Nền nhạt của màu nhấn |
| `--acM` | `color-mix(in srgb, var(--ac) 18%, #fff)` | `color-mix(in srgb, var(--ac) 36%, #1D1B23)` | Viền focus |
| `--acD` | `color-mix(in srgb, var(--ac) 84%, #000)` | `color-mix(in srgb, var(--ac) 76%, #fff)` | Hover nút chính |
| `--bg` | `#F3F1EE` | `#15141A` | Nền trang |
| `--sf` | `#FFFFFF` | `#1D1B23` | Nền thẻ / bảng |
| `--sf2` | `#F7F5F2` | `#24222B` | Nền phụ, ô input |
| `--bd` | `#E7E3DE` | `#332F3C` | Viền chính |
| `--bd2` | `#EFECE7` | `#2B2934` | Viền phân cách hàng |
| `--tx` | `#1A1A1C` | `#F1EFF4` | Chữ chính |
| `--tx2` | `#5C5B60` | `#B4B0BE` | Chữ phụ |
| `--tx3` | `#8B8A90` | `#847F8F` | Chữ mờ, nhãn |
| `--gn` / `--gnS` | `#14855C` / `#E4F4EC` | `#4ED8A0` / `#17352A` | Thành công, đã thu |
| `--am` / `--amS` | `#A9740A` / `#FBF0DA` | `#E5B65E` / `#3B3019` | Cảnh báo, chờ xử lý |
| `--bl` / `--blS` | `#2062C4` / `#E7EFFC` | `#7EADF6` / `#1D2B45` | Thông tin |
| `--rd` / `--rdS` | `#C13C3C` / `#FBEAEA` | `#F18787` / `#3E2023` | Lỗi, quá hạn |

Màu avatar (hash tên → chọn 1 trong 8): `#8E2DA8 #2F5FD0 #BC5B5B #A9791F #177A5B #5B4BC4 #C0642B #2F8F8A`. Nền avatar = `color-mix(in srgb, <màu> 14%, #fff)`, chữ = màu gốc.

### Chữ

Font: **Be Vietnam Pro** (400/500/600/700/800) + **Material Symbols Rounded** (weight 300, FILL 0).

| Vai trò | Cỡ | Đậm | Ghi chú |
| --- | --- | --- | --- |
| Tiêu đề trang lớn | 24px | 750 | `letter-spacing:-.6px` |
| Tiêu đề màn | 19–21px | 750 | `letter-spacing:-.4px` |
| Tiêu đề topbar | 16.5px | 750 | `letter-spacing:-.3px` |
| Tiêu đề thẻ | 14px | 700 | |
| Số liệu KPI | 22–25px | 750 | `letter-spacing:-.7px`, `tabular-nums` |
| Nội dung hàng | 13.5px | 650 | |
| Nội dung phụ | 12.5px | 550–600 | màu `--tx2` |
| Chú thích | 11.5px | 400–600 | màu `--tx3` |
| Nhãn viết hoa | 10.5–11px | 700–800 | `letter-spacing:.5–.7px`, `uppercase` |
| Pill trạng thái | 11–11.5px | 650 | |

Mọi con số tiền/ngày dùng `font-variant-numeric: tabular-nums`.

### Khoảng cách & hình khối

- Bo góc: thẻ `14px`, thẻ nhỏ/ô nhập `10–11px`, nút `9–10px`, pill `20px`, avatar `50%`
- Padding thẻ: `15–18px 16–20px`; hàng bảng: `12–13px 18px`
- Gap lưới: `12px` (thẻ), `14px` (khối lớn)
- Đổ bóng: thẻ **không có bóng**, chỉ dùng viền. Modal `0 24px 70px rgba(20,15,25,.28)`. Toast `0 12px 34px rgba(20,15,25,.3)`.
- Chuyển động: `transition: background .14s`; modal `pop .2s ease`; nội dung trang `fadeUp .3s ease`

### Ngưỡng responsive (đã kiểm chứng, đừng đổi tuỳ tiện)

| Ngưỡng | Xảy ra gì |
| --- | --- |
| `< 1240px` | Bảng Hợp đồng (min-width 1120px) và Khách hàng (940px) cuộn ngang. **Thẻ bao phải `overflow-x:auto`, không được `overflow:hidden`.** |
| `< 1180px` | Bố cục 2 cột có rail phải → 1 cột; rail bỏ `position:sticky`; lịch nhân sự cuộn ngang |
| `< 1120px` | Ẩn thanh chuyển vai trò trên topbar |
| `< 1100px` | Lưới thẻ 3 cột → 2 cột; ẩn dòng tên job trong ô lịch nhân sự |
| `< 1000px` | Ẩn tên người dùng cạnh avatar |

**Bài học đã trả giá:** mọi cột grid phải là `minmax(<px tối thiểu>, <fr>)`, không bao giờ để `fr` trần. Pill trạng thái, ngày giờ, số tiền, badge, nút icon phải có `flex:none` + `white-space:nowrap` — nếu không chúng sẽ là thứ duy nhất co lại và vỡ chữ.

---

## Bảng ánh xạ màn ↔ file repo

| # | Màn | Route | File nguồn trong repo |
| --- | --- | --- | --- |
| 1 | Khung app (sidebar, topbar, ⌘K) | — | `src/components/StudioShell.tsx` |
| 2 | Tổng quan | `dashboard` | `src/app/dashboard/studio/page.tsx` |
| 3 | Báo giá | `quotes` | `studio/quotes/QuotesListView.tsx` |
| 4 | Chi tiết báo giá | `quote` | `studio/quotes/[id]/` |
| 5 | Tạo báo giá | `newq` | `studio/quotes/new/` |
| 6 | Hợp đồng & lịch hẹn | `contracts` | `studio/contracts/ContractsListView.tsx`, `src/lib/contract-filter.ts` |
| 7 | Chi tiết hợp đồng | `detail` | `studio/contracts/[id]/`, `src/lib/contract-status.ts` |
| 8 | Tạo hợp đồng (5 bước) | `newc` | `studio/contracts/new/` |
| 9 | Hợp đồng gửi khách | `share` | `studio/contracts/[id]/share/`, trang công khai `app/c/[token]/` |
| 10 | Bảng công việc (kanban) | `board` | `studio/board/BoardView.tsx` |
| 11 | Đặt lịch khách | `bookings` | `studio/bookings/BookingsView.tsx` |
| 12 | Chi tiết đặt lịch | `booking` | `studio/bookings/[id]/` |
| 13 | Yêu cầu mới | `leads` | `studio/leads/LeadsView.tsx` |
| 14 | Lịch làm việc (4 chế độ) | `calendar` | `studio/calendar/CalendarView.tsx`, `team/TeamCalendar.tsx` |
| 15 | Chế độ ngày chụp | `field` | `studio/field/`, `src/lib/field-mode.ts` |
| 16 | Xử lý hình ảnh | `production` | `studio/production/ProductionView.tsx` |
| 17 | Thư viện album | `albums` | `dashboard/AlbumList.tsx` |
| 18 | Album chọn ảnh (chi tiết) | `album` | `dashboard/albums/[id]/AlbumEditor.tsx` |
| 19 | Phòng váy | `rental` | `studio/rental/RentalManager.tsx` |
| 20 | Chi tiết trang phục | `rentalitem` | `studio/rental/[id]/` |
| 21 | Thiết bị | `equipment` | `studio/equipment/EquipmentManager.tsx` |
| 22 | Chi tiết thiết bị | `equipitem` | `studio/equipment/[id]/` |
| 23 | Khách hàng | `clients` | `studio/clients/ClientsView.tsx` |
| 24 | Hồ sơ khách | `client` | `studio/clients/[id]/` |
| 25 | Thiệp · Story · Slide | `digital` | `studio/thiep/`, `studio/story/`, `studio/slide/` |
| 26 | Tạo thiệp cưới | `cardmaker` | `studio/thiep/new/` |
| 27 | Tạo Love Story | `storymaker` | `studio/story/new/` |
| 28 | Tạo Slide cưới | `slidemaker` | `studio/slide/new/` |
| 29 | Thiết kế album | `designer` | `studio/album-designer/` |
| 30 | Dàn trang album | `spread` | `studio/album-designer/[id]/` |
| 31 | Thu chi & công nợ | `finance` | `studio/reports/ReportsView.tsx` |
| 32 | Thêm khoản chi | `expense` | `studio/expenses/new/` |
| 33 | Đối soát tiền công | `payroll` | `studio/payroll/PayrollView.tsx` |
| 34 | Báo cáo | `reports` | `studio/reports/ReportsView.tsx` |
| 35 | Đội ngũ | `crew` | `studio/crew/CrewManager.tsx`, `staff/StaffManager.tsx` |
| 36 | Hồ sơ nhân sự | `member` | `studio/crew/[id]/` |
| 37 | Xếp hạng | `ranking` | `studio/ranking/page.tsx` |
| 38 | Mẫu tin nhắn | `messages` | `studio/messages/MessagesManager.tsx` |
| 39 | Sửa mẫu tin nhắn | `msgedit` | `studio/messages/[id]/` |
| 40 | Gói & bảng giá | `packages` | `studio/packages/PackagesManager.tsx`, `pricing/PricingManager.tsx` |
| 41 | Sửa gói dịch vụ | `pkgedit` | `studio/packages/[id]/` |
| 42 | Dịch vụ & điều khoản | `services` | `studio/services/ServicesManager.tsx`, `src/lib/contract-clauses.ts` |
| 43 | Website & chatbox | `web` | `studio/chatbox/ChatboxConfig.tsx`, `dashboard/site/` |
| 44 | Giao diện website | `sitebuild` | `dashboard/site/SiteRenderer.tsx` |
| 45 | Công cụ ảnh | `tools` | `dashboard/filter/`, `dashboard/compress/`, `studio/drive-sync/` |
| 46 | Lọc ảnh khách chọn | `toolfilter` | `dashboard/filter/` |
| 47 | Nén ảnh & watermark | `toolcompress` | `dashboard/compress/` |
| 48 | Cài đặt studio | `settings` | `dashboard/settings/SettingsPanel.tsx` |
| 49 | Cài đặt chi tiết (6 mục) | `setdetail` | `dashboard/settings/[section]/` |
| 50 | Thông báo | `notifications` | `studio/notifications/NotificationsList.tsx` |
| 51 | Tài khoản & bảo mật | `account` | `dashboard/account/AccountPanel.tsx` |
| 52 | Gói phần mềm | `upgrade` | `dashboard/upgrade/page.tsx`, `src/lib/plans.ts` |
| 53 | Affiliate | `affiliate` | `dashboard/affiliate/page.tsx` |
| 54 | Ứng dụng máy tính | `desktop` | `studio/desktop/DesktopPanel.tsx` |
| 55 | Quản trị hệ thống | `admin` | `dashboard/admin/AdminPanel.tsx` |

Trong file thiết kế, mỗi màn nằm trong một `<sc-if value="{{ isXxx }}">` — tìm theo tên route ở bảng trên.

---

## Cấu trúc điều hướng

Sidebar 250px, cố định, 7 nhóm. Nhãn nhóm 10px/800/uppercase màu `--tx3`. Mục đang mở: nền `--acS`, chữ `--ac`, đậm 700.

```
(không nhãn)  Tổng quan
Bán hàng      Báo giá(2) · Hợp đồng & lịch hẹn · Bảng công việc · Đặt lịch khách(3) · Yêu cầu mới(3)
Vận hành      Lịch làm việc · Xử lý hình ảnh(4) · Thư viện album · Phòng váy · Thiết bị
Khách hàng    Khách hàng · Thiệp·Story·Slide · Thiết kế album(2)
Tài chính     Thu chi & công nợ · Đối soát tiền công(2) · Báo cáo
Nhân sự       Đội ngũ · Xếp hạng · Mẫu tin nhắn
Thiết lập     Gói & bảng giá · Dịch vụ & điều khoản · Website & chatbox · Công cụ ảnh · Cài đặt studio
Tài khoản     Thông báo(5) · Tài khoản & bảo mật · Gói phần mềm · Affiliate · Ứng dụng máy tính · Quản trị hệ thống
```

Số trong ngoặc là badge đếm. Chân sidebar: thẻ trạng thái đồng bộ Drive + số phiên bản.

**Topbar** (sticky, nền `rgba(255,255,255,.86)` + `backdrop-filter:blur(12px)`): tiêu đề + phụ đề trang · ô ⌘K · nút dark mode · chuông thông báo · chuyển vai trò · avatar (bấm → Tài khoản).

### Phân quyền

Ba vai trò lọc danh sách route hiển thị:

- **Chủ studio** — thấy tất cả
- **Quản lý** — mọi thứ trừ Tài chính, Đối soát, Báo cáo, Gói phần mềm, Affiliate, Quản trị hệ thống
- **Nhân sự** — chỉ: Tổng quan, Hợp đồng, Chi tiết HĐ, Lịch, Xử lý hình ảnh, Album, Thông báo, Tài khoản

Trong bản HTML đây là mảng `allowed` trong `renderVals()`. Ở repo thật nên chuyển thành middleware + kiểm tra ở server component.

---

## Trạng thái hợp đồng

Đổi **nhãn hiển thị** sang tiếng Việt dễ hiểu, **giữ nguyên giá trị enum** trong DB. Cập nhật `CONTRACT_STATUS_LABEL` ở `src/lib/types.ts`:

| enum | Nhãn mới | Màu chữ | Nền |
| --- | --- | --- | --- |
| `draft` | Nháp | `#6B6A70` | `#F0EEEB` |
| `sent` | Chờ khách duyệt | `#A9740A` | `#FBF0DA` |
| `approved` | Khách đã duyệt | `#2062C4` | `#E7EFFC` |
| `in_progress` | Đang thực hiện | `#8E2DA8` | `#F8E9FA` |
| `completed` | Hoàn thành | `#14855C` | `#E4F4EC` |
| `cancelled` | Đã huỷ | `#C13C3C` | `#FBEAEA` |

Pill trạng thái = chấm tròn 6px cùng màu chữ + nhãn, `padding:5px 11px`, `border-radius:20px`, `white-space:nowrap`.

**Stepper vòng đời 7 bước** (thay dropdown trạng thái ở màn chi tiết):
`Báo giá → Ký hợp đồng → Phân công → Nhận cọc → Chụp → Hậu kỳ → Giao album`
Bước xong: nền `--gn` + icon `check`. Bước hiện tại: nền `--ac`. Bước chưa tới: nền `--sf2`, viền `--bd`.

---

## 14 tính năng mới (không có trong bản cũ)

| # | Tính năng | Mô tả | Nằm ở |
| --- | --- | --- | --- |
| 1 | Hàng đợi "Cần xử lý ngay" | 6 việc gấp, mỗi dòng có nút hành động tại chỗ | Tổng quan |
| 2 | Ô lệnh ⌘K | Tìm không dấu across hành động + hợp đồng + khách + nhân sự | Toàn app |
| 3 | Cảnh báo lãi mỏng | Biên < 45% → khối cảnh báo đỏ trước khi gửi khách ký | Bước 5 tạo HĐ |
| 4 | Lịch theo nhân sự | Mỗi người 1 hàng × 7 ngày, cột tải tuần đổi màu | Lịch, tab 4 |
| 5 | Cam kết giao ảnh | Đếm ngược theo điều khoản (gốc 7 ngày, chỉnh 21 ngày) | Tổng quan |
| 6 | Cảnh báo dồn lịch | 1 ngày ≥3 buổi, hoặc 1 người ≥4 ngày/tuần | Tổng quan |
| 7 | Chốt đối soát theo job | Job xong là chốt tiền ngay, không đợi cuối tháng | Đối soát, tab 2 |
| 8 | Xem như khách trên điện thoại | Preview 376px có status bar + address bar | Hợp đồng gửi khách |
| 9 | Hoàn tác trong toast | Nút "Hoàn tác" sống 5 giây sau hành động khó gỡ | Toàn app |
| 10 | Trạng thái trống có hướng dẫn | Icon + câu giải thích + nút hành động | 4 màn danh sách |
| 11 | Nhân bản hợp đồng | "Tạo giống HĐ này" → nhảy vào bước 2 đã điền sẵn | Chi tiết HĐ |
| 12 | Chế độ ngày chụp | Chữ 16–28px, nút 56px, lịch trình + checklist ảnh theo loại buổi | Route riêng |
| 13 | Ghi chú nội bộ @nhắc tên | Luồng trao đổi trong hợp đồng, @tên được highlight | Chi tiết HĐ, tab 5 |
| 14 | Dark mode | Ghi đè 19 biến màu, giữ nguyên màu nhấn | Toàn app |

### Chi tiết một số tính năng

**⌘K** — bắt `metaKey/ctrlKey + k` ở `window`, `Escape` để đóng. So khớp bằng chuỗi đã bỏ dấu: `s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d").toLowerCase()`. Nhóm kết quả theo loại, mỗi loại có pill màu riêng. Kết quả đầu tiên highlight nền `--sf2`.

**Chế độ ngày chụp** — lịch trình phải sinh ra từ `t1`/`t2` của chính hợp đồng (bước đầu = `t1 − 30 phút`, các bước sau chia đều tới `t2`). Checklist ảnh chọn theo loại buổi, nhận diện bằng regex trên `svc + title`: cưới / sơ sinh / kỷ yếu / doanh nghiệp / chân dung.

Đã dựng ở `src/lib/field-mode.ts` (tính thuần, không React) + `studio/field/`. Vài điểm khi ghép vào dữ liệu thật của repo:

- `studio_contracts` chỉ có MỘT cột giờ (`event_time`), không có giờ kết thúc. Nên `t1` = sớm nhất trong (giờ phân công `contract_crew.start_time` → `event_time` → `intake.start_time`), `t2` = muộn nhất của `contract_crew.end_time`. Không có giờ phân công thì `t2` = `t1` + độ dài mặc định theo loại buổi (cưới 10h, kỷ yếu 5h, doanh nghiệp 6h, sơ sinh/chân dung 3h).
- Tiệc tan **01:00** nghĩa là rạng sáng hôm sau, không phải dữ liệu hỏng: `t2 < t1` được cộng 24h, và mốc trong lịch trình giữ cả số phút chưa quay vòng (`RunStep.atMin`) để so thứ tự cho đúng.
- Chặng đang chạy bám theo đồng hồ; thợ bấm vào một chặng để tự ghim, bấm lại để thả. Ô tick checklist ảnh và chặng đã ghim lưu ở `localStorage` theo id hợp đồng — ngoài hiện trường sóng chập chờn, mà đây cũng chỉ là ghi chú thao tác của thợ.
- Nút **"Xong buổi chụp"** đưa hợp đồng sang `in_progress` (bước "Chụp" trong vòng đời 7 bước suy ra từ trạng thái này, không có cột riêng), rồi ở lại màn này để thợ chuyển sang buổi kế trong ngày.

**Cảnh báo lãi mỏng** — `biên = (tổng HĐ − tiền công nhân sự − chi phí sản xuất) / tổng HĐ`. Dưới 45% đỏ, 45–60% vàng, trên 60% xanh.

**Xem như khách trên điện thoại** — khung xem trước nhúng THẲNG trang khách thật `/c/<token>` bằng iframe, không vẽ lại nội dung hợp đồng (vẽ lại thì mỗi lần trang khách đổi, bản xem trước lại nói dối). Một chỗ dễ sập: app đặt `X-Frame-Options: SAMEORIGIN` + `frame-ancestors 'self'`, nên studio có tên miền riêng mà nhúng link branded sẽ bị trình duyệt chặn, khung trắng trơn. Vì `/c/<token>` chạy trên cả host chính lẫn host studio và ra cùng nội dung, iframe dùng đường dẫn **cùng gốc**, còn link hiện / nút chép / mã QR vẫn là bản branded.

**Ghi chú nội bộ @nhắc tên** — bảng MỚI `contract_notes` (chạy `supabase/migrations/contract_notes.sql` trước khi dùng). RLS cùng luật với các bảng con khác của hợp đồng: mọi thành viên studio đọc/ghi được, studio khác không thấy gì. Khách không bao giờ thấy — trang `/c/<token>` không đọc bảng này.

Bộ tách @nhắc-tên nằm ở `src/lib/mentions.ts` (thuần, tách khỏi component để kiểm được). Ba luật: chỉ khớp tên CÓ THẬT trong ê-kíp/nhân viên (nên `a@b.com` không bị tô); tên dài thử trước tên ngắn (có cả "Thảo" lẫn "Thảo Huỳnh" thì `@Thảo Huỳnh` khớp trọn họ tên); gõ không dấu vẫn khớp, và cột `mentions` lưu **tên chuẩn** chứ không lưu bản người dùng gõ — nếu không thì sau này lọc theo tên hay gửi thông báo đều trượt.

Mốc thời gian dùng `fmtWhen()` ở `src/lib/date.ts`, luôn quy về giờ Việt Nam. Dùng `getHours()` cục bộ thì máy chủ (UTC trên Vercel) và máy khách (UTC+7) dựng ra hai chuỗi khác nhau → React báo lỗi hydration và vẽ lại cả cây.

**Hoàn tác trong toast** — `useUndoToast()` ở `src/components/studio/UndoToast.tsx`. Hoãn việc xoá 5 giây rồi mới gọi xuống máy chủ, chứ không xoá-rồi-thêm-lại (thêm lại không bao giờ khôi phục đúng nguyên trạng: id mới, mất bản ghi con, sai thứ tự). Ba chỗ dễ hụt đã xử lý: xoá liên tiếp thì việc đang chờ được chốt ngay chứ không bị nuốt; rời trang thì chạy nốt qua `pagehide`; hoàn tác trả dòng về đúng vị trí cũ.

---

## Bản mobile

Khung điện thoại 392×812, tab bar 5 mục ở đáy, hit target tối thiểu 44px. 11 màn:

- **Trang chủ** — 4 thẻ KPI 2×2, "Cần xử lý ngay", lịch hôm nay
- **Lịch** — dải ngày cuộn ngang + danh sách thẻ, viền trái theo màu trạng thái
- **Hợp đồng** — ô tìm + chip lọc cuộn ngang + thẻ 2 dòng
- **Chi tiết** — stepper cuộn ngang, thanh hành động cố định đáy
- **Tiền** — thu/chi/lợi nhuận + danh sách công nợ
- **Thêm** → Báo giá · Khách hàng · Album · Đội ngũ · Đối soát · Thông báo

Bảng trên desktop → thẻ trên mobile. Không thu nhỏ bảng.

Không dựng route riêng cho mobile — cùng một màn, đổi bố cục theo bề ngang:

- **Lịch**: dưới 640px mở thẳng chế độ **Ngày** (lưới tuần ở khổ hẹp vẫn là 7 cột bé xíu, chạm rất khó). Dải ngày lùi 3 / tiến 10 ngày, mỗi ô hiện số buổi. Thẻ đồng bộ Google là việc cài một lần nên đẩy xuống cuối ở khổ hẹp (`order-last lg:order-none`), không chiếm đầu màn.
- **Chi tiết HĐ**: stepper 7 bước chuyển từ xuống dòng sang **cuộn ngang** dưới 900px — xuống dòng thì nó cao thành một khối đẩy hết nội dung xuống dưới nếp gấp. Thanh hành động (Ghi nhận thu · Gửi khách) ghim đáy, ngay TRÊN thanh tab 52px, chỉ hiện dưới `lg`.

---

## Ghi chú kỹ thuật khi dựng lại

**Nguồn số liệu duy nhất.** Lỗi lặp lại nhiều nhất trong quá trình thiết kế: một màn chi tiết lưu `id` được bấm nhưng nội dung lại là hằng số cứng, nên mọi hàng mở ra cùng một bản ghi. Với mỗi màn chi tiết, **luôn** derive từ `find(x => x.id === selectedId)`. Tương tự, tổng tiền phải cộng từ mảng hạng mục, không viết tay số tổng.

**Icon** — Material Symbols Rounded. Tên icon dùng trong thiết kế: `space_dashboard, request_quote, description, view_kanban, event_note, inbox, calendar_month, auto_fix_high, photo_library, checkroom, photo_camera, groups, auto_awesome, auto_stories, account_balance_wallet, payments, monitoring, diversity_3, trophy, forum, inventory_2, gavel, language, tune, settings, notifications, account_circle, workspace_premium, redeem, desktop_windows, shield_person`.

**Ảnh** — mọi chỗ có ảnh đang là placeholder sọc. Trong repo thật nối vào Google Drive / CDN sẵn có.

**Định dạng tiền** — `(n).toLocaleString("vi-VN") + " đ"`. Rút gọn: `≥1e9 → "x,x tỷ"`, `≥1e6 → "xtr"`, còn lại `"xk"`.

**Ngày** — hiển thị `T2/T3/.../CN · dd/mm`. Không dùng tên thứ đầy đủ trong bảng.

---

## Danh sách file trong gói

| File | Nội dung |
| --- | --- |
| `README.md` | Tài liệu này |
| `Quản lý Studio.dc.html` | Bản thiết kế đầy đủ, mở trực tiếp bằng trình duyệt |
| `support.js` | Runtime cần cho file trên chạy được (không dùng trong repo thật) |
| `image-slot.js` | Component ô thả ảnh (không dùng trong repo thật) |
| `github.md` | Ghi nhận repo nguồn + bảng ánh xạ màn ↔ file |

---

## Câu lệnh gợi ý cho Claude Code

```
Đọc README.md trong thư mục design_handoff_studio_admin.
Mở Quản lý Studio.dc.html trong trình duyệt để xem thiết kế trực quan.

Bắt đầu từ bước 1 trong mục "Thứ tự triển khai đề xuất":
áp bộ design token vào src/app/globals.css, giữ nguyên tên biến
đang có nếu trùng chức năng, thêm biến mới nếu chưa có.
Sau đó dựng lại src/components/StudioShell.tsx theo mục
"Cấu trúc điều hướng".

Làm từng bước một, mỗi bước một commit. Không đổi schema Prisma.
Không đổi giá trị enum trạng thái hợp đồng — chỉ đổi nhãn hiển thị
trong CONTRACT_STATUS_LABEL.
```
