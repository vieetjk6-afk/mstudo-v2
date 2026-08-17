# Giảm dung lượng & băng thông Supabase

Ghi chép cách mstudo tiêu tốn hạn mức Supabase, vì sao nó vượt, và cách kéo xuống.

Hạn mức gói Free: **Egress 5 GB · File storage 1 GB · Database 500 MB · MAU 50.000**.

## Đo thực tế (07/2026)

```
bucket_id        objects   size
drive-cache      10656     13 GB     ← 99,7%
payment-proofs   20        26 MB
wedding-photos   42        9820 kB
logos            3         410 kB
```

Bucket cache là toàn bộ vấn đề; ba bucket còn lại cộng lại 36 MB. Bóc tách tiếp:

```
loai              count   size
orig (full-res)   950     10 GB     ← 8,9% số file, 77% dung lượng
thumbnail         9720    2451 MB
```

Ảnh gốc trung bình **10,8 MB/file** — tắt cache ảnh gốc cắt ngay 10 GB.

Nhưng riêng thumbnail đã là **2,4 GB, vẫn gấp 2,4 lần hạn mức 1 GB**, và ở mức
258 KB/ảnh thì chỉ ~19.000 lượt xem ảnh/tháng là chạm trần egress 5 GB. Tức là
với gói Free, KHÔNG có cấu hình nào của bucket này là bền vững — xem mục 4 phần
"Cần làm ngay".

Dashboard lúc đó báo 1.53 GB: metering storage của Supabase cập nhật theo chu kỳ
nên số trên dashboard trễ hơn thực tế khá nhiều. Tin `storage.objects`.

## Cái gì đang tốn

| Hạng mục | Nguồn tốn chính |
|---|---|
| **File storage** | Bucket cache ảnh Drive (`DRIVE_IMG_CACHE_BUCKET`) — `/api/img` lưu mỗi ảnh đã proxy thành một object `<id>_w<width>.jpg`, và trước đây cả bản gốc `<id>_orig`. Ảnh gốc một tấm cưới thường 5–15 MB. |
| | Bucket `wedding-photos` — ảnh/nhạc của thiệp cưới. Trước đây **không có** job nào dọn ảnh của thiệp đã xoá. |
| | Bucket `payment-proofs` — đã có cron xoá sau 30 ngày kể từ khi hợp đồng hoàn thành. |
| **Egress** | Mỗi lần bucket cache phục vụ ảnh (302 → CDN Supabase) đều tính egress. Nặng nhất là bản gốc tải ZIP. |
| | Truy vấn DB từ Vercel. Đáng kể nhất là polling: trang album khách hàng trước đây gọi lại `/api/a/<slug>/select` mỗi 5 giây, kể cả khi tab bị ẩn. |
| **Database** | 69 MB / 500 MB — chưa phải vấn đề. |

Điểm mấu chốt: **ảnh HIỂN THỊ không tốn gì của Supabase.** `/api/img` đã 302 thẳng
sang CDN của Google cho các lượt tải `<img>` thông thường (xem `IMG_CDN_REDIRECT`).
Phần chảy qua Supabase chỉ là byte không redirect được: tải ZIP, tải bản gốc, và
ảnh fetch cross-origin để đóng watermark bằng canvas.

## Đã sửa những gì

1. **Không cache ảnh gốc nữa** (`DRIVE_IMG_CACHE_ORIGINALS`, mặc định tắt). Bản gốc
   chảy thẳng từ Google qua Vercel — Supabase tốn 0 byte storage và 0 byte egress.
   Đây là thay đổi có tác dụng lớn nhất.
2. **Chỉ cache bề rộng ≤ 1024** (`DRIVE_IMG_CACHE_MAX_WIDTH`). Bản w=2000/2560 chỉ
   được fetch đúng một lần lúc tải về, cache vào chỉ tốn chỗ.
3. **Trần dung lượng cứng cho bucket cache** (`DRIVE_IMG_CACHE_MAX_BYTES`, mặc định
   500 MB). Dọn theo tuổi thôi thì không bao giờ đủ — bucket đầy từ lâu trước khi
   file đầu tiên đủ tuổi. Cron nay xoá tiếp file cũ nhất cho tới khi lọt trần.
4. **Cron cache chạy hằng ngày** thay vì hằng tuần, và hạn tuổi mặc định 60 → 21 ngày.
5. **Cron mới `cleanup-wedding-photos`** (hằng tuần) xoá ảnh của thiệp cưới đã bị xoá.
   Chỉ đụng vào thư mục mồ côi — thiệp còn sống thì không bao giờ bị chạm.
6. **Album khách hàng poll 20 giây và dừng khi tab bị ẩn** (trước: 5 giây, chạy mãi).

Xoá cache **không mất dữ liệu gì**: mọi object trong bucket cache đều dựng lại được
từ Drive ở lần xem kế tiếp, chỉ tốn đúng một lượt fetch qua Vercel.

## Cần làm ngay để lấy lại chỗ (dự án đang vượt hạn mức)

Các thay đổi trên chặn tăng trưởng về sau; phần đã chiếm chỗ phải tự thu hồi.

**1. Dọn sạch bucket cache một lần.** Nhanh nhất với bucket đã phình to: Supabase →
Storage → `drive-cache` → **Empty bucket**. Chạy phía server nên không vướng giới hạn
thời gian của function. Không mất gì: mọi object đều dựng lại được từ Drive.

Hoặc qua endpoint (chạy lặp tới khi `done: true`):

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://<domain>/api/cron/cleanup-drive-cache?purge=1"
```

Storage chỉ xoá được 1000 object mỗi lượt gọi, nên job có ngân sách thời gian và
tự dừng trước khi hết giờ. `done: false` nghĩa là còn việc — gọi lại; tiến độ đã
xoá không mất đi.

**2. Dọn ảnh thiệp cưới mồ côi:**

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://<domain>/api/cron/cleanup-wedding-photos"
```

**3. Kiểm tra bucket nào đang chiếm chỗ** — chạy trong Supabase SQL Editor:

```sql
select bucket_id,
       count(*)                                             as objects,
       pg_size_pretty(sum((metadata->>'size')::bigint))     as size
from storage.objects
group by bucket_id
order by sum((metadata->>'size')::bigint) desc;
```

**4. Tắt hẳn bucket cache khi còn ở gói Free** — đặt `DRIVE_IMG_CACHE_BUCKET=`
(để trống) trên Vercel. `/api/img` quay về chế độ proxy thuần: storage và egress
Supabase cho ảnh về **0**, Vercel gánh băng thông (Free 100 GB/tháng, rộng gấp 20
lần 5 GB của Supabase).

Số đo ở trên cho thấy đây không phải lựa chọn "tuỳ khẩu vị": chỉ riêng thumbnail đã
2,4 GB trên hạn mức 1 GB, nên mọi cấu hình còn lại chỉ là chọn hy sinh cái gì. Trần
500 MB, hạn tuổi và chặn ảnh gốc là lưới an toàn cho ngày lên gói Pro và bật lại
bucket — không phải cách sống được với gói Free.

Khách hàng không thấy khác biệt: ảnh HIỂN THỊ vốn đã 302 thẳng sang CDN Google từ
trước và không hề đụng Supabase. Chỉ ZIP/watermark chuyển sang chảy qua Vercel.

## Vài điều cần biết

- Ảnh trong bucket cache **không** được tham chiếu từ bảng nào — chúng được đánh địa
  chỉ theo nội dung (`<id>_w<width>.jpg`). Vì thế cron dọn theo tuổi/dung lượng chứ
  không dò theo bản ghi DB.
- Ảnh người dùng tải lên ưu tiên vào **Drive của admin** (`uploadToAdminDrive`), chỉ
  rơi xuống Supabase Storage khi Drive chưa kết nối. Nếu `wedding-photos` phình to,
  kiểm tra kết nối Drive admin trước — nhiều khả năng nó đã rớt và mọi thứ đang
  fallback sang Supabase.
- Egress trên gói Free tính cả byte phục vụ qua CDN, nên tăng `cacheControl` không
  làm giảm hoá đơn egress. Cách duy nhất để giảm là **đừng để byte đi ra từ Supabase**
  — tức đẩy chúng sang CDN Google, đúng như những gì các thay đổi trên làm.

---

## Cập nhật 08/2026 — đóng dấu chìm chuyển sang phía máy chủ

Bối cảnh: Vercel báo **Fast Origin Transfer 10,74 GB / 10 GB** (vượt hạn mức),
trong khi Fluid Active CPU mới dùng 2h22m/4h.

### Đường rò đã tìm ra

Sau khi đã 302 lượt xem sang CDN Google và gỡ `buildZip()`, byte còn chảy qua
máy chủ nhiều nhất là **tải ảnh có đóng dấu**:

`lib/download.ts` nạp `/api/img?id=…&w=2560` bằng `<img crossOrigin="anonymous">`
để canvas đọc pixel. Đường này tránh được cả ba lớp tiết kiệm:

| Lớp | Vì sao không áp dụng |
|---|---|
| 302 sang CDN Google | request là `Sec-Fetch-Mode: cors`, chuyển hướng sang Google thì canvas bị "tainted" |
| Cache Supabase | `w=2560` vượt `DRIVE_IMG_CACHE_MAX_WIDTH` (1024) |
| 302 cho `<img>` thường | không áp dụng cho request CORS |

Đường rò thứ hai: **xuất file in của trình thiết kế album** kéo ảnh gốc
(`orig=1`, trung bình 10,8 MB) cho từng ảnh trên từng trang đôi. Một lần xuất
album 30 trang đôi ≈ 648 MB.

### Đã sửa gì

Đóng dấu chuyển sang máy chủ: `/api/img/watermark` + `lib/watermark.ts`
(sharp, chữ dựng bằng SVG). `lib/download.ts` chỉ còn tạo thẻ `<a>` — không
byte ảnh nào vào JavaScript của trình duyệt nữa.

Số đo trên ảnh 2560px chi tiết cao:

| | Kích thước | Thời gian |
|---|---|---|
| Ảnh nguồn Google trả về | 1,41 MB | — |
| mozjpeg q90 (mặc định) | **1,17 MB (−17%)** | 510–1100 ms |
| không mozjpeg q90 (≈ trình duyệt) | 1,42 MB (+1%) | 180 ms |

Đổi CPU lấy băng thông — đúng hướng khi transfer là thứ khan hiếm. Tắt bằng
`WATERMARK_MOZJPEG=0` nếu CPU thành nút thắt.

**Nói thẳng: cách này KHÔNG đưa dự án về dưới hạn mức.** Byte vẫn phải rời khỏi
máy chủ; chỉ nhỏ đi 17%. Muốn hết hẳn thì byte phải được phục vụ từ nơi khác —
tức là chuyển sang VPS (băng thông 1–2 TB/tháng) hoặc đẩy cache sang R2.

Lợi ích phụ, không liên quan băng thông: máy yếu không còn dựng canvas 2560px
(trước đây tải album lớn hay hết bộ nhớ rồi im lặng thất bại), và tên file tải
về đặt đúng được cả tên tiếng Việt.

### Một kiểu hỏng phải canh chừng

Thiếu font hệ thống thì sharp vẫn dựng ảnh bình thường, chỉ có chữ watermark
render ra **rỗng** — khách nhận ảnh không có dấu bảo vệ, log sạch bong, không
ai biết. `deploy/setup-vps.sh` cài sẵn `fonts-dejavu-core`, và
`deploy/activate.sh` dựng thử một ảnh chữ rồi đếm điểm ảnh mực, dưới ngưỡng thì
**chặn deploy**.

### Chưa làm

Xuất file in của trình thiết kế album vẫn chạy ở trình duyệt. Chuyển sang máy
chủ sẽ cắt được nhiều byte nhất (N ảnh gốc vào → 1 file ra), nhưng canvas
300 DPI cần ~100 MB bộ nhớ mỗi trang đôi nên **sẽ hết bộ nhớ trên hàm Vercel**
(1 GB). Làm sau khi đã chuyển sang VPS.

### Cập nhật tiếp — đóng dấu chuyển thành tự chọn

Số liệu Vercel rõ hơn: **11,54 GB / 10 GB**, và biểu đồ cho thấy gần như toàn
bộ dồn vào **4 ngày** (một ngày 4,42 GB đi ra, chiều Incoming chỉ 333 MB). Tức
là không phải tải đều — mà là vài đợt khách tải album hàng loạt.

Nguyên nhân gốc: `albums.watermark_enabled` để **`default true`**, nên mọi
album chọn ảnh đều bật đóng dấu kể cả khi studio không hề chạm vào cài đặt.
Khác biệt băng thông giữa hai trạng thái là tuyệt đối:

| | Khách bấm tải ảnh | Máy chủ tốn |
|---|---|---|
| **Có** watermark | ảnh 2560px phải chảy qua máy chủ | ~1,2 MB / ảnh |
| **Không** watermark | 302 thẳng sang Google Drive | **0 byte** |

Không phải giảm 17% — mà là **về 0** cho những album không cần đóng dấu.

Đã sửa:

- `supabase/migrations/watermark_opt_in.sql` — đổi mặc định cột sang `false`,
  kèm khối SQL **tuỳ chọn** (đang chú thích) để tắt cho album đang có
- `schema.sql` + `setup-all.sql` — mặc định `false` cho bản cài mới
- `lib/studio-drive.ts` — album đồng bộ từ Drive không còn tự bật watermark

`watermark_delivery` (gallery giao hàng) vốn đã `default false`, không đụng tới.
`CreateAlbumFlow` vốn đã chỉ bật khi studio gõ chữ watermark, giữ nguyên.

Việc đóng dấu phía máy chủ ở mục trên **vẫn giữ** — nó phục vụ những studio
thật sự bật watermark, và với họ thì vẫn nhỏ hơn 17% so với cách cũ.
