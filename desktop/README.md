# MStudo Desktop — client Windows

Ứng dụng máy tính cho tài khoản gói Studio: **tự động lưu hợp đồng (PDF + Word)**
về thư mục đã chọn ngay khi khách ký, và **tự xuất Excel toàn bộ dữ liệu hằng
ngày** để chống mất dữ liệu. Xây bằng Tauri v2 (Rust + WebView2), file cài ~10MB.

## Kiến trúc

- `ui/` — giao diện tiếng Việt (HTML/CSS/JS thuần, không framework): 3 màn hình
  Kết nối → Chọn thư mục → Trạng thái. Toàn bộ engine đồng bộ nằm ở `ui/app.js`.
- `src-tauri/` — phần Rust: gọi API mstudo (tránh CORS), ghi file an toàn
  (ghi `.tmp` rồi đổi tên), chọn thư mục, chuyển HTML→PDF bằng **Microsoft Edge
  headless** (sẵn trên Windows 10/11 — bản PDF giữ nguyên ảnh chữ ký), dọn file
  cũ hơn 30 ngày, di chuyển dữ liệu khi đổi thư mục.
- Xác thực bằng **mã kết nối thiết bị** (`msd_...`): chủ studio lấy mã ở trang
  *mstudo → MStudo Desktop → Kết nối thiết bị mới* (mã chỉ hiện 1 lần, server
  chỉ giữ bản băm; tối đa 2 máy/tài khoản).

## Cách 1 (khuyến nghị): build tự động bằng GitHub Actions — KHÔNG cần máy Windows

Đã có workflow `.github/workflows/desktop-build.yml` build trên máy ảo Windows
của GitHub và cho ra file cài `.exe`:

1. Vào repo trên GitHub → tab **Actions** → chọn **"Build MStudo Desktop
   (Windows)"** → bấm **Run workflow**. (Nút này chỉ hiện khi workflow đã nằm
   trên nhánh mặc định — sau khi merge nhánh vào `main`.)
2. Chờ ~5–10 phút, mở lần chạy → tải file trong mục **Artifacts →
   MStudo-Desktop-Windows**.
3. Hoặc đẩy tag `desktop-v0.1.0` → workflow tự build và **tạo Release** kèm file
   `.exe` để tải trực tiếp.

## Cách 2: build tay trên máy Windows

Yêu cầu: [Rust](https://rustup.rs) + [Node.js 18+](https://nodejs.org) +
WebView2 (sẵn trên Windows 10/11).

```bash
cd desktop
npm install          # cài @tauri-apps/cli
npm run dev          # chạy thử (cửa sổ dev)
npm run build        # đóng gói — file cài NSIS tại:
                     # src-tauri/target/release/bundle/nsis/MStudo Desktop_0.1.0_x64-setup.exe
```

Upload file `...-setup.exe` lên hosting rồi đặt biến môi trường
`NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL` cho web app (Vercel) — nút "Tải bản cài đặt"
trên trang MStudo Desktop sẽ tự trỏ vào đó.

## Cài đặt trên Windows khi app CHƯA ký số

Bản cài hiện **chưa mua chứng chỉ ký số**, nên Windows không xác minh được nhà
phát hành. Có 2 mức cảnh báo — hầu hết máy khách chỉ gặp mức 1:

**1) SmartScreen** (đa số máy — SAC đang tắt): mở `.exe` → hiện "Windows
protected your PC" → bấm **More info → Run anyway**. Nếu file vừa tải bị "khoá":
chuột phải `.exe` → **Properties** → tick **Unblock** → **OK**, rồi mở lại.

**2) Smart App Control** ("*Smart App Control blocked an app that may be
unsafe*") — chỉ bật mặc định trên **Windows 11 cài mới tinh**. SAC nghiêm hơn
SmartScreen: app chưa ký **không thể chạy** khi SAC đang bật. Cách duy nhất để
chạy app chưa ký là **tắt SAC**: *Settings → Privacy & security → Windows
Security → App & browser control → Smart App Control → **Off***.
> ⚠️ Tắt SAC là **một chiều** — muốn bật lại phải **reset/cài lại Windows**. Chỉ
> nên tắt trên máy của bạn để test; **không** yêu cầu khách làm điều này.

**Bỏ hẳn cảnh báo** cho mọi máy (kể cả SAC) thì bắt buộc **ký số** installer +
app: khuyến nghị **Azure Trusted Signing** (~$10/tháng, SmartScreen & SAC đều
tin) hoặc **chứng chỉ EV**. Khi đã có, ký trong CI qua `bundle.windows.signCommand`
của Tauri (nhớ ký cả `*-setup.exe` lẫn binary bên trong).

## Ghi chú

- **SmartScreen / Smart App Control**: chưa mua chứng chỉ ký số nên Windows sẽ
  cảnh báo khi cài — xem mục *"Cài đặt trên Windows khi app CHƯA ký số"* ở trên.
- **Tự cập nhật**: app kiểm tra bản mới khi mở và mỗi 2 giờ. Khi có bản mới, nếu
  app đang **rảnh** (không đồng bộ/đang tải/đang xuất) sẽ **tự tải & cài** (đóng
  app → chạy trình cài → mở lại); nếu đang bận thì hiện banner để bấm “Cập nhật
  ngay” khi tiện. Xem mục *“Kênh cập nhật”* ngay dưới đây trước khi phát hành.
- **Kênh cập nhật — đọc kỹ chỗ này khi bản mới “không tự cập nhật được”**: app
  hỏi GitHub API **không kèm đăng nhập**, nên nó chỉ đọc được release của repo
  **CÔNG KHAI**. Repo mã nguồn (`vieetjk6-afk/mstudo-v2`) là repo **riêng tư** →
  release ở đó với app luôn là 404. Kênh thật là release **`desktop-dev` của
  `vieetjk6-afk/mstudo-desktop`** — repo công khai **chỉ chứa file cài**, không
  có mã nguồn. Ba chỗ phải khớp nhau, đổi thì đổi cả ba (`npm run
  test:desktop-update` giữ khớp):

  | Chỗ | Giữ gì |
  | --- | --- |
  | `ui/app.js` → `RELEASE_REPO` | repo app đi tìm bản mới |
  | `src-tauri/src/main.rs` → `download_and_run` | chỉ cho tải file cài từ đúng repo đó (chặn chạy `.exe` tuỳ ý) |
  | `.github/workflows/desktop-build.yml` → `RELEASE_CHANNEL_REPO` | nơi workflow đẩy file cài lên |

  Repo kênh **phải có ít nhất một commit** — GitHub từ chối tạo release trên repo
  rỗng (`422 Repository is empty`), và đó là lỗi đã làm hỏng lần phát hành đầu
  tiên: build xanh, chỉ mỗi bước đẩy đỏ, máy studio không thấy gì.

  Workflow tự đẩy bản cài lên kênh này sau mỗi lần build, cần secret
  **`RELEASE_TOKEN`** (token có quyền *Contents: Read and write* trên repo kênh).
  Chưa có secret thì bước đó bỏ qua kèm cảnh báo vàng, build vẫn xanh — và **máy
  studio sẽ không thấy bản mới**, đúng cái bẫy im lặng này.

  Phát hành bản mới: tăng `version` ở `tauri.conf.json`, `Cargo.toml`,
  `package.json` và `APP_VERSION` trong `ui/app.js` cho khớp (client so số phiên
  bản **trong tên file cài** với `APP_VERSION`), rồi chạy workflow build.
  (Cập nhật ngầm bằng tauri-plugin-updater để sau — cần quản lý khóa ký riêng.)
- **Kênh CŨ `vieetjk01/studio` — đường chuyển tiếp, sẽ bỏ**: máy còn chạy bản
  **≤ 1.1.1** đã ghim kênh cũ ngay trong file cài, không biết gì về kênh mới. Nên
  workflow còn đẩy thêm bản cài lên kênh cũ, chạy sau secret riêng
  **`LEGACY_RELEASE_TOKEN`**; máy cũ nhận bản cầu nối, cài xong là tự chuyển sang
  kênh mới. Khi không còn máy nào ở bản cũ: xoá secret đó (hoặc xoá hẳn
  `LEGACY_CHANNEL_REPO` cùng các bước dùng nó). Không có token cho repo cũ thì
  mỗi máy cũ phải **cài tay một lần** — không có đường nào khác.
- Cấu trúc dữ liệu client tạo trong thư mục studio chọn:

```
HopDong/Hop dong HD-2026-001 - Ten Khach - 0901234567/   ← mỗi HĐ 1 thư mục
  Hop dong ... .pdf / .docx                               ← bản đầu
  Hop dong ... (ban 2 - 2026-07-10).pdf / .docx           ← khi sửa/ký lại
  mstudo.json                                             ← manifest phiên bản
  Photo/JPG Goc · Raw · File ChinhSua                     ← ảnh (tự đồng bộ lên Drive)
  Video/Video Goc · Video HoanThien                       ← video (nếu HĐ có quay)
  mstudo-drive.json                                       ← manifest đồng bộ Drive
KhachHang/ BaoGia/ ChiTieu/ Luong/ LichHen/ NhanVien/     ← Excel mỗi ngày 1 file
SaoLuu/mstudo-backup-YYYY-MM-DD.json                      ← bản đầy đủ để khôi phục
```

- File Excel/JSON quá 30 ngày tự xóa; thư mục `HopDong/` **không bao giờ** tự xóa.

## Đồng bộ ảnh/video lên Google Drive

Khi hợp đồng đã ký, app tạo cây thư mục ảnh/video theo tên hợp đồng và **tự tải
lên Google Drive của studio** (1 chiều). Chủ studio:

- Kết nối Drive một lần trên web tại **mstudo → Khách hàng → Đồng bộ Drive**, đặt
  **tên thư mục gốc** trên Drive (app tạo giúp; có thể tự kéo thư mục đó đi bất kỳ
  đâu trong Drive — vẫn đồng bộ đúng), và chỉnh *mẫu thư mục* (photo/video:
  đổi tên, thêm/bớt, chọn thư mục loại trừ).
- Trong app desktop, bấm **“Chọn thư mục gốc…”** để chọn thư mục trên máy chứa
  ảnh/video (mỗi hợp đồng 1 thư mục con) — KHÔNG còn nằm trong `HopDong/`.

Mặc định **JPG Goc** → album chọn ảnh, **File ChinhSua** → gallery giao khách;
**Raw** và **Video Goc** không đồng bộ. Cần đặt `GOOGLE_STUDIO_DRIVE_REDIRECT_URI`
và chạy migration `supabase/migrations/studio_drive_sync.sql`.

### Đồng bộ gần như tức thì + thanh tiến trình (như app Google Drive)

- **Hợp đồng “đang thực hiện”** được quét mỗi **~10 giây** (vòng nhanh) — thợ đổ
  ảnh vào thư mục là tự tải lên Drive ngay, khỏi chờ. Các hợp đồng đã ký khác vẫn
  quét ở vòng chậm (2 phút) để bắt file bỏ vào muộn. Đây là phương án tối ưu: vòng
  nhanh chỉ đụng vài hợp đồng đang chạy (danh sách cache 30s, cây thư mục Drive
  cache 5 phút) nên không “đập” server mỗi 10 giây.
- Khi tải, app hiện **ảnh đang đồng bộ (xem trước), số ảnh (x/y), phần trăm, tốc
  độ và thời gian dự kiến còn lại** — cập nhật mượt theo từng khối 8MB (quan trọng
  với video lớn). Manifest ghi sau mỗi file nên ngắt giữa chừng không tải lại từ đầu.

### Chạy ngầm dưới khay hệ thống

Bấm dấu **×** ở cửa sổ chính sẽ **thu nhỏ xuống khay hệ thống** thay vì thoát —
engine đồng bộ hợp đồng/ảnh vẫn chạy ngầm. Vì app không thoát khi bấm ×, mở lại
app từ Desktop/Start **không tạo bản thứ hai**: bản đang chạy được đưa lên
trước, bản vừa mở tự thoát (chốt `tauri-plugin-single-instance`). Không có chốt
này thì mỗi lần mở là thêm một biểu tượng khay và thêm một engine đồng bộ ghi
song song vào cùng thư mục dữ liệu. Biểu tượng khay: **bấm trái** để mở
lại cửa sổ; **chuột phải** có menu **Mở giao diện studio / Bảng điều khiển &
đồng bộ / Đồng bộ ngay / Đăng xuất · xóa cookie đăng nhập / Thoát** (Thoát mới
đóng hẳn app).

## Bấm link trong cửa sổ studio

Cửa sổ studio là WebView2 **không có tab, không thanh địa chỉ**. WebView2 mặc
định **nuốt** mọi yêu cầu mở cửa sổ mới, nên trước đây bấm link `target="_blank"`
(Google Drive, Zalo hỗ trợ, xem trước album/thiệp/story) **không có gì xảy ra** —
im lặng, không báo lỗi; cửa sổ **in hợp đồng / báo giá** (trang tự mở bằng
`window.open("")` rồi ghi nội dung vào) cũng không hiện. App tự xử lý:

| Bấm vào | Đi đâu |
| --- | --- |
| Link ra ngoài (`drive.google.com`, Facebook, Zalo…) | **Trình duyệt mặc định** của máy |
| Link trang của chính studio mở tab mới | **Cửa sổ mới trong app** — dùng chung hồ sơ WebView2 nên **không phải đăng nhập lại** |
| Cửa sổ in hợp đồng/báo giá (`window.open("")`) | Cửa sổ mới trong app (mở ở trình duyệt ngoài thì trang không ghi được nội dung in vào) |
| `mailto:` / `tel:` (gọi khách hàng ở màn *Hôm nay*) | Phần mềm mail / ứng dụng gọi điện của máy |
| Link ra ngoài **không** có `target="_blank"` | Trình duyệt mặc định — script tiêm vào trang bắt lại, không để cửa sổ studio điều hướng sang trang ngoài rồi kẹt ở đó (không có nút Back) |

Địa chỉ giao cho Windows mở chỉ được thuộc `http, https, mailto, tel, sms,
callto` và luôn đi qua `explorer`/`rundll32` chứ **không qua `cmd`** — không có
shell thì không chèn được lệnh nếu URL bị thao túng. Kiểm thử:
`npm run test:desktop-links`.

## Đăng nhập trong cửa sổ studio

### Đăng nhập tự động bằng mã thiết bị (mặc định)

Máy đã kết nối thì **không cần đăng nhập lại bằng form web**. App gọi
`POST /api/desktop/session` kèm mã thiết bị `msd_...`, máy chủ sinh mã đăng nhập
**dùng một lần** (magic link của Supabase) cho đúng chủ máy đó và trả về đường
`/auth/desktop?token_hash=…`; app mở đường này trong cửa sổ studio để đổi lấy
phiên (route `auth/desktop` gọi `verifyOtp` rồi ghi cookie phiên lên chính
response chuyển hướng).

Chạy khi: bấm **Đăng nhập tự động** trong *Đồng bộ & sao lưu*, chọn mục cùng tên
ở menu khay, **hoặc tự động** khi cửa sổ studio bị đá về `/login`.

Vì sao làm vậy: đăng nhập bằng form web bên trong WebView2 là chỗ hỏng nhiều
nhất — Google **chặn thẳng** đăng nhập trong webview nhúng, captcha Turnstile
lắm lúc không chạy, cookie phiên hỏng thì không có menu trình duyệt nào để xóa.
Máy này vốn đã được chủ studio xác thực một lần bằng mã kết nối rồi.

Quyền **không** rộng thêm: mã thiết bị vốn đã đọc/ghi được toàn bộ dữ liệu studio
qua `/api/desktop/*`. Endpoint chỉ nhận mã thiết bị (`via === "device"`), giới hạn
5 lần / 5 phút mỗi máy, và app chỉ thử tự động **một lần mỗi lần chạy** (mã hỏng
mà thử lại là vòng lặp vô tận). Vừa bấm *Đăng xuất* thì tự động cũng bị khóa tới
lần chạy sau, không thì vừa đăng xuất đã bị đăng nhập lại ngay.

### Kẹt đăng nhập → xóa cookie ở đâu

Cửa sổ studio là WebView2 **không có thanh địa chỉ, không có menu trình duyệt**,
nên khi cookie phiên hỏng (còn phiên tài khoản cũ, khóa Supabase đã đổi, một lần
đăng nhập Google dở dang để lại `code-verifier` mồ côi) thì trước đây không có
chỗ nào xóa cookie — người dùng kẹt luôn ở trang đăng nhập. Ba lối thoát, theo
thứ tự nhẹ → nặng:

1. **Ngay trên trang đăng nhập**: link *“Không đăng nhập được? Xóa cookie đăng
   nhập rồi thử lại”* → gọi `/auth/reset` trên máy chủ (xóa mọi cookie `sb-*`
   rồi quay lại `/login`). Dùng được cả trên trình duyệt web thường.
2. **Menu khay hệ thống → “Đăng xuất / xóa cookie đăng nhập”**, hoặc nút *Đăng
   xuất / xóa cookie* trong **Đồng bộ & sao lưu**. Cùng đường `/auth/reset`
   nhưng bấm được kể cả khi cửa sổ studio đang chiếm hết màn hình.
3. **Nút *Xóa sạch cookie & bộ nhớ đệm*** (lệnh Rust `clear_web_data`): xóa
   toàn bộ dữ liệu duyệt web của WebView2 khi cách 1–2 vẫn không gỡ được.
   ⚠️ WebView2 dùng **chung một hồ sơ** cho mọi cửa sổ của app, nên lệnh này xóa
   luôn `localStorage` của bảng điều khiển — `app.js` ghi lại cấu hình (`cfg`:
   máy chủ, mã kết nối, thư mục lưu) ngay sau đó, chỉ mất nhật ký hoạt động.
   Kết nối thiết bị và file đã lưu trên máy **không** bị đụng tới.
