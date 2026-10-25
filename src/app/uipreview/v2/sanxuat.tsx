/* Màn xem trước GIAO DIỆN MỚI của nhóm "sanxuat" — mỗi nhóm một file để làm song
 * song không đụng nhau. Đăng ký sẵn trong ../screens.tsx. Bọc màn trong
 * <PreviewV2 path="/dashboard/..."> (xem ./shell.tsx). */
import * as f from "../fixtures";
import { PreviewV2 } from "./shell";
import ProductionView, { type ProductRow, type VendorOrderRow } from "@/app/dashboard/studio/production/ProductionView";
import BoardView, { type BoardCard } from "@/app/dashboard/studio/board/BoardView";
import RentalManager from "@/app/dashboard/studio/rental/RentalManager";
import type { RentalItem, RentalOrderWithItems } from "@/lib/types";

/** Ngày TƯƠNG ĐỐI so với hôm nay (giờ VN), để nhóm "quá hạn / sắp tới hạn" luôn có hàng. */
const inDays = (n: number) => new Date(Date.now() + 7 * 3600_000 + n * 86_400_000).toISOString().slice(0, 10);

const LONG = f.contracts[0].title;

/* ── Xử lý hình ảnh ─────────────────────────────────────────────────────── */
const staff = [
  ...f.staff,
  { id: "s2", full_name: "Trần Hoài Nam", email: "nam@maistudio.vn" },
  { id: "s3", full_name: null, email: "chau.editor@maistudio.vn" },
];

const job = (id: string, title: string, client_name: string | null, due: number | null) => ({
  id, title, client_name, delivery_due: due === null ? null : inDays(due),
});

const production: ProductRow[] = [
  { id: "p1", name: "Album 30x30 da bò", qty: 1, cost: 3_500_000, status: "ordered", note: "Chờ khách duyệt maket", assigned_to: "s1", contract: job("c1", LONG, "Nguyễn Thị Lan Phương", -3) },
  { id: "p2", name: "Chỉnh màu 120 ảnh cưới", qty: 1, cost: 0, status: "in_progress", note: null, assigned_to: "s2", contract: job("c1", LONG, "Nguyễn Thị Lan Phương", -3) },
  { id: "p3", name: "Video highlight 3 phút", qty: 1, cost: 0, status: "in_progress", note: null, assigned_to: null, contract: job("c7", "Phóng sự cưới nhà trai — Hà Nội", "Đỗ Quang Huy", 2) },
  { id: "p4", name: "Ảnh phóng 60x90", qty: 2, cost: 900_000, status: "ordered", note: null, assigned_to: null, contract: job("c2", "Chụp kỷ yếu 12A3", "Trần Văn B", 0) },
  { id: "p5", name: "Retouch 40 ảnh sản phẩm", qty: 1, cost: 0, status: "in_progress", note: "Nền trắng, bóng đổ nhẹ", assigned_to: "s1", contract: job("c5", "Chụp sản phẩm mỹ phẩm · 120 mẫu", "Công ty TNHH Hạ Vy", 5) },
  { id: "p6", name: "Photobook 20x20 gia đình", qty: 1, cost: 1_200_000, status: "ordered", note: null, assigned_to: "s3", contract: job("c8", "Chụp gia đình Tết 2026", "Lê Minh Khang", 18) },
  { id: "p7", name: "USB gỗ khắc tên", qty: 1, cost: 250_000, status: "ordered", note: null, assigned_to: null, contract: null },
  { id: "p8", name: "Dựng phim phóng sự ngày cưới", qty: 1, cost: 0, status: "done", note: null, assigned_to: "s2", contract: job("c9", "Phóng sự cưới Hội An", "Phạm Thu Hà", -10) },
  { id: "p9", name: "File gốc + 300 ảnh chỉnh", qty: 1, cost: 0, status: "done", note: null, assigned_to: "s1", contract: job("c9", "Phóng sự cưới Hội An", "Phạm Thu Hà", -10) },
];

const productionOrders: VendorOrderRow[] = [
  { id: "o1", vendor_name: "Xưởng album Minh Anh", contract_id: "c1", title: "Album 30x30 cao cấp, 40 trang", amount: 3_500_000, status: "doing", due_date: inDays(-1) },
  { id: "o2", vendor_name: "Trang điểm Ngọc", contract_id: "c7", title: "Makeup ngoài cho nhà trai", amount: 1_500_000, status: "sent", due_date: inDays(2) },
  { id: "o3", vendor_name: "In ấn Sài Gòn", contract_id: "c2", title: "In ảnh phóng 60x90 × 2", amount: 900_000, status: "received", due_date: inDays(6) },
  { id: "o4", vendor_name: null, contract_id: null, title: "Xe hoa Mercedes trắng", amount: 2_000_000, status: "sent", due_date: null },
];

/* ── Bảng công việc ─────────────────────────────────────────────────────── */
const items = (v: number) => [{ qty: 1, unit_price: v }];
const tasks = (done: number, total: number) => Array.from({ length: total }, (_, i) => ({ done: i < done }));
const board: BoardCard[] = [
  ...f.board,
  { id: "b1", title: "Phóng sự cưới nhà trai — Hà Nội", client_name: "Đỗ Quang Huy", status: "approved", event_date: inDays(1), delivery_due: null, contract_items: items(34_000_000), contract_tasks: tasks(1, 4) },
  { id: "b2", title: "Chụp gia đình cuối tuần", client_name: "Lê Minh Khang", status: "sent", event_date: inDays(4), delivery_due: null, contract_items: items(6_500_000), contract_tasks: [] },
  { id: "b3", title: "Chụp cưới Đà Lạt + phóng sự ngày cưới", client_name: "Vũ Ngọc Ánh", status: "in_progress", event_date: inDays(0), delivery_due: inDays(30), contract_items: items(52_000_000), contract_tasks: tasks(2, 6) },
  { id: "b4", title: "Quay phóng sự kỷ niệm 1 năm", client_name: "Hoàng Yến", status: "post_production", event_date: inDays(-6), delivery_due: inDays(2), contract_items: items(8_000_000), contract_tasks: tasks(3, 3) },
  { id: "b5", title: "Chụp ảnh bầu tại studio", client_name: "Phạm Thu Hà", status: "completed", event_date: inDays(-40), delivery_due: inDays(-20), contract_items: items(12_000_000), contract_tasks: tasks(4, 4) },
  { id: "b6", title: "Chụp lookbook thu đông", client_name: "Công ty TNHH Hạ Vy", status: "approved", event_date: inDays(12), delivery_due: null, contract_items: items(18_000_000), contract_tasks: [] },
];

/* ── Phòng váy ──────────────────────────────────────────────────────────── */
const rentalItems: RentalItem[] = [
  ...f.rentalKho.map((r) => ({ ...r, owner_id: "o" }) as RentalItem),
  { id: "r5", owner_id: "o", name: "Váy cưới công chúa xoè tầng, đuôi dài 3m", category: "dress", code: "V-02", size: "M", color: "ngà", rental_price: 6_500_000, deposit: 5_000_000, quantity: 1, cover_url: null, status: "maintenance", note: "Đang giặt hấp, xong thứ Sáu", created_at: "2026-09-12" },
  { id: "r6", owner_id: "o", name: "Vest xám khói slim-fit", category: "vest", code: "VS-05", size: "M", color: "xám", rental_price: 800_000, deposit: 500_000, quantity: 2, cover_url: null, status: "available", note: null, created_at: "2026-09-12" },
  { id: "r7", owner_id: "o", name: "Áo dài cưới trắng ngọc trai", category: "ao_dai", code: "AD-02", size: "S", color: "trắng", rental_price: 1_500_000, deposit: 1_000_000, quantity: 1, cover_url: null, status: "retired", note: "Rách tà, ngưng cho thuê", created_at: "2026-09-12" },
  { id: "r8", owner_id: "o", name: "Găng tay ren cô dâu", category: "accessory", code: null, size: null, color: "trắng", rental_price: 100_000, deposit: 0, quantity: 6, cover_url: null, status: "available", note: null, created_at: "2026-09-12" },
];

const line = (order_id: string, id: string, item_id: string, name: string, price: number, qty = 1) => ({ id, order_id, item_id, name, price, qty, created_at: "2026-09-12" });
const rentalOrders: RentalOrderWithItems[] = [
  { id: "ro1", owner_id: "o", contract_id: null, client_name: "Nguyễn Thị Lan Phương", client_phone: "0912345678", pickup_date: inDays(-6), return_date: inDays(-2), returned_at: null, total_price: 4_500_000, deposit_paid: 3_000_000, status: "picked_up", note: null, created_at: inDays(-10), updated_at: inDays(-6),
    items: [line("ro1", "l1", "r1", "Váy cưới đuôi cá ren Pháp — size S", 4_500_000)] },
  { id: "ro2", owner_id: "o", contract_id: null, client_name: "Đỗ Quang Huy", client_phone: "0966777888", pickup_date: inDays(-1), return_date: inDays(2), returned_at: null, total_price: 2_100_000, deposit_paid: 1_500_000, status: "picked_up", note: "Khách tự đến lấy", created_at: inDays(-5), updated_at: inDays(-1),
    items: [line("ro2", "l2", "r3", "Vest chú rể xanh navy", 900_000), line("ro2", "l3", "r2", "Áo dài đỏ thêu tay", 1_200_000)] },
  { id: "ro3", owner_id: "o", contract_id: null, client_name: "Lê Minh Khang", client_phone: null, pickup_date: inDays(1), return_date: inDays(3), returned_at: null, total_price: 1_400_000, deposit_paid: 0, status: "booked", note: null, created_at: inDays(-2), updated_at: inDays(-2),
    items: [line("ro3", "l4", "r6", "Vest xám khói slim-fit", 800_000), line("ro3", "l5", "r4", "Mấn cô dâu đính ngọc trai", 300_000, 2)] },
  { id: "ro4", owner_id: "o", contract_id: "c1", client_name: "Phạm Thu Hà", client_phone: "0977888999", pickup_date: inDays(-20), return_date: inDays(-17), returned_at: inDays(-17), total_price: 1_200_000, deposit_paid: 1_000_000, status: "returned", note: null, created_at: inDays(-25), updated_at: inDays(-17),
    items: [line("ro4", "l6", "r2", "Áo dài đỏ thêu tay", 1_200_000)] },
  { id: "ro5", owner_id: "o", contract_id: null, client_name: "Hoàng Yến", client_phone: "0911000222", pickup_date: inDays(5), return_date: inDays(7), returned_at: null, total_price: 300_000, deposit_paid: 0, status: "canceled", note: "Khách đổi ngày cưới", created_at: inDays(-3), updated_at: inDays(-1),
    items: [line("ro5", "l7", "r4", "Mấn cô dâu đính ngọc trai", 300_000)] },
];

export const SCREENS_SANXUAT: Record<string, { title: string; render: () => React.ReactNode; bare?: boolean }> = {
  "v2-xu-ly-anh": {
    title: "Giao diện mới — Xử lý hình ảnh",
    render: () => (
      <PreviewV2 path="/dashboard/studio/production">
        <ProductionView initial={production} staff={staff} orders={productionOrders} />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-xu-ly-anh-trong": {
    title: "Giao diện mới — Xử lý hình ảnh (chưa có việc)",
    render: () => (
      <PreviewV2 path="/dashboard/studio/production">
        <ProductionView initial={[]} staff={[]} />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-bang-viec": {
    title: "Giao diện mới — Bảng công việc",
    render: () => (
      <PreviewV2 path="/dashboard/studio/board">
        <BoardView initial={board} />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-bang-viec-trong": {
    title: "Giao diện mới — Bảng công việc (trống)",
    render: () => (
      <PreviewV2 path="/dashboard/studio/board">
        <BoardView initial={[]} />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-phong-vay": {
    title: "Giao diện mới — Phòng váy",
    render: () => (
      <PreviewV2 path="/dashboard/studio/rental">
        <RentalManager ownerId="o" initialItems={rentalItems} initialOrders={rentalOrders} />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-phong-vay-trong": {
    title: "Giao diện mới — Phòng váy (kho trống)",
    render: () => (
      <PreviewV2 path="/dashboard/studio/rental">
        <RentalManager ownerId="o" initialItems={[]} initialOrders={[]} />
      </PreviewV2>
    ),
    bare: true,
  },
};
