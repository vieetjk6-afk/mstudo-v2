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
| 2 | **Vercel** — project nhận host đó | App tự đăng ký từng host (hoặc wildcard, nếu dùng nameserver Vercel) | Trang lỗi của Vercel: *"The deployment could not be found"* |
| 3 | **App** — có dòng `sites` khớp `subdomain` và đã **xuất bản** | Studio, trong trình tạo website | Trang 404 của mstudo |

Trước đây app chỉ lo tầng 3: lưu `sites.subdomain` vào database là xong, không ai
nói cho Vercel biết có host mới. Nên khi project **chưa có** wildcard, studio lưu
tên miền phụ, bấm xuất bản, mở link ra thì gặp trang lỗi của Vercel — app còn
chưa kịp chạy dòng nào để giải thích. Giờ `POST /api/site/subdomain` lưu xong sẽ
tự đăng ký host trên Vercel và trả về tình trạng thật.

## Wildcard `*.mstudo.com` KHÔNG dùng được với DNS ngoài

Đọc kỹ chỗ này trước khi mất buổi chiều như lần đầu.

**Vercel bắt buộc domain phải dùng nameserver của chính Vercel thì mới thêm được
wildcard.** Không có cách nào lách bằng bản ghi TXT. Lý do kỹ thuật: chứng chỉ
wildcard phải xin qua **DNS-01 challenge**, tức Vercel phải tự tạo và tự xoay
bản ghi `_acme-challenge` mỗi lần gia hạn — nó chỉ làm được khi cầm luôn zone
DNS.

Vì vậy khi DNS đang ở Cloudflare, thêm `*.mstudo.com` vào project sẽ kẹt mãi ở
**Verification Required**, và khung "DNS configuration" chỉ hiện đúng một dòng
*"Move this domain to this team to use Vercel nameservers"* — không có bảng TXT
nào để làm theo.

> Bản ghi **TXT `_vercel`** là chuyện khác: nó dùng để xác minh một domain
> **thường** đang thuộc tài khoản Vercel khác. Đừng nhầm hai việc này.

Điều đó KHÔNG có nghĩa là tên miền phụ không chạy được — subdomain đăng ký lẻ
vẫn chạy bình thường với DNS ngoài. `thiep.mstudo.com`, `admin.mstudo.com`,
`img.mstudo.com` đang chạy đúng kiểu đó.

## Thiết lập một lần (người vận hành) — chọn MỘT đường

### Đường A — giữ DNS ở Cloudflare, app tự đăng ký từng subdomain

Đường đang dùng. Không đụng tới nameserver.

**1. Cloudflare** → DNS → Add record. Một bản ghi này phủ mọi studio:

| Type | Name | Content | Proxy |
|---|---|---|---|
| CNAME | `*` | `cname.vercel-dns.com` | **DNS only** (mây xám) |

Phải để mây xám: bật proxy thì Cloudflare chặn giữa, Vercel không xác minh và
cấp chứng chỉ cho từng host được.

**2. Vercel** → **đừng** thêm `*.mstudo.com` vào project (nó sẽ kẹt vĩnh viễn ở
Verification Required). Chỉ cần ba biến môi trường ở mục 3 bên dưới.

**3.** Xong. Studio lưu tên miền phụ → `/api/site/subdomain` gọi API đăng ký
đúng host đó với Vercel → Vercel cấp chứng chỉ riêng cho host đó → chạy.

Điểm phải để ý: **Vercel giới hạn số domain trên mỗi project.** Vài chục studio
thì thoải mái; quy mô hàng nghìn thì tính lại đường B.

### Đường B — chuyển nameserver sang Vercel để dùng wildcard thật

Đổi lại: mọi tên miền phụ chạy ngay, không phụ thuộc API, không lo giới hạn số
domain.

Cái giá: **trước khi đổi nameserver phải chép TOÀN BỘ bản ghi DNS từ Cloudflare
sang Vercel DNS** — MX, SPF/DKIM, các subdomain đang chạy, mọi TXT xác minh của
dịch vụ khác. Sót bản ghi MX là mất email. Và mất luôn Cloudflare proxy/WAF.

Các bước: Vercel → Domains → **Move this domain** để đưa `mstudo.com` về team →
dựng lại bản ghi trong Vercel DNS → đổi nameserver ở nơi mua tên miền sang
nameserver Vercel → chờ lan truyền → thêm `*.mstudo.com` vào project.

Ngược với `chuyen-doi-mstudo-2.0.md` phần 0 (chỗ cố ý đưa DNS về Cloudflare), nên
chỉ đi đường này khi đã quyết bỏ Cloudflare.

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
2. Vercel → Settings → Domains — có dòng `ten-studio.mstudo.com` **Valid
   Configuration** không? → tầng Vercel. (Dòng `*.mstudo.com` kẹt ở
   *Verification Required* là bình thường khi DNS ở Cloudflare — bỏ qua nó.)
3. Câu SQL trên — có dòng, `published = true` không? → tầng app.
