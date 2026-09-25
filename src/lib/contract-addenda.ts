/* ═══════════════════════════════════════════════════════════════════════════
   PHỤ LỤC HỢP ĐỒNG — phần thuần (không đụng database), để kiểm thử bằng node.

   Khách ký hợp đồng xong thì hạng mục gốc bị khoá (trigger trong
   supabase/migrations/contract_addenda.sql). Thêm/bớt dịch vụ sau đó đi bằng
   phụ lục: bản nháp nằm ở `contract_addenda.lines`, chỉ khi khách ký (hoặc
   studio xác nhận thay) mới thành dòng `contract_items` — nên mọi tổng tiền
   của app tự đúng mà không phải sửa từng nơi.
   ═══════════════════════════════════════════════════════════════════════════ */

export type AddendumLine = { name: string; description: string | null; qty: number; unit_price: number };

export type ContractAddendum = {
  id: string;
  contract_id: string;
  no: number;
  title: string;
  note: string | null;
  lines: AddendumLine[];
  signed_at: string | null;
  signed_by: "client" | "studio" | null;
  signed_name: string | null;
  created_at: string;
};

export const MAX_ADDENDUM_LINES = 50;

/**
 * Làm sạch dòng nháp gửi lên từ trình duyệt: bỏ dòng không tên, số lượng là
 * số nguyên 1–999, đơn giá làm tròn về đồng (âm = giảm giá), cắt độ dài chữ.
 */
export function normalizeAddendumLines(raw: unknown): AddendumLine[] {
  if (!Array.isArray(raw)) return [];
  const out: AddendumLine[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const name = String(o.name ?? "").trim().slice(0, 200);
    if (!name) continue;
    const qty = Math.min(999, Math.max(1, Math.round(Number(o.qty) || 1)));
    const price = Math.round(Number(o.unit_price) || 0);
    const unit_price = Math.max(-1_000_000_000, Math.min(1_000_000_000, price));
    const desc = String(o.description ?? "").trim().slice(0, 1000);
    out.push({ name, description: desc || null, qty, unit_price });
    if (out.length >= MAX_ADDENDUM_LINES) break;
  }
  return out;
}

/** Tổng một phụ lục (có thể âm nếu chỉ toàn giảm giá). */
export function addendumTotal(lines: AddendumLine[]): number {
  return lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unit_price) || 0), 0);
}

/** Số thứ tự phụ lục kế tiếp của một hợp đồng: 1, 2, 3… (lấp lỗ không cần). */
export function nextAddendumNo(existing: { no: number }[]): number {
  return existing.reduce((m, a) => Math.max(m, Number(a.no) || 0), 0) + 1;
}

/** Tiêu đề mặc định: "Phụ lục 2". */
export function addendumLabel(a: { no: number; title?: string | null }): string {
  const t = (a.title ?? "").trim();
  return t ? `Phụ lục ${a.no} · ${t}` : `Phụ lục ${a.no}`;
}

/** Lỗi trigger khoá hạng mục → câu dễ hiểu cho studio. */
export function isSignedLockError(err: unknown): boolean {
  const m = err && typeof err === "object" ? String((err as { message?: string }).message ?? "") : "";
  return m.includes("contract_signed_locked");
}
