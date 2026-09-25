/* Nhãn và nhóm cho nhật ký thao tác — dùng ở cả máy chủ lẫn trình duyệt, nên
   file này KHÔNG import "server-only". Xem supabase/migrations/studio_audit_log.sql. */

export type AuditGroup = "money" | "contract" | "addendum" | "voucher" | "security" | "other";

export const AUDIT_GROUP_LABEL: Record<AuditGroup, string> = {
  money: "Tiền",
  contract: "Hợp đồng",
  addendum: "Phụ lục",
  voucher: "Voucher",
  security: "Bảo mật",
  other: "Khác",
};

/** Nhóm của một hành động ('payment.delete' → 'money'). */
export function auditGroup(action: string): AuditGroup {
  const head = String(action || "").split(".")[0];
  if (head === "payment" || head === "expense") return "money";
  if (head === "contract" || head === "items") return "contract";
  if (head === "addendum") return "addendum";
  if (head === "voucher") return "voucher";
  if (head === "mfa" || head === "account") return "security";
  return "other";
}

/** Hành động "nguy hiểm" — tô đỏ để chủ studio nhìn thấy ngay khi lướt. */
export function auditIsDestructive(action: string): boolean {
  return /\.(delete|clear|void|unenroll)$/.test(String(action || ""));
}
