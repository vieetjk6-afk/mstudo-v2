/**
 * NHÀ CUNG CẤP & ĐƠN ĐẶT NGOÀI.
 *
 * Vấn đề: album in, makeup thuê ngoài, xe hoa, địa điểm — tất cả đang chỉ là một
 * dòng chi trong `studio_expenses`. Nên không ai trả lời được câu hỏi hằng ngày
 * của studio: *"đơn album của khách A đã in xong chưa?"*.
 *
 * File này là LUẬT THUẦN: nhãn/màu trạng thái, luật chuyển trạng thái, cảnh báo
 * trễ hẹn, và cộng tiền. Không đọc DB — kiểm thử bằng node
 * (`npm run test:vendors`).
 *
 * MỘT QUYẾT ĐỊNH QUAN TRỌNG VỀ TIỀN: mỗi đơn đặt ngoài sinh ĐÚNG MỘT dòng trong
 * `studio_expenses`, và dòng đó gắn ngược lại đơn bằng `vendor_order_id`. Nhờ
 * vậy tiền KHÔNG bị đếm hai lần khi studio vừa ghi chi phí tay vừa tạo đơn — xem
 * `expenseFor()` và ghi chú trong migration vendors.sql.
 */

/* ─────────────────────────────────────────────────────────────────────────────
   Loại nhà cung cấp
   ───────────────────────────────────────────────────────────────────────────── */

export type VendorKind = "album" | "makeup" | "dress" | "car" | "venue" | "print" | "other";

export const VENDOR_KIND_LABEL: Record<VendorKind, string> = {
  album: "Xưởng album",
  makeup: "Trang điểm",
  dress: "Váy / vest",
  car: "Xe hoa",
  venue: "Địa điểm",
  print: "In ấn",
  other: "Khác",
};

export const VENDOR_KINDS = Object.keys(VENDOR_KIND_LABEL) as VendorKind[];

export function vendorKindLabel(k: string | null | undefined): string {
  return VENDOR_KIND_LABEL[(k ?? "") as VendorKind] ?? VENDOR_KIND_LABEL.other;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Trạng thái đơn
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * Bốn trạng thái, đúng đường đi của một đơn đặt ngoài:
 *   đã gửi → đang làm → đã nhận → đã giao khách
 *
 * Cố ý KHÔNG có "đã huỷ" như một bước: đơn huỷ thì xoá, vì một đơn huỷ vẫn nằm
 * trong danh sách sẽ tiếp tục được cộng tiền và tiếp tục bị đếm là trễ hẹn.
 */
export type OrderStatus = "sent" | "doing" | "received" | "delivered";

export const ORDER_STATUS: readonly OrderStatus[] = ["sent", "doing", "received", "delivered"];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  sent: "Đã gửi",
  doing: "Đang làm",
  received: "Đã nhận",
  delivered: "Đã giao khách",
};

/** Tông màu dùng chung với các màn khác (xem components/studio/ui.tsx). */
export const ORDER_STATUS_TONE: Record<OrderStatus, "gray" | "amber" | "blue" | "green"> = {
  sent: "gray",
  doing: "amber",
  received: "blue",
  delivered: "green",
};

export function orderStatusLabel(s: string | null | undefined): string {
  return ORDER_STATUS_LABEL[(s ?? "") as OrderStatus] ?? ORDER_STATUS_LABEL.sent;
}

/** Bước kế tiếp trên đường đi; `null` khi đã ở bước cuối. */
export function nextStatus(s: OrderStatus): OrderStatus | null {
  const i = ORDER_STATUS.indexOf(s);
  return i < 0 || i >= ORDER_STATUS.length - 1 ? null : ORDER_STATUS[i + 1];
}

/** Đơn đã xong hẳn (không còn phải theo dõi). */
export function isClosed(s: string | null | undefined): boolean {
  return s === "delivered";
}

/* ─────────────────────────────────────────────────────────────────────────────
   Trễ hẹn
   ───────────────────────────────────────────────────────────────────────────── */

export type VendorOrder = {
  id: string;
  vendorId: string | null;
  vendorName?: string | null;
  contractId: string | null;
  title: string;
  amount: number;
  status: OrderStatus;
  /** 'YYYY-MM-DD' — hẹn xong. `null` = chưa hẹn. */
  dueDate: string | null;
  note?: string | null;
};

export type Lateness = { level: "ok" | "soon" | "late"; days: number | null };

/** Còn mấy ngày tới hẹn (âm = đã quá hẹn). */
export function daysToDue(dueDate: string | null | undefined, today: string): number | null {
  if (!dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return null;
  return Math.round((Date.parse(`${dueDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

/** Cảnh báo trong bao nhiêu ngày trước hẹn. */
export const SOON_DAYS = 3;

/**
 * Đơn này có đáng lo không?
 *
 * Đơn ĐÃ GIAO KHÁCH thì luôn "ok" dù hẹn đã qua từ lâu: nó xong rồi, và để nó
 * đỏ mãi trong danh sách sẽ làm studio ngưng nhìn màu đỏ — đúng cái bẫy làm mọi
 * badge cảnh báo mất tác dụng.
 */
export function lateness(o: Pick<VendorOrder, "status" | "dueDate">, today: string): Lateness {
  if (isClosed(o.status)) return { level: "ok", days: null };
  const d = daysToDue(o.dueDate, today);
  if (d === null) return { level: "ok", days: null };
  if (d < 0) return { level: "late", days: d };
  if (d <= SOON_DAYS) return { level: "soon", days: d };
  return { level: "ok", days: d };
}

/** Câu mô tả hạn, đọc được: "quá hẹn 3 ngày" / "còn 2 ngày" / "hẹn hôm nay". */
export function dueLabel(o: Pick<VendorOrder, "status" | "dueDate">, today: string): string {
  if (!o.dueDate) return "Chưa hẹn ngày";
  if (isClosed(o.status)) return `Hẹn ${dmy(o.dueDate)}`;
  const d = daysToDue(o.dueDate, today);
  if (d === null) return "Chưa hẹn ngày";
  if (d < 0) return `Quá hẹn ${-d} ngày`;
  if (d === 0) return "Hẹn hôm nay";
  return `Còn ${d} ngày`;
}

const dmy = (ymd: string) => ymd.split("-").reverse().join("/");

/* ─────────────────────────────────────────────────────────────────────────────
   Tổng hợp
   ───────────────────────────────────────────────────────────────────────────── */

export type OrderSummary = {
  total: number;
  /** Tiền của những đơn CHƯA giao khách — đây là khoản studio còn đang treo. */
  open: number;
  count: number;
  openCount: number;
  lateCount: number;
  soonCount: number;
};

export function summarize(orders: VendorOrder[], today: string): OrderSummary {
  let total = 0;
  let open = 0;
  let openCount = 0;
  let lateCount = 0;
  let soonCount = 0;
  for (const o of orders) {
    const amount = Number(o.amount) || 0;
    total += amount;
    if (!isClosed(o.status)) {
      open += amount;
      openCount++;
      const l = lateness(o, today);
      if (l.level === "late") lateCount++;
      else if (l.level === "soon") soonCount++;
    }
  }
  return { total, open, count: orders.length, openCount, lateCount, soonCount };
}

/** Đơn của một hợp đồng — để màn Xử lý hình ảnh hiện tiến độ in cạnh tiến độ hậu kỳ. */
export function ordersOfContract(orders: VendorOrder[], contractId: string): VendorOrder[] {
  return orders.filter((o) => o.contractId === contractId);
}

/**
 * Xếp đơn theo mức cần chú ý: quá hẹn trước, rồi sắp tới hẹn, rồi phần còn lại;
 * trong mỗi nhóm thì hẹn gần nhất lên trên. Đơn đã giao khách xuống đáy.
 */
export function sortByUrgency(orders: VendorOrder[], today: string): VendorOrder[] {
  const rank = (o: VendorOrder) => {
    if (isClosed(o.status)) return 3;
    const l = lateness(o, today).level;
    return l === "late" ? 0 : l === "soon" ? 1 : 2;
  };
  return [...orders].sort((a, b) => {
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    // Đơn chưa hẹn ngày xuống sau đơn đã hẹn — có hẹn thì mới theo dõi được.
    if (!a.dueDate && b.dueDate) return 1;
    if (a.dueDate && !b.dueDate) return -1;
    return (a.dueDate ?? "").localeCompare(b.dueDate ?? "");
  });
}

/* ─────────────────────────────────────────────────────────────────────────────
   Nối sang sổ chi
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * Dòng chi tương ứng với một đơn đặt ngoài.
 *
 * Mỗi đơn sinh ĐÚNG MỘT dòng `studio_expenses` mang `vendor_order_id` của nó, và
 * mọi lần sửa đơn sẽ CẬP NHẬT chính dòng đó thay vì thêm dòng mới. Đây là điều
 * giữ cho tiền không bị đếm hai lần — nếu không, sửa giá đơn ba lần là ba dòng
 * chi và báo cáo lợi nhuận sai gấp ba.
 *
 * `spent_at` lấy theo NGÀY HẸN XONG chứ không phải ngày tạo đơn: chi phí thuộc
 * về kỳ mà công việc được giao, đó là cách sổ sách của studio đọc con số này.
 * Chưa hẹn ngày thì rơi về ngày tạo.
 */
export function expenseFor(o: VendorOrder, createdOn: string): {
  title: string;
  amount: number;
  category: string;
  spent_at: string;
} {
  const who = o.vendorName?.trim();
  return {
    title: who ? `${o.title} — ${who}` : o.title,
    amount: Number(o.amount) || 0,
    category: "vendor",
    spent_at: o.dueDate || createdOn,
  };
}
