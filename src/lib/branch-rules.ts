/* ═══════════════════════════════════════════════════════════════════════════
   LUẬT CHI NHÁNH — phần TÍNH TOÁN THUẦN.

   Tách riêng khỏi `branches.ts` (nơi đọc cookie và gọi Supabase) vì đây là loại
   code sai âm thầm: gộp số của chi nhánh sai một dòng thì doanh thu của cơ sở A
   nhảy sang cơ sở B, không có gì nổ và bảng vẫn cộng đủ tổng. Đứng riêng, nó
   chạy được trực tiếp trong Node để kiểm thử.

   File này KHÔNG import gì: kiểu khai theo CẤU TRÚC (chỉ những cột dùng tới) nên
   `StudioBranch` và các bản ghi thật của src/lib/types.ts tự khớp.
   ═══════════════════════════════════════════════════════════════════════════ */

export type BranchRow = { id: string; name: string; code: string | null; active: boolean; position: number };

/** Giá trị cho ô chọn / cookie. "all" = xem gộp, "none" = riêng phần chưa gán. */
export const BRANCH_ALL = "all";
export const BRANCH_NONE = "none";

/** Nhãn khi một bản ghi chưa được gán cơ sở nào. */
export const UNASSIGNED_LABEL = "Chưa gán chi nhánh";

/**
 * Chuẩn hoá giá trị chi nhánh đang chọn (từ cookie hoặc query) thành một trong:
 *   - null        → xem gộp mọi chi nhánh
 *   - "none"      → chỉ những bản ghi CHƯA gán chi nhánh
 *   - "<uuid>"    → một chi nhánh CÓ THẬT trong danh sách của studio này
 *
 * Chốt cuối cùng là danh sách `branches`: cookie còn giữ id của một chi nhánh đã
 * bị xoá (hoặc id của studio khác) thì phải rơi về "xem gộp", chứ không được lọc
 * theo một id lạ và cho ra màn hình trống mà không ai hiểu vì sao.
 */
export function normalizeBranch(raw: string | null | undefined, branches: BranchRow[]): string | null {
  const v = (raw ?? "").trim();
  if (!v || v === BRANCH_ALL) return null;
  if (v === BRANCH_NONE) return BRANCH_NONE;
  return branches.some((b) => b.id === v) ? v : null;
}

/** Chi nhánh đang chọn có phải một cơ sở thật (không phải "gộp"/"chưa gán")? */
export function isRealBranch(sel: string | null): sel is string {
  return !!sel && sel !== BRANCH_NONE;
}

/**
 * Một bản ghi có thuộc phạm vi đang chọn không. Dùng cho lọc PHÍA CLIENT (khi
 * dữ liệu đã nạp sẵn cả studio); lọc phía server thì thêm điều kiện vào truy vấn
 * bằng `branchFilter` bên dưới.
 */
export function inBranch(row: { branch_id?: string | null }, sel: string | null): boolean {
  if (sel === null) return true;
  if (sel === BRANCH_NONE) return !row.branch_id;
  return row.branch_id === sel;
}

/**
 * Điều kiện truy vấn Supabase cho phạm vi đang chọn.
 *   null        → không thêm gì (xem gộp)
 *   "none"      → branch_id IS NULL
 *   "<uuid>"    → branch_id = uuid
 * Trả về mô tả để chỗ gọi áp vào query — giữ file này thuần, không phụ thuộc
 * client Supabase.
 */
export function branchFilter(sel: string | null): { kind: "all" } | { kind: "null" } | { kind: "eq"; id: string } {
  if (sel === null) return { kind: "all" };
  if (sel === BRANCH_NONE) return { kind: "null" };
  return { kind: "eq", id: sel };
}

/** Nhãn hiển thị của một chi nhánh: "Quận 1 · Q1", hoặc chỉ tên nếu không có mã. */
export function branchLabel(b: Pick<BranchRow, "name" | "code">): string {
  const name = b.name?.trim() || "Chi nhánh";
  const code = b.code?.trim();
  return code ? `${name} · ${code}` : name;
}

/** Tra tên chi nhánh theo id, kể cả khi id rỗng hoặc không còn tồn tại. */
export function branchName(id: string | null | undefined, branches: BranchRow[]): string {
  if (!id) return UNASSIGNED_LABEL;
  const b = branches.find((x) => x.id === id);
  return b ? b.name?.trim() || "Chi nhánh" : UNASSIGNED_LABEL;
}

/** Thứ tự hiện chi nhánh: đang hoạt động trước, rồi theo position, rồi theo tên. */
export function sortBranches<T extends BranchRow>(list: T[]): T[] {
  return [...list].sort(
    (a, b) =>
      Number(b.active) - Number(a.active) ||
      a.position - b.position ||
      (a.name || "").localeCompare(b.name || "", "vi")
  );
}

/* ── Gộp số liệu theo chi nhánh ───────────────────────────────────────────── */

export type BranchStats = {
  branchId: string | null;
  contracts: number;
  revenue: number;
  /** Tổng giá trị hợp đồng (chưa trừ gì) — để so với số đã thu. */
  contractValue: number;
  expenses: number;
  staff: number;
  crew: number;
  appointments: number;
};

function emptyStats(branchId: string | null): BranchStats {
  return { branchId, contracts: 0, revenue: 0, contractValue: 0, expenses: 0, staff: 0, crew: 0, appointments: 0 };
}

/**
 * Gộp số liệu của MỘT LƯỢT quét thành bảng theo chi nhánh, kèm khoá `null` cho
 * phần chưa gán. Mỗi chi nhánh trong `branches` luôn có một hàng (kể cả khi
 * chưa có dữ liệu) — thẻ chi nhánh mới tạo phải hiện 0 chứ không được biến mất.
 *
 * `revenue` = tiền THỰC THU (tổng contract_payments của các hợp đồng thuộc chi
 * nhánh đó), không phải giá trị hợp đồng: đó là con số chủ studio hỏi khi so hai
 * cơ sở với nhau.
 */
export function statsByBranch(
  branches: BranchRow[],
  data: {
    contracts?: { branch_id: string | null; items?: { qty: number; unit_price: number }[]; payments?: { amount: number }[] }[];
    expenses?: { branch_id: string | null; amount: number }[];
    staff?: { studio_branch_id: string | null }[];
    crew?: { branch_id: string | null }[];
    appointments?: { branch_id: string | null }[];
  }
): Map<string | null, BranchStats> {
  const out = new Map<string | null, BranchStats>();
  const bucket = (id: string | null) => {
    // id không còn trong danh sách (chi nhánh vừa bị xoá, dữ liệu chưa kịp cập
    // nhật) thì dồn vào "chưa gán" thay vì tạo một hàng mồ côi không nhãn.
    const key = id && branches.some((b) => b.id === id) ? id : null;
    let s = out.get(key);
    if (!s) { s = emptyStats(key); out.set(key, s); }
    return s;
  };

  out.set(null, emptyStats(null));
  for (const b of branches) out.set(b.id, emptyStats(b.id));

  for (const c of data.contracts ?? []) {
    const s = bucket(c.branch_id);
    s.contracts += 1;
    s.contractValue += (c.items ?? []).reduce((t, i) => t + (i.qty || 0) * (i.unit_price || 0), 0);
    s.revenue += (c.payments ?? []).reduce((t, p) => t + (p.amount || 0), 0);
  }
  for (const e of data.expenses ?? []) bucket(e.branch_id).expenses += e.amount || 0;
  for (const p of data.staff ?? []) bucket(p.studio_branch_id).staff += 1;
  for (const c of data.crew ?? []) bucket(c.branch_id).crew += 1;
  for (const a of data.appointments ?? []) bucket(a.branch_id).appointments += 1;

  return out;
}

/** Tổng của mọi chi nhánh + phần chưa gán — dòng "Toàn studio". */
export function totalStats(m: Map<string | null, BranchStats>): BranchStats {
  const t = emptyStats(null);
  for (const s of m.values()) {
    t.contracts += s.contracts;
    t.revenue += s.revenue;
    t.contractValue += s.contractValue;
    t.expenses += s.expenses;
    t.staff += s.staff;
    t.crew += s.crew;
    t.appointments += s.appointments;
  }
  return t;
}
