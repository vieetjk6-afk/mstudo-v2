"use client";

import { ROLE_SIZE, cellFilter, cellRadius, type ADTpl, type Rect, type Spread } from "./designer-core";
import type { AlbumDesignEditor } from "./useAlbumDesignEditor";

/* Mảnh VẼ dùng chung của trình dàn trang (bản cũ AlbumEditor + bản mới
 * AlbumEditorV2): spread tĩnh, sơ đồ bố cục, thanh trượt, và khung spread
 * tương tác (kéo / đổi cỡ ô, thả ảnh từ thư viện). Giữ nguyên DOM của bản cũ. */

/** Render TĨNH một spread (ảnh + chữ, không tương tác) — dùng cho spread hàng
 * xóm ở chế độ Nhiều Spread và cho dải trang dưới cùng. */
export function SpreadView({ s, w, h, page, ink }: { s: Spread; w: number; h: number; page: string; ink: string }) {
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
export function LayoutMini({ rects, aspect, active }: { rects: Rect[]; aspect: number; active?: boolean }) {
  return (
    <div style={{ position: "relative", width: "100%", aspectRatio: `${aspect}`, background: "var(--surface2)", borderRadius: 3, overflow: "hidden" }}>
      {rects.map((r, i) => <span key={i} style={{ position: "absolute", left: `${r[0]}%`, top: `${r[1]}%`, width: `${r[2]}%`, height: `${r[3]}%`, background: "var(--brand)", opacity: active ? 0.7 : 0.45, borderRadius: 1 }} />)}
    </div>
  );
}

export function Slider({ label, min, max, step, value, onChange }: { label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1 flex justify-between text-xs font-semibold" style={{ color: "var(--text2)" }}>{label}<span style={{ color: "var(--text3)" }}>{value}</span></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} className="w-full accent-[var(--brand)]" />
    </label>
  );
}

/**
 * Khung spread TƯƠNG TÁC đang chỉnh: bấm chọn ô, kéo / kéo góc đổi cỡ, thả ảnh
 * từ thư viện vào ô, bấm đúp để đặt lại khung ảnh, nhãn DPI thấp, khoá layer.
 */
export function SpreadCanvas({ ed, tpl }: { ed: AlbumDesignEditor; tpl: ADTpl }) {
  const { setSel, spreadPxW, spreadPxH, spread, sel, cellDpi, onCellDown, fillCell, dragLib, patchCell, scale } = ed;
  return (
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
  );
}
