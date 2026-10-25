"use client";

import { Wand2, Undo2, Redo2, Plus, Trash2, Shuffle, Loader2, Download, ImagePlus, ArrowLeft, Copy, ChevronLeft, ChevronRight, Type, Lock, Unlock, Save, LayoutGrid, Maximize, Images } from "lucide-react";
import { useUiV2 } from "@/components/v2/UiV2Context";
import AlbumEditorV2 from "./AlbumEditorV2";
import { DECOS, FILTERS, ROLE_SIZE, clamp, sig } from "./designer-core";
import { LayoutMini, Slider, SpreadCanvas, SpreadView } from "./designer-parts";
import { useAlbumDesignEditor, type AlbumEditorProps } from "./useAlbumDesignEditor";

export type { ADSize, ADTpl, SavedDesign } from "./designer-core";

/**
 * Trình dàn trang album in. Kiểu dữ liệu + bố cục mẫu ở ./designer-core, logic
 * ở ./useAlbumDesignEditor, mảnh vẽ dùng chung ở ./designer-parts — bản cũ
 * (AlbumEditorV1 bên dưới) và bản mới (./AlbumEditorV2) dùng chung.
 */
export default function AlbumEditor(props: AlbumEditorProps) {
  return useUiV2() ? <AlbumEditorV2 {...props} /> : <AlbumEditorV1 {...props} />;
}

function AlbumEditorV1({ size, tpl, onBack, initial }: AlbumEditorProps) {
  const ed = useAlbumDesignEditor({ size, tpl, initial });
  const {
    aspect, spreads, cur, setCur, setSel, spread, selCell, pickCount, laySrc, setLaySrc, laySearch, setLaySearch,
    favSet, toggleFav, saveMine, zoom, setZoom, lib, folder, setFolder, loadingLib, loadLibrary, toast, exporting,
    fmt, setFmt, bleedMm, setBleedMm, showExport, setShowExport, exportSel, setExportSel, showAuto, setShowAuto,
    autoSpreads, setAutoSpreads, autoMin, setAutoMin, autoMax, setAutoMax, autoPlan, multi, setMulti, railOpen,
    setRailOpen, showLib, setShowLib, name, setName, saving, dirty, dragPage, stageRef, hist, fut, undo, redo,
    patchCell, onThumbClick, usedIds, applyRects, curPhotoSig,
    chooseCount, addText, addDeco, delCell, clearPhoto, shuffle, delSpread, addSpread, dupSpread, moveSpread, dragLib,
    autoFill, openAuto, regenAuto, applyAutoPlan, reflowAll, toggleLock, setSpreadBg, reorderSpread, save, cellDpi,
    exportPages, scenesUsed, railLayouts, nbW, nbH,
  } = ed;
  const panel: React.CSSProperties = { background: "var(--panel)", border: "1px solid var(--border)" };
  const bar = "flex items-center justify-center rounded-lg px-2 h-8 text-sm";

  return (
    <div className="page-in">
      {/* ── Thanh công cụ trên ── */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5 rounded-2xl p-2" style={panel}>
        <button onClick={onBack} className={`btn-ghost ${bar} gap-1`} title="Đổi khổ / mở album khác"><ArrowLeft size={15} /></button>
        <input value={name} onChange={(e) => { setName(e.target.value); dirty.current = true; }} className="input h-8 w-40 text-sm font-semibold" placeholder="Tên album" />
        <span className="mx-0.5 h-5 w-px" style={{ background: "var(--border)" }} />
        <button onClick={() => { setCur((c) => Math.max(0, c - 1)); setSel(null); }} disabled={cur === 0} className={`btn-ghost ${bar} disabled:opacity-40`}><ChevronLeft size={16} /></button>
        <span className="min-w-[52px] text-center text-xs font-semibold" style={{ color: "var(--text2)" }}>{cur + 1}/{spreads.length}</span>
        <button onClick={() => { setCur((c) => Math.min(spreads.length - 1, c + 1)); setSel(null); }} disabled={cur === spreads.length - 1} className={`btn-ghost ${bar} disabled:opacity-40`}><ChevronRight size={16} /></button>
        <span className="mx-0.5 h-5 w-px" style={{ background: "var(--border)" }} />
        <button onClick={() => setShowLib((v) => !v)} className={`btn-ghost ${bar} gap-1`} title="Thư viện ảnh" style={{ color: showLib ? "var(--brand)" : "var(--text2)" }}><Images size={15} /></button>
        <button onClick={addText} className={`btn-ghost ${bar} gap-1`} title="Thêm dòng chữ"><Type size={15} /></button>
        <button onClick={openAuto} className={`btn-ghost ${bar} gap-1`}><Wand2 size={15} /> Auto Design</button>
        <button onClick={reflowAll} className={`btn-ghost ${bar} gap-1`}><Shuffle size={15} /> Dàn lại</button>
        <button onClick={() => selCell && toggleLock(selCell.uid)} disabled={!selCell} className={`btn-ghost ${bar} gap-1 disabled:opacity-40`} title="Khóa/mở khóa layer" style={{ color: selCell?.locked ? "var(--brand)" : "var(--text2)" }}>{selCell?.locked ? <Lock size={15} /> : <Unlock size={15} />}</button>
        <button onClick={dupSpread} className={`btn-ghost ${bar} gap-1`}><Copy size={15} /> Clone</button>
        <span className="flex-1" />
        <button onClick={undo} disabled={!hist.current.length} aria-label="Hoàn tác" title="Hoàn tác" className={`btn-ghost ${bar} disabled:opacity-40`}><Undo2 size={15} /></button>
        <button onClick={redo} disabled={!fut.current.length} aria-label="Làm lại" title="Làm lại" className={`btn-ghost ${bar} disabled:opacity-40`}><Redo2 size={15} /></button>
        <div className="flex overflow-hidden rounded-lg text-xs font-semibold" style={panel}>
          {(["pdf", "jpg", "png"] as const).map((f) => (
            <button key={f} onClick={() => setFmt(f)} className="px-2.5 py-2" style={{ background: fmt === f ? "var(--brandSoft)" : "transparent", color: fmt === f ? "var(--brand)" : "var(--text2)" }}>{f.toUpperCase()}</button>
          ))}
        </div>
        <button onClick={() => save()} disabled={saving} className={`btn-ghost ${bar} gap-1.5`}>{saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Lưu</button>
        <button onClick={() => { setExportSel(new Set(spreads.map((_, i) => i))); setShowExport(true); }} disabled={exporting} className="btn-primary gap-1.5">{exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Xuất</button>
      </div>

      {/* ── Dải bố cục ngang ── */}
      <div className="mb-2 rounded-2xl p-2" style={panel}>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setRailOpen((o) => !o)} className={`btn-ghost ${bar} gap-1 font-semibold`}><LayoutGrid size={14} /> Bố cục</button>
          {railOpen && (<>
            <div className="flex gap-1">
              {([["all", "Tất cả"], ["mine", "Của tôi"], ["fav", "Yêu thích"]] as const).map(([k, l]) => (
                <button key={k} onClick={() => setLaySrc(k)} className="rounded-md px-2 py-1 text-xs font-semibold" style={{ background: laySrc === k ? "var(--brand)" : "var(--surface)", color: laySrc === k ? "#fff" : "var(--text2)", border: "1px solid var(--border)" }}>{l}</button>
              ))}
            </div>
            {laySrc === "all" && (
              <div className="flex items-center gap-1">
                <span className="text-[11px]" style={{ color: "var(--text3)" }}>Số ảnh</span>
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <button key={n} onClick={() => chooseCount(n)} className="h-7 w-7 rounded-md text-xs font-semibold" style={{ background: pickCount === n ? "var(--brand)" : "var(--surface)", color: pickCount === n ? "#fff" : "var(--text2)", border: "1px solid var(--border)" }}>{n}</button>
                ))}
              </div>
            )}
            <input value={laySearch} onChange={(e) => setLaySearch(e.target.value)} placeholder="Tìm tên / category…" className="input h-7 w-40 text-xs" />
            <button onClick={saveMine} className={`btn-ghost ${bar} gap-1 text-xs`}><Plus size={13} /> Lưu bố cục</button>
          </>)}
        </div>
        {railOpen && (
          railLayouts.length ? (
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {railLayouts.map((v, i) => {
                const active = sig(v) === curPhotoSig, faved = favSet.has(sig(v));
                return (
                  <div key={i} className="relative flex-none" style={{ width: 88 }}>
                    <button onClick={() => applyRects(v)} className="w-full rounded-lg p-1" style={{ border: `2px solid ${active ? "var(--brand)" : "var(--border)"}` }}><LayoutMini rects={v} aspect={aspect} active={active} /></button>
                    <button onClick={() => toggleFav(v)} title="Yêu thích" className="absolute right-1 top-1 leading-none text-[13px]" style={{ color: faved ? "#e0b85c" : "var(--text3)" }}>{faved ? "★" : "☆"}</button>
                  </div>
                );
              })}
            </div>
          ) : <p className="mt-2 text-center text-xs" style={{ color: "var(--text3)" }}>{laySrc === "mine" ? "Chưa có bố cục đã lưu. Chọn trang rồi nhấn “Lưu bố cục”." : "Chưa có bố cục yêu thích. Nhấn ☆ trên mẫu."}</p>
        )}
      </div>

      {/* ── Khu làm việc ── */}
      <div className="flex items-start gap-3">
        {/* Thư viện ảnh (thu gọn được) */}
        {showLib && (
          <div className="w-[200px] flex-none rounded-2xl p-3" style={panel}>
            <p className="text-sm font-extrabold">Thư viện ảnh</p>
            <p className="mb-2 text-[11.5px]" style={{ color: "var(--text2)" }}>{lib.length} ảnh · {scenesUsed} đã dùng</p>
            <div className="mb-2 flex gap-1">
              <input value={folder} onChange={(e) => setFolder(e.target.value)} placeholder="Dán link folder Drive…" className="input flex-1 text-xs" />
              <button onClick={loadLibrary} disabled={loadingLib} className="btn-ghost px-2">{loadingLib ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}</button>
            </div>
            <div className="grid max-h-[46vh] grid-cols-2 gap-1.5 overflow-y-auto">
              {lib.map((p) => (
                <button key={p.id} onClick={() => onThumbClick(p)} draggable onDragStart={() => { dragLib.current = p; }} className="relative aspect-square overflow-hidden rounded-lg" style={{ cursor: "grab" }}>
                  <img src={p.thumb} alt="" className="h-full w-full object-cover" loading="lazy" draggable={false} />
                  {usedIds.has(p.thumb) && <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] text-white" style={{ background: "var(--brand)" }}>✓</span>}
                </button>
              ))}
            </div>
            <button onClick={openAuto} className="btn-primary mt-2 w-full gap-1.5"><Wand2 size={15} /> Tự thiết kế cả album</button>
            <button onClick={autoFill} className="btn-ghost mt-1.5 w-full gap-1.5 text-sm"><Wand2 size={14} /> Rải vào ô trống</button>
            <p className="mt-1 text-center text-[11px]" style={{ color: "var(--text3)" }}>Kéo ảnh vào ô · tự khớp hướng ảnh</p>
          </div>
        )}

        {/* Canvas + thanh trạng thái */}
        <div className="min-w-0 flex-1">
          <div ref={stageRef} className="flex items-center justify-center gap-4 overflow-hidden rounded-2xl p-4" style={{ ...panel, minHeight: 440 }}>
            {/* Spread trước (ngữ cảnh) */}
            {multi && cur > 0 && (
              <button onClick={() => { setCur(cur - 1); setSel(null); }} className="flex-none opacity-60 transition-opacity hover:opacity-90" title="Spread trước">
                <SpreadView s={spreads[cur - 1]} w={nbW} h={nbH} page={tpl.page} ink={tpl.ink} />
              </button>
            )}
            {/* Spread hiện tại — tương tác */}
            <SpreadCanvas ed={ed} tpl={tpl} />
            {/* Spread sau (ngữ cảnh) */}
            {multi && cur < spreads.length - 1 && (
              <button onClick={() => { setCur(cur + 1); setSel(null); }} className="flex-none opacity-60 transition-opacity hover:opacity-90" title="Spread sau">
                <SpreadView s={spreads[cur + 1]} w={nbW} h={nbH} page={tpl.page} ink={tpl.ink} />
              </button>
            )}
          </div>

          {/* Thanh trạng thái */}
          <div className="mt-2 flex flex-wrap items-center gap-3 rounded-xl px-3 py-1.5 text-xs" style={{ ...panel, color: "var(--text2)" }}>
            <span>{multi ? "Nhiều Spread" : "1 Spread"} · {spreads.length} trang · {Math.round(zoom * 100)}%</span>
            <span className="text-[11px]" style={{ color: "var(--text3)" }}>click chọn layer · kéo ảnh để đổi</span>
            <span className="flex-1" />
            <button onClick={() => setZoom((z) => clamp(+(z - 0.1).toFixed(1), 0.5, 1.6))} className="px-1.5 text-base">−</button>
            <input type="range" min={0.5} max={1.6} step={0.05} value={zoom} onChange={(e) => setZoom(+e.target.value)} className="w-28 accent-[var(--brand)]" />
            <button onClick={() => setZoom((z) => clamp(+(z + 0.1).toFixed(1), 0.5, 1.6))} className="px-1.5 text-base">+</button>
            <button onClick={() => setZoom(1)} className="btn-ghost gap-1 px-2 py-1"><Maximize size={13} /> Fit</button>
            <button onClick={() => setMulti((v) => !v)} className="rounded-md px-2 py-1 font-semibold" style={{ background: multi ? "var(--brandSoft)" : "transparent", color: multi ? "var(--brand)" : "var(--text2)", border: "1px solid var(--border)" }}>Nhiều Spread</button>
          </div>

          {/* ── Dải trang (kéo-thả để sắp xếp) ── */}
          <div className="mt-2 flex items-center gap-2 overflow-x-auto rounded-2xl p-2" style={panel}>
            {spreads.map((s, i) => (
              <button key={s.id} onClick={() => { setCur(i); setSel(null); }}
                draggable onDragStart={() => { dragPage.current = i; }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => { if (dragPage.current != null) { reorderSpread(dragPage.current, i); dragPage.current = null; } }}
                className="flex-none rounded-lg p-1" style={{ border: `2px solid ${i === cur ? "var(--brand)" : "transparent"}`, cursor: "grab" }} title="Kéo để đổi thứ tự trang">
                <SpreadView s={s} w={64} h={64 / aspect} page={tpl.page} ink={tpl.ink} />
                <span className="mt-0.5 block text-center text-[10px]" style={{ color: "var(--text3)" }}>{i === 0 ? "Bìa" : i + 1}</span>
              </button>
            ))}
            <button onClick={addSpread} className="flex-none rounded-lg px-3 py-4 text-lg" style={{ border: "1px dashed var(--border)", color: "var(--text3)" }} title="Thêm trang">＋</button>
          </div>
        </div>

        {/* Panel thuộc tính (theo ngữ cảnh) */}
        <div className="w-[280px] flex-none rounded-2xl p-3" style={panel}>
          {/* Công cụ trang — luôn hiển thị */}
          <p className="mb-2 text-sm font-extrabold">{cur === 0 ? "Bìa" : `Trang ${cur + 1}`} <span className="text-[11px] font-normal" style={{ color: "var(--text3)" }}>· {size.name}</span></p>
          <div className="mb-2 grid grid-cols-2 gap-1.5">
            <button onClick={dupSpread} className="btn-ghost gap-1 text-xs"><Copy size={13} /> Nhân đôi</button>
            <button onClick={delSpread} className="btn-ghost gap-1 text-xs" style={{ color: "#cc4b4b" }}><Trash2 size={13} /> Xoá trang</button>
            <button onClick={() => moveSpread(-1)} disabled={cur === 0} className="btn-ghost gap-1 text-xs disabled:opacity-40"><ChevronLeft size={13} /> Trước</button>
            <button onClick={() => moveSpread(1)} disabled={cur === spreads.length - 1} className="btn-ghost gap-1 text-xs disabled:opacity-40">Sau <ChevronRight size={13} /></button>
            <button onClick={shuffle} className="btn-ghost col-span-2 gap-1 text-xs"><Shuffle size={13} /> Đổi vị trí ảnh trong trang</button>
          </div>
          {/* Nền trang */}
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold" style={{ color: "var(--text2)" }}>Nền trang</span>
            <button onClick={() => setSpreadBg(undefined)} className="rounded-md px-2 py-1 text-[11px]" style={{ border: "1px solid var(--border)", color: !spread?.bg ? "var(--brand)" : "var(--text2)" }}>Mặc định</button>
            {["#ffffff", "#faf6ef", "#f3ece2", "#efe7df", "#eef1ea", "#f7edf0", "#1a1a1c"].map((col) => (
              <button key={col} onClick={() => setSpreadBg(col)} className="h-6 w-6 rounded-full" style={{ background: col, border: `2px solid ${spread?.bg === col ? "var(--brand)" : "var(--border)"}` }} />
            ))}
            <input type="color" value={spread?.bg && spread.bg.startsWith("#") ? spread.bg : "#ffffff"} onChange={(e) => setSpreadBg(e.target.value)} className="h-6 w-8 rounded border" style={{ borderColor: "var(--border)" }} title="Màu tùy chọn" />
          </div>
          <div className="mb-3 h-px" style={{ background: "var(--border)" }} />

          {/* Ô ảnh được chọn */}
          {selCell?.type === "photo" && (<div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold">Ảnh</span>
              <button onClick={() => toggleLock(selCell.uid)} className="btn-ghost gap-1 px-2 py-1 text-xs" style={{ color: selCell.locked ? "var(--brand)" : "var(--text2)" }}>{selCell.locked ? <><Lock size={12} /> Đã khóa</> : <><Unlock size={12} /> Khóa</>}</button>
            </div>
            <Slider label="Phóng to" min={1} max={2.6} step={0.05} value={selCell.scale} onChange={(v) => patchCell(selCell.uid, { scale: v })} />
            <Slider label="Dời ngang" min={0} max={100} step={1} value={selCell.posX} onChange={(v) => patchCell(selCell.uid, { posX: v })} />
            <Slider label="Dời dọc" min={0} max={100} step={1} value={selCell.posY} onChange={(v) => patchCell(selCell.uid, { posY: v })} />
            <div>
              <p className="mb-1 text-xs font-semibold" style={{ color: "var(--text2)" }}>Bộ lọc màu</p>
              <div className="grid grid-cols-3 gap-1.5">
                {FILTERS.map((f) => (
                  <button key={f.k} onClick={() => patchCell(selCell.uid, { filter: f.k })} className="overflow-hidden rounded-md" style={{ border: `1.5px solid ${selCell.filter === f.k ? "var(--brand)" : "var(--border)"}` }}>
                    {selCell.photo && (
                      <img src={selCell.photo} alt="" className="h-10 w-full object-cover" style={{ filter: f.css }} />
                    )}
                    <span className="block py-0.5 text-center text-[10px]">{f.label}</span>
                  </button>
                ))}
              </div>
            </div>
            {/* Khung ảnh: bo góc / tròn-elip + viền */}
            <div>
              <p className="mb-1 text-xs font-semibold" style={{ color: "var(--text2)" }}>Khung ảnh</p>
              <div className="grid grid-cols-3 gap-1.5">
                {([["rect", "Vuông"], ["rounded", "Bo góc"], ["circle", "Tròn/Elip"]] as const).map(([sh, l]) => (
                  <button key={sh} onClick={() => patchCell(selCell.uid, { shape: sh })} className="rounded-md py-1.5 text-xs" style={{ border: `1.5px solid ${(selCell.shape || "rect") === sh ? "var(--brand)" : "var(--border)"}`, color: (selCell.shape || "rect") === sh ? "var(--brand)" : "var(--text2)" }}>{l}</button>
                ))}
              </div>
            </div>
            {selCell.shape === "rounded" && <Slider label="Độ bo góc" min={4} max={80} step={2} value={selCell.radius ?? 24} onChange={(v) => patchCell(selCell.uid, { radius: v })} />}
            <Slider label="Làm mờ (Blur)" min={0} max={16} step={0.5} value={selCell.blur ?? 0} onChange={(v) => patchCell(selCell.uid, { blur: v })} />
            <Slider label="Viền" min={0} max={12} step={1} value={selCell.borderW ?? 0} onChange={(v) => patchCell(selCell.uid, { borderW: v })} />
            {!!selCell.borderW && (
              <div className="flex flex-wrap gap-1.5">
                {["#ffffff", "#000000", "#b08968", "#c98a86", "#d4af37"].map((col) => (
                  <button key={col} onClick={() => patchCell(selCell.uid, { borderColor: col })} className="h-6 w-6 rounded-full" style={{ background: col, border: `2px solid ${(selCell.borderColor || "#ffffff") === col ? "var(--brand)" : "var(--border)"}` }} />
                ))}
              </div>
            )}
            {/* Phủ màu (tint / đổi màu) */}
            <div>
              <p className="mb-1 text-xs font-semibold" style={{ color: "var(--text2)" }}>Phủ màu</p>
              <div className="flex flex-wrap items-center gap-1.5">
                <button onClick={() => patchCell(selCell.uid, { tint: null, tintA: 0 })} className="rounded-md px-2 py-1 text-[11px]" style={{ border: "1px solid var(--border)", color: !selCell.tint ? "var(--brand)" : "var(--text2)" }}>Không</button>
                {["#000000", "#ffffff", "#b08968", "#c98a86", "#3f5a4a", "#7a5c5c"].map((col) => (
                  <button key={col} onClick={() => patchCell(selCell.uid, { tint: col, tintA: selCell.tintA || 35 })} className="h-6 w-6 rounded-full" style={{ background: col, border: `2px solid ${selCell.tint === col ? "var(--brand)" : "var(--border)"}` }} />
                ))}
              </div>
            </div>
            {!!selCell.tint && <Slider label="Độ đậm phủ màu" min={5} max={90} step={5} value={selCell.tintA ?? 35} onChange={(v) => patchCell(selCell.uid, { tintA: v })} />}
            {(() => { const dpi = cellDpi(selCell); return dpi != null ? <p className="text-[11.5px]" style={{ color: dpi < 150 ? "#cc4b4b" : dpi < 230 ? "#c08a1e" : "var(--text2)" }}>~{dpi} DPI · {dpi < 150 ? "quá thấp để in" : dpi < 230 ? "hơi thấp" : "tốt để in"}</p> : null; })()}
            <button onClick={() => clearPhoto(selCell.uid)} className="btn-ghost w-full text-sm">Bỏ ảnh khỏi ô</button>
          </div>)}

          {/* Dòng chữ được chọn */}
          {selCell?.type === "text" && (<div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold">Chữ</span>
              <button onClick={() => toggleLock(selCell.uid)} className="btn-ghost gap-1 px-2 py-1 text-xs" style={{ color: selCell.locked ? "var(--brand)" : "var(--text2)" }}>{selCell.locked ? <><Lock size={12} /> Đã khóa</> : <><Unlock size={12} /> Khóa</>}</button>
            </div>
            <textarea value={selCell.text} onChange={(e) => patchCell(selCell.uid, { text: e.target.value })} rows={2} className="input w-full text-sm" />
            <Slider label="Cỡ chữ" min={10} max={72} step={1} value={selCell.size || ROLE_SIZE[selCell.role]} onChange={(v) => patchCell(selCell.uid, { size: v })} />
            <div className="flex flex-wrap gap-1.5">
              {["#ffffff", "#1a1a1a", "#8a6d3b", "#b08968", "#7a5c5c", "#3f5a4a"].map((col) => (
                <button key={col} onClick={() => patchCell(selCell.uid, { color: col })} className="h-6 w-6 rounded-full" style={{ background: col, border: `2px solid ${selCell.color === col ? "var(--brand)" : "var(--border)"}` }} />
              ))}
            </div>
            <div className="flex gap-1">
              {(["left", "center", "right"] as const).map((a) => <button key={a} onClick={() => patchCell(selCell.uid, { align: a })} className="flex-1 rounded-md py-1.5 text-xs" style={{ background: selCell.align === a ? "var(--brandSoft)" : "var(--surface)", color: selCell.align === a ? "var(--brand)" : "var(--text2)" }}>{a === "left" ? "Trái" : a === "center" ? "Giữa" : "Phải"}</button>)}
            </div>
            <button onClick={() => delCell(selCell.uid)} className="btn-ghost w-full text-sm" style={{ color: "#cc4b4b" }}>Xoá dòng chữ</button>
          </div>)}

          {/* Không chọn gì → trang trí */}
          {!selCell && (<div>
            <p className="mb-2 text-xs font-semibold" style={{ color: "var(--text2)" }}>Chèn trang trí</p>
            <div className="grid grid-cols-2 gap-2">
              {DECOS.map((d) => <button key={d.label} onClick={() => addDeco(d)} className="rounded-lg py-3 text-center" style={{ border: "1px solid var(--border)" }}><div style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 20 }}>{d.text}</div><span className="text-[11px]" style={{ color: "var(--text2)" }}>{d.label}</span></button>)}
            </div>
            <p className="mt-3 text-center text-[11px]" style={{ color: "var(--text3)" }}>Nhấp một ô ảnh/chữ để chỉnh.</p>
          </div>)}
        </div>
      </div>

      {/* Export modal — chọn trang để xuất */}
      {showExport && (
        <div onClick={() => setShowExport(false)} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl p-5" style={{ background: "var(--panel)", boxShadow: "0 24px 70px rgba(0,0,0,.4)" }}>
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-base font-extrabold">Xuất album</h3>
              <button onClick={() => setShowExport(false)} className="text-xl" style={{ color: "var(--text3)" }}>×</button>
            </div>
            <p className="mb-3 text-xs" style={{ color: "var(--text2)" }}>{size.name} · {exportSel.size}/{spreads.length} trang · 300 DPI · ảnh gốc{fmt === "pdf" ? ` · bleed ${bleedMm}mm + dấu cắt` : ""}</p>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold" style={{ color: "var(--text2)" }}>Định dạng</span>
              <div className="flex overflow-hidden rounded-lg text-xs font-semibold" style={{ border: "1px solid var(--border)" }}>
                {(["pdf", "jpg", "png"] as const).map((f) => <button key={f} onClick={() => setFmt(f)} className="px-3 py-1.5" style={{ background: fmt === f ? "var(--brandSoft)" : "transparent", color: fmt === f ? "var(--brand)" : "var(--text2)" }}>{f.toUpperCase()}</button>)}
              </div>
              {fmt === "pdf" && (
                <label className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--text2)" }}>
                  Bleed
                  <select value={bleedMm} onChange={(e) => setBleedMm(+e.target.value)} className="input px-1.5 py-1 text-xs">
                    {[0, 3, 5].map((b) => <option key={b} value={b}>{b}mm</option>)}
                  </select>
                </label>
              )}
              <span className="flex-1" />
              <button onClick={() => setExportSel(new Set(spreads.map((_, i) => i)))} className="text-xs font-semibold" style={{ color: "var(--brand)" }}>Chọn tất cả</button>
              <button onClick={() => setExportSel(new Set())} className="text-xs font-semibold" style={{ color: "var(--text3)" }}>Bỏ chọn</button>
            </div>
            <div className="grid max-h-[46vh] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
              {spreads.map((s, i) => {
                const on = exportSel.has(i);
                return (
                  <button key={s.id} onClick={() => setExportSel((prev) => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n; })} className="rounded-lg p-1 text-left" style={{ border: `2px solid ${on ? "var(--brand)" : "var(--border)"}` }}>
                    <div style={{ position: "relative", width: "100%", aspectRatio: `${aspect}`, background: tpl.page, borderRadius: 4, overflow: "hidden" }}>
                      {s.cells.filter((c) => c.type === "photo").map((c, k) => <span key={k} style={{ position: "absolute", left: `${c.x}%`, top: `${c.y}%`, width: `${c.w}%`, height: `${c.h}%`, background: c.photo ? "var(--brand)" : "var(--surface2)", opacity: c.photo ? 0.5 : 1, borderRadius: 1 }} />)}
                      {on && <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] text-white" style={{ background: "var(--brand)" }}>✓</span>}
                    </div>
                    <span className="mt-1 block text-[11px]" style={{ color: "var(--text3)" }}>{i === 0 ? "Bìa" : `Trang ${i + 1}`}</span>
                  </button>
                );
              })}
            </div>
            <button onClick={() => exportPages([...exportSel])} disabled={!exportSel.size} className="btn-primary mt-4 w-full gap-1.5 disabled:opacity-50"><Download size={15} /> Xuất {exportSel.size} trang ({fmt.toUpperCase()})</button>
          </div>
        </div>
      )}

      {/* Auto Design — xem trước phương án trước khi áp dụng */}
      {showAuto && (
        <div onClick={() => setShowAuto(false)} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl rounded-2xl p-5" style={{ background: "var(--panel)", boxShadow: "0 24px 70px rgba(0,0,0,.4)", maxHeight: "88vh", overflowY: "auto" }}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-extrabold">Tự động thiết kế Album</h3>
              <button onClick={() => setShowAuto(false)} className="text-xl" style={{ color: "var(--text3)" }}>×</button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Tùy chọn */}
              <div className="space-y-3">
                <p className="text-xs" style={{ color: "var(--text2)" }}>{lib.length} ảnh trong thư viện · tạo spread mới rồi rải ảnh tự động.</p>
                <label className="block text-xs font-semibold" style={{ color: "var(--text2)" }}>Số spread
                  <input type="number" min={1} max={60} value={autoSpreads} onChange={(e) => setAutoSpreads(clamp(+e.target.value || 1, 1, 60))} className="input mt-1 w-full text-sm" />
                </label>
                <Slider label="Số ảnh tối thiểu / trang" min={1} max={9} step={1} value={autoMin} onChange={(v) => setAutoMin(Math.min(v, autoMax))} />
                <Slider label="Số ảnh tối đa / trang" min={1} max={9} step={1} value={autoMax} onChange={(v) => setAutoMax(Math.max(v, autoMin))} />
                <button onClick={regenAuto} className="btn-ghost w-full gap-1.5 text-sm"><Shuffle size={14} /> Tạo lại phương án</button>
              </div>
              {/* Xem trước phương án */}
              <div>
                <p className="mb-2 text-xs font-semibold" style={{ color: "var(--text2)" }}>Xem trước phương án ({autoPlan.length} spread)</p>
                <div className="max-h-[46vh] space-y-1.5 overflow-y-auto rounded-lg p-1" style={{ background: "var(--surface2)" }}>
                  {autoPlan.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-md px-2 py-1.5" style={{ background: "var(--panel)" }}>
                      <span style={{ width: 54, flexShrink: 0, display: "block" }}><LayoutMini rects={p.rects} aspect={aspect} /></span>
                      <span className="text-xs font-semibold">Spread {i + 1}</span>
                      <span className="ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: "var(--brandSoft)", color: "var(--brand)" }}>{p.count} ảnh</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowAuto(false)} className="btn-ghost text-sm">Hủy</button>
              <button onClick={applyAutoPlan} className="btn-primary gap-1.5 text-sm"><Wand2 size={15} /> Áp dụng</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div style={{ position: "fixed", left: "50%", bottom: 24, transform: "translateX(-50%)", zIndex: 90, background: "var(--brand)", color: "#fff", padding: "10px 20px", borderRadius: 999, fontSize: 13, fontWeight: 600 }}>{toast}</div>}
    </div>
  );
}
