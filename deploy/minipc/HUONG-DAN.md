# Biến minipc thành máy chủ mstudo + NAS + chạy thêm web khác

Tài liệu này đi từ **máy trắng** tới lúc `mstudo.com` chạy trên minipc trong
nhà, kèm ổ mạng (NAS) cho cả studio và chỗ để chạy thêm các web khác. Làm theo
thứ tự; mỗi mục có lệnh copy‑dán được.

---

## 0. Phương án được chọn và vì sao

```
          Internet (khách, studio)                    Bạn (quản trị, ở đâu cũng được)
                   │ HTTPS                                       │
          ┌────────▼─────────┐                          ┌────────▼────────┐
          │ Cloudflare (CDN, │                          │    Tailscale    │
          │ SSL, chống DDoS) │                          │ (VPN riêng, mã  │
          └────────┬─────────┘                          │  hoá đầu-cuối)  │
                   │ đường hầm (minipc gọi RA)          └────────┬────────┘
   ┌───────────────▼───────────────────────────────────────────▼───────────┐
   │ MINIPC · Ubuntu Server 24.04 LTS · tường lửa CHẶN mọi kết nối vào     │
   │                                                                       │
   │  Docker:  cloudflared ──► mstudo (Next.js) ◄── cron (11 việc hẹn giờ) │
   │                     └──► web khác (blog, uptime-kuma, …)              │
   │                                                                       │
   │  Samba (NAS) ─ chỉ LAN + Tailscale        restic ─► ổ USB / đám mây    │
   └───────────────────────────────────────────────────────────────────────┘
                   Database vẫn ở Supabase (đám mây) như hiện nay
```

| Quyết định | Chọn | Lý do |
|---|---|---|
| Hệ điều hành | **Ubuntu Server 24.04 LTS** cài thẳng lên máy | Nhẹ, vá bảo mật tới 2029, tài liệu nhiều nhất. Proxmox/TrueNAS/Unraid hợp với máy nhiều ổ hoặc cần máy ảo — với 1 minipc thì thêm lớp phức tạp mà không thêm an toàn. |
| Chạy ứng dụng | **Docker Compose** | Mỗi web một hộp riêng, cập nhật/khôi phục bằng một lệnh, không làm bẩn hệ điều hành. |
| Đưa web ra Internet | **Cloudflare Tunnel** | **Không mở cổng router**, không lộ IP nhà, chạy được cả khi nhà mạng dùng CGNAT/IP động, SSL + chống DDoS miễn phí. DNS của bạn vốn đã ở Cloudflare. |
| Quản trị từ xa + NAS ngoài nhà | **Tailscale** | SSH và ổ mạng **không bao giờ** ra Internet công khai; chỉ máy bạn đã đăng nhập mới thấy. |
| NAS | **Samba (SMB3)** cài trên máy | Windows/macOS/điện thoại mở được ngay, nhanh nhất, ít thứ phải bảo trì. |
| Database | **Giữ Supabase** | Tự host Postgres + Auth + Storage là gánh nặng vận hành lớn và rủi ro mất dữ liệu; không đáng. |
| Sao lưu | **restic** (mã hoá) ra ổ USB + 1 nơi ngoài nhà | Quy tắc 3‑2‑1. App cũng đã tự sao lưu DB lên Drive mỗi đêm. |

### Trước khi quyết dời hẳn khỏi Vercel — đọc kỹ

Chạy ở nhà thì **bạn là người trực**: mất điện, đứt cáp, nhà mạng bảo trì =
web chết cho tới khi có lại. Vercel không có rủi ro đó. Vì vậy:

- **Nên có UPS** (bộ lưu điện 600–1000VA, ~1–1,5 triệu) và cắm cả modem/router vào.
- **Nên làm theo 2 giai đoạn** (mục 7): chạy thử trên tên miền phụ vài tuần,
  ổn rồi mới chuyển tên miền chính. Vercel vẫn để đó làm đường lui (trỏ DNS
  ngược lại là xong trong 1 phút).
- Cloudflare gói Free giới hạn **100 MB mỗi lần tải lên** qua tên miền. Tải
  file lớn hơn qua app sẽ lỗi 413 (ảnh/video đi thẳng Google Drive thì không ảnh hưởng).
- **Tên miền riêng của studio khách** (vd `studioabc.com`): trên Vercel app tự
  đăng ký qua API; tự host thì phải dùng **Cloudflare for SaaS → Custom
  Hostnames** (miễn phí 100 tên miền) và thêm tay từng cái. Tên miền phụ
  `<sub>.mstudo.com` thì vẫn tự động (mục 5.4).

---

## 1. Phần cứng và chuẩn bị (30 phút)

**Tối thiểu cho mstudo + NAS + vài web:** CPU 4 nhân (Intel N100 trở lên),
RAM **16 GB** (8 GB vẫn chạy nhưng build sẽ chậm), SSD NVMe ≥ 256 GB cho hệ
điều hành, **ổ thứ hai** cho dữ liệu NAS (SSD/HDD 2,5"), một **ổ USB gắn ngoài**
để sao lưu.

Trong **BIOS/UEFI** (bấm Del/F2 khi khởi động):

1. **Restore on AC Power Loss → Power On** (có điện lại là tự bật).
2. Bật **Secure Boot** (Ubuntu hỗ trợ).
3. Đặt mật khẩu BIOS.
4. Tắt Wake-on-LAN nếu không dùng.

**Mạng:** cắm **dây LAN** (đừng dùng Wi‑Fi cho máy chủ). Vào trang quản trị
router, mục DHCP → **đặt IP cố định** (DHCP reservation) cho minipc, vd
`192.168.1.10`. **Không cần và không được** mở port (NAT/port‑forward) nào.

---

## 2. Cài Ubuntu Server 24.04 LTS (30 phút)

1. Tải ISO: <https://ubuntu.com/download/server> (bản 24.04 LTS).
2. Ghi ra USB bằng **Rufus** (Windows) hoặc **balenaEtcher** (macOS).
3. Cắm USB vào minipc, khởi động từ USB, chọn:
   - Ngôn ngữ **English** (thông báo lỗi dễ tra cứu hơn).
   - Ổ cài: chọn **ổ NVMe** (ổ hệ điều hành), *Use an entire disk*,
     tick **Set up this disk as an LVM group** và **Encrypt the LVM group with
     LUKS** nếu muốn mã hoá ổ (khi đó mỗi lần khởi động phải gõ mật khẩu tại
     máy → **không tự bật lại sau mất điện**; với máy chủ ở nhà thường KHÔNG
     chọn mã hoá ổ hệ điều hành, chỉ mã hoá bản sao lưu là đủ).
   - **KHÔNG** đụng tới ổ dữ liệu ở bước này.
   - Tên máy: `minipc`, tài khoản: vd `khoa` + mật khẩu mạnh.
   - Tick **Install OpenSSH server**.
   - Bỏ qua mọi "Featured snaps" (Docker sẽ cài bản chính thức sau).
4. Rút USB, khởi động lại.

Từ giờ bạn làm việc **từ máy tính của mình** qua SSH (Windows dùng Terminal/PowerShell):

```bash
ssh khoa@192.168.1.10
```

---

## 3. Bảo mật máy (15 phút) — chạy script đã viết sẵn

### 3.1 Lấy mã nguồn về máy

```bash
git clone https://github.com/vieetjk6-afk/mstudo-v2.git ~/mstudo-v2
```

Repo private → GitHub hỏi đăng nhập: dùng **Personal Access Token** (GitHub →
Settings → Developer settings → Fine‑grained tokens → chỉ repo `mstudo-v2`,
quyền *Contents: Read‑only*) làm mật khẩu. Hoặc tạo *deploy key* chỉ đọc.

### 3.2 Đăng nhập bằng SSH key (thay cho mật khẩu)

Trên **máy tính của bạn** (không phải minipc):

```bash
ssh-keygen -t ed25519
```

```bash
ssh-copy-id khoa@192.168.1.10
```

(Windows không có `ssh-copy-id`: mở file `C:\Users\<bạn>\.ssh\id_ed25519.pub`,
copy nội dung, rồi trên minipc dán vào `~/.ssh/authorized_keys`.)

Thử `ssh khoa@192.168.1.10` — vào thẳng không hỏi mật khẩu là đúng.

### 3.3 Chạy script chuẩn bị máy

```bash
sudo bash ~/mstudo-v2/deploy/minipc/scripts/01-chuan-bi-may.sh
```

Script làm: cập nhật + **tự vá bảo mật hằng đêm**, tường lửa **chặn mọi kết nối
vào** (chỉ cho SSH từ LAN), fail2ban, **tắt đăng nhập bằng mật khẩu** (vì đã có
key), cấm root đăng nhập, cài Docker + Tailscale, theo dõi sức khoẻ ổ cứng.

### 3.4 Bật Tailscale

```bash
sudo tailscale up
```

Mở link hiện ra, đăng nhập (Google cũng được). Cài app **Tailscale** trên
laptop + điện thoại, cùng tài khoản. Xong là ở bất cứ đâu bạn cũng
`ssh khoa@minipc` được (MagicDNS), trong khi Internet công khai không thấy cổng
SSH nào.

> Trong trang quản trị Tailscale → Machines → minipc → **Disable key expiry**
> (nếu không 180 ngày sau máy chủ tự rớt khỏi mạng Tailscale).

**Đăng xuất rồi SSH vào lại** để quyền dùng Docker có hiệu lực.

---

## 4. Cloudflare Tunnel (10 phút)

1. Vào <https://one.dash.cloudflare.com> → **Networks → Tunnels → Create a tunnel**.
2. Chọn **Cloudflared**, đặt tên `minipc`, Save.
3. Ở màn "Install connector" chọn **Docker**, copy **chuỗi dài sau `--token`**
   (chỉ chuỗi token). Giữ bí mật — ai có token là chiếm được đường hầm.
4. **Chưa** cần thêm Public Hostname, làm ở mục 5.4.

---

## 5. Chạy mstudo (20–30 phút, phần lớn là chờ build)

### 5.1 Tạo file bí mật `.env`

```bash
cd ~/mstudo-v2/deploy/minipc
```

```bash
cat ../../.env.example .env.minipc.example > .env && chmod 600 .env
```

```bash
nano .env
```

Điền **đúng như trên Vercel** (Vercel → Project → Settings → Environment
Variables, hoặc `vercel env pull` trên máy bạn). Bắt buộc tối thiểu:

| Biến | Ghi chú |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase |
| `CRON_SECRET` | `openssl rand -hex 32`. Thiếu là cron không chạy |
| `CLOUDFLARE_TUNNEL_TOKEN` | Token ở mục 4 |
| `GOOGLE_API_KEY`, `GOOGLE_CLIENT_SECRET`, `NEXT_PUBLIC_GOOGLE_*`, các `*_REDIRECT_URI` | Giữ nguyên như Vercel nếu cùng tên miền |
| `NEXT_PUBLIC_*_HOST` | **Giai đoạn chạy thử: để TRỐNG cả 5** (cả app chạy trên 1 tên miền thử). Lúc chuyển chính thức mới điền. |
| `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID` | **Để trống** |

Lưu: `Ctrl+O`, Enter, `Ctrl+X`.

> ⚠ Biến `NEXT_PUBLIC_*` được **nhúng lúc build**. Đổi chúng thì phải
> `docker compose up -d --build`, khởi động lại thôi là không đủ.

### 5.2 Build và chạy

```bash
docker compose up -d --build
```

Lần đầu mất 5–15 phút. Bước build cần **~6 GB RAM** (kiểm tra kiểu TypeScript
của repo rất nặng). Máy **8 GB RAM** thì trước khi build tạo thêm 8 GB swap và
hạ mức heap:

```bash
sudo fallocate -l 8G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile && echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

```bash
docker compose build --build-arg BUILD_HEAP_MB=3072 && docker compose up -d
```

(Chạy thì nhẹ: đo thử app lúc rảnh ~150 MB RAM, đã giới hạn tối đa 2 GB.) Xem trạng thái:

```bash
docker compose ps
```

Cả 3 dòng `mstudo`, `cron`, `cloudflared` phải là `running`/`healthy`. Thử ngay trên máy:

```bash
curl -s http://127.0.0.1:3000/api/version
```

Xem log khi có lỗi:

```bash
docker compose logs -f --tail=100 mstudo
```

### 5.3 Kiểm tra cron

```bash
docker compose logs cron
```

Chạy thử một việc ngay (phải ra mã `200`, không phải `401`):

```bash
docker compose exec cron /bin/sh /cron/goi.sh /api/cron/plan-expiry
```

Lịch cron giống hệt `vercel.json` (giờ UTC), nằm ở `deploy/minipc/cron/crontab`.

### 5.4 Gắn tên miền vào đường hầm

Cloudflare Zero Trust → Networks → Tunnels → `minipc` → **Public Hostname → Add**:

| Giai đoạn | Subdomain | Domain | Service |
|---|---|---|---|
| Chạy thử | `thu` | `mstudo.com` | `HTTP` · `mstudo:3000` |
| Chính thức | *(trống)* | `mstudo.com` | `HTTP` · `mstudo:3000` |
| Chính thức | `album`, `img`, `admin`, `thiep` (mỗi cái 1 dòng) | `mstudo.com` | `HTTP` · `mstudo:3000` |
| Chính thức | `*` (tên miền phụ của studio) | `mstudo.com` | `HTTP` · `mstudo:3000` |

Cloudflare tự tạo bản ghi DNS. Nếu báo "record already exists" (đang trỏ
Vercel) thì đó chính là bước **chuyển** — xem mục 7.

Trong **SSL/TLS** của tên miền: chế độ **Full**, bật **Always Use HTTPS**.

---

## 6. NAS (20 phút)

### 6.1 Gắn ổ dữ liệu (ổ thứ hai)

Xem tên ổ:

```bash
lsblk -o NAME,SIZE,MODEL,MOUNTPOINT
```

Giả sử ổ dữ liệu là `/dev/sda` (**kiểm tra kỹ — lệnh dưới XOÁ SẠCH ổ đó**):

```bash
sudo wipefs -a /dev/sda && sudo parted -s /dev/sda mklabel gpt mkpart nas ext4 0% 100%
```

```bash
sudo mkfs.ext4 -L nas /dev/sda1
```

```bash
sudo mkdir -p /srv/nas && echo 'LABEL=nas /srv/nas ext4 defaults,noatime,nofail 0 2' | sudo tee -a /etc/fstab
```

```bash
sudo systemctl daemon-reload && sudo mount -a && df -h /srv/nas
```

(`nofail`: ổ hỏng thì máy vẫn khởi động được, web vẫn chạy.)

### 6.2 Cài chia sẻ mạng

```bash
sudo NAS_ROOT=/srv/nas bash ~/mstudo-v2/deploy/minipc/scripts/02-nas.sh
```

Tạo 3 thư mục chia sẻ: `studio` (dùng chung), `ca-nhan` (riêng bạn),
`sao-luu-may-tinh` (Time Machine cho Mac / File History cho Windows). Có **thùng
rác 30 ngày** cho file xoá qua mạng. Chỉ máy trong nhà và trong Tailscale
truy cập được.

- Windows: File Explorer → gõ `\\192.168.1.10\studio` → nhập tài khoản/mật khẩu NAS
  → chuột phải *Map network drive*.
- macOS: Finder → `Cmd+K` → `smb://192.168.1.10/studio`.
- Điện thoại: app **Files** (iOS) / **CX File Explorer** (Android) → SMB.
- Ở ngoài: bật Tailscale, thay IP bằng `minipc` hoặc IP `100.x.x.x`.

> **Không bao giờ** đưa NAS ra Internet qua Cloudflare Tunnel hay mở cổng 445.
> Đó là cách ransomware vào nhà.

Muốn xem/tải file qua trình duyệt kiểu Google Drive thì thêm **Filebrowser** hoặc
**Nextcloud** như một "web khác" (mục 8) và **bọc bằng Cloudflare Access** (8.2).

---

## 7. Chuyển tên miền chính từ Vercel sang minipc

Làm sau khi `thu.mstudo.com` chạy ổn ít nhất 1–2 tuần.

1. Sửa `.env`: điền 5 biến `NEXT_PUBLIC_MAIN_HOST`, `..._APP_HOST`,
   `..._IMG_HOST`, `..._ADMIN_HOST`, `..._THIEP_HOST` giống Vercel. Rồi:
   ```bash
   docker compose up -d --build
   ```
2. Cloudflare DNS: **xoá** các bản ghi `mstudo.com`, `album`, `img`, `admin`,
   `thiep`, `*` đang trỏ `cname.vercel-dns.com` / IP Vercel.
3. Thêm các Public Hostname "Chính thức" ở bảng mục 5.4.
4. **TẮT cron trên Vercel ngay** — nếu không mỗi tin nhắc Zalo/email sẽ gửi
   **2 lần**. Cách: Vercel → Project → Settings → Cron Jobs → **Disable**
   (hoặc xoá biến `CRON_SECRET` trên Vercel để cron bên đó tự trả 401).
5. Callback Google/Zalo/Meta **không phải sửa** vì tên miền giữ nguyên.
6. Đường lui: trả lại bản ghi DNS về Vercel + bật lại cron bên đó.

---

## 8. Chạy thêm web khác

Mỗi web một thư mục, một `docker-compose.yml`, nối vào mạng `edge` để
cloudflared gọi tới được — **không mở thêm cổng**. Ví dụ Uptime Kuma (báo khi
web sập, rất nên có):

```bash
mkdir -p ~/apps/uptime && cd ~/apps/uptime
```

```bash
cat > docker-compose.yml <<'EOF'
services:
  uptime-kuma:
    image: louislam/uptime-kuma:1
    restart: unless-stopped
    volumes: ["./data:/app/data"]
    networks: [edge]
networks:
  edge:
    external: true
EOF
```

```bash
docker compose up -d
```

Rồi thêm Public Hostname `uptime.mstudo.com` → `HTTP` · `uptime-kuma:3001`.
Web tĩnh / WordPress / blog làm y hệt, chỉ đổi image và cổng.

### 8.1 Quy tắc an toàn cho mọi web thêm vào

- Dùng image **chính chủ**, ghi rõ phiên bản (không dùng `latest` cho thứ quan trọng).
- **Không** dùng `ports:` ra `0.0.0.0` — Docker sẽ **vượt qua tường lửa UFW**.
  Cần thử trên máy thì ghi `127.0.0.1:PORT:PORT`.
- Không gắn `/var/run/docker.sock` vào container nào phơi ra Internet.

### 8.2 Trang quản trị chỉ mình bạn vào: Cloudflare Access

Zero Trust → **Access → Applications → Add → Self-hosted** → tên miền (vd
`uptime.mstudo.com`) → Policy *Allow* · *Emails* = email của bạn. Ai vào cũng
phải nhận mã qua email trước khi thấy trang. Áp cho mọi trang quản trị
(Uptime Kuma, Filebrowser, Portainer…). **Không** áp cho `mstudo.com` (khách cần vào).

---

## 9. Sao lưu (15 phút) — đừng bỏ qua

Cắm ổ USB sao lưu, định dạng + gắn giống 6.1 nhưng nhãn `backup`, thư mục `/mnt/backup`. Rồi:

```bash
sudo BACKUP_REPO=/mnt/backup/restic bash ~/mstudo-v2/deploy/minipc/scripts/03-sao-luu.sh cai-dat
```

Script in ra **mật khẩu kho sao lưu** — chép ra giấy cất kỹ. Mỗi đêm 01:30 tự
sao lưu `/srv/nas` + file `.env` + cấu hình Samba, giữ 7 ngày / 4 tuần / 12
tháng, chủ nhật tự kiểm tra bản sao lưu.

Bản thứ hai **ngoài nhà** (cháy/trộm là mất cả minipc lẫn ổ USB): tạo thêm một
kho trên Backblaze B2 (~6 USD/TB/tháng) hoặc Google Drive qua `rclone`, rồi chạy
lại lệnh `cai-dat` với `BACKUP_REPO` mới trong một file cấu hình riêng.

Database: app đã tự xuất toàn bộ dữ liệu lên Drive admin mỗi đêm
(`docs/sao-luu-tu-dong.md`) — giữ nguyên.

**Diễn tập khôi phục** mỗi quý một lần (bản sao lưu chưa từng khôi phục thử thì
coi như chưa có):

```bash
sudo bash ~/mstudo-v2/deploy/minipc/scripts/03-sao-luu.sh danh-sach
```

---

## 10. Vận hành hằng ngày

| Việc | Lệnh |
|---|---|
| Cập nhật mstudo lên bản mới của `main` | `~/mstudo-v2/deploy/minipc/scripts/cap-nhat.sh` |
| Xem trạng thái | `cd ~/mstudo-v2/deploy/minipc && docker compose ps` |
| Xem log | `docker compose logs -f --tail=100 mstudo` |
| Khởi động lại app | `docker compose restart mstudo` |
| Dung lượng ổ | `df -h` · `ncdu /srv/nas` |
| Sức khoẻ ổ cứng | `sudo smartctl -H /dev/nvme0n1` |
| Ai đang bị chặn SSH | `sudo fail2ban-client status sshd` |
| Dọn image cũ | `docker system prune -f` |

Hệ điều hành tự vá bảo mật mỗi đêm và tự khởi động lại lúc 4h sáng khi cần;
Docker tự bật lại mọi web sau khi khởi động.

### Danh sách kiểm tra bảo mật

- [ ] Router **không** có port‑forward nào tới minipc.
- [ ] `sudo ufw status` chỉ có SSH/Samba từ LAN và `tailscale0`.
- [ ] Đăng nhập SSH bằng mật khẩu đã tắt (`ssh -o PubkeyAuthentication=no khoa@minipc` phải bị từ chối).
- [ ] `.env` có quyền `600`, **không** commit lên git (đã có trong `.gitignore`).
- [ ] Tailscale: tắt key expiry cho minipc; bật 2FA cho tài khoản Tailscale, Cloudflare, GitHub, Google.
- [ ] Trang quản trị phụ đều nằm sau Cloudflare Access.
- [ ] Có UPS; BIOS đặt tự bật khi có điện.
- [ ] Đã khôi phục thử một file từ bản sao lưu.
