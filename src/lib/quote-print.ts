/**
 * Dữ liệu bản in BÁO GIÁ — dựng trên bộ in dùng chung của hợp đồng
 * (./contract-print.ts) để báo giá có đúng đầu trang thương hiệu, khổ A4, số
 * trang, dòng "Bằng chữ", tài khoản nhận cọc và QR như hợp đồng.
 *
 * Bản cũ tự viết HTML riêng: không logo/tên studio, ngày ISO "2026-12-20",
 * không có cột đơn giá, cộng cả dòng khách đã bỏ tick vào "Tổng hạng mục"
 * (ra "20.500.000 − 500.000 = 11.000.000"), và câu chân trang hướng dẫn
 * "tick tuỳ chọn trên trang trực tuyến" — vô nghĩa trên giấy.
 *
 * Import tương đối có đuôi .ts để test Node nạp thẳng được.
 */
import type { ContractPrintData, PrintItem, PrintStudio, PrintTotal } from "./contract-print.ts";
import { normalizePackageSelection } from "./quote-lines.ts";

export type QuotePrintItem = {
  name: string;
  description?: string | null;
  qty: number;
  unit_price: number;
  is_optional: boolean;
  is_discount?: boolean;
  selected: boolean;
  package_group?: string | null;
};

export type QuotePrintInput = {
  quote: {
    title?: string | null;
    code?: string | null;
    client_name?: string | null;
    client_phone?: string | null;
    client_email?: string | null;
    event_date?: string | null;
    location?: string | null;
    intro?: string | null;
    created_at?: string | null;
    discount_package_group?: string | null;
  };
  items: QuotePrintItem[];
  studio?: PrintStudio | null;
  qr?: string | null;
  /** Tổng các dòng đang tính (chưa trừ ưu đãi gói). */
  total: number;
  /** Tổng khách trả (đã trừ ưu đãi gói). */
  payableTotal: number;
  deposit: number;
  depositPct: number;
  validUntil?: string | null;
};

const dmy = (iso?: string | null): string => {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
};

const DOW = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const withDow = (iso?: string | null): string => {
  const d = dmy(iso);
  if (!d || !iso) return "";
  const dt = new Date(`${iso.slice(0, 10)}T12:00:00+07:00`);
  return isNaN(dt.getTime()) ? d : `${DOW[dt.getUTCDay()]} · ${d}`;
};

const lineOf = (it: QuotePrintItem): PrintItem => ({
  name: it.name,
  description: it.description?.trim() || null,
  qty: it.is_discount ? null : it.qty,
  unitPrice: it.is_discount ? null : it.unit_price,
  amount: (it.is_discount ? -1 : 1) * (it.qty || 0) * (it.unit_price || 0),
});

export function quotePrintData(i: QuotePrintInput): ContractPrintData {
  const q = i.quote;
  const items = normalizePackageSelection(i.items);
  const active = (it: QuotePrintItem) => (it.package_group ? it.selected : it.selected || !it.is_optional);
  const chosen = items.filter(active);
  // Dòng chưa chọn: in riêng thành "Tuỳ chọn thêm" để khách biết còn gì có thể
  // thêm, nhưng KHÔNG cộng vào tổng.
  const others = items.filter((it) => !active(it) && !it.is_discount);

  const bulk = i.total - i.payableTotal;
  const totals: PrintTotal[] = [
    ...(bulk > 0 ? [{ label: "Cộng hạng mục", amount: i.total }, { label: `Ưu đãi gói ${q.discount_package_group || ""}`.trim(), amount: bulk, minus: true }] : []),
    { label: "Tổng báo giá", amount: i.payableTotal, strong: true },
    ...(i.deposit > 0 ? [{ label: `Cọc giữ lịch (~${i.depositPct}%)`, amount: i.deposit, bold: true }] : []),
  ];

  const valid = dmy(i.validUntil);
  const terms = [
    q.intro?.trim() || "",
    [
      valid ? `- Báo giá có hiệu lực đến hết ngày ${valid}.` : "- Báo giá có hiệu lực trong 15 ngày kể từ ngày lập, trừ khi studio ghi khác.",
      i.deposit > 0 ? `- Lịch chụp được giữ khi studio nhận cọc ${i.deposit.toLocaleString("vi-VN")}đ; phần còn lại thanh toán theo hợp đồng.` : "",
      "- Báo giá chưa phải hợp đồng. Sau khi khách đồng ý, studio gửi hợp đồng để hai bên ký xác nhận.",
    ].filter(Boolean).join("\n"),
  ].filter(Boolean).join("\n\n");

  return {
    docTitle: `Báo giá ${q.code || ""} ${q.client_name || ""}`.trim(),
    heading: "Báo giá dịch vụ",
    title: q.title,
    code: q.code,
    codeLabel: "Số báo giá",
    issuedAt: dmy(q.created_at),
    partyLabels: ["Đơn vị báo giá", "Khách hàng"],
    itemsTitle: "Hạng mục báo giá",
    studio: i.studio ?? { name: "Studio" },
    client: { name: q.client_name, phone: q.client_phone, email: q.client_email },
    facts: [
      { label: "Ngày chụp dự kiến", value: withDow(q.event_date) },
      { label: "Hiệu lực đến", value: valid },
      { label: "Địa điểm", value: q.location, wide: true },
    ],
    items: chosen.map(lineOf),
    products: others.map(lineOf),
    productsTitle: "Tuỳ chọn thêm (chưa tính vào tổng)",
    totals,
    amountInWords: i.payableTotal,
    // Không có kế hoạch thanh toán ở báo giá — vẫn in tài khoản để khách chuyển cọc.
    bankNote: true,
    terms,
    signs: [
      { label: "Đại diện studio", name: i.studio?.name ?? null },
      { label: "Khách hàng xác nhận", name: q.client_name ?? null },
    ],
    qr: i.qr ?? null,
    qrCaption: "Quét xem & chọn gói online",
    footer: "Báo giá được lập từ phần mềm quản lý studio mstudo.",
  };
}
