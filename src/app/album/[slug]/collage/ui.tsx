"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, Heart, Sparkles, X } from "lucide-react";
import type { PhotoCat, PhotoInfo } from "@/lib/collage/categories";
import type { PersonChip } from "@/lib/face-people";
import { FaceAvatar } from "@/app/a/[slug]/FaceFinderV2";
import type { PhotoLite } from "./api";
import type { ImgUrl } from "./PageView";

/* Mảnh giao diện dùng chung trong màn ghép ảnh (điện thoại trước, máy tính sau). */

/** Đầu màn: nút lùi / đóng bên trái, tiêu đề giữa, thao tác bên phải. */
export function StudioHeader({
  title,
  sub,
  onBack,
  backLabel = "Quay lại",
  close = false,
  right,
}: {
  title: React.ReactNode;
  sub?: React.ReactNode;
  onBack: () => void;
  backLabel?: string;
  /** Nút trái là ✕ (đóng hẳn) thay vì ‹. */
  close?: boolean;
  right?: React.ReactNode;
}) {
  return (
    <header
      className="flex flex-none items-center gap-2 px-2"
      style={{
        minHeight: 56,
        paddingTop: "env(safe-area-inset-top, 0px)",
        borderBottom: "1px solid var(--bd)",
        background: "var(--sf)",
      }}
    >
      <button type="button" onClick={onBack} aria-label={backLabel} title={backLabel} className="flex h-11 w-11 flex-none items-center justify-center rounded-full" style={{ color: "var(--tx2)" }}>
        {close ? <X size={21} /> : <ChevronLeft size={23} />}
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15.5px] font-semibold">{title}</p>
        {sub ? <p className="truncate text-[12px]" style={{ color: "var(--tx3)" }}>{sub}</p> : null}
      </div>
      {right ? <div className="flex flex-none items-center gap-1.5 pr-1">{right}</div> : null}
    </header>
  );
}

/** Thanh dưới đáy (vùng ngón cái) — nút chính của bước. */
export function StudioFooter({ children }: { children: React.ReactNode }) {
  return (
    <footer
      className="flex flex-none items-center gap-2 px-3 pt-2.5"
      style={{
        paddingBottom: "max(10px, env(safe-area-inset-bottom, 0px))",
        borderTop: "1px solid var(--bd)",
        background: "var(--sf)",
      }}
    >
      {children}
    </footer>
  );
}

/** Kích thước cửa sổ, theo dõi khi xoay máy / đổi cỡ. */
export function useViewport() {
  const read = () => (typeof window === "undefined" ? { w: 390, h: 760 } : { w: window.innerWidth, h: window.innerHeight });
  const [v, setV] = useState(read);
  useEffect(() => {
    const on = () => setV(read());
    window.addEventListener("resize", on);
    window.addEventListener("orientationchange", on);
    return () => {
      window.removeEventListener("resize", on);
      window.removeEventListener("orientationchange", on);
    };
  }, []);
  return v;
}

/** Thông báo nhỏ nổi phía trên thanh đáy, tự tắt. */
export function useToast() {
  const [text, setText] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = (t: string) => {
    setText(t);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setText(null), 3200);
  };
  const node = text ? (
    <div className="pointer-events-none fixed inset-x-0 z-[120] flex justify-center px-4" style={{ bottom: "calc(max(10px, env(safe-area-inset-bottom, 0px)) + 132px)" }}>
      <span className="max-w-[440px] rounded-[12px] px-3.5 py-2.5 text-center text-[13px] font-medium" style={{ background: "rgba(20,20,24,.92)", color: "#fff", boxShadow: "0 12px 34px rgba(20,15,25,.3)" }}>
        {text}
      </span>
    </div>
  ) : null;
  return { show, node };
}

/* ── Nhóm ảnh gợi ý ────────────────────────────────────────────────────────── */

export const CAT_SUGGEST = "__suggest";
export const CAT_ALL = "__all";
export const CAT_PICKED = "__picked";
export const CAT_HEARTS = "__hearts";

/** Hàng chip nhóm ảnh: Gợi ý · Tất cả · Ảnh chung · Cô dâu · Chú rể · Decor · Bê quả… */
export function CatChips({
  cats,
  value,
  onChange,
  counts,
  people,
  driveIdOf,
  extra = [],
}: {
  cats: PhotoCat[];
  value: string;
  onChange: (v: string) => void;
  counts: { suggest?: number; all: number; picked?: number; hearts?: number };
  people: PersonChip[];
  driveIdOf: Map<string, string>;
  extra?: { id: string; label: string; count?: number }[];
}) {
  const chip = (id: string, label: React.ReactNode, count?: number, lead?: React.ReactNode) => {
    const on = value === id;
    return (
      <button
        key={id}
        type="button"
        onClick={() => onChange(id)}
        aria-pressed={on}
        className="inline-flex h-9 flex-none items-center gap-1.5 whitespace-nowrap rounded-full pl-2.5 pr-3 text-[13px] font-semibold transition-colors"
        style={
          on
            ? { background: "var(--acS)", color: "var(--ac)", border: "1px solid color-mix(in srgb, var(--ac) 35%, transparent)" }
            : { background: "var(--sf)", color: "var(--tx2)", border: "1px solid var(--bd)" }
        }
      >
        {lead}
        {label}
        {count !== undefined ? <span className="tnum text-[12px] font-semibold" style={{ color: on ? "var(--ac)" : "var(--tx3)" }}>{count}</span> : null}
      </button>
    );
  };
  return (
    <div role="group" aria-label="Nhóm ảnh" className="flex gap-2 overflow-x-auto px-3 py-2" style={{ scrollbarWidth: "none" }}>
      {counts.suggest !== undefined ? chip(CAT_SUGGEST, "Gợi ý", counts.suggest, <Sparkles size={14} />) : null}
      {chip(CAT_ALL, "Tất cả", counts.all)}
      {counts.picked ? chip(CAT_PICKED, "Đã chọn", counts.picked, <Check size={14} strokeWidth={2.6} />) : null}
      {counts.hearts ? chip(CAT_HEARTS, "Đã thả tim", counts.hearts, <Heart size={13} fill="currentColor" strokeWidth={0} />) : null}
      {cats.map((c) => {
        const person = c.personId ? people.find((p) => p.id === c.personId) : undefined;
        const lead = person ? <FaceAvatar person={person} driveIdOf={driveIdOf} size={24} /> : null;
        const label = c.label || (c.kind === "person" ? "Ảnh riêng" : "Nhóm ảnh");
        return chip(c.id, label, c.count, lead);
      })}
      {extra.map((x) => chip(x.id, x.label, x.count))}
    </div>
  );
}

/** Nhãn nhóm ngắn trên ô ảnh (ảnh chung / cô dâu / decor…). */
export function tagLabel(info: PhotoInfo | undefined, cats: PhotoCat[]): string | null {
  if (!info) return null;
  for (const c of cats) if (c.kind !== "folder" && info.tags.includes(c.id)) return c.label || (c.kind === "person" ? "Ảnh riêng" : null);
  return null;
}

/**
 * Lưới ảnh vuông, nạp dần khi cuộn (album cưới có cả nghìn ảnh — không dựng
 * nghìn thẻ <img> một lượt). `order` = số thứ tự chọn hiện trên ô.
 */
export function PhotoGrid({
  photos,
  img,
  picked,
  order,
  onTap,
  label,
  dim,
  cols = 3,
  resetKey,
}: {
  photos: PhotoLite[];
  img: ImgUrl;
  picked: (id: string) => boolean;
  order?: (id: string) => number | null;
  onTap: (id: string) => void;
  label?: (id: string) => string | null;
  dim?: (id: string) => boolean;
  cols?: number;
  /**
   * Đổi khoá này (vd. đổi nhóm ảnh) mới thu lưới về 90 ảnh đầu. Không truyền thì
   * thu lại mỗi khi mảng `photos` đổi. Chọn / bỏ chọn ảnh KHÔNG được thu lưới:
   * album nghìn ảnh, khách đang cuộn ở ảnh thứ 300 mà lưới co về 90 là trang
   * nhảy vọt lên trên.
   */
  resetKey?: string | number;
}) {
  const [limit, setLimit] = useState(90);
  const sentinel = useRef<HTMLDivElement | null>(null);
  const list = useMemo(() => photos.slice(0, limit), [photos, limit]);
  const reset = resetKey ?? photos;
  useEffect(() => setLimit(90), [reset]);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || limit >= photos.length || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) setLimit((n) => n + 90);
    }, { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [limit, photos.length]);
  return (
    <div>
      <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {list.map((p) => {
          const on = picked(p.id);
          const n = order?.(p.id) ?? null;
          const tag = label?.(p.id) ?? null;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onTap(p.id)}
              aria-pressed={on}
              className="relative aspect-square overflow-hidden"
              style={{ background: "var(--sf2)", opacity: dim?.(p.id) ? 0.45 : 1 }}
            >
              <img src={img(p.d, 400)} alt="" loading="lazy" decoding="async" draggable={false} className="block h-full w-full select-none object-cover" />
              {on ? <span className="pointer-events-none absolute inset-0" style={{ boxShadow: "inset 0 0 0 3px var(--ac)" }} /> : null}
              <span
                className="absolute right-1.5 top-1.5 flex h-[24px] min-w-[24px] items-center justify-center rounded-full px-1 text-[12px] font-bold"
                style={{ background: on ? "var(--ac)" : "rgba(0,0,0,.25)", border: "2px solid #fff", color: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,.35)" }}
              >
                {on ? (n ?? <Check size={13} strokeWidth={3} />) : null}
              </span>
              {tag ? (
                <span className="pointer-events-none absolute bottom-1 left-1 max-w-[calc(100%-8px)] truncate rounded-full px-1.5 py-[1px] text-[10.5px] font-semibold" style={{ background: "rgba(0,0,0,.5)", color: "#fff" }}>
                  {tag}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {limit < photos.length ? <div ref={sentinel} className="h-10" /> : null}
    </div>
  );
}

/** Lớp phủ đáy (bảng trượt từ đáy lên) — dùng cho đổi ảnh, tải ảnh, đổi khổ. */
export function Sheet({ title, onClose, children, footer, tall = false }: { title: React.ReactNode; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; tall?: boolean }) {
  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center sm:items-center sm:p-4" style={{ background: "rgba(10,12,18,.55)" }} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-[560px] flex-col rounded-t-[20px] sm:rounded-[20px]"
        style={{ background: "var(--sf)", color: "var(--tx)", maxHeight: tall ? "92dvh" : "86dvh", border: "1px solid var(--bd)" }}
      >
        <div className="flex flex-none items-center gap-2 px-4 pb-2 pt-3.5">
          <p className="min-w-0 flex-1 truncate text-[16px] font-semibold">{title}</p>
          <button type="button" onClick={onClose} aria-label="Đóng" className="-mr-1 flex h-9 w-9 items-center justify-center rounded-full" style={{ color: "var(--tx3)" }}>
            <X size={19} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
        {footer ? (
          <div className="flex flex-none items-center gap-2 px-4 pt-3" style={{ borderTop: "1px solid var(--bd2)", paddingBottom: "max(14px, env(safe-area-inset-bottom, 0px))" }}>
            {footer}
          </div>
        ) : (
          <div style={{ height: "max(10px, env(safe-area-inset-bottom, 0px))" }} />
        )}
      </div>
    </div>
  );
}

/** Thời gian còn lại tới lúc bộ ảnh ghép bị xoá. */
export function leftText(expiresAt: string | null | undefined): string {
  if (!expiresAt) return "";
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (!(ms > 0)) return "sắp hết hạn";
  const h = Math.floor(ms / 3_600_000);
  if (h >= 1) return `còn ${h} giờ`;
  return `còn ${Math.max(1, Math.round(ms / 60_000))} phút`;
}
