/**
 * Phần THUẦN của email gửi khách song song với tin Zalo — tiêu đề theo mốc, đổi
 * nội dung tin (văn bản Zalo) sang HTML. Không import gì để test nạp thẳng được:
 * desktop/test/client-email.mjs.
 */

/** Tiêu đề email theo mốc tin Zalo. Mốc lạ → tiêu đề chung. */
const SUBJECT: Record<string, string> = {
  shoot_reminder: "Nhắc lịch chụp ngày mai",
  payment_due: "Nhắc thanh toán",
  deposit_confirm: "Đã nhận cọc",
  payment_done: "Đã thanh toán đủ — cảm ơn anh/chị",
  select_ready: "Mời anh/chị chọn ảnh",
  select_nudge: "Nhắc chọn ảnh",
  delivery_ready: "Ảnh của anh/chị đã sẵn sàng",
  quote_expiring: "Báo giá sắp hết hạn",
  contract_share: "Hợp đồng dịch vụ của anh/chị",
  manual: "Thông báo",
};

export function emailSubject(kind: string | null | undefined, studio: string | null | undefined): string {
  const label = (kind && SUBJECT[kind]) || "Thông báo";
  const s = (studio || "").trim();
  return s ? `${s}: ${label}` : label;
}

/** Địa chỉ email trông hợp lệ (đủ để không gửi rác vào API). */
export function isEmail(s: string | null | undefined): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test((s || "").trim());
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

/**
 * Văn bản tin Zalo → HTML email: giữ xuống dòng, biến link http(s) thành link
 * bấm được (Zalo tự làm việc này, email thì không). Escape TRƯỚC rồi mới gắn
 * thẻ <a>, nên nội dung tin không thể chèn HTML.
 */
export function bodyToHtml(body: string, studio?: string | null): string {
  const html = esc(body || "")
    .replace(/https?:\/\/[^\s<]+/g, (u) => {
      // Dấu câu dính cuối link ("...link.", "...link)") không thuộc link.
      const m = /^(.*?)([.,;:!?)]*)$/.exec(u)!;
      return `<a href="${m[1]}" style="color:#2563eb">${m[1]}</a>${m[2]}`;
    })
    .replace(/\n/g, "<br>");
  const foot = studio ? `<p style="color:#888;font-size:12px;margin-top:20px">Email tự động từ ${esc(studio)}.</p>` : "";
  return `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#222;max-width:560px;margin:0 auto"><p>${html}</p>${foot}</div>`;
}
