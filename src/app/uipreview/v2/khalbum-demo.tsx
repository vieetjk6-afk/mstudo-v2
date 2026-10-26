"use client";

/* Dữ liệu giả + lớp bọc cho các màn xem trước nhóm "khalbum" (album của khách,
 * giao diện mới). Tách khỏi ./khalbum.tsx vì ảnh giả cần hàm dựng địa chỉ ảnh
 * (AlbumImgProvider) — hàm không đi qua được ranh giới server → client.
 * Ảnh là SVG sinh tại chỗ: máy dev không có Drive, không có mạng. */

import { useMemo, useState } from "react";
import CustomerAlbumV2 from "@/app/a/[slug]/CustomerAlbumV2";
import GalleryViewV2 from "@/app/album/[slug]/GalleryViewV2";
import AlbumBrowseV2 from "@/app/album/AlbumBrowseV2";
import type { GalleryViewProps } from "@/app/album/[slug]/useGalleryView";
import type { GalleryCard } from "@/app/album/useAlbumBrowse";
import type { Feedback } from "@/lib/types";
import FaceFinderV2 from "@/app/a/[slug]/FaceFinderV2";
import DuplicatesV2 from "@/app/a/[slug]/DuplicatesV2";
import { AlbumImgProvider, type AlbumImg } from "@/app/a/[slug]/album-v2-ui";
import { useFaceSearch } from "@/app/a/[slug]/useFaceSearch";
import type { DuplicateScan } from "@/app/a/[slug]/useDuplicateScan";
import type { CustomerAlbumProps, PublicPhoto } from "@/app/a/[slug]/useCustomerAlbum";
import type { PersonChip } from "@/lib/face-people";
import type { DuplicateGroup } from "@/lib/photo-ai";

/* ── Ảnh giả ─────────────────────────────────────────────────────────────── */
const PALETTES: [string, string, string][] = [
  ["#f6d365", "#fda085", "#b4553c"],
  ["#a1c4fd", "#c2e9fb", "#41658a"],
  ["#d4fc79", "#96e6a1", "#3c7a4a"],
  ["#fbc2eb", "#a6c1ee", "#6b5b95"],
  ["#ffecd2", "#fcb69f", "#a0563c"],
  ["#89f7fe", "#66a6ff", "#24477a"],
  ["#e0c3fc", "#8ec5fc", "#4c5aa0"],
  ["#fdfbfb", "#ebedee", "#7d8a96"],
  ["#f093fb", "#f5576c", "#7a2340"],
  ["#c1dfc4", "#deecdd", "#4e7a5a"],
];
const SIZES: [number, number][] = [
  [600, 400],
  [400, 600],
  [500, 500],
  [400, 600],
  [600, 400],
  [600, 450],
  [400, 560],
];

function svgUri(seed: number, w: number, h: number) {
  const [a, b, c] = PALETTES[seed % PALETTES.length];
  const sx = 20 + ((seed * 37) % 60);
  const sy = 18 + ((seed * 23) % 30);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 100 ${Math.round((h / w) * 100)}" preserveAspectRatio="none">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>` +
    `<rect width="100%" height="100%" fill="url(#g)"/>` +
    `<circle cx="${sx}" cy="${sy}" r="9" fill="#fff" opacity=".55"/>` +
    `<path d="M0 ${Math.round((h / w) * 100 * 0.72)} Q 30 ${Math.round((h / w) * 100 * 0.55)} 55 ${Math.round((h / w) * 100 * 0.7)} T 100 ${Math.round((h / w) * 100 * 0.62)} V 200 H 0 Z" fill="${c}" opacity=".55"/>` +
    `<path d="M0 ${Math.round((h / w) * 100 * 0.85)} Q 40 ${Math.round((h / w) * 100 * 0.74)} 100 ${Math.round((h / w) * 100 * 0.86)} V 200 H 0 Z" fill="${c}" opacity=".8"/>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const cache = new Map<string, string>();
function fakeSrc(driveId: string) {
  let s = cache.get(driveId);
  if (!s) {
    const seed = Number(driveId.replace(/\D/g, "")) || driveId.length;
    const [w, h] = driveId.startsWith("cover") ? [1600, 1000] : SIZES[seed % SIZES.length];
    s = svgUri(seed, w, h);
    cache.set(driveId, s);
  }
  return s;
}
export const DEMO_IMG: AlbumImg = { thumb: (id) => fakeSrc(id), full: (id) => fakeSrc(id), original: (id) => fakeSrc(id) };
export const DEMO_COVER = fakeSrc("cover4");

/* ── Album chọn ảnh ──────────────────────────────────────────────────────── */
const photo = (i: number, source: string | null): PublicPhoto => ({
  id: `p${i}`,
  drive_file_id: `d${i}`,
  name: `DSC_${String(4470 + i).padStart(4, "0")}.JPG`,
  source_id: source,
  position: i,
});
const PHOTOS: PublicPhoto[] = [
  ...Array.from({ length: 16 }, (_, i) => photo(i, "s1")),
  ...Array.from({ length: 24 }, (_, i) => photo(i + 16, "s2")),
];
const SOURCES = [
  { id: "s1", name: "Lễ gia tiên", position: 0 },
  { id: "s2", name: "Tiệc cưới", position: 1 },
];
export const PEOPLE: PersonChip[] = [
  { id: "P1", name: "Cô dâu", coverPhotoId: "p1", coverBox: [0.3, 0.2, 0.35, 0.4], faceCount: 22, photoIds: ["p1", "p2", "p3", "p5", "p8", "p12", "p20"] },
  { id: "P2", name: "Chú rể", coverPhotoId: "p4", coverBox: [0.45, 0.25, 0.3, 0.35], faceCount: 18, photoIds: ["p3", "p4", "p8", "p21"] },
  { id: "P3", name: "Mẹ cô dâu", coverPhotoId: "p9", coverBox: [0.2, 0.3, 0.3, 0.3], faceCount: 6, photoIds: ["p9", "p10"] },
  { id: "P4", name: "", coverPhotoId: "p14", coverBox: [0.5, 0.1, 0.3, 0.35], faceCount: 4, photoIds: ["p14", "p15"] },
  { id: "P5", name: "Phù dâu", coverPhotoId: "p18", coverBox: null, faceCount: 3, photoIds: ["p18"] },
];

const BASE: CustomerAlbumProps = {
  album: {
    id: "al-demo",
    slug: "xem-truoc-v2",
    title: "Lan & Minh · Tiệc cưới Riverside",
    description: "Ảnh cưới ngày 12/10 tại Riverside Palace. Chọn những tấm bạn thích nhất để studio chỉnh sửa.",
    cover_url: DEMO_COVER,
    selection_limit: 30,
    watermark_enabled: false,
    watermark_text: null,
    hasPassword: false,
    allowDownload: true,
    allowDrive: true,
    allowNotes: true,
  },
  initialPhotos: PHOTOS,
  initialSources: SOURCES,
  initialSelected: ["p1", "p3", "p4", "p8", "p12", "p17", "p21"],
  initialDisliked: ["p6", "p19"],
  initialNotes: { p3: "Làm sáng da và xoá người phía sau giúp mình", p6: "Mắt nhắm" },
  initialDriveFolders: [{ name: "Ảnh gốc", url: "https://drive.google.com/drive/folders/demo" }],
  initialPeople: PEOPLE,
  studioName: "Mây Studio",
  logoUrl: null,
};

export type ChonVariant = "day" | "moi" | "khoa" | "rong" | "chiase" | "wm";

function chonProps(v: ChonVariant): CustomerAlbumProps {
  switch (v) {
    case "moi":
      return {
        ...BASE,
        album: { ...BASE.album, slug: "xem-truoc-v2-moi", cover_url: null, selection_limit: null, description: null },
        initialSources: [SOURCES[1]],
        initialPhotos: PHOTOS.map((p) => ({ ...p, source_id: "s2" })),
        initialSelected: [],
        initialDisliked: [],
        initialNotes: {},
        initialPeople: [],
        faceScan: { daQuet: 120, tong: 300 },
      };
    case "khoa":
      return { ...BASE, album: { ...BASE.album, slug: "xem-truoc-v2-khoa", hasPassword: true }, initialPhotos: null, initialSources: null };
    case "rong":
      return {
        ...BASE,
        album: { ...BASE.album, slug: "xem-truoc-v2-rong", cover_url: null },
        initialPhotos: [],
        initialSources: [],
        initialSelected: [],
        initialDisliked: [],
        initialPeople: [],
      };
    case "chiase":
      return { ...BASE, album: { ...BASE.album, slug: "xem-truoc-v2-chiase" }, shareIds: ["p1", "p3", "p4", "p8", "p12", "p17", "p21"] };
    case "wm":
      return { ...BASE, album: { ...BASE.album, slug: "xem-truoc-v2-wm", watermark_enabled: true, watermark_text: "Mây Studio", cover_url: null } };
    default:
      return BASE;
  }
}

/* ── Máy chủ giả cho các slug "xem-truoc-v2…" ───────────────────────────────
 * Trang thật đọc lại lựa chọn từ máy chủ ngay khi mở (máy chủ là nguồn sự thật),
 * nên với slug giả, route thật trả về danh sách rỗng và xoá sạch dữ liệu mẫu.
 * Ở đây chặn đúng các route của slug giả và trả lời từ bộ nhớ — bấm chọn, ghi
 * chú, "Đã chọn xong", chia sẻ… đều chạy như thật. Mọi đường khác đi qua fetch thật. */
type Picks = { selected: string[]; disliked: string[]; notes: Record<string, string> };
const demoPicks = new Map<string, Picks>();
function picksFor(slug: string): Picks {
  let p = demoPicks.get(slug);
  if (!p) {
    const v = (slug.replace(/^xem-truoc-v2-?/, "") || "day") as ChonVariant;
    const src = chonProps(v);
    p = { selected: src.initialSelected ?? [], disliked: src.initialDisliked ?? [], notes: src.initialNotes ?? {} };
    demoPicks.set(slug, p);
  }
  return p;
}
if (typeof window !== "undefined" && !(window as { __khalbumFetch?: boolean }).__khalbumFetch) {
  (window as { __khalbumFetch?: boolean }).__khalbumFetch = true;
  const real = window.fetch.bind(window);
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const m = new URL(url, window.location.href).pathname.match(/^\/api\/(?:a|album)\/(xem-truoc-v2[^/]*)\/([^/?]+)/);
    if (!m) return real(input, init);
    const [, slug, route] = m;
    const method = (init?.method ?? "GET").toUpperCase();
    if (route === "select" && method === "GET") return json(picksFor(slug));
    if (route === "select") {
      const b = JSON.parse(String(init?.body ?? "{}"));
      demoPicks.set(slug, { selected: b.photoIds ?? [], disliked: b.dislikedIds ?? [], notes: b.notes ?? {} });
      return json({ ok: true });
    }
    if (route === "share") return json({ token: "demo123" });
    if (route === "access") return json({ error: "wrong_password" }, 401);
    if (route === "print") return json({ picks: JSON.parse(String(init?.body ?? "{}")).photoIds ?? [], sentAt: new Date().toISOString() });
    return json({ ok: true });
  };
}

export function KhAlbumChonDemo({ variant = "day" }: { variant?: ChonVariant }) {
  return (
    <AlbumImgProvider value={DEMO_IMG}>
      <CustomerAlbumV2 key={variant} {...chonProps(variant)} />
    </AlbumImgProvider>
  );
}

/* ── Ngăn kéo "Ảnh na ná nhau" đã quét xong ──────────────────────────────── */
const GROUPS: DuplicateGroup[] = [
  { keys: ["p16", "p17", "p18"], bestKey: "p17" },
  { keys: ["p22", "p23", "p24", "p25"], bestKey: "p24" },
  { keys: ["p30", "p31"], bestKey: "p30" },
];

export function KhAlbumTrungDemo() {
  const [selected, setSelected] = useState<Set<string>>(new Set(["p17", "p24"]));
  const [hide, setHide] = useState(true);
  const byId = useMemo(() => new Map(PHOTOS.map((p) => [p.id, p])), []);
  const scan: DuplicateScan = {
    supported: true,
    busy: false,
    progress: null,
    run: async () => {},
    stop: () => {},
    abortRef: { current: null },
    scanList: PHOTOS,
    byId,
    shown: GROUPS,
    dupCount: 6,
  };
  return (
    <AlbumImgProvider value={DEMO_IMG}>
      <CustomerAlbumV2 {...BASE} album={{ ...BASE.album, slug: "xem-truoc-v2-trung" }} />
      <DuplicatesV2
        open
        onClose={() => {}}
        scan={scan}
        photoCount={PHOTOS.length}
        selected={selected}
        hide={hide}
        onHide={setHide}
        onToggle={(id) =>
          setSelected((s) => {
            const n = new Set(s);
            if (n.has(id)) n.delete(id);
            else n.add(id);
            return n;
          })
        }
        onOpen={() => {}}
      />
    </AlbumImgProvider>
  );
}

/* ── Ngăn kéo "Tìm ảnh có mặt bạn" ───────────────────────────────────────── */
export function KhAlbumMatDemo() {
  const [active, setActive] = useState<string | null>("P1");
  const search = useFaceSearch({ slug: "xem-truoc-v2-mat", onPick: setActive });
  const driveIdOf = useMemo(() => new Map(PHOTOS.map((p) => [p.id, p.drive_file_id])), []);
  return (
    <AlbumImgProvider value={DEMO_IMG}>
      <CustomerAlbumV2 {...BASE} album={{ ...BASE.album, slug: "xem-truoc-v2-mat" }} />
      <FaceFinderV2 open onClose={() => {}} people={PEOPLE} activeId={active} onPick={setActive} driveIdOf={driveIdOf} scan={null} search={search} />
    </AlbumImgProvider>
  );
}

/* ── Album giao khách ────────────────────────────────────────────────────── */
const G_PHOTOS = [
  ...Array.from({ length: 14 }, (_, i) => ({ ...photo(i + 50, "g1"), name: `LAN_${String(1200 + i)}.JPG` })),
  ...Array.from({ length: 18 }, (_, i) => ({ ...photo(i + 70, "g2"), name: `LAN_${String(1300 + i)}.JPG` })),
  { id: "v1", drive_file_id: "d99", name: "Highlight tiec cuoi.mp4", source_id: "g2", position: 99, is_video: true },
];
const FEEDBACK: Feedback[] = [
  {
    id: "f1", album_id: "g-demo", client_name: "Lan", rating: 5, content: "Ảnh đẹp quá, cả nhà ai cũng khen. Cảm ơn ekip đã nhiệt tình cả ngày!",
    approved: true, reply: "Cảm ơn Lan và Minh, chúc hai bạn trăm năm hạnh phúc!", replied_at: "2026-10-20T09:00:00Z", moderated_at: "2026-10-20T09:00:00Z", created_at: "2026-10-19T09:00:00Z",
  },
  {
    id: "f2", album_id: "g-demo", client_name: "Mẹ cô dâu", rating: 5, content: "Ảnh gia tiên rất có hồn.",
    approved: true, reply: null, replied_at: null, moderated_at: "2026-10-21T09:00:00Z", created_at: "2026-10-21T09:00:00Z",
  },
];
const G_BASE: GalleryViewProps = {
  gallery: {
    id: "g-demo",
    slug: "xem-truoc-v2-giao",
    title: "Lan & Minh · Tiệc cưới Riverside",
    event_date: "2026-10-12",
    cover_url: fakeSrc("cover1"),
    hasPassword: false,
    allowDownload: true,
    driveIsEdited: true,
    watermark: null,
  },
  initialPhotos: G_PHOTOS,
  initialPeople: PEOPLE.map((p) => ({ ...p, coverPhotoId: "p" + (Number(p.coverPhotoId?.slice(1)) + 50), photoIds: p.photoIds.map((id) => "p" + (Number(id.slice(1)) + 50)) })),
  totalPhotos: G_PHOTOS.length,
  initialSources: [
    { id: "g1", name: "Lễ gia tiên", position: 0 },
    { id: "g2", name: "Tiệc cưới", position: 1 },
  ],
  initialDriveFolders: [{ name: "File ChinhSua", url: "https://drive.google.com/drive/folders/demo-edit" }],
  initialOriginalFolders: [{ name: "JPG Goc", url: "https://drive.google.com/drive/folders/demo-orig" }],
  feedback: FEEDBACK,
  studioName: "Mây Studio",
  print: { quota: 3, picks: [], sentAt: null, copiedAt: null },
};

export type GiaoVariant = "day" | "khoa" | "chiase" | "gon";
export function KhAlbumGiaoDemo({ variant = "day" }: { variant?: GiaoVariant }) {
  const props: GalleryViewProps =
    variant === "khoa"
      ? { ...G_BASE, gallery: { ...G_BASE.gallery, hasPassword: true }, initialPhotos: null, totalPhotos: null }
      : variant === "chiase"
        ? { ...G_BASE, shareIds: ["p51", "p52", "p55", "p71", "p72"] }
        : variant === "gon"
          ? { ...G_BASE, gallery: { ...G_BASE.gallery, cover_url: null, allowDownload: false }, initialDriveFolders: [], initialOriginalFolders: [], print: null, feedback: [], initialPeople: [], initialSources: [] }
          : G_BASE;
  return (
    <AlbumImgProvider value={DEMO_IMG}>
      <GalleryViewV2 key={variant} {...props} />
    </AlbumImgProvider>
  );
}

/* ── Thư mục album ───────────────────────────────────────────────────────── */
const card = (i: number, title: string, category: string, date: string, pinned = true): GalleryCard => ({
  slug: `demo-${i}`,
  title,
  client_name: null,
  event_date: date,
  category,
  category_label: null,
  cover_url: fakeSrc(`d${i * 3 + 1}`),
  gallery_pinned: pinned,
});
const BROWSE: GalleryCard[] = [
  card(1, "Lan & Minh · Tiệc cưới Riverside", "cuoi", "2026-10-12"),
  card(2, "Gia đình anh Tuấn · Đà Lạt", "gia-dinh", "2026-10-05", false),
  card(3, "Kỷ yếu 12A1 · THPT Lê Quý Đôn", "ky-yeu", "2026-10-02"),
  card(4, "Thảo & Long · Pre-wedding Hội An", "cuoi", "2026-10-01"),
  card(5, "Bé Na tròn 1 tuổi", "gia-dinh", "2026-10-01", false),
  card(6, "Hà & Quân · Lễ ăn hỏi", "cuoi", "2026-09-21"),
  card(7, "Kỷ yếu 12C3", "ky-yeu", "2026-09-14"),
  card(8, "Teaser cưới Lan & Minh", "video", "2026-10-12"),
];
export function KhAlbumThuMucDemo() {
  return <AlbumBrowseV2 galleries={BROWSE} />;
}
