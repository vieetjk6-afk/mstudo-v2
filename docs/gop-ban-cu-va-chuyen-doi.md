# Gộp bản đang chạy vào 2.0 rồi chuyển sang GitHub · Supabase · Vercel mới

Tình huống: `mstudo.com` đang chạy repo cũ (`vieetjk01/Studio`, nhánh
`claude/stoic-fermi-gf0pg4`) trên **Vercel cũ + Supabase cũ**. Bản 2.0 đã dựng
xong và **đang chạy** ở repo này (`mstudo-v2`, nhánh `main`) trên **GitHub mới +
Supabase mới + Vercel mới**. Việc còn lại: đưa dữ liệu thật từ bản cũ sang môi
trường mới rồi cắt tên miền.

> ⚠️ **Đích ĐANG ĐƯỢC DÙNG.** `clone-from-old-project.sql` xoá sạch project đích
> (`delete from auth.users` + `truncate` mọi bảng `public`) rồi mới chép. Chạy
> [`supabase/kiem-tra-truoc-khi-chep.sql`](../supabase/kiem-tra-truoc-khi-chep.sql)
> **trước** để biết đang có gì sắp mất — xem mục 2.4.

> 📋 File này là **kế hoạch** — giải thích vì sao làm từng thứ, và ghi lại phần
> gộp code đã xong. Khi bắt tay vào làm thật, mở
> [`chuyen-doi-mstudo-2.0.md`](./chuyen-doi-mstudo-2.0.md) — đó là bản hướng dẫn
> đang dùng, từng cú bấm theo thứ tự.

Có **hai thứ** phải gộp, đừng lẫn vào nhau:

| | Gộp thế nào | Trạng thái |
|---|---|---|
| **Code** — tính năng bản cũ làm thêm | `git merge` (hai repo chung lịch sử) | ✅ **xong**, mục 1 |
| **Dữ liệu** — hợp đồng, album, khách tuần qua | Chép sang Supabase mới trong cửa sổ đóng băng | ⬜ mục 2–3 |

---

## 1. Code — đã gộp xong

Hai repo **chung lịch sử git** (mstudo-v2 tách ra từ chính nhánh đó), nên gộp
bằng `git merge` thật, không phải chép tay.

Điểm tách: `28ae9c5` (01/08). Từ đó tới nay bản cũ có **12 commit** mà 2.0 chưa
có — tất cả làm ngày **07/08**; 2.0 có 41 commit bản cũ chưa có. Đã gộp 12
commit đó vào nhánh này (`abd27ff`):

- **Công cụ lọc ảnh** tách thành `<FilterTool/>` dùng chung — trang đầy đủ và
  popup "Lọc ảnh" trong quản lý album gọi cùng một thành phần.
- **Copy ảnh đã lọc thẳng sang Drive**: studio nối Drive một lần, máy chủ tự
  tạo thư mục `Anh Chon` trong đúng link ảnh gốc (4 route `/api/filter/*`).
- **Khách bấm "đã chọn xong"** → báo studio qua chuông + push + Zalo.
- Sửa lỗi `{"error":"forbidden"}` khi kết nối Google Drive.

Gộp tiếp về sau (nếu bản cũ còn commit mới):

```bash
git remote add old https://github.com/vieetjk01/studio   # nếu chưa có
git fetch old
git merge old/claude/stoic-fermi-gf0pg4
```

---

## 2. Ba việc phải hiểu trước khi chép dữ liệu

### 2.1 File trong Storage KHÔNG đi theo dữ liệu

`clone-from-old-project.sql` chỉ chép **database**. Ảnh nằm trong Storage phải
tải xuống rồi tải lên tay: 3 bucket **`logos`, `wedding-photos`,
`payment-proofs`** (~36 MB).

**Đừng chép `drive-cache`** — 13 GB cache ảnh, chính là thứ làm vượt hạn mức
Free của project cũ (xem [`docs/supabase-usage.md`](./supabase-usage.md)). Nó
tự sinh lại khi cần. Ở project mới cứ **để trống `DRIVE_IMG_CACHE_BUCKET`**.

### 2.2 URL ảnh trong database vẫn trỏ về project CŨ

App lưu ảnh bằng `getPublicUrl()`, tức trong database là URL đầy đủ
`https://<ma-project-cu>.supabase.co/storage/v1/object/public/…`. Chép sang
project mới thì các URL đó **vẫn trỏ về project cũ**.

Nguy hiểm ở chỗ: chừng nào project cũ còn sống thì ảnh vẫn hiện bình thường, rất
dễ tưởng đã xong; tới lúc xoá/tạm dừng project cũ là logo studio, ảnh chuyển
khoản của khách, ảnh thiệp cưới, ảnh bìa album đồng loạt chết.

→ Chạy [`supabase/rewrite-storage-urls.sql`](../supabase/rewrite-storage-urls.sql)
trên project **MỚI** sau khi chép xong. Script quét mọi cột text/jsonb trong
`public` và đổi mã project, rồi tự kiểm tra lại phải in ra "Sạch".

### 2.3 Tài khoản đăng nhập đi theo, nhưng Google login thì không tự

Script có chép `auth.users` + `auth.identities`, nên **email + mật khẩu cũ vẫn
đăng nhập được**. Nhưng nếu studio nào đăng nhập bằng Google thì phải bật
**Authentication → Providers → Google** ở project mới với **đúng Client ID /
Secret cũ**, không thì Supabase coi đó là người lạ và tạo tài khoản mới.

Tin tốt: mọi token trong dữ liệu (`client_token` của hợp đồng/báo giá,
`intake_token`, `calendar_token`, `crew_token`, `slug` album) đi theo nguyên
vẹn → **link đã gửi cho khách vẫn chạy** sau khi chuyển, miễn tên miền không đổi.

### 2.4 Đích đang được dùng — phải xử lý trước

`clone-from-old-project.sql` được viết cho project **trắng**. Bước đầu của nó là:

```sql
delete from auth.users;                     -- mất mọi tài khoản ở project mới
truncate table <mọi bảng public> cascade;   -- mất mọi dữ liệu nghiệp vụ
```

Không hỏi lại, không hoàn tác được. Vì 2.0 đã chạy một thời gian nên phải biết
đích đang có gì: chạy
[`supabase/kiem-tra-truoc-khi-chep.sql`](../supabase/kiem-tra-truoc-khi-chep.sql)
ở SQL Editor project MỚI (chỉ đếm, không sửa gì).

**Nếu in ra `TRỐNG` hoặc chỉ có dữ liệu xem thử** (vài tài khoản của bạn, hợp
đồng nháp tự tạo để soi giao diện) → bỏ đi được, chạy clone như mục 3.

**Nếu đích đã có dữ liệu THẬT** (hợp đồng của khách, ảnh khách đã chọn, khoản đã
thu) thì **đừng chạy clone** — nó xoá mất. Ba lối đi, theo thứ tự nên chọn:

| Cách | Khi nào hợp | Việc phải làm |
|---|---|---|
| **Nhập lại tay** | Đích chỉ có vài bản ghi | Chép ra giấy/ảnh màn hình, chạy clone, nhập lại sau |
| **Đổi vai trò hai project** | Đích có nhiều dữ liệu thật hơn nguồn | Giữ Supabase mới làm chính, chép NGƯỢC phần thiếu từ project cũ sang bằng câu `insert … select` cho từng bảng |
| **Gộp hai chiều** | Cả hai bên đều nhiều | Việc lớn: phải xử lý trùng khoá chính, trùng email tài khoản, trùng `client_token`. Nói trước để làm riêng, đừng làm vội trong cửa sổ cắt |

---

## 3. Thứ tự việc

### Giai đoạn A — chuẩn bị trước, KHÔNG ảnh hưởng bản đang chạy

1. **Đưa nhánh giao diện vào `main`.** Nhánh làm việc hiện tại đi trước `main`
   và không thiếu commit nào của `main` → gộp là fast-forward sạch, không xung
   đột. Deploy `main` lên Vercel mới rồi soi lại một lượt.
2. **Kiểm tra đích trước khi tính chuyện chép** — mục 2.4.
3. **Supabase mới**: chạy lại toàn bộ
   [`supabase/setup-all.sql`](../supabase/setup-all.sql). *Phải chạy lại kể cả
   khi đã chạy trước đây* — file vừa được sinh lại kèm 2 cột mới của tuần qua
   (`studio_notifications.album_id`, `studio_drive.filter_refresh_token`).
4. **Biến môi trường** cho Vercel mới: chép từ Vercel cũ rồi sửa những biến
   bắt buộc đổi ([`docs/chuyen-vercel.md`](./chuyen-vercel.md) mục 2). Nhớ:
   - 3 khoá Supabase → của project **mới**
   - `VERCEL_PROJECT_ID` / `VERCEL_TEAM_ID` → project **mới** (quên thì studio
     thêm domain riêng sẽ đăng ký nhầm vào project cũ)
   - `CRON_SECRET` — không có là 5 route cron trả 401 và im lặng ngừng chạy
   - **mới:** `GOOGLE_FILTER_DRIVE_REDIRECT_URI` =
     `https://<miền>/api/filter/drive/callback`
   - `DRIVE_IMG_CACHE_BUCKET` → **để trống**
5. **Khai callback ở bên thứ ba** ([`docs/chuyen-vercel.md`](./chuyen-vercel.md)
   mục 4): Google Cloud (thêm cả URI `filter/drive/callback` mới), **Supabase
   Auth của project MỚI**, Zalo, Turnstile. Giữ nguyên URI cũ, cắt xong mới xoá.
6. **Chạy thử `clone-from-old-project.sql` một lần** vào lúc rảnh, để biết mất
   bao nhiêu phút và bấm Run bao nhiêu lần. Dữ liệu thật lúc cắt sẽ chép đè lần
   nữa nên lần chạy thử này bỏ đi được.
7. **Deploy và đi hết checklist** ở [`docs/chuyen-vercel.md`](./chuyen-vercel.md)
   mục 5 trên `*.vercel.app`.

### Giai đoạn B — cửa sổ đóng băng (~1–2 tiếng)

Từ bước 2 tới bước 6, **dữ liệu khách nhập vào sẽ mất** — nên phải dừng nhập
liệu thật. Chọn giờ vắng (khuya).

1. Báo studio dừng nhập liệu **ở CẢ HAI bản** (bản cũ và bản 2.0 đang chạy).
2. **Pause project Vercel cũ** (Settings → Pause Project) — dừng cả traffic lẫn
   cron, không ai ghi thêm được.
3. **Chép dữ liệu** (chỉ khi mục 2.4 đã cho phép):
   `supabase/clone-from-old-project.sql` trên project MỚI,
   4 lần Run theo [`docs/thiet-lap-moi.md`](./thiet-lap-moi.md) mục 3b; phần 3
   bấm lại tới khi hiện `✅ XONG TẤT CẢ`.
4. **Chép 3 bucket Storage** (`logos`, `wedding-photos`, `payment-proofs`).
5. **Chạy [`supabase/rewrite-storage-urls.sql`](../supabase/rewrite-storage-urls.sql)**
   trên project mới → phải in ra `── Sạch`.
6. **Đối chiếu số dòng** vài bảng chính giữa hai project trước khi cắt:
   ```sql
   select 'contracts' t, count(*) from studio_contracts
   union all select 'albums',     count(*) from albums
   union all select 'selections', count(*) from selections
   union all select 'payments',   count(*) from contract_payments
   union all select 'profiles',   count(*) from profiles;
   ```
7. **Cắt tên miền** theo [`docs/chuyen-vercel.md`](./chuyen-vercel.md) mục 6
   (hạ TTL xuống 60 giây từ hôm trước; nhớ cả `*.mstudo.com` và domain riêng
   của studio khách — lấy danh sách bằng câu SQL trong tài liệu đó).
8. Đi lại checklist "Kiểm ngay sau khi cắt" trong mục 6.

### Giai đoạn C — sau khi cắt

1. **Đổi secret deploy trong GitHub mới** (`VERCEL_PROJECT_ID`, `VERCEL_ORG_ID`,
   `VERCEL_TOKEN`) hoặc cài Vercel GitHub App rồi xoá
   `.github/workflows/vercel-deploy.yml`.
2. **Dọn `drive-cache` ở project cũ** nếu còn giữ project đó — 13 GB đang tính
   vào hạn mức.
3. Giữ **cả Vercel cũ lẫn Supabase cũ** ít nhất 7 ngày để còn quay đầu. Quay đầu
   = đảo lại bước 7 giai đoạn B, bỏ Pause project cũ; dữ liệu bản cũ vẫn nguyên
   vì từ lúc Pause không ai ghi thêm.
4. Sau 7 ngày êm: xoá project Vercel cũ, thu hồi token cũ, xoá redirect URI cũ
   trong Google Cloud và Supabase cũ. **Chỉ xoá Supabase cũ khi đã chắc
   `rewrite-storage-urls.sql` chạy sạch** — không thì ảnh chết hàng loạt.

---

## 4. Còn một việc chưa xác định: "thay đổi ở trang mstudo"

Đã soi toàn bộ 12 commit của bản cũ từ điểm tách tới nay — **không commit nào
đụng trang chủ / landing** (`src/app/LandingPage.tsx`, `src/app/page.tsx`,
`SiteRenderer`, `dashboard/site`). Nên thay đổi đó rơi vào một trong ba khả năng:

| Khả năng | Cách xử lý |
|---|---|
| Sửa qua **giao diện quản trị** (nội dung trang, bảng giá, ảnh, chatbox…) | Nằm trong **database** → chép dữ liệu ở giai đoạn B là tự có |
| Sửa code nhưng **chưa push** / ở máy khác | Push lên rồi `git fetch old && git merge` lần nữa |
| Sửa code ở **nhánh khác** của repo cũ | Cho biết tên nhánh, gộp thêm nhánh đó |
