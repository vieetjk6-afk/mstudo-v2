# Chuyển mstudo từ Vercel sang VPS

> Dành cho người **chưa từng dùng VPS**. Mỗi bước ghi rõ gõ gì, ở đâu, và làm
> sao biết là đã đúng. Không bước nào yêu cầu hiểu Linux từ trước.
>
> Kết quả: `mstudo.com` chạy trên VPS của bạn, không còn Vercel. Supabase vẫn
> giữ nguyên (mục 9 nói về việc chuyển nốt Supabase sau này).

---

## 0. Tóm tắt trước khi bắt đầu

| | |
|---|---|
| **Thời gian** | 3–4 giờ làm lần đầu, phần lớn là ngồi chờ |
| **Gián đoạn thật sự** | 5–15 phút (lúc đổi DNS ở mục 7) |
| **Cần có** | VPS Ubuntu 22.04/24.04, quyền truy cập DNS tên miền, tài khoản GitHub |
| **Quay lui được không** | Được. Trỏ DNS về Vercel là trang chạy lại như cũ |

**Cách làm an toàn:** dựng VPS chạy song song với Vercel, kiểm thử trên
`beta.mstudo.com` cho chắc, rồi mới đổi DNS. Vercel vẫn sống nguyên cho đến khi
bạn chủ động tắt.

### VPS 2GB — điều phải biết trước

RAM 2GB đủ **chạy** mstudo nhưng **không đủ build**. `next build` cần 2–4GB;
build ngay trên VPS sẽ bị hệ thống giết giữa chừng, và nếu app đang chạy thì nó
bị giết luôn — nghĩa là mỗi lần deploy đều có nguy cơ sập trang.

Cách xử lý trong bộ cấu hình này: **GitHub Actions build hộ** (máy 16GB, miễn
phí) rồi gửi kết quả ~150MB sang VPS. VPS chỉ đổi symlink và khởi động lại —
nhẹ, nhanh, không bao giờ hết RAM. Bạn không phải làm gì thêm, chỉ cần biết vì
sao lại thế.

Ngoài ra `setup-vps.sh` tạo **swap 4GB** làm lưới an toàn cho lúc cao điểm.

---

## 1. Những gì đã có sẵn trong repo

Tất cả nằm trong thư mục `deploy/`, không cần tự viết:

| File | Việc |
|---|---|
| `setup-vps.sh` | Dựng VPS từ số 0: swap, user, tường lửa, Node, pm2, Caddy |
| `Caddyfile` | Máy chủ web + HTTPS tự động cho mọi tên miền |
| `ecosystem.config.cjs` | Cấu hình pm2 giữ app luôn sống |
| `activate.sh` | Kích hoạt bản mới, tự quay lui nếu hỏng |
| `crontab.txt` | 5 job cron thay cho `vercel.json` |
| `cron-run.sh` | Chạy một job cron và ghi log |
| `backup-db.sh` | Sao lưu DB (dùng ở giai đoạn 2) |
| `env.vps.example` | Mẫu file biến môi trường cho VPS |
| `.github/workflows/vps-deploy.yml` | Build + đẩy lên VPS mỗi khi push `main` |

Và 3 thay đổi nhỏ trong code:

| Thay đổi | Vì sao |
|---|---|
| `next.config.mjs` — thêm `output: standalone` (chỉ khi `BUILD_STANDALONE=1`) | Gói build gọn còn ~150MB, hợp VPS RAM thấp. Không đặt biến thì build y như cũ, Vercel không ảnh hưởng |
| `/api/health` (mới) | Để `activate.sh` biết bản mới đã sống chưa |
| `/api/tls/allow` (mới) | Chốt chặn để Caddy chỉ cấp HTTPS cho tên miền có thật trong DB |
| `/api/site/domain` — thêm chế độ VPS | Xem mục 8 |

---

## 2. Chuẩn bị (chưa động gì đến trang đang chạy)

### 2.1 Lấy thông tin VPS

Nhà cung cấp gửi cho bạn: **IP**, **user** (thường là `root`), **mật khẩu**.
Bài này giả định IP là `203.0.113.10` — thay bằng IP thật của bạn ở mọi chỗ.

### 2.2 Tạo khoá SSH (làm trên máy tính của bạn)

Khoá SSH giống chìa khoá nhà: an toàn hơn mật khẩu rất nhiều, và GitHub Actions
bắt buộc phải dùng nó để tự deploy.

```bash
ssh-keygen -t ed25519 -C "mstudo-deploy" -f ~/.ssh/mstudo_deploy
```

Bấm Enter hai lần khi nó hỏi passphrase (để trống — GitHub Actions không gõ
passphrase được).

Có hai file:
- `~/.ssh/mstudo_deploy` — **khoá riêng**, giữ kín, lát nữa dán vào GitHub Secret
- `~/.ssh/mstudo_deploy.pub` — khoá công khai, đem lên VPS

Đẩy khoá công khai lên VPS:

```bash
ssh-copy-id -i ~/.ssh/mstudo_deploy.pub root@203.0.113.10
```

Thử đăng nhập không cần mật khẩu:

```bash
ssh -i ~/.ssh/mstudo_deploy root@203.0.113.10
```

Vào được thẳng, không hỏi mật khẩu → xong bước này.

### 2.3 Chuẩn bị tên miền thử

Trong trang quản lý DNS (Cloudflare hoặc nơi bạn mua tên miền), thêm:

| Loại | Tên | Giá trị | Proxy |
|---|---|---|---|
| A | `beta` | `203.0.113.10` | **TẮT** (đám mây xám) |

> **Cloudflare — quan trọng:** bật proxy (đám mây cam) sẽ chặn Caddy xin chứng
> chỉ và làm hỏng bước xác minh tên miền. Trong suốt bài này để **DNS only**.
> Muốn dùng proxy thì bật sau, khi mọi thứ đã chạy.

---

## 3. Dựng VPS

SSH vào VPS rồi chạy:

```bash
ssh -i ~/.ssh/mstudo_deploy root@203.0.113.10

# Tải script dựng máy từ repo
curl -fsSL https://raw.githubusercontent.com/vieetjk6-afk/mstudo-v2/main/deploy/setup-vps.sh -o setup-vps.sh
less setup-vps.sh          # đọc lướt xem nó làm gì, q để thoát
bash setup-vps.sh
```

Chạy khoảng 3–5 phút. Script tự bỏ qua những bước đã làm, nên chạy lại nhiều
lần cũng không sao.

**Kiểm tra đã đúng chưa:**

```bash
free -h              # phải thấy dòng Swap: 4.0Gi
node -v              # v22.x
pm2 -v               # có số phiên bản
caddy version        # có số phiên bản
ufw status           # Status: active, mở 22/80/443
id mstudo            # có user mstudo
```

---

## 4. Đặt biến môi trường lên VPS

Đây là bước dài nhất và cũng là bước dễ sai nhất. Cứ từ từ.

### 4.1 Lấy biến từ Vercel

Mở Vercel → project `mstudo-v2` → Settings → Environment Variables. Bấm hiện giá
trị từng biến và chép ra một file nháp trên máy bạn.

Nhanh hơn thì dùng Vercel CLI:

```bash
npx vercel login
npx vercel link          # chọn project mstudo-v2
npx vercel env pull .env.tu-vercel
```

File `.env.tu-vercel` có sẵn toàn bộ giá trị. **Đừng commit file này.**

### 4.2 Tạo file .env trên VPS

```bash
ssh -i ~/.ssh/mstudo_deploy root@203.0.113.10
sudo -u mstudo nano /var/www/mstudo/shared/.env
```

Chép nội dung `deploy/env.vps.example` vào, điền giá trị thật từ bước 4.1.

Ba biến cần chú ý:

| Biến | Ghi chú |
|---|---|
| `SERVER_IP` | **Mới.** IP công khai của VPS. Thiếu biến này thì tính năng tên miền riêng của studio sẽ hỏng |
| `CRON_SECRET` | Giữ nguyên giá trị đang dùng trên Vercel |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | **Giữ nguyên tuyệt đối.** Đổi là mọi thiết bị đã bật thông báo bị mất kết nối, phải đăng ký lại |

**Cách viết giá trị:** file này được shell đọc bằng `source`, nên giá trị có dấu
cách hoặc ký tự `#`, `$`, `"`, `'` phải bọc trong nháy đơn:

```bash
EMAIL_FROM='mstudo <no-reply@mstudo.com>'
GOOGLE_CLIENT_SECRET='abc#def$ghi'
```

Lưu (Ctrl+O, Enter, Ctrl+X) rồi khoá quyền đọc:

```bash
sudo chmod 600 /var/www/mstudo/shared/.env
sudo chown mstudo:mstudo /var/www/mstudo/shared/.env
```

### 4.3 Không cần đưa lên VPS

`VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID` — chỉ dùng để đăng ký tên
miền lên Vercel, trên VPS đã có `SERVER_IP` + Caddy thay thế.

`UPSTASH_REDIS_REST_*` — có trong `.env.example` nhưng code **không dùng**.

---

## 5. Cấu hình Caddy (máy chủ web + HTTPS)

### 5.1 Sửa file cho khớp tên miền của bạn

Trên **máy tính của bạn**, mở `deploy/Caddyfile` và sửa 2 chỗ:
1. `doi-email-cua-ban@mstudo.com` → email thật (Let's Encrypt báo khi chứng chỉ
   sắp hết hạn mà gia hạn hỏng)
2. Nếu tên miền không phải `mstudo.com` thì thay hết

Ở giai đoạn kiểm thử, thêm `beta.mstudo.com` vào danh sách host hệ thống:

```
mstudo.com,
www.mstudo.com,
beta.mstudo.com,
img.mstudo.com,
...
```

### 5.2 Chép lên VPS

```bash
scp -i ~/.ssh/mstudo_deploy deploy/Caddyfile root@203.0.113.10:/etc/caddy/Caddyfile

ssh -i ~/.ssh/mstudo_deploy root@203.0.113.10
sudo caddy validate --config /etc/caddy/Caddyfile   # phải in "Valid configuration"
sudo systemctl reload caddy
sudo systemctl status caddy                          # phải thấy active (running)
```

### 5.3 Caddy làm gì cho bạn

- **HTTPS tự động** cho cả 6 subdomain, tự gia hạn, không phải nhớ gì
- **HTTPS cho tên miền lạ** (on-demand TLS): studio gắn `studio-cua-khach.com`
  → Caddy tự xin chứng chỉ ở lần truy cập đầu tiên
- **Chốt chặn**: trước khi xin chứng chỉ, Caddy hỏi `/api/tls/allow` xem tên
  miền có trong DB không. Không có chốt này, ai trỏ domain rác về IP của bạn
  cũng làm Caddy đi xin chứng chỉ, và Let's Encrypt sẽ **khoá cả máy chủ một
  tuần** — kể cả `mstudo.com` cũng không gia hạn được
- **Bỏ giới hạn của Vercel**: hết chặn body 4.5MB, hết timeout 60s. Upload ảnh
  cưới và xuất file chạy thoải mái. Đây là cái lợi rõ nhất khi rời serverless

---

## 6. Deploy lần đầu

### 6.1 Khai báo secret cho GitHub

GitHub → repo `mstudo-v2` → Settings → Secrets and variables → Actions.

Tab **Secrets** (New repository secret):

| Tên | Giá trị |
|---|---|
| `VPS_HOST` | `203.0.113.10` |
| `VPS_SSH_KEY` | Toàn bộ nội dung `~/.ssh/mstudo_deploy` — chép cả dòng `-----BEGIN…` và `-----END…` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Lấy từ file `.env` |

Tab **Variables** (New repository variable) — đây là các biến `NEXT_PUBLIC_*`
không bí mật:

| Tên | Ví dụ |
|---|---|
| `VPS_USER` | `mstudo` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_MAIN_HOST` | `mstudo.com` |
| `NEXT_PUBLIC_IMG_HOST` | `img.mstudo.com` |
| `NEXT_PUBLIC_ADMIN_HOST` | `admin.mstudo.com` |
| `NEXT_PUBLIC_THIEP_HOST` | `thiep.mstudo.com` |
| `NEXT_PUBLIC_APP_HOST` | `album.mstudo.com` |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | … |
| `NEXT_PUBLIC_GOOGLE_API_KEY` | … |
| `NEXT_PUBLIC_GOOGLE_APP_ID` | … |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | … |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | … |
| `NEXT_PUBLIC_STUDIO_HOST` | (để trống nếu không dùng) |
| `NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL` | … |
| `NEXT_PUBLIC_DESKTOP_RELEASES_REPO` | … |

> **Vì sao `NEXT_PUBLIC_*` phải khai ở GitHub mà các biến khác thì không?**
> Biến `NEXT_PUBLIC_*` bị nướng thẳng vào file JavaScript gửi xuống trình duyệt
> **lúc build**, nên phải có mặt trên máy build. Các biến bí mật thật
> (`SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`…) chỉ
> chạy phía máy chủ, đọc lúc chạy, nên chỉ cần nằm trong `.env` trên VPS.
> Đừng bao giờ đưa chúng vào GitHub.

### 6.2 Chạy deploy

GitHub → tab **Actions** → **Deploy to VPS** → **Run workflow** → chọn nhánh →
**Run**.

Mất khoảng 5–8 phút. Log sẽ hiện lần lượt: cài gói → build → gói bản build →
đẩy sang VPS → kích hoạt → kiểm tra sức khoẻ.

### 6.3 Kiểm tra

```bash
ssh -i ~/.ssh/mstudo_deploy mstudo@203.0.113.10

pm2 list                       # mstudo phải ở trạng thái online
pm2 logs mstudo --lines 30     # xem có lỗi khởi động không
curl -s localhost:3000/api/health   # {"ok":true,...}
```

Rồi mở trình duyệt vào `https://beta.mstudo.com`. Kiểm tra lần lượt:

- [ ] Trang chủ hiện đúng, có CSS và ảnh (mất CSS = quên chép `.next/static`)
- [ ] Đăng nhập được
- [ ] Vào dashboard, xem danh sách hợp đồng
- [ ] Mở Google Picker chọn ảnh từ Drive
- [ ] Upload một ảnh
- [ ] Xem một album công khai
- [ ] Chuông thông báo (kiểm tra realtime còn chạy)
- [ ] Xuất một hợp đồng ra file

---

## 7. Đổi DNS sang VPS

Chỉ làm khi mục 6 đã kiểm tra xong hết.

### 7.1 Hạ TTL trước 1 ngày

Vào DNS, đổi TTL của các bản ghi `mstudo.com`, `www`, `img`, `admin`, `thiep`,
`album` xuống **300 giây (5 phút)**. Làm trước một ngày.

Việc này để nếu có sự cố, đổi ngược về Vercel chỉ mất 5 phút thay vì vài tiếng.

### 7.2 Bỏ cron trên Vercel trước

**Đây là bước hay bị quên nhất.** Nếu Vercel và VPS cùng chạy cron, khách sẽ
nhận **hai** email nhắc và **hai** tin Zalo mỗi ngày, và job dọn ảnh chạy hai
lần.

Trên Vercel: Settings → Cron Jobs → tắt cả 5 job. (Hoặc xoá `vercel.json` và
deploy lại, nhưng tắt bằng tay thì nhanh và chắc hơn.)

### 7.3 Đổi bản ghi DNS

| Loại | Tên | Giá trị cũ | Giá trị mới |
|---|---|---|---|
| A | `@` | `76.76.21.21` | `203.0.113.10` |
| A hoặc CNAME | `www` | `cname.vercel-dns.com` | `203.0.113.10` |
| A hoặc CNAME | `img` | `cname.vercel-dns.com` | `203.0.113.10` |
| A hoặc CNAME | `admin` | `cname.vercel-dns.com` | `203.0.113.10` |
| A hoặc CNAME | `thiep` | `cname.vercel-dns.com` | `203.0.113.10` |
| A hoặc CNAME | `album` | `cname.vercel-dns.com` | `203.0.113.10` |
| A | `*` (nếu có) | | `203.0.113.10` |

Bản ghi `*` phục vụ subdomain của studio (`abc.mstudo.com`).

### 7.4 Theo dõi 30 phút đầu

```bash
pm2 logs mstudo                                # log ứng dụng
sudo journalctl -u caddy -f                    # log Caddy (xem việc cấp chứng chỉ)
watch -n5 'free -h; pm2 jlist | head -c 200'   # RAM
```

Kiểm tra bên ngoài: mở `https://mstudo.com` ở chế độ ẩn danh, đăng nhập, upload
thử một ảnh.

### 7.5 Nếu có sự cố

Đổi các bản ghi DNS về giá trị Vercel cũ. TTL 300s nên 5 phút là trang trở lại
bình thường. Vercel vẫn còn nguyên, chưa xoá gì.

---

## 8. Tên miền riêng của studio — điểm khác biệt lớn nhất

Trên Vercel, khi một studio gắn `studio-cua-khach.com`, app gọi Vercel API để
đăng ký tên miền và Vercel lo chứng chỉ. **Trên VPS không có API đó.**

Repo đã có sẵn cách thay thế, kích hoạt bằng biến `SERVER_IP`:

| | Trên Vercel | Trên VPS |
|---|---|---|
| Đăng ký tên miền | gọi Vercel API | không cần — lưu vào DB là đủ |
| Cấp chứng chỉ HTTPS | Vercel làm | Caddy tự xin (on-demand TLS) |
| Xác minh | hỏi Vercel API | app tra DNS xem đã trỏ về `SERVER_IP` chưa |
| Studio phải khai DNS | A → `76.76.21.21` | A → IP VPS của bạn |
| Chốt chặn chống lạm dụng | Vercel lo | `/api/tls/allow` tra bảng `sites` |

**Studio đã gắn tên miền từ trước thì sao?** Họ đang trỏ về `76.76.21.21` (IP
của Vercel). Sau khi bạn chuyển nhà, các tên miền đó vẫn trỏ về Vercel và sẽ
hỏng khi bạn tắt project.

Lấy danh sách cần báo bằng SQL này (chạy trong Supabase SQL Editor):

```sql
select s.custom_domain, s.subdomain, p.email, p.full_name
from sites s
join profiles p on p.id = s.owner_id
where s.custom_domain is not null
order by s.custom_domain;
```

Với mỗi studio trong danh sách, báo họ đổi bản ghi A của tên miền từ
`76.76.21.21` sang IP VPS của bạn. Đổi xong, họ vào phần cài đặt website bấm
"kiểm tra lại" là app tự xác minh và Caddy tự cấp HTTPS.

**Mẹo giảm gián đoạn:** báo trước cho họ đổi DNS **cùng ngày** bạn đổi DNS
chính. Danh sách này thường chỉ vài studio nên gọi điện là nhanh nhất.

---

## 9. Giai đoạn 2 — tự dựng Supabase (làm sau, khi đã có VPS mạnh hơn)

### Chưa làm được với VPS 2GB

Bộ self-host Supabase gồm 7 dịch vụ (Postgres, GoTrue, PostgREST, Realtime,
Storage, Kong, Studio) và cần **tối thiểu 4GB RAM chỉ riêng cho nó**. Cộng thêm
Next.js nữa thì phải **8GB**. Ép chạy trên 2GB sẽ hỏng theo kiểu tệ nhất: chạy
được lúc vắng khách rồi chết vào đúng lúc đông.

**Khi nào nên làm:** khi hoá đơn Supabase đủ lớn để bù tiền nâng VPS lên 8GB, và
bạn đã quen vận hành VPS sau vài tháng chạy giai đoạn 1.

### Vì sao phải self-host chứ không đổi sang Postgres thường

Dự án phụ thuộc rất sâu vào Supabase:

| | Số lượng |
|---|---|
| Bảng | 161 |
| Chính sách RLS | 208 |
| `auth.uid()` trong SQL | 238 chỗ |
| File dùng Supabase Auth | 56 |
| Realtime | 3 màn |
| Storage bucket | `wedding-photos`, `payment-proofs` |

208 chính sách RLS là **toàn bộ hàng rào ngăn studio A đọc dữ liệu studio B**.
Bỏ Supabase để dùng Postgres thường nghĩa là phải viết lại từng ấy quy tắc thành
code, và mỗi chỗ sót là một lần rò rỉ dữ liệu khách hàng.

Self-host Supabase giữ **nguyên vẹn** tất cả: code ứng dụng chỉ đổi
`NEXT_PUBLIC_SUPABASE_URL` và hai khoá.

### Phác thảo các bước (khi đã nâng VPS)

1. Nâng VPS lên **8GB RAM / 4 vCPU / 100GB+ SSD**. Ước lượng ổ đĩa trước bằng
   cách xem dung lượng Storage hiện tại trên Supabase Dashboard → Settings →
   Usage — bucket `wedding-photos` có thể rất lớn.
2. Cài Docker + Docker Compose.
3. Tải bộ self-host chính thức
   (`github.com/supabase/supabase` → `docker/`), sinh khoá mới bằng công cụ của
   họ, viết `.env` cho compose.
4. Thêm `db.mstudo.com` (trỏ về VPS) vào Caddyfile, reverse proxy về cổng Kong
   (8000).
5. Chuyển dữ liệu: `pg_dump` từ Supabase cloud → `psql` vào Postgres mới. Nhớ
   dump **cả** schema `auth` (bảng người dùng), không chỉ `public` — thiếu là
   mọi người mất tài khoản.
6. Chuyển file Storage: tải toàn bộ 2 bucket xuống rồi đẩy lên bằng
   Storage API của bản self-host.
7. Đổi `NEXT_PUBLIC_SUPABASE_URL` + 2 khoá trong `.env` trên VPS và trong
   GitHub Variables/Secrets, rồi deploy lại.
8. Cập nhật URL callback đăng nhập Google trong Google Cloud Console (host của
   Supabase đổi → callback đổi).
9. **Bật ngay** `deploy/backup-db.sh` trong crontab và cấu hình `BACKUP_REMOTE`
   để đẩy sao lưu ra nơi khác.

> Việc lớn nhất và rủi ro nhất là bước 5 và 6. Làm thử trên một VPS tạm trước,
> đừng làm thẳng trên production.

---

## 10. Vận hành hằng ngày

### Lệnh hay dùng

```bash
ssh -i ~/.ssh/mstudo_deploy mstudo@203.0.113.10

pm2 list                     # app còn sống không
pm2 logs mstudo              # log trực tiếp
pm2 logs mstudo --lines 200  # 200 dòng gần nhất
pm2 monit                    # xem RAM/CPU theo thời gian thực
pm2 reload mstudo            # khởi động lại không đứt kết nối

free -h                      # RAM + swap
df -h /                      # ổ đĩa
tail -50 ~/logs/cron.log     # cron chạy có lỗi không

sudo journalctl -u caddy -n 50    # log Caddy
```

### Deploy bản mới

Push lên `main` là GitHub Actions tự làm. Muốn deploy tay: Actions → Deploy to
VPS → Run workflow.

### Quay lui bản cũ

`activate.sh` tự quay lui khi bản mới không phản hồi. Muốn quay lui thủ công:

```bash
ls -1t /var/www/mstudo/releases      # 3 bản gần nhất
/var/www/mstudo/releases/<tên-bản-cũ>/deploy/activate.sh <tên-bản-cũ>
```

### Việc phải nhớ

| Việc | Khi nào |
|---|---|
| `sudo apt update && sudo apt upgrade -y` | Mỗi tháng |
| Kiểm tra `df -h` còn chỗ trống | Mỗi tháng |
| Xem `~/logs/cron.log` có job nào hỏng | Mỗi tuần |
| Thử khôi phục một bản sao lưu | Mỗi quý (giai đoạn 2) |

### Nên gắn thêm giám sát

VPS chết thì không ai báo bạn. Đăng ký một dịch vụ miễn phí (UptimeRobot,
BetterStack) trỏ vào `https://mstudo.com/api/health`, 5 phút kiểm tra một lần,
gửi email khi sập.

---

## 11. Xử lý sự cố

| Triệu chứng | Nguyên nhân hay gặp | Cách xử lý |
|---|---|---|
| Trang trắng, mất hết CSS | Quên chép `.next/static` hoặc `public/` | Chạy lại workflow deploy |
| 502 Bad Gateway | Next.js không chạy | `pm2 list`, `pm2 logs mstudo` |
| Đăng nhập xong bị đá về `/login` | `NEXT_PUBLIC_MAIN_HOST` sai → cookie domain sai | Sửa `.env`, `pm2 reload mstudo --update-env` |
| Không cấp được HTTPS | Cloudflare đang bật proxy, hoặc DNS chưa trỏ | Tắt proxy (đám mây xám), chờ DNS |
| Tên miền riêng của studio không lên HTTPS | Chưa lưu trong DB, hoặc DNS chưa trỏ về VPS | `curl "localhost:3000/api/tls/allow?domain=studio.com"` — không trả `ok` thì xem lại bảng `sites` |
| Cron không chạy | Chưa cài crontab, hoặc `CRON_SECRET` lệch | `crontab -l`, xem `~/logs/cron.log` |
| Khách nhận 2 email / 2 tin Zalo | Cron còn bật cả trên Vercel | Tắt Cron Jobs trên Vercel |
| App tự khởi động lại liên tục | Hết RAM | `free -h`; kiểm tra swap; cân nhắc nâng RAM |
| Upload file lớn bị lỗi | Timeout Caddy | Nâng `read_timeout` trong Caddyfile |
| Deploy hỏng, trang vẫn chạy bản cũ | `activate.sh` đã tự quay lui | Xem log Actions và `pm2 logs mstudo` |

### Trang sập, chưa biết vì sao — làm theo thứ tự này

```bash
ssh -i ~/.ssh/mstudo_deploy mstudo@203.0.113.10
pm2 list                        # 1. app còn chạy không?
pm2 logs mstudo --lines 100     # 2. lỗi gì?
free -h                         # 3. hết RAM không?
df -h /                         # 4. đầy ổ không?
sudo systemctl status caddy     # 5. Caddy còn chạy không?
curl -s localhost:3000/api/health   # 6. Next.js có phản hồi không?
```

Bước 6 trả về `{"ok":true}` mà ngoài Internet vẫn không vào được → lỗi ở Caddy
hoặc DNS, không phải ở app.

---

## 12. Danh sách kiểm tra

**Chuẩn bị**
- [ ] Tạo khoá SSH, vào VPS được không cần mật khẩu
- [ ] Thêm bản ghi DNS `beta` trỏ về VPS (Cloudflare: tắt proxy)
- [ ] Xuất biến môi trường từ Vercel

**Dựng máy**
- [ ] Chạy `setup-vps.sh`, kiểm tra swap 4GB
- [ ] Tạo `/var/www/mstudo/shared/.env`, `chmod 600`
- [ ] Điền `SERVER_IP`
- [ ] Chép `Caddyfile`, `caddy validate`, reload

**Deploy**
- [ ] Khai secret + variable trên GitHub
- [ ] Chạy workflow, thấy `pm2 list` online
- [ ] Kiểm tra đủ 8 mục ở 6.3 trên `beta.mstudo.com`
- [ ] Cài crontab, chạy thử một job bằng tay

**Cắt chuyển**
- [ ] Hạ TTL xuống 300s (trước 1 ngày)
- [ ] **Tắt Cron Jobs trên Vercel**
- [ ] Đổi DNS
- [ ] Theo dõi 30 phút
- [ ] Báo studio có tên miền riêng đổi bản ghi A

**Sau khi ổn**
- [ ] Gắn giám sát vào `/api/health`
- [ ] Chạy song song 1–2 tuần rồi mới xoá project Vercel
- [ ] Xoá `vercel.json` và `.github/workflows/vercel-deploy.yml` khỏi repo
