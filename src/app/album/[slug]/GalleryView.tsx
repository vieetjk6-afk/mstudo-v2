"use client";

import { useEffect, useRef, useState } from "react";
import { fmtDate } from "@/lib/date";
import FaceFinder from "@/app/a/[slug]/FaceFinder";
import {
  Lock, ChevronLeft, ChevronRight, X, Download, Calendar, Star, Send, Check, Play, Heart, Share2,
} from "lucide-react";
import DriveFolderLinks from "@/components/DriveFolderLinks";
import StudioBrand from "@/components/StudioBrand";
import Turnstile from "@/components/Turnstile";
import ShareButton from "@/components/ShareButton";
import ShareDialog from "@/components/ShareDialog";
import { studioUrl } from "@/lib/hosts";
import { ICON_HALO } from "@/lib/album-icon";
import { thumbnailUrl, fullImageUrl, originalImageUrl, retryViaProxy } from "@/lib/drive";
import PhotoZoom from "@/components/PhotoZoom";
import { downloadImage } from "@/lib/download";
import { useMasonry } from "@/lib/masonry";
import { useGridThumbWidth } from "@/lib/use-img-width";
import ZoomHiRes from "@/components/ZoomHiRes";
import { ALBUM_TITLE_FONT } from "@/lib/album-title";
import { watermarkLayer } from "@/lib/album-watermark";
import AlbumCover from "@/components/AlbumCover";
import { PrintBar, PrintCard, PrintFab, PrintToggle } from "./PrintPicker";
import { isVideo, useGalleryView, type GalleryDriveFolder as DriveFolder, type GalleryViewProps } from "./useGalleryView";

/* Album giao khách — GIAO DIỆN CŨ. Toàn bộ logic (mở khoá, nạp nền, chia sẻ,
   ảnh in, khung xem, cảm nhận…) nằm ở ./useGalleryView, dùng chung với bản giao
   diện mới ./GalleryViewV2. File này chỉ còn phần vẽ. */

export default function GalleryView(props: GalleryViewProps) {
  const { gallery, shareIds, studioName = "Studio", logoUrl = null, studioHost = null } = props;
  const {
    tr,
    wm,
    unlocked,
    password,
    setPassword,
    pwError,
    pwLoading,
    unlock,
    photos,
    tabSources,
    people,
    scan,
    personId,
    setPersonId,
    driveIdOf,
    downloadFolders,
    activeTab,
    setActiveTab,
    visible,
    sections,
    photosRef,
    printCardRef,
    scrollToPhotos,
    shareMode,
    selected,
    toggleSelect,
    shareUrl,
    setShareUrl,
    shareBusy,
    shareSelected,
    pp,
    printing,
    lbIdx,
    setLbIdx,
    go,
    fullW,
    fbName,
    setFbName,
    fbRating,
    setFbRating,
    fbContent,
    setFbContent,
    fbList,
    fbSent,
    fbCaptcha,
    setFbCaptcha,
    fbSending,
    fbErr,
    onFbCaptcha,
    sendFeedback,
  } = useGalleryView(props);
  const totalPhotos = props.totalPhotos ?? null;

  /** Khách đang phóng to ảnh trong khung xem → gọi bản độ phân giải cao (ZoomHiRes). */
  const [lbZoomed, setLbZoomed] = useState(false);
  /** Đang tải ảnh gốc cho lúc phóng to (xem ZoomHiRes) → hiện chỉ báo nhỏ. */
  const [hiResLoading, setHiResLoading] = useState(false);
  // Vùng nền của khung xem ảnh — PhotoZoom bắt cử chỉ trên đây (kể cả dải đen
  // hai bên ảnh dọc, chỗ ngón cái hay quẹt).
  const lbStage = useRef<HTMLDivElement | null>(null);

  // Lưới ảnh: 2 cột trên điện thoại, 4 cột trên máy tính, đặt ảnh trái → phải.
  // Hàm thứ ba cho lưới biết địa chỉ ảnh của từng ô để gọi sẵn byte ảnh sắp tới
  // (xem @/lib/masonry) — không có nó thì cuộn nhanh sẽ thấy ô trắng.
  // Cỡ ảnh theo màn hình thật (xem @/lib/use-img-width) — 400px cố định bị mờ
  // trên điện thoại và màn retina.
  const gridW = useGridThumbWidth(2, 4);
  const masonry = useMasonry(2, 4, (id) => {
    const f = driveIdOf.get(id);
    return f ? thumbnailUrl(f, gridW) : null;
  });

  // Đổi ảnh → khung xem dựng lại ở mức 1 (key theo id ảnh), nhãn phóng to cũng về 0.
  useEffect(() => { setLbZoomed(false); setHiResLoading(false); }, [lbIdx]);

  // ── Password gate ──
  if (!unlocked) {
    return (
      <main className="flex min-h-screen flex-col">
        <header className="flex items-center justify-between px-6 py-5 md:px-10"><StudioBrand name={studioName} logoUrl={logoUrl} /></header>
        <div className="flex flex-1 items-center justify-center px-6">
          <form onSubmit={unlock} className="card w-full max-w-sm p-8 text-center">
            <Lock className="mx-auto mb-4" size={26} style={{ color: "var(--gold)" }} />
            <h1 className="font-serif text-2xl font-medium">{gallery.title}</h1>
            <p className="mb-1 mt-2 text-sm" style={{ color: "var(--text2)" }}>{tr.enterPw}</p>
            <p className="mb-6 text-[12.5px]" style={{ color: "var(--gold)" }}>{tr.pwHint} <b>{tr.pwHintBold}</b>{tr.pwHintSuffix}</p>
            <input type="text" inputMode="numeric" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} className="input mb-4 text-center" placeholder="09xx xxx xxx" />
            {pwError && <p className="mb-4 text-sm" style={{ color: "var(--danger)" }}>{tr.pwWrong}</p>}
            <button disabled={pwLoading} className="btn-primary w-full">{pwLoading ? tr.pwOpening : tr.pwEnter}</button>
          </form>
        </div>
      </main>
    );
  }

  const lb = lbIdx !== null ? visible[lbIdx] : null;

  return (
    <main className="min-h-screen pb-24">
      <header className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-5 py-3.5 md:px-10" style={{ background: "color-mix(in srgb, var(--bg) 80%, transparent)", backdropFilter: "blur(20px)", borderBottom: "1px solid var(--border)" }}>
        <StudioBrand name={studioName} logoUrl={logoUrl} />
        <div className="flex flex-wrap items-center justify-end gap-2">
          {!shareMode && !printing && selected.size > 0 && (
            <button onClick={shareSelected} disabled={shareBusy} className="btn-primary px-3 py-1.5 text-[13px]">
              <Share2 size={14} />
              {shareBusy ? "Đang tạo link…" : `Chia sẻ ${selected.size} ảnh đã chọn`}
            </button>
          )}
          {/* Nút chính của album giao khách: mở thẳng thư mục FILE CHỈNH SỬA trên
              Drive (nguồn giai đoạn "delivery", AlbumEditor đặt tên "File ChinhSua").
              Google tự nén và phục vụ nên không tốn byte nào của Vercel/Supabase.
              Ẩn ở chế độ chia sẻ chọn lọc vì link Drive trỏ CẢ thư mục → sẽ lộ
              toàn album chứ không riêng mấy ảnh được chia sẻ. */}
          {/* MỘT nút "Tải ảnh" duy nhất: bên trong gộp cả file đã chỉnh sửa
              (thư mục giao khách) lẫn ảnh gốc giai đoạn chọn ảnh. Trước đây là
              hai nút riêng nằm cạnh nhau, khách phải tự đoán nút nào là nút
              mình cần. Ẩn thư mục giao khách ở chế độ chia sẻ chọn lọc vì link
              Drive mở CẢ thư mục → sẽ lộ toàn album. */}
          {!shareMode && downloadFolders.length > 0 && (
            <DriveDownload folders={downloadFolders} label={tr.download} labelOne={tr.download} accent />
          )}
          {!shareMode && <ShareButton path={studioUrl(studioHost, `/album/${gallery.slug}`)} title={gallery.title} className="btn-ghost px-3 py-1.5 text-[13px]" />}
        </div>
      </header>

      {/* Ảnh bìa chiếm trọn màn hình, tên album ở giữa, nút "Xem album" ngay
          dưới — xem src/components/AlbumCover.tsx. */}
      {gallery.cover_url && (
        <AlbumCover
          url={gallery.cover_url}
          title={gallery.title}
          note={gallery.event_date ? fmtDate(gallery.event_date) : null}
          buttonLabel={tr.viewAlbum}
          onView={scrollToPhotos}
        />
      )}

      <div className="mx-auto max-w-[1800px] px-4 md:px-6" style={{ marginTop: gallery.cover_url ? "24px" : "28px", position: "relative" }}>
        {!gallery.cover_url && (
          <h1 className="text-[clamp(34px,6vw,64px)] leading-[1.06]" style={ALBUM_TITLE_FONT}>{gallery.title}</h1>
        )}
        <p className="mt-2 flex items-center gap-3 text-[13.5px]" style={{ color: "var(--text2)" }}>
          {gallery.event_date && !gallery.cover_url && (<span className="flex items-center gap-1"><Calendar size={13} /> {fmtDate(gallery.event_date)}</span>)}
          <span>{shareMode ? visible.length : (totalPhotos ?? photos.length)} {tr.photoCount}</span>
        </p>
        {shareMode ? (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px]" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--gold)" }}>
            <Share2 size={14} /> {shareIds!.length} ảnh được chia sẻ
          </div>
        ) : null}

        <PrintCard pp={pp} cardRef={printCardRef} />

        {/* tabs */}
        {/* TÌM ẢNH THEO KHUÔN MẶT — album giao khách.
            Cùng khối với album chọn ảnh: máy chủ đã gom sẵn nên bấm một mặt chỉ
            là tra bảng, khách không tải mô hình nào. */}
        <FaceFinder people={people} activeId={personId} onPick={setPersonId} driveIdOf={driveIdOf} slug={gallery.slug} password={password} scan={scan} />

        {tabSources.length > 1 && (
          <div className="mt-6 flex flex-wrap gap-2">
            <Tab active={activeTab === "all"} onClick={() => setActiveTab("all")}>{tr.tabAll}</Tab>
            {tabSources.map((s) => (<Tab key={s.id} active={activeTab === s.id} onClick={() => setActiveTab(s.id)}>{s.name} <span className="opacity-60">{photos.filter((p) => p.source_id === s.id).length}</span></Tab>))}
          </div>
        )}

        {/* sections — mỗi thư mục con là một mục riêng, có tiêu đề + số ảnh */}
        <div
          ref={(el) => { photosRef.current = el; masonry.ref(el); }}
          className="mt-7 space-y-9 scroll-mt-20"
        >
          {sections.map((sec) => {
            if (sec.items.length === 0) return null;
            // Chỉ dựng phần ô đang nằm quanh khung nhìn (xem @/lib/masonry).
            // Khai báo lưới TRƯỚC rồi mới hỏi khoảng: hỏi trước thì lượt dựng đầu
            // chưa có lưới nào để trả lời, album hiện ra trống một nhịp.
            const luoi = masonry.lattice(sec.id, sec.ids);
            const [dau, cuoi] = masonry.range(sec.id);
            const items = sec.items.slice(dau, cuoi);
            return (
            <section key={sec.id}>
              {sec.name && (
                <h2 className="mb-3 font-serif text-xl font-medium">
                  {sec.name}
                  <span className="ml-2 text-[13px] font-normal" style={{ color: "var(--text3)" }}>· {sec.items.length} {tr.photoCount}</span>
                </h2>
              )}
              {/* Lưới ảnh kiểu collage: 2 cột trên điện thoại, 4 cột trên máy tính,
                  khe gần như bằng 0, KHÔNG bo góc và KHÔNG cắt ảnh — mỗi tấm giữ
                  đúng tỉ lệ gốc, và ảnh được đặt lần lượt TRÁI → PHẢI
                  (xem src/lib/masonry.ts). */}
              <div {...luoi}>
                {items.map(({ p, i }, k) => {
                  const isSel = printing ? pp.picks.has(p.id) : selected.has(p.id);
                  const o = masonry.tileProps(sec.id, p.id, dau + k);
                  return (
                  <div key={p.id} ref={o.ref} className="o-anh-cho group relative cursor-pointer overflow-hidden" style={{ background: "var(--surface)", ...o.style }}>
                    <img {...masonry.imgProps(p.id)} onClick={() => setLbIdx(i)} role="button" tabIndex={0} aria-label={`Xem ${p.name}`} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setLbIdx(i); } }} src={thumbnailUrl(p.drive_file_id, gridW)} alt={p.name} loading="lazy" decoding="async" draggable={false} onContextMenu={(e) => wm && e.preventDefault()} className="block h-full w-full cursor-zoom-in select-none object-cover" />
                    {wm && (
                      <div className="pointer-events-none absolute inset-0 z-[2] opacity-20" style={watermarkLayer(wm)} />
                    )}
                    {isSel && <div className="pointer-events-none absolute inset-0 z-[2]" style={{ boxShadow: "inset 0 0 0 2px var(--gold)" }} />}
                    {isVideo(p) && (
                      <span onClick={() => setLbIdx(i)} className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full" style={{ background: "rgba(10,10,12,.55)", color: "#fff", backdropFilter: "blur(6px)" }}>
                        <Play size={20} fill="currentColor" strokeWidth={0} />
                      </span>
                    )}
                    {/* Đang chọn ảnh in: nút tròn chọn in thay chỗ trái tim. */}
                    {printing && !isVideo(p) && (
                      <div className="absolute right-0.5 top-0.5 z-[4]">
                        <PrintToggle picked={pp.picks.has(p.id)} disabled={pp.locked} onToggle={() => pp.toggle(p.id, !isVideo(p))} />
                      </div>
                    )}
                    {/* Chỉ còn TRÁI TIM: không nền, không viền tròn, cỡ nhỏ lại. */}
                    {!shareMode && !printing && (
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleSelect(p.id); }}
                        title={isSel ? "Bỏ chọn ảnh này" : "Chọn ảnh để chia sẻ"}
                        aria-label={isSel ? "Bỏ chọn ảnh này" : "Chọn ảnh để chia sẻ"}
                        aria-pressed={isSel}
                        className="absolute right-1 top-1 z-[4] flex h-7 w-7 items-center justify-center transition-transform active:scale-90"
                        style={{ color: isSel ? "var(--gold)" : "#fff", filter: ICON_HALO }}
                      >
                        <Heart size={16} fill={isSel ? "currentColor" : "none"} strokeWidth={isSel ? 0 : 2.2} />
                      </button>
                    )}
                    {/* Nút tải từng ảnh đã bỏ khỏi lưới — chỉ còn trong khung xem
                        ảnh lớn (bấm vào ảnh), để lưới thật gọn. */}
                  </div>
                  );
                })}
              </div>
            </section>
            );
          })}
        </div>

        {/* Feedback */}
        <section className="mt-16 border-t pt-10" style={{ borderColor: "var(--border)" }}>
          <h2 className="font-serif text-2xl font-medium">{tr.feedbackTitle}</h2>
          <div className="mt-5 grid gap-6 lg:grid-cols-2">
            <div className="card p-5">
              {fbSent ? (
                <div>
                  <div className="flex items-center gap-2.5 text-sm" style={{ color: "var(--success)" }}><Check size={18} /> {tr.fbThanks}</div>
                  <p className="mt-1.5 text-[12.5px]" style={{ color: "var(--text3)" }}>{tr.fbPending}</p>
                </div>
              ) : (
                <>
                  <input value={fbName} onChange={(e) => setFbName(e.target.value)} placeholder={tr.fbNamePh} className="input mb-3" />
                  <div className="mb-3 flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} type="button" onClick={() => setFbRating(n)} aria-label={`${n} sao`} aria-pressed={n <= fbRating} className="p-1" style={{ color: n <= fbRating ? "var(--gold)" : "var(--text3)" }}>
                        <Star size={22} fill={n <= fbRating ? "currentColor" : "none"} strokeWidth={n <= fbRating ? 0 : 2} />
                      </button>
                    ))}
                  </div>
                  <textarea value={fbContent} onChange={(e) => setFbContent(e.target.value)} placeholder={tr.fbContentPh} className="input min-h-[90px] resize-y" />
                  <Turnstile onVerify={onFbCaptcha} onExpire={() => setFbCaptcha(null)} onError={() => setFbCaptcha(null)} className="mt-3" />
                  {fbErr && <p className="mt-2 text-[12.5px]" style={{ color: "var(--s-red, #d66)" }}>{tr.fbErr}</p>}
                  <button onClick={sendFeedback} disabled={!fbCaptcha || fbSending} className="btn-primary mt-3 w-full"><Send size={15} /> {fbSending ? tr.fbSending : tr.fbSend}</button>
                </>
              )}
            </div>
            <div className="space-y-3">
              {fbList.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--text3)" }}>{tr.fbEmpty}</p>
              ) : fbList.map((f) => (
                <div key={f.id} className="card p-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{f.client_name || tr.fbGuest}</span>
                    {f.rating ? <span className="flex items-center gap-0.5" style={{ color: "var(--gold)" }}>{Array.from({ length: f.rating }).map((_, i) => <Star key={i} size={12} fill="currentColor" strokeWidth={0} />)}</span> : null}
                  </div>
                  <p className="mt-1 text-[13.5px]" style={{ color: "var(--text2)" }}>{f.content}</p>
                  {f.reply ? (
                    <div className="mt-2.5 rounded-lg px-3 py-2" style={{ background: "var(--surface2)" }}>
                      <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text3)" }}>{tr.fbReply}</p>
                      <p className="mt-0.5 whitespace-pre-wrap text-[13px]">{f.reply}</p>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* Lightbox */}
      {lb && lbIdx !== null && (
        <div className="fixed inset-0 z-[80] flex flex-col" style={{
            background: "rgba(6,6,8,.94)",
            backdropFilter: "blur(8px)",
            // Khung xem ảnh LUÔN là nền tối, còn giao diện mặc định của app là
            // chủ đề SÁNG (data-theme="light"): --text2 là xám đậm, --surface
            // gần trắng. Nút nào không tự đặt màu sẽ thành chữ đậm trên nền đen
            // — đúng lỗi "bấm vào xem ảnh mất nút chọn / không chọn": nút vẫn ở
            // đó và vẫn bấm được, chỉ là không nhìn thấy. Ghi đè bộ biến ngay
            // tại gốc khung xem để MỌI thứ bên trong đọc được, thay vì đi vá
            // màu từng nút. `color` phải đặt tường minh: thẻ nào thừa kế màu
            // chữ từ body thì đã nhận giá trị TÍNH TOÁN của chủ đề sáng rồi,
            // ghi đè biến không cứu được.
            color: "#f4f3f1",
            "--text": "#f4f3f1",
            "--text2": "rgba(244,243,241,.72)",
            "--text3": "rgba(244,243,241,.55)",
            "--surface": "rgba(255,255,255,.12)",
            "--surface2": "rgba(255,255,255,.18)",
            "--border": "rgba(255,255,255,.22)",
            "--border2": "rgba(255,255,255,.3)",
          } as React.CSSProperties}>
          <div className="flex flex-shrink-0 items-center gap-3 px-4 py-3.5 md:px-7" style={{ borderBottom: "1px solid var(--border)" }}>
            <span className="text-[13px]" style={{ color: "var(--text2)" }}>{lbIdx + 1} / {visible.length}</span>
            <div className="flex-1" />
            {gallery.allowDownload !== false && (
              isVideo(lb) ? (
                <a href={`https://drive.google.com/file/d/${lb.drive_file_id}/view`} target="_blank" rel="noopener noreferrer" aria-label={tr.dlPhoto} title={tr.dlPhoto} className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text2)" }}><Download size={17} /></a>
              ) : (
                <button type="button" onClick={() => downloadImage(lb.drive_file_id, lb.name, wm)} aria-label={tr.dlPhoto} title={tr.dlPhoto} className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text2)" }}><Download size={17} /></button>
              )
            )}
            <button onClick={() => setLbIdx(null)} aria-label="Đóng" className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}><X size={17} /></button>
          </div>
          <div ref={lbStage} className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-1 md:p-4">
            {hiResLoading && (
            <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full px-3 py-1 text-[12px]" style={{ background: "rgba(0,0,0,.6)", color: "#fff" }}>
              Đang tải ảnh gốc…
            </div>
            )}
            {/* Chỉ còn dấu < > chồng lên ảnh: bỏ nền + viền để ảnh chiếm chỗ tối đa. */}
            <button onClick={() => setLbIdx(Math.max(0, lbIdx - 1))} disabled={lbIdx === 0} aria-label="Ảnh trước" className="absolute left-0 top-1/2 z-10 flex h-16 w-11 -translate-y-1/2 items-center justify-center transition-opacity disabled:opacity-20 md:w-14" style={{ color: "#fff", filter: "drop-shadow(0 2px 6px rgba(0,0,0,.8))" }}><ChevronLeft size={34} strokeWidth={1.6} /></button>
            {isVideo(lb) ? (
              <iframe
                src={`https://drive.google.com/file/d/${lb.drive_file_id}/preview`}
                allow="autoplay; fullscreen"
                allowFullScreen
                className="aspect-video w-full max-w-4xl rounded"
                style={{ border: "none", boxShadow: "0 30px 80px rgba(0,0,0,.6)" }}
              />
            ) : (
              // Khung ngoài KHÔNG bị transform nên kích thước bằng đúng ảnh —
              // nút thích vì thế dính đúng góc ảnh.
              <div className="relative inline-block">
                <PhotoZoom key={lb.id} stageRef={lbStage} onSwipe={go} onZoomChange={(k) => setLbZoomed(k > 1)} className="relative inline-block">
                  <img key={lb.id} src={fullImageUrl(lb.drive_file_id, fullW)} alt={lb.name} draggable={false} decoding="async" onError={retryViaProxy} onContextMenu={(e) => wm && e.preventDefault()} className="max-h-[82vh] max-w-full select-none rounded object-contain" style={{ boxShadow: "0 30px 80px rgba(0,0,0,.6)", backgroundImage: `url(${thumbnailUrl(lb.drive_file_id, gridW)})`, backgroundSize: "contain", backgroundRepeat: "no-repeat", backgroundPosition: "center" }} />
                  <ZoomHiRes key={lb.id} srcs={[originalImageUrl(lb.drive_file_id), fullImageUrl(lb.drive_file_id, 4096), `${fullImageUrl(lb.drive_file_id, 2560)}&raw=1`]} active={lbZoomed} onLoadingChange={setHiResLoading} className="rounded" />
                  {wm && (
                    <div className="pointer-events-none absolute inset-0 flex flex-wrap content-center items-center justify-center gap-x-12 gap-y-10 opacity-20">
                      {Array.from({ length: 12 }).map((_, wi) => (
                        <span key={wi} className="rotate-[-30deg] whitespace-nowrap text-base font-semibold tracking-widest text-white">{wm}</span>
                      ))}
                    </div>
                  )}
                </PhotoZoom>
                {printing && (
                  <div className="absolute right-1 top-1 z-20">
                    <PrintToggle size="lg" picked={pp.picks.has(lb.id)} disabled={pp.locked} onToggle={() => pp.toggle(lb.id, true)} />
                  </div>
                )}
                {/* Thích ảnh ngay trong khung xem — cùng góc với lưới ảnh bên
                    ngoài. Trước đây chỉ chọn được ở lưới. */}
                {!shareMode && !printing && (
                  <button
                    onClick={() => toggleSelect(lb.id)}
                    title={selected.has(lb.id) ? "Bỏ chọn ảnh này" : "Chọn ảnh để chia sẻ"}
                    aria-label={selected.has(lb.id) ? "Bỏ chọn ảnh này" : "Chọn ảnh để chia sẻ"}
                    aria-pressed={selected.has(lb.id)}
                    className="absolute right-1.5 top-1.5 z-20 flex h-10 w-10 items-center justify-center transition-transform active:scale-90"
                    style={{ color: selected.has(lb.id) ? "var(--gold)" : "#fff", filter: ICON_HALO }}
                  >
                    <Heart size={24} fill={selected.has(lb.id) ? "currentColor" : "none"} strokeWidth={selected.has(lb.id) ? 0 : 2.4} />
                  </button>
                )}
              </div>
            )}
            <button onClick={() => setLbIdx(Math.min(visible.length - 1, lbIdx + 1))} disabled={lbIdx >= visible.length - 1} aria-label="Ảnh sau" className="absolute right-0 top-1/2 z-10 flex h-16 w-11 -translate-y-1/2 items-center justify-center transition-opacity disabled:opacity-20 md:w-14" style={{ color: "#fff", filter: "drop-shadow(0 2px 6px rgba(0,0,0,.8))" }}><ChevronRight size={34} strokeWidth={1.6} /></button>
          </div>
        </div>
      )}

      <PrintFab pp={pp} cardRef={printCardRef} />
      <PrintBar pp={pp} />

      <ShareDialog
        url={shareUrl}
        title={`Chia sẻ ${selected.size} ảnh đã chọn`}
        subtitle="Gửi link này cho người khác — họ sẽ chỉ xem đúng những ảnh bạn đã chọn."
        onClose={() => setShareUrl(null)}
      />
    </main>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="rounded-full px-4 py-1.5 text-[13px] transition-colors" style={active ? { background: "var(--accent)", color: "var(--accentInk)" } : { background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text2)" }}>
      {children}
    </button>
  );
}

/**
 * "Tải album" = link Drive. Một folder → link trực tiếp; nhiều folder → menu thả
 * xuống liệt kê từng thư mục. Khách tải trực tiếp từ Google Drive (giữ nguyên
 * chất lượng gốc), không qua ZIP nén.
 */
function DriveDownload({ folders, label, labelOne, accent = false }: { folders: DriveFolder[]; label: string; labelOne: string; accent?: boolean }) {
  // File chỉnh sửa là thứ khách vào album để lấy → nút chính. "File gốc" là
  // phụ, để nguyên kiểu chìm cho khỏi tranh chỗ.
  const cls = `${accent ? "btn-primary" : "btn-ghost"} px-3 py-1.5 text-[13px]`;
  return <DriveFolderLinks folders={folders} label={label} labelOne={labelOne} className={cls} />;
}
