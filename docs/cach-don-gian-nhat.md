# Cách chuyển đơn giản hơn — dùng lại chính project Vercel cũ

Bạn đang đọc hướng dẫn [`chuyen-doi-mstudo-2.0.md`](./chuyen-doi-mstudo-2.0.md)
và thấy dài. Nó dài vì đang làm theo **Phương án 2**: dựng một project Vercel
mới hoàn toàn rồi kéo tên miền sang.

Có **Phương án 1** ngắn hơn nhiều, làm được đúng một việc bạn cần — đưa
`mstudo.com` chạy code 2.0 trên Supabase mới — mà **không đụng tới tên miền,
DNS, chứng chỉ HTTPS, domain riêng của khách, hay 32 biến môi trường**.

---

## Ý tưởng

Project Vercel không "thuộc về" một repo GitHub nào cả. Nó chỉ **nối** tới một
repo, và cái nối đó **đổi được bằng hai cú bấm**.

Nên thay vì bê tên miền sang project mới, ta làm ngược lại: **giữ nguyên project
cũ, đổi nguồn code của nó sang repo mới.**

| | Phương án 1 — đổi repo của project cũ | Phương án 2 — project mới + kéo tên miền |
|---|---|---|
| Biến môi trường | **giữ nguyên**, chỉ sửa 3 khoá Supabase + thêm `CRON_SECRET` | chép tay hoặc dán lại cả 32 biến |
| `mstudo.com`, `www`, `img`, `admin`, `thiep`, `*.mstudo.com` | **không đụng tới** | gỡ bên cũ, thêm bên mới, sửa DNS, chờ cấp chứng chỉ |
| Domain riêng của studio khách | **không đụng tới** | phải liệt kê từ DB rồi thêm lại từng cái |
| `VERCEL_PROJECT_ID` | **vẫn đúng** | phải đổi, quên là hỏng âm thầm |
| Cloudflare | không bắt buộc, làm lúc nào cũng được | phải xong trước đêm cắt |
| Cron | tự chạy tiếp | tự chạy tiếp |
| Gián đoạn | chỉ trong lúc chép dữ liệu | chép dữ liệu + chờ DNS/chứng chỉ |
| Quay đầu khi hỏng | 1 cú bấm **Rollback**, hiệu lực tức thì | đổi DNS ngược lại, chờ lan truyền |

Phần khó thật sự — **chép dữ liệu từ Supabase cũ sang Supabase mới** (Phần B4–B8)
— giống hệt nhau ở cả hai phương án. Phương án 1 chỉ cắt bỏ phần hạ tầng.

---

## Khi nào KHÔNG dùng Phương án 1

Chỉ có ba trường hợp:

1. **Bạn muốn rời hẳn tài khoản Vercel cũ** (đổi chủ sở hữu, đổi bên thanh toán,
   không còn quyền vào project cũ nữa).
2. **Bạn muốn hai bản chạy song song** một thời gian để so sánh.
3. Project cũ đang bị khoá vì quá hạn mức và bạn không định trả tiền cho nó.

Ngoài ba trường hợp đó, Phương án 1 luôn nhẹ hơn.

> Project `mstudo-v2` mới trên Vercel **không phí đi đâu cả**: giữ lại làm bản
> thử (staging) chạy trên `*.vercel.app`. Sửa gì cứ thử ở đó trước.

---

## Các bước

### Bước 1 — chuẩn bị (không gián đoạn, làm trước lúc nào cũng được)

Làm y hệt hướng dẫn chính, **chỉ 4 mục**:

- **A0** — kiểm tra repo cũ còn commit nào chưa gộp không (làm lại lần cuối ngay
  trước đêm cắt).
- **A1** — soi Supabase MỚI đang có gì.
- **A2** — chạy `supabase/setup-all.sql` trên Supabase MỚI.
- **A5** — chạy thử PHẦN 1 của script chép để chắc chắn kết nối được.

Bỏ qua A3 (biến môi trường — giữ nguyên bên cũ), A6, A7 và **cả Phần 0
(Cloudflare)**.

### Bước 2 — cho Vercel thấy repo mới

Vercel → **project CŨ** → **Settings** → **Git**.

1. Mục **Connected Git Repository** → **Disconnect**.
2. Bấm **Connect Git Repository** → chọn `vieetjk6-afk/mstudo-v2`.
   Không thấy repo trong danh sách → bấm **Adjust GitHub App Permissions** và
   cấp quyền cho repo này.
3. **Production Branch**: `main`.

Đổi nối repo **không** làm mất tên miền, biến môi trường, hay bản deploy đang
chạy. Trang vẫn phục vụ bản cũ cho tới khi có bản deploy mới.

> ⚠️ Đừng bấm Deploy vội. Bản deploy mới sẽ dùng code 2.0 **nhưng vẫn trỏ vào
> Supabase cũ** (vì 3 khoá chưa đổi). Nếu lỡ deploy, xem "Lỡ tay" ở cuối trang.

### Bước 3 — thêm đúng 1 biến, sửa đúng 3 biến (làm ở đêm cắt)

Vercel → project CŨ → Settings → Environment Variables:

| Biến | Làm gì | Giá trị |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **sửa** | Project URL của Supabase **MỚI** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **sửa** | khoá `anon public` của Supabase **MỚI** |
| `SUPABASE_SERVICE_ROLE_KEY` | **sửa** | khoá `service_role` của Supabase **MỚI** |
| `CRON_SECRET` | **thêm mới** | một chuỗi ngẫu nhiên dài (xem A3) |

Hết. **28 biến còn lại không đụng tới** — chúng đã đúng sẵn, kể cả
`VERCEL_PROJECT_ID`, 5 URI callback của Google, cặp khoá VAPID, và mọi khoá bí
mật mà bạn không xem lại được.

Đây chính là chỗ Phương án 1 tiết kiệm nhất: **toàn bộ chương 7 của
[`bien-moi-truong.md`](./bien-moi-truong.md) ("lấy lại giá trị bị ẩn") trở nên
thừa** — bạn không cần đọc được giá trị nào cả, vì chúng nằm yên tại chỗ.

### Bước 4 — khai callback ở bên thứ ba

Vẫn phải làm, nhưng chỉ còn **một dòng duy nhất**: Google Cloud Console →
Credentials → OAuth 2.0 Web client → **Authorized redirect URIs** → thêm

```
https://<mã-project-Supabase-MỚI>.supabase.co/auth/v1/callback
```

Lý do và cách lấy chính xác: mục **A4** của hướng dẫn chính. Cùng với đó,
Supabase MỚI → Authentication → URL Configuration → **Site URL** =
`https://mstudo.com`, **Redirect URLs** += `https://mstudo.com/**`.

Bốn URI Drive/Story và Zalo giữ nguyên — cùng tên miền, cùng đường dẫn.

### Bước 5 — đêm cắt

1. **B2** — báo studio dừng nhập liệu.
2. **B3** — khoá bản cũ (đặt biển bảo trì).
3. **B4 → B8** — chép dữ liệu và file Storage sang Supabase MỚI, sửa URL ảnh.
   **Không được bỏ B7b.**
4. Vercel → sửa 3 khoá + thêm `CRON_SECRET` (Bước 3 ở trên).
5. Vercel → **Deployments** → **Redeploy** bản mới nhất *(hoặc push một commit
   lên `main`)*. Đây là lúc `mstudo.com` chuyển sang bản 2.0.
6. **B10** — mở cửa sổ ẩn danh, chạy hết danh sách kiểm tra.

**Không có bước đổi DNS. Không chờ chứng chỉ. Không gỡ/thêm domain nào.**

### Bước 6 — nếu hỏng, quay đầu

Vercel → **Deployments** → tìm bản deploy cuối cùng của code cũ → `⋯` →
**Instant Rollback** (hoặc **Promote to Production**). Hiệu lực trong vài giây.

Rồi đổi 3 khoá Supabase về giá trị **cũ** và Redeploy — dữ liệu ở Supabase cũ
vẫn còn nguyên vì bản 2.0 ghi vào project khác.

So với Phương án 2 (đổi DNS ngược, chờ lan truyền), đây là đường lùi tốt hơn hẳn.

---

## Lỡ tay deploy code 2.0 khi chưa chép dữ liệu?

Không sao, và đây là điều đáng biết trước:

- Code 2.0 + 3 khoá Supabase **cũ** = app chạy bình thường trên **dữ liệu thật
  cũ**. Không mất gì. Đây thật ra là một cách test rất tốt.
- Code 2.0 + 3 khoá Supabase **mới** khi chưa chép = app chạy trên **dữ liệu bản
  chép hồi dựng v2**, tức thiếu việc của mấy tuần gần đây. Studio sẽ báo "mất
  hợp đồng". Đổi 3 khoá về cũ + Rollback là trở lại như thường.

Điều duy nhất **không** quay lại được là chạy `clone-from-old-project.sql` nhầm
hướng (chép từ mới sang cũ). Script luôn chạy trên project **đích** — kiểm tra
mã project trên thanh địa chỉ trước khi bấm Run, đúng như cảnh báo ở A1.

---

## Còn Cloudflare thì sao?

Việc đưa DNS về Cloudflare (Phần 0) là **một việc độc lập**, không liên quan gì
tới chuyện đổi code. Làm trước, làm sau, hay không làm cũng được — app không
biết ai đang phục vụ DNS.

Nếu vẫn muốn làm, cứ theo Phần 0 nguyên văn, nhưng làm nó vào một ngày khác hẳn
với đêm cắt dữ liệu. Gộp hai việc vào một đêm là cách chắc chắn nhất để không
biết cái nào hỏng.
