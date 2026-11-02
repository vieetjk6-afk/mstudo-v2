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

## Sự cố 11/2026: bị khoá vì vượt egress (8,53 / 5 GB)

Số đo lúc đó: File storage 0,02 GB (bucket cache đã tắt), DB 348 MB, Log
Ingestion 3,3 GB, chỉ 15 MAU. Egress gần như toàn bộ là **truy vấn database**.

Thủ phạm tìm được trong log GitHub Actions của "Quét khuôn mặt":

1. **Gom khuôn mặt lại sau mỗi lượt cron.** `scanAlbum` đặt
   `faces_clustered_at = null` sau MỖI mẻ ghi 20 ảnh, nên lượt cron nào cũng
   `clusterAlbum` lại album đang quét — đọc toàn bộ `album_faces` kèm vector 128
   số (~1,5 KB/khuôn mặt, tới cả MB mỗi album). Album 1.449 ảnh quét ~35
   tấm/lượt bị gom lại ~40 lần. Nay chỉ đưa vào lại hàng đợi gom khi quét hết
   album, hoặc lần gom trước đã cũ hơn 12 giờ.
2. **Ảnh 404 thử lại mãi.** Một album 111 tấm đã xoá khỏi Drive bị tải lại ở
   mọi lượt và chiếm một chỗ hàng đợi. Nay lỗi vĩnh viễn (`http-404`,
   `khong-phai-jpeg`) được đánh mốc luôn.

Kiểm thử: `npm run test:face-gom-it`.
