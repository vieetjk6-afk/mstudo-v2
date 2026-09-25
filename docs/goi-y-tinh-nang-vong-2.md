# Gợi ý tính năng — vòng 2

Mười mục của [`goi-y-hoan-thien-app.md`](goi-y-hoan-thien-app.md) đã làm xong hết.
File này là vòng tiếp theo: những chỗ app **vẫn còn hở** khi rà lại toàn bộ
`src/app/dashboard/studio/*`, `src/lib/*` và 47 file SQL trong `supabase/`. Tính
năng nào đã có thì không nhắc lại.

Cách rà: tìm trong mã nguồn và SQL những khái niệm mà một studio ảnh ở Việt Nam
gặp hằng tháng — `voucher`, `refund`/hoàn tiền, lý do huỷ, nhật ký thao tác,
2FA, vật tư, khung giờ chụp nhanh… Kết quả: **không có một dòng nào** cho các
khái niệm dưới đây.

---

## 0. Bảng tra 1 phút

| # | Tính năng | Vì sao cần | Công sức | Trạng thái |
|---|---|---|---|---|
| 1 | **Huỷ hợp đồng: giữ/hoàn cọc** | Báo cáo đếm tiền cọc đã trả lại khách là doanh thu | Nhỏ | ✅ đã có trên `main` (`contract_cancel_reschedule.sql`) |
| 2 | **Khoá giá sau khi khách ký + phụ lục** | Sửa được giá hợp đồng khách đã ký, không dấu vết | Trung bình | ✅ đã làm |
| 3 | **Nhật ký thao tác tiền & hợp đồng** | Ai xoá một khoản thu thì không truy được | Trung bình | ✅ đã làm |
| 4 | **Voucher / thẻ quà của studio** | Mùa lễ bán thẻ quà, đang ghi sổ tay | Trung bình | ✅ đã làm |
| 5 | **Chụp theo khung giờ (mini-session)** | Tết, Trung thu: 20–30 khách một ngày | Trung bình | chưa làm |
| 6 | **Phiếu chi có số** | Phiếu thu có số, tiền ra thì chưa | Nhỏ | chưa làm |
| 7 | **Xác thực 2 lớp** | Tài khoản chủ & kế toán chỉ có mật khẩu | Nhỏ | ✅ đã làm |
| 8 | **Vật tư tiêu hao** | Bìa album, khung, giấy in hết giữa mùa | Nhỏ | chưa làm |

Chủ studio đang chạy thật: dán `supabase/cap-nhat.sql` vào SQL Editor một lần —
nó đã gồm ba migration mới `contract_addenda.sql`, `studio_vouchers.sql`,
`studio_audit_log.sql`. Chưa chạy thì app vẫn chạy như cũ; màn mới báo cần chạy SQL.

---

## ✅ 1. Huỷ hợp đồng — đã có trên `main`

Một nhánh khác đã làm xong trước và gộp vào `main`: khoản hoàn là một lần thu
`kind = 'refund'` số âm, có chính sách huỷ của studio, kèm dời lịch hợp đồng
(`src/lib/contract-cancel.ts`, `src/app/api/studio/contracts/[id]/cancel`,
`supabase/migrations/contract_cancel_reschedule.sql`). Không làm lại.

---

## ✅ 2. Khoá giá sau khi khách ký + phụ lục

**Đã dựng:**

| Phần | File |
|---|---|
| Bảng `contract_addenda`, cột `contract_items.addendum_id`, trigger khoá | `supabase/migrations/contract_addenda.sql` |
| Làm sạch dòng nháp, tổng, số thứ tự (thuần, có test) | `src/lib/contract-addenda.ts`, `desktop/test/contract-addenda.mjs` |
| Ký phụ lục (đóng dấu + chép dòng) | `src/lib/contract-addenda-server.ts` |
| Studio tạo / sửa / xoá / xác nhận thay khách | `src/app/api/studio/contracts/[id]/addenda/route.ts`, `ContractAddenda.tsx` |
| Khách ký phụ lục ở cổng `/c/[token]` | `src/app/api/c/[token]/route.ts` (`sign_addendum`), `ClientAddenda.tsx` |

**Vì sao dựng như thế:**

- **Phụ lục chưa ký chỉ là bản nháp JSON** (`contract_addenda.lines`), không nằm
  trong `contract_items`. Khi khách ký (hoặc studio xác nhận thay), máy chủ chép
  các dòng thành hạng mục mang `addendum_id`. Nhờ vậy **mọi chỗ cộng tổng tiền**
  (công nợ, báo cáo, cổng khách, xuất kế toán) tự đúng mà không sửa nơi nào.
- **Hàng rào là trigger dưới DB**, không chỉ là nút bị khoá: người dùng đăng nhập
  không chèn / sửa / xoá được hạng mục gốc của hợp đồng đã ký, cũng không đụng
  được dòng phụ lục đã ký. Lời gọi không có người dùng (service role của route
  máy chủ, SQL Editor) đi qua — đó là đường chép phụ lục.
- **Ký là một UPDATE có điều kiện `signed_at is null`**: khách bấm đúp, hay khách
  ký đúng lúc studio xác nhận thay, chỉ một lần thắng — dòng không bị chép đôi.
  Chép hỏng thì gỡ dấu chữ ký, phụ lục quay về "chờ ký".
- Trình sửa hợp đồng xoá-rồi-chèn chỉ trên hạng mục gốc (`addendum_id is null`),
  và lùi về cách cũ khi DB chưa có cột.

**Còn thiếu:** bản in PDF hợp đồng chưa in kèm phụ lục; app desktop ghi bằng
service role nên không bị hàng rào chặn.

---

## ✅ 3. Nhật ký thao tác — `/dashboard/studio/audit`

**Hai đường ghi**, vì app ghi dữ liệu bằng hai cách:

1. **Trigger dưới DB** cho thao tác người dùng ghi thẳng từ trình duyệt:
   khoản thu, khoản chi, hạng mục (MỘT dòng nhật ký cho mỗi lần Lưu — trigger mức
   câu lệnh, vì trình sửa xoá-rồi-chèn), và các trường có hệ quả của hợp đồng
   (trạng thái, ngày chụp, cọc, tên/SĐT khách). Người thao tác = `auth.uid()`.
2. **`logAction()`** (`src/lib/audit-log.ts`) cho route máy chủ chạy bằng service
   role — đổi trạng thái, huỷ, dời lịch, "Đã thu" ở Tổng quan, phụ lục, voucher,
   bật/tắt 2 lớp. Ở đó `auth.uid()` là null nên trigger tự bỏ qua: không trùng,
   không mất người.

Bất biến: không có policy ghi nào cho người dùng. Chỉ chủ studio và kế toán đọc
được. Màn hợp đồng có nút **Lịch sử** lọc riêng hợp đồng đó.

**Còn thiếu:** SePay tự ghi thu không vào nhật ký (không có người thao tác).

---

## ✅ 4. Voucher / thẻ quà — `/dashboard/studio/vouchers`

**Hạch toán** (sai là đếm tiền hai lần): bán thẻ là **khoản nợ khách**, ghi ở
`studio_vouchers`, KHÔNG vào `contract_payments`. Khách dùng thẻ ở tab Thanh
toán của hợp đồng → ghi một khoản thu `kind = 'voucher'` bằng mệnh giá — lúc đó
mới là doanh thu, công nợ tự trừ. Xoá khoản thu đó → trigger trả thẻ về "còn
hiệu lực".

- Mã `QUA-XXXXXX` không có ký tự dễ nhầm (0/O, 1/I/L) — khách đọc mã qua điện thoại.
- Thẻ chưa thu tiền thì chưa dùng được; hết hạn thì không dùng được.
- Dùng thẻ là UPDATE có điều kiện `status = 'active'`: hai người dùng cùng một mã
  cùng lúc thì chỉ một người thắng.
- Đầu màn: đã bán · đã thu · **còn nợ khách** (mệnh giá thẻ còn hiệu lực) · đã dùng.
- In thẻ khổ A5 ngang ngay trên trình duyệt.

**Còn thiếu:** thẻ hết hạn chưa được tự ghi thành doanh thu (phần "breakage").

---

## ✅ 7. Xác thực 2 lớp

Supabase Auth MFA (TOTP). Bật / tắt ở **Tài khoản & bảo mật** (quét QR bằng
Google Authenticator, Microsoft Authenticator, 1Password…).

- **Hàng rào**: `needsMfa()` trong `src/lib/auth-guards.ts` đọc mức xác thực từ
  JWT (không tốn lượt mạng). Tài khoản đã bật mà phiên mới qua mật khẩu (aal1)
  thì `dashboard/layout.tsx` và `staff/layout.tsx` chuyển sang `/login/mfa`, còn
  `requireStudio()` / `requireAdmin()` trả null → mọi route API dùng chúng từ chối.
- Bật dở (quét QR mà chưa nhập mã) thì yếu tố đó bị dọn ở lần bật sau.
- Bật / TẮT 2 lớp vào nhật ký thao tác — "kế toán vừa tắt 2 lớp" là việc kẻ chiếm
  tài khoản làm đầu tiên.

**Việc cần làm một lần:** Supabase → Authentication → Multi-Factor → bật TOTP
(mặc định đã bật trên project mới).

**Còn thiếu:** chưa có tuỳ chọn "bắt buộc 2 lớp với chủ & kế toán" ở cấp studio;
và RLS chưa đòi `aal2`, nên ai cầm được phiên aal1 vẫn gọi thẳng PostgREST được
(giao diện và API của app thì đã chặn).

---

## 5. Chụp theo khung giờ (mini-session)

**Vấn đề.** Form đặt lịch `/book/[token]` hỏi một ngày; studio phải tự nhắn qua
lại để xếp giờ. Ngày chụp Tết/Trung thu có 20–30 khách, mỗi người 15–20 phút.

**Làm:** "đợt chụp" = ngày + điểm chụp + độ dài slot + giá; khách mở link, thấy
slot còn trống, chọn, cọc qua `booking-deposit.ts`. Slot đã có người thì khoá
bằng ràng buộc UNIQUE `(session_id, start_at)` để hai khách không đặt trùng.
Mỗi slot đã đặt sinh một `studio_appointments` để hiện trên Lịch làm việc.

## 6. Phiếu chi có số

Phiếu thu đã có số liên tục theo năm (`next_receipt_no`). Tiền ra thì chưa: hoàn
cọc khi huỷ (khoản thu `refund` số âm), trả tiền công thợ, trả nhà cung cấp.
Thêm `next_voucher_no` cùng khuôn, cột số phiếu trên `studio_expenses` và trên
khoản `refund`, cùng mẫu in "Phiếu chi" trong `contract-print.ts`. Kế toán cần cả
hai chiều mới khớp sổ quỹ.

## 8. Vật tư tiêu hao

Nhóm "Kho" có Phòng váy và Thiết bị — cả hai là tài sản **cho mượn rồi trả**.
Vật tư là thứ **dùng hết**: bìa album, khung, giấy in, hộp USB. Cần: tồn kho,
ngưỡng cảnh báo, trừ tồn khi hợp đồng có sản phẩm tương ứng, nút "đặt thêm" tạo
đơn ở Nhà cung cấp (`vendors.ts`).

---

## Cố ý KHÔNG đề xuất

| Việc | Vì sao không |
|---|---|
| Chương trình tích điểm | Khách studio ảnh quay lại vài năm một lần; "khách giới thiệu khách" (`referral.ts`) và nhắc kỷ niệm (`anniversary.ts`) đã nhắm đúng hành vi đó |
| Khảo sát NPS riêng | Đánh giá khách (`/reviews`) đã thu sao + cảm nhận sau giao ảnh; thêm một khảo sát là hỏi khách hai lần |
| Cổng thanh toán thẻ | Khách Việt chuyển khoản; VietQR đã có. Cổng thẻ thêm phí 2–3% mà gần như không ai dùng |
