"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useUiV2 } from "@/components/v2/UiV2Context";
import { THEMES } from "./slide-engine";
import { LAYOUT_LABEL, SLIDE_MUSIC, SLIDE_TABS, useSlideStudio } from "./useSlideStudio";

// Bản giao diện mới tách thành chunk riêng: ai đang dùng bản cũ không phải tải nó.
const SlideStudioV2 = dynamic(() => import("./SlideStudioV2"));

/**
 * Slide cưới — trình tạo video slideshow ảnh cưới (canvas 1920×1080): slide tựa
 * đề → ảnh với hiệu ứng chuyển cảnh + Ken Burns → slide chữ/câu chuyện → kết.
 * Port trực tiếp từ thiết kế "Video slide ảnh cưới" của studio (đang Sắp ra mắt;
 * sẽ chỉnh sau). Xuất video bằng MediaRecorder (webm/mp4 tuỳ trình duyệt).
 *
 * Bộ máy dựng video ở ./slide-engine, logic màn ở ./useSlideStudio — bản cũ
 * (SlideStudioV1 bên dưới) và bản mới (./SlideStudioV2) dùng chung.
 */
export default function SlideStudio() {
  return useUiV2() ? <SlideStudioV2 /> : <SlideStudioV1 />;
}

function SlideStudioV1() {
  const {
    eng, S, storyRef, sugg, lib, own, setOwn, saveLib, genSuggestion, appendStory, saveOwn,
    picker, setPicker, applyPick, qn, curIdx, curSlide, curIsGrid, curHasPhotos,
  } = useSlideStudio();
  const [exportMenu, setExportMenu] = useState(false);

  const green = "#1f9d63";
  const TABS = SLIDE_TABS;
  const MUSIC = SLIDE_MUSIC;
  const inp: React.CSSProperties = { width: "100%", height: 42, padding: "0 14px", border: "1px solid #e2dccf", borderRadius: 10, fontSize: 14, background: "#faf8f3", color: "#26241f" };
  const lbl: React.CSSProperties = { fontSize: 12.5, fontWeight: 700, marginBottom: 6, color: "#6a6459" };

  return (
    <div className="lg:h-[calc(100vh-120px)]" style={{ minHeight: 520, display: "flex", flexDirection: "column", background: "#e9e5dd", color: "#26241f", borderRadius: 16, overflow: "hidden", border: "1px solid var(--border)" }}>
      {/* Header */}
      <header style={{ height: 60, flex: "none", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", background: "#fffdf9", borderBottom: "1px solid #e7e2d9" }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15 }}>Video slide ảnh cưới</div>
          <div style={{ fontSize: 12, color: "#8a8378" }}>Tự động tạo từ ảnh của bạn · mstudo</div>
        </div>
        <div style={{ position: "relative" }}>
          <button onClick={() => setExportMenu((v) => !v)} style={{ height: 40, padding: "0 18px", border: "none", borderRadius: 10, background: green, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", boxShadow: "0 6px 18px rgba(31,157,99,.3)" }}>↓ Xuất video ▾</button>
          {exportMenu && (
            <>
              <div onClick={() => setExportMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
              <div style={{ position: "absolute", right: 0, top: 46, zIndex: 41, width: 230, background: "#fffdf9", border: "1px solid #e7e2d9", borderRadius: 12, boxShadow: "0 16px 40px rgba(0,0,0,.18)", overflow: "hidden" }}>
                <button onClick={() => { setExportMenu(false); eng.exportVideo("landscape"); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", border: "none", background: "transparent", cursor: "pointer", textAlign: "left" }}>
                  <span style={{ width: 40, height: 24, borderRadius: 4, background: green, flex: "none" }} />
                  <span><span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: "#26241f" }}>Video ngang</span><span style={{ fontSize: 12, color: "#8a8378" }}>16:9 · YouTube, TV, màn chiếu</span></span>
                </button>
                <div style={{ height: 1, background: "#efe9df" }} />
                <button onClick={() => { setExportMenu(false); eng.exportVideo("portrait"); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", border: "none", background: "transparent", cursor: "pointer", textAlign: "left" }}>
                  <span style={{ width: 24, height: 40, borderRadius: 4, background: green, flex: "none" }} />
                  <span><span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: "#26241f" }}>Video dọc</span><span style={{ fontSize: 12, color: "#8a8378" }}>9:16 · Reels, TikTok, Story</span></span>
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      <div className="flex flex-col lg:flex-row" style={{ flex: 1, minHeight: 0 }}>
        {/* Controls */}
        <aside className="w-full lg:w-[400px] lg:flex-none" style={{ background: "#fffdf9", borderRight: "1px solid #e7e2d9", display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ flex: "none", display: "flex", gap: 2, padding: "10px 10px 0", borderBottom: "1px solid #efe9df" }}>
            {TABS.map(([id, num, label]) => (
              <button key={id} onClick={() => eng.go(id)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "10px 2px 12px", border: "none", borderBottom: S.tab === id ? `2px solid ${green}` : "2px solid transparent", background: "transparent", cursor: "pointer", color: S.tab === id ? green : "#9a9488", fontSize: 11, fontWeight: 700 }}>
                <span style={{ width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, background: S.tab === id ? green : "#ece7de", color: S.tab === id ? "#fff" : "#9a9488" }}>{num}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
            {S.tab === "photos" && (
              <div>
                <label onDrop={(e) => { e.preventDefault(); if (e.dataTransfer?.files) eng.addFiles(e.dataTransfer.files); }} onDragOver={(e) => e.preventDefault()} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "30px 20px", border: "2px dashed #d8d0c3", borderRadius: 14, cursor: "pointer", textAlign: "center", background: "#faf8f3" }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>Kéo thả ảnh vào đây</div>
                  <div style={{ fontSize: 12.5, color: "#8a8378" }}>hoặc bấm để chọn nhiều ảnh · JPG, PNG</div>
                  <input type="file" accept="image/*" multiple onChange={(e) => { eng.addFiles(e.target.files); e.target.value = ""; }} style={{ display: "none" }} />
                </label>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "18px 0 10px" }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: "#6a6459" }}>{S.photos.length ? `${S.photos.length} ảnh` : "Chưa có ảnh"}</span>
                  <span style={{ fontSize: 12, color: "#a49d90" }}>Kéo để sắp xếp lại</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                  {S.photos.map((ph, i) => (
                    <div key={ph.id} draggable onDragStart={() => { eng._drag = ph.id; }} onDragOver={(e) => e.preventDefault()} onDrop={() => eng.reorderPhotos(eng._drag, ph.id)} style={{ position: "relative", aspectRatio: "1", borderRadius: 10, overflow: "hidden", background: "#eae5dc", cursor: "grab" }}>
                      <img src={ph.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", pointerEvents: "none" }} />
                      <span style={{ position: "absolute", left: 5, top: 5, minWidth: 18, height: 18, padding: "0 4px", borderRadius: 6, background: "rgba(20,18,15,.72)", color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                      <button onClick={() => eng.removePhoto(ph.id)} style={{ position: "absolute", right: 5, top: 5, width: 20, height: 20, border: "none", borderRadius: 6, background: "rgba(20,18,15,.72)", color: "#fff", fontSize: 13, lineHeight: 1, cursor: "pointer", padding: 0 }}>×</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {S.tab === "info" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div><div style={lbl}>Tên chú rể</div><input onChange={(e) => eng.setField("groom", e.target.value)} defaultValue={S.groom} placeholder="VD: Hoàng Phú" style={inp} /></div>
                <div><div style={lbl}>Tên cô dâu</div><input onChange={(e) => eng.setField("bride", e.target.value)} defaultValue={S.bride} placeholder="VD: Bảo Hân" style={inp} /></div>
                <div><div style={lbl}>Ngày cưới</div><input onChange={(e) => eng.setField("date", e.target.value)} defaultValue={S.date} placeholder="VD: 20 · 12 · 2025" style={inp} /></div>
                <div><div style={lbl}>Câu mở đầu (không bắt buộc)</div><input onChange={(e) => eng.setField("eyebrow", e.target.value)} defaultValue={S.eyebrow} placeholder="VD: LỄ THÀNH HÔN" style={inp} /></div>
              </div>
            )}
            {S.tab === "story" && (
              <div>
                <div style={lbl}>Lời nhắn · câu chuyện · cảm nghĩ</div>
                <textarea ref={storyRef} onChange={(e) => eng.setField("story", e.target.value)} defaultValue={S.story} placeholder={"Viết những dòng cảm xúc của bạn...\n\nMỗi đoạn cách nhau một dòng trống sẽ thành một slide chữ riêng."} style={{ ...inp, height: 200, padding: 14, lineHeight: 1.6, resize: "vertical" }} />
                <div style={{ fontSize: 12, color: "#a49d90", marginTop: 8 }}>{S.showText ? (qn ? `${qn} slide chữ sẽ được tạo từ câu chuyện` : "Chưa có nội dung — cách đoạn bằng một dòng trống") : "Đang tắt slide chữ (bật lại ở tab Phong cách)"}</div>

                {/* Tạo gợi ý câu cảm xúc */}
                <div style={{ marginTop: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={lbl}>Gợi ý câu cảm xúc</span>
                  <button onClick={genSuggestion} style={{ height: 32, padding: "0 12px", border: "none", borderRadius: 8, background: green, color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>✨ Tạo gợi ý</button>
                </div>
                {sugg.length === 0 && <p style={{ fontSize: 12, color: "#a49d90", marginTop: 6 }}>Bấm “Tạo gợi ý” để sinh câu mẫu — mỗi lần một câu mới, câu cũ vẫn giữ lại.</p>}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                  {sugg.map((s, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", border: "1px solid #e2dccf", borderRadius: 10, background: "#faf8f3" }}>
                      <span style={{ flex: 1, fontSize: 13, lineHeight: 1.5 }}>{s}</span>
                      <button onClick={() => appendStory(s)} title="Thêm vào câu chuyện" style={{ flex: "none", height: 28, padding: "0 10px", border: `1px solid ${green}`, borderRadius: 8, background: "#fff", color: green, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Thêm</button>
                    </div>
                  ))}
                </div>

                {/* Thư viện câu của bạn (lưu để dùng lần sau) */}
                <div style={{ marginTop: 18 }}><span style={lbl}>Thư viện câu của bạn</span></div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={own} onChange={(e) => setOwn(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveOwn(); }} placeholder="Nhập câu của riêng bạn rồi lưu lại…" style={{ ...inp, flex: 1 }} />
                  <button onClick={saveOwn} disabled={!own.trim()} style={{ flex: "none", height: 42, padding: "0 14px", border: "1px solid #e2dccf", borderRadius: 10, background: "#fff", fontSize: 13, fontWeight: 700, color: "#6a6459", cursor: "pointer", opacity: own.trim() ? 1 : 0.5 }}>Lưu</button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                  {lib.map((s, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", border: "1px solid #e2dccf", borderRadius: 10, background: "#fff" }}>
                      <span style={{ flex: 1, fontSize: 13, lineHeight: 1.5 }}>{s}</span>
                      <button onClick={() => appendStory(s)} style={{ flex: "none", height: 28, padding: "0 10px", border: `1px solid ${green}`, borderRadius: 8, background: "#fff", color: green, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Thêm</button>
                      <button onClick={() => saveLib(lib.filter((_, j) => j !== i))} title="Xoá" style={{ flex: "none", width: 28, height: 28, border: "1px solid #e2dccf", borderRadius: 8, background: "#fff", color: "#b06a6a", fontSize: 14, cursor: "pointer", padding: 0 }}>×</button>
                    </div>
                  ))}
                  {lib.length === 0 && <p style={{ fontSize: 12, color: "#a49d90" }}>Chưa có câu nào — lưu câu bạn thích để dùng cho các video sau.</p>}
                </div>
              </div>
            )}
            {S.tab === "music" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {MUSIC.map(([id, label, desc]) => (
                  <button key={id} onClick={() => eng.selectMusic(id)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", border: S.music === id ? `1.5px solid ${green}` : "1px solid #e2dccf", borderRadius: 10, background: S.music === id ? "#f0f8f3" : "#faf8f3", cursor: "pointer" }}>
                    <div style={{ textAlign: "left" }}><div style={{ fontWeight: 700, fontSize: 14 }}>{label}</div><div style={{ fontSize: 12, color: "#8a8378", marginTop: 1 }}>{desc}</div></div>
                    <span style={{ width: 16, height: 16, borderRadius: "50%", border: S.music === id ? `5px solid ${green}` : "2px solid #cfc8bb", background: "#fff", flex: "none" }} />
                  </button>
                ))}
                <label style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", border: "1px dashed #d8d0c3", borderRadius: 10, cursor: "pointer", background: "#faf8f3" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#6a6459" }}>{S.audioName ? `Đã chọn: ${S.audioName}` : "Tải file nhạc của bạn lên"}</span>
                  <input type="file" accept="audio/*" onChange={(e) => { eng.setAudioFile(e.target.files?.[0]); e.target.value = ""; }} style={{ display: "none" }} />
                </label>
                <div style={{ fontSize: 12, color: "#a49d90", marginTop: 2 }}>Nhạc sẽ được ghép vào file video khi xuất.</div>
              </div>
            )}
            {S.tab === "style" && (
              <div>
                <div style={{ ...lbl, marginBottom: 10 }}>Phong cách</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {Object.entries(THEMES).map(([id, t]) => (
                    <button key={id} onClick={() => eng.selectTheme(id)} style={{ padding: 8, border: S.theme === id ? `2px solid ${green}` : "1px solid #e2dccf", borderRadius: 12, background: S.theme === id ? "#f0f8f3" : "#fff", cursor: "pointer" }}>
                      <div style={{ height: 54, borderRadius: 8, background: `linear-gradient(120deg, ${t.c1} 62%, ${t.c2} 62%)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ fontFamily: `"${t.title}"`, fontStyle: t.titleItalic ? "italic" : "normal", fontSize: 26, fontWeight: 600, color: t.ink }}>Aa</span>
                      </div>
                      <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 8, textAlign: "left" }}>{t.name}</div>
                    </button>
                  ))}
                </div>
                <div style={{ marginTop: 22 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, fontWeight: 700, color: "#6a6459", marginBottom: 10 }}><span>Thời lượng mỗi ảnh</span><span style={{ color: green }}>{S.perPhoto.toFixed(1)} giây</span></div>
                  <input type="range" min={2} max={6} step={0.2} defaultValue={S.perPhoto} onChange={(e) => eng.setField("perPhoto", parseFloat(e.target.value))} style={{ width: "100%", accentColor: green }} />
                </div>
                <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 10 }}>
                  {([["diverse", "Hiệu ứng chuyển cảnh đa dạng"], ["showText", "Chèn slide chữ / câu chuyện"]] as const).map(([k, label]) => {
                    const on = S[k] as boolean;
                    return (
                      <button key={k} onClick={() => eng.setField(k, !on as never)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", border: "1px solid #e2dccf", borderRadius: 10, background: "#faf8f3", cursor: "pointer", width: "100%" }}>
                        <span style={{ fontSize: 13.5, fontWeight: 600 }}>{label}</span>
                        <span style={{ width: 40, height: 23, borderRadius: 999, background: on ? green : "#d5cfc4", flex: "none", position: "relative", transition: "background .15s" }}><span style={{ position: "absolute", top: 2, left: on ? 19 : 2, width: 19, height: 19, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.25)", transition: "left .15s" }} /></span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Preview */}
        <main className="min-h-[320px]" style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", background: "#1a1a1e" }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, minHeight: 0 }}>
            <div style={{ ...(S.portrait ? { height: "100%", maxHeight: 820, aspectRatio: "9 / 16" } : { width: "100%", maxWidth: 1120, aspectRatio: "16 / 9" }), background: "#000", borderRadius: 12, overflow: "hidden", boxShadow: "0 30px 80px rgba(0,0,0,.5)", position: "relative" }}>
              <canvas width={1920} height={1080} ref={(el) => { if (el && el !== eng.canvas) { eng.canvas = el; eng.ctx = el.getContext("2d"); eng.rebuild(); } }} style={{ width: "100%", height: "100%", display: "block" }} />
              <div style={{ position: "absolute", left: 14, top: 12, display: "flex", gap: 8, alignItems: "center", pointerEvents: "none" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: "rgba(0,0,0,.42)", padding: "4px 10px", borderRadius: 999 }}>Xem trước · {S.portrait ? "9:16 dọc" : "16:9 ngang"}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#fff", background: "rgba(0,0,0,.42)", padding: "4px 10px", borderRadius: 999 }}>{S.slideCount} cảnh</span>
              </div>
              <div style={{ position: "absolute", right: 14, top: 12, display: "flex", gap: 6 }}>
                {([["landscape", "Ngang"], ["portrait", "Dọc"]] as const).map(([id, label]) => {
                  const on = S.portrait === (id === "portrait");
                  return (
                    <button key={id} onClick={() => eng.setAspect(id === "portrait")} title={id === "portrait" ? "Xem & chỉnh riêng khổ dọc 9:16 — không ảnh hưởng khổ ngang" : "Xem & chỉnh khổ ngang 16:9"} style={{ height: 26, padding: "0 12px", border: "none", borderRadius: 999, background: on ? green : "rgba(0,0,0,.42)", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{label}</button>
                  );
                })}
              </div>
            </div>
          </div>
          {/* Bảng chỉnh RIÊNG slide đang xem: thêm / đổi / xoá ảnh + chọn bố cục */}
          {curHasPhotos && (
            <div style={{ flex: "none", padding: "12px 24px 0" }}>
              <div style={{ background: "#232329", border: "1px solid #34343b", borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: "#e6e2da" }}>
                    Cảnh {curIdx + 1}/{S.slideCount} · <span style={{ color: green }}>{LAYOUT_LABEL[curSlide!.type] || curSlide!.type}</span>
                  </span>
                  {/* Dải ảnh của slide: bấm để đổi, × để xoá bớt, ＋ để thêm */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    {curSlide!.photos.map((ph, i) => (
                      <div key={ph.id + "-" + i} style={{ position: "relative", width: 46, height: 46, borderRadius: 8, overflow: "hidden", background: "#111", border: "1px solid #44444c" }}>
                        <img src={ph.url} alt="" onClick={() => setPicker({ mode: "swap", idx: i })} title="Đổi ảnh này" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", cursor: "pointer" }} />
                        {curIsGrid && curSlide!.photos.length > 1 && (
                          <button onClick={() => eng.removeSlidePhoto(i)} title="Xoá ảnh khỏi cảnh" style={{ position: "absolute", right: 2, top: 2, width: 17, height: 17, border: "none", borderRadius: 5, background: "rgba(15,15,18,.8)", color: "#fff", fontSize: 12, lineHeight: 1, cursor: "pointer", padding: 0 }}>×</button>
                        )}
                      </div>
                    ))}
                    {curIsGrid && curSlide!.photos.length < 6 && (
                      <button onClick={() => setPicker({ mode: "add", idx: -1 })} title="Thêm ảnh vào cảnh" style={{ width: 46, height: 46, flex: "none", border: "1.5px dashed #4c4c55", borderRadius: 8, background: "transparent", color: "#b7b2a9", fontSize: 20, lineHeight: 1, cursor: "pointer" }}>＋</button>
                    )}
                  </div>
                </div>
                {/* Chọn bố cục cho slide ảnh (gồm Full viền) */}
                {curIsGrid && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: "#9a958c", marginRight: 2 }}>Bố cục:</span>
                    {eng.layoutsFor(curSlide!.photos.length).map((t) => {
                      const on = curSlide!.type === t;
                      return (
                        <button key={t} onClick={() => eng.setSlideLayout(t)} style={{ height: 28, padding: "0 12px", border: on ? `1.5px solid ${green}` : "1px solid #3f3f46", borderRadius: 999, background: on ? "rgba(31,157,99,.16)" : "transparent", color: on ? "#8fe4b8" : "#cfcbc4", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{LAYOUT_LABEL[t] || t}</button>
                      );
                    })}
                  </div>
                )}
                {!curIsGrid && (
                  <div style={{ fontSize: 11.5, color: "#9a958c", marginTop: 8 }}>
                    {curSlide!.type === "TITLE" ? "Bấm ảnh để đổi ảnh bìa." : "Cảnh chữ + ảnh — bấm ảnh để đổi ảnh minh hoạ."}
                  </div>
                )}
              </div>
            </div>
          )}
          <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 14, padding: "14px 24px 20px" }}>
            <button onClick={() => eng.togglePlay()} style={{ width: 44, height: 44, flex: "none", border: "none", borderRadius: "50%", background: green, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 18px rgba(31,157,99,.35)" }}>{S.playing ? "❚❚" : "▶"}</button>
            <span ref={(el) => { eng.timeLabel = el; }} style={{ fontSize: 12.5, color: "#cfcbc4", fontVariantNumeric: "tabular-nums", minWidth: 36 }}>0:00</span>
            <input type="range" min={0} max={100} step={0.05} defaultValue={0} ref={(el) => { eng.scrubber = el; if (el) el.max = String(eng.total || 100); }} onChange={(e) => eng.onScrub(parseFloat(e.target.value) || 0)} style={{ flex: 1, accentColor: green }} />
            <span style={{ fontSize: 12.5, color: "#8f8b84", fontVariantNumeric: "tabular-nums", minWidth: 36 }}>{eng.fmt(S.total)}</span>
            <button onClick={() => eng.regenSlide()} title="Đổi bố cục + hiệu ứng của slide đang xem" style={{ height: 36, padding: "0 14px", border: "1px solid #3a3a40", borderRadius: 9, background: "transparent", color: "#e6e2da", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>↻ Bố cục slide này</button>
          </div>
        </main>
      </div>

      {/* Export overlay */}
      {S.exporting && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,15,18,.72)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div style={{ width: 380, background: "#fffdf9", borderRadius: 18, padding: 30, textAlign: "center", boxShadow: "0 30px 80px rgba(0,0,0,.4)" }}>
            <div style={{ fontWeight: 800, fontSize: 17, color: "#26241f" }}>Đang xuất video…</div>
            <div style={{ fontSize: 13, color: "#8a8378", marginTop: 6 }}>Giữ tab này mở cho tới khi hoàn tất. Video sẽ tự tải về.</div>
            <div style={{ height: 8, background: "#eee7db", borderRadius: 5, margin: "20px 0 8px", overflow: "hidden" }}><div style={{ width: `${S.exportPct}%`, height: "100%", background: green, borderRadius: 5, transition: "width .2s" }} /></div>
            <div style={{ fontSize: 13, fontWeight: 700, color: green }}>{S.exportPct}%</div>
            <button onClick={() => { eng._cancelExport = true; }} style={{ marginTop: 18, height: 38, padding: "0 18px", border: "1px solid #e2dccf", borderRadius: 9, background: "transparent", fontSize: 13, fontWeight: 600, color: "#6a6459", cursor: "pointer" }}>Hủy</button>
          </div>
        </div>
      )}
      {S.exportError && (
        <div onClick={() => eng.setState({ exportError: "" })} style={{ position: "fixed", left: "50%", bottom: 24, transform: "translateX(-50%)", background: "#cc4b4b", color: "#fff", padding: "12px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600, zIndex: 60, cursor: "pointer", maxWidth: 520 }}>{S.exportError}</div>
      )}

      {/* Chọn ảnh từ thư viện để thêm vào / đổi cho slide đang xem */}
      {picker && (
        <div onClick={() => setPicker(null)} style={{ position: "fixed", inset: 0, background: "rgba(15,15,18,.72)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 55, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 640, maxHeight: "82vh", display: "flex", flexDirection: "column", background: "#fffdf9", borderRadius: 16, boxShadow: "0 30px 80px rgba(0,0,0,.4)", overflow: "hidden" }}>
            <div style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #efe9df" }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: "#26241f" }}>{picker.mode === "add" ? "Thêm ảnh vào cảnh" : "Đổi ảnh"}</div>
              <button onClick={() => setPicker(null)} style={{ width: 30, height: 30, border: "none", borderRadius: 8, background: "#f0ece3", color: "#6a6459", fontSize: 16, cursor: "pointer" }}>×</button>
            </div>
            {S.photos.length === 0 ? (
              <div style={{ padding: 30, textAlign: "center", fontSize: 13, color: "#8a8378" }}>Chưa có ảnh nào trong thư viện — tải ảnh lên ở tab “Ảnh”.</div>
            ) : (
              <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 8 }}>
                {S.photos.map((ph, i) => (
                  <button key={ph.id} onClick={() => applyPick(ph.id)} style={{ position: "relative", aspectRatio: "1", borderRadius: 10, overflow: "hidden", border: "1px solid #e2dccf", background: "#eae5dc", cursor: "pointer", padding: 0 }}>
                    <img src={ph.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    <span style={{ position: "absolute", left: 5, top: 5, minWidth: 18, height: 18, padding: "0 4px", borderRadius: 6, background: "rgba(20,18,15,.72)", color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
