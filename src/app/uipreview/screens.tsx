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
import StaffManager from "@/app/dashboard/studio/staff/StaffManager";
import EquipmentManager from "@/app/dashboard/studio/equipment/EquipmentManager";
import PackagesManager from "@/app/dashboard/studio/packages/PackagesManager";
import InboxView from "@/app/dashboard/studio/inbox/InboxView";
import ChannelsManager from "@/app/dashboard/studio/inbox/ket-noi/ChannelsManager";
import ReviewsView from "@/app/dashboard/studio/reviews/ReviewsView";
import TokenSwatches from "./TokenSwatches";
import AiCompareDemo from "./AiCompareDemo";
import AlbumDupDemo from "./AlbumDupDemo";
import AiFaceDemo from "./AiFaceDemo";
import * as f from "./fixtures";

/**
 * Bảng màn hình xem trước: một khoá → một tiêu đề + phần dựng sẵn.
 *
 * Thêm màn mới = thêm một dòng ở đây. Ưu tiên những màn khó mở bằng tay (cần
 * dữ liệu ở đúng trạng thái hiếm) hơn là những màn chỉ cần mở app là thấy.
 */
export const SCREENS: Record<
  string,
  {
    title: string;
    render: () => React.ReactNode;
    /** true = ĐỪNG bọc `.studio-shell` quanh màn này. Chỉ dùng cho màn tự
     *  dựng khung màu của nó (bảng màu so ba khung), vì cái nó cần kiểm tra
     *  chính là khung NGOÀI shell. */
    bare?: boolean;
  }
> = {
  "so-sanh-anh": {
    title: "Lọc ảnh AI — khung so sánh (ảnh mẫu sinh trong trình duyệt)",
    render: () => <AiCompareDemo />,
  },
  "anh-trung-khach": {
    title: "Album khách — khối “Ảnh na ná nhau” (dữ liệu giả)",
    render: () => <AlbumDupDemo />,
  },
  "khuon-mat": {
    title: "Lọc ảnh AI — bộ nhận diện khuôn mặt (mặt vẽ bằng canvas)",
    render: () => <AiFaceDemo />,
  },
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
        sourceStats={f.sourceStats} funnel={f.funnel}
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
  "nhan-vien": {
    title: "Nhân viên & phân quyền",
    render: () => (
      <StaffManager initial={f.staffRows} branches={f.branches} canManageRoles canAssignBranch lockedBranchName={null} />
    ),
  },
  "thiet-bi": {
    title: "Thiết bị",
    render: () => <EquipmentManager ownerId="o" initial={f.equipment} />,
  },
  "goi-buoi": {
    title: "Gói nhiều buổi",
    render: () => <PackagesManager ownerId="o" initial={f.packages} />,
  },
  "hop-thu": {
    title: "Hộp thư hợp nhất (Zalo · Facebook · Instagram · website)",
    render: () => (
      <InboxView
        conversations={f.inboxConversations}
        firstMessages={f.inboxMessages}
        staff={{ u1: "Phạm Thu Hà", u2: "Trần Hoài Nam" }}
        channels={f.inboxChannels}
        meId="u2"
        canManageChannels
      />
    ),
  },
  "noi-kenh": {
    title: "Nối mạng xã hội vào hộp thư",
    render: () => <ChannelsManager channels={f.inboxChannels} zaloReady zaloChannel="oa" metaOAuthReady />,
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
        <InboxView conversations={[]} firstMessages={[]} staff={{}} channels={[]} meId="u2" canManageChannels />
      </div>
    ),
  },
  "danh-gia": {
    title: "Đánh giá khách (chờ duyệt · đang hiện · đã ẩn)",
    render: () => <ReviewsView reviews={f.reviews} awaiting={f.awaitingReviews} studioHost={null} />,
  },
  // Bảng màu: canh đúng loại lỗi "token chỉ có trong shell" — xem ghi chú đầu
  // TokenSwatches.tsx. Tự dựng cả ba khung nên KHÔNG cho route bọc shell.
  "bang-mau": {
    title: "Bảng màu — ngoài shell / shell sáng / shell tối",
    render: () => <TokenSwatches />,
    bare: true,
  },
};
