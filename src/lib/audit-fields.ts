/* Dịch ảnh chụp "trước / sau" của nhật ký thao tác thành các dòng người đọc
   được — thay cho JSON thô. Thuần, dùng được ở trình duyệt và trong test Node.
   Dữ liệu gốc: supabase/migrations/studio_audit_log.sql và các lời gọi logAction. */
import {
  CONTRACT_STATUS_LABEL,
  PAYMENT_KIND_LABEL,
  PAYMENT_METHOD_LABEL,
} from "./types";

export type AuditLine = { name: string; qty: string; price: string };
export type AuditField = {
  label: string;
  /** Có cả trước lẫn sau → dòng "đã đổi". Chỉ một bên → dòng thông tin. */
  before?: string;
  after?: string;
  /** Danh sách hạng mục (items.save, phụ lục) — hiện thành bảng nhỏ. */
  lines?: AuditLine[];
};

type Kind = "money" | "date" | "bool" | "text" | "status" | "method" | "payKind" | "proof";

/** Trường được hiện, theo đúng thứ tự này. Trường khác không có trong bảng thì ẩn. */
const FIELDS: [key: string, label: string, kind: Kind][] = [
  ["code", "Mã", "text"],
  ["title", "Tên", "text"],
  ["client_name", "Tên khách", "text"],
  ["client_phone", "SĐT khách", "text"],
  ["status", "Trạng thái", "status"],
  ["event_date", "Ngày chụp", "date"],
  ["event_time", "Giờ", "text"],
  ["amount", "Số tiền", "money"],
  ["price", "Giá bán", "money"],
  ["deposit", "Cọc", "money"],
  ["refund", "Hoàn tiền", "money"],
  ["kind", "Loại", "payKind"],
  ["method", "Hình thức", "method"],
  ["paid", "Đã thu", "bool"],
  ["paid_at", "Ngày thu", "date"],
  ["spent_at", "Ngày chi", "date"],
  ["category", "Danh mục", "text"],
  ["receipt_no", "Số phiếu thu", "text"],
  ["proof_url", "Ảnh chứng từ", "proof"],
  ["expires_at", "Hết hạn", "date"],
  ["note", "Ghi chú", "text"],
  ["reason", "Lý do", "text"],
];

const vnd = (n: number) => Math.round(n).toLocaleString("vi-VN") + "đ";

function fmtDay(s: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
}

function show(v: unknown, kind: Kind): string {
  if (v == null || v === "") return "—";
  switch (kind) {
    case "money":
      return Number.isFinite(Number(v)) ? vnd(Number(v)) : String(v);
    case "date":
      return fmtDay(String(v));
    case "bool":
      return v ? "Có" : "Chưa";
    case "status":
      return (CONTRACT_STATUS_LABEL as Record<string, string>)[String(v)] ?? String(v);
    case "method":
      return (PAYMENT_METHOD_LABEL as Record<string, string>)[String(v)] ?? String(v);
    case "payKind":
      return (PAYMENT_KIND_LABEL as Record<string, string>)[String(v)] ?? String(v);
    case "proof":
      return "Có ảnh";
    default:
      return typeof v === "object" ? JSON.stringify(v) : String(v);
  }
}

function toLines(v: unknown): AuditLine[] | null {
  if (!Array.isArray(v)) return null;
  return v.map((l) => {
    const r = (l ?? {}) as { name?: unknown; qty?: unknown; unit_price?: unknown };
    return {
      name: String(r.name ?? "—"),
      qty: String(r.qty ?? 1),
      price: Number.isFinite(Number(r.unit_price)) ? vnd(Number(r.unit_price)) : "—",
    };
  });
}

const obj = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

/**
 * Sửa (có cả trước và sau) → chỉ những trường ĐÃ ĐỔI.
 * Thêm / xoá (một bên) → những trường có giá trị.
 * id, owner_id, mốc tạo… không bao giờ hiện: không ai đọc được chúng.
 */
export function auditFields(before: unknown, after: unknown): AuditField[] {
  const b = obj(before);
  const a = obj(after);
  const both = !!b && !!a;
  const out: AuditField[] = [];

  for (const [key, label, kind] of FIELDS) {
    const hasB = !!b && key in b;
    const hasA = !!a && key in a;
    if (!hasB && !hasA) continue;
    const vb = b?.[key];
    const va = a?.[key];
    if (both) {
      if (JSON.stringify(vb ?? null) === JSON.stringify(va ?? null)) continue;
      out.push({ label, before: show(vb, kind), after: show(va, kind) });
    } else {
      const v = hasA ? va : vb;
      if (v == null || v === "") continue;
      out.push(hasA ? { label, after: show(v, kind) } : { label, before: show(v, kind) });
    }
  }

  const lb = toLines(b?.lines);
  const la = toLines(a?.lines);
  if (la) out.push({ label: both ? "Hạng mục (sau)" : "Hạng mục", lines: la });
  if (lb && (!la || JSON.stringify(lb) !== JSON.stringify(la))) {
    out.push({ label: la ? "Hạng mục (trước)" : "Hạng mục", lines: lb });
  }
  return out;
}
