"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  ImagePlus,
  Images,
  LayoutGrid,
  Palette,
  Plus,
  RectangleVertical,
  Replace,
  RotateCcw,
  Shuffle,
  Trash2,
  Type,
  Undo2,
  X,
} from "lucide-react";
import { btn } from "@/components/v2/kit";
import { Switch } from "@/components/v2/kit-client";
import type { CollageDoc, CollagePage, Crop, LayoutInput, PhotoFrame, Rect, TextFrame, TextStyle } from "@/lib/collage/types";
import { COLLAGE_LIMITS } from "@/lib/collage/types";
import { COLLAGE_FORMATS, formatById } from "@/lib/collage/formats";
import { COLLAGE_FONTS, nearestWeight } from "@/lib/collage/fonts";
import { TEXT_PRESETS, presetById, sizeFor } from "@/lib/collage/typography";
import { PICKABLE_LOCKUPS as LOCKUPS, lockupById, lockupFor, type LockCtx } from "@/lib/collage/lockups";
import { panoramaMax } from "@/lib/collage/carousel";
import { paletteSwatches } from "@/lib/collage/palette";
import { isEndPage } from "@/lib/collage/endcard";
import type { SignSpec } from "@/lib/collage/brand";
import { WishesSheet } from "./WishesSheet";
import { focusCrop } from "@/lib/collage/crop";
import { heroPhoto } from "@/lib/collage/compose";
import { styleById } from "@/lib/collage/styles";
import { addTextToPage, applyLayout, changeFormat, pagePhotoIds, pageSuggestions, pageText, relayoutPage, removeTextFromPage, type Suggestion } from "@/lib/collage/generate";
import type { PhotoCat, PhotoInfo } from "@/lib/collage/categories";
import type { PersonChip } from "@/lib/face-people";
import type { PhotoLite } from "./api";
import { EditLayer, PageView, type ImgUrl } from "./PageView";
import { SaveBadge, type SaveStatus } from "./OverviewStep";
import { CAT_ALL, CAT_PICKED, CatChips, PhotoGrid, Sheet, StudioHeader, tagLabel, useViewport } from "./ui";

/* ═══════════════════════════════════════════════════════════════════════════
   BƯỚC 4 — SỬA TỪNG LAYOUT, làm cho điện thoại trước:
     • chạm ảnh → kéo để dời ảnh trong khung, chụm hai ngón để phóng; đổi ảnh,
       đổi chỗ với ảnh khác, đặt lại, bỏ khỏi trang (máy dàn lại);
     • chạm chữ → sửa nội dung, kiểu chữ, cỡ, màu, căn lề, bóng chữ; kéo để dời;
     • MẪU GỢI Ý ngay dưới trang: nhiều bố cục + phong cách cho đúng các ảnh
       đang có; "Gợi ý khác" đổi hẳn sang một loạt mẫu mới và áp mẫu đầu tiên;
     • Ảnh: thêm / bớt ảnh trên trang (chỉ ảnh trong album);
     • Nền: màu nền, ảnh làm nền mờ;
     • Trang: dời trước / sau, thêm trang, xoá trang, đổi khổ cả bộ.
   Mọi thay đổi tự lưu (giữ 1 ngày) và hoàn tác được (↶).
   ═══════════════════════════════════════════════════════════════════════════ */

type Tool = "photos" | "text" | "bg" | "page";

const TEXT_COLORS = ["#ffffff", "#f6f1e8", "#d9b77a", "#2b2622", "#111111", "#7a4848", "#c9344a", "#a07c55", "#2f5d8a", "#3e6b48"];
const BG_COLORS = ["#ffffff", "#f5f0e8", "#f7e9e6", "#efe6dc", "#e8eef2", "#dfe7df", "#121212", "#2b2622", "#7b1e22", "#1f3a33"];

export interface EditorProps {
  doc: CollageDoc;
  pageIdx: number;
  setPageIdx: (i: number) => void;
  photos: PhotoLite[];
  cats: PhotoCat[];
  info: Record<string, PhotoInfo>;
  people: PersonChip[];
  driveIdOf: Map<string, string>;
  inputs: Map<string, LayoutInput>;
  /** Đo tỉ lệ các ảnh chưa đo (ảnh mới thêm từ album) trước khi dàn; trả bảng mới nhất. */
  ensureInputs: (ids: string[]) => Promise<Map<string, LayoutInput>>;
  img: ImgUrl;
  driveOf: (id: string) => string | undefined;
  fontsReady: number;
  watermark: string | null;
  save: SaveStatus;
  /** Sửa bộ layout; `history = false` cho các bước giữa một thao tác kéo. */
  apply: (fn: (d: CollageDoc) => CollageDoc, history?: boolean) => void;
  /** Ghi một mốc hoàn tác (đầu một thao tác kéo / chụm). */
  checkpoint: () => void;
  undo: () => void;
  canUndo: boolean;
  onBack: () => void;
  onExport: () => void;
  toast: (t: string) => void;
  /** Ngày cưới / tên để điền dòng phụ khi đổi mẫu chữ. */
  lockCtx: LockCtx;
  /** Màu chủ đạo của các ảnh (nạp khi cần) — cho dải "Màu từ ảnh" ở tab Nền. */
  paletteFor: (ids: string[]) => Promise<string[][]>;
  /** Chữ ký studio (hiện y như trên ảnh xuất). */
  sign?: SignSpec | null;
  /** Xem trước như bài đăng Instagram. */
  onPreview: () => void;
}

function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: { v: T; label: React.ReactNode; aria?: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-[10px] p-0.5" style={{ background: "var(--sf2)", border: "1px solid var(--bd)" }}>
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          aria-pressed={value === o.v}
          aria-label={o.aria}
          onClick={() => onChange(o.v)}
          className="flex h-9 min-w-[40px] items-center justify-center gap-1 rounded-[8px] px-2.5 text-[13px] font-semibold"
          style={value === o.v ? { background: "var(--sf)", color: "var(--ac)", boxShadow: "0 1px 3px rgba(0,0,0,.12)" } : { color: "var(--tx2)" }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Swatches({ colors, value, onPick, label }: { colors: string[]; value: string; onPick: (c: string) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`${label} ${c}`}
          aria-pressed={value.toLowerCase() === c}
          onClick={() => onPick(c)}
          className="h-9 w-9 rounded-full"
          style={{ background: c, border: "1px solid var(--bd)", boxShadow: value.toLowerCase() === c ? "0 0 0 2.5px var(--sf), 0 0 0 4.5px var(--ac)" : undefined }}
        />
      ))}
    </div>
  );
}

function Slider({ label, value, min, max, step = 1, onChange, onStart, suffix = "" }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; onStart?: () => void; suffix?: string }) {
  return (
    <label className="flex items-center gap-3">
      <span className="w-[76px] flex-none text-[12.5px] font-medium" style={{ color: "var(--tx2)" }}>
        {label}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onPointerDown={onStart}
        onKeyDown={onStart}
        onChange={(e) => onChange(Number(e.target.value))}
        className="min-w-0 flex-1"
        style={{ accentColor: "var(--ac)" }}
      />
      <span className="tnum w-[42px] flex-none text-right text-[12px]" style={{ color: "var(--tx3)" }}>
        {Math.round(value)}
        {suffix}
      </span>
    </label>
  );
}

/** Bảng chọn ảnh trong album (đổi ảnh / thêm ảnh / trang mới) — chỉ ảnh studio đã giao. */
function PhotoChooser({
  title,
  photos,
  cats,
  info,
  people,
  driveIdOf,
  img,
  preferred,
  multi,
  max,
  initial = [],
  disabled,
  onDone,
  onClose,
}: {
  title: string;
  photos: PhotoLite[];
  cats: PhotoCat[];
  info: Record<string, PhotoInfo>;
  people: PersonChip[];
  driveIdOf: Map<string, string>;
  img: ImgUrl;
  /** Ảnh khách đã chọn cho bộ này — hiện trước. */
  preferred: string[];
  multi: boolean;
  max: number;
  initial?: string[];
  disabled?: (id: string) => boolean;
  onDone: (ids: string[]) => void;
  onClose: () => void;
}) {
  const vp = useViewport();
  const [cat, setCat] = useState(preferred.length ? CAT_PICKED : CAT_ALL);
  const [picked, setPicked] = useState<string[]>(initial);
  const byId = useMemo(() => new Map(photos.map((p) => [p.id, p])), [photos]);
  const shown = useMemo(() => {
    const ids = cat === CAT_PICKED ? preferred : cat === CAT_ALL ? photos.map((p) => p.id) : photos.filter((p) => info[p.id]?.tags.includes(cat)).map((p) => p.id);
    return ids.map((id) => byId.get(id)).filter((p): p is PhotoLite => !!p);
  }, [cat, preferred, photos, info, byId]);
  const tap = (id: string) => {
    if (disabled?.(id)) return;
    if (!multi) {
      onDone([id]);
      return;
    }
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= max ? p : [...p, id]));
  };
  return (
    <Sheet
      title={title}
      onClose={onClose}
      tall
      footer={
        multi ? (
          <>
            <span className="min-w-0 flex-1 text-[13px]" style={{ color: "var(--tx3)" }}>
              Đã chọn {picked.length}/{max} ảnh
            </span>
            <button type="button" disabled={!picked.length} onClick={() => onDone(picked)} className={btn("primary", "lg")}>
              Xong
            </button>
          </>
        ) : undefined
      }
    >
      <div className="sticky top-0 z-[2]" style={{ background: "var(--sf)" }}>
        <CatChips cats={cats} value={cat} onChange={setCat} counts={{ all: photos.length, picked: preferred.length }} people={people} driveIdOf={driveIdOf} />
      </div>
      <div className="px-[3px] pb-3">
        <PhotoGrid
          photos={shown}
          img={img}
          picked={(id) => picked.includes(id)}
          order={multi ? (id) => (picked.includes(id) ? picked.indexOf(id) + 1 : null) : undefined}
          onTap={tap}
          dim={disabled}
          label={(id) => tagLabel(info[id], cats)}
          cols={vp.w >= 640 ? 5 : 4}
        />
      </div>
    </Sheet>
  );
}

export default function EditorStep(p: EditorProps) {
  const { doc, pageIdx, apply } = p;
  const vp = useViewport();
  const page = doc.pages[Math.min(pageIdx, doc.pages.length - 1)];
  const f = formatById(doc.formatId);
  const short = Math.min(f.w, f.h);
  const style = styleById(page.styleId);
  const [tool, setTool] = useState<Tool>("photos");
  const [sel, setSel] = useState<string | null>(null);
  const [swapFrom, setSwapFrom] = useState<string | null>(null);
  const [chooser, setChooser] = useState<null | { kind: "replace" | "add" | "newpage"; frameId?: string }>(null);
  const [formatOpen, setFormatOpen] = useState(false);
  // Loạt mẫu gợi ý đang hiện: tính lại khi đổi trang / đổi ảnh / thêm bớt chữ;
  // "Gợi ý khác" giữ loạt mới trong state (không tính lại khi áp mẫu — dải không nhảy dưới tay).
  const [sugState, setSugState] = useState<{ sig: string; round: number; list: Suggestion[] } | null>(null);
  const [relayouts, setRelayouts] = useState(1);
  // Màu từ ảnh (tab Nền) + hoa lá đã tắt (bật lại được).
  const [photoColors, setPhotoColors] = useState<{ key: string; colors: string[] } | null>(null);
  const [ornStash, setOrnStash] = useState<{ pageId: string; orn: NonNullable<CollagePage["ornaments"]> } | null>(null);
  const [newText, setNewText] = useState("");
  const [wishesOpen, setWishesOpen] = useState(false);
  // Slide cuối của studio (mã QR): không đổi bố cục / ảnh — chỉ sửa chữ, nền, xoá.
  const endPage = isEndPage(page);

  useEffect(() => {
    setSel(null);
    setSwapFrom(null);
    // Slide cuối của studio không có tab Ảnh.
    if (isEndPage(page)) setTool((t) => (t === "photos" ? "text" : t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page.id]);

  // Tab Nền: lấy màu chủ đạo các ảnh của layout (ảnh nhỏ cùng miền) → dải "Màu từ ảnh".
  const idsKey = pagePhotoIds(page).join(",");
  const paletteFor = p.paletteFor;
  useEffect(() => {
    if (tool !== "bg" || !idsKey) return;
    let alive = true;
    void paletteFor(idsKey.split(",")).then((pals) => {
      if (alive) setPhotoColors({ key: idsKey, colors: paletteSwatches(pals, 9) });
    });
    return () => {
      alive = false;
    };
  }, [tool, idsKey, paletteFor]);

  const selFrame = page.frames.find((x) => x.id === sel) ?? null;
  const text = pageText(page);
  const ids = pagePhotoIds(page);

  /* ── Cỡ khung xem ── */
  const wide = vp.w >= 900;
  // Carousel liền mạch: trang rộng `span` slide — khung xem cuộn ngang.
  const span = Math.max(1, Math.round(page.span ?? 1));
  const pageRatio = (f.w * span) / f.h;
  const maxOnPage = span > 1 ? panoramaMax(span) : COLLAGE_LIMITS.pagePhotos;
  const ratio = f.w / f.h;
  // Điện thoại: chừa chỗ cho dải mẫu gợi ý ngay dưới trang (~120 px) và bảng công cụ.
  const stageMaxH = wide ? vp.h - 56 - 96 - 40 - 150 : Math.max(200, vp.h * 0.44 - 40);
  const stageMaxW = wide ? Math.min(680, vp.w - 420 - 48) : vp.w - 24;
  const stageW = span > 1 ? Math.round(Math.max(180, stageMaxH) * pageRatio) : Math.floor(Math.max(160, Math.min(stageMaxW, stageMaxH * ratio)));

  /* ── Sửa trang đang mở ── */
  const updatePage = (fn: (pg: CollagePage) => CollagePage, history = true) =>
    apply((d) => ({ ...d, pages: d.pages.map((pg, i) => (i === pageIdx ? fn(pg) : pg)) }), history);
  const updateFrame = <T extends PhotoFrame | TextFrame>(id: string, fn: (fr: T) => T, history = true) =>
    updatePage((pg) => ({ ...pg, frames: pg.frames.map((fr) => (fr.id === id ? fn(fr as T) : fr)) }), history);
  const setTextStyle = (patch: Partial<TextStyle>, history = true) => {
    if (!text) return;
    updateFrame<TextFrame>(text.id, (t) => ({ ...t, style: { ...t.style, ...patch } }), history);
  };

  /** Đổi mẫu chữ của trang: điền lại dòng phụ, kiểu chữ chính theo mẫu (đổi phông sau vẫn được). */
  const setLockup = (id: string) => {
    const spec = lockupById(id);
    updatePage((pg) => ({
      ...pg,
      frames: pg.frames.map((fr) => {
        if (fr.kind !== "text") return fr;
        const next: TextFrame = { ...fr };
        const lk = lockupFor(id, p.lockCtx);
        if (lk) next.lockup = lk;
        else delete next.lockup;
        const pr = spec?.main ? presetById(spec.main) : null;
        if (pr) {
          next.style = { ...fr.style, font: pr.font, weight: nearestWeight(pr.font, pr.weight), italic: pr.italic, uppercase: pr.uppercase, letterSpacing: pr.letterSpacing, lineHeight: pr.lineHeight, size: sizeFor(pr, fr.text, short) };
        }
        return next;
      }),
    }));
  };
  const setLockLine = (which: "kicker" | "sub", v: string, history = false) => {
    if (!text?.lockup) return;
    updateFrame<TextFrame>(
      text.id,
      (t) => {
        if (!t.lockup) return t;
        const lk = { ...t.lockup };
        const val = v.slice(0, 80);
        if (val.trim()) lk[which] = val;
        else delete lk[which];
        return { ...t, lockup: lk };
      },
      history,
    );
  };

  const relayoutWith = async (photoIds: string[]) => {
    if (!photoIds.length) {
      p.toast("Mỗi layout cần ít nhất một ảnh.");
      return;
    }
    const inputs = await p.ensureInputs(photoIds);
    updatePage((pg) => {
      const photos = photoIds.map((id) => inputs.get(id)).filter((x): x is LayoutInput => !!x);
      return relayoutPage(pg, photos, doc.formatId, (doc.seed + relayouts * 31 + photoIds.length) >>> 0) ?? pg;
    });
    setRelayouts((n) => n + 1);
    setSel(null);
  };

  /* ── Mẫu gợi ý cho đúng các ảnh đang có ── */
  const sig = `${page.id}|${ids.join(",")}|${text ? "t" : ""}|${doc.formatId}`;
  const first = useMemo(
    () => pageSuggestions(page, p.inputs, doc.formatId, doc.seed, 0, 10),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sig],
  );
  const live = sugState && sugState.sig === sig ? sugState : null;
  const sugs = live ? live.list : first;
  const applySug = (a: Suggestion) => updatePage((pg) => applyLayout(pg, a, styleById(a.styleId), short));
  /** "Gợi ý khác": loạt mẫu mới (phong cách khác, họ bố cục khác) và đổi trang sang mẫu đầu tiên. */
  const moreSugs = () => {
    const round = (live?.round ?? 0) + 1;
    const list = pageSuggestions(page, p.inputs, doc.formatId, doc.seed, round, 10);
    setSugState({ sig, round, list });
    if (list[0]) applySug(list[0]);
  };
  const isCurrent = (a: Suggestion) => a.recipe === page.recipe && a.styleId === page.styleId;

  /* ── Chạm trên trang ── */
  const onSelect = (id: string | null) => {
    if (swapFrom && id && id !== swapFrom) {
      const a = page.frames.find((x) => x.id === swapFrom);
      const b = page.frames.find((x) => x.id === id);
      if (a?.kind === "photo" && b?.kind === "photo") {
        updatePage((pg) => ({
          ...pg,
          frames: pg.frames.map((fr) => {
            if (fr.id === a.id) return { ...fr, photoId: b.photoId, crop: focusCrop(p.inputs.get(b.photoId)?.faces, a.rect.w / a.rect.h, doc.aspects[b.photoId] ?? 1.5) } as PhotoFrame;
            if (fr.id === b.id) return { ...fr, photoId: a.photoId, crop: focusCrop(p.inputs.get(a.photoId)?.faces, b.rect.w / b.rect.h, doc.aspects[a.photoId] ?? 1.5) } as PhotoFrame;
            return fr;
          }),
        }));
        setSwapFrom(null);
        setSel(null);
        return;
      }
    }
    setSwapFrom(null);
    setSel(id);
    if (id && page.frames.find((x) => x.id === id)?.kind === "text") setTool("text");
  };
  const gesture = {
    onBegin: p.checkpoint,
    onSelect,
    onCrop: (id: string, crop: Crop) => updateFrame<PhotoFrame>(id, (fr) => ({ ...fr, crop }), false),
    onMove: (id: string, rect: Rect) => updateFrame<TextFrame>(id, (fr) => ({ ...fr, rect }), false),
  };

  /* ── Trang ── */
  const movePage = (dir: -1 | 1) => {
    const j = pageIdx + dir;
    if (j < 0 || j >= doc.pages.length) return;
    apply((d) => {
      const pages = [...d.pages];
      [pages[pageIdx], pages[j]] = [pages[j], pages[pageIdx]];
      return { ...d, pages };
    });
    p.setPageIdx(j);
  };
  const deletePage = () => {
    if (doc.pages.length <= 1) {
      p.toast("Bộ ảnh ghép cần ít nhất một layout.");
      return;
    }
    if (!confirm(text ? `Xoá layout này? Nội dung “${text.text.slice(0, 40)}” cũng mất theo. Bấm ↶ để lấy lại.` : "Xoá layout này? Bấm ↶ để lấy lại.")) return;
    apply((d) => ({ ...d, pages: d.pages.filter((_, i) => i !== pageIdx) }));
    p.setPageIdx(Math.max(0, pageIdx - 1));
  };
  const addPage = async (photoIds: string[]) => {
    if (doc.pages.length >= COLLAGE_LIMITS.pages) {
      p.toast(`Mỗi bộ tối đa ${COLLAGE_LIMITS.pages} layout.`);
      return;
    }
    const inputs = await p.ensureInputs(photoIds);
    const photos = photoIds.map((id) => inputs.get(id)).filter((x): x is LayoutInput => !!x);
    const blank: CollagePage = { id: `p_${Date.now().toString(36)}`, frames: [], background: style.background, recipe: "", styleId: style.id };
    const pg = relayoutPage(blank, photos, doc.formatId, (doc.seed + Date.now()) >>> 0);
    if (!pg) return;
    apply((d) => ({
      ...d,
      photoIds: [...d.photoIds, ...photoIds.filter((id) => !d.photoIds.includes(id))].slice(0, COLLAGE_LIMITS.photos),
      pages: [...d.pages.slice(0, pageIdx + 1), pg, ...d.pages.slice(pageIdx + 1)],
    }));
    p.setPageIdx(pageIdx + 1);
  };

  /* ── Thanh trang ── */
  const strip = (
    <div className="flex flex-none items-center gap-2 overflow-x-auto px-3 py-2" style={{ scrollbarWidth: "none", borderBottom: "1px solid var(--bd2)" }}>
      {doc.pages.map((pg, i) => (
        <button
          key={pg.id}
          type="button"
          onClick={() => p.setPageIdx(i)}
          aria-label={`Layout ${i + 1}`}
          aria-current={i === pageIdx}
          className="relative flex-none overflow-hidden rounded-[6px]"
          style={{ outline: i === pageIdx ? "2.5px solid var(--ac)" : "1px solid var(--bd)", outlineOffset: i === pageIdx ? 1 : 0 }}
        >
          <PageView
            doc={doc}
            page={pg}
            width={(pg.span ?? 1) > 1 ? Math.min(180, Math.round((52 * f.w * (pg.span ?? 1)) / f.h)) : Math.round(44 * Math.min(1.6, ratio))}
            img={p.img}
            driveOf={p.driveOf}
            fontsReady={p.fontsReady}
            slides={(pg.span ?? 1) > 1 ? "lines" : undefined}
          />
          <span className="absolute bottom-0.5 left-0.5 rounded px-1 text-[10px] font-bold" style={{ background: "rgba(0,0,0,.5)", color: "#fff" }}>
            {i + 1}
          </span>
        </button>
      ))}
      <button type="button" onClick={() => setChooser({ kind: "newpage" })} aria-label="Thêm layout" className="flex h-[52px] w-[44px] flex-none items-center justify-center rounded-[6px]" style={{ border: "1.5px dashed var(--bd)", color: "var(--tx3)" }}>
        <Plus size={18} />
      </button>
    </div>
  );

  /* ── Công cụ khi đang chọn ảnh ── */
  const photoTools = selFrame?.kind === "photo" && (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 text-[14px] font-semibold">Ảnh đang chọn</p>
        <button type="button" onClick={() => setSel(null)} className={btn("secondary", "sm")}>
          Xong
        </button>
      </div>
      <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>
        Kéo ảnh để chỉnh vị trí, chụm hai ngón để phóng to.
      </p>
      <Slider
        label="Phóng"
        value={Math.round(selFrame.crop.zoom * 100)}
        min={100}
        max={400}
        suffix="%"
        onStart={p.checkpoint}
        onChange={(v) => updateFrame<PhotoFrame>(selFrame.id, (fr) => ({ ...fr, crop: { ...fr.crop, zoom: v / 100 } }), false)}
      />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <button type="button" onClick={() => setChooser({ kind: "replace", frameId: selFrame.id })} className={btn("secondary", "md")}>
          <Replace size={16} /> Đổi ảnh
        </button>
        <button
          type="button"
          disabled={ids.length < 2}
          onClick={() => {
            setSwapFrom(selFrame.id);
            setSel(null);
            p.toast("Chạm vào ảnh khác trên trang để đổi chỗ.");
          }}
          className={btn("secondary", "md")}
        >
          <ArrowLeftRight size={16} /> Đổi chỗ
        </button>
        <button
          type="button"
          onClick={() => updateFrame<PhotoFrame>(selFrame.id, (fr) => ({ ...fr, crop: focusCrop(p.inputs.get(fr.photoId)?.faces, fr.rect.w / fr.rect.h, doc.aspects[fr.photoId] ?? 1.5) }))}
          className={btn("secondary", "md")}
        >
          <RotateCcw size={16} /> Đặt lại
        </button>
        <button type="button" disabled={ids.length < 2} onClick={() => relayoutWith(ids.filter((x) => x !== selFrame.photoId))} className={btn("secondary", "md")}>
          <X size={16} /> Bỏ khỏi trang
        </button>
      </div>
    </div>
  );

  /* ── Công cụ chữ ── */
  const textTools = text ? (
    <div className="flex flex-col gap-3">
      <textarea
        value={text.text}
        rows={2}
        onFocus={p.checkpoint}
        onChange={(e) => updateFrame<TextFrame>(text.id, (t) => ({ ...t, text: e.target.value.slice(0, COLLAGE_LIMITS.textChars) }), false)}
        aria-label="Nội dung chữ"
        className="v2-input resize-none"
        style={{ fontSize: 16 }}
      />
      <button type="button" onClick={() => setWishesOpen(true)} className={btn("ghost", "sm", "-mt-1 self-start")}>
        <Type size={14} /> Chọn từ thư viện lời chúc
      </button>
      <div className="flex gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
        {TEXT_PRESETS.map((pr) => {
          const on = text.style.font === pr.font && text.style.italic === pr.italic && text.style.uppercase === pr.uppercase;
          return (
            <button
              key={pr.id}
              type="button"
              aria-pressed={on}
              onClick={() =>
                setTextStyle({
                  font: pr.font,
                  weight: nearestWeight(pr.font, pr.weight),
                  italic: pr.italic,
                  uppercase: pr.uppercase,
                  letterSpacing: pr.letterSpacing,
                  lineHeight: pr.lineHeight,
                  size: sizeFor(pr, text.text, short),
                })
              }
              className="inline-flex h-10 flex-none items-center rounded-[10px] px-3 text-[15px]"
              style={{
                fontSize: COLLAGE_FONTS.find((x) => x.key === pr.font)?.kind === "script" ? 20 : undefined,
                fontFamily: `var(${COLLAGE_FONTS.find((x) => x.key === pr.font)?.cssVar}), serif`,
                fontStyle: pr.italic ? "italic" : "normal",
                fontWeight: pr.weight,
                textTransform: pr.uppercase ? "uppercase" : "none",
                letterSpacing: `${Math.min(0.12, pr.letterSpacing)}em`,
                background: on ? "var(--acS)" : "var(--sf2)",
                color: on ? "var(--ac)" : "var(--tx)",
                border: `1px solid ${on ? "var(--ac)" : "var(--bd)"}`,
              }}
            >
              {pr.name}
            </button>
          );
        })}
      </div>
      <div>
        <p className="mb-1.5 text-[12px] font-semibold" style={{ color: "var(--tx3)" }}>
          Mẫu chữ
        </p>
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
          {LOCKUPS.map((l, i) => {
            const on = (text.lockup?.id ?? "plain") === l.id;
            const pr = l.main ? presetById(l.main) : null;
            return (
              <span key={l.id} className="contents">
                {l.occasion && !LOCKUPS[i - 1]?.occasion ? (
                  <span className="flex-none pl-1 text-[11.5px] font-semibold" style={{ color: "var(--tx3)" }}>
                    Theo dịp:
                  </span>
                ) : null}
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => setLockup(l.id)}
                  className="inline-flex h-10 flex-none items-center rounded-[10px] px-3 text-[14px]"
                  style={{
                    fontFamily: pr ? `var(${COLLAGE_FONTS.find((x) => x.key === pr.font)?.cssVar}), serif` : undefined,
                    fontSize: pr && COLLAGE_FONTS.find((x) => x.key === pr.font)?.kind === "script" ? 19 : undefined,
                    fontStyle: pr?.italic ? "italic" : "normal",
                    background: on ? "var(--acS)" : "var(--sf2)",
                    color: on ? "var(--ac)" : "var(--tx)",
                    border: `1px solid ${on ? "var(--ac)" : "var(--bd)"}`,
                  }}
                >
                  {l.name}
                </button>
              </span>
            );
          })}
        </div>
      </div>
      {text.lockup && (lockupById(text.lockup.id)?.kicker || lockupById(text.lockup.id)?.sub) ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {lockupById(text.lockup.id)?.kicker ? (
            <input
              value={text.lockup.kicker ?? ""}
              onFocus={p.checkpoint}
              onChange={(e) => setLockLine("kicker", e.target.value)}
              placeholder="Dòng nhỏ phía trên (để trống = bỏ)"
              aria-label="Dòng phụ phía trên"
              className="v2-input"
              style={{ fontSize: 16 }}
            />
          ) : null}
          {lockupById(text.lockup.id)?.sub ? (
            <input
              value={text.lockup.sub ?? ""}
              onFocus={p.checkpoint}
              onChange={(e) => setLockLine("sub", e.target.value)}
              placeholder="Dòng nhỏ phía dưới — ngày cưới, tên…"
              aria-label="Dòng phụ phía dưới"
              className="v2-input"
              style={{ fontSize: 16 }}
            />
          ) : null}
        </div>
      ) : null}
      <Slider label="Cỡ chữ" value={Math.round((text.style.size / short) * 1000) / 10} min={1} max={20} step={0.5} suffix="%" onStart={p.checkpoint} onChange={(v) => setTextStyle({ size: (v / 100) * short }, false)} />
      <Slider
        label="Rộng khung"
        value={Math.round((text.rect.w / f.w) * 100)}
        min={25}
        max={100}
        suffix="%"
        onStart={p.checkpoint}
        onChange={(v) =>
          updateFrame<TextFrame>(
            text.id,
            (t) => {
              const w = (v / 100) * f.w;
              const cx = t.rect.x + t.rect.w / 2;
              return { ...t, rect: { ...t.rect, w, x: Math.max(0, Math.min(f.w - w, cx - w / 2)) } };
            },
            false,
          )
        }
      />
      <Swatches colors={[...new Set([style.ink.toLowerCase(), ...TEXT_COLORS])]} value={text.style.color} onPick={(c) => setTextStyle({ color: c })} label="Màu chữ" />
      <div className="flex flex-wrap items-center gap-2">
        <Seg
          label="Căn chữ"
          value={text.style.align}
          onChange={(a) => setTextStyle({ align: a })}
          options={[
            { v: "left", label: <AlignLeft size={16} />, aria: "Căn trái" },
            { v: "center", label: <AlignCenter size={16} />, aria: "Căn giữa" },
            { v: "right", label: <AlignRight size={16} />, aria: "Căn phải" },
          ]}
        />
        <div className="min-w-[180px] flex-1">
          <Switch checked={!!text.style.shadow} onChange={(v) => setTextStyle({ shadow: v })} label="Bóng chữ" desc="Đọc rõ khi chữ nằm trên ảnh" />
        </div>
      </div>
      <p className="text-[12px]" style={{ color: "var(--tx3)" }}>
        Chạm vào chữ trên ảnh rồi kéo để dời chỗ. Chữ dài tự xuống dòng và thu nhỏ cho vừa khung.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => relayoutWith(ids)} className={btn("secondary", "sm")}>
          <LayoutGrid size={15} /> Dàn lại cho vừa chữ
        </button>
        <button
          type="button"
          onClick={() => {
            updatePage((pg) => removeTextFromPage(pg, p.inputs, doc.formatId, (doc.seed + 3) >>> 0));
            setSel(null);
          }}
          className={btn("ghost", "sm")}
        >
          <Trash2 size={15} /> Bỏ chữ khỏi layout này
        </button>
      </div>
    </div>
  ) : (
    <div className="flex flex-col gap-2.5">
      <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>
        Layout này chưa có nội dung. Mỗi layout chỉ mang một nội dung — thêm vào đây, máy dàn lại để chừa chỗ cho chữ.
      </p>
      <textarea value={newText} rows={2} onChange={(e) => setNewText(e.target.value.slice(0, COLLAGE_LIMITS.textChars))} placeholder="Ví dụ: Thank you for coming" aria-label="Nội dung mới" className="v2-input resize-none" style={{ fontSize: 16 }} />
      <button type="button" onClick={() => setWishesOpen(true)} className={btn("ghost", "sm", "-mt-1 self-start")}>
        <Type size={14} /> Chọn từ thư viện lời chúc
      </button>
      <button
        type="button"
        disabled={!newText.trim()}
        onClick={() => {
          updatePage((pg) => addTextToPage(pg, newText, p.inputs, doc.formatId, (doc.seed + relayouts) >>> 0));
          setRelayouts((n) => n + 1);
          setNewText("");
        }}
        className={btn("primary", "md", "self-start")}
      >
        <Type size={16} /> Thêm chữ vào layout này
      </button>
    </div>
  );

  /* ── Bảng công cụ theo tab ── */
  const tabs: { id: Tool; label: string; icon: typeof LayoutGrid }[] = [
    ...(endPage ? [] : [{ id: "photos" as Tool, label: "Ảnh", icon: Images }]),
    { id: "text", label: "Chữ", icon: Type },
    { id: "bg", label: "Nền", icon: Palette },
    { id: "page", label: "Trang", icon: RectangleVertical },
  ];
  const altW = span > 1 ? Math.min(240, Math.round((wide ? 76 : 64) * pageRatio)) : Math.round(Math.min(wide ? 92 : 68, (wide ? 100 : 80) * ratio));
  const tools = (
    <div className="flex flex-col gap-3">
      {selFrame?.kind === "photo" ? (
        photoTools
      ) : (
        <>
          <div role="tablist" aria-label="Công cụ" className="flex gap-1 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {tabs.map((t) => (
              <button
                key={t.id}
                role="tab"
                type="button"
                aria-selected={tool === t.id}
                onClick={() => {
                  setTool(t.id);
                  if (t.id !== "text") setSel(null);
                }}
                className="flex h-11 min-w-[64px] flex-1 flex-col items-center justify-center gap-0.5 rounded-[10px] text-[11.5px] font-semibold"
                style={tool === t.id ? { background: "var(--acS)", color: "var(--ac)" } : { color: "var(--tx2)" }}
              >
                <t.icon size={17} />
                {t.label}
              </button>
            ))}
          </div>

          {tool === "photos" && (
            <div className="flex flex-col gap-2.5">
              <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>
                Chạm ảnh để thêm vào hoặc bỏ khỏi layout này (tối đa {maxOnPage} ảnh) — máy tự dàn lại.
              </p>
              <PhotoGrid
                photos={doc.photoIds.map((id) => p.photos.find((x) => x.id === id)).filter((x): x is PhotoLite => !!x)}
                img={p.img}
                picked={(id) => ids.includes(id)}
                onTap={(id) => {
                  if (ids.includes(id)) relayoutWith(ids.filter((x) => x !== id));
                  else if (ids.length >= maxOnPage) p.toast(`Layout này tối đa ${maxOnPage} ảnh.`);
                  else relayoutWith([...ids, id]);
                }}
                cols={vp.w >= 640 || wide ? 5 : 4}
              />
              <button type="button" onClick={() => setChooser({ kind: "add" })} className={btn("secondary", "md", "self-start")}>
                <ImagePlus size={16} /> Thêm ảnh khác trong album
              </button>
            </div>
          )}

          {tool === "text" && textTools}

          {tool === "bg" && (
            <div className="flex flex-col gap-3">
              <Swatches colors={[...new Set([style.background.toLowerCase(), ...BG_COLORS])]} value={page.background} onPick={(c) => updatePage((pg) => ({ ...pg, background: c }))} label="Màu nền" />
              {photoColors && photoColors.key === ids.join(",") && photoColors.colors.length ? (
                <Swatches colors={photoColors.colors} value={page.background} onPick={(c) => updatePage((pg) => ({ ...pg, background: c }))} label="Màu từ ảnh" />
              ) : (
                <p className="text-[12px]" style={{ color: "var(--tx3)" }}>
                  Đang lấy màu từ ảnh của layout…
                </p>
              )}
              {page.ornaments?.length || ornStash?.pageId === page.id ? (
                <Switch
                  checked={!!page.ornaments?.length}
                  onChange={(v) => {
                    if (!v && page.ornaments?.length) {
                      setOrnStash({ pageId: page.id, orn: page.ornaments });
                      updatePage((pg) => {
                        const rest = { ...pg };
                        delete rest.ornaments;
                        return rest;
                      });
                    } else if (v && ornStash?.pageId === page.id) {
                      const orn = ornStash.orn;
                      updatePage((pg) => ({ ...pg, ornaments: orn }));
                    }
                  }}
                  label="Hoa lá, băng dính, dải phim"
                  desc="Phần trang trí đi kèm mẫu này"
                />
              ) : null}
              <Switch
                checked={!!page.bgPhoto}
                onChange={(v) =>
                  updatePage((pg) => {
                    if (!v) {
                      const rest = { ...pg };
                      delete rest.bgPhoto;
                      return rest;
                    }
                    const hero = heroPhoto(pg.frames) ?? ids[0];
                    return hero ? { ...pg, bgPhoto: { photoId: hero, blur: 26, dim: 0.18 } } : pg;
                  })
                }
                label="Nền là ảnh làm mờ"
                desc="Ảnh chính của layout trải mờ phía sau"
              />
              {page.bgPhoto && /^(tight|bleed|overlay)/.test(page.recipe) ? (
                <p className="text-[12px]" style={{ color: "var(--am)" }}>
                  Bố cục này phủ kín trang nên chưa thấy nền — chọn một bố cục có lề ở tab Bố cục.
                </p>
              ) : null}
              {page.bgPhoto ? (
                <>
                  <Slider label="Độ mờ" value={page.bgPhoto.blur} min={0} max={60} onStart={p.checkpoint} onChange={(v) => updatePage((pg) => (pg.bgPhoto ? { ...pg, bgPhoto: { ...pg.bgPhoto, blur: v } } : pg), false)} />
                  <Slider label="Phủ màu" value={Math.round(page.bgPhoto.dim * 100)} min={0} max={80} suffix="%" onStart={p.checkpoint} onChange={(v) => updatePage((pg) => (pg.bgPhoto ? { ...pg, bgPhoto: { ...pg.bgPhoto, dim: v / 100 } } : pg), false)} />
                  <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                    {ids.map((id) => {
                      const d = p.driveOf(id);
                      const on = page.bgPhoto?.photoId === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          aria-pressed={on}
                          aria-label="Dùng ảnh này làm nền"
                          onClick={() => updatePage((pg) => (pg.bgPhoto ? { ...pg, bgPhoto: { ...pg.bgPhoto, photoId: id } } : pg))}
                          className="h-14 w-14 flex-none overflow-hidden rounded-[8px]"
                          style={{ outline: on ? "2.5px solid var(--ac)" : "1px solid var(--bd)" }}
                        >
                          {d ? <img src={p.img(d, 200)} alt="" className="h-full w-full object-cover" /> : null}
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : null}
            </div>
          )}

          {tool === "page" && (
            <div className="flex flex-col gap-2.5">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <button type="button" disabled={pageIdx === 0} onClick={() => movePage(-1)} className={btn("secondary", "md")}>
                  <ChevronLeft size={16} /> Dời trước
                </button>
                <button type="button" disabled={pageIdx >= doc.pages.length - 1} onClick={() => movePage(1)} className={btn("secondary", "md")}>
                  Dời sau <ChevronRight size={16} />
                </button>
                <button type="button" onClick={() => setChooser({ kind: "newpage" })} className={btn("secondary", "md")}>
                  <Plus size={16} /> Thêm layout
                </button>
                <button type="button" onClick={deletePage} className={btn("secondary", "md")}>
                  <Trash2 size={16} /> Xoá layout
                </button>
              </div>
              <button type="button" onClick={() => setFormatOpen(true)} className={btn("ghost", "md", "self-start")}>
                <RectangleVertical size={16} /> Đổi khổ cả bộ · {f.label}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );

  /* ── Dải mẫu gợi ý — nằm ngay dưới trang, không giấu trong tab ── */
  const suggestions = (
    <div className="flex-none" style={{ background: "var(--bg)" }}>
      <div className="flex items-center gap-2 px-3 pt-1">
        <p className="min-w-0 flex-1 text-[12.5px] font-semibold" style={{ color: "var(--tx2)" }}>
          Mẫu gợi ý <span style={{ color: "var(--tx3)", fontWeight: 500 }}>· chạm để dùng</span>
        </p>
        <button type="button" onClick={moreSugs} className={btn("secondary", "sm", "flex-none")}>
          <Shuffle size={15} /> Gợi ý khác
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto px-3 pb-2.5 pt-2" style={{ scrollbarWidth: "none" }} role="listbox" aria-label="Mẫu gợi ý">
        {sugs.map((a, i) => {
          const on = isCurrent(a);
          return (
            <button
              key={`${live?.round ?? 0}-${a.recipe}-${a.styleId}-${i}`}
              type="button"
              role="option"
              aria-selected={on}
              onClick={() => applySug(a)}
              aria-label={`Mẫu ${i + 1}`}
              className="flex-none overflow-hidden rounded-[6px]"
              style={{ outline: on ? "2.5px solid var(--ac)" : "1px solid var(--bd)", outlineOffset: on ? 1 : 0 }}
            >
              <PageView doc={doc} page={applyLayout(page, a, styleById(a.styleId), short)} width={altW} img={p.img} driveOf={p.driveOf} fontsReady={p.fontsReady} />
            </button>
          );
        })}
      </div>
    </div>
  );

  const endNote = (
    <p className="flex-none px-4 pb-2.5 text-[12.5px]" style={{ color: "var(--tx3)", background: "var(--bg)" }}>
      Slide cuối của studio: mã QR dẫn tới trang studio để người xem bài đăng xem thêm ảnh. Sửa chữ ở tab Chữ; không muốn đăng thì xoá ở tab Trang.
    </p>
  );

  const stageInner = (
    <div className="relative mx-auto flex-none" style={{ width: stageW, boxShadow: "0 10px 30px -12px rgba(15,30,55,.35)" }}>
      <PageView doc={doc} page={page} width={stageW} img={p.img} driveOf={p.driveOf} fontsReady={p.fontsReady} watermark={p.watermark} selectedId={swapFrom ?? sel} slides={span > 1 ? "full" : undefined} sign={p.sign} />
      <EditLayer doc={doc} page={page} width={stageW} selectedId={sel} g={gesture} />
    </div>
  );
  // Carousel: cả dải ở chiều cao dễ sửa, vuốt ngang để xem từng slide.
  const stage =
    span > 1 ? (
      <div className="w-full overflow-x-auto overscroll-x-contain pb-1" style={{ scrollbarWidth: "thin" }}>
        <div className="px-3" style={{ width: stageW + 24 }}>
          {stageInner}
        </div>
      </div>
    ) : (
      stageInner
    );

  return (
    <>
      <StudioHeader
        title={`Layout ${pageIdx + 1}/${doc.pages.length}`}
        sub={<SaveBadge s={p.save} />}
        onBack={p.onBack}
        backLabel="Xem cả bộ"
        right={
          <>
            <button type="button" onClick={p.undo} disabled={!p.canUndo} aria-label="Hoàn tác" title="Hoàn tác" className="flex h-10 w-10 items-center justify-center rounded-full disabled:opacity-35" style={{ color: "var(--tx2)" }}>
              <Undo2 size={19} />
            </button>
            <button type="button" onClick={p.onPreview} aria-label="Xem trước như trên Instagram" title="Xem trước" className="flex h-10 w-10 items-center justify-center rounded-full" style={{ color: "var(--tx2)" }}>
              <Eye size={19} />
            </button>
            <button type="button" onClick={p.onExport} className={btn("primary", "sm")}>
              <Download size={15} /> Tải
            </button>
          </>
        }
      />
      {strip}
      {wide ? (
        <div className="flex min-h-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col overflow-auto" style={{ background: "var(--bg)" }}>
            <div className={span > 1 ? "py-5 pb-3" : "flex justify-center p-5 pb-3"}>{stage}</div>
            <div className="mx-auto w-full max-w-[760px]">{endPage ? endNote : suggestions}</div>
          </div>
          <aside className="w-[400px] flex-none overflow-y-auto p-4" style={{ borderLeft: "1px solid var(--bd)", background: "var(--sf)" }}>
            {tools}
          </aside>
        </div>
      ) : (
        <>
          <div className={span > 1 ? "flex-none pb-2 pt-3" : "flex flex-none justify-center px-3 pb-2 pt-3"} style={{ background: "var(--bg)" }}>
            {stage}
          </div>
          {endPage ? endNote : suggestions}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-4 pt-3" style={{ background: "var(--sf)", borderTop: "1px solid var(--bd)", paddingBottom: "max(16px, env(safe-area-inset-bottom, 0px))" }}>
            {tools}
          </div>
        </>
      )}

      {chooser ? (
        <PhotoChooser
          title={chooser.kind === "replace" ? "Chọn ảnh thay vào khung" : chooser.kind === "add" ? "Thêm ảnh vào layout" : "Chọn ảnh cho layout mới"}
          photos={p.photos}
          cats={p.cats}
          info={p.info}
          people={p.people}
          driveIdOf={p.driveIdOf}
          img={p.img}
          preferred={doc.photoIds}
          multi={chooser.kind !== "replace"}
          max={chooser.kind === "add" ? Math.max(1, maxOnPage - ids.length) : COLLAGE_LIMITS.pagePhotos}
          disabled={chooser.kind === "newpage" ? undefined : (id) => ids.includes(id)}
          onClose={() => setChooser(null)}
          onDone={async (picked) => {
            const c = chooser;
            setChooser(null);
            if (c.kind === "replace" && c.frameId) {
              const id = picked[0];
              const inputs = await p.ensureInputs([id]);
              apply((d) => ({
                ...d,
                photoIds: d.photoIds.includes(id) ? d.photoIds : [...d.photoIds, id].slice(0, COLLAGE_LIMITS.photos),
                pages: d.pages.map((pg, i) =>
                  i !== pageIdx
                    ? pg
                    : {
                        ...pg,
                        frames: pg.frames.map((fr) =>
                          fr.id === c.frameId && fr.kind === "photo"
                            ? { ...fr, photoId: id, crop: focusCrop(inputs.get(id)?.faces, fr.rect.w / fr.rect.h, inputs.get(id)?.aspect ?? 1.5) }
                            : fr,
                        ),
                      },
                ),
              }));
              setSel(null);
            } else if (c.kind === "add") {
              apply((d) => ({ ...d, photoIds: [...d.photoIds, ...picked.filter((id) => !d.photoIds.includes(id))].slice(0, COLLAGE_LIMITS.photos) }));
              await relayoutWith([...ids, ...picked].slice(0, maxOnPage));
            } else {
              await addPage(picked);
            }
          }}
        />
      ) : null}

      {wishesOpen ? (
        <WishesSheet
          onClose={() => setWishesOpen(false)}
          onPick={(line) => {
            setWishesOpen(false);
            if (text) {
              p.checkpoint();
              updateFrame<TextFrame>(text.id, (t) => ({ ...t, text: line }), false);
            } else setNewText(line);
          }}
        />
      ) : null}

      {formatOpen ? (
        <Sheet title="Đổi khổ cả bộ" onClose={() => setFormatOpen(false)}>
          <div className="grid grid-cols-2 gap-2 px-4 pb-2 sm:grid-cols-3">
            {COLLAGE_FORMATS.map((x) => (
              <button
                key={x.id}
                type="button"
                aria-pressed={x.id === doc.formatId}
                onClick={() => {
                  setFormatOpen(false);
                  if (x.id === doc.formatId) return;
                  p.apply((d) => changeFormat(d, x.id, p.inputs), true);
                  p.toast(`Đã đổi sang khổ ${x.label} — máy dàn lại ${doc.pages.length} layout.`);
                }}
                className="rounded-[12px] px-3 py-3 text-left"
                style={{ background: x.id === doc.formatId ? "var(--acS)" : "var(--sf2)", border: `1.5px solid ${x.id === doc.formatId ? "var(--ac)" : "var(--bd)"}` }}
              >
                <p className="text-[13.5px] font-semibold">{x.label}</p>
                <p className="text-[11.5px]" style={{ color: "var(--tx3)" }}>
                  {x.hint} · {x.w}×{x.h}
                </p>
              </button>
            ))}
          </div>
          <p className="px-4 pb-3 text-[12px]" style={{ color: "var(--tx3)" }}>
            Đổi khổ thì máy dàn lại từng layout với đúng ảnh và chữ đang có.
          </p>
        </Sheet>
      ) : null}
    </>
  );
}

