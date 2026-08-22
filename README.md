# Đặc tả giao diện quản lý studio (mstudo)

> Tài liệu tham chiếu cho khu **quản lý studio**: design token, cấu trúc điều
> hướng, phân quyền, trạng thái hợp đồng và bảng ánh xạ màn ↔ file.
> Sửa giao diện studio thì đọc mục tương ứng ở đây trước.

## Tóm tắt

Khu **quản lý studio**: 46 màn desktop + 11 màn mobile, nav gom thành 24 mục /
7 nhóm. Trang chủ / landing **không** thuộc phạm vi tài liệu này.

Giao diện đã được dựng xong trong `src/` (Next.js App Router + React +
TypeScript + Tailwind). Bản thiết kế HTML tham chiếu dùng khi dựng
(`Quản lý Studio.dc.html` cùng `support.js`, `image-slot.js`) đã được gỡ khỏi
repo sau khi hoàn tất — lấy lại từ lịch sử git nếu cần đối chiếu:

```bash
git log --all --diff-filter=D -- 'Quản lý Studio.dc.html'
git show <commit>^:'Quản lý Studio.dc.html' > /tmp/thiet-ke.html
```

Các giá trị dưới đây là **giá trị cuối** — màu, chữ, khoảng cách, bo góc,
trạng thái hover. Đổi thì đổi có chủ đích, đừng đổi tuỳ tiện.

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
| 9 | Hợp đồng gửi khách | `share` | `studio/contracts/[id]/share/`, trang công khai `app/hd/[code]/` |
| 10 | Bảng công việc (kanban) | `board` | `studio/board/BoardView.tsx` |
| 11 | Đặt lịch khách | `bookings` | `studio/bookings/BookingsView.tsx` |
| 12 | Chi tiết đặt lịch | `booking` | `studio/bookings/[id]/` |
| 13 | Yêu cầu mới | `leads` | `studio/leads/LeadsView.tsx` |
| 14 | Lịch làm việc (4 chế độ) | `calendar` | `studio/calendar/CalendarView.tsx`, `team/TeamCalendar.tsx` |
| 15 | Chế độ ngày chụp | `field` | **mới** — `studio/field/` |
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
| 35 | Nhân viên & phân quyền (2 tab: tài khoản + sổ thợ) | `crew` | `studio/staff/StaffAndCrew.tsx`, `staff/StaffManager.tsx`, `crew/CrewManager.tsx` · vai trò ở `src/lib/studio-roles.ts` |
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
Vận hành      Lịch làm việc · Lịch studio · Xử lý hình ảnh(4) · Thư viện album · Công cụ ảnh · Thiết bị
Khách hàng    Khách hàng · Thiệp·Story·Slide · Thiết kế album(2)
Tài chính     Thu chi & công nợ · Đối soát tiền công(2) · Báo cáo
Nhân sự       Nhân viên & phân quyền · Xếp hạng · Chi nhánh
Thiết lập     Gói & bảng giá · Dịch vụ & điều khoản · Website & chatbox · Công cụ ảnh · Cài đặt studio
Tài khoản     Trang của tôi · Thông báo(5) · Tài khoản & bảo mật · Gói phần mềm · Affiliate · Ứng dụng máy tính · Quản trị hệ thống
```

Số trong ngoặc là badge đếm. Chân sidebar: thẻ trạng thái đồng bộ Drive + số phiên bản.

**Topbar** (sticky, nền `rgba(255,255,255,.86)` + `backdrop-filter:blur(12px)`): tiêu đề + phụ đề trang · ô ⌘K · nút dark mode · chuông thông báo · chuyển vai trò · avatar (bấm → Tài khoản).

### Phân quyền

Nguồn duy nhất: **`src/lib/studio-roles.ts`** (nhãn, mô tả, và mọi hàm `can*`).
Thêm hoặc sửa vai trò thì sửa ở đó, đừng viết lại bảng nhãn trong component.

| Vai trò | Thấy gì |
| --- | --- |
| **Chủ studio** (`owner` / `admin`) | tất cả. Người DUY NHẤT tạo/xoá tài khoản và đổi vai trò |
| **Quản lý** (`manager`) | toàn bộ studio, TRỪ mục tài chính (Thu chi, Đối soát) và Gói/Affiliate/Quản trị |
| **Toàn quyền chi nhánh** (`branch_manager`) | như Quản lý **cộng tài chính**, nhưng phạm vi dữ liệu bị GHIM vào đúng chi nhánh của họ |
| **Nhân viên** (`staff`) | chỉ hợp đồng được giao cho mình |
| **Kế toán** (`accountant`) | chỉ Thu chi và Đối soát tiền công |

Vai trò đổi được **sau khi tạo** (ô chọn trên từng dòng ở màn Nhân viên & phân
quyền → `PATCH /api/studio/staff`). Ghi qua service-role vì vá C1 đã thu hồi
quyền UPDATE cột `studio_role` của client.

#### "Toàn quyền chi nhánh" là hàng rào thật, không phải bộ lọc

Khác với việc gán chi nhánh cho các vai trò khác — cái đó chỉ là MẶC ĐỊNH hiển
thị và đổi được — vai trò này bị ghim ở tầng truy vấn:

- `getBranchScope()` trả `selected` = chi nhánh của họ và `locked: true`, **bỏ
  qua cookie**. Ô chọn trên topbar hiện thành chip khoá.
- Chưa được gán chi nhánh → `forcedBranchScope` trả `"none"` (**fail-closed**:
  chỉ thấy phần chưa gán). Không bao giờ trả `null`, vì `null` nghĩa là "xem gộp
  toàn studio" — một thiếu sót cấu hình sẽ thành lỗ hổng.
- Màn chi tiết hợp đồng chặn theo `branch_id`: gõ tay URL `/contracts/<id>` của
  cơ sở khác ra 404. **Bộ lọc ở danh sách chỉ là hiển thị — hàng rào có lỗ thì
  không còn là hàng rào.**
- Không được: tạo/xoá tài khoản, đổi vai trò của ai, gán nhân sự vào chi nhánh
  (nếu không họ tự kéo người kèm dữ liệu về cơ sở mình), thêm/sửa/xoá chi nhánh.
- KHÔNG có trong ô "xem-như vai trò khác" của chủ studio: xem-như chỉ lọc menu
  chứ không ghim dữ liệu, nên sẽ vẽ ra một bức tranh sai.

Các màn đã ghim phạm vi cho vai trò này: Hợp đồng (danh sách + **chi tiết**),
Báo giá (danh sách + **chi tiết**), Bảng công việc, Đặt lịch khách, Lịch làm việc,
Lịch studio, Xử lý hình ảnh, Thu chi & công nợ, Đối soát tiền công, Xếp hạng,
Khách hàng, Thiết bị, Kho trang phục, Nhân sự, Chi nhánh.

**Chỗ CỐ Ý không ghim** (nói ra để không ai tưởng là đã kín):

| Không ghim | Vì sao |
| --- | --- |
| `studio_events` (mốc ghi chú trên Lịch làm việc) | phần lớn là mốc chung của studio (nghỉ lễ, bảo trì thiết bị), không có cột chi nhánh |
| `rental_orders` (đơn thuê) | một đơn có thể lấy đồ ở cơ sở này trả ở cơ sở khác; lọc bừa sẽ làm mất đơn khỏi màn hình. Kho trang phục (`rental_items`) thì ĐÃ ghim |
| Thư viện album, bảng giá, gói, điều khoản, mẫu tin nhắn | tài nguyên dùng chung toàn studio — đó là thiết kế của tính năng chi nhánh, không phải sơ hở |

Luật này có test: `npm run test:studio-roles`.

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

**Cảnh báo lãi mỏng** — `biên = (tổng HĐ − tiền công nhân sự − chi phí sản xuất) / tổng HĐ`. Dưới 45% đỏ, 45–60% vàng, trên 60% xanh.

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

---

## Ghi chú kỹ thuật khi dựng lại

**Nguồn số liệu duy nhất.** Lỗi lặp lại nhiều nhất trong quá trình thiết kế: một màn chi tiết lưu `id` được bấm nhưng nội dung lại là hằng số cứng, nên mọi hàng mở ra cùng một bản ghi. Với mỗi màn chi tiết, **luôn** derive từ `find(x => x.id === selectedId)`. Tương tự, tổng tiền phải cộng từ mảng hạng mục, không viết tay số tổng.

**Icon** — Material Symbols Rounded. Tên icon dùng trong thiết kế: `space_dashboard, request_quote, description, view_kanban, event_note, inbox, calendar_month, auto_fix_high, photo_library, checkroom, photo_camera, groups, auto_awesome, auto_stories, account_balance_wallet, payments, monitoring, diversity_3, trophy, forum, inventory_2, gavel, language, tune, settings, notifications, account_circle, workspace_premium, redeem, desktop_windows, shield_person`.

**Ảnh** — mọi chỗ có ảnh đang là placeholder sọc. Trong repo thật nối vào Google Drive / CDN sẵn có.

**Định dạng tiền** — `(n).toLocaleString("vi-VN") + " đ"`. Rút gọn: `≥1e9 → "x,x tỷ"`, `≥1e6 → "xtr"`, còn lại `"xk"`.

**Ngày** — hiển thị `T2/T3/.../CN · dd/mm`. Không dùng tên thứ đầy đủ trong bảng.

---

## Cổng nhân viên, cổng khách hàng & Lịch studio

Gói thiết kế thứ hai (*"Cổng nhân viên & khách hàng"*) thêm **ba bề mặt** dùng
chung một model dữ liệu mới. Mọi thứ khác — màu, chữ, hình khối, ngưỡng
responsive — giữ nguyên bộ token ở trên; **màu nhấn vẫn là xanh mstudo
`#1e9e72`**, không dùng tím `#AF2BB8` của bản vẽ.

| Bề mặt | Route | File nguồn |
| --- | --- | --- |
| Lịch studio (lịch tuần các buổi hẹn) | `/dashboard/studio/schedule` | `studio/schedule/SchedulePage.tsx` |
| Cổng nhân viên (3 tab) | `/staff` | `app/staff/StaffPortal.tsx`, `TodayView.tsx`, `TaskQueue.tsx`, `StaffNotifications.tsx` |
| Cổng khách hàng theo hợp đồng | `/portal/<client_token>` | `app/portal/[token]/ContractPortalView.tsx`, `PaymentPanel.tsx` |
| Trang album (khi hợp đồng hoàn thành) | cùng route `/portal/<client_token>` | `app/portal/[token]/AlbumView.tsx` |
| Lịch hẹn trong màn hợp đồng | `/dashboard/studio/contracts/[id]` | `studio/contracts/[id]/ContractAppointments.tsx` |

### Model dữ liệu

`supabase/migrations/studio_appointments.sql` (đã có trong `setup-all.sql`):

- **`studio_appointments`** — một buổi hẹn: `kind` (`makeup` · `fitting` · `pre`
  · `consult` · `shoot` · `delivery` · `other`), ngày + giờ, `room`, người phụ
  trách (`crew_id` cho sổ thợ / `staff_id` cho nhân viên có tài khoản),
  `status` (`scheduled` → `checked_in` → `done` | `cancelled`) và
  `client_visible` (lịch nội bộ đặt `false` để cổng khách không thấy).
  Đây là bảng **mới**, không nhồi vào `studio_events`: mốc ghi chú của hợp đồng
  không có người phụ trách, không có phòng, không có check-in.
- **`studio_rooms`** — phòng & nguồn lực, `capacity_week` là mẫu số của thanh
  công suất. Studio chưa khai phòng nào thì lần mở Lịch studio đầu tiên tạo sẵn
  4 phòng mặc định.
- **`studio_notifications.kind`** thêm ba khoá (cột là `text`, không cần
  migration): `schedule_reminder` · `contract_changed` · `assigned`.

Luật xếp lịch thuần (tuần, giờ, trùng lịch, công suất) nằm ở
`src/lib/appointment-rules.ts` — **không import gì**, nên chạy trực tiếp trong
Node: `npm run test:appointments`. Nhãn/màu/icon ở `src/lib/appointments.ts`,
màu + icon thông báo ở `src/lib/notifications.ts` (dùng chung giữa khu quản lý
và cổng nhân viên).

### Liên kết với tính năng đang có

- Cổng khách dùng **cùng `client_token` và cùng endpoint `/api/c/[token]`** với
  trang hợp đồng `/c/<token>` — một link khách đã có mở được cả hai trang, và
  cổng mới không dựng lại cổng chặn theo số điện thoại.
- Tab *Ảnh cần sửa* của cổng nhân viên đọc **cùng `contract_products`** với màn
  *Xử lý hình ảnh*; đổi trạng thái ở một nơi là đổi ở cả hai.
- Checklist *việc sau buổi chụp* là `contract_tasks` của hợp đồng người đó
  phụ trách.
- Cron `/api/cron/reminders` ghi `schedule_reminder` cho buổi hẹn **ngày mai** và
  thêm mục "Lịch hẹn ngày mai" vào email nhắc việc.
- Album hoàn thành **không** dựng lại phần tải hàng loạt: nút *Tải toàn bộ* dẫn
  về `/album/<slug>` — nơi đã có nén ZIP, đóng dấu mờ và luật hạn lưu trữ.

### Chỗ CỐ Ý lệch bản vẽ (và vì sao)

| Bản vẽ | Bản dựng | Lý do |
| --- | --- | --- |
| Màu nhấn tím `#AF2BB8` | xanh mstudo `#1e9e72` | studio giữ màu thương hiệu, đã chốt ở gói thiết kế trước |
| Font *Lora* cho tên khách | *Cormorant Garamond* (`font-serif`) | repo đã có một họ serif dành riêng cho trang khách — không nạp thêm họ phông thứ hai cho một dòng chữ |
| Icon Material Symbols | `lucide-react` | trộn hai bộ icon lệch hơn là lệch vài nét vẽ |
| KPI *Thù lao tạm tính* | *Hợp đồng phụ trách* | sổ tiền công (`contract_crew`) khoá theo tên/SĐT thợ, không theo tài khoản đăng nhập → không quy ra tiền của một nhân viên mà không đoán |
| Hậu kỳ 4 trạng thái + cột "62/80 ảnh" | 3 trạng thái của `contract_products`, thanh tiến độ theo bước | thêm cột *Chờ duyệt* sẽ không ai ghi vào, và số ảnh sẽ là số bịa |
| Rail *Ekip trang điểm* | *Ê-kíp trong tuần* (ai đang có việc) | sổ thợ không có vai trò "trang điểm" — chỉ `photographer/cameraman/assistant/editor` |

## Chi nhánh studio

Nhiều cơ sở trong CÙNG một tài khoản: mỗi chi nhánh có đội ngũ, lịch và sổ thu
chi riêng, chủ studio **xem gộp hoặc tách**. Đã phát hành — không còn nhãn
"Sắp ra mắt".

| Bề mặt | Route | File nguồn |
| --- | --- | --- |
| Quản lý chi nhánh + đối chiếu cơ sở | `/dashboard/studio/branches` | `studio/branches/BranchesManager.tsx` |
| Ô chọn chi nhánh trên thanh trên cùng | mọi màn trong shell | `components/BranchSwitcher.tsx` |

### Nguyên tắc thiết kế

1. **Chi nhánh là một CHIỀU PHÂN LOẠI, không phải tài khoản thứ hai.** Không
   nhân bản bảng nào — chỉ thêm cột `branch_id`. Bảng giá, điều khoản và thư
   viện album vẫn dùng chung toàn studio.
2. **`branch_id` LUÔN cho phép null = "chưa gán".** Studio một cơ sở (đa số)
   không khai chi nhánh nào thì mọi dòng đều null và mọi màn hoạt động y như
   trước. Tính năng này không được phép buộc studio đang chạy đi gán lại dữ liệu cũ.
3. **Mọi khoá ngoại `on delete set null`.** Xoá một chi nhánh KHÔNG xoá theo hợp
   đồng, lịch hay khoản thu chi của nó — dữ liệu chỉ quay về "chưa gán". Hộp
   thoại xác nhận nói đúng điều đó.
4. **Chưa khai chi nhánh → không hiện gì thêm.** Ô chọn trên topbar, ô chọn
   trong form hợp đồng / lịch / nhân sự đều tự ẩn khi `branches` rỗng.

### Model dữ liệu

`supabase/migrations/studio_branches.sql` (đã có trong `setup-all.sql`, chạy SAU
`studio_appointments.sql`):

- **`studio_branches`** — tên, mã ngắn (Q1, GV…), địa chỉ, SĐT, `manager_id`
  (một tài khoản nhân viên), `active` (tạm ẩn cơ sở đã đóng mà vẫn tra được số cũ).
- **`branch_id`** thêm vào: `studio_contracts`, `studio_bookings`,
  `studio_appointments`, `studio_rooms`, `studio_expenses`, `studio_equipment`,
  `rental_items`, `studio_crew`.
  CỐ Ý **không** thêm vào `albums`/`photos`, `studio_pricelist`,
  `studio_packages`, `studio_services`, `contract_*` (đã thuộc hợp đồng),
  `studio_notifications`.
- **`profiles.studio_branch_id`** — nhân viên thuộc cơ sở nào. Cột này CỐ Ý
  **không** nằm trong danh sách cột `authenticated` được UPDATE (vá C1), vì nếu
  cấp thì nhân viên tự đổi được chi nhánh của mình. Ghi qua service-role ở
  `PATCH /api/studio/staff`, giống cách gán vai trò.

Luật thuần (chuẩn hoá lựa chọn, điều kiện truy vấn, gộp số liệu) nằm ở
`src/lib/branch-rules.ts` — **không import gì**, chạy trực tiếp trong Node:
`npm run test:branches`. Phần chạm hệ thống (cookie + truy vấn) ở
`src/lib/branches.ts`.

### "Xem gộp hoặc tách" hoạt động thế nào

Lựa chọn lưu trong **cookie** `mstudo_branch`, không phải query string: chủ
studio chọn "Quận 1" một lần rồi đi qua Hợp đồng → Lịch → Thu chi và cả ba màn
cùng nói về Quận 1. Nhét vào URL thì mỗi liên kết trong app phải tự mang tham số
theo, sót một chỗ là phạm vi âm thầm nhảy về "toàn studio".

`getBranchScope()` đọc cookie ở layout; từng màn áp vào truy vấn bằng
`applyBranch(query, scope.selected)`. Ba giá trị: `null` = gộp · `"none"` =
chưa gán (`IS NULL`) · `<uuid>` = một cơ sở. Cookie giữ id của một chi nhánh đã
xoá thì rơi về "gộp", KHÔNG lọc theo id lạ rồi cho ra màn hình trống.

Đã áp phạm vi: Hợp đồng (`/api/studio/contracts-list`), Đặt lịch khách, Lịch
studio, Lịch làm việc (chỉ hợp đồng — `studio_events` là mốc ghi chú chung),
Thu chi & công nợ (thu và tiền công lọc qua `contract.branch_id`).

### Chỗ cần biết trước khi sửa

| Việc | Cách làm đúng |
| --- | --- |
| Thêm màn lọc theo chi nhánh | `getBranchScope()` + `applyBranch()`, đừng tự viết `.eq("branch_id", …)` — "chưa gán" phải là `IS NULL`, viết sai thì màn trống |
| Gán chi nhánh cho nhân viên | `PATCH /api/studio/staff`; gọi supabase trực tiếp sẽ IM LẶNG không ghi được gì (vá C1) |
| Chi nhánh của nhân viên | là **mặc định hiển thị**, KHÔNG phải hàng rào quyền — họ vẫn chuyển sang "Tất cả chi nhánh" được. Muốn khoá cứng thì phải chặn ở từng truy vấn, và đó là một quyết định về phân quyền |
| Hợp đồng mới | thừa hưởng chi nhánh đang xem (không hỏi thêm một bước trong luồng 5 bước); đổi lại ở màn chi tiết hợp đồng |

## Quy tắc khi sửa giao diện studio

- **Design token** sống ở `:root` của `src/app/globals.css`; bản dark ghi đè
  bằng `[data-theme="dark"]`. Trong JSX dùng lớp token của Tailwind
  (`bg-surface`, `text-fg`, `text-accent-muted`, `border-subtle`) —
  **đừng** viết cứng `bg-white` / `text-stone-*` cho bề mặt dashboard, vì
  chúng không đổi theo chế độ tối.
- **Không đổi giá trị enum** trạng thái hợp đồng — chỉ đổi nhãn hiển thị trong
  `CONTRACT_STATUS_LABEL`.
- **Ngưỡng responsive** ở mục trên đã kiểm chứng — đừng đổi tuỳ tiện.
- Dựng HTML bằng tay (`document.write`, `srcDoc`, template in ấn) thì mọi giá
  trị do người dùng nhập phải qua `escapeHtml()` ở `src/lib/html-escape.ts`.

## Tài liệu khác

Xem thư mục [`docs/`](docs/) — thiết lập môi trường, chuyển đổi dữ liệu,
Supabase, và đặc tả client desktop.
