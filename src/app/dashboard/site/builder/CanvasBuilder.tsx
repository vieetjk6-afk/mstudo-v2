"use client";

import { Fragment } from "react";
import { createPortal } from "react-dom";
import {
  Monitor, Smartphone, Undo2, Redo2, Eye, EyeOff, Rocket, ArrowLeft, Plus,
  LayoutTemplate, Blocks, GripVertical, ChevronUp, ChevronDown,
  ImagePlus, Type as TypeIcon, Check, ExternalLink, Layers,
  RefreshCw,
} from "lucide-react";
import { MAIN_HOST } from "@/lib/hosts";
import { SITE_BLOCK_LABEL } from "@/lib/types";
import { SITE_TEMPLATES, SECTION_PRESETS } from "@/lib/site-templates";
import CustomDomain from "@/components/CustomDomain";
import { useUiV2 } from "@/components/v2/UiV2Context";
import { DOMAIN_STATE_COLOR, DOMAIN_STATE_LABEL } from "../useSiteSettings";
import { useCanvasBuilder, type CanvasBuilderProps } from "./useCanvasBuilder";
import {
  ACCENTS, PALETTE, DropZone, BlockShell, Inspector, ViewStats, SeoPanel,
  insLabel, insInput, toolBtn, chipBtn, segBtn, primaryBtn, tabBtn, paletteCard, tplCard, presetCard, segWide,
} from "./builder-parts";
import CanvasBuilderV2 from "./CanvasBuilderV2";

export type { AlbumOption, PriceItem, PriceListOption, SiteViewStats } from "./builder-parts";

/* ─────────────────────────────────────────────────────────────────────────
   Trình tạo website kéo-thả (canvas + inline edit + inspector).
   Chrome (giao diện công cụ) dùng bộ token đất nung theo handoff; canvas dùng
   theme thật của trang (sites.theme) nên giống hệt trang xuất bản.

   Logic chung ở ./useCanvasBuilder, phần canvas/inspector ở ./builder-parts;
   giao diện mới (V2) vẽ khung công cụ khác ở ./CanvasBuilderV2.
   ───────────────────────────────────────────────────────────────────────── */

export default function CanvasBuilder(props: CanvasBuilderProps) {
  return useUiV2() ? <CanvasBuilderV2 {...props} /> : <CanvasBuilderV1 {...props} />;
}

function CanvasBuilderV1(props: CanvasBuilderProps) {
  const {
    site,
    albums,
    pricelist = [],
    priceLists = [],
    priceLabels = {},
    siteViews,
    canPublish,
    canCustomDomain = false,
    mainHost,
  } = props;
  const {
    supabase, uiTheme, mounted,
    blocks, theme, selId, setSelId, leftTab, setLeftTab, device, setDevice, preview, setPreview, toast, flash,
    dragType, setDragType, dragId, setDragId, dropIndex, setDropIndex,
    undoStack, redoStack, undo, redo, snapshot,
    published, subdomain, setSubdomain, savedSub, savingDomain, domainState, busy, saveDomain, checkDomain, togglePublish,
    liveUrl,
    insertBlock, moveDir, reorderTo, insertPreset, dupBlock, toggleVisible, delBlock, setConfig, patchTheme, applyTemplate,
    setBgMode, fabOn, toggleFab, toggleFabOff, uploadLogo,
    selected, dragging, canvasBlocks, accent, canvasMax, dark, canvasVars, fontHead,
  } = useCanvasBuilder(props);

  const ui = (
    <div className="studio-shell" data-theme={uiTheme} style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", flexDirection: "column", background: "var(--bg)", color: "var(--text)" }}>
      {/* TOP BAR */}
      <header style={{ height: 58, flexShrink: 0, display: "flex", alignItems: "center", gap: 10, padding: "0 14px", background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
        <a href="/dashboard/site" title="Quay lại Website & chatbox" style={chipBtn(false)}><ArrowLeft size={16} /></a>
        <span style={{ fontWeight: 800, letterSpacing: "-.02em", fontSize: 15 }}>Trình tạo website</span>

        {!preview && (
          <>
            <span style={{ width: 1, height: 26, background: "var(--border)", margin: "0 4px" }} />
            <div style={{ display: "flex", borderRadius: 9, overflow: "hidden", border: "1px solid var(--border)" }}>
              <button onClick={() => setDevice("desktop")} title="Máy tính" style={segBtn(device === "desktop")}><Monitor size={15} /></button>
              <button onClick={() => setDevice("mobile")} title="Điện thoại" style={segBtn(device === "mobile")}><Smartphone size={15} /></button>
            </div>
            <button onClick={undo} disabled={!undoStack.current.length} title="Hoàn tác" style={chipBtn(false, !undoStack.current.length)}><Undo2 size={16} /></button>
            <button onClick={redo} disabled={!redoStack.current.length} title="Làm lại" style={chipBtn(false, !redoStack.current.length)}><Redo2 size={16} /></button>
          </>
        )}

        {!preview && (
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 0, border: "1px solid var(--border)", borderRadius: 10, padding: "3px 4px 3px 12px", background: "var(--surface2)" }}>
            <input
              value={subdomain}
              onChange={(e) => setSubdomain(e.target.value.toLowerCase())}
              onKeyDown={(e) => { if (e.key === "Enter") saveDomain(); }}
              placeholder="ten-cua-ban"
              spellCheck={false}
              style={{ width: 110, border: 0, background: "transparent", outline: "none", fontSize: 13, fontWeight: 600, color: "var(--text)" }}
            />
            <span style={{ fontSize: 12, color: "var(--text3)", marginRight: 6 }}>.{mainHost || "mstudo.com"}</span>
            {savedSub && domainState && (
              <span
                title={DOMAIN_STATE_LABEL[domainState]}
                aria-label={DOMAIN_STATE_LABEL[domainState]}
                style={{ width: 8, height: 8, borderRadius: 999, marginRight: 8, flexShrink: 0, background: DOMAIN_STATE_COLOR[domainState] }}
              />
            )}
            <button onClick={saveDomain} disabled={savingDomain || subdomain.trim().toLowerCase() === savedSub} title="Lưu tên miền" style={{ ...chipBtn(false, savingDomain || subdomain.trim().toLowerCase() === savedSub), height: 28, padding: "0 10px" }}>
              <Check size={14} /> Lưu
            </button>
            {savedSub && (
              <button onClick={checkDomain} disabled={savingDomain} title="Kiểm tra tên miền đã chạy chưa" style={{ ...chipBtn(false, savingDomain), height: 28, padding: "0 8px", marginLeft: 4 }}>
                <RefreshCw size={14} />
              </button>
            )}
          </div>
        )}

        <div style={{ marginLeft: preview ? "auto" : 0, display: "flex", alignItems: "center", gap: 8 }}>
          {liveUrl && published && (
            <a href={liveUrl} target="_blank" rel="noreferrer" style={chipBtn(false)} title="Mở trang thật"><ExternalLink size={15} /></a>
          )}
          <button onClick={() => { setPreview((p) => !p); setSelId(null); }} style={chipBtn(preview)}>
            {preview ? <><ArrowLeft size={15} /> Quay lại chỉnh sửa</> : <><Eye size={15} /> Xem trước</>}
          </button>
          <button onClick={togglePublish} disabled={busy || !canPublish} style={{ ...primaryBtn, opacity: canPublish ? 1 : 0.5 }} title={canPublish ? "" : "Nâng cấp để xuất bản"}>
            <Rocket size={15} /> {published ? "Đã xuất bản" : "Xuất bản"}
          </button>
        </div>
      </header>

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* LEFT PANEL */}
        {!preview && (
          <aside style={{ width: 300, flexShrink: 0, background: "var(--surface)", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", padding: 10, gap: 4, borderBottom: "1px solid var(--border)" }}>
              <button onClick={() => setLeftTab("page")} style={tabBtn(leftTab === "page")}><Layers size={14} /> Trang</button>
              <button onClick={() => setLeftTab("blocks")} style={tabBtn(leftTab === "blocks")}><Blocks size={14} /> Khối</button>
              <button onClick={() => setLeftTab("presets")} style={tabBtn(leftTab === "presets")}><Plus size={14} /> Cụm</button>
              <button onClick={() => setLeftTab("templates")} style={tabBtn(leftTab === "templates")}><LayoutTemplate size={14} /> Mẫu</button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
              {leftTab === "page" ? (
                <>
                  {/* Danh sách khối đang có trên trang — đúng cột trái của màn
                      "Giao diện website" trong bản thiết kế: tay kéo, icon, tên
                      khối, nhãn Đang hiện/Đang ẩn và nút mở phần chỉnh. */}
                  <p style={{ fontSize: 12, color: "var(--text3)", marginBottom: 10 }}>Kéo để đổi thứ tự trên trang. Bấm một khối để chỉnh nội dung.</p>
                  {blocks.length === 0 ? (
                    <p style={{ fontSize: 12.5, color: "var(--text3)", padding: "14px 12px", border: "1px dashed var(--border)", borderRadius: 11, textAlign: "center" }}>
                      Trang chưa có khối nào. Mở tab <b>Mẫu</b> để dựng nhanh, hoặc tab <b>Khối</b> để thêm từng phần.
                    </p>
                  ) : (
                    <div style={{ display: "grid", gap: 8 }}>
                      {blocks.map((b, i) => {
                        const on = selId === b.id;
                        return (
                          <div
                            key={b.id}
                            draggable
                            onDragStart={() => { setDragId(b.id); setDragType(null); }}
                            onDragEnd={() => { setDragId(null); setDropIndex(null); }}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => { e.preventDefault(); reorderTo(i); }}
                            onClick={() => setSelId(b.id)}
                            style={{
                              display: "flex", alignItems: "center", gap: 8, padding: "10px 11px", borderRadius: 12,
                              border: `1px solid ${on ? "var(--brand)" : "var(--border)"}`,
                              background: on ? "var(--brandSoft)" : "var(--surface)",
                              opacity: b.visible ? 1 : 0.55, cursor: "pointer",
                            }}
                          >
                            <GripVertical size={16} style={{ flexShrink: 0, color: "var(--text3)", cursor: "grab" }} />
                            <span style={{ flex: 1, minWidth: 0 }}>
                              <span style={{ display: "block", fontSize: 12.5, fontWeight: 650, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {SITE_BLOCK_LABEL[b.type]}
                              </span>
                              <span style={{ display: "block", fontSize: 10.5, fontWeight: 650, color: b.visible ? "var(--s-green)" : "var(--text3)" }}>
                                {b.visible ? "Đang hiện" : "Đang ẩn"}
                              </span>
                            </span>
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleVisible(b.id); }}
                              title={b.visible ? "Ẩn khối" : "Hiện khối"}
                              style={{ ...toolBtn, color: "var(--text3)" }}
                            >
                              {b.visible ? <Eye size={15} /> : <EyeOff size={15} />}
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); moveDir(b.id, -1); }}
                              disabled={i === 0}
                              title="Lên trên"
                              style={{ ...toolBtn, color: "var(--text3)", opacity: i === 0 ? 0.3 : 1 }}
                            >
                              <ChevronUp size={15} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); moveDir(b.id, 1); }}
                              disabled={i === blocks.length - 1}
                              title="Xuống dưới"
                              style={{ ...toolBtn, color: "var(--text3)", opacity: i === blocks.length - 1 ? 0.3 : 1 }}
                            >
                              <ChevronDown size={15} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : leftTab === "blocks" ? (
                <>
                  <p style={{ fontSize: 12, color: "var(--text3)", marginBottom: 10 }}>Kéo khối thả vào trang, hoặc bấm để thêm vào cuối.</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {PALETTE.map((type) => (
                      <button
                        key={type}
                        draggable
                        onDragStart={() => { setDragType(type); setDragId(null); }}
                        onDragEnd={() => { setDragType(null); setDropIndex(null); }}
                        onClick={() => insertBlock(type, blocks.length)}
                        style={paletteCard}
                      >
                        <Plus size={14} style={{ color: "var(--brand)" }} />
                        <span style={{ fontSize: 11.5, fontWeight: 600, lineHeight: 1.2 }}>{SITE_BLOCK_LABEL[type]}</span>
                      </button>
                    ))}
                  </div>
                </>
              ) : leftTab === "presets" ? (
                <>
                  <p style={{ fontSize: 12, color: "var(--text3)", marginBottom: 10 }}>
                    Thêm cả cụm khối đã soạn sẵn nội dung vào cuối trang — không đổi màu sắc đang có.
                  </p>
                  <div style={{ display: "grid", gap: 8 }}>
                    {SECTION_PRESETS.map((p) => (
                      <button key={p.key} onClick={() => insertPreset(p.key)} style={presetCard}>
                        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700 }}>
                          <Plus size={13} style={{ color: "var(--brand)", flexShrink: 0 }} /> {p.name}
                        </span>
                        <span style={{ fontSize: 11, color: "var(--text3)", lineHeight: 1.5 }}>{p.hint}</span>
                        <span style={{ fontSize: 10.5, color: "var(--text3)", opacity: 0.8 }}>
                          {p.blocks.map((b) => SITE_BLOCK_LABEL[b.type]).join(" · ")}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {SITE_TEMPLATES.map((tp) => (
                    <button key={tp.key} onClick={() => applyTemplate(tp.key)} style={tplCard}>
                      <img src={tp.thumb} alt={tp.name} style={{ width: "100%", aspectRatio: "3/2", objectFit: "cover", display: "block" }} />
                      <div style={{ padding: "7px 9px" }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700 }}>{tp.name}</div>
                        <div style={{ fontSize: 10.5, color: "var(--text3)", marginTop: 1 }}>{tp.tag}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </aside>
        )}

        {/* CANVAS */}
        <main
          style={{ flex: 1, overflowY: "auto", background: preview ? "var(--s-bg)" : "var(--bg2)", padding: preview ? 0 : "26px 20px", ...canvasVars }}
          onClick={() => setSelId(null)}
        >
          <div
            style={{
              maxWidth: canvasMax,
              margin: "0 auto",
              background: "var(--s-bg)",
              color: "var(--s-text)",
              minHeight: preview ? "100vh" : "calc(100vh - 110px)",
              borderRadius: preview ? 0 : 16,
              overflow: "hidden",
              boxShadow: preview ? "none" : "0 8px 30px rgba(20,24,33,.12)",
              transition: "max-width .25s ease",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {canvasBlocks.length === 0 ? (
              <div style={{ padding: "120px 24px", textAlign: "center", color: "var(--s-text)", opacity: 0.6 }}>
                <p style={{ fontFamily: fontHead, fontSize: 30 }}>Trang trống</p>
                <p style={{ marginTop: 8, fontSize: 14 }}>
                  {preview && blocks.length ? "Mọi khối đang bị ẩn — bật lại bằng con mắt trên khối." : <>Chọn một <b>Mẫu trang</b> hoặc kéo khối từ bên trái vào đây.</>}
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start" }}>
                {canvasBlocks.map((b, i) => {
                  const isHero = b.type === "hero";
                  const half = b.config?.width === "half" && !isHero;
                  return (
                    <Fragment key={b.id}>
                      {!preview && <DropZone dragging={dragging} active={dropIndex === i} onOver={() => setDropIndex(i)} onDrop={() => {
                        if (dragType) insertBlock(dragType, i);
                        else if (dragId) reorderTo(i);
                        setDropIndex(null); setDragType(null); setDragId(null);
                      }} />}
                      <div style={{ flex: half ? "1 1 calc(50% - 0.5px)" : "1 1 100%", minWidth: half ? 240 : 0 }}>
                        <BlockShell
                          block={b}
                          selected={selId === b.id}
                          preview={preview}
                          first={i === 0}
                          last={i === canvasBlocks.length - 1}
                          fontHead={fontHead}
                          accent={accent}
                          albums={albums}
                          pricelist={pricelist}
                          priceLabels={priceLabels}
                          onSelect={() => setSelId(b.id)}
                          onDragStart={() => { setDragId(b.id); setDragType(null); }}
                          onDragEnd={() => { setDragId(null); setDropIndex(null); }}
                          onMove={(d) => moveDir(b.id, d)}
                          onDup={() => dupBlock(b.id)}
                          onDel={() => delBlock(b.id)}
                          onToggleVisible={() => toggleVisible(b.id)}
                          onEdit={(k, v, commit) => setConfig(b.id, k, v, commit)}
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

        {/* RIGHT INSPECTOR */}
        {!preview && (
          <aside style={{ width: 300, flexShrink: 0, background: "var(--surface)", borderLeft: "1px solid var(--border)", overflowY: "auto" }}>
            {selected ? (
              <Inspector
                key={selected.id}
                block={selected}
                blocks={blocks}
                siteUrl={savedSub && MAIN_HOST ? `https://${savedSub}.${MAIN_HOST}` : ""}
                albums={albums}
                priceLists={priceLists}
                accent={accent}
                onEdit={(k, v, commit) => setConfig(selected.id, k, v, commit)}
                onBeforeEdit={snapshot}
              />
            ) : (
              <div style={{ padding: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>Giao diện trang</h3>
                <p style={{ fontSize: 12, color: "var(--text3)", marginBottom: 16 }}>Áp dụng cho toàn bộ trang. Bấm một khối để chỉnh riêng khối đó.</p>

                {canCustomDomain && (
                  <CustomDomain
                    initialDomain={(site.custom_domain as string | null) ?? null}
                    initialVerified={!!(site as { custom_domain_verified?: boolean }).custom_domain_verified}
                  />
                )}

                <label style={insLabel}>Màu nhấn</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                  {ACCENTS.map((c) => (
                    <button key={c} onClick={() => patchTheme({ accent: c })} title={c}
                      style={{ width: 30, height: 30, borderRadius: 999, background: c, border: accent.toLowerCase() === c.toLowerCase() ? "2px solid var(--text)" : "1px solid var(--border)", cursor: "pointer" }} />
                  ))}
                  <label style={{ width: 30, height: 30, borderRadius: 999, border: "1px solid var(--border)", overflow: "hidden", cursor: "pointer", position: "relative" }}>
                    <input type="color" value={accent} onChange={(e) => patchTheme({ accent: e.target.value })} style={{ position: "absolute", inset: -4, width: 40, height: 40, border: 0, cursor: "pointer" }} />
                  </label>
                </div>

                <label style={insLabel}>Kiểu chữ tiêu đề</label>
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  {(["serif", "sans"] as const).map((f) => (
                    <button key={f} onClick={() => patchTheme({ font: f })} style={segWide((theme.font || "serif") === f)}>
                      <TypeIcon size={13} /> {f === "serif" ? "Serif" : "Sans"}
                    </button>
                  ))}
                </div>

                <label style={insLabel}>Nền trang</label>
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  {(["light", "dark"] as const).map((m) => (
                    <button key={m} onClick={() => setBgMode(m)} style={segWide((theme.mode || (dark ? "dark" : "light")) === m)}>
                      {m === "light" ? "☀ Sáng" : "🌙 Tối"}
                    </button>
                  ))}
                </div>

                <label style={insLabel}>Bố cục trang</label>
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  {([["compact", "Thu nhỏ"], ["full", "Toàn màn hình"]] as const).map(([w, lbl]) => (
                    <button key={w} onClick={() => patchTheme({ contentWidth: w })} style={segWide((theme.contentWidth || "compact") === w)}>{lbl}</button>
                  ))}
                </div>

                <label style={insLabel}>Bo góc</label>
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  {([["rounded", "Bo tròn"], ["sharp", "Vuông"]] as const).map(([r, lbl]) => (
                    <button key={r} onClick={() => patchTheme({ radius: r })} style={segWide((theme.radius || "rounded") === r)}>{lbl}</button>
                  ))}
                </div>

                <label style={insLabel}>Vị trí menu</label>
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  {([["top", "Trên"], ["left", "Trái"], ["bottom", "Dưới"]] as const).map(([np, lbl]) => (
                    <button key={np} onClick={() => patchTheme({ navPosition: np })} style={segWide((theme.navPosition || "top") === np)}>{lbl}</button>
                  ))}
                </div>

                <label style={insLabel}>Ảnh bìa — chiều cao</label>
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  {([["small", "Thấp"], ["medium", "Vừa"], ["large", "Cao"]] as const).map(([h, lbl]) => (
                    <button key={h} onClick={() => patchTheme({ heroSize: h })} style={segWide((theme.heroSize || "medium") === h)}>{lbl}</button>
                  ))}
                </div>

                <label style={insLabel}>Ảnh bìa — căn chữ</label>
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  {([["center", "Giữa"], ["left", "Trái"]] as const).map(([a, lbl]) => (
                    <button key={a} onClick={() => patchTheme({ heroAlign: a })} style={segWide((theme.heroAlign || "center") === a)}>{lbl}</button>
                  ))}
                </div>

                <label style={insLabel}>Bộ sưu tập — số cột</label>
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  {([2, 3, 4] as const).map((n) => (
                    <button key={n} onClick={() => patchTheme({ galleryCols: n })} style={segWide((Number(theme.galleryCols) || 3) === n)}>{n} cột</button>
                  ))}
                </div>

                <label style={insLabel}>Nút liên hệ nổi (góc phải trang)</label>
                <p style={{ fontSize: 11, color: "var(--text3)", lineHeight: 1.55, marginBottom: 8 }}>
                  Lấy sẵn số điện thoại &amp; Facebook trong thông tin studio. Khách bấm là gọi / nhắn Zalo ngay.
                </p>
                <div style={{ display: "grid", gap: 6, marginBottom: 16 }}>
                  {([["booking", "Đặt lịch"], ["zalo", "Chat Zalo"], ["messenger", "Messenger"], ["phone", "Gọi điện"]] as const).map(([k, lbl]) => {
                    const on = fabOn(k);
                    return (
                      <button key={k} onClick={() => toggleFab(k)}
                        style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: 10, cursor: "pointer", textAlign: "left", border: `1px solid ${on ? "var(--brand)" : "var(--border)"}`, background: on ? "var(--brandSoft)" : "var(--surface)", color: "var(--text)" }}>
                        <span style={{ width: 17, height: 17, borderRadius: 5, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${on ? "var(--brand)" : "var(--border)"}`, background: on ? "var(--brand)" : "transparent", color: "var(--brandFg)" }}>
                          {on && <Check size={12} />}
                        </span>
                        <span style={{ fontSize: 12.5, fontWeight: 600 }}>{lbl}</span>
                      </button>
                    );
                  })}
                  <button onClick={toggleFabOff}
                    style={{ ...segWide(false), height: 30, fontSize: 12 }}>
                    {theme.fab?.off ? "Bật lại nút nổi" : "Tắt hẳn nút nổi"}
                  </button>
                </div>

                <label style={insLabel}>Logo studio</label>
                <div style={{ marginBottom: 16 }}>
                  {theme.logo ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <img src={theme.logo} alt="logo" style={{ height: 36, width: "auto", maxWidth: 140, objectFit: "contain", borderRadius: 6, border: "1px solid var(--border)" }} />
                      <button onClick={() => patchTheme({ logo: "" })} style={{ ...segWide(false), flex: "0 0 auto", padding: "0 10px", height: 30 }}>Gỡ</button>
                    </div>
                  ) : null}
                  <label style={{ ...insInput, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer", background: "var(--surface2)" }}>
                    <ImagePlus size={15} /> Tải logo lên
                    <input type="file" accept="image/*" hidden onChange={async (e) => {
                      const file = e.target.files?.[0]; e.target.value = "";
                      if (!file) return;
                      await uploadLogo(file);
                    }} />
                  </label>
                </div>

                {siteViews && <ViewStats stats={siteViews} published={published} />}

                <SeoPanel site={site} supabase={supabase} onFlash={flash} />

                <label style={insLabel}>CSS tùy chỉnh (nâng cao)</label>
                <textarea
                  style={{ ...insInput, minHeight: 140, fontFamily: "monospace", fontSize: 12, marginBottom: 8 }}
                  placeholder={".site-block { } \n/* CSS riêng áp cho toàn trang */"}
                  value={String(theme.customCss ?? "")}
                  onChange={(e) => patchTheme({ customCss: e.target.value })}
                />
                <p style={{ fontSize: 11, color: "var(--text3)", lineHeight: 1.5, marginBottom: 16 }}>
                  CSS này chỉ áp trên <b>trang đã xuất bản</b> (không hiện trong khung soạn này để khỏi ảnh hưởng trình tạo). Bấm Xuất bản rồi mở trang để xem. Sai cú pháp có thể làm trang lệch.
                </p>

                <div style={{ marginTop: 8, padding: 12, borderRadius: 12, background: "var(--surface2)", border: "1px solid var(--border)", fontSize: 12, color: "var(--text3)", lineHeight: 1.6 }}>
                  💡 Mẹo: bấm thẳng vào chữ trên trang để sửa. Dùng thanh công cụ nổi trên mỗi khối để di chuyển, nhân bản hay xoá.
                </div>
              </div>
            )}
          </aside>
        )}
      </div>

      {toast && (
        <div style={{ position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)", zIndex: 80, background: "#23201B", color: "#fff", padding: "10px 18px", borderRadius: 999, fontSize: 13, fontWeight: 600, boxShadow: "0 8px 24px rgba(0,0,0,.25)" }}>
          {toast}
        </div>
      )}
    </div>
  );

  // Render through a portal to <body> so the fixed overlay escapes the studio
  // shell's transformed ancestors (the .page-in animation creates a containing
  // block that would otherwise trap position:fixed and let chrome show through).
  return mounted ? createPortal(ui, document.body) : null;
}
