# Tên miền phụ của studio — `*.mstudo.com`

Mỗi studio có một website riêng chạy ở `<ten-studio>.mstudo.com`. File này nói
đúng một việc: **vì sao tạo tên miền phụ xong mà trang không tự chạy, và sửa ở
đâu.**

## Ba tầng phải cùng đúng

Một tên miền phụ chỉ mở được khi CẢ BA tầng dưới đây đều đúng. Thiếu tầng nào
thì trình duyệt báo lỗi khác nhau — nhìn lỗi là biết đang vướng tầng nào.

| # | Tầng | Ai lo | Sai thì thấy gì |
|---|---|---|---|
| 1 | **DNS** — `*.mstudo.com` trỏ về Vercel | Người vận hành, làm **một lần** | Không mở được trang / lỗi tên miền của trình duyệt |
| 2 | **Vercel** — project nhận host đó | Wildcard (một lần) hoặc app tự đăng ký | Trang lỗi của Vercel: *"The deployment could not be found"* |
| 3 | **App** — có dòng `sites` khớp `subdomain` và đã **xuất bản** | Studio, trong trình tạo website | Trang 404 của mstudo |

Trước đây app chỉ lo tầng 3: lưu `sites.subdomain` vào database là xong, không ai
nói cho Vercel biết có host mới. Nên khi project **chưa có** wildcard, studio lưu
tên miền phụ, bấm xuất bản, mở link ra thì gặp trang lỗi của Vercel — app còn
chưa kịp chạy dòng nào để giải thích. Giờ `POST /api/site/subdomain` lưu xong sẽ
tự đăng ký host trên Vercel và trả về tình trạng thật.

## Thiết lập một lần (người vận hành)

### 1. DNS

Tại nhà cung cấp tên miền, thêm bản ghi wildcard:

| Loại | Tên | Giá trị |
|---|---|---|
| CNAME | `*` | `cname.vercel-dns.com` |

Dùng Cloudflare thì để bản ghi này ở chế độ **DNS only** (mây xám). Bật proxy
(mây cam) cho wildcard cần gói trả phí — không thì chứng chỉ SSL của các tên
miền phụ sẽ hỏng.

### 2. Vercel

Project → **Settings → Domains → Add** → nhập `*.mstudo.com`.

Vercel sẽ đòi thêm một bản ghi **TXT `_vercel`** để xác minh quyền sở hữu — thêm
đúng giá trị Vercel hiển thị, rồi chờ tới khi domain chuyển sang **Valid
Configuration**. Chỉ khi wildcard ở trạng thái này thì mọi tên miền phụ mới chạy
ngay mà không cần đăng ký từng cái.

### 3. Biến môi trường

| Biến | Vì sao cần |
|---|---|
| `NEXT_PUBLIC_MAIN_HOST=mstudo.com` | Thiếu là middleware **không** rẽ `<sub>.mstudo.com` vào trang studio — nó phục vụ landing như host thường |
| `VERCEL_TOKEN`, `VERCEL_PROJECT_ID` (+ `VERCEL_TEAM_ID` nếu project thuộc team) | Cho app tự đăng ký host khi **chưa** có wildcard, và tự kiểm tra tình trạng |

Wildcard và token không loại trừ nhau: có wildcard thì app không đụng gì tới
project; chưa có wildcard thì token là phương án dự phòng để tên miền phụ vẫn tự
chạy.

## Studio dùng thế nào

Trình tạo website → ô tên miền ở thanh trên → gõ tên → **Lưu**.

Cạnh ô có **chấm tình trạng** và nút **kiểm tra lại**:

| Chấm | Nghĩa là | Làm gì |
|---|---|---|
| 🟢 xanh | Host đã phục vụ được | Xuất bản là xong |
| 🟡 vàng | Đã đăng ký, đang chờ DNS xác minh | Chờ vài phút rồi bấm kiểm tra lại |
| 🟡 vàng (*"chưa nối API Vercel"*) | Máy chủ thiếu `VERCEL_TOKEN`/`VERCEL_PROJECT_ID` | Người vận hành thêm domain thủ công, hoặc khai hai biến trên |
| 🔴 đỏ | Host đang thuộc một project Vercel khác | Gỡ ở project kia rồi bấm kiểm tra lại |

Lưu tên miền xong **vẫn phải bấm Xuất bản**: trang chưa xuất bản thì
`loadTenant()` trả null và khách gặp 404. Chấm xanh mà trang vẫn 404 thì gần như
chắc chắn là chưa xuất bản.

## Tên bị cấm

`subdomainError()` trong [`src/lib/hosts.ts`](../src/lib/hosts.ts) chặn các nhãn
không thể chạy được:

- **Host của nền tảng** — `www`, `admin`, `img`, `thiep`, `album`, `api`… :
  middleware coi chúng là host hệ thống nên không bao giờ rẽ vào trang studio.
- **Nhãn hạ tầng** — `mail`, `ns1`, `cdn`, `smtp`… : DNS của chúng thường trỏ đi
  nơi khác (máy chủ mail, CDN) chứ không tới Vercel.

Trước đây trình tạo chỉ kiểm tra ký tự nên gõ `www` vẫn lưu được — rồi mở link ra
thì trắng trang mà không hiểu vì sao.

## Soi nhanh khi có studio báo lỗi

```sql
-- Studio đã lưu tên miền phụ và đã xuất bản chưa?
select subdomain, published, custom_domain, custom_domain_verified
from sites
where subdomain = 'ten-studio';
```

Rồi đối chiếu ba tầng ở bảng đầu file:

1. `dig +short ten-studio.mstudo.com` — có trả về đích của Vercel không? → tầng DNS.
2. Vercel → Settings → Domains — có `*.mstudo.com` **Valid Configuration**, hoặc
   có host riêng của studio không? → tầng Vercel.
3. Câu SQL trên — có dòng, `published = true` không? → tầng app.
