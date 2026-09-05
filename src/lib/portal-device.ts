"use client";

/**
 * CỔNG KHÁCH NHỚ THIẾT BỊ — `/portal/[token]` và `/c/[token]`.
 *
 * Vấn đề. Cổng khách chặn bằng số điện thoại ở MỌI lần gọi (xem
 * `POST /api/c/[token]`), nên trước đây khách phải nhập lại số mỗi lần mở trang.
 * Một hợp đồng cưới chạy 3–6 tháng và khách mở lại hàng chục lần để xem lịch thử
 * đồ, xem còn nợ bao nhiêu — nhập số điện thoại mười lần thì khách thôi không mở
 * nữa, và studio mất đúng cái kênh mình vừa dựng ra.
 *
 * Cách làm. Nhớ số đã mở khoá TRÊN CHÍNH MÁY KHÁCH (localStorage), rồi tự mở khi
 * quay lại. Ba giới hạn cố ý:
 *
 *  - Không phải "đăng nhập". Server vẫn kiểm số điện thoại từng lần gọi; đây chỉ
 *    là cái máy nhớ hộ khách con số họ vừa gõ. Không có phiên, không có cookie,
 *    không có gì gửi lên máy chủ.
 *  - Số điện thoại nằm cùng chỗ với token, mà token vốn đã ở trong URL trên máy
 *    đó. Nên việc nhớ này KHÔNG mở thêm cửa nào: ai mở được trình duyệt đó thì
 *    đã có link trong lịch sử truy cập. Bù lại phải có nút thoát rõ ràng cho máy
 *    dùng chung (máy tính nhà, điện thoại đưa người khác xem ảnh).
 *  - Có hạn 90 ngày. Hợp đồng xong rồi thì bản nhớ tự hết, không nằm lại vô hạn.
 *
 * Bản chụp dữ liệu (`snapshot`) là để ĐỌC khi mất mạng: tiến độ, lịch hẹn, các
 * đợt thanh toán. Chỉ đọc — mọi thao tác ghi (báo đã chuyển khoản, gửi brief, ký)
 * đều đòi mạng và cổng phải nói thẳng điều đó thay vì nhận rồi đánh mất.
 */

const PHONE_PREFIX = "mstudo_portal_phone:";
const SNAP_PREFIX = "mstudo_portal_snap:";

/** Bản nhớ số điện thoại hết hạn sau 90 ngày. */
export const REMEMBER_MS = 90 * 24 * 3600 * 1000;

type PhoneMemo = { phone: string; at: number };

export const digitsOnly = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

/** Bản nhớ còn hiệu lực? Tách riêng để kiểm thử được luật hết hạn. */
export function memoValid(memo: PhoneMemo | null, now: number): boolean {
  if (!memo || !memo.phone) return false;
  if (!Number.isFinite(memo.at)) return false;
  // Mốc ở tương lai = đồng hồ máy bị đặt sai (hoặc đổi múi giờ). Coi như còn hạn
  // thay vì bắt khách nhập lại: thà nhớ thừa vài ngày còn hơn làm khách khó chịu.
  if (memo.at > now) return true;
  return now - memo.at < REMEMBER_MS;
}

export function rememberPhone(token: string, phone: string): void {
  const d = digitsOnly(phone);
  if (!d) return;
  try {
    localStorage.setItem(PHONE_PREFIX + token, JSON.stringify({ phone: d, at: Date.now() } satisfies PhoneMemo));
  } catch {
    /* chế độ riêng tư / hết dung lượng — chỉ mất tiện lợi */
  }
}

/** Số điện thoại đã mở khoá trên máy này, hoặc `null`. Hết hạn thì tự xoá. */
export function readPhone(token: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PHONE_PREFIX + token);
    if (!raw) return null;
    const memo = JSON.parse(raw) as PhoneMemo;
    if (!memoValid(memo, Date.now())) {
      localStorage.removeItem(PHONE_PREFIX + token);
      return null;
    }
    return memo.phone;
  } catch {
    return null;
  }
}

/** Khách bấm "thoát khỏi máy này": xoá cả số nhớ lẫn bản chụp dữ liệu. */
export function forgetDevice(token: string): void {
  try {
    localStorage.removeItem(PHONE_PREFIX + token);
    localStorage.removeItem(SNAP_PREFIX + token);
  } catch {
    /* không có gì để xoá */
  }
}

/* ── Bản chụp dữ liệu để đọc khi mất mạng ─────────────────────────────────── */

export type Snapshot<T> = { at: number; data: T };

export function saveSnapshot<T>(token: string, data: T): void {
  try {
    localStorage.setItem(SNAP_PREFIX + token, JSON.stringify({ at: Date.now(), data } satisfies Snapshot<T>));
  } catch {
    /* payload quá lớn (album vài trăm ảnh) — bỏ qua, chỉ mất chế độ đọc offline */
  }
}

export function readSnapshot<T>(token: string): Snapshot<T> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SNAP_PREFIX + token);
    if (!raw) return null;
    const s = JSON.parse(raw) as Snapshot<T>;
    return s && s.data != null && Number.isFinite(s.at) ? s : null;
  } catch {
    return null;
  }
}

/**
 * Nhãn tuổi của bản chụp, để khách biết mình đang đọc bản lưu từ bao giờ. Nói
 * mốc tương đối ("2 giờ trước") vì đó là câu trả lời cho câu hỏi thật của khách:
 * "số này còn đúng không?".
 */
export function snapshotAge(at: number, now: number): string {
  const ms = Math.max(0, now - at);
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "vừa xong";
  if (min < 60) return `${min} phút trước`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} giờ trước`;
  const day = Math.floor(hour / 24);
  if (day === 1) return "hôm qua";
  if (day < 30) return `${day} ngày trước`;
  const month = Math.floor(day / 30);
  return month < 12 ? `${month} tháng trước` : `hơn ${Math.floor(month / 12)} năm trước`;
}
