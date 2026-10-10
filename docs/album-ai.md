# Album AI — tặng 1 năm bản quyền cho gói Studio

**Album AI** (`albumai.mstudo.com`) là phần mềm thiết kế album & slide ảnh bằng
AI, **đang trong giai đoạn phát triển**. Chủ studio dùng **gói Studio** được
**tặng 1 năm bản quyền**. Luật tặng nằm ở một chỗ: `src/lib/albumai.ts`.

## Người dùng thấy gì trong mstudo

| Chỗ | Gói Studio | Gói khác |
|---|---|---|
| **Tổng quan** (`/dashboard/studio`) | Thẻ giới thiệu Album AI: quà 1 năm, tình trạng bản quyền, nút **Tải Album AI** | Cùng thẻ, kèm nút **Nâng cấp Studio**. Bấm X là ẩn (nhớ bằng cookie) |
| Bấm **Tải Album AI** | Hộp thoại: ① phần mềm **đang phát triển**; ② **đăng nhập Album AI bằng tài khoản có email trùng email mstudo** để được kích hoạt (kèm email + nút chép) → nút tới trang tải | Hộp thoại: ① đang phát triển; ② bản quyền tặng kèm gói Studio → nâng cấp rồi đăng nhập bằng email mstudo |
| **Thiết kế album**, **Thiệp · Story · Slide** (sidebar, ⌘K) | Như cũ. Màn "Sắp ra mắt" của Thiết kế album / Slide có thêm thẻ Album AI | Mục menu hiện kèm nhãn **STUDIO**; bấm vào ra màn **mời nâng cấp gói** (`StudioUpsell`) |
| Trang **Nâng cấp gói** | Dòng "Tặng 1 năm bản quyền phần mềm Album AI" trong gói Studio + một dòng trong bảng so sánh | — |

> Trang nâng cấp đọc nội dung đã lưu ở **Cấu hình mstudo** nếu admin từng bấm
> lưu. Khi đó dòng mới ở trên không tự hiện — thêm tay trong Cấu hình mstudo.

## Ai được tặng

| Tài khoản | Kết quả |
|---|---|
| Gói Studio **trả phí** (tháng / năm / admin cấp) | Được tặng — kích hoạt ở lần đăng nhập Album AI đầu tiên |
| Gói Studio **dùng thử** (7 ngày) | **Chưa** — 7 ngày dùng thử không đổi được 1 năm bản quyền |
| Photographer, Photographer Plus, Basic, Free | Không — mời nâng cấp |
| Tài khoản **nhân viên** của studio | Không — bản quyền gắn với email **chủ** studio |
| Admin mstudo | Được (để thử) |

**1 năm tính từ lúc kích hoạt** (lần đầu đăng nhập Album AI), không phải từ ngày
ra mắt chương trình. Đã kích hoạt thì giữ nguyên mốc: đăng nhập lại không kéo dài
thêm, và gói Studio có hết hạn sau đó cũng không thu lại quà.

## Cài đặt (một lần)

1. **Chạy migration** trên Supabase SQL Editor: `supabase/migrations/albumai_license.sql`
   (đã có sẵn trong `supabase/cap-nhat.sql` và `supabase/setup-all.sql`). Thêm 2
   cột `albumai_activated_at`, `albumai_expires_at` vào `profiles`. Chưa chạy thì
   mstudo vẫn chạy bình thường, chỉ có API dưới đây trả `503 missing_migration`.
2. **Biến môi trường** trên Vercel (Production + Preview), rồi Redeploy:

   | Biến | Là gì |
   |---|---|
   | `ALBUMAI_LICENSE_SECRET` | 🔒 chuỗi ngẫu nhiên dài, **cùng giá trị** đặt ở máy chủ Album AI. Bỏ trống → API trả 401 (fail-closed) |
   | `NEXT_PUBLIC_ALBUMAI_URL` | trang tải Album AI. Bỏ trống → `https://albumai.mstudo.com` |

## API cho máy chủ Album AI

Gọi **từ máy chủ** Album AI (không gọi từ app trên máy người dùng — khoá bí mật
sẽ lộ) mỗi khi người dùng đăng nhập Album AI:

```http
POST https://mstudo.com/api/albumai/license
Authorization: Bearer <ALBUMAI_LICENSE_SECRET>
Content-Type: application/json

{ "email": "chu-studio@example.com" }
```

Email so khớp không phân biệt hoa/thường với email tài khoản mstudo.

**Có bản quyền** (lần đầu thì đây chính là lúc kích hoạt, `justActivated: true`):

```json
{
  "email": "chu-studio@example.com",
  "licensed": true,
  "source": "studio_gift",
  "activatedAt": "2026-10-10T03:00:00.000Z",
  "expiresAt": "2027-10-10T03:00:00.000Z",
  "justActivated": true
}
```

**Không có bản quyền** — `reason` cho biết nên nói gì với người dùng:

```json
{ "email": "…", "licensed": false, "reason": "not_studio", "plan": "photographer", "expiresAt": null }
```

| `reason` | Nghĩa | Album AI nên nói |
|---|---|---|
| `no_account` | Không có tài khoản mstudo nào mang email này | Đăng nhập bằng đúng email tài khoản mstudo |
| `inactive` | Tài khoản mstudo bị khoá | Liên hệ mstudo |
| `not_studio` | Không phải gói Studio | Nâng cấp gói Studio trên mstudo để được tặng 1 năm |
| `studio_trial` | Đang dùng thử Studio | Lên gói Studio trả phí để được tặng |
| `staff_account` | Tài khoản nhân viên của một studio | Đăng nhập bằng email của chủ studio |
| `gift_expired` | Đã hết 1 năm tặng (`expiresAt` là ngày hết) | Liên hệ mstudo để gia hạn |

Mã lỗi: `401 unauthorized` (sai/thiếu khoá), `400 invalid_email`,
`503 missing_migration` (chưa chạy SQL ở bước 1), `500 db_error`.

## File liên quan

| File | Vai trò |
|---|---|
| `src/lib/albumai.ts` | Luật tặng, thời hạn, link tải |
| `src/app/api/albumai/license/route.ts` | API kích hoạt / tra cứu bản quyền |
| `src/components/AlbumAiPromo.tsx` | Thẻ giới thiệu + hộp thoại "Tải Album AI" |
| `src/components/studio/StudioUpsell.tsx` | Màn mời nâng cấp gói |
| `src/lib/studio-nav.ts` (`upsellFrom`) | Mục menu hiện cho gói thấp kèm nhãn Studio |
| `desktop/test/albumai.mjs` | `npm run test:albumai` |
