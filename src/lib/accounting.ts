/**
 * HOÁ ĐƠN & XUẤT KẾ TOÁN.
 *
 * Studio có doanh thu thật thì cần hai thứ mà app chưa có:
 *   1. PHIẾU THU đưa khách cho mỗi lần nhận tiền.
 *   2. Bản XUẤT theo kỳ đưa kế toán, và một mốc KHOÁ SỔ để số liệu quá khứ
 *      không đổi khi ai đó sửa một hợp đồng cũ.
 *
 * File này là LUẬT THUẦN: đánh số phiếu, dựng dữ liệu cho khung in, cộng sổ theo
 * kỳ, tính công nợ, và luật khoá sổ. Không đọc DB — kiểm thử bằng node
 * (`npm run test:accounting`).
 *
 * Phiếu thu KHÔNG dựng hệ thống in thứ hai: nó trả về đúng hình dữ liệu
 * `ContractPrintData` của @/lib/contract-print, chỉ đổi `heading` và bảng hạng
 * mục. Một khung in, hai loại giấy.
 */

import type { ContractPrintData, PrintStudio } from "./contract-print";

/* ─────────────────────────────────────────────────────────────────────────────
   Số phiếu thu
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * Số phiếu thu: `PT-2026-0007`.
 *
 * Đánh số theo NĂM, không theo toàn bộ lịch sử: đây là nếp sổ sách Việt Nam, và
 * nó giữ cho số phiếu ngắn kể cả sau mười năm. Số thứ tự do DB cấp (xem
 * migration accounting.sql), hàm này chỉ định dạng.
 */
export function receiptNo(seq: number, year: number): string {
  const y = Math.trunc(year);
  const n = Math.max(1, Math.trunc(seq));
  return `PT-${y}-${String(n).padStart(4, "0")}`;
}

/** Năm của một ngày 'YYYY-MM-DD' hoặc ISO. Không đọc được → năm hiện tại. */
export function yearOf(date: string | null | undefined, fallback: number): number {
  const m = String(date ?? "").match(/^(\d{4})-/);
  return m ? Number(m[1]) : fallback;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Dữ liệu phiếu thu cho khung in
   ───────────────────────────────────────────────────────────────────────────── */

export type ReceiptInput = {
  no: string;
  /** Ngày thu, đã định dạng dd/mm/yyyy. */
  paidOn: string;
  amount: number;
  kindLabel: string;
  note?: string | null;
  studio: PrintStudio;
  client: { name?: string | null; phone?: string | null; address?: string | null };
  contract: { title?: string | null; code?: string | null };
  /** Tổng giá trị hợp đồng. */
  contractTotal: number;
  /** Đã thu TRƯỚC phiếu này (không gồm phiếu này). */
  paidBefore: number;
};

/**
 * Dựng dữ liệu cho khung in hợp đồng, ở dạng PHIẾU THU.
 *
 * Ba con số bắt buộc có mặt và bắt buộc đúng: số tiền lần này, tổng đã thu, còn
 * lại. Khách cầm tờ giấy này về và đối chiếu; sai một trong ba là mất lòng tin
 * vào cả studio.
 */
export function receiptPrintData(r: ReceiptInput): ContractPrintData {
  const paidAfter = r.paidBefore + r.amount;
  // Kẹp ở 0: hợp đồng thu vượt (khách trả dư rồi hoàn sau) không được hiện "còn
  // lại −500.000đ" trên giấy đưa khách.
  const remaining = Math.max(0, r.contractTotal - paidAfter);

  return {
    docTitle: `Phiếu thu ${r.no}`,
    heading: "PHIẾU THU",
    nationalHeading: true,
    title: r.contract.title ?? null,
    code: r.no,
    issuedAt: r.paidOn,
    studio: r.studio,
    client: { name: r.client.name ?? null, phone: r.client.phone ?? null, address: r.client.address ?? null },
    facts: [
      { label: "Hợp đồng", value: r.contract.code || r.contract.title || "—", wide: true },
      { label: "Hình thức", value: r.kindLabel },
      { label: "Ngày thu", value: r.paidOn },
      ...(r.note ? [{ label: "Nội dung", value: r.note, wide: true } as const] : []),
    ],
    items: [{ name: `Thu tiền ${r.kindLabel.toLowerCase()}`, qty: 1, unitPrice: r.amount, amount: r.amount }],
    totals: [
      { label: "Số tiền thu lần này", amount: r.amount, strong: true, bold: true },
      { label: "Tổng giá trị hợp đồng", amount: r.contractTotal },
      { label: "Đã thu (gồm lần này)", amount: paidAfter },
      { label: "Còn lại", amount: remaining, bold: true },
    ],
    amountInWords: r.amount,
    signs: [
      { label: "Người nộp tiền", name: r.client.name ?? null },
      { label: "Người thu tiền", name: r.studio.name ?? null },
    ],
    footer: "Phiếu thu được lập tự động từ phần mềm quản lý studio.",
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   Cộng sổ theo kỳ
   ───────────────────────────────────────────────────────────────────────────── */

export type MoneyRow = {
  /** 'YYYY-MM-DD' */
  date: string;
  amount: number;
  label: string;
  category?: string | null;
  contractCode?: string | null;
  contractTitle?: string | null;
  clientName?: string | null;
};

/** Ngày nằm trong kỳ [from, to] (bao gồm hai đầu). */
export function inPeriod(date: string, from: string, to: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  return date >= from && date <= to;
}

export type PeriodSummary = {
  income: number;
  expense: number;
  /** Lợi nhuận gộp = thu − chi trong kỳ. */
  profit: number;
  incomeCount: number;
  expenseCount: number;
  /** Chi theo nhóm, xếp giảm dần. */
  byCategory: { category: string; amount: number; count: number }[];
};

export const CATEGORY_LABEL: Record<string, string> = {
  vendor: "Nhà cung cấp",
  equipment: "Thiết bị",
  rent: "Mặt bằng",
  marketing: "Quảng cáo",
  salary: "Lương & tiền công",
  travel: "Đi lại",
  other: "Khác",
};

export function categoryLabel(c: string | null | undefined): string {
  const k = (c ?? "").trim();
  return CATEGORY_LABEL[k] ?? (k ? k : CATEGORY_LABEL.other);
}

export function periodSummary(income: MoneyRow[], expense: MoneyRow[], from: string, to: string): PeriodSummary {
  const inc = income.filter((r) => inPeriod(r.date, from, to));
  const exp = expense.filter((r) => inPeriod(r.date, from, to));
  const sum = (rows: MoneyRow[]) => rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  const cats = new Map<string, { amount: number; count: number }>();
  for (const r of exp) {
    const k = categoryLabel(r.category);
    const cur = cats.get(k) ?? { amount: 0, count: 0 };
    cur.amount += Number(r.amount) || 0;
    cur.count++;
    cats.set(k, cur);
  }

  const income_ = sum(inc);
  const expense_ = sum(exp);
  return {
    income: income_,
    expense: expense_,
    profit: income_ - expense_,
    incomeCount: inc.length,
    expenseCount: exp.length,
    byCategory: [...cats.entries()]
      .map(([category, v]) => ({ category, ...v }))
      .sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category, "vi")),
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   Công nợ
   ───────────────────────────────────────────────────────────────────────────── */

export type ReceivableInput = {
  contractId: string;
  code: string | null;
  title: string;
  clientName: string | null;
  eventDate: string | null;
  status: string;
  total: number;
  paid: number;
};

export type Receivable = ReceivableInput & { remaining: number };

/**
 * Công nợ = hợp đồng còn thiếu tiền.
 *
 * Hợp đồng ĐÃ HUỶ bị loại hẳn: studio không đòi tiền một hợp đồng đã huỷ, và để
 * nó nằm trong bảng công nợ sẽ thổi con số "khách còn nợ" lên một cách vô nghĩa.
 * Hợp đồng thu DƯ cũng bị loại (remaining ≤ 0) — đó không phải công nợ.
 */
export function receivables(rows: ReceivableInput[]): Receivable[] {
  return rows
    .filter((r) => r.status !== "cancelled")
    .map((r) => ({ ...r, remaining: (Number(r.total) || 0) - (Number(r.paid) || 0) }))
    .filter((r) => r.remaining > 0)
    .sort((a, b) => b.remaining - a.remaining);
}

export function totalReceivable(rows: Receivable[]): number {
  return rows.reduce((s, r) => s + r.remaining, 0);
}

/* ─────────────────────────────────────────────────────────────────────────────
   Khoá sổ
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * Ngày này đã bị KHOÁ SỔ chưa?
 *
 * `closedUntil` là ngày cuối cùng ĐÃ chốt ('YYYY-MM-DD'), hoặc `null` khi studio
 * chưa khoá kỳ nào. Mọi bút toán có ngày ≤ mốc đó là bất biến.
 *
 * Vì sao cần: báo cáo tháng trước đã gửi kế toán, rồi ai đó sửa một hợp đồng cũ
 * và con số tháng trước đổi — không ai phát hiện, và bản đã gửi thành sai. Khoá
 * sổ biến "đừng sửa số cũ" từ một lời dặn miệng thành một hàng rào.
 */
export function isLocked(date: string | null | undefined, closedUntil: string | null | undefined): boolean {
  if (!closedUntil || !/^\d{4}-\d{2}-\d{2}$/.test(closedUntil)) return false;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  return date <= closedUntil;
}

/** Ngày cuối của tháng 'YYYY-MM' — mốc khoá sổ khi studio chốt một tháng. */
export function endOfMonth(ym: string): string | null {
  const m = String(ym ?? "").match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) return null;
  // Ngày 0 của tháng SAU = ngày cuối của tháng này; tự đúng cả năm nhuận.
  const d = new Date(Date.UTC(y, mo, 0));
  return d.toISOString().slice(0, 10);
}

/** Câu giải thích cho studio khi một thao tác bị khoá sổ chặn. */
export function lockedMessage(closedUntil: string): string {
  return `Sổ đã khoá tới ${closedUntil.split("-").reverse().join("/")}. Muốn sửa số liệu trước mốc này, hãy mở khoá kỳ ở màn Thu chi & công nợ.`;
}

/**
 * Bút toán này có bị hàng rào khoá sổ chặn không?
 *
 * ĐÂY LÀ BẢN SAO Ở TẦNG CODE của trigger `guard_books_closed()` trong
 * supabase/migrations/accounting.sql. Hàng rào THẬT nằm ở DB (RLS cho phép
 * studio ghi thẳng bằng anon key, nên một kiểm tra ở React không chặn được ai);
 * hàm này để giao diện nói trước một câu tử tế thay vì để người dùng đâm vào lỗi
 * Postgres, và để luật đó KIỂM THỬ ĐƯỢC.
 *
 * Sửa luật thì phải sửa CẢ HAI nơi — hai bản lệch nhau là giao diện nói được mà
 * DB chối, hoặc tệ hơn: giao diện chối mà DB cho qua.
 *
 * Hai điểm tinh:
 *  - Xét CẢ ngày cũ lẫn ngày mới: dời một bút toán RA KHỎI kỳ đã khoá cũng là
 *    làm đổi số của kỳ đó, y như sửa tại chỗ.
 *  - Sửa mà KHÔNG động tới tiền (đóng số phiếu thu, đính ảnh chuyển khoản, sửa
 *    ghi chú) thì cho qua. Chặn cả những thứ đó thì studio sẽ đi mở khoá sổ chỉ
 *    để in một tờ phiếu, và cái khoá thành vô nghĩa.
 */
export type BookOp = "insert" | "update" | "delete";

export function blocksWrite(o: {
  op: BookOp;
  closedUntil: string | null | undefined;
  /** Ngày của bản ghi TRƯỚC thao tác ('YYYY-MM-DD'). Không có với `insert`. */
  oldDate?: string | null;
  /** Ngày của bản ghi SAU thao tác. Không có với `delete`. */
  newDate?: string | null;
  /** Chỉ xét với `update`: thao tác có làm đổi tiền/ngày/nhóm/hợp đồng không. */
  moneyChanged?: boolean;
}): boolean {
  const closed = o.closedUntil;
  if (!closed || !/^\d{4}-\d{2}-\d{2}$/.test(closed)) return false;
  if (o.op === "update" && o.moneyChanged === false) return false;
  return isLocked(o.oldDate, closed) || isLocked(o.newDate, closed);
}

/** Câu báo cho giao diện — cùng ý với thông báo của trigger dưới DB. */
export function blockedWriteMessage(closedUntil: string): string {
  return `Sổ đã khoá tới ${closedUntil.split("-").reverse().join("/")}. Bút toán trong kỳ đã chốt không sửa/xoá/thêm được — mở khoá kỳ ở màn Thu chi & công nợ nếu thật sự cần.`;
}
