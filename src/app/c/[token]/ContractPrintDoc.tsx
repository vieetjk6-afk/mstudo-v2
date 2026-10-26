import { fmtDate, fmtDateLunar } from "@/lib/date";
import type { BankInfo } from "@/lib/vietqr";
import { contractPrintBody, contractPrintCss, type ContractPrintData } from "@/lib/contract-print";
import { SHOOT_TYPE_LABEL, CONTRACT_STATUS_LABEL, PRODUCT_STATUS_LABEL, PAYMENT_KIND_LABEL } from "@/lib/types";
import type { Contract, Item, Milestone, Payment, PlanRow, ProductRow } from "./useContractPortal";

/**
 * Bản in chính thức (đen trắng, khổ A4) — ẩn trên màn hình, chỉ hiện khi in.
 * Dựng bằng bộ dựng dùng chung src/lib/contract-print.ts nên bản khách in ra
 * giống hệt bản studio xuất từ màn quản trị.
 *
 * Vẫn in trong CHÍNH trang này (không mở cửa sổ mới): khách hay bấm từ điện
 * thoại, mà Safari iOS chặn/nuốt cửa sổ pop-up.
 *
 * Dùng chung cho cả bản cũ (ContractView) lẫn giao diện mới (ContractViewV2):
 * phần màn hình mang lớp `no-print`, khi in chỉ còn khối `.print-doc` này.
 */
export default function ContractPrintDoc({
  contract,
  studioName,
  studioLogo,
  studioPhone,
  bank,
  items,
  products,
  payments,
  plan,
  milestones,
  itemsTotal,
  surcharge,
  printing,
  total,
  collected,
  balance,
  qr,
}: {
  contract: Contract;
  studioName: string;
  studioLogo: string | null;
  studioPhone: string | null;
  bank: BankInfo;
  items: Item[];
  products: ProductRow[];
  payments: Payment[];
  plan: PlanRow[];
  milestones: Milestone[];
  itemsTotal: number;
  surcharge: number;
  printing: number;
  total: number;
  collected: number;
  balance: number;
  qr: string;
}) {
  // Có phụ phí / in ấn thì mới tách dòng "giá trị dịch vụ"; hợp đồng thường
  // chỉ cần đúng ba dòng tổng — cộng, đã trả, còn lại.
  const extra = surcharge > 0 || printing > 0;
  const data: ContractPrintData = {
    title: contract.title,
    code: contract.code,
    statusLabel: CONTRACT_STATUS_LABEL[contract.status],
    studio: {
      name: studioName,
      logo: studioLogo,
      phone: studioPhone,
      bankHolder: bank.holder,
      bankAccount: bank.account,
      bankName: bank.name,
    },
    client: { name: contract.client_name, phone: contract.client_phone, email: contract.client_email },
    facts: [
      { label: "Gói dịch vụ", value: SHOOT_TYPE_LABEL[contract.shoot_type] },
      { label: "Ngày chụp", value: [fmtDateLunar(contract.event_date), contract.event_time].filter(Boolean).join(" · ") },
      { label: "Địa điểm", value: contract.location, wide: true },
    ],
    items: items.map((it) => ({
      name: it.name,
      // Mô tả hạng mục in dưới tên, giống bản in phía studio. Thiếu dòng này thì
      // khách bấm "Lưu PDF / In" ra bản không có phạm vi công việc, dù trên màn
      // hình vẫn thấy.
      description: it.description?.trim() || null,
      qty: it.qty,
      unitPrice: it.unit_price,
      amount: it.qty * it.unit_price,
    })),
    products: products.map((p) => ({
      name: [p.name, PRODUCT_STATUS_LABEL[p.status as keyof typeof PRODUCT_STATUS_LABEL]].filter(Boolean).join(" · "),
      qty: p.qty || 1,
      unitPrice: p.cost,
      amount: (Number(p.cost) || 0) * (Number(p.qty) || 1),
    })),
    totals: [
      ...(extra ? [{ label: "Giá trị dịch vụ", amount: itemsTotal }] : []),
      ...(surcharge > 0 ? [{ label: "Chi phí phát sinh", amount: surcharge }] : []),
      ...(printing > 0 ? [{ label: "Chi phí in ấn", amount: printing }] : []),
      { label: "Tổng giá trị hợp đồng", amount: total, strong: true },
      { label: "Đã thanh toán / cọc", amount: collected, minus: true },
      { label: "Còn lại", amount: balance, bold: true },
    ],
    amountInWords: total,
    plan: plan.map((p) => ({
      label: p.label,
      due: p.due_date ? fmtDate(p.due_date) : "",
      paid: p.paid,
      amount: p.amount,
    })),
    schedule: milestones.map((m) => ({
      title: m.title,
      when: [fmtDateLunar(m.event_date), m.event_time].filter(Boolean).join(" · "),
    })),
    payments: payments.map((p) => ({
      date: fmtDate(p.paid_at),
      kind: PAYMENT_KIND_LABEL[p.kind],
      amount: p.amount,
    })),
    terms: contract.note,
    signs: [
      {
        label: "Bên A · Studio",
        name: contract.studio_signed_name || studioName,
        image: contract.studio_signature,
        signedAt: contract.studio_signed_at ? fmtDate(contract.studio_signed_at) : "",
      },
      {
        label: "Bên B · Khách hàng",
        name: contract.client_signed_name || contract.client_name,
        image: contract.client_signature,
        signedAt: contract.client_signed_at ? fmtDate(contract.client_signed_at) : "",
      },
    ],
    qr,
    footer: "Quét mã QR ở đầu trang để mở bản hợp đồng điện tử.",
  };

  return (
    <div className="print-doc" style={{ display: "none" }}>
      <style dangerouslySetInnerHTML={{ __html: contractPrintCss(".print-doc") }} />
      <div dangerouslySetInnerHTML={{ __html: contractPrintBody(data) }} />
    </div>
  );
}
