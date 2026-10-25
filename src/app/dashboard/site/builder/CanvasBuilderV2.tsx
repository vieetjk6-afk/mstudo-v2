"use client";

import { Fragment, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft, ChevronDown, ChevronUp, Copy, ExternalLink, Eye, EyeOff, ImagePlus, LayoutTemplate,
  Layers, Lightbulb, Monitor, MoreHorizontal, Moon, Palette, PencilLine, Plus, Redo2, Rocket, Settings2, Smartphone,
  Sun, Trash2, Undo2, X,
} from "lucide-react";
import { MAIN_HOST } from "@/lib/hosts";
import { SITE_BLOCK_LABEL, type SiteBlock, type SiteBlockType } from "@/lib/types";
import { SITE_TEMPLATES, SECTION_PRESETS } from "@/lib/site-templates";
import CustomDomain from "@/components/CustomDomain";
import { Badge, Callout, GroupLabel, btn, iconBtn, inputCls } from "@/components/v2/kit";
import { Drawer, Menu, Segmented, Switch, Tabs, type MenuItem } from "@/components/v2/kit-client";
import { useCanvasBuilder, type CanvasBuilderProps, type LeftTab } from "./useCanvasBuilder";
import { ACCENTS, PALETTE, BlockShell, DropZone, Inspector, ViewStats } from "./builder-parts";
import { DomainStateBadge, SeoFields, SubdomainField, blockIcon } from "../SiteSettingsV2";

/* ═══════════════════════════════════════════════════════════════════════════
   TRÌNH DỰNG WEBSITE — giao diện mới. Canvas, khung khối và bảng chỉnh khối
   dùng NGUYÊN của bản cũ (./builder-parts), logic chung ở ./useCanvasBuilder;
   chỉ khung công cụ bao quanh được làm lại:
     • Thanh trên gọn: quay lại · tên + trạng thái xuất bản · máy tính/điện
       thoại · hoàn tác/làm lại · Xem trước · MỘT nút chính "Xuất bản" (đã xuất
       bản thì thành "Xem trang"; gỡ xuất bản nằm trong ⋯).
     • Cột trái 3 phần: Bố cục (danh sách khối — kéo để đổi chỗ, mắt để ẩn, ⋯
       để lên/xuống/nhân bản/xoá) · Thêm khối (từng khối + cụm soạn sẵn) · Mẫu.
     • Cột phải: chọn một khối → bảng chỉnh khối đó; không chọn → hai tab
       Giao diện (màu, chữ, bố cục, ảnh bìa, logo) và Cài đặt (tên miền, nút
       liên hệ nổi, SEO, lượt xem, CSS). Ô tên miền chuyển từ thanh trên vào đây.
     • Điện thoại: canvas chiếm trọn màn, các cột mở thành ngăn kéo từ thanh
       dưới (Bố cục · Thêm · Mẫu · Giao diện · Chỉnh khối).
   ═══════════════════════════════════════════════════════════════════════════ */

type Side = "layout" | "add" | "templates";
type Sheet = Side | "design" | "block" | null;
type RightTab = "design" | "settings";

const sideOf = (t: LeftTab): Side => (t === "page" ? "layout" : t === "templates" ? "templates" : "add");
const tabOf = (s: Side): LeftTab => (s === "layout" ? "page" : s === "templates" ? "templates" : "blocks");

/** Dòng phụ cho một khối: tiêu đề/nhãn đang đặt, để phân biệt hai khối cùng loại. */
function blockSub(b: SiteBlock): string {
  const c = b.config || {};
  const s = String(c.heading || c.eyebrow || c.subheading || c.text || "").replace(/\s+/g, " ").trim();
  return s.length > 60 ? `${s.slice(0, 59)}…` : s;
}

const FAB: [("booking" | "zalo" | "messenger" | "phone"), string][] = [
  ["booking", "Đặt lịch"],
  ["zalo", "Chat Zalo"],
  ["messenger", "Messenger"],
  ["phone", "Gọi điện"],
];

export default function CanvasBuilderV2(props: CanvasBuilderProps) {
  const {
    site, albums, pricelist = [], priceLists = [], priceLabels = {}, siteViews, canPublish, canCustomDomain = false, mainHost,
  } = props;
  const b = useCanvasBuilder(props);
  const {
    supabase, uiTheme, mounted, blocks, theme, selId, setSelId, leftTab, setLeftTab, device, setDevice, preview, setPreview,
    toast, flash, dragType, setDragType, dragId, setDragId, dropIndex, setDropIndex, undoStack, redoStack, undo, redo, snapshot,
    published, savedSub, domainState, busy, togglePublish, liveUrl,
    insertBlock, moveDir, reorderTo, insertPreset, dupBlock, toggleVisible, delBlock, setConfig, patchTheme, applyTemplate,
    setBgMode, fabOn, toggleFab, toggleFabOff, uploadLogo,
    selected, dragging, canvasBlocks, accent, canvasMax, dark, canvasVars, fontHead,
  } = b;

  const [sheet, setSheet] = useState<Sheet>(null);
  const [rightTab, setRightTab] = useState<RightTab>("design");
  const side = sideOf(leftTab);

  if (!mounted) return null;

  // Portal ra <body> nằm ngoài khung V2 → tự mang lớp + màu chủ đạo của khung.
  const acBase = getComputedStyle(document.querySelector(".ui-v2") ?? document.documentElement).getPropertyValue("--ac-base");
  const canUndo = undoStack.current.length > 0;
  const canRedo = redoStack.current.length > 0;
  const host = savedSub ? `${savedSub}.${mainHost || "mstudo.com"}` : "";
  const visibleCount = blocks.filter((x) => x.visible).length;

  /* ── Các phần của khung công cụ (dùng cho cả cột cố định lẫn ngăn kéo) ── */

  const blockMenu = (x: SiteBlock, i: number, trigger?: "row" | "head"): MenuItem[] => [
    { label: "Lên trên", icon: ChevronUp, onClick: () => moveDir(x.id, -1), disabled: i === 0 },
    { label: "Xuống dưới", icon: ChevronDown, onClick: () => moveDir(x.id, 1), disabled: i === blocks.length - 1 },
    ...(trigger === "head"
      ? [{ label: x.visible ? "Tạm ẩn khỏi trang" : "Hiện lại trên trang", icon: x.visible ? EyeOff : Eye, onClick: () => toggleVisible(x.id) }]
      : []),
    { label: "Nhân bản", icon: Copy, onClick: () => dupBlock(x.id) },
    "divider",
    { label: "Xoá khối", icon: Trash2, danger: true, onClick: () => delBlock(x.id) },
  ];

  const layoutList = (
    <div className="flex flex-col gap-1.5">
      <p className="px-1 pb-1 text-[12.5px]" style={{ color: "var(--tx3)" }}>
        {blocks.length ? `${visibleCount}/${blocks.length} khối đang hiện. Kéo để đổi chỗ, bấm để chỉnh.` : ""}
      </p>
      {blocks.length === 0 ? (
        <div className="rounded-[12px] px-4 py-6 text-center" style={{ border: "1px dashed var(--bd)" }}>
          <LayoutTemplate size={22} className="mx-auto" style={{ color: "var(--tx3)" }} />
          <p className="mt-2 text-[13.5px] font-semibold">Trang chưa có khối nào</p>
          <p className="mt-1 text-[12.5px]" style={{ color: "var(--tx3)" }}>Chọn một mẫu dựng sẵn, hoặc thêm từng khối.</p>
          <div className="mt-3 flex justify-center gap-2">
            <button type="button" className={btn("secondary", "sm")} onClick={() => setLeftTab("templates")}>
              Xem mẫu
            </button>
            <button type="button" className={btn("ghost", "sm")} onClick={() => setLeftTab("blocks")}>
              <Plus size={14} /> Thêm khối
            </button>
          </div>
        </div>
      ) : (
        blocks.map((x, i) => {
          const on = selId === x.id;
          const Icon = blockIcon(x.type);
          const sub = blockSub(x);
          return (
            <div
              key={x.id}
              draggable
              onDragStart={() => { setDragId(x.id); setDragType(null); }}
              onDragEnd={() => { setDragId(null); setDropIndex(null); }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); reorderTo(i); }}
              onClick={() => { setSelId(x.id); setRightTab("design"); if (sheet) setSheet("block"); }}
              className="group flex cursor-grab items-center gap-2.5 rounded-[11px] py-1.5 pl-1.5 pr-1 transition-colors hover:bg-[var(--sf2)] active:cursor-grabbing"
              style={{
                border: `1px solid ${on ? "var(--ac)" : "transparent"}`,
                background: on ? "var(--acS)" : undefined,
              }}
            >
              <span
                className="flex h-8 w-8 flex-none items-center justify-center rounded-[9px]"
                style={{ background: on ? "var(--sf)" : "var(--sf2)", color: x.visible ? (on ? "var(--ac)" : "var(--tx2)") : "var(--tx3)" }}
              >
                <Icon size={15} />
              </span>
              <span className="min-w-0 flex-1" style={{ opacity: x.visible ? 1 : 0.6 }}>
                <span className="block truncate text-[13px] font-semibold">{SITE_BLOCK_LABEL[x.type]}</span>
                <span className="block truncate text-[11.5px]" style={{ color: "var(--tx3)" }}>
                  {x.visible ? sub || "—" : "Đang ẩn khỏi trang"}
                </span>
              </span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); toggleVisible(x.id); }}
                aria-label={x.visible ? `Ẩn khối ${SITE_BLOCK_LABEL[x.type]}` : `Hiện khối ${SITE_BLOCK_LABEL[x.type]}`}
                title={x.visible ? "Ẩn khối" : "Hiện khối"}
                className={iconBtn(`!h-8 !w-8 ${on || !x.visible ? "" : "lg:opacity-0 lg:focus-visible:opacity-100 lg:group-hover:opacity-100"}`)}
              >
                {x.visible ? <Eye size={15} /> : <EyeOff size={15} />}
              </button>
              <span onClick={(e) => e.stopPropagation()} className={`flex ${on ? "" : "lg:opacity-0 lg:focus-within:opacity-100 lg:group-hover:opacity-100"}`}>
                <Menu
                  label={`Thao tác với khối ${SITE_BLOCK_LABEL[x.type]}`}
                  width={200}
                  items={blockMenu(x, i)}
                  trigger={({ open, toggle }) => (
                    <button type="button" onClick={toggle} aria-expanded={open} aria-label={`Thao tác với khối ${SITE_BLOCK_LABEL[x.type]}`} className={iconBtn("!h-8 !w-8")}>
                      <MoreHorizontal size={16} />
                    </button>
                  )}
                />
              </span>
            </div>
          );
        })
      )}
    </div>
  );

  const addPanel = (
    <div className="flex flex-col gap-3">
      <p className="px-1 text-[12.5px]" style={{ color: "var(--tx3)" }}>Kéo một khối thả vào trang, hoặc bấm để thêm vào cuối.</p>
      <div className="grid grid-cols-2 gap-2">
        {PALETTE.map((type: SiteBlockType) => {
          const Icon = blockIcon(type);
          return (
            <button
              key={type}
              type="button"
              draggable
              onDragStart={() => { setDragType(type); setDragId(null); }}
              onDragEnd={() => { setDragType(null); setDropIndex(null); }}
              onClick={() => { insertBlock(type, blocks.length); setSheet(null); }}
              className="flex cursor-grab items-center gap-2 rounded-[11px] px-2.5 py-2 text-left transition-colors hover:bg-[var(--sf2)]"
              style={{ border: "1px solid var(--bd)", background: "var(--sf)" }}
            >
              <span className="flex h-7 w-7 flex-none items-center justify-center rounded-[8px]" style={{ background: "var(--acS)", color: "var(--ac)" }}>
                <Icon size={14} />
              </span>
              <span className="min-w-0 text-[12.5px] font-semibold leading-tight">{SITE_BLOCK_LABEL[type]}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-1">
        <GroupLabel count={SECTION_PRESETS.length}>Cụm khối soạn sẵn</GroupLabel>
      </div>
      <p className="-mt-1 px-1 text-[12.5px]" style={{ color: "var(--tx3)" }}>Thêm cả cụm đã có nội dung vào cuối trang, không đổi màu sắc đang có.</p>
      <div className="flex flex-col gap-2">
        {SECTION_PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => { insertPreset(p.key); setSheet(null); }}
            className="flex flex-col gap-1 rounded-[12px] px-3 py-2.5 text-left transition-colors hover:bg-[var(--sf2)]"
            style={{ border: "1px solid var(--bd)" }}
          >
            <span className="flex items-center gap-1.5 text-[13px] font-semibold">
              <Plus size={14} className="flex-none" style={{ color: "var(--ac)" }} /> {p.name}
            </span>
            <span className="text-[12px] leading-snug" style={{ color: "var(--tx2)" }}>{p.hint}</span>
            <span className="text-[11.5px]" style={{ color: "var(--tx3)" }}>{p.blocks.map((x) => SITE_BLOCK_LABEL[x.type]).join(" · ")}</span>
          </button>
        ))}
      </div>
    </div>
  );

  const templatesPanel = (
    <div className="flex flex-col gap-3">
      <p className="px-1 text-[12.5px]" style={{ color: "var(--tx3)" }}>
        Dựng nhanh cả trang từ một mẫu. {blocks.length ? "Mẫu sẽ thay toàn bộ khối đang có." : ""}
      </p>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-1">
        {SITE_TEMPLATES.map((tp) => (
          <button
            key={tp.key}
            type="button"
            onClick={() => { void applyTemplate(tp.key); setSheet(null); }}
            className="block w-full overflow-hidden rounded-[12px] text-left transition-shadow hover:shadow-md"
            style={{ border: "1px solid var(--bd)", background: "var(--sf)" }}
          >
            <img src={tp.thumb} alt={tp.name} className="block w-full object-cover" style={{ aspectRatio: "3/2" }} />
            <span className="block px-3 py-2">
              <span className="block text-[13px] font-semibold">{tp.name}</span>
              <span className="block text-[11.5px]" style={{ color: "var(--tx3)" }}>{tp.tag}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );

  const label = (t: string) => (
    <p className="mb-2 text-[12.5px] font-semibold" style={{ color: "var(--tx2)" }}>{t}</p>
  );
  const group = (t: string) => (
    <p className="-mx-4 mb-3 mt-1 border-t px-4 pb-1 pt-4 text-[11.5px] font-semibold uppercase tracking-wide first:mt-0 first:border-t-0 first:pt-0" style={{ color: "var(--tx3)", borderColor: "var(--bd2)" }}>
      {t}
    </p>
  );
  const seg = <T extends string>(value: T, onChange: (v: T) => void, options: { value: T; label: React.ReactNode }[], aria: string) => (
    <div className="mb-4 [&_.v2-seg-btn]:flex-1 [&_.v2-seg-btn]:justify-center [&_.v2-seg]:flex [&_.v2-seg]:w-full">
      <Segmented<T> size="sm" label={aria} value={value} onChange={onChange} options={options} />
    </div>
  );

  const designPanel = (
    <div className="px-4 pb-6 pt-4">
      {group("Màu & chữ")}
      {label("Màu nhấn")}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {ACCENTS.map((c) => {
          const on = accent.toLowerCase() === c.toLowerCase();
          return (
            <button
              key={c}
              type="button"
              onClick={() => patchTheme({ accent: c })}
              aria-label={`Màu nhấn ${c}`}
              title={c}
              className="h-8 w-8 rounded-full"
              style={{ background: c, boxShadow: on ? "0 0 0 2px var(--sf), 0 0 0 4px var(--ac)" : "inset 0 0 0 1px rgba(0,0,0,.12)" }}
            />
          );
        })}
        <label className="relative h-8 w-8 cursor-pointer overflow-hidden rounded-full" title="Chọn màu khác" style={{ border: "1px dashed var(--bd)" }}>
          <input type="color" value={accent} onChange={(e) => patchTheme({ accent: e.target.value })} aria-label="Chọn màu nhấn khác" className="absolute -inset-1 h-10 w-10 cursor-pointer border-0 opacity-0" />
          <Plus size={14} className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ color: "var(--tx3)" }} />
        </label>
      </div>
      {label("Kiểu chữ tiêu đề")}
      {seg<"serif" | "sans">((theme.font || "serif") as "serif" | "sans", (f) => patchTheme({ font: f }), [
        { value: "serif", label: <span style={{ fontFamily: "var(--font-cormorant), Georgia, serif", fontSize: 14 }}>Cổ điển</span> },
        { value: "sans", label: "Hiện đại" },
      ], "Kiểu chữ tiêu đề")}
      {label("Nền trang")}
      {seg<"light" | "dark">((theme.mode || (dark ? "dark" : "light")) as "light" | "dark", setBgMode, [
        { value: "light", label: <><Sun size={14} /> Sáng</> },
        { value: "dark", label: <><Moon size={14} /> Tối</> },
      ], "Nền trang")}
      {label("Logo studio")}
      <div className="mb-2 flex items-center gap-2">
        {theme.logo ? (
          <>
            <span className="flex h-11 min-w-0 flex-1 items-center rounded-[10px] px-2" style={{ border: "1px solid var(--bd)", background: "var(--sf2)" }}>
              <img src={theme.logo} alt="Logo studio" className="h-8 w-auto max-w-full object-contain" />
            </span>
            <button type="button" onClick={() => patchTheme({ logo: "" })} className={btn("ghost", "sm")}>Gỡ</button>
          </>
        ) : null}
      </div>
      <label className={btn("secondary", "md", "mb-1 w-full cursor-pointer")}>
        <ImagePlus size={16} /> {theme.logo ? "Đổi logo" : "Tải logo lên"}
        <input type="file" accept="image/*" hidden onChange={async (e) => {
          const file = e.target.files?.[0]; e.target.value = "";
          if (!file) return;
          await uploadLogo(file);
        }} />
      </label>

      {group("Bố cục")}
      {label("Độ rộng trang")}
      {seg<"compact" | "full">((theme.contentWidth || "compact") as "compact" | "full", (w) => patchTheme({ contentWidth: w }), [
        { value: "compact", label: "Thu nhỏ" },
        { value: "full", label: "Toàn màn hình" },
      ], "Độ rộng trang")}
      {label("Bo góc")}
      {seg<"rounded" | "sharp">((theme.radius || "rounded") as "rounded" | "sharp", (r) => patchTheme({ radius: r }), [
        { value: "rounded", label: "Bo tròn" },
        { value: "sharp", label: "Vuông" },
      ], "Bo góc")}
      {label("Vị trí menu")}
      {seg<"top" | "left" | "bottom">((theme.navPosition || "top") as "top" | "left" | "bottom", (np) => patchTheme({ navPosition: np }), [
        { value: "top", label: "Trên" },
        { value: "left", label: "Trái" },
        { value: "bottom", label: "Dưới" },
      ], "Vị trí menu")}

      {group("Ảnh bìa & bộ sưu tập")}
      {label("Chiều cao ảnh bìa")}
      {seg<"small" | "medium" | "large">((theme.heroSize || "medium") as "small" | "medium" | "large", (h) => patchTheme({ heroSize: h }), [
        { value: "small", label: "Thấp" },
        { value: "medium", label: "Vừa" },
        { value: "large", label: "Cao" },
      ], "Chiều cao ảnh bìa")}
      {label("Căn chữ trên ảnh bìa")}
      {seg<"center" | "left">((theme.heroAlign || "center") as "center" | "left", (a) => patchTheme({ heroAlign: a }), [
        { value: "center", label: "Giữa" },
        { value: "left", label: "Trái" },
      ], "Căn chữ trên ảnh bìa")}
      {label("Số cột bộ sưu tập")}
      {seg<"2" | "3" | "4">(String(Number(theme.galleryCols) || 3) as "2" | "3" | "4", (n) => patchTheme({ galleryCols: Number(n) as 2 | 3 | 4 }), [
        { value: "2", label: "2 cột" },
        { value: "3", label: "3 cột" },
        { value: "4", label: "4 cột" },
      ], "Số cột bộ sưu tập")}
    </div>
  );

  const fabOff = !!theme.fab?.off;
  const settingsPanel = (
    <div className="px-4 pb-6 pt-4">
      {group("Tên miền")}
      {!savedSub || domainState ? (
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="text-[12.5px] font-semibold" style={{ color: "var(--tx2)" }}>Tình trạng</span>
          <DomainStateBadge state={domainState} saved={!!savedSub} />
        </div>
      ) : null}
      <SubdomainField pub={b} mainHost={mainHost} stacked />
      {canCustomDomain && (
        <div className="-mt-1">
          <CustomDomain
            initialDomain={(site.custom_domain as string | null) ?? null}
            initialVerified={!!(site as { custom_domain_verified?: boolean }).custom_domain_verified}
          />
        </div>
      )}

      <div className="mt-5" />
      {group("Nút liên hệ nổi")}
      <p className="mb-1 text-[12px]" style={{ color: "var(--tx3)" }}>
        Góc phải trang. Lấy sẵn số điện thoại &amp; Facebook trong thông tin studio; khách bấm là gọi hoặc nhắn ngay.
      </p>
      <Switch checked={!fabOff} onChange={toggleFabOff} label="Hiện nút liên hệ nổi" />
      <div className="ml-1 border-l pl-3" style={{ borderColor: "var(--bd2)", opacity: fabOff ? 0.55 : 1 }}>
        {FAB.map(([k, l]) => (
          <Switch key={k} checked={fabOn(k)} onChange={() => toggleFab(k)} label={l} />
        ))}
      </div>

      <div className="mt-4" />
      {group("SEO & chia sẻ")}
      <SeoFields site={site} supabase={supabase} onFlash={flash} host={host} compact />

      <div className="mt-5" />
      {group("Lượt xem")}
      {siteViews ? (
        <div className="-mt-3.5 [&>div]:!border-t-0">
          <ViewStats stats={siteViews} published={published} />
        </div>
      ) : (
        <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>Chưa có số liệu.</p>
      )}

      {group("CSS tùy chỉnh (nâng cao)")}
      <textarea
        className={`${inputCls} font-mono`}
        style={{ minHeight: 140, fontSize: 12 }}
        placeholder={".site-block { } \n/* CSS riêng áp cho toàn trang */"}
        value={String(theme.customCss ?? "")}
        onChange={(e) => patchTheme({ customCss: e.target.value })}
        aria-label="CSS tùy chỉnh"
      />
      <p className="mt-2 text-[12px] leading-relaxed" style={{ color: "var(--tx3)" }}>
        Chỉ áp trên <b>trang đã xuất bản</b> (không hiện trong khung soạn này). Xuất bản rồi mở trang để xem. Sai cú pháp có thể làm trang lệch.
      </p>
    </div>
  );

  const pagePanel = (
    <>
      <div className="sticky top-0 z-10 flex-none px-2" style={{ borderBottom: "1px solid var(--bd)", background: "var(--sf)" }}>
        <div className="[&_.v2-tab]:flex-1 [&_.v2-tab]:justify-center [&_.v2-tabs]:border-b-0">
          <Tabs<RightTab>
            label="Cài đặt trang"
            value={rightTab}
            onChange={setRightTab}
            options={[
              { value: "design", label: "Giao diện", icon: Palette },
              { value: "settings", label: "Cài đặt", icon: Settings2 },
            ]}
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {rightTab === "design" ? designPanel : settingsPanel}
        <div className="mx-4 mb-5">
          <Callout tone="blue" icon={Lightbulb}>
            Bấm thẳng vào chữ trên trang để sửa. Rê chuột lên một khối để di chuyển, nhân bản hay xoá.
          </Callout>
        </div>
      </div>
    </>
  );

  const selIndex = selected ? blocks.findIndex((x) => x.id === selected.id) : -1;
  const blockHead = selected ? (
    <div className="flex flex-none items-center gap-2.5 px-4 py-3" style={{ borderBottom: "1px solid var(--bd)" }}>
      {(() => {
        const Icon = blockIcon(selected.type);
        return (
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px]" style={{ background: "var(--acS)", color: "var(--ac)" }}>
            <Icon size={17} />
          </span>
        );
      })()}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold">{SITE_BLOCK_LABEL[selected.type]}</p>
        <p className="truncate text-[12px]" style={{ color: "var(--tx3)" }}>
          {selected.visible ? "Chỉnh nội dung & bố cục khối này" : "Khối đang ẩn khỏi trang"}
        </p>
      </div>
      <Menu label="Thao tác với khối đang chọn" width={210} items={blockMenu(selected, selIndex, "head")} />
      <button type="button" onClick={() => setSelId(null)} aria-label="Bỏ chọn khối" title="Bỏ chọn (Esc)" className={iconBtn()}>
        <X size={17} />
      </button>
    </div>
  ) : null;

  const inspector = selected ? (
    <Inspector
      key={selected.id}
      hideHead
      block={selected}
      blocks={blocks}
      siteUrl={savedSub && MAIN_HOST ? `https://${savedSub}.${MAIN_HOST}` : ""}
      albums={albums}
      priceLists={priceLists}
      accent={accent}
      onEdit={(k, v, commit) => setConfig(selected.id, k, v, commit)}
      onBeforeEdit={snapshot}
    />
  ) : null;

  const publishBtn = published ? (
    liveUrl ? (
      <a href={liveUrl} target="_blank" rel="noreferrer" className={btn("secondary", "md", "hidden sm:inline-flex")}>
        <ExternalLink size={16} /> Xem trang
      </a>
    ) : (
      <Badge tone="green" dot>Đã xuất bản</Badge>
    )
  ) : (
    <button
      type="button"
      onClick={togglePublish}
      disabled={busy || !canPublish}
      title={canPublish ? "" : "Nâng cấp để xuất bản"}
      className={btn("primary")}
    >
      <Rocket size={16} /> <span className="hidden sm:inline">Xuất bản</span><span className="sm:hidden">Đăng</span>
    </button>
  );

  const moreItems: MenuItem[] = [
    { label: preview ? "Quay lại chỉnh sửa" : "Xem trước", icon: preview ? PencilLine : Eye, onClick: () => { setPreview((p) => !p); setSelId(null); } },
    { label: "Hoàn tác", hint: "Ctrl + Z", icon: Undo2, onClick: undo, disabled: !canUndo },
    { label: "Làm lại", hint: "Ctrl + Y", icon: Redo2, onClick: redo, disabled: !canRedo },
    ...(liveUrl && published ? (["divider", { label: "Mở trang thật", hint: host, icon: ExternalLink, href: liveUrl, external: true }] as MenuItem[]) : []),
    ...(published
      ? (["divider", { label: "Gỡ xuất bản", hint: "Khách sẽ không mở được trang", icon: EyeOff, danger: true, onClick: togglePublish, disabled: busy || !canPublish }] as MenuItem[])
      : []),
    "divider",
    { label: "Về Website & chatbox", icon: ArrowLeft, href: "/dashboard/site" },
  ];

  const ui = (
    <div
      className="studio-shell ui-v2"
      data-theme={uiTheme}
      style={{
        position: "fixed", inset: 0, zIndex: 60, display: "flex", flexDirection: "column", background: "var(--bg)", color: "var(--tx)",
        ...(acBase ? { ["--ac-base" as string]: acBase } : {}),
      }}
    >
      {/* ── Thanh trên ─────────────────────────────────────────────────── */}
      <header className="flex h-[58px] flex-none items-center gap-2 px-2.5 sm:gap-3 sm:px-4" style={{ background: "var(--sf)", borderBottom: "1px solid var(--bd)" }}>
        <a href="/dashboard/site" aria-label="Quay lại Website & chatbox" title="Quay lại Website & chatbox" className={iconBtn()}>
          <ArrowLeft size={18} />
        </a>
        <div className="min-w-0 flex-1 lg:flex-none">
          <p className="truncate text-[15px] font-bold" style={{ letterSpacing: "-.2px" }}>Trình dựng website</p>
          <p className="flex min-w-0 items-center gap-1.5 text-[12px]" style={{ color: "var(--tx3)" }}>
            <span className="h-1.5 w-1.5 flex-none rounded-full" style={{ background: published ? "var(--gn)" : "var(--tx3)" }} />
            <span className="truncate">{published ? "Đã xuất bản" : "Nháp"}{host ? ` · ${host}` : ""}</span>
          </p>
        </div>

        {!preview && (
          <div className="mx-auto hidden items-center gap-1.5 lg:flex">
            <Segmented<"desktop" | "mobile">
              size="sm"
              label="Khung xem"
              value={device}
              onChange={setDevice}
              options={[
                { value: "desktop", label: <><Monitor size={14} /> Máy tính</> },
                { value: "mobile", label: <><Smartphone size={14} /> Điện thoại</> },
              ]}
            />
            <span className="mx-1 h-6 w-px" style={{ background: "var(--bd)" }} />
            <button type="button" onClick={undo} disabled={!canUndo} aria-label="Hoàn tác" title="Hoàn tác (Ctrl+Z)" className={iconBtn("disabled:opacity-40")}>
              <Undo2 size={17} />
            </button>
            <button type="button" onClick={redo} disabled={!canRedo} aria-label="Làm lại" title="Làm lại (Ctrl+Y)" className={iconBtn("disabled:opacity-40")}>
              <Redo2 size={17} />
            </button>
          </div>
        )}
        {preview && <div className="mx-auto hidden lg:block" />}

        <div className="flex flex-none items-center gap-2">
          <button
            type="button"
            onClick={() => { setPreview((p) => !p); setSelId(null); }}
            className={btn(preview ? "soft" : "ghost", "md", "hidden md:inline-flex")}
          >
            {preview ? <><PencilLine size={16} /> Quay lại chỉnh sửa</> : <><Eye size={16} /> Xem trước</>}
          </button>
          {publishBtn}
          <Menu label="Thêm thao tác" width={240} items={moreItems} />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* ── Cột trái ─────────────────────────────────────────────────── */}
        {!preview && (
          <aside className="hidden w-[284px] flex-none flex-col lg:flex" style={{ background: "var(--sf)", borderRight: "1px solid var(--bd)" }}>
            <div className="flex-none p-3 [&_.v2-seg-btn]:flex-1 [&_.v2-seg-btn]:justify-center [&_.v2-seg]:flex [&_.v2-seg]:w-full" style={{ borderBottom: "1px solid var(--bd2)" }}>
              <Segmented<Side>
                size="sm"
                label="Cột trái"
                value={side}
                onChange={(s) => setLeftTab(tabOf(s))}
                options={[
                  { value: "layout", label: "Bố cục", count: blocks.length },
                  { value: "add", label: "Thêm khối" },
                  { value: "templates", label: "Mẫu" },
                ]}
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {side === "layout" ? layoutList : side === "add" ? addPanel : templatesPanel}
            </div>
          </aside>
        )}

        {/* ── Canvas (giữ nguyên cách vẽ của bản cũ) ───────────────────── */}
        <main
          className={preview ? "" : "px-3 pb-24 pt-3 sm:px-5 sm:pt-5 lg:pb-8 lg:pt-6"}
          style={{ flex: 1, overflowY: "auto", background: preview ? "var(--s-bg)" : "var(--bg2)", ...canvasVars }}
          onClick={() => setSelId(null)}
        >
          <div
            style={{
              maxWidth: canvasMax,
              margin: "0 auto",
              background: "var(--s-bg)",
              color: "var(--s-text)",
              minHeight: preview ? "100vh" : "calc(100vh - 110px)",
              borderRadius: preview ? 0 : 14,
              overflow: "hidden",
              boxShadow: preview ? "none" : "0 1px 2px rgba(16,24,40,.06), 0 12px 32px -12px rgba(16,24,40,.18)",
              transition: "max-width .25s ease",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {canvasBlocks.length === 0 ? (
              <div style={{ padding: "120px 24px", textAlign: "center", color: "var(--s-text)", opacity: 0.6 }}>
                <p style={{ fontFamily: fontHead, fontSize: 30 }}>Trang trống</p>
                <p style={{ marginTop: 8, fontSize: 14 }}>
                  {preview && blocks.length ? "Mọi khối đang bị ẩn — bật lại bằng con mắt trên khối." : <>Chọn một <b>Mẫu</b> hoặc kéo khối từ cột <b>Thêm khối</b> vào đây.</>}
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start" }}>
                {canvasBlocks.map((x, i) => {
                  const isHero = x.type === "hero";
                  const half = x.config?.width === "half" && !isHero;
                  return (
                    <Fragment key={x.id}>
                      {!preview && <DropZone dragging={dragging} active={dropIndex === i} onOver={() => setDropIndex(i)} onDrop={() => {
                        if (dragType) insertBlock(dragType, i);
                        else if (dragId) reorderTo(i);
                        setDropIndex(null); setDragType(null); setDragId(null);
                      }} />}
                      <div style={{ flex: half ? "1 1 calc(50% - 0.5px)" : "1 1 100%", minWidth: half ? 240 : 0 }}>
                        <BlockShell
                          block={x}
                          selected={selId === x.id}
                          preview={preview}
                          first={i === 0}
                          last={i === canvasBlocks.length - 1}
                          fontHead={fontHead}
                          accent={accent}
                          albums={albums}
                          pricelist={pricelist}
                          priceLabels={priceLabels}
                          onSelect={() => setSelId(x.id)}
                          onDragStart={() => { setDragId(x.id); setDragType(null); }}
                          onDragEnd={() => { setDragId(null); setDropIndex(null); }}
                          onMove={(d) => moveDir(x.id, d)}
                          onDup={() => dupBlock(x.id)}
                          onDel={() => delBlock(x.id)}
                          onToggleVisible={() => toggleVisible(x.id)}
                          onEdit={(k, v, commit) => setConfig(x.id, k, v, commit)}
                          onBeforeEdit={snapshot}
                        />
                      </div>
                    </Fragment>
                  );
                })}
                {!preview && (
                  <DropZone dragging={dragging} active={dropIndex === blocks.length} onOver={() => setDropIndex(blocks.length)} onDrop={() => {
                    if (dragType) insertBlock(dragType, blocks.length);
                    else if (dragId) reorderTo(blocks.length);
                    setDropIndex(null); setDragType(null); setDragId(null);
                  }} tall />
                )}
              </div>
            )}
          </div>
        </main>

        {/* ── Cột phải ─────────────────────────────────────────────────── */}
        {!preview && (
          <aside className="hidden w-[328px] flex-none flex-col lg:flex" style={{ background: "var(--sf)", borderLeft: "1px solid var(--bd)" }}>
            {selected ? (
              <>
                {blockHead}
                <div className="min-h-0 flex-1 overflow-y-auto">{inspector}</div>
              </>
            ) : (
              pagePanel
            )}
          </aside>
        )}
      </div>

      {/* ── Điện thoại / máy tính bảng: thanh dưới mở ngăn kéo ─────────── */}
      {!preview && (
        <nav
          className="grid flex-none grid-cols-5 lg:hidden"
          style={{ background: "var(--sf)", borderTop: "1px solid var(--bd)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
          aria-label="Công cụ dựng trang"
        >
          {(
            [
              ["layout", "Bố cục", Layers],
              ["add", "Thêm", Plus],
              ["templates", "Mẫu", LayoutTemplate],
              ["design", "Giao diện", Palette],
              ["block", selected ? "Chỉnh khối" : "Khối", PencilLine],
            ] as [Exclude<Sheet, null>, string, typeof Layers][]
          ).map(([k, l, Icon]) => {
            const disabled = k === "block" && !selected;
            const hot = k === "block" && !!selected;
            return (
              <button
                key={k}
                type="button"
                disabled={disabled}
                onClick={() => {
                  if (k === "layout" || k === "add" || k === "templates") setLeftTab(tabOf(k));
                  setSheet(k);
                }}
                className="flex flex-col items-center gap-0.5 pb-2 pt-2 disabled:opacity-40"
                style={{ color: hot ? "var(--ac)" : "var(--tx2)" }}
              >
                <span className="flex h-7 w-11 items-center justify-center rounded-full" style={{ background: hot ? "var(--acS)" : "transparent" }}>
                  <Icon size={19} />
                </span>
                <span className="text-[11px] font-semibold">{l}</span>
              </button>
            );
          })}
        </nav>
      )}

      {toast && (
        <div
          role="status"
          className="fixed bottom-[86px] left-1/2 z-[85] max-w-[calc(100vw-32px)] -translate-x-1/2 rounded-[14px] px-4 py-2.5 text-[13px] font-semibold lg:bottom-6"
          style={{ background: "var(--tx)", color: "var(--sf)", boxShadow: "var(--sh-pop)" }}
        >
          {toast}
        </div>
      )}
    </div>
  );

  const sheetTitle: Record<Exclude<Sheet, null>, string> = {
    layout: "Bố cục trang",
    add: "Thêm khối",
    templates: "Mẫu trang",
    design: "Giao diện & cài đặt",
    block: selected ? SITE_BLOCK_LABEL[selected.type] : "Khối",
  };

  return (
    <>
      {createPortal(ui, document.body)}
      <Drawer
        open={sheet !== null && !(sheet === "block" && !selected)}
        onClose={() => setSheet(null)}
        title={sheet ? sheetTitle[sheet] : ""}
        width={420}
      >
        {sheet === "layout" ? layoutList : sheet === "add" ? addPanel : sheet === "templates" ? templatesPanel : sheet === "design" ? (
          <div className="-mx-5 -my-[18px] flex flex-col">{pagePanel}</div>
        ) : sheet === "block" && selected ? (
          <div className="-mx-5 -my-[18px]">
            <div className="flex items-center gap-2 px-4 pt-3">
              <span className="text-[12.5px]" style={{ color: "var(--tx3)" }}>{selected.visible ? "Đang hiện trên trang" : "Đang ẩn khỏi trang"}</span>
              <span className="ml-auto flex">
                <Menu label="Thao tác với khối đang chọn" width={210} items={blockMenu(selected, selIndex, "head")} />
              </span>
            </div>
            {inspector}
          </div>
        ) : null}
      </Drawer>
    </>
  );
}
