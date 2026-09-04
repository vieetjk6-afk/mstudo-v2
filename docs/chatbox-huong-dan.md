# Chatbox tư vấn — hướng dẫn đầy đủ từ số 0

Bạn chưa làm gì cho phần chatbox. File này đi từ đầu đến cuối: **lấy khoá AI ở
đâu, dán vào đâu, chạy SQL nào, dạy bot thế nào, thử ra sao** — và một bảng
"thấy lỗi này thì do đâu" ở cuối.

**Thời gian:** ~15 phút cho bản chạy được. **Tiền:** 0 đồng (Gemini có gói miễn phí).

> Nếu chỉ muốn làm nhanh: đọc **Bước 1 → Bước 2 → Bước 4 → Bước 5**. Bốn bước đó
> là đủ để chatbox trả lời khách. Ba bước còn lại là nâng cấp.

---

## 0. Trước khi bắt đầu — chatbox hiện ra ở ĐÂU

Đây là chỗ dễ mất một buổi nhất, nên nói trước.

Khung chat (bong bóng góc phải màn hình) **chỉ hiện trên trang web dùng giao
diện `vieetjk`** — tức là:

| Trang | Có bong bóng chat? |
|---|---|
| `vieetjk.com` (hoặc `vieetjk.<tên-miền>`) | ✅ có |
| Site của studio có `sites.template = 'vieetjk'` | ✅ có |
| Site studio dựng bằng trình kéo-thả (`/dashboard/site/builder`) | ❌ **không** — chỉ có nút liên hệ Zalo/điện thoại |
| Khu quản lý `/dashboard`, trang album, trang khách | ❌ không |

Lý do: widget được gắn trong `VieetjkChrome`
([`src/components/vieetjk/ChatWidget.tsx`](../src/components/vieetjk/ChatWidget.tsx)),
còn `SiteRenderer` — bộ dựng site cho studio khách — chỉ gắn `SiteContactFab`.

**Nghĩa là:** mục *Cấu hình chatbox* hiện trong dashboard của **mọi** studio từ
gói Photographer trở lên, nhưng cái khung chat thật thì hiện nay chỉ chạy cho
site vieetjk. Đây là giới hạn của bản hiện tại, không phải bạn cấu hình thiếu —
xem [mục 8](#8-ba-giới-hạn-của-bản-hiện-tại).

---

## 1. Bức tranh: chatbox có ba lớp, làm rời nhau được

```
   ┌─ Lớp 1: BỘ NÃO ─────────────────────────────────────────┐
   │  Khoá API của một hãng AI, khai ở Vercel                 │
   │  → thiếu lớp này: khách chat, bot đáp "chưa trả lời được"│
   └──────────────────────────────────────────────────────────┘
                              ↓
   ┌─ Lớp 2: KIẾN THỨC RIÊNG ────────────────────────────────┐
   │  Lời chào + chính sách + FAQ bạn gõ trong dashboard       │
   │  → thiếu lớp này: bot vẫn chạy, nhưng nói chung chung     │
   └──────────────────────────────────────────────────────────┘
                              ↓
   ┌─ Lớp 3: HAI CHIỀU (tuỳ chọn) ───────────────────────────┐
   │  Hộp thư hợp nhất: bạn "tiếp quản" và tự trả lời khách   │
   │  → thiếu lớp này: bot nói một mình, không ai chen vào được│
   └──────────────────────────────────────────────────────────┘
```

Bot **đã biết sẵn** dịch vụ, các gói và thông tin liên hệ (đọc từ
[`src/lib/vieetjk/content.ts`](../src/lib/vieetjk/content.ts)) — bạn **không cần
gõ lại bảng giá** ở lớp 2.

Bot cũng **tra được trạng thái hợp đồng/album** cho khách, nhưng chỉ khi khách
nhắn đúng số điện thoại đã ghi trong hợp đồng (số điện thoại đóng vai mật khẩu,
đúng như cổng `/c/[token]`). Việc này tự chạy, không cần cấu hình gì.

---

## 2. Bước 1 — Lấy khoá AI (5 phút, miễn phí)

Dùng **Google Gemini** vì có gói miễn phí và không cần thẻ tín dụng.

1. Mở <https://aistudio.google.com> → đăng nhập bằng tài khoản Google.
2. Bấm **Get API key** (góc trái, hoặc menu ☰ → *API keys*).
3. Bấm **Create API key** → chọn một project Google Cloud có sẵn, hoặc để nó tự
   tạo project mới.
4. Nó hiện một chuỗi bắt đầu bằng `AIza…`. **Copy ngay** — đóng hộp thoại rồi
   thì phải vào lại danh sách key để xem.

> **Đây có phải `GOOGLE_API_KEY` đang dùng cho Drive không?** Không. Hai khoá
> khác nhau, khác cả API được bật. Đừng dùng lẫn: khoá Drive bị giới hạn theo
> referer sẽ bị Gemini từ chối, và ngược lại.

**Muốn dùng hãng khác?** Được hết — xem [Bước 3](#4-bước-3-tuỳ-chọn--nhiều-hãng-ai-để-không-bao-giờ-chết).

---

## 3. Bước 2 — Dán vào Vercel rồi deploy lại

1. Vercel → chọn project mstudo → **Settings** → **Environment Variables**.
2. Bấm **Add New**:
   - **Key:** `GEMINI_API_KEY`
   - **Value:** dán chuỗi `AIza…` (không có dấu nháy, không có khoảng trắng thừa)
   - **Environments:** tick cả **Production**, **Preview**, **Development**
3. **Save**.
4. Tab **Deployments** → bản mới nhất → menu `⋯` → **Redeploy**.

**Bắt buộc phải deploy lại.** Biến mới không tự áp vào bản đang chạy.

> **Cờ Sensitive:** bật hay tắt đều được cho biến này (nó chỉ đọc ở máy chủ).
> Quy tắc "phải tắt Sensitive" chỉ áp cho các biến `NEXT_PUBLIC_*` — xem
> [`bien-moi-truong.md`](./bien-moi-truong.md) mục ⚠️.

**Biến tuỳ chọn đi kèm:**

| Biến | Để trống thì sao |
|---|---|
| `GEMINI_MODEL` | dùng `gemini-flash-latest` — cứ để trống |

---

## 4. Bước 3 (tuỳ chọn) — nhiều hãng AI để không bao giờ chết

Một khoá miễn phí có lúc hết hạn mức trong ngày. Khi đó bot trả câu "Trợ lý đang
hơi bận…" và tự mở form xin số điện thoại — đỡ mất khách, nhưng vẫn là mất một
cuộc tư vấn.

`CHAT_PROVIDERS` cho bạn khai **nhiều hãng theo thứ tự ưu tiên**. Bot thử hãng
thứ nhất; lỗi/hết quota/trả rỗng thì tự nhảy sang hãng kế tiếp, khách không thấy
gì bất thường.

**Giá trị là JSON viết trên MỘT dòng:**

```
CHAT_PROVIDERS=[{"type":"gemini","key":"AIza...","model":"gemini-flash-latest"},{"type":"openai","key":"sk-or-...","model":"deepseek/deepseek-chat","baseUrl":"https://openrouter.ai/api/v1"}]
```

Bốn kiểu `type` được hỗ trợ
([`src/lib/vieetjk/providers.ts`](../src/lib/vieetjk/providers.ts)):

| `type` | Dùng cho | `baseUrl` mặc định |
|---|---|---|
| `gemini` | Google Gemini | `https://generativelanguage.googleapis.com/v1beta` |
| `openai` | mọi API chuẩn OpenAI: OpenAI, OpenRouter, DeepSeek, Groq, Together… | `https://api.openai.com/v1` |
| `anthropic` | Claude API trực tiếp | `https://api.anthropic.com/v1` |
| `responses` | OpenAI Responses API (Codex & reseller); có thêm `"effort"` | `https://api.openai.com/v1` |

Mỗi phần tử: `key` bắt buộc; `model`, `baseUrl`, `label`, `effort` tuỳ chọn.

**Ba điều dễ sai:**

1. **Đặt `CHAT_PROVIDERS` thì `GEMINI_API_KEY` bị bỏ qua hoàn toàn.** Muốn giữ
   Gemini thì phải khai nó *bên trong* mảng JSON.
2. **JSON hỏng = coi như không đặt** (code bắt lỗi và rơi về `GEMINI_API_KEY`).
   Dán vào <https://jsonlint.com> kiểm tra trước cho chắc.
3. **Phải một dòng.** Ô Value của Vercel nhận xuống dòng, nhưng nhiều dòng dễ
   lẫn với cú pháp dán-cả-gói `KEY=VALUE` của Vercel.

**Chưa cần đến `CHAT_PROVIDERS` thì cứ để trống** — `GEMINI_API_KEY` một mình là
đủ chạy.

---

## 5. Bước 4 — Chạy SQL (1 phút)

Chatbox cần hai bảng. Mở **Supabase → SQL Editor → New query**, dán, **Run**:

| File | Tạo gì | Thiếu thì |
|---|---|---|
| [`supabase/migrations/website_chat_config.sql`](../supabase/migrations/website_chat_config.sql) | `website_chat_config` — lời chào + kiến thức riêng | màn *Cấu hình chatbox* bấm Lưu là báo lỗi |
| [`supabase/migrations/website_leads.sql`](../supabase/migrations/website_leads.sql) | `website_leads` — lead khách để lại SĐT trong chat | khách để lại số mà không vào đâu cả |

Cả hai chạy nhiều lần đều được (idempotent) — lỡ chạy rồi thì chạy lại vô hại.

> **Dựng project Supabase mới hoàn toàn?** Đừng chạy từng file. Chạy
> [`supabase/setup-all.sql`](../supabase/setup-all.sql) một lần — nó đã gộp sẵn
> cả hai file trên đúng thứ tự.

---

## 6. Bước 5 — Dạy bot trả lời theo ý bạn

Vào **Dashboard → Website & chatbox** (hoặc thẳng `/dashboard/studio/chatbox`).
Cần tài khoản gói **Photographer trở lên**.

Hai ô:

**① Lời chào mở đầu** (tối đa 400 ký tự) — câu bot nói khi khách vừa mở khung
chat. Để trống thì dùng lời chào mặc định.

**② Kiến thức, FAQ & luật trả lời** (tối đa 8.000 ký tự) — phần quan trọng.
Viết tự nhiên theo gạch đầu dòng. Bot coi phần này là **ưu tiên cao hơn** kiến
thức mặc định.

Mẫu dùng được ngay, sửa số liệu cho khớp studio bạn:

```
• Giọng văn: thân thiện, xưng "studio", gọi khách là "anh/chị". Không hứa chắc
  về giá khi chưa rõ nhu cầu — mời khách để lại SĐT để báo giá chính xác.

• Cọc & huỷ: cọc 30% để giữ lịch. Báo huỷ trước 7 ngày hoàn 100% cọc, trước 3
  ngày hoàn 50%, sát ngày không hoàn.

• Thời gian giao ảnh: cưới 20–30 ngày; sự kiện 3–5 ngày; ảnh thô xem trước sau
  3 ngày.

• Khu vực: Quảng Ngãi và các tỉnh lân cận. Ngoại tỉnh phụ thu chi phí đi lại,
  báo riêng theo quãng đường.

• Khuyến mãi tháng này: giảm 10% cho khách đặt lịch trước ngày 30.

• Câu hỏi hay gặp:
  - "Có quay flycam không?" → Có, báo giá riêng tuỳ buổi và địa hình.
  - "Trời mưa thì sao?" → Đổi lịch miễn phí, studio chủ động báo trước 1 ngày.
  - "Có trang điểm không?" → Có, đi kèm gói cưới; gói khác tính thêm.

• KHÔNG nói: số tài khoản ngân hàng, thông tin khách khác, giá thấp hơn bảng giá.

• Luôn kết thúc bằng lời mời để lại SĐT hoặc đặt lịch khi khách tỏ ý quan tâm.
```

Bấm **Lưu cấu hình** → **áp dụng ngay**, kể cả với khách đang chat dở. Không cần
deploy lại.

**Ba mẹo viết cho bot nghe lời:**

- **Viết luật, đừng viết văn.** "Cọc 30%" tốt hơn "studio thường yêu cầu đặt cọc
  một khoản để giữ lịch".
- **Ghi cả điều KHÔNG được nói.** Đây là thứ hiệu quả nhất mà hầu hết bỏ qua.
- **Đừng chép lại bảng giá** — bot đã có. Chỉ ghi phần bảng giá *không* nói được:
  điều kiện, phụ thu, khuyến mãi theo mùa.
- **Không gõ thông tin nhạy cảm** (mật khẩu, số tài khoản): mọi thứ ở đây bot có
  thể nói ra cho bất kỳ khách nào.

---

## 7. Bước 6 — Thử, và đọc kết quả

Mở web ở **cửa sổ ẩn danh** (để không dính phiên đăng nhập), bấm bong bóng chat
góc phải.

| Bạn thấy | Nghĩa là |
|---|---|
| Bot chào bằng đúng câu bạn vừa đặt | ✅ Lớp 1 + lớp 2 đều chạy |
| Bot chào bằng câu mặc định | Lớp 1 chạy, nhưng cấu hình chưa lưu được — kiểm tra lại Bước 4 (SQL) |
| Gõ câu hỏi → *"Xin lỗi, mình chưa trả lời được lúc này."* | Lớp 1 hỏng — xem bảng lỗi bên dưới |
| *"Trợ lý đang hơi bận một chút 🙏"* + form xin SĐT | Khoá AI hết hạn mức hoặc bị từ chối. Bot vẫn giữ được khách. Thêm hãng thứ hai ở Bước 3 |

**Thử ba câu này** — chúng chạm ba đường khác nhau:

1. *"Chụp cưới bao nhiêu tiền?"* → kiểm tra bot có đọc được bảng giá không.
2. *"Cọc bao nhiêu?"* → kiểm tra phần bạn gõ ở Bước 5 có ăn không.
3. *"Cho mình xin tư vấn, số mình 0912345678"* → kiểm tra đường lead: vào
   **Dashboard → Yêu cầu mới** (`/dashboard/studio/leads`) phải thấy số đó.

---

## 8. Bước 7 (tuỳ chọn) — bật chat hai chiều

Mặc định chatbox là **một chiều**: bot nói, bạn không chen vào được.

Bật **Hộp thư hợp nhất** thì mỗi lượt chat được ghi lại, và khi bạn bấm *Tôi tiếp
quản*, bot im ngay — khách tiếp tục nhắn trong đúng khung chat đó và bạn trả lời
như nhắn tin bình thường.

Hai việc:

1. **Chạy SQL:** [`supabase/migrations/inbox_unified.sql`](../supabase/migrations/inbox_unified.sql).
2. **Bật cờ:** đăng nhập admin → `/dashboard/settings` → mục **Tính năng** → **bỏ
   tích** ô *Hộp thư hợp nhất*.

Chỉ riêng chatbox website thì **không cần** biến `META_*` hay `ZALO_*` nào —
những biến đó dành cho việc nối Facebook/Instagram/Zalo vào cùng hộp thư. Muốn
nối thêm các kênh đó thì đọc [`hop-thu-hop-nhat.md`](./hop-thu-hop-nhat.md).

> Khi cờ hộp thư còn **tắt**, khối ghi hộp thư trong `/api/vieetjk/chat` bị bỏ
> qua hoàn toàn — chatbox chạy đúng như cũ và không sinh một dòng dữ liệu nào.

---

## 9. Bảng lỗi → nguyên nhân

| Triệu chứng | Nguyên nhân gần như chắc chắn | Sửa |
|---|---|---|
| *"Xin lỗi, mình chưa trả lời được lúc này."* | Không có khoá AI nào ⇒ API trả **503 `assistant_unavailable`** | Khai `GEMINI_API_KEY`, **rồi redeploy** |
| Vẫn 503 dù đã khai biến | Chưa deploy lại, hoặc biến không tick **Production** | Vercel → Settings → sửa Environments → Redeploy |
| *"Trợ lý đang hơi bận"* ngay lần chat đầu | Khoá sai/đã bị xoá/chưa bật Generative Language API | Tạo khoá mới ở aistudio.google.com |
| Chat được nhưng bot không theo luật bạn viết | Cấu hình chưa lưu (thiếu bảng), hoặc bạn đang sửa cấu hình của **tài khoản khác** với chủ site vieetjk | Chạy `website_chat_config.sql`; kiểm tra đang đăng nhập đúng tài khoản chủ site |
| Bấm **Lưu cấu hình** báo *"Lưu thất bại"* | Chưa chạy `website_chat_config.sql` | Chạy SQL ở Bước 4 |
| Trang web không có bong bóng chat | Site không dùng giao diện `vieetjk` | Xem [mục 0](#0-trước-khi-bắt-đầu--chatbox-hiện-ra-ở-đâu) |
| Khách để lại SĐT mà không thấy trong dashboard | Chưa chạy `website_leads.sql` | Chạy SQL ở Bước 4 |
| Khách chat nhưng hộp thư trống | Cờ `inbox` còn ở "Sắp ra mắt" (đúng thiết kế) | Bước 7 |
| Bot nói sai bảng giá | Bảng giá bot dùng nằm ở `content.ts`, **không** phải bảng giá trong DB | Sửa `src/lib/vieetjk/content.ts` rồi deploy, hoặc ghi đè bằng ô kiến thức riêng |

**Xem log để biết chắc:** Vercel → **Logs** → lọc `/api/vieetjk/chat`. Khi mọi
hãng AI đều hỏng, máy chủ ghi đúng một dòng
`[vieetjk/chat] all providers failed: …` kèm mã lỗi của từng hãng. Khách không
bao giờ thấy dòng này.

---

## 10. Ba giới hạn của bản hiện tại

Nói trước để bạn khỏi đi tìm nút không tồn tại.

1. **Chatbox là một-studio, không phải mỗi-studio-một-bot.**
   `/api/vieetjk/chat` xác định chủ studio bằng cách tìm site có
   `custom_domain = vieetjk.com`, rồi mới đến `subdomain = 'vieetjk'`
   ([`src/lib/vieetjk/data.ts`](../src/lib/vieetjk/data.ts)). Nên nếu một studio
   khác cũng đặt `template = 'vieetjk'`, trang họ sẽ hiện khung chat nhưng bot
   **trả lời bằng dữ liệu và cấu hình của vieetjk**. Để nhiều studio dùng chatbox
   riêng thì phải cho widget mang `ownerId` theo site đang mở — đây là việc code,
   chưa làm.

2. **Bot không đọc bảng giá trong cơ sở dữ liệu.** Dịch vụ và giá lấy từ
   `content.ts` (hằng số trong mã nguồn), không phải bảng `price_lists` mà studio
   sửa trong dashboard. Sửa giá trong dashboard thì bot vẫn nói giá cũ.

3. **Kiến thức riêng chỉ là văn bản, không phải tài liệu.** Không có chỗ tải file
   PDF/Word lên cho bot đọc. Tối đa 8.000 ký tự gõ tay.

---

## 11. Bảng kiểm — in ra tick từng dòng

```
[ ] 1. Có khoá Gemini (AIza…) từ aistudio.google.com
[ ] 2. GEMINI_API_KEY đã khai ở Vercel, tick cả 3 Environments
[ ] 3. Đã Redeploy sau khi thêm biến
[ ] 4. Đã chạy website_chat_config.sql trong Supabase
[ ] 5. Đã chạy website_leads.sql trong Supabase
[ ] 6. Đã gõ lời chào + kiến thức riêng ở /dashboard/studio/chatbox và bấm Lưu
[ ] 7. Mở cửa sổ ẩn danh, chat thử 3 câu ở Bước 6 — đều có trả lời
[ ] 8. Để lại SĐT trong chat → thấy nó ở /dashboard/studio/leads
[ ] 9. (tuỳ chọn) CHAT_PROVIDERS khai thêm hãng thứ hai để dự phòng
[ ] 10. (tuỳ chọn) Chạy inbox_unified.sql + bỏ tích "Hộp thư" ở /dashboard/settings
```

---

## Đọc thêm

| File | Khi nào cần |
|---|---|
| [`con-thieu-gi.md`](./con-thieu-gi.md) | Toàn bộ những việc/biến còn thiếu, không riêng chatbox |
| [`bien-moi-truong.md`](./bien-moi-truong.md) | Tra cứu từng biến môi trường |
| [`hop-thu-hop-nhat.md`](./hop-thu-hop-nhat.md) | Nối Facebook / Instagram / Zalo vào cùng hộp thư |
