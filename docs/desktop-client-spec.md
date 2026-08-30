# MStudo Desktop — Đặc tả & kế hoạch triển khai

> Client Windows cho tài khoản gói Studio: tự động lưu hợp đồng về máy, tự xuất
> dữ liệu ra Excel theo lịch để chống mất dữ liệu.
> Trạng thái: **chưa xuất bản — chỉ admin thấy** (feature flag `desktop`, giống Story/Album/Slide).

## 1. Quyết định đã chốt

| Hạng mục | Quyết định |
| --- | --- |
| Kiến trúc | App desktop (Tauri) chạy giao diện web mstudo + cầu nối ghi file xuống máy. Cần internet để dùng. |
| Hệ điều hành | Chỉ Windows |
| Người được cài | **Chỉ chủ studio** (không phải nhân viên), tối đa **2 máy / tài khoản** |
| Hợp đồng | Lưu **PDF + Word**, tự lưu **ngay khi khách ký** |
| Tên & tổ chức file hợp đồng | Mỗi hợp đồng **1 thư mục riêng**: `Hợp đồng {mã HĐ} - {Tên khách} - {SĐT}`; khi sửa/ký lại → **lưu thành bản mới** trong cùng thư mục, không ghi đè |
| Hợp đồng cũ | Lần chạy đầu **tải toàn bộ** hợp đồng đã ký về máy |
| Xuất dữ liệu khác | **Mỗi mảng 1 file Excel** (khách hàng, báo giá, chi tiêu, lương, lịch hẹn, nhân viên); chạy **hằng ngày + khi mở app** (xuất bù nếu hôm trước máy tắt) |
| Giữ bản cũ | **30 ngày**, tự xóa bản cũ hơn |
| Khôi phục ngược | **Có** — nhập file sao lưu JSON để phục hồi dữ liệu vào hệ thống |
| Bảo mật file | **File thường** (không mã hóa), kèm cảnh báo trong app |
| Hết hạn gói Studio | Client ngừng đồng bộ; **hợp đồng trên hệ thống bị khóa lại**; file đã lưu trên máy giữ nguyên |
| Code signing | **Không đầu tư** — chấp nhận cảnh báo SmartScreen, kèm hướng dẫn cài đặt |
| Phân phối | Mục **"Tải MStudo Desktop"** trong trang quản trị (chỉ gói Studio; giai đoạn đầu chỉ admin thấy) |
| Thư mục lưu | Studio chọn vị trí lưu; **đổi vị trí thì các lần lưu sau theo vị trí mới** (hỏi có di chuyển dữ liệu cũ sang hay không) |
| Đề xuất mở rộng (làm sau) | Sao lưu tự động lên Google Drive của studio (chạy từ server, không cần client); cache offline |

## 2. Kiến trúc

```
┌─ Máy studio (Windows) ─────────────────────────┐
│  MStudo Desktop (Tauri)                        │
│  ├─ WebView: giao diện mstudo hiện tại         │
│  ├─ Cầu nối (Rust): ghi file, chọn thư mục,    │
│  │   lịch chạy, tải file, thông báo            │
│  └─ Bộ lưu trữ cấu hình: thư mục lưu, token    │
└────────────┬───────────────────────────────────┘
             │ HTTPS + Supabase Realtime
┌────────────┴───────────────────────────────────┐
│  Server mstudo (Next.js + Supabase)            │
│  ├─ API thiết bị: đăng ký / thu hồi (tối đa 2) │
│  ├─ API xuất: Excel từng mảng, JSON đầy đủ     │
│  ├─ API hợp đồng: danh sách + PDF + DOCX       │
│  ├─ Realtime: sự kiện "hợp đồng đã ký"         │
│  └─ API khôi phục: nhập JSON, xem trước, ghi   │
└────────────────────────────────────────────────┘
```

- **Luồng hợp đồng ký**: khách ký trên web → server ghi nhận → phát realtime →
  client tải PDF + DOCX về đúng thư mục hợp đồng. Client tắt lúc đó → khi mở
  lại, gọi API "hợp đồng chưa lưu từ lần đồng bộ cuối" để **tải bù**.
- **Ghi file an toàn**: luôn ghi ra file `.tmp` rồi đổi tên — tránh hỏng file
  khi mất điện; file Excel đang mở bị khóa → thử lại + thông báo.

## 3. Cấu trúc thư mục trên máy

```
MStudo/                                  ← studio chọn vị trí gốc
├─ HopDong/
│  └─ Hop dong HD-2026-0012 - Nguyen Van A - 0901234567/
│     ├─ Hop dong HD-2026-0012 - Nguyen Van A - 0901234567.pdf
│     ├─ Hop dong HD-2026-0012 - Nguyen Van A - 0901234567.docx
│     ├─ Hop dong ... (ban 2 - 2026-07-10).pdf    ← khi sửa/ký lại
│     └─ Hop dong ... (ban 2 - 2026-07-10).docx
├─ BaoGia/        BaoGia_2026-07-05.xlsx
├─ KhachHang/     KhachHang_2026-07-05.xlsx
├─ ChiTieu/       ChiTieu_2026-07.xlsx
├─ LichHen/       LichHen_2026-07-05.xlsx
├─ NhanVien/      NhanVien_2026-07-05.xlsx · Luong_2026-07.xlsx
└─ SaoLuu/        mstudo-backup-2026-07-05.json   ← bản đầy đủ để khôi phục
```

- Tên file/thư mục: giữ tiếng Việt, loại bỏ ký tự Windows cấm (`\ / : * ? " < > |`).
- Dọn dẹp: file Excel/JSON quá **30 ngày** tự xóa; **thư mục hợp đồng không bao giờ tự xóa**.
- Đổi thư mục gốc: client hỏi *"Di chuyển dữ liệu đã lưu sang thư mục mới?"* —
  Có → move toàn bộ; Không → dữ liệu cũ giữ nguyên, lưu mới vào chỗ mới.

## 4. Thiết bị & phiên đăng nhập

- Đăng nhập trong client bằng tài khoản mstudo; chỉ chấp nhận **chủ studio** (owner) gói Studio.
- Bảng `desktop_devices`: id, studio_id, tên máy, phiên bản, lần đồng bộ cuối, trạng thái.
- Tối đa **2 thiết bị hoạt động**; đăng ký máy thứ 3 → yêu cầu thu hồi 1 máy cũ.
- Trang quản lý thiết bị (trong phần cài đặt studio): xem danh sách, thu hồi.
- Hết hạn gói: API từ chối đồng bộ; hợp đồng trên hệ thống chuyển trạng thái khóa
  (không tạo/sửa/ký); client hiện thông báo gia hạn; file trên máy giữ nguyên.

## 5. Khôi phục ngược

- Nguồn: file `mstudo-backup-*.json` (đầy đủ mọi mảng, có version schema).
- Chỉ chủ studio thao tác; luồng: chọn file → **xem trước** (số bản ghi từng mảng,
  chênh lệch so với hiện tại) → xác nhận → server ghi theo kiểu upsert, có nhật ký.
- Không phục hồi đè im lặng: bản ghi xung đột (đã sửa mới hơn trên server) được
  liệt kê để chọn giữ bên nào.

## 6. Phát hành & cập nhật

- Trang quản trị: mục **"Tải MStudo Desktop"** — flag `desktop` (mặc định ẩn, chỉ admin).
- Không code signing: kèm hướng dẫn cài (SmartScreen → "More info" → "Run anyway").
- Tự cập nhật qua Tauri Updater; file cài + manifest đặt trên hosting của mstudo.

## 7. Kế hoạch triển khai

**Giai đoạn A — nền tảng phía server (làm trong repo này)**
1. Flag `desktop` + trang "Tải MStudo Desktop" trong quản trị (admin-only).
2. API xuất Excel từng mảng + JSON đầy đủ (dùng chung cho client và nút xuất trên web).
3. API hợp đồng: danh sách theo lần-đồng-bộ-cuối + xuất PDF + DOCX.
4. Bảng + API `desktop_devices` (đăng ký, thu hồi, giới hạn 2).
5. Khóa hợp đồng khi hết hạn gói.

**Giai đoạn B — client Windows (thư mục `desktop/` trong repo, Tauri v2)**
1. ✅ Scaffold hoàn chỉnh: UI tiếng Việt 3 màn hình (kết nối → chọn thư mục →
   trạng thái) + Rust commands (HTTP, ghi file an toàn, chọn thư mục, dọn 30
   ngày, di chuyển dữ liệu). Build trên máy Windows theo `desktop/README.md`.
2. ✅ Xác thực bằng MÃ KẾT NỐI thiết bị: nút "Kết nối thiết bị mới" trên trang
   web tạo token `msd_` hiện 1 lần → dán vào app (thay cho đăng nhập webview —
   đơn giản, không phụ thuộc cookie).
3. ✅ PDF hợp đồng: server trả HTML bản in → client chuyển PDF bằng Microsoft
   Edge headless (sẵn trên Win 10/11, giữ nguyên ảnh chữ ký); không có Edge →
   giữ bản HTML dự phòng.
4. ✅ Engine: tải bù theo mốc đồng bộ cuối (chỉ dời mốc khi lưu trọn vẹn),
   mỗi HĐ 1 thư mục + bản mới khi sửa (manifest mstudo.json), Excel hằng ngày
   + khi mở app, dọn 30 ngày (không đụng HopDong), đổi thư mục có hỏi di chuyển.
5. ✅ Báo cập nhật: app kiểm tra /api/desktop/version khi mở + mỗi ngày, hiện
   banner + nút tải bản mới (đặt DESKTOP_LATEST_VERSION + link trên Vercel là
   xong — không cần khóa ký; nâng cấp lên tauri-plugin-updater sau nếu cần
   cập nhật ngầm). Mã Rust đã `cargo check` sạch.
6. Còn lại: build file cài NSIS trên máy Windows (`cd desktop && npm install
   && npm run build`), upload + đặt NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL.

**Giai đoạn C — hoàn thiện**
1. ✅ Khôi phục ngược: trang MStudo Desktop nhận file mstudo-backup JSON →
   xem trước từng mảng (trong file / sẽ thêm mới / trùng) → mặc định chỉ THÊM
   bản ghi bị mất; tùy chọn ghi đè bản trùng. Gửi theo lô ≤ ~900KB (giới hạn
   Vercel); owner_id luôn bị ép về tài khoản hiện tại, bảng con phải có cha
   thuộc tài khoản; chạy lại cùng file an toàn (bản ghi đã vào tự bỏ qua).
2. ✅ Quản lý thiết bị (danh sách + thu hồi) ngay trên trang MStudo Desktop.
3. (Làm sau) Sao lưu Google Drive từ server; cache offline.

## 9. Đồng bộ ảnh/video hợp đồng lên Google Drive (đã triển khai)

> Khác đề xuất "chạy từ server" ban đầu: đồng bộ do **client** thực hiện (tải
> thẳng lên Drive, không qua máy chủ) nên video lớn vẫn được. Quyết định đã chốt.

| Hạng mục | Quyết định |
| --- | --- |
| Kết nối Drive | **Trên web**, tính năng riêng ở **Khách hàng → Đồng bộ Drive** (`/dashboard/studio/drive-sync`). Per-studio OAuth, scope `drive.file`, refresh token để ở bảng riêng `studio_drive` (RLS, chỉ service-role đọc). |
| Thư mục gốc Drive | App tạo 1 thư mục gốc trong Drive studio, **tên do studio đặt** (`studio_drive.root_folder_name`, mặc định `MStudo`). Studio có thể **tự kéo thư mục này đi bất kỳ đâu** trong Drive — app vẫn đồng bộ đúng (lưu theo folder ID). |
| Thư mục gốc trên máy | **Studio tự chọn** trong app desktop (`cfg.mediaDir`) — KHÔNG còn nằm trong `HopDong/`. Mỗi hợp đồng 1 thư mục con trong thư mục gốc này. |
| Thời điểm | Khi hợp đồng **đã ký / xác nhận** (`client_signed_at` hoặc `status='approved'`). Ký xong: **máy chủ tạo ngay cây thư mục Drive + album** (không chờ app desktop); thư mục trên **máy** do app desktop tạo khi chạy. |
| Chọn tạo thư mục | Ngay khi **tạo hợp đồng**, studio chọn tạo **Photo** (mặc định bật) và **Video** (mặc định tắt — chọn riêng khi có quay). Lưu ở `studio_contracts.drive_make_photo/video`. |
| Chiều đồng bộ | **1 chiều**: máy → Drive (tải file mới lên; không kéo ngược). |
| Cây thư mục | `{Tên hợp đồng}/Photo/{JPG Goc, Raw, File ChinhSua}` + `Video/{Video Goc, Video HoanThien}` (khi chọn có quay) — tất cả trong 1 thư mục gốc lấy tên hợp đồng. Studio đổi tên/thêm/bớt trong *Mẫu thư mục mặc định* (nhóm photo/video). |
| Loại trừ | Mỗi thư mục có cờ "Đồng bộ Drive"; mặc định **Raw** và **Video Goc** bị loại trừ (chỉ giữ ở máy). |
| Album tự tạo | **JPG Goc** → album chọn ảnh (`selection`); **File ChinhSua** → gallery giao khách (`delivery`). Gắn vào `studio_contracts.selection_album_id` / `gallery_album_id`. Hai thư mục này được đặt công khai *ai-có-link* để đọc qua `GOOGLE_API_KEY`. |
| Mốc tạo album | Album **chọn ảnh** tạo khi hợp đồng sang *đang thực hiện* / *hoàn thành*. Album **giao khách** chỉ tạo khi hợp đồng *hoàn thành* **và** thư mục *File ChinhSua* đã có ảnh — hoàn thành là mốc TIỀN, hậu kỳ có thể còn dở, lúc đó khách vẫn ở giai đoạn chọn ảnh. Ảnh lên Drive sau thì `/api/desktop/drive/prepare` (resync) hoặc cron `/api/cron/zalo?only=work` tạo bù, kèm tin Zalo `delivery_ready`. |
| Upload | Máy chủ cấp **access token tạm** (`/api/desktop/drive/token`); client tải file **thẳng** lên Drive bằng resumable upload theo khối 8MB (video lớn không nạp hết vào RAM). |

**Đồng bộ near-realtime**: app tự đồng bộ hợp đồng mỗi **20 giây** + **ngay khi
mở/quay lại cửa sổ app** (focus/visibilitychange, có tiết lưu 8s) — không cần bấm.
Phát hiện hợp đồng mới ký → tạo thư mục + upload ngay. Quét file ảnh/video mới
mỗi 2 phút và khi focus.

**Luồng client** (`ui/app.js` → `runDriveSync`): với mỗi hợp đồng đã ký, gọi
`POST /api/desktop/drive/prepare` → nhận sơ đồ cây `[{path,id,role,excluded}]`,
tạo thư mục local tương ứng, quét file mới (so khớp size+mtime trong
`mstudo-drive.json`) rồi tải lên Drive; khi có file mới vào JPG Goc/File ChinhSua
gọi lại prepare với `resync=true` để làm mới danh sách ảnh của album.

**UI web**: trang riêng `/dashboard/studio/drive-sync` (nhóm *Khách hàng*) —
kết nối Drive, đặt tên thư mục gốc, chỉnh mẫu thư mục (photo/video).

**Env**: `GOOGLE_STUDIO_DRIVE_REDIRECT_URI` (…/api/studio/drive/callback), dùng
chung `NEXT_PUBLIC_GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`. Migration:
`supabase/migrations/studio_drive_sync.sql`.

**Lệnh Rust mới** (`src-tauri/src/main.rs`): `create_dir`, `list_dir`,
`drive_upload` (resumable).

**Còn để sau**: dọn file trùng khi ảnh bị sửa/tải lại (hiện tạo bản mới trên
Drive), đồng bộ ngược Drive → máy, theo dõi thư mục theo thời gian thực.

## 8. Việc còn mở (chốt khi làm)

- Mẫu file Word hợp đồng (dùng đúng mẫu hợp đồng hiện tại, có logo studio?).
- Cột cụ thể của từng file Excel (lấy theo màn hình danh sách hiện tại, chốt khi code).
- Tên miền/đường dẫn chứa file cài đặt và manifest cập nhật.
