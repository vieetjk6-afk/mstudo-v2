/* Màn xem trước GIAO DIỆN MỚI của nhóm "hopdongct" — mỗi nhóm một file để làm song
 * song không đụng nhau. Đăng ký sẵn trong ../screens.tsx. Bọc màn trong
 * <PreviewV2 path="/dashboard/..."> (xem ./shell.tsx). */
import * as f from "../fixtures";
import { PreviewV2 } from "./shell";
import ContractEditor from "@/app/dashboard/studio/contracts/[id]/ContractEditor";
import type { ContractEditorProps } from "@/app/dashboard/studio/contracts/[id]/useContractEditor";
import { todayVN } from "@/lib/date";
import { addDaysIso } from "@/lib/contract-filter";

/** Đúng bộ prop của màn xem trước bản cũ (screens.tsx → "hop-dong-<tab>"). */
function base(tab: string): ContractEditorProps {
  return {
    contract: f.contractFull,
    initialItems: f.contractItems,
    initialCrew: f.contractCrew,
    initialRequests: f.contractRequests,
    initialPayments: f.contractPayments,
    initialPlan: f.contractPlan,
    initialTasks: f.contractTasks,
    initialProducts: f.contractProducts,
    initialExpenses: [],
    initialMilestones: f.milestones,
    initialAppointments: f.contractAppointments,
    initialQuoteOptions: [],
    initialClientProofs: f.clientProofs,
    roster: f.roster,
    galleries: [],
    selectionAlbums: [],
    ownerId: "o1",
    branches: f.branches,
    studioName: f.studio.name,
    studioPhone: f.studio.phone,
    studioEmail: f.studio.email,
    conflictByPhone: {},
    staffList: f.staff,
    canAssign: true,
    canRental: true /* xem trước giả lập gói Studio */,
    bank: f.bank,
    sameDayContracts: [],
    pricelist: f.pricelistRows,
    initialTab: tab,
    savedSignature: tab === "send" ? f.savedSignature : null,
  };
}

/** Hợp đồng NHÁP mới tạo, ngày chụp sắp tới: chưa đợt thu, chưa ê-kíp — nút chính phải là "Gửi khách ký". */
function draft(): ContractEditorProps {
  const t = todayVN();
  const p = base("info");
  return {
    ...p,
    contract: {
      ...f.contractFull,
      id: "c-nhap",
      code: "HD2615",
      title: "Chụp gia đình cuối tuần — công viên Gia Định",
      client_name: "Lê Minh Khang",
      client_phone: "0933222111",
      client_email: null,
      status: "draft",
      event_date: addDaysIso(t, 4),
      event_time: "16:00",
      location: "Công viên Gia Định, Gò Vấp",
      client_signed_at: null,
      client_signed_name: null,
      client_viewed_at: null,
    },
    initialItems: [{ ...f.contractItems[0], name: "Gói gia đình 2 giờ", unit_price: 6_500_000, description: null }],
    initialCrew: [],
    initialRequests: [],
    initialPayments: [],
    initialPlan: [],
    initialMilestones: [],
    initialClientProofs: [],
    initialTasks: [],
    initialProducts: [],
  };
}

const wrap = (p: ContractEditorProps) => (
  <PreviewV2 path="/dashboard/studio/contracts/x">
    <ContractEditor {...p} />
  </PreviewV2>
);

export const SCREENS_HOPDONGCT: Record<string, { title: string; render: () => React.ReactNode; bare?: boolean }> = {
  ...Object.fromEntries(
    (
      [
        ["info", "Tổng quan"],
        ["items", "Hạng mục"],
        ["pay", "Thanh toán"],
        ["crew", "Ê-kíp & lịch"],
        ["album", "Sản phẩm"],
        ["send", "Ký & gửi"],
      ] as const
    ).map(([tab, nhan]) => [
      tab === "info" ? "v2-hop-dong-ct" : `v2-hop-dong-ct-${tab}`,
      { title: `Giao diện mới — Hợp đồng chi tiết · ${nhan}`, render: () => wrap(base(tab)), bare: true },
    ]),
  ),
  "v2-hop-dong-ct-thue-do": {
    title: "Giao diện mới — Hợp đồng Makeup · tab Thuê đồ",
    render: () => wrap({ ...base("rental"), contract: f.contractMakeup }),
    bare: true,
  },
  "v2-hop-dong-ct-nhap": {
    title: "Giao diện mới — Hợp đồng nháp mới tạo (chưa gửi, chưa thu, chưa ê-kíp)",
    render: () => wrap(draft()),
    bare: true,
  },
  "v2-hop-dong-ct-huy": {
    title: "Giao diện mới — Hợp đồng đã huỷ",
    render: () =>
      wrap({
        ...base("info"),
        contract: { ...f.contractFull, status: "cancelled", cancelled_at: "2026-09-20T03:00:00Z", cancel_reason: "Khách đổi kế hoạch, dời cưới sang năm sau" },
      }),
    bare: true,
  },
};
