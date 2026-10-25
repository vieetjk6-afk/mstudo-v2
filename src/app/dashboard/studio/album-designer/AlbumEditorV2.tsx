"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft, Check, ChevronLeft, ChevronRight, Copy, Download, FolderOpen, ImagePlus, Images, LayoutGrid, Loader2,
  Lock, Maximize, Minus, MoreHorizontal, Plus, Redo2, Save, Shapes, Shuffle, SlidersHorizontal, Star, Trash2, Type,
  Undo2, Wand2,
} from "lucide-react";
import { Badge, Empty, Field, btn, iconBtn, inputCls } from "@/components/v2/kit";
import { Menu, Modal, SearchInput, Segmented, Switch, type MenuItem } from "@/components/v2/kit-client";
import { ToastV2 } from "../thiep/CreativeV2Parts";
import { DECOS, FILTERS, ROLE_SIZE, clamp, sig } from "./designer-core";
import { LayoutMini, SpreadCanvas, SpreadView } from "./designer-parts";
import { useAlbumDesignEditor, type AlbumEditorProps } from "./useAlbumDesignEditor";

/* ═══════════════════════════════════════════════════════════════════════════
   TRÌNH DÀN TRANG ALBUM — giao diện mới. Cùng logic với AlbumEditor (bản cũ,
   chung ở ./useAlbumDesignEditor), cùng khung spread tương tác (SpreadCanvas);
   khác ở cách sắp xếp:
     • Thẻ đầu: tên album (sửa tại chỗ) + khổ · mẫu · số trang · ảnh đã dùng;
       hoàn tác / làm lại, "Lưu", MỘT nút chính "Xuất file in", menu ⋯ (tự
       thiết kế cả album, dàn lại, rải ảnh, thêm chữ, nhân đôi trang, đổi khổ).
     • Giữa: khung spread + thanh trang / thu phóng / nhiều spread, dưới là
       dải trang kéo-thả để đổi thứ tự.
     • Bên phải: một bảng có 4 tab — Ảnh (thư viện Drive) · Bố cục (gợi ý /
       của tôi / yêu thích) · Chèn (chữ, trang trí) · Chỉnh (trang đang xem +
       ô đang chọn). Chọn một ô trên trang là bảng tự sang tab Chỉnh.
     • Điện thoại: một cột — thẻ đầu, khung spread, dải trang, rồi bảng tab.
   ═══════════════════════════════════════════════════════════════════════════ */

type Panel = "photos" | "layout" | "insert" | "edit";

const BG_SWATCHES = ["#ffffff", "#faf6ef", "#f3ece2", "#efe7df", "#eef1ea", "#f7edf0", "#1a1a1c"];
const BORDER_SWATCHES = ["#ffffff", "#000000", "#b08968", "#c98a86", "#d4af37"];
const TINT_SWATCHES = ["#000000", "#ffffff", "#b08968", "#c98a86", "#3f5a4a", "#7a5c5c"];
const TEXT_SWATCHES = ["#ffffff", "#1a1a1a", "#8a6d3b", "#b08968", "#7a5c5c", "#3f5a4a"];

export default function AlbumEditorV2({ size, tpl, onBack, initial }: AlbumEditorProps) {
  const ed = useAlbumDesignEditor({ size, tpl, initial });
  const {
    aspect, spreads, cur, setCur, setSel, spread, selCell, pickCount, laySrc, setLaySrc, laySearch, setLaySearch,
    favSet, toggleFav, saveMine, zoom, setZoom, lib, folder, setFolder, loadingLib, loadLibrary, toast, exporting,
    fmt, setFmt, bleedMm, setBleedMm, showExport, setShowExport, exportSel, setExportSel, showAuto, setShowAuto,
    autoSpreads, setAutoSpreads, autoMin, setAutoMin, autoMax, setAutoMax, autoPlan, multi, setMulti, name, setName,
    saving, dirty, dragPage, stageRef, hist, fut, undo, redo, patchCell, spreadPxH, onThumbClick, usedIds, applyRects,
    curPhotoSig, chooseCount, addText, addDeco, delCell, clearPhoto, shuffle, delSpread, addSpread, dupSpread,
    moveSpread, dragLib, autoFill, openAuto, regenAuto, applyAutoPlan, reflowAll, toggleLock, setSpreadBg,
    reorderSpread, save, cellDpi, exportPages, scenesUsed, railLayouts, nbW, nbH,
  } = ed;

  const [panel, setPanel] = useState<Panel>("photos");
  // Chọn một ô trên trang → mở tab Chỉnh (trừ khi đang ở tab Ảnh: ở đó bấm ô
  // là để chọn ô đích cho ảnh sắp bấm trong thư viện).
  const selUid = selCell?.uid ?? null;
  const prevSel = useRef<number | null>(null);
  useEffect(() => {
    if (selUid != null && selUid !== prevSel.current && panel !== "photos") setPanel("edit");
    prevSel.current = selUid;
  }, [selUid, panel]);

  const pageLabel = (i: number) => (i === 0 ? "Bìa" : `Trang ${i + 1}`);
  const go = (i: number) => { setCur(clamp(i, 0, spreads.length - 1)); setSel(null); };
  const openExport = () => { setExportSel(new Set(spreads.map((_, i) => i))); setShowExport(true); };

  const moreItems: MenuItem[] = [
    { label: "Tự thiết kế cả album", hint: "Xem trước phương án rồi áp dụng", icon: Wand2, onClick: openAuto },
    { label: "Dàn lại toàn album", hint: "Đổi bố cục mọi trang, giữ ảnh & chữ", icon: Shuffle, onClick: reflowAll },
    { label: "Rải ảnh vào ô trống", hint: "Tự khớp ảnh ngang / dọc", icon: ImagePlus, onClick: autoFill },
    "divider",
    { label: "Thêm dòng chữ", icon: Type, onClick: () => { addText(); setPanel("edit"); } },
    { label: "Nhân đôi trang này", icon: Copy, onClick: dupSpread },
    "divider",
    { label: "Đổi khổ · mở album khác", icon: FolderOpen, onClick: onBack },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {/* ── Thẻ đầu ─────────────────────────────────────────────────────── */}
      <div className="v2-card flex flex-col gap-3 p-3 sm:p-4 md:flex-row md:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <button type="button" onClick={onBack} className={iconBtn("flex-none")} aria-label="Về danh sách album" title="Về danh sách album">
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <input
              value={name}
              onChange={(e) => { setName(e.target.value); dirty.current = true; }}
              placeholder="Tên album"
              aria-label="Tên album"
              className={`${inputCls} w-full max-w-[460px] text-[15px] font-semibold`}
            />
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 pl-0.5 text-[12.5px]" style={{ color: "var(--tx3)" }}>
              <span>{size.name}</span>·<span>Mẫu {tpl.name}</span>·<span><b className="v2-num" style={{ color: "var(--tx)" }}>{spreads.length}</b> trang</span>
              {lib.length ? <span className="hidden sm:inline">· {scenesUsed}/{lib.length} ảnh đã dùng</span> : null}
            </p>
          </div>
        </div>
        <div className="flex flex-none items-center gap-1.5">
          <button type="button" onClick={undo} disabled={!hist.current.length} className={iconBtn()} aria-label="Hoàn tác" title="Hoàn tác">
            <Undo2 size={17} />
          </button>
          <button type="button" onClick={redo} disabled={!fut.current.length} className={iconBtn()} aria-label="Làm lại" title="Làm lại">
            <Redo2 size={17} />
          </button>
          <button type="button" onClick={() => void save()} disabled={saving} className={btn("secondary", "md", "ml-1")}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Lưu
          </button>
          <button type="button" onClick={openExport} disabled={exporting} className={btn("primary", "md", "flex-1 md:flex-none")}>
            {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} {exporting ? "Đang xuất…" : "Xuất file in"}
          </button>
          <Menu label="Thêm thao tác với album" width={260} items={moreItems} />
        </div>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        {/* ── Khung spread + dải trang ─────────────────────────────────── */}
        <div className="flex min-w-0 flex-col gap-4">
          <section className="v2-card overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 px-3 py-2.5" style={{ borderBottom: "1px solid var(--bd2)" }}>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => go(cur - 1)} disabled={cur === 0} className={iconBtn()} aria-label="Trang trước" title="Trang trước">
                  <ChevronLeft size={18} />
                </button>
                <span className="min-w-[92px] text-center text-[13px] font-semibold">
                  {pageLabel(cur)} <span className="v2-num font-normal" style={{ color: "var(--tx3)" }}>· {cur + 1}/{spreads.length}</span>
                </span>
                <button type="button" onClick={() => go(cur + 1)} disabled={cur === spreads.length - 1} className={iconBtn()} aria-label="Trang sau" title="Trang sau">
                  <ChevronRight size={18} />
                </button>
              </div>
              <span className="flex-1" />
              {selCell ? (
                <button type="button" onClick={() => setPanel("edit")} className={btn("soft", "sm")}>
                  <SlidersHorizontal size={14} /> Chỉnh ô {selCell.type === "photo" ? "ảnh" : "chữ"}
                </button>
              ) : null}
              <div className="hidden items-center gap-1 sm:flex">
                <button type="button" onClick={() => setZoom((z) => clamp(+(z - 0.1).toFixed(1), 0.5, 1.6))} className={iconBtn()} aria-label="Thu nhỏ" title="Thu nhỏ">
                  <Minus size={16} />
                </button>
                <button type="button" onClick={() => setZoom(1)} className="v2-num min-w-[48px] rounded-[8px] px-1 py-1 text-center text-[12.5px] font-semibold" style={{ color: "var(--tx2)" }} title="Vừa khung">
                  {Math.round(zoom * 100)}%
                </button>
                <button type="button" onClick={() => setZoom((z) => clamp(+(z + 0.1).toFixed(1), 0.5, 1.6))} className={iconBtn()} aria-label="Phóng to" title="Phóng to">
                  <Plus size={16} />
                </button>
                <button type="button" onClick={() => setZoom(1)} className={iconBtn()} aria-label="Vừa khung" title="Vừa khung">
                  <Maximize size={15} />
                </button>
              </div>
              <button
                type="button"
                onClick={() => setMulti((v) => !v)}
                aria-pressed={multi}
                className={btn(multi ? "soft" : "ghost", "sm")}
                title="Xem kèm trang trước và trang sau"
              >
                <Images size={14} /> Nhiều spread
              </button>
            </div>

            <div
              ref={stageRef}
              className="flex items-center justify-center gap-4 overflow-hidden p-3 sm:p-4"
              style={{ background: "var(--sf2)", minHeight: Math.max(200, spreadPxH + 40) }}
            >
              {multi && cur > 0 && (
                <button type="button" onClick={() => go(cur - 1)} className="flex-none opacity-60 transition-opacity hover:opacity-90" title="Spread trước">
                  <SpreadView s={spreads[cur - 1]} w={nbW} h={nbH} page={tpl.page} ink={tpl.ink} />
                </button>
              )}
              <SpreadCanvas ed={ed} tpl={tpl} keepSelection />
              {multi && cur < spreads.length - 1 && (
                <button type="button" onClick={() => go(cur + 1)} className="flex-none opacity-60 transition-opacity hover:opacity-90" title="Spread sau">
                  <SpreadView s={spreads[cur + 1]} w={nbW} h={nbH} page={tpl.page} ink={tpl.ink} />
                </button>
              )}
            </div>
            <p className="hidden px-4 py-2 text-[12px] sm:block" style={{ color: "var(--tx3)", borderTop: "1px solid var(--bd2)" }}>
              Bấm chọn ô · kéo để dời · kéo góc để đổi cỡ · bấm đúp ô ảnh để đặt lại khung · kéo ảnh từ thư viện thả vào ô
            </p>
          </section>

          {/* Dải trang — kéo-thả để đổi thứ tự */}
          <section className="v2-card p-3">
            <div className="mb-2 flex items-center gap-2 px-1">
              <p className="text-[13px] font-semibold">Các trang</p>
              <span className="text-[12px]" style={{ color: "var(--tx3)" }}>{spreads.length} spread · kéo để đổi thứ tự</span>
            </div>
            <div className="flex items-start gap-2 overflow-x-auto pb-1">
              {spreads.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => go(i)}
                  draggable
                  onDragStart={() => { dragPage.current = i; }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => { if (dragPage.current != null) { reorderSpread(dragPage.current, i); dragPage.current = null; } }}
                  className="flex-none cursor-grab rounded-[10px] p-1"
                  style={{ border: `2px solid ${i === cur ? "var(--ac)" : "transparent"}`, background: i === cur ? "var(--acS)" : "transparent" }}
                  aria-label={`Mở ${pageLabel(i)}`}
                  aria-current={i === cur ? "page" : undefined}
                >
                  <SpreadView s={s} w={72} h={72 / aspect} page={tpl.page} ink={tpl.ink} />
                  <span className="mt-1 block text-center text-[11px] font-medium" style={{ color: i === cur ? "var(--ac)" : "var(--tx3)" }}>
                    {i === 0 ? "Bìa" : i + 1}
                  </span>
                </button>
              ))}
              <button
                type="button"
                onClick={addSpread}
                className="flex flex-none flex-col items-center justify-center gap-1 self-stretch rounded-[10px] px-4 text-[11px] font-medium"
                style={{ border: "1.5px dashed var(--bd)", color: "var(--tx3)", minHeight: 72 / aspect + 26 }}
                aria-label="Thêm trang"
              >
                <Plus size={16} /> Thêm
              </button>
            </div>
          </section>
        </div>

        {/* ── Bảng bên phải ────────────────────────────────────────────── */}
        <aside className="v2-card flex min-w-0 flex-col overflow-hidden lg:sticky lg:top-[80px] lg:max-h-[calc(100vh-100px)]">
          <div role="tablist" aria-label="Công cụ dàn trang" className="grid flex-none grid-cols-4 gap-1 p-1.5" style={{ borderBottom: "1px solid var(--bd2)" }}>
            {([
              ["photos", "Ảnh", Images],
              ["layout", "Bố cục", LayoutGrid],
              ["insert", "Chèn", Shapes],
              ["edit", "Chỉnh", SlidersHorizontal],
            ] as const).map(([k, l, Icon]) => {
              const on = panel === k;
              return (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setPanel(k)}
                  className="relative flex flex-col items-center gap-1 rounded-[10px] px-1 py-2 text-[12px] font-semibold transition-colors"
                  style={{ background: on ? "var(--acS)" : "transparent", color: on ? "var(--ac)" : "var(--tx2)" }}
                >
                  <Icon size={17} />
                  {l}
                  {k === "edit" && selCell && !on ? <span className="absolute right-3 top-1.5 h-2 w-2 rounded-full" style={{ background: "var(--ac)" }} /> : null}
                </button>
              );
            })}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {panel === "photos" && (
              <div className="flex flex-col gap-3">
                <Field label="Thư mục ảnh Google Drive" hint="Thư mục phải chia sẻ công khai (ai có link đều xem được).">
                  <div className="flex gap-2">
                    <input
                      value={folder}
                      onChange={(e) => setFolder(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") void loadLibrary(); }}
                      placeholder="Dán link thư mục Drive…"
                      aria-label="Link thư mục Google Drive"
                      className={`${inputCls} min-w-0 flex-1`}
                    />
                    <button type="button" onClick={() => void loadLibrary()} disabled={loadingLib || !folder.trim()} className={btn("secondary")}>
                      {loadingLib ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />} Nạp
                    </button>
                  </div>
                </Field>
                {lib.length ? (
                  <>
                    <div className="flex items-center justify-between text-[12.5px]">
                      <span className="font-semibold">{lib.length} ảnh</span>
                      <span style={{ color: "var(--tx3)" }}>{scenesUsed} đã dùng</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 lg:grid-cols-3">
                      {lib.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => onThumbClick(p)}
                          draggable
                          onDragStart={() => { dragLib.current = p; }}
                          className="relative aspect-square cursor-grab overflow-hidden rounded-[8px]"
                          style={{ background: "var(--sf2)" }}
                          title={`${p.name} — bấm để đặt vào ô đang chọn (hoặc ô trống đầu tiên)`}
                        >
                          <img src={p.thumb} alt="" className="h-full w-full object-cover" loading="lazy" draggable={false} />
                          {usedIds.has(p.thumb) && (
                            <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full text-white" style={{ background: "var(--ac)" }}>
                              <Check size={10} strokeWidth={3.5} />
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <Empty compact icon={Images} title="Chưa nạp ảnh" hint="Dán link thư mục ảnh đã chọn rồi bấm Nạp. Ảnh hiện ở đây để kéo vào trang." />
                )}
                <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
                  <button type="button" onClick={openAuto} className={btn("soft")}>
                    <Wand2 size={16} /> Tự thiết kế cả album
                  </button>
                  <button type="button" onClick={autoFill} className={btn("secondary")}>
                    <ImagePlus size={16} /> Rải vào ô trống
                  </button>
                </div>
                <p className="text-[12px]" style={{ color: "var(--tx3)" }}>Kéo ảnh thả vào ô · AI tự khớp ảnh ngang vào ô ngang, ảnh dọc vào ô dọc.</p>
              </div>
            )}

            {panel === "layout" && (
              <div className="flex flex-col gap-3">
                <div>
                <Segmented<"all" | "mine" | "fav">
                  size="sm"
                  label="Nguồn bố cục"
                  value={laySrc}
                  onChange={setLaySrc}
                  options={[
                    { value: "all", label: "Gợi ý" },
                    { value: "mine", label: "Của tôi" },
                    { value: "fav", label: "Yêu thích", count: favSet.size || undefined },
                  ]}
                />
                </div>
                {laySrc === "all" && (
                  <div className="flex flex-col gap-1.5">
                    <p className="v2-label">Số ảnh trên trang</p>
                    <div className="flex flex-wrap gap-1.5">
                      {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => chooseCount(n)}
                          aria-pressed={pickCount === n}
                          className="v2-num h-8 w-8 rounded-[8px] text-[13px] font-semibold"
                          style={{ background: pickCount === n ? "var(--ac)" : "var(--sf2)", color: pickCount === n ? "#fff" : "var(--tx2)", border: `1px solid ${pickCount === n ? "var(--ac)" : "var(--bd)"}` }}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {laySrc === "mine" && <SearchInput value={laySearch} onChange={setLaySearch} placeholder="Tìm bố cục đã lưu…" />}
                {railLayouts.length ? (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-3">
                    {railLayouts.map((v, i) => {
                      const active = sig(v) === curPhotoSig, faved = favSet.has(sig(v));
                      return (
                        <div key={i} className="relative">
                          <button
                            type="button"
                            onClick={() => applyRects(v)}
                            className="w-full rounded-[8px] p-1"
                            style={{ border: `2px solid ${active ? "var(--ac)" : "var(--bd)"}` }}
                            aria-label={`Dùng bố cục ${v.length} ô`}
                          >
                            <LayoutMini rects={v} aspect={aspect} active={active} />
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleFav(v)}
                            aria-label={faved ? "Bỏ yêu thích" : "Yêu thích"}
                            title={faved ? "Bỏ yêu thích" : "Yêu thích"}
                            className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full"
                            style={{ background: "var(--sf)", border: "1px solid var(--bd)", color: faved ? "var(--am)" : "var(--tx3)" }}
                          >
                            <Star size={12} fill={faved ? "currentColor" : "none"} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <Empty
                    compact
                    icon={LayoutGrid}
                    title={laySrc === "mine" ? "Chưa có bố cục đã lưu" : "Chưa có bố cục yêu thích"}
                    hint={laySrc === "mine" ? "Dàn một trang ưng ý rồi bấm “Lưu bố cục trang này”." : "Bấm ngôi sao trên một bố cục gợi ý để giữ lại."}
                  />
                )}
                <button type="button" onClick={saveMine} className={btn("secondary", "sm")}>
                  <Plus size={15} /> Lưu bố cục trang này
                </button>
              </div>
            )}

            {panel === "insert" && (
              <div className="flex flex-col gap-3">
                <button type="button" onClick={() => { addText(); setPanel("edit"); }} className={btn("secondary")}>
                  <Type size={16} /> Thêm dòng chữ
                </button>
                <p className="v2-label">Trang trí</p>
                <div className="grid grid-cols-3 gap-2">
                  {DECOS.map((dd) => (
                    <button
                      key={dd.label}
                      type="button"
                      onClick={() => addDeco(dd)}
                      className="flex flex-col items-center gap-0.5 rounded-[10px] px-1 py-2.5 text-center"
                      style={{ border: "1px solid var(--bd)" }}
                    >
                      <span className="truncate" style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 18, maxWidth: "100%" }}>{dd.text}</span>
                      <span className="text-[11px]" style={{ color: "var(--tx3)" }}>{dd.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {panel === "edit" && (
              <div className="flex flex-col gap-4">
                {/* Trang đang xem */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-baseline gap-2">
                    <p className="text-[14px] font-semibold">{pageLabel(cur)}</p>
                    <span className="text-[12px]" style={{ color: "var(--tx3)" }}>{size.name}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button type="button" onClick={dupSpread} className={btn("secondary", "sm")}><Copy size={14} /> Nhân đôi</button>
                    <button type="button" onClick={delSpread} disabled={spreads.length <= 1} className={btn("secondary", "sm")} style={{ color: "var(--rd)" }}>
                      <Trash2 size={14} /> Xoá trang
                    </button>
                    <button type="button" onClick={() => moveSpread(-1)} disabled={cur === 0} className={btn("ghost", "sm")}><ChevronLeft size={14} /> Dời lên</button>
                    <button type="button" onClick={() => moveSpread(1)} disabled={cur === spreads.length - 1} className={btn("ghost", "sm")}>Dời xuống <ChevronRight size={14} /></button>
                    <button type="button" onClick={shuffle} className={btn("ghost", "sm", "col-span-2")}><Shuffle size={14} /> Đổi vị trí ảnh trong trang</button>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <p className="v2-label">Nền trang</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSpreadBg(undefined)}
                        className="h-7 rounded-[8px] px-2 text-[12px] font-semibold"
                        style={{ border: `1px solid ${!spread?.bg ? "var(--ac)" : "var(--bd)"}`, color: !spread?.bg ? "var(--ac)" : "var(--tx2)" }}
                      >
                        Theo mẫu
                      </button>
                      {BG_SWATCHES.map((col) => (
                        <Swatch key={col} color={col} on={spread?.bg === col} onClick={() => setSpreadBg(col)} />
                      ))}
                      <input
                        type="color"
                        value={spread?.bg && spread.bg.startsWith("#") ? spread.bg : "#ffffff"}
                        onChange={(e) => setSpreadBg(e.target.value)}
                        className="h-7 w-9 cursor-pointer rounded-[6px]"
                        style={{ border: "1px solid var(--bd)" }}
                        title="Màu tuỳ chọn"
                        aria-label="Màu nền tuỳ chọn"
                      />
                    </div>
                  </div>
                </div>

                <div className="h-px" style={{ background: "var(--bd2)" }} />

                {selCell?.type === "photo" && (
                  <div className="flex flex-col gap-3.5">
                    <div className="flex items-center gap-2">
                      <p className="flex-1 text-[14px] font-semibold">Ô ảnh</p>
                      {(() => {
                        const dpi = cellDpi(selCell);
                        return dpi != null ? (
                          <Badge tone={dpi < 150 ? "red" : dpi < 230 ? "amber" : "green"}>~{dpi} DPI · {dpi < 150 ? "quá thấp để in" : dpi < 230 ? "hơi thấp" : "tốt để in"}</Badge>
                        ) : null;
                      })()}
                    </div>
                    <Switch label="Khoá ô" desc="Không kéo, đổi cỡ được cho tới khi mở khoá" checked={!!selCell.locked} onChange={() => toggleLock(selCell.uid)} />
                    <RangeV2 label="Phóng to" min={1} max={2.6} step={0.05} value={selCell.scale} onChange={(v) => patchCell(selCell.uid, { scale: v })} />
                    <RangeV2 label="Dời ngang" min={0} max={100} step={1} value={selCell.posX} onChange={(v) => patchCell(selCell.uid, { posX: v })} />
                    <RangeV2 label="Dời dọc" min={0} max={100} step={1} value={selCell.posY} onChange={(v) => patchCell(selCell.uid, { posY: v })} />
                    <div className="flex flex-col gap-1.5">
                      <p className="v2-label">Bộ lọc màu</p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {FILTERS.map((f) => {
                          const on = selCell.filter === f.k;
                          return (
                            <button
                              key={f.k}
                              type="button"
                              onClick={() => patchCell(selCell.uid, { filter: f.k })}
                              aria-pressed={on}
                              className="overflow-hidden rounded-[8px]"
                              style={{ border: `1.5px solid ${on ? "var(--ac)" : "var(--bd)"}` }}
                            >
                              {selCell.photo && <img src={selCell.photo} alt="" className="h-10 w-full object-cover" style={{ filter: f.css }} />}
                              <span className="block py-0.5 text-center text-[11px] font-medium" style={{ color: on ? "var(--ac)" : "var(--tx2)" }}>{f.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex flex-col items-start gap-1.5">
                      <p className="v2-label">Khung ảnh</p>
                      <Segmented<"rect" | "rounded" | "circle">
                        size="sm"
                        label="Khung ảnh"
                        value={selCell.shape || "rect"}
                        onChange={(sh) => patchCell(selCell.uid, { shape: sh })}
                        options={[
                          { value: "rect", label: "Vuông" },
                          { value: "rounded", label: "Bo góc" },
                          { value: "circle", label: "Tròn / elip" },
                        ]}
                      />
                    </div>
                    {selCell.shape === "rounded" && <RangeV2 label="Độ bo góc" min={4} max={80} step={2} value={selCell.radius ?? 24} onChange={(v) => patchCell(selCell.uid, { radius: v })} />}
                    <RangeV2 label="Làm mờ" min={0} max={16} step={0.5} value={selCell.blur ?? 0} onChange={(v) => patchCell(selCell.uid, { blur: v })} />
                    <RangeV2 label="Viền" min={0} max={12} step={1} value={selCell.borderW ?? 0} onChange={(v) => patchCell(selCell.uid, { borderW: v })} />
                    {!!selCell.borderW && (
                      <div className="flex flex-wrap gap-1.5">
                        {BORDER_SWATCHES.map((col) => (
                          <Swatch key={col} color={col} on={(selCell.borderColor || "#ffffff") === col} onClick={() => patchCell(selCell.uid, { borderColor: col })} />
                        ))}
                      </div>
                    )}
                    <div className="flex flex-col gap-1.5">
                      <p className="v2-label">Phủ màu</p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => patchCell(selCell.uid, { tint: null, tintA: 0 })}
                          className="h-7 rounded-[8px] px-2 text-[12px] font-semibold"
                          style={{ border: `1px solid ${!selCell.tint ? "var(--ac)" : "var(--bd)"}`, color: !selCell.tint ? "var(--ac)" : "var(--tx2)" }}
                        >
                          Không
                        </button>
                        {TINT_SWATCHES.map((col) => (
                          <Swatch key={col} color={col} on={selCell.tint === col} onClick={() => patchCell(selCell.uid, { tint: col, tintA: selCell.tintA || 35 })} />
                        ))}
                      </div>
                    </div>
                    {!!selCell.tint && <RangeV2 label="Độ đậm phủ màu" min={5} max={90} step={5} value={selCell.tintA ?? 35} onChange={(v) => patchCell(selCell.uid, { tintA: v })} />}
                    <button type="button" onClick={() => clearPhoto(selCell.uid)} disabled={!selCell.photo} className={btn("ghost", "sm")}>
                      Bỏ ảnh khỏi ô
                    </button>
                  </div>
                )}

                {selCell?.type === "text" && (
                  <div className="flex flex-col gap-3.5">
                    <p className="text-[14px] font-semibold">Dòng chữ</p>
                    <Field label="Nội dung">
                      <textarea
                        value={selCell.text}
                        onChange={(e) => patchCell(selCell.uid, { text: e.target.value })}
                        rows={2}
                        className={inputCls}
                        style={{ height: "auto", minHeight: 64, paddingTop: 8, paddingBottom: 8 }}
                      />
                    </Field>
                    <RangeV2 label="Cỡ chữ" min={10} max={72} step={1} value={selCell.size || ROLE_SIZE[selCell.role]} onChange={(v) => patchCell(selCell.uid, { size: v })} />
                    <div className="flex flex-col gap-1.5">
                      <p className="v2-label">Màu chữ</p>
                      <div className="flex flex-wrap gap-1.5">
                        {TEXT_SWATCHES.map((col) => (
                          <Swatch key={col} color={col} on={selCell.color === col} onClick={() => patchCell(selCell.uid, { color: col })} />
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col items-start gap-1.5">
                      <p className="v2-label">Căn lề</p>
                      <Segmented<"left" | "center" | "right">
                        size="sm"
                        label="Căn lề"
                        value={selCell.align}
                        onChange={(a) => patchCell(selCell.uid, { align: a })}
                        options={[
                          { value: "left", label: "Trái" },
                          { value: "center", label: "Giữa" },
                          { value: "right", label: "Phải" },
                        ]}
                      />
                    </div>
                    <Switch label="Khoá ô" desc="Không kéo, đổi cỡ được cho tới khi mở khoá" checked={!!selCell.locked} onChange={() => toggleLock(selCell.uid)} />
                    <button type="button" onClick={() => delCell(selCell.uid)} className={btn("ghost", "sm")} style={{ color: "var(--rd)" }}>
                      <Trash2 size={14} /> Xoá dòng chữ
                    </button>
                  </div>
                )}

                {!selCell && (
                  <div className="flex items-start gap-2.5 rounded-[12px] p-3 text-[12.5px]" style={{ background: "var(--sf2)", color: "var(--tx2)" }}>
                    <MoreHorizontal size={16} className="mt-0.5 flex-none" style={{ color: "var(--tx3)" }} />
                    <span>Bấm một ô ảnh hoặc dòng chữ trên trang để chỉnh: phóng, dời khung, bộ lọc, viền, cỡ chữ, màu… Ô đang chọn có biểu tượng <Lock size={11} className="inline" /> là đã khoá, mở bằng công tắc “Khoá ô”.</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* ── Xuất file in ─────────────────────────────────────────────────── */}
      <Modal
        open={showExport}
        onClose={() => setShowExport(false)}
        icon={Download}
        title="Xuất file in"
        desc={`${size.name} · ${exportSel.size}/${spreads.length} trang · 300 DPI · ảnh gốc${fmt === "pdf" ? ` · bleed ${bleedMm}mm + dấu cắt` : ""}`}
        width={600}
        footer={
          <>
            <button type="button" onClick={() => setShowExport(false)} className={btn("ghost")}>Huỷ</button>
            <button type="button" onClick={() => void exportPages([...exportSel])} disabled={!exportSel.size} className={btn("primary")}>
              <Download size={16} /> Xuất {exportSel.size} trang ({fmt.toUpperCase()})
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Định dạng">
              <Segmented<"pdf" | "jpg" | "png">
                label="Định dạng"
                value={fmt}
                onChange={setFmt}
                options={[
                  { value: "pdf", label: "PDF in" },
                  { value: "jpg", label: "JPG" },
                  { value: "png", label: "PNG" },
                ]}
              />
            </Field>
            {fmt === "pdf" && (
              <Field label="Bleed" className="w-[110px]">
                <select value={bleedMm} onChange={(e) => setBleedMm(+e.target.value)} className={inputCls} aria-label="Bleed">
                  {[0, 3, 5].map((b) => <option key={b} value={b}>{b}mm</option>)}
                </select>
              </Field>
            )}
          </div>
          <div className="flex items-center gap-3">
            <p className="v2-label flex-1">Chọn trang</p>
            <button type="button" onClick={() => setExportSel(new Set(spreads.map((_, i) => i)))} className="text-[12.5px] font-semibold" style={{ color: "var(--ac)" }}>Chọn tất cả</button>
            <button type="button" onClick={() => setExportSel(new Set())} className="text-[12.5px] font-semibold" style={{ color: "var(--tx3)" }}>Bỏ chọn</button>
          </div>
          <div className="grid max-h-[42vh] grid-cols-2 gap-2 overflow-y-auto p-0.5 sm:grid-cols-3">
            {spreads.map((s, i) => {
              const on = exportSel.has(i);
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setExportSel((prev) => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n; })}
                  className="rounded-[10px] p-1.5 text-left"
                  style={{ border: `2px solid ${on ? "var(--ac)" : "var(--bd)"}` }}
                >
                  <span className="relative block overflow-hidden rounded-[4px]" style={{ aspectRatio: `${aspect}`, background: tpl.page }}>
                    {s.cells.filter((c) => c.type === "photo").map((c, k) => (
                      <span key={k} className="absolute rounded-[1px]" style={{ left: `${c.x}%`, top: `${c.y}%`, width: `${c.w}%`, height: `${c.h}%`, background: c.photo ? "var(--ac)" : "var(--sf2)", opacity: c.photo ? 0.5 : 1 }} />
                    ))}
                    {on && (
                      <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full text-white" style={{ background: "var(--ac)" }}>
                        <Check size={10} strokeWidth={3.5} />
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block text-[11.5px]" style={{ color: "var(--tx3)" }}>{pageLabel(i)}</span>
                </button>
              );
            })}
          </div>
        </div>
      </Modal>

      {/* ── Tự thiết kế cả album — xem trước phương án ──────────────────── */}
      <Modal
        open={showAuto}
        onClose={() => setShowAuto(false)}
        icon={Wand2}
        title="Tự thiết kế cả album"
        desc={`${lib.length} ảnh trong thư viện · tạo các spread mới rồi rải ảnh tự động. Các trang hiện có sẽ được thay.`}
        width={720}
        footer={
          <>
            <button type="button" onClick={() => setShowAuto(false)} className={btn("ghost")}>Huỷ</button>
            <button type="button" onClick={applyAutoPlan} className={btn("primary")}>
              <Wand2 size={16} /> Áp dụng phương án
            </button>
          </>
        }
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-4">
            <Field label="Số spread">
              <input type="number" min={1} max={60} value={autoSpreads} onChange={(e) => setAutoSpreads(clamp(+e.target.value || 1, 1, 60))} className={inputCls} />
            </Field>
            <RangeV2 label="Số ảnh tối thiểu / trang" min={1} max={9} step={1} value={autoMin} onChange={(v) => setAutoMin(Math.min(v, autoMax))} />
            <RangeV2 label="Số ảnh tối đa / trang" min={1} max={9} step={1} value={autoMax} onChange={(v) => setAutoMax(Math.max(v, autoMin))} />
            <button type="button" onClick={regenAuto} className={btn("secondary")}>
              <Shuffle size={16} /> Tạo lại phương án
            </button>
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            <p className="v2-label">Xem trước ({autoPlan.length} spread)</p>
            <div className="flex max-h-[44vh] flex-col gap-1.5 overflow-y-auto rounded-[12px] p-1.5" style={{ background: "var(--sf2)" }}>
              {autoPlan.map((p, i) => (
                <div key={i} className="flex items-center gap-2.5 rounded-[9px] px-2 py-1.5" style={{ background: "var(--sf)" }}>
                  <span className="block w-[56px] flex-none"><LayoutMini rects={p.rects} aspect={aspect} /></span>
                  <span className="flex-1 text-[12.5px] font-semibold">{i === 0 ? "Bìa" : `Spread ${i + 1}`}</span>
                  <Badge tone="brand">{p.count} ảnh</Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {exporting ? <ToastV2>Đang dựng file in 300 DPI từ ảnh gốc… giữ tab này mở</ToastV2> : toast ? <ToastV2>{toast}</ToastV2> : null}
    </div>
  );
}

/** Thanh trượt có nhãn + giá trị (bản mới của Slider). */
function RangeV2({ label, min, max, step, value, onChange }: { label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-center justify-between text-[12.5px] font-medium" style={{ color: "var(--tx2)" }}>
        {label}
        <span className="v2-num" style={{ color: "var(--tx3)" }}>{value}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} className="w-full" style={{ accentColor: "var(--ac)" }} />
    </label>
  );
}

/** Ô màu tròn (màu nội dung album — trang, viền, chữ — không phải màu giao diện). */
function Swatch({ color, on, onClick }: { color: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Màu ${color}`}
      aria-pressed={on}
      className="h-7 w-7 rounded-full"
      style={{ background: color, border: `2px solid ${on ? "var(--ac)" : "var(--bd)"}`, boxShadow: on ? "0 0 0 2px var(--acS)" : undefined }}
    />
  );
}
