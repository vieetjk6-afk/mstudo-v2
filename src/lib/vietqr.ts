/**
 * Phần THUẦN của VietQR — không React, không "use client".
 *
 * Tách khỏi components/VietQR.tsx vì server component cũng cần dựng nội dung
 * chuyển khoản và URL ảnh QR (thẻ công nợ ở Tổng quan, tin nhắn gửi khách).
 * Nhập một hàm từ file "use client" vào server component là cái bẫy đã làm màn
 * Lịch làm việc chết trắng một lần — có hẳn npm run test:client-boundary canh.
 */

export type BankInfo = {
  bin: string | null;
  account: string | null;
  holder: string | null;
  name: string | null;
};

export function qrUrl(bank: BankInfo, amount: number, addInfo: string): string | null {
  if (!bank.bin || !bank.account) return null;
  const acc = (bank.account || "").replace(/\s/g, "");
  const params = new URLSearchParams();
  if (amount > 0) params.set("amount", String(Math.round(amount)));
  if (addInfo) params.set("addInfo", addInfo);
  if (bank.holder) params.set("accountName", bank.holder);
  const qs = params.toString();
  return `https://img.vietqr.io/image/${bank.bin}-${acc}-compact2.png${qs ? `?${qs}` : ""}`;
}

/**
 * Nội dung chuyển khoản của MỘT đợt: mã đợt + mã hợp đồng + tên đợt, cắt cho
 * vừa trường nội dung của ngân hàng. Trang studio, cổng khách và thẻ công nợ ở
 * Tổng quan dùng CHUNG hàm này để ba mã QR của cùng một đợt không lệch nội dung —
 * sao kê về là đối chiếu được ngay tiền của đợt nào.
 *
 * Mã đợt (MSxxxxxxxx, cột pay_code) đứng ĐẦU: nó là thứ webhook SePay dò để tự
 * ghi thu, nên không bao giờ được là phần bị cắt mất khi nội dung quá dài. Đợt
 * chưa có mã (database chưa chạy migration) thì nội dung như cũ.
 */
export function instalmentNote(ref?: string | null, label?: string | null, payCode?: string | null): string {
  return [(payCode || "").trim(), (ref || "").trim(), (label || "").trim()].filter(Boolean).join(" ").slice(0, 50);
}

/** Cách studio muốn ghi nội dung chuyển khoản của hợp đồng (profiles.qr_note_date + SePay). */
export type TransferNoteMode = {
  /** true = số HĐ + ngày chính; false = chỉ số HĐ. */
  withDate: boolean;
  /** Studio đã bật SePay → thêm mã đợt MSxxxxxxxx để webhook tự ghi thu. */
  sepay: boolean;
};

export const DEFAULT_TRANSFER_NOTE_MODE: TransferNoteMode = { withDate: false, sepay: false };

/** "2026-12-25" → "25-12-2026". Gạch ngang: app ngân hàng nào lọc ký tự lạ thì còn "25122026", vẫn đọc được. */
function noteDate(iso?: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}

/**
 * Nội dung chuyển khoản của MỘT đợt thanh toán hợp đồng — CHỈ số hợp đồng
 * (tuỳ studio: kèm ngày chính). Không tên khách, không tên đợt ("Cọc giữ
 * lịch", "Thanh toán khi giao sản phẩm"…): studio không muốn sao kê ghi rõ đây
 * là tiền dịch vụ của ai, việc gì.
 *
 * Tiêu đề hợp đồng KHÔNG được dùng thay khi thiếu số HĐ — tiêu đề hay chứa tên
 * khách. Thiếu cả hai thì để trống, khách tự ghi.
 *
 * Mã đợt (pay_code) chỉ có mặt khi studio đã bật SePay, và đứng ĐẦU để không
 * bao giờ bị cắt mất — webhook dò đúng mã đó để tự ghi thu.
 */
export function transferNote(
  c: { code?: string | null; event_date?: string | null },
  payCode: string | null | undefined,
  mode: TransferNoteMode
): string {
  return [
    mode.sepay ? (payCode || "").trim() : "",
    (c.code || "").trim(),
    mode.withDate ? noteDate(c.event_date) : "",
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 50);
}
