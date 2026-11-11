"use client";

import { memo, useRef } from "react";
import type { CollageDoc, CollagePage, Crop, Frame, FrameDeco, PhotoFrame, Rect, TextFrame } from "@/lib/collage/types";
import { formatById } from "@/lib/collage/formats";
import { panCrop, placePhoto } from "@/lib/collage/crop";
import { frameRotation, photoArea, rotatePoint, shapeRadii } from "@/lib/collage/frame-geom";
import { cssFontFamily } from "@/lib/collage/fonts";
import { layoutLockup, layoutText } from "@/lib/collage/text-layout";
import { dividerPrims, ornamentPrims, stampPath, type Ornament, type OrnPrim } from "@/lib/collage/ornaments";
import { filterCss } from "@/lib/collage/filters";
import { placeSign, SIGN_INK, type SignSpec } from "@/lib/collage/brand";
import { isEndPage } from "@/lib/collage/endcard";
import { watermarkLayer } from "@/lib/album-watermark";

/* ═══════════════════════════════════════════════════════════════════════════
   VẼ MỘT TRANG ẢNH GHÉP bằng DOM — cho lưới xem trước, dải trang và màn sửa.
   Cùng phép đặt ảnh (placePhoto) và cùng cách ngắt chữ (layoutText) với bộ
   xuất canvas, nên ảnh tải về y hệt thứ khách thấy.

   Ảnh hiển thị đi đường thường của /api/img (302 sang CDN Google — 0 byte qua
   máy chủ), bề rộng xin theo đúng cỡ khung trên màn hình.
   ═══════════════════════════════════════════════════════════════════════════ */

export type ImgUrl = (driveId: string, width: number) => string;

const STEPS = [200, 400, 800, 1200, 1600];
const pickWidth = (px: number) => STEPS.find((s) => s >= px) ?? STEPS[STEPS.length - 1];
const dpr = () => (typeof window === "undefined" ? 1 : Math.min(2, window.devicePixelRatio || 1));

function rgba(hex: string, a: number) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  const n = m ? parseInt(m[1], 16) : 0xffffff;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

interface ViewProps {
  doc: Pick<CollageDoc, "formatId" | "aspects" | "filter">;
  page: CollagePage;
  /** Bề rộng hiển thị (px). */
  width: number;
  img: ImgUrl;
  driveOf: (photoId: string) => string | undefined;
  fontsReady: number;
  watermark?: string | null;
  /** Khung đang chọn (viền nổi). */
  selectedId?: string | null;
  className?: string;
  /** Carousel: vạch ranh giới slide ("lines"), kèm số slide ("full"). Không bao giờ có trong ảnh xuất. */
  slides?: "lines" | "full";
  /** Chữ ký studio (cài đặt ghép ảnh của studio) — vẽ y như trên ảnh xuất. */
  sign?: SignSpec | null;
}

/** Chữ ký studio ở góc slide (carousel: chỉ slide cuối). */
function SignBox({ spec, page, k, x0, W, H }: { spec: SignSpec; page: CollagePage; k: number; x0: number; W: number; H: number }) {
  const b = placeSign(spec, page, W, H);
  const ink = SIGN_INK[b.ink];
  const common = { left: (x0 + b.x) * k, top: b.y * k, width: b.w * k, height: b.h * k } as const;
  if (spec.mode === "logo" && spec.logoUrl) {
    return (
      <img
        src={spec.logoUrl}
        alt=""
        aria-hidden
        className="pointer-events-none absolute select-none"
        style={{ ...common, objectFit: "contain", objectPosition: b.align === "right" ? "right center" : b.align === "left" ? "left center" : "center", opacity: 0.92, filter: ink.shadow ? "drop-shadow(0 1px 2px rgba(0,0,0,.35))" : undefined }}
      />
    );
  }
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute flex items-center whitespace-nowrap"
      style={{
        ...common,
        justifyContent: b.align === "right" ? "flex-end" : b.align === "left" ? "flex-start" : "center",
        fontFamily: "var(--font-manrope), system-ui, sans-serif",
        fontWeight: 600,
        fontSize: b.size * k,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: ink.color,
        textShadow: ink.shadow ? `0 ${b.size * k * 0.06}px ${b.size * k * 0.35}px ${ink.shadow}` : undefined,
      }}
    >
      {spec.text}
    </div>
  );
}

/** Vẽ các nét trang trí bằng SVG — cùng nguồn (ornaments.ts) với bộ xuất canvas. */
function PrimSvg({ prims, w, h, k, color, style }: { prims: OrnPrim[]; w: number; h: number; k: number; color?: string; style?: React.CSSProperties }) {
  return (
    <svg width={w * k} height={h * k} viewBox={`0 0 ${w} ${h}`} aria-hidden className="pointer-events-none absolute" style={{ overflow: "visible", ...style }}>
      {prims.map((p, i) => (
        <path
          key={i}
          d={p.d}
          fill={p.fill ?? (p.stroke ? "none" : color)}
          stroke={p.stroke}
          strokeWidth={p.sw}
          strokeLinecap="round"
          fillRule={p.evenodd ? "evenodd" : undefined}
          opacity={p.opacity}
        />
      ))}
    </svg>
  );
}

/** Một hình trang trí đặt trên trang. */
function OrnBox({ o, k }: { o: Ornament; k: number }) {
  const tf = [o.rotate ? `rotate(${o.rotate}deg)` : "", o.flip ? "scaleX(-1)" : ""].filter(Boolean).join(" ");
  return <PrimSvg prims={ornamentPrims(o)} w={o.rect.w} h={o.rect.h} k={k} color={o.color} style={{ left: o.rect.x * k, top: o.rect.y * k, transform: tf || undefined, opacity: o.opacity }} />;
}

/** border-radius CSS cho hình khung (khớp shapePath của bộ xuất canvas). */
function radiusCss(shape: FrameDeco["shape"], w: number, h: number): string | undefined {
  if (shape === "oval") return "50%";
  const r = shapeRadii(shape, w, h);
  return r.some((v) => v > 0) ? r.map((v) => `${v}px`).join(" ") : undefined;
}

function PhotoBox({ f, k, short, aspect, img, drive, filter }: { f: PhotoFrame; k: number; short: number; aspect: number; img: ImgUrl; drive?: string; filter?: string }) {
  const area = photoArea(f);
  const d = f.deco;
  const p = placePhoto(area.w, area.h, aspect * 1000, 1000, f.crop);
  const w = pickWidth(p.width * k * dpr());
  const rot = frameRotation(d);
  const padded = !!d && ((d.pad ?? 0) > 0 || (d.padBottom ?? 0) > 0);
  const stamp = d?.shape === "stamp";
  const shadow = d?.shadow ? `0 ${short * 0.01 * k}px ${short * 0.03 * k}px rgba(0,0,0,.3)` : undefined;
  return (
    <div
      className="absolute"
      style={{
        left: f.rect.x * k,
        top: f.rect.y * k,
        width: f.rect.w * k,
        height: f.rect.h * k,
        transform: rot ? `rotate(${rot}deg)` : undefined,
        background: padded && !stamp ? (d?.padColor ?? "#ffffff") : undefined,
        borderRadius: radiusCss(d?.shape, f.rect.w * k, f.rect.h * k),
        // Cùng thông số với bóng của bộ xuất canvas (CSS blur B ≈ canvas shadowBlur B).
        boxShadow: stamp ? undefined : shadow,
      }}
    >
      {stamp ? (
        // Tem thư: viền răng cưa vẽ bằng SVG; bóng đổ theo đúng hình răng cưa.
        <PrimSvg
          prims={[{ d: stampPath(f.rect.w, f.rect.h), fill: d?.padColor ?? "#ffffff" }]}
          w={f.rect.w}
          h={f.rect.h}
          k={k}
          style={{ left: 0, top: 0, filter: shadow ? `drop-shadow(${shadow})` : undefined }}
        />
      ) : null}
      <div
        className="absolute overflow-hidden"
        style={{
          left: (area.x - f.rect.x) * k,
          top: (area.y - f.rect.y) * k,
          width: area.w * k,
          height: area.h * k,
          borderRadius: stamp ? undefined : radiusCss(d?.shape, area.w * k, area.h * k),
          background: "rgba(127,127,127,.18)",
        }}
      >
        {drive ? (
          <img
            src={img(drive, w)}
            alt=""
            draggable={false}
            decoding="async"
            className="pointer-events-none absolute max-w-none select-none"
            style={{ left: p.left * k, top: p.top * k, width: p.width * k, height: p.height * k, filter }}
          />
        ) : null}
      </div>
    </div>
  );
}

/** Một dòng chữ (đã ngắt sẵn) — letter-spacing của CSS thêm cả sau ký tự cuối, bù lại để căn giữa khớp canvas. */
function Line({ text, font, size, weight, italic, spacing, lineH, color, align, shadow }: { text: string; font: string; size: number; weight: number; italic: boolean; spacing: number; lineH: number; color: string; align: TextFrame["style"]["align"]; shadow?: boolean }) {
  return (
    <div
      style={{
        fontFamily: cssFontFamily(font),
        fontSize: size,
        fontWeight: weight,
        fontStyle: italic ? "italic" : "normal",
        color,
        textAlign: align,
        lineHeight: `${lineH}px`,
        height: lineH,
        whiteSpace: "pre",
        textShadow: shadow ? `0 ${size * 0.04}px ${size * 0.3}px rgba(0,0,0,.45)` : undefined,
      }}
    >
      <span style={{ letterSpacing: `${spacing}em`, marginRight: spacing ? `-${spacing}em` : undefined }}>{text || " "}</span>
    </div>
  );
}

function TextBox({ t, k, fontsReady }: { t: TextFrame; k: number; fontsReady: number }) {
  const st = t.style;
  const box = { left: t.rect.x * k, top: t.rect.y * k, width: t.rect.w * k, height: t.rect.h * k, transform: frameRotation(t) ? `rotate(${frameRotation(t)}deg)` : undefined };
  const lock = layoutLockup(t, fontsReady);
  if (lock) {
    const just = st.align === "left" ? "flex-start" : st.align === "right" ? "flex-end" : "center";
    return (
      <div className="pointer-events-none absolute flex flex-col justify-center" style={{ ...box, gap: lock.gap * k }}>
        {lock.blocks.map((b, i) =>
          b.kind === "text" ? (
            <div key={i}>
              {b.lines.map((line, j) => (
                <Line key={j} text={line} font={b.font} size={b.size * k} weight={b.weight} italic={b.italic} spacing={b.letterSpacing} lineH={b.lineH * k} color={st.color} align={st.align} shadow={st.shadow} />
              ))}
            </div>
          ) : (
            <div key={i} className="relative flex flex-none" style={{ height: b.h * k, justifyContent: just }}>
              <PrimSvg prims={dividerPrims(b.type, b.w, b.h, st.color)} w={b.w} h={b.h} k={k} color={st.color} style={{ position: "relative", filter: st.shadow ? "drop-shadow(0 1px 3px rgba(0,0,0,.45))" : undefined }} />
            </div>
          ),
        )}
      </div>
    );
  }
  const lay = layoutText(t, fontsReady);
  return (
    <div className="pointer-events-none absolute flex flex-col justify-center" style={box}>
      {lay.lines.map((line, i) => (
        <Line key={i} text={line} font={st.font} size={lay.size * k} weight={st.weight} italic={st.italic} spacing={st.letterSpacing} lineH={lay.lineH * k} color={st.color} align={st.align} shadow={st.shadow} />
      ))}
    </div>
  );
}

export const PageView = memo(function PageView({ doc, page, width, img, driveOf, fontsReady, watermark, selectedId, className = "", slides, sign }: ViewProps) {
  const f = formatById(doc.formatId);
  // Carousel liền mạch: trang rộng `span` slide, khung tính theo cả dải.
  const span = Math.max(1, Math.round(page.span ?? 1));
  const k = width / (f.w * span);
  const height = f.h * k;
  const bg = page.bgPhoto;
  const bgDrive = bg ? driveOf(bg.photoId) : undefined;
  const radius = bg ? (Math.max(0, Math.min(60, bg.blur)) / 1000) * Math.min(f.w, f.h) * k : 0;
  const m = radius * 3;
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ width, height, background: page.background, contain: "layout paint" }}>
      {bg && bgDrive ? (
        <>
          <img
            src={img(bgDrive, 400)}
            alt=""
            draggable={false}
            className="pointer-events-none absolute max-w-none select-none"
            style={{ left: -m, top: -m, width: width + 2 * m, height: height + 2 * m, objectFit: "cover", filter: [radius > 0 ? `blur(${radius}px)` : "", filterCss(doc.filter) ?? ""].join(" ").trim() || undefined }}
          />
          {bg.dim > 0 ? <div className="pointer-events-none absolute inset-0" style={{ background: rgba(page.background, Math.min(1, bg.dim)) }} /> : null}
        </>
      ) : null}
      {(page.ornaments ?? []).map((o) => (o.over ? null : <OrnBox key={o.id} o={o} k={k} />))}
      {page.frames.map((fr) =>
        fr.kind === "photo" ? <PhotoBox key={fr.id} f={fr} k={k} short={Math.min(f.w, f.h)} aspect={doc.aspects[fr.photoId] ?? 1.5} img={img} drive={driveOf(fr.photoId)} filter={filterCss(doc.filter)} /> : null,
      )}
      {(page.ornaments ?? []).map((o) => (o.over ? <OrnBox key={o.id} o={o} k={k} /> : null))}
      {page.frames.map((fr) => (fr.kind === "text" ? <TextBox key={fr.id} t={fr} k={k} fontsReady={fontsReady} /> : null))}
      {sign && !isEndPage(page) ? <SignBox spec={sign} page={page} k={k} x0={(span - 1) * f.w} W={f.w} H={f.h} /> : null}
      {watermark ? <div className="pointer-events-none absolute inset-0 opacity-20" style={watermarkLayer(watermark)} /> : null}
      {span > 1 && slides
        ? Array.from({ length: span }, (_, i) => (
            <div key={`sl-${i}`} className="pointer-events-none absolute bottom-0 top-0" style={{ left: i * f.w * k, width: f.w * k, borderLeft: i ? "1px dashed rgba(255,255,255,.9)" : undefined, boxShadow: i ? "-1px 0 0 rgba(0,0,0,.18)" : undefined }}>
              {slides === "full" ? (
                <span className="absolute left-1.5 top-1.5 rounded px-1.5 text-[10.5px] font-bold" style={{ background: "rgba(0,0,0,.45)", color: "#fff" }}>
                  {i + 1}/{span}
                </span>
              ) : null}
            </div>
          ))
        : null}
      {selectedId
        ? page.frames
            .filter((fr) => fr.id === selectedId)
            .map((fr) => (
              <div
                key={`sel-${fr.id}`}
                className="pointer-events-none absolute"
                style={{
                  left: fr.rect.x * k,
                  top: fr.rect.y * k,
                  width: fr.rect.w * k,
                  height: fr.rect.h * k,
                  transform: frameRotation(fr.kind === "photo" ? fr.deco : fr) ? `rotate(${frameRotation(fr.kind === "photo" ? fr.deco : fr)}deg)` : undefined,
                  boxShadow: "inset 0 0 0 2.5px var(--ac, #af2bb8), 0 0 0 1px rgba(255,255,255,.7)",
                }}
              />
            ))
        : null}
    </div>
  );
});

/* ── Lớp chạm của màn sửa ─────────────────────────────────────────────────── */

export interface Gesture {
  /** Bắt đầu một thao tác kéo / chụm (để ghi một mốc hoàn tác). */
  onBegin: () => void;
  onCrop: (frameId: string, crop: Crop) => void;
  onMove: (frameId: string, rect: Rect) => void;
  onSelect: (frameId: string | null) => void;
}

/**
 * Vùng chạm phủ lên trang: chạm để chọn khung; khung ẢNH đang chọn kéo để dời
 * ảnh trong khung, chụm hai ngón để phóng; khung CHỮ đang chọn kéo để dời chữ.
 * touch-action: none để kéo ảnh không cuộn trang.
 */
export function EditLayer({ doc, page, width, selectedId, g }: { doc: CollageDoc; page: CollagePage; width: number; selectedId: string | null; g: Gesture }) {
  const f = formatById(doc.formatId);
  const PW = f.w * Math.max(1, Math.round(page.span ?? 1));
  const k = width / PW;
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const start = useRef<{ frame: Frame; x: number; y: number; dist: number; moved: boolean } | null>(null);
  // Thứ tự lớp chạm KHỚP thứ tự vẽ: ảnh theo thứ tự khung (ảnh sau đè ảnh trước —
  // ảnh in chồng góc), chữ trên cùng. Thẻ sau trong DOM nằm trên, nhận chạm trước.
  const frames = [...page.frames.filter((x) => x.kind === "photo"), ...page.frames.filter((x) => x.kind === "text")];

  const begin = (e: React.PointerEvent, fr: Frame) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    const dist = pts.length > 1 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0;
    start.current = { frame: fr, x: pts[0].x, y: pts[0].y, dist, moved: start.current?.moved ?? false };
  };
  const move = (e: React.PointerEvent) => {
    const s = start.current;
    if (!s || !pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    const dx = pts[0].x - s.x;
    const dy = pts[0].y - s.y;
    if (!s.moved) {
      if (Math.hypot(dx, dy) < 3 && !(pts.length > 1 && s.dist > 0)) return;
      s.moved = true;
      g.onBegin();
    }
    const fr = s.frame;
    if (fr.kind === "photo") {
      const aspect = doc.aspects[fr.photoId] ?? 1.5;
      if (pts.length > 1 && s.dist > 0) {
        const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        g.onCrop(fr.id, { ...fr.crop, zoom: Math.max(1, Math.min(4, fr.crop.zoom * (d / s.dist))) });
        return;
      }
      // Khung đang xoay: đổi hướng kéo trên màn hình về hướng của khung.
      const local = rotatePoint(dx, dy, 0, 0, -frameRotation(fr.deco));
      const area = photoArea(fr);
      g.onCrop(fr.id, panCrop(area.w, area.h, aspect * 1000, 1000, fr.crop, local.x / k, local.y / k));
      return;
    }
    const nx = Math.max(-fr.rect.w * 0.5, Math.min(PW - fr.rect.w * 0.5, fr.rect.x + dx / k));
    const ny = Math.max(-fr.rect.h * 0.5, Math.min(f.h - fr.rect.h * 0.5, fr.rect.y + dy / k));
    g.onMove(fr.id, { ...fr.rect, x: nx, y: ny });
  };
  const end = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) start.current = null;
    else if (start.current) {
      // Thả một ngón khi đang chụm: ngón còn lại đi tiếp từ chỗ hiện tại (khung
      // đã phóng), không giật về trạng thái trước lúc chụm.
      const rest = [...pointers.current.values()][0];
      const cur = page.frames.find((x) => x.id === start.current!.frame.id) ?? start.current.frame;
      start.current = { ...start.current, frame: cur, x: rest.x, y: rest.y, dist: 0 };
    }
  };

  return (
    <div
      className="absolute inset-0"
      onClick={(e) => {
        if (e.target === e.currentTarget) g.onSelect(null);
      }}
    >
      {frames.map((fr) => {
        const on = fr.id === selectedId;
        const rot = frameRotation(fr.kind === "photo" ? fr.deco : fr);
        const style = { left: fr.rect.x * k, top: fr.rect.y * k, width: fr.rect.w * k, height: fr.rect.h * k, transform: rot ? `rotate(${rot}deg)` : undefined };
        if (!on) {
          return (
            <button
              key={fr.id}
              type="button"
              aria-label={fr.kind === "photo" ? "Chọn ảnh này" : "Chọn chữ này"}
              className="absolute"
              style={{ ...style, background: "transparent" }}
              onClick={(e) => {
                e.stopPropagation();
                g.onSelect(fr.id);
              }}
            />
          );
        }
        return (
          <div
            key={fr.id}
            role="application"
            aria-label={fr.kind === "photo" ? "Kéo để dời ảnh, chụm hai ngón để phóng to" : "Kéo để dời chữ"}
            className="absolute"
            style={{ ...style, touchAction: "none", cursor: fr.kind === "photo" ? "grab" : "move" }}
            onPointerDown={(e) => {
              e.stopPropagation();
              begin(e, fr);
            }}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
          />
        );
      })}
    </div>
  );
}
