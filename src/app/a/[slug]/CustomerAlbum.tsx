"use client";

import { useEffect, useRef, useState } from "react";
import {
  Heart,
  HeartOff,
  Check,
  Copy,
  Download,
  FileText,
  Lock,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  ListChecks,
  ZoomIn,
  ZoomOut,
  Share2,
  Send,
  Undo2,
  RotateCcw,
} from "lucide-react";
import StudioBrand from "@/components/StudioBrand";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import InstallPwaButton from "@/components/InstallPwaButton";
import ShareDialog from "@/components/ShareDialog";
import { thumbnailUrl, fullImageUrl, originalImageUrl, retryViaProxy, stripExtension } from "@/lib/drive";
import PhotoZoom, { type PhotoZoomHandle } from "@/components/PhotoZoom";
import FaceFinder from "./FaceFinder";
import { syncBadge, type AlbumLedger, type SaveActivity } from "@/lib/album-offline";
import { downloadImage } from "@/lib/download";
import { useMasonry } from "@/lib/masonry";
import { useGridThumbWidth } from "@/lib/use-img-width";
import ZoomHiRes from "@/components/ZoomHiRes";
import { watermarkLayer } from "@/lib/album-watermark";
import { ICON_HALO } from "@/lib/album-icon";
import { ALBUM_TITLE_FONT } from "@/lib/album-title";
import AlbumCover from "@/components/AlbumCover";
import DriveFolderLinks from "@/components/DriveFolderLinks";
import AlbumDuplicateFinder from "./AlbumDuplicateFinder";
import { useCustomerAlbum, type CustomerAlbumProps } from "./useCustomerAlbum";

/* Album chọn ảnh — GIAO DIỆN CŨ. Toàn bộ logic (lưu lựa chọn, đồng bộ, báo
   studio, chia sẻ, khung xem…) nằm ở ./useCustomerAlbum, dùng chung với bản
   giao diện mới ./CustomerAlbumV2. File này chỉ còn phần vẽ. */

export default function CustomerAlbum(props: CustomerAlbumProps) {
  const { album, shareIds, studioName = "Studio", logoUrl = null } = props;
  const {
    t,
    unlocked,
    photos,
    driveFolders,
    people,
    scan,
    personId,
    setPersonId,
    password,
    setPassword,
    pwError,
    pwLoading,
    selected,
    disliked,
    notes,
    view,
    setView,
    selectedOnly,
    dislikedOnly,
    activeTab,
    setActiveTab,
    contentRef,
    scrollToContent,
    lbIdx,
    setLbIdx,
    ledger,
    saveActivity,
    online,
    copied,
    toast,
    notifyingDone,
    doneSent,
    dupGroups,
    setDupGroups,
    hideDupes,
    setHideDupes,
    resetArmed,
    setResetArmed,
    wm,
    shareMode,
    shareUrl,
    setShareUrl,
    shareBusy,
    shareSelected,
    notifyDone,
    limit,
    toggle,
    toggleDislike,
    resetPicks,
    setNote,
    unlock,
    activePerson,
    driveIdOf,
    visiblePhotos,
    lbPhotos,
    tabSources,
    sections,
    copyList,
    exportList,
    closeLightbox,
    openGroup,
    openFromGrid,
    go,
    fullW,
  } = useCustomerAlbum(props);

  // Mức phóng chỉ để bật/tắt nút "thu nhỏ" — cử chỉ (chụm ngón, kéo, vuốt, lăn
  // chuột) do PhotoZoom lo và KHÔNG render lại trang, xem @/components/PhotoZoom.
  const [zoom, setZoom] = useState(1);
  /** Đang tải ảnh gốc cho lúc phóng to (xem ZoomHiRes) → hiện chỉ báo nhỏ. */
  const [hiResLoading, setHiResLoading] = useState(false);
  const zoomRef = useRef<PhotoZoomHandle>(null);
  // Vùng nền của khung xem ảnh — nơi PhotoZoom bắt cử chỉ.
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

  // Đổi ảnh / mở khung xem → về mức phóng 1. Bản thân khung ảnh tự dựng lại
  // (key theo id ảnh) nên đã ở mức 1; đây chỉ là đồng bộ nhãn cho nút bấm.
  useEffect(() => {
    setZoom(1);
    setHiResLoading(false);
  }, [lbIdx]);

  // ── Password gate ──────────────────────────────────────────────
  if (!unlocked) {
    return (
      <main className="flex min-h-screen flex-col">
        <header className="flex items-center justify-between px-6 py-5 md:px-10">
          <StudioBrand name={studioName} logoUrl={logoUrl} />
          <LanguageSwitcher />
        </header>
        <div className="flex flex-1 items-center justify-center px-6">
          <form onSubmit={unlock} className="card w-full max-w-sm p-8 text-center animate-[vkPop_.4s_ease_both]">
            <Lock className="mx-auto mb-4" size={26} style={{ color: "var(--gold)" }} />
            <h1 className="font-serif text-2xl font-medium">{album.title}</h1>
            <p className="mb-6 mt-1 text-sm" style={{ color: "var(--text2)" }}>
              {t("enterPassword")}
            </p>
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input mb-4 text-center"
              placeholder="••••••"
            />
            {pwError && <p className="mb-4 text-sm" style={{ color: "var(--danger)" }}>{t("wrongPassword")}</p>}
            <button disabled={pwLoading} className="btn-primary w-full">
              {pwLoading ? t("loading") : t("enter")}
            </button>
          </form>
        </div>
      </main>
    );
  }

  const lbPhoto = lbIdx !== null ? lbPhotos[lbIdx] : null;

  // ── Gallery ────────────────────────────────────────────────────
  return (
    <main className="min-h-screen pb-32">
      <header
        className="sticky top-0 z-40 flex h-16 items-center gap-3 px-5 md:px-10"
        style={{
          background: "color-mix(in srgb, var(--bg) 80%, transparent)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <StudioBrand name={studioName} logoUrl={logoUrl} />
        <div
          className="ml-auto flex min-w-0 items-center gap-2.5 rounded-full px-3.5 py-1.5 text-[12.5px]"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text2)" }}
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: shareMode ? "var(--gold)" : "#3fbf7f" }} />
          <span className="truncate">
            {shareMode ? `${shareIds!.length} ảnh được chia sẻ` : "Album được chia sẻ · chế độ khách"}
          </span>
        </div>
        {/* Cài album lên màn hình chính. Tự ẩn khi đã cài hoặc khi trình duyệt
            không hỗ trợ, nên không có gì để dọn ở trường hợp thường. Không hiện
            ở chế độ xem link chia sẻ: đó là ảnh của người khác gửi cho xem. */}
        {!shareMode && <InstallPwaButton variant="pill" label="Lưu album" />}
        <LanguageSwitcher />
      </header>

      {/* Ảnh bìa studio đã chọn — chiếm trọn màn hình, tên album ở giữa,
          nút "Xem album" ngay dưới (xem src/components/AlbumCover.tsx). */}
      {album.cover_url && (
        <AlbumCover
          url={album.cover_url}
          title={album.title}
          eyebrow={`${studioName} đã chia sẻ với bạn`}
          buttonLabel="Xem album"
          onView={scrollToContent}
        />
      )}

      <div ref={contentRef} className="mx-auto max-w-[1800px] scroll-mt-16 px-4 pt-7 md:px-6">
        <div className="animate-[vkFade_.5s_ease_both]">
          {!album.cover_url && (
            <>
              <p className="mb-2 text-[12px] uppercase tracking-[0.2em]" style={{ color: "var(--text3)" }}>
                {studioName} đã chia sẻ với bạn
              </p>
              <h1 className="mb-1 text-[clamp(34px,6vw,64px)] leading-[1.06]" style={ALBUM_TITLE_FONT}>
                {album.title}
              </h1>
            </>
          )}
          <p className="text-[13.5px]" style={{ color: "var(--text2)" }}>
            {photos.length} {t("photos")}
            {album.description ? ` · ${album.description}` : ""}
          </p>
        </div>

        {/* Link tabs — switch between Drive sources */}
        {tabSources.length > 1 && (
          <div className="mt-6 flex flex-wrap gap-2">
            <button
              onClick={() => setActiveTab("all")}
              className="rounded-full px-4 py-1.5 text-[13px] transition-colors"
              style={activeTab === "all" ? { background: "var(--accent)", color: "var(--accentInk)" } : { background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text2)" }}
            >
              Tất cả
            </button>
            {tabSources.map((s) => {
              // Số hiển thị đúng bằng số ảnh tab đó đang cho xem: chế độ thường ẩn
              // ảnh không thích, tab "Không thích" chỉ đếm ảnh bị loại.
              const n = photos.filter(
                (p) => p.source_id === s.id && (dislikedOnly ? disliked.has(p.id) : !disliked.has(p.id))
              ).length;
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveTab(s.id)}
                  className="rounded-full px-4 py-1.5 text-[13px] transition-colors"
                  style={activeTab === s.id ? { background: "var(--accent)", color: "var(--accentInk)" } : { background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text2)" }}
                >
                  {s.name}
                  <span className="ml-1.5 opacity-60">{n}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* TÌM ẢNH THEO KHUÔN MẶT.
            Máy chủ đã quét & gom sẵn (cron /api/cron/face-scan), nên bấm một mặt
            chỉ là tra bảng. Cả đường "gửi ảnh của bạn" cũng không tải mô hình về
            máy khách nữa — máy chủ so hộ. Đúng câu mà cả nhà hỏi khi mở album —
            "ảnh của mẹ đâu?" — mà trước đây phải cuộn tay qua bảy trăm tấm. */}
        <FaceFinder
          people={people}
          activeId={personId}
          onPick={setPersonId}
          driveIdOf={driveIdOf}
          slug={album.slug}
          password={password}
          scan={scan}
        />
        {activePerson && (
          <p className="mt-2 text-[12.5px]" style={{ color: "var(--text3)" }}>
            {t("personHint")}
          </p>
        )}

        {/* Sticky toolbar */}
        <div
          className={`sticky top-[64px] z-20 mt-6 mb-7 flex flex-wrap items-center gap-2.5 rounded-2xl p-3 animate-[vkFade_.5s_ease_both]${shareMode ? " justify-between" : ""}`}
          style={{
            background: "color-mix(in srgb, var(--bg2) 86%, transparent)",
            backdropFilter: "blur(16px)",
            border: "1px solid var(--border)",
          }}
        >
          {shareMode ? (
            <span className="flex items-center gap-2 text-[13px] font-medium" style={{ color: "var(--gold)" }}>
              <Share2 size={14} /> {shareIds!.length} ảnh được chia sẻ
            </span>
          ) : (
            <>
              {/* Bộ lọc: CHỈ biểu tượng + số lượng. Tên đầy đủ hiện khi rê chuột
                  (title) để người dùng vẫn biết nút làm gì. */}
              <div className="flex flex-col">
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => setView((v) => (v === "selected" ? "all" : "selected"))}
                    title={selectedOnly ? t("viewingSelected") : t("selectedCount")}
                    aria-label={selectedOnly ? t("viewingSelected") : t("selectedCount")}
                    aria-pressed={selectedOnly}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors"
                    style={
                      selectedOnly
                        ? { background: "var(--accent)", color: "var(--accentInk)", border: "1px solid var(--accent)" }
                        : { background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)" }
                    }
                  >
                    <Heart size={15} fill={selectedOnly ? "currentColor" : "none"} />
                    <span className="tabular-nums">{selected.size}</span>
                  </button>
                  {/* Tab riêng cho ảnh không thích — chỉ hiện khi khách đã loại ảnh nào. */}
                  {(disliked.size > 0 || dislikedOnly) && (
                    <button
                      onClick={() => setView((v) => (v === "disliked" ? "all" : "disliked"))}
                      title={t("dislikedCount")}
                      aria-label={t("dislikedCount")}
                      aria-pressed={dislikedOnly}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors"
                      style={
                        dislikedOnly
                          ? { background: "var(--danger)", color: "#fff", border: "1px solid var(--danger)" }
                          : { background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)" }
                      }
                    >
                      <HeartOff size={15} />
                      <span className="tabular-nums">{disliked.size}</span>
                    </button>
                  )}
                </div>
                {/* Số lượng ảnh nằm ngay dưới cụm biểu tượng, không chen ngang hàng. */}
                <span className="mt-1 flex flex-wrap items-center gap-2 text-[12px]" style={{ color: "var(--text3)" }}>
                  {dislikedOnly
                    ? `${disliked.size} ảnh không thích`
                    : selectedOnly
                      ? `${selected.size} ảnh đã chọn`
                      : /* Số ảnh phải là số khách ĐANG THẤY. Đang lọc theo một người mà
                           vẫn báo tổng cả album thì con số đó nói về một lưới khác. Phần
                           "đã chọn" thì vẫn tính cả album — hạn chọn ảnh áp cho cả album,
                           không phải cho từng người. */
                        `${selected.size}${limit != null ? `/${limit}` : ""} đã chọn · ${
                          activePerson
                            ? `${activePerson.photoIds.filter((id) => !disliked.has(id)).length} ảnh của ${activePerson.name}`
                            : `${photos.length - disliked.size} ảnh`
                        }`}
                  <SyncPill ledger={ledger} activity={saveActivity} online={online} />
                </span>
              </div>
            </>
          )}

          <div className="flex-1" />

          {/* Tải cả album từ Drive. Ẩn ở chế độ chia sẻ chọn lọc: link Drive mở
              CẢ thư mục nên sẽ lộ toàn album chứ không riêng mấy ảnh được chia sẻ. */}
          {!shareMode && album.allowDrive && driveFolders.length > 0 && (
            <DriveFolderLinks
              folders={driveFolders}
              label={t("driveFolderPick")}
              labelOne={t("driveFolder")}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--text)] transition-colors"
            />
          )}
          {/* Thao tác phụ trên danh sách đã chọn gom vào MỘT menu "Tác vụ" cho
              thanh công cụ gọn: chép danh sách · xuất .txt · chia sẻ. Riêng nút
              "Báo studio" để hẳn bên ngoài vì đó là việc chính khách cần làm. */}
          {!shareMode && (
            <TaskMenu
              items={[
                {
                  key: "copy",
                  icon: copied ? <Check size={15} /> : <Copy size={15} />,
                  label: copied ? t("copied") : t("copyList"),
                  onClick: copyList,
                  disabled: selected.size === 0,
                },
                {
                  key: "export",
                  icon: <FileText size={15} />,
                  label: t("exportList"),
                  onClick: exportList,
                  disabled: selected.size === 0,
                },
                {
                  key: "share",
                  icon: <Share2 size={15} />,
                  label: shareBusy ? "Đang tạo link…" : "Chia sẻ ảnh đã chọn",
                  onClick: shareSelected,
                  disabled: selected.size === 0 || shareBusy,
                },
                {
                  key: "reset",
                  icon: <RotateCcw size={15} />,
                  label: t("resetPicks"),
                  onClick: () => setResetArmed(true),
                  disabled: selected.size === 0 && disliked.size === 0,
                  danger: true,
                },
              ]}
            />
          )}
          {/* Báo studio đã chọn xong — CTA chính, để riêng ngoài menu cho dễ thấy. */}
          {!shareMode && (selected.size > 0 || disliked.size > 0) && (
            <button
              onClick={notifyDone}
              disabled={notifyingDone}
              className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-semibold transition-colors disabled:opacity-50"
              style={
                doneSent
                  ? { background: "var(--success)", color: "#04150d", border: "1px solid var(--success)" }
                  : { background: "var(--accent)", color: "var(--accentInk)", border: "1px solid var(--accent)" }
              }
            >
              {doneSent ? <Check size={15} /> : <Send size={15} />}
              {notifyingDone ? "Đang gửi…" : doneSent ? "Báo lại studio" : "Đã chọn xong · Báo studio"}
            </button>
          )}
        </div>

        {/* Xác nhận bỏ chọn tất cả. Hai bước chứ không một: xoá cả buổi chiều
            ngồi chọn ảnh cưới bằng một cú bấm nhầm là thứ không có đường lùi —
            sổ trên máy ghi đè ngay, và bản trên máy chủ bị đè ở lượt lưu kế tiếp.
            Nói RÕ SỐ sắp mất, chứ không hỏi chung chung "bạn chắc chứ?". */}
        {resetArmed && (
          <div
            className="mb-4 flex flex-wrap items-center gap-2.5 rounded-[12px] px-4 py-3"
            style={{ background: "var(--surface)", border: "1px solid var(--danger)" }}
          >
            <span className="flex-1 text-[13px]" style={{ color: "var(--text)" }}>
              {t("resetAsk")} <b>{selected.size}</b> {t("resetAskSelected")}
              {disliked.size > 0 && (
                <> · <b>{disliked.size}</b> {t("resetAskDisliked")}</>
              )}
            </span>
            <button
              onClick={() => setResetArmed(false)}
              className="rounded-lg px-3 py-2 text-[13px] font-semibold"
              style={{ background: "var(--surface2)", color: "var(--text2)" }}
            >
              {t("cancel")}
            </button>
            <button
              onClick={resetPicks}
              className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-bold"
              style={{ background: "var(--danger)", color: "#fff" }}
            >
              <RotateCcw size={15} /> {t("resetConfirm")}
            </button>
          </div>
        )}

        {/* Gợi ý ảnh na ná nhau. Chỉ hiện ở tab "tất cả" và khi album đủ nhiều
            ảnh để có chuyện trùng — album 12 tấm đã là bản studio lọc sẵn, thêm
            một khối công cụ vào đó chỉ làm khách phân tâm. Chế độ xem link chia
            sẻ cũng không cần: đó là một tập ảnh khách đã chọn xong. */}
        {!shareMode && view === "all" && photos.length >= 24 && (
          <AlbumDuplicateFinder
            photos={photos}
            selected={selected}
            disliked={disliked}
            groups={dupGroups}
            onGroups={(g) => {
              setDupGroups(g);
              // Quét xong và CÓ nhóm → ẩn bớt bản trùng ngay: đó đúng là thứ
              // khách vừa bấm nút để có. Chỉ ẩn khỏi lưới, không đụng vào lựa
              // chọn, và có công tắc tắt ngay trong khối gợi ý.
              setHideDupes(!!g && g.length > 0);
            }}
            hide={hideDupes}
            onHide={setHideDupes}
            onToggle={toggle}
            onOpen={openGroup}
          />
        )}

        {/* Empty filtered state */}
        {visiblePhotos.length === 0 ? (
          <div className="py-20 text-center animate-[vkFade_.4s_ease_both]" style={{ color: "var(--text3)" }}>
            <p className="mb-1.5 font-serif text-2xl" style={{ color: "var(--text2)" }}>
              {dislikedOnly
                ? t("noDislikedPhotos")
                : selectedOnly
                  ? t("noSelectedPhotos")
                  : photos.length === 0
                    ? "Album chưa có ảnh nào"
                    : disliked.size > 0
                      ? "Mọi ảnh ở đây đã được đánh dấu không thích"
                      : t("loading")}
            </p>
          </div>
        ) : (
          // Sections — each Drive source shown separately, left-to-right
          <div ref={masonry.ref} className="space-y-9">
            {sections.map((sec) => {
              if (sec.items.length === 0) return null;
              // Chỉ dựng phần ô đang nằm quanh khung nhìn (xem @/lib/masonry).
              // Khai báo lưới TRƯỚC rồi mới hỏi khoảng: hỏi trước thì lượt dựng
              // đầu chưa có lưới nào để trả lời, album hiện ra trống một nhịp.
              const luoi = masonry.lattice(sec.id, sec.ids);
              const [dau, cuoi] = masonry.range(sec.id);
              const items = sec.items.slice(dau, cuoi);
              return (
              <section key={sec.id}>
                {sec.name && (
                  <h2 className="mb-3 font-serif text-xl font-medium">
                    {sec.name}
                    <span className="ml-2 text-[13px] font-normal" style={{ color: "var(--text3)" }}>
                      · {sec.items.length} ảnh
                    </span>
                  </h2>
                )}
                {/* Lưới ảnh kiểu collage: 2 cột trên điện thoại, 4 cột trên máy
                    tính, khe gần như bằng 0, KHÔNG bo góc và KHÔNG cắt ảnh —
                    mỗi tấm giữ đúng tỉ lệ gốc, và ảnh được đặt lần lượt
                    TRÁI → PHẢI (xem src/lib/masonry.ts). */}
                <div {...luoi}>
            {items.map(({ p, idx }, k) => {
              const isSel = selected.has(p.id);
              const isDis = disliked.has(p.id);
              const note = notes[p.id];
              const o = masonry.tileProps(sec.id, p.id, dau + k);
              return (
                <div
                  key={p.id}
                  ref={o.ref}
                  className="o-anh-cho overflow-hidden animate-[vkPop_.45s_ease_both]"
                  style={{ background: "var(--surface)", ...o.style }}
                >
                  <div className="relative h-full w-full">
                    <div
                      className="pointer-events-none absolute inset-0 z-[3]"
                      style={
                        isDis
                          ? { boxShadow: "inset 0 0 0 2px var(--danger)" }
                          : isSel
                            ? { boxShadow: "inset 0 0 0 2px var(--gold)" }
                            : undefined
                      }
                    />
                    <img
                      src={thumbnailUrl(p.drive_file_id, gridW)}
                      alt={p.name}
                      loading="lazy"
                      decoding="async"
                      draggable={false}
                      role="button"
                      tabIndex={0}
                      aria-label={`Xem ảnh ${stripExtension(p.name)}`}
                      onClick={() => openFromGrid(idx)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openFromGrid(idx);
                        }
                      }}
                      onContextMenu={(e) => wm && e.preventDefault()}
                      className="block h-full w-full cursor-zoom-in select-none object-cover"
                      {...masonry.imgProps(p.id)}
                    />
                    {wm && (
                      <div className="pointer-events-none absolute inset-0 z-[2] opacity-20" style={watermarkLayer(wm)} />
                    )}
                    {/* heart select — large tap target for mobile. Ảnh đang ở mục
                        không thích thì chỉ còn nút hoàn tác, không cho thích luôn. */}
                    {!shareMode && !isDis && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggle(p.id);
                        }}
                        title={isSel ? t("deselect") : t("selectThis")}
                        aria-label={isSel ? t("deselect") : t("selectThis")}
                        aria-pressed={isSel}
                        className="absolute right-1 top-1 z-[4] flex h-7 w-7 items-center justify-center transition-transform active:scale-90"
                        style={{ color: isSel ? "var(--gold)" : "#fff", filter: ICON_HALO }}
                      >
                        <Heart size={16} fill={isSel ? "currentColor" : "none"} strokeWidth={isSel ? 0 : 2.2} />
                      </button>
                    )}
                    {/* Không thích (góc trái) — bấm là ảnh ẩn khỏi lưới, sang tab
                        riêng. Ở tab "Không thích" nút này thành hoàn tác. */}
                    {!shareMode && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleDislike(p.id);
                        }}
                        title={isDis ? t("undislike") : t("dislikeThis")}
                        aria-label={isDis ? t("undislike") : t("dislikeThis")}
                        className="absolute left-1 top-1 z-[4] flex h-7 w-7 items-center justify-center transition-transform active:scale-90"
                        style={{ color: isDis ? "var(--danger)" : "#fff", filter: ICON_HALO }}
                      >
                        {isDis ? <Undo2 size={16} /> : <HeartOff size={16} strokeWidth={2.2} />}
                      </button>
                    )}

                    {/* Ghi chú: trước là một dải chữ dưới mỗi ảnh làm lưới rời
                        rạc. Giờ chỉ còn biểu tượng nhỏ ở góc — bấm mở ảnh lớn để
                        viết; sáng màu vàng khi ảnh đã có ghi chú. */}
                    {album.allowNotes && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openFromGrid(idx);
                        }}
                        title={note?.trim() || "Thêm ghi chú"}
                        aria-label={note?.trim() ? `Ghi chú: ${note.trim()}` : "Thêm ghi chú"}
                        className="absolute bottom-1 left-1 z-[4] flex h-7 w-7 items-center justify-center transition-transform active:scale-90"
                        style={{ color: note?.trim() ? "var(--gold)" : "#fff", filter: ICON_HALO }}
                      >
                        <FileText size={15} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
                </div>
              </section>
              );
            })}

            {/* CUỐI ALBUM — chỗ khách tìm sau khi xem xong và muốn giữ file gốc.
                Nút cùng việc trên thanh công cụ dễ bị bỏ qua giữa mấy nút chọn
                ảnh, mà lúc khách nghĩ tới "tải về" thì họ đang ở dưới đáy.
                Link Drive: Google tự nén và tự phục vụ nên không byte nào đi qua
                Vercel/Supabase (xem DriveFolderLinks). Ẩn ở chế độ chia sẻ chọn
                lọc vì link mở CẢ thư mục, sẽ lộ toàn album. */}
            {!shareMode && album.allowDrive && driveFolders.length > 0 && (
              <div
                className="mt-14 rounded-2xl px-5 py-6 text-center"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <p className="text-[15px] font-semibold">{t("originalTitle")}</p>
                <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed" style={{ color: "var(--text2)" }}>
                  {t("originalHint")}
                </p>
                <div className="mt-4 flex justify-center">
                  <DriveFolderLinks
                    folders={driveFolders}
                    label={t("driveFolderPick")}
                    labelOne={t("driveFolder")}
                    className="btn-primary px-4 py-2 text-[13.5px]"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lbPhoto && lbIdx !== null && (
        <div
          className="fixed inset-0 z-[80] flex flex-col animate-[vkOverlay_.3s_ease_both]"
          style={{
            background: "rgba(6,6,8,.93)",
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
          } as React.CSSProperties}
        >
          <div className="flex flex-shrink-0 items-center gap-3 px-4 py-3.5 md:px-7" style={{ borderBottom: "1px solid var(--border)" }}>
            <span className="text-[13px]" style={{ color: "var(--text2)" }}>
              {lbIdx + 1} / {lbPhotos.length}
            </span>
            <div className="flex-1" />
            {album.allowDownload && (
              <button
                type="button"
                onClick={() => downloadImage(lbPhoto.drive_file_id, lbPhoto.name, wm)}
                title={t("downloadPhoto")}
                aria-label={t("downloadPhoto")}
                className="flex h-10 w-10 items-center justify-center rounded-lg"
                style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text2)" }}
              >
                <Download size={17} />
              </button>
            )}
            <button onClick={() => zoomRef.current?.zoomBy(1 / 1.5)} disabled={zoom <= 1} title="Thu nhỏ" className="flex h-10 w-10 items-center justify-center rounded-lg disabled:opacity-40" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text2)" }}>
              <ZoomOut size={17} />
            </button>
            <button onClick={() => zoomRef.current?.zoomBy(1.5)} title="Phóng to" className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text2)" }}>
              <ZoomIn size={17} />
            </button>
            <button
              onClick={closeLightbox}
              aria-label="Đóng"
              className="flex h-10 w-10 items-center justify-center rounded-lg"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}
            >
              <X size={17} />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
            <div ref={lbStage} className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-1 md:p-4">
              {hiResLoading && (
              <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full px-3 py-1 text-[12px]" style={{ background: "rgba(0,0,0,.6)", color: "#fff" }}>
                Đang tải ảnh gốc…
              </div>
            )}
              <button
                onClick={() => setLbIdx(Math.max(0, lbIdx - 1))}
                disabled={lbIdx === 0}
                aria-label="Ảnh trước"
                className="absolute left-0 top-1/2 z-10 flex h-16 w-11 -translate-y-1/2 items-center justify-center transition-opacity disabled:pointer-events-none disabled:opacity-20 md:w-14"
                style={{ color: "#fff", filter: "drop-shadow(0 2px 6px rgba(0,0,0,.8))" }}
              >
                <ChevronLeft size={34} strokeWidth={1.6} />
              </button>
              {/* Khung ngoài KHÔNG bị transform, nên kích thước của nó bằng đúng
                  ảnh ở mức thu phóng 1 — hai nút vì thế dính đúng GÓC ẢNH, và
                  không phóng to/thu nhỏ theo khi khách zoom ảnh. */}
              <div className="relative inline-flex">
                <PhotoZoom
                  key={lbPhoto.id}
                  ref={zoomRef}
                  stageRef={lbStage}
                  onSwipe={go}
                  onZoomChange={setZoom}
                  className="relative inline-flex"
                >
                  <img
                    key={lbPhoto.id}
                    src={fullImageUrl(lbPhoto.drive_file_id, fullW)}
                    alt={lbPhoto.name}
                    draggable={false}
                    decoding="async"
                    onError={retryViaProxy}
                    onContextMenu={(e) => wm && e.preventDefault()}
                    className="max-h-[calc(100dvh-232px)] max-w-full select-none rounded object-contain md:max-h-[80vh]"
                    style={{
                      boxShadow: "0 30px 80px rgba(0,0,0,.6)",
                      // Show the cached grid thumbnail behind while the full image
                      // decodes, so the picture changes immediately on prev/next.
                      backgroundImage: `url(${thumbnailUrl(lbPhoto.drive_file_id, gridW)})`,
                      backgroundSize: "contain",
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: "center",
                    }}
                  />
                  <ZoomHiRes srcs={[originalImageUrl(lbPhoto.drive_file_id), fullImageUrl(lbPhoto.drive_file_id, 4096), `${fullImageUrl(lbPhoto.drive_file_id, 2560)}&raw=1`]} active={zoom > 1} onLoadingChange={setHiResLoading} className="rounded" />
                  {wm && (
                    <div className="pointer-events-none absolute inset-0 flex flex-wrap content-center items-center justify-center gap-x-12 gap-y-10 overflow-hidden opacity-30">
                      {Array.from({ length: 16 }).map((_, i) => (
                        <span key={i} className="rotate-[-30deg] whitespace-nowrap text-base font-semibold tracking-widest text-white drop-shadow">
                          {wm}
                        </span>
                      ))}
                    </div>
                  )}
                </PhotoZoom>
                {/* Không thích (góc trái) và thích (góc phải) — cùng vị trí với
                    lưới ảnh bên ngoài để khách chỉ phải học một chỗ. */}
                {!shareMode && (
                  <button
                    onClick={() => toggleDislike(lbPhoto.id)}
                    title={disliked.has(lbPhoto.id) ? t("undislike") : t("dislikeThis")}
                    aria-label={disliked.has(lbPhoto.id) ? t("undislike") : t("dislikeThis")}
                    aria-pressed={disliked.has(lbPhoto.id)}
                    className="absolute left-1.5 top-1.5 z-20 flex h-10 w-10 items-center justify-center transition-transform active:scale-90"
                    style={{ color: disliked.has(lbPhoto.id) ? "var(--danger)" : "#fff", filter: ICON_HALO }}
                  >
                    {disliked.has(lbPhoto.id) ? <Undo2 size={24} /> : <HeartOff size={24} strokeWidth={2.2} />}
                  </button>
                )}
                {!shareMode && !disliked.has(lbPhoto.id) && (
                  <button
                    onClick={() => toggle(lbPhoto.id)}
                    title={selected.has(lbPhoto.id) ? t("deselect") : t("selectThis")}
                    aria-label={selected.has(lbPhoto.id) ? t("deselect") : t("selectThis")}
                    aria-pressed={selected.has(lbPhoto.id)}
                    className="absolute right-1.5 top-1.5 z-20 flex h-10 w-10 items-center justify-center transition-transform active:scale-90"
                    style={{ color: selected.has(lbPhoto.id) ? "var(--gold)" : "#fff", filter: ICON_HALO }}
                  >
                    <Heart size={24} fill={selected.has(lbPhoto.id) ? "currentColor" : "none"} strokeWidth={selected.has(lbPhoto.id) ? 0 : 2.4} />
                  </button>
                )}
              </div>
              {/* Điện thoại: nhấn giữ ảnh là Safari/Chrome lưu thẳng vào thư
                  viện Ảnh của máy — không tốn thêm băng thông vì ảnh đã tải sẵn.
                  Chỉ hiện trên máy cảm ứng (hover:none) và khi album KHÔNG bật
                  watermark: watermark là lớp phủ, nhấn giữ sẽ lấy được ảnh sạch
                  nên thao tác đó đang bị chặn có chủ đích. */}
              {album.allowDownload && !wm && (
                <p
                  className="pointer-events-none absolute inset-x-0 bottom-1 hidden px-4 text-center text-[11.5px] [@media(hover:none)]:block"
                  style={{ color: "rgba(255,255,255,.55)" }}
                >
                  {t("saveToPhotosHint")}
                </p>
              )}
              <button
                onClick={() => setLbIdx(Math.min(lbPhotos.length - 1, lbIdx + 1))}
                disabled={lbIdx >= lbPhotos.length - 1}
                aria-label="Ảnh sau"
                className="absolute right-0 top-1/2 z-10 flex h-16 w-11 -translate-y-1/2 items-center justify-center transition-opacity disabled:pointer-events-none disabled:opacity-20 md:w-14"
                style={{ color: "#fff", filter: "drop-shadow(0 2px 6px rgba(0,0,0,.8))" }}
              >
                <ChevronRight size={34} strokeWidth={1.6} />
              </button>
            </div>

            {album.allowNotes && (
              <aside
                className="flex w-full flex-none flex-col gap-2 border-t p-3 md:w-[340px] md:gap-4 md:overflow-y-auto md:border-l md:border-t-0 md:p-7"
                style={{ borderColor: "var(--border)" }}
              >
                <div>
                  <h3 className="flex items-center gap-2 text-[15px] font-semibold">
                    <FileText size={16} style={{ color: "var(--gold)" }} /> {t("note")}
                  </h3>
                  <p className="mt-1 hidden text-[12.5px] leading-relaxed md:block" style={{ color: "var(--text3)" }}>
                    {disliked.has(lbPhoto.id)
                      ? "Cho studio biết vì sao bạn không thích ảnh này (tuỳ chọn)."
                      : "Để lại ghi chú để studio biết bạn muốn chỉnh sửa gì cho ảnh này."}
                  </p>
                </div>
                {/* Ô nhập để lộ hẳn ra: viền vàng khi CHƯA có ghi chú nên khách
                    nhìn là biết gõ được vào đây, không phải đoán. */}
                <textarea
                  value={notes[lbPhoto.id] ?? ""}
                  onChange={(e) => setNote(lbPhoto.id, e.target.value)}
                  placeholder="Viết ghi chú cho ảnh này…"
                  rows={2}
                  className="min-h-[54px] w-full resize-y rounded-xl px-3.5 py-2.5 text-sm outline-none md:min-h-[110px] md:py-3"
                  style={{
                    background: "var(--surface)",
                    border: notes[lbPhoto.id]?.trim() ? "1px solid var(--border)" : "1.5px solid var(--gold)",
                    color: "var(--text)",
                  }}
                />
                <div className="mt-auto hidden border-t pt-4 md:block" style={{ borderColor: "var(--border)" }}>
                  <div className="flex items-center gap-2.5 text-[13px]" style={{ color: "var(--text2)" }}>
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{
                        background: disliked.has(lbPhoto.id)
                          ? "var(--danger)"
                          : selected.has(lbPhoto.id)
                            ? "#3fbf7f"
                            : "var(--text3)",
                      }}
                    />
                    {disliked.has(lbPhoto.id)
                      ? "Ảnh này đã chuyển sang mục Không thích"
                      : selected.has(lbPhoto.id)
                        ? "Ảnh này đã được chọn"
                        : "Ảnh chưa được chọn"}
                  </div>
                </div>
              </aside>
            )}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-8 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-2.5 rounded-xl px-5 py-3.5 animate-[vkToast_.35s_ease_both]"
          style={{ background: "var(--surface2)", border: "1px solid var(--border2)", boxShadow: "0 20px 60px rgba(0,0,0,.5)" }}
        >
          <span className="h-2 w-2 rounded-full" style={{ background: "#3fbf7f" }} />
          <span className="text-sm font-medium">{toast}</span>
        </div>
      )}

      <ShareDialog
        url={shareUrl}
        title={`Chia sẻ ${selected.size} ảnh đã chọn`}
        subtitle="Gửi link này — người nhận sẽ chỉ xem đúng những ảnh bạn đã chọn."
        onClose={() => setShareUrl(null)}
      />
    </main>
  );
}

/**
 * Menu "Tác vụ" — gom chép danh sách / xuất danh sách / chia sẻ / báo studio vào
 * một nút thả xuống. Trước đây bốn nút này nằm rời trên thanh công cụ và tràn
 * hàng trên điện thoại.
 */
type TaskItem = {
  key: string;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  accent?: boolean;
  /** Thao tác XOÁ — vẽ màu cảnh báo để không bấm nhầm giữa các mục lành tính. */
  danger?: boolean;
};

/**
 * VIÊN TRẠNG THÁI LƯU — thứ khách cần thấy nhất trên trang này.
 *
 * Album chọn ảnh được mở trên điện thoại, thường ở nơi mạng kém. Trước đây trang
 * không nói gì cả: mất mạng thì lượt bấm im lặng bay mất, khách chỉ phát hiện ra
 * ở lần mở lại. Giờ mọi lượt bấm đã nằm trên máy, nên viên này chỉ còn việc nói
 * thật về việc studio đã nhận chưa. Chữ và tông do @/lib/album-offline quyết
 * (kiểm thử ở desktop/test/album-offline.mjs) — ở đây chỉ vẽ.
 */
function SyncPill({ ledger, activity, online }: { ledger: AlbumLedger; activity: SaveActivity; online: boolean }) {
  const badge = syncBadge(ledger, activity, online);
  const tone =
    badge.tone === "ok"
      ? { dot: "var(--success)", fg: "var(--text2)" }
      : badge.tone === "wait"
        ? { dot: "var(--gold)", fg: "var(--gold)" }
        : { dot: "var(--text3)", fg: "var(--text2)" };
  return (
    <span
      title={badge.detail}
      aria-live="polite"
      className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold"
      style={{ background: "var(--surface)", border: "1px solid var(--border)", color: tone.fg }}
    >
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full${badge.tone === "busy" ? " animate-pulse" : ""}`}
        style={{ background: tone.dot }}
      />
      {badge.text}
    </span>
  );
}

function TaskMenu({ items }: { items: TaskItem[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Tác vụ"
        className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-semibold transition-colors"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}
      >
        <ListChecks size={15} /> Tác vụ
        <ChevronDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full z-50 mt-2 min-w-[250px] max-w-[80vw] rounded-xl p-1.5 shadow-xl"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            {items.map((it) => (
              <button
                key={it.key}
                onClick={() => {
                  setOpen(false);
                  it.onClick();
                }}
                disabled={it.disabled}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] transition-colors hover:bg-[var(--surface2)] disabled:opacity-40 disabled:hover:bg-transparent"
                style={{
                  color: it.danger ? "var(--danger)" : it.accent ? "var(--accent)" : "var(--text)",
                  fontWeight: it.accent || it.danger ? 700 : 500,
                }}
              >
                <span className="flex-shrink-0">{it.icon}</span>
                <span className="truncate">{it.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
