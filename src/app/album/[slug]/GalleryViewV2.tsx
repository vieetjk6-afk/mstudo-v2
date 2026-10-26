"use client";

import { useState } from "react";
import {
  Calendar,
  Check,
  CheckCircle2,
  Download,
  ImageOff,
  MessageSquareHeart,
  Play,
  Printer,
  ScanFace,
  Send,
  Share2,
  Star,
  X,
} from "lucide-react";
import { fmtDate } from "@/lib/date";
import { useTheme } from "@/lib/theme";
import { stripExtension } from "@/lib/drive";
import { downloadImage } from "@/lib/download";
import { useMasonry } from "@/lib/masonry";
import { useGridThumbWidth } from "@/lib/use-img-width";
import { watermarkLayer } from "@/lib/album-watermark";
import { studioUrl } from "@/lib/hosts";
import DriveFolderLinks from "@/components/DriveFolderLinks";
import ShareButton from "@/components/ShareButton";
import ShareDialog from "@/components/ShareDialog";
import Turnstile from "@/components/Turnstile";
import { CustomerHeaderV2, CustomerRootV2 } from "@/components/v2/customer";
import { Callout, Empty, Field, GroupLabel, Progress, Section, btn, inputCls } from "@/components/v2/kit";
import { Switch } from "@/components/v2/kit-client";
import FaceFinderV2, { FaceAvatar, faceToolAvailable } from "@/app/a/[slug]/FaceFinderV2";
import { useFaceSearch } from "@/app/a/[slug]/useFaceSearch";
import { AlbumHeroV2, ChipRow, ChipV2, LockScreenV2, SelectDot, ViewerV2, useAlbumImg } from "@/app/a/[slug]/album-v2-ui";
import { printCardText, useCardInView, type PrintPicks } from "./PrintPicker";
import { isVideo, useGalleryView, type GalleryViewProps } from "./useGalleryView";

/* ═══════════════════════════════════════════════════════════════════════════
   ALBUM GIAO KHÁCH (/album/[slug]) — giao diện mới. Cùng dữ liệu, cùng hành vi
   với GalleryView (bản cũ; logic chung ở ./useGalleryView). Khác ở cách sắp:
     • Thẻ đầu trang có MỘT nút chính "Tải tất cả ảnh" (thư mục Drive: file đã
       chỉnh sửa + ảnh gốc), chia sẻ album nằm ở đầu trang.
     • Ảnh in tặng là một thẻ gọn + thanh dính đáy khi đang chọn.
     • Lưới ảnh tràn mép trên điện thoại; chạm vòng tròn ở góc để chọn ảnh rồi
       chia sẻ — thanh "Đã chọn N ảnh · Chia sẻ" hiện ở đáy.
     • Khung xem toàn màn hình: Chọn · Tải ảnh này ở đáy (vùng ngón cái).
     • Cảm nhận của khách là một khối riêng cuối trang.
   ═══════════════════════════════════════════════════════════════════════════ */

export default function GalleryViewV2(props: GalleryViewProps) {
  const { gallery, studioName = "Studio", logoUrl = null, studioHost = null, shareIds } = props;
  const g = useGalleryView(props);
  const { tr, pp } = g;
  const { theme } = useTheme();
  const img = useAlbumImg();
  const brand = { name: studioName, logoUrl };
  const [faceOpen, setFaceOpen] = useState(false);
  const face = useFaceSearch({
    slug: gallery.slug,
    password: g.password,
    onPick: (id) => {
      g.setPersonId(id);
      if (id) setFaceOpen(false);
    },
  });
  // Thẻ ảnh in đang trong màn hình thì không hiện nút nổi cùng việc.
  const cardInView = useCardInView(g.printCardRef, pp.enabled);

  const gridW = useGridThumbWidth(2, 4);
  const masonry = useMasonry(2, 4, (id) => {
    const f = g.driveIdOf.get(id);
    return f ? img.thumb(f, gridW) : null;
  });

  if (!g.unlocked) {
    return (
      <LockScreenV2
        theme={theme}
        brand={brand}
        title={gallery.title}
        desc={tr.enterPw}
        hint={
          <>
            {tr.pwHint} <b>{tr.pwHintBold}</b> {tr.pwHintSuffix}
          </>
        }
        value={g.password}
        onChange={g.setPassword}
        onSubmit={g.unlock}
        error={g.pwError ? tr.pwWrong : null}
        loading={g.pwLoading}
        submitLabel={tr.pwEnter}
        loadingLabel={tr.pwOpening}
        placeholder="09xx xxx xxx"
        numeric
      />
    );
  }

  const lb = g.lbIdx !== null ? g.visible[g.lbIdx] ?? null : null;
  const count = g.shareMode ? g.visible.length : (props.totalPhotos ?? g.photos.length);
  const showFaces = faceToolAvailable(g.people, g.scan);
  const sharing = !g.shareMode && !g.printing && g.selected.size > 0;
  const showFab = pp.needsAction && !pp.mode && !cardInView && !sharing;
  const bottomBar = g.printing || sharing;

  return (
    <CustomerRootV2 theme={theme}>
      <CustomerHeaderV2
        brand={brand}
        sub={g.shareMode ? "Ảnh được chia sẻ" : "Album hoàn thiện"}
        right={
          !g.shareMode ? (
            <ShareButton path={studioUrl(studioHost, `/album/${gallery.slug}`)} title={gallery.title} label="Chia sẻ" className={btn("secondary", "sm")} />
          ) : null
        }
      />

      <AlbumHeroV2
        cover={gallery.cover_url}
        title={gallery.title}
        eyebrow={`${studioName} gửi bạn`}
        meta={
          <>
            {gallery.event_date ? (
              <>
                <span className="inline-flex items-center gap-1">
                  <Calendar size={13} /> {fmtDate(gallery.event_date)}
                </span>
                <span aria-hidden>·</span>
              </>
            ) : null}
            <span>
              {count} {tr.photoCount}
            </span>
          </>
        }
      />

      <main className="mx-auto w-full max-w-[1080px] px-4" style={{ paddingBottom: bottomBar || showFab ? 140 : 56 }}>
        <div className="flex flex-col gap-3 pt-4 sm:pt-5">
          {g.shareMode ? (
            <Callout tone="blue" icon={Share2} title={`${shareIds!.length} ảnh được chia sẻ`}>
              Người gửi link chọn sẵn những ảnh này cho bạn xem.
            </Callout>
          ) : (
            <div className="v2-card v2-card-pad flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
              <div className="min-w-0 flex-1">
                <p className="text-[15.5px] font-semibold">Ảnh của bạn đã sẵn sàng</p>
                <p className="mt-0.5 text-[13px]" style={{ color: "var(--tx2)" }}>
                  {g.downloadFolders.length > 0
                    ? "Tải cả album từ Google Drive, giữ nguyên chất lượng. Muốn lấy vài tấm thì mở ảnh rồi bấm “Tải ảnh”."
                    : g.allowDownload
                      ? "Bấm vào ảnh để xem lớn và tải từng tấm về máy."
                      : "Bấm vào ảnh để xem lớn. Chạm vòng tròn ở góc ảnh để chọn và chia sẻ."}
                </p>
              </div>
              {g.downloadFolders.length > 0 && (
                <div className="flex-none [&>a]:w-full [&>div>button]:w-full [&>div]:w-full sm:[&>a]:w-auto sm:[&>div>button]:w-auto sm:[&>div]:w-auto">
                  <DriveFolderLinks folders={g.downloadFolders} label="Tải tất cả ảnh" labelOne="Tải tất cả ảnh" className={btn("primary", "lg")} />
                </div>
              )}
            </div>
          )}

          <PrintCardV2 pp={pp} cardRef={g.printCardRef} />
        </div>

        {/* Thư mục + khuôn mặt */}
        {(g.tabSources.length > 1 || showFaces) && (
          <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-center">
            {g.tabSources.length > 1 ? (
              <div className="min-w-0 flex-1">
                <ChipRow label="Thư mục ảnh">
                  <ChipV2 on={g.activeTab === "all"} onClick={() => g.setActiveTab("all")}>
                    {tr.tabAll}
                  </ChipV2>
                  {g.tabSources.map((s) => (
                    <ChipV2 key={s.id} on={g.activeTab === s.id} onClick={() => g.setActiveTab(s.id)} count={g.photos.filter((p) => p.source_id === s.id && (!g.shareSet || g.shareSet.has(p.id))).length}>
                      {s.name}
                    </ChipV2>
                  ))}
                </ChipRow>
              </div>
            ) : (
              <div className="hidden flex-1 sm:block" />
            )}
            {showFaces && (
              <button type="button" onClick={() => setFaceOpen(true)} className={btn("secondary", "md", "w-full sm:w-auto")}>
                {g.people.length > 0 ? (
                  <span className="-ml-1 flex -space-x-2">
                    {g.people.slice(0, 3).map((p) => (
                      <span key={p.id} className="rounded-full" style={{ boxShadow: "0 0 0 2px var(--sf)" }}>
                        <FaceAvatar person={p} driveIdOf={g.driveIdOf} size={22} />
                      </span>
                    ))}
                  </span>
                ) : (
                  <ScanFace size={16} style={{ color: "var(--ac)" }} />
                )}
                Tìm ảnh có mặt bạn
              </button>
            )}
          </div>
        )}

        {g.activePerson && (
          <div className="mt-3 flex">
            <span className="inline-flex h-9 items-center gap-2 rounded-full pl-1 pr-1 text-[13px] font-semibold" style={{ background: "var(--acS)", color: "var(--ac)" }}>
              <FaceAvatar person={g.activePerson} driveIdOf={g.driveIdOf} size={28} />
              <span className="max-w-[56vw] truncate">
                {g.activePerson.name ? `Ảnh của ${g.activePerson.name}` : "Ảnh của người này"} · {g.visible.length}
              </span>
              <button type="button" onClick={() => g.setPersonId(null)} aria-label="Xem cả album" title="Xem cả album" className="flex h-7 w-7 items-center justify-center rounded-full">
                <X size={15} />
              </button>
            </span>
          </div>
        )}

        {/* Lưới ảnh */}
        <div ref={g.photosRef} className="mt-4 scroll-mt-20">
          {g.visible.length === 0 ? (
            <div className="v2-card">
              {g.printing && pp.onlyPicked ? (
                <Empty icon={Printer} title="Chưa chọn ảnh in nào" hint="Tắt “Chỉ xem ảnh đã chọn” để chọn ảnh." />
              ) : (
                <Empty icon={ImageOff} title="Album chưa có ảnh nào" hint="Studio đang đưa ảnh lên. Bạn quay lại sau ít phút nhé." />
              )}
            </div>
          ) : (
            <div ref={masonry.ref} className="-mx-4 flex flex-col gap-7 sm:mx-0">
              {g.sections.map((sec) => {
                if (sec.items.length === 0) return null;
                const luoi = masonry.lattice(sec.id, sec.ids);
                const [dau, cuoi] = masonry.range(sec.id);
                const items = sec.items.slice(dau, cuoi);
                return (
                  <section key={sec.id}>
                    {sec.name && (
                      <div className="mb-2 px-4 sm:px-0">
                        <GroupLabel count={`${sec.items.length} ${tr.photoCount}`}>{sec.name}</GroupLabel>
                      </div>
                    )}
                    <div {...luoi}>
                      {items.map(({ p, i }, k) => {
                        const video = isVideo(p);
                        const isSel = g.printing ? pp.picks.has(p.id) : g.selected.has(p.id);
                        const o = masonry.tileProps(sec.id, p.id, dau + k);
                        return (
                          <div key={p.id} ref={o.ref} className="o-anh-cho overflow-hidden" style={{ background: "var(--sf2)", ...o.style }}>
                            <img
                              {...masonry.imgProps(p.id)}
                              src={img.thumb(p.drive_file_id, gridW)}
                              alt={p.name}
                              loading="lazy"
                              decoding="async"
                              draggable={false}
                              role="button"
                              tabIndex={0}
                              aria-label={`Xem ${stripExtension(p.name)}`}
                              onClick={() => g.setLbIdx(i)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  g.setLbIdx(i);
                                }
                              }}
                              onContextMenu={(e) => g.wm && e.preventDefault()}
                              className="block h-full w-full cursor-zoom-in select-none object-cover"
                            />
                            {g.wm && <div className="pointer-events-none absolute inset-0 z-[2] opacity-20" style={watermarkLayer(g.wm)} />}
                            {isSel && <div className="pointer-events-none absolute inset-0 z-[3]" style={{ boxShadow: "inset 0 0 0 3px var(--ac)" }} />}
                            {video && (
                              <span
                                className="pointer-events-none absolute left-1/2 top-1/2 z-[3] flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full"
                                style={{ background: "rgba(10,10,12,.55)", color: "#fff", backdropFilter: "blur(6px)" }}
                              >
                                <Play size={20} fill="currentColor" strokeWidth={0} />
                              </span>
                            )}
                            {g.printing && !video && (
                              <SelectDot
                                on={pp.picks.has(p.id)}
                                disabled={pp.locked}
                                onClick={() => pp.toggle(p.id, !video)}
                                label={pp.picks.has(p.id) ? "Bỏ chọn in ảnh này" : "Chọn in ảnh này"}
                                icon={<Printer size={13} strokeWidth={2.6} />}
                              />
                            )}
                            {!g.shareMode && !g.printing && (
                              <SelectDot
                                on={isSel}
                                onClick={() => g.toggleSelect(p.id)}
                                label={isSel ? "Bỏ chọn ảnh này" : "Chọn ảnh để chia sẻ"}
                                icon={<Check size={15} strokeWidth={3} />}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>

        <FeedbackV2 g={g} />
      </main>

      {/* Đang chọn ảnh in: thanh đáy đếm x/N, lọc, gửi. */}
      {g.printing && <PrintBarV2 pp={pp} />}

      {/* Đã chọn ảnh để chia sẻ. */}
      {sharing && (
        <BottomBar>
          <div className="min-w-0 flex-1">
            <p className="text-[13px]" style={{ color: "var(--tx2)" }}>
              Đã chọn <b className="tnum text-[17px]" style={{ color: "var(--tx)" }}>{g.selected.size}</b> ảnh
            </p>
            <button type="button" onClick={() => g.setSelected(new Set())} className="text-[12.5px] font-semibold" style={{ color: "var(--ac)" }}>
              Bỏ chọn
            </button>
          </div>
          <button type="button" onClick={g.shareSelected} disabled={g.shareBusy} className={btn("primary", "lg", "flex-none")}>
            <Share2 size={16} /> {g.shareBusy ? "Đang tạo link…" : `Chia sẻ ${g.selected.size} ảnh`}
          </button>
        </BottomBar>
      )}

      {/* Nút nổi "Chọn ảnh in" — khách cuộn tới đâu cũng thấy, cho tới khi gửi xong. */}
      {showFab && (
        <div className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4" style={{ bottom: "max(16px, env(safe-area-inset-bottom, 0px))" }}>
          <button type="button" onClick={() => pp.open()} className={btn("primary", "lg", "pointer-events-auto")} style={{ boxShadow: "0 10px 30px rgba(15,30,55,.3)" }}>
            <Printer size={17} />
            {pp.picks.size > 0 ? `Tiếp tục chọn ảnh in (${pp.picks.size}/${pp.quota})` : `Chọn ${pp.quota} ảnh in tặng`}
          </button>
        </div>
      )}

      {lb && g.lbIdx !== null && (
        <ViewerV2
          photo={lb}
          video={isVideo(lb)}
          index={g.lbIdx}
          total={g.visible.length}
          onClose={() => g.setLbIdx(null)}
          onStep={g.go}
          wm={g.wm}
          gridW={gridW}
          fullW={g.fullW}
          reserve={g.shareMode && !g.allowDownload ? 80 : 168}
          actions={<GalleryViewerActions g={g} photo={lb} />}
        />
      )}

      <FaceFinderV2
        open={faceOpen}
        onClose={() => setFaceOpen(false)}
        people={g.people}
        activeId={g.personId}
        onPick={g.setPersonId}
        driveIdOf={g.driveIdOf}
        scan={g.scan}
        search={face}
      />

      <ShareDialog
        url={g.shareUrl}
        title={`Chia sẻ ${g.selected.size} ảnh đã chọn`}
        subtitle="Gửi link này cho người khác — họ sẽ chỉ xem đúng những ảnh bạn đã chọn."
        onClose={() => g.setShareUrl(null)}
      />
    </CustomerRootV2>
  );
}

type GalleryState = ReturnType<typeof useGalleryView>;

/** Khung đáy dính màn hình dùng chung (chia sẻ / ảnh in). */
function BottomBar({ children, below }: { children: React.ReactNode; below?: React.ReactNode }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 sm:bottom-4 sm:px-4">
      <div
        className="pointer-events-auto mx-auto w-full max-w-[640px] px-4 pt-3 sm:rounded-[18px] sm:pb-3"
        style={{
          background: "var(--sf)",
          borderTop: "1px solid var(--bd)",
          boxShadow: "0 -6px 24px -12px rgba(15,30,55,.25), 0 10px 30px -12px rgba(15,30,55,.3)",
          paddingBottom: "max(12px, env(safe-area-inset-bottom, 0px))",
        }}
      >
        <div className="flex items-center gap-3">{children}</div>
        {below}
      </div>
    </div>
  );
}

/** Thẻ "Bạn được tặng N ảnh in" — chữ dùng chung với bản cũ (printCardText). */
function PrintCardV2({ pp, cardRef }: { pp: PrintPicks; cardRef: React.RefObject<HTMLDivElement | null> }) {
  if (!pp.enabled) return null;
  const { title, note, cta } = printCardText(pp);
  return (
    <div ref={cardRef} className="v2-card v2-card-pad flex scroll-mt-20 flex-wrap items-center gap-3">
      <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full" style={{ background: "var(--amS)", color: "var(--am)" }}>
        <Printer size={20} />
      </span>
      <div className="min-w-0 flex-1 basis-56">
        <p className="text-[14.5px] font-semibold">{title}</p>
        <p className="mt-0.5 text-[13px]" style={{ color: "var(--tx2)" }}>
          {note}
        </p>
      </div>
      {!pp.mode && (
        <button type="button" onClick={() => pp.open(pp.locked)} className={btn("soft", "md", "w-full sm:w-auto")}>
          <Printer size={16} /> {cta}
        </button>
      )}
      {pp.msg && !pp.mode && (
        <p className="w-full text-[13px] font-medium" style={{ color: pp.msg.ok ? "var(--gn)" : "var(--rd)" }}>
          {pp.msg.text}
        </p>
      )}
    </div>
  );
}

/** Thanh đáy khi đang chọn ảnh in: đếm x/N, chỉ xem ảnh đã chọn, gửi cho studio. */
function PrintBarV2({ pp }: { pp: PrintPicks }) {
  const full = pp.picks.size >= pp.quota;
  return (
    <BottomBar
      below={
        <>
          <div className="mt-1 -mx-1">
            <Switch checked={pp.onlyPicked} onChange={pp.setOnlyPicked} label="Chỉ xem ảnh đã chọn in" />
          </div>
          {pp.msg && (
            <p className="text-[12.5px] font-medium" style={{ color: pp.msg.ok ? "var(--gn)" : "var(--rd)" }}>
              {pp.msg.text}
            </p>
          )}
        </>
      }
    >
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-1.5 text-[13px]" style={{ color: "var(--tx2)" }}>
          <Printer size={14} className="self-center" style={{ color: "var(--am)" }} /> Ảnh in
          <b className="tnum text-[17px]" style={{ color: full ? "var(--gn)" : "var(--tx)" }}>
            {pp.picks.size}
            <span className="text-[13.5px]" style={{ color: "var(--tx3)" }}>
              /{pp.quota}
            </span>
          </b>
        </p>
        <div className="mt-1.5">
          <Progress value={pp.quota ? (pp.picks.size / pp.quota) * 100 : 0} tone={full ? "green" : "brand"} />
        </div>
      </div>
      <button type="button" onClick={pp.close} aria-label="Đóng chọn ảnh in" className={btn("secondary", "lg", "flex-none")}>
        {pp.locked ? "Đóng" : "Xong"}
      </button>
      {!pp.locked && (
        <button
          type="button"
          onClick={pp.send}
          disabled={pp.busy || pp.picks.size === 0 || (!pp.dirty && !!pp.sentAt)}
          className={btn("primary", "lg", "flex-none")}
        >
          <Send size={16} /> {pp.busy ? "Đang gửi…" : pp.sentAt ? "Gửi lại" : "Gửi studio"}
        </button>
      )}
    </BottomBar>
  );
}

/** Thao tác lớn ở đáy khung xem: Chọn (chia sẻ) / Chọn in · Tải ảnh này. */
function GalleryViewerActions({ g, photo }: { g: GalleryState; photo: NonNullable<GalleryState["visible"][number]> }) {
  const video = isVideo(photo);
  const act = "flex h-[58px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-[14px] text-[12.5px] font-semibold transition-colors active:scale-[.98] disabled:opacity-50";
  const ghost = { background: "rgba(255,255,255,.09)", color: "#fff" };
  const strong = { background: "color-mix(in srgb, var(--ac) 76%, #000)", color: "#fff" };
  const onSoft = { background: "color-mix(in srgb, var(--ac) 26%, transparent)", color: "#fff", boxShadow: "inset 0 0 0 1.5px var(--ac)" };
  const picked = g.printing ? g.pp.picks.has(photo.id) : g.selected.has(photo.id);
  return (
    <div className="flex gap-2">
      {g.printing && !video && (
        <button type="button" onClick={() => g.pp.toggle(photo.id, true)} disabled={g.pp.locked} aria-pressed={picked} className={act} style={picked ? onSoft : ghost}>
          {picked ? <CheckCircle2 size={20} /> : <Printer size={19} />}
          {picked ? `Đã chọn in · ${g.pp.picks.size}/${g.pp.quota}` : "Chọn in ảnh này"}
        </button>
      )}
      {!g.shareMode && !g.printing && (
        <button type="button" onClick={() => g.toggleSelect(photo.id)} aria-pressed={picked} className={act} style={picked ? onSoft : ghost}>
          {picked ? <CheckCircle2 size={20} /> : <Check size={20} strokeWidth={2.6} />}
          {picked ? "Đã chọn" : "Chọn để chia sẻ"}
        </button>
      )}
      {g.allowDownload &&
        (video ? (
          <a href={`https://drive.google.com/file/d/${photo.drive_file_id}/view`} target="_blank" rel="noopener noreferrer" className={act} style={strong}>
            <Download size={19} /> {g.tr.dlPhoto}
          </a>
        ) : (
          <button type="button" onClick={() => downloadImage(photo.drive_file_id, photo.name, g.wm)} className={act} style={strong}>
            <Download size={19} /> {g.tr.dlPhoto}
          </button>
        ))}
    </div>
  );
}

/** Cảm nhận của khách: gửi (có captcha) + những cảm nhận studio đã duyệt. */
function FeedbackV2({ g }: { g: GalleryState }) {
  const { tr } = g;
  return (
    <div className="mt-12">
      <Section title={tr.feedbackTitle} desc="Vài dòng của bạn giúp studio làm tốt hơn." icon={MessageSquareHeart}>
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            {g.fbSent ? (
              <div className="flex items-start gap-3 rounded-[12px] p-4" style={{ background: "var(--gnS)" }}>
                <CheckCircle2 size={20} style={{ color: "var(--gn)", flex: "none" }} />
                <div>
                  <p className="text-[14px] font-semibold" style={{ color: "var(--gn)" }}>
                    {tr.fbThanks}
                  </p>
                  <p className="mt-0.5 text-[13px]" style={{ color: "var(--tx2)" }}>
                    {tr.fbPending}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <Field label="Tên của bạn">
                  <input value={g.fbName} onChange={(e) => g.setFbName(e.target.value)} placeholder={tr.fbNamePh} className={inputCls} style={{ fontSize: 16 }} />
                </Field>
                <div className="flex items-center gap-0.5" role="radiogroup" aria-label="Chấm điểm">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => g.setFbRating(n)}
                      aria-label={`${n} sao`}
                      aria-pressed={n <= g.fbRating}
                      className="flex h-10 w-10 items-center justify-center"
                      style={{ color: n <= g.fbRating ? "var(--am)" : "var(--tx3)" }}
                    >
                      <Star size={24} fill={n <= g.fbRating ? "currentColor" : "none"} strokeWidth={n <= g.fbRating ? 0 : 2} />
                    </button>
                  ))}
                </div>
                <textarea value={g.fbContent} onChange={(e) => g.setFbContent(e.target.value)} placeholder={tr.fbContentPh} className={inputCls} style={{ fontSize: 16 }} rows={4} aria-label={tr.fbContentPh} />
                <Turnstile onVerify={g.onFbCaptcha} onExpire={() => g.setFbCaptcha(null)} onError={() => g.setFbCaptcha(null)} />
                {g.fbErr && (
                  <p className="text-[13px] font-medium" style={{ color: "var(--rd)" }}>
                    {tr.fbErr}
                  </p>
                )}
                <button type="button" onClick={g.sendFeedback} disabled={!g.fbCaptcha || g.fbSending} className={btn("secondary", "md", "self-start")}>
                  <Send size={15} /> {g.fbSending ? tr.fbSending : tr.fbSend}
                </button>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-3">
            {g.fbList.length === 0 ? (
              <p className="text-[13.5px]" style={{ color: "var(--tx3)" }}>
                {tr.fbEmpty}
              </p>
            ) : (
              g.fbList.map((f) => (
                <div key={f.id} className="rounded-[14px] p-4" style={{ background: "var(--sf2)" }}>
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-semibold">{f.client_name || tr.fbGuest}</span>
                    {f.rating ? (
                      <span className="flex items-center gap-0.5" style={{ color: "var(--am)" }} aria-label={`${f.rating} sao`}>
                        {Array.from({ length: f.rating }).map((_, i) => (
                          <Star key={i} size={13} fill="currentColor" strokeWidth={0} />
                        ))}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-[13.5px]" style={{ color: "var(--tx2)" }}>
                    {f.content}
                  </p>
                  {f.reply ? (
                    <div className="mt-2.5 rounded-[10px] px-3 py-2" style={{ background: "var(--sf)", border: "1px solid var(--bd)" }}>
                      <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--tx3)" }}>
                        {tr.fbReply}
                      </p>
                      <p className="mt-0.5 whitespace-pre-wrap text-[13px]">{f.reply}</p>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      </Section>
    </div>
  );
}
