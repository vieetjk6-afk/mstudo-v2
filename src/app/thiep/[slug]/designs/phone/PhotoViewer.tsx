"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Bọc quanh một album: chạm vào ảnh nào (ô `<Slot pv={i}>` bên trong) thì ảnh
 * đó mở to toàn màn hình — vuốt ngang / bấm mũi tên để xem ảnh kế, chạm nền
 * hoặc nút ✕ để đóng.
 *
 * Bắt sự kiện một chỗ ở khung bọc (event delegation) nên mỗi mẫu tự dựng lưới
 * album theo kiểu riêng, chỉ cần gắn `pv` vào ô ảnh.
 *
 * Lớp xem ảnh dùng `position: fixed` là an toàn: thiệp trong trình chỉnh sửa
 * được dựng trong <iframe>, nên "toàn màn hình" chỉ là toàn khung xem trước.
 */
export default function PhotoViewer({ photos, children, style }: { photos: string[]; children: ReactNode; style?: React.CSSProperties }) {
  const [open, setOpen] = useState<number | null>(null);
  const [dir, setDir] = useState(0);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const n = photos.length;

  const go = useCallback((step: number) => {
    setDir(step);
    setOpen((i) => (i === null ? i : (i + step + n) % n));
  }, [n]);

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, go]);

  const onClick = (e: React.MouseEvent) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-pv]");
    if (!el) return;
    const i = Number(el.dataset.pv);
    if (Number.isInteger(i) && photos[i]) { setDir(0); setOpen(i); }
  };

  return (
    <div className="wed-pv" style={style} onClick={onClick}>
      {children}
      {open !== null && photos[open] && (
        <div
          role="dialog" aria-modal="true" aria-label="Xem ảnh"
          onClick={() => setOpen(null)}
          onTouchStart={(e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
          onTouchEnd={(e) => {
            const t = touch.current; touch.current = null;
            if (!t) return;
            const dx = e.changedTouches[0].clientX - t.x, dy = e.changedTouches[0].clientY - t.y;
            if (Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
            else if (dy > 90) setOpen(null);
          }}
          style={{
            position: "fixed", inset: 0, zIndex: 120, background: "rgba(8,8,10,.94)",
            display: "flex", alignItems: "center", justifyContent: "center", animation: "wedPvIn .28s ease both",
          }}
        >
          {/* key đổi theo ảnh → ảnh mới trượt vào từ phía vừa vuốt */}
          <img
            key={open} src={photos[open]} alt={`Ảnh ${open + 1}`}
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "100%", maxHeight: "86vh", objectFit: "contain", boxShadow: "0 30px 80px rgba(0,0,0,.5)",
              animation: `${dir > 0 ? "wedPvNext" : dir < 0 ? "wedPvPrev" : "wedPvZoom"} .42s cubic-bezier(.2,.8,.3,1) both`,
            }}
          />
          <div style={{ position: "absolute", top: 14, left: 0, right: 0, textAlign: "center", color: "rgba(255,255,255,.8)", fontSize: 13, letterSpacing: ".2em", fontFamily: "system-ui, sans-serif" }}>
            {open + 1} / {n}
          </div>
          <button type="button" aria-label="Đóng" onClick={(e) => { e.stopPropagation(); setOpen(null); }} style={btn({ top: 8, right: 8 })}>✕</button>
          {n > 1 && (
            <>
              <button type="button" aria-label="Ảnh trước" onClick={(e) => { e.stopPropagation(); go(-1); }} style={btn({ left: 6, top: "50%", marginTop: -22 })}>‹</button>
              <button type="button" aria-label="Ảnh sau" onClick={(e) => { e.stopPropagation(); go(1); }} style={btn({ right: 6, top: "50%", marginTop: -22 })}>›</button>
            </>
          )}
          {/* Tải sẵn ảnh kế bên để vuốt không bị chờ */}
          {n > 1 && [photos[(open + 1) % n], photos[(open - 1 + n) % n]].map((u, k) => <img key={k} src={u} alt="" aria-hidden style={{ display: "none" }} />)}
        </div>
      )}
      <style>{`
        @keyframes wedPvIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes wedPvZoom { from { opacity: 0; transform: scale(.86) } to { opacity: 1; transform: none } }
        @keyframes wedPvNext { from { opacity: 0; transform: translateX(18%) } to { opacity: 1; transform: none } }
        @keyframes wedPvPrev { from { opacity: 0; transform: translateX(-18%) } to { opacity: 1; transform: none } }
      `}</style>
    </div>
  );
}

function btn(pos: React.CSSProperties): React.CSSProperties {
  return {
    position: "absolute", ...pos, width: 44, height: 44, borderRadius: "50%", border: "none",
    background: "rgba(255,255,255,.12)", color: "#fff", fontSize: 26, lineHeight: "44px", textAlign: "center",
    cursor: "pointer", fontFamily: "system-ui, sans-serif", padding: 0,
  };
}
