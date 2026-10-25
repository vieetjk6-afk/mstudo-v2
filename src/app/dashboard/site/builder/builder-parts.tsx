"use client";

import { useCallback, useRef, useState } from "react";
import {
  Eye, EyeOff, GripVertical, ChevronUp, ChevronDown, Copy,
  Trash2, ImagePlus, X, Check, BarChart3,
} from "lucide-react";
import type { createClient } from "@/lib/supabase/client";
import {
  SITE_BLOCK_LABEL,
  type Site,
  type SiteBlock,
  type SiteBlockType,
} from "@/lib/types";
import SitePricing from "@/components/site/SitePricing";
import {
  buildPriceView,
  hasListSelection,
  selectedListKeys,
  type SitePriceItem,
} from "@/lib/site-pricing";
import { isShortMapLink, mapEmbedSrc } from "@/lib/site-map";
import HtmlEmbed from "@/components/HtmlEmbed";
import { compressImage, checkImageFile, MAX_IMAGE_UPLOAD_MB } from "@/lib/image";
import { uploadImage, dataUrlToBlob } from "@/lib/upload-client";
import { useSiteSeo } from "../useSiteSettings";
// CSS .s-*/.sp-* của website studio — tách khỏi globals để trang khác không phải tải.
import "@/components/site/site.css";

/* ─────────────────────────────────────────────────────────────────────────
   PHẦN DÙNG CHUNG của trình tạo website kéo-thả: hằng số, khung khối trên
   canvas (BlockShell/BlockBody — vẽ y như trang xuất bản), bảng chỉnh khối
   (Inspector), lượt xem, SEO… Tách khỏi CanvasBuilder.tsx để bản cũ và bản
   giao diện mới (CanvasBuilderV2) dùng CHUNG đúng một phần canvas — hai bản chỉ
   khác nhau ở khung công cụ bao quanh (thanh trên, cột trái, cột phải).
   ───────────────────────────────────────────────────────────────────────── */

export type Device = "desktop" | "mobile";
/** Album của studio + `pinned`: có đủ điều kiện lên trang công khai hay chưa. */
export type AlbumLite = { id: string; slug: string; title: string; cover_url: string | null; pinned?: boolean };
export type AlbumOption = AlbumLite;

// Bộ màu nhấn người dùng có thể chọn nhanh (theo handoff §5).
export const ACCENTS = ["#1A1815", "#C9A24B", "#E0533D", "#C0837D", "#3E6F63", "#5566B5"];

// Các loại khối hiện trong palette — trùng với SiteRenderer/quản lý cũ.
export const PALETTE: SiteBlockType[] = [
  "hero", "gallery", "about", "services", "stats", "pricing",
  "testimonials", "quote", "cta", "team", "logos", "video",
  "social", "faq", "map", "contact", "html",
];

// Nội dung mặc định khi thêm 1 khối mới (đúng config key của SiteRenderer).
export const DEFAULTS: Partial<Record<SiteBlockType, Record<string, unknown>>> = {
  hero: { heading: "Tên studio của bạn", subheading: "Nhiếp ảnh cưới & chân dung" },
  about: { heading: "Về chúng tôi", text: "Mỗi khung hình là một câu chuyện.\nChúng tôi lưu giữ khoảnh khắc trọn vẹn nhất của bạn." },
  gallery: { heading: "Bộ sưu tập" },
  services: { heading: "Dịch vụ", items: "Chụp cưới | Phóng sự trọn ngày\nPre-wedding | Concept theo yêu cầu\nGia đình | Studio & ngoại cảnh" },
  stats: { items: "8 năm | Kinh nghiệm\n300+ | Album\n100% | Khách hài lòng" },
  pricing: { heading: "Bảng giá", layout: "card", grouping: "tabs" },
  testimonials: { heading: "Khách hàng nói gì" },
  quote: { text: "Chúng tôi không chỉ chụp ảnh — chúng tôi kể lại câu chuyện của bạn.", author: "Studio" },
  cta: { heading: "Sẵn sàng cho buổi chụp của bạn?", text: "Liên hệ ngay để giữ ngày đẹp.", button: "Đặt lịch ngay" },
  team: { heading: "Đội ngũ", items: "Minh Anh | Photographer | \nQuốc Bảo | Quay phim | " },
  logos: { heading: "Đối tác", items: "" },
  video: { heading: "Video highlight", url: "" },
  social: { heading: "Theo dõi", facebook: "", instagram: "" },
  faq: { heading: "Câu hỏi thường gặp", items: "Đặt cọc bao nhiêu? | Studio giữ lịch khi cọc 30%.\nKhi nào nhận ảnh? | Trong 15–20 ngày." },
  map: { heading: "Ghé studio", address: "", mapUrl: "" },
  contact: { heading: "Liên hệ & đặt lịch", email: "", address: "" },
  html: { heading: "", html: "<!-- Dán mã HTML / nhúng của bạn vào đây -->" },
};

export function uid() {
  return (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/-/g, "");
}

export function isLightHex(hex?: string): boolean {
  if (!hex) return false;
  const m = hex.replace("#", "");
  if (m.length < 6) return false;
  const r = parseInt(m.slice(0, 2), 16), g = parseInt(m.slice(2, 4), 16), b = parseInt(m.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}
export function contrastInk(hex: string): string {
  return isLightHex(hex) ? "#171717" : "#ffffff";
}

export const lines = (v: unknown) => String(v ?? "").split("\n").map((s) => s.trim()).filter(Boolean);

export type PriceItem = SitePriceItem;
export type PriceListOption = { key: string; label: string; count: number };
export type SiteViewStats = {
  today: number;
  week: number;
  month: number;
  daily: { day: string; views: number }[];
};

/* ── Drop zone between blocks ──────────────────────────────────────────────
   Only present while dragging, so it never breaks the half-block flex row in
   normal editing. As a full-row flex item it marks a clear insertion line. */
export function DropZone({ dragging, active, onOver, onDrop, tall }: { dragging: boolean; active: boolean; onOver: () => void; onDrop: () => void; tall?: boolean }) {
  if (!dragging) return null;
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); onOver(); }}
      onDrop={(e) => { e.preventDefault(); onDrop(); }}
      style={{ flex: "1 1 100%", height: active ? 36 : tall ? 40 : 14, transition: "height .12s ease", display: "flex", alignItems: "center", padding: "0 24px" }}
    >
      <div style={{ width: "100%", height: active ? 4 : 2, borderRadius: 999, background: active ? "var(--brand)" : "var(--border)", transition: "all .12s ease" }} />
    </div>
  );
}

/* ── Block shell: floating toolbar + selection border + editable content ── */
export function BlockShell({
  block, selected, preview, first, last, fontHead, accent, albums, pricelist, priceLabels,
  onSelect, onDragStart, onDragEnd, onMove, onDup, onDel, onToggleVisible, onEdit, onBeforeEdit,
}: {
  block: SiteBlock;
  selected: boolean;
  preview: boolean;
  first: boolean;
  last: boolean;
  fontHead: string;
  accent: string;
  albums: AlbumLite[];
  pricelist: PriceItem[];
  priceLabels: Record<string, string>;
  onSelect: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onMove: (d: -1 | 1) => void;
  onDup: () => void;
  onDel: () => void;
  onToggleVisible: () => void;
  onEdit: (k: string, v: unknown, commit?: boolean) => void;
  onBeforeEdit: () => void;
}) {
  const [hover, setHover] = useState(false);
  const showTools = !preview && (hover || selected);
  const hidden = block.visible === false;

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={(e) => { e.stopPropagation(); if (!preview) onSelect(); }}
      style={{
        position: "relative",
        outline: preview ? "none" : selected ? `2px solid ${accent}` : hover ? "2px solid rgba(184,92,59,.45)" : "2px solid transparent",
        outlineOffset: -2,
        cursor: preview ? "default" : "pointer",
        // Khối đang ẩn: làm mờ + gạch chéo nhẹ để thấy ngay là không lên trang.
        opacity: hidden ? 0.42 : 1,
        filter: hidden ? "grayscale(.7)" : undefined,
      }}
    >
      {showTools && (
        <div style={{ position: "absolute", top: 8, right: 8, zIndex: 5, display: "flex", gap: 4, background: "#23201B", borderRadius: 10, padding: 4, boxShadow: "0 4px 14px rgba(0,0,0,.25)" }}>
          <span draggable onDragStart={(e) => { e.stopPropagation(); onDragStart(); }} onDragEnd={onDragEnd} title="Kéo để di chuyển" style={toolBtn}><GripVertical size={15} /></span>
          <button disabled={first} onClick={(e) => { e.stopPropagation(); onMove(-1); }} title="Lên" style={toolBtn}><ChevronUp size={15} /></button>
          <button disabled={last} onClick={(e) => { e.stopPropagation(); onMove(1); }} title="Xuống" style={toolBtn}><ChevronDown size={15} /></button>
          <button onClick={(e) => { e.stopPropagation(); onToggleVisible(); }} title={hidden ? "Hiện lại khối trên trang" : "Tạm ẩn khối khỏi trang"} style={toolBtn}>
            {hidden ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDup(); }} title="Nhân bản" style={toolBtn}><Copy size={14} /></button>
          <button onClick={(e) => { e.stopPropagation(); onDel(); }} title="Xoá" style={{ ...toolBtn, color: "#f0a39e" }}><Trash2 size={14} /></button>
        </div>
      )}
      {showTools && (
        <span style={{ position: "absolute", top: 8, left: 8, zIndex: 5, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ background: accent, color: contrastInk(accent), fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999 }}>
            {SITE_BLOCK_LABEL[block.type]}
          </span>
          {hidden && (
            <span style={{ background: "#23201B", color: "#fff", fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999 }}>
              Đang ẩn
            </span>
          )}
        </span>
      )}
      <BlockBody block={block} fontHead={fontHead} accent={accent} albums={albums} pricelist={pricelist} priceLabels={priceLabels} preview={preview} onEdit={onEdit} onBeforeEdit={onBeforeEdit} />
    </div>
  );
}

/* ── Editable inline text ─────────────────────────────────────────────── */
export function Editable({ value, onCommit, onBeforeEdit, preview, style, placeholder, multiline }: {
  value: string;
  onCommit: (v: string) => void;
  onBeforeEdit: () => void;
  preview: boolean;
  style?: React.CSSProperties;
  placeholder?: string;
  multiline?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  return (
    <div
      ref={ref}
      contentEditable={!preview}
      suppressContentEditableWarning
      onFocusCapture={() => { if (!started.current) { started.current = true; onBeforeEdit(); } }}
      onBlur={(e) => { started.current = false; onCommit(multiline ? e.currentTarget.innerText : e.currentTarget.innerText.replace(/\n/g, " ").trim()); }}
      onClick={(e) => { if (!preview) e.stopPropagation(); }}
      style={{ outline: "none", cursor: preview ? "inherit" : "text", whiteSpace: multiline ? "pre-wrap" : "normal", minWidth: 20, ...style }}
    >
      {value || (preview ? "" : placeholder || "")}
    </div>
  );
}

/* ── Block body: WYSIWYG canvas render of each block type ──────────────── */
export function BlockBody({ block, fontHead, accent, albums, pricelist, priceLabels, preview, onEdit, onBeforeEdit }: {
  block: SiteBlock;
  fontHead: string;
  accent: string;
  albums: AlbumLite[];
  pricelist: PriceItem[];
  priceLabels: Record<string, string>;
  preview: boolean;
  onEdit: (k: string, v: unknown, commit?: boolean) => void;
  onBeforeEdit: () => void;
}) {
  const c = block.config || {};
  const S = (k: string) => String(c[k] ?? "");
  const ed = (k: string, v: string) => onEdit(k, v, true);
  const sec: React.CSSProperties = { maxWidth: 1040, margin: "0 auto", padding: "clamp(44px,7vw,84px) clamp(20px,5vw,40px)" };
  const center = c.align === "center";
  // Đầu đề khối: nhãn nhỏ (eyebrow) + tiêu đề — sửa trực tiếp trên canvas, hiện
  // đúng như trang xuất bản (cùng class .s-sec-head/.s-eyebrow/.s-h2).
  const heading = (k = "heading", fallback = "") => (
    <div className={`s-sec-head${center ? " is-center" : ""}`}>
      {(S("eyebrow") || !preview) && (
        <Editable
          value={S("eyebrow")}
          placeholder="Nhãn nhỏ (không bắt buộc)"
          preview={preview}
          onBeforeEdit={onBeforeEdit}
          onCommit={(v) => ed("eyebrow", v)}
          style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: ".2em", textTransform: "uppercase", color: accent, opacity: S("eyebrow") ? 1 : 0.45 }}
        />
      )}
      <Editable value={S(k)} placeholder={fallback} preview={preview} onBeforeEdit={onBeforeEdit} onCommit={(v) => ed(k, v)} style={{ fontFamily: fontHead, fontSize: "clamp(26px,3.4vw,40px)", lineHeight: 1.12, marginTop: 10 }} />
    </div>
  );

  switch (block.type) {
    case "hero": {
      const img = S("image");
      return (
        <section style={{ position: "relative", minHeight: 380, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "clamp(40px,8vw,80px) 24px", backgroundImage: img ? `linear-gradient(rgba(0,0,0,.42),rgba(0,0,0,.58)),url(${img})` : undefined, backgroundSize: "cover", backgroundPosition: S("imagePos") || "center", color: img ? "#fff" : "var(--s-text)" }}>
          <div style={{ maxWidth: 760 }}>
            {(S("eyebrow") || !preview) && (
              <Editable value={S("eyebrow")} placeholder="Nhãn nhỏ (không bắt buộc)" preview={preview} onBeforeEdit={onBeforeEdit} onCommit={(v) => ed("eyebrow", v)}
                style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: ".2em", textTransform: "uppercase", color: img ? "#fff" : accent, opacity: S("eyebrow") ? 0.9 : 0.45, marginBottom: 12 }} />
            )}
            <Editable value={S("heading")} placeholder="Tiêu đề lớn" preview={preview} onBeforeEdit={onBeforeEdit} onCommit={(v) => ed("heading", v)} style={{ fontFamily: fontHead, fontSize: "clamp(34px,5.4vw,68px)", lineHeight: 1.05 }} />
            <Editable value={S("subheading")} placeholder="Mô tả ngắn" preview={preview} onBeforeEdit={onBeforeEdit} onCommit={(v) => ed("subheading", v)} style={{ marginTop: 16, fontSize: 18, opacity: 0.9 }} />
            <span style={ctaPill(accent)}>{S("button") || "Đặt lịch"}</span>
          </div>
        </section>
      );
    }
    case "about": {
      const img = S("image");
      return (
        <section style={sec}>
          {heading("heading", "Giới thiệu")}
          <div style={{ display: "grid", gap: 30, gridTemplateColumns: img ? "repeat(auto-fit,minmax(260px,1fr))" : "1fr", alignItems: "center" }}>
            <Editable multiline value={S("text")} placeholder="Nội dung giới thiệu…" preview={preview} onBeforeEdit={onBeforeEdit} onCommit={(v) => ed("text", v)} style={{ lineHeight: 1.75, opacity: 0.88 }} />
            {img && <img src={img} alt="" style={{ width: "100%", borderRadius: "var(--s-radius)", objectFit: "cover", aspectRatio: "4/5", maxHeight: 520 }} />}
          </div>
        </section>
      );
    }
    case "gallery": {
      // Tôn trọng album studio đã chọn (album_ids); chưa chọn thì lấy album mới nhất.
      const ids = Array.isArray(c.album_ids) ? (c.album_ids as string[]) : [];
      const picked = ids.length
        ? (ids.map((id) => albums.find((a) => a.id === id)).filter(Boolean) as AlbumLite[])
        : albums.filter((a) => a.cover_url);
      const covers = picked.slice(0, 6);
      return (
        <section style={sec}>
          {heading("heading", "Bộ sưu tập")}
          <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))" }}>
            {(covers.length ? covers : Array.from({ length: 6 })).map((a, i) => (
              <div key={i} className="s-tile">
                <img src={(a as AlbumLite)?.cover_url || `https://picsum.photos/seed/g${i}/600/450`} alt="" />
                <span className="s-tile-cap">{(a as AlbumLite)?.title || `Album mẫu ${i + 1}`}</span>
              </div>
            ))}
          </div>
          {!covers.length && !preview && <p style={{ marginTop: 10, fontSize: 12, opacity: 0.5 }}>(Ảnh mẫu — sẽ thay bằng album đã xuất bản của bạn)</p>}
        </section>
      );
    }
    case "services": {
      const items = lines(c.items).map((l) => { const [t, ...d] = l.split("|"); return { t: t.trim(), d: d.join("|").trim() }; });
      return (
        <section style={sec}>
          {heading("heading", "Dịch vụ")}
          <div className="s-grid s-grid--3">
            {items.map((it, i) => (
              <div key={i} className="s-card">
                <span style={{ color: accent, fontFamily: fontHead, fontSize: 22, fontWeight: 600 }}>{String(i + 1).padStart(2, "0")}</span>
                <p style={{ fontFamily: fontHead, fontSize: 19, marginTop: 6 }}>{it.t}</p>
                {it.d && <p style={{ marginTop: 8, opacity: 0.82, lineHeight: 1.65, fontSize: 14 }}>{it.d}</p>}
              </div>
            ))}
          </div>
          {!preview && <p style={editHint}>Sửa danh sách dịch vụ ở bảng bên phải →</p>}
        </section>
      );
    }
    case "stats": {
      const items = lines(c.items).map((l) => { const [v, ...x] = l.split("|"); return { v: v.trim(), l: x.join("|").trim() }; });
      return (
        <section style={sec}>
          <div className="s-stats">
            {items.map((it, i) => (
              <div key={i}>
                <p className="s-stat-v" style={{ fontFamily: fontHead }}>{it.v}</p>
                {it.l && <p className="s-stat-l">{it.l}</p>}
              </div>
            ))}
          </div>
          {!preview && <p style={editHint}>Sửa con số ở bảng bên phải →</p>}
        </section>
      );
    }
    case "pricing": {
      // Dùng đúng component của trang xuất bản → xem trước giống trang thật 100%.
      const views = buildPriceView(pricelist, c, priceLabels);
      const noneSelected = hasListSelection(c) && selectedListKeys(c).length === 0;
      return (
        <section style={sec}>
          {heading("heading", "Bảng giá")}
          {views.length > 0 ? (
            <SitePricing items={pricelist} config={c} labels={priceLabels} bookingHref="#" fontVar={fontHead} editable />
          ) : (
            <p className="sp-empty">
              {noneSelected
                ? "Chưa chọn bảng giá nào để hiện. Chọn ở bảng bên phải →"
                : "Chưa có gói nào trong bảng giá. Thêm ở trang Bảng giá của studio."}
            </p>
          )}
        </section>
      );
    }
    case "testimonials":
      return (
        <section style={sec}>
          {heading("heading", "Khách hàng nói gì")}
          <div className="s-grid s-grid--2">
            {[0, 1].map((i) => (
              <div key={i} className="s-card">
                <p style={{ color: accent, letterSpacing: 2 }}>★★★★★</p>
                <p style={{ marginTop: 8, fontSize: 14.5, lineHeight: 1.7, opacity: 0.85 }}>Đánh giá khách hàng…</p>
              </div>
            ))}
          </div>
          {!preview && <p style={editHint}>Tự lấy đánh giá đã duyệt khi xuất bản.</p>}
        </section>
      );
    case "quote":
      return (
        <section style={{ maxWidth: 1040, margin: "0 auto", padding: "56px 24px", textAlign: "center" }}>
          <Editable multiline value={S("text")} placeholder="Câu trích dẫn nổi bật…" preview={preview} onBeforeEdit={onBeforeEdit} onCommit={(v) => ed("text", v)} style={{ fontFamily: fontHead, fontSize: "clamp(22px,3.4vw,34px)", lineHeight: 1.45, fontStyle: "italic", maxWidth: "34ch", marginLeft: "auto", marginRight: "auto" }} />
          <Editable value={S("author")} placeholder="— Tác giả" preview={preview} onBeforeEdit={onBeforeEdit} onCommit={(v) => ed("author", v)} style={{ marginTop: 18, color: accent, fontWeight: 600, fontSize: 13.5, letterSpacing: ".06em", textTransform: "uppercase" }} />
        </section>
      );
    case "cta":
      return (
        <section style={{ maxWidth: 1040, margin: "0 auto", padding: 24 }}>
          <div style={{ borderRadius: "var(--s-radius)", border: "1px solid var(--s-border)", padding: "clamp(30px,6vw,60px)", textAlign: "center", background: `color-mix(in srgb, ${accent} 8%, transparent)` }}>
            {(S("eyebrow") || !preview) && (
              <Editable value={S("eyebrow")} placeholder="Nhãn nhỏ (không bắt buộc)" preview={preview} onBeforeEdit={onBeforeEdit} onCommit={(v) => ed("eyebrow", v)}
                style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: ".2em", textTransform: "uppercase", color: accent, opacity: S("eyebrow") ? 1 : 0.45, marginBottom: 10 }} />
            )}
            <Editable value={S("heading")} placeholder="Tiêu đề kêu gọi" preview={preview} onBeforeEdit={onBeforeEdit} onCommit={(v) => ed("heading", v)} style={{ fontFamily: fontHead, fontSize: "clamp(26px,4vw,40px)" }} />
            <Editable value={S("text")} placeholder="Mô tả ngắn" preview={preview} onBeforeEdit={onBeforeEdit} onCommit={(v) => ed("text", v)} style={{ marginTop: 12, opacity: 0.85, maxWidth: "52ch", marginLeft: "auto", marginRight: "auto" }} />
            <span style={ctaPill(accent)}>{S("button") || "Đặt lịch"}</span>
          </div>
        </section>
      );
    case "team": {
      const items = lines(c.items).map((l) => { const [n, r, img] = l.split("|"); return { n: (n || "").trim(), r: (r || "").trim(), img: (img || "").trim() }; });
      return (
        <section style={sec}>
          {heading("heading", "Đội ngũ")}
          <div style={{ display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", textAlign: "center" }}>
            {items.map((it, i) => (
              <div key={i}>
                <div style={{ width: 110, height: 110, margin: "0 auto", borderRadius: 999, overflow: "hidden", border: "1px solid var(--s-border)", background: "var(--s-card)" }}>
                  {it.img && <img src={it.img} alt={it.n} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                </div>
                <p style={{ fontFamily: fontHead, fontSize: 17, marginTop: 10 }}>{it.n}</p>
                {it.r && <p style={{ opacity: 0.75, fontSize: 13 }}>{it.r}</p>}
              </div>
            ))}
          </div>
          {!preview && <p style={editHint}>Sửa thành viên ở bảng bên phải →</p>}
        </section>
      );
    }
    case "logos": {
      const items = lines(c.items);
      return (
        <section style={sec}>
          {heading("heading", "Đối tác")}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 32, alignItems: "center", justifyContent: "center" }}>
            {(items.length ? items : ["", "", ""]).map((src, i) => src ? <img key={i} src={src} alt="" style={{ height: 36, maxWidth: 150, objectFit: "contain", opacity: 0.7 }} /> : <div key={i} style={{ width: 120, height: 32, background: "var(--s-card)", borderRadius: 6 }} />)}
          </div>
        </section>
      );
    }
    case "video":
      return (
        <section style={sec}>
          {heading("heading", "Video")}
          <div style={{ aspectRatio: "16/9", borderRadius: "var(--s-radius)", background: "var(--s-card)", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.6 }}>
            {S("url") ? "▶ " + S("url") : "Dán link YouTube/Vimeo ở bảng bên phải →"}
          </div>
        </section>
      );
    case "social":
      return (
        <section style={sec}>
          {heading("heading", "Theo dõi")}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {["Facebook", "Instagram", "TikTok", "YouTube"].map((l) => (
              <span key={l} style={{ padding: "10px 22px", borderRadius: 999, border: "1px solid var(--s-border)", fontSize: 14, fontWeight: 500 }}>{l}</span>
            ))}
          </div>
        </section>
      );
    case "faq": {
      const items = lines(c.items).map((l) => { const [q, ...a] = l.split("|"); return { q: q.trim(), a: a.join("|").trim() }; });
      return (
        <section style={sec}>
          {heading("heading", "Câu hỏi thường gặp")}
          <div>
            {items.map((it, i) => (
              <details key={i} className="s-faq" open={i === 0}>
                <summary>{it.q}</summary>
                {it.a && <p className="s-faq-a">{it.a}</p>}
              </details>
            ))}
          </div>
          {!preview && <p style={editHint}>Sửa câu hỏi ở bảng bên phải →</p>}
        </section>
      );
    }
    case "map": {
      // Bản đồ thật ngay trong khung soạn để studio kiểm được ghim đúng chỗ.
      // Khi đang soạn thì chặn chuột trên iframe để bấm vào vẫn chọn được khối.
      const src = mapEmbedSrc(S("mapUrl"), S("address"));
      const shortPending = isShortMapLink(S("mapUrl"));
      return (
        <section style={sec}>
          {heading("heading", "Địa chỉ")}
          <Editable value={S("address")} placeholder="Nhập địa chỉ studio…" preview={preview} onBeforeEdit={onBeforeEdit} onCommit={(v) => ed("address", v)} style={{ opacity: 0.85, marginBottom: 12 }} />
          {src ? (
            <div style={{ borderRadius: "var(--s-radius)", overflow: "hidden", border: "1px solid var(--s-border)", position: "relative" }}>
              <iframe title="Bản đồ" src={src} loading="lazy" style={{ width: "100%", height: 300, border: 0, display: "block", pointerEvents: preview ? "auto" : "none" }} />
            </div>
          ) : (
            <div style={{ height: 240, borderRadius: "var(--s-radius)", background: "var(--s-card)", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 20, opacity: 0.65, fontSize: 13 }}>
              {shortPending
                ? "🗺 Link rút gọn — bấm “Lấy vị trí từ link” ở bảng bên phải →"
                : "🗺 Dán link Google Maps hoặc nhập địa chỉ ở bảng bên phải →"}
            </div>
          )}
        </section>
      );
    }
    case "contact":
      return (
        <section style={sec}>
          {heading("heading", "Liên hệ & đặt lịch")}
          <div style={{ display: "grid", gap: "clamp(20px,3vw,36px)", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", alignItems: "start" }}>
            <div style={{ display: "grid", gap: 2 }}>
              {([["Email", "email", "Email liên hệ"], ["Địa chỉ", "address", "Địa chỉ studio"]] as const).map(([lbl, key, ph]) => (
                <div key={key} style={{ display: "flex", gap: 14, padding: "11px 0", borderBottom: "1px solid var(--s-border)", fontSize: 15 }}>
                  <span style={{ width: 92, flexShrink: 0, fontSize: 12.5, opacity: 0.6, textTransform: "uppercase", letterSpacing: ".08em", paddingTop: 2 }}>{lbl}</span>
                  <Editable value={S(key)} placeholder={ph} preview={preview} onBeforeEdit={onBeforeEdit} onCommit={(v) => ed(key, v)} style={{ fontWeight: 500 }} />
                </div>
              ))}
              {!preview && <p style={editHint}>Điện thoại &amp; Facebook lấy tự động từ thông tin studio.</p>}
            </div>
            <div className="s-card" style={{ textAlign: "center" }}>
              <Editable value={S("bookHeading")} placeholder="Giữ ngày đẹp của bạn" preview={preview} onBeforeEdit={onBeforeEdit} onCommit={(v) => ed("bookHeading", v)} style={{ fontFamily: fontHead, fontSize: 20 }} />
              <Editable multiline value={S("bookText")} placeholder="Gửi yêu cầu đặt lịch, studio sẽ liên hệ xác nhận sớm nhất." preview={preview} onBeforeEdit={onBeforeEdit} onCommit={(v) => ed("bookText", v)} style={{ marginTop: 8, fontSize: 13.5, opacity: 0.75, lineHeight: 1.6 }} />
              <span style={ctaPill(accent)}>Đặt lịch ngay</span>
            </div>
          </div>
        </section>
      );
    case "html": {
      const raw = S("html");
      // Full-bleed by default so the canvas matches the published full-width
      // embed; "contained" keeps it boxed like other sections.
      const contained = c.width === "contained";
      return (
        <section style={contained ? sec : { width: "100%", padding: 0 }}>
          {S("heading") && heading("heading", "")}
          {raw ? (
            <HtmlEmbed html={raw} />
          ) : (
            <div style={{ padding: 24, borderRadius: "var(--s-radius)", background: "var(--s-card)", textAlign: "center", opacity: 0.6, fontSize: 13 }}>
              {"</>"} Dán mã HTML / nhúng ở khung bên phải
            </div>
          )}
        </section>
      );
    }
    default:
      return null;
  }
}

/* ── Inspector (right panel for the selected block) ───────────────────── */
export function Inspector({ block, blocks = [], siteUrl = "", albums, priceLists = [], accent, onEdit, onBeforeEdit, hideHead = false }: {
  /** true = bỏ tiêu đề riêng của bảng (khung V2 đã có đầu bảng). */
  hideHead?: boolean;
  block: SiteBlock;
  blocks?: SiteBlock[];
  siteUrl?: string;
  albums: AlbumLite[];
  priceLists?: PriceListOption[];
  accent: string;
  onEdit: (k: string, v: unknown, commit?: boolean) => void;
  onBeforeEdit: () => void;
}) {
  const c = block.config || {};
  const S = (k: string) => String(c[k] ?? "");
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadKey, setUploadKey] = useState<string>("image");

  function pickFile(key: string) {
    setUploadKey(key);
    fileRef.current?.click();
  }
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const check = checkImageFile(f);
    if (!check.ok) { alert(check.error); return; }
    // Compress aggressively to keep published pages as light as possible.
    const dataUrl = await compressImage(f, { maxDim: 1280, quality: 0.65, mime: "image/webp" });
    let url = dataUrl;
    try { url = await uploadImage(await dataUrlToBlob(dataUrl), { filename: "site.webp" }); } catch { /* fallback: nhúng data URL */ }
    onBeforeEdit();
    onEdit(uploadKey, url, true);
  }

  const hasImage = ["hero", "about"].includes(block.type);
  const hasItems = ["services", "stats", "team", "faq", "logos"].includes(block.type);
  // Khối có đầu đề (nhãn nhỏ + tiêu đề) → cho chỉnh eyebrow / căn lề.
  const hasHead = !["quote", "html"].includes(block.type);
  const itemHint: Record<string, string> = {
    services: "Mỗi dòng: Tên dịch vụ | Mô tả",
    stats: "Mỗi dòng: Con số | Nhãn",
    team: "Mỗi dòng: Tên | Vai trò | Link ảnh",
    faq: "Mỗi dòng: Câu hỏi | Câu trả lời",
    logos: "Mỗi dòng: 1 link logo",
  };

  return (
    <div style={{ padding: 16 }}>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
      {!hideHead && (
        <>
          <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 2 }}>{SITE_BLOCK_LABEL[block.type]}</h3>
          <p style={{ fontSize: 11.5, color: "var(--text3)", marginBottom: 16 }}>Chỉnh nội dung & bố cục khối này.</p>
        </>
      )}

      {/* Text fields */}
      {"heading" in DEFAULTS[block.type]! || ["hero", "about", "cta", "quote", "map", "contact"].includes(block.type) ? (
        <Field label="Tiêu đề"><input style={insInput} value={S("heading")} onFocus={onBeforeEdit} onChange={(e) => onEdit("heading", e.target.value)} onBlur={(e) => onEdit("heading", e.target.value, true)} /></Field>
      ) : null}

      {/* Nhãn nhỏ phía trên tiêu đề (eyebrow) — làm đầu khối trông có gu hơn. */}
      {hasHead && (
        <Field label="Nhãn nhỏ trên tiêu đề">
          <input style={insInput} value={S("eyebrow")} placeholder="vd: Dịch vụ · Bảng giá · Câu chuyện" onFocus={onBeforeEdit} onChange={(e) => onEdit("eyebrow", e.target.value)} onBlur={(e) => onEdit("eyebrow", e.target.value, true)} />
        </Field>
      )}

      {/* Căn đầu khối: trái (mặc định) hoặc giữa. */}
      {hasHead && block.type !== "hero" && (
        <Field label="Căn đầu khối">
          <div style={{ display: "flex", gap: 8 }}>
            {([["left", "Căn trái"], ["center", "Căn giữa"]] as const).map(([v, lbl]) => (
              <button key={v} onClick={() => { onBeforeEdit(); onEdit("align", v, true); }} style={segWide((c.align === "center" ? "center" : "left") === v)}>{lbl}</button>
            ))}
          </div>
        </Field>
      )}

      {/* Tên hiển thị trên MENU (rút gọn), riêng cho từng khối — trừ hero. */}
      {block.type !== "hero" && (
        <>
          <Field label="Tên trên menu (để trống = dùng tiêu đề)">
            <input style={insInput} value={S("navLabel")} placeholder={S("heading") || SITE_BLOCK_LABEL[block.type]} onFocus={onBeforeEdit} onChange={(e) => onEdit("navLabel", e.target.value)} onBlur={(e) => onEdit("navLabel", e.target.value, true)} />
          </Field>
          <Toggle
            label="Hiện mục này trên menu"
            hint="Tắt nếu khối vẫn ở trên trang nhưng không cần link trong menu."
            on={c.navHidden !== true}
            onChange={(v) => { onBeforeEdit(); onEdit("navHidden", !v, true); }}
          />
        </>
      )}

      {block.type === "hero" && (
        <>
          <Field label="Mô tả ngắn"><input style={insInput} value={S("subheading")} onFocus={onBeforeEdit} onChange={(e) => onEdit("subheading", e.target.value)} onBlur={(e) => onEdit("subheading", e.target.value, true)} /></Field>
          <Field label="Chữ trên nút"><input style={insInput} value={S("button")} placeholder="Đặt lịch" onFocus={onBeforeEdit} onChange={(e) => onEdit("button", e.target.value)} onBlur={(e) => onEdit("button", e.target.value, true)} /></Field>
        </>
      )}
      {block.type === "hero" && (
        <Field label="Vị trí ảnh bìa (chỉnh nếu chủ thể bị lệch)">
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {([["center", "Giữa"], ["top", "Giữa trên"], ["left", "Trái"], ["right", "Phải"], ["50% 25%", "Trên"]] as const).map(([v, l]) => {
              const active = (S("imagePos") || "center") === v;
              return (
                <button key={v} type="button" onClick={() => { onBeforeEdit?.(); onEdit("imagePos", v, true); }}
                  style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12.5, cursor: "pointer", border: `1px solid ${active ? "var(--brand)" : "var(--border)"}`, background: active ? "var(--brandSoft)" : "var(--surface)", color: active ? "var(--brand)" : "var(--text2)" }}>{l}</button>
              );
            })}
          </div>
        </Field>
      )}
      {(block.type === "about") && (
        <Field label="Nội dung"><textarea style={{ ...insInput, minHeight: 90 }} value={S("text")} onFocus={onBeforeEdit} onChange={(e) => onEdit("text", e.target.value)} onBlur={(e) => onEdit("text", e.target.value, true)} /></Field>
      )}
      {block.type === "cta" && (
        <>
          <Field label="Mô tả ngắn"><input style={insInput} value={S("text")} onFocus={onBeforeEdit} onChange={(e) => onEdit("text", e.target.value)} onBlur={(e) => onEdit("text", e.target.value, true)} /></Field>
          <Field label="Chữ trên nút"><input style={insInput} value={S("button")} onFocus={onBeforeEdit} onChange={(e) => onEdit("button", e.target.value)} onBlur={(e) => onEdit("button", e.target.value, true)} /></Field>
        </>
      )}
      {block.type === "quote" && (
        <>
          <Field label="Trích dẫn"><textarea style={{ ...insInput, minHeight: 70 }} value={S("text")} onFocus={onBeforeEdit} onChange={(e) => onEdit("text", e.target.value)} onBlur={(e) => onEdit("text", e.target.value, true)} /></Field>
          <Field label="Tác giả"><input style={insInput} value={S("author")} onFocus={onBeforeEdit} onChange={(e) => onEdit("author", e.target.value)} onBlur={(e) => onEdit("author", e.target.value, true)} /></Field>
        </>
      )}
      {block.type === "video" && (
        <Field label="Link YouTube / Vimeo"><input style={insInput} value={S("url")} onFocus={onBeforeEdit} onChange={(e) => onEdit("url", e.target.value)} onBlur={(e) => onEdit("url", e.target.value, true)} /></Field>
      )}
      {block.type === "social" && (["facebook", "instagram", "tiktok", "youtube"] as const).map((k) => (
        <Field key={k} label={k[0].toUpperCase() + k.slice(1)}><input style={insInput} value={S(k)} onFocus={onBeforeEdit} onChange={(e) => onEdit(k, e.target.value)} onBlur={(e) => onEdit(k, e.target.value, true)} /></Field>
      ))}
      {block.type === "contact" && (
        <>
          <Field label="Email"><input style={insInput} value={S("email")} onFocus={onBeforeEdit} onChange={(e) => onEdit("email", e.target.value)} onBlur={(e) => onEdit("email", e.target.value, true)} /></Field>
          <Field label="Địa chỉ"><input style={insInput} value={S("address")} onFocus={onBeforeEdit} onChange={(e) => onEdit("address", e.target.value)} onBlur={(e) => onEdit("address", e.target.value, true)} /></Field>
        </>
      )}
      {block.type === "gallery" && (
        <AlbumPicker block={block} albums={albums} onEdit={onEdit} onBeforeEdit={onBeforeEdit} />
      )}

      {block.type === "map" && (
        <>
          <Field label="Địa chỉ (chữ hiện trên trang)">
            <input style={insInput} value={S("address")} placeholder="24 Lê Lợi, Quận 1, TP.HCM" onFocus={onBeforeEdit} onChange={(e) => onEdit("address", e.target.value)} onBlur={(e) => onEdit("address", e.target.value, true)} />
          </Field>
          <MapUrlField block={block} onEdit={onEdit} onBeforeEdit={onBeforeEdit} />
        </>
      )}

      {block.type === "html" && (
        <>
          <Field label="Mã HTML / nhúng (tự thiết kế)">
            <textarea
              style={{ ...insInput, minHeight: 200, fontFamily: "monospace", fontSize: 12 }}
              placeholder="<div>...</div>  hoặc dán mã nhúng (YouTube, form, widget...)"
              value={S("html")}
              onFocus={onBeforeEdit}
              onChange={(e) => onEdit("html", e.target.value)}
              onBlur={(e) => onEdit("html", e.target.value, true)}
            />
            <p style={{ marginTop: 6, fontSize: 11, color: "var(--text3)" }}>
              Dán HTML của riêng bạn. Mã nhúng từ nguồn lạ có thể bị chặn vì lý do bảo mật.
            </p>
          </Field>
          <Field label="Chiều rộng">
            <select style={insInput} value={S("width") === "contained" ? "contained" : "full"} onFocus={onBeforeEdit} onChange={(e) => onEdit("width", e.target.value, true)}>
              <option value="full">Toàn trang (full width)</option>
              <option value="contained">Trong khung (gọn giữa trang)</option>
            </select>
          </Field>
          <LinkRefs block={block} blocks={blocks} siteUrl={siteUrl} />
        </>
      )}

      {hasItems && (
        <Field label={itemHint[block.type]}>
          <textarea style={{ ...insInput, minHeight: 120, fontFamily: "monospace", fontSize: 12 }} value={S("items")} onFocus={onBeforeEdit} onChange={(e) => onEdit("items", e.target.value)} onBlur={(e) => onEdit("items", e.target.value, true)} />
        </Field>
      )}

      {/* Image */}
      {hasImage && (
        <Field label="Ảnh">
          {S("image") ? (
            <div style={{ position: "relative", marginBottom: 8 }}>
              <img src={S("image")} alt="" style={{ width: "100%", borderRadius: 10, display: "block" }} />
              <button onClick={() => { onBeforeEdit(); onEdit("image", "", true); }} aria-label="Gỡ ảnh" title="Gỡ ảnh" style={{ position: "absolute", top: 6, right: 6, background: "var(--text)", color: "var(--bg)", border: 0, borderRadius: 999, width: 26, height: 26, cursor: "pointer" }}><X size={14} /></button>
            </div>
          ) : null}
          <button onClick={() => pickFile("image")} style={{ ...insInput, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer", background: "var(--surface2)" }}>
            <ImagePlus size={15} /> Tải ảnh lên
          </button>
          <p style={{ marginTop: 4, fontSize: 11, color: "var(--text3)" }}>
            Tối đa {MAX_IMAGE_UPLOAD_MB}MB — ảnh sẽ tự được nén cho trang nhẹ.
          </p>
          <input style={{ ...insInput, marginTop: 6 }} placeholder="hoặc dán link ảnh" value={S("image").startsWith("data:") ? "" : S("image")} onFocus={onBeforeEdit} onChange={(e) => onEdit("image", e.target.value)} onBlur={(e) => onEdit("image", e.target.value, true)} />
          {albums.filter((a) => a.cover_url).length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {albums.filter((a) => a.cover_url).slice(0, 9).map((a) => (
                <button key={a.id} onClick={() => { onBeforeEdit(); onEdit("image", a.cover_url, true); }} title={a.title} style={{ width: 44, height: 32, borderRadius: 6, overflow: "hidden", border: S("image") === a.cover_url ? `2px solid ${accent}` : "1px solid var(--border)", padding: 0, cursor: "pointer" }}>
                  <img src={a.cover_url as string} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </button>
              ))}
            </div>
          )}
        </Field>
      )}

      {/* Bảng giá: chọn loại nào hiện lên website + cách trình bày. */}
      {block.type === "pricing" && (
        <PricingFields block={block} priceLists={priceLists} onEdit={onEdit} onBeforeEdit={onBeforeEdit} />
      )}

      {/* Layout: width (half/full) for non-hero, non-html blocks
          (html has its own full/contained control above). */}
      {block.type !== "hero" && block.type !== "html" && (
        <Field label="Bố cục">
          <div style={{ display: "flex", gap: 8 }}>
            {(["full", "half"] as const).map((w) => (
              <button key={w} onClick={() => { onBeforeEdit(); onEdit("width", w, true); }} style={segWide((c.width || "full") === w)}>
                {w === "full" ? "Toàn phần" : "Một nửa"}
              </button>
            ))}
          </div>
        </Field>
      )}

      {/* Copyable anchor link to THIS block's content (for custom HTML nav). */}
      <BlockLink block={block} siteUrl={siteUrl} />

      {(block.type === "pricing" || block.type === "testimonials") && (
        <p style={{ fontSize: 12, color: "var(--text3)", marginTop: 8, lineHeight: 1.5 }}>
          {block.type === "pricing" ? "Nội dung giá lấy từ trang Bảng giá của studio — sửa giá ở đó, website tự cập nhật." : "Khối này tự lấy đánh giá khách đã duyệt khi xuất bản."}
        </p>
      )}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={insLabel}>{label}</label>
      {children}
    </div>
  );
}

/* Công tắc bật/tắt gọn cho các tuỳ chọn hiển thị. */
export function Toggle({ label, hint, on, onChange }: { label: string; hint?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <button
        type="button"
        onClick={() => onChange(!on)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", cursor: "pointer", textAlign: "left" }}
      >
        <span style={{ width: 34, height: 20, borderRadius: 999, background: on ? "var(--brand)" : "var(--border)", position: "relative", flexShrink: 0, transition: "background .15s ease" }}>
          <span style={{ position: "absolute", top: 2, left: on ? 16 : 2, width: 16, height: 16, borderRadius: 999, background: "#fff", transition: "left .15s ease" }} />
        </span>
        <span style={{ fontSize: 12.5, fontWeight: 600 }}>{label}</span>
      </button>
      {hint && <p style={{ marginTop: 5, fontSize: 11, color: "var(--text3)", lineHeight: 1.5 }}>{hint}</p>}
    </div>
  );
}

/* ── Lượt xem website (bảng site_views) ────────────────────────────────────── */
export function ViewStats({ stats, published }: { stats: SiteViewStats; published: boolean }) {
  const max = Math.max(1, ...stats.daily.map((d) => d.views));
  // Dựng đủ 30 cột (ngày không có lượt xem = 0) để cột không bị dồn lệch ngày.
  const days: { day: string; views: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const day = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
    days.push({ day, views: stats.daily.find((d) => d.day === day)?.views ?? 0 });
  }

  return (
    <div style={{ marginBottom: 18, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
      <label style={{ ...insLabel, display: "flex", alignItems: "center", gap: 6 }}>
        <BarChart3 size={13} /> Lượt xem trang
      </label>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {([["Hôm nay", stats.today], ["7 ngày", stats.week], ["30 ngày", stats.month]] as const).map(([lbl, n]) => (
          <div key={lbl} style={{ flex: 1, padding: "8px 6px", borderRadius: 10, background: "var(--surface2)", border: "1px solid var(--border)", textAlign: "center" }}>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-.02em" }}>{n}</div>
            <div style={{ fontSize: 10.5, color: "var(--text3)" }}>{lbl}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 42 }} title="30 ngày gần nhất">
        {days.map((d) => (
          <div
            key={d.day}
            title={`${d.day}: ${d.views} lượt`}
            style={{
              flex: 1,
              height: `${Math.max(3, Math.round((d.views / max) * 100))}%`,
              borderRadius: 2,
              background: d.views ? "var(--brand)" : "var(--border)",
            }}
          />
        ))}
      </div>
      <p style={{ marginTop: 7, fontSize: 11, color: "var(--text3)", lineHeight: 1.5 }}>
        {published
          ? "Đếm mỗi khách một lượt trong một phiên truy cập. Không tính bản xem trước của bạn."
          : "Trang chưa xuất bản nên chưa có lượt xem nào."}
      </p>
    </div>
  );
}

/* ── SEO & ảnh chia sẻ (sites.seo) ─────────────────────────────────────────
   Đây là chữ hiện trên Google và khi dán link vào Facebook/Zalo. Trước đây bảng
   `sites` đã có cột `seo` và generateMetadata đã đọc, chỉ thiếu chỗ nhập. */
export function SeoPanel({ site, supabase, onFlash }: {
  site: Site;
  supabase: ReturnType<typeof createClient>;
  onFlash: (m: string) => void;
}) {
  const { seo, setSeo, busy, save, pickOg, titleLen, descLen } = useSiteSeo({ site, supabase, onFlash });

  return (
    <div style={{ marginBottom: 18, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
      <label style={insLabel}>SEO &amp; ảnh chia sẻ</label>
      <p style={{ fontSize: 11, color: "var(--text3)", lineHeight: 1.55, marginBottom: 10 }}>
        Chữ hiện trên Google và khi dán link trang vào Facebook / Zalo.
      </p>

      <input
        style={insInput}
        placeholder="Tiêu đề trang (vd: Mộc Studio — Ảnh cưới Đà Nẵng)"
        value={seo.title ?? ""}
        onChange={(e) => setSeo({ ...seo, title: e.target.value })}
        onBlur={(e) => save({ ...seo, title: e.target.value.trim() })}
      />
      <p style={{ margin: "3px 0 8px", fontSize: 10.5, color: titleLen > 60 ? "#c0603d" : "var(--text3)" }}>
        {titleLen}/60 ký tự{titleLen > 60 ? " — Google sẽ cắt bớt" : ""}
      </p>

      <textarea
        style={{ ...insInput, minHeight: 64 }}
        placeholder="Mô tả ngắn: studio làm gì, ở đâu, thế mạnh gì."
        value={seo.description ?? ""}
        onChange={(e) => setSeo({ ...seo, description: e.target.value })}
        onBlur={(e) => save({ ...seo, description: e.target.value.trim() })}
      />
      <p style={{ margin: "3px 0 8px", fontSize: 10.5, color: descLen > 160 ? "#c0603d" : "var(--text3)" }}>
        {descLen}/160 ký tự{descLen > 160 ? " — Google sẽ cắt bớt" : ""}
      </p>

      {seo.og_image ? (
        <div style={{ position: "relative", marginBottom: 8 }}>
          <img src={seo.og_image} alt="" style={{ width: "100%", aspectRatio: "1200/630", objectFit: "cover", borderRadius: 10, display: "block" }} />
          <button onClick={() => save({ ...seo, og_image: "" })} title="Gỡ ảnh"
            style={{ position: "absolute", top: 6, right: 6, background: "var(--text)", color: "var(--bg)", border: 0, borderRadius: 999, width: 26, height: 26, cursor: "pointer" }}>
            <X size={14} />
          </button>
        </div>
      ) : null}
      <label style={{ ...insInput, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: busy ? "wait" : "pointer", background: "var(--surface2)" }}>
        <ImagePlus size={15} /> {busy ? "Đang tải…" : seo.og_image ? "Đổi ảnh chia sẻ" : "Tải ảnh chia sẻ (1200×630)"}
        <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) pickOg(f); }} />
      </label>
      <p style={{ marginTop: 5, fontSize: 11, color: "var(--text3)", lineHeight: 1.5 }}>
        Để trống thì hệ thống dùng tên studio và ảnh bìa sẵn có.
      </p>
    </div>
  );
}

/* ── Bộ sưu tập: chọn album nào hiện & theo thứ tự nào ─────────────────────── */
export function AlbumPicker({ block, albums, onEdit, onBeforeEdit }: {
  block: SiteBlock;
  albums: AlbumLite[];
  onEdit: (k: string, v: unknown, commit?: boolean) => void;
  onBeforeEdit: () => void;
}) {
  const c = block.config || {};
  const ids = Array.isArray(c.album_ids) ? (c.album_ids as string[]) : [];
  const auto = ids.length === 0;

  function setIds(next: string[]) {
    onBeforeEdit();
    onEdit("album_ids", next, true);
  }
  function toggle(id: string) {
    setIds(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
  }

  // Album chưa "ghim ở trang chủ" / chưa ở giai đoạn giao khách sẽ KHÔNG lên
  // trang công khai — cảnh báo ngay để studio không tưởng là lỗi.
  const chosen = ids.map((id) => albums.find((a) => a.id === id)).filter(Boolean) as AlbumLite[];
  const notPinned = (auto ? albums : chosen).filter((a) => a.pinned === false);

  return (
    <Field label="Album hiện trong khối này">
      {albums.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--text3)", lineHeight: 1.5 }}>
          Chưa có album nào đã xuất bản. Tạo album trước rồi quay lại chọn.
        </p>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
            {albums.map((a) => {
              const at = ids.indexOf(a.id);
              const on = at >= 0;
              return (
                <button
                  key={a.id}
                  type="button"
                  title={`${a.title}${a.pinned === false ? " — chưa ghim ở trang chủ" : ""}`}
                  onClick={() => toggle(a.id)}
                  style={{
                    position: "relative", padding: 0, aspectRatio: "4/3", borderRadius: 8, overflow: "hidden", cursor: "pointer",
                    border: on ? "2px solid var(--brand)" : "1px solid var(--border)",
                    background: "var(--surface2)",
                    opacity: a.pinned === false ? 0.55 : 1,
                  }}
                >
                  {a.cover_url ? (
                    <img src={a.cover_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : null}
                  {on && (
                    <span style={{ position: "absolute", top: 3, left: 3, minWidth: 16, height: 16, padding: "0 4px", borderRadius: 999, background: "var(--brand)", color: "var(--brandFg)", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {at + 1}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button type="button" onClick={() => setIds([])} style={{ ...segWide(auto), height: 30, fontSize: 12 }}>Tự động (mới nhất)</button>
            <button type="button" onClick={() => setIds(albums.map((a) => a.id))} style={{ ...segWide(false), height: 30, fontSize: 12 }}>Chọn tất cả</button>
          </div>
          <p style={{ marginTop: 6, fontSize: 11, color: "var(--text3)", lineHeight: 1.55 }}>
            {auto
              ? "Đang tự lấy album mới nhất. Bấm vào ảnh để tự chọn — số trên ảnh là thứ tự hiện."
              : `Đang chọn ${ids.length} album, hiện theo thứ tự bạn bấm.`}
          </p>
          {notPinned.length > 0 && (
            <p style={{ marginTop: 6, fontSize: 11, color: "var(--warn, #b4690e)", lineHeight: 1.55 }}>
              ⚠ {notPinned.length} album sẽ KHÔNG lên trang công khai vì chưa ở giai đoạn giao khách hoặc chưa tích “Hiện ở trang chủ”. Sửa trong trang Album.
            </p>
          )}
        </>
      )}
    </Field>
  );
}

/* ── Bản đồ: dán link Google Maps → ghim đúng vị trí ───────────────────────── */
export function MapUrlField({ block, onEdit, onBeforeEdit }: {
  block: SiteBlock;
  onEdit: (k: string, v: unknown, commit?: boolean) => void;
  onBeforeEdit: () => void;
}) {
  const c = block.config || {};
  const value = String(c.mapUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const short = isShortMapLink(value);
  const ok = !!mapEmbedSrc(value);

  // Link "Chia sẻ" trên điện thoại (maps.app.goo.gl) không nhúng được — nhờ
  // server mở ra link đầy đủ rồi lưu lại link đó.
  const resolve = useCallback(async (raw: string) => {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/maps/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: raw }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setMsg(data.error || "Không lấy được vị trí từ link này.");
        return;
      }
      onBeforeEdit();
      onEdit("mapUrl", data.url, true);
      setMsg("Đã lấy đúng vị trí từ link.");
    } catch {
      setMsg("Lỗi mạng — thử lại.");
    } finally {
      setBusy(false);
    }
  }, [onEdit, onBeforeEdit]);

  return (
    <Field label="Link Google Maps (ghim đúng vị trí)">
      <textarea
        style={{ ...insInput, minHeight: 62, fontSize: 12 }}
        placeholder="Dán link từ nút Chia sẻ của Google Maps, hoặc toạ độ 10.7769,106.7009"
        value={value}
        onFocus={onBeforeEdit}
        onChange={(e) => { setMsg(null); onEdit("mapUrl", e.target.value); }}
        onBlur={(e) => {
          const v = e.target.value.trim();
          onEdit("mapUrl", v, true);
          if (isShortMapLink(v)) resolve(v);
        }}
      />
      {short && (
        <button type="button" onClick={() => resolve(value)} disabled={busy} style={{ ...insInput, marginTop: 6, cursor: busy ? "wait" : "pointer", background: "var(--surface2)", fontWeight: 600 }}>
          {busy ? "Đang lấy vị trí…" : "Lấy vị trí từ link"}
        </button>
      )}
      {msg && <p style={{ marginTop: 5, fontSize: 11, color: "var(--text3)", lineHeight: 1.5 }}>{msg}</p>}
      <p style={{ marginTop: 6, fontSize: 11, color: "var(--text3)", lineHeight: 1.55 }}>
        {ok
          ? "✓ Bản đồ đang ghim theo link này."
          : short
            ? "Link rút gọn — bấm nút trên để lấy vị trí."
            : "Để trống thì bản đồ tìm theo địa chỉ chữ ở trên (có thể lệch). Dán link Google Maps để ghim đúng chỗ."}
      </p>
    </Field>
  );
}

/* ── Bảng giá: chọn loại nào hiện + cách trình bày ─────────────────────────── */
export function PricingFields({ block, priceLists, onEdit, onBeforeEdit }: {
  block: SiteBlock;
  priceLists: PriceListOption[];
  onEdit: (k: string, v: unknown, commit?: boolean) => void;
  onBeforeEdit: () => void;
}) {
  const c = block.config || {};
  const chosen = selectedListKeys(c);
  const explicit = hasListSelection(c);
  const showAll = !explicit;
  const isOn = (key: string) => showAll || chosen.includes(key);

  // Ghi ra `list_keys` (mảng) và dọn `list_key` cũ để không còn hai nguồn sự thật.
  function setKeys(keys: string[]) {
    onBeforeEdit();
    onEdit("list_key", "", false);
    onEdit("list_keys", keys, true);
  }
  function toggleKey(key: string) {
    const base = showAll ? priceLists.map((l) => l.key) : chosen;
    setKeys(base.includes(key) ? base.filter((k) => k !== key) : [...base, key]);
  }

  const multi = priceLists.length > 1;
  const activeCount = priceLists.filter((l) => isOn(l.key)).length;

  return (
    <>
      <Field label="Bảng giá hiện trên website">
        {priceLists.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--text3)", lineHeight: 1.5 }}>
            Chưa có dòng giá nào. Thêm ở <b>Studio → Bảng giá</b>, rồi quay lại chọn loại muốn hiện.
          </p>
        ) : (
          <>
            <div style={{ display: "grid", gap: 6 }}>
              {priceLists.map((l) => {
                const on = isOn(l.key);
                return (
                  <button
                    key={l.key}
                    type="button"
                    onClick={() => toggleKey(l.key)}
                    style={{
                      display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: 10, cursor: "pointer", textAlign: "left",
                      border: `1px solid ${on ? "var(--brand)" : "var(--border)"}`,
                      background: on ? "var(--brandSoft)" : "var(--surface)",
                      color: "var(--text)",
                    }}
                  >
                    <span style={{ width: 17, height: 17, borderRadius: 5, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${on ? "var(--brand)" : "var(--border)"}`, background: on ? "var(--brand)" : "transparent", color: "var(--brandFg)" }}>
                      {on && <Check size={12} />}
                    </span>
                    <span style={{ fontSize: 12.5, fontWeight: 600, flex: 1 }}>{l.label}</span>
                    <span style={{ fontSize: 11, color: "var(--text3)" }}>{l.count} dòng</span>
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button type="button" onClick={() => setKeys(priceLists.map((l) => l.key))} style={{ ...segWide(false), height: 30, fontSize: 12 }}>Chọn tất cả</button>
              <button type="button" onClick={() => setKeys([])} style={{ ...segWide(false), height: 30, fontSize: 12 }}>Bỏ chọn hết</button>
            </div>
            <p style={{ marginTop: 6, fontSize: 11, color: "var(--text3)", lineHeight: 1.5 }}>
              {activeCount === 0
                ? "Đang không hiện bảng giá nào — khối này sẽ bị ẩn trên trang."
                : `Đang hiện ${activeCount}/${priceLists.length} loại bảng giá.`}
            </p>
          </>
        )}
      </Field>

      {multi && activeCount > 1 && (
        <Field label="Nhiều loại bảng giá thì">
          <div style={{ display: "flex", gap: 8 }}>
            {([["tabs", "Tab chuyển"], ["stack", "Xếp dọc"]] as const).map(([v, lbl]) => (
              <button key={v} onClick={() => { onBeforeEdit(); onEdit("grouping", v, true); }} style={segWide((c.grouping === "stack" ? "stack" : "tabs") === v)}>{lbl}</button>
            ))}
          </div>
        </Field>
      )}

      <Field label="Kiểu trình bày gói">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
          {([["card", "Thẻ"], ["compact", "Gọn"], ["table", "Bảng"]] as const).map(([v, lbl]) => (
            <button key={v} onClick={() => { onBeforeEdit(); onEdit("layout", v, true); }} style={{ ...segWide((c.layout === "compact" || c.layout === "table" ? c.layout : "card") === v), fontSize: 12 }}>{lbl}</button>
          ))}
        </div>
        <p style={{ marginTop: 6, fontSize: 11, color: "var(--text3)", lineHeight: 1.5 }}>
          Thẻ = đầy đủ nhất · Gọn = ít chỗ hơn · Bảng = mỗi gói một dòng, gọn nhất.
        </p>
      </Field>

      <Toggle
        label="Hiện nút đặt lịch ở từng gói"
        hint="Khách bấm là mở form đặt lịch, điền sẵn loại bảng giá và tên gói."
        on={c.showBook !== false}
        onChange={(v) => { onBeforeEdit(); onEdit("showBook", v, true); }}
      />
      <Toggle
        label="Hiện phần ghi chú"
        hint='Các dòng giá 0đ ("Phát sinh thêm", "Lưu ý"…) xếp gọn xuống cuối bảng giá.'
        on={c.showNotes !== false}
        onChange={(v) => { onBeforeEdit(); onEdit("showNotes", v, true); }}
      />
    </>
  );
}

/* A read-only link + copy button (for wiring custom HTML to site sections). */
export function CopyLine({ label, value }: { label: string; value: string }) {
  const [done, setDone] = useState(false);
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 3 }}>{label}</div>
      <div style={{ display: "flex", gap: 6 }}>
        <input readOnly value={value} onFocus={(e) => e.currentTarget.select()} style={{ ...insInput, fontFamily: "monospace", fontSize: 11 }} />
        <button
          onClick={() => { navigator.clipboard?.writeText(value); setDone(true); setTimeout(() => setDone(false), 1200); }}
          style={{ ...insInput, width: 44, flexShrink: 0, cursor: "pointer", background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center" }}
          title="Sao chép"
        >
          {done ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
    </div>
  );
}

/* Anchor link to the current block's section (designers paste into nav <a>). */
export function BlockLink({ block, siteUrl }: { block: SiteBlock; siteUrl: string }) {
  const anchor = `#sec-${block.id}`;
  return (
    <Field label="Link tới khối này (để gắn vào menu / mã HTML)">
      <CopyLine label="Trong trang (anchor)" value={anchor} />
      {siteUrl && <CopyLine label="Link đầy đủ" value={`${siteUrl}/${anchor}`} />}
    </Field>
  );
}

/* Reference list shown in the HTML block: links to every section + the site. */
export function LinkRefs({ block, blocks, siteUrl }: { block: SiteBlock; blocks: SiteBlock[]; siteUrl: string }) {
  const others = blocks.filter((b) => b.id !== block.id);
  return (
    <div style={{ marginTop: 4, marginBottom: 14, padding: 12, borderRadius: 10, background: "var(--surface2)" }}>
      <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Liên kết để gắn vào thiết kế của bạn</p>
      <p style={{ fontSize: 11, color: "var(--text3)", marginBottom: 10, lineHeight: 1.5 }}>
        Dùng các link này trong mã HTML (vd <code>{'<a href="#sec-...">'}</code>) để chuyển tới từng phần của trang hoặc tới các dịch vụ.
      </p>
      {siteUrl && <CopyLine label="Trang web của bạn" value={siteUrl} />}
      {others.length === 0 ? (
        <p style={{ fontSize: 11, color: "var(--text3)" }}>Chưa có khối nào khác để liên kết.</p>
      ) : (
        others.map((b) => <CopyLine key={b.id} label={SITE_BLOCK_LABEL[b.type] || b.type} value={`#sec-${b.id}`} />)
      )}
    </div>
  );
}

/* ── Inline style helpers ─────────────────────────────────────────────── */
export const insLabel: React.CSSProperties = { display: "block", fontSize: 11.5, fontWeight: 700, color: "var(--text3)", marginBottom: 5, letterSpacing: ".01em" };
export const insInput: React.CSSProperties = { width: "100%", border: "1px solid var(--border)", borderRadius: 9, padding: "8px 10px", fontSize: 13, color: "var(--text)", background: "var(--surface)", outline: "none", boxSizing: "border-box", resize: "vertical" };
export const editHint: React.CSSProperties = { marginTop: 12, fontSize: 11.5, opacity: 0.5, fontStyle: "italic" };
export const toolBtn: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: 7, border: 0, background: "transparent", color: "#fff", cursor: "pointer" };

export function chipBtn(active: boolean, disabled = false): React.CSSProperties {
  return { display: "inline-flex", alignItems: "center", gap: 6, height: 34, padding: "0 12px", borderRadius: 9, border: "1px solid var(--border)", background: active ? "var(--brand)" : "var(--surface)", color: active ? "var(--brandFg)" : "var(--text)", fontSize: 13, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.4 : 1, textDecoration: "none" };
}
export function segBtn(active: boolean): React.CSSProperties {
  return { display: "flex", alignItems: "center", justifyContent: "center", width: 38, height: 32, border: 0, background: active ? "var(--brand)" : "var(--surface)", color: active ? "var(--brandFg)" : "var(--text3)", cursor: "pointer" };
}
export const primaryBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, height: 34, padding: "0 16px", borderRadius: 10, border: 0, background: "var(--brand)", color: "var(--brandFg)", fontSize: 13, fontWeight: 700, cursor: "pointer" };
export function tabBtn(active: boolean): React.CSSProperties {
  return { flex: 1, minWidth: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4, height: 34, padding: "0 6px", borderRadius: 9, border: 0, background: active ? "var(--brand)" : "var(--surface2)", color: active ? "var(--brandFg)" : "var(--text3)", fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap", cursor: "pointer" };
}
export const paletteCard: React.CSSProperties = { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6, padding: "10px 11px", borderRadius: 11, border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--text)", cursor: "grab", textAlign: "left" };
export const tplCard: React.CSSProperties = { display: "block", width: "100%", textAlign: "left", padding: 0, borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", cursor: "pointer" };
export const presetCard: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4, width: "100%", textAlign: "left", padding: "10px 11px", borderRadius: 11, border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--text)", cursor: "pointer" };
export function segWide(active: boolean): React.CSSProperties {
  return { flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, height: 36, borderRadius: 9, border: active ? "1px solid var(--brand)" : "1px solid var(--border)", background: active ? "var(--brand)" : "var(--surface)", color: active ? "var(--brandFg)" : "var(--text)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" };
}
export function ctaPill(accent: string): React.CSSProperties {
  return { display: "inline-block", marginTop: 22, padding: "12px 28px", borderRadius: 999, background: accent, color: contrastInk(accent), fontWeight: 600 };
}
