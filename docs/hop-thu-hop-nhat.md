# Bật hộp thư hợp nhất — lấy biến môi trường ở đâu

Hộp thư gom tin nhắn khách từ Zalo, Facebook, Instagram, TikTok và chatbox
website về một chỗ (Dashboard → Kinh doanh → **Hộp thư**). Code đã lên `main`; tài liệu này
là phần **phải làm tay** để nó chạy thật.

Bốn biến cần thêm. Hai biến bạn **tự sinh ra**, hai biến phải **đi lấy**:

| Biến | Lấy ở đâu | Bắt buộc khi |
| --- | --- | --- |
| `INBOX_INGEST_SECRET` | bạn tự sinh | dùng kênh Zalo cá nhân **hoặc TikTok** |
| `META_VERIFY_TOKEN` | bạn tự đặt | dùng Facebook / Instagram |
| `META_APP_SECRET` | Meta App | dùng Facebook / Instagram |
| `ZALO_OA_WEBHOOK_SECRET` | Zalo App | dùng Zalo OA |

Không dùng kênh nào thì bỏ qua biến của kênh đó — các kênh độc lập nhau. Chatbox
website chạy sẵn, **không cần biến nào**.

> **Page Access Token của Facebook KHÔNG nằm ở đây.** Nó dán trong giao diện
> (Hộp thư → Kênh), vì mỗi studio một trang khác nhau và token được mã hoá trước
> khi lưu. Biến môi trường chỉ giữ những thứ dùng chung cho cả nền tảng.

---

## Làm theo đúng thứ tự này

Thứ tự quan trọng: Meta sẽ **gọi ngược vào URL của bạn** để xác minh, nên biến
phải có trên máy chủ TRƯỚC khi bạn bấm nút xác minh bên Meta. Làm ngược lại thì
Meta báo lỗi và bạn sẽ đi tìm nguyên nhân ở nhầm chỗ.

1. Chạy SQL tạo bảng
2. Lấy / sinh các biến (mục 1–4 dưới đây)
3. Dán vào Vercel rồi **Redeploy**
4. Khai webhook bên Meta / Zalo
5. Kiểm tra

---

## Bước 1 — Chạy SQL

Supabase → **SQL Editor** → dán trọn nội dung
`supabase/migrations/inbox_unified.sql` → **Run**.

Rồi chạy tiếp `supabase/migrations/inbox_tiktok.sql` (nới danh sách kênh cho
TikTok). Chạy lại nhiều lần vô hại (idempotent). Xong sẽ có 4 bảng mới: `inbox_channels`,
`inbox_contacts`, `inbox_conversations`, `inbox_messages`.

---

## Bước 2 — Lấy từng biến

### 1. `INBOX_INGEST_SECRET` — bạn tự sinh

Đây là mật khẩu của **cửa nhận tin** `/api/inbox/ingest` — dùng chung cho tiến
trình lắng nghe Zalo cá nhân và cầu nối TikTok. Không ai cấp cho bạn, bạn tự tạo
một chuỗi ngẫu nhiên:

```bash
openssl rand -hex 32
```

Chép kết quả. Chuỗi này phải **giống hệt** ở hai nơi: biến môi trường trên
Vercel, và phía bên kia của cửa — máy chạy worker Zalo, hoặc đối tác TikTok.

Để trống thì cửa `/api/inbox/ingest` **khoá hẳn** (trả 503) — đó là chủ ý, không
phải lỗi: một endpoint ghi thẳng vào hộp thư mà không có mật khẩu thì ai cũng
bơm tin giả vào được.

Cần biến này nếu bạn dùng **Zalo cá nhân** hoặc **TikTok** — hai kênh duy nhất
đi qua cửa ingest. Zalo OA, Facebook và Instagram đi bằng webhook có chữ ký
riêng nên cố ý **không** được phép dùng cửa này: mở ra là hạ một xác thực mạnh
xuống còn "ai biết bí mật dùng chung cũng vào được".

### 2. `META_VERIFY_TOKEN` — bạn tự đặt

Cũng là chuỗi bạn tự nghĩ ra. Meta không cấp — nó chỉ là mật khẩu một lần để
Meta chứng minh "đúng là bạn khai URL này":

```bash
openssl rand -hex 16
```

Bạn sẽ dán đúng chuỗi này vào ô **Verify Token** bên Meta ở bước 4.

### 3. `META_APP_SECRET` — lấy trong Meta App

Cần một Meta App. Nếu studio chưa có:

1. Vào **developers.facebook.com** → đăng nhập bằng tài khoản Facebook quản lý
   fanpage → **My Apps** → **Create App**.
2. Chọn loại app cho doanh nghiệp (Meta hay đổi nhãn — chọn cái nói về
   *Business* / nhắn tin với khách hàng, không phải Gaming).
3. Trong app → **App settings → Basic** → dòng **App Secret** → bấm **Show** →
   chép chuỗi đó. **Đó là `META_APP_SECRET`.**

App Secret dùng để kiểm chữ ký `X-Hub-Signature-256` của mọi tin webhook gửi
tới. Thiếu nó thì endpoint từ chối hết (503) — cố ý, vì URL webhook là công
khai, không kiểm chữ ký thì bất kỳ ai cũng nhét được tin giả vào hộp thư và đốt
hạn mức AI của bạn.

> App Secret là **bí mật cấp cao nhất** của Meta App — ai có nó thì giả mạo được
> app của bạn. Chỉ dán vào Vercel, đừng để trong code hay ảnh chụp màn hình.

Trong lúc còn ở đây, thêm luôn sản phẩm cho app: **Messenger** (cho fanpage) và
**Instagram** (cho IG DM). Instagram doanh nghiệp phải đã liên kết với một
fanpage thì tin nhắn IG mới đi qua được đường này.

### 4. `ZALO_OA_WEBHOOK_SECRET` — lấy trong Zalo App

1. Vào **developers.zalo.me** → mở Zalo App bạn đã dùng cho tính năng nhắn Zalo
   tự động (chính là app có `ZALO_OA_APP_ID` đang chạy).
2. Vào sản phẩm **Official Account** → mục **Webhook**.
3. Ở đó có **OA Secret Key** — chép chuỗi đó.

Zalo ký mỗi sự kiện bằng khoá này (`X-ZEvent-Signature`), khác với App Secret
dùng cho OAuth.

**Không tìm thấy ô đó?** Cứ để biến trống — code tự rơi về `ZALO_OA_APP_SECRET`
bạn đã có. Nhưng đây là đường lùi, không phải đường đúng: nếu Zalo thực sự ký
bằng OA Secret Key khác thì mọi tin sẽ bị từ chối với 403 và hộp thư im lặng.
Thấy 403 trong log Vercel thì quay lại tìm cho ra OA Secret Key.

`ZALO_OA_APP_ID` cũng phải có sẵn (bạn đã đặt từ trước cho tính năng nhắc lịch
Zalo) — chữ ký tính từ cả hai.

---

## Bước 3 — Dán vào Vercel rồi redeploy

Vercel → project → **Settings → Environment Variables** → thêm từng biến, tích
môi trường **Production** (và **Preview** nếu bạn có bản thử).

```
INBOX_INGEST_SECRET       = <chuỗi từ mục 1>
META_VERIFY_TOKEN         = <chuỗi từ mục 2>
META_APP_SECRET           = <App Secret từ mục 3>
ZALO_OA_WEBHOOK_SECRET    = <OA Secret Key từ mục 4>
```

Rồi **Deployments → bản mới nhất → Redeploy**.

Đây là chỗ hay vấp nhất: **thêm biến KHÔNG tự áp dụng cho bản đang chạy.** Chưa
redeploy mà đã sang Meta bấm xác minh thì máy chủ vẫn chưa biết
`META_VERIFY_TOKEN`, Meta báo lỗi, và bạn sẽ ngồi kiểm tra lại chuỗi token vốn
đã đúng.

---

## Bước 4 — Khai webhook

URL chính xác hiện sẵn kèm nút chép trong **Hộp thư → Kênh**. Dạng của nó:

```
https://<tên-miền-của-bạn>/api/inbox/webhook/meta     ← Facebook + Instagram (dùng CHUNG một URL)
https://<tên-miền-của-bạn>/api/inbox/webhook/zalo     ← Zalo OA
```

**Bên Meta** — trong app → **Webhooks**:

- Callback URL: URL `/meta` ở trên
- Verify Token: đúng chuỗi `META_VERIFY_TOKEN`
- Bấm **Verify and Save**
- Đăng ký sự kiện **`messages`** — làm cho **cả hai** sản phẩm Messenger và
  Instagram, vì đó là hai đăng ký riêng dù chung một URL
- Vào **Messenger → Settings**, liên kết fanpage của studio và bấm **Generate
  Token** → chép Page Access Token → dán vào **Hộp thư → Kênh** trong MStudo
  (kèm Page ID), **không** dán vào Vercel

**Bên Zalo** — Zalo App → **Webhook**: dán URL `/zalo`, bật sự kiện *người dùng
gửi tin nhắn*. Sau đó vào **Hộp thư → Kênh** bấm **Nối Zalo vào hộp thư** (nó
dùng lại tài khoản Zalo bạn đã kết nối, không phải cấp quyền lại từ đầu).

### Một điều về Meta nên biết trước

App mới tạo chạy ở chế độ **Development**: chỉ nhắn được với tài khoản là
admin/developer/tester của chính app đó. Khách thật nhắn vào sẽ **không** tới.
Muốn phục vụ khách thật phải qua **App Review** của Meta để xin quyền
`pages_messaging` (và `instagram_manage_messages` cho IG). Đây là khâu duyệt của
Meta, mất vài ngày và nằm ngoài tầm code.

Vì vậy nên **thử bằng tài khoản Facebook của chính bạn trước** (thêm nó làm
tester), xác nhận tin chạy về hộp thư, rồi mới nộp duyệt.

---

## Bước 5 — Kiểm tra

**Endpoint xác minh Meta còn sống không** (thay tên miền và token của bạn):

```bash
curl "https://<tên-miền>/api/inbox/webhook/meta?hub.mode=subscribe&hub.verify_token=<META_VERIFY_TOKEN>&hub.challenge=12345"
```

Đúng thì in ra `12345`. Ra `forbidden` nghĩa là token lệch hoặc chưa redeploy.

**Cửa nhận tin (Zalo cá nhân / TikTok) đã khoá đúng chưa:**

```bash
curl -i -X POST https://<tên-miền>/api/inbox/ingest
```

Mong đợi `401` (có `INBOX_INGEST_SECRET`, và bạn gọi mà không có mật khẩu →
đúng). Nếu ra `503` là biến chưa tới máy chủ — chưa redeploy.

**Thử thật:** nhắn một tin từ tài khoản khác vào fanpage / OA. Trong vài giây
hội thoại phải hiện ở Hộp thư và trợ lý AI trả lời. Không thấy gì thì mở
**Vercel → Deployments → Logs**, lọc `[inbox/` — mọi lỗi đều ghi ở đó kèm lý do.

---

## Riêng TikTok — nối qua cầu nối

TikTok **có** API nhắn tin (Business Messaging API) cho **tài khoản doanh
nghiệp**, và Việt Nam nằm trong khu vực được hỗ trợ (châu Á – Thái Bình Dương;
API này *không* mở cho EU, Anh, Thuỵ Sĩ và Mỹ). Nhưng nó còn ở giai đoạn beta và
trên thực tế phải đi qua một **đối tác nhắn tin** được TikTok công nhận —
TikTok có hẳn chương trình *Messaging Partner* cho Đông Nam Á.

Vì vậy MStudo **không** nối thẳng TikTok như Meta. Kênh TikTok dùng một **cầu
nối**: một giao thức nhỏ, ai cũng cắm vào được — đối tác nhắn tin, hay chính
connector của bạn nếu sau này TikTok cấp quyền API trực tiếp.

```
Khách nhắn TikTok  →  đối tác  →  POST /api/inbox/ingest       →  Hộp thư
Nhân viên trả lời  →  MStudo POST tới URL cầu nối của đối tác   →  Khách
```

**Cách nối:**

1. Chạy `supabase/migrations/inbox_tiktok.sql` (nới danh sách kênh hợp lệ — chạy
   sau `inbox_unified.sql`; cài mới hoàn toàn thì file nền đã có sẵn TikTok).
2. Đặt `INBOX_INGEST_SECRET` như mục 1 — TikTok dùng chung cửa nhận tin với
   Zalo cá nhân.
3. Vào **Hộp thư → Kênh → TikTok**, khai:
   - **Tài khoản TikTok** — định danh đối tác dùng để chỉ đúng tài khoản của bạn
   - **URL cầu nối** — địa chỉ đối tác nhận tin trả lời (bắt buộc `https`)
   - **Khoá ký** — chuỗi bí mật dùng chung với đối tác
4. Đưa cho đối tác: địa chỉ `https://<tên-miền>/api/inbox/ingest` và
   `INBOX_INGEST_SECRET` (họ gửi kèm header `Authorization: Bearer <secret>`).

**Tin vào** — đối tác POST vào `/api/inbox/ingest`:

```json
{
  "platform": "tiktok",
  "channelId": "@maistudio.vn",
  "messageId": "id-tin-ben-tiktok",
  "from": { "id": "openid-cua-khach", "name": "linh.pham2004" },
  "text": "chụp kỷ yếu bao nhiêu ạ",
  "attachments": [{ "type": "image", "url": "https://..." }]
}
```

`messageId` không bắt buộc nhưng **nên có**: nó là thứ chặn ghi trùng khi đối
tác bắn lại một tin cũ.

**Tin ra** — MStudo POST tới URL cầu nối, kèm header
`X-Mstudo-Signature: t=<giây>,s=<hex>`. Chữ ký là HMAC-SHA256 của chuỗi
`<t>.<body>` với khoá ký ở trên (dấu thời gian nằm **trong** phần được ký, nên
không ai sửa được `t` để phát lại tin cũ). Thân tin:

```json
{
  "platform": "tiktok",
  "channelId": "@maistudio.vn",
  "conversationId": "…",
  "to": { "id": "openid-cua-khach", "name": "linh.pham2004" },
  "text": "Dạ gói kỷ yếu bên em từ 3 triệu ạ"
}
```

Cầu nối trả mã khác 2xx thì tin được ghi là **gửi hỏng** kèm nguyên văn lý do và
hiện viền đỏ trong khung chat — nhân viên biết ngay mà gọi điện.

**Vì sao MStudo không tự chặn cửa sổ trả lời cho TikTok:** luật đó nằm ở phía
TikTok/đối tác và chưa được công bố rõ. Đặt một con số đoán mò sẽ chặn nhầm
những tin lẽ ra gửi được. Cầu nối từ chối thì tin thành "gửi hỏng" — đúng đường
đã có sẵn, không phải im lặng.

> **URL cầu nối phải là `https` và không được trỏ vào địa chỉ nội bộ**
> (`localhost`, `10.x`, `192.168.x`, `169.254.169.254`…). Máy chủ tự gọi URL đó
> bằng danh tính của mình, nên đây là hàng rào chống SSRF, không phải khó tính.
> Hệ thống chặn ngay lúc bạn bấm nối.

---

## Riêng Zalo cá nhân

Zalo cá nhân **không có webhook**. Muốn nhận tin phải chạy thêm một tiến trình
trên máy studio hoặc một VPS nhỏ (phần *gửi* thì app tự làm được):

```bash
npm i zca-js @supabase/supabase-js

export NEXT_PUBLIC_SUPABASE_URL=...        # cùng project với app
export SUPABASE_SERVICE_ROLE_KEY=...
export ZALO_SESSION_SECRET=...             # đúng khoá app dùng để mã hoá phiên
export MSTUDO_URL=https://<tên-miền>
export INBOX_INGEST_SECRET=...             # TRÙNG với biến trên Vercel

npm run inbox:zalo-worker
```

Ba biến Supabase và `ZALO_SESSION_SECRET` lấy nguyên từ Vercel (Settings →
Environment Variables → bấm hiện giá trị).

Máy tắt thì ngừng nhận tin — tin nhắn trong lúc đó không được ghi lại. Nếu studio
không có máy chạy 24/7 thì nên dùng Zalo OA thay vì Zalo cá nhân.

> ⚠️ Nhắc lại cảnh báo cũ: tự động hoá tài khoản Zalo cá nhân **vi phạm điều
> khoản của Zalo** và có thể bị khoá tài khoản. Zalo OA là kênh chính thống.

---

## Tóm tắt: cần gì cho từng kênh

| Muốn dùng | Cần |
| --- | --- |
| Chatbox website | không cần gì — chạy sẵn sau khi chạy SQL |
| Zalo OA | `ZALO_OA_WEBHOOK_SECRET` + khai webhook + bấm "Nối Zalo" |
| Facebook Messenger | `META_APP_SECRET`, `META_VERIFY_TOKEN` + Page Access Token dán trong UI + App Review |
| Instagram DM | như Facebook, thêm IG doanh nghiệp đã liên kết fanpage |
| Zalo cá nhân | `INBOX_INGEST_SECRET` + một máy chạy worker liên tục |
| TikTok | `INBOX_INGEST_SECRET` + một đối tác nhắn tin TikTok (khai URL cầu nối trong UI) |

AI trả lời dùng lại `CHAT_PROVIDERS` bạn đã cấu hình cho chatbox website —
không phải khai thêm khoá nào.
