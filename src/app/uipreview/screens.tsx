import BoardView from "@/app/dashboard/studio/board/BoardView";
import ThueDoDemo from "./ThueDoDemo";
import NewContractForm from "@/app/dashboard/studio/contracts/new/NewContractForm";
import NewQuoteForm from "@/app/dashboard/studio/quotes/new/NewQuoteForm";
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
import CrewManager from "@/app/dashboard/studio/crew/CrewManager";
import SiteRenderer from "@/components/SiteRenderer";
import EquipmentManager from "@/app/dashboard/studio/equipment/EquipmentManager";
import PackagesManager from "@/app/dashboard/studio/packages/PackagesManager";
import InboxView from "@/app/dashboard/studio/inbox/InboxView";
import ChannelsManager from "@/app/dashboard/studio/inbox/ket-noi/ChannelsManager";
import ReviewsView from "@/app/dashboard/studio/reviews/ReviewsView";
import TokenSwatches from "./TokenSwatches";
import SepayGuideVideo from "@/components/SepayGuideVideo";
import WeddingGiftVideo from "@/components/WeddingGiftVideo";
import AiCompareDemo from "./AiCompareDemo";
import AiProvidersDemo from "./AiProvidersDemo";
import AlbumDupDemo from "./AlbumDupDemo";
import AiFaceDemo from "./AiFaceDemo";
import FaceFinderDemo from "./FaceFinderDemo";
import FaceScanProgressDemo from "./FaceScanProgressDemo";
import FaceSetupDemo from "./FaceSetupDemo";
import GalleryFaceDemo from "./GalleryFaceDemo";
import { AnhInAlbumLeDemo, AnhInKhachDemo, AnhInStudioDemo } from "./AnhInDemo";
import LuoiAnhDemo from "./LuoiAnhDemo";
import AlbumMaAnhDemo from "./AlbumMaAnhDemo";
import ThiepDemo, { ThiepEditorDemo, ThiepIntroDemo } from "./ThiepDemo";
import HopDongHangMucDemo from "./HopDongHangMucDemo";
import { VoucherKhachDemo, DatLichVoucherDemo, TangVoucherDemo, VoucherQuanLyDemo, PortalVoucherDemo, PaidConfirmDemo } from "./VoucherDemo";
import ContractEditor from "@/app/dashboard/studio/contracts/[id]/ContractEditor";
import { PortalAlbumDemo } from "./PortalAlbumDemo";
import { KeHoachCuoiDemo, QuaCuoiThiepDemo } from "./KeHoachCuoiDemo";
import StudioShellV2 from "@/components/v2/StudioShellV2";
import StudioShell from "@/components/StudioShell";
import type { ChromeProfile } from "@/lib/types";
import AlbumList, { type AlbumRow } from "@/app/dashboard/AlbumList";
import { SCREENS_TONGQUAN } from "./v2/tongquan";
import { SCREENS_HOPDONG } from "./v2/hopdong";
import { SCREENS_TAICHINH } from "./v2/taichinh";
import { SCREENS_LICH } from "./v2/lich";
import { SCREENS_KHACHHANG } from "./v2/khachhang";
import { SCREENS_CONGCU } from "./v2/congcu";
import { SCREENS_HOPDONGCT } from "./v2/hopdongct";
import { SCREENS_ALBUMCT } from "./v2/albumct";
import { SCREENS_THIETLAP } from "./v2/thietlap";
import { SCREENS_TAOHD } from "./v2/taohd";
import { SCREENS_SANXUAT } from "./v2/sanxuat";
import { SCREENS_SANGTAO } from "./v2/sangtao";
import { SCREENS_WEBSITE } from "./v2/website";
import { SCREENS_TAIKHOAN } from "./v2/taikhoan";
import { SCREENS_KHTAILIEU } from "./v2/khtailieu";
import { SCREENS_KHALBUM } from "./v2/khalbum";
import { SCREENS_KHCONG } from "./v2/khcong";
import { SCREENS_NOIBO } from "./v2/noibo";
import { SCREENS_CONLAI } from "./v2/conlai";
import { SCREENS_KHTHIEP } from "./v2/khthiep";
import * as f from "./fixtures";

/** Chủ studio giả cho các màn xem trước khung giao diện. */
const shellProfile: ChromeProfile = {
  id: "o", email: "mrlee@studio.vn", full_name: "Mr Lee", role: "photographer",
  plan: "studio", plan_expires_at: null, studio_owner_id: null, studio_role: null,
};

/** Bìa giả: dải màu SVG, không cần mạng. */
function bia(a: string, b: string) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${a}'/><stop offset='1' stop-color='${b}'/></linearGradient></defs><rect width='400' height='300' fill='url(#g)'/></svg>`)}`;
}
const albumMau: AlbumRow[] = [
  { id: "a1", slug: "su-kien", title: "ALBUM SU KIEN", cover_url: bia("#4b6cb7", "#182848"), status: "published", watermark_enabled: true, download_enabled: false, phase: "selection", selection_done_at: "2026-10-16T06:47:00Z", created_at: "2026-10-16T03:00:00Z", photoCount: 15, coverFallback: null, selections: [{ count: 4 }] },
  { id: "a2", slug: "anh-cuoi", title: "ALBUM ANH CUOI", cover_url: bia("#f7971e", "#7b2ff7"), status: "published", watermark_enabled: true, download_enabled: false, phase: "selection", selection_done_at: "2026-10-16T02:45:00Z", created_at: "2026-10-16T01:00:00Z", photoCount: 10, coverFallback: null, selections: [{ count: 6 }] },
  { id: "a3", slug: "hoai-mo", title: "Simple Hoai Mo", cover_url: bia("#d7d2cc", "#304352"), status: "published", watermark_enabled: false, download_enabled: true, phase: "selection", selection_done_at: null, created_at: "2026-10-15T01:00:00Z", photoCount: 344, coverFallback: null, selections: [{ count: 15 }], dislikes: [{ count: 3 }] },
  { id: "a4", slug: "may-1", title: "May 1 — Tiệc cưới Thảo & Nam", cover_url: bia("#ee9ca7", "#ffdde1"), status: "published", watermark_enabled: false, download_enabled: true, phase: "delivery", selection_done_at: null, created_at: "2026-10-11T01:00:00Z", photoCount: 413, coverFallback: null, selections: [{ count: 9 }] },
  { id: "a5", slug: "a", title: "Chụp ngoại cảnh Đà Lạt", cover_url: bia("#c2e59c", "#64b3f4"), status: "draft", watermark_enabled: false, download_enabled: false, phase: "selection", selection_done_at: null, created_at: "2026-09-07T01:00:00Z", photoCount: 4, coverFallback: null, selections: [{ count: 0 }] },
  { id: "a6", slug: "ssss", title: "Kỷ yếu 12A3", cover_url: null, status: "published", watermark_enabled: true, download_enabled: false, phase: "selection", selection_done_at: null, created_at: "2026-09-02T01:00:00Z", photoCount: 0, coverFallback: null, selections: [{ count: 0 }] },
];

function thuChi() {
  return (
    <ReportsView
      ownerId="o"
      studio={f.studio}
      payments={f.payments}
      salaries={f.salaries}
      initialExpenses={f.expenses}
      initialTarget={50_000_000}
      sourceStats={f.sourceStats} funnel={f.funnel}
    />
  );
}

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
  "anh-in-khach": {
    title: "Ảnh in tặng — album giao khách, hợp đồng tặng 3 ảnh in",
    render: () => <AnhInKhachDemo />,
    bare: true,
  },
  "ma-anh-album": {
    title: "Mã ảnh — tab Ảnh của album: chép mã ảnh giao khách / ảnh chọn",
    render: () => <AlbumMaAnhDemo tab="photos" />,
  },
  "ma-anh-chia-se": {
    title: "Mã ảnh — tab Khách chia sẻ: link khách gửi người khác xem + mã ảnh",
    render: () => <AlbumMaAnhDemo tab="shares" />,
  },
  "anh-in-studio": {
    title: "Ảnh in tặng — thẻ ở tab Giao khách của album (studio)",
    render: () => <AnhInStudioDemo />,
  },
  "anh-in-album-le": {
    title: "Ảnh in tặng — album lẻ không thuộc hợp đồng: nhập số ảnh in ngay trong album",
    render: () => <AnhInAlbumLeDemo />,
  },
  "web-ten-dai": {
    title: "Web studio — tên studio dài, menu trên (canh tên tràn khỏi màn hình điện thoại)",
    render: () => <SiteRenderer demo data={f.longNameSite("top")} />,
    bare: true,
  },
  "web-ten-dai-cot": {
    title: "Web studio — tên studio dài, menu cột trái (thu thành thanh ngang trên điện thoại)",
    render: () => <SiteRenderer demo data={f.longNameSite("left")} />,
    bare: true,
  },
  "khoa-ai": {
    title: "Nhà cung cấp AI — key chung (Quản trị hệ thống) + key riêng (trang Chatbox)",
    render: () => <AiProvidersDemo />,
  },
  "so-tho": {
    title: "Sổ thợ — có chi nhánh, tên dài, thống kê lời mời (canh tràn ngang trên điện thoại)",
    render: () => (
      <CrewManager
        ownerId="o1"
        initial={f.roster}
        stats={{ "0987654321": { total: 2, accepted: 1, declined: 0 } }}
        branches={f.branches}
        canEditCrewRoles
      />
    ),
  },
  "hop-dong-hang-muc": {
    title: "Hợp đồng — tab Hạng mục (có ô mô tả từng hạng mục)",
    render: () => <HopDongHangMucDemo />,
  },
  "thiep-cuoi": {
    title: "Thiệp cưới — 10 mẫu khổ điện thoại (dữ liệu giả)",
    render: () => <ThiepDemo />,
    bare: true,
  },
  "thiep-mo": {
    title: "Thiệp cưới — hiệu ứng mở thiệp của 10 mẫu",
    render: () => <ThiepIntroDemo />,
    bare: true,
  },
  "thiep-sua": {
    title: "Thiệp cưới — trình chỉnh sửa: chọn mẫu + xem trước trực tiếp",
    render: () => <ThiepEditorDemo />,
    bare: true,
  },
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
  "loc-theo-nguoi": {
    title: "Album khách — tìm ảnh theo khuôn mặt (dữ liệu giả)",
    render: () => <FaceFinderDemo />,
  },
  "dang-quet-mat": {
    title: "Album khách — đang quét khuôn mặt dở (tiến độ thật)",
    render: () => <FaceScanProgressDemo />,
  },
  "bao-chua-chay-sql": {
    title: "Bảng điều khiển — báo chưa bật được tìm theo khuôn mặt",
    render: () => <FaceSetupDemo />,
  },
  "luoi-anh": {
    title: "Album khách — lưới 1200 ảnh (đo cuộn sâu có lag không)",
    render: () => <LuoiAnhDemo />,
  },
  "giao-khach-tim-mat": {
    title: "Album GIAO KHÁCH — tìm ảnh theo khuôn mặt (dữ liệu giả)",
    render: () => <GalleryFaceDemo />,
  },
  "hop-dong": {
    title: "Hợp đồng — danh sách",
    render: () => <ContractsList rows={f.contracts} studio={f.studio} />,
  },

  /* Màn CHI TIẾT hợp đồng — màn studio ngồi lâu nhất và bị kêu rối nhất, mà
     trước giờ không xem trước được vì nó cần đúng một hợp đồng có hạng mục,
     đợt thu, nhân sự, mốc lịch ở trạng thái vừa phải.
     Mỗi tab một khoá riêng: sáu tab là sáu bố cục khác nhau, gộp một màn thì
     chụp ảnh so sánh không thấy được tab đang đóng. */
  ...Object.fromEntries(
    ([
      ["info", "Thông tin"],
      ["items", "Hạng mục"],
      ["pay", "Thanh toán"],
      ["crew", "Nhân sự"],
      ["album", "Sản phẩm"],
      ["rental", "Thuê đồ"],
      ["send", "Ký và thực hiện"],
    ] as const).map(([tab, nhan]) => [
      `hop-dong-${tab}`,
      {
        title: `Hợp đồng chi tiết — tab ${nhan}`,
        render: () => (
          <ContractEditor
            contract={f.contractFull}
            initialItems={f.contractItems}
            initialCrew={f.contractCrew}
            initialRequests={f.contractRequests}
            initialPayments={f.contractPayments}
            initialPlan={f.contractPlan}
            initialTasks={f.contractTasks}
            initialProducts={f.contractProducts}
            initialExpenses={[]}
            initialMilestones={f.milestones}
            initialAppointments={f.contractAppointments}
            initialQuoteOptions={[]}
            initialClientProofs={f.clientProofs}
            roster={f.roster}
            galleries={[]}
            selectionAlbums={[]}
            ownerId="o1"
            branches={f.branches}
            studioName={f.studio.name}
            studioPhone={f.studio.phone}
            studioEmail={f.studio.email}
            conflictByPhone={{}}
            staffList={f.staff}
            canAssign
            canRental /* xem trước giả lập gói Studio */
            bank={f.bank}
            sameDayContracts={[]}
            pricelist={f.pricelistRows}
            initialTab={tab}
            savedSignature={tab === "send" ? f.savedSignature : null}
          />
        ),
      },
    ])
  ),
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
        ownerId="o1"
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
        <InboxView conversations={[]} firstMessages={[]} staff={{}} channels={[]} meId="u2" ownerId="o1" canManageChannels />
      </div>
    ),
  },
  "danh-gia": {
    title: "Đánh giá khách (chờ duyệt · đang hiện · đã ẩn)",
    render: () => <ReviewsView reviews={f.reviews} awaiting={f.awaitingReviews} studioHost={null} />,
  },
  // Bảng màu: canh đúng loại lỗi "token chỉ có trong shell" — xem ghi chú đầu
  // TokenSwatches.tsx. Tự dựng cả ba khung nên KHÔNG cho route bọc shell.
  "hop-dong-chup": {
    title: "Hợp đồng nhóm Chụp — có tab Sản phẩm, KHÔNG có tab Thuê đồ",
    render: () => (
          <ContractEditor
            contract={f.contractChup}
            initialItems={f.contractItems}
            initialCrew={f.contractCrew}
            initialRequests={f.contractRequests}
            initialPayments={f.contractPayments}
            initialPlan={f.contractPlan}
            initialTasks={f.contractTasks}
            initialProducts={f.contractProducts}
            initialExpenses={[]}
            initialMilestones={f.milestones}
            initialAppointments={f.contractAppointments}
            initialQuoteOptions={[]}
            initialClientProofs={f.clientProofs}
            roster={f.roster}
            galleries={[]}
            selectionAlbums={[]}
            ownerId="o1"
            branches={f.branches}
            studioName={f.studio.name}
            studioPhone={f.studio.phone}
            studioEmail={f.studio.email}
            conflictByPhone={{}}
            staffList={f.staff}
            canAssign
            canRental /* xem trước giả lập gói Studio */
            bank={f.bank}
            sameDayContracts={[]}
            pricelist={f.pricelistRows}
            initialTab="info"
          />
    ),
  },
  "hop-dong-makeup": {
    title: "Hợp đồng nhóm Makeup — ẩn tab Sản phẩm, hiện tab Thuê đồ",
    render: () => (
          <ContractEditor
            contract={f.contractMakeup}
            initialItems={f.contractItems}
            initialCrew={f.contractCrew}
            initialRequests={f.contractRequests}
            initialPayments={f.contractPayments}
            initialPlan={f.contractPlan}
            initialTasks={f.contractTasks}
            initialProducts={f.contractProducts}
            initialExpenses={[]}
            initialMilestones={f.milestones}
            initialAppointments={f.contractAppointments}
            initialQuoteOptions={[]}
            initialClientProofs={f.clientProofs}
            roster={f.roster}
            galleries={[]}
            selectionAlbums={[]}
            ownerId="o1"
            branches={f.branches}
            studioName={f.studio.name}
            studioPhone={f.studio.phone}
            studioEmail={f.studio.email}
            conflictByPhone={{}}
            staffList={f.staff}
            canAssign
            canRental /* xem trước giả lập gói Studio */
            bank={f.bank}
            sameDayContracts={[]}
            pricelist={f.pricelistRows}
            initialTab="info"
          />
    ),
  },
  "hop-dong-makeup-goi-plus": {
    title: "Hợp đồng Makeup ở gói Photographer Plus — KHÔNG có tab Thuê đồ",
    render: () => (
          <ContractEditor
            contract={f.contractMakeup}
            initialItems={f.contractItems}
            initialCrew={f.contractCrew}
            initialRequests={f.contractRequests}
            initialPayments={f.contractPayments}
            initialPlan={f.contractPlan}
            initialTasks={f.contractTasks}
            initialProducts={f.contractProducts}
            initialExpenses={[]}
            initialMilestones={f.milestones}
            initialAppointments={f.contractAppointments}
            initialQuoteOptions={[]}
            initialClientProofs={f.clientProofs}
            roster={f.roster}
            galleries={[]}
            selectionAlbums={[]}
            ownerId="o1"
            branches={f.branches}
            studioName={f.studio.name}
            studioPhone={f.studio.phone}
            studioEmail={f.studio.email}
            conflictByPhone={{}}
            staffList={f.staff}
            canAssign
            bank={f.bank}
            sameDayContracts={[]}
            pricelist={f.pricelistRows}
            initialTab="info"
          />
    ),
  },
  "hop-dong-moi": {
    title: "Tạo hợp đồng — 6 bước (bước 1: loại dịch vụ)",
    render: () => (
      <NewContractForm
        ownerId="o1"
        assignTo={null}
        templates={[]}
        services={f.dichVu}
        packages={f.goiDichVu}
        roster={f.roster}
        recentClients={f.khachGanDay}
        bank={f.bank}
      />
    ),
  },
  "voucher-khach": {
    title: "Voucher ưu đãi · trang khách (quét QR)",
    render: () => <VoucherKhachDemo />,
  },
  "voucher-khach-da-dung": {
    title: "Voucher ưu đãi · trang khách (đã dùng)",
    render: () => <VoucherKhachDemo used />,
  },
  "dat-lich-voucher": {
    title: "Đặt lịch kèm voucher (vào từ QR)",
    render: () => <DatLichVoucherDemo />,
  },
  "dat-lich-voucher-loi": {
    title: "Đặt lịch với mã voucher hết hạn",
    render: () => <DatLichVoucherDemo bad />,
  },
  "da-nhan-coc": {
    title: "Cổng hợp đồng — màn Đã nhận cọc khi tiền về",
    render: () => <PaidConfirmDemo />,
  },
  "album-cong-khach": {
    title: "Cổng khách — trang album khi hợp đồng hoàn thành (ảnh + tải từng ảnh)",
    render: () => <PortalAlbumDemo />,
    bare: true,
  },
  "album-cong-khach-video": {
    title: "Cổng khách — trang album, tab Video (phát lớn + danh sách phát)",
    render: () => <PortalAlbumDemo tab="videos" />,
    bare: true,
  },
  "ke-hoach-cuoi": {
    title: "Kế hoạch cưới — tổng quan: bốn con số + Sắp tới (việc quá hạn, thanh toán, lịch hẹn studio)",
    render: () => <KeHoachCuoiDemo />,
    bare: true,
  },
  "ke-hoach-cuoi-viec": {
    title: "Kế hoạch cưới — việc cần làm theo mốc (người lo, ưu tiên, hạn riêng, việc studio tự tick)",
    render: () => <KeHoachCuoiDemo tab="tasks" />,
    bare: true,
  },
  "ke-hoach-cuoi-ngan-sach": {
    title: "Kế hoạch cưới — ngân sách vượt mức, giá chốt, ai chi bao nhiêu, thanh toán sắp tới",
    render: () => <KeHoachCuoiDemo tab="budget" />,
    bare: true,
  },
  "ke-hoach-cuoi-khach": {
    title: "Kế hoạch cưới — khách mời (phản hồi qua thiệp tự khớp, khách ngoài danh sách, tên rất dài)",
    render: () => <KeHoachCuoiDemo tab="guests" />,
    bare: true,
  },
  "ke-hoach-cuoi-so-do-ban": {
    title: "Kế hoạch cưới — sơ đồ bàn (bàn vượt sức chứa, khách chưa xếp bàn)",
    render: () => <KeHoachCuoiDemo tab="guests" guestView="tables" />,
    bare: true,
  },
  "ke-hoach-cuoi-nha-cung-cap": {
    title: "Kế hoạch cưới — nhà cung cấp: so báo giá theo hạng mục, đã chốt, đưa vào ngân sách",
    render: () => <KeHoachCuoiDemo tab="vendors" />,
    bare: true,
  },
  "ke-hoach-cuoi-ngay-cuoi": {
    title: "Kế hoạch cưới — ngày cưới: lịch trình tách cô dâu / chú rể, đội hỗ trợ, đồ cần mang",
    render: () => <KeHoachCuoiDemo tab="day" />,
    bare: true,
  },
  "ke-hoach-cuoi-phong-cach": {
    title: "Kế hoạch cưới — phong cách & ảnh cần chụp (bảng màu, concept, link cảm hứng)",
    render: () => <KeHoachCuoiDemo tab="style" />,
    bare: true,
  },
  "ke-hoach-cuoi-chua-co-ngay": {
    title: "Kế hoạch cưới — khách chưa chọn ngày cưới, các danh sách còn trống",
    render: () => <KeHoachCuoiDemo variant="no-date" tab="day" />,
    bare: true,
  },
  "ke-hoach-cuoi-khoa": {
    title: "Kế hoạch cưới — chỉ xem (gói studio hết hạn)",
    render: () => <KeHoachCuoiDemo tab="budget" variant="locked" />,
    bare: true,
  },
  "qua-cuoi": {
    title: "Quà cưới (kế hoạch + thiệp, chế độ admin) — tổng quan: nút Thiệp cưới cạnh Tổng quan, thẻ thiệp bản nháp",
    render: () => <KeHoachCuoiDemo variant="combo" />,
    bare: true,
  },
  "qua-cuoi-khach": {
    title: "Quà cưới — khách mời: link thiệp / QR từng khách, phản hồi qua thiệp đã ghi vào danh sách, khách tự thêm",
    render: () => <KeHoachCuoiDemo variant="combo" tab="guests" />,
    bare: true,
  },
  "qua-cuoi-thiep": {
    title: "Quà cưới — trình sửa thiệp nhúng trong kế hoạch (nút về kế hoạch, khách mời dùng chung)",
    render: () => <QuaCuoiThiepDemo />,
    bare: true,
  },
  "ke-hoach-cuoi-db-cu": {
    title: "Kế hoạch cưới — database chưa chạy migration mở rộng (chỉ 4 tab gốc)",
    render: () => <KeHoachCuoiDemo variant="old-db" />,
    bare: true,
  },
  "voucher-cong-khach": {
    title: "Voucher trên cổng hợp đồng của khách (3 giai đoạn)",
    render: () => <PortalVoucherDemo />,
  },
  "voucher-quan-ly": {
    title: "Voucher & thẻ quà — có voucher ưu đãi đã tặng",
    render: () => <VoucherQuanLyDemo />,
  },
  "tang-voucher": {
    title: "Hợp đồng · Tặng voucher lần sau",
    render: () => <TangVoucherDemo />,
  },
  "bao-gia-moi": {
    title: "Tạo báo giá (có ô Tạo nhanh bằng AI)",
    render: () => <NewQuoteForm ownerId="o1" services={f.dichVu} pricelist={f.goiDichVu} />,
  },
  "hop-dong-thue-do": {
    title: "Hợp đồng · Thuê đồ (có đơn)",
    render: () => <ThueDoDemo />,
  },
  "video-sepay": {
    title: "Video hướng dẫn nối SePay (trình phát trong thẻ Tự xác nhận)",
    render: () => (
      <div style={{ maxWidth: 900 }}>
        <SepayGuideVideo />
      </div>
    ),
  },
  // Khung 1280×720 trần, không nút — scripts/xuat-video-sepay.mjs chụp từng
  // khung ở đây rồi ghép thành MP4 để gửi Zalo / đăng Facebook.
  "video-sepay-xuat": {
    title: "Video SePay · chế độ xuất MP4",
    render: () => (
      <div style={{ position: "fixed", inset: 0, width: 1280, height: 720, zIndex: 9999 }}>
        {/* Nút "N" của Next dev không được lọt vào video. */}
        <style>{"nextjs-portal{display:none!important}"}</style>
        <SepayGuideVideo renderMode />
      </div>
    ),
    bare: true,
  },
  "video-qua-cuoi": {
    title: "Video quà cưới (dọc 9:16) — chốt lịch cưới nhận thiệp online + kế hoạch cưới",
    render: () => (
      <div style={{ maxWidth: 420 }}>
        <WeddingGiftVideo studio="Mây Studio" phone="0909 000 000" />
      </div>
    ),
  },
  "video-qua-cuoi-ngang": {
    title: "Video quà cưới (ngang 16:9)",
    render: () => (
      <div style={{ maxWidth: 960 }}>
        <WeddingGiftVideo orientation="landscape" studio="Mây Studio" phone="0909 000 000" />
      </div>
    ),
  },
  // Khung trần, không nút — scripts/xuat-video-qua-cuoi.mjs chụp từng khung ở
  // đây rồi ghép MP4. Tên / SĐT studio đi qua ?studio=…&phone=….
  "video-qua-cuoi-xuat": {
    title: "Video quà cưới · chế độ xuất MP4 (dọc)",
    render: () => (
      <div style={{ position: "fixed", inset: 0, width: 1080, height: 1920, zIndex: 9999 }}>
        <style>{"nextjs-portal{display:none!important}"}</style>
        <WeddingGiftVideo renderMode />
      </div>
    ),
    bare: true,
  },
  "video-qua-cuoi-xuat-ngang": {
    title: "Video quà cưới · chế độ xuất MP4 (ngang)",
    render: () => (
      <div style={{ position: "fixed", inset: 0, width: 1920, height: 1080, zIndex: 9999 }}>
        <style>{"nextjs-portal{display:none!important}"}</style>
        <WeddingGiftVideo orientation="landscape" renderMode />
      </div>
    ),
    bare: true,
  },
  /* Khung GIAO DIỆN MỚI (thử nghiệm) bọc quanh màn thật — để so với khung cũ. */
  "khung-moi-thu-chi": {
    title: "Giao diện mới — khung + Thu chi",
    render: () => (
      <StudioShellV2 profile={shellProfile} tier="full" role="owner" accent="blue" previewPath="/dashboard/studio/reports">
        {thuChi()}
      </StudioShellV2>
    ),
    bare: true,
  },
  "khung-moi-hop-dong": {
    title: "Giao diện mới — khung + Hợp đồng (màu tím)",
    render: () => (
      <StudioShellV2 profile={shellProfile} tier="full" role="owner" accent="violet" previewPath="/dashboard/studio/contracts">
        <ContractsList rows={f.contracts} studio={f.studio} />
      </StudioShellV2>
    ),
    bare: true,
  },
  "moi-album": {
    title: "Giao diện mới — Thư viện album",
    render: () => (
      <StudioShellV2 profile={shellProfile} tier="full" role="owner" accent="blue" previewPath="/dashboard/albums">
        <AlbumList albums={albumMau} canDelivery canWatermark canFaceSearch studioHost={null} planUsage={null} />
      </StudioShellV2>
    ),
    bare: true,
  },
  "khung-cu-goi-y": {
    title: "Khung cũ — thẻ gợi ý dùng giao diện mới",
    render: () => (
      <StudioShell profile={shellProfile} tier="full" role="owner" suggestNewUi>
        {thuChi()}
      </StudioShell>
    ),
    bare: true,
  },
  /* Giao diện mới theo nhóm màn — mỗi nhóm một file trong ./v2. */
  ...SCREENS_TONGQUAN,
  ...SCREENS_HOPDONG,
  ...SCREENS_TAICHINH,
  ...SCREENS_LICH,
  ...SCREENS_KHACHHANG,
  ...SCREENS_CONGCU,
  ...SCREENS_HOPDONGCT,
  ...SCREENS_ALBUMCT,
  ...SCREENS_THIETLAP,
  ...SCREENS_TAOHD,
  ...SCREENS_SANXUAT,
  ...SCREENS_SANGTAO,
  ...SCREENS_WEBSITE,
  ...SCREENS_TAIKHOAN,
  ...SCREENS_KHTAILIEU,
  ...SCREENS_KHALBUM,
  ...SCREENS_KHCONG,
  ...SCREENS_NOIBO,
  ...SCREENS_CONLAI,
  ...SCREENS_KHTHIEP,
  "bang-mau": {
    title: "Bảng màu — ngoài shell / shell sáng / shell tối",
    render: () => <TokenSwatches />,
    bare: true,
  },
};
