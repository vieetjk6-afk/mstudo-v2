# Chuyển mstudo từ Vercel sang VPS — hướng dẫn đầy đủ

> Viết cho người **chưa từng dùng VPS**. Mỗi bước ghi rõ gõ gì, ở đâu, và làm
> sao biết là đã đúng. Không bước nào cần biết Linux từ trước.
>
> Kết quả: `mstudo.com` chạy trên máy chủ của bạn, không còn Vercel. Supabase
> giữ nguyên.

**Mục lục**

1. [Phương án đã chọn và vì sao](#1-phương-án-đã-chọn-và-vì-sao)
2. [Chọn VPS: nhà cung cấp, cấu hình, hệ điều hành](#2-chọn-vps-nhà-cung-cấp-cấu-hình-hệ-điều-hành)
3. [Chuẩn bị trước khi động vào gì](#3-chuẩn-bị-trước-khi-động-vào-gì)
4. [Dựng máy chủ](#4-dựng-máy-chủ)
5. [Đặt biến môi trường](#5-đặt-biến-môi-trường)
6. [Cấu hình Caddy](#6-cấu-hình-caddy)
7. [Deploy lần đầu](#7-deploy-lần-đầu)
8. [Cài cron](#8-cài-cron)
9. [Kiểm thử trước khi cắt](#9-kiểm-thử-trước-khi-cắt)
10. [Đổi DNS](#10-đổi-dns)
11. [Tên miền riêng của studio](#11-tên-miền-riêng-của-studio)
12. [Vận hành hằng ngày](#12-vận-hành-hằng-ngày)
13. [Xử lý sự cố](#13-xử-lý-sự-cố)
14. [Việc nên làm tiếp](#14-việc-nên-làm-tiếp)
15. [Danh sách kiểm tra](#15-danh-sách-kiểm-tra)

---

## 1. Phương án đã chọn và vì sao

**VPS 2GB · Ubuntu 24.04 LTS · Caddy · systemd · build trên GitHub Actions ·
Supabase giữ nguyên**

| Thành phần | Chọn gì | Vì sao |
|---|---|---|
| Hệ điều hành | Ubuntu 24.04 LTS | Được hỗ trợ tới 2029, nhiều tài liệu nhất, có sẵn gói Node và Caddy |
| Máy chủ web | **Caddy** | Tự xin và tự gia hạn HTTPS cho **mọi** tên miền, kể cả tên miền riêng của khách mà ta không biết trước. Nginx phải chạy certbot tay cho từng tên miền — bất khả thi với mstudo |
| Giữ app sống | **systemd** | Đã có sẵn, tốn 0 RAM. pm2 tốn 67MB (đo thật) và là thêm một daemon có thể chết |
| Build | **GitHub Actions** | `next build` cần 2–4GB. Build trên VPS sẽ hết RAM và kéo sập app đang chạy |
| Database | Supabase (giữ nguyên) | 208 chính sách RLS + 238 chỗ gọi `auth.uid()` là hàng rào ngăn studio này đọc dữ liệu studio kia. Viết lại là rủi ro rò rỉ dữ liệu |

**Vì sao không dùng những thứ khác:**

- **Dokploy / Coolify** — cần tối thiểu 2GB *chỉ cho bản thân nó*, và không xử
  lý được tên miền riêng tự phục vụ (phải thêm tay từng domain).
- **Cloudflare Workers** — rẻ hơn, nhưng `googleapis` và `web-push` (Drive,
  Calendar, thông báo đẩy) chưa chắc chạy, và mất tính năng Zalo cá nhân.
- **Docker** — thêm một tầng phức tạp cho **một** ứng dụng, tốn thêm RAM.

### Con số đo thật

Tôi đã build bản standalone và chạy thật, nạp 660 request với 30 luồng đồng thời:

| | |
|---|---|
| Gói build gửi sang VPS | **54 MB** |
| RAM lúc vừa khởi động | **79 MB** |
| RAM đỉnh khi tải nặng | **155 MB** |
| Thời gian khởi động | **76 ms** |

Khởi động 76ms cộng với việc Caddy giữ request tới 15 giây nghĩa là **deploy
không làm gián đoạn** — khách không thấy gì.

---

## 2. Chọn VPS: nhà cung cấp, cấu hình, hệ điều hành

### 2.1 Cấu hình cần

| | Tối thiểu | **Nên chọn** | Khi nào cần hơn |
|---|---|---|---|
| RAM | 1 GB | **2 GB** | 4GB nếu sau này tự dựng Supabase (cần 8GB) |
| CPU | 1 nhân | **2 nhân** | |
| Ổ đĩa | 20 GB | **30–40 GB** SSD/NVMe | Ảnh nằm trên Supabase, không chiếm ổ VPS |
| Băng thông | 1 TB/tháng | 2 TB | |

**Vì sao 2GB chứ không phải 1GB:** 1GB *chạy được* — tôi đã tính: hệ điều hành
~180MB + Caddy 30MB + app 300MB = còn trống ~500MB. Nhưng đó là toàn bộ vùng đệm
cho mọi tình huống bất thường. Mỗi upload đang chạy chiếm tới 10MB RAM, nên
khoảng 40 studio cùng đổ ảnh là chạm trần. Chênh lệch giá 1GB → 2GB thường chỉ
vài chục nghìn mỗi tháng, đổi lại bạn có quyền sai sót.

### 2.2 Chọn nhà cung cấp

Khách của bạn ở Việt Nam, nên **vị trí máy chủ quan trọng hơn thương hiệu**.

| Vị trí | Độ trễ tới VN | Ghi chú |
|---|---|---|
| Việt Nam | 5–20 ms | Nhanh nhất. Nhưng cáp quang biển đứt thì kết nối quốc tế (Supabase, Google Drive) chậm theo |
| **Singapore** | 30–50 ms | **Cân bằng tốt nhất** — gần VN, lại là điểm trung chuyển quốc tế tốt |
| Nhật / Hong Kong | 50–80 ms | Tốt |
| Mỹ / Châu Âu | 200–300 ms | Chậm rõ rệt, tránh |

Điểm quan trọng: app của bạn gọi Supabase và Google Drive **ở mỗi request**. Nếu
Supabase của bạn đặt ở Singapore thì VPS ở Singapore sẽ cho tổng thời gian phản
hồi thấp nhất — kể cả khi khách ở Việt Nam. Kiểm tra vùng Supabase tại
Dashboard → Settings → General → Region.

Gợi ý nhà cung cấp có Singapore, giá quanh 2GB:

- **Vultr**, **DigitalOcean**, **Linode/Akamai** — quốc tế, giao diện tốt, trả bằng thẻ quốc tế
- **Hetzner** — rẻ nhất nhưng chỉ có Châu Âu/Mỹ, **không hợp** với khách VN
- **VNG Cloud, Viettel IDC, BizFly, Vinahost** — đặt tại VN, thanh toán nội địa

> Đây là gợi ý chung, không phải khuyến nghị cụ thể — bạn nên tự so giá và điều
> khoản tại thời điểm mua.

### 2.3 Chọn hệ điều hành khi tạo VPS

Trong trang tạo máy, chọn:

> **Ubuntu 24.04 LTS x64**

Đừng chọn: bản không-LTS (hết hỗ trợ sau 9 tháng), CentOS (đã ngừng), hay các
image "có sẵn cPanel/Plesk" (cài đầy thứ bạn không dùng và ăn RAM).

Nếu nhà cung cấp hỏi thêm:
- **Enable IPv6** — bật, không hại gì
- **Enable backups** — bật nếu rẻ (thường ~20% giá máy). Đây là lưới an toàn cấp máy chủ
- **SSH keys** — nếu có ô dán khoá công khai, làm mục 3.2 trước rồi dán vào đây
- **Cloud-init / User data** — bỏ trống

### 2.4 Ghi lại thông tin

Sau khi tạo xong, nhà cung cấp cho bạn:

```
IP        : 203.0.113.10      ← thay bằng IP thật ở MỌI chỗ trong tài liệu này
User      : root
Mật khẩu  : (gửi qua email hoặc hiện trên giao diện)
```

---

## 3. Chuẩn bị trước khi động vào gì

Toàn bộ mục này **không ảnh hưởng** đến trang đang chạy trên Vercel.

### 3.1 Những gì đã có sẵn trong repo

| File | Việc |
|---|---|
| `deploy/setup-vps.sh` | Dựng máy: swap, user, tường lửa, fail2ban, siết SSH, Node, Caddy, systemd |
| `deploy/Caddyfile` | Web server + HTTPS tự động |
| `deploy/mstudo.service` | Cấu hình systemd |
| `deploy/activate.sh` | Kích hoạt bản mới, kiểm tra, tự quay lui |
| `deploy/crontab.txt` | 5 job thay cho `vercel.json` |
| `deploy/cron-run.sh` | Chạy job + ghi log |
| `deploy/backup-db.sh` | Sao lưu DB (dùng sau) |
| `deploy/env.vps.example` | Mẫu biến môi trường |
| `.github/workflows/vps-deploy.yml` | Build + đẩy sang VPS |

### 3.2 Tạo khoá SSH (làm trên máy tính của bạn)

Khoá SSH giống chìa khoá nhà — an toàn hơn mật khẩu rất nhiều, và GitHub Actions
bắt buộc phải dùng nó.

```bash
ssh-keygen -t ed25519 -C "mstudo-deploy" -f ~/.ssh/mstudo_deploy
```

Bấm Enter hai lần khi hỏi passphrase (để trống — GitHub Actions không gõ được).

Được hai file:
- `~/.ssh/mstudo_deploy` — **khoá riêng**, giữ kín, lát nữa dán vào GitHub Secret
- `~/.ssh/mstudo_deploy.pub` — khoá công khai, đem lên VPS

Đẩy khoá công khai lên VPS:

```bash
ssh-copy-id -i ~/.ssh/mstudo_deploy.pub root@203.0.113.10
```

Thử vào không cần mật khẩu:

```bash
ssh -i ~/.ssh/mstudo_deploy root@203.0.113.10
```

Vào thẳng, không hỏi mật khẩu → xong bước này. **Chưa được thì đừng đi tiếp** —
mục 4 sẽ tắt đăng nhập bằng mật khẩu, và bạn sẽ bị khoá ngoài máy chủ.

### 3.3 Thêm tên miền thử

Trong trang quản lý DNS (Cloudflare hoặc nơi mua tên miền):

| Loại | Tên | Giá trị | Proxy |
|---|---|---|---|
| A | `beta` | `203.0.113.10` | **TẮT** (đám mây xám) |

> **Cloudflare — rất quan trọng:** bật proxy (đám mây cam) sẽ chặn Caddy xin
> chứng chỉ. Trong suốt bài này để **DNS only**. Muốn dùng proxy thì bật sau,
> khi mọi thứ đã chạy.

### 3.4 Lấy biến môi trường từ Vercel

```bash
npx vercel login
npx vercel link          # chọn project mstudo-v2
npx vercel env pull .env.tu-vercel
```

File `.env.tu-vercel` có toàn bộ giá trị thật. **Đừng commit file này.**

Không dùng CLI thì vào Vercel → Settings → Environment Variables, bấm hiện giá
trị từng biến và chép ra file nháp.

---

## 4. Dựng máy chủ

SSH vào VPS và chạy script dựng máy:

```bash
ssh -i ~/.ssh/mstudo_deploy root@203.0.113.10

curl -fsSL https://raw.githubusercontent.com/vieetjk6-afk/mstudo-v2/main/deploy/setup-vps.sh -o setup-vps.sh
less setup-vps.sh        # đọc lướt xem nó làm gì — q để thoát
bash setup-vps.sh
```

Mất 3–5 phút. Chạy lại nhiều lần cũng được, bước nào xong rồi thì tự bỏ qua.

Script làm 10 việc:

| # | Việc | Vì sao |
|---|---|---|
| 1 | Cập nhật hệ thống, múi giờ VN | Cron chạy theo giờ Việt Nam |
| 2 | Swap = 2× RAM (tối đa 4GB) | Lưới an toàn khi RAM cạn — chậm còn hơn chết |
| 3 | User `mstudo` | Không bao giờ chạy app web bằng root |
| 4 | Tường lửa: chỉ 22/80/443 | Đóng mọi thứ không cần |
| 5 | fail2ban | Chặn IP dò mật khẩu SSH |
| 6 | Tắt đăng nhập bằng mật khẩu | Mật khẩu dù mạnh cũng bị dò cả ngày |
| 7 | Node.js 22 | |
| 8 | Caddy | |
| 9 | Thư mục app + systemd + quyền sudo tối thiểu | |
| 10 | Cập nhật bảo mật tự động | Bản vá tự cài, không cần nhớ |

### ⚠️ Ngay sau khi script chạy xong

Script đã **tắt đăng nhập bằng mật khẩu**. **Đừng đóng cửa sổ SSH hiện tại.**
Mở một cửa sổ terminal **mới** và thử:

```bash
ssh -i ~/.ssh/mstudo_deploy mstudo@203.0.113.10
```

Vào được thì mới đóng cửa sổ cũ. Không vào được thì quay lại cửa sổ cũ và chạy:

```bash
rm /etc/ssh/sshd_config.d/99-mstudo.conf && systemctl reload ssh
```

### Kiểm tra đã đúng chưa

```bash
free -h                 # dòng Swap phải khác 0
node -v                 # v22.x
caddy version           # có số phiên bản
ufw status              # Status: active, mở 22/80/443
id mstudo               # có user mstudo
systemctl is-enabled mstudo    # enabled
sudo -n -l -U mstudo | grep systemctl    # thấy dòng cấp quyền restart
```

---

## 5. Đặt biến môi trường

Đây là bước dài nhất và dễ sai nhất. Cứ từ từ.

```bash
ssh -i ~/.ssh/mstudo_deploy mstudo@203.0.113.10
nano /var/www/mstudo/shared/.env
```

Chép nội dung `deploy/env.vps.example` vào, điền giá trị thật từ mục 3.4.

### Cách viết giá trị

systemd đọc file này, **không phải bash**. Luật đơn giản hơn:

```bash
# Đúng — dấu cách trong giá trị không cần bọc nháy
EMAIL_FROM=mstudo <no-reply@mstudo.com>
VAPID_SUBJECT=mailto:khoa@mstudo.com

# Sai — không được có dấu cách quanh dấu =
A = 1

# Sai — không dùng export
export A=1
```

`$` trong giá trị **không** bị thay thế, nên khoá bí mật chứa `$` an toàn.

> `activate.sh` tự kiểm tra định dạng file này trước mỗi lần deploy và **từ chối
> deploy** nếu sai. Lý do: systemd không báo lỗi khi gặp dòng sai — nó lặng lẽ
> bỏ qua dòng đó, và bạn sẽ có một app chạy bình thường nhưng hỏng một tính năng
> nào đó, không có gì trong log chỉ ra nguyên nhân.

### Ba biến cần chú ý

| Biến | Ghi chú |
|---|---|
| `SERVER_IP` | **Mới.** IP của VPS. Thiếu là tính năng tên miền riêng của studio hỏng |
| `CRON_SECRET` | Giữ nguyên giá trị đang dùng trên Vercel |
| `VAPID_*` | **Giữ nguyên tuyệt đối.** Đổi là mọi thiết bị đã bật thông báo mất kết nối, phải đăng ký lại |

### Không cần đưa lên VPS

`VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID` — trên VPS đã có
`SERVER_IP` + Caddy thay thế.

`UPSTASH_REDIS_REST_*` — có trong `.env.example` nhưng code **không dùng**.

### Khoá quyền đọc

```bash
chmod 600 /var/www/mstudo/shared/.env
ls -l /var/www/mstudo/shared/.env      # phải là -rw------- mstudo mstudo
```

---

## 6. Cấu hình Caddy

### 6.1 Sửa cho khớp tên miền của bạn

Trên **máy tính của bạn**, mở `deploy/Caddyfile` và sửa:

1. `doi-email-cua-ban@mstudo.com` → email thật (Let's Encrypt báo khi gia hạn hỏng)
2. Nếu tên miền không phải `mstudo.com` thì thay hết
3. Thêm `beta.mstudo.com` vào danh sách host để kiểm thử:

```
mstudo.com,
www.mstudo.com,
beta.mstudo.com,
img.mstudo.com,
admin.mstudo.com,
thiep.mstudo.com,
album.mstudo.com {
	import app
}
```

### 6.2 Chép lên VPS

```bash
scp -i ~/.ssh/mstudo_deploy deploy/Caddyfile root@203.0.113.10:/etc/caddy/Caddyfile

ssh -i ~/.ssh/mstudo_deploy root@203.0.113.10
caddy validate --config /etc/caddy/Caddyfile   # phải in "Valid configuration"
systemctl reload caddy
systemctl status caddy                          # active (running)
```

### 6.3 Caddy làm gì cho bạn

- **HTTPS tự động** cho các subdomain hệ thống, tự gia hạn
- **HTTPS cho tên miền lạ** (on-demand TLS): studio gắn `studio-cua-khach.com` →
  Caddy tự xin chứng chỉ ở lần truy cập đầu tiên
- **Chốt chặn**: trước khi xin chứng chỉ, Caddy hỏi `/api/tls/allow` xem tên
  miền có trong DB không. Không có chốt này, ai trỏ domain rác về IP của bạn
  cũng làm Caddy đi xin chứng chỉ, và Let's Encrypt **khoá cả máy chủ một tuần**
  — kể cả `mstudo.com` cũng không gia hạn được
- **Deploy không gián đoạn**: giữ request tới 15 giây trong lúc app khởi động lại
- **Bỏ giới hạn của Vercel**: hết chặn body 4.5MB, hết timeout 60s

---

## 7. Deploy lần đầu

### 7.1 Khai báo secret cho GitHub

GitHub → repo `mstudo-v2` → Settings → Secrets and variables → Actions.

Tab **Secrets**:

| Tên | Giá trị |
|---|---|
| `VPS_HOST` | `203.0.113.10` |
| `VPS_SSH_KEY` | Toàn bộ nội dung `~/.ssh/mstudo_deploy`, cả dòng `-----BEGIN…` và `-----END…` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Lấy từ `.env` |

Tab **Variables**:

| Tên | Ví dụ |
|---|---|
| `VPS_USER` | `mstudo` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_MAIN_HOST` | `mstudo.com` |
| `NEXT_PUBLIC_IMG_HOST` | `img.mstudo.com` |
| `NEXT_PUBLIC_ADMIN_HOST` | `admin.mstudo.com` |
| `NEXT_PUBLIC_THIEP_HOST` | `thiep.mstudo.com` |
| `NEXT_PUBLIC_APP_HOST` | `album.mstudo.com` |
| `NEXT_PUBLIC_STUDIO_HOST` | (để trống nếu không dùng) |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | … |
| `NEXT_PUBLIC_GOOGLE_API_KEY` | … |
| `NEXT_PUBLIC_GOOGLE_APP_ID` | … |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | … |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | … |
| `NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL` | … |
| `NEXT_PUBLIC_DESKTOP_RELEASES_REPO` | … |

> **Vì sao `NEXT_PUBLIC_*` phải khai ở GitHub mà biến khác thì không?**
> Chúng bị nướng thẳng vào JavaScript gửi xuống trình duyệt **lúc build**, nên
> phải có mặt trên máy build. Biến bí mật thật (`SUPABASE_SERVICE_ROLE_KEY`,
> `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`…) chỉ chạy phía máy chủ và đọc lúc
> chạy, nên chỉ cần nằm trong `.env` trên VPS. **Đừng đưa chúng vào GitHub.**

### 7.2 Chạy

GitHub → **Actions** → **Deploy to VPS** → **Run workflow**.

Mất 5–8 phút: cài gói → build → gói bản build → đẩy sang VPS → kích hoạt →
kiểm tra sức khoẻ.

### 7.3 Kiểm tra

```bash
ssh -i ~/.ssh/mstudo_deploy mstudo@203.0.113.10

systemctl status mstudo             # active (running)
journalctl -u mstudo -n 30          # có lỗi khởi động không
curl -s localhost:3000/api/health   # {"ok":true,...}
```

---

## 8. Cài cron

```bash
crontab /var/www/mstudo/current/deploy/crontab.txt
crontab -l                          # xem lại
```

Chạy thử một job ngay để chắc chắn nó hoạt động:

```bash
/var/www/mstudo/current/deploy/cron-run.sh reminders
tail -5 ~/logs/cron.log             # phải thấy dòng "OK — ..."
```

Thấy `LỖI: CRON_SECRET rỗng` hoặc `HTTP 401` → xem lại `CRON_SECRET` trong `.env`.

### 5 job và giờ chạy

| Giờ VN | Job | Việc |
|---|---|---|
| 07:00 hằng ngày | `reminders` | Email tổng hợp cho chủ studio |
| 08:30 hằng ngày | `cleanup-proofs` | Xoá ảnh chứng từ quá hạn |
| 10:00 hằng ngày | `cleanup-drive-cache` | Dọn cache ảnh Drive |
| 11:00 hằng ngày | `zalo` | Gửi tin Zalo theo lịch |
| 09:00 Chủ nhật | `cleanup-wedding-photos` | Xoá ảnh cưới hết hạn |

`vercel.json` ghi theo giờ UTC, bảng trên đã quy đổi sang giờ Việt Nam.

---

## 9. Kiểm thử trước khi cắt

Mở `https://beta.mstudo.com` và kiểm tra từng mục:

- [ ] Trang chủ hiện đúng, **có CSS và ảnh** (mất CSS = thiếu `.next/static`)
- [ ] Đăng nhập được, refresh trang vẫn còn đăng nhập
- [ ] Dashboard, danh sách hợp đồng hiện đủ
- [ ] Mở Google Picker chọn ảnh từ Drive
- [ ] Upload một ảnh
- [ ] Xem một album công khai (mở ẩn danh)
- [ ] Chuông thông báo có số (kiểm tra realtime)
- [ ] Xuất một hợp đồng ra file
- [ ] Trang thiệp cưới
- [ ] Công cụ nén ảnh

Thử luôn khả năng deploy không gián đoạn: mở trang, rồi trong lúc đó chạy
`sudo systemctl restart mstudo` từ SSH. Trang phải vẫn tải bình thường.

---

## 10. Đổi DNS

Chỉ làm khi mục 9 đã xong hết.

### 10.1 Hạ TTL — làm trước 1 ngày

Đổi TTL của các bản ghi `mstudo.com`, `www`, `img`, `admin`, `thiep`, `album`
xuống **300 giây**. Để nếu có sự cố, quay về Vercel chỉ mất 5 phút thay vì vài
tiếng.

### 10.2 Tắt cron trên Vercel — làm TRƯỚC khi đổi DNS

**Đây là bước hay bị quên nhất.** Vercel và VPS cùng chạy cron thì khách nhận
**hai** email và **hai** tin Zalo mỗi ngày, job dọn ảnh chạy hai lần.

Vercel → Settings → Cron Jobs → tắt cả 5 job.

### 10.3 Đổi bản ghi

| Loại | Tên | Giá trị mới |
|---|---|---|
| A | `@` | `203.0.113.10` |
| A | `www` | `203.0.113.10` |
| A | `img` | `203.0.113.10` |
| A | `admin` | `203.0.113.10` |
| A | `thiep` | `203.0.113.10` |
| A | `album` | `203.0.113.10` |
| A | `*` (nếu có) | `203.0.113.10` |

Bản ghi `*` phục vụ subdomain của studio (`abc.mstudo.com`). Nếu đang là CNAME
trỏ về `cname.vercel-dns.com` thì đổi thành bản ghi A.

### 10.4 Theo dõi 30 phút

```bash
journalctl -u mstudo -f              # log ứng dụng
journalctl -u caddy -f               # log Caddy (xem việc cấp chứng chỉ)
watch -n5 'free -h; systemctl status mstudo --no-pager | head -5'
```

Kiểm tra bên ngoài: mở `https://mstudo.com` ẩn danh, đăng nhập, upload thử.

### 10.5 Nếu có sự cố

Đổi DNS về giá trị Vercel cũ. TTL 300s nên 5 phút là trang trở lại. Vercel vẫn
còn nguyên, chưa xoá gì.

---

## 11. Tên miền riêng của studio

### 11.1 Điều gì đã thay đổi

Trên Vercel, khi studio gắn `studio-cua-khach.com`, app gọi Vercel API để đăng
ký và Vercel lo chứng chỉ. **Trên VPS không có API đó.** Repo đã có cách thay
thế, bật bằng biến `SERVER_IP`:

| | Trên Vercel | Trên VPS |
|---|---|---|
| Đăng ký tên miền | gọi Vercel API | không cần — lưu DB là đủ |
| Cấp HTTPS | Vercel làm | Caddy tự xin |
| Xác minh | hỏi Vercel API | tra DNS xem đã trỏ về `SERVER_IP` chưa |
| Studio khai DNS | A → `76.76.21.21` | A → IP VPS của bạn |

### 11.2 Studio đã gắn tên miền từ trước

Họ đang trỏ về `76.76.21.21` (IP Vercel) và sẽ hỏng khi bạn tắt project.

Lấy danh sách cần báo (chạy trong Supabase SQL Editor):

```sql
select s.custom_domain, s.subdomain, p.email, p.full_name
from sites s
join profiles p on p.id = s.owner_id
where s.custom_domain is not null
order by s.custom_domain;
```

Báo mỗi studio đổi bản ghi A sang IP VPS. Xong, họ vào cài đặt website bấm
"kiểm tra lại" là app tự xác minh và Caddy tự cấp HTTPS.

**Mẹo:** báo họ đổi **cùng ngày** bạn đổi DNS chính. Danh sách thường chỉ vài
studio nên gọi điện là nhanh nhất.

### 11.3 Khi cần sửa cấu hình systemd

`activate.sh` **cố ý không** tự cập nhật unit file — nếu cho phép, ai đẩy được
code lên VPS cũng có thể sửa thành `ExecStart=/bin/sh` rồi restart, tức là leo
thẳng lên quyền root. Sửa unit thì làm tay bằng root:

```bash
sudo cp /var/www/mstudo/current/deploy/mstudo.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl restart mstudo
```

`activate.sh` sẽ nhắc bạn khi phát hiện hai bản khác nhau.

---

## 12. Vận hành hằng ngày

### Lệnh hay dùng

```bash
ssh -i ~/.ssh/mstudo_deploy mstudo@203.0.113.10

systemctl status mstudo          # còn sống không
journalctl -u mstudo -f          # log trực tiếp (Ctrl+C để thoát)
journalctl -u mstudo -n 200      # 200 dòng gần nhất
journalctl -u mstudo --since "1 hour ago"
sudo systemctl restart mstudo    # khởi động lại

free -h                          # RAM + swap
df -h /                          # ổ đĩa
systemctl show mstudo -p MemoryCurrent   # app đang ăn bao nhiêu RAM
tail -50 ~/logs/cron.log         # cron có lỗi không

sudo systemctl reload caddy
journalctl -u caddy -n 50
curl -s localhost:3000/api/health
```

### Deploy bản mới

Push lên `main` → GitHub Actions tự làm. Deploy tay: Actions → Deploy to VPS →
Run workflow.

### Quay lui

`activate.sh` tự quay lui khi bản mới không phản hồi trong 60 giây. Thủ công:

```bash
ls -1t /var/www/mstudo/releases          # 3 bản gần nhất
/var/www/mstudo/releases/<bản-cũ>/deploy/activate.sh <bản-cũ>
```

### Đổi biến môi trường

```bash
nano /var/www/mstudo/shared/.env
sudo systemctl restart mstudo    # không có bước này thì app vẫn giá trị cũ
```

### Lịch bảo trì

| Việc | Khi nào |
|---|---|
| `sudo apt update && sudo apt upgrade -y` | Mỗi tháng (bản vá bảo mật đã tự cài) |
| Kiểm tra `df -h` còn chỗ trống | Mỗi tháng |
| Xem `~/logs/cron.log` có job hỏng | Mỗi tuần |
| `sudo reboot` sau khi cập nhật kernel | Khi có thông báo |

### Gắn giám sát

VPS chết thì không ai báo bạn. Đăng ký một dịch vụ miễn phí (UptimeRobot,
BetterStack) trỏ vào `https://mstudo.com/api/health`, 5 phút kiểm tra một lần,
gửi email khi sập. **Đừng bỏ qua bước này** — đây là khác biệt lớn nhất giữa
Vercel (họ trông hộ) và VPS (bạn tự trông).

---

## 13. Xử lý sự cố

| Triệu chứng | Nguyên nhân hay gặp | Cách xử lý |
|---|---|---|
| Trang trắng, mất CSS | Thiếu `.next/static` hoặc `public/` | Chạy lại workflow deploy |
| 502 Bad Gateway | App không chạy | `systemctl status mstudo`, `journalctl -u mstudo -n 50` |
| Đăng nhập xong bị đá về `/login` | `NEXT_PUBLIC_MAIN_HOST` sai → cookie domain sai | Sửa `.env`, `sudo systemctl restart mstudo` |
| Không cấp được HTTPS | Cloudflare bật proxy, hoặc DNS chưa trỏ | Tắt proxy (đám mây xám), chờ DNS |
| Tên miền studio không lên HTTPS | Chưa lưu DB, hoặc DNS chưa trỏ | `curl "localhost:3000/api/tls/allow?domain=studio.com"` — không trả `ok` thì xem bảng `sites` |
| Cron không chạy | Chưa cài crontab, hoặc `CRON_SECRET` lệch | `crontab -l`, xem `~/logs/cron.log` |
| Khách nhận 2 email / 2 tin Zalo | Cron còn bật trên Vercel | Tắt Cron Jobs trên Vercel |
| App khởi động lại liên tục | Hết RAM, hoặc lỗi khởi động | `journalctl -u mstudo -n 100`; `free -h` |
| `Start request repeated too quickly` | Chết 5 lần trong 60s, systemd dừng hẳn | Sửa lỗi rồi `sudo systemctl reset-failed mstudo && sudo systemctl start mstudo` |
| Deploy báo lỗi `.env` | File sai định dạng systemd | Đọc thông báo lỗi, sửa dòng được chỉ ra |
| Deploy hỏng, trang vẫn chạy bản cũ | `activate.sh` đã tự quay lui | Xem log Actions và `journalctl -u mstudo` |
| Upload file lớn lỗi | Timeout Caddy | Nâng `read_timeout` trong Caddyfile |

### Trang sập, chưa biết vì sao — theo thứ tự này

```bash
ssh -i ~/.ssh/mstudo_deploy mstudo@203.0.113.10
systemctl status mstudo             # 1. app còn chạy không?
journalctl -u mstudo -n 100         # 2. lỗi gì?
free -h                             # 3. hết RAM không?
df -h /                             # 4. đầy ổ không?
systemctl status caddy              # 5. Caddy còn chạy không?
curl -s localhost:3000/api/health   # 6. app có phản hồi không?
```

Bước 6 trả `{"ok":true}` mà ngoài Internet không vào được → lỗi ở Caddy hoặc
DNS, không phải ở app.

### Mất quyền SSH vào máy

Dùng **Console / VNC** trên trang quản lý của nhà cung cấp — đó là "màn hình
cắm trực tiếp vào máy", vào được kể cả khi SSH hỏng. Đăng nhập root bằng mật
khẩu ban đầu rồi:

```bash
rm /etc/ssh/sshd_config.d/99-mstudo.conf
systemctl reload ssh
```

---

## 14. Việc nên làm tiếp

### 14.1 Chuyển bucket cache ảnh sang Cloudflare R2 — **ưu tiên cao nhất**

Chuyển sang VPS cắt được tiền Vercel, nhưng **không** giải quyết vấn đề tài
nguyên Supabase. Theo `docs/supabase-usage.md`, bucket `drive-cache` chiếm
**13GB — 99,7% tổng dung lượng**, trong khi hạn mức Free là 1GB. Database chỉ
dùng 69MB/500MB.

Cloudflare R2 tính **0 đồng egress** và ~$0,015/GB/tháng. 13GB ≈ **$0,20/tháng**,
so với việc phải lên Supabase Pro $25/tháng chỉ vì cái bucket cache.

Thay đổi rất gọn: 6 điểm gọi trong 3 file (`/api/img`, cron dọn cache,
`lib/download.ts`), đều đã nằm sau biến `DRIVE_IMG_CACHE_BUCKET`. Mất cache
không mất dữ liệu — mọi object dựng lại được từ Drive.

### 14.2 Sau khi chạy ổn định 1–2 tuần

- Xoá project trên Vercel
- Xoá `vercel.json` và `.github/workflows/vercel-deploy.yml` khỏi repo
- Bật lại Cloudflare proxy nếu muốn (chỉ sau khi HTTPS đã cấp xong)

### 14.3 Tự dựng Supabase — chỉ khi đã nâng VPS lên 8GB

Bộ self-host Supabase cần **tối thiểu 4GB RAM cho riêng nó**, cộng Next.js là
8GB. Việc rủi ro nhất là chuyển dữ liệu: phải dump **cả** schema `auth` (bảng
người dùng), không chỉ `public` — thiếu là mọi người mất tài khoản. Làm thử trên
VPS tạm trước, đừng làm thẳng trên production. Và bật `deploy/backup-db.sh` ngay
trong ngày đầu.

---

## 15. Danh sách kiểm tra

**Mua máy**
- [ ] VPS 2GB RAM / 2 nhân / 30GB SSD, vị trí Singapore hoặc VN
- [ ] Ubuntu 24.04 LTS x64
- [ ] Ghi lại IP

**Chuẩn bị**
- [ ] Tạo khoá SSH, vào VPS được không cần mật khẩu
- [ ] Thêm bản ghi DNS `beta` (Cloudflare: tắt proxy)
- [ ] Xuất biến môi trường từ Vercel

**Dựng máy**
- [ ] Chạy `setup-vps.sh`
- [ ] **Mở cửa sổ mới, thử SSH bằng user `mstudo` trước khi đóng cửa sổ cũ**
- [ ] Kiểm tra swap, node, caddy, ufw
- [ ] Điền `/var/www/mstudo/shared/.env`, nhớ `SERVER_IP`
- [ ] `chmod 600` file `.env`
- [ ] Chép `Caddyfile`, `caddy validate`, reload

**Deploy**
- [ ] Khai secret + variable trên GitHub
- [ ] Chạy workflow, `systemctl status mstudo` = active
- [ ] Cài crontab, chạy thử `cron-run.sh reminders`
- [ ] Kiểm tra đủ 10 mục ở mục 9 trên `beta.mstudo.com`
- [ ] Thử restart lúc đang mở trang — không được đứt

**Cắt chuyển**
- [ ] Hạ TTL xuống 300s (trước 1 ngày)
- [ ] **Tắt Cron Jobs trên Vercel**
- [ ] Đổi DNS
- [ ] Theo dõi 30 phút
- [ ] Báo studio có tên miền riêng đổi bản ghi A

**Sau khi ổn**
- [ ] Gắn giám sát vào `/api/health`
- [ ] Chuyển bucket cache sang R2 (mục 14.1)
- [ ] Chạy song song 1–2 tuần rồi mới xoá Vercel
