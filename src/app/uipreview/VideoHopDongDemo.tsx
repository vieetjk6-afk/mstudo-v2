"use client";

import ContractEditor from "@/app/dashboard/studio/contracts/[id]/ContractEditor";
import type { ContractItem, StudioContract, StudioEvent } from "@/lib/types";

/**
 * Hai màn dựng riêng cho VIDEO giới thiệu hợp đồng (scripts/quay-video-hop-dong.mjs):
 *
 *   · VideoHangMucDemo — hợp đồng nháp, bảng giá đủ dài để khoe ô chọn hạng mục,
 *     hạng mục đã chia chính/phụ, có sẵn một mốc lịch để khoe nút sửa tên.
 *   · VideoPhuLucDemo  — cùng hợp đồng nhưng KHÁCH ĐÃ KÝ: bảng giá khoá, thêm bớt
 *     dịch vụ đi bằng phụ lục.
 *
 * Tách khỏi HopDongHangMucDemo để chỉnh cảnh quay không làm lệch ảnh soát giao
 * diện (npm run ui:shot) đang dùng màn kia.
 */

const BASE: StudioContract = {
  id: "demo", owner_id: "demo", code: "HD-2026-042", title: "Cưới Mai Anh & Đức Huy",
  client_name: "Mai Anh", client_phone: "0938556172", client_email: null,
  shoot_type: "wedding", service_id: null, event_date: "2026-12-20", event_time: "06:00",
  location: "White Palace Phạm Văn Đồng", status: "draft", deposit: 5_000_000, note: null, client_token: "demo",
  client_signed_name: null, client_signature: null, client_signed_at: null,
  studio_signed_name: null, studio_signature: null, studio_signed_at: null,
  gallery_album_id: null, client_viewed_at: null, assigned_to: null, delivery_due: "2027-01-15",
  client_messenger: null, selection_album_id: null, source: null,
  brief_concept: null, brief_outfit: null, brief_refs: null, brief_note: null, brief_submitted_at: null,
  chosen_quote_option_id: null, chosen_quote_at: null,
  intake_token: null, intake: null, intake_submitted_at: null, branch_id: null,
  created_at: "2026-09-20T00:00:00Z", updated_at: "2026-09-20T00:00:00Z",
};

const ITEMS: ContractItem[] = [
  {
    id: "v1", contract_id: "demo", name: "Gói combo chụp + quay ngày cưới", tier: "main",
    description: "2 thợ chụp, 2 thợ quay, 1 flycam — từ lễ gia tiên tới hết tiệc.",
    qty: 1, unit_price: 13_500_000, position: 0, created_at: "",
  },
  { id: "v2", contract_id: "demo", name: "Album cao cấp 30×30", description: null, tier: "sub", qty: 1, unit_price: 3_500_000, position: 1, created_at: "" },
  { id: "v3", contract_id: "demo", name: "Ảnh phóng 60×90 khung gỗ", description: null, tier: null, qty: 2, unit_price: 800_000, position: 2, created_at: "" },
];

const PRICELIST = [
  { name: "Chụp đãi trước (tiệc nhà gái)", price: 4_000_000, unit: "buổi" },
  { name: "Chụp lễ gia tiên", price: 3_500_000, unit: "buổi" },
  { name: "Quay phim highlight 5 phút", price: 6_000_000, unit: "gói" },
  { name: "Flycam quay toàn cảnh", price: 2_500_000, unit: "buổi" },
  { name: "Album cao cấp 30×30", price: 3_500_000, unit: "cuốn" },
  { name: "Ảnh phóng 60×90 khung gỗ", price: 800_000, unit: "tấm" },
];

const MILESTONES: StudioEvent[] = [
  { id: "ms1", owner_id: "demo", contract_id: "demo", title: "Thử đồ", event_date: "2026-12-05", event_time: "15:00", note: null, remind: true, created_at: "" },
];

function Editor({ contract, tab, canEditAddenda }: { contract: StudioContract; tab: string; canEditAddenda?: boolean }) {
  return (
    <ContractEditor
      contract={contract}
      initialItems={ITEMS}
      initialCrew={[]}
      initialRequests={[]}
      initialPayments={[]}
      roster={[]}
      galleries={[]}
      selectionAlbums={[]}
      initialMilestones={MILESTONES}
      initialAppointments={[]}
      ownerId="demo"
      branches={[]}
      studioName="MStudo Demo"
      conflictByPhone={{}}
      initialTasks={[]}
      initialExpenses={[]}
      initialPlan={[]}
      initialProducts={[]}
      initialQuoteOptions={[]}
      staffList={[]}
      canAssign={false}
      bank={{ bin: null, account: null, holder: null, name: null }}
      sameDayContracts={[]}
      pricelist={PRICELIST}
      initialClientProofs={[]}
      initialAddenda={[]}
      canEditAddenda={canEditAddenda}
      initialTab={tab}
    />
  );
}

export function VideoHangMucDemo() {
  return <Editor contract={BASE} tab="items" />;
}

export function VideoPhuLucDemo() {
  return (
    <Editor
      contract={{ ...BASE, status: "approved", client_signed_name: "Nguyễn Mai Anh", client_signed_at: "2026-09-22T09:30:00Z", studio_signed_name: "MStudo", studio_signed_at: "2026-09-22T09:00:00Z" }}
      tab="items"
      canEditAddenda
    />
  );
}
