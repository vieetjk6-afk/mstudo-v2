/* ═══════════════════════════════════════════════════════════════════════════
   CÀI ĐẶT GHÉP ẢNH CỦA STUDIO (profiles.collage_brand) — áp dụng mọi album:
     • ký tên studio trên ảnh ghép khách tải về (tên / logo, góc nào) — mỗi bài
       khách đăng là một lần studio được giới thiệu;
     • slide cuối "Xem cả album" (mã QR về trang studio hoặc album này);
     • khoá màu ảnh: khách không đổi bộ lọc màu (giữ màu studio đã chỉnh).
   Thuần — máy chủ, trang album và dashboard dùng chung.
   ═══════════════════════════════════════════════════════════════════════════ */

import type { CollagePage, Rect } from "./types";
import { contrast } from "./palette";
import { frameRotation } from "./frame-geom";

export type SignMode = "off" | "name" | "logo";
export type SignPos = "br" | "bl" | "tr" | "tl" | "bc";
export type EndSlide = "studio" | "album" | "off";

export interface CollageBrand {
  sign: SignMode;
  pos: SignPos;
  end: EndSlide;
  lockColor: boolean;
}

export const DEFAULT_COLLAGE_BRAND: CollageBrand = { sign: "name", pos: "br", end: "studio", lockColor: false };

const SIGNS = new Set<SignMode>(["off", "name", "logo"]);
const POSES = new Set<SignPos>(["br", "bl", "tr", "tl", "bc"]);
const ENDS = new Set<EndSlide>(["studio", "album", "off"]);

/** Đọc cài đặt từ cột jsonb (thiếu / sai trường nào thì lấy mặc định trường đó). */
export function collageBrandFrom(raw: unknown): CollageBrand {
  const o = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return {
    sign: typeof o.sign === "string" && SIGNS.has(o.sign as SignMode) ? (o.sign as SignMode) : DEFAULT_COLLAGE_BRAND.sign,
    pos: typeof o.pos === "string" && POSES.has(o.pos as SignPos) ? (o.pos as SignPos) : DEFAULT_COLLAGE_BRAND.pos,
    end: typeof o.end === "string" && ENDS.has(o.end as EndSlide) ? (o.end as EndSlide) : DEFAULT_COLLAGE_BRAND.end,
    lockColor: o.lockColor === true,
  };
}

/** Phần gửi xuống màn ghép của khách: cài đặt + tên / logo / đường dẫn của studio. */
export interface CollageBrandPublic extends CollageBrand {
  name: string;
  logoUrl: string | null;
  /** Trang studio (tên miền riêng nếu có). */
  siteUrl: string;
  /** Album này (để slide cuối trỏ về album nếu studio chọn). */
  albumUrl: string;
}

/** Đường dẫn slide cuối trỏ tới (null = không có slide cuối). */
export function endSlideUrl(b: Pick<CollageBrandPublic, "end" | "siteUrl" | "albumUrl"> | null | undefined): string | null {
  if (!b || b.end === "off") return null;
  return b.end === "album" ? b.albumUrl : b.siteUrl;
}

/** Tên miền gọn để in dưới mã QR: "https://vieetjk.com/album/x" → "vieetjk.com/album/x". */
export function prettyUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

/** Chữ ký studio cần vẽ lên ảnh ghép (null = studio tắt ký tên). */
export interface SignSpec {
  mode: "name" | "logo";
  text: string;
  logoUrl: string | null;
  pos: SignPos;
}

export function signFor(b: Pick<CollageBrandPublic, "sign" | "name" | "logoUrl" | "pos"> | null | undefined): SignSpec | null {
  if (!b || b.sign === "off" || !b.name.trim()) return null;
  return { mode: b.sign === "logo" && b.logoUrl ? "logo" : "name", text: b.name.trim().slice(0, 40), logoUrl: b.logoUrl, pos: b.pos };
}

/**
 * Hộp chữ ký trong một slide W×H (toạ độ slide): góc studio chọn, cách mép 3%
 * cạnh ngắn. Chữ cao ~2,4% cạnh ngắn (≈ 26 px trên ảnh 1080) — đủ đọc, không
 * lấn ảnh. Logo cao ~6%.
 */
export function signBox(spec: SignSpec, W: number, H: number, logoAspect = 3): { x: number; y: number; w: number; h: number; align: "left" | "right" | "center"; size: number } {
  const short = Math.min(W, H);
  const m = short * 0.03;
  const size = short * 0.024;
  const h = spec.mode === "logo" ? short * 0.06 : size * 1.6;
  const w = spec.mode === "logo" ? Math.min(W * 0.26, h * Math.max(0.5, Math.min(6, logoAspect))) : Math.min(W * 0.6, spec.text.length * size * 0.72 + size);
  const right = spec.pos === "br" || spec.pos === "tr";
  const top = spec.pos === "tr" || spec.pos === "tl";
  const x = spec.pos === "bc" ? (W - w) / 2 : right ? W - m - w : m;
  const y = top ? m : H - m - h;
  return { x, y, w, h, align: spec.pos === "bc" ? "center" : right ? "right" : "left", size };
}

/** Màu chữ ký: "photo" = trắng có bóng (đè lên ảnh / nền ảnh mờ); "dark" = mực tối nhạt trên nền sáng; "light" = trắng trên nền tối. */
export type SignInk = "photo" | "dark" | "light";

export const SIGN_INK: Record<SignInk, { color: string; shadow: string | null }> = {
  photo: { color: "rgba(255,255,255,.92)", shadow: "rgba(0,0,0,.45)" },
  dark: { color: "rgba(24,24,24,.58)", shadow: null },
  light: { color: "rgba(255,255,255,.84)", shadow: null },
};

export interface SignPlace {
  x: number;
  y: number;
  w: number;
  h: number;
  align: "left" | "right" | "center";
  size: number;
  ink: SignInk;
}

/** Hộp bao (không xoay) của khung `rect` xoay `deg` độ quanh tâm. */
function rotatedBounds(rect: Rect, deg: number): Rect {
  if (!deg) return rect;
  const a = (Math.abs(deg) * Math.PI) / 180;
  const w = rect.w * Math.cos(a) + rect.h * Math.sin(a);
  const h = rect.w * Math.sin(a) + rect.h * Math.cos(a);
  return { x: rect.x + (rect.w - w) / 2, y: rect.y + (rect.h - h) / 2, w, h };
}

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const overlapsX = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w;

/**
 * Chỗ đặt chữ ký trên slide CUỐI của trang (toạ độ slide W×H) và màu mực —
 * màn sửa (DOM) và bộ xuất (canvas) dùng chung nên ảnh tải về y hệt.
 *   • Góc studio chọn đè lên khung ảnh / chữ mà lề đủ rộng → dời chữ ký vào
 *     giữa lề (không vắt ngang mép ảnh); lề hẹp → đặt hẳn vào trong ảnh.
 *   • Mực: trên ảnh hoặc nền ảnh mờ → trắng có bóng; nền màu → tối hoặc trắng,
 *     màu nào tương phản với nền hơn.
 */
export function placeSign(spec: SignSpec, page: Pick<CollagePage, "frames" | "background" | "bgPhoto" | "span">, W: number, H: number, logoAspect = 3): SignPlace {
  const b = signBox(spec, W, H, logoAspect);
  const m = Math.min(W, H) * 0.03;
  const off = (Math.max(1, Math.min(10, Math.round(page.span ?? 1))) - 1) * W;
  const obs = page.frames
    .map((fr) => {
      const r = rotatedBounds(fr.rect, frameRotation(fr.kind === "photo" ? fr.deco : { rotate: fr.rotate }));
      return { photo: fr.kind === "photo", r: { ...r, x: r.x - off } };
    })
    .filter((o) => o.r.x < W && o.r.x + o.r.w > 0 && o.r.w > 0 && o.r.h > 0);
  const at = (y: number): Rect => ({ x: b.x, y, w: b.w, h: b.h });
  const top = spec.pos === "tl" || spec.pos === "tr";
  let y = b.y;
  const hit = obs.filter((o) => overlaps(at(y), o.r));
  if (hit.length) {
    const col = obs.filter((o) => overlapsX(at(y), o.r));
    if (top) {
      const edge = Math.min(...col.map((o) => o.r.y));
      if (edge >= b.h + m * 0.6) y = (edge - b.h) / 2;
      else y = Math.min(H - b.h, Math.max(b.y, Math.max(...hit.map((o) => o.r.y)) + m * 0.5));
    } else {
      const edge = Math.max(...col.map((o) => o.r.y + o.r.h));
      if (H - edge >= b.h + m * 0.6) y = edge + (H - edge - b.h) / 2;
      else y = Math.max(0, Math.min(b.y, Math.min(...hit.map((o) => o.r.y + o.r.h)) - b.h - m * 0.5));
    }
  }
  const final = at(y);
  let ink: SignInk;
  if (page.bgPhoto || obs.some((o) => o.photo && overlaps(final, o.r))) ink = "photo";
  else {
    const raw = String(page.background ?? "").trim();
    const bg = /^#[0-9a-f]{6}$/i.test(raw) ? raw : "#ffffff";
    ink = contrast(bg, "#181818") >= contrast(bg, "#ffffff") ? "dark" : "light";
  }
  return { ...b, y, ink };
}

