/* Màn xem trước GIAO DIỆN MỚI của nhóm "sangtao" — mỗi nhóm một file để làm song
 * song không đụng nhau. Đăng ký sẵn trong ../screens.tsx. Bọc màn trong
 * <PreviewV2 path="/dashboard/..."> (xem ./shell.tsx). */
import ThiepListView, { type InvitationRow } from "@/app/dashboard/studio/thiep/ThiepListView";
import StoryListView, { type StoryRow } from "@/app/dashboard/studio/story/StoryListView";
import SlideStudio from "@/app/dashboard/studio/slide/SlideStudio";
import AlbumDesigner from "@/app/dashboard/studio/album-designer/AlbumDesigner";
import type { SavedDesign } from "@/app/dashboard/studio/album-designer/AlbumEditor";
import { DesignerEditorDemo, FakeDesignerApi, SeedSlidePhotos } from "./sangtao-demo";
import * as f from "../fixtures";

/* ── Ảnh giả: dải màu SVG, không cần mạng ─────────────────────────────────── */
function photo(seed: number, w = 600, h = 800) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${seed * 47},45%,72%)"/><stop offset="1" stop-color="hsl(${seed * 47 + 40},40%,48%)"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/><circle cx="${w / 2}" cy="${h * 0.42}" r="${Math.min(w, h) * 0.2}" fill="rgba(255,255,255,.32)"/></svg>`,
  )}`;
}

/* ── Thiệp cưới ───────────────────────────────────────────────────────────── */
const inv = (i: number, over: Partial<InvitationRow> & { config?: InvitationRow["config"] }): InvitationRow => ({
  id: `inv-${i}`, slug: `thiep-${i}`, edit_token: `tok${i}`, template: "sen", published: true,
  config: {}, contract_id: null, created_at: `2026-10-${String(20 - i).padStart(2, "0")}T02:00:00Z`, rsvp_count: 0,
  ...over,
});
const THIEP: InvitationRow[] = [
  inv(1, { template: "sen", rsvp_count: 86, contract_id: "c1", config: { groom_name: "Anh Tuấn", bride_name: "Phương Nhi", wedding_date: "2026-11-16", cover_url: photo(1) } }),
  inv(2, { template: "trang", rsvp_count: 12, config: { groom_name: "Hoàng Phú", bride_name: "Bảo Hân", wedding_date: "2026-12-06", cover_url: photo(3) } }),
  inv(3, { template: "do", published: false, config: { groom_name: "Minh Khoa", bride_name: "Thu Trang", wedding_date: "2027-01-10" } }),
  inv(4, { template: "kem", rsvp_count: 140, contract_id: "c2", config: { groom_name: "Quốc Bảo", bride_name: "Ngọc Hân Nguyễn Hoàng Thảo", wedding_date: "2026-09-20", cover_url: photo(6) } }),
  inv(5, { template: "sen", published: false, config: {} }),
];

/* ── Love Story ───────────────────────────────────────────────────────────── */
const story = (i: number, over: Partial<StoryRow>): StoryRow => ({
  id: `st-${i}`, slug: `story-${i}`, edit_token: `stok${i}`, published: true, config: {}, contract_id: null, wish_count: 0, ...over,
});
const STORIES: StoryRow[] = [
  story(1, { wish_count: 42, contract_id: "c1", config: { groom_name: "Anh Tuấn", bride_name: "Phương Nhi", cover_url: photo(2), event_label: "Lễ Thành Hôn", event_date: "2026-11-16", tagline: "Mười năm, một con đường" } }),
  story(2, { wish_count: 7, config: { groom_name: "Hoàng Phú", bride_name: "Bảo Hân", event_date: "2026-12-06" } }),
  story(3, { published: false, config: { groom_name: "Minh Khoa", bride_name: "Thu Trang", cover_url: photo(8) } }),
];

/* ── Thiết kế album: album đã lưu + thư viện ảnh giả ───────────────────────── */
const TPL_BLANC = { id: "blanc", name: "Blanc", page: "#ffffff", ink: "#17181a", font: "var(--font-cormorant), serif" };
const TPL_NOIR = { id: "noir", name: "Noir", page: "#1a1a1c", ink: "#ece7dd", font: "var(--font-cormorant), serif" };
const TPL_AMOUR = { id: "amour", name: "Amour", page: "#fbf5ef", ink: "#4a3b34", font: "var(--font-script), cursive" };
const DESIGNS = [
  { id: "d1", name: "Album cưới Nhi & Tuấn", size: { name: "Vuông 30×30", w: 30, h: 30 }, tpl: TPL_BLANC, updated_at: "2026-10-22T08:00:00Z" },
  { id: "d2", name: "Pre-wedding Đà Lạt — Hân & Phú", size: { name: "Ngang 30×20", w: 30, h: 20 }, tpl: TPL_AMOUR, updated_at: "2026-10-18T08:00:00Z" },
  { id: "d3", name: "Noir — Trang & Khoa", size: { name: "Dọc 20×30", w: 20, h: 30 }, tpl: TPL_NOIR, updated_at: "2026-09-30T08:00:00Z" },
];
const LIB = Array.from({ length: 10 }, (_, i) => {
  const land = i % 3 !== 1;
  const u = photo(i + 1, land ? 900 : 600, land ? 600 : 900);
  return { id: `lib${i}`, thumb: u, full: u, name: `DSC_${4100 + i}.JPG`, w: land ? 6000 : 4000, h: land ? 4000 : 6000 };
});

let cellUid = 9000;
type DCell = NonNullable<SavedDesign["spreads"]>[number]["cells"][number];
function pcell(x: number, y: number, w: number, h: number, ph: string | null, extra: Partial<DCell> = {}): DCell {
  return { uid: cellUid++, type: "photo", x, y, w, h, photo: ph, full: ph, scale: 1, posX: 50, posY: 50, filter: "none", text: "", role: "body", align: "center", size: null, color: null, overlay: false, upper: false, ...extra };
}
function tcell(x: number, y: number, w: number, h: number, text: string, role: DCell["role"], extra: Partial<DCell> = {}): DCell {
  return { uid: cellUid++, type: "text", x, y, w, h, photo: null, full: null, scale: 1, posX: 50, posY: 50, filter: "none", text, role, align: "center", size: null, color: null, overlay: false, upper: role === "sub", ...extra };
}
const SPREADS: NonNullable<SavedDesign["spreads"]> = [
  { id: 1, layout: "cover", cells: [pcell(0, 0, 100, 100, LIB[0].thumb), tcell(10, 58, 80, 12, "Phương Nhi & Anh Tuấn", "title", { overlay: true }), tcell(10, 75, 80, 6, "16 · 11 · 2026", "sub", { overlay: true })] },
  { id: 2, layout: "duo", cells: [pcell(2, 3, 47, 94, LIB[1].thumb), pcell(51, 3, 47, 94, LIB[2].thumb)] },
  { id: 3, layout: "focus", cells: [pcell(2, 3, 62, 94, LIB[3].thumb), pcell(66, 3, 32, 45.5, LIB[4].thumb), pcell(66, 51.5, 32, 45.5, null)] },
  { id: 4, layout: "mag", cells: [pcell(2, 3, 48, 94, LIB[5].thumb), tcell(56, 20, 40, 14, "Chuyện của chúng mình", "title", { align: "left" }), tcell(56, 40, 40, 36, "Mười năm đi chung một con đường, hôm nay rẽ vào cùng một nhà.", "body", { align: "left" })] },
  { id: 5, layout: "quad", cells: [pcell(2, 3, 47, 45.5, LIB[6].thumb), pcell(51, 3, 47, 45.5, LIB[7].thumb), pcell(2, 51.5, 47, 45.5, LIB[8].thumb), pcell(51, 51.5, 47, 45.5, null)] },
  { id: 6, layout: "full", cells: [pcell(2, 2, 96, 96, LIB[9].thumb)] },
];
const DESIGNER = { designs: DESIGNS, spreads: SPREADS, lib: LIB };
const DESIGNER_EMPTY = { designs: [], spreads: SPREADS, lib: LIB };

export const SCREENS_SANGTAO: Record<string, { title: string; render: () => React.ReactNode; bare?: boolean }> = {
  /* ── Bản cũ (để so: tắt giao diện mới phải giữ y nguyên) ── */
  "v1-thiep": {
    title: "Bản cũ — Thiệp cưới (danh sách)",
    render: () => <ThiepListView rows={THIEP} ownerId="o" studio={f.studio} />,
  },
  "v1-story": {
    title: "Bản cũ — Love Story (danh sách)",
    render: () => <StoryListView rows={STORIES} ownerId="o" studioHost="maistudio.mstudo.com" />,
  },
  "v1-album-designer": {
    title: "Bản cũ — Thiết kế album (album đã lưu)",
    render: () => (
      <FakeDesignerApi data={DESIGNER}>
        <AlbumDesigner />
      </FakeDesignerApi>
    ),
  },
  "v1-album-designer-editor": {
    title: "Bản cũ — Thiết kế album (trình dàn trang)",
    render: () => <DesignerEditorDemo data={DESIGNER} />,
  },
  "v1-slide": {
    title: "Bản cũ — Slide cưới",
    render: () => (
      <SeedSlidePhotos>
        <SlideStudio />
      </SeedSlidePhotos>
    ),
  },
};
