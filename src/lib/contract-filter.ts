/**
 * Lọc & tách nhóm danh sách hợp đồng cho trang "Quản lý hợp đồng".
 *
 * Để riêng ra khỏi component (và KHÔNG import gì) vì đây là phần dễ sai nhất —
 * nhờ vậy desktop/test/contract-filter.mjs nạp được thẳng file này để kiểm thử,
 * không cần bước build.
 */

/** Chỉ những cột mà bộ lọc thực sự đọc — nhận cả ContractRow đầy đủ. */
export type FilterableContract = {
  code: string | null;
  title: string;
  client_name: string | null;
  client_phone: string | null;
  event_date: string | null;
  status: string;
  /** Giờ chụp "HH:MM". Chỉ dùng để xếp hai buổi CÙNG NGÀY cho đúng thứ tự. */
  event_time?: string | null;
};

export type ContractFilters = {
  /** Tìm chung: tên HĐ, tên khách, ngày thực hiện, mã, SĐT. */
  q?: string;
  /** Lọc riêng theo mã hợp đồng. */
  code?: string;
  /** Ngày thực hiện từ (YYYY-MM-DD). */
  from?: string;
  /** Ngày thực hiện đến (YYYY-MM-DD). */
  to?: string;
};

/**
 * "2026-03-15" → "15/03/2026" để gõ ngày y như đang hiện trên danh sách là tìm
 * được. Cố tình làm tại chỗ (thay vì dùng fmtDate ở lib/date) để file này không
 * phụ thuộc gì và test nạp được trực tiếp; chỉ nhận đúng dạng ISO của cột date.
 */
function dmy(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/**
 * Áp tìm kiếm + mã + khoảng ngày thực hiện. KHÔNG lọc trạng thái — việc đó do
 * splitContracts làm, để số đếm hai tab cùng phản ánh một bộ lọc.
 */
export function filterContracts<T extends FilterableContract>(
  rows: readonly T[],
  { q = "", code = "", from = "", to = "" }: ContractFilters
): T[] {
  const needle = q.trim().toLowerCase();
  const codeNeedle = code.trim().toLowerCase();
  return rows.filter((c) => {
    if (codeNeedle && !(c.code || "").toLowerCase().includes(codeNeedle)) return false;
    // HĐ chưa có ngày thực hiện thì không thể nằm trong khoảng ngày đã chọn.
    if (from && (!c.event_date || c.event_date < from)) return false;
    if (to && (!c.event_date || c.event_date > to)) return false;
    if (!needle) return true;
    const hay = [
      c.title,
      c.client_name,
      c.code,
      c.client_phone,
      c.event_date,
      c.event_date ? dmy(c.event_date) : "",
    ];
    return hay.some((v) => !!v && v.toLowerCase().includes(needle));
  });
}

/**
 * Kiểu sắp xếp. "default" = giữ nguyên thứ tự server trả về (mới tạo trước),
 * nên KHÔNG sắp lại — danh sách vốn đã order by created_at desc.
 */
export type ContractSort = "default" | "event_asc" | "event_desc" | "code_asc" | "code_desc";

/** So sánh mã HĐ có số: "HD-2" phải đứng trước "HD-10" (numeric), không phân biệt hoa thường. */
const cmpCode = (a: string, b: string) => a.localeCompare(b, "vi", { numeric: true, sensitivity: "base" });

/**
 * Sắp xếp theo ngày thực hiện hoặc mã HĐ. Không sửa mảng gốc (rows là state +
 * cache trên máy). HĐ thiếu ngày/mã luôn xuống cuối ở CẢ hai chiều — xếp chúng
 * lẫn vào giữa thì vô nghĩa và làm studio tưởng mất dữ liệu. Cùng khoá thì
 * chốt thứ tự bằng mã rồi tên để kết quả không nhảy giữa các lần render.
 */
export function sortContracts<T extends FilterableContract>(rows: readonly T[], sort: ContractSort): T[] {
  if (sort === "default") return [...rows];
  const dir = sort === "event_desc" || sort === "code_desc" ? -1 : 1;
  const key = (c: T) => (sort === "code_asc" || sort === "code_desc" ? c.code : c.event_date) || "";
  return [...rows].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    // Thiếu khoá → xuống cuối, không nhân với dir.
    if (!ka && !kb) return cmpCode(a.code || a.title, b.code || b.title);
    if (!ka) return 1;
    if (!kb) return -1;
    const primary = sort === "code_asc" || sort === "code_desc" ? cmpCode(ka, kb) : ka < kb ? -1 : ka > kb ? 1 : 0;
    if (primary !== 0) return primary * dir;
    return cmpCode(a.code || a.title, b.code || b.title);
  });
}

/**
 * Tách HĐ đã hoàn thành sang nhóm riêng. Ở nhóm "đang thực hiện" mới áp thêm
 * lọc trạng thái ("all" = mọi trạng thái chưa hoàn thành, kể cả nháp/đã huỷ).
 */
export function splitContracts<T extends FilterableContract>(
  matched: readonly T[],
  tab: "active" | "completed",
  status: string = "all"
): T[] {
  return matched.filter((c) => {
    if (tab === "completed") return c.status === "completed";
    if (c.status === "completed") return false;
    return status === "all" || c.status === status;
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   TAB "SẮP TỚI" — buổi chụp trong 7 ngày tới, gần nhất lên đầu.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Số ngày của tab "Sắp tới". Đổi ở đây là đổi cả nhãn tab lẫn phép lọc. */
export const UPCOMING_DAYS = 7;

/**
 * Cộng ngày cho chuỗi ISO "YYYY-MM-DD". Tự làm bằng UTC thay vì `new Date(iso)`
 * giờ địa phương: máy đặt múi giờ âm sẽ lùi mất một ngày, và cả cửa sổ 7 ngày
 * lệch theo. Trả "" nếu đầu vào không đúng dạng.
 */
export function addDaysIso(iso: string, days: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Hợp đồng đã HUỶ hoặc đã HOÀN THÀNH không phải "việc sắp tới" — buổi chụp của
 * chúng có thể vẫn nằm trong tuần nhưng studio không cần chuẩn bị gì nữa.
 * Hợp đồng NHÁP thì có: ngày đã chốt trong đầu, chỉ là chưa gửi khách ký, và đó
 * chính là thứ cần nhắc trước khi tới ngày.
 */
const UPCOMING_SKIP = new Set(["completed", "cancelled"]);

/**
 * Buổi chụp rơi vào cửa sổ [hôm nay, hôm nay + days]. Bao gồm CẢ hôm nay: buổi
 * chiều nay vẫn là việc phải chuẩn bị, bỏ nó ra khỏi tab là bỏ đúng việc gấp
 * nhất. Cột event_date kiểu date nên so sánh chuỗi là đúng thứ tự.
 */
export function isUpcoming<T extends FilterableContract>(c: T, today: string, days = UPCOMING_DAYS): boolean {
  if (!c.event_date || UPCOMING_SKIP.has(c.status)) return false;
  const end = addDaysIso(today, days);
  return c.event_date >= today && (!end || c.event_date <= end);
}

/**
 * Danh sách "sắp tới", ĐÃ xếp gần nhất lên đầu: theo ngày, rồi theo giờ trong
 * cùng một ngày (buổi thiếu giờ xuống cuối ngày hôm đó — không đoán hộ studio
 * là nó chụp sáng hay chiều), rồi chốt bằng mã HĐ để thứ tự không nhảy giữa các
 * lần render.
 */
export function upcomingContracts<T extends FilterableContract>(
  rows: readonly T[],
  today: string,
  days = UPCOMING_DAYS
): T[] {
  return rows
    .filter((c) => isUpcoming(c, today, days))
    .sort((a, b) => {
      if (a.event_date !== b.event_date) return (a.event_date as string) < (b.event_date as string) ? -1 : 1;
      const ta = a.event_time || "99:99";
      const tb = b.event_time || "99:99";
      if (ta !== tb) return ta < tb ? -1 : 1;
      return cmpCode(a.code || a.title, b.code || b.title);
    });
}
