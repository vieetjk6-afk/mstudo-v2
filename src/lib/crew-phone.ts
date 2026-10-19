/* ═══════════════════════════════════════════════════════════════════════════
   SĐT CỦA THỢ — phần logic THUẦN (không import gì, chạy thẳng trong Node để
   kiểm thử: `npm run test:crew-phone`).

   SĐT là danh tính của thợ: thợ đăng nhập /crew bằng số này, và phân công hợp
   đồng (contract_crew), lịch bận/rảnh (crew_unavailable / crew_available), chấm
   công (crew_timesheet) đều lưu THEO SỐ chứ không theo studio_crew.id. Nên đổi
   số ở sổ thợ phải đi qua /api/studio/crew/phone để chuyển cả những dòng đó —
   xem route ấy.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Chỉ giữ chữ số — đúng cách cổng /crew và mọi bảng lịch thợ so số. */
export const phoneDigits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

/**
 * Số lưu vào sổ: chỉ chữ số, đầu +84 đổi về 0 — thợ đăng nhập /crew bằng số
 * dạng 0xxx, lưu 84xxx là thợ gõ đúng số mình mà vẫn "không có trong sổ".
 */
export function normalizeCrewPhone(raw: string | null | undefined): string {
  const d = phoneDigits(raw);
  if (d.length === 11 && d.startsWith("84")) return `0${d.slice(2)}`;
  return d;
}

/** Lỗi hiển thị cho người dùng, hoặc null nếu số dùng được. */
export function crewPhoneError(normalized: string): string | null {
  if (!normalized) return "Cần nhập số điện thoại.";
  if (normalized.length < 9 || normalized.length > 11) return "Số điện thoại phải có 9–11 chữ số.";
  return null;
}

/** Thợ khác trong cùng sổ đã dùng số này chưa (so theo chữ số, bỏ qua cách viết). */
export function findPhoneOwner<T extends { id: string; phone: string | null }>(
  roster: T[],
  normalized: string,
  exceptId: string
): T | null {
  return roster.find((r) => r.id !== exceptId && normalizeCrewPhone(r.phone) === normalized) ?? null;
}
