/**
 * "Mật khẩu" mở trang hợp đồng / trang riêng của khách.
 *
 * Mặc định là SĐT khách. Khách KHÔNG dùng điện thoại thì studio đặt một MÃ SỐ
 * (cột studio_contracts.client_passcode, migrations/ma_so_mo_hop_dong.sql) —
 * khách gõ mã đó vào đúng ô nhập SĐT. Có cả hai thì cái nào cũng mở được.
 *
 * File THUẦN (không import) để test nạp thẳng được: desktop/test/portal-key.mjs.
 */

/** Mã số tối thiểu bao nhiêu chữ số — ngắn hơn thì dò quá dễ, coi như chưa đặt. */
export const PASSCODE_MIN = 6;
export const PASSCODE_MAX = 12;

export const keyDigits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

/** Mã số đặt được chưa (đủ độ dài). Dùng cho cả ô nhập lẫn phía máy chủ. */
export function passcodeValid(code: string | null | undefined): boolean {
  const d = keyDigits(code);
  return d.length >= PASSCODE_MIN && d.length <= PASSCODE_MAX;
}

/** Hợp đồng có "khoá" nào để khách mở chưa (SĐT hoặc mã số hợp lệ). */
export function hasPortalKey(phone: string | null | undefined, passcode: string | null | undefined): boolean {
  return keyDigits(phone).length > 0 || passcodeValid(passcode);
}

/** Khách gõ `input` — có khớp SĐT hoặc mã số của hợp đồng không. Fail-closed. */
export function portalKeyMatches(
  input: string | null | undefined,
  phone: string | null | undefined,
  passcode?: string | null
): boolean {
  const k = keyDigits(input);
  if (!k) return false;
  const p = keyDigits(phone);
  if (p && k === p) return true;
  return passcodeValid(passcode) && k === keyDigits(passcode);
}

/** Mã số ngẫu nhiên 6 chữ số, không bắt đầu bằng 0 (khỏi bị bảng tính nuốt số 0). */
export function randomPasscode(): string {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return String(100000 + (buf[0] % 900000));
}

/** Cụm "mật khẩu" chuẩn mà mọi lời nhắn gửi khách đang dùng. */
export const PHONE_HINT = "(mật khẩu là SĐT của anh/chị)";

/**
 * Lời nhắn soạn sẵn ghi "(mật khẩu là SĐT của anh/chị)". Khách KHÔNG có SĐT
 * nhưng có mã số thì câu đó sai — đổi thành "(mã mở: 123456)" để khách mở được.
 * Có SĐT thì giữ nguyên (khách vẫn mở bằng SĐT như cũ).
 */
export function withPasscodeHint(text: string, phone: string | null | undefined, passcode: string | null | undefined): string {
  if (keyDigits(phone) || !passcodeValid(passcode)) return text;
  return text.split(PHONE_HINT).join(`(mã mở: ${keyDigits(passcode)})`);
}
