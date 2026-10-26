"use client";

import { useState } from "react";
import { PortalAppV2 } from "@/app/portal/[token]/ContractPortalViewV2";
import { PortalGateV2 } from "@/app/portal/[token]/PortalShellV2";
import type { PortalPayload } from "@/app/portal/[token]/types";
import type { GridPhoto } from "@/app/portal/[token]/PortalPhotoGrid";
import PlannerViewV2 from "@/app/portal/[token]/ke-hoach/PlannerViewV2";
import type { PlannerTab } from "@/app/portal/[token]/ke-hoach/ui";
import type { PlannerPayload } from "@/app/portal/[token]/ke-hoach/types";
import BookingFormV2 from "@/app/book/[token]/BookingFormV2";
import { parseFinalVideos } from "@/lib/final-links";
import { useTheme } from "@/lib/theme";
import { applyPlanOp, autoLinks, newPlan, syncInviteReplies, templateFor, type PlanOp, type WeddingPlanData } from "@/lib/wedding-plan";
import { bank as fBank } from "../fixtures";

/* ═══════════════════════════════════════════════════════════════════════════
   Dữ liệu giả cho màn xem trước giao diện mới của nhóm "khcong" — cổng khách
   (/portal), kế hoạch cưới (/portal/…/ke-hoach) và đặt lịch (/book). Ảnh là SVG
   giữ chỗ (data URI) để màn chụp không phụ thuộc Drive. Thao tác kế hoạch cưới
   đi qua chính `applyPlanOp` như trang thật, chỉ không gửi lên máy chủ.
   ═══════════════════════════════════════════════════════════════════════════ */

const BRAND = { name: "Mây Studio", logoUrl: null };
const TINTS: [string, string][] = [
  ["#d9b8a0", "#8c6b5d"], ["#a9bccf", "#4f6479"], ["#cfa9b6", "#7d5464"], ["#b9cdb2", "#5c7556"],
  ["#e2c99a", "#9c7a45"], ["#bdb2d6", "#625a86"], ["#e6c3b3", "#a2675a"], ["#b4c9c9", "#4c6c6c"],
];

/** Ảnh giữ chỗ: dải màu ấm + vài khối mờ, đủ để nhìn bố cục lưới. */
function ph(i: number, w = 400, h = 500): string {
  const [a, b] = TINTS[i % TINTS.length];
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>` +
    `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${a}'/><stop offset='1' stop-color='${b}'/></linearGradient></defs>` +
    `<rect width='100%' height='100%' fill='url(#g)'/>` +
    `<circle cx='${w * (0.3 + (i % 3) * 0.2)}' cy='${h * 0.38}' r='${Math.min(w, h) * 0.16}' fill='rgba(255,255,255,.28)'/>` +
    `<rect x='${w * 0.18}' y='${h * 0.62}' width='${w * 0.64}' height='${h * 0.26}' rx='${w * 0.08}' fill='rgba(255,255,255,.18)'/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
const imgSrc = (p: GridPhoto) => ph(Number(p.id.replace(/\D/g, "")) || 0);

/* ── Cổng khách ─────────────────────────────────────────────────────────── */
function portalData(variant: "active" | "unsigned" | "completed" | "video"): PortalPayload {
  const completed = variant === "completed" || variant === "video";
  const unsigned = variant === "unsigned";
  const photos = Array.from({ length: 40 }, (_, i) => ({ id: `p${i}`, drive_file_id: `demo-photo-${i}`, name: `MAY_${1000 + i}.jpg`, is_video: false }));
  return {
    contract: {
      code: "HD-0921",
      title: "Phóng sự cưới + prewedding Đà Lạt",
      client_name: "Nguyễn Hoàng Bảo Ngọc & Trần Đình Minh Khôi",
      client_phone: "0900000000",
      shoot_type: "wedding",
      event_date: "2026-11-14",
      event_time: "07:30",
      location: "Trung tâm tiệc cưới Riverside Palace, Q.4, TP.HCM",
      status: completed ? "completed" : unsigned ? "sent" : "in_progress",
      note: null,
      client_signed_at: unsigned ? null : "2026-06-01T09:00:00Z",
      client_signed_name: unsigned ? null : "Nguyễn Hoàng Bảo Ngọc",
      brief_submitted_at: null,
      updated_at: "2026-10-01T09:00:00Z",
    },
    studio_name: "Mây Studio",
    studio_logo: null,
    studio_phone: "0909000000",
    bank: fBank,
    items: [
      { id: "i1", name: "Gói phóng sự cưới Vàng", qty: 1, unit_price: 18_900_000 },
      { id: "i2", name: "Prewedding Đà Lạt (2 bộ trang phục)", qty: 1, unit_price: 10_000_000 },
    ],
    payments: completed
      ? [{ id: "pay1", amount: 8_670_000, kind: "deposit", paid_at: "2026-06-01" }, { id: "pay2", amount: 20_230_000, kind: "final", paid_at: "2026-11-20" }]
      : unsigned ? [] : [{ id: "pay1", amount: 8_670_000, kind: "deposit", paid_at: "2026-06-01" }],
    plan: completed
      ? []
      : [
          { id: "pl1", label: "Đặt cọc 30%", amount: 8_670_000, due_date: "2026-06-01", paid: !unsigned, paid_at: unsigned ? null : "2026-06-01" },
          { id: "pl2", label: "Đợt 2 — trước ngày chụp", amount: 11_560_000, due_date: "2026-11-01", paid: false, paid_at: null },
          { id: "pl3", label: "Tất toán khi nhận album", amount: 8_670_000, due_date: "2026-12-20", paid: false, paid_at: null },
        ],
    products: [
      { id: "pr1", name: "Album cưới 30×30 (40 trang)", qty: 1, cost: 0, status: completed ? "done" : "in_progress" },
      { id: "pr2", name: "Ảnh phóng 60×90 khung gỗ", qty: 2, cost: 0, status: completed ? "done" : "ordered" },
      { id: "pr3", name: "Video highlight 3 phút", qty: 1, cost: 0, status: completed ? "done" : "ordered" },
    ],
    milestones: [{ id: "m1", title: "Nhận album và ảnh phóng", event_date: "2026-12-20", event_time: null, note: null }],
    tasks: [],
    appointments: [
      { id: "a1", kind: "fitting", title: "Thử váy lần 1", appt_date: "2026-10-10", start_time: "09:00", end_time: "10:30", duration_min: 90, location: null, room: "Phòng váy Mây", crew_name: null, status: "done", note: null },
      { id: "a2", kind: "pre", title: "Chụp prewedding Đà Lạt", appt_date: "2026-10-31", start_time: "05:00", end_time: "11:00", duration_min: 360, location: "Đồi chè Cầu Đất, Đà Lạt", room: null, crew_name: null, status: "scheduled", note: "Có mặt lúc 4:45 để trang điểm — mang theo giày cao gót trắng." },
      { id: "a3", kind: "makeup", title: "Trang điểm cô dâu ngày cưới", appt_date: "2026-11-14", start_time: "05:30", end_time: "07:30", duration_min: 120, location: "Nhà gái — 12 Nguyễn Trãi, Q.1", room: null, crew_name: null, status: "scheduled", note: null },
      { id: "a4", kind: "shoot", title: "Phóng sự lễ gia tiên + tiệc tối", appt_date: "2026-11-14", start_time: "07:30", end_time: "21:00", duration_min: 810, location: "Riverside Palace", room: null, crew_name: null, status: "scheduled", note: null },
    ],
    album: completed
      ? {
          slug: "demo",
          title: "Bảo Ngọc & Minh Khôi",
          cover_url: ph(3, 1600, 900),
          download_enabled: true,
          watermark: null,
          photos: variant === "video" ? [...photos.slice(0, 4), { id: "v1", drive_file_id: "demo-video-1", name: "Highlight le gia tien.mp4", is_video: true }] : photos,
        }
      : null,
    final_links: completed
      ? {
          album_url: null,
          originals_url: "https://drive.google.com/drive/folders/demo-originals",
          videos: parseFinalVideos("Phim cưới (bản đầy đủ) | https://youtu.be/dQw4w9WgXcQ\nTeaser 60 giây | https://vimeo.com/76979871").map((v, i) => ({ ...v, poster: ph(i + 4, 1280, 720) })),
        }
      : null,
    gallery: completed ? { slug: "demo", title: "Bảo Ngọc & Minh Khôi" } : null,
    selection: !completed && !unsigned ? { slug: "demo", title: "Chọn ảnh prewedding", phase: "selection" } : null,
    wedding: { slug: "bao-ngoc-minh-khoi", edit_token: "x", published: true },
    story: null,
    planner: unsigned ? null : { wedding_date: "2027-01-16", done: 6, total: 31 },
  };
}

export function PortalV2Demo({
  variant = "active", tab, albumTab,
}: { variant?: "active" | "unsigned" | "completed" | "video"; tab?: "home" | "pay" | "media"; albumTab?: "photos" | "videos" | "files" }) {
  return <PortalAppV2 token="demo" phone="0900000000" data={portalData(variant)} staleAt={null} brand={BRAND} initialTab={tab} albumTab={albumTab} imgSrc={imgSrc} />;
}

export function PortalGateV2Demo({ error }: { error?: boolean }) {
  const { theme } = useTheme();
  const [phone, setPhone] = useState(error ? "0901234567" : "");
  return (
    <PortalGateV2
      brand={BRAND}
      theme={theme}
      title="Trang hợp đồng của bạn"
      desc="Nhập số điện thoại đã đăng ký để xem lịch trình, thanh toán và sản phẩm."
      phone={phone}
      setPhone={setPhone}
      err={error ? "Số điện thoại không khớp. Vui lòng kiểm tra lại." : null}
      loading={false}
      onSubmit={(e) => e.preventDefault()}
      submitLabel="Mở trang của tôi"
      note="Máy này sẽ nhớ số của bạn trong 90 ngày để lần sau mở thẳng vào trang."
    />
  );
}

/* ── Kế hoạch cưới (cùng dữ liệu khó với KeHoachCuoiDemo của bản cũ) ───── */
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

export function PlannerV2Demo({
  tab = "overview", variant, guestView,
}: { tab?: PlannerTab; variant?: "no-date" | "locked" | "old-db" | "combo"; guestView?: "list" | "tables" }) {
  const today = "2026-10-23";
  const combo = variant === "combo";
  const [plan, setPlan] = useState<WeddingPlanData>(() => {
    const p = demoPlan(variant === "no-date");
    return combo ? syncInviteReplies(p, REPLIES, id).plan : p;
  });
  const data: PlannerPayload = {
    enabled: true,
    ext: variant !== "old-db",
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
    <PlannerViewV2
      data={data}
      plan={plan}
      today={today}
      backHref="#"
      onOp={onOp}
      saving="saved"
      initialTab={tab}
      guestView={guestView}
      onOpenInvite={combo ? () => {} : undefined}
      brand={BRAND}
    />
  );
}

/* ── Đặt lịch ───────────────────────────────────────────────────────────── */
export function BookingV2Demo({
  step, voucher = "ok", sent,
}: { step?: number; voucher?: "ok" | "bad" | "none"; sent?: "deposit" | "done" }) {
  return (
    <BookingFormV2
      token="demo"
      studioName="Mây Studio"
      brand={BRAND}
      packages={[
        { name: "Chụp cưới · Gói Vàng (2 ekip, album 30×30)", price: 15_000_000 },
        { name: "Chụp cưới · Gói Bạc", price: 9_000_000 },
        { name: "Prewedding · Đà Lạt 1 ngày", price: 12_500_000 },
      ]}
      presetPackage="Chụp cưới · Gói Vàng (2 ekip, album 30×30)"
      referralDiscount={500_000}
      bank={fBank}
      voucher={
        voucher === "none" ? null
          : voucher === "bad" ? { code: "UD-XXXXXX", label: "", ok: false, message: "Voucher đã hết hạn." }
            : { code: "UD-7K3M9P", label: "Giảm 1.000.000đ", ok: true, needsPhone: true, terms: ["Áp dụng cho: Phóng sự x2, Gói combo.", "Không có giá trị quy đổi thành tiền mặt."] }
      }
      preview={{ step, sent: sent === "deposit" ? { amount: 2_000_000, code: "DL 7K3M9P", token: "demo" } : sent === "done" ? true : undefined }}
    />
  );
}
