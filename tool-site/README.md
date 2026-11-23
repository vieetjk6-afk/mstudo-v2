# tool.vieetjk.com

Trang tổng hợp phần mềm để tải về. Trang tĩnh thuần (HTML/CSS/JS), không cần build,
không dính gì tới app Next.js của mstudo (thư mục này được bỏ qua khi lint/build).

| File | Dùng để |
|---|---|
| `tools.js` | **Danh sách phần mềm + liên hệ.** Thêm / sửa / ẩn phần mềm chỉ cần sửa file này |
| `index.html` | Khung trang |
| `style.css` | Giao diện (tự sáng / tối theo máy) |
| `app.js` | Hiện danh sách, tìm kiếm không dấu, lọc nhóm, hộp chi tiết, lấy bản mới nhất từ GitHub |

## Thêm phần mềm mới

1. Mở `tools.js`, chép một khối `{ ... }` trong mảng `tools`, dán vào cuối.
2. Sửa `id`, `name`, `tagline`, `category`, `platforms`, `price`, `icon`, `features`.
3. Link tải:
   - Phần mềm phát hành trên **GitHub Releases** (repo công khai): đặt
     `github: { repo: 'vieetjk6-afk/TenRepo', asset: 'TenFile.zip' }`. Trang tự hiện
     phiên bản, dung lượng và nút **Tải về** luôn trỏ tới bản mới nhất. Không phải sửa trang mỗi lần ra bản mới.
   - Còn lại (repo riêng tư, Supabase, trang web riêng…): đặt `download: 'https://...'`.
4. Nhóm mới thì thêm vào `categories`.
5. Đẩy lên nhánh chính, trang tự cập nhật.

Mỗi phần mềm có link riêng dạng `https://tool.vieetjk.com/#id` (mở thẳng hộp chi tiết) để gửi khách.

## Đưa lên tool.vieetjk.com

**Cloudflare Workers** (màn "Set up your application" khi kết nối repo):

| Ô | Giá trị |
|---|---|
| Project name | `vieetjk-tools` (khớp `name` trong `wrangler.jsonc`) |
| Build command | *(xoá trống)* |
| Deploy command | `npx wrangler deploy` |
| Advanced settings → Path | `tool-site` |

Deploy xong: Worker → Settings → Domains & Routes → Add → Custom domain → `tool.vieetjk.com`.

**Cloudflare Pages** (khuyến nghị, miễn phí):

1. Cloudflare → Workers & Pages → Create → Pages → Connect to Git → chọn repo `mstudo-v2`.
2. Framework preset: **None** · Build command: *(để trống)* · Build output directory: `tool-site`.
3. Sau khi chạy xong: Custom domains → thêm `tool.vieetjk.com` (nếu domain `vieetjk.com` nằm
   trên Cloudflare thì bản ghi DNS tự tạo; nếu không, thêm CNAME `tool` → `<tên-project>.pages.dev`).

**Vercel** (tạo project mới, không đụng project mstudo):

1. Add New → Project → chọn repo `mstudo-v2` → Root Directory: `tool-site` · Framework: **Other** · không build command.
2. Settings → Domains → thêm `tool.vieetjk.com`, rồi thêm CNAME `tool` → `cname.vercel-dns.com` ở nơi quản lý domain.

## Xem thử trên máy

```bash
cd tool-site && python3 -m http.server 8000
```
rồi mở http://localhost:8000
