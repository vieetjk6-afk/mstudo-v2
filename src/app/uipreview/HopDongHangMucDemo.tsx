"use client";

import ContractEditor from "@/app/dashboard/studio/contracts/[id]/ContractEditor";
import type { ContractItem, StudioContract } from "@/lib/types";

/**
 * Xem trước TAB HẠNG MỤC của hợp đồng bằng dữ liệu giả.
 *
 * Vì sao cần: trình sửa hợp đồng nằm sau đăng nhập studio + một hợp đồng có
 * thật trong Supabase, nên muốn soát riêng khối hạng mục (ô mô tả bật/tắt, bản
 * in, tổng tiền) thì gần như không mở bằng tay được đúng lúc cần nhìn.
 */

const CONTRACT: StudioContract = {
  id: "demo", owner_id: "demo", code: "HD-2026-018", title: "Hợp đồng chụp cưới — Ngọc Hân & Minh Khoa",
  client_name: "Ngọc Hân", client_phone: "0903221118", client_email: null,
  shoot_type: "prewedding", service_id: null, event_date: "2026-11-08", event_time: "07:00",
  location: "Đà Lạt", status: "draft", deposit: 15_000_000, note: null, client_token: "demo",
  client_signed_name: null, client_signature: null, client_signed_at: null,
  studio_signed_name: null, studio_signature: null, studio_signed_at: null,
  gallery_album_id: null, client_viewed_at: null, assigned_to: null, delivery_due: "2026-12-05",
  client_messenger: null, selection_album_id: null, source: null,
  brief_concept: null, brief_outfit: null, brief_refs: null, brief_note: null, brief_submitted_at: null,
  chosen_quote_option_id: null, chosen_quote_at: null,
  intake_token: null, intake: null, intake_submitted_at: null, branch_id: null,
  created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z",
};

const ITEMS: ContractItem[] = [
  {
    id: "i1", contract_id: "demo", name: "Chụp phóng sự cả ngày",
    description: "2 thợ chính + 1 trợ lý, có mặt từ 6h00 đến hết tiệc.\n300 ảnh sửa màu, giao qua link tải trong 20 ngày.",
    qty: 1, unit_price: 28_000_000, position: 0, created_at: "",
  },
  {
    id: "i2", contract_id: "demo", name: "Album cát tút 25×35",
    description: "40 trang, bìa da thật ép nhũ tên cô dâu chú rể.", qty: 2, unit_price: 3_500_000, position: 1, created_at: "",
  },
  // Hạng mục CHƯA có mô tả — phải hiện nút "Thêm mô tả", không phải khung trống.
  { id: "i3", contract_id: "demo", name: "Quay phim highlight 5 phút", description: null, qty: 1, unit_price: 12_000_000, position: 2, created_at: "" },
  { id: "i4", contract_id: "demo", name: "🏷️ Giảm giá khách quen", description: null, qty: 1, unit_price: -2_000_000, position: 3, created_at: "" },
];

export default function HopDongHangMucDemo() {
  return (
    <ContractEditor
      contract={CONTRACT}
      initialItems={ITEMS}
      initialCrew={[]}
      initialRequests={[]}
      initialPayments={[]}
      roster={[]}
      galleries={[]}
      selectionAlbums={[]}
      initialMilestones={[]}
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
      pricelist={[{ name: "Chụp phóng sự cả ngày", price: 28_000_000, unit: "gói" }]}
      initialClientProofs={[]}
      initialTab="items"
    />
  );
}
