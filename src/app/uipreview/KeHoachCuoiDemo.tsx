"use client";

import { useState } from "react";
import PlannerView, { type PlannerTab } from "@/app/portal/[token]/ke-hoach/PlannerView";
import type { PlannerPayload } from "@/app/portal/[token]/ke-hoach/types";
import WeddingEditor from "@/app/thiep/sua/[token]/WeddingEditor";
import { applyPlanOp, autoLinks, newPlan, syncInviteReplies, templateFor, type PlanOp, type WeddingPlanData } from "@/lib/wedding-plan";

/**
 * Kế hoạch cưới của khách (/portal/<token>/ke-hoach) bằng dữ liệu giả. Bấm được
 * thật: thao tác đi qua chính `applyPlanOp` như trang thật, chỉ không gửi lên
 * máy chủ.
 *
 * Dữ liệu cố ý khó: tên đôi dài, khoản tiền 9 chữ số, ngân sách bị vượt, việc
 * đã quá hạn, bàn tiệc vượt sức chứa, khách phản hồi qua thiệp nhưng không có
 * trong danh sách, lịch hẹn studio chen vào giữa lịch trình khách tự lập.
 *
 * `variant="combo"`: chế độ Quà cưới — phản hồi qua thiệp đã ghi vào danh sách
 * (đi qua chính `syncInviteReplies`), mỗi khách có link thiệp, thiệp chưa xuất bản.
 */
export function KeHoachCuoiDemo({
  tab = "overview", variant, guestView,
}: { tab?: PlannerTab; variant?: "no-date" | "locked" | "old-db" | "combo"; guestView?: "list" | "tables" }) {
  const today = "2026-10-23";
  const combo = variant === "combo";
  const [plan, setPlan] = useState<WeddingPlanData>(() => {
    const p = demoPlan(variant === "no-date");
    return combo ? syncInviteReplies(p, REPLIES, id).plan : p;
  });
  const ext = variant !== "old-db";

  const data: PlannerPayload = {
    enabled: true,
    ext,
    combo,
    contract: { title: "Phóng sự cưới + prewedding Đà Lạt", client_name: "Nguyễn Hoàng Bảo Ngọc & Trần Đình Minh Khôi", event_date: "2026-11-02", status: "approved" },
    studio_name: "Mây Studio",
    studio_phone: "0909000000",
    plan,
    updated_at: "2026-10-22T09:00:00Z",
    auto: autoLinks({
      studioName: "Mây Studio",
      signed: true,
      shot: false,
      invitation: { published: !combo, href: combo ? "#thiep" : "#" },
      album: null,
      total: 28_900_000,
      paid: 8_670_000,
    }),
    studio_line: { name: "Gói của Mây Studio", estimate: 28_900_000, paid: 8_670_000, due: "2026-11-01" },
    studio_day: variant === "no-date" ? [] : [{ id: "s1", time: "07:30", title: "Ê-kíp chụp có mặt", place: "Nhà gái", studio: true }],
    studio_appts: [
      { id: "a1", date: "2026-10-28", time: "09:00", title: "Thử váy lần 2", place: "Phòng váy Mây" },
      { id: "a2", date: "2026-11-02", time: "05:00", title: "Chụp prewedding Đà Lạt", place: "Đồi chè Cầu Đất" },
    ],
    invite: variant === "no-date" ? null : {
      href: combo ? "#thiep" : "#",
      token: "demo-qua",
      public_href: "/thiep/bao-ngoc-minh-khoi-x8k2p",
      published: !combo,
      names: combo ? [] : ["Gia đình chú Ba", "Bạn Minh", "Cô giáo Thu Hằng", "Anh Tuấn phòng kỹ thuật"],
      replies: REPLIES,
    },
    plan_locked: variant === "locked",
  };

  function onOp(op: PlanOp) {
    const r = applyPlanOp(plan, op);
    if (r.ok) setPlan(r.plan);
  }

  return (
    <PlannerView
      data={data}
      plan={plan}
      today={today}
      backHref="#"
      onOp={onOp}
      saving="saved"
      initialTab={tab}
      guestView={guestView}
      onOpenInvite={combo ? () => {} : undefined}
    />
  );
}

/**
 * Trình sửa thiệp nhúng trong kế hoạch cưới (chế độ Quà cưới). Trình sửa tự tải
 * thiệp qua /api/thiep/demo-qua — trang xem thử không có thiệp đó, nên lúc chụp
 * bố cục phải chặn đường gọi ấy và trả một thiệp giả.
 */
export function QuaCuoiThiepDemo() {
  return (
    <WeddingEditor
      token="demo-qua"
      embed={{ onBack: () => {}, onOpenGuests: () => {}, guestNames: ["Gia đình chú Ba", "Bạn Minh", "Cô giáo Thu Hằng"] }}
    />
  );
}

const REPLIES = [
  { guest_name: "Gia đình chú Ba", attending: true, num_guests: 5, created_at: "2026-10-20T10:00:00Z" },
  { guest_name: "Bạn Minh", attending: false, num_guests: 1, created_at: "2026-10-21T10:00:00Z" },
  { guest_name: "Chị Hoa (bạn cấp 3)", attending: true, num_guests: 2, created_at: "2026-10-22T10:00:00Z" },
];

let n = 0;
const id = () => `demo${++n}`;

function demoPlan(noDate: boolean): WeddingPlanData {
  const p = newPlan({ weddingDate: noDate ? null : "2027-01-16" });
  p.budget_total = 280_000_000;
  p.tasks = p.tasks.map((t, i) =>
    i < 6 ? { ...t, done: i !== 3 }
      : i === 6 ? { ...t, owner: "bride" as const, due: "2026-10-30", note: "Váy Bella — hẹn thử lần 2 ngày 28/10" }
        : i === 9 ? { ...t, owner: "groom" as const }
          : t,
  );
  p.budget = p.budget.map((b) =>
    b.cat === "party" ? { ...b, estimate: 180_000_000, actual: 195_000_000, paid: 50_000_000, payer: "groom_family" as const, due: "2026-12-20" }
      : b.cat === "outfit" ? { ...b, name: "Váy cưới cô dâu (2 bộ) + áo dài lễ gia tiên + vest chú rể may đo", estimate: 32_500_000, paid: 10_000_000, payer: "bride" as const, due: "2026-10-20" }
        : b.cat === "ring" ? { ...b, estimate: 41_000_000, actual: 41_000_000, paid: 41_000_000, payer: "groom" as const }
          : b,
  );
  if (noDate) return p;
  p.day = [
    { id: "d1", time: "05:00", title: "Trang điểm, làm tóc cô dâu", place: "Nhà gái — 12 Nguyễn Trãi, P. Bến Thành, Q.1", who: "Chị Mai makeup", side: "bride" },
    { id: "d6", time: "06:30", title: "Chú rể sửa soạn, đội bê tráp tập trung", side: "groom" },
    { id: "d2", time: "08:30", title: "Nhà trai đến — lễ gia tiên nhà gái (lễ vu quy)", place: "Nhà gái" },
    { id: "d3", time: "10:00", title: "Rước dâu về nhà trai", who: "Anh Tuấn lo xe" },
    { id: "d4", time: "", title: "Chụp ảnh với họ hàng nhà trai (chờ chốt giờ)" },
    { id: "d5", time: "18:00", title: "Đón khách, chụp ảnh với khách mời", place: "Trung tâm tiệc cưới Riverside Palace" },
  ];
  const G = (name: string, group: WeddingPlanData["guests"][number]["group"], extra: Partial<WeddingPlanData["guests"][number]> = {}) =>
    ({ id: id(), name, group, count: 1, invited: false, rsvp: "pending" as const, gift: 0, thanked: false, ...extra });
  p.guests = [
    G("Gia đình chú Ba", "groom_family", { count: 4, table: "1", invited: true }),
    G("Bạn Minh", "groom_friends", { invited: true, table: "5" }),
    G("Cô giáo Thu Hằng", "bride_family", { invited: true, rsvp: "yes", table: "2", gift: 1_000_000, thanked: true }),
    G("Ông bà ngoại", "bride_family", { count: 2, rsvp: "yes", table: "VIP" }),
    G("Anh Tuấn phòng kỹ thuật — Công ty TNHH Giải pháp Phần mềm Sao Việt", "colleagues", { count: 2, table: "1" }),
    G("Nhóm bạn đại học Bách Khoa K62", "common", { count: 6, table: "1", rsvp: "yes" }),
    G("Chị Lan hàng xóm", "other", { note: "Ăn chay" }),
    G("Gia đình bác Hai", "groom_family", { count: 5, rsvp: "no", invited: true }),
  ];
  p.vendors = [
    { id: id(), cat: "venue", name: "Riverside Palace", phone: "0909123456", link: "https://riversidepalace.vn/", quote: 150_000_000, status: "booked" },
    { id: id(), cat: "venue", name: "White Palace Phạm Văn Đồng", quote: 185_000_000, status: "consider", note: "Sảnh 40 bàn, có bãi xe" },
    { id: id(), cat: "decor", name: "Hoa Ngọc Lan", quote: 18_000_000, status: "consider" },
    { id: id(), cat: "decor", name: "Bloom Wedding Decor", quote: 25_000_000, status: "consider", link: "https://facebook.com/bloomdecor" },
    { id: id(), cat: "music", name: "MC Hoàng Anh", phone: "0912000111", quote: 6_000_000, status: "booked" },
  ];
  p.people = [
    { id: id(), name: "Trần Thu Hà", role: "Phù dâu", phone: "0987654321", side: "bride" },
    { id: id(), name: "Lê Minh Quân", role: "Phù rể", side: "groom" },
    { id: id(), name: "Cô Út", role: "Giữ phong bì", phone: "0903000222" },
  ];
  p.packing = (templateFor("packing", id) as WeddingPlanData["packing"]).map((x, i) => ({ ...x, packed: i < 5 }));
  p.shots = templateFor("shots", id) as WeddingPlanData["shots"];
  p.style = {
    colors: ["#862828", "#e8c6c2", "#f6e9e4", "#a59d7a", "#c7b6a6"],
    concept: "Tiệc ngoài trời tông đỏ rượu vang, hoa hồng kem, cổng hoa vòm, váy đuôi cá.",
    links: ["https://pinterest.com/ngockhoi/wedding-inspo/"],
  };
  p.settings = { table_size: 10, guests_expected: 0 };
  return p;
}
