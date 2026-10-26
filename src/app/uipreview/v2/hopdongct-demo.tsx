"use client";

/* Phần CÓ TƯƠNG TÁC của màn xem trước nhóm "hopdongct" (./hopdongct.tsx là file
 * server nên không truyền được hàm, không cài được fetch giả). Chỉ dùng ở
 * /uipreview.
 *
 * Các thẻ con của màn hợp đồng TỰ nạp dữ liệu (album của hợp đồng, voucher ưu
 * đãi, phụ lục, kế hoạch cưới, thiệp, Love Story, thuê đồ, hộp thoại huỷ / dời
 * lịch…). Không có dữ liệu giả thì màn xem trước chỉ hiện "unauthorized" hoặc
 * trống trơn — lỗi bố cục của chúng không ai thấy. FakeContractApi chặn đúng
 * các API / bảng Supabase đó và trả dữ liệu giả; mọi request khác đi tiếp. */
import { RescheduleDialogV2, CancelDialogV2 } from "@/app/dashboard/studio/contracts/[id]/ContractChangeDialogsV2";
import * as f from "../fixtures";

export type FakeVariant = {
  /** Chế độ album của hợp đồng. */
  albumMode?: "desktop" | "manual";
  /** Voucher ưu đãi đã phát (thẻ có QR) hay còn chờ đủ điều kiện. */
  voucherIssued?: boolean;
};

type Json = Record<string, unknown> | unknown[];

const D = f.contractFull.event_date ?? "2026-09-12";

function json(body: Json, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

const readiness = { driveConfigured: true, driveConnected: true, rootFolderReady: true, desktopConnected: true, planAllowsDesktop: true, ready: true };

function albumSnapshot(v: FakeVariant) {
  if (v.albumMode === "manual")
    return {
      mode: "manual",
      migrated: true,
      status: "completed",
      readiness,
      selectionAlbumId: null,
      galleryAlbumId: null,
      album: {
        id: "al-demo",
        title: "Cưới Lan Phương & Minh Quân — Đà Lạt",
        slug: "cuoi-lan-phuong",
        status: "published",
        phase: "selection",
        photoCount: 486,
        deliveryPhotos: 120,
        sources: [
          { id: "s1", name: "Ảnh chọn — Lễ gia tiên nhà gái", url: "https://drive.google.com/drive/folders/demo1", stage: "selection" },
          { id: "s2", name: "Ảnh chọn — Tiệc tối Riverside", url: "https://drive.google.com/drive/folders/demo2", stage: "selection" },
          { id: "s3", name: "Ảnh hoàn thiện đợt 1", url: "https://drive.google.com/drive/folders/demo3", stage: "delivery" },
        ],
      },
    };
  return { mode: "desktop", migrated: true, status: "in_progress", readiness, selectionAlbumId: null, galleryAlbumId: null, album: null };
}

const loyaltyVoucher = {
  id: "vu1",
  code: "UD-7K3M9P",
  title: "Voucher ưu đãi lần sau",
  amount: 0,
  price: 0,
  buyer_name: null,
  buyer_phone: "0912345678",
  recipient_name: "Nguyễn Thị Lan Phương",
  paid: true,
  paid_method: null,
  paid_at: D,
  expires_on: "2027-09-12",
  status: "active",
  redeemed_contract_id: null,
  redeemed_at: null,
  note: null,
  created_at: `${D}T10:00:00Z`,
  kind: "loyalty",
  discount_type: "percent",
  percent: 5,
  max_discount: 2_000_000,
  source_contract_id: "c1",
  public_token: "demo-token-1234567890",
  applies_packages: null,
};

function loyalty(v: FakeVariant) {
  return {
    stage: v.voucherIssued ? "issued" : "pending",
    percent: 5,
    tiers: [
      { min: 0, percent: 5 },
      { min: 80_000_000, percent: 7 },
    ],
    total: 64_000_000,
    next: v.voucherIssued ? null : { min: 80_000_000, percent: 7, max: 3_000_000 },
    progMax: 2_000_000,
    max: 2_000_000,
    missing: v.voucherIssued ? [] : ["Studio ký xác nhận hợp đồng"],
    voucher: v.voucherIssued ? loyaltyVoucher : null,
  };
}

const weddingPlan = {
  wedding_date: "2026-12-20",
  budget_total: 0,
  tasks: [
    { id: "t1", title: "Chọn studio", when: "m12", done: true },
    { id: "t2", title: "Đặt nhà hàng", when: "m6", done: true },
    { id: "t3", title: "May áo dài", when: "m3", done: false },
    { id: "t4", title: "In thiệp", when: "w4", done: false },
  ],
  budget: [],
  day_plan: [
    { id: "d1", time: "06:00", title: "Cô dâu trang điểm", place: "Nhà gái — 12 Lê Lợi, Đà Lạt", who: "Makeup Thảo", side: "bride" },
    { id: "d2", time: "08:30", title: "Nhà trai xuất phát rước dâu", place: "Khách sạn Dalat Palace", side: "groom" },
    { id: "d3", time: "09:30", title: "Lễ gia tiên nhà gái", place: "Nhà gái — 12 Lê Lợi, Đà Lạt", who: "Cả hai họ" },
    { id: "d4", time: "18:00", title: "Đón khách & tiệc cưới", place: "Nhà hàng Riverside" },
  ],
  extra: {
    guests: [],
    vendors: [
      { id: "v1", cat: "party", name: "Nhà hàng Riverside", phone: "02633888999", quote: 0, status: "booked" },
      { id: "v2", cat: "makeup", name: "Makeup Thảo Nguyễn", phone: "0909111222", quote: 0, status: "booked" },
    ],
    people: [
      { id: "p1", name: "Trần Thu Hà", role: "Phù dâu", phone: "0911222333", side: "bride" },
      { id: "p2", name: "Lê Văn Nam", role: "Bê tráp, giữ phong bì", phone: "0988777666", side: "groom" },
    ],
    packing: [],
    shots: [
      { id: "s1", title: "Ảnh cô dâu với bà ngoại", must: true },
      { id: "s2", title: "Ảnh hai họ đầy đủ trước bàn thờ", must: true },
      { id: "s3", title: "Ảnh bạn thân thời cấp 3", must: false },
    ],
    style: { colors: ["#e9d5c3", "#8a9a5b", "#f4f1ea"], concept: "Rustic tối giản, hoa cúc hoạ mi và lá bạc.", links: [] },
    settings: { table_size: 10, guests_expected: 250 },
  },
  updated_at: `${D}T15:20:00Z`,
};

function rest(table: string, method: string, accept: string | null, body: unknown): Promise<Response> | null {
  const one = !!accept && accept.includes("vnd.pgrst.object");
  switch (table) {
    case "story_pages":
      return method === "GET" ? json([{ slug: "lan-phuong-minh-quan-x7k2p", edit_token: "demoedit", published: true }]) : null;
    case "wedding_invitations":
      return method === "GET" ? json([]) : null;
    case "wedding_plans":
      return method === "GET" ? json([weddingPlan]) : null;
    case "studio_vouchers":
      return method === "GET" ? json([]) : null;
    case "rental_orders":
      return method === "GET" ? json([...f.rentalDons] as unknown[]) : null;
    case "rental_items":
      return method === "GET" ? json([...f.rentalKho] as unknown[]) : null;
    case "studio_appointments":
      if (method === "POST") {
        const row = Array.isArray(body) ? body[0] : body;
        const out = { id: `ap${Date.now()}`, status: "scheduled", end_time: null, duration_min: null, location: null, staff_id: null, checked_in_at: null, done_at: null, note: null, client_visible: true, created_at: new Date().toISOString(), ...(row as object) };
        return json(one ? out : [out], 201);
      }
      return method === "DELETE" ? Promise.resolve(new Response(null, { status: 204 })) : null;
    default:
      return null;
  }
}

function route(url: string, method: string, init: RequestInit | undefined, v: FakeVariant): Promise<Response> | null {
  let body: unknown = null;
  try {
    body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
  } catch {
    body = null;
  }
  const m = url.match(/\/rest\/v1\/([a-z_]+)/);
  if (m) return rest(m[1], method, new Headers(init?.headers).get("Accept"), body);
  if (url.includes("/api/studio/contract-album")) return json(albumSnapshot(v));
  if (url.includes("/api/studio/vouchers")) {
    const action = (body as { action?: string } | null)?.action;
    if (action === "check")
      return json({ ok: true, voucher: { ...loyaltyVoucher, id: "g1", code: "QUA-7K3M9P", title: "Thẻ quà tặng 2.000.000đ", kind: "gift", discount_type: "amount", amount: 2_000_000 } });
    if (action === "redeem") return json({ error: "preview" }, 400);
    return json({ loyalty: loyalty(v) });
  }
  if (/\/api\/studio\/contracts\/[^/]+\/reschedule/.test(url) && method === "GET")
    return json({
      crewBusy: [{ name: "Trần Minh Quân", what: "Chụp cưới Hà & Tuấn · 07:00" }],
      sameDay: [{ id: "c9", title: "Chụp gia đình", client_name: "Phạm Gia Bảo" }],
    });
  if (/\/api\/studio\/contracts\/[^/]+\/cancel/.test(url) && method === "GET")
    return json({
      collected: 15_000_000,
      policy: { earlyDays: 30, earlyPct: 50, latePct: 0 },
      quote: { daysBefore: 47, pct: 50, refund: 7_500_000 },
    });
  return null;
}

/** Cài fetch giả NGAY khi dựng (trước effect của con) để lần gọi đầu đã nhận dữ liệu giả. */
function install(v: FakeVariant) {
  if (typeof window === "undefined") return;
  const w = window as Window & { __hdctFake?: FakeVariant; __hdctReal?: typeof fetch };
  w.__hdctFake = v;
  if (w.__hdctReal) return;
  const real = window.fetch.bind(window);
  w.__hdctReal = real;
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    return route(url, method, init, w.__hdctFake ?? {}) ?? real(input, init);
  };
}

/** Bọc NGOÀI khung studio để mọi client Supabase tạo sau đó đều đi qua fetch giả. */
export function FakeContractApi({ variant = {}, children }: { variant?: FakeVariant; children: React.ReactNode }) {
  install(variant);
  return <>{children}</>;
}

/** Hộp thoại Dời lịch (giao diện mới) mở sẵn. */
export function RescheduleDemo() {
  install({});
  return (
    <RescheduleDialogV2
      contractId="c1"
      eventDate={f.contractFull.event_date}
      eventTime={f.contractFull.event_time}
      clientName={f.contractFull.client_name}
      clientPhone={f.contractFull.client_phone}
      onClose={() => {}}
      onDone={() => {}}
    />
  );
}

/** Hộp thoại Huỷ hợp đồng (giao diện mới) mở sẵn. */
export function CancelDemo() {
  install({});
  return (
    <CancelDialogV2
      contractId="c1"
      clientName={f.contractFull.client_name}
      clientPhone={f.contractFull.client_phone}
      onClose={() => {}}
      onDone={() => {}}
    />
  );
}
