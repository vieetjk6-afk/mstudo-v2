# Biến môi trường — tra cứu đầy đủ

Dùng cho bước **A3** của [`chuyen-doi-mstudo-2.0.md`](./chuyen-doi-mstudo-2.0.md):
nạp biến từ Vercel CŨ sang Vercel MỚI.

Bảng dưới đối chiếu **danh sách thật ở Vercel cũ** với **code hiện tại**, nên nó
chính xác hơn `.env.example` (file mẫu có vài biến chưa bao giờ được dùng, và
thiếu vài biến bản cũ đang chạy).

---

## Cách thêm biến (làm một lần, áp dụng cho mọi biến bên dưới)

1. Vercel → chọn **project MỚI** → tab **Settings** → mục **Environment
   Variables** (menu bên trái).
2. Ô **Key** điền tên biến, ô **Value** điền giá trị.
3. Phần **Environments**: tick cả **Production**, **Preview**, **Development**.
   Thiếu Production là bản chính không có biến đó.
4. Bấm **Save**.
5. Làm xong hết → **Deployments** → tạo bản deploy mới (xem A3 trong file chính
   nếu Vercel báo *"Prebuilt deployments cannot be redeployed"*).

> Ô **Value** nhận **cả khối nhiều dòng** dạng `KEY=VALUE`. Dán cả file một lượt
> nhanh hơn nhiều so với gõ từng biến — Vercel tự tách thành từng biến riêng.

> ⚠️ **Không dán dấu nháy kép.** File `.env.old` ghi `KEY="giá-trị"`. Nếu sau khi
> lưu mà giá trị còn dính `"` ở hai đầu thì phải xoá — URL dính nháy là URL sai.

---

## ⚠️ Nếu file `.env.old` ghi `[SENSITIVE]`

Vercel cho phép đánh dấu một biến là **Sensitive** — loại đó **chỉ ghi được,
không đọc lại được**. `vercel env pull` trả về đúng chữ `[SENSITIVE]`, và giao
diện web cũng không hiện giá trị. Không có cách nào bắt Vercel nhả ra.

**Nhưng gần như mọi giá trị đều lấy lại được từ chỗ khác.** Xem chương
[**mục 7 — Lấy lại giá trị bị ẩn**](#7-lấy-lại-giá-trị-bị-ẩn) ở cuối file — có cách cho
từng biến một, kể cả mẹo đọc thẳng từ chính trang mstudo.com đang chạy.

Trước khi làm gì: **thử xem trong giao diện web đã**. Vercel CŨ → Settings →
Environment Variables → bấm vào biến. Biến thường có nút con mắt để hiện giá
trị; chỉ biến Sensitive mới thật sự không xem được. Có khi file `.env.old` ghi
`[SENSITIVE]` nhưng trên web vẫn xem được bình thường.

---

# 1. Bắt buộc — thiếu là hỏng

| Biến | Là gì | Lấy ở đâu |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | địa chỉ database | Supabase **MỚI** → Settings → API → **Project URL** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | khoá công khai cho trình duyệt | cùng trang → **anon public** |
| `SUPABASE_SERVICE_ROLE_KEY` | khoá quản trị, chỉ dùng ở máy chủ 🔒 | cùng trang → **service_role** |

Ba biến này **phải là của Supabase MỚI**. Copy từ bản cũ là app mới vẫn ghi vào
database cũ — chạy có vẻ bình thường nhưng dữ liệu nhập vào không thấy đâu.

Thiếu 2 biến đầu → **500 toàn site** (`MIDDLEWARE_INVOCATION_FAILED`).

---

# 2. Cần tạo mới — bản cũ không có

| Biến | Là gì | Lấy ở đâu |
|---|---|---|
| `CRON_SECRET` | khoá bảo vệ 5 route `/api/cron/*` 🔒 | **tự đặt** một chuỗi ngẫu nhiên dài |

Bản cũ **không có biến này**, nghĩa là 5 cron ở bản cũ đang trả 401 và **không
chạy** từ trước tới nay: nhắc lịch chụp, gửi Zalo, dọn ảnh chuyển khoản, dọn
cache ảnh, dọn ảnh cưới. Đây là lỗi có sẵn chứ không phải do chuyển đổi — nhân
dịp này sửa luôn.

Code cố ý **fail-closed**: thiếu khoá thì khoá cửa chứ không mở toang, vì
`/api/cron/reminders` gửi email hàng loạt, để mở là ai cũng kích hoạt được.

Tạo chuỗi ngẫu nhiên trong PowerShell:

```powershell
-join ((48..57) + (97..122) | Get-Random -Count 48 | % {[char]$_})
```

Vercel tự gắn `Authorization: Bearer $CRON_SECRET` khi chạy cron theo
`vercel.json`, bạn không phải làm gì thêm.

---

# 3. Phải sửa giá trị — copy nguyên là sai

Năm biến này là địa chỉ Google/Zalo gọi ngược về app. Tên miền không đổi nên
**phần lớn giữ nguyên được**; chỉ sửa nếu giá trị cũ trỏ về host khác.

| Biến | Giá trị | Lấy ở đâu |
|---|---|---|
| `GOOGLE_ADMIN_DRIVE_REDIRECT_URI` | `https://mstudo.com/api/admin/drive/callback` | giữ nguyên bản cũ |
| `GOOGLE_FILTER_DRIVE_REDIRECT_URI` | `https://mstudo.com/api/filter/drive/callback` | giữ nguyên bản cũ |
| `GOOGLE_STORY_REDIRECT_URI` | `https://mstudo.com/api/story/drive/callback` | giữ nguyên bản cũ |
| `GOOGLE_STUDIO_DRIVE_REDIRECT_URI` | `https://mstudo.com/api/studio/drive/callback` | giữ nguyên bản cũ |
| `GOOGLE_CALENDAR_REDIRECT_URI` | callback đồng bộ Google Calendar | giữ nguyên bản cũ |

Mỗi giá trị phải **trùng tuyệt đối** với một dòng trong Authorized redirect URIs
ở Google Cloud Console. Lệch một dấu `/` là Google từ chối.

---

# 4. Copy nguyên si từ bản cũ

## 4a. Google

| Biến | Là gì | Lấy lại ở đâu nếu mất |
|---|---|---|
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | OAuth Web client ID | GCC → Credentials → OAuth 2.0 Client ID |
| `GOOGLE_CLIENT_SECRET` | secret của client trên 🔒 | cùng chỗ → **Reset secret** nếu mất hẳn |
| `GOOGLE_API_KEY` | khoá server gọi Drive API 🔒 | GCC → Credentials → API keys |
| `NEXT_PUBLIC_GOOGLE_API_KEY` | khoá trình duyệt cho Google Picker | GCC → Credentials → API keys (khoá riêng, có giới hạn domain) |
| `NEXT_PUBLIC_GOOGLE_APP_ID` | **số** project Google Cloud | GCC → Dashboard → Project number |
| `GOOGLE_API_REFERER` | referer khai kèm khi gọi Drive API | giữ nguyên bản cũ |

## 4b. Tên miền

| Biến | Giá trị |
|---|---|
| `NEXT_PUBLIC_MAIN_HOST` | `mstudo.com` |
| `NEXT_PUBLIC_IMG_HOST` | `img.mstudo.com` |
| `NEXT_PUBLIC_ADMIN_HOST` | `admin.mstudo.com` |
| `NEXT_PUBLIC_THIEP_HOST` | `thiep.mstudo.com` |
| `NEXT_PUBLIC_STUDIO_HOST` | host studio dùng cho link hợp đồng/báo giá gửi khách |

Giữ **đúng như bản cũ**. Tên miền không đổi nên không có gì phải sửa.

> 💡 Đang test trên `*.vercel.app` mà thấy bị đá về `mstudo.com`: tạm **để trống**
> `NEXT_PUBLIC_MAIN_HOST`, deploy lại, test xong điền lại. Middleware bỏ qua toàn
> bộ phần định tuyến theo host khi biến này rỗng.

## 4c. Thông báo đẩy (web push)

| Biến | Là gì | Lấy lại ở đâu nếu mất |
|---|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | khoá công khai VAPID | phải đi **theo cặp** với khoá riêng |
| `VAPID_PRIVATE_KEY` | khoá riêng VAPID 🔒 | như trên |
| `VAPID_SUBJECT` | email liên hệ, dạng `mailto:…` | mặc định `mailto:hello@mstudo.com` |

⚠️ Hai khoá VAPID là **một cặp**. Tạo cặp mới thì **mọi thiết bị đã đăng ký nhận
thông báo phải đăng ký lại**. Cố lấy đúng cặp cũ; mất hẳn mới tạo mới bằng
`npx web-push generate-vapid-keys`.

## 4d. Còn lại

| Biến | Là gì | Ghi chú |
|---|---|---|
| `OAUTH_STATE_SECRET` | ký tham số `state` khi nối Zalo/Drive 🔒 | mất thì tự đặt chuỗi ngẫu nhiên mới; code tự dùng `SUPABASE_SERVICE_ROLE_KEY` nếu bỏ trống |
| `GEMINI_API_KEY` | chatbox AI 🔒 | aistudio.google.com → API keys |
| `CHAT_PROVIDERS` | cấu hình nhà cung cấp chat (JSON) | giữ nguyên bản cũ |
| `IMG_CDN_REDIRECT` | `0` = tắt tối ưu ảnh | để nguyên như bản cũ |
| `DESKTOP_LATEST_VERSION` | số phiên bản app desktop | giữ nguyên |
| `NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL` | link tải app desktop | giữ nguyên |
| `VERCEL_PROJECT_ID` | **phải đổi** → project MỚI | Vercel MỚI → Settings → General → Project ID |
| `VERCEL_TOKEN` | token để app tự thêm domain cho studio 🔒 | vercel.com/account/tokens → tạo token mới |
| `VERCEL_TEAM_ID` | team chứa project mới | Vercel → Settings → General; **để trống** nếu tài khoản cá nhân |

`VERCEL_PROJECT_ID` sai thì tính năng "studio gắn tên miền riêng" sẽ đăng ký
domain nhầm vào **project cũ** — hỏng âm thầm, rất khó lần ra.

---

# 5. Bỏ hẳn — không copy

## 5a. Code không còn dùng

`NEXT_PUBLIC_MAIN_URL` · `NEXT_PUBLIC_STUDIO_URL` · `NEXT_PUBLIC_SUPABASE_KEY` ·
`SUPABASE_SERVICE_KEY`

Bốn biến này không xuất hiện ở bất cứ đâu trong code hiện tại (đã kiểm tra bằng
`grep process.env.<tên>` trên toàn bộ `src/`). Hai cái sau là tên cũ của
`NEXT_PUBLIC_SUPABASE_ANON_KEY` và `SUPABASE_SERVICE_ROLE_KEY`.

## 5b. Vercel tự tiêm — thêm tay là gây rối

`VERCEL` · `VERCEL_ENV` · `VERCEL_URL` · `VERCEL_TARGET_ENV` · `VERCEL_OIDC_TOKEN` ·
`VERCEL_GIT_*` (mọi biến bắt đầu bằng `VERCEL_GIT_`)

Vercel tự đặt các biến này ở mỗi lần build, theo đúng deployment đang chạy. Khai
tay là ghi đè bằng giá trị sai của bản cũ.

## 5c. Của hệ thống build

`NX_DAEMON` · `TURBO_CACHE` · `TURBO_DOWNLOAD_LOCAL_ENABLED` · `TURBO_REMOTE_ONLY` ·
`TURBO_RUN_SUMMARY`

Vercel tự quản. Bỏ qua.

---

# 6. Không cần khai — tính năng tự tắt khi thiếu

Bản cũ **không có** những biến này, tức các tính năng tương ứng vốn đã tắt. Cứ
để trống, app chạy bình thường. Chỉ khai khi bạn muốn bật thêm.

| Nhóm | Biến | Không khai thì sao |
|---|---|---|
| Zalo OA | `ZALO_OA_APP_ID`, `ZALO_OA_APP_SECRET`, `ZALO_OA_REDIRECT_URI`, `ZALO_SESSION_SECRET` | kênh Zalo OA tắt (kênh cá nhân vẫn chạy) |
| Chống bot | `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | không có captcha ở form công khai |
| Cache ảnh | `DRIVE_IMG_CACHE_*` (5 biến) | **nên để trống** — chính bucket này làm vượt hạn mức Supabase bản cũ |
| Gửi email | `RESEND_API_KEY`, `EMAIL_FROM` | không gửi được email |
| Giới hạn tần suất | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | không giới hạn tần suất gọi |
| Khác | `GEMINI_MODEL` | dùng model mặc định trong code |
| Đã ngừng dùng | `NEXT_PUBLIC_APP_HOST` | không dùng nữa, để trống |

---

# 7. Lấy lại giá trị bị ẩn

Dành cho những biến `.env.old` ghi `[SENSITIVE]`. Xếp theo độ khó, làm từ trên
xuống.

## 7.1. Mức dễ — bạn tự biết giá trị

Không cần lấy ở đâu cả, đây là địa chỉ và bạn đã biết chúng:

| Biến | Giá trị |
|---|---|
| `NEXT_PUBLIC_MAIN_HOST` | `mstudo.com` |
| `NEXT_PUBLIC_IMG_HOST` | `img.mstudo.com` |
| `NEXT_PUBLIC_ADMIN_HOST` | `admin.mstudo.com` |
| `NEXT_PUBLIC_THIEP_HOST` | `thiep.mstudo.com` |
| `NEXT_PUBLIC_STUDIO_HOST` | thường là `mstudo.com` |
| `GOOGLE_ADMIN_DRIVE_REDIRECT_URI` | `https://mstudo.com/api/admin/drive/callback` |
| `GOOGLE_FILTER_DRIVE_REDIRECT_URI` | `https://mstudo.com/api/filter/drive/callback` |
| `GOOGLE_STORY_REDIRECT_URI` | `https://mstudo.com/api/story/drive/callback` |
| `GOOGLE_STUDIO_DRIVE_REDIRECT_URI` | `https://mstudo.com/api/studio/drive/callback` |
| `GOOGLE_CALENDAR_REDIRECT_URI` | `https://mstudo.com/api/gcal/callback` |
| `GOOGLE_API_REFERER` | `https://mstudo.com` |
| `IMG_CDN_REDIRECT` | để trống (chỉ đặt `0` khi muốn tắt tối ưu ảnh) |

**Cách đối chiếu cho chắc** với 5 URI Google: Google Cloud Console → Credentials
→ OAuth 2.0 Web client → khung **Authorized redirect URIs** liệt kê đúng những
URI bản cũ đang dùng. Copy từ đó là chính xác tuyệt đối.

## 7.2. Mức dễ — đọc thẳng từ trang mstudo.com đang chạy

Mọi biến tên bắt đầu bằng `NEXT_PUBLIC_` đều được **nhúng thẳng vào JavaScript**
gửi xuống trình duyệt. Trang cũ vẫn đang chạy, nên giá trị vẫn nằm ở đó:

| Biến | Nhúng trong |
|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | nút bật thông báo đẩy |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | công cụ nén ảnh |
| `NEXT_PUBLIC_GOOGLE_API_KEY` | công cụ nén ảnh |
| `NEXT_PUBLIC_GOOGLE_APP_ID` | công cụ nén ảnh |
| `NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL` | trang app desktop |

**Cách làm** (Chrome/Edge):

1. Mở `https://mstudo.com`, đăng nhập, vào **Công cụ ảnh → Nén ảnh** (để trình
   duyệt tải đúng đoạn JavaScript chứa mấy biến này).
2. Nhấn **F12** → tab **Sources**.
3. Nhấn **Ctrl + Shift + F** (tìm trong mọi file).
4. Gõ từ khoá rồi Enter:
   - `apps.googleusercontent.com` → ra `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
   - `AIza` → ra `NEXT_PUBLIC_GOOGLE_API_KEY` (khoá Google luôn bắt đầu bằng `AIza`)
5. Với khoá VAPID: vào trang có nút bật thông báo rồi tìm `BM` hoặc `BN` — khoá
   VAPID công khai là chuỗi ~87 ký tự bắt đầu bằng `B`.

Cách nhanh hơn cho khoá VAPID: mở Console (F12 → **Console**) trên trang cũ và
chạy:

```js
[...document.querySelectorAll('script[src]')].map(s => s.src)
```

rồi mở từng file `.js`, dùng Ctrl+F tìm `"B`. Nhưng cách Ctrl+Shift+F ở trên
thường nhanh hơn.

## 7.3. Mức trung bình — lấy lại ở Google Cloud Console

| Biến | Đường đi |
|---|---|
| `GOOGLE_API_KEY` | GCC → APIs & Services → **Credentials** → mục **API Keys** → bấm vào khoá → **SHOW KEY** |
| `NEXT_PUBLIC_GOOGLE_API_KEY` | như trên (khoá riêng, thường có giới hạn theo domain) |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | GCC → Credentials → **OAuth 2.0 Client IDs** → bấm vào client → **Client ID** hiện rõ |
| `NEXT_PUBLIC_GOOGLE_APP_ID` | GCC → trang chủ project → **Project number** (là dãy số, không phải Project ID chữ) |
| `GEMINI_API_KEY` | [aistudio.google.com](https://aistudio.google.com) → **Get API key** → tạo khoá mới (khoá cũ vẫn chạy song song) |

### ⚠️ `GOOGLE_CLIENT_SECRET` — cẩn thận, đây là chỗ dễ làm sập bản cũ

Google Cloud Console → Credentials → OAuth 2.0 Client → bấm vào client:

- **Có thấy secret** (hoặc nút tải file JSON) → copy, xong.
- **Không thấy** → có nút **Reset secret**. **Đừng bấm vội.**

Reset là secret cũ **chết ngay lập tức**, mà bản cũ đang phục vụ khách vẫn đang
dùng secret đó. Bấm nhầm là mọi kết nối Google Drive ở bản cũ hỏng giữa ban ngày.

Nếu buộc phải reset thì làm theo đúng thứ tự này:

1. Bấm **Reset secret**, copy giá trị mới.
2. Dán vào `GOOGLE_CLIENT_SECRET` ở Vercel **MỚI**.
3. **Ngay lập tức** dán cùng giá trị đó vào Vercel **CŨ** và deploy lại bản cũ.

Hoặc gọn hơn: **để dành việc này tới đêm cắt** (Phần B), lúc bản cũ đã pause thì
reset thoải mái, không ảnh hưởng ai.

## 7.4. Mức dễ — tạo mới, không cần giá trị cũ

Mấy biến này chỉ cần "một chuỗi bí mật nào đó", không phải khớp với bên thứ ba:

| Biến | Tạo mới thế nào | Mất gì khi đổi |
|---|---|---|
| `CRON_SECRET` | chuỗi ngẫu nhiên bất kỳ | không mất gì (bản cũ vốn chưa có) |
| `OAUTH_STATE_SECRET` | chuỗi ngẫu nhiên bất kỳ | không mất gì — chỉ làm hỏng những lượt nối Drive/Zalo đang dở, tính bằng giây |
| `VERCEL_TOKEN` | vercel.com/account/tokens → **Create Token** | không mất gì, token cũ vẫn sống |
| `ZALO_SESSION_SECRET` | chuỗi ngẫu nhiên bất kỳ | phiên Zalo đang mở phải nối lại |

Tạo chuỗi ngẫu nhiên trong PowerShell:

```powershell
-join ((48..57) + (97..122) | Get-Random -Count 48 | % {[char]$_})
```

## 7.5. Mức khó — cặp khoá VAPID

`NEXT_PUBLIC_VAPID_PUBLIC_KEY` lấy lại được từ trình duyệt (mục 7.2), nhưng
`VAPID_PRIVATE_KEY` thì **không có ở đâu ngoài Vercel** — không nhúng vào trang,
không lấy từ dịch vụ nào.

Hai khoá phải là **một cặp toán học**. Ghép khoá công khai cũ với khoá riêng mới
là không chạy.

- **Lấy được cả cặp** (từ ghi chú, máy cũ, người từng cấu hình) → dùng lại,
  không ai bị ảnh hưởng.
- **Mất khoá riêng** → phải tạo cặp mới:

```powershell
npx web-push generate-vapid-keys
```

Nó in ra Public Key và Private Key — dán vào `NEXT_PUBLIC_VAPID_PUBLIC_KEY` và
`VAPID_PRIVATE_KEY`.

**Cái mất:** mọi thiết bị đã bật thông báo đẩy phải **vào bật lại**. Dữ liệu
không mất gì, chỉ là các đăng ký cũ ngừng nhận thông báo cho tới khi người dùng
bật lại. Nếu ít người dùng tính năng này thì cứ tạo mới, đừng mất thời gian tìm.

Không muốn phiền ai thì cứ **để trống cả hai** — thông báo đẩy tắt, app vẫn chạy
bình thường, chuông thông báo trong app vẫn hoạt động.

## 7.6. Mức khó — `CHAT_PROVIDERS`

Đây là JSON cấu hình nhà cung cấp AI cho chatbox, dạng:

```json
[{"type":"gemini","key":"AIza…","model":"gemini-flash-latest","label":"gemini"}]
```

Mất thì **không cần khôi phục nguyên văn**. Code có đường lui: bỏ trống
`CHAT_PROVIDERS`, chỉ cần khai `GEMINI_API_KEY` là chatbox tự chạy bằng Gemini
với model mặc định (`src/lib/vieetjk/providers.ts`).

Vậy nên: **để trống `CHAT_PROVIDERS`, khai `GEMINI_API_KEY` là xong.**

## 7.7. Không cần khôi phục

| Biến | Vì sao |
|---|---|
| 3 khoá Supabase | lấy từ Supabase **MỚI**, giá trị cũ vô dụng |
| `VERCEL_PROJECT_ID` | lấy ID của project **MỚI** |
| `DESKTOP_LATEST_VERSION` | đặt số phiên bản desktop hiện tại; sai thì chỉ hiện nhầm số |
| 4 biến ở mục 5a | code không dùng |

---

# 8. Kiểm tra sau khi nạp xong

```powershell
cd ~\vc-old
npx vercel link          # chọn project MỚI
npx vercel env ls production
```

Đối chiếu:

- [ ] 3 khoá Supabase là **của project MỚI** (so với Settings → API bên Supabase)
- [ ] `CRON_SECRET` có mặt và không rỗng
- [ ] `VERCEL_PROJECT_ID` là ID của project **MỚI**
- [ ] Không có biến `VERCEL_GIT_*` nào do bạn tự thêm
- [ ] Mở một biến bất kỳ xem giá trị **không dính dấu nháy kép**
- [ ] Đã tạo bản deploy **mới** sau khi khai xong
