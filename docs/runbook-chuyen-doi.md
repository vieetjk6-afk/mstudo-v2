# Runbook: chuyển mstudo từ bản cũ sang bản 2.0

Hướng dẫn bấm-từng-nút để dời `mstudo.com` từ **Vercel cũ + Supabase cũ** (repo
`vieetjk01/Studio`) sang **Vercel mới + Supabase mới + GitHub mới** (repo này,
nhánh `main`).

**Bối cảnh đã chốt**

- Code bản cũ (12 commit ngày 07/08) **đã gộp xong** vào `main`.
- Supabase mới chỉ có **dữ liệu xem thử** → chép đè toàn bộ từ bản cũ sang.
- Tên miền giữ nguyên `mstudo.com`, nên mọi link đã gửi khách vẫn chạy.

**Thời gian**: Phần A ~90 phút, làm rải rác lúc nào cũng được, không ảnh hưởng
bản đang chạy. Phần B ~60–120 phút, phải làm liền mạch và có gián đoạn dịch vụ.

**Quy ước**: `CŨ` = project/tài khoản đang chạy production. `MỚI` = môi trường
2.0. Mọi câu SQL chạy ở **Supabase → SQL Editor**.

---

## Bảng tra nhanh: cần lấy sẵn những gì

Chuẩn bị một file nháp (đừng commit) và điền đủ trước khi bắt đầu:

| Cần | Lấy ở đâu | Dùng cho |
|---|---|---|
| Mã project CŨ | Supabase CŨ → Settings → API → Project URL, phần trước `.supabase.co` | Bước A5, B7 |
| Mã project MỚI | Supabase MỚI → Settings → API → Project URL | Bước B7 |
| Host pooler CŨ | Supabase CŨ → Settings → Database → Connection string → tab **Session pooler** | Bước B4 |
| User pooler CŨ | cùng chỗ, dạng `postgres.<mã-project-cũ>` | Bước B4 |
| Mật khẩu DB CŨ | lưu lúc tạo project; quên thì Settings → Database → Reset password | Bước B4 |
| 3 khoá Supabase MỚI | Settings → API: Project URL · anon public · service_role | Bước A3 |
| Toàn bộ biến môi trường CŨ | Vercel CŨ → Settings → Environment Variables | Bước A3 |

> ⚠️ Reset mật khẩu database ở project CŨ **không** làm production sập (app dùng
> khoá API, không dùng mật khẩu DB). Cứ reset nếu quên.

---

# PHẦN A — Chuẩn bị (không gián đoạn gì)

## A1. Kiểm tra Supabase MỚI đang có gì

Dù đã biết chỉ là dữ liệu thử, vẫn chạy để chắc chắn — script chỉ đếm, không sửa.

1. Supabase **MỚI** → SQL Editor → New query.
2. Dán toàn bộ [`supabase/kiem-tra-truoc-khi-chep.sql`](../supabase/kiem-tra-truoc-khi-chep.sql) → Run.
3. Đọc tab **Messages** (không phải Results):
   - `TRỐNG — chép được` hoặc `CÓ DỮ LIỆU: N dòng` kèm danh sách bảng.
4. Nhìn bảng kết quả bên dưới: nếu cột `chi_tiet` của dòng "hợp đồng" toàn tên
   nháp kiểu "test", "abc" thì yên tâm. Nếu thấy tên khách thật → **dừng lại**,
   xem mục 2.4 của [`docs/gop-ban-cu-va-chuyen-doi.md`](./gop-ban-cu-va-chuyen-doi.md).

## A2. Cập nhật schema Supabase MỚI

**Phải làm kể cả khi đã chạy trước đây.** Tuần qua bản cũ thêm 2 cột; nếu Supabase
MỚI thiếu 2 cột đó thì lúc chép dữ liệu, script sẽ **bỏ qua 2 cột đó trong im
lặng** (nó chỉ chép cột có ở cả hai bên).

1. Supabase **MỚI** → SQL Editor → New query.
2. Mở [`supabase/setup-all.sql`](../supabase/setup-all.sql) trong repo, copy
   **toàn bộ** (~3.700 dòng), dán vào, Run.
3. Chờ "Success". Mọi câu lệnh đều idempotent — chạy lại nhiều lần vô hại.
4. Kiểm tra 2 cột mới đã có:

```sql
select column_name, table_name
from information_schema.columns
where (table_name = 'studio_notifications' and column_name = 'album_id')
   or (table_name = 'studio_drive'         and column_name = 'filter_refresh_token');
```

Phải trả về **đúng 2 dòng**. Không đủ → chưa chạy hết file, làm lại bước 2.

5. Kiểm tra 3 bucket đã có: Storage → phải thấy `payment-proofs`,
   `wedding-photos`, `logos`. (SQL tự tạo. **Không** tạo `drive-cache`.)

## A3. Biến môi trường cho Vercel MỚI

### Kéo biến từ Vercel CŨ về

```bash
npm i -g vercel
vercel login

mkdir -p ~/vc-old && cd ~/vc-old
vercel link                                   # chọn team + project CŨ
vercel env pull .env.old --environment=production
```

`.env.old` là **file bí mật** — đừng commit, xong việc thì `rm ~/vc-old/.env.old`.

### Nạp vào Vercel MỚI

Cách nhanh: Vercel MỚI → Settings → Environment Variables → **Add New** → dán
**nguyên khối nhiều dòng** nội dung `.env.old` (ô này nhận cả khối `KEY=VALUE`).

Hoặc bằng CLI:

```bash
cd ~/mstudo-v2
vercel link                                   # chọn team + project MỚI
set -a; while IFS= read -r line; do
  case "$line" in ''|\#*) continue;; esac
  key=${line%%=*}; val=${line#*=}
  val=$(printf '%s' "$val" | sed -e 's/^"//' -e 's/"$//')
  printf '%s' "$val" | vercel env add "$key" production --force
done < ~/vc-old/.env.old; set +a
```

### Rồi SỬA những biến sau — copy nguyên là hỏng

| Biến | Đặt thành | Không sửa thì sao |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL của Supabase **MỚI** | App vẫn đọc DB cũ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key **MỚI** | như trên |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role **MỚI** | như trên |
| `VERCEL_PROJECT_ID` | Project ID của Vercel **MỚI** (Settings → General) | Studio thêm domain riêng sẽ đăng ký nhầm vào project cũ |
| `VERCEL_TEAM_ID` | team chứa project mới (trống nếu tài khoản cá nhân) | như trên |
| `VERCEL_TOKEN` | token mới (vercel.com/account/tokens) | Token cũ vẫn chạy nhưng nên xoay vòng |
| `GOOGLE_FILTER_DRIVE_REDIRECT_URI` | `https://mstudo.com/api/filter/drive/callback` | **Mới tuần này** — không có thì nút "Kết nối Google Drive" ở công cụ lọc ảnh bị ẩn |
| `DRIVE_IMG_CACHE_BUCKET` | **để trống** | Bucket cache lại phình 13 GB và vượt hạn mức Free lần nữa |
| `NEXT_PUBLIC_*_HOST` | **để trống** trong lúc chạy thử; điền đúng tên miền ở bước B8 | `NEXT_PUBLIC_*` nhúng lúc build — điền sớm thì bản thử trên `*.vercel.app` bị đá lung tung |

### Biến dễ quên nhất: `CRON_SECRET`

5 route `/api/cron/*` **fail-closed** — thiếu biến này là trả 401 và **mọi nhắc
lịch / dọn dẹp im lặng ngừng chạy**, không có thông báo lỗi nào. Biến này có ở
project cũ nhưng **không nằm trong `.env.example`**. Kiểm tra:

```bash
vercel env ls production | grep CRON_SECRET
```

Không thấy → lấy giá trị từ `.env.old`, hoặc đặt chuỗi ngẫu nhiên mới
(`openssl rand -hex 32`). Vercel tự gắn `Authorization: Bearer $CRON_SECRET`.

5 cron trong [`vercel.json`](../vercel.json): nhắc lịch 07:00, Zalo 11:00, dọn
ảnh chuyển khoản 08:30, dọn cache Drive 10:00, dọn ảnh thiệp Chủ nhật 09:00
(giờ VN; file ghi theo UTC).

## A4. Khai callback ở bên thứ ba

Làm **trước** khi cắt tên miền, **giữ nguyên URI cũ** — hai bên cùng tồn tại
không xung đột, cắt xong mới xoá cái cũ.

### Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Web client

**Authorized redirect URIs** — thêm đủ 4 (kèm bản `*.vercel.app` nếu muốn thử
OAuth trước khi cắt):

```
https://mstudo.com/api/story/drive/callback
https://mstudo.com/api/admin/drive/callback
https://mstudo.com/api/studio/drive/callback
https://mstudo.com/api/filter/drive/callback     ← MỚI tuần này
```

**Authorized JavaScript origins** — thêm `https://mstudo.com` và
`https://<project-mới>.vercel.app` (Google Picker của công cụ nén ảnh cần).

### Supabase MỚI → Authentication → URL Configuration

- **Site URL**: `https://mstudo.com`
- **Redirect URLs**: thêm `https://mstudo.com/auth/callback` và
  `https://<project-mới>.vercel.app/auth/callback`

### Supabase MỚI → Authentication → Providers → Google

Chỉ khi có studio đăng nhập bằng Google. Bật provider, dán **đúng Client ID /
Secret đang dùng ở project CŨ**. Dùng client khác là Supabase coi người dùng đó
là người lạ và tạo tài khoản mới, không nối vào hồ sơ cũ.

### Zalo Developers → app → Redirect URI

Chỉ khi dùng kênh OA: thêm `https://mstudo.com/api/studio/zalo/oa/callback`.

### Cloudflare Turnstile → widget → Domains

Thêm `mstudo.com` và `<project-mới>.vercel.app`.

## A5. Chạy thử việc chép dữ liệu

Chạy thử để biết mất bao lâu và phải bấm Run mấy lần — đêm cắt sẽ không còn bất
ngờ. Dữ liệu lần thử này sẽ bị đè lại ở phần B nên bỏ đi được.

Làm đúng như bước **B4–B5** bên dưới, rồi ghi lại: *"PHẦN 3 bấm Run N lần, hết
M phút"*.

## A6. Cấu hình project Vercel MỚI

Settings →

- **General → Node.js Version**: 20.x
- **Functions → Function Region**: **Singapore (sin1)**. Region khác thì mọi
  truy vấn Supabase chậm thêm ~200 ms/lần.
- **Deployment Protection**: **tắt** cho Production (bật thì khách vào bị chặn).
- **Crons**: sau lần deploy production đầu tiên phải thấy đủ **5 job**. Gói
  Hobby chỉ cho cron chạy 1 lần/ngày — bản cũ nếu đang ở Pro thì project mới
  cũng nên ở Pro.

## A7. Deploy và kiểm tra trên `*.vercel.app`

`main` đã có đủ code. Đợi Vercel deploy xong rồi đi hết danh sách này —
**tất cả phải xanh** mới sang phần B:

- [ ] Đăng nhập bằng email + mật khẩu (tài khoản thử ở Supabase mới).
- [ ] Đăng nhập bằng Google (nếu có bật).
- [ ] `/dashboard/studio` lên đủ sidebar, không màn nào lỗi.
- [ ] Tạo thử 1 hợp đồng qua wizard 5 bước → mở màn chi tiết → đủ 6 tab.
- [ ] Mở `/dashboard/tools` → 3 thẻ công cụ → vào được cả lọc ảnh lẫn nén ảnh.
- [ ] Công cụ **Nén ảnh** mở được Google Picker (kiểm tra JS origin đã khai đúng).
- [ ] Lịch làm việc: đủ 4 chế độ Ngày · Tuần · Tháng · Nhân sự.
- [ ] Chatbox trên trang chủ trả lời (`GEMINI_API_KEY` / `CHAT_PROVIDERS`).
- [ ] Cron trả JSON chứ không phải 401:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
     https://<project-mới>.vercel.app/api/cron/reminders
```

---

# PHẦN B — Đêm cắt (có gián đoạn)

Chọn giờ vắng nhất (khuya). Từ B2 tới B9, **dữ liệu ai nhập vào cũng sẽ mất**.

## B0. Hôm trước: hạ TTL

Vào nhà cung cấp DNS, hạ **TTL xuống 60 giây** cho các bản ghi của `mstudo.com`.
Có bước này thì lỡ phải quay đầu cũng chỉ mất một phút.

Lấy sẵn danh sách domain riêng của studio khách (app tự đăng ký, không nằm trong
Vercel settings mà nằm trong DB) — chạy ở Supabase **CŨ**:

```sql
select custom_domain, custom_domain_verified
from public.sites
where custom_domain is not null
order by custom_domain;
```

## B1. Báo dừng nhập liệu

Nhắn cho studio: dừng nhập liệu ở **cả hai bản** — bản cũ và bản 2.0 đang chạy.

## B2. Pause Vercel CŨ

Vercel CŨ → Settings → **Pause Project**. Dừng cả traffic lẫn cron, không ai ghi
thêm được nữa, mà dữ liệu vẫn nguyên để còn quay đầu.

> Từ giây phút này `mstudo.com` **ngừng phục vụ** cho tới khi xong B9.

## B3. Xoá dữ liệu thử ở Supabase MỚI

Script chép tự làm việc này, nhưng làm trước cho chắc và để thấy rõ điểm bắt đầu.
Bỏ qua nếu muốn — B4 sẽ dọn.

## B4. Kết nối Supabase MỚI sang CŨ (PHẦN 1 của script chép)

1. Mở [`supabase/clone-from-old-project.sql`](../supabase/clone-from-old-project.sql).
2. Copy **chỉ khối PHẦN 1** (từ `create extension if not exists postgres_fdw;`
   tới hết `import foreign schema auth limit to …`).
3. Sửa **3 chỗ có dấu ⬅️**:
   - `host` → host pooler của project CŨ, dạng `aws-0-<vùng>.pooler.supabase.com`.
     **Đừng dùng `db.xxx.supabase.co`** — host đó chỉ có IPv6, FDW không tới được.
   - `user` → `postgres.<mã-project-cũ>`
   - `password` → mật khẩu database CŨ
4. Dán vào SQL Editor của project **MỚI** → Run.

Lỗi hay gặp:

| Báo lỗi | Nghĩa là | Sửa |
|---|---|---|
| `could not connect to server` | Sai host, hoặc dùng nhầm `db.xxx.supabase.co` | Lấy lại host ở tab **Session pooler** |
| `password authentication failed` | Sai user hoặc mật khẩu | User phải có dạng `postgres.<mã>`; reset mật khẩu nếu quên |
| `permission denied for schema auth` | Tài khoản không đủ quyền | Dùng đúng user `postgres.<mã>`, không phải user khác |

## B5. Cài bộ máy chép (PHẦN 2)

Copy **khối PHẦN 2** (từ `create table if not exists public.mig_progress`
tới hết định nghĩa `mig_step`) → Run một lần. Không phải sửa gì.

## B6. Chép dữ liệu (PHẦN 3) — bấm Run nhiều lần

```sql
select * from public.mig_step();
```

Mỗi lần Run làm việc ~40 giây rồi tự dừng và **ghi nhớ chỗ đang dở** (tới từng lô
2.000 dòng). Kết quả hiện dạng bảng: tên bảng · số dòng đã chép · trạng thái.

**Bấm Run lại liên tục cho tới khi thấy `✅ XONG TẤT CẢ`.** Bảng vài trăm nghìn
dòng có thể cần chục lần bấm — bình thường.

Theo dõi tiến độ bất cứ lúc nào:

```sql
select bang, so_dong, xong, so_lan_loi, ghi_chu
from public.mig_progress
order by xong, thu_tu;
```

> Nếu bỏ dở giữa chừng, **trigger nghiệp vụ vẫn đang tắt**. Bật lại bằng
> `select public.mig_bat_lai_trigger();` trước khi cho ai dùng app.

## B7. Chép file Storage + sửa URL

### B7a. Chép 3 bucket

Supabase CŨ → Storage → tải xuống, rồi Supabase MỚI → Storage → tải lên, **giữ
nguyên tên file và cấu trúc thư mục**:

| Bucket | Nội dung | Cỡ |
|---|---|---|
| `logos` | Logo studio, ảnh trong trình tạo website | ~0,4 MB |
| `wedding-photos` | Ảnh/nhạc thiệp cưới | ~10 MB |
| `payment-proofs` | Ảnh chuyển khoản khách gửi | ~26 MB |

**KHÔNG chép `drive-cache`** — 13 GB cache ảnh, chính là thứ làm vượt hạn mức
Free. Nó tự sinh lại khi cần.

### B7b. Sửa URL ảnh trong database — bước dễ bỏ sót nhất

App lưu ảnh bằng `getPublicUrl()`, nên trong database là URL **đầy đủ** trỏ vào
project CŨ. Chép sang project mới thì các URL đó vẫn trỏ về chỗ cũ. Ảnh **vẫn
hiện bình thường** chừng nào project cũ còn sống — nên rất dễ tưởng đã xong; tới
lúc xoá project cũ là logo studio, ảnh chuyển khoản, ảnh thiệp cưới chết đồng loạt.

1. Mở [`supabase/rewrite-storage-urls.sql`](../supabase/rewrite-storage-urls.sql).
2. Sửa `ma_cu` / `ma_moi` ở **cả hai khối `do $$`** (khối sửa và khối kiểm tra).
3. Dán vào SQL Editor project **MỚI** → Run.
4. Xem tab **Messages** — phải có dòng:

```
── Sạch: không còn URL nào trỏ về project cũ.
```

Còn dòng `CÒN SÓT` → cột đó kiểu dữ liệu lạ, sửa tay rồi chạy lại.

## B8. Đối chiếu trước khi cắt

Chạy câu này ở **cả hai** project, số phải khớp:

```sql
select 'contracts' as bang, count(*) from studio_contracts
union all select 'albums',      count(*) from albums
union all select 'photos',      count(*) from photos
union all select 'selections',  count(*) from selections
union all select 'payments',    count(*) from contract_payments
union all select 'profiles',    count(*) from profiles
union all select 'quotes',      count(*) from studio_quotes
order by bang;
```

Lệch → xem `mig_progress` bảng nào chưa `xong`, bấm Run PHẦN 3 tiếp.

Kiểm tra tài khoản đăng nhập đã sang:

```sql
select count(*) as so_tai_khoan from auth.users;
```

## B9. Cắt tên miền

1. **Sửa các biến `NEXT_PUBLIC_*_HOST`** ở Vercel MỚI cho đúng tên miền thật:
   ```
   NEXT_PUBLIC_MAIN_HOST=mstudo.com
   NEXT_PUBLIC_IMG_HOST=img.mstudo.com
   NEXT_PUBLIC_ADMIN_HOST=admin.mstudo.com
   NEXT_PUBLIC_THIEP_HOST=thiep.mstudo.com
   ```
   (`NEXT_PUBLIC_APP_HOST` đã nghỉ hưu — album do MAIN_HOST phục vụ. Nếu bản cũ
   không tách miền phụ thì để trống hết, trừ `MAIN_HOST`.)
2. **Redeploy** — biến `NEXT_PUBLIC_*` nhúng lúc build, không đổi lúc chạy.
   Không redeploy thì đăng nhập xong bị đá về `/login`.
3. Vercel CŨ → Settings → Domains → **Remove** từng domain.
   *Hai project cùng một tài khoản/team thì bỏ qua bước này: thêm thẳng bên
   project mới, Vercel hỏi "Move domain?" → xác nhận.*
4. Vercel MỚI → Settings → Domains → **Add** lần lượt:

   | Domain | Vai trò |
   |---|---|
   | `mstudo.com` | Trang chính + khu quản lý studio |
   | `www.mstudo.com` | Chuyển hướng về apex (middleware lo) |
   | `*.mstudo.com` | Website riêng của từng studio |
   | `img.` `admin.` `thiep.` | Các miền phụ nếu đang tách |
   | domain riêng của studio | Kết quả câu SQL ở bước B0 |

5. **DNS**: làm **đúng theo giá trị Vercel hiển thị ngay trong tab Domains** —
   bản ghi A/CNAME của Vercel có đổi theo thời gian, đừng chép số từ tài liệu cũ.
   DNS vẫn trỏ như khi chạy project cũ thì thường **không phải sửa gì**.
6. `*.mstudo.com` cần thêm bản ghi **TXT `_vercel`** để xác minh (trừ khi tên
   miền dùng nameserver của Vercel). Vercel hiện đúng giá trị cần thêm.
7. Chờ mỗi domain chuyển sang **Valid Configuration** + cấp xong HTTPS (< 1 phút).

## B10. Kiểm tra ngay sau khi cắt

- [ ] `https://mstudo.com` lên trang chủ.
- [ ] `https://www.mstudo.com` tự về apex.
- [ ] Đăng nhập bằng tài khoản **cũ** (email + mật khẩu cũ) — phải vào được.
- [ ] **F5 vẫn còn đăng nhập.** Bị đá về `/login` = sai `NEXT_PUBLIC_MAIN_HOST`
      hoặc quên redeploy ở B9.2.
- [ ] Mở một hợp đồng cũ: đủ hạng mục, nhân sự, thanh toán, **ảnh chuyển khoản
      hiện được** (kiểm tra B7b có ăn không).
- [ ] Mở một album cũ: ảnh Drive hiện, lượt khách chọn còn nguyên.
- [ ] Mở link cổng khách của một hợp đồng cũ (`/c/<token>`) — phải mở được bằng
      SĐT khách.
- [ ] Một website studio `<sub>.mstudo.com` và một domain riêng của khách mở được.
- [ ] Kết nối Google Drive trong Cài đặt chạy hết vòng OAuth, không
      `redirect_uri_mismatch`.
- [ ] Logo studio hiện trên trang khách (kiểm tra bucket `logos` đã chép).

---

# PHẦN C — Dọn dẹp

## C1. Ngay trong ngày

1. **Xác nhận Vercel CŨ vẫn đang Pause.** Nếu hai project cùng chạy mà chung
   Supabase thì cron chạy đôi — khách nhận 2 tin Zalo, 2 email. (Ở đây hai
   project dùng hai Supabase khác nhau nên không lẫn, nhưng vẫn nên Pause để
   không ai vào nhầm bản cũ.)
2. **Secret deploy trong GitHub MỚI** → Settings → Secrets and variables →
   Actions: `VERCEL_PROJECT_ID`, `VERCEL_ORG_ID`, `VERCEL_TOKEN` trỏ sang
   project mới. *(Hoặc cài Vercel GitHub App cho repo mới rồi xoá luôn
   `.github/workflows/vercel-deploy.yml`.)*
3. `rm ~/vc-old/.env.old`.

## C2. Sau 7 ngày chạy êm

- Xoá project Vercel cũ.
- Thu hồi `VERCEL_TOKEN` cũ.
- Xoá các redirect URI cũ trong Google Cloud Console và Supabase cũ.
- **Chỉ xoá Supabase CŨ khi đã chắc bước B7b in ra `── Sạch`.** Chưa chắc thì
  chạy lại khối kiểm tra trong `rewrite-storage-urls.sql` một lần nữa.

## C3. Quay đầu khi có sự cố

Trong 7 ngày đó, quay đầu chỉ là đảo lại B9:

1. Vercel MỚI → Domains → Remove các domain.
2. Vercel CŨ → bỏ Pause → Domains → Add lại.
3. TTL 60 giây nên khách thấy lại bản cũ trong vòng một phút.

Dữ liệu bản cũ vẫn nguyên vẹn vì từ lúc B2 không ai ghi thêm. **Vì vậy đừng xoá
project cũ sớm.**

---

# Phụ lục: những chỗ hay sập

| Triệu chứng | Nguyên nhân | Sửa |
|---|---|---|
| Đăng nhập xong bị đá về `/login` | `NEXT_PUBLIC_MAIN_HOST` sai, hoặc sửa rồi mà **quên redeploy** | Sửa biến → Redeploy (biến `NEXT_PUBLIC_*` nhúng lúc build) |
| Nhắc lịch / Zalo im lặng ngừng chạy | Thiếu `CRON_SECRET` → 5 route cron trả 401 | Đặt biến rồi redeploy; thử bằng lệnh `curl` ở A7 |
| Ảnh chuyển khoản / logo mất sau khi xoá project cũ | Quên bước B7b | Chạy `rewrite-storage-urls.sql`; nếu đã lỡ xoá project cũ thì file mất thật |
| `redirect_uri_mismatch` khi nối Drive | Thiếu URI trong Google Cloud, hay quên URI `filter/drive/callback` mới | Thêm đủ 4 URI ở A4 |
| Studio thêm domain riêng nhưng không lên | `VERCEL_PROJECT_ID` vẫn trỏ project cũ | Sửa biến → redeploy |
| Google Picker không mở ở công cụ nén ảnh | Thiếu JavaScript origin | Thêm `https://mstudo.com` vào Authorized JS origins |
| Studio đăng nhập Google thành tài khoản mới | Provider Google ở Supabase mới dùng Client ID khác | Dùng **đúng** Client ID/Secret của project cũ |
| Bucket Supabase lại phình, vượt hạn mức | `DRIVE_IMG_CACHE_BUCKET` được đặt tên | Để trống biến đó |
| Chép xong nhưng thiếu vài cột dữ liệu | Chưa chạy lại `setup-all.sql` ở A2 | Chạy A2 rồi chép lại từ đầu |
