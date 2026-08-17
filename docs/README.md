# Mở file nào?

Bảng này để bạn khỏi phải đoán nên mở file nào.

## Đang chuyển từ Vercel sang VPS

Chỉ cần **một** file: [`chuyen-sang-vps.md`](./chuyen-sang-vps.md) — hướng dẫn
từng bước cho người chưa từng dùng VPS. Các file cấu hình đi kèm nằm ở
[`../deploy/`](../deploy/README.md).

## Đang chuyển mstudo sang bản 2.0

Đọc theo đúng thứ tự này:

| # | File | Dùng để |
|---|---|---|
| 1 | [`cach-don-gian-nhat.md`](./cach-don-gian-nhat.md) | **Đọc trước tiên.** So sánh hai đường đi và chọn đường ngắn hơn nếu hợp |
| 2 | [`chuyen-doi-mstudo-2.0.md`](./chuyen-doi-mstudo-2.0.md) | Hướng dẫn chính, bấm từng nút theo thứ tự |
| 3 | [`bien-moi-truong.md`](./bien-moi-truong.md) | Tra cứu biến môi trường — mở khi làm bước A3 |

Ba file trên là đủ. Không cần mở file nào khác.

## Việc khác

| File | Nội dung |
|---|---|
| [`chuyen-sang-vps.md`](./chuyen-sang-vps.md) | Rời Vercel, tự chạy trên VPS: dựng máy, HTTPS, cron, deploy tự động, sao lưu |
| [`thiet-lap-moi.md`](./thiet-lap-moi.md) | Dựng Supabase + Vercel từ số 0 (khi làm bản thử mới, không phải lúc chuyển đổi) |
| [`supabase-usage.md`](./supabase-usage.md) | Vì sao vượt hạn mức Supabase và cách kéo xuống |
| [`desktop-client-spec.md`](./desktop-client-spec.md) | Đặc tả app desktop cho gói Studio |

## Đã cũ — giữ lại chỉ để tham khảo

Đừng làm theo mấy file này, chúng ra đời trước và có chỗ mâu thuẫn với hướng dẫn
chính:

| File | Vì sao bỏ |
|---|---|
| [`runbook-chuyen-doi.md`](./runbook-chuyen-doi.md) | Bản nháp đầu, đã được `chuyen-doi-mstudo-2.0.md` viết lại |
| [`chuyen-vercel.md`](./chuyen-vercel.md) | Chỉ nói phần Vercel, chưa có Cloudflare; nội dung đã gộp vào hướng dẫn chính |
| [`gop-ban-cu-va-chuyen-doi.md`](./gop-ban-cu-va-chuyen-doi.md) | Là **kế hoạch** giải thích vì sao, không phải các bước làm |
