/**
 * Huỷ hợp đồng & dời lịch: phần THUẦN (không DB, không React), test được.
 *
 * Chính sách huỷ của studio có hai bậc, đủ cho gần hết studio ảnh cưới ở VN:
 *   • huỷ trước ngày chụp từ `earlyDays` ngày trở lên → hoàn `earlyPct`% số đã thu
 *   • huỷ muộn hơn (hoặc ngày chụp đã qua)            → hoàn `latePct`%
 * Đây chỉ là con số GỢI Ý. Studio luôn sửa được trước khi xác nhận, vì huỷ là
 * chuyện thương lượng với khách chứ không phải phép tính.
 */

export type CancelPolicy = { earlyDays: number; earlyPct: number; latePct: number };

export const DEFAULT_CANCEL_POLICY: CancelPolicy = { earlyDays: 30, earlyPct: 50, latePct: 0 };

/** Chuẩn hoá chính sách đọc từ DB (cột có thể chưa có → null). */
export function cancelPolicyOf(p: {
  cancel_early_days?: number | null;
  cancel_early_refund_pct?: number | null;
  cancel_late_refund_pct?: number | null;
} | null | undefined): CancelPolicy {
  const pick = (v: number | null | undefined, d: number, max: number) =>
    v == null || !Number.isFinite(Number(v)) ? d : Math.max(0, Math.min(max, Math.round(Number(v))));
  return {
    earlyDays: pick(p?.cancel_early_days, DEFAULT_CANCEL_POLICY.earlyDays, 365),
    earlyPct: pick(p?.cancel_early_refund_pct, DEFAULT_CANCEL_POLICY.earlyPct, 100),
    latePct: pick(p?.cancel_late_refund_pct, DEFAULT_CANCEL_POLICY.latePct, 100),
  };
}

const DAY = 86_400_000;

function utcMs(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  if (!m) return null;
  return Date.UTC(+m[1], +m[2] - 1, +m[3]);
}

/** Số ngày từ `from` tới `to` (YYYY-MM-DD). Sai dạng → null. */
export function daysBetween(from: string | null | undefined, to: string | null | undefined): number | null {
  const a = utcMs(from || "");
  const b = utcMs(to || "");
  if (a == null || b == null) return null;
  return Math.round((b - a) / DAY);
}

/** Cộng `days` ngày vào một ngày YYYY-MM-DD. */
export function shiftDate(iso: string, days: number): string {
  const ms = utcMs(iso);
  if (ms == null) return iso;
  return new Date(ms + days * DAY).toISOString().slice(0, 10);
}

/** Làm tròn XUỐNG tới nghìn đồng: không ai hoàn "1.234.567đ". */
const toThousand = (n: number) => Math.floor(Math.max(0, n) / 1000) * 1000;

export type CancelQuote = {
  /** Số ngày còn lại tới ngày chụp; null khi hợp đồng chưa có ngày. */
  daysBefore: number | null;
  rule: "early" | "late";
  pct: number;
  /** Tiền gợi ý hoàn cho khách. */
  refund: number;
  /** Phần studio giữ lại (phí huỷ). */
  kept: number;
};

/**
 * Gợi ý số tiền hoàn khi huỷ. `collected` là số THỰC đã thu (đã trừ các lần hoàn
 * trước nếu có). Chưa có ngày chụp thì coi như huỷ sớm: chưa giữ ngày nào cho khách.
 */
export function cancelQuote(o: { collected: number; eventDate: string | null | undefined; today: string; policy: CancelPolicy }): CancelQuote {
  const collected = Math.max(0, Math.round(o.collected || 0));
  const daysBefore = o.eventDate ? daysBetween(o.today, o.eventDate) : null;
  const early = daysBefore == null || daysBefore >= o.policy.earlyDays;
  const pct = early ? o.policy.earlyPct : o.policy.latePct;
  const refund = Math.min(collected, toThousand((collected * pct) / 100));
  return { daysBefore, rule: early ? "early" : "late", pct, refund, kept: collected - refund };
}

/** Câu chính sách in vào điều khoản hợp đồng / hiện cho khách. */
export function cancelPolicyText(p: CancelPolicy): string {
  const late = p.latePct > 0 ? `hoàn ${p.latePct}% số tiền đã thanh toán` : "studio giữ toàn bộ số tiền đã thanh toán";
  if (p.earlyDays <= 0) return `Huỷ hợp đồng: hoàn ${p.earlyPct}% số tiền đã thanh toán.`;
  return `Huỷ trước ngày chụp từ ${p.earlyDays} ngày trở lên: hoàn ${p.earlyPct}% số tiền đã thanh toán. Huỷ muộn hơn: ${late}.`;
}

/** Điều khoản "Huỷ & dời lịch" sinh từ chính sách của studio, để chép vào hợp đồng mẫu. */
export function cancelClauseText(p: CancelPolicy): string {
  return [
    "HUỶ & DỜI LỊCH",
    `- ${cancelPolicyText(p)}`,
    "- Dời lịch: tuỳ lịch trống của studio; phí dời lịch (nếu có) được cộng vào giá trị hợp đồng.",
    "- Studio nếu phải huỷ vì lý do chủ quan sẽ hoàn 100% số tiền đã thanh toán hoặc sắp xếp ê-kíp thay thế.",
  ].join("\n");
}

// ── Tin nhắn gửi khách ──────────────────────────────────────────────────────
const hi = (name?: string | null) => `Chào ${name?.trim() || "anh/chị"},`;

export function cancelClientMessage(o: {
  name?: string | null;
  title?: string | null;
  refund: string | null;
  studio?: string | null;
}): string {
  return [
    hi(o.name),
    `${o.studio || "Studio"} xác nhận đã huỷ hợp đồng "${o.title || "dịch vụ"}" theo yêu cầu.`,
    o.refund ? `Số tiền hoàn lại cho anh/chị: ${o.refund}.` : "Theo chính sách huỷ, khoản đã thanh toán không được hoàn lại.",
    "Cảm ơn anh/chị đã tin tưởng, hy vọng được phục vụ anh/chị dịp khác ạ.",
  ].join("\n");
}

export function rescheduleClientMessage(o: {
  name?: string | null;
  title?: string | null;
  oldDate: string | null;
  newDate: string;
  newTime?: string | null;
  fee: string | null;
  link?: string | null;
  studio?: string | null;
}): string {
  return [
    hi(o.name),
    `${o.studio || "Studio"} xác nhận đã dời lịch "${o.title || "buổi chụp"}"${o.oldDate ? ` từ ${o.oldDate}` : ""} sang ${o.newDate}${o.newTime ? ` lúc ${o.newTime}` : ""}.`,
    o.fee ? `Phí dời lịch: ${o.fee} (đã cộng vào hợp đồng).` : "",
    o.link ? `Xem lại hợp đồng: ${o.link}` : "",
  ].filter(Boolean).join("\n");
}
