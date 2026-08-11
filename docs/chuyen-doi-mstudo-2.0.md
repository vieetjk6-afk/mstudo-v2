# Chuyển mstudo sang bản 2.0 — hướng dẫn đầy đủ

Đây là **tài liệu chính thức** cho đợt chuyển đổi. Làm theo đúng thứ tự trong
file này là đủ, không cần mở file nào khác.

Việc cần làm: đưa `mstudo.com` từ **Vercel cũ + Supabase cũ** (repo
`vieetjk01/Studio`) sang **Vercel mới + Supabase mới + GitHub mới** (repo này,
nhánh `main`), đồng thời chuyển tên miền về **Cloudflare** quản lý DNS.

## Những gì đã chốt

- Code bản cũ (12 commit ngày 07/08) **đã gộp xong** vào `main`. Không còn gì
  phải gộp nữa.
- Supabase mới đang chứa **một bản chép cũ** của dữ liệu thật, tạo lúc dựng giao
  diện 2.0. Bản chép đó bỏ được — sẽ chép đè bằng dữ liệu mới nhất.
- Tên miền giữ nguyên `mstudo.com`, nên **mọi link đã gửi khách vẫn chạy**.
- **Không có nút quay về giao diện 1.0.** Nút chuyển phiên bản và cờ `webapp_v2`
  đã được gỡ khỏi code: mọi studio dùng giao diện 2.0. Đường lùi duy nhất là
  đường lùi hạ tầng ở Phần D (trỏ tên miền về Vercel cũ), không phải nút bấm
  cho từng người dùng.

## Thời gian

| Phần | Nội dung | Thời lượng | Gián đoạn |
|---|---|---|---|
| **0** | Đưa tên miền về Cloudflare | ~30 phút + chờ 2–24h | Không |
| **A** | Chuẩn bị môi trường mới | ~90 phút, làm rải rác | Không |
| **B** | Đêm cắt: chép dữ liệu + đổi DNS | 60–120 phút liền mạch | **Có** |
| **C** | Kiểm tra & dọn dẹp | ~30 phút | Không |
| **D** | Đường lùi | khi có sự cố | — |

Phần 0 phải xong **trước** Phần B ít nhất một ngày. Phần A làm lúc nào cũng
được. Chỉ vào Phần B khi A đã kiểm tra sạch.

## Quy ước

`CŨ` = project/tài khoản đang chạy production. `MỚI` = môi trường 2.0. Mọi câu
SQL chạy ở **Supabase → SQL Editor**.

---

## Bảng tra nhanh: chuẩn bị sẵn trước khi bắt đầu

Mở một file nháp (**đừng commit**) và điền đủ:

| Cần | Lấy ở đâu | Dùng ở bước |
|---|---|---|
| Mã project Supabase CŨ | Supabase CŨ → Settings → API → Project URL, phần trước `.supabase.co` | B4, B7 |
| Mã project Supabase MỚI | Supabase MỚI → Settings → API → Project URL | B7 |
| Host pooler CŨ | Supabase CŨ → Settings → Database → Connection string → tab **Session pooler** | B4 |
| User pooler CŨ | cùng chỗ, dạng `postgres.<mã-project-cũ>` | B4 |
| Mật khẩu database CŨ | lưu lúc tạo project; quên thì Settings → Database → Reset password | B4 |
| 3 khoá Supabase MỚI | Settings → API: Project URL · `anon public` · `service_role` | A3 |
| Toàn bộ biến môi trường CŨ | Vercel CŨ → Settings → Environment Variables | A3 |
| Tài khoản đăng ký tên miền | nơi bạn mua `mstudo.com` (để đổi nameserver) | 0.2 |

> ⚠️ Reset mật khẩu database ở project CŨ **không** làm production sập — app
> dùng khoá API chứ không dùng mật khẩu DB. Cứ reset nếu quên.

> 🔒 Bốn thứ sau là **bí mật máy chủ**, không bao giờ để lộ ra trình duyệt và
> không commit: `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_CLIENT_SECRET`,
> `ZALO_OA_APP_SECRET`, `CRON_SECRET`. Nếu bạn kéo biến về máy thành `.env.old`
> thì xoá file đó ngay sau khi dùng xong.

---

# PHẦN 0 — Đưa tên miền về Cloudflare

Làm phần này **sớm, tách hẳn khỏi đêm cắt**, và làm sao cho **không có gì thay
đổi với người dùng**. Nguyên tắc: chuyển nhà cung cấp DNS trước, giữ nguyên mọi
bản ghi đang có; đổi đích trỏ về Vercel mới để dành cho Phần B.

Gộp hai việc này vào một đêm là cách nhanh nhất để không biết cái nào hỏng.

## 0.1. Thêm domain vào Cloudflare

1. Đăng ký/đăng nhập Cloudflare → **Add a site** → nhập `mstudo.com` → chọn gói
   **Free**.
2. Cloudflare tự quét và nhập sẵn các bản ghi DNS hiện có. **Đối chiếu từng
   dòng** với bảng DNS ở nhà cung cấp cũ.
3. Kiểm tra kỹ 3 nhóm sau — quét tự động hay sót:
   - **MX** và các bản ghi liên quan email (`SPF`/`TXT`, `DKIM`, `_dmarc`).
     **Sót MX là mất email của tên miền.** Nếu bạn dùng email
     `@mstudo.com` thì đây là rủi ro lớn nhất của cả Phần 0.
   - **TXT xác minh**: Google Search Console, xác minh domain của Vercel…
   - Các subdomain đang chạy: `img`, `admin`, `thiep`, và **wildcard `*`** nếu
     bạn đã dùng subdomain riêng cho từng studio.
4. Thiếu dòng nào thì thêm tay cho khớp **y hệt** bên cũ.

Ở bước này **đừng đổi đích trỏ** của bản ghi nào cả. Mục tiêu là Cloudflare phục
vụ DNS giống hệt nhà cung cấp cũ.

## 0.2. Đổi nameserver ở nơi đăng ký tên miền

Cloudflare cho bạn 2 nameserver dạng `xxx.ns.cloudflare.com`. Vào nơi bạn mua
`mstudo.com` → phần Nameservers → thay 2 dòng đó vào.

Lan truyền thường 2–6 giờ, có thể tới 24 giờ. Cloudflare gửi email khi xong và
trạng thái site chuyển sang **Active**.

## 0.3. Kiểm tra trước khi đi tiếp

Chỉ đi tiếp khi cả 3 điều này đúng:

- Cloudflare báo site **Active**.
- `mstudo.com` vẫn mở bình thường (vẫn đang chạy bản cũ — đúng như mong đợi).
- Email `@mstudo.com` vẫn gửi/nhận được, nếu bạn có dùng.

## 0.4. Cấu hình SSL — chỗ hay làm sập nhất

Cloudflare → **SSL/TLS** → **Overview** → chọn **Full (strict)**.

Đây không phải tuỳ chọn cho vui. Chế độ mặc định **Flexible** nối trình duyệt →
Cloudflare bằng HTTPS nhưng Cloudflare → Vercel bằng HTTP, trong khi Vercel luôn
ép HTTPS. Hai bên đẩy qua đẩy lại và trang chết với lỗi
**`ERR_TOO_MANY_REDIRECTS`**. Đặt **Full (strict)** là hết.

## 0.5. Đám mây cam hay đám mây xám?

Mỗi bản ghi DNS ở Cloudflare có một biểu tượng đám mây:

- 🟠 **Proxied** (cam) — traffic đi qua Cloudflare: có CDN, chống DDoS, giấu IP.
- ⚪ **DNS only** (xám) — Cloudflare chỉ trả lời DNS, traffic đi thẳng Vercel.

**Trong lúc thiết lập, để XÁM.** Vercel cần tự cấp chứng chỉ HTTPS cho tên miền,
và quá trình xác minh đó bị đám mây cam chặn — biểu hiện là Vercel treo ở
**"Failed to Generate Cert"**. Cấp chứng chỉ xong rồi, muốn bật cam thì bật, với
điều kiện SSL đã ở **Full (strict)** theo bước 0.4.

Lời khuyên: **cứ để xám**. Vercel đã có CDN riêng; thêm một lớp proxy nữa chỉ
thêm chỗ để hỏng, mà lợi ích với ứng dụng này gần như không có.

## 0.6. Wildcard cho subdomain của từng studio

App phục vụ website của mỗi studio ở `<tên-studio>.mstudo.com`, nên cần một bản
ghi wildcard:

```
Type: CNAME    Name: *    Target: <giá trị Vercel hiển thị>    Proxy: DNS only
```

Hai điều cần biết:

- Chứng chỉ **Universal SSL** miễn phí của Cloudflare phủ `mstudo.com` và **một
  cấp** subdomain (`*.mstudo.com`) — vừa đủ cho `abc.mstudo.com`. Nó **không**
  phủ subdomain nhiều cấp như `abc.xyz.mstudo.com`. May là app cũng không dùng:
  middleware bỏ qua mọi subdomain có dấu chấm bên trong.
- Bản ghi wildcard **proxy được** ở mọi gói Cloudflare, kể cả Free. Nhưng theo
  bước 0.5 thì cứ để xám.

## 0.7. Đừng đặt redirect ở Cloudflare

App **tự** chuyển `www.mstudo.com` → `mstudo.com` trong middleware. Nếu bạn thêm
một Page Rule / Redirect Rule ở Cloudflare chuyển ngược lại (apex → www), hai bên
sẽ đá nhau vô hạn và trang chết. Để phần chuyển hướng cho app lo.

---

# PHẦN A — Chuẩn bị môi trường mới (không gián đoạn)

Bản cũ vẫn chạy bình thường suốt phần này.

## A1. Xem Supabase MỚI đang có gì

> ⚠️ **Kiểm tra đang mở đúng project trước khi bấm Run.** Hai project trông y
> hệt nhau trong SQL Editor, và vì đích đã từng được chép dữ liệu nên **cả hai
> đều đầy tên khách thật** — nhìn dữ liệu không phân biệt được. Cách chắc chắn
> duy nhất là thanh địa chỉ:
> `supabase.com/dashboard/project/`**`<mã-project>`**, phải khớp Project URL của
> Supabase MỚI (Settings → API).

1. Supabase **MỚI** → SQL Editor → New query.
2. Dán toàn bộ [`supabase/kiem-tra-truoc-khi-chep.sql`](../supabase/kiem-tra-truoc-khi-chep.sql) → Run.
3. Đọc tab **Messages** (không phải Results), từ trên xuống:

   - Danh sách `public.<bảng> — dòng mới nhất: …` rồi
     `DỮ LIỆU MỚI NHẤT Ở PROJECT NÀY`. Bản cũ vẫn phục vụ khách nên luôn có dòng
     của hôm nay; **bản chép thì đứng yên từ ngày chép**. Mốc này là hôm nay →
     bạn đang ở project CŨ, đóng tab lại.
   - **Quan trọng nhất:** soi từng bảng xem **có bảng nào mới hơn ngày chép**
     không. Có nghĩa là đã có việc thật làm trên bản 2.0 sau lần chép đó — phần
     đó sẽ mất khi chép đè. Xử lý xong mới đi tiếp.
   - `URL ảnh đang trỏ về project: …` — chỉ để biết bước **B7b** đã chạy chưa.
     Sau khi chép mà chưa chạy B7b thì mã ở đây vẫn là mã project **cũ**; đó là
     bình thường, **không** phải dấu hiệu đứng nhầm project.
   - `TRỐNG — chép được` hoặc `CÓ DỮ LIỆU: N dòng`.

4. Bảng bucket cuối cùng (`bucket` / `so_file`) — **chụp lại**, bước B7a cần để
   đối chiếu.

Thấy tên khách thật ở đích đừng vội hoảng: nếu đó là bản bạn chép hồi dựng v2
thì bỏ được. Chỉ dừng lại khi có bảng mang dữ liệu tạo **sau** ngày chép.

## A2. Cập nhật schema Supabase MỚI

**Phải làm kể cả khi đã chạy trước đây.** Tuần cuối bản cũ thêm 2 cột; thiếu
chúng thì bước chép sẽ bỏ qua đúng 2 cột đó, mất dữ liệu mà không báo lỗi.

1. Supabase MỚI → SQL Editor → dán toàn bộ
   [`supabase/setup-all.sql`](../supabase/setup-all.sql) → Run.
2. Xác nhận 2 cột đã có:

```sql
select
  (select count(*) from information_schema.columns
    where table_schema='public' and table_name='studio_notifications' and column_name='album_id') as album_id,
  (select count(*) from information_schema.columns
    where table_schema='public' and table_name='studio_drive' and column_name='filter_refresh_token') as filter_token;
```

Cả hai phải ra `1`.

> An toàn khi chạy lại: `setup-all.sql` không có `drop table`, `truncate` hay
> `delete` nào. Nó chỉ drop rồi tạo lại trigger/policy, và dòng
> `insert into site_settings … on conflict do nothing` nên **không đè** cấu hình
> bạn đã sửa trong quản trị.

## A3. Biến môi trường cho Vercel MỚI

> 📖 **Bảng tra từng biến** — công dụng, cách lấy giá trị, thêm ở đâu, biến nào
> phải bỏ: [`bien-moi-truong.md`](./bien-moi-truong.md). Mục dưới đây chỉ tóm
> tắt; khi ngồi làm thật thì mở file kia.

Phần lớn copy nguyên từ Vercel cũ, nhưng có một nhóm bắt buộc phải sửa — copy
nhầm thì bản mới vẫn ghi vào Supabase cũ, hỏng âm thầm. Ngoài ra có nhóm **phải
bỏ đi** (Vercel tự tiêm) và nhóm **phải tạo mới** (`CRON_SECRET`).

### Kéo biến từ Vercel CŨ

Có hai cách. Cách nào cũng được, chọn theo việc bạn có muốn cài Node.js không.

#### Cách 1 — không cần cài gì

Vercel CŨ → project → Settings → Environment Variables. Bấm vào từng biến để
hiện giá trị rồi copy. 36 biến nên hơi lâu, nhưng không phải cài phần mềm nào.

#### Cách 2 — CLI, lấy cả gói một lần

**Chạy ở đâu:** trên **máy tính của bạn** — Mac mở **Terminal**, Windows mở
**PowerShell**. Không chạy được trong trình duyệt hay trong SQL Editor của
Supabase; CLI cần mở trình duyệt để bạn đăng nhập Vercel.

**Cần có Node.js.** Gõ `node -v`; ra số phiên bản là được, báo *not found* thì
cài ở [nodejs.org](https://nodejs.org) rồi mở lại cửa sổ terminal.

```bash
cd ~
mkdir vc-old
cd vc-old
npx vercel login                                    # mở trình duyệt để đăng nhập
npx vercel link                                     # Link to existing project → chọn project CŨ
npx vercel env pull .env.old --environment=production
```

`vc-old` chỉ là thư mục trống để `vercel link` bám vào — không cần source code
trong đó. Xong, file `.env.old` nằm ngay trong thư mục ấy, mở bằng
Notepad/TextEdit là đọc được.

> ⚠️ **Windows: đừng mở PowerShell bằng "Run as Administrator".** Khi đó cửa sổ
> đứng ở `C:\Windows\System32`, Windows chặn ghi vào đấy và `vercel link` chết
> với `EPERM: operation not permitted, mkdir '.vercel'`; lệnh `env pull` ngay sau
> đó báo *"Your codebase isn't linked to a project"*. Dòng `cd ~` ở đầu khối trên
> đưa bạn về `C:\Users\<tên>` nên tránh được — nhưng cứ mở PowerShell bình thường
> cho chắc.

`vercel link` hỏi ba câu: *Set up …?* → **Y**; *Link to existing project?* →
**Y**; *name of your existing project?* → tên project CŨ.

> 🔒 `.env.old` chứa toàn bộ khoá bí mật. **Không commit, không gửi cho ai, xoá
> ngay sau khi nạp xong sang Vercel mới.**

### Nạp vào Vercel MỚI

Vercel MỚI → project → Settings → Environment Variables → thêm từng biến, tick
đủ **Production + Preview + Development**.

### Những biến BẮT BUỘC phải sửa

| Biến | Giá trị mới |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL của Supabase **MỚI** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | khoá `anon public` của Supabase **MỚI** |
| `SUPABASE_SERVICE_ROLE_KEY` | khoá `service_role` của Supabase **MỚI** |
| `GOOGLE_ADMIN_DRIVE_REDIRECT_URI` | đổi host sang tên miền/URL bản mới |
| `GOOGLE_FILTER_DRIVE_REDIRECT_URI` | như trên |
| `GOOGLE_STORY_REDIRECT_URI` | như trên |
| `GOOGLE_STUDIO_DRIVE_REDIRECT_URI` | như trên |
| `ZALO_OA_REDIRECT_URI` | như trên |

Bốn biến `NEXT_PUBLIC_*_HOST` (`MAIN`, `IMG`, `ADMIN`, `THIEP`) giữ nguyên giá
trị như bản cũ, vì tên miền không đổi. `NEXT_PUBLIC_APP_HOST` đã ngừng dùng.

### Biến dễ quên nhất: `CRON_SECRET`

Bỏ trống thì **cả 5 cron trả 401 và im lặng ngừng chạy** — không có thông báo
lỗi nào. Những việc sau sẽ chết âm thầm:

| Cron | Lịch | Việc |
|---|---|---|
| `/api/cron/reminders` | `0 0 * * *` | nhắc lịch chụp |
| `/api/cron/zalo` | `0 4 * * *` | gửi tin Zalo |
| `/api/cron/cleanup-proofs` | `30 1 * * *` | dọn ảnh chuyển khoản |
| `/api/cron/cleanup-drive-cache` | `0 3 * * *` | dọn cache ảnh |
| `/api/cron/cleanup-wedding-photos` | `0 2 * * 0` | dọn ảnh cưới |

Đặt một chuỗi ngẫu nhiên dài, giữ bí mật. Có thể dùng lại đúng giá trị bên cũ.

### ⚠️ Sau khi khai biến phải Redeploy

Mọi biến `NEXT_PUBLIC_*` được **nướng vào lúc build**. Khai xong mà không deploy
lại thì app vẫn chạy với giá trị cũ. Vercel → Deployments → deployment mới nhất
→ **Redeploy**.

Đây là lỗi đã xảy ra một lần rồi: thiếu 2 biến Supabase làm `mstudo-v2.vercel.app`
trả 500 toàn site.

> ⚠️ Bấm Redeploy mà Vercel báo *"Prebuilt deployments cannot be redeployed"*:
> bản đang chạy được tạo bằng `vercel deploy --prebuilt`, tức build sẵn ở nơi
> khác rồi tải lên dạng thành phẩm — biến cũ đã nằm sẵn trong đó nên Vercel từ
> chối dùng lại. Phải tạo bản deploy **mới**, build trên máy chủ Vercel:
>
> - **Project nối GitHub** (Settings → Git có hiện repo): đẩy một commit lên
>   `main`, Vercel tự build. Cách này sạch nhất — về sau chỉ cần push.
> - **Từ giao diện**: Deployments → chọn bản có biểu tượng nhánh Git (không phải
>   bản CLI) → `⋯` → Redeploy.
> - **Từ máy bạn**: `npx vercel --prod` trong một bản clone của repo — **không
>   kèm** `--prebuilt`, có cờ đó là lặp lại đúng vấn đề.

## A4. Khai lại callback ở bên thứ ba

Đăng nhập Google và các kết nối Drive sẽ **không chạy** nếu thiếu bước này.

### Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Web client

Vì tên miền **không đổi**, phần lớn khai báo cũ dùng lại được nguyên. Chỉ có
đúng một dòng bắt buộc phải thêm.

**Dùng lại, không đụng gì:**

- 4 URI Drive/Story (`GOOGLE_ADMIN_DRIVE_REDIRECT_URI`,
  `GOOGLE_FILTER_DRIVE_REDIRECT_URI`, `GOOGLE_STORY_REDIRECT_URI`,
  `GOOGLE_STUDIO_DRIVE_REDIRECT_URI`) — cùng `mstudo.com`, cùng đường dẫn.
- **Authorized JavaScript origins**: `https://mstudo.com` giữ nguyên.
- **Client ID / Client Secret**: phải là **đúng cặp cũ**. Dùng cặp khác thì
  Supabase coi người đăng nhập là người lạ và tạo tài khoản mới.

**Bắt buộc thêm mới — Authorized redirect URIs:**

```
https://<mã-project-MỚI>.supabase.co/auth/v1/callback
```

Đăng nhập Google đi qua `supabase.auth.signInWithOAuth`, nên Google chuyển hướng
về **Supabase** chứ không về `mstudo.com` — mà mã project Supabase thì đổi. Lấy
nguyên văn ở Supabase MỚI → Authentication → Providers → Google (ô **Callback
URL**), copy dán chứ đừng gõ tay.

Thiếu dòng này là đăng nhập Google báo `redirect_uri_mismatch`, **không ai vào
được app**. Giữ nguyên dòng callback của Supabase **cũ** cho tới khi cắt xong.

**Kiểm tra thêm:** `GOOGLE_FILTER_DRIVE_REDIRECT_URI`
(`/api/filter/drive/callback`) là tính năng mới của đợt gộp code. Bản cũ đã chạy
tính năng đó thì URI có sẵn rồi; chưa có thì thêm vào.

**Nếu muốn test trên `*.vercel.app` trước khi cắt:** thêm
`https://<tên>.vercel.app` vào **Authorized JavaScript origins** — chỉ cần cho
Google Picker ở công cụ nén ảnh. Việc đăng nhập thì không cần, vì Google chỉ
nhìn thấy callback của Supabase.

### Supabase MỚI → Authentication → URL Configuration

- **Site URL**: `https://mstudo.com`
- **Redirect URLs**: thêm `https://mstudo.com/**` và, nếu còn đang test,
  `https://<tên>.vercel.app/**`.

Đây mới là nơi kiểm soát tham số `redirectTo` mà app gửi lên
(`window.location.origin/auth/callback`) — không phải bên Google. Đang test trên
`*.vercel.app` mà quên thêm ở đây thì đăng nhập xong bị Supabase chặn ở bước
quay về.

### Supabase MỚI → Authentication → Providers → Google

Bật, điền Client ID + Client Secret giống bản cũ. Copy **Callback URL** mà
Supabase hiện ra, dán vào Authorized redirect URIs ở Google Cloud Console.

### Zalo Developers → app → Redirect URI

Thêm giá trị `ZALO_OA_REDIRECT_URI` mới.

### Cloudflare Turnstile → widget → Domains

Thêm `mstudo.com` và domain `*.vercel.app` của bản mới.

## A5. Chạy thử việc chép dữ liệu

Đừng để đêm cắt là lần đầu chạy script. Chạy thử **PHẦN 1** của
[`supabase/clone-from-old-project.sql`](../supabase/clone-from-old-project.sql)
trên Supabase MỚI: nó chỉ tạo kết nối sang project cũ, chưa xoá gì cả. Chạy
được là mật khẩu/host pooler đúng — đêm cắt sẽ nhẹ nhàng.

## A6. Cấu hình project Vercel MỚI

- **Region**: Settings → Functions → chọn **Singapore (sin1)**. Khách ở Việt
  Nam, để region Mỹ là mỗi request cõng thêm ~200ms.
- **Node version**: giống bản cũ.
- **Build command / Output**: để mặc định Next.js.
- **Cron**: `vercel.json` trong repo đã khai đủ 5 cron, không cần bấm gì thêm —
  nhưng nhớ `CRON_SECRET` ở A3.

## A7. Deploy và kiểm tra trên `*.vercel.app`

Kiểm tra hết bảng này **trước khi động vào tên miền**. Ở giai đoạn này Supabase
mới vẫn đang giữ bản chép cũ, đủ để test mọi luồng.

- [ ] Mở trang chủ — không lỗi 500
- [ ] Đăng nhập bằng Google
- [ ] Đăng nhập bằng email/mật khẩu
- [ ] Vào Tổng quan studio, số liệu hiện đúng
- [ ] Mở một hợp đồng, in thử PDF
- [ ] Tạo báo giá nháp rồi xoá
- [ ] Mở lịch làm việc
- [ ] Mở một album, xem ảnh có hiện không
- [ ] Mở link khách chọn ảnh `/a/<slug>`
- [ ] Thử chọn vài ảnh với tư cách khách
- [ ] Vào Công cụ ảnh → nén ảnh
- [ ] Vào Website & chatbox → trình dựng trang
- [ ] Đổi một cài đặt trong quản trị rồi kiểm tra nó hiện ra ngoài

Có mục nào hỏng thì **dừng**, sửa xong mới sang Phần B.

---

# PHẦN B — Đêm cắt (có gián đoạn)

Chọn khung giờ vắng khách. Làm liền mạch, đừng chia hai buổi.

## B1. Hôm trước: hạ TTL

Cloudflare → DNS → các bản ghi của `mstudo.com` → đặt **TTL = Auto** (Cloudflare
Auto tương đương 300 giây, đủ nhanh).

Nếu bản ghi đang để 🟠 Proxied thì TTL không có ý nghĩa — Cloudflare tự xử lý,
đổi đích có hiệu lực gần như tức thì. Đây là một lợi thế thật của việc đã chuyển
sang Cloudflare ở Phần 0.

## B2. Báo dừng nhập liệu

Nhắn cho các studio: từ giờ tới khi có thông báo, **đừng tạo/sửa gì** — hợp
đồng, album, thu tiền. Việc làm trong khoảng này sẽ mất.

## B3. Khoá bản cũ lại

Vercel CŨ → project → Settings → **Pause project** (hoặc bật Password
Protection). Đây là cách chắc chắn nhất để không ai ghi thêm dữ liệu vào Supabase
cũ trong lúc bạn đang chép.

Bỏ qua bước này là rước rủi ro: một studio lưu hợp đồng lúc 1h sáng, sau khi
bạn đã chép xong bảng đó — dữ liệu đó biến mất và không ai biết.

## B4. Nối Supabase MỚI sang CŨ (PHẦN 1 của script chép)

Mở [`supabase/clone-from-old-project.sql`](../supabase/clone-from-old-project.sql),
sửa **3 giá trị** có đánh dấu ⬅️ ở PHẦN 1:

| Giá trị | Lấy ở đâu |
|---|---|
| host pooler | Supabase CŨ → Settings → Database → **Session pooler** |
| user | `postgres.<mã-project-cũ>` |
| mật khẩu | mật khẩu database project CŨ |

> ⚠️ Phải dùng host **Session pooler**, không dùng `db.xxx.supabase.co`. Host
> `db.` chỉ có IPv6, mà Supabase không kết nối ra IPv6 được → treo rồi timeout.

Chạy PHẦN 1 trên Supabase **MỚI**.

| Lỗi | Nguyên nhân |
|---|---|
| `password authentication failed` | sai mật khẩu, hoặc dùng mật khẩu project mới |
| `could not connect to server` | dùng nhầm host `db.` thay vì pooler |
| `permission denied to create extension` | chạy nhầm ở project cũ |

## B5. Cài bộ máy chép (PHẦN 2)

Chạy PHẦN 2. Nó tạo các hàm phụ trợ và bảng theo dõi tiến độ `mig_progress`.
Không sửa gì trong phần này.

## B6. Chép dữ liệu (PHẦN 3) — bấm Run nhiều lần

> ⚠️ **Đây là bước xoá sạch project đích.** PHẦN 3 chạy `delete from auth.users`
> và `truncate` mọi bảng `public` rồi mới chép. Không hỏi lại, không hoàn tác
> được. Chỉ chạy khi A1 đã xác nhận đích chỉ có bản chép cũ.

Chạy PHẦN 3. Script chép **theo lô** để không vượt giới hạn thời gian của SQL
Editor, nên nó sẽ dừng giữa chừng — **cứ bấm Run lại**, nó tự chạy tiếp từ chỗ
dừng. Lặp tới khi kết quả báo xong hết.

Xem tiến độ bất cứ lúc nào:

```sql
select thu_tu, tbl, xong from public.mig_progress order by thu_tu;
```

## B7. Chép file Storage và sửa URL ảnh

### B7a. Chép 3 bucket

Ba bucket cần chép: **`payment-proofs`**, **`wedding-photos`**, **`logos`**.
(Nếu bản cũ có đặt `DRIVE_IMG_CACHE_BUCKET` thì bucket cache đó **không cần
chép** — nó tự tạo lại khi có người xem ảnh.)

Với mỗi bucket: Supabase CŨ → Storage → chọn bucket → tải file về; Supabase MỚI
→ Storage → tạo bucket cùng tên, **cùng chế độ public/private** → tải lên, giữ
nguyên cấu trúc thư mục.

Đối chiếu số file với bảng bạn chụp ở bước A1.

### B7b. Sửa URL ảnh trong database — bước dễ bỏ sót nhất

App lưu ảnh bằng **URL đầy đủ**, dạng:

```
https://<mã-project>.supabase.co/storage/v1/object/public/<bucket>/<file>
```

Chép dữ liệu xong thì các URL đó **vẫn trỏ về project CŨ**. Chừng nào project cũ
còn sống thì ảnh vẫn hiện bình thường — nên rất dễ tưởng đã xong. Nhưng xoá hoặc
tạm dừng project cũ là **mọi ảnh chết cùng lúc**: logo studio, ảnh chuyển khoản
của khách, ảnh thiệp cưới, ảnh bìa album, ảnh trong trình dựng website.

Đây là lỗi **im lặng và trả chậm** — nó nổ vài tuần sau, lúc bạn đã quên mất
đợt chuyển đổi.

1. Mở [`supabase/rewrite-storage-urls.sql`](../supabase/rewrite-storage-urls.sql).
2. Sửa `ma_cu` và `ma_moi` ở đầu **cả hai** khối `do $$`.
3. Chạy trên Supabase **MỚI**.
4. Đợi tới khi thấy dòng `── Sạch: không còn URL nào trỏ về project cũ.`

## B8. Đối chiếu trước khi cắt

Chạy trên **cả hai** project rồi so từng con số:

```sql
select 'tài khoản' as muc, count(*) from auth.users
union all select 'hợp đồng',  count(*) from public.studio_contracts
union all select 'album',     count(*) from public.albums
union all select 'ảnh',       count(*) from public.photos
union all select 'lượt chọn', count(*) from public.selections
union all select 'khoản thu', count(*) from public.contract_payments;
```

Lệch dòng nào thì quay lại B6 chạy tiếp, **đừng cắt tên miền**.

## B9. Cắt tên miền sang Vercel mới

1. **Vercel MỚI** → project → Settings → Domains → **Add** `mstudo.com`. Thêm
   luôn `www.mstudo.com` và các subdomain đang dùng (`img`, `admin`, `thiep`) và
   `*.mstudo.com`.
2. Vercel hiện ra giá trị DNS cần đặt. **Dùng đúng giá trị Vercel hiển thị** —
   đừng chép giá trị từ bài hướng dẫn nào trên mạng, Vercel có đổi theo thời gian.
3. **Vercel CŨ** → Settings → Domains → **xoá** `mstudo.com` khỏi project cũ.
   Một tên miền không thể thuộc hai project Vercel cùng lúc; không gỡ bên cũ thì
   bên mới báo *domain is already in use*.
4. **Cloudflare** → DNS → sửa các bản ghi trỏ về giá trị Vercel vừa cho. Giữ
   **DNS only (đám mây xám)** theo bước 0.5.
5. Đợi Vercel chuyển từ *Invalid Configuration* sang **Valid**, và chứng chỉ
   HTTPS cấp xong (thường vài phút).

Treo ở **"Failed to Generate Cert"** thì gần như chắc chắn bản ghi đang để đám
mây cam — chuyển về xám rồi bấm Refresh.

## B10. Kiểm tra ngay sau khi cắt

Mở **cửa sổ ẩn danh** (tránh cache và cookie cũ):

- [ ] `https://mstudo.com` mở được, khoá HTTPS xanh
- [ ] `https://www.mstudo.com` tự chuyển về `https://mstudo.com`
- [ ] Đăng nhập Google
- [ ] Vào Tổng quan — số hợp đồng, doanh thu khớp với bản cũ
- [ ] Mở một hợp đồng có ảnh chuyển khoản — **ảnh phải hiện**
- [ ] Mở một album — ảnh bìa và ảnh trong album phải hiện
- [ ] Mở một link khách `/a/<slug>` đã gửi trước đây
- [ ] Mở website một studio ở `<tên>.mstudo.com`
- [ ] `https://thiep.mstudo.com` (nếu đang dùng)
- [ ] Kiểm tra một lượt chọn ảnh cũ vẫn còn nguyên

Ảnh không hiện → **B7b chưa chạy hoặc chạy sót**. Quay lại làm ngay, đừng để qua
đêm.

## B11. Mở lại cho studio

Nhắn cho các studio là đã xong, dùng bình thường được.

---

# PHẦN C — Sau khi cắt

## C1. Ngay trong ngày

- Xoá file `.env.old` nếu có.
- Vercel MỚI → Deployments → xem log vài giờ đầu, tìm lỗi 500.
- Supabase MỚI → Logs → xem có lỗi RLS hay quota không.
- Kiểm tra cron đầu tiên có chạy không (sáng hôm sau, sau `0 0 * * *`).

## C2. Giữ nguyên trong 7 ngày

**Đừng xoá gì bên cũ.** Cụ thể là:

- Vercel CŨ: để nguyên trạng thái pause, đừng xoá project.
- Supabase CŨ: đừng xoá, đừng pause. Pause project cũ trong lúc B7b chưa chắc
  chắn sạch là ảnh chết hàng loạt.
- Repo cũ: để nguyên.

Đây là đường lùi của bạn. Bảy ngày là đủ để mọi việc định kỳ (cron hàng tuần,
chu kỳ thanh toán) chạy qua ít nhất một lượt.

## C3. Sau 7 ngày chạy êm

- Google Cloud Console: xoá các redirect URI cũ không dùng nữa.
- Supabase CŨ: có thể pause để tiết kiệm.
- Vercel CŨ: có thể xoá project.
- Chỉ **xoá hẳn** Supabase cũ khi bạn đã chắc chắn không còn URL nào trỏ về nó
  — chạy lại phần kiểm tra của `rewrite-storage-urls.sql` một lần nữa cho yên tâm.

---

# PHẦN D — Đường lùi khi có sự cố

Vì tên miền đã ở Cloudflare, quay đầu rất nhanh:

1. **Vercel CŨ** → bỏ pause project, thêm lại `mstudo.com` vào Domains.
2. **Vercel MỚI** → xoá `mstudo.com` khỏi Domains.
3. **Cloudflare** → DNS → trỏ lại giá trị của Vercel cũ.

Có hiệu lực trong vài phút. Dữ liệu ở Supabase cũ vẫn nguyên vẹn vì bản mới ghi
vào Supabase mới — hai bên không đụng nhau.

**Cái mất khi quay đầu:** mọi việc studio làm trên bản 2.0 kể từ lúc cắt. Nên
nếu định lùi thì lùi sớm, đừng để vài ngày.

---

# Phụ lục: những chỗ hay sập

| Triệu chứng | Nguyên nhân | Xử lý |
|---|---|---|
| `ERR_TOO_MANY_REDIRECTS` | Cloudflare SSL để **Flexible** | Đổi sang **Full (strict)** (bước 0.4) |
| Vercel treo **"Failed to Generate Cert"** | bản ghi để 🟠 Proxied | Chuyển sang ⚪ DNS only, bấm Refresh |
| Vercel báo *domain is already in use* | tên miền còn gắn ở project cũ | Xoá khỏi Vercel CŨ trước (bước B9.3) |
| 500 toàn site, `MIDDLEWARE_INVOCATION_FAILED` | thiếu biến Supabase | Khai `NEXT_PUBLIC_SUPABASE_URL` + `ANON_KEY` rồi **Redeploy** |
| Mở được ở ẩn danh nhưng lỗi ở tab thường | cookie phiên cũ | Xoá cookie của `mstudo.com`, đăng nhập lại |
| Đăng nhập Google báo `redirect_uri_mismatch` | thiếu redirect URI | Thêm ở Google Cloud Console (bước A4) |
| Ảnh vỡ hết sau khi cắt | chưa chạy `rewrite-storage-urls.sql` | Chạy bước B7b |
| Ảnh vỡ lẻ tẻ | thiếu file lúc chép bucket | Đối chiếu số file, tải bù (bước B7a) |
| Script chép báo timeout | lô quá lớn, bình thường | Bấm **Run** lại, script tự chạy tiếp |
| `could not connect to server` ở B4 | dùng host `db.` (chỉ có IPv6) | Dùng host **Session pooler** |
| Cron không chạy, không báo lỗi | thiếu `CRON_SECRET` | Khai biến rồi Redeploy |
| Email `@mstudo.com` chết sau Phần 0 | sót bản ghi MX khi chuyển DNS | Thêm lại MX ở Cloudflare cho khớp bên cũ |
| Website studio ở subdomain không mở | thiếu bản ghi wildcard `*` | Thêm CNAME `*` (bước 0.6) |
