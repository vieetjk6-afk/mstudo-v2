/**
 * Cọc giữ ngày cho yêu cầu đặt lịch.
 *
 * Luồng: khách gửi yêu cầu → hiện QR VietQR kèm mã nội dung → khách chuyển và
 * tải ảnh biên lai → studio đối chiếu sao kê rồi xác nhận.
 *
 * KHÔNG có cổng thanh toán tự động ở đây, và điều đó là cố ý: chuyển khoản
 * VietQR là cách người Việt vốn đã trả tiền, không mất phí cổng, và studio vẫn
 * phải tự đối chiếu sao kê — nên trạng thái "khách báo đã chuyển" tách hẳn khỏi
 * "studio đã xác nhận". Tiền chỉ được coi là nhận khi studio nhìn thấy nó.
 */

export type DepositStatus = "none" | "awaiting" | "paid" | "confirmed";

export const DEPOSIT_STATUS_LABEL: Record<DepositStatus, string> = {
  none: "Không cọc",
  awaiting: "Chờ khách chuyển",
  paid: "Khách báo đã chuyển",
  confirmed: "Đã nhận cọc",
};

export const DEPOSIT_STATUS_TONE: Record<DepositStatus, "neutral" | "amber" | "blue" | "green"> = {
  none: "neutral",
  awaiting: "amber",
  paid: "blue",
  confirmed: "green",
};

/**
 * Mã nội dung chuyển khoản: "COC-" + 4 ký tự. Bỏ các ký tự dễ đọc nhầm trên sao
 * kê in ra (0/O, 1/I/L) — studio đối chiếu bằng mắt nên nhầm một ký tự là mất
 * công tra cả buổi.
 */
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function newDepositCode(): string {
  let out = "";
  for (let i = 0; i < 4; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return `COC-${out}`;
}

/** Token dài để khách quay lại trang cọc — không đoán được từ id. */
export function newDepositToken(): string {
  const uuid = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}${Math.random()}`;
  return uuid.replace(/-/g, "");
}

/**
 * Số tiền cọc cho một yêu cầu đặt lịch. Studio đặt một mức CỐ ĐỊNH (VND) chứ
 * không theo phần trăm gói: lúc đặt lịch khách thường chưa chốt gói, mà "cọc
 * 500k giữ ngày" là câu studio nói được ngay trên điện thoại.
 *
 * Kẹp không vượt quá giá gói khi khách đã chọn gói — cọc lớn hơn tổng tiền là
 * vô lý và làm khách bỏ đi.
 */
export function depositFor(policyAmount: number, packagePrice: number | null | undefined): number {
  const base = Math.max(0, Math.round(policyAmount || 0));
  if (!base) return 0;
  const pkg = packagePrice != null && Number.isFinite(packagePrice) ? Math.max(0, Math.round(packagePrice)) : 0;
  return pkg > 0 ? Math.min(base, pkg) : base;
}
