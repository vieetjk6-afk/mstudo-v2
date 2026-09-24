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
