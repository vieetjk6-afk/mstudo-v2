/* Màn xem trước GIAO DIỆN MỚI của nhóm "hopdongct" — mỗi nhóm một file để làm song
 * song không đụng nhau. Đăng ký sẵn trong ../screens.tsx. Bọc màn trong
 * <PreviewV2 path="/dashboard/..."> (xem ./shell.tsx). */
import * as f from "../fixtures";
import { PreviewV2 } from "./shell";
import ContractEditor from "@/app/dashboard/studio/contracts/[id]/ContractEditor";
import SessionInfoView from "@/app/dashboard/studio/contracts/[id]/buoi-chup/SessionInfoView";
import type { ContractEditorProps } from "@/app/dashboard/studio/contracts/[id]/useContractEditor";
import type { ContractAddendum } from "@/lib/contract-addenda";
import type { ContractIntake, StudioAppointment } from "@/lib/types";
import { todayVN } from "@/lib/date";
import { addDaysIso } from "@/lib/contract-filter";
import { CancelDemo, FakeContractApi, RescheduleDemo, type FakeVariant } from "./hopdongct-demo";

const D = f.contractFull.event_date ?? "2026-09-12";

/* Lịch hẹn dịch vụ của hợp đồng: một buổi thử đồ đã xong (có phòng, người phụ
   trách tên dài) và một buổi trang điểm sáng ngày cưới. */
const appointments: StudioAppointment[] = [
  {
    id: "ap1", owner_id: "o1", contract_id: "c1", kind: "fitting", title: "", appt_date: "2026-09-05", start_time: "14:00", end_time: "15:30",
    duration_min: 90, location: null, room: "Phòng thử đồ 2", crew_id: "sc2", staff_id: null, crew_name: "Lê Thị Hồng Nhung Phương Thảo",
    client_name: "Nguyễn Thị Lan Phương", client_phone: "0912345678", status: "done", checked_in_at: null, done_at: null, note: null,
    client_visible: true, branch_id: "b1", position: 0, created_at: `${D}T08:00:00Z`, updated_at: `${D}T08:00:00Z`,
  },
  {
    id: "ap2", owner_id: "o1", contract_id: "c1", kind: "makeup", title: "Trang điểm cô dâu sáng ngày cưới", appt_date: D, start_time: "05:30", end_time: null,
    duration_min: null, location: "Nhà gái — 12 Lê Lợi, Đà Lạt", room: null, crew_id: null, staff_id: null, crew_name: null,
    client_name: "Nguyễn Thị Lan Phương", client_phone: "0912345678", status: "scheduled", checked_in_at: null, done_at: null, note: null,
    client_visible: true, branch_id: "b1", position: 1, created_at: `${D}T08:00:00Z`, updated_at: `${D}T08:00:00Z`,
  },
];

/* Phụ lục: một bản đã ký (khách ký ở cổng) và một bản nháp chờ ký có dòng giảm giá. */
const addenda: ContractAddendum[] = [
  {
    id: "ad1", contract_id: "c1", no: 1, title: "Thêm buổi chụp pre-wedding ở hồ Tuyền Lâm", note: null,
    lines: [
      { name: "Chụp pre-wedding nửa ngày", description: null, qty: 1, unit_price: 6_500_000 },
      { name: "Váy cưới thứ hai", description: null, qty: 1, unit_price: 1_500_000 },
    ],
    signed_at: `${D}T11:00:00Z`, signed_by: "client", signed_name: "Nguyễn Thị Lan Phương", created_at: `${D}T10:00:00Z`,
  },
  {
    id: "ad2", contract_id: "c1", no: 2, title: "", note: "Studio tặng thêm 10 ảnh in 13x18 cho gia đình hai bên.",
    lines: [
      { name: "In thêm album 25x25 cho bố mẹ", description: null, qty: 2, unit_price: 1_800_000 },
      { name: "Giảm giá khách quen", description: null, qty: 1, unit_price: -600_000 },
    ],
    signed_at: null, signed_by: null, signed_name: null, created_at: `${D}T12:00:00Z`,
  },
];

/* Form thông tin buổi chụp khách đã điền (cưới: nhà gái · nhà trai · tiệc · ghi chú). */
const intake: ContractIntake = {
  type: "psc",
  bride: {
    name: "Nguyễn Thị Lan Phương", phone: "0912345678", makeup_time: "05:30", ceremony_time: "09:30",
    location: { lat: 11.9404, lng: 108.4583, mapUrl: "https://maps.google.com/?q=11.9404,108.4583" },
  },
  groom: {
    name: "Trần Minh Quân", phone: "0987654321", depart_time: "08:30", ceremony_time: "10:30",
    location: { lat: 11.9465, lng: 108.4419, mapUrl: "https://maps.google.com/?q=11.9465,108.4419" },
  },
  reception: { time: "18:00", location: { lat: 11.9361, lng: 108.4429, mapUrl: "https://maps.google.com/?q=11.9361,108.4429" } },
  note: "Cô dâu ngại chụp cận mặt nghiêng trái. Nhà gái có cầu thang hẹp — mang đèn gọn, không dựng chân đèn lớn.",
};

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
    initialAppointments: [...f.contractAppointments, ...appointments],
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
    initialAddenda: addenda,
    canEditAddenda: true,
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

/* FakeContractApi bọc NGOÀI khung: các thẻ con tự nạp dữ liệu (album, voucher,
   kế hoạch cưới, thuê đồ…) nhận dữ liệu giả thay vì "unauthorized". */
const wrap = (p: ContractEditorProps, variant: FakeVariant = {}, extra?: React.ReactNode) => (
  <FakeContractApi variant={variant}>
    <PreviewV2 path="/dashboard/studio/contracts/x">
      <ContractEditor {...p} />
      {extra}
    </PreviewV2>
  </FakeContractApi>
);

const session = (withIntake: boolean) => (
  <PreviewV2 path="/dashboard/studio/contracts/x/buoi-chup">
    <SessionInfoView
      contract={{
        id: "c1",
        title: f.contractFull.title,
        clientName: f.contractFull.client_name,
        eventDate: f.contractFull.event_date,
        eventTime: f.contractFull.event_time,
        location: f.contractFull.location,
        intake: withIntake ? intake : null,
        submittedAt: withIntake ? `${D}T13:40:00Z` : null,
      }}
      formUrl="https://mayanh.mstudo.com/form/demo-intake"
      crew={f.contractCrew.map((c) => ({ id: c.id, name: c.name, phone: c.phone, role: c.role, side: c.side, event_id: null }))}
      studioName={f.studio.name}
    />
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
  "v2-hop-dong-ct-album-link": {
    title: "Giao diện mới — Hợp đồng · Sản phẩm, album nhập link riêng (đã hoàn thành, chờ giao)",
    render: () => wrap(base("album"), { albumMode: "manual" }),
    bare: true,
  },
  "v2-hop-dong-ct-voucher": {
    title: "Giao diện mới — Hợp đồng · Thanh toán, đã tặng voucher ưu đãi lần sau",
    render: () => wrap(base("pay"), { voucherIssued: true }),
    bare: true,
  },
  "v2-hop-dong-ct-doi-lich": {
    title: "Giao diện mới — Hộp thoại Dời lịch hợp đồng",
    render: () => wrap(base("info"), {}, <RescheduleDemo />),
    bare: true,
  },
  "v2-hop-dong-ct-huy-hd": {
    title: "Giao diện mới — Hộp thoại Huỷ hợp đồng (hoàn cọc theo chính sách)",
    render: () => wrap(base("info"), {}, <CancelDemo />),
    bare: true,
  },
  "v2-buoi-chup": {
    title: "Giao diện mới — Thông tin buổi chụp (khách đã điền form)",
    render: () => session(true),
    bare: true,
  },
  "v2-buoi-chup-trong": {
    title: "Giao diện mới — Thông tin buổi chụp (khách chưa điền)",
    render: () => session(false),
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
