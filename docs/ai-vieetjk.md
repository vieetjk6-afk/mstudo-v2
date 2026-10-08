# ai.vieetjk.com — trang Công ty giải pháp công nghệ Vieetjk

Trang giới thiệu công ty công nghệ (phát triển app, giải pháp AI, AI Agent, SEO,
chuyển đổi số), hiển thị bằng **tiếng Anh**. Code tay giống trang vieetjk.com,
**không** dùng trình tạo website và **không** cần dòng nào trong bảng `sites`.

## Các trang

| Đường dẫn | Nội dung |
|---|---|
| `/` | Trang chủ: About, Services, AI Agents, Products, Industries, Process, Technology, cam kết, FAQ, Contact |
| `/app-development` `/web-development` `/ai-solutions` `/ai-agents` `/seo` `/digital-transformation` | Trang chi tiết từng dịch vụ |
| `/robots.txt` `/sitemap.xml` | Riêng cho host này (cho Google lập chỉ mục) |

## Bật tên miền (làm một lần)

1. **Vercel** → project mstudo → *Settings → Domains* → thêm `ai.vieetjk.com`.
2. **DNS của vieetjk.com** → thêm bản ghi `CNAME` tên `ai`, giá trị đúng như
   Vercel hiển thị ở bước 1. Nếu DNS ở Cloudflare thì để **DNS only** (mây xám)
   để Vercel tự cấp chứng chỉ HTTPS.
3. Chờ Vercel báo *Valid Configuration* rồi mở `https://ai.vieetjk.com`.

Không cần biến môi trường mới. Middleware đã coi mọi host lạ là tên miền riêng
và rewrite sang `/site/ai.vieetjk.com/...`; trang tự nhận ra host này
(`isVieetjkAiHost`) trước khi tra bảng `sites`.

## Sửa nội dung

Mọi chữ, số liệu, dịch vụ, câu hỏi thường gặp, số điện thoại, email nằm trong
**một file**: `src/lib/vieetjk-ai/content.ts`. Giao diện ở
`src/components/vieetjk-ai/`.

Ảnh chia sẻ mạng xã hội và icon: `public/vieetjk-ai-og.png` (1200×630),
`public/vieetjk-ai-icon.svg`, `public/vieetjk-ai-icon.png` (180×180).

## Form "Nhận tư vấn"

Khách chỉ cần để lại **SĐT hoặc email** (khách nước ngoài có thể không có số
Việt Nam): số Việt Nam được chuẩn hoá về `0xxxxxxxxx`, số quốc tế dạng `+<mã nước>…`
được giữ nguyên. Gửi tới `POST /api/vieetjk-ai/contact` → lưu vào `website_leads` với
`source = 'vieetjk-ai'`, gắn cho **cùng chủ tài khoản đang sở hữu vieetjk.com**
(dòng `sites` có `custom_domain = vieetjk.com`, dự phòng `subdomain = vieetjk`).
Yêu cầu hiện ở *Dashboard → Yêu cầu mới* (`/dashboard/studio/leads`) và được báo qua Zalo nếu
đã kết nối — phần báo cho chủ vẫn bằng tiếng Việt. Giới hạn 5 lần/phút/IP, có ô
bẫy bot ẩn.

Nếu không tìm thấy chủ tài khoản đó, API trả `no_owner` và form hiện số hotline
để khách gọi trực tiếp.
