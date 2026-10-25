"use client";

import {
  ArrowLeft, ArrowRight, Check, ChevronDown, Clapperboard, Download, ImagePlus, LayoutTemplate, Music, Pause, Play, Plus,
  RectangleHorizontal, RectangleVertical, Shuffle, Sparkles, Trash2, Upload, X,
} from "lucide-react";
import { Badge, Field, Progress, Section, Stack, btn, iconBtn, inputCls } from "@/components/v2/kit";
import { Menu, Modal, Segmented, Switch } from "@/components/v2/kit-client";
import { BlockingDialogV2, CreativeTabsV2, ToastV2 } from "../thiep/CreativeV2Parts";
import { THEMES } from "./slide-engine";
import { LAYOUT_LABEL, SLIDE_MUSIC, SLIDE_TABS, useSlideStudio } from "./useSlideStudio";

/* ═══════════════════════════════════════════════════════════════════════════
   SLIDE CƯỚI — giao diện mới. Cùng bộ máy dựng video (./slide-engine), cùng
   thao tác với SlideStudio (bản cũ, logic chung ở ./useSlideStudio); khác ở
   cách sắp xếp:
     • Thẻ đầu: tên cặp đôi + số ảnh · số cảnh · thời lượng · phong cách, và
       MỘT nút chính "Xuất video" (menu chọn ngang 16:9 / dọc 9:16).
     • Cột trái: năm BƯỚC có đánh dấu đã xong (Ảnh → Thông tin → Câu chuyện →
       Nhạc → Phong cách), mỗi bước một khối Field / Switch, cuối khối có nút
       "Bước tiếp". Cột phải: khung xem trước (giữ nguyên canvas của bộ máy),
       thanh phát, rồi khối "Cảnh đang xem" để đổi ảnh / bố cục riêng cảnh đó.
     • Điện thoại: xem trước lên đầu, các bước xếp bên dưới.
   ═══════════════════════════════════════════════════════════════════════════ */

const STEP_INFO: Record<string, { title: string; desc: string }> = {
  photos: { title: "Ảnh cưới", desc: "Ảnh đầu tiên làm bìa mở đầu. Kéo thả để đổi thứ tự ảnh trong video." },
  info: { title: "Thông tin cặp đôi", desc: "Hiện trên cảnh mở đầu và lời kết." },
  story: { title: "Câu chuyện", desc: "Mỗi đoạn (cách nhau một dòng trống) thành một cảnh chữ riêng." },
  music: { title: "Nhạc nền", desc: "Nhạc được ghép thẳng vào file video khi xuất." },
  style: { title: "Phong cách", desc: "Màu, phông chữ, nhịp chuyển cảnh của cả video." },
};

export default function SlideStudioV2() {
  const {
    eng, S, storyRef, sugg, lib, own, setOwn, saveLib, genSuggestion, appendStory, saveOwn,
    picker, setPicker, applyPick, qn, curIdx, curSlide, curIsGrid, curHasPhotos, canvasRef,
  } = useSlideStudio();

  const theme = THEMES[S.theme] ?? THEMES.luxe;
  const hasNames = !!(S.groom.trim() || S.bride.trim());
  const done: Record<string, boolean> = {
    photos: S.photos.length > 0,
    info: hasNames,
    story: qn > 0,
    music: S.music !== "none",
    style: false,
  };
  const stepIdx = SLIDE_TABS.findIndex(([id]) => id === S.tab);
  const prevStep = stepIdx > 0 ? SLIDE_TABS[stepIdx - 1] : null;
  const nextStep = stepIdx < SLIDE_TABS.length - 1 ? SLIDE_TABS[stepIdx + 1] : null;
  const musicLabel = SLIDE_MUSIC.find(([id]) => id === S.music)?.[1] ?? "Không nhạc";

  return (
    <Stack>
      <CreativeTabsV2 active="slide" />

      {/* ── Thẻ đầu: video nào, đang có gì, một nút chính ─────────────────── */}
      <div className="v2-card flex flex-wrap items-center gap-x-4 gap-y-3 p-4 sm:px-5">
        <span className="v2-section-icon hidden sm:flex" style={{ width: 44, height: 44 }}>
          <Clapperboard size={20} />
        </span>
        <div className="min-w-0 flex-[1_1_220px]">
          <h1 className="truncate text-[17px] font-bold sm:text-[19px]" style={{ letterSpacing: "-0.2px" }}>
            {hasNames ? eng.coupleName() : "Video slide ảnh cưới"}
          </h1>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[12.5px]" style={{ color: "var(--tx3)" }}>
            <span><b className="v2-num" style={{ color: "var(--tx)" }}>{S.photos.length}</b> ảnh</span>
            <span><b className="v2-num" style={{ color: "var(--tx)" }}>{S.slideCount}</b> cảnh</span>
            <span>dài <b className="v2-num" style={{ color: "var(--tx)" }}>{eng.fmt(S.total)}</b></span>
            <span className="hidden sm:inline">· {theme.name} · {musicLabel}</span>
          </p>
        </div>
        <Menu
          width={250}
          trigger={({ toggle, open }) => (
            <button type="button" onClick={toggle} aria-expanded={open} disabled={S.exporting} className={btn("primary", "md", "w-full sm:w-auto")}>
              <Download size={17} /> Xuất video <ChevronDown size={15} className="-mr-1 opacity-80" />
            </button>
          )}
          items={[
            { label: "Video ngang", hint: "16:9 · YouTube, TV, màn chiếu", icon: RectangleHorizontal, onClick: () => void eng.exportVideo("landscape") },
            { label: "Video dọc", hint: "9:16 · Reels, TikTok, Story", icon: RectangleVertical, onClick: () => void eng.exportVideo("portrait") },
          ]}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
        {/* ── Cột phải (điện thoại: lên đầu): xem trước + cảnh đang xem ──── */}
        <div className="flex min-w-0 flex-col gap-5 lg:order-2">
          <section className="v2-card overflow-hidden">
            <header className="flex flex-wrap items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid var(--bd2)" }}>
              <h2 className="text-[15px] font-semibold">Xem trước</h2>
              <span className="flex-1" />
              <Segmented<"landscape" | "portrait">
                size="sm"
                label="Khổ xem trước"
                value={S.portrait ? "portrait" : "landscape"}
                onChange={(v) => eng.setAspect(v === "portrait")}
                options={[
                  { value: "landscape", label: "Ngang 16:9" },
                  { value: "portrait", label: "Dọc 9:16" },
                ]}
              />
            </header>
            {/* Sân khấu tối cố định (như màn chiếu) ở cả nền sáng lẫn nền tối. */}
            <div className="flex justify-center p-3 sm:p-5" style={{ background: "#14171c" }}>
              <div
                className="relative overflow-hidden rounded-[10px]"
                style={
                  S.portrait
                    ? { aspectRatio: "9 / 16", width: "min(100%, calc(min(70vh, 720px) * 9 / 16))", background: "#000" }
                    : { aspectRatio: "16 / 9", width: "100%", background: "#000" }
                }
              >
                <canvas width={1920} height={1080} ref={canvasRef} className="block h-full w-full" />
                <span
                  className="pointer-events-none absolute left-2.5 top-2.5 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white"
                  style={{ background: "rgba(0,0,0,.45)" }}
                >
                  {S.slideCount} cảnh · {eng.fmt(S.total)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2.5 px-4 py-3 sm:gap-3">
              <button
                type="button"
                onClick={() => eng.togglePlay()}
                disabled={!S.photos.length}
                aria-label={S.playing ? "Tạm dừng" : "Phát thử"}
                title={S.playing ? "Tạm dừng" : "Phát thử"}
                className="flex h-11 w-11 flex-none items-center justify-center rounded-full disabled:opacity-50"
                style={{ background: "var(--acS)", color: "var(--ac)" }}
              >
                {S.playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
              </button>
              <span ref={(el) => { eng.timeLabel = el; }} className="v2-num min-w-[34px] text-[12.5px] font-semibold" style={{ color: "var(--tx2)" }}>
                0:00
              </span>
              <input
                type="range"
                min={0}
                max={100}
                step={0.05}
                defaultValue={0}
                aria-label="Tua video xem trước"
                ref={(el) => { eng.scrubber = el; if (el) el.max = String(eng.total || 100); }}
                onChange={(e) => eng.onScrub(parseFloat(e.target.value) || 0)}
                className="min-w-0 flex-1"
                style={{ accentColor: "var(--ac)" }}
              />
              <span className="v2-num min-w-[34px] text-right text-[12.5px]" style={{ color: "var(--tx3)" }}>{eng.fmt(S.total)}</span>
            </div>
          </section>

          {curSlide ? (
            <Section
              icon={LayoutTemplate}
              title={`Cảnh ${curIdx + 1}/${S.slideCount}`}
              desc={
                <>
                  <span style={{ color: "var(--ac)", fontWeight: 600 }}>{LAYOUT_LABEL[curSlide.type] || curSlide.type}</span>
                  {" · "}
                  {curIsGrid ? "đổi ảnh, thêm bớt ảnh, chọn bố cục riêng cho cảnh này" : curSlide.type === "TITLE" ? "bấm ảnh để đổi ảnh bìa" : curHasPhotos ? "bấm ảnh để đổi ảnh minh hoạ" : "cảnh chữ, đổi được hiệu ứng chuyển cảnh"}
                </>
              }
              actions={
                <button type="button" onClick={() => eng.regenSlide()} className={btn("ghost", "sm")} title="Đổi bố cục + hiệu ứng của cảnh đang xem">
                  <Shuffle size={15} /> <span className="hidden sm:inline">Đổi bố cục</span>
                </button>
              }
            >
              <div className="flex flex-col gap-3">
                {curHasPhotos ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {curSlide.photos.map((ph, i) => (
                      <div key={ph.id + "-" + i} className="relative h-14 w-14 flex-none overflow-hidden rounded-[10px]" style={{ background: "var(--sf2)", border: "1px solid var(--bd)" }}>
                        <button type="button" onClick={() => setPicker({ mode: "swap", idx: i })} className="block h-full w-full" aria-label={`Đổi ảnh ${i + 1} của cảnh`} title="Đổi ảnh này">
                          <img src={ph.url} alt="" className="h-full w-full object-cover" />
                        </button>
                        {curIsGrid && curSlide.photos.length > 1 && (
                          <button
                            type="button"
                            onClick={() => eng.removeSlidePhoto(i)}
                            aria-label="Bỏ ảnh khỏi cảnh"
                            title="Bỏ ảnh khỏi cảnh"
                            className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-[6px] text-white"
                            style={{ background: "rgba(15,15,18,.72)" }}
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    ))}
                    {curIsGrid && curSlide.photos.length < 6 && (
                      <button
                        type="button"
                        onClick={() => setPicker({ mode: "add", idx: -1 })}
                        aria-label="Thêm ảnh vào cảnh"
                        title="Thêm ảnh vào cảnh"
                        className="flex h-14 w-14 flex-none items-center justify-center rounded-[10px]"
                        style={{ border: "1.5px dashed var(--bd)", color: "var(--tx3)" }}
                      >
                        <Plus size={18} />
                      </button>
                    )}
                  </div>
                ) : null}
                {curIsGrid && (
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <p className="v2-label">Bố cục cảnh</p>
                    <Segmented<string>
                      size="sm"
                      label="Bố cục cảnh"
                      value={curSlide.type}
                      onChange={(v) => eng.setSlideLayout(v)}
                      options={eng.layoutsFor(curSlide.photos.length).map((t) => ({ value: t, label: LAYOUT_LABEL[t] || t }))}
                    />
                  </div>
                )}
              </div>
            </Section>
          ) : null}
        </div>

        {/* ── Cột trái: năm bước ─────────────────────────────────────────── */}
        <aside className="v2-card flex min-w-0 flex-col overflow-hidden lg:sticky lg:top-[80px] lg:order-1 lg:max-h-[calc(100vh-100px)]">
          <div role="tablist" aria-label="Các bước làm video" className="grid flex-none grid-cols-5 gap-1 p-2" style={{ borderBottom: "1px solid var(--bd2)" }}>
            {SLIDE_TABS.map(([id, num, label]) => {
              const on = S.tab === id;
              const ok = done[id];
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => eng.go(id)}
                  className="flex min-w-0 flex-col items-center gap-1.5 rounded-[10px] px-0.5 py-2 text-[11.5px] font-semibold transition-colors"
                  style={{ background: on ? "var(--acS)" : "transparent", color: on ? "var(--ac)" : "var(--tx2)" }}
                >
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-bold"
                    style={{ background: on ? "var(--ac)" : ok ? "var(--gnS)" : "var(--sf2)", color: on ? "#fff" : ok ? "var(--gn)" : "var(--tx3)" }}
                  >
                    {ok && !on ? <Check size={13} strokeWidth={3} /> : num}
                  </span>
                  <span className="max-w-full truncate">{label}</span>
                </button>
              );
            })}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
            <div className="mb-4">
              <h2 className="text-[15px] font-semibold">{STEP_INFO[S.tab]?.title}</h2>
              <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--tx3)" }}>{STEP_INFO[S.tab]?.desc}</p>
            </div>

            {S.tab === "photos" && (
              <div className="flex flex-col gap-3">
                <label
                  onDrop={(e) => { e.preventDefault(); if (e.dataTransfer?.files) eng.addFiles(e.dataTransfer.files); }}
                  onDragOver={(e) => e.preventDefault()}
                  className="flex cursor-pointer flex-col items-center gap-1.5 rounded-[14px] px-4 py-6 text-center"
                  style={{ border: "1.5px dashed var(--bd)", background: "var(--sf2)" }}
                >
                  <span className="v2-section-icon mb-1"><Upload size={17} /></span>
                  <span className="text-[13.5px] font-semibold">Kéo thả ảnh vào đây</span>
                  <span className="text-[12.5px]" style={{ color: "var(--tx3)" }}>hoặc bấm để chọn nhiều ảnh · JPG, PNG</span>
                  <input type="file" accept="image/*" multiple onChange={(e) => { eng.addFiles(e.target.files); e.target.value = ""; }} className="hidden" />
                </label>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold">{S.photos.length ? `${S.photos.length} ảnh` : "Chưa có ảnh"}</span>
                  {S.photos.length > 1 ? <span className="text-[12px]" style={{ color: "var(--tx3)" }}>Kéo để sắp xếp lại</span> : null}
                </div>
                {S.photos.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 lg:grid-cols-3">
                    {S.photos.map((ph, i) => (
                      <div
                        key={ph.id}
                        draggable
                        onDragStart={() => { eng._drag = ph.id; }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => eng.reorderPhotos(eng._drag, ph.id)}
                        className="relative aspect-square cursor-grab overflow-hidden rounded-[10px]"
                        style={{ background: "var(--sf2)" }}
                      >
                        <img src={ph.url} alt="" className="pointer-events-none block h-full w-full object-cover" />
                        <span className="absolute left-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-[6px] px-1 text-[11px] font-bold text-white" style={{ background: "rgba(20,18,15,.72)" }}>
                          {i === 0 ? "Bìa" : i + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => eng.removePhoto(ph.id)}
                          aria-label={`Xoá ảnh ${i + 1}`}
                          title="Xoá ảnh"
                          className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-[6px] text-white"
                          style={{ background: "rgba(20,18,15,.72)" }}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {S.tab === "info" && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
                <Field label="Tên chú rể">
                  <input className={inputCls} onChange={(e) => eng.setField("groom", e.target.value)} defaultValue={S.groom} placeholder="VD: Hoàng Phú" />
                </Field>
                <Field label="Tên cô dâu">
                  <input className={inputCls} onChange={(e) => eng.setField("bride", e.target.value)} defaultValue={S.bride} placeholder="VD: Bảo Hân" />
                </Field>
                <Field label="Ngày cưới">
                  <input className={inputCls} onChange={(e) => eng.setField("date", e.target.value)} defaultValue={S.date} placeholder="VD: 20 · 12 · 2025" />
                </Field>
                <Field label="Câu mở đầu" hint="Không bắt buộc">
                  <input className={inputCls} onChange={(e) => eng.setField("eyebrow", e.target.value)} defaultValue={S.eyebrow} placeholder="VD: LỄ THÀNH HÔN" />
                </Field>
              </div>
            )}

            {S.tab === "story" && (
              <div className="flex flex-col gap-5">
                <Field
                  label="Lời nhắn · câu chuyện · cảm nghĩ"
                  hint={S.showText ? (qn ? `${qn} cảnh chữ sẽ được tạo từ câu chuyện` : "Chưa có nội dung — cách đoạn bằng một dòng trống") : "Đang tắt cảnh chữ (bật lại ở bước Phong cách)"}
                >
                  <textarea
                    ref={storyRef}
                    rows={7}
                    className={inputCls}
                    style={{ height: "auto", minHeight: 150, lineHeight: 1.6, paddingTop: 10, paddingBottom: 10, resize: "vertical" }}
                    onChange={(e) => eng.setField("story", e.target.value)}
                    defaultValue={S.story}
                    placeholder={"Viết những dòng cảm xúc của bạn...\n\nMỗi đoạn cách nhau một dòng trống sẽ thành một cảnh chữ riêng."}
                  />
                </Field>

                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="v2-label">Gợi ý câu cảm xúc</p>
                    <button type="button" onClick={genSuggestion} className={btn("soft", "sm")}>
                      <Sparkles size={15} /> Tạo gợi ý
                    </button>
                  </div>
                  {sugg.length === 0 ? (
                    <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>Mỗi lần bấm sinh một câu mẫu mới, câu cũ vẫn giữ lại.</p>
                  ) : (
                    sugg.map((s, i) => (
                      <PhraseRow key={i} text={s} onAdd={() => appendStory(s)} />
                    ))
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <p className="v2-label">Thư viện câu của bạn</p>
                  <div className="flex gap-2">
                    <input
                      value={own}
                      onChange={(e) => setOwn(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveOwn(); }}
                      placeholder="Nhập câu của riêng bạn rồi lưu lại…"
                      aria-label="Câu của riêng bạn"
                      className={`${inputCls} min-w-0 flex-1`}
                    />
                    <button type="button" onClick={saveOwn} disabled={!own.trim()} className={btn("secondary")}>Lưu</button>
                  </div>
                  {lib.length === 0 ? (
                    <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>Chưa có câu nào — lưu câu bạn thích để dùng cho các video sau.</p>
                  ) : (
                    lib.map((s, i) => (
                      <PhraseRow key={i} text={s} onAdd={() => appendStory(s)} onDelete={() => saveLib(lib.filter((_, j) => j !== i))} />
                    ))
                  )}
                </div>
              </div>
            )}

            {S.tab === "music" && (
              <div className="flex flex-col gap-2">
                {SLIDE_MUSIC.map(([id, label, desc]) => {
                  const on = S.music === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => eng.selectMusic(id)}
                      className="flex items-center gap-3 rounded-[12px] px-3.5 py-3 text-left transition-colors"
                      style={{ border: `1px solid ${on ? "var(--ac)" : "var(--bd)"}`, background: on ? "var(--acS)" : "var(--sf)", boxShadow: on ? "0 0 0 1px var(--ac)" : undefined }}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13.5px] font-semibold">{label}</span>
                        <span className="block text-[12px]" style={{ color: "var(--tx3)" }}>
                          {id === "upload" && S.audioName ? S.audioName : desc}
                        </span>
                      </span>
                      <span
                        className="h-[18px] w-[18px] flex-none rounded-full"
                        style={{ border: on ? "5px solid var(--ac)" : "2px solid var(--bd)", background: "var(--sf)" }}
                      />
                    </button>
                  );
                })}
                <label
                  className="mt-1 flex cursor-pointer items-center gap-2.5 rounded-[12px] px-3.5 py-3"
                  style={{ border: "1.5px dashed var(--bd)", background: "var(--sf2)" }}
                >
                  <Music size={16} style={{ color: "var(--tx3)" }} className="flex-none" />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold" style={{ color: "var(--tx2)" }}>
                    {S.audioName ? `Đã chọn: ${S.audioName}` : "Tải file nhạc của bạn lên"}
                  </span>
                  <input type="file" accept="audio/*" onChange={(e) => { eng.setAudioFile(e.target.files?.[0]); e.target.value = ""; }} className="hidden" />
                </label>
              </div>
            )}

            {S.tab === "style" && (
              <div className="flex flex-col gap-5">
                <div className="grid grid-cols-2 gap-2.5">
                  {Object.entries(THEMES).map(([id, t]) => {
                    const on = S.theme === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => eng.selectTheme(id)}
                        aria-pressed={on}
                        className="rounded-[12px] p-2 text-left transition-colors"
                        style={{ border: `1px solid ${on ? "var(--ac)" : "var(--bd)"}`, background: on ? "var(--acS)" : "var(--sf)", boxShadow: on ? "0 0 0 1px var(--ac)" : undefined }}
                      >
                        {/* Mẫu màu của phong cách (màu của video, không phải màu giao diện). */}
                        <span className="flex h-[54px] items-center justify-center rounded-[8px]" style={{ background: `linear-gradient(120deg, ${t.c1} 62%, ${t.c2} 62%)` }}>
                          <span style={{ fontFamily: `"${t.title}"`, fontStyle: t.titleItalic ? "italic" : "normal", fontSize: 24, fontWeight: 600, color: t.ink }}>Aa</span>
                        </span>
                        <span className="mt-2 flex items-center gap-1 text-[12.5px] font-semibold">
                          <span className="min-w-0 flex-1 truncate">{t.name}</span>
                          {on ? <Check size={14} style={{ color: "var(--ac)" }} className="flex-none" /> : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <Field label={<span className="flex justify-between"><span>Thời lượng mỗi ảnh</span><span className="v2-num" style={{ color: "var(--ac)" }}>{S.perPhoto.toFixed(1)} giây</span></span>}>
                  <input
                    type="range"
                    min={2}
                    max={6}
                    step={0.2}
                    defaultValue={S.perPhoto}
                    aria-label="Thời lượng mỗi ảnh"
                    onChange={(e) => eng.setField("perPhoto", parseFloat(e.target.value))}
                    className="w-full"
                    style={{ accentColor: "var(--ac)" }}
                  />
                </Field>
                <div className="flex flex-col">
                  <Switch label="Hiệu ứng chuyển cảnh đa dạng" desc="Tắt thì chỉ dùng hiệu ứng mờ dần" checked={S.diverse} onChange={(v) => eng.setField("diverse", v)} />
                  <Switch label="Chèn cảnh chữ / câu chuyện" desc="Lấy từ bước Câu chuyện" checked={S.showText} onChange={(v) => eng.setField("showText", v)} />
                </div>
              </div>
            )}
          </div>

          <footer className="flex flex-none items-center gap-2 px-4 py-3 sm:px-5" style={{ borderTop: "1px solid var(--bd2)" }}>
            {prevStep ? (
              <button type="button" onClick={() => eng.go(prevStep[0])} className={btn("ghost", "sm")}>
                <ArrowLeft size={15} /> {prevStep[2]}
              </button>
            ) : null}
            <span className="flex-1" />
            {nextStep ? (
              <button type="button" onClick={() => eng.go(nextStep[0])} className={btn("secondary", "sm")}>
                Bước tiếp: {nextStep[2]} <ArrowRight size={15} />
              </button>
            ) : (
              <Badge tone="green" icon={Check}>Xong — bấm “Xuất video”</Badge>
            )}
          </footer>
        </aside>
      </div>

      {/* Đang xuất: chặn thao tác, chỉ cho huỷ. */}
      {S.exporting && (
        <BlockingDialogV2 title="Đang xuất video…" desc="Giữ tab này mở cho tới khi hoàn tất. Video sẽ tự tải về máy.">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <Progress value={S.exportPct} />
            </div>
            <span className="v2-num w-10 text-right text-[13px] font-semibold" style={{ color: "var(--ac)" }}>{S.exportPct}%</span>
          </div>
          <div className="mt-5 flex justify-end">
            <button type="button" onClick={() => { eng._cancelExport = true; }} className={btn("secondary")}>Huỷ xuất</button>
          </div>
        </BlockingDialogV2>
      )}
      {S.exportError ? (
        <ToastV2 tone="red" onClick={() => eng.setState({ exportError: "" })}>{S.exportError}</ToastV2>
      ) : null}

      {/* Chọn ảnh từ thư viện để thêm vào / đổi cho cảnh đang xem */}
      <Modal
        open={!!picker}
        onClose={() => setPicker(null)}
        title={picker?.mode === "add" ? "Thêm ảnh vào cảnh" : "Đổi ảnh"}
        desc={`Chọn một ảnh trong ${S.photos.length} ảnh đã tải lên`}
        icon={ImagePlus}
        width={640}
      >
        {S.photos.length === 0 ? (
          <p className="py-6 text-center text-[13px]" style={{ color: "var(--tx3)" }}>Chưa có ảnh nào — tải ảnh lên ở bước “Ảnh”.</p>
        ) : (
          <div className="grid max-h-[56vh] grid-cols-[repeat(auto-fill,minmax(92px,1fr))] gap-2 overflow-y-auto">
            {S.photos.map((ph, i) => (
              <button
                key={ph.id}
                type="button"
                onClick={() => applyPick(ph.id)}
                className="relative aspect-square overflow-hidden rounded-[10px]"
                style={{ border: "1px solid var(--bd)", background: "var(--sf2)" }}
              >
                <img src={ph.url} alt={`Ảnh ${i + 1}`} className="block h-full w-full object-cover" />
                <span className="absolute left-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-[6px] px-1 text-[11px] font-bold text-white" style={{ background: "rgba(20,18,15,.72)" }}>
                  {i + 1}
                </span>
              </button>
            ))}
          </div>
        )}
      </Modal>
    </Stack>
  );
}

/** Một câu gợi ý / câu đã lưu: chữ + nút Thêm (+ nút xoá cho câu đã lưu). */
function PhraseRow({ text, onAdd, onDelete }: { text: string; onAdd: () => void; onDelete?: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded-[12px] px-3 py-2.5" style={{ border: "1px solid var(--bd)", background: onDelete ? "var(--sf)" : "var(--sf2)" }}>
      <span className="min-w-0 flex-1 text-[13px] leading-relaxed">{text}</span>
      <button type="button" onClick={onAdd} className={btn("ghost", "sm")} title="Thêm vào câu chuyện">
        <Plus size={14} /> Thêm
      </button>
      {onDelete ? (
        <button type="button" onClick={onDelete} className={iconBtn()} aria-label="Xoá câu khỏi thư viện" title="Xoá" style={{ color: "var(--rd)" }}>
          <Trash2 size={15} />
        </button>
      ) : null}
    </div>
  );
}
