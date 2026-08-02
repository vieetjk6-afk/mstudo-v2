# Vieetjk — Photo collection for customers

> ### 🎨 Đây là repo **mstudo 2.0** — bản làm lại giao diện
>
> Tách riêng khỏi repo đang chạy production, dùng **Supabase và Vercel riêng**,
> nên sửa thoải mái mà không ảnh hưởng khách đang dùng. Logic là bản sao đầy đủ
> nên chạy được ngay từ ngày đầu.
>
> **Dựng môi trường lần đầu → [`docs/thiet-lap-moi.md`](docs/thiet-lap-moi.md)**
> (Supabase mới · Vercel mới · biến môi trường · chỗ bắt đầu sửa giao diện)

> Minimalist, dark-themed photo selection platform. Photographers create albums
> from Google Drive links; customers browse (watermarked), pick photos within a
> limit, export/copy the list, and download a ZIP.
>
> Nền tảng chọn ảnh tối giản, tone tối. Photographer tạo album từ link Google
> Drive; khách hàng xem (có watermark), chọn ảnh theo giới hạn, xuất/copy danh
> sách và tải ZIP.

Built with **Next.js 14 (App Router) · TypeScript · Tailwind CSS · Supabase**.

The UI follows the **Vieetjk Gallery “Obsidian”** design: deep-ink palette
(`#0a0a0c`), champagne-gold accent (`#E8C57C`), the TJK wordmark logo, and an
editorial type pairing — **Cormorant Garamond** (headings) + **Hanken Grotesk**
(UI). The customer selection page mirrors that design: editorial album title,
guest banner, a sticky toolbar (filter selected / export / copy / ZIP / send),
a masonry gallery with selection rings, and a lightbox with a per-photo note
panel.

> Delivery galleries (`/album`) reuse the albums/sources/photos tables via
> `is_gallery = true`; the view password is the client's phone (pinned galleries
> are open). Re-run `supabase/schema.sql` to add the gallery columns + the
> `feedback` table.
>
> Already have a database from an earlier version? Re-run `supabase/schema.sql`
> (it is idempotent) — it adds `selections.client_note`, the album showcase
> flags (`is_showcase`, `is_pinned`, `kind`), and the `site_settings` and
> `bookings` tables used by the homepage and settings.

---

## ✨ Features / Tính năng

- **Albums from Google Drive** — add multiple sources per album (individual file
  links *or* folder links). Folders are auto-listed via the Drive API and can be
  re-synced to update the photo count. *(Tạo album từ nhiều link Drive — file lẻ
  hoặc folder; đồng bộ lại số lượng ảnh.)*
- **Group or merge** — each source is a named group; customers can view all
  photos together or filter by group.
- **Selection limit** — cap how many photos a customer may select.
- **Album password** — optional bcrypt-hashed password gate per album.
- **Watermark** — tiled diagonal watermark on previews *and* on ZIP downloads.
- **Export / copy** — export the selection as a `.txt`, or copy the list with
  file extensions stripped.
- **Download ZIP** — client-side zip of selected images (watermarked if enabled).
- **Customer notes** — clients can leave a note on each photo (in the lightbox);
  notes are sent to the studio with the selection.
- **Photographer tools** — edit album, change cover, re-sync Drive, view customer
  selections (with the client's notes) and add their own notes per chosen photo.
- **Admin** — manage photographers: roles, activation, album limit, ZIP
  permission, and create new accounts.
- **Profile homepage** — public studio portfolio: cover, avatar, bio, live
  stats, featured photos, view-only **reference albums**, a **booking form**
  (4 service types → stored as leads) and a contact block.
- **Reference (showcase) albums** — flag any published album as "show on
  homepage"; it renders view-only (no selection/download) at `/showcase/[slug]`.
- **2-step create flow** — `/dashboard/create`: paste Drive links + options,
  then get a shareable client link **with a real QR code**.
- **Studio settings & bookings** — admins edit the homepage profile/contact and
  review booking leads at `/dashboard/settings`.
- **Contract → Drive sync** — tính năng riêng ở **Khách hàng → Đồng bộ Drive**.
  Studio kết nối Drive của mình, đặt tên thư mục gốc (tự kéo đi đâu trong Drive
  cũng được), và chọn thư mục gốc trên máy. Khi hợp đồng đã ký, máy chủ tạo ngay
  cây thư mục Drive + album, còn MStudo Desktop tạo thư mục trên máy — tất cả trong
  1 thư mục gốc lấy tên hợp đồng (`Photo/JPG Goc · Raw · File ChinhSua`, và
  `Video/…` nếu chọn có quay), rồi **tự tải lên Drive** (1 chiều).
  *JPG Goc* → album chọn ảnh, *File ChinhSua* → gallery giao khách; loại trừ được
  thư mục không cần đồng bộ. Cây thư mục tự chia theo cấu trúc **Thư mục gốc /
  Loại dịch vụ / Thang{tháng ngày thực hiện} / Tên hợp đồng** — giống hệt trên
  Drive lẫn trên máy; thư mục *loại dịch vụ* và *tháng* chỉ tạo một lần rồi các
  hợp đồng sau lưu đúng vào đó. Env `GOOGLE_STUDIO_DRIVE_REDIRECT_URI`, migration
  `supabase/migrations/studio_drive_sync.sql`.
- **Giao khách (client handoff)** — khi hợp đồng chuyển giai đoạn giao khách (đã
  có album hoàn thiện), album chọn ảnh không còn hiện cho khách (cổng hợp đồng ẩn
  thẻ chọn ảnh, link `/a/[slug]` tự chuyển sang album hoàn thiện). Trong album hoàn
  thiện có thêm nút **File gốc (ảnh chọn)** trỏ tới thư mục Drive *JPG Goc* của giai
  đoạn chọn ảnh để khách lấy file gốc khi cần.
  Với album **không gắn hợp đồng** (sửa trực tiếp trong thư viện album): khi chuyển
  sang giai đoạn Giao khách, thư mục ảnh gốc (giai đoạn chọn) tự thành nút *File gốc*;
  studio dán **link thư mục ảnh đã chỉnh sửa** ngay trong trình sửa album rồi
  **Lưu & đồng bộ** — ảnh đã chỉnh sửa hiện ở album giao cho khách.
- **Bilingual UI** — Vietnamese / English toggle.

---

## 🚀 Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run [`supabase/schema.sql`](supabase/schema.sql).
3. From **Project Settings → API**, copy the *Project URL*, *anon key* and
   *service_role key*.

### 2. Google Drive API key

1. In [Google Cloud Console](https://console.cloud.google.com), enable the
   **Google Drive API**.
2. Create an **API key**. Restrict it to the Drive API (and ideally to your
   site's referrer / IP).
3. Drive sources must be shared as **“Anyone with the link”** for the key to
   read them. *(Folder/ảnh phải được chia sẻ ở chế độ “Anyone with the link”.)*

### 2b. Google sign-in (OAuth) — for photographers

The app subdomain's home (`/start`) lets a photographer create albums and signs
them in **with Google** on demand. To enable it:

1. In **Supabase → Authentication → Providers → Google**, enable it and paste a
   Google OAuth **Client ID / Secret** (create them in Google Cloud → APIs &
   Services → Credentials → OAuth client, type *Web application*).
2. In that Google OAuth client, add the **Authorized redirect URI** that
   Supabase shows you (`https://<project>.supabase.co/auth/v1/callback`).
3. In **Supabase → Authentication → URL Configuration**, add your site URLs to
   **Redirect URLs**, e.g. `https://album.vieetjk.com/auth/callback` (and your
   `*.vercel.app` / `http://localhost:3000/auth/callback` for testing).

New sign-ups become active photographers automatically and can create albums
right away. By default a new account is on a **free tier**: up to **5 albums per
month**, customer **download (ZIP) disabled**, and customer **notes disabled**.
An admin can raise the monthly limit and toggle download/notes per account in
**Dashboard → Admin** (admins themselves are unlimited and always allow
download/notes). The monthly quota is enforced by a database trigger.

### 3. Environment variables

Copy `.env.example` to `.env.local` and fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...     # server only — keep secret
GOOGLE_API_KEY=...                # server only — keep secret
```

### 4. Run locally

```bash
npm install
npm run dev
```

### 5. Create the first admin

1. Sign up once is disabled by default; instead, create a user in the Supabase
   dashboard (**Authentication → Users → Add user**, with a password).
2. In **SQL Editor**, promote that user:
   ```sql
   update public.profiles set role = 'admin', is_active = true
   where email = 'you@example.com';
   ```
3. Sign in at `/login`. From **Admin**, create photographer accounts.

### 6. Deploy to Vercel

Push to GitHub, import the repo in Vercel, and add the four environment
variables above in **Project Settings → Environment Variables**. Deploy.

### 7. (Optional) Split across two domains

Serve the public site and the app on separate hosts from the **same** Vercel
project:

1. In **Settings → Domains**, add `vieetjk.com`, `album.vieetjk.com` and
   `img.vieetjk.com`.
2. Add the env vars and redeploy:
   - `NEXT_PUBLIC_MAIN_HOST=vieetjk.com`
   - `NEXT_PUBLIC_APP_HOST=album.vieetjk.com`
   - `NEXT_PUBLIC_IMG_HOST=img.vieetjk.com`

Middleware then routes by host:

- **vieetjk.com** → profile homepage, showcase albums, booking, contact, social.
  App routes are redirected to the app host.
- **album.vieetjk.com** → login, dashboard, album management, and the customer
  selection pages (`/a/[slug]`). `/` redirects to `/dashboard`. The compress
  tool is redirected to the image host.
- **img.vieetjk.com** → the image-compress tool (`Nén ảnh`). `/` opens the tool;
  it requires login, and every other path is sent to the app host. Add this
  host to the Supabase **Redirect URLs** too (`https://img.vieetjk.com/auth/callback`).

When the host vars are unset (local dev, `*.vercel.app`), the full app runs on a
single host and the compress tool stays at `/dashboard/compress`.

> **Image tool tabs + quotas.** The tool has three tabs: **Nén ảnh** (compress),
> **Gắn watermark** (standalone text/image watermark) and **Đổi định dạng**
> (convert between JPEG/PNG/WebP). Each tab has a **preview**. Free-account limits
> (admins always unlimited):
> - **Compress** from local files / public Drive link: **2/day**
>   (`profiles.compress_daily_limit`, counted per Vietnam-day).
> - **Compress via the Google Picker** (writes back to Drive): **1 lifetime trial**
>   (`profiles.compress_picker_limit`).
> - **Watermark** and **Convert**: unlimited (download only, no Drive write-back).
>
> Usage is logged in `compress_usages` (`kind` = `basic` | `picker`). Admins set
> per-account limits in **Dashboard → Admin** (“Nén/ngày”, “Nén Drive”). For the
> Picker compress, the overwrite/new-copy choice is made **before** running and
> the compress+write runs automatically. Re-run `supabase/schema.sql` to add the
> columns + `kind`.

> **Compress on a user's own Drive (Google Picker).** In the compress tool the
> **“Chọn từ Google Drive”** button lets **any signed-in Google user** pick
> images/folders from **their own Drive** (private folders included), compress
> them, then **overwrite the originals in place** (same file ID & link —
> irreversible) or **save new `_nen` copies** in the same folder. It uses the
> **non-sensitive `drive.file` scope** via Google Identity Services + the Picker,
> so **no Google verification and no “unverified app” screen** — works for
> unlimited users. All Drive calls run in the browser with the user's own access
> token; nothing touches our server.
>
> Setup (Google Cloud Console, same project as Drive): **enable the “Google
> Picker API”**, create an **OAuth Web client** (add your site origins —
> `https://img.vieetjk.com`, etc. — under *Authorized JavaScript origins*) and a
> **browser API key**, set the **OAuth consent screen to “In production”** (only
> the non-sensitive `drive.file` + sign-in scopes → no review needed). Then set
> `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_GOOGLE_API_KEY` and
> `NEXT_PUBLIC_GOOGLE_APP_ID` (the project number). Leave them unset to hide the
> picker and keep only the public-link (download-only) mode.

---

## 🗺 Routes

| Route | Who | Purpose |
|---|---|---|
| `/` | public | Studio homepage (portfolio, pinned galleries, videos, feedback, booking) |
| `/album` | public | Client gallery directory — search by name/phone, grouped by month |
| `/album/[slug]` | public | Delivery gallery — password = client phone (pinned = open); download, feedback |
| `/dashboard/galleries` | auth | Manage delivery galleries (create/edit/pin/delete) |
| `/showcase/[slug]` | public | Reference album — view-only gallery + lightbox |
| `/login` | public | Photographer / admin sign-in |
| `/dashboard` | auth | Album list |
| `/dashboard/create` | auth | 2-step create flow (Drive links → share link + QR) |
| `/dashboard/albums/[id]` | owner/admin | Edit album, sources, photos, settings |
| `/dashboard/albums/[id]/selections` | owner/admin | Customer selections + notes |
| `/dashboard/compress` | auth | Compress images (Drive link or local files) + optional text/image watermark |
| `/dashboard/admin` | admin | Manage photographers |
| `/dashboard/settings` | admin | Studio profile/contact + booking leads |
| `/a/[slug]` | public | Customer album (password → select → export/zip) |

---

## 🔀 Giao diện 2.0 (webapp v2)

Webapp có sẵn cơ chế **chuyển phiên bản giao diện 1.0 ↔ 2.0**. Bản 2.0 đang được
thiết kế nên mặc định **chưa chạy**: người dùng chỉ thấy một nút thông báo
(hình ✨ trên thanh trên) cho biết "giao diện 2.0 sắp ra mắt".

Bật/tắt tại **Cài đặt hệ thống → Tính năng → Giao diện 2.0** (cờ
`site_settings.feature_flags.webapp_v2`):

| Giá trị cờ | Ai chuyển được | Hiển thị |
|---|---|---|
| *(không có)* / `coming_soon` | Không ai | Nút thông báo + "Sắp ra mắt · đang kiểm thử" |
| `beta` | Chỉ admin | Nút chuyển hoạt động (kiểm thử nội bộ) |
| `live` | Mọi studio | Nút chuyển hoạt động, vẫn quay lại 1.0 được |

Cách hoạt động:

- Lựa chọn của người dùng lưu ở cookie `mstudo_ui` (`POST /api/webapp-version`);
  quyền được **kiểm tra lại ở server**, nút chỉ là lớp hiển thị.
- Hạ cờ về `coming_soon` là mọi phiên đang ở 2.0 **tự trở lại 1.0** ở lần tải
  trang sau — không cần xoá cookie của ai.
- Dashboard được bọc `data-webapp="v1" | "v2"`. Giao diện 2.0 viết CSS **bên
  trong** `[data-webapp="v2"]` (xem khối khung chờ ở cuối `src/app/globals.css`),
  kèm hai lớp `.v1-only` / `.v2-only` để dựng song song hai bố cục.
- Logic cờ/cookie: `src/lib/webapp-version.ts` — kiểm thử: `npm run test:webapp-version`.

---

## 🔐 Security notes

- The Google API key and Supabase service-role key are **server-only**; Drive
  listing and customer-selection writes go through API routes, never the browser.
- Album passwords are stored as **bcrypt hashes** and verified server-side.
- Row Level Security restricts photographers to their own albums; admins see all.
- **Rotate any key that was ever shared in plain text.**
- This project pins **Next.js 14.2.x** (latest patched 14 line). `npm audit`
  flags advisories whose only fix is the Next 16 major release; deploying on
  Vercel (managed, not self-hosted) mitigates the self-hosted image-optimizer
  and middleware advisories. Upgrade to Next 16 when you're ready to adapt to
  its async `params`/`cookies()` API.

---

© Vieetjk — photo collection for customers.
