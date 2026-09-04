# Còn thiếu gì — bảng kiểm toàn bộ

File này trả lời đúng một câu hỏi: **"tôi còn phải làm gì nữa?"**

Nó không hướng dẫn chuyển đổi (đọc [`chuyen-doi-mstudo-2.0.md`](./chuyen-doi-mstudo-2.0.md))
và không đề xuất tính năng mới (đọc [`goi-y-hoan-thien-app.md`](./goi-y-hoan-thien-app.md)).
Nó liệt kê **việc còn dở** trên bản đang chạy, xếp theo bốn nhóm:

| Nhóm | Nội dung | Mục |
|---|---|---|
| 🗄️ SQL | migration nào chưa chạy | [1](#1-sql--kiểm-trong-2-phút) |
| 🎚️ Cờ tính năng | 5 màn đang bị khoá bằng công tắc, không phải bằng lỗi | [2](#2-cờ-tính-năng--5-màn-đang-tự-khoá) |
| 🔑 Biến môi trường | cả 59 biến, nhóm theo tính năng, kèm chỗ lấy | [3](#3-biến-môi-trường--59-biến-nhóm-theo-tính-năng) |
| 🧩 Tính năng | phần code chưa viết | [4](#4-tính-năng-chưa-viết) |

> **Bắt đầu từ đâu:** làm mục 1 → mục 2 → phần 🔴 của mục 3. Ba việc đó là những
> thứ đang *làm hỏng* app. Phần còn lại là mở thêm năng lực.

---

## 0. Tự soi 5 phút — biết mình thiếu gì trước khi đọc tiếp

**a) Biến môi trường.** Trên máy, trong thư mục dự án:

```bash
npx vercel link          # nếu chưa nối project
npx vercel pull          # kéo biến Production về .vercel/.env.production.local
node scripts/kiem-tra-bien.mjs
```

Script in ra từng biến: ✅ có, ❌ thiếu, 🚫 bị cờ **Sensitive** bôi đen. Nó bắt
được cả các lỗi vô hình như dán thừa dấu nháy, thiếu `https://`, hostname có dấu
`/` ở cuối — những lỗi vẫn build thành công rồi mới nổ lúc chạy.

**b) Bảng trong Supabase.** Supabase → SQL Editor → chạy:

```sql
select table_name from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'website_chat_config','website_leads','inbox_channels','inbox_conversations',
    'inbox_messages','inbox_contacts','studio_appointments','studio_branches',
    'studio_drive','album_designs','rental_items','crew_shift_plan'
  )
order by 1;
```

Tên nào **không** hiện ra là migration tương ứng chưa chạy.

**c) Cờ tính năng.** Đăng nhập tài khoản admin → `/dashboard/settings` → mục
**Tính năng**. Ô nào còn tích là màn đó đang khoá với studio.

---

## 1. SQL — kiểm trong 2 phút

Thư mục `supabase/` có **41 file `.sql`**, trong đó **32 file** là phần dựng nên cơ sở
dữ liệu (31 migration + các file nền). Bạn **không** phải chạy từng file.

### Nếu project Supabase dựng từ trước và đang chạy

Chỉ chạy những migration mới hơn lần cuối bạn cập nhật. Hai file **mới nhất**,
gần như chắc chắn bạn chưa chạy (chúng đi kèm ba tính năng vừa làm xong):

| File | Cho tính năng | Không chạy thì |
|---|---|---|
| [`migrations/danh_gia_khach.sql`](../supabase/migrations/danh_gia_khach.sql) | Đánh giá khách (`/dashboard/studio/reviews`) | màn Đánh giá báo lỗi cột `reply`/`moderated_at`; đánh giá 1 sao vẫn lên thẳng trang chủ |
| [`migrations/nguon_khach.sql`](../supabase/migrations/nguon_khach.sql) | Nguồn khách & phễu chuyển đổi | biểu đồ theo nguồn trống rỗng; lead → đặt lịch → hợp đồng không nối được |

Ba file hay bị bỏ sót khác:

| File | Cho tính năng |
|---|---|
| [`migrations/website_chat_config.sql`](../supabase/migrations/website_chat_config.sql) | **Chatbox** — xem [`chatbox-huong-dan.md`](./chatbox-huong-dan.md) |
| [`migrations/website_leads.sql`](../supabase/migrations/website_leads.sql) | Lead từ chatbox → màn *Yêu cầu mới* |
| [`migrations/inbox_unified.sql`](../supabase/migrations/inbox_unified.sql) + [`inbox_tiktok.sql`](../supabase/migrations/inbox_tiktok.sql) | Hộp thư hợp nhất |

Mọi migration đều **chạy lại được** (idempotent) và đều có khối kiểm tra điều
kiện: thiếu bảng nền thì chúng nói rõ phải chạy file nào trước, thay vì ném ra
`42P01: relation does not exist`.

### Nếu dựng project Supabase MỚI

Chạy **một file duy nhất**: [`supabase/setup-all.sql`](../supabase/setup-all.sql).
Nó gộp đủ 32 file theo đúng thứ tự phụ thuộc. Đừng chạy `cat *.sql` — thứ tự
alphabet **không** phải thứ tự chạy.

> Thêm file SQL mới vào repo thì phải thêm tên vào danh sách `ORDER` trong
> [`build-setup-all.mjs`](../supabase/build-setup-all.mjs) rồi chạy
> `node supabase/build-setup-all.mjs` để dựng lại `setup-all.sql`.

---

## 2. Cờ tính năng — 5 màn đang tự khoá

Đây là chỗ hay bị hiểu nhầm là "lỗi". Năm tính năng **mặc định khoá** cho tới khi
admin bật, vì chúng còn cần khai báo bên ngoài (Meta App, Google verification,
bản desktop…). Studio thấy nhãn *"Sắp ra mắt"* và bấm không vào.

**Bật ở:** đăng nhập admin → `/dashboard/settings` → mục **Tính năng** → **bỏ
tích** ô tương ứng → Lưu.

| Cờ | Màn | Mặc định | Cần gì trước khi bật |
|---|---|---|---|
| `inbox` | Hộp thư hợp nhất | 🔒 khoá | chạy `inbox_unified.sql`; muốn có Facebook/Zalo thì thêm biến `META_*`/`ZALO_*` |
| `album` | Thiết kế Album | 🔒 khoá | chạy `album_designs.sql` |
| `slide` | Slide cưới | 🔒 khoá | — |
| `drive_sync` | Đồng bộ Google Drive | 🔒 khoá | `GOOGLE_STUDIO_DRIVE_REDIRECT_URI` + chạy `studio_drive_sync.sql` |
| `desktop` | MStudo Desktop | 🙈 **ẩn hẳn** | có bản phát hành trên GitHub Releases + `DESKTOP_LATEST_VERSION` |

Riêng `story` (Love Story) **mặc định mở**; nó chỉ khoá nếu bạn tự tích vào.

`rental` (Phòng váy) và `branches` (Chi nhánh) **đã phát hành** — hai hàm cờ giờ
luôn trả `false`, nên có lỡ để cờ cũ trong DB cũng không khoá lại được.

---

## 3. Biến môi trường — 59 biến, nhóm theo tính năng

Ký hiệu cột **Cần**:

| | Nghĩa |
|---|---|
| 🔴 | **bắt buộc** — thiếu là app không chạy |
| 🟡 | thiếu thì **mất đúng một tính năng**, phần còn lại vẫn chạy |
| ⚪ | tuỳ chọn / có giá trị mặc định hợp lý — cứ để trống |

> Bảng chi tiết từng biến (kể cả cách lấy lại giá trị đã mất) nằm ở
> [`bien-moi-truong.md`](./bien-moi-truong.md). Bảng dưới đây xếp theo **tính
> năng** để bạn quyết định "cái này tôi có cần không" trước, rồi mới đi lấy.

### 3.1. Bắt buộc — 4 biến

| Biến | Cần | Lấy ở đâu |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 🔴 | Supabase → Project Settings → **API** → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 🔴 | cùng trang, khoá `anon` `public` |
| `SUPABASE_SERVICE_ROLE_KEY` | 🔴 | cùng trang, khoá `service_role` — **bí mật** |
| `CRON_SECRET` | 🔴 | **bạn tự sinh** một chuỗi ngẫu nhiên dài |

`CRON_SECRET` **fail-closed**: bỏ trống thì cả 6 cron trong
[`vercel.json`](../vercel.json) trả 401 và **im lặng ngừng chạy** — nhắc lịch,
gửi Zalo tự động, dọn cache ảnh đều chết mà không có dòng lỗi nào ở đâu.

Sinh chuỗi ngẫu nhiên (PowerShell):

```powershell
-join ((48..57) + (97..122) | Get-Random -Count 48 | % {[char]$_})
```

### 3.2. Chatbox AI — 3 biến

| Biến | Cần | Lấy ở đâu |
|---|---|---|
| `GEMINI_API_KEY` | 🟡 | <https://aistudio.google.com> → **Get API key** → Create API key |
| `CHAT_PROVIDERS` | ⚪ | JSON tự viết — khai nhiều hãng để dự phòng |
| `GEMINI_MODEL` | ⚪ | để trống → `gemini-flash-latest` |

**Thiếu cả `GEMINI_API_KEY` lẫn `CHAT_PROVIDERS`** → chatbox trả 503, khách thấy
*"Xin lỗi, mình chưa trả lời được lúc này."*

👉 **Hướng dẫn đầy đủ: [`chatbox-huong-dan.md`](./chatbox-huong-dan.md)**

### 3.3. Google Drive, Picker & OAuth — 10 biến

| Biến | Cần | Lấy ở đâu |
|---|---|---|
| `GOOGLE_API_KEY` | 🟡 | Google Cloud Console → **APIs & Services → Credentials → API key**; giới hạn theo Drive API |
| `GOOGLE_API_REFERER` | ⚪ | để trống → `https://mstudo.com/` |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | 🟡 | cùng trang → **OAuth 2.0 Client ID** (loại *Web application*) |
| `NEXT_PUBLIC_GOOGLE_API_KEY` | 🟡 | API key cho trình duyệt, bật **Google Picker API** |
| `NEXT_PUBLIC_GOOGLE_APP_ID` | 🟡 | **số** project Google Cloud (Project number, không phải Project ID) |
| `GOOGLE_CLIENT_SECRET` | 🟡 | secret của chính OAuth client ở trên — **bí mật** |
| `GOOGLE_STORY_REDIRECT_URI` | 🟡 | **bạn tự gõ**: `https://<tên-miền>/api/story/drive/callback` |
| `GOOGLE_ADMIN_DRIVE_REDIRECT_URI` | 🟡 | `https://<tên-miền>/api/admin/drive/callback` |
| `GOOGLE_FILTER_DRIVE_REDIRECT_URI` | 🟡 | `https://<tên-miền>/api/filter/drive/callback` |
| `GOOGLE_STUDIO_DRIVE_REDIRECT_URI` | 🟡 | `https://<tên-miền>/api/studio/drive/callback` |

**Bốn địa chỉ callback không phải đi tìm ở đâu** — bạn tự gõ. Nhưng mỗi địa chỉ
phải được dán **y hệt** vào OAuth client (Google Cloud Console → Credentials →
OAuth client → *Authorized redirect URIs*). Lệch một dấu `/` là Google từ chối.

Thiếu từng cái thì mất: tải ảnh của khách vào Drive cặp đôi (Story) · lưu nội
dung người dùng trên Drive admin · nút *Kết nối Drive* trong công cụ lọc ảnh ·
đồng bộ ảnh hợp đồng của app desktop.

### 3.4. Tên miền — 6 biến

| Biến | Cần | Giá trị |
|---|---|---|
| `NEXT_PUBLIC_MAIN_HOST` | 🟡 | `mstudo.com` |
| `NEXT_PUBLIC_IMG_HOST` | 🟡 | `img.mstudo.com` |
| `NEXT_PUBLIC_ADMIN_HOST` | 🟡 | `admin.mstudo.com` |
| `NEXT_PUBLIC_THIEP_HOST` | 🟡 | `thiep.mstudo.com` |
| `NEXT_PUBLIC_STUDIO_HOST` | ⚪ | `mstudo.com` — để trống cũng chạy |
| `NEXT_PUBLIC_APP_HOST` | ⚪ | đã ngừng dùng |

⚠️ **Phải là hostname trần**: không `https://`, không `/` ở cuối, không cổng, và
**không** `www.`. Đặt `NEXT_PUBLIC_MAIN_HOST=www.mstudo.com` sẽ khiến trang chủ
`mstudo.com` bị coi là tên miền riêng của một studio khách → **trang trắng**, mà
không có dòng lỗi nào. Script ở mục 0 bắt đúng lỗi này.

### 3.5. Hộp thư hợp nhất — 8 biến

Đây là 8 biến **mới nhất** của dự án.

| Biến | Cần | Lấy ở đâu |
|---|---|---|
| `INBOX_INGEST_SECRET` | 🟡 | **bạn tự sinh** — chuỗi ngẫu nhiên; dùng cho cầu nối TikTok & worker Zalo cá nhân |
| `META_VERIFY_TOKEN` | 🟡 | **bạn tự đặt** — dán lại y hệt bên Meta khi khai webhook |
| `META_APP_ID` | 🟡 | <https://developers.facebook.com> → App → **Settings → Basic → App ID** |
| `META_APP_SECRET` | 🟡 | cùng trang, **App Secret** (bấm *Show*) — bí mật |
| `META_REDIRECT_URI` | 🟡 | **bạn tự gõ**: `https://<tên-miền>/api/inbox/meta/callback`, rồi dán vào *Facebook Login → Valid OAuth Redirect URIs* |
| `META_LOGIN_CONFIG_ID` | ⚪ | id cấu hình *Facebook Login for Business* (nếu dùng) |
| `META_GRAPH_BASE` | ⚪ | để trống → `https://graph.facebook.com/v21.0` |
| `ZALO_OA_WEBHOOK_SECRET` | ⚪ | Zalo App → OA Secret Key; để trống → rơi về `ZALO_OA_APP_SECRET` |

Bỏ trống `META_APP_ID`/`META_REDIRECT_URI` → nút *Kết nối Facebook* **tự ẩn**,
màn Kênh chỉ còn đường dán Page Access Token thủ công (vẫn chạy).

👉 **Cách khai webhook và đi App Review: [`hop-thu-hop-nhat.md`](./hop-thu-hop-nhat.md)**

> Chỉ muốn chatbox website hai chiều (không nối Facebook/Zalo)? **Không cần một
> biến nào trong bảng này** — chỉ cần chạy `inbox_unified.sql` và bật cờ `inbox`.

### 3.6. Zalo OA — 4 biến

| Biến | Cần | Lấy ở đâu |
|---|---|---|
| `ZALO_OA_APP_ID` | 🟡 | <https://developers.zalo.me> → app của bạn → **App ID** |
| `ZALO_OA_APP_SECRET` | 🟡 | cùng trang — bí mật |
| `ZALO_OA_REDIRECT_URI` | 🟡 | `https://<tên-miền>/api/studio/zalo/oa/callback` |
| `ZALO_SESSION_SECRET` | ⚪ | bạn tự sinh; để trống → dùng `SUPABASE_SERVICE_ROLE_KEY` |

Thiếu → studio không nối được Zalo OA (kênh Zalo **cá nhân** vẫn chạy, nhưng
xem cảnh báo về điều khoản Zalo trong [`hop-thu-hop-nhat.md`](./hop-thu-hop-nhat.md)).

### 3.7. Thông báo đẩy (web push) — 3 biến

| Biến | Cần | Lấy ở đâu |
|---|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | 🟡 | sinh **theo cặp** |
| `VAPID_PRIVATE_KEY` | 🟡 | sinh theo cặp — bí mật |
| `VAPID_SUBJECT` | ⚪ | để trống → `mailto:hello@mstudo.com` |

```bash
npx web-push generate-vapid-keys
```

Hai khoá phải là **một cặp toán học** — ghép khoá công khai cũ với khoá riêng mới
là không chạy. Để trống **cả cặp** cũng được: app chỉ mất thông báo đẩy.

### 3.8. Email — 2 biến

| Biến | Cần | Lấy ở đâu |
|---|---|---|
| `RESEND_API_KEY` | 🟡 | <https://resend.com> → **API Keys → Create** |
| `EMAIL_FROM` | 🟡 | địa chỉ gửi, phải thuộc tên miền đã xác minh ở Resend |

Thiếu → app **không gửi được email nào** (báo giá, nhắc lịch qua email…).

### 3.9. Captcha Turnstile — 2 biến

| Biến | Cần | Lấy ở đâu |
|---|---|---|
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | ⚪ | Cloudflare Dashboard → **Turnstile → Add site** |
| `TURNSTILE_SECRET_KEY` | ⚪ | cùng trang, Secret Key |

⚠️ **Phải khai đủ cả cặp mới có tác dụng.** Khai một nửa thì ô captcha hiện ra
nhưng máy chủ không xác minh được gì — tệ hơn là không khai, vì bạn tưởng mình
đang được bảo vệ. Để trống cả hai thì form dùng khoá thử của Cloudflare (hiện ra
nhưng không chặn ai).

### 3.10. Chống spam bền (Upstash Redis) — 2 biến

| Biến | Cần | Lấy ở đâu |
|---|---|---|
| `UPSTASH_REDIS_REST_URL` | ⚪ | <https://upstash.com> → tạo Redis database → tab **REST API** |
| `UPSTASH_REDIS_REST_TOKEN` | ⚪ | cùng trang |

Để trống thì giới hạn tần suất rơi về **bộ nhớ trong tiến trình** — vẫn chạy,
nhưng mỗi máy chủ serverless đếm riêng nên hạn mức lỏng hơn. Đáng khai khi đã có
khách thật gõ vào các cổng công khai (chat, để lại SĐT, gửi cảm nhận).

### 3.11. Tự đăng ký tên miền cho studio — 3 biến

| Biến | Cần | Lấy ở đâu |
|---|---|---|
| `VERCEL_TOKEN` | ⚪ | <https://vercel.com/account/tokens> → **Create Token** |
| `VERCEL_PROJECT_ID` | ⚪ | Vercel → project → Settings → General → **Project ID** |
| `VERCEL_TEAM_ID` | ⚪ | Settings của team; **để trống** nếu là tài khoản cá nhân |

Thiếu → studio gắn tên miền riêng phải chờ bạn thêm tay trên Vercel.

### 3.12. App desktop — 4 biến

| Biến | Cần | Ghi chú |
|---|---|---|
| `DESKTOP_LATEST_VERSION` | ⚪ | để trống → app tưởng bản mới nhất là `0.1.0` |
| `DESKTOP_UPDATE_NOTE` | ⚪ | mô tả ngắn bản mới |
| `NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL` | ⚪ | để trống → nút tải rơi về trang GitHub Releases |
| `NEXT_PUBLIC_DESKTOP_RELEASES_REPO` | ⚪ | để trống → `vieetjk01/Studio`; **phải là repo công khai** |

Chỉ cần khi bật cờ `desktop`.

### 3.13. Cache ảnh & băng thông — 6 biến

| Biến | Cần | Ghi chú |
|---|---|---|
| `DRIVE_IMG_CACHE_BUCKET` | ⚪ | **nên để trống** |
| `DRIVE_IMG_CACHE_MAX_AGE_DAYS` | ⚪ | mặc định 21 ngày |
| `DRIVE_IMG_CACHE_MAX_BYTES` | ⚪ | mặc định 500 MB |
| `DRIVE_IMG_CACHE_ORIGINALS` | ⚪ | mặc định TẮT — đừng bật |
| `DRIVE_IMG_CACHE_MAX_WIDTH` | ⚪ | mặc định 1024 |
| `IMG_CDN_REDIRECT` | ⚪ | **để trống** = đã bật sẵn (tốt) |

⚠️ Bucket cache **ăn cả hai hạn mức Supabase** (storage + egress) và là nguyên
nhân vượt hạn mức của bản cũ. Để trống là lựa chọn đúng trong hầu hết trường hợp
— chi tiết ở [`supabase-usage.md`](./supabase-usage.md).

`IMG_CDN_REDIRECT` để trống nghĩa là **đang bật**; đặt `=0` mới là tắt. Đừng chép
giá trị `0` từ bản cũ sang.

### 3.14. Còn lại — 2 biến

| Biến | Cần | Ghi chú |
|---|---|---|
| `OAUTH_STATE_SECRET` | ⚪ | để trống → dùng `SUPABASE_SERVICE_ROLE_KEY` |
| `GOOGLE_CALENDAR_REDIRECT_URI` | 🟡 | `https://<tên-miền>/api/gcal/callback` — thiếu thì mất đồng bộ Google Lịch |

### 3.15. Cách thêm biến (làm một lần)

1. Vercel → project → **Settings → Environment Variables → Add New**.
2. **Key** = tên biến, **Value** = giá trị (**không** dấu nháy, **không** khoảng
   trắng đầu/cuối).
3. **Environments:** tick cả **Production + Preview + Development**.
4. **Save**, rồi **Deployments → ⋯ → Redeploy**. Không deploy lại thì biến chưa
   áp dụng.

**Mẹo:** ô **Value** nhận nguyên một khối nhiều dòng dạng `KEY=VALUE` và tự tách
thành từng biến — dán cả gói một lượt thay vì gõ 59 lần.

🚫 **Đừng bật cờ Sensitive cho biến `NEXT_PUBLIC_*`.** Vercel không cho build đọc
lại chúng, nên bundle nhận đúng chuỗi `[SENSITIVE]` làm giá trị — build vẫn xanh,
lỗi rải ra khắp app và không chỗ nào nhắc tới nguyên nhân. Biến chỉ dùng ở máy
chủ thì bật thoải mái.

---

## 4. Tính năng chưa viết

Đây là **code chưa có**, không phải cấu hình thiếu. Chi tiết từng mục (hiện có
gì, thiếu gì, chạm vào đâu) nằm ở [`goi-y-hoan-thien-app.md`](./goi-y-hoan-thien-app.md).

| # | Tính năng | Công sức | Vì sao đáng làm |
|---|---|---|---|
| 4 | Việc tự động theo trạng thái | Trung bình | mọi nhắc nhở hiện vẫn do người nhớ |
| 5 | Chấm công & lịch rảnh của thợ | Trung bình | có phân công nhưng không có "ai thực sự đi làm" → `payroll` vẫn nhập tay |
| 6 | Nhà cung cấp & đơn in ấn | Trung bình | album in / makeup / xe hoa đang nằm ngoài hệ thống |
| 7 | Hoá đơn & xuất kế toán | Trung bình | không có phiếu thu đưa khách, không có bản xuất theo kỳ |
| 8 | Thời tiết & đường đi buổi chụp ngoại | **Nhỏ** | rẻ nhất mà khách thấy ngay; Open-Meteo không cần khoá API |
| 9 | Lọc ảnh bằng AI | Lớn | việc tốn giờ nhất của hậu kỳ; phải chạy trên máy, không phải server |
| 10 | PWA cho phần chọn ảnh | Trung bình | khách chọn ảnh gần như 100% trên điện thoại |

Ba mục đầu (đánh giá khách · nguồn khách & phễu · nhắc kỷ niệm) **đã làm xong**.

### 4.1. Hai việc chờ bạn quyết (không phải việc code)

Cả hai là **chọn màu thương hiệu**, nên không ai quyết thay được. Xem bằng mắt ở
`/uipreview/bang-mau` trên bản dev:

1. **Ngoài khu studio, màu cảnh báo trùng y hệt màu nhấn** (`--am` và `--ac` cùng
   là vàng). Trên landing, trang đăng nhập và dashboard gói free, một viên *cảnh
   báo* và một viên *thương hiệu* nhìn giống hệt nhau. Cần bạn chọn một màu cảnh
   báo riêng cho bảng màu vàng.
2. **Thanh tiến độ điều hướng luôn màu vàng**, kể cả trong khu quản lý (nơi màu
   nhấn là xanh). Sửa được, nhưng vẫn là chọn màu nên cần bạn gật đầu.

### 4.2. Giới hạn đã biết của chatbox

Không phải lỗi cấu hình — là giới hạn của bản hiện tại:

- **Chatbox là một-studio**: `/api/vieetjk/chat` luôn tra chủ studio qua site
  `vieetjk`, nên studio khác đặt `template = 'vieetjk'` sẽ thấy khung chat nhưng
  bot trả lời bằng dữ liệu của vieetjk.
- **Site dựng bằng trình kéo-thả không có khung chat** — chỉ có nút liên hệ.
- **Bot không đọc bảng giá trong DB**; nó đọc `src/lib/vieetjk/content.ts`.

Đầy đủ ở [`chatbox-huong-dan.md`](./chatbox-huong-dan.md) mục 10.

---

## 5. Bảng kiểm rút gọn

```
🗄️  SQL
[ ] Chạy danh_gia_khach.sql          (màn Đánh giá khách)
[ ] Chạy nguon_khach.sql             (phễu chuyển đổi)
[ ] Chạy website_chat_config.sql     (chatbox)
[ ] Chạy website_leads.sql           (lead từ chatbox)
[ ] (nếu bật hộp thư) inbox_unified.sql + inbox_tiktok.sql

🎚️  Cờ tính năng  —  /dashboard/settings → Tính năng
[ ] Quyết định bật/để khoá: inbox · album · slide · drive_sync · desktop

🔑  Biến môi trường  —  chạy `node scripts/kiem-tra-bien.mjs` trước
[ ] 4 biến bắt buộc đủ và đúng (3 Supabase + CRON_SECRET)
[ ] GEMINI_API_KEY  → chatbox mới trả lời được
[ ] Không biến NEXT_PUBLIC_* nào bật cờ Sensitive
[ ] Không hostname nào có https:// hay dấu / ở cuối
[ ] Quyết định từng nhóm 🟡: Google Drive · Zalo OA · Meta · push · email · captcha
[ ] Đã Redeploy sau mọi thay đổi biến

🧩  Tính năng
[ ] Chọn mục tiếp theo trong goi-y-hoan-thien-app.md (gợi ý: #8 thời tiết — nhỏ nhất)
[ ] Chốt hai quyết định màu ở mục 4.1
```
