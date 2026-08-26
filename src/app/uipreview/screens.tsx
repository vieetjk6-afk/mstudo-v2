import BoardView from "@/app/dashboard/studio/board/BoardView";
import { ContractsList } from "@/app/dashboard/studio/contracts/ContractsListView";
import ClientsView from "@/app/dashboard/studio/clients/ClientsView";
import LeadsView from "@/app/dashboard/studio/leads/LeadsView";
import PayrollView from "@/app/dashboard/studio/payroll/PayrollView";
import ProductionView from "@/app/dashboard/studio/production/ProductionView";
import QuotesListView from "@/app/dashboard/studio/quotes/QuotesListView";
import ReportsView from "@/app/dashboard/studio/reports/ReportsView";
import BookingsView from "@/app/dashboard/studio/bookings/BookingsView";
import UpgradeRequests from "@/app/dashboard/admin/UpgradeRequests";
import DiscountCodes from "@/app/dashboard/admin/DiscountCodes";
import PaymentView from "@/app/dashboard/upgrade/thanh-toan/[id]/PaymentView";
import * as f from "./fixtures";

/**
 * Bảng màn hình xem trước: một khoá → một tiêu đề + phần dựng sẵn.
 *
 * Thêm màn mới = thêm một dòng ở đây. Ưu tiên những màn khó mở bằng tay (cần
 * dữ liệu ở đúng trạng thái hiếm) hơn là những màn chỉ cần mở app là thấy.
 */
export const SCREENS: Record<string, { title: string; render: () => React.ReactNode }> = {
  "hop-dong": {
    title: "Hợp đồng — danh sách",
    render: () => <ContractsList rows={f.contracts} studio={f.studio} />,
  },
  "bang-viec": {
    title: "Bảng việc (kéo thả theo trạng thái)",
    render: () => <BoardView initial={f.board} />,
  },
  "khach-hang": {
    title: "Khách hàng",
    render: () => <ClientsView clients={f.clients} studio={f.studio} />,
  },
  "bao-gia": {
    title: "Báo giá",
    render: () => <QuotesListView list={f.quotes} />,
  },
  "san-xuat": {
    title: "Sản xuất (album, ảnh phóng…)",
    render: () => <ProductionView initial={f.production} staff={f.staff} />,
  },
  luong: {
    title: "Lương thợ",
    render: () => <PayrollView rows={f.payroll} studio={f.studio} />,
  },
  lead: {
    title: "Lead từ chatbox website",
    render: () => <LeadsView leads={f.leads} />,
  },
  "dat-lich": {
    title: "Yêu cầu đặt lịch",
    render: () => <BookingsView ownerId="o" token="tk" initial={f.bookings} />,
  },
  "thu-chi": {
    title: "Thu chi & công nợ",
    render: () => (
      <ReportsView
        ownerId="o"
        studio={f.studio}
        payments={f.payments}
        salaries={f.salaries}
        initialExpenses={f.expenses}
        initialTarget={50_000_000}
        sourceStats={f.sourceStats}
      />
    ),
  },
  "nang-cap": {
    title: "Quản trị — yêu cầu nâng cấp & mã giảm giá",
    render: () => (
      <div className="space-y-4">
        <UpgradeRequests initial={f.upgrades} />
        <DiscountCodes initial={f.codes} />
      </div>
    ),
  },
  "thanh-toan": {
    title: "Thanh toán gói dịch vụ (4 trạng thái)",
    render: () => (
      <div className="space-y-10">
        <PaymentView id="a" plan="studio" cycle="year" amount={3_000_000} code="MS-4K7Q" initialStatus="none" initialNote={null} bank={f.bank} />
        <PaymentView id="b" plan="basic" cycle="month" amount={50_000} code="MS-7QW2" initialStatus="awaiting_confirm" initialNote={null} bank={f.bank} />
        <PaymentView id="c" plan="photographer" cycle="month" amount={100_000} code="MS-9XZ3" initialStatus="failed" initialNote="Bên mình chưa thấy tiền về, nhờ anh kiểm tra lại nội dung chuyển khoản." bank={f.bank} />
        <PaymentView id="d" plan="studio" cycle="month" amount={300_000} code="MS-2AB4" initialStatus="none" initialNote={null} bank={{ bin: null, account: null, holder: null, name: null }} />
      </div>
    ),
  },
  // Danh sách RỖNG là trạng thái người dùng mới gặp đầu tiên, và cũng là chỗ hay
  // quên vẽ nhất — để riêng một màn để không bao giờ bỏ sót.
  rong: {
    title: "Trạng thái rỗng (tài khoản vừa tạo)",
    render: () => (
      <div className="space-y-10">
        <ContractsList rows={[]} studio={f.studio} />
        <ClientsView clients={[]} studio={f.studio} />
        <LeadsView leads={[]} />
        <ProductionView initial={[]} staff={[]} />
      </div>
    ),
  },
};
