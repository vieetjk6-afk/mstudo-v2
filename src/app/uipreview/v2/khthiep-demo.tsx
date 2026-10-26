"use client";

/* Phần CÓ TƯƠNG TÁC của màn xem trước nhóm "khthiep" (./khthiep.tsx là file
 * server nên không truyền được hàm, không chạy được effect). Chỉ dùng ở /uipreview.
 *
 * Trình sửa thiệp / love story tự tải dữ liệu qua /api/thiep/<token> và
 * /api/story/<token> — trang xem thử không có bản ghi đó, nên ở đây chặn đúng
 * mấy đường gọi ấy và trả dữ liệu giả (lưu thì trả "ok", không gửi đi đâu). */
import WeddingEditor from "@/app/thiep/sua/[token]/WeddingEditor";
import WeddingEditorV2, { type WeddingEditorSection, type WeddingEditorView } from "@/app/thiep/sua/[token]/WeddingEditorV2";
import StoryEditor from "@/app/story/sua/[token]/StoryEditor";
import StoryEditorV2, { type StoryEditorSection } from "@/app/story/sua/[token]/StoryEditorV2";
import type { StoryConfig, WeddingConfig, WeddingRsvp } from "@/lib/types";

const BRAND = { name: "Mây Studio", logoUrl: null };

/* ── Ảnh giả (cùng kiểu với ThiepDemo): dải màu SVG, không cần mạng ─────── */
const PHOTO = (seed: number) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${seed * 47},45%,72%)"/><stop offset="1" stop-color="hsl(${seed * 47 + 40},40%,52%)"/></linearGradient></defs><rect width="600" height="800" fill="url(#g)"/><circle cx="300" cy="330" r="120" fill="rgba(255,255,255,.35)"/><text x="300" y="720" font-family="sans-serif" font-size="44" fill="rgba(255,255,255,.85)" text-anchor="middle">ảnh ${seed}</text></svg>`,
  )}`;

/* ── Thiệp đầy đủ (dữ liệu giống ThiepDemo) ─────────────────────────────── */
const CONFIG: WeddingConfig = {
  bride_name: "Phương Nhi",
  groom_name: "Anh Tuấn",
  bride_role: "Trưởng nữ",
  groom_role: "Út nam",
  bride_subtitle: "Con Ông Đặng Văn Sơn và Bà Trịnh Thu Hà",
  groom_subtitle: "Con Ông Vũ Đình Hải và Bà Lê Thị Mai",
  bride_photo: PHOTO(3),
  groom_photo: PHOTO(4),
  bride_family: "Ông Đặng Văn Sơn\nBà Trịnh Thu Hà",
  groom_family: "Ông Vũ Đình Hải\nBà Lê Thị Mai",
  wedding_date: "2027-01-16",
  lunar_date: "Nhằm ngày 19 tháng Chạp năm Bính Ngọ",
  reception_time: "Đón khách từ 17:00",
  location: "Đà Lạt",
  cover_url: PHOTO(1),
  cover_quote: "Mười năm đi chung một con đường, hôm nay tụi mình xin phép rẽ vào cùng một nhà.",
  story: "2019 — chung một quán cà phê, khác bàn.\n2021 — chung một chuyến tàu về Đà Lạt.\n2027 — chung một cái tên trên tấm thiệp này.",
  gallery: [PHOTO(2), PHOTO(5), PHOTO(6), PHOTO(7), PHOTO(8), PHOTO(9)],
  events: [
    { label: "Lễ Vu quy", date: "2027-01-15", time: "08:00", venue: "Tư gia nhà gái", address: "42 Nguyễn Du, P.7, Đà Lạt" },
    { label: "Lễ Tân hôn", date: "2027-01-16", time: "11:00", venue: "Tư gia nhà trai", address: "9 Hồ Tùng Mậu, Đà Lạt" },
    { label: "Tiệc cưới", date: "2027-01-16", time: "17:30", venue: "Dalat Palace Heritage", address: "2 Trần Phú, Phường 3, TP. Đà Lạt" },
  ],
  timeline: [
    { time: "17:00", label: "Đón khách" },
    { time: "18:00", label: "Cử hành hôn lễ" },
    { time: "18:30", label: "Khai tiệc" },
  ],
  venue_name: "Dalat Palace Heritage",
  venue_address: "2 Trần Phú, Phường 3, TP. Đà Lạt",
  map_url: "https://www.google.com/maps?q=Dalat+Palace+Heritage",
  dress_code: ["#f3e4d7", "#c98a93", "#7f6a5b"],
  dress_code_note: "Kem · hồng sen",
  hashtag: "#NhiVeNhaTuan",
  parking_note: "Bãi B, lối vào Hồ Tùng Mậu — miễn phí",
  hotline: "0903 221 118 (chị Hạnh)",
  closing_line: "Hân hạnh được đón tiếp",
  thanks_note: "Xin chân thành cảm ơn và hẹn gặp Quý khách trong ngày trọng đại.",
  thanks_photo: PHOTO(10),
  gift_enabled: true,
  gift_note: "Sự hiện diện của bạn đã là món quà quý nhất với tụi mình.",
  bride_bank: { holder: "DANG PHUONG NHI", account: "0601160127", bin: "970403", name: "Sacombank" },
  guest_greeting: "Trân trọng kính mời",
  rsvp_enabled: true,
  guestbook_enabled: true,
  music_url: "https://youtu.be/dQw4w9WgXcQ",
  guests: [
    "Gia đình chú Ba",
    "Bạn Minh",
    "Cô giáo Thu Hằng",
    "Anh Tuấn phòng kỹ thuật",
    "Anh Nam & chị Lan",
    "Gia đình bác Hai Nguyễn Văn Thành ở Bảo Lộc cùng các con cháu",
    "Chị Ngọc Hân",
    "Bạn Khoa",
  ],
};

const RSVPS: WeddingRsvp[] = [
  { id: "r1", invitation_id: "demo", guest_name: "Gia đình chú Ba", side: "bride", attending: true, num_guests: 4, wish: "Chúc hai cháu trăm năm hạnh phúc!", created_at: "2026-10-20T03:00:00Z" },
  { id: "r2", invitation_id: "demo", guest_name: "Bạn Minh", side: "groom", attending: true, num_guests: 2, wish: "Mừng đám cưới tụi bây, sớm có tin vui nha!", created_at: "2026-10-19T03:00:00Z" },
  { id: "r3", invitation_id: "demo", guest_name: "Cô giáo Thu Hằng", side: "bride", attending: false, num_guests: 0, wish: "Cô bận công tác, chúc hai em hạnh phúc.", created_at: "2026-10-18T03:00:00Z" },
  { id: "r4", invitation_id: "demo", guest_name: "Chị Ngọc Hân", side: "both", attending: true, num_guests: 1, wish: null, created_at: "2026-10-17T03:00:00Z" },
  { id: "r5", invitation_id: "demo", guest_name: "Hoàng Long (đồng nghiệp)", side: "groom", attending: true, num_guests: 1, wish: "Chúc mừng anh Tuấn nhé!", created_at: "2026-10-16T03:00:00Z" },
];

type FakeThiep = { template: string; published: boolean; config: WeddingConfig; rsvps: WeddingRsvp[]; planner_href?: string | null };

const THIEP: Record<string, FakeThiep> = {
  "demo-v2-full": { template: "sen", published: true, config: CONFIG, rsvps: RSVPS },
  "demo-v2-new": { template: "classic", published: false, config: { bride_name: "Phương Nhi" }, rsvps: [] },
  "demo-v2-lock": { template: "do", published: true, config: { ...CONFIG, guests_password: "20122025" }, rsvps: RSVPS },
  "demo-v2-combo": { template: "trang", published: false, config: { ...CONFIG, guests: [] }, rsvps: RSVPS.slice(0, 3), planner_href: "#ke-hoach" },
};

/* ── Love Story ─────────────────────────────────────────────────────────── */
const STORY: StoryConfig = {
  groom_name: "Anh Tuấn",
  bride_name: "Phương Nhi",
  cover_url: PHOTO(11),
  tagline: "Mười năm, một con đường 💕",
  story: "Tụi mình quen nhau ở một quán cà phê nhỏ, rồi cùng nhau đi qua mười năm. Cảm ơn mọi người đã ở đây.",
  timeline: [
    { date: "2019-03-08", title: "Lần đầu gặp nhau", text: "Chung một quán cà phê, khác bàn." },
    { date: "2021-12-24", title: "Chuyến tàu về Đà Lạt", text: "Lời tỏ tình dưới trời se lạnh." },
    { date: "2026-02-14", title: "Ngày cầu hôn", text: "" },
  ],
  drive_folder: "https://drive.google.com/drive/folders/demo",
  event_label: "Lễ Thành Hôn",
  event_date: "2027-01-16",
  event_venue: "Dalat Palace Heritage",
  wishes_enabled: true,
  guest_upload: true,
  accent: "#d0687a",
};

type FakeStory = { config: StoryConfig; published: boolean; drive: boolean; uploads: { id: string; drive_file_id: string; guest_name: string; is_video: boolean; approved: boolean; created_at: string }[] };
const STORIES: Record<string, FakeStory> = {
  "demo-v2-story": {
    config: STORY,
    published: true,
    drive: true,
    uploads: [
      { id: "u1", drive_file_id: "demo-video-1", guest_name: "Bạn Minh", is_video: true, approved: false, created_at: "2026-10-20T03:00:00Z" },
      { id: "u2", drive_file_id: "demo-video-2", guest_name: "Chị Ngọc Hân", is_video: true, approved: false, created_at: "2026-10-19T03:00:00Z" },
    ],
  },
  "demo-v2-story-new": { config: {}, published: false, drive: false, uploads: [] },
};

function json(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

/** Chặn đúng các API của trình sửa thiệp / love story và trả dữ liệu giả. Cài
 *  NGAY khi dựng (trước effect của con) để lần fetch đầu đã nhận dữ liệu giả. */
function installFakeEditorApi() {
  if (typeof window === "undefined") return;
  const w = window as Window & { __fakeKhThiep?: boolean };
  if (w.__fakeKhThiep) return;
  w.__fakeKhThiep = true;
  const real = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const path = new URL(raw, location.href).pathname;
    const method = (init?.method ?? "GET").toUpperCase();
    const t = path.match(/^\/api\/thiep\/(demo-v2-[\w-]+)(\/.*)?$/);
    if (t) {
      const d = THIEP[t[1]];
      if (!d) return json({ error: "not_found" }, 404);
      const sub = t[2] ?? "";
      if (sub === "/album-photos") return json({ photos: Array.from({ length: 12 }, (_, i) => ({ id: `a${i}`, name: `IMG_${i}.jpg`, url: PHOTO(20 + i), thumb: PHOTO(20 + i) })) });
      if (sub === "/upload") return json({ url: PHOTO(40) });
      if (sub === "/map") return json({ url: "https://www.google.com/maps/@11.94,108.44,17z" });
      if (method !== "GET") return json({ ok: true });
      return json({
        invitation: { id: t[1], slug: "nhi-tuan", template: d.template, config: d.config, published: d.published },
        rsvps: d.rsvps,
        planner_href: d.planner_href ?? null,
      });
    }
    const s = path.match(/^\/api\/story\/(demo-v2-[\w-]+)(\/.*)?$/);
    if (s) {
      const d = STORIES[s[1]];
      if (!d) return json({ error: "not_found" }, 404);
      if (s[2] === "/photos") return json({ photos: Array.from({ length: 9 }, (_, i) => ({ id: `p${i}`, name: `IMG_${i}.jpg`, url: PHOTO(12 + i), thumb: PHOTO(12 + i) })) });
      if (method !== "GET") return json({ ok: true });
      return json({ story: { id: s[1], slug: "nhi-tuan", config: d.config, published: d.published }, uploads: d.uploads, drive_connected: d.drive });
    }
    return real(input, init);
  };
}

export function WeddingEditorV2Demo({
  token = "demo-v2-full", view, section, embed = false,
}: {
  token?: "demo-v2-full" | "demo-v2-new" | "demo-v2-lock" | "demo-v2-combo";
  view?: WeddingEditorView;
  section?: WeddingEditorSection | null;
  /** Nhúng trong kế hoạch cưới (chế độ Quà cưới): nút về kế hoạch, khách dùng chung. */
  embed?: boolean;
}) {
  installFakeEditorApi();
  return (
    <WeddingEditorV2
      token={token}
      brand={BRAND}
      initialView={view}
      initialSection={section}
      embed={embed ? { onBack: () => {}, onOpenGuests: () => {}, guestNames: ["Gia đình chú Ba", "Bạn Minh", "Cô giáo Thu Hằng"] } : undefined}
    />
  );
}

export function StoryEditorV2Demo({
  token = "demo-v2-story", section,
}: {
  token?: "demo-v2-story" | "demo-v2-story-new";
  section?: StoryEditorSection | null;
}) {
  installFakeEditorApi();
  return <StoryEditorV2 token={token} brand={BRAND} initialSection={section} />;
}

/** BẢN CŨ (V1) với cùng dữ liệu giả — để đối chiếu: trang thật khi giao diện mới tắt. */
export function EditorsV1Demo({ kind }: { kind: "thiep" | "story" }) {
  installFakeEditorApi();
  return kind === "thiep" ? <WeddingEditor token="demo-v2-full" /> : <StoryEditor token="demo-v2-story" />;
}
