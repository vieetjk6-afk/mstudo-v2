# Gộp bản đang chạy vào 2.0 rồi cắt sang Vercel mới

Tình huống: `mstudo.com` đang chạy repo cũ (`vieetjk01/Studio`, nhánh
`claude/stoic-fermi-gf0pg4`) trên **Vercel cũ + Supabase cũ**. Repo này
(`mstudo-v2`) là bản làm lại giao diện, đang chạy thử trên **Vercel mới +
Supabase mới**. Tuần vừa rồi bản cũ có thêm dữ liệu thật và thêm tính năng.

Có **hai thứ** phải gộp, đừng lẫn vào nhau:

| | Gộp thế nào | Trạng thái |
|---|---|---|
| **Code** — tính năng bản cũ làm thêm | `git merge` (hai repo chung lịch sử) | ✅ **xong**, xem mục 1 |
| **Dữ liệu** — hợp đồng, album, khách tuần qua | Quyết định dùng Supabase nào | ⬜ xem mục 2 |

---

## 1. Code — đã gộp xong

Hai repo **chung lịch sử git** (mstudo-v2 tách ra từ chính nhánh đó), nên gộp
được bằng `git merge` thật, không phải chép tay.

Điểm tách: `28ae9c5` (01/08). Từ đó tới nay:

- Bản cũ có **12 commit** mà 2.0 chưa có — tất cả làm ngày **07/08**.
- 2.0 có **41 commit** bản cũ chưa có (bộ SQL 2.0 + toàn bộ giao diện mới).

Đã gộp 12 commit đó vào nhánh này (commit `abd27ff`). Nội dung mang sang:

- **Công cụ lọc ảnh** tách thành `<FilterTool/>` dùng chung — trang đầy đủ và
  popup "Lọc ảnh" trong quản lý album gọi cùng một thành phần.
- **Copy ảnh đã lọc thẳng sang Drive**: studio nối Drive một lần, máy chủ tự
  tạo thư mục `Anh Chon` trong đúng link ảnh gốc (4 route `/api/filter/*` +
  `src/lib/filter-drive.ts`).
- **Khách bấm "đã chọn xong"** → báo studio qua chuông + push + Zalo
  (`/api/a/[slug]/done`, thông báo loại `selection`).
- Sửa lỗi `{"error":"forbidden"}` khi kết nối Google Drive.

Bốn file phải gỡ xung đột tay vì 2.0 đã dựng lại giao diện ở đúng chỗ đó
(`AlbumList`, `AlbumEditor`, `filter/page.tsx`, `NotificationsList`) — đã giữ
giao diện 2.0 và ghép thêm chức năng mới của bản cũ.

Kiểm tra lại sau khi gộp: `tsc --noEmit`, `next build`, 4 bộ test — sạch.

> Nếu bản cũ còn commit mới sau 07/08, gộp tiếp bằng:
> ```bash
> git remote add old https://github.com/vieetjk01/studio   # nếu chưa có
> git fetch old
> git merge old/claude/stoic-fermi-gf0pg4
> ```

### Hai thứ đi kèm phải khai báo thêm

| Việc | Chi tiết |
|---|---|
| Biến môi trường mới | `GOOGLE_FILTER_DRIVE_REDIRECT_URI` = `https://<miền>/api/filter/drive/callback` |
| Google Cloud Console | Thêm đúng URI đó vào *Authorized redirect URIs* của OAuth Web client |
| Schema | 2 cột mới: `studio_notifications.album_id`, `studio_drive.filter_refresh_token` |

Cột mới **đã có sẵn trong Supabase cũ** (production đang chạy code đó). Nếu
dùng Supabase mới thì chạy lại `supabase/setup-all.sql` — file này đã được sinh
lại kèm 2 cột trên.

---

## 2. Dữ liệu — nên giữ Supabase CŨ, chỉ đổi Vercel

**Khuyến nghị: trỏ Vercel mới vào Supabase CŨ.** Bốn lý do:

1. **Không có mốc cắt nào để mất dữ liệu.** Dữ liệu tuần qua — và mọi thứ khách
   nhập từ giờ tới lúc cắt tên miền — vẫn nguyên chỗ cũ. Không phải chép gì.
2. **Chép dữ liệu là thao tác xoá-sạch-rồi-đè.**
   `supabase/clone-from-old-project.sql` xoá toàn bộ dữ liệu project đích rồi
   hút lại từ đầu, phải bấm Run nhiều lần cho tới khi hiện `✅ XONG TẤT CẢ`.
   Làm được, nhưng phải làm **đúng lúc cắt** và trong lúc đó không ai được nhập
   liệu — rủi ro cao mà không đổi lại được gì.
3. **Lý do tạo Supabase mới không nằm ở database.** Theo
   [`docs/supabase-usage.md`](./supabase-usage.md), thủ phạm vượt hạn mức Free là
   **bucket `drive-cache` 13 GB**; database chỉ **69 MB / 500 MB**. Đổi project
   không chữa được điều đó — xoá bucket và để trống `DRIVE_IMG_CACHE_BUCKET`
   mới chữa, và làm được ngay trên project cũ.
4. **2.0 không thêm schema của riêng nó.** Toàn bộ việc làm lại giao diện không
   đụng bảng nào; DB cũ chạy được 2.0 ngay.

Đổi lại, phải nhớ **một** điều: trong lúc hai project Vercel cùng sống mà dùng
chung Supabase thì **cron chạy hai lần** (khách nhận 2 tin Zalo, 2 email). Cắt
xong là **Pause project cũ ngay** — xem
[`docs/chuyen-vercel.md`](./chuyen-vercel.md) mục 7.

### Nếu vẫn muốn sang Supabase mới

Chỉ nên làm khi chấp nhận **đóng băng nhập liệu ~1–2 tiếng**:

1. Thông báo dừng nhập liệu, Pause Vercel cũ.
2. Chạy `supabase/clone-from-old-project.sql` trên project MỚI (4 lần Run theo
   [`docs/thiet-lap-moi.md`](./thiet-lap-moi.md) mục 3b).
3. Chép tay 3 bucket Storage: `logos`, `wedding-photos`, `payment-proofs`
   (~36 MB). **Đừng chép `drive-cache`.**
4. Đối chiếu số dòng vài bảng chính (`studio_contracts`, `albums`, `selections`)
   giữa hai project trước khi cắt tên miền.
5. Cắt tên miền.

Dữ liệu phát sinh sau bước 2 mà trước bước 5 sẽ **mất** — nên phải đóng băng.

---

## 3. Thứ tự việc, từ giờ tới lúc cắt

1. **Gộp code** — xong (mục 1). Deploy nhánh này lên Vercel mới, kiểm tra trên
   `*.vercel.app`.
2. **Bổ sung `GOOGLE_FILTER_DRIVE_REDIRECT_URI`** và khai URI đó ở Google Cloud
   Console.
3. **Trỏ Vercel mới vào Supabase cũ**: đổi 3 biến
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY` sang giá trị của project cũ, rồi Redeploy.
   Để trống `DRIVE_IMG_CACHE_BUCKET`.
4. **Dọn bucket `drive-cache`** trong Supabase cũ (Storage → xoá object) để về
   dưới hạn mức.
5. **Đi hết checklist kiểm thử** ở [`docs/chuyen-vercel.md`](./chuyen-vercel.md)
   mục 5 — lần này với dữ liệu thật, nên soi kỹ hợp đồng và album.
6. **Cắt tên miền** theo mục 6 của tài liệu đó (hạ TTL trước một hôm).
7. **Pause project Vercel cũ ngay** — quan trọng nhất, để cron không chạy đôi.
8. Giữ project cũ ít nhất 7 ngày để còn quay đầu.

Supabase mới sau đó thành môi trường thử: chạy `setup-all.sql` cho trống, hoặc
xoá luôn.

---

## 4. Còn một việc chưa xác định: "thay đổi ở trang mstudo"

Đã soi toàn bộ 12 commit của bản cũ từ điểm tách tới nay — **không commit nào
đụng trang chủ / landing** (`src/app/LandingPage.tsx`, `src/app/page.tsx`,
`SiteRenderer`, `dashboard/site`). Nên thay đổi bạn nói tới rơi vào một trong
ba khả năng:

| Khả năng | Cách xử lý |
|---|---|
| Sửa qua **giao diện quản trị** (nội dung trang, bảng giá, ảnh, chatbox…) | Nằm trong **database** → giữ Supabase cũ là tự có, không phải làm gì |
| Sửa code nhưng **chưa push** / ở máy khác | Push lên rồi `git fetch old && git merge` lần nữa |
| Sửa code ở **nhánh khác** của repo cũ | Cho biết tên nhánh, gộp thêm nhánh đó |

Nếu là khả năng 1 thì đây là thêm một lý do nữa để **giữ Supabase cũ**.
