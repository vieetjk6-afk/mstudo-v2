# Máy chủ ở nhà cho mstudo — hướng dẫn từng bước

Tài liệu này dành cho người **không chuyên** về máy chủ. Làm lần lượt từ trên
xuống, mỗi bước có cách kiểm tra "đã đúng chưa".

---

## 0. Bức tranh tổng thể

```
                 Khách / studio (trình duyệt)
                   │                     │
     trang web, đăng nhập,        byte ảnh nặng (/api/img?raw=1):
     dashboard, API thường        watermark, xuất album, nén, quét AI
                   │                     │ (hỏng/quá 8 giây → quay lại Vercel)
                   ▼                     ▼
          ┌──────────────┐      ┌──────────────────────┐
          │    VERCEL    │      │  Cloudflare (CDN +   │
          │ mstudo.com   │      │  Tunnel) media.<...> │
          │ (giữ nguyên) │      └──────────┬───────────┘
          └──────┬───────┘                 │ đường hầm đi RA từ nhà,
                 │                         │ router KHÔNG mở cổng nào
                 ▼                         ▼
          ┌──────────────┐      ┌──────────────────────────────────┐
          │   Supabase   │◄─────│ MÁY Ở NHÀ (Docker)               │
          │ (dùng chung) │      │  app         : cùng mã Next.js   │
          └──────────────┘      │  cron        : quét khuôn mặt    │
                                │  zalo-worker : nghe Zalo 24/7    │
                                │  cloudflared : đường hầm         │
                                └──────────────────────────────────┘
```

- **Vercel vẫn là trang chính.** Mọi trang, đăng nhập, dashboard chạy như cũ.
- **Máy ở nhà chỉ gánh việc nặng**: đọc byte ảnh, quét khuôn mặt (CPU), worker
  Zalo (phải sống 24/7 — Vercel không làm được).
- **Máy ở nhà tắt thì trang vẫn chạy.** Trình duyệt hỏi máy nhà trước, không
  được thì tự quay về Vercel (chậm hơn một nhịp, không hỏng). Xem mục 12.
- Máy ở nhà **chỉ trả lời vài đường dẫn** (`/api/img`, `/api/file`,
  `/api/version`, `/api/cron/*`, `/api/inbox/ingest`). Mọi thứ khác — kể cả
  trang chủ và dashboard — là 404. Không ai vào được bảng điều khiển qua máy nhà.

---

## 1. Mua phần cứng (dưới 5 triệu cho máy)

| Món | Gợi ý | Ghi chú |
|---|---|---|
| Mini PC | **Intel N100** (Beelink Mini S12 Pro, GMKtec G3/NucBox…), **16 GB RAM**, **SSD NVMe 512 GB** | Khoảng 3,5–4,5 triệu (giá tham khảo, kiểm lại lúc mua). Ăn ~6–15 W — chạy 24/7 tốn ~10 k₫ điện/tháng. Chọn bản có **cổng LAN 2.5G/1G**. |
| UPS (bộ lưu điện) | 600–1000 VA (Santak, APC, Prolink…) | ~1–1,5 triệu, mua sau cũng được. Cắm **cả mini PC lẫn modem/router** vào UPS: mất điện ngắn thì không ai biết. |
| Dây mạng | Cáp LAN Cat5e/Cat6 | **Cắm dây, không dùng Wi-Fi** — ổn định hơn hẳn. |
| USB | ≥ 8 GB | Để cài Ubuntu. |

**Cài BIOS (làm một lần, trước khi cài Ubuntu):** bật máy, bấm `Del` (hoặc `F2`/`F7`)
liên tục để vào BIOS, tìm mục *Power* / *Chipset*:

- **Restore on AC Power Loss** (hoặc *State after G3*, *AC Recovery*) → **Power On**.
  Có điện lại là máy tự bật, Docker tự chạy lại mọi container.
- Nếu có *ErP* / *Deep Sleep* → **Disabled** (để tuỳ chọn trên có hiệu lực).

---

## 2. Cài Ubuntu Server 24.04 LTS

1. Trên máy tính thường: tải **Ubuntu Server 24.04 LTS** (ubuntu.com/download/server),
   ghi ra USB bằng **Rufus** (Windows) hoặc **balenaEtcher** (Mac).
2. Cắm USB + dây LAN vào mini PC, bật máy, bấm `F7`/`F11`/`F12` để chọn khởi động từ USB.
3. Trong trình cài:
   - Ngôn ngữ English, bàn phím English (US).
   - Mạng: để DHCP (tự nhận IP) — bước 4 sẽ cố định IP ở router.
   - Ổ đĩa: *Use an entire disk* → chọn SSD NVMe (xoá sạch Windows có sẵn).
   - Tạo tài khoản, vd tên `mstudo`. **Mật khẩu dài, đừng dùng lại mật khẩu khác.**
   - **Tick "Install OpenSSH server"** (quan trọng — để điều khiển từ xa).
   - Không chọn thêm snap nào.
4. Cài xong, rút USB, khởi động lại. Màn hình hiện `login:` là được. Gõ
   `ip a` để xem IP (dòng `inet 192.168.x.y` của cổng `enp…`).
5. **Cố định IP trên router** (để IP không đổi sau mỗi lần khởi động): vào trang
   quản trị router (thường `192.168.1.1`), mục *DHCP* / *Address Reservation* /
   *Static DHCP lease*, gán IP hiện tại cho địa chỉ MAC của mini PC.

Từ giờ không cần màn hình/bàn phím nữa — làm mọi thứ qua SSH từ máy tính của bạn:

```bash
ssh mstudo@192.168.1.50        # thay bằng IP của mini PC
```

### 2b. Đăng nhập bằng khoá SSH, tắt mật khẩu (nên làm)

Trên **máy tính của bạn** (không phải mini PC):

```bash
ssh-keygen -t ed25519                 # Enter liên tục nếu đã có khoá thì bỏ qua
ssh-copy-id mstudo@192.168.1.50       # nhập mật khẩu lần cuối
ssh mstudo@192.168.1.50               # phải vào được mà KHÔNG hỏi mật khẩu
```

Vào được rồi thì trên **mini PC**:

```bash
sudo sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
echo 'PasswordAuthentication no' | sudo tee /etc/ssh/sshd_config.d/99-chi-dung-khoa.conf
sudo systemctl restart ssh
```

> ⚠️ Mở một cửa sổ SSH **mới** để thử đăng nhập trước khi đóng cửa sổ cũ. Lỡ
> khoá mình ở ngoài thì cắm màn hình + bàn phím vào máy để sửa.

---

## 3. (Repo riêng tư) Cho máy quyền đọc repo

Bỏ qua nếu repo công khai. Nếu riêng tư, trên mini PC:

```bash
ssh-keygen -t ed25519 -C "mstudo-home" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub
```

Chép dòng in ra → GitHub → repo → **Settings → Deploy keys → Add deploy key**,
dán vào, **không** tick *Allow write access*. Rồi dùng địa chỉ SSH ở bước 4
(`git@github.com:<chủ>/<repo>.git`).

---

## 4. Chạy script cài đặt

Trên mini PC:

```bash
curl -fsSLO https://raw.githubusercontent.com/<chủ>/<repo>/main/deploy/home-server/cai-dat.sh
sudo bash cai-dat.sh https://github.com/<chủ>/<repo>.git main
```

(Repo riêng tư: tải `cai-dat.sh` bằng cách khác — vd chép qua `scp` — và dùng địa
chỉ `git@github.com:…`.)

Script tự làm: múi giờ Việt Nam, cập nhật hệ thống, **tự cài bản vá bảo mật**,
tường lửa (chặn mọi kết nối vào, chừa SSH), cài **Docker** từ kho chính thức,
clone repo vào `/opt/mstudo`, tạo file `.env`. Chạy lại bao nhiêu lần cũng được.

Xong thì **đăng xuất SSH và đăng nhập lại** (để dùng lệnh `docker` không cần `sudo`).

---

## 5. Tạo Cloudflare Tunnel

Tên miền đang để DNS ở Cloudflare nên làm hết trong trang Cloudflare:

1. Vào **one.dash.cloudflare.com** (Cloudflare Zero Trust). Lần đầu nó hỏi tạo
   team name và chọn gói — chọn **Free**.
2. **Networks → Tunnels → Create a tunnel** → chọn **Cloudflared** → đặt tên
   (vd `mstudo-nha`) → **Save tunnel**.
3. Màn *Install and run connector*: chọn **Docker**. Nó hiện một lệnh
   `docker run cloudflare/cloudflared:latest tunnel --no-autoupdate run --token eyJ...`.
   **Chỉ chép chuỗi dài sau `--token`** — đó là `TUNNEL_TOKEN`. **Không** chạy
   lệnh đó; docker compose sẽ chạy hộ.
4. **Next** → tab **Public Hostname** (hoặc *Published application routes*) → **Add**:
   - Subdomain: `media`
   - Domain: tên miền của bạn (vd `mstudo.com`)
   - Path: để trống
   - Service: Type **HTTP**, URL **`app:3000`**
   - **Save**.

   Cloudflare tự tạo bản ghi DNS `media` (CNAME → tunnel). Bản ghi cụ thể này
   **thắng** bản ghi wildcard `* → cname.vercel-dns.com` đang dùng cho tên miền
   phụ của studio, nên không đụng gì tới các studio khác. Nếu DNS **đã có sẵn**
   một bản ghi tên `media` thì xoá nó trước.

> `media` cũng đã được thêm vào danh sách tên miền phụ hệ thống
> (`RESERVED_SUBDOMAINS` trong `src/lib/hosts.ts`) nên không studio nào chọn
> được nó nữa. Nếu **trước đây** đã có studio lấy tên `media`, hãy đặt
> `MEDIA_HOST` thành tên khác (vd `anh.mstudo.com`) và đổi Public Hostname theo.

---

## 6. Điền biến môi trường

```bash
cd /opt/mstudo/deploy/home-server
nano .env
```

Quy tắc: **giá trị giống hệt bên Vercel** (Vercel → project → Settings →
Environment Variables → Production). Máy nhà và Vercel dùng chung Supabase,
chung `CRON_SECRET`, chung `INBOX_INGEST_SECRET`, chung `ZALO_SESSION_SECRET`.

Tối thiểu phải có: `TUNNEL_TOKEN` (bước 5), `MEDIA_HOST`, `NEXT_PUBLIC_MEDIA_ORIGIN`,
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_API_KEY`, `CRON_SECRET`,
`INBOX_INGEST_SECRET`, `ZALO_SESSION_SECRET`, `NEXT_PUBLIC_MAIN_HOST`.
Mỗi biến có chú thích tiếng Việt ngay trong file.

Lưu: `Ctrl+O`, `Enter`, `Ctrl+X`. File đã được khoá `chmod 600` (chỉ bạn đọc được).

> Khoá `GOOGLE_API_KEY` bị giới hạn theo **địa chỉ IP** (ít gặp)? Thêm IP nhà
> bạn vào danh sách. Giới hạn theo **HTTP referrer** thì không cần làm gì.

---

## 7. Dựng và chạy

```bash
cd /opt/mstudo/deploy/home-server
./cap-nhat.sh
```

Lần đầu mất **10–15 phút** trên N100 (tải Node, cài thư viện, dựng Next.js).
Script tự: soi biến môi trường, dựng image, chạy 4 container, chờ `app` khoẻ,
rồi gọi thử `https://media.<tên-miền>/api/version` qua Internet.

**Kiểm tra bằng điện thoại (tắt Wi-Fi, dùng 4G):** mở
`https://media.<tên-miền>/api/version` → phải thấy JSON có `"env":"home-server"`
và `"commit"` đúng commit mới nhất. Mở `https://media.<tên-miền>/` → phải là
**404** (đúng thiết kế: máy nhà không phục vụ trang).

---

## 8. Bật trên Vercel

Vercel → project → **Settings → Environment Variables → Add**:

| Key | Value | Environments |
|---|---|---|
| `NEXT_PUBLIC_MEDIA_ORIGIN` | `https://media.<tên-miền>` | Production (Preview tuỳ ý) |

Biến `NEXT_PUBLIC_*` được **nướng vào bản dựng** nên phải **dựng lại**:
Deployments → bản mới nhất → **⋯ → Redeploy** (hoặc đẩy một commit; workflow
`vercel-deploy.yml` dùng `vercel pull` nên tự lấy biến mới).

Kiểm tra: mở một album khách có watermark, bấm tải một ảnh; trong DevTools
(F12) → Network phải thấy request tới `media.<tên-miền>/api/img?…&raw=1`.

**Muốn tắt nhanh** (quay về như cũ): xoá biến này trên Vercel rồi Redeploy.

---

## 9. Chuyển quét khuôn mặt về nhà

GitHub → repo → **Settings → Secrets and variables → Actions → tab Variables →
New repository variable**: Name `FACE_SCAN_ON_HOME`, Value `true`.

Từ đó workflow *Quét khuôn mặt* trên GitHub ngừng chạy theo lịch (vẫn bấm chạy
tay được khi máy nhà tắt); container `cron` ở nhà quét mỗi 10 phút, mỗi lượt
tới 4 phút (`FACE_SCAN_BUDGET_MS=240000`) thay vì 45 giây.

Xem tiến độ: `docker compose logs -f cron`, hoặc đăng nhập rồi mở `/api/face-status`
trên trang chính.

Máy nhà tắt lâu? Xoá biến `FACE_SCAN_ON_HOME` (hoặc đặt `false`) — GitHub quét lại.

---

## 10. Cloudflare Cache Rule — giảm băng thông upload của nhà

Mỗi byte ảnh máy nhà gửi đi là băng thông **upload** của gói cáp quang (thường
nhỏ hơn download nhiều). `/api/img` đã gửi header cache rất dài
(`public, max-age=86400, s-maxage=31536000, immutable` — ảnh theo id + cỡ không
bao giờ đổi), nhưng Cloudflare **mặc định không cache đường dẫn không có đuôi
file** như `/api/img`. Thêm một luật:

Cloudflare dashboard → chọn tên miền → **Caching → Cache Rules → Create rule**:

- Rule name: `media img`
- **Custom filter expression**:
  - Hostname **equals** `media.<tên-miền>` **AND**
  - URI Path **equals** `/api/img`
- Then: **Eligible for cache**
  - Edge TTL: **Use cache-control header if present, bypass cache if not**
  - Browser TTL: **Respect origin TTL**
  - Cache key: giữ mặc định (có cả query string — `id`, `w`, `raw` là một phần của khoá, đúng ý)
- **Deploy**.

Từ đó ảnh đã có người tải một lần thì những lần sau Cloudflare phục vụ thẳng,
không chạm tới máy nhà. Lỗi (`502`) chỉ được giữ 60 giây (`s-maxage=60`).
Kiểm tra: tải cùng một URL hai lần, header `cf-cache-status` lần hai là `HIT`.

---

## 11. Dùng hằng ngày

Mọi lệnh chạy trong `/opt/mstudo/deploy/home-server`:

| Việc | Lệnh |
|---|---|
| Cập nhật lên mã mới nhất | `./cap-nhat.sh` |
| Trạng thái + sức khoẻ | `docker compose ps` |
| Log app (Ctrl+C để thoát) | `docker compose logs -f app` |
| Log quét khuôn mặt | `docker compose logs -f cron` |
| Log worker Zalo / tunnel | `docker compose logs -f zalo-worker` · `docker compose logs -f cloudflared` |
| Khởi động lại một container | `docker compose restart app` |
| Studio vừa nối Zalo cá nhân mới | `docker compose restart zalo-worker` |
| Dừng tất cả / chạy lại | `docker compose down` · `docker compose up -d` |
| Dung lượng ổ | `df -h /` · `docker system df` |
| RAM/CPU từng container | `docker stats` |

Các container có `restart: unless-stopped`: mất điện, khởi động lại máy, container
lỗi — Docker tự bật lại. Không cần systemd hay gì thêm.

---

## 12. Khi máy nhà TẮT thì sao?

| Tính năng | Khi máy nhà tắt |
|---|---|
| Xem album, đăng nhập, dashboard, mọi trang | **Không ảnh hưởng** (chạy trên Vercel) |
| Tải ảnh có watermark, xuất album in, nén ảnh Drive, lọc ảnh AI, tìm ảnh trùng | **Vẫn chạy** — trình duyệt thử máy nhà, Cloudflare báo lỗi ngay (hoặc quá 8 giây), tự quay về Vercel. Sau lần hỏng đầu, trình duyệt **nghỉ hỏi máy nhà 2 phút**. Byte lại đi qua Vercel như trước. |
| Quét khuôn mặt tự động | **Dừng** cho tới khi máy bật lại (tự làm tiếp phần còn lại). Tắt lâu: xoá biến `FACE_SCAN_ON_HOME` trên GitHub để GitHub quét thay. |
| Nhận tin Zalo cá nhân vào Hộp thư | **Dừng** — tin đến trong lúc tắt không vào Hộp thư (vẫn nằm trong Zalo). Gửi tin đi vẫn chạy (gửi từ Vercel). |
| Việc định kỳ hằng ngày (nhắc lịch, Zalo, dọn dẹp) | Không ảnh hưởng nếu vẫn để ở Vercel (mặc định). |

---

## 13. Việc định kỳ — cái nào chạy ở đâu

`vercel.json` khai 7 việc hằng ngày. Đánh giá:

| Việc | Nặng? | Chạy hai nơi có sao không | Mặc định |
|---|---|---|---|
| `face-scan` (mỗi 10 phút) | **Nặng CPU** (~11 phút CPU / album 800 ảnh) | Phí: hai nơi giành quét cùng những tấm ảnh — vì vậy có biến `FACE_SCAN_ON_HOME` (mục 9) | **Ở nhà** (`HOME_CRON_FACE_SCAN=true`) |
| `cleanup-proofs`, `cleanup-drive-cache`, `cleanup-wedding-photos` | Nhẹ CPU, nhưng **lâu** (khai `maxDuration=300`, gói Hobby cắt ở 60 giây) | **Vô hại** — xoá cái đã xoá thì không còn gì | Vercel. Bật thêm ở nhà: `HOME_CRON_CLEANUP=true` |
| `automations`, `reminders`, `zalo?only=money`, `zalo?only=work` | Nhẹ | **CÓ HẠI** — khách nhận email/Zalo **hai lần** | Vercel. Chỉ bật ở nhà (`HOME_CRON_DAILY=true`) **sau khi** tắt Cron Jobs trên Vercel (Settings → Cron Jobs → Disable) |

> Ghi chú trong `.github/workflows/quet-khuon-mat.yml` cho biết cron của Vercel
> **từng không chạy** trên project này (gói Hobby chỉ cho 2 cron/ngày, `vercel.json`
> khai 7). Nếu bạn xác nhận vậy (vào Vercel → Settings → Cron Jobs xem lần chạy
> gần nhất), thì máy nhà chính là cái đồng hồ đáng tin: tắt Cron Jobs trên Vercel
> rồi đặt `HOME_CRON_CLEANUP=true` và `HOME_CRON_DAILY=true`, chạy `./cap-nhat.sh`.

Lịch ở nhà nằm trong `cron/crontab` (giờ UTC, trùng từng dòng với `vercel.json`).

---

## 14. Bảo mật — đọc một lần

- **Không mở cổng nào** trên router (không port forwarding, không DMZ). Tunnel
  là kết nối đi ra; tường lửa `ufw` chặn mọi kết nối vào trừ SSH (và SSH chỉ
  vào được từ mạng nhà vì router không chuyển tiếp cổng 22).
- Container `app` không publish cổng (`expose` chứ không `ports`) — chỉ
  `cloudflared`, `cron`, `zalo-worker` trong mạng Docker nội bộ gọi được nó.
- **`.env` là chìa khoá toàn quyền vào database.** Không gửi qua Zalo/email,
  không commit, không chép lên USB rồi quên. Nó chỉ đi vào image dưới dạng
  *build secret* (không nằm lại trong image).
- **Chỉ đăng nhập SSH bằng khoá** (bước 2b).
- Muốn quản trị từ xa (ngoài nhà): dùng **Cloudflare Access** cho SSH hoặc
  Tailscale — **đừng** mở cổng 22 ra Internet.
- Bản vá bảo mật Ubuntu tự cài mỗi ngày. Bản vá **kernel** cần khởi động lại:
  thỉnh thoảng `sudo reboot` vào giờ vắng (container tự lên lại).
- Máy media trả `X-Robots-Tag: noindex` — Google không lập chỉ mục nó.
- CORS: `/api/img` trên máy media trả `Access-Control-Allow-Origin: *`. Đây là
  chủ ý: route này không đọc cookie, không phân quyền, chỉ tải ảnh Drive **công
  khai** theo id (ai có id đều tải được bằng curl, CORS hay không). `*` cho
  phép mọi tên miền riêng của studio dùng được, và không vỡ cache của Cloudflare
  (cache không tách theo `Origin`).

---

## 15. Mất điện / mất mạng — danh sách kiểm tra

**Mất điện:**
1. Có UPS: không cần làm gì với mất điện ngắn.
2. Mất lâu hơn pin UPS: máy tắt. Có điện lại → BIOS tự bật máy (mục 1) → Docker
   tự chạy 4 container. Chờ ~2 phút rồi mở `https://media.<tên-miền>/api/version`.
3. Không lên? SSH vào, `cd /opt/mstudo/deploy/home-server && docker compose ps`.
   Container nào không `Up` → `docker compose up -d`.

**Mất mạng (cáp quang đứt, modem treo):**
1. Trang chính vẫn chạy (mục 12). Không cần làm gì gấp.
2. Có mạng lại → `cloudflared` tự nối lại trong vài giây.
3. Lâu không nối lại → `docker compose restart cloudflared` rồi xem
   `docker compose logs --tail 50 cloudflared`.
4. Khởi động lại modem mà IP mini PC đổi? Không sao — tunnel không phụ thuộc IP.
   Chỉ SSH là phải dùng IP mới (nên làm bước cố định IP ở mục 2).

---

## 16. Gỡ lỗi nhanh

| Triệu chứng | Nguyên nhân hay gặp | Cách xử lý |
|---|---|---|
| `https://media.../api/version` báo lỗi 1033 / 530 | Tunnel không chạy | `docker compose logs cloudflared`; kiểm `TUNNEL_TOKEN` |
| Lỗi 502 Bad Gateway từ Cloudflare | Public Hostname sai URL | Service phải là `HTTP` + `app:3000` (không phải `localhost`) |
| `cap-nhat.sh` dừng ở "Soi biến môi trường" | Biến trong `.env` sai dạng / trống | Đọc dòng ❌, sửa `.env` |
| `cron` log `401` | `CRON_SECRET` trong `.env` khác Vercel/GitHub | Chép lại cho trùng, `./cap-nhat.sh` |
| `zalo-worker` log "Chưa studio nào nối kênh Zalo cá nhân" | Đúng — không có gì để nghe | Bình thường; nó thử lại mỗi 5 phút |
| `zalo-worker` log "chưa có phiên Zalo cá nhân hợp lệ" | `ZALO_SESSION_SECRET` khác Vercel | Chép lại cho trùng |
| Trình duyệt vẫn gọi `/api/img?raw=1` trên Vercel | Chưa Redeploy sau khi thêm `NEXT_PUBLIC_MEDIA_ORIGIN`, hoặc máy media vừa hỏng (trình duyệt nghỉ 2 phút) | Redeploy; tải lại trang |
| Dựng image hết RAM | `next build` cần ~4 GB | Dừng bớt: `docker compose stop app` rồi `./cap-nhat.sh` |

---

## 17. Cho người phát triển: cái gì đi máy media, cái gì ở lại

**Đi máy media trước** (helper `src/lib/media-origin.ts`, lùi về cùng miền khi hỏng):
mọi URL **cùng miền** `/api/img?…&raw=1` (kể cả `orig=1&raw=1`):

- `src/lib/download.ts` — tải ảnh có watermark (`loadMediaImage`)
- `AlbumEditor.tsx` `loadOriginal` — ảnh gốc khi xuất album in (`loadMediaImage`)
- `compress/ToolPanel.tsx` `getBlob` — nén/watermark ảnh Drive (`fetchMediaBytes`)
- `photo-ai-scan.ts` `fetchBlob` + `face-detect.ts` `decode` — dùng bởi
  `AiFilterPanel` (lọc ảnh AI) và `AlbumDuplicateFinder` (ảnh trùng) (`fetchMediaBytes`)
- `drive.ts` `retryViaProxy` — khung xem ảnh hỏng: Google → **máy media** → cùng miền
- `ZoomHiRes.tsx` — ảnh phóng to: chèn bản máy media ngay trước bản `raw=1`

**Ở lại cùng miền (Vercel), và vì sao:**

- `/api/img` **không** `raw=1` (ảnh hiển thị) và `dl=1`: chỉ là cú 302 sang
  Google, không byte nào qua Vercel — đổi miền chẳng tiết kiệm gì.
- `/api/file`: chỉ 302 sang Drive.
- `/api/upload`, `/api/upload/finalize`, `/api/album-designer/photos`… và mọi
  API có đăng nhập: cần cookie phiên — cookie không đi theo request khác miền
  với `credentials: "omit"`/`crossOrigin="anonymous"`.
- Ảnh tải bằng token Google Picker (`fetchDriveBytes`) và `fetchPublicDriveBytes`:
  đi thẳng Google, không qua máy chủ nào.

**Không có byte path nào cần cookie** trong danh sách trên: `/api/img` không đọc
cookie, không phân quyền, không có logic watermark phía máy chủ (watermark vẽ
trong trình duyệt), và chỉ đọc file Drive công khai bằng request ẩn danh.

**Hàng rào máy media** (thêm route mới cho máy media thì sửa CẢ HAI, test sẽ báo lệch):

- `src/lib/media-host.ts` → proxy (`src/proxy.ts`) chặn trang trên host media
  (và mọi host khi `MEDIA_ONLY=1`), xét **trước** nhánh tenant/tên miền riêng.
- `MEDIA_API_ALLOW` trong `next.config.mjs` → rewrite `/api/*` không được phép
  về `/api/media-chan` (404). Cần vì matcher của proxy bỏ qua `/api/*`.
- Kiểm: `npm run test:media-origin`.
