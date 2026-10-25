/* ═══════════════════════════════════════════════════════════════════════════
   THIẾT KẾ ALBUM — phần THUẦN (kiểu dữ liệu, bố cục mẫu, bộ sinh bố cục, hàm vẽ
   ô). Tách khỏi AlbumEditor.tsx để bản cũ (AlbumEditor) và bản mới
   (AlbumEditorV2) dùng chung; logic có state ở ./useAlbumDesignEditor.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── Types ──────────────────────────────────────────────────────────────── */
export type ADSize = { name: string; w: number; h: number };
export type ADTpl = { id: string; name: string; page: string; ink: string; font: string };
export type Lib = { id: string; thumb: string; full: string; name: string; w?: number | null; h?: number | null };
export type Orient = "l" | "p" | "s";
export type CellShape = "rect" | "rounded" | "circle";
export type Cell = {
  uid: number; type: "photo" | "text"; x: number; y: number; w: number; h: number;
  photo: string | null; full: string | null; scale: number; posX: number; posY: number; filter: string;
  text: string; role: "title" | "sub" | "body" | "deco"; align: "left" | "center" | "right";
  size: number | null; color: string | null; overlay: boolean; upper: boolean;
  locked?: boolean; // khóa layer — không kéo/resize được cho tới khi mở khóa
  // Mặt nạ & hiệu ứng ảnh (bo góc/tròn, viền, làm mờ, phủ màu):
  shape?: CellShape;   // rect | rounded (bo góc) | circle (tròn/elip)
  radius?: number;     // độ bo góc (px thiết kế, theo baseH 500) khi shape=rounded
  borderW?: number;    // độ dày viền (px thiết kế)
  borderColor?: string;
  blur?: number;       // làm mờ ảnh (px thiết kế)
  tint?: string | null; // phủ màu lên ảnh
  tintA?: number;      // độ đậm phủ màu 0..100
};
export type Spread = { id: number; layout: string; cells: Cell[]; bg?: string };
/** Album đã lưu trên server, dùng để mở lại trong editor. */
export type SavedDesign = { id: string; name: string; folder?: string | null; spreads?: Spread[] };

/* ── Constants ──────────────────────────────────────────────────────────── */
export const FILTERS = [
  { k: "none", label: "Gốc", css: "none" },
  { k: "bright", label: "Sáng", css: "brightness(1.08) contrast(1.02)" },
  { k: "warm", label: "Ấm", css: "saturate(1.18) sepia(.12)" },
  { k: "bw", label: "Đen trắng", css: "grayscale(1) contrast(1.05)" },
  { k: "cine", label: "Điện ảnh", css: "contrast(1.12) saturate(1.12) brightness(.98)" },
  { k: "dream", label: "Mơ", css: "brightness(1.05) contrast(.94) saturate(1.05)" },
];
export type Rect = [number, number, number, number];
export type TextDef = { x: number; y: number; w: number; h: number; role: Cell["role"]; align?: Cell["align"]; overlay?: boolean };
export const LAYOUTS: Record<string, { label: string; photos: Rect[]; texts?: TextDef[] }> = {
  full: { label: "Toàn cảnh", photos: [[2, 2, 96, 96]] },
  duo: { label: "Đôi", photos: [[2, 3, 47, 94], [51, 3, 47, 94]] },
  trio: { label: "Bộ ba", photos: [[2, 3, 47, 94], [51, 3, 47, 45.5], [51, 51.5, 47, 45.5]] },
  quad: { label: "Lưới 4", photos: [[2, 3, 47, 45.5], [51, 3, 47, 45.5], [2, 51.5, 47, 45.5], [51, 51.5, 47, 45.5]] },
  focus: { label: "Tiêu điểm", photos: [[2, 3, 62, 94], [66, 3, 32, 45.5], [66, 51.5, 32, 45.5]] },
  mag: { label: "Tạp chí", photos: [[2, 3, 48, 94]], texts: [{ x: 56, y: 20, w: 40, h: 14, role: "title" }, { x: 56, y: 40, w: 40, h: 36, role: "body" }] },
  pano: { label: "Toàn ảnh", photos: [[2, 24, 96, 52]], texts: [{ x: 2, y: 82, w: 96, h: 7, role: "sub", align: "center" }] },
  cover: { label: "Bìa", photos: [[0, 0, 100, 100]], texts: [{ x: 10, y: 58, w: 80, h: 12, role: "title", align: "center", overlay: true }, { x: 10, y: 75, w: 80, h: 6, role: "sub", align: "center", overlay: true }] },
  // Bố cục đa dạng hơn (bất đối xứng, kiểu tạp chí/mosaic)
  strip3: { label: "3 dải ngang", photos: [[2, 2, 96, 30.7], [2, 34.6, 96, 30.7], [2, 67.3, 96, 30.7]] },
  bigTop: { label: "Lớn trên · 3 dưới", photos: [[2, 2, 96, 58], [2, 62, 31.3, 36], [34.3, 62, 31.3, 36], [66.6, 62, 31.3, 36]] },
  mosaic5: { label: "Mosaic 5", photos: [[2, 2, 58, 96], [62, 2, 17, 46.5], [81, 2, 17, 46.5], [62, 51.5, 17, 46.5], [81, 51.5, 17, 46.5]] },
  sideStrip: { label: "Lớn + dải 4", photos: [[2, 2, 70, 96], [74, 2, 24, 22.5], [74, 26.5, 24, 22.5], [74, 51, 24, 22.5], [74, 75.5, 24, 22.5]] },
  heroWide: { label: "Toàn cảnh + 4", photos: [[2, 2, 96, 60], [2, 64, 23, 34], [26, 64, 23, 34], [50, 64, 23, 34], [74, 64, 24, 34]] },
  sixGrid: { label: "Lưới 6", photos: [[2, 2, 31.3, 47], [34.3, 2, 31.3, 47], [66.6, 2, 31.4, 47], [2, 51, 31.3, 47], [34.3, 51, 31.3, 47], [66.6, 51, 31.4, 47]] },
  // Bố cục kèm chữ (tạp chí / bài báo / trích dẫn) — thêm cho đa dạng.
  magRight: { label: "Tạp chí phải", photos: [[52, 3, 46, 94]], texts: [{ x: 4, y: 24, w: 42, h: 16, role: "title" }, { x: 4, y: 44, w: 42, h: 38, role: "body" }] },
  editorialL: { label: "Bài báo", photos: [[2, 3, 50, 94]], texts: [{ x: 58, y: 16, w: 38, h: 14, role: "title" }, { x: 58, y: 34, w: 38, h: 6, role: "sub" }, { x: 58, y: 46, w: 38, h: 40, role: "body" }] },
  quoteFull: { label: "Trích dẫn", photos: [[0, 0, 100, 100]], texts: [{ x: 12, y: 40, w: 76, h: 20, role: "title", align: "center", overlay: true }] },
  duoText: { label: "Đôi + lời", photos: [[2, 3, 47, 62], [51, 3, 47, 62]], texts: [{ x: 10, y: 70, w: 80, h: 24, role: "body", align: "center" }] },
  tripTitle: { label: "3 dọc + tựa", photos: [[2, 24, 31.3, 74], [34.3, 24, 31.3, 74], [66.6, 24, 31.4, 74]], texts: [{ x: 10, y: 6, w: 80, h: 14, role: "title", align: "center" }] },
};
export const SEED_PLAN = ["cover", "duo", "focus", "trio", "mag", "bigTop", "sixGrid", "full"];

/** Tile `count` cells into a region [rx,ry,rw,rh] with `cols` columns. */
export function tileRegion(count: number, rx: number, ry: number, rw: number, rh: number, cols: number): Rect[] {
  const G = 2;
  cols = Math.max(1, Math.min(cols, count));
  const rows = Math.ceil(count / cols);
  const cw = (rw - (cols + 1) * G) / cols, ch = (rh - (rows + 1) * G) / rows;
  const out: Rect[] = [];
  let idx = 0;
  for (let r = 0; r < rows && idx < count; r++) {
    const inRow = Math.min(cols, count - idx);
    const rowW = inRow * cw + (inRow - 1) * G;
    const sx = rx + (rw - rowW) / 2;
    const y = ry + G + r * (ch + G);
    for (let c = 0; c < inRow; c++, idx++) out.push([+(sx + c * (cw + G)).toFixed(1), +y.toFixed(1), +cw.toFixed(1), +ch.toFixed(1)]);
  }
  return out;
}

export const sig = (r: Rect[]) => r.map((a) => a.map(Math.round).join(",")).sort().join("|");

/**
 * Preset bố cục thủ công (bất đối xứng / mosaic / pinwheel / tạp chí) mà bộ
 * sinh lưới không tạo ra — để "bố cục đa dạng hơn". Toạ độ %, chừa gap ~2.
 */
export const LAYOUT_PRESETS: Record<number, Rect[][]> = {
  2: [
    [[4, 8, 54, 84], [60, 20, 36, 60]],           // lớn trái + nhỏ nổi phải
    [[2, 2, 96, 60], [2, 63, 96, 35]],             // rộng trên + dải dưới
    [[2, 2, 63, 96], [67, 2, 31, 96]],             // 2/3 · 1/3
  ],
  3: [
    [[2, 2, 60, 96], [64, 2, 34, 47], [64, 51, 34, 47]],                 // tiêu điểm trái
    [[2, 2, 48, 60], [52, 2, 46, 60], [2, 64, 96, 34]],                  // 2 trên + rộng dưới
    [[2, 2, 96, 50], [2, 54, 47, 44], [51, 54, 47, 44]],                 // rộng trên + 2 dưới
    [[2, 2, 30, 96], [34, 2, 30, 96], [68, 2, 30, 96]],                  // 3 dải dọc
  ],
  4: [
    [[2, 2, 60, 60], [64, 2, 34, 60], [2, 64, 34, 34], [38, 64, 60, 34]], // pinwheel
    [[2, 2, 96, 46], [2, 50, 30.6, 48], [34.6, 50, 30.6, 48], [69.2, 50, 28.8, 48]], // rộng trên + 3 dưới
    [[2, 2, 46, 96], [50, 2, 48, 30], [50, 34, 48, 30], [50, 66, 48, 32]], // lớn trái + 3 phải
    [[2, 2, 47, 47], [51, 2, 47, 60], [2, 51, 47, 47], [51, 66, 47, 32]],  // so le
  ],
  5: [
    [[2, 2, 58, 58], [62, 2, 36, 58], [2, 62, 30, 36], [34, 62, 30, 36], [66, 62, 32, 36]],
    [[2, 2, 96, 52], [2, 56, 23, 42], [27, 56, 23, 42], [51, 56, 23, 42], [75, 56, 23, 42]],
    [[2, 2, 40, 96], [44, 2, 54, 47], [44, 51, 17, 47], [63, 51, 17, 47], [82, 51, 16, 47]],
  ],
  6: [
    [[2, 2, 47, 48], [51, 2, 47, 48], [2, 52, 23, 46], [27, 52, 23, 46], [51, 52, 23, 46], [75, 52, 23, 46]], // 2 trên + 4 dưới
    [[2, 2, 62, 62], [66, 2, 32, 30], [66, 34, 32, 28], [2, 66, 30, 32], [34, 66, 30, 32], [66, 66, 32, 32]], // tiêu điểm + 5
  ],
  7: [
    [[2, 2, 31.3, 47], [35.3, 2, 31.3, 47], [69.3, 2, 28.7, 47], [2, 51, 22.5, 47], [26.5, 51, 22.5, 47], [51, 51, 22.5, 47], [75.5, 51, 22.5, 47]], // 3 trên + 4 dưới
  ],
};

/**
 * Sinh NHIỀU gợi ý bố cục cho đúng N ảnh: lưới mọi rows×cols hợp lý; ảnh tiêu
 * điểm (lớn) ở 4 hướng với nhiều cỡ; hai ảnh lớn + phần còn lại; chia 2–3 dải;
 * cùng các preset thủ công. Khử trùng lặp, chỉ ô hợp lệ. (đa dạng hơn nhiều)
 */
export function layoutVariants(n: number, _aspect: number): Rect[][] {
  n = Math.max(1, Math.min(12, Math.round(n)));
  const out: Rect[][] = [];
  const seen = new Set<string>();
  const add = (r: Rect[]) => {
    if (r.length !== n) return;
    if (!r.every(([x, y, w, h]) => w >= 7 && h >= 7 && x >= -0.5 && y >= -0.5 && x + w <= 100.5 && y + h <= 100.5)) return;
    const s = sig(r); if (seen.has(s)) return; seen.add(s); out.push(r);
  };
  if (n === 1) { add([[0, 0, 100, 100]]); add([[6, 6, 88, 88]]); add([[12, 4, 76, 92]]); add([[4, 12, 92, 76]]); return out; }

  // 1) Lưới — mọi rows×cols vừa khít n.
  for (let cols = 1; cols <= 6; cols++) {
    const rows = Math.ceil(n / cols);
    if (rows > 5 || rows * cols - n >= cols) continue;
    if (n > 3 && (cols === 1 || rows === 1)) continue; // tránh 1 dải mảnh cho nhiều ảnh
    add(tileRegion(n, 0, 0, 100, 100, cols));
  }
  // 2) Ảnh tiêu điểm + phần còn lại — 4 hướng, nhiều cỡ, xếp 1–2 cột.
  if (n >= 2) {
    const rest = n - 1;
    for (const big of [55, 62, 70]) {
      for (const rc of [1, 2]) {
        add([[2, 2, big - 2, 96], ...tileRegion(rest, big + 1, 2, 99 - big, 96, rc)]);   // lớn trái
        add([[100 - big, 2, big - 2, 96], ...tileRegion(rest, 2, 2, 99 - big, 96, rc)]);  // lớn phải
      }
      add([[2, 2, 96, big - 2], ...tileRegion(rest, 2, big + 1, 96, 99 - big, rest)]);    // lớn trên
      add([[2, 100 - big, 96, big - 2], ...tileRegion(rest, 2, 2, 96, 99 - big, rest)]);  // lớn dưới
    }
  }
  // 3) Hai ảnh lớn (cột trái xếp chồng) + phần còn lại lưới bên phải.
  if (n >= 4) {
    const rest = n - 2;
    for (const cols of [1, 2]) {
      add([[2, 2, 46, 47], [2, 51, 46, 47], ...tileRegion(rest, 50, 2, 48, 96, cols)]);   // 2 lớn trái
      add([...tileRegion(rest, 2, 2, 48, 96, cols), [52, 2, 46, 47], [52, 51, 46, 47]]);   // 2 lớn phải
    }
  }
  // 4) Chia 2 dải & 3 dải (không đối xứng).
  if (n >= 4) {
    for (const k of [Math.floor(n / 2), Math.ceil(n / 2), 2, n - 2]) {
      if (k < 1 || k >= n) continue;
      add([...tileRegion(k, 0, 0, 100, 50, k), ...tileRegion(n - k, 0, 50, 100, 50, n - k)]);
    }
  }
  if (n >= 6) {
    const a = Math.floor(n / 3), b = Math.floor((n - a) / 2), c = n - a - b;
    if (a && b && c) add([...tileRegion(a, 0, 0, 100, 34, a), ...tileRegion(b, 0, 34, 100, 33, b), ...tileRegion(c, 0, 67, 100, 33, c)]);
  }
  // 5) Preset thủ công (bất đối xứng / mosaic / pinwheel).
  (LAYOUT_PRESETS[n] ?? []).forEach(add);

  return out.slice(0, 30);
}
export const DECOS: { label: string; text: string; size: number }[] = [
  { label: "Đường kẻ", text: "———", size: 22 }, { label: "Đường dài", text: "——————", size: 20 },
  { label: "Dấu &", text: "&", size: 40 }, { label: "and", text: "and", size: 24 },
  { label: "Ngày cưới", text: "12 · 10 · 2025", size: 16 }, { label: "Save the date", text: "Save the date", size: 20 },
  { label: "The Wedding", text: "THE WEDDING", size: 18 }, { label: "Forever", text: "Forever & Always", size: 20 },
  { label: "Hoa văn", text: "❧", size: 30 }, { label: "Điểm nhấn", text: "✦", size: 24 },
  { label: "Hoa", text: "❀", size: 30 }, { label: "Sao", text: "✧ ✦ ✧", size: 22 },
  { label: "Trái tim", text: "♡", size: 30 }, { label: "Nhẫn", text: "◦○◦", size: 26 },
  { label: "Lá", text: "☘", size: 28 }, { label: "Chấm", text: "• • •", size: 22 },
  { label: "Mũi tên", text: "❯", size: 26 }, { label: "Khung", text: "◇", size: 30 },
];
export const ROLE_SIZE = { title: 26, sub: 12, body: 13, deco: 24 } as const;

/* ── Helpers ────────────────────────────────────────────────────────────── */
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const filterCss = (k: string) => FILTERS.find((f) => f.k === k)?.css || "none";
/** border-radius CSS cho ô ảnh (k = hệ số quy đổi px thiết kế → px hiển thị). */
export const cellRadius = (c: Cell, k: number) =>
  c.shape === "circle" ? "9999px" : c.shape === "rounded" ? `${Math.max(0, c.radius ?? 24) * k}px` : "0";
/** filter tổng hợp: bộ lọc màu + làm mờ (blur tính theo px thiết kế). */
export const cellFilter = (c: Cell, k: number) => {
  const base = filterCss(c.filter);
  const parts: string[] = [];
  if (base && base !== "none") parts.push(base);
  if (c.blur) parts.push(`blur(${(c.blur * k).toFixed(2)}px)`);
  return parts.length ? parts.join(" ") : "none";
};
/** Vẽ đường bao ô (rect / bo góc / tròn-elip) lên canvas — dùng để clip & viền. */
export function cellPath(ctx: CanvasRenderingContext2D, c: Cell, x: number, y: number, w: number, h: number, k: number) {
  ctx.beginPath();
  if (c.shape === "circle") { ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); return; }
  const r = c.shape === "rounded" ? Math.min((c.radius ?? 24) * k, w / 2, h / 2) : 0;
  if (r > 0) {
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  } else ctx.rect(x, y, w, h);
}
let UID = 1;
/** Mã ô mới — tăng dần, dùng chung cho cả trang (ô ảnh, ô chữ, trang trí). */
export const nextUid = () => UID++;
/** Đẩy bộ đếm vượt mọi uid sẵn có (khi mở lại album đã lưu) để không trùng. */
export function bumpUid(maxUid: number) { if (maxUid >= UID) UID = maxUid + 1; }

export function buildSpread(layout: string, id: number): Spread {
  const L = LAYOUTS[layout] || LAYOUTS.full;
  const cells: Cell[] = [];
  for (const [x, y, w, h] of L.photos) {
    cells.push({ uid: nextUid(), type: "photo", x, y, w, h, photo: null, full: null, scale: 1, posX: 50, posY: 50, filter: "none", text: "", role: "body", align: "center", size: null, color: null, overlay: false, upper: false });
  }
  for (const t of L.texts || []) {
    cells.push({
      uid: nextUid(), type: "text", x: t.x, y: t.y, w: t.w, h: t.h, photo: null, full: null, scale: 1, posX: 50, posY: 50, filter: "none",
      text: t.role === "title" ? "Bảo Hân & Hoàng Phú" : t.role === "sub" ? "12 · 10 · 2025" : "Chuyện của chúng mình…",
      role: t.role, align: t.align || "left", size: null, color: null, overlay: !!t.overlay, upper: t.role === "sub",
    });
  }
  return { id, layout, cells };
}
