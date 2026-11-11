"use client";

import { memo, useRef } from "react";
import type { CollageDoc, CollagePage, Crop, Frame, FrameDeco, PhotoFrame, Rect, TextFrame } from "@/lib/collage/types";
import { formatById } from "@/lib/collage/formats";
import { panCrop, placePhoto } from "@/lib/collage/crop";
import { frameRotation, photoArea, rotatePoint, shapeRadii } from "@/lib/collage/frame-geom";
import { cssFontFamily } from "@/lib/collage/fonts";
import { layoutText } from "@/lib/collage/text-layout";
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
  doc: Pick<CollageDoc, "formatId" | "aspects">;
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
}

/** border-radius CSS cho hình khung (khớp shapePath của bộ xuất canvas). */
function radiusCss(shape: FrameDeco["shape"], w: number, h: number): string | undefined {
  if (shape === "oval") return "50%";
  const r = shapeRadii(shape, w, h);
  return r.some((v) => v > 0) ? r.map((v) => `${v}px`).join(" ") : undefined;
}

function PhotoBox({ f, k, short, aspect, img, drive }: { f: PhotoFrame; k: number; short: number; aspect: number; img: ImgUrl; drive?: string }) {
  const area = photoArea(f);
  const d = f.deco;
  const p = placePhoto(area.w, area.h, aspect * 1000, 1000, f.crop);
  const w = pickWidth(p.width * k * dpr());
  const rot = frameRotation(d);
  const padded = !!d && ((d.pad ?? 0) > 0 || (d.padBottom ?? 0) > 0);
  return (
    <div
      className="absolute"
      style={{
        left: f.rect.x * k,
        top: f.rect.y * k,
        width: f.rect.w * k,
        height: f.rect.h * k,
        transform: rot ? `rotate(${rot}deg)` : undefined,
        background: padded ? (d?.padColor ?? "#ffffff") : undefined,
        borderRadius: radiusCss(d?.shape, f.rect.w * k, f.rect.h * k),
        // Cùng thông số với bóng của bộ xuất canvas (CSS blur B ≈ canvas shadowBlur B).
        boxShadow: d?.shadow ? `0 ${short * 0.01 * k}px ${short * 0.03 * k}px rgba(0,0,0,.3)` : undefined,
      }}
    >
      <div
        className="absolute overflow-hidden"
        style={{
          left: (area.x - f.rect.x) * k,
          top: (area.y - f.rect.y) * k,
          width: area.w * k,
          height: area.h * k,
          borderRadius: radiusCss(d?.shape, area.w * k, area.h * k),
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
            style={{ left: p.left * k, top: p.top * k, width: p.width * k, height: p.height * k }}
          />
        ) : null}
      </div>
    </div>
  );
}

function TextBox({ t, k, fontsReady }: { t: TextFrame; k: number; fontsReady: number }) {
  const lay = layoutText(t, fontsReady);
  const st = t.style;
  const size = lay.size * k;
  return (
    <div
      className="pointer-events-none absolute flex flex-col justify-center"
      style={{ left: t.rect.x * k, top: t.rect.y * k, width: t.rect.w * k, height: t.rect.h * k, transform: frameRotation(t) ? `rotate(${frameRotation(t)}deg)` : undefined }}
    >
      {lay.lines.map((line, i) => (
        <div
          key={i}
          style={{
            fontFamily: cssFontFamily(st.font),
            fontSize: size,
            fontWeight: st.weight,
            fontStyle: st.italic ? "italic" : "normal",
            color: st.color,
            textAlign: st.align,
            lineHeight: `${lay.lineH * k}px`,
            height: lay.lineH * k,
            whiteSpace: "pre",
            textShadow: st.shadow ? `0 ${size * 0.04}px ${size * 0.3}px rgba(0,0,0,.45)` : undefined,
          }}
        >
          {/* letter-spacing của CSS thêm cả sau ký tự cuối — bù lại để căn giữa khớp canvas. */}
          <span style={{ letterSpacing: `${st.letterSpacing}em`, marginRight: st.letterSpacing ? `-${st.letterSpacing}em` : undefined }}>{line || " "}</span>
        </div>
      ))}
    </div>
  );
}

export const PageView = memo(function PageView({ doc, page, width, img, driveOf, fontsReady, watermark, selectedId, className = "" }: ViewProps) {
  const f = formatById(doc.formatId);
  const k = width / f.w;
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
            style={{ left: -m, top: -m, width: width + 2 * m, height: height + 2 * m, objectFit: "cover", filter: radius > 0 ? `blur(${radius}px)` : undefined }}
          />
          {bg.dim > 0 ? <div className="pointer-events-none absolute inset-0" style={{ background: rgba(page.background, Math.min(1, bg.dim)) }} /> : null}
        </>
      ) : null}
      {page.frames.map((fr) =>
        fr.kind === "photo" ? <PhotoBox key={fr.id} f={fr} k={k} short={Math.min(f.w, f.h)} aspect={doc.aspects[fr.photoId] ?? 1.5} img={img} drive={driveOf(fr.photoId)} /> : null,
      )}
      {page.frames.map((fr) => (fr.kind === "text" ? <TextBox key={fr.id} t={fr} k={k} fontsReady={fontsReady} /> : null))}
      {watermark ? <div className="pointer-events-none absolute inset-0 opacity-20" style={watermarkLayer(watermark)} /> : null}
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
  const k = width / f.w;
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
    const nx = Math.max(-fr.rect.w * 0.5, Math.min(f.w - fr.rect.w * 0.5, fr.rect.x + dx / k));
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
