"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Wand2, Undo2, Redo2, Plus, Trash2, Shuffle, Loader2, Download, ImagePlus, ArrowLeft, Copy, ChevronLeft, ChevronRight, Type, Lock, Unlock, Save, LayoutGrid, Maximize, Images } from "lucide-react";
import { buildPdf, cmToPt, type PdfPageSpec } from "@/lib/album-pdf";

/* ── Types ──────────────────────────────────────────────────────────────── */
export type ADSize = { name: string; w: number; h: number };
export type ADTpl = { id: string; name: string; page: string; ink: string; font: string };
type Lib = { id: string; thumb: string; full: string; name: string; w?: number | null; h?: number | null };
type Orient = "l" | "p" | "s";
type CellShape = "rect" | "rounded" | "circle";
type Cell = {
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
type Spread = { id: number; layout: string; cells: Cell[]; bg?: string };
/** Album đã lưu trên server, dùng để mở lại trong editor. */
export type SavedDesign = { id: string; name: string; folder?: string | null; spreads?: Spread[] };

/* ── Constants ──────────────────────────────────────────────────────────── */
const FILTERS = [
  { k: "none", label: "Gốc", css: "none" },
  { k: "bright", label: "Sáng", css: "brightness(1.08) contrast(1.02)" },
  { k: "warm", label: "Ấm", css: "saturate(1.18) sepia(.12)" },
  { k: "bw", label: "Đen trắng", css: "grayscale(1) contrast(1.05)" },
  { k: "cine", label: "Điện ảnh", css: "contrast(1.12) saturate(1.12) brightness(.98)" },
  { k: "dream", label: "Mơ", css: "brightness(1.05) contrast(.94) saturate(1.05)" },
];
type Rect = [number, number, number, number];
type TextDef = { x: number; y: number; w: number; h: number; role: Cell["role"]; align?: Cell["align"]; overlay?: boolean };
const LAYOUTS: Record<string, { label: string; photos: Rect[]; texts?: TextDef[] }> = {
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
const SEED_PLAN = ["cover", "duo", "focus", "trio", "mag", "bigTop", "sixGrid", "full"];

/** Tile `count` cells into a region [rx,ry,rw,rh] with `cols` columns. */
function tileRegion(count: number, rx: number, ry: number, rw: number, rh: number, cols: number): Rect[] {
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

const sig = (r: Rect[]) => r.map((a) => a.map(Math.round).join(",")).sort().join("|");

/**
 * Preset bố cục thủ công (bất đối xứng / mosaic / pinwheel / tạp chí) mà bộ
 * sinh lưới không tạo ra — để "bố cục đa dạng hơn". Toạ độ %, chừa gap ~2.
 */
const LAYOUT_PRESETS: Record<number, Rect[][]> = {
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
function layoutVariants(n: number, _aspect: number): Rect[][] {
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
const DECOS: { label: string; text: string; size: number }[] = [
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
const ROLE_SIZE = { title: 26, sub: 12, body: 13, deco: 24 } as const;

/* ── Helpers ────────────────────────────────────────────────────────────── */
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const filterCss = (k: string) => FILTERS.find((f) => f.k === k)?.css || "none";
/** border-radius CSS cho ô ảnh (k = hệ số quy đổi px thiết kế → px hiển thị). */
const cellRadius = (c: Cell, k: number) =>
  c.shape === "circle" ? "9999px" : c.shape === "rounded" ? `${Math.max(0, c.radius ?? 24) * k}px` : "0";
/** filter tổng hợp: bộ lọc màu + làm mờ (blur tính theo px thiết kế). */
const cellFilter = (c: Cell, k: number) => {
  const base = filterCss(c.filter);
  const parts: string[] = [];
  if (base && base !== "none") parts.push(base);
  if (c.blur) parts.push(`blur(${(c.blur * k).toFixed(2)}px)`);
  return parts.length ? parts.join(" ") : "none";
};
/** Vẽ đường bao ô (rect / bo góc / tròn-elip) lên canvas — dùng để clip & viền. */
function cellPath(ctx: CanvasRenderingContext2D, c: Cell, x: number, y: number, w: number, h: number, k: number) {
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

function buildSpread(layout: string, id: number): Spread {
  const L = LAYOUTS[layout] || LAYOUTS.full;
  const cells: Cell[] = [];
  for (const [x, y, w, h] of L.photos) {
    cells.push({ uid: UID++, type: "photo", x, y, w, h, photo: null, full: null, scale: 1, posX: 50, posY: 50, filter: "none", text: "", role: "body", align: "center", size: null, color: null, overlay: false, upper: false });
  }
  for (const t of L.texts || []) {
    cells.push({
      uid: UID++, type: "text", x: t.x, y: t.y, w: t.w, h: t.h, photo: null, full: null, scale: 1, posX: 50, posY: 50, filter: "none",
      text: t.role === "title" ? "Bảo Hân & Hoàng Phú" : t.role === "sub" ? "12 · 10 · 2025" : "Chuyện của chúng mình…",
      role: t.role, align: t.align || "left", size: null, color: null, overlay: !!t.overlay, upper: t.role === "sub",
    });
  }
  return { id, layout, cells };
}

export default function AlbumEditor({ size, tpl, onBack, initial }: { size: ADSize; tpl: ADTpl; onBack: () => void; initial?: SavedDesign | null }) {
  const aspect = (2 * size.w) / size.h; // spread = two pages wide
  const [spreads, setSpreads] = useState<Spread[]>(() =>
    initial?.spreads?.length ? initial.spreads : SEED_PLAN.map((l, i) => buildSpread(l, i + 1)),
  );
  const [cur, setCur] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const [pickCount, setPickCount] = useState(3);
  const [laySrc, setLaySrc] = useState<"all" | "mine" | "fav">("all");
  const [laySearch, setLaySearch] = useState("");
  const [favs, setFavs] = useState<Rect[][]>([]);
  const [mine, setMine] = useState<{ name: string; rects: Rect[] }[]>([]);
  const [zoom, setZoom] = useState(1);
  const [lib, setLib] = useState<Lib[]>([]);
  const [folder, setFolder] = useState(initial?.folder ?? "");
  const [loadingLib, setLoadingLib] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [fmt, setFmt] = useState<"jpg" | "png" | "pdf">("pdf");
  const [bleedMm, setBleedMm] = useState(3); // bleed mặc định 3mm (chuẩn nhà in)
  const [showExport, setShowExport] = useState(false);
  const [exportSel, setExportSel] = useState<Set<number>>(new Set());
  const [showAuto, setShowAuto] = useState(false);
  const [autoSpreads, setAutoSpreads] = useState(6);
  const [autoMin, setAutoMin] = useState(1);
  const [autoMax, setAutoMax] = useState(6);
  const [autoPlan, setAutoPlan] = useState<{ count: number; rects: Rect[] }[]>([]);
  const [canvasW, setCanvasW] = useState(700);
  // Đại tu giao diện: nhiều spread, dải bố cục ngang, dải trang, lưu server.
  const [multi, setMulti] = useState(false);              // xem nhiều spread liên tục
  const [railOpen, setRailOpen] = useState(true);          // mở dải bố cục ngang
  const [showLib, setShowLib] = useState(true);            // ngăn thư viện ảnh
  const [designId, setDesignId] = useState<string | null>(initial?.id ?? null);
  const [name, setName] = useState(initial?.name ?? "Album chưa đặt tên");
  const [saving, setSaving] = useState(false);
  const dirty = useRef(false);
  const dragPage = useRef<number | null>(null); // kéo-thả sắp xếp trang
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dims = useRef<Record<string, { w: number; h: number; approx?: boolean }>>({});
  const hist = useRef<string[]>([]);
  const fut = useRef<string[]>([]);
  const [, force] = useState(0);

  // Khi mở album đã lưu, đẩy bộ đếm UID vượt mọi uid sẵn có để tránh trùng.
  useEffect(() => {
    const maxUid = Math.max(0, ...spreads.flatMap((s) => s.cells.map((c) => c.uid)));
    if (maxUid >= UID) UID = maxUid + 1;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const spread = spreads[cur];
  const selCell = spread?.cells.find((c) => c.uid === sel) || null;

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2400); };
  const snapshot = useCallback(() => { hist.current.push(JSON.stringify(spreads)); if (hist.current.length > 40) hist.current.shift(); fut.current = []; dirty.current = true; force((n) => n + 1); }, [spreads]);
  const undo = () => { const s = hist.current.pop(); if (!s) return; fut.current.push(JSON.stringify(spreads)); setSpreads(JSON.parse(s)); force((n) => n + 1); };
  const redo = () => { const s = fut.current.pop(); if (!s) return; hist.current.push(JSON.stringify(spreads)); setSpreads(JSON.parse(s)); force((n) => n + 1); };

  const patchCell = (uid: number, p: Partial<Cell>) => setSpreads((sp) => sp.map((s, i) => i !== cur ? s : { ...s, cells: s.cells.map((c) => c.uid === uid ? { ...c, ...p } : c) }));

  /* ── Thư viện bố cục: Yêu thích + Của tôi (lưu trong trình duyệt) ────────── */
  useEffect(() => {
    try {
      setFavs(JSON.parse(localStorage.getItem("ad_favs") || "[]"));
      setMine(JSON.parse(localStorage.getItem("ad_mine") || "[]"));
    } catch { /* localStorage trống/hỏng — bỏ qua */ }
  }, []);
  const favSet = useMemo(() => new Set(favs.map(sig)), [favs]);
  const toggleFav = (rects: Rect[]) => {
    const k = sig(rects);
    const next = favSet.has(k) ? favs.filter((f) => sig(f) !== k) : [rects, ...favs];
    setFavs(next); try { localStorage.setItem("ad_favs", JSON.stringify(next)); } catch {}
  };
  const saveMine = () => {
    const rects = spread.cells.filter((c) => c.type === "photo").map((c) => [c.x, c.y, c.w, c.h] as Rect);
    if (!rects.length) { showToast("Trang này chưa có ô ảnh để lưu."); return; }
    const next = [{ name: `Của tôi ${mine.length + 1}`, rects }, ...mine];
    setMine(next); try { localStorage.setItem("ad_mine", JSON.stringify(next)); } catch {}
    showToast("Đã lưu bố cục vào 'Của tôi'.");
  };
  // Measure canvas width.
  useEffect(() => {
    const el = stageRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setCanvasW(el.clientWidth));
    ro.observe(el); setCanvasW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Real pixel dimensions come from Drive metadata (accurate for the print DPI
  // check). Fall back to loading the thumbnail only for orientation if missing.
  useEffect(() => {
    lib.forEach((p) => {
      if (dims.current[p.id]) return;
      if (p.w && p.h) { dims.current[p.id] = { w: p.w, h: p.h }; return; }
      const img = new Image();
      img.onload = () => { dims.current[p.id] = { w: img.naturalWidth, h: img.naturalHeight, approx: true }; };
      img.src = p.thumb;
    });
  }, [lib]);

  const orient = (id: string): Orient => {
    const d = dims.current[id]; if (!d) return "s";
    const r = d.w / d.h; return r > 1.15 ? "l" : r < 0.87 ? "p" : "s";
  };

  async function loadLibrary() {
    if (!folder.trim()) return;
    setLoadingLib(true);
    try {
      const res = await fetch(`/api/album-designer/photos?folder=${encodeURIComponent(folder.trim())}`);
      const d = await res.json();
      setLib(d.photos || []);
      if (d.error === "no_api_key") showToast("Máy chủ chưa cấu hình GOOGLE_API_KEY để đọc Drive.");
      else if (!d.photos?.length) showToast("Không đọc được ảnh — kiểm tra link folder đã chia sẻ công khai chưa.");
    } finally { setLoadingLib(false); }
  }

  // Base spread geometry.
  const baseH = 500, baseW = 500 * aspect;
  const scale = Math.min(1, (canvasW - 40) / baseW) * zoom;
  const spreadPxW = baseW * scale, spreadPxH = baseH * scale;

  /* ── Drag / resize ──────────────────────────────────────────────────── */
  const drag = useRef<{ uid: number; mode: string; sx: number; sy: number; c0: Cell; moved: boolean } | null>(null);
  const onCellDown = (e: React.PointerEvent, c: Cell, mode: string) => {
    e.stopPropagation();
    setSel(c.uid);
    if (c.locked) return; // layer bị khóa: chỉ chọn, không kéo/resize
    drag.current = { uid: c.uid, mode, sx: e.clientX, sy: e.clientY, c0: { ...c }, moved: false };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };
  const onMove = useCallback((e: PointerEvent) => {
    const d = drag.current; if (!d) return;
    const dxp = ((e.clientX - d.sx) / spreadPxW) * 100;
    const dyp = ((e.clientY - d.sy) / spreadPxH) * 100;
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 2) { d.moved = true; snapshot(); }
    if (!d.moved) return;
    const c = d.c0;
    let { x, y, w, h } = c;
    if (d.mode === "move") { x = clamp(c.x + dxp, 0, 100 - c.w); y = clamp(c.y + dyp, 0, 100 - c.h); }
    else {
      if (d.mode.includes("e")) w = clamp(c.w + dxp, 6, 100 - c.x);
      if (d.mode.includes("s")) h = clamp(c.h + dyp, 6, 100 - c.y);
      if (d.mode.includes("w")) { const nx = clamp(c.x + dxp, 0, c.x + c.w - 6); w = c.w + (c.x - nx); x = nx; }
      if (d.mode.includes("n")) { const ny = clamp(c.y + dyp, 0, c.y + c.h - 6); h = c.h + (c.y - ny); y = ny; }
    }
    patchCell(d.uid, { x, y, w, h });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spreadPxW, spreadPxH, snapshot, cur]);
  const onUp = useCallback(() => { drag.current = null; window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); }, [onMove]);

  /* ── Fill photo ─────────────────────────────────────────────────────── */
  const fillCell = (uid: number, p: Lib) => { snapshot(); patchCell(uid, { photo: p.thumb, full: p.full, scale: 1, posX: 50, posY: 50 }); };
  const onThumbClick = (p: Lib) => {
    const target = selCell?.type === "photo" ? selCell.uid : spread?.cells.find((c) => c.type === "photo" && !c.photo)?.uid;
    if (target) fillCell(target, p);
  };
  const usedIds = useMemo(() => new Set(spreads.flatMap((s) => s.cells.map((c) => c.photo).filter(Boolean))), [spreads]);

  /* ── Layout / cells ops ─────────────────────────────────────────────── */
  // Rebuild the current spread's photo cells from arbitrary rects (auto layout),
  // keeping already-placed photos and any text cells.
  function applyRects(rects: Rect[]) {
    snapshot();
    const placed = spread.cells.filter((c) => c.type === "photo" && c.photo);
    const texts = spread.cells.filter((c) => c.type === "text");
    let pi = 0;
    const photoCells: Cell[] = rects.map(([x, y, w, h]) => {
      const base: Cell = { uid: UID++, type: "photo", x, y, w, h, photo: null, full: null, scale: 1, posX: 50, posY: 50, filter: "none", text: "", role: "body", align: "center", size: null, color: null, overlay: false, upper: false };
      const s = placed[pi++];
      return s ? { ...base, photo: s.photo, full: s.full, scale: s.scale, posX: s.posX, posY: s.posY, filter: s.filter } : base;
    });
    setSpreads((sp) => sp.map((s, i) => i !== cur ? s : { ...s, layout: `auto:${rects.length}`, cells: [...photoCells, ...texts] }));
    setSel(null);
  }
  const curPhotoSig = sig(spread?.cells.filter((c) => c.type === "photo").map((c) => [c.x, c.y, c.w, c.h] as Rect) ?? []);
  const variants = useMemo(() => layoutVariants(pickCount, aspect), [pickCount, aspect]);
  // Picking a count shows suggestions and applies the first as a preview.
  const chooseCount = (n: number) => { const nn = clamp(Math.round(n), 1, 12); setPickCount(nn); applyRects(layoutVariants(nn, aspect)[0]); };
  // Browsing to another spread syncs the count picker to that page.
  useEffect(() => { setPickCount(spreads[cur]?.cells.filter((c) => c.type === "photo").length || 1); }, [cur]); // eslint-disable-line react-hooks/exhaustive-deps
  const addText = () => { snapshot(); const c = buildSpread("full", spread.id).cells[0]; setSpreads((sp) => sp.map((s, i) => i !== cur ? s : { ...s, cells: [...s.cells, { ...c, uid: UID++, type: "text", x: 20, y: 40, w: 60, h: 12, text: "Dòng chữ mới", role: "body", align: "center" }] })); };
  const addDeco = (d: typeof DECOS[number]) => { snapshot(); setSpreads((sp) => sp.map((s, i) => i !== cur ? s : { ...s, cells: [...s.cells, { uid: UID++, type: "text", x: 30, y: 45, w: 40, h: 12, photo: null, full: null, scale: 1, posX: 50, posY: 50, filter: "none", text: d.text, role: "deco", align: "center", size: d.size, color: null, overlay: false, upper: false }] })); };
  const delCell = (uid: number) => { snapshot(); setSpreads((sp) => sp.map((s, i) => i !== cur ? s : { ...s, cells: s.cells.filter((c) => c.uid !== uid) })); setSel(null); };
  const clearPhoto = (uid: number) => { snapshot(); patchCell(uid, { photo: null, full: null }); };
  const shuffle = () => {
    snapshot();
    const photos = spread.cells.filter((c) => c.type === "photo" && c.photo).map((c) => ({ photo: c.photo, full: c.full }));
    for (let i = photos.length - 1; i > 0; i--) { const j = (i * 7 + 3) % (i + 1); [photos[i], photos[j]] = [photos[j], photos[i]]; }
    let pi = 0;
    setSpreads((sp) => sp.map((s, i) => i !== cur ? s : { ...s, cells: s.cells.map((c) => c.type === "photo" && c.photo && photos[pi] ? { ...c, ...photos[pi++] } : c) }));
  };
  const delSpread = () => { if (spreads.length <= 1) return; snapshot(); setSpreads((sp) => sp.filter((_, i) => i !== cur)); setCur((c) => Math.max(0, c - 1)); setSel(null); };
  const addSpread = () => { snapshot(); setSpreads((sp) => [...sp, buildSpread("duo", (sp.at(-1)?.id ?? 0) + 1)]); setCur(spreads.length); };
  const dupSpread = () => { snapshot(); const clone: Spread = { ...spread, id: (spreads.at(-1)?.id ?? 0) + 1, cells: spread.cells.map((c) => ({ ...c, uid: UID++ })) }; setSpreads((sp) => { const n = sp.slice(); n.splice(cur + 1, 0, clone); return n; }); setCur(cur + 1); setSel(null); };
  const moveSpread = (dir: -1 | 1) => { const j = cur + dir; if (j < 0 || j >= spreads.length) return; snapshot(); setSpreads((sp) => { const n = sp.slice(); [n[cur], n[j]] = [n[j], n[cur]]; return n; }); setCur(j); };
  // Drag a photo from the library onto a cell (fill / replace).
  const dragLib = useRef<Lib | null>(null);

  /* ── AI auto-fill ───────────────────────────────────────────────────── */
  // Fill every empty photo cell in `base`, matching cell↔photo orientation and
  // preferring least-used photos. Pure — returns new spreads.
  function fillEmpty(base: Spread[]): Spread[] {
    const use: Record<string, number> = {};
    base.forEach((s) => s.cells.forEach((c) => { const id = c.photo?.match(/id=([^&]+)/)?.[1]; if (id) use[id] = (use[id] || 0) + 1; }));
    return base.map((s) => ({
      ...s,
      cells: s.cells.map((c) => {
        if (c.type !== "photo" || c.photo) return c;
        const cellOrient: Orient = (c.w / c.h) * aspect > 1.15 ? "l" : (c.w / c.h) * aspect < 0.87 ? "p" : "s";
        const cand = [...lib].sort((a, b) => {
          const ma = orient(a.id) === cellOrient ? 0 : 1, mb = orient(b.id) === cellOrient ? 0 : 1;
          if (ma !== mb) return ma - mb;
          return (use[a.id] || 0) - (use[b.id] || 0);
        })[0];
        if (!cand) return c;
        use[cand.id] = (use[cand.id] || 0) + 1;
        return { ...c, photo: cand.thumb, full: cand.full, scale: 1, posX: 50, posY: 50 };
      }),
    }));
  }
  function autoFill() {
    if (!lib.length) { showToast("Hãy nạp thư viện ảnh trước."); return; }
    snapshot();
    const before = spreads.flatMap((s) => s.cells).filter((c) => c.photo).length;
    const next = fillEmpty(spreads);
    setSpreads(next);
    showToast(`AI đã rải ${Math.max(0, next.flatMap((s) => s.cells).filter((c) => c.photo).length - before)} ảnh — khớp hướng ảnh`);
  }
  // SmartAlbum-style "tự thiết kế cả album": tạo đủ số trang cho toàn bộ ảnh rồi
  // rải tự động — một chạm ra album hoàn chỉnh.
  /* ── Auto Design có XEM TRƯỚC phương án ─────────────────────────────────── */
  const blankPhotoCell = useCallback(([x, y, w, h]: Rect): Cell => ({ uid: UID++, type: "photo", x, y, w, h, photo: null, full: null, scale: 1, posX: 50, posY: 50, filter: "none", text: "", role: "body", align: "center", size: null, color: null, overlay: false, upper: false }), []);
  // Dựng phương án: chia ảnh vào N spread, mỗi spread 1 bố cục theo số ảnh.
  const buildAutoPlan = useCallback((spreadsN: number, minC: number, maxC: number): { count: number; rects: Rect[] }[] => {
    const total = Math.max(lib.length, spreadsN); // đảm bảo đủ ảnh danh nghĩa
    const plan: { count: number; rects: Rect[] }[] = [];
    let remaining = total;
    for (let i = 0; i < spreadsN; i++) {
      const left = spreadsN - i;
      let c = Math.round(remaining / left);
      c = Math.max(minC, Math.min(maxC, c));
      c = Math.min(c, Math.max(minC, remaining - (left - 1) * minC)); // chừa min cho các trang sau
      c = Math.max(1, Math.min(9, c));
      remaining -= c;
      const vs = layoutVariants(c, aspect);
      const rects = vs.length ? vs[(i * 3 + c) % vs.length] : [[2, 2, 96, 96] as Rect];
      plan.push({ count: c, rects });
    }
    return plan;
  }, [lib.length, aspect]);
  const openAuto = () => {
    if (!lib.length) { showToast("Hãy nạp thư viện ảnh trước."); return; }
    setAutoPlan(buildAutoPlan(autoSpreads, autoMin, autoMax));
    setShowAuto(true);
  };
  const regenAuto = () => setAutoPlan(buildAutoPlan(autoSpreads, autoMin, autoMax));
  function applyAutoPlan() {
    snapshot();
    const built: Spread[] = autoPlan.map((p, i) => ({ id: i + 1, layout: `auto:${p.count}`, cells: p.rects.map(blankPhotoCell) }));
    setSpreads(fillEmpty(built));
    setCur(0); setSel(null); setShowAuto(false);
    showToast(`Đã tạo ${built.length} spread theo phương án.`);
  }
  // "Dàn lại": đổi bố cục MỌI trang sang một biến thể khác (giữ nguyên ảnh & chữ)
  // — một chạm làm mới cách dàn cả cuốn album.
  function reflowAll() {
    snapshot();
    setSpreads((sp) => sp.map((s, idx) => {
      const photos = s.cells.filter((c) => c.type === "photo" && c.photo);
      const texts = s.cells.filter((c) => c.type === "text");
      const n = Math.max(1, s.cells.filter((c) => c.type === "photo").length);
      const vs = layoutVariants(n, aspect);
      if (!vs.length) return s;
      const pick = vs[(idx + 1) % vs.length]; // lệch theo trang để đa dạng
      let pi = 0;
      const photoCells: Cell[] = pick.map(([x, y, w, h]) => {
        const base: Cell = { uid: UID++, type: "photo", x, y, w, h, photo: null, full: null, scale: 1, posX: 50, posY: 50, filter: "none", text: "", role: "body", align: "center", size: null, color: null, overlay: false, upper: false };
        const p = photos[pi++];
        return p ? { ...base, photo: p.photo, full: p.full, scale: p.scale, posX: p.posX, posY: p.posY, filter: p.filter } : base;
      });
      return { ...s, layout: `auto:${pick.length}`, cells: [...photoCells, ...texts] };
    }));
    setSel(null);
    showToast("Đã dàn lại bố cục toàn album.");
  }

  /* ── Khóa layer ─────────────────────────────────────────────────────── */
  const toggleLock = (uid: number) => patchCell(uid, { locked: !spread.cells.find((c) => c.uid === uid)?.locked });
  const setSpreadBg = (bg?: string) => { snapshot(); setSpreads((sp) => sp.map((s, i) => i !== cur ? s : { ...s, bg })); };

  /* ── Sắp xếp lại trang bằng kéo-thả (dải trang dưới cùng) ───────────── */
  function reorderSpread(from: number, to: number) {
    if (from === to || from < 0 || to < 0 || from >= spreads.length || to >= spreads.length) return;
    snapshot();
    setSpreads((sp) => { const n = sp.slice(); const [m] = n.splice(from, 1); n.splice(to, 0, m); return n; });
    setCur(to); setSel(null);
  }

  /* ── Lưu / tự lưu lên server ────────────────────────────────────────── */
  const save = useCallback(async (silent = false): Promise<void> => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/album-designer/designs", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: designId, name, size, tpl, spreads, folder }),
      });
      const d = await res.json();
      if (!res.ok) { if (!silent) showToast(d.error === "too_large" ? "Album quá lớn để lưu." : "Lưu thất bại."); return; }
      if (d.id && !designId) setDesignId(d.id);
      dirty.current = false;
      if (!silent) showToast("Đã lưu album.");
    } catch { if (!silent) showToast("Lỗi mạng khi lưu."); }
    finally { setSaving(false); }
  }, [saving, designId, name, size, tpl, spreads, folder]);

  // Tự lưu mỗi 20s nếu có thay đổi VÀ album đã từng được lưu (có id) —
  // tránh tạo bản nháp rác khi người dùng chỉ xem thử.
  useEffect(() => {
    const t = setInterval(() => { if (dirty.current && designId) save(true); }, 20_000);
    return () => clearInterval(t);
  }, [designId, save]);

  /* ── DPI ────────────────────────────────────────────────────────────── */
  function cellDpi(c: Cell): number | null {
    if (!c.photo) return null;
    // dims keyed by drive id; the thumb URL carries an id= param.
    const id = c.photo.match(/id=([^&]+)/)?.[1] || "";
    const dd = dims.current[id]; if (!dd || dd.approx) return null; // need true pixel size
    const cellWcm = (c.w / 100) * (2 * size.w), cellHcm = (c.h / 100) * size.h;
    const cellCm = Math.min(cellWcm, cellHcm);
    return Math.round((Math.min(dd.w, dd.h) / c.scale) / (cellCm / 2.54));
  }

  /* ── Export (JPG/PNG từng trang · PDF chuẩn in cả cuốn) ─────────────────
   * `bleedMm` > 0: mở rộng canvas ra mỗi phía; ô ảnh CHẠM mép trim được kéo
   * giãn vào vùng bleed để sau khi nhà in xén không lộ viền trắng. */
  const loadImg = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => res(im); im.onerror = rej; im.src = src; });
  async function renderSpreadCanvas(s: Spread, bleed_mm: number): Promise<HTMLCanvasElement> {
    const DPI = 300;
    const trimW = Math.round((2 * size.w) * DPI / 2.54), trimH = Math.round(size.h * DPI / 2.54);
    const bl = Math.round((bleed_mm / 10) * DPI / 2.54);
    const W = trimW + 2 * bl, H = trimH + 2 * bl;
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d")!; ctx.fillStyle = s.bg || tpl.page; ctx.fillRect(0, 0, W, H);
    const kpx = trimH / baseH; // px thiết kế → px export (bo góc/viền/blur)
    for (const c of s.cells) {
      let cx = bl + (c.x / 100) * trimW, cy = bl + (c.y / 100) * trimH;
      let cw = (c.w / 100) * trimW, ch = (c.h / 100) * trimH;
      if (bl > 0 && c.type === "photo") {
        // Kéo ô sát mép trim ra tận mép giấy (bleed) để tránh viền trắng khi xén.
        if (c.x <= 0.5) { cx -= bl; cw += bl; }
        if (c.y <= 0.5) { cy -= bl; ch += bl; }
        if (c.x + c.w >= 99.5) cw += bl;
        if (c.y + c.h >= 99.5) ch += bl;
      }
      if (c.type === "photo" && c.full) {
        try {
          // raw=1: ảnh gốc phải về cùng miền để canvas xuất được file in.
          const im = await loadImg(c.full + (c.full.includes("?") ? "&" : "?") + "raw=1");
          ctx.save(); cellPath(ctx, c, cx, cy, cw, ch, kpx); ctx.clip(); ctx.filter = cellFilter(c, kpx);
          const s0 = Math.max(cw / im.width, ch / im.height) * c.scale, dw = im.width * s0, dh = im.height * s0;
          const dx = cx + (cw - dw) * (c.posX / 100), dy = cy + (ch - dh) * (c.posY / 100);
          ctx.drawImage(im, dx, dy, dw, dh);
          ctx.filter = "none";
          if (c.tint && c.tintA) { ctx.globalAlpha = c.tintA / 100; ctx.fillStyle = c.tint; ctx.fillRect(cx, cy, cw, ch); ctx.globalAlpha = 1; }
          ctx.restore();
          if (c.borderW) { ctx.save(); cellPath(ctx, c, cx, cy, cw, ch, kpx); ctx.lineWidth = c.borderW * kpx; ctx.strokeStyle = c.borderColor || "#ffffff"; ctx.stroke(); ctx.restore(); }
        } catch { /* skip broken image */ }
      } else if (c.type === "text" && c.text) {
        ctx.save(); ctx.fillStyle = c.color || (c.overlay ? "#fff" : tpl.ink);
        const fs = (c.size || ROLE_SIZE[c.role]) * (trimH / baseH);
        ctx.font = `${fs}px ${c.role === "body" ? "Manrope, sans-serif" : "'Cormorant Garamond', serif"}`;
        ctx.textAlign = c.align; ctx.textBaseline = "middle";
        const tx = c.align === "center" ? cx + cw / 2 : c.align === "right" ? cx + cw : cx;
        (c.upper ? c.text.toUpperCase() : c.text).split("\n").forEach((line, li) => ctx.fillText(line, tx, cy + ch / 2 + li * fs * 1.2));
        ctx.restore();
      }
    }
    return cv;
  }
  const canvasToBytes = (cv: HTMLCanvasElement, q = 0.95): Promise<Uint8Array> =>
    new Promise((res) => cv.toBlob(async (b) => res(new Uint8Array(await b!.arrayBuffer())), "image/jpeg", q));

  async function exportImages(indices: number[]) {
    for (const i of indices) {
      const cv = await renderSpreadCanvas(spreads[i], 0); // ảnh: không bleed
      const mime = fmt === "png" ? "image/png" : "image/jpeg";
      const ext = fmt === "png" ? "png" : "jpg";
      const blob: Blob = await new Promise((res) => cv.toBlob((b) => res(b!), mime, fmt === "png" ? undefined : 0.95));
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `album-${size.name}-trang-${i + 1}.${ext}`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      await new Promise((r) => setTimeout(r, 450));
    }
  }
  async function exportPdf(indices: number[]) {
    const trimWpt = cmToPt(2 * size.w), trimHpt = cmToPt(size.h), blPt = cmToPt(bleedMm / 10);
    const pages: PdfPageSpec[] = [];
    for (const i of indices) {
      const cv = await renderSpreadCanvas(spreads[i], bleedMm);
      pages.push({
        jpeg: await canvasToBytes(cv), widthPx: cv.width, heightPx: cv.height,
        boxWpt: trimWpt + 2 * blPt, boxHpt: trimHpt + 2 * blPt, trimMarginPt: blPt,
      });
    }
    const blob = buildPdf(pages);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `album-${size.name}-${pages.length}trang.pdf`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 8000);
  }
  async function exportPages(indices: number[]) {
    const list = indices.filter((i) => i >= 0 && i < spreads.length).sort((a, b) => a - b);
    if (!list.length) { showToast("Chưa chọn trang nào để xuất."); return; }
    setShowExport(false);
    setExporting(true);
    try {
      if (fmt === "pdf") { await exportPdf(list); showToast(`Đã xuất PDF ${list.length} trang · 300 DPI · bleed ${bleedMm}mm + dấu cắt.`); }
      else { await exportImages(list); showToast(`Đã xuất ${list.length} trang (${fmt.toUpperCase()} · 300 DPI · ảnh gốc).`); }
    }
    catch { showToast("Xuất file gặp lỗi — thử lại hoặc giảm số trang."); }
    finally { setExporting(false); }
  }

  /* ── Render ─────────────────────────────────────────────────────────── */
  const panel: React.CSSProperties = { background: "var(--panel)", border: "1px solid var(--border)" };
  const scenesUsed = usedIds.size;
  const bar = "flex items-center justify-center rounded-lg px-2 h-8 text-sm";
  // Bố cục hiển thị trên dải ngang theo nguồn đang chọn.
  const railLayouts: Rect[][] =
    laySrc === "mine" ? mine.filter((m) => !laySearch || m.name.toLowerCase().includes(laySearch.toLowerCase())).map((m) => m.rects)
    : laySrc === "fav" ? favs
    : variants;
  const nbW = spreadPxW * 0.52, nbH = spreadPxH * 0.52; // spread hàng xóm (chế độ Nhiều Spread)

  return (
    <div className="page-in">
      {/* ── Thanh công cụ trên ── */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5 rounded-2xl p-2" style={panel}>
        <button onClick={onBack} className={`btn-ghost ${bar} gap-1`} title="Đổi khổ / mở album khác"><ArrowLeft size={15} /></button>
        <input value={name} onChange={(e) => { setName(e.target.value); dirty.current = true; }} className="input h-8 w-40 text-sm font-semibold" placeholder="Tên album" />
        <span className="mx-0.5 h-5 w-px" style={{ background: "var(--border)" }} />
        <button onClick={() => { setCur((c) => Math.max(0, c - 1)); setSel(null); }} disabled={cur === 0} className={`btn-ghost ${bar} disabled:opacity-40`}><ChevronLeft size={16} /></button>
        <span className="min-w-[52px] text-center text-xs font-semibold" style={{ color: "var(--text2)" }}>{cur + 1}/{spreads.length}</span>
        <button onClick={() => { setCur((c) => Math.min(spreads.length - 1, c + 1)); setSel(null); }} disabled={cur === spreads.length - 1} className={`btn-ghost ${bar} disabled:opacity-40`}><ChevronRight size={16} /></button>
        <span className="mx-0.5 h-5 w-px" style={{ background: "var(--border)" }} />
        <button onClick={() => setShowLib((v) => !v)} className={`btn-ghost ${bar} gap-1`} title="Thư viện ảnh" style={{ color: showLib ? "var(--brand)" : "var(--text2)" }}><Images size={15} /></button>
        <button onClick={addText} className={`btn-ghost ${bar} gap-1`} title="Thêm dòng chữ"><Type size={15} /></button>
        <button onClick={openAuto} className={`btn-ghost ${bar} gap-1`}><Wand2 size={15} /> Auto Design</button>
        <button onClick={reflowAll} className={`btn-ghost ${bar} gap-1`}><Shuffle size={15} /> Dàn lại</button>
        <button onClick={() => selCell && toggleLock(selCell.uid)} disabled={!selCell} className={`btn-ghost ${bar} gap-1 disabled:opacity-40`} title="Khóa/mở khóa layer" style={{ color: selCell?.locked ? "var(--brand)" : "var(--text2)" }}>{selCell?.locked ? <Lock size={15} /> : <Unlock size={15} />}</button>
        <button onClick={dupSpread} className={`btn-ghost ${bar} gap-1`}><Copy size={15} /> Clone</button>
        <span className="flex-1" />
        <button onClick={undo} disabled={!hist.current.length} className={`btn-ghost ${bar} disabled:opacity-40`}><Undo2 size={15} /></button>
        <button onClick={redo} disabled={!fut.current.length} className={`btn-ghost ${bar} disabled:opacity-40`}><Redo2 size={15} /></button>
        <div className="flex overflow-hidden rounded-lg text-xs font-semibold" style={panel}>
          {(["pdf", "jpg", "png"] as const).map((f) => (
            <button key={f} onClick={() => setFmt(f)} className="px-2.5 py-2" style={{ background: fmt === f ? "var(--brandSoft)" : "transparent", color: fmt === f ? "var(--brand)" : "var(--text2)" }}>{f.toUpperCase()}</button>
          ))}
        </div>
        <button onClick={() => save()} disabled={saving} className={`btn-ghost ${bar} gap-1.5`}>{saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Lưu</button>
        <button onClick={() => { setExportSel(new Set(spreads.map((_, i) => i))); setShowExport(true); }} disabled={exporting} className="btn-primary gap-1.5">{exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Xuất</button>
      </div>

      {/* ── Dải bố cục ngang ── */}
      <div className="mb-2 rounded-2xl p-2" style={panel}>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setRailOpen((o) => !o)} className={`btn-ghost ${bar} gap-1 font-semibold`}><LayoutGrid size={14} /> Bố cục</button>
          {railOpen && (<>
            <div className="flex gap-1">
              {([["all", "Tất cả"], ["mine", "Của tôi"], ["fav", "Yêu thích"]] as const).map(([k, l]) => (
                <button key={k} onClick={() => setLaySrc(k)} className="rounded-md px-2 py-1 text-xs font-semibold" style={{ background: laySrc === k ? "var(--brand)" : "var(--surface)", color: laySrc === k ? "#fff" : "var(--text2)", border: "1px solid var(--border)" }}>{l}</button>
              ))}
            </div>
            {laySrc === "all" && (
              <div className="flex items-center gap-1">
                <span className="text-[11px]" style={{ color: "var(--text3)" }}>Số ảnh</span>
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <button key={n} onClick={() => chooseCount(n)} className="h-7 w-7 rounded-md text-xs font-semibold" style={{ background: pickCount === n ? "var(--brand)" : "var(--surface)", color: pickCount === n ? "#fff" : "var(--text2)", border: "1px solid var(--border)" }}>{n}</button>
                ))}
              </div>
            )}
            <input value={laySearch} onChange={(e) => setLaySearch(e.target.value)} placeholder="Tìm tên / category…" className="input h-7 w-40 text-xs" />
            <button onClick={saveMine} className={`btn-ghost ${bar} gap-1 text-xs`}><Plus size={13} /> Lưu bố cục</button>
          </>)}
        </div>
        {railOpen && (
          railLayouts.length ? (
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {railLayouts.map((v, i) => {
                const active = sig(v) === curPhotoSig, faved = favSet.has(sig(v));
                return (
                  <div key={i} className="relative flex-none" style={{ width: 88 }}>
                    <button onClick={() => applyRects(v)} className="w-full rounded-lg p-1" style={{ border: `2px solid ${active ? "var(--brand)" : "var(--border)"}` }}><LayoutMini rects={v} aspect={aspect} active={active} /></button>
                    <button onClick={() => toggleFav(v)} title="Yêu thích" className="absolute right-1 top-1 leading-none text-[13px]" style={{ color: faved ? "#e0b85c" : "var(--text3)" }}>{faved ? "★" : "☆"}</button>
                  </div>
                );
              })}
            </div>
          ) : <p className="mt-2 text-center text-xs" style={{ color: "var(--text3)" }}>{laySrc === "mine" ? "Chưa có bố cục đã lưu. Chọn trang rồi nhấn “Lưu bố cục”." : "Chưa có bố cục yêu thích. Nhấn ☆ trên mẫu."}</p>
        )}
      </div>

      {/* ── Khu làm việc ── */}
      <div className="flex items-start gap-3">
        {/* Thư viện ảnh (thu gọn được) */}
        {showLib && (
          <div className="w-[200px] flex-none rounded-2xl p-3" style={panel}>
            <p className="text-sm font-extrabold">Thư viện ảnh</p>
            <p className="mb-2 text-[11.5px]" style={{ color: "var(--text2)" }}>{lib.length} ảnh · {scenesUsed} đã dùng</p>
            <div className="mb-2 flex gap-1">
              <input value={folder} onChange={(e) => setFolder(e.target.value)} placeholder="Dán link folder Drive…" className="input flex-1 text-xs" />
              <button onClick={loadLibrary} disabled={loadingLib} className="btn-ghost px-2">{loadingLib ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}</button>
            </div>
            <div className="grid max-h-[46vh] grid-cols-2 gap-1.5 overflow-y-auto">
              {lib.map((p) => (
                <button key={p.id} onClick={() => onThumbClick(p)} draggable onDragStart={() => { dragLib.current = p; }} className="relative aspect-square overflow-hidden rounded-lg" style={{ cursor: "grab" }}>
                  <img src={p.thumb} alt="" className="h-full w-full object-cover" loading="lazy" draggable={false} />
                  {usedIds.has(p.thumb) && <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] text-white" style={{ background: "var(--brand)" }}>✓</span>}
                </button>
              ))}
            </div>
            <button onClick={openAuto} className="btn-primary mt-2 w-full gap-1.5"><Wand2 size={15} /> Tự thiết kế cả album</button>
            <button onClick={autoFill} className="btn-ghost mt-1.5 w-full gap-1.5 text-sm"><Wand2 size={14} /> Rải vào ô trống</button>
            <p className="mt-1 text-center text-[11px]" style={{ color: "var(--text3)" }}>Kéo ảnh vào ô · tự khớp hướng ảnh</p>
          </div>
        )}

        {/* Canvas + thanh trạng thái */}
        <div className="min-w-0 flex-1">
          <div ref={stageRef} className="flex items-center justify-center gap-4 overflow-hidden rounded-2xl p-4" style={{ ...panel, minHeight: 440 }}>
            {/* Spread trước (ngữ cảnh) */}
            {multi && cur > 0 && (
              <button onClick={() => { setCur(cur - 1); setSel(null); }} className="flex-none opacity-60 transition-opacity hover:opacity-90" title="Spread trước">
                <SpreadView s={spreads[cur - 1]} w={nbW} h={nbH} page={tpl.page} ink={tpl.ink} />
              </button>
            )}
            {/* Spread hiện tại — tương tác */}
            <div onClick={() => setSel(null)} style={{ position: "relative", width: spreadPxW, height: spreadPxH, background: spread?.bg || tpl.page, boxShadow: "0 10px 40px rgba(0,0,0,.18)" }}>
              <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "rgba(0,0,0,.08)" }} />
              {spread?.cells.map((c) => {
                const selected = c.uid === sel;
                const dpi = c.type === "photo" ? cellDpi(c) : null;
                return (
                  <div key={c.uid} onPointerDown={(e) => onCellDown(e, c, "move")}
                    onDragOver={c.type === "photo" ? (e) => e.preventDefault() : undefined}
                    onDrop={c.type === "photo" ? () => { if (dragLib.current) { fillCell(c.uid, dragLib.current); dragLib.current = null; } } : undefined}
                    onDoubleClick={() => { if (c.type === "photo" && c.photo) patchCell(c.uid, { scale: 1, posX: 50, posY: 50 }); }}
                    style={{ position: "absolute", left: `${c.x}%`, top: `${c.y}%`, width: `${c.w}%`, height: `${c.h}%`, outline: selected ? "2.5px solid var(--brand)" : "none", cursor: c.locked ? "default" : "grab", overflow: "visible" }}>
                    <div style={{ position: "absolute", inset: 0, overflow: "hidden", boxSizing: "border-box", borderRadius: c.type === "photo" ? cellRadius(c, scale) : undefined, border: c.type === "photo" && c.borderW ? `${c.borderW * scale}px solid ${c.borderColor || "#ffffff"}` : undefined }}>
                      {c.type === "photo" ? (c.photo ? (<>
                        <img src={c.photo} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: `${c.posX}% ${c.posY}%`, transform: `scale(${c.scale})`, filter: cellFilter(c, scale) }} />
                        {!!(c.tint && c.tintA) && <div style={{ position: "absolute", inset: 0, background: c.tint!, opacity: (c.tintA ?? 0) / 100, pointerEvents: "none" }} />}
                      </>) : (
                        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "var(--text3)", background: "repeating-linear-gradient(45deg,var(--surface),var(--surface) 6px,var(--surface2) 6px,var(--surface2) 12px)" }}>＋ Kéo ảnh</div>
                      )) : (
                        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: c.align === "center" ? "center" : c.align === "right" ? "flex-end" : "flex-start", textAlign: c.align, padding: 4, fontFamily: c.role === "body" ? "var(--font-manrope), sans-serif" : "var(--font-cormorant), serif", fontSize: (c.size || ROLE_SIZE[c.role]) * scale, color: c.color || (c.overlay ? "#fff" : tpl.ink), textTransform: c.upper ? "uppercase" : "none", letterSpacing: c.role === "sub" ? ".18em" : undefined, lineHeight: c.role === "body" ? 1.7 : 1.2, textShadow: c.overlay ? "0 1px 6px rgba(0,0,0,.5)" : undefined, whiteSpace: "pre-wrap" }}>{c.text}</div>
                      )}
                    </div>
                    {c.locked && <span style={{ position: "absolute", right: 3, top: 3, background: "var(--brand)", color: "#fff", borderRadius: 4, padding: "1px 3px", fontSize: 9 }}>🔒</span>}
                    {dpi != null && dpi < 230 && <span style={{ position: "absolute", left: 4, bottom: 4, fontSize: 9, fontWeight: 700, padding: "1px 4px", borderRadius: 4, color: "#fff", background: dpi < 150 ? "#cc4b4b" : "#c08a1e" }}>{dpi < 150 ? "⚠ " : ""}{dpi} DPI</span>}
                    {selected && !c.locked && (["nw", "ne", "sw", "se"] as const).map((m) => (
                      <span key={m} onPointerDown={(e) => onCellDown(e, c, m)} style={{ position: "absolute", width: 12, height: 12, background: "var(--brand)", borderRadius: 2, cursor: `${m}-resize`, left: m.includes("w") ? -6 : undefined, right: m.includes("e") ? -6 : undefined, top: m.includes("n") ? -6 : undefined, bottom: m.includes("s") ? -6 : undefined }} />
                    ))}
                  </div>
                );
              })}
            </div>
            {/* Spread sau (ngữ cảnh) */}
            {multi && cur < spreads.length - 1 && (
              <button onClick={() => { setCur(cur + 1); setSel(null); }} className="flex-none opacity-60 transition-opacity hover:opacity-90" title="Spread sau">
                <SpreadView s={spreads[cur + 1]} w={nbW} h={nbH} page={tpl.page} ink={tpl.ink} />
              </button>
            )}
          </div>

          {/* Thanh trạng thái */}
          <div className="mt-2 flex flex-wrap items-center gap-3 rounded-xl px-3 py-1.5 text-xs" style={{ ...panel, color: "var(--text2)" }}>
            <span>{multi ? "Nhiều Spread" : "1 Spread"} · {spreads.length} trang · {Math.round(zoom * 100)}%</span>
            <span className="text-[11px]" style={{ color: "var(--text3)" }}>click chọn layer · kéo ảnh để đổi</span>
            <span className="flex-1" />
            <button onClick={() => setZoom((z) => clamp(+(z - 0.1).toFixed(1), 0.5, 1.6))} className="px-1.5 text-base">−</button>
            <input type="range" min={0.5} max={1.6} step={0.05} value={zoom} onChange={(e) => setZoom(+e.target.value)} className="w-28 accent-[var(--brand)]" />
            <button onClick={() => setZoom((z) => clamp(+(z + 0.1).toFixed(1), 0.5, 1.6))} className="px-1.5 text-base">+</button>
            <button onClick={() => setZoom(1)} className="btn-ghost gap-1 px-2 py-1"><Maximize size={13} /> Fit</button>
            <button onClick={() => setMulti((v) => !v)} className="rounded-md px-2 py-1 font-semibold" style={{ background: multi ? "var(--brandSoft)" : "transparent", color: multi ? "var(--brand)" : "var(--text2)", border: "1px solid var(--border)" }}>Nhiều Spread</button>
          </div>

          {/* ── Dải trang (kéo-thả để sắp xếp) ── */}
          <div className="mt-2 flex items-center gap-2 overflow-x-auto rounded-2xl p-2" style={panel}>
            {spreads.map((s, i) => (
              <button key={s.id} onClick={() => { setCur(i); setSel(null); }}
                draggable onDragStart={() => { dragPage.current = i; }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => { if (dragPage.current != null) { reorderSpread(dragPage.current, i); dragPage.current = null; } }}
                className="flex-none rounded-lg p-1" style={{ border: `2px solid ${i === cur ? "var(--brand)" : "transparent"}`, cursor: "grab" }} title="Kéo để đổi thứ tự trang">
                <SpreadView s={s} w={64} h={64 / aspect} page={tpl.page} ink={tpl.ink} />
                <span className="mt-0.5 block text-center text-[10px]" style={{ color: "var(--text3)" }}>{i === 0 ? "Bìa" : i + 1}</span>
              </button>
            ))}
            <button onClick={addSpread} className="flex-none rounded-lg px-3 py-4 text-lg" style={{ border: "1px dashed var(--border)", color: "var(--text3)" }} title="Thêm trang">＋</button>
          </div>
        </div>

        {/* Panel thuộc tính (theo ngữ cảnh) */}
        <div className="w-[280px] flex-none rounded-2xl p-3" style={panel}>
          {/* Công cụ trang — luôn hiển thị */}
          <p className="mb-2 text-sm font-extrabold">{cur === 0 ? "Bìa" : `Trang ${cur + 1}`} <span className="text-[11px] font-normal" style={{ color: "var(--text3)" }}>· {size.name}</span></p>
          <div className="mb-2 grid grid-cols-2 gap-1.5">
            <button onClick={dupSpread} className="btn-ghost gap-1 text-xs"><Copy size={13} /> Nhân đôi</button>
            <button onClick={delSpread} className="btn-ghost gap-1 text-xs" style={{ color: "#cc4b4b" }}><Trash2 size={13} /> Xoá trang</button>
            <button onClick={() => moveSpread(-1)} disabled={cur === 0} className="btn-ghost gap-1 text-xs disabled:opacity-40"><ChevronLeft size={13} /> Trước</button>
            <button onClick={() => moveSpread(1)} disabled={cur === spreads.length - 1} className="btn-ghost gap-1 text-xs disabled:opacity-40">Sau <ChevronRight size={13} /></button>
            <button onClick={shuffle} className="btn-ghost col-span-2 gap-1 text-xs"><Shuffle size={13} /> Đổi vị trí ảnh trong trang</button>
          </div>
          {/* Nền trang */}
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold" style={{ color: "var(--text2)" }}>Nền trang</span>
            <button onClick={() => setSpreadBg(undefined)} className="rounded-md px-2 py-1 text-[11px]" style={{ border: "1px solid var(--border)", color: !spread?.bg ? "var(--brand)" : "var(--text2)" }}>Mặc định</button>
            {["#ffffff", "#faf6ef", "#f3ece2", "#efe7df", "#eef1ea", "#f7edf0", "#1a1a1c"].map((col) => (
              <button key={col} onClick={() => setSpreadBg(col)} className="h-6 w-6 rounded-full" style={{ background: col, border: `2px solid ${spread?.bg === col ? "var(--brand)" : "var(--border)"}` }} />
            ))}
            <input type="color" value={spread?.bg && spread.bg.startsWith("#") ? spread.bg : "#ffffff"} onChange={(e) => setSpreadBg(e.target.value)} className="h-6 w-8 rounded border" style={{ borderColor: "var(--border)" }} title="Màu tùy chọn" />
          </div>
          <div className="mb-3 h-px" style={{ background: "var(--border)" }} />

          {/* Ô ảnh được chọn */}
          {selCell?.type === "photo" && (<div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold">Ảnh</span>
              <button onClick={() => toggleLock(selCell.uid)} className="btn-ghost gap-1 px-2 py-1 text-xs" style={{ color: selCell.locked ? "var(--brand)" : "var(--text2)" }}>{selCell.locked ? <><Lock size={12} /> Đã khóa</> : <><Unlock size={12} /> Khóa</>}</button>
            </div>
            <Slider label="Phóng to" min={1} max={2.6} step={0.05} value={selCell.scale} onChange={(v) => patchCell(selCell.uid, { scale: v })} />
            <Slider label="Dời ngang" min={0} max={100} step={1} value={selCell.posX} onChange={(v) => patchCell(selCell.uid, { posX: v })} />
            <Slider label="Dời dọc" min={0} max={100} step={1} value={selCell.posY} onChange={(v) => patchCell(selCell.uid, { posY: v })} />
            <div>
              <p className="mb-1 text-xs font-semibold" style={{ color: "var(--text2)" }}>Bộ lọc màu</p>
              <div className="grid grid-cols-3 gap-1.5">
                {FILTERS.map((f) => (
                  <button key={f.k} onClick={() => patchCell(selCell.uid, { filter: f.k })} className="overflow-hidden rounded-md" style={{ border: `1.5px solid ${selCell.filter === f.k ? "var(--brand)" : "var(--border)"}` }}>
                    {selCell.photo && (
                      <img src={selCell.photo} alt="" className="h-10 w-full object-cover" style={{ filter: f.css }} />
                    )}
                    <span className="block py-0.5 text-center text-[10px]">{f.label}</span>
                  </button>
                ))}
              </div>
            </div>
            {/* Khung ảnh: bo góc / tròn-elip + viền */}
            <div>
              <p className="mb-1 text-xs font-semibold" style={{ color: "var(--text2)" }}>Khung ảnh</p>
              <div className="grid grid-cols-3 gap-1.5">
                {([["rect", "Vuông"], ["rounded", "Bo góc"], ["circle", "Tròn/Elip"]] as const).map(([sh, l]) => (
                  <button key={sh} onClick={() => patchCell(selCell.uid, { shape: sh })} className="rounded-md py-1.5 text-xs" style={{ border: `1.5px solid ${(selCell.shape || "rect") === sh ? "var(--brand)" : "var(--border)"}`, color: (selCell.shape || "rect") === sh ? "var(--brand)" : "var(--text2)" }}>{l}</button>
                ))}
              </div>
            </div>
            {selCell.shape === "rounded" && <Slider label="Độ bo góc" min={4} max={80} step={2} value={selCell.radius ?? 24} onChange={(v) => patchCell(selCell.uid, { radius: v })} />}
            <Slider label="Làm mờ (Blur)" min={0} max={16} step={0.5} value={selCell.blur ?? 0} onChange={(v) => patchCell(selCell.uid, { blur: v })} />
            <Slider label="Viền" min={0} max={12} step={1} value={selCell.borderW ?? 0} onChange={(v) => patchCell(selCell.uid, { borderW: v })} />
            {!!selCell.borderW && (
              <div className="flex flex-wrap gap-1.5">
                {["#ffffff", "#000000", "#b08968", "#c98a86", "#d4af37"].map((col) => (
                  <button key={col} onClick={() => patchCell(selCell.uid, { borderColor: col })} className="h-6 w-6 rounded-full" style={{ background: col, border: `2px solid ${(selCell.borderColor || "#ffffff") === col ? "var(--brand)" : "var(--border)"}` }} />
                ))}
              </div>
            )}
            {/* Phủ màu (tint / đổi màu) */}
            <div>
              <p className="mb-1 text-xs font-semibold" style={{ color: "var(--text2)" }}>Phủ màu</p>
              <div className="flex flex-wrap items-center gap-1.5">
                <button onClick={() => patchCell(selCell.uid, { tint: null, tintA: 0 })} className="rounded-md px-2 py-1 text-[11px]" style={{ border: "1px solid var(--border)", color: !selCell.tint ? "var(--brand)" : "var(--text2)" }}>Không</button>
                {["#000000", "#ffffff", "#b08968", "#c98a86", "#3f5a4a", "#7a5c5c"].map((col) => (
                  <button key={col} onClick={() => patchCell(selCell.uid, { tint: col, tintA: selCell.tintA || 35 })} className="h-6 w-6 rounded-full" style={{ background: col, border: `2px solid ${selCell.tint === col ? "var(--brand)" : "var(--border)"}` }} />
                ))}
              </div>
            </div>
            {!!selCell.tint && <Slider label="Độ đậm phủ màu" min={5} max={90} step={5} value={selCell.tintA ?? 35} onChange={(v) => patchCell(selCell.uid, { tintA: v })} />}
            {(() => { const dpi = cellDpi(selCell); return dpi != null ? <p className="text-[11.5px]" style={{ color: dpi < 150 ? "#cc4b4b" : dpi < 230 ? "#c08a1e" : "var(--text2)" }}>~{dpi} DPI · {dpi < 150 ? "quá thấp để in" : dpi < 230 ? "hơi thấp" : "tốt để in"}</p> : null; })()}
            <button onClick={() => clearPhoto(selCell.uid)} className="btn-ghost w-full text-sm">Bỏ ảnh khỏi ô</button>
          </div>)}

          {/* Dòng chữ được chọn */}
          {selCell?.type === "text" && (<div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold">Chữ</span>
              <button onClick={() => toggleLock(selCell.uid)} className="btn-ghost gap-1 px-2 py-1 text-xs" style={{ color: selCell.locked ? "var(--brand)" : "var(--text2)" }}>{selCell.locked ? <><Lock size={12} /> Đã khóa</> : <><Unlock size={12} /> Khóa</>}</button>
            </div>
            <textarea value={selCell.text} onChange={(e) => patchCell(selCell.uid, { text: e.target.value })} rows={2} className="input w-full text-sm" />
            <Slider label="Cỡ chữ" min={10} max={72} step={1} value={selCell.size || ROLE_SIZE[selCell.role]} onChange={(v) => patchCell(selCell.uid, { size: v })} />
            <div className="flex flex-wrap gap-1.5">
              {["#ffffff", "#1a1a1a", "#8a6d3b", "#b08968", "#7a5c5c", "#3f5a4a"].map((col) => (
                <button key={col} onClick={() => patchCell(selCell.uid, { color: col })} className="h-6 w-6 rounded-full" style={{ background: col, border: `2px solid ${selCell.color === col ? "var(--brand)" : "var(--border)"}` }} />
              ))}
            </div>
            <div className="flex gap-1">
              {(["left", "center", "right"] as const).map((a) => <button key={a} onClick={() => patchCell(selCell.uid, { align: a })} className="flex-1 rounded-md py-1.5 text-xs" style={{ background: selCell.align === a ? "var(--brandSoft)" : "var(--surface)", color: selCell.align === a ? "var(--brand)" : "var(--text2)" }}>{a === "left" ? "Trái" : a === "center" ? "Giữa" : "Phải"}</button>)}
            </div>
            <button onClick={() => delCell(selCell.uid)} className="btn-ghost w-full text-sm" style={{ color: "#cc4b4b" }}>Xoá dòng chữ</button>
          </div>)}

          {/* Không chọn gì → trang trí */}
          {!selCell && (<div>
            <p className="mb-2 text-xs font-semibold" style={{ color: "var(--text2)" }}>Chèn trang trí</p>
            <div className="grid grid-cols-2 gap-2">
              {DECOS.map((d) => <button key={d.label} onClick={() => addDeco(d)} className="rounded-lg py-3 text-center" style={{ border: "1px solid var(--border)" }}><div style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 20 }}>{d.text}</div><span className="text-[11px]" style={{ color: "var(--text2)" }}>{d.label}</span></button>)}
            </div>
            <p className="mt-3 text-center text-[11px]" style={{ color: "var(--text3)" }}>Nhấp một ô ảnh/chữ để chỉnh.</p>
          </div>)}
        </div>
      </div>

      {/* Export modal — chọn trang để xuất */}
      {showExport && (
        <div onClick={() => setShowExport(false)} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl p-5" style={{ background: "var(--panel)", boxShadow: "0 24px 70px rgba(0,0,0,.4)" }}>
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-base font-extrabold">Xuất album</h3>
              <button onClick={() => setShowExport(false)} className="text-xl" style={{ color: "var(--text3)" }}>×</button>
            </div>
            <p className="mb-3 text-xs" style={{ color: "var(--text2)" }}>{size.name} · {exportSel.size}/{spreads.length} trang · 300 DPI · ảnh gốc{fmt === "pdf" ? ` · bleed ${bleedMm}mm + dấu cắt` : ""}</p>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold" style={{ color: "var(--text2)" }}>Định dạng</span>
              <div className="flex overflow-hidden rounded-lg text-xs font-semibold" style={{ border: "1px solid var(--border)" }}>
                {(["pdf", "jpg", "png"] as const).map((f) => <button key={f} onClick={() => setFmt(f)} className="px-3 py-1.5" style={{ background: fmt === f ? "var(--brandSoft)" : "transparent", color: fmt === f ? "var(--brand)" : "var(--text2)" }}>{f.toUpperCase()}</button>)}
              </div>
              {fmt === "pdf" && (
                <label className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--text2)" }}>
                  Bleed
                  <select value={bleedMm} onChange={(e) => setBleedMm(+e.target.value)} className="input px-1.5 py-1 text-xs">
                    {[0, 3, 5].map((b) => <option key={b} value={b}>{b}mm</option>)}
                  </select>
                </label>
              )}
              <span className="flex-1" />
              <button onClick={() => setExportSel(new Set(spreads.map((_, i) => i)))} className="text-xs font-semibold" style={{ color: "var(--brand)" }}>Chọn tất cả</button>
              <button onClick={() => setExportSel(new Set())} className="text-xs font-semibold" style={{ color: "var(--text3)" }}>Bỏ chọn</button>
            </div>
            <div className="grid max-h-[46vh] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
              {spreads.map((s, i) => {
                const on = exportSel.has(i);
                return (
                  <button key={s.id} onClick={() => setExportSel((prev) => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n; })} className="rounded-lg p-1 text-left" style={{ border: `2px solid ${on ? "var(--brand)" : "var(--border)"}` }}>
                    <div style={{ position: "relative", width: "100%", aspectRatio: `${aspect}`, background: tpl.page, borderRadius: 4, overflow: "hidden" }}>
                      {s.cells.filter((c) => c.type === "photo").map((c, k) => <span key={k} style={{ position: "absolute", left: `${c.x}%`, top: `${c.y}%`, width: `${c.w}%`, height: `${c.h}%`, background: c.photo ? "var(--brand)" : "var(--surface2)", opacity: c.photo ? 0.5 : 1, borderRadius: 1 }} />)}
                      {on && <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] text-white" style={{ background: "var(--brand)" }}>✓</span>}
                    </div>
                    <span className="mt-1 block text-[11px]" style={{ color: "var(--text3)" }}>{i === 0 ? "Bìa" : `Trang ${i + 1}`}</span>
                  </button>
                );
              })}
            </div>
            <button onClick={() => exportPages([...exportSel])} disabled={!exportSel.size} className="btn-primary mt-4 w-full gap-1.5 disabled:opacity-50"><Download size={15} /> Xuất {exportSel.size} trang ({fmt.toUpperCase()})</button>
          </div>
        </div>
      )}

      {/* Auto Design — xem trước phương án trước khi áp dụng */}
      {showAuto && (
        <div onClick={() => setShowAuto(false)} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl rounded-2xl p-5" style={{ background: "var(--panel)", boxShadow: "0 24px 70px rgba(0,0,0,.4)", maxHeight: "88vh", overflowY: "auto" }}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-extrabold">Tự động thiết kế Album</h3>
              <button onClick={() => setShowAuto(false)} className="text-xl" style={{ color: "var(--text3)" }}>×</button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Tùy chọn */}
              <div className="space-y-3">
                <p className="text-xs" style={{ color: "var(--text2)" }}>{lib.length} ảnh trong thư viện · tạo spread mới rồi rải ảnh tự động.</p>
                <label className="block text-xs font-semibold" style={{ color: "var(--text2)" }}>Số spread
                  <input type="number" min={1} max={60} value={autoSpreads} onChange={(e) => setAutoSpreads(clamp(+e.target.value || 1, 1, 60))} className="input mt-1 w-full text-sm" />
                </label>
                <Slider label="Số ảnh tối thiểu / trang" min={1} max={9} step={1} value={autoMin} onChange={(v) => setAutoMin(Math.min(v, autoMax))} />
                <Slider label="Số ảnh tối đa / trang" min={1} max={9} step={1} value={autoMax} onChange={(v) => setAutoMax(Math.max(v, autoMin))} />
                <button onClick={regenAuto} className="btn-ghost w-full gap-1.5 text-sm"><Shuffle size={14} /> Tạo lại phương án</button>
              </div>
              {/* Xem trước phương án */}
              <div>
                <p className="mb-2 text-xs font-semibold" style={{ color: "var(--text2)" }}>Xem trước phương án ({autoPlan.length} spread)</p>
                <div className="max-h-[46vh] space-y-1.5 overflow-y-auto rounded-lg p-1" style={{ background: "var(--surface2)" }}>
                  {autoPlan.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-md px-2 py-1.5" style={{ background: "var(--panel)" }}>
                      <span style={{ width: 54, flexShrink: 0, display: "block" }}><LayoutMini rects={p.rects} aspect={aspect} /></span>
                      <span className="text-xs font-semibold">Spread {i + 1}</span>
                      <span className="ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: "var(--brandSoft)", color: "var(--brand)" }}>{p.count} ảnh</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowAuto(false)} className="btn-ghost text-sm">Hủy</button>
              <button onClick={applyAutoPlan} className="btn-primary gap-1.5 text-sm"><Wand2 size={15} /> Áp dụng</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div style={{ position: "fixed", left: "50%", bottom: 24, transform: "translateX(-50%)", zIndex: 90, background: "var(--brand)", color: "#fff", padding: "10px 20px", borderRadius: 999, fontSize: 13, fontWeight: 600 }}>{toast}</div>}
    </div>
  );
}

/** Render TĨNH một spread (ảnh + chữ, không tương tác) — dùng cho spread hàng
 * xóm ở chế độ Nhiều Spread và cho dải trang dưới cùng. */
function SpreadView({ s, w, h, page, ink }: { s: Spread; w: number; h: number; page: string; ink: string }) {
  return (
    <div style={{ position: "relative", width: w, height: h, background: s.bg || page, overflow: "hidden", borderRadius: 4, boxShadow: "0 6px 22px rgba(0,0,0,.14)" }}>
      <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "rgba(0,0,0,.06)" }} />
      {s.cells.map((c) => c.type === "photo" ? (
        c.photo ? (
          <img key={c.uid} src={c.photo} alt="" draggable={false} style={{ position: "absolute", left: `${c.x}%`, top: `${c.y}%`, width: `${c.w}%`, height: `${c.h}%`, objectFit: "cover", objectPosition: `${c.posX}% ${c.posY}%`, filter: cellFilter(c, h / 500), borderRadius: cellRadius(c, h / 500), boxSizing: "border-box", border: c.borderW ? `${c.borderW * (h / 500)}px solid ${c.borderColor || "#fff"}` : undefined }} />
        ) : (
          <div key={c.uid} style={{ position: "absolute", left: `${c.x}%`, top: `${c.y}%`, width: `${c.w}%`, height: `${c.h}%`, background: "var(--surface2)", borderRadius: cellRadius(c, h / 500) }} />
        )
      ) : (
        <div key={c.uid} style={{ position: "absolute", left: `${c.x}%`, top: `${c.y}%`, width: `${c.w}%`, height: `${c.h}%`, display: "flex", alignItems: "center", justifyContent: c.align === "center" ? "center" : c.align === "right" ? "flex-end" : "flex-start", textAlign: c.align, overflow: "hidden", color: c.color || (c.overlay ? "#fff" : ink), fontFamily: c.role === "body" ? "var(--font-manrope), sans-serif" : "var(--font-cormorant), serif", fontSize: (c.size || ROLE_SIZE[c.role]) * (h / 500), textTransform: c.upper ? "uppercase" : "none", lineHeight: 1.2, whiteSpace: "pre-wrap" }}>{c.text}</div>
      ))}
    </div>
  );
}

/** Thumbnail sơ đồ bố cục (các ô ảnh) theo tỉ lệ spread. */
function LayoutMini({ rects, aspect, active }: { rects: Rect[]; aspect: number; active?: boolean }) {
  return (
    <div style={{ position: "relative", width: "100%", aspectRatio: `${aspect}`, background: "var(--surface2)", borderRadius: 3, overflow: "hidden" }}>
      {rects.map((r, i) => <span key={i} style={{ position: "absolute", left: `${r[0]}%`, top: `${r[1]}%`, width: `${r[2]}%`, height: `${r[3]}%`, background: "var(--brand)", opacity: active ? 0.7 : 0.45, borderRadius: 1 }} />)}
    </div>
  );
}

function Slider({ label, min, max, step, value, onChange }: { label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1 flex justify-between text-xs font-semibold" style={{ color: "var(--text2)" }}>{label}<span style={{ color: "var(--text3)" }}>{value}</span></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} className="w-full accent-[var(--brand)]" />
    </label>
  );
}
