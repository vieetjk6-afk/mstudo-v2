/**
 * Thanh toán gói dịch vụ MStudo — phần THUẦN, dùng chung cho cả trang thanh
 * toán của studio lẫn màn duyệt của admin.
 *
 * Cùng một triết lý với cọc giữ ngày ở `booking-deposit.ts`, chỉ khác cấp:
 * ở đây MStudo là bên thu và studio là bên trả. Không có cổng thanh toán tự
 * động — "studio BÁO đã chuyển" tách hẳn khỏi "MStudo ĐÃ NHẬN", vì ảnh chụp
 * màn hình chuyển khoản làm giả được trong 30 giây. Gói chỉ được nâng khi
 * admin nhìn thấy tiền trong sao kê.
 */

export type UpgradePaymentStatus = "none" | "awaiting_confirm" | "paid" | "failed";

export const UPGRADE_PAYMENT_LABEL: Record<UpgradePaymentStatus, string> = {
  none: "Chờ chuyển khoản",
  awaiting_confirm: "Chờ admin xác nhận",
  paid: "Đã nhận tiền · đã nâng cấp",
  failed: "Chưa nhận được tiền",
};

export const UPGRADE_PAYMENT_TONE: Record<UpgradePaymentStatus, "neutral" | "amber" | "green" | "red"> = {
  none: "neutral",
  awaiting_confirm: "amber",
  paid: "green",
  failed: "red",
};

export function isUpgradePaymentStatus(v: unknown): v is UpgradePaymentStatus {
  return v === "none" || v === "awaiting_confirm" || v === "paid" || v === "failed";
}

/**
 * Nội dung chuyển khoản: "MS-" + 4 ký tự. Bỏ các ký tự dễ đọc nhầm (0/O,
 * 1/I/L) — admin đối chiếu sao kê bằng mắt, nhầm một ký tự là tra cả buổi.
 * Ngắn để studio gõ tay được khi app ngân hàng của họ không quét QR.
 */
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function newUpgradePaymentCode(): string {
  let out = "";
  for (let i = 0; i < 4; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return `MS-${out}`;
}

/**
 * Số tiền phải trả cho một gói, TÍNH LẠI TỪ GIÁ GỐC.
 *
 * Trình duyệt gửi lên số tiền của nó, nhưng đây là số in lên mã QR nên phải do
 * máy chủ chốt: sửa một dòng JSON là mua gói Studio giá 1.000đ.
 * `discountPct` là mức giảm ĐÃ ĐƯỢC XÁC THỰC phía máy chủ (khuyến mãi của gói
 * hoặc mã giảm giá hợp lệ), không phải con số trình duyệt khai.
 */
export function upgradeAmount(basePrice: number, discountPct: number): number {
  const base = Math.max(0, Math.round(Number(basePrice) || 0));
  const pct = Math.min(100, Math.max(0, Number(discountPct) || 0));
  return Math.round(base * (1 - pct / 100));
}
