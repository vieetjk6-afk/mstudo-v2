# Dựng môi trường mstudo 2.0 (repo · Supabase · Vercel mới)

Repo này là **bản sao đầy đủ** của mstudo đang chạy, tách ra để làm lại toàn bộ
giao diện mà không đụng gì tới bản production. Toàn bộ logic (hợp đồng, đặt
lịch, album, Drive, Zalo, thanh toán…) đã chạy được ngay — việc còn lại chỉ là
thay lớp giao diện.

Ba việc phải làm một lần: **Supabase mới → Vercel mới → biến môi trường**.
Tính từ lúc bắt đầu, mất khoảng 20–30 phút.

---

## 1. Supabase mới

1. Vào [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**.
   Đặt tên gì cũng được (gợi ý `mstudo-v2`), chọn region **Singapore** cho gần VN.
   Lưu mật khẩu database vào chỗ an toàn.
2. Mở **SQL Editor** → dán **toàn bộ** file [`supabase/setup-all.sql`](../supabase/setup-all.sql) → **Run**.
   File này gộp sẵn 18 file SQL theo đúng thứ tự phụ thuộc (nền trước, vá sau);
   mọi câu lệnh đều idempotent nên chạy lại nhiều lần vô hại.
   *Sửa SQL về sau:* sửa file gốc rồi chạy `node supabase/build-setup-all.mjs`
   để sinh lại — đừng sửa tay `setup-all.sql`.
3. Kiểm tra nhanh **Table Editor**: phải thấy `profiles`, `albums`, `contracts`,
   `studio_*`… và **Storage** phải có sẵn 3 bucket `payment-proofs`,
   `wedding-photos`, `logos` (SQL tự tạo).
4. **Authentication → Providers → Google**: bật, dán Client ID / Secret. Thêm
   `https://<domain-moi>/auth/callback` vào **Redirect URLs**.
5. Lấy 3 khoá ở **Project Settings → API**: `Project URL`, `anon public`,
   `service_role` (khoá này là **bí mật**, chỉ đặt ở server).

> **Dữ liệu KHÔNG tự chuyển sang.** Đây là database trắng — đúng cho việc thử
> giao diện. Nếu muốn dữ liệu thật để nhìn cho giống, cách an toàn là dump từ
> project cũ rồi restore (`pg_dump`/`pg_restore` với connection string ở
> *Project Settings → Database*), làm sau cũng được.

## 2. Vercel mới

1. [vercel.com/new](https://vercel.com/new) → **Import** repo `mstudo-v2`.
   Framework tự nhận Next.js, không cần đổi build command.
2. Dán biến môi trường (mục 3 bên dưới) trước khi bấm Deploy.
3. Cron trong [`vercel.json`](../vercel.json) tự chạy sau lần deploy đầu — 5 job
   dọn dẹp & nhắc lịch. Gói Hobby giới hạn cron chạy 1 lần/ngày; nếu Vercel báo
   vượt hạn mức thì xoá bớt job trong `vercel.json`, không ảnh hưởng gì tới
   giao diện.
4. Chưa cần tên miền riêng: **để trống toàn bộ biến `NEXT_PUBLIC_*_HOST`** thì
   app chạy trọn vẹn trên một tên miền `*.vercel.app` (link nội bộ tự thành
   đường dẫn tương đối). Chỉ khi nào tách miền phụ mới điền các biến đó.

## 3. Biến môi trường

Danh sách đầy đủ kèm giải thích nằm ở [`.env.example`](../.env.example). Mức
tối thiểu để app chạy được:

| Biến | Lấy ở đâu |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role (**bí mật**) |

Thêm khi cần từng mảng tính năng:

- **Google Drive / chọn ảnh:** `GOOGLE_API_KEY`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`,
  `GOOGLE_CLIENT_SECRET`, `NEXT_PUBLIC_GOOGLE_API_KEY`, `NEXT_PUBLIC_GOOGLE_APP_ID`.
- **Zalo tự động nhắn:** `ZALO_OA_APP_ID`, `ZALO_OA_APP_SECRET`, `ZALO_SESSION_SECRET`.
- **Chatbox website:** `GEMINI_API_KEY`, `CHAT_PROVIDERS`.
- **Chống spam form:** `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`.

> **Ba biến `*_REDIRECT_URI` phải đổi theo tên miền mới**
> (`GOOGLE_ADMIN_DRIVE_REDIRECT_URI`, `GOOGLE_STORY_REDIRECT_URI`,
> `GOOGLE_STUDIO_DRIVE_REDIRECT_URI`, và `ZALO_OA_REDIRECT_URI` nếu dùng Zalo).
> Đồng thời khai đúng URI đó trong Google Cloud Console → OAuth client, nếu
> không sẽ dính lỗi `redirect_uri_mismatch` khi kết nối Drive.

> **Đừng bật `DRIVE_IMG_CACHE_BUCKET` ở môi trường mới.** Bucket cache ảnh là
> thứ đã ngốn 13 GB và làm vượt hạn mức Free của project cũ — xem
> [`docs/supabase-usage.md`](./supabase-usage.md). Để trống thì `/api/img` vẫn
> chạy, chỉ là không cache lâu dài.

## 4. Tạo admin đầu tiên

Đăng ký một tài khoản qua giao diện `/login`, rồi chạy trong Supabase SQL Editor:

```sql
insert into public.profiles (id, email, role, is_active, full_name)
select id, email, 'admin', true, 'Admin'
from auth.users where email = 'email-cua-ban@example.com'
on conflict (id) do update set role = 'admin', is_active = true;
```

## 5. Làm giao diện 2.0

Cơ chế chuyển phiên bản đã có sẵn (xem mục *Giao diện 2.0* trong
[README](../README.md)). Ở repo này bạn có hai lối đi, chọn kiểu nào cũng được:

- **Sửa thẳng giao diện hiện tại** — nhanh nhất, vì đây đã là repo riêng, không
  sợ ảnh hưởng production. Cơ chế `data-webapp` chỉ còn là tuỳ chọn.
- **Dựng song song trong `[data-webapp="v2"]`** — giữ được bản 1.0 để đối chiếu
  cạnh nhau, bật/tắt bằng cờ `webapp_v2` trong Cài đặt hệ thống. Hợp khi muốn
  so sánh trước/sau hoặc cho người khác xem thử.

Điểm bắt đầu của phần lớn giao diện quản lý:

| Việc muốn đổi | File |
|---|---|
| Khung studio: sidebar, topbar, ngăn kéo | `src/components/StudioShell.tsx` |
| Thanh trên các trang ngoài studio | `src/components/DashboardHeader.tsx` |
| Màu, nền, viền, chữ (design token) | `src/app/globals.css` |
| Nút, thẻ, ô nhập dùng chung | `src/app/globals.css` (`.btn-*`, `.card`, `.input`) |
| Trang Tổng quan | `src/app/dashboard/studio/page.tsx` |

## 6. Chạy máy mình

```bash
npm install
cp .env.example .env.local   # điền 3 khoá Supabase ở mục 3
npm run dev                  # http://localhost:3000
```

Kiểm tra trước khi đẩy code:

```bash
npx tsc --noEmit             # bắt lỗi kiểu
npm run build                # dựng thật như Vercel
npm run test:webapp-version  # cơ chế chuyển phiên bản
```
