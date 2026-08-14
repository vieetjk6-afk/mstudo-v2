# Chuyển từ Vercel cũ sang Vercel mới

> ⛔ **File này đã cũ.** Bản đang dùng là
> [`chuyen-doi-mstudo-2.0.md`](./chuyen-doi-mstudo-2.0.md) (có thêm phần
> Cloudflare và phần chép dữ liệu). Trước đó hãy đọc
> [`cach-don-gian-nhat.md`](./cach-don-gian-nhat.md) để xem có cần dựng project
> Vercel mới không. Giữ file này chỉ để tham khảo.

Hướng dẫn dời **toàn bộ** phần đang chạy trên project Vercel cũ (mstudo bản
production) sang project Vercel mới của repo `mstudo-v2`: biến môi trường, tên
miền, cron, domain riêng của từng studio, và các nơi khai báo callback.

Thời gian: khoảng **60–90 phút** chuẩn bị + **2–5 phút** gián đoạn lúc cắt tên
miền. Làm được từng phần, dừng giữa chừng cũng không sao — chỉ bước 6 (cắt tên
miền) là "một phát ăn ngay".

> Dựng project Vercel mới từ số 0 (chưa có gì) thì xem
> [`docs/thiet-lap-moi.md`](./thiet-lap-moi.md) mục 2. Tài liệu này nói riêng
> việc **dời** từ project cũ sang.

---

## 0. Những gì KHÔNG nằm trong repo (nên phải dời tay)

| Thứ | Ở đâu trên Vercel cũ | Ghi chú |
|---|---|---|
| Biến môi trường | Settings → Environment Variables | Nhiều nhất, làm ở bước 2 |
| Tên miền + DNS | Settings → Domains | Gồm cả `*.mstudo.com` |
| Domain riêng của studio khách | Settings → Domains (do app tự thêm qua API) | Danh sách nằm trong DB, xem bước 6 |
| Cron | Tự sinh từ `vercel.json` | Project mới tự có sau lần deploy đầu |
| Region chạy hàm | Settings → Functions | Nên để **Singapore (sin1)** cho gần VN |
| Kết nối GitHub / secret deploy | Vercel GitHub App hoặc `.github/workflows/vercel-deploy.yml` | Bước 7 |

Còn code, cron schedule, security header… đã nằm trong repo nên tự sang theo.

---

## 1. Chuẩn bị (làm trước, không ảnh hưởng gì đang chạy)

```bash
npm i -g vercel
vercel login
```

Quyết định trước **một** việc: project mới dùng **Supabase nào**?

- **Dùng chung Supabase với bản cũ** → dữ liệu liền mạch, cắt sang là chạy tiếp.
  Nhưng trong lúc hai project cùng sống, **cron sẽ chạy hai lần** (nhắc khách 2
  tin Zalo, 2 email). Phải tắt cron bên cũ ngay sau khi cắt — xem bước 7.
- **Supabase mới** → an toàn tuyệt đối với bản cũ, nhưng phải chép dữ liệu sang
  (xem `docs/thiet-lap-moi.md` mục 3b) và người dùng đăng nhập trên bản mới sẽ
  không thấy dữ liệu phát sinh ở bản cũ sau thời điểm chép.

---

## 2. Chép biến môi trường sang project mới

### Cách nhanh (CLI)

```bash
# 1) Kéo biến của project CŨ về máy
mkdir -p ~/vc-old && cd ~/vc-old
vercel link                      # chọn team + project CŨ
vercel env pull .env.old --environment=production
```

`.env.old` giờ có toàn bộ biến production của bản cũ (**là file bí mật — đừng
commit, xong việc thì xoá**).

```bash
# 2) Nạp vào project MỚI
cd ~/mstudo-v2
vercel link                      # chọn team + project MỚI

# đọc từng dòng KEY=VALUE trong .env.old và thêm vào production
set -a; while IFS= read -r line; do
  case "$line" in ''|\#*) continue;; esac
  key=${line%%=*}
  val=${line#*=}
  val=$(printf '%s' "$val" | sed -e 's/^"//' -e 's/"$//')
  printf '%s' "$val" | vercel env add "$key" production --force
done < ~/vc-old/.env.old; set +a
```

Kiểm tra: `vercel env ls production` — số biến phải khớp bản cũ.

### Cách bấm tay (không cần CLI)

Vercel cũ → Settings → Environment Variables → từng biến bấm **⋯ → Copy value**,
rồi sang project mới → **Add New**. Chậm nhưng chắc. Ô "Add New" của Vercel dán
được **cả khối `KEY=VALUE` nhiều dòng** một lần — dán nguyên nội dung `.env.old`
vào đó là xong.

### Biến PHẢI sửa, không được copy nguyên

| Biến | Sửa thành |
|---|---|
| `NEXT_PUBLIC_MAIN_HOST` và các `*_HOST` khác | Để **trống** trong lúc chạy thử trên `*.vercel.app`; điền đúng tên miền ngay trước khi cắt (bước 6) |
| `GOOGLE_STORY_REDIRECT_URI` | `https://<miền-mới>/api/story/drive/callback` |
| `GOOGLE_ADMIN_DRIVE_REDIRECT_URI` | `https://<miền-mới>/api/admin/drive/callback` |
| `GOOGLE_STUDIO_DRIVE_REDIRECT_URI` | `https://<miền-mới>/api/studio/drive/callback` |
| `ZALO_OA_REDIRECT_URI` | `https://<miền-mới>/api/studio/zalo/oa/callback` |
| `VERCEL_PROJECT_ID` | **Project ID của project MỚI** (Settings → General). Quên đổi thì studio thêm domain riêng sẽ đăng ký nhầm vào project cũ |
| `VERCEL_TEAM_ID` | ID team chứa project mới (bỏ trống nếu là tài khoản cá nhân) |
| `VERCEL_TOKEN` | Nên tạo token mới (vercel.com/account/tokens) và thu hồi token cũ sau khi xong |
| `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY` | Chỉ đổi nếu dùng Supabase mới |
| `DRIVE_IMG_CACHE_BUCKET` | Nếu sang Supabase mới thì **để trống** — bucket cache ảnh là thứ đã làm vượt hạn mức Free bản cũ |

### Biến dễ quên nhất: `CRON_SECRET`

5 route `/api/cron/*` **fail-closed**: thiếu `CRON_SECRET` là trả 401 và mọi
nhắc lịch / dọn dẹp im lặng ngừng chạy. Biến này có trong project cũ nhưng
không nằm trong `.env.example`. Chép đúng giá trị đó sang (hoặc đặt chuỗi ngẫu
nhiên mới — Vercel tự gắn `Authorization: Bearer $CRON_SECRET` khi gọi cron).

---

## 3. Cho cấu hình project mới khớp bản cũ

Project mới → **Settings**:

- **General → Framework**: Next.js (tự nhận), Node.js **20.x**.
- **Functions → Function Region**: **Singapore (sin1)** — khác region thì mọi
  truy vấn Supabase chậm thêm ~200ms/lần.
- **Deployment Protection**: tắt cho Production (bật thì khách vào bị chặn),
  giữ cho Preview nếu muốn.
- **Crons**: sau lần deploy production đầu tiên phải thấy đủ 5 job của
  `vercel.json`. Gói Hobby chỉ cho cron chạy 1 lần/ngày — bản cũ nếu đang ở Pro
  thì project mới cũng nên ở Pro, không thì bớt job.

---

## 4. Khai báo callback ở nơi thứ ba

Làm **trước** khi cắt tên miền, và **giữ nguyên URI cũ** — hai bên cùng tồn tại
không xung đột, cắt xong mới xoá cái cũ.

**Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Web client:**

- *Authorized redirect URIs* — thêm 3 URI Drive + (nếu dùng) URI khác đã đặt ở
  bước 2, cả bản `*.vercel.app` đang chạy thử lẫn bản tên miền thật.
- *Authorized JavaScript origins* — thêm `https://<miền-mới>` và
  `https://<project>.vercel.app` (Google Picker của công cụ nén ảnh cần).

**Supabase → Authentication → URL Configuration:**

- *Site URL*: tên miền mới.
- *Redirect URLs*: thêm `https://<miền-mới>/auth/callback` và
  `https://<project>.vercel.app/auth/callback`.

**Zalo Developers → app → Redirect URI** (chỉ khi dùng kênh OA): thêm URI mới.

**Cloudflare Turnstile → widget → Domains**: thêm tên miền mới.

---

## 5. Deploy thử và kiểm tra trên `*.vercel.app`

```bash
cd ~/mstudo-v2
git push origin main      # hoặc: vercel --prod
```

Mở `https://<project>.vercel.app` và đi hết danh sách này:

- [ ] Đăng nhập được (email + mật khẩu, và Google nếu có bật).
- [ ] `/dashboard/studio` lên đủ sidebar, số liệu không rỗng bất thường.
- [ ] Mở một hợp đồng, một album — ảnh Drive hiện.
- [ ] Công cụ **Nén ảnh** mở được Google Picker (kiểm tra origin đã khai đúng).
- [ ] Chatbox trên trang chủ trả lời (biến `GEMINI_API_KEY` / `CHAT_PROVIDERS`).
- [ ] Cron: gọi thử một job bằng đúng secret —
      `curl -H "Authorization: Bearer $CRON_SECRET" https://<project>.vercel.app/api/cron/reminders`
      → phải trả JSON, không phải 401.

Chỉ khi mọi mục xanh mới sang bước 6.

---

## 6. Cắt tên miền (đây là lúc có gián đoạn)

**Một tên miền chỉ thuộc về đúng một project Vercel tại một thời điểm.** Cắt
sang là gỡ khỏi project cũ và thêm vào project mới — thao tác mất vài giây, tính
cả DNS lan truyền thì khoảng 2–5 phút.

**Hôm trước:** vào nhà cung cấp DNS hạ **TTL xuống 60 giây** cho các bản ghi của
`mstudo.com`. Có bước này thì lỡ phải quay đầu cũng nhanh.

**Liệt kê đủ domain phải dời.** Ngoài các miền hệ thống, còn domain riêng của
studio khách do app tự đăng ký — lấy danh sách bằng SQL Editor của Supabase:

```sql
select custom_domain, custom_domain_verified
from public.sites
where custom_domain is not null
order by custom_domain;
```

Danh sách đầy đủ thường gồm:

| Domain | Vai trò |
|---|---|
| `mstudo.com` | Trang chính + khu quản lý studio |
| `www.mstudo.com` | Chuyển hướng về apex (middleware lo) |
| `*.mstudo.com` | Website riêng của từng studio (`<sub>.mstudo.com`) |
| `album.` `img.` `admin.` `thiep.` | Các miền phụ nếu đang tách |
| domain riêng của studio | Kết quả câu SQL ở trên |

**Thứ tự thao tác:**

1. Sửa các biến `NEXT_PUBLIC_*_HOST` ở project mới cho đúng tên miền thật
   (`NEXT_PUBLIC_MAIN_HOST=mstudo.com`…), rồi **Redeploy** để biến ăn vào bản
   build. Biến `NEXT_PUBLIC_*` được nhúng lúc build, không đổi lúc chạy.
2. Vercel cũ → Settings → Domains → gỡ (`Remove`) từng domain. Nếu hai project
   cùng một tài khoản/team, có thể bỏ qua bước gỡ: thêm thẳng bên project mới,
   Vercel sẽ hỏi **"Move domain?"** → xác nhận là xong.
3. Vercel mới → Settings → Domains → **Add** lần lượt từng domain ở bảng trên.
4. DNS: làm **đúng theo giá trị Vercel hiển thị** ngay trong tab Domains (bản
   ghi A/CNAME của Vercel có đổi theo thời gian, đừng chép số từ tài liệu cũ).
   Nếu DNS vẫn trỏ đúng như khi chạy project cũ thì thường **không phải sửa gì**
   — chỉ cần domain đã được nhận ở project mới.
5. `*.mstudo.com`: domain wildcard cần thêm bản ghi **TXT `_vercel`** để xác
   minh, trừ khi tên miền đang dùng nameserver của Vercel. Vercel hiện đúng giá
   trị TXT cần thêm.
6. Chờ mỗi domain chuyển sang **Valid Configuration** và cấp xong chứng chỉ
   HTTPS (thường < 1 phút).

**Kiểm ngay sau khi cắt:**

- [ ] `https://mstudo.com` lên trang chủ, `https://www.mstudo.com` tự về apex.
- [ ] Đăng nhập rồi **F5 vẫn còn đăng nhập** (cookie `.mstudo.com` — sai
      `NEXT_PUBLIC_MAIN_HOST` là dính lỗi "đăng nhập xong bị đá về /login").
- [ ] Một website studio `<sub>.mstudo.com` và một domain riêng của khách mở được.
- [ ] Kết nối Google Drive trong Cài đặt chạy hết vòng OAuth (không
      `redirect_uri_mismatch`).

---

## 7. Dọn dẹp project cũ (làm ngay trong ngày)

1. **Tắt cron bên cũ** — quan trọng nhất nếu hai project dùng chung Supabase.
   Cách chắc nhất: Vercel cũ → Settings → **Pause Project** (dừng cả cron lẫn
   traffic, giữ nguyên dữ liệu để còn quay đầu được).
2. **Đổi secret deploy trong GitHub** (repo → Settings → Secrets and variables →
   Actions): `VERCEL_PROJECT_ID`, `VERCEL_ORG_ID`, `VERCEL_TOKEN` trỏ sang
   project mới. Không đổi thì workflow `vercel-deploy.yml` vẫn deploy vào
   project cũ. *(Hoặc: cài Vercel GitHub App cho repo mới, để Vercel tự build
   khi push, rồi xoá luôn file workflow đó.)*
3. Nếu bản cũ còn phải sống song song một thời gian, **đừng dùng chung
   `CRON_SECRET`/token** để không lẫn.
4. Sau 7 ngày chạy êm: xoá project Vercel cũ, thu hồi `VERCEL_TOKEN` cũ, xoá các
   redirect URI cũ trong Google Cloud Console và Supabase.
5. Xoá file `.env.old` đã kéo về ở bước 2.

---

## 8. Quay đầu khi có sự cố

Code và database không đổi, nên quay đầu chỉ là đảo lại bước 6: gỡ domain khỏi
project mới → thêm lại vào project cũ → bỏ Pause. TTL 60 giây nên khách thấy lại
bản cũ trong vòng một phút. Vì vậy: **đừng xoá project cũ sớm**.
