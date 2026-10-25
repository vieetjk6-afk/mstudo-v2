/* Màn xem trước GIAO DIỆN MỚI của nhóm "taichinh" — mỗi nhóm một file để làm song
 * song không đụng nhau. Đăng ký sẵn trong ../screens.tsx. Bọc màn trong
 * <PreviewV2 path="/dashboard/..."> (xem ./shell.tsx). */
import ReportsView, { type PaymentRow, type SalaryRow } from "@/app/dashboard/studio/reports/ReportsView";
import PayrollView, { type PayrollRow } from "@/app/dashboard/studio/payroll/PayrollView";
import type { StudioExpense } from "@/lib/types";
import AccountingExportCard from "@/components/studio/AccountingExportCard";
import * as f from "../fixtures";
import { PreviewV2 } from "./shell";

/* Dữ liệu giả của fixtures nằm ở tháng 8/2026, còn màn Thu chi mở ở THÁNG HIỆN
   TẠI — dời ngày về tháng này (giữ nguyên ngày trong tháng) để màn có số liệu,
   và thêm vài dòng ở các tháng trước cho biểu đồ 12 tháng có hình. */
function ymShift(back: number) {
  const n = new Date();
  const d = new Date(n.getFullYear(), n.getMonth() - back, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
const at = (back: number, day: string) => `${ymShift(back)}-${day}`;
const shiftDate = (iso: string | null) => (iso ? `${ymShift(0)}${iso.slice(7)}` : iso);

function financeData() {
  const payments: PaymentRow[] = [
    ...f.payments.map((p) => ({ ...p, paid_at: shiftDate(p.paid_at)! })),
    { id: "m3", amount: 6_500_000, kind: "installment", method: "transfer", paid_at: at(0, "14"), contract: { title: "Chụp gia đình ngoại cảnh Hồ Tây" } },
    { id: "m4", amount: 2_000_000, kind: "deposit", method: null, paid_at: at(0, "11"), contract: { title: "Chụp sản phẩm mỹ phẩm Lumi" } },
    { id: "m5", amount: -1_500_000, kind: "refund", method: "transfer", paid_at: at(0, "09"), contract: { title: "Chụp kỷ yếu 12A3" } },
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((b) => ({
      id: `h${b}`, amount: 18_000_000 + ((b * 7_300_000) % 22_000_000), kind: "final" as const, method: "transfer",
      paid_at: at(b, "15"), contract: { title: `Hợp đồng tháng trước ${b}` },
    })),
  ];
  const salaries: SalaryRow[] = [
    ...f.salaries.map((s) => ({ ...s, paid_at: shiftDate(s.paid_at) })),
    { id: "s3", name: "Phạm Minh Khoa", salary: 1_800_000, paid: true, paid_at: at(0, "16"), contract: { title: "Chụp gia đình ngoại cảnh Hồ Tây" } },
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((b) => ({
      id: `hs${b}`, name: "Anh Tuấn", salary: 4_000_000 + ((b * 1_700_000) % 5_000_000), paid: true, paid_at: at(b, "20"), contract: null,
    })),
  ];
  const expenses: StudioExpense[] = [
    ...f.expenses.map((e) => ({ ...e, spent_at: shiftDate(e.spent_at)! })),
    { ...f.expenses[0], id: "e3", title: "Quảng cáo Facebook tuần 3", amount: 3_000_000, category: "marketing", note: null, spent_at: at(0, "21") },
    { ...f.expenses[0], id: "e4", title: "Tiền thuê mặt bằng studio", amount: 8_000_000, category: "rent", note: "Đã chuyển khoản cho chủ nhà", spent_at: at(0, "01") },
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((b) => ({
      ...f.expenses[0], id: `he${b}`, title: "Tiền thuê mặt bằng studio", amount: 8_000_000, category: "rent", note: null, spent_at: at(b, "01"),
    })),
  ];
  return { payments, salaries, expenses };
}

const payrollRows: PayrollRow[] = [
  ...f.payroll,
  { id: "w5", name: "Phạm Minh Khoa", phone: "0911222666", role: "assistant", salary: 1_800_000, status: "accepted", paid: true, contract: { id: "c3", title: "Chụp gia đình ngoại cảnh Hồ Tây", event_date: "2026-09-20", code: "HD2611" } },
  { id: "w6", name: "Lê Thu Trang", phone: "0911222777", role: "makeup", salary: 1_500_000, status: "accepted", paid: false, contract: { id: "c3", title: "Chụp gia đình ngoại cảnh Hồ Tây", event_date: "2026-09-20", code: "HD2611" } },
  { id: "w7", name: "Minh", phone: "0911222444", role: "assistant", salary: 800_000, status: "accepted", paid: true, contract: { id: "c2", title: "Chụp kỷ yếu 12A3", event_date: "2026-08-01", code: "HD2610" } },
];

export const SCREENS_TAICHINH: Record<string, { title: string; render: () => React.ReactNode; bare?: boolean }> = {
  "v2-thu-chi": {
    title: "Giao diện mới — Thu chi & công nợ",
    bare: true,
    render: () => {
      const d = financeData();
      return (
        <PreviewV2 path="/dashboard/studio/reports">
          <ReportsView
            ownerId="o"
            studio={f.studio}
            payments={d.payments}
            salaries={d.salaries}
            initialExpenses={d.expenses}
            initialTarget={50_000_000}
            sourceStats={f.sourceStats}
            funnel={f.funnel}
            closedUntil={at(1, "28")}
            receivable={{ total: 42_000_000, count: 3 }}
            accounting={<AccountingExportCard ownerId="o" initialClosedUntil={at(1, "28")} canClose />}
          />
        </PreviewV2>
      );
    },
  },
  "v2-thu-chi-rong": {
    title: "Giao diện mới — Thu chi (chưa có dữ liệu)",
    bare: true,
    render: () => (
      <PreviewV2 path="/dashboard/studio/reports">
        <ReportsView ownerId="o" studio={f.studio} payments={[]} salaries={[]} initialExpenses={[]} initialTarget={0} sourceStats={[]} funnel={f.funnel} />
      </PreviewV2>
    ),
  },
  "v2-tien-cong": {
    title: "Giao diện mới — Đối soát tiền công",
    bare: true,
    render: () => (
      <PreviewV2 path="/dashboard/studio/payroll">
        <PayrollView
          rows={payrollRows}
          studio={f.studio}
          rates={{ "0911222333": 250_000 }}
          timesheet={[
            { id: "t1", phone: "0911222333", name: "Anh Tuấn", contractId: "c1", workDate: "2026-09-12", startedAt: "2026-09-12T01:00:00Z", endedAt: "2026-09-12T09:30:00Z", note: null },
            { id: "t2", phone: "0911222333", name: "Anh Tuấn", contractId: "c2", workDate: "2026-08-01", startedAt: "2026-08-01T01:00:00Z", endedAt: null, note: null },
          ]}
        />
      </PreviewV2>
    ),
  },
};
