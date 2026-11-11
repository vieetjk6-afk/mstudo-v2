/* ═══════════════════════════════════════════════════════════════════════════
   KIỂM BỘ LAYOUT trước khi lưu (máy chủ) và sau khi đọc (máy khách).

   Bộ layout đến từ trình duyệt của khách nên KHÔNG tin gì cả: dựng lại một bản
   sạch chỉ gồm đúng các trường đã biết, số nằm trong khoảng hợp lý, màu dạng
   #rrggbb, phông trong danh sách.

   Quan trọng nhất: MỌI ảnh (khung ảnh, ảnh nền mờ, danh sách ảnh chọn) phải
   thuộc `allowed` — tập ảnh studio đã giao trong album này. Khách không đưa
   được ảnh ngoài vào layout: giao diện không có nút tải ảnh lên, và có sửa tay
   dữ liệu gửi lên thì máy chủ cũng từ chối ở đây.
   ═══════════════════════════════════════════════════════════════════════════ */
import type { BgPhoto, CollageDoc, CollagePage, Crop, Frame, FrameDeco, PerPage, Rect, TextAlign, TextFrame, TextStyle } from "./types";
import { COLLAGE_LIMITS } from "./types";
import { COLLAGE_FORMATS } from "./formats";
import { COLLAGE_FONTS } from "./fonts";
import { COLLAGE_STYLES, MIX_STYLE } from "./styles";
import { LOCKUP_IDS } from "./lockups";
import { ORN_KINDS, PATH_RE, type Ornament } from "./ornaments";

export type DocCheck = { ok: true; doc: CollageDoc } | { ok: false; error: string };

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const num = (v: unknown, lo: number, hi: number): number | null =>
  typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi ? v : null;
const str = (v: unknown, max: number): string | null => (typeof v === "string" && v.length <= max ? v : null);
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const FONT_KEYS = new Set(COLLAGE_FONTS.map((f) => f.key));
const FORMAT_IDS = new Set(COLLAGE_FORMATS.map((f) => f.id));
const STYLE_IDS = new Set([...COLLAGE_STYLES.map((s) => s.id), MIX_STYLE]);
const ALIGNS = new Set<TextAlign>(["left", "center", "right"]);

/** Làm tròn cho JSON gọn (toạ độ điểm ảnh: 1 chữ số thập phân; tỉ lệ: 4). */
const r1 = (v: number) => Math.round(v * 10) / 10;
const r4 = (v: number) => Math.round(v * 10000) / 10000;

function rect(v: unknown, W: number, H: number): Rect | null {
  if (!isObj(v)) return null;
  const x = num(v.x, -W, 2 * W);
  const y = num(v.y, -H, 2 * H);
  const w = num(v.w, 1, 2 * W);
  const h = num(v.h, 1, 2 * H);
  if (x == null || y == null || w == null || h == null) return null;
  return { x: r1(x), y: r1(y), w: r1(w), h: r1(h) };
}

function crop(v: unknown): Crop | null {
  if (!isObj(v)) return null;
  const zoom = num(v.zoom, 1, 5);
  const cx = num(v.cx, 0, 1);
  const cy = num(v.cy, 0, 1);
  if (zoom == null || cx == null || cy == null) return null;
  return { zoom: r4(zoom), cx: r4(cx), cy: r4(cy) };
}

function textStyle(v: unknown, H: number): TextStyle | null {
  if (!isObj(v)) return null;
  const font = typeof v.font === "string" && FONT_KEYS.has(v.font) ? v.font : null;
  const size = num(v.size, 4, H);
  const weight = num(v.weight, 100, 900);
  const color = typeof v.color === "string" && COLOR_RE.test(v.color) ? v.color.toLowerCase() : null;
  const align = typeof v.align === "string" && ALIGNS.has(v.align as TextAlign) ? (v.align as TextAlign) : null;
  const letterSpacing = num(v.letterSpacing, -0.2, 1);
  const lineHeight = num(v.lineHeight, 0.6, 3);
  if (!font || size == null || weight == null || !color || !align || letterSpacing == null || lineHeight == null) return null;
  return {
    font,
    size: r1(size),
    weight: Math.round(weight),
    italic: v.italic === true,
    color,
    align,
    letterSpacing: r4(letterSpacing),
    lineHeight: r4(lineHeight),
    uppercase: v.uppercase === true,
    ...(v.shadow === true ? { shadow: true } : {}),
  };
}

const SHAPES = new Set(["round", "arch", "oval", "stamp"]);
const ORN_SET = new Set<string>(ORN_KINDS);

/** Hình trang trí: chỉ giữ hình hợp lệ (sai thì bỏ hình đó, không từ chối cả bộ). */
function ornament(v: unknown, W: number, H: number): Ornament | null {
  if (!isObj(v)) return null;
  const id = typeof v.id === "string" && ID_RE.test(v.id) ? v.id : null;
  const kind = typeof v.kind === "string" && ORN_SET.has(v.kind) ? (v.kind as Ornament["kind"]) : null;
  const rc = rect(v.rect, W, H);
  const color = typeof v.color === "string" && COLOR_RE.test(v.color) ? v.color.toLowerCase() : null;
  if (!id || !kind || !rc || !color) return null;
  const out: Ornament = { id, kind, rect: rc, color };
  if (typeof v.color2 === "string" && COLOR_RE.test(v.color2)) out.color2 = v.color2.toLowerCase();
  const rot = num(v.rotate, -360, 360);
  if (rot) out.rotate = r1(rot);
  const op = num(v.opacity, 0.05, 1);
  if (op != null && op < 1) out.opacity = r4(op);
  if (v.flip === true) out.flip = true;
  if (v.over === true) out.over = true;
  if (kind === "path") {
    if (typeof v.d !== "string" || !PATH_RE.test(v.d)) return null;
    out.d = v.d;
    const w = num(v.width, 0.3, 60);
    if (w != null) out.width = r1(w);
  }
  return out;
}

/** Trang trí khung ảnh: chỉ giữ trường đã biết, số trong khoảng; sai thì bỏ trường đó (không từ chối cả bộ). */
function deco(v: unknown, W: number, H: number): FrameDeco | null {
  if (!isObj(v)) return null;
  const out: FrameDeco = {};
  if (typeof v.shape === "string" && SHAPES.has(v.shape)) out.shape = v.shape as FrameDeco["shape"];
  const pad = num(v.pad, 0, Math.min(W, H) * 0.12);
  if (pad != null && pad > 0) out.pad = r1(pad);
  const pb = num(v.padBottom, 0, H * 0.35);
  if (pb != null && pb > 0) out.padBottom = r1(pb);
  if (typeof v.padColor === "string" && COLOR_RE.test(v.padColor)) out.padColor = v.padColor.toLowerCase();
  const rot = num(v.rotate, -15, 15);
  if (rot != null && rot !== 0) out.rotate = r1(rot);
  if (v.shadow === true) out.shadow = true;
  return Object.keys(out).length ? out : null;
}

function frame(v: unknown, W: number, H: number, allowed: ReadonlySet<string>): Frame | "bad_photo" | null {
  if (!isObj(v)) return null;
  const id = typeof v.id === "string" && ID_RE.test(v.id) ? v.id : null;
  const rc = rect(v.rect, W, H);
  if (!id || !rc) return null;
  if (v.kind === "photo") {
    if (typeof v.photoId !== "string" || !allowed.has(v.photoId)) return "bad_photo";
    const c = crop(v.crop);
    if (!c) return null;
    const d = deco(v.deco, W, H);
    return { kind: "photo", id, rect: rc, photoId: v.photoId, crop: c, ...(d ? { deco: d } : {}) };
  }
  if (v.kind === "text") {
    const text = str(v.text, COLLAGE_LIMITS.textChars);
    const style = textStyle(v.style, H);
    if (text == null || !style) return null;
    const rot = num(v.rotate, -15, 15);
    let lockup: TextFrame["lockup"] | undefined;
    if (isObj(v.lockup) && typeof v.lockup.id === "string" && LOCKUP_IDS.has(v.lockup.id)) {
      const kicker = str(v.lockup.kicker, 80);
      const sub = str(v.lockup.sub, 80);
      lockup = { id: v.lockup.id, ...(kicker ? { kicker } : {}), ...(sub ? { sub } : {}) };
    }
    return { kind: "text", id, rect: rc, text, style, ...(rot ? { rotate: r1(rot) } : {}), ...(lockup ? { lockup } : {}) };
  }
  return null;
}

function bgPhoto(v: unknown, allowed: ReadonlySet<string>): BgPhoto | null | "bad_photo" {
  if (v == null) return null;
  if (!isObj(v)) return null;
  if (typeof v.photoId !== "string" || !allowed.has(v.photoId)) return "bad_photo";
  const blur = num(v.blur, 0, 60);
  const dim = num(v.dim, 0, 1);
  if (blur == null || dim == null) return null;
  return { photoId: v.photoId, blur: r1(blur), dim: r4(dim) };
}

/**
 * Kiểm và dựng lại bản sạch. `allowed` = id ảnh giao khách của album (máy chủ
 * truyền tập đầy đủ; máy khách truyền tập ảnh đang có trong trang).
 */
export function sanitizeDoc(raw: unknown, allowed: ReadonlySet<string>): DocCheck {
  if (!isObj(raw) || raw.v !== 1) return { ok: false, error: "bad_doc" };
  const formatId = typeof raw.formatId === "string" && FORMAT_IDS.has(raw.formatId) ? raw.formatId : null;
  if (!formatId) return { ok: false, error: "bad_format" };
  const fmt = COLLAGE_FORMATS.find((f) => f.id === formatId)!;
  const W = fmt.w;
  const H = fmt.h;
  const styleId = typeof raw.styleId === "string" && STYLE_IDS.has(raw.styleId) ? raw.styleId : COLLAGE_STYLES[0].id;
  const perPage: PerPage = raw.perPage === "mix" ? "mix" : (num(raw.perPage, 1, COLLAGE_LIMITS.pagePhotos) ?? 4);

  const texts = Array.isArray(raw.texts) ? raw.texts : [];
  if (texts.length > COLLAGE_LIMITS.texts) return { ok: false, error: "too_many_texts" };
  const cleanTexts: string[] = [];
  for (const t of texts) {
    const s = str(t, COLLAGE_LIMITS.textChars);
    if (s == null) return { ok: false, error: "bad_text" };
    cleanTexts.push(s);
  }

  const ids = Array.isArray(raw.photoIds) ? raw.photoIds : [];
  if (ids.length > COLLAGE_LIMITS.photos) return { ok: false, error: "too_many_photos" };
  const photoIds: string[] = [];
  for (const id of ids) {
    if (typeof id !== "string" || !allowed.has(id)) return { ok: false, error: "bad_photo" };
    if (!photoIds.includes(id)) photoIds.push(id);
  }

  const aspects: Record<string, number> = {};
  if (isObj(raw.aspects)) {
    for (const [id, a] of Object.entries(raw.aspects)) {
      if (!allowed.has(id)) continue;
      const v = num(a, 0.1, 10);
      if (v != null) aspects[id] = r4(v);
    }
  }

  const rawPages = Array.isArray(raw.pages) ? raw.pages : [];
  if (rawPages.length === 0) return { ok: false, error: "empty" };
  if (rawPages.length > COLLAGE_LIMITS.pages) return { ok: false, error: "too_many_pages" };
  const pages: CollagePage[] = [];
  for (const p of rawPages) {
    if (!isObj(p)) return { ok: false, error: "bad_page" };
    const id = typeof p.id === "string" && ID_RE.test(p.id) ? p.id : null;
    const background = typeof p.background === "string" && COLOR_RE.test(p.background) ? p.background.toLowerCase() : null;
    const recipe = str(p.recipe, 120) ?? "";
    const pStyle = typeof p.styleId === "string" && STYLE_IDS.has(p.styleId) && p.styleId !== MIX_STYLE ? p.styleId : COLLAGE_STYLES[0].id;
    if (!id || !background) return { ok: false, error: "bad_page" };
    // Carousel liền mạch: trang rộng `span` slide — toạ độ khung tính theo cả dải.
    const span = typeof p.span === "number" && Number.isFinite(p.span) ? Math.max(1, Math.min(COLLAGE_LIMITS.slides, Math.round(p.span))) : 1;
    const PW = W * span;
    const rawFrames = Array.isArray(p.frames) ? p.frames : [];
    if (rawFrames.length > COLLAGE_LIMITS.frames) return { ok: false, error: "too_many_frames" };
    const frames: Frame[] = [];
    let textCount = 0;
    let photoCount = 0;
    for (const fr of rawFrames) {
      const f = frame(fr, PW, H, allowed);
      if (f === "bad_photo") return { ok: false, error: "bad_photo" };
      if (!f) return { ok: false, error: "bad_frame" };
      if (f.kind === "text") textCount++;
      else photoCount++;
      frames.push(f);
    }
    // Luật của tính năng: mỗi trang tối đa MỘT nội dung chữ, và phải có ảnh.
    if (textCount > 1) return { ok: false, error: "one_text_per_page" };
    if (photoCount === 0 || photoCount > COLLAGE_LIMITS.pagePhotos * span) return { ok: false, error: "bad_page" };
    const bg = bgPhoto(p.bgPhoto, allowed);
    if (bg === "bad_photo") return { ok: false, error: "bad_photo" };
    const orns = (Array.isArray(p.ornaments) ? p.ornaments : []).slice(0, COLLAGE_LIMITS.ornaments).map((o) => ornament(o, PW, H)).filter((o): o is Ornament => !!o);
    pages.push({ id, frames, background, ...(bg ? { bgPhoto: bg } : {}), ...(orns.length ? { ornaments: orns } : {}), ...(span > 1 ? { span } : {}), recipe, styleId: pStyle });
  }

  const seed = num(raw.seed, 0, 4294967295) ?? 1;
  return {
    ok: true,
    doc: { v: 1, ...(raw.mode === "manual" ? { mode: "manual" as const } : {}), formatId, styleId, perPage, texts: cleanTexts, photoIds, aspects, pages, seed: Math.floor(seed) },
  };
}

/** Mọi id ảnh mà bộ layout dùng tới (để máy chủ đối chiếu với album một lượt). */
export function docPhotoIds(raw: unknown): string[] {
  const out = new Set<string>();
  if (!isObj(raw)) return [];
  if (Array.isArray(raw.photoIds)) for (const id of raw.photoIds) if (typeof id === "string") out.add(id);
  if (Array.isArray(raw.pages)) {
    for (const p of raw.pages) {
      if (!isObj(p)) continue;
      if (isObj(p.bgPhoto) && typeof p.bgPhoto.photoId === "string") out.add(p.bgPhoto.photoId);
      if (Array.isArray(p.frames)) for (const f of p.frames) if (isObj(f) && typeof f.photoId === "string") out.add(f.photoId);
    }
  }
  return [...out];
}

/** Tên bộ layout: cắt khoảng trắng, tối đa 80 ký tự (khớp check trong migration). */
export function cleanTitle(v: unknown): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, 80) : "";
}
