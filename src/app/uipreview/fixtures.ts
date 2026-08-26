/**
 * Dữ liệu giả cho trang xem trước giao diện (/uipreview).
 *
 * Cố ý KHÔNG "đẹp đều": mỗi bộ có sẵn những ca hay làm vỡ bố cục mà dữ liệu
 * thật hiếm khi có đủ lúc ta đang nhìn — tên rất dài, số tiền 8 chữ số, trường
 * để trống, danh sách rỗng, trạng thái lỗi. Đó mới là chỗ giao diện hỏng.
 */
import type { BoardCard } from "@/app/dashboard/studio/board/BoardView";
import type { ClientAgg } from "@/app/dashboard/studio/clients/ClientsView";
import type { ContractRow } from "@/app/dashboard/studio/contracts/ContractsListView";
import type { Lead } from "@/app/dashboard/studio/leads/LeadsView";
import type { PayrollRow } from "@/app/dashboard/studio/payroll/PayrollView";
import type { ProductRow } from "@/app/dashboard/studio/production/ProductionView";
import type { QuoteRow } from "@/app/dashboard/studio/quotes/QuotesListView";
import type { PaymentRow, SalaryRow, SourceStat } from "@/app/dashboard/studio/reports/ReportsView";
import type { ExportStudio } from "@/lib/studio-export";
import type { StaffRow } from "@/app/dashboard/studio/staff/StaffManager";
import type { ChannelPublic, ConversationView, MessageRow } from "@/lib/inbox/types";
import type {
  DiscountCode, StudioBooking, StudioEquipment, StudioExpense, StudioPackage, UpgradeRequest,
} from "@/lib/types";

/** Ngày cố định để ảnh chụp hai lần vẫn giống nhau (khỏi so nhầm khác biệt). */
const D = "2026-09-12";
const LONG = "Chụp phóng sự cưới trọn gói hai ngày tại Đà Lạt kèm quay phim và in album";

export const studio: ExportStudio = {
  name: "Mai Studio",
  phone: "0912345678",
  email: "hello@maistudio.vn",
  site: "maistudio.mstudo.com",
};

export const contracts: ContractRow[] = [
  {
    id: "c1", code: "HD2609", title: LONG, client_name: "Nguyễn Thị Lan Phương", client_phone: "0912345678",
    event_date: D, event_time: "07:30", status: "in_progress", shoot_type: "wedding",
    contract_items: [{ qty: 1, unit_price: 45_000_000, name: "Gói cưới trọn gói" }],
    contract_payments: [{ amount: 15_000_000 }],
    contract_crew: [
      { id: "k1", name: "Anh Tuấn", role: "photographer", status: "accepted" },
      { id: "k2", name: "Minh", role: "assistant", status: "pending" },
    ],
  },
  {
    id: "c2", code: "HD2610", title: "Chụp kỷ yếu 12A3", client_name: "Trần Văn B", client_phone: "0987654321",
    event_date: "2026-08-01", event_time: null, status: "completed", shoot_type: "photo",
    contract_items: [{ qty: 40, unit_price: 350_000 }], contract_payments: [{ amount: 14_000_000 }], contract_crew: [],
  },
  // Hợp đồng nháp, thiếu gần hết trường — ca hay làm vỡ bảng nhất.
  {
    id: "c3", code: null, title: "Chưa đặt tên", client_name: null, client_phone: null,
    event_date: null, event_time: null, status: "draft", shoot_type: "other",
    contract_items: [], contract_payments: [], contract_crew: [],
  },
  {
    id: "c4", code: "HD2611", title: "Chụp ảnh sản phẩm mỹ phẩm", client_name: "Công ty TNHH Mỹ phẩm Hạ Long",
    client_phone: "0900111222", event_date: "2026-09-30", event_time: "13:00", status: "cancelled", shoot_type: "photo",
    contract_items: [{ qty: 1, unit_price: 8_000_000 }], contract_payments: [], contract_crew: [],
  },
];

export const board: BoardCard[] = contracts.map((c) => ({
  id: c.id, title: c.title, client_name: c.client_name, status: c.status,
  event_date: c.event_date, delivery_due: c.status === "in_progress" ? "2026-10-05" : null,
  contract_items: c.contract_items.map((i) => ({ qty: i.qty, unit_price: i.unit_price })),
  contract_tasks: c.status === "in_progress" ? [{ done: true }, { done: true }, { done: false }] : [],
}));

export const clients: ClientAgg[] = [
  { key: "1", name: "Nguyễn Thị Lan Phương", phone: "0912345678", count: 3, value: 82_000_000, collected: 60_000_000, last: D, source: "facebook" },
  { key: "2", name: "Trần Văn B", phone: "0987654321", count: 1, value: 14_000_000, collected: 14_000_000, last: "2026-08-01", source: "referral" },
  // Khách cũ lâu không quay lại (>6 tháng) + chưa rõ nguồn.
  { key: "3", name: "Lê Hoàng Anh Quân", phone: "0900111222", count: 2, value: 21_500_000, collected: 9_000_000, last: "2025-11-20", source: null },
];

export const quotes: QuoteRow[] = [
  {
    id: "q1", owner_id: "o", code: "BG2601", title: "Báo giá chụp cưới Đà Lạt", client_name: "Nguyễn Thị Lan Phương",
    client_phone: "0912345678", client_email: null, client_facebook: null, event_date: D, location: "Đà Lạt",
    intro: null, note: null, deposit_percent: 25, auto_create_contract: false, status: "sent",
    client_token: "t1", expires_at: "2026-09-01", contract_id: null, viewed_at: null, accepted_at: null,
    bulk_discount_amount: 0, bulk_discount_min_items: 0, discount_package_group: null,
    created_at: "2026-08-20T03:00:00Z", updated_at: "2026-08-20T03:00:00Z", branch_id: null,
    quote_items: [{ qty: 1, unit_price: 45_000_000, selected: true, is_optional: false, is_discount: false }],
    quote_adjustments: [],
  },
  {
    id: "q2", owner_id: "o", code: "BG2602", title: "Báo giá kỷ yếu", client_name: "Trần Văn B",
    client_phone: "0987654321", client_email: null, client_facebook: null, event_date: null, location: null,
    intro: null, note: null, deposit_percent: 0, auto_create_contract: false, status: "adjust_requested",
    client_token: "t2", expires_at: null, contract_id: null, viewed_at: "2026-08-21T03:00:00Z", accepted_at: null,
    bulk_discount_amount: 0, bulk_discount_min_items: 0, discount_package_group: null,
    created_at: "2026-08-19T03:00:00Z", updated_at: "2026-08-21T03:00:00Z", branch_id: null,
    quote_items: [{ qty: 40, unit_price: 350_000, selected: true, is_optional: false, is_discount: false }],
    quote_adjustments: [{ id: "a1", resolved: false }],
  },
];

export const production: ProductRow[] = [
  { id: "p1", name: "Album 30x30 da bò", qty: 1, cost: 3_500_000, status: "ordered", note: "Chờ duyệt maket", assigned_to: "s1", contract: { id: "c1", title: LONG, client_name: "Nguyễn Thị Lan Phương", delivery_due: "2026-10-05" } },
  { id: "p2", name: "Ảnh phóng 60x90", qty: 2, cost: 900_000, status: "in_progress", note: null, assigned_to: null, contract: { id: "c2", title: "Chụp kỷ yếu 12A3", client_name: "Trần Văn B", delivery_due: "2026-09-01" } },
  { id: "p3", name: "USB gỗ khắc tên", qty: 1, cost: 250_000, status: "done", note: null, assigned_to: "s1", contract: null },
];

export const staff = [{ id: "s1", full_name: "Phạm Thu Hà", email: "ha@maistudio.vn" }];

export const payroll: PayrollRow[] = [
  { id: "w1", name: "Anh Tuấn", phone: "0911222333", role: "photographer", salary: 3_000_000, status: "accepted", paid: false, contract: { id: "c1", title: LONG, event_date: D, code: "HD2609" } },
  { id: "w2", name: "Minh", phone: "0911222444", role: "assistant", salary: 800_000, status: "pending", paid: false, contract: { id: "c1", title: LONG, event_date: D, code: "HD2609" } },
  { id: "w3", name: "Anh Tuấn", phone: "0911222333", role: "photographer", salary: 2_500_000, status: "accepted", paid: true, contract: { id: "c2", title: "Chụp kỷ yếu 12A3", event_date: "2026-08-01", code: "HD2610" } },
  // Thợ TỪ CHỐI: studio không nợ đồng nào, phải bị loại khỏi mọi con số tiền.
  { id: "w4", name: "Hùng", phone: "0911222555", role: "photographer", salary: 4_000_000, status: "declined", paid: false, contract: { id: "c1", title: LONG, event_date: D, code: "HD2609" } },
];

export const leads: Lead[] = [
  { id: "l1", name: "Chị Hằng", phone: "0933444555", interest: "Chụp cưới ngoại cảnh Đà Lạt tháng 11", status: "new", created_at: "2026-08-25T02:10:00Z", transcript: [{ role: "user", content: "Bên mình có gói chụp Đà Lạt không ạ?" }, { role: "assistant", content: "Dạ có ạ, bên em có gói 2 ngày…" }] },
  // Lead trống gần hết: chatbox bắt được mỗi số điện thoại.
  { id: "l2", name: null, phone: "0944555666", interest: null, status: "contacted", created_at: "2026-08-24T09:00:00Z", transcript: null },
];

export const bookings: StudioBooking[] = [
  { id: "b1", owner_id: "o", name: "Nguyễn Thị Lan Phương", phone: "0912345678", service: "Chụp cưới", preferred_date: D, note: "Muốn chụp buổi sáng sớm", package_name: "Gói trọn gói", package_price: 45_000_000, facebook: null, status: "new", deposit_amount: 3_000_000, deposit_status: "paid", deposit_proof_url: null, deposit_paid_at: "2026-08-25T04:00:00Z", deposit_code: "COC-4K7Q", deposit_token: "tk1", referrer_phone: "0987654321", branch_id: null, created_at: "2026-08-25T03:00:00Z" },
  { id: "b2", owner_id: "o", name: "Khách chưa để lại tên", phone: "0955666777", service: null, preferred_date: null, note: null, package_name: null, package_price: null, facebook: null, status: "pending", deposit_amount: null, deposit_status: "none", deposit_proof_url: null, deposit_paid_at: null, deposit_code: null, deposit_token: null, referrer_phone: null, branch_id: null, created_at: "2026-08-23T03:00:00Z" },
];

export const payments: PaymentRow[] = [
  { id: "m1", amount: 15_000_000, kind: "deposit", paid_at: "2026-08-20", contract: { title: LONG } },
  { id: "m2", amount: 14_000_000, kind: "final", paid_at: "2026-08-05", contract: { title: "Chụp kỷ yếu 12A3" } },
];

export const salaries: SalaryRow[] = [
  { id: "s1", name: "Anh Tuấn", salary: 2_500_000, paid: true, paid_at: "2026-08-06", contract: { title: "Chụp kỷ yếu 12A3" } },
  { id: "s2", name: "Minh", salary: 800_000, paid: false, paid_at: null, contract: { title: LONG } },
];

export const expenses: StudioExpense[] = [
  { id: "e1", owner_id: "o", contract_id: null, title: "Thuê lens 24-70 f2.8", amount: 1_200_000, category: "equipment", note: null, spent_at: "2026-08-18", client_visible: false, branch_id: null, created_at: "2026-08-18T03:00:00Z" },
  { id: "e2", owner_id: "o", contract_id: "c1", title: "Vé xe Đà Lạt", amount: 2_400_000, category: "travel", note: "2 người", spent_at: "2026-08-19", client_visible: true, branch_id: null, created_at: "2026-08-19T03:00:00Z" },
];

export const sourceStats: SourceStat[] = [
  { source: "facebook", label: "Facebook", count: 5, value: 120_000_000, collected: 90_000_000 },
  { source: "referral", label: "Khách giới thiệu", count: 3, value: 48_000_000, collected: 48_000_000 },
];

const upgrade = (over: Partial<UpgradeRequest>): UpgradeRequest => ({
  id: Math.random().toString(36).slice(2), user_id: "u1", email: "studio.anhcuoi@gmail.com", note: null,
  plan: "studio", cycle: "year", discount_code: null, phone: "0912345678", amount: 3_000_000,
  payment_amount: 3_000_000, payment_code: "MS-4K7Q", payment_status: "none", declared_at: null,
  reviewed_at: null, reviewed_by: null, review_note: null, handled: false, created_at: "2026-08-26T09:12:00Z",
  ...over,
});

export const upgrades: UpgradeRequest[] = [
  upgrade({ payment_status: "awaiting_confirm", declared_at: "2026-08-26T09:30:00Z" }),
  upgrade({ payment_status: "paid", handled: true, plan: "basic", cycle: "month", payment_amount: 50_000 }),
  upgrade({ payment_status: "failed", plan: "photographer", payment_amount: 999_000, review_note: "Chưa thấy tiền về" }),
  upgrade({ payment_status: "none", discount_code: "TET2026", payment_amount: 2_100_000, note: "Cần xuất hoá đơn" }),
];

export const codes = [
  { id: "1", code: "TET2026", percent: 30, plan: null, cycle: null, max_uses: null, used_count: 12, expires_at: "2026-12-31", trial_days: null, active: true, created_at: "2026-01-01" },
  { id: "2", code: "THUSTUDIO", percent: 0, plan: "studio", cycle: null, max_uses: 1, used_count: 1, expires_at: "2026-01-01", trial_days: 1, active: true, created_at: "2026-01-01" },
] as DiscountCode[];

export const bank = { bin: "970436", account: "0123456789", holder: "NGUYEN VAN A", name: "Vietcombank" };

export const staffRows: StaffRow[] = [
  { id: "u1", email: "ha@maistudio.vn", full_name: "Phạm Thu Hà", studio_role: "manager", studio_branch_id: "b1", is_active: true, created_at: "2026-03-01T03:00:00Z" },
  { id: "u2", email: "nam@maistudio.vn", full_name: "Trần Hoài Nam", studio_role: "staff", studio_branch_id: null, is_active: true, created_at: "2026-05-12T03:00:00Z" },
  // Tài khoản đã KHOÁ và chưa đặt tên — hai ca hay làm hàng bị lệch.
  { id: "u3", email: "ketoan.rat.dai.dong@maistudio.com.vn", full_name: null, studio_role: "accountant", studio_branch_id: null, is_active: false, created_at: "2026-06-20T03:00:00Z" },
];

export const branches = [{ id: "b1", name: "Cơ sở Quận 1" }, { id: "b2", name: "Cơ sở Thủ Đức" }];

export const equipment: StudioEquipment[] = [
  { id: "e1", owner_id: "o", name: "Sony A7 IV + lens 24-70 f2.8 GM", category: "Máy ảnh", note: "Body số 2, có vết xước nhẹ ở LCD", active: true, branch_id: "b1", created_at: "2026-01-01T03:00:00Z" },
  { id: "e2", owner_id: "o", name: "Đèn Godox AD200", category: null, note: null, active: true, branch_id: null, created_at: "2026-01-01T03:00:00Z" },
  { id: "e3", owner_id: "o", name: "Chân máy hỏng ốc", category: "Phụ kiện", note: "Chờ sửa", active: false, branch_id: "b2", created_at: "2026-01-01T03:00:00Z" },
];

export const packages: StudioPackage[] = [
  { id: "g1", owner_id: "o", client_name: "Nguyễn Thị Lan Phương", client_phone: "0912345678", name: "Gói 10 buổi chụp bé", total_sessions: 10, used_sessions: 7, price: 12_000_000, paid: true, note: null, created_at: "2026-04-01T03:00:00Z" },
  // Gói đã dùng HẾT và chưa trả tiền — hai ca cần nhìn thấy ngay.
  { id: "g2", owner_id: "o", client_name: "Trần Văn B", client_phone: null, name: "Gói chụp gia đình", total_sessions: 4, used_sessions: 4, price: 6_000_000, paid: false, note: "Hẹn trả sau buổi cuối", created_at: "2026-02-01T03:00:00Z" },
];

/* ── Hộp thư hợp nhất ───────────────────────────────────────────────────────
   Cố ý gồm đủ những ca hay làm vỡ khung chat: khách chưa cho tên, tên rất dài,
   hội thoại đã QUÁ cửa sổ trả lời của Facebook (ô soạn phải bị khoá), tin gửi
   HỎNG, và một hội thoại nhân viên đã tiếp quản.

   Mốc thời gian của hội thoại ĐANG mở phải tính theo giờ hiện tại: cửa sổ trả
   lời đo bằng "cách đây bao lâu", nên nếu ghim ngày cứng thì mọi ảnh chụp sau
   đó đều ra màn khoá ô soạn — và ta không bao giờ nhìn thấy trạng thái thường
   gặp nhất. */
const phutTruoc = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
export const inboxConversations: ConversationView[] = [
  {
    id: "c1", platform: "facebook", channelName: "Mai Studio - Fanpage",
    contactName: "Nguyễn Thị Lan Phương", contactAvatar: null, contactPhone: "0912345678",
    status: "open", aiEnabled: true, assigneeId: null, assigneeName: null,
    lastMessage: "Dạ chị muốn hỏi gói chụp cưới ngoại cảnh Đà Lạt ạ",
    lastMessageAt: phutTruoc(8), lastDirection: "in", unread: 3,
    lastInboundAt: phutTruoc(8),
  },
  {
    id: "c2", platform: "zalo_oa", channelName: "Mai Studio OA",
    contactName: "Khách chưa cho tên", contactAvatar: null, contactPhone: null,
    status: "open", aiEnabled: false, assigneeId: "u1", assigneeName: null,
    // KHÔNG tự thêm "Bạn:" vào đây — giao diện đã tự gắn theo lastDirection.
    lastMessage: "Dạ em gửi bảng giá qua Zalo cho chị nhé",
    lastMessageAt: phutTruoc(95), lastDirection: "out", unread: 0,
    lastInboundAt: phutTruoc(110),
  },
  {
    id: "c3", platform: "instagram", channelName: "@maistudio.vn",
    contactName: "Trần Nguyễn Hoàng Bảo Ngọc Phương Thảo", contactAvatar: null, contactPhone: null,
    // Tin cuối của khách đã quá 24 giờ ⇒ ô soạn tin PHẢI khoá kèm giải thích.
    status: "open", aiEnabled: true, assigneeId: null, assigneeName: null,
    lastMessage: "chụp kỷ yếu cho lớp 45 bạn thì bao nhiêu ạ",
    lastMessageAt: "2026-03-08T09:00:00Z", lastDirection: "in", unread: 1,
    lastInboundAt: "2026-03-08T09:00:00Z",
  },
  {
    id: "c4", platform: "website", channelName: "Chatbox website",
    contactName: "Khách chưa cho tên", contactAvatar: null, contactPhone: null,
    status: "closed", aiEnabled: true, assigneeId: null, assigneeName: null,
    lastMessage: "📎 Tệp đính kèm", lastMessageAt: "2026-03-07T02:00:00Z",
    lastDirection: "in", unread: 0, lastInboundAt: "2026-03-07T02:00:00Z",
  },
];

export const inboxMessages: MessageRow[] = [
  {
    id: "m1", conversation_id: "c1", direction: "in", sender: "customer", sender_id: null,
    sender_name: null, body: "Chào shop, mình muốn hỏi gói chụp cưới ngoại cảnh Đà Lạt",
    attachments: [], status: "sent", error: null, created_at: phutTruoc(20),
  },
  {
    id: "m2", conversation_id: "c1", direction: "out", sender: "ai", sender_id: null,
    sender_name: "Trợ lý AI",
    body: "Dạ chào chị ạ! Gói ngoại cảnh Đà Lạt bên em có 3 mức, tuỳ số ngày và ê-kíp. Chị dự định chụp khoảng tháng mấy để em xem lịch giúp chị ạ?",
    attachments: [], status: "sent", error: null, created_at: phutTruoc(19),
  },
  {
    id: "m3", conversation_id: "c1", direction: "in", sender: "customer", sender_id: null,
    sender_name: null, body: "Tháng 6 nha em. Cho chị xin bảng giá chi tiết luôn",
    attachments: [], status: "sent", error: null, created_at: phutTruoc(10),
  },
  {
    id: "m4", conversation_id: "c1", direction: "out", sender: "staff", sender_id: "u1",
    sender_name: "Phạm Thu Hà", body: "Dạ em Hà bên Mai Studio ạ, em gửi chị bảng giá tháng 6 ngay đây ạ.",
    attachments: [], status: "sent", error: null, created_at: phutTruoc(9),
  },
  // Tin gửi HỎNG — phải hiện viền đỏ kèm lý do, không được im lặng biến mất.
  {
    id: "m5", conversation_id: "c1", direction: "out", sender: "staff", sender_id: "u1",
    sender_name: "Phạm Thu Hà", body: "Chị cho em xin số điện thoại để em gọi tư vấn nhanh hơn nhé ạ.",
    attachments: [], status: "failed", error: "Trang chưa cấp quyền nhắn tin",
    created_at: phutTruoc(8),
  },
];

export const inboxChannels: ChannelPublic[] = [
  { id: "ch1", platform: "facebook", externalId: "10276", name: "Mai Studio - Fanpage", status: "connected", aiMode: "auto", lastError: null, connectedAt: "2026-03-01T03:00:00Z" },
  { id: "ch2", platform: "zalo_oa", externalId: "555", name: "Mai Studio OA", status: "connected", aiMode: "auto", lastError: null, connectedAt: "2026-03-01T03:00:00Z" },
  { id: "ch3", platform: "instagram", externalId: "778", name: "@maistudio.vn", status: "connected", aiMode: "off", lastError: null, connectedAt: "2026-03-02T03:00:00Z" },
  { id: "ch4", platform: "website", externalId: "o", name: "Chatbox website", status: "connected", aiMode: "auto", lastError: null, connectedAt: "2026-01-01T03:00:00Z" },
];
