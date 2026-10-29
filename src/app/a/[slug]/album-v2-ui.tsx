"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Lock, X, ZoomIn, ZoomOut } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { fullImageUrl, originalImageUrl, retryViaProxy, stripExtension, thumbnailUrl } from "@/lib/drive";
import { ALBUM_TITLE_FONT, ALBUM_TITLE_ON_COVER } from "@/lib/album-title";
import { watermarkLayer } from "@/lib/album-watermark";
import PhotoZoom, { type PhotoZoomHandle } from "@/components/PhotoZoom";
import ZoomHiRes from "@/components/ZoomHiRes";
import { CustomerHeaderV2, CustomerRootV2 } from "@/components/v2/customer";
import { btn, iconBtn, inputCls } from "@/components/v2/kit";
import { Segmented } from "@/components/v2/kit-client";
import type { StudioBrandInfo } from "@/lib/studio-brand";

/* ═══════════════════════════════════════════════════════════════════════════
   MẢNH GIAO DIỆN MỚI dùng chung cho hai trang album của khách:
   /a/[slug] (chọn ảnh — CustomerAlbumV2) và /album/[slug] (giao khách —
   GalleryViewV2). Chỉ có phần VẼ; logic ở các hook use*.ts cạnh file.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── Địa chỉ ảnh ─────────────────────────────────────────────────────────── */
/**
 * Mọi địa chỉ ảnh của bản V2 đi qua đây thay vì gọi thẳng @/lib/drive. Trên
 * trang thật nó CHÍNH LÀ ba hàm của @/lib/drive; màn xem trước (không có mạng,
 * không có Drive) bọc <AlbumImgProvider> để trả ảnh SVG dựng sẵn.
 */
export type AlbumImg = {
  thumb: (driveId: string, w: number) => string;
  full: (driveId: string, w: number) => string;
  original: (driveId: string) => string;
};
const DRIVE_IMG: AlbumImg = { thumb: thumbnailUrl, full: fullImageUrl, original: originalImageUrl };
const ImgCtx = createContext<AlbumImg>(DRIVE_IMG);
export function AlbumImgProvider({ value, children }: { value: AlbumImg; children: React.ReactNode }) {
  return <ImgCtx.Provider value={value}>{children}</ImgCtx.Provider>;
}
export const useAlbumImg = () => useContext(ImgCtx);

/* ── Chọn ngôn ngữ (VI / EN) ─────────────────────────────────────────────── */
export function LangToggleV2() {
  const { lang, setLang, t } = useLang();
  return (
    <Segmented
      size="sm"
      label={t("language")}
      value={lang}
      onChange={setLang}
      options={[
        { value: "vi", label: "VI" },
        { value: "en", label: "EN" },
      ]}
    />
  );
}

/* ── Ảnh bìa / tiêu đề album ─────────────────────────────────────────────── */
/**
 * Có ảnh bìa: dải ảnh tràn mép, cao vừa đủ (không còn chiếm trọn màn hình như
 * bản cũ) để khách thấy ngay lưới ảnh và thanh chọn ảnh bên dưới. Không có ảnh
 * bìa: khối tiêu đề gọn trong cột nội dung.
 */
export function AlbumHeroV2({
  cover,
  title,
  eyebrow,
  meta,
}: {
  cover?: string | null;
  title: string;
  eyebrow?: React.ReactNode;
  meta?: React.ReactNode;
}) {
  if (cover) {
    return (
      <section className="relative h-[clamp(250px,42svh,400px)] w-full overflow-hidden sm:h-[clamp(320px,56svh,600px)]" style={{ background: "#111" }}>
        <img src={cover} alt={title} className="absolute inset-0 h-full w-full object-cover" />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to bottom, rgba(0,0,0,.18), rgba(0,0,0,0) 28%, rgba(0,0,0,.08) 52%, rgba(0,0,0,.66))" }}
        />
        <div className="absolute inset-x-0 bottom-0">
          <div className="mx-auto w-full max-w-[1080px] px-4 pb-6 sm:pb-9">
            {eyebrow ? (
              <p className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.16em]" style={{ color: "rgba(255,255,255,.88)", textShadow: "0 1px 8px rgba(0,0,0,.6)" }}>
                {eyebrow}
              </p>
            ) : null}
            <h1 className="max-w-[20ch] text-[clamp(28px,5.4vw,52px)] leading-[1.08]" style={ALBUM_TITLE_ON_COVER}>
              {title}
            </h1>
            {meta ? (
              <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-medium" style={{ color: "rgba(255,255,255,.9)", textShadow: "0 1px 8px rgba(0,0,0,.6)" }}>
                {meta}
              </div>
            ) : null}
          </div>
        </div>
      </section>
    );
  }
  return (
    <div className="mx-auto w-full max-w-[1080px] px-4 pt-6 sm:pt-8">
      {eyebrow ? (
        <p className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--tx3)" }}>
          {eyebrow}
        </p>
      ) : null}
      <h1 className="text-[clamp(26px,5vw,44px)] leading-[1.1]" style={ALBUM_TITLE_FONT}>
        {title}
      </h1>
      {meta ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]" style={{ color: "var(--tx2)" }}>
          {meta}
        </div>
      ) : null}
    </div>
  );
}

/* ── Màn khoá (album có mật khẩu) ────────────────────────────────────────── */
export function LockScreenV2({
  theme,
  brand,
  headerRight,
  title,
  desc,
  hint,
  value,
  onChange,
  onSubmit,
  error,
  loading,
  submitLabel,
  loadingLabel,
  placeholder = "••••••",
  numeric = false,
}: {
  theme: "light" | "dark";
  brand: StudioBrandInfo;
  headerRight?: React.ReactNode;
  title: string;
  desc: React.ReactNode;
  hint?: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  error?: React.ReactNode;
  loading: boolean;
  submitLabel: string;
  loadingLabel: string;
  placeholder?: string;
  numeric?: boolean;
}) {
  const { t } = useLang();
  return (
    <CustomerRootV2 theme={theme}>
      <CustomerHeaderV2 brand={brand} sub={t("photoAlbum")} right={headerRight} />
      <div className="flex min-h-[calc(100svh-60px)] items-center justify-center px-4 py-10">
        <form onSubmit={onSubmit} className="v2-card w-full max-w-[400px] px-6 py-8 text-center sm:px-8">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full" style={{ background: "var(--acS)", color: "var(--ac)" }}>
            <Lock size={22} />
          </span>
          <h1 className="mt-4 text-[20px] font-bold leading-snug" style={{ letterSpacing: "-0.2px" }}>
            {title}
          </h1>
          <p className="mt-1.5 text-[14px]" style={{ color: "var(--tx2)" }}>
            {desc}
          </p>
          {hint ? (
            <p className="mt-1 text-[13px]" style={{ color: "var(--tx3)" }}>
              {hint}
            </p>
          ) : null}
          <input
            type={numeric ? "text" : "password"}
            inputMode={numeric ? "numeric" : undefined}
            autoFocus
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={`${inputCls} mt-6 text-center`}
            // 16px: Safari trên iPhone tự phóng to trang khi chạm vào ô chữ nhỏ hơn.
            style={{ fontSize: 16, height: 46 }}
            placeholder={placeholder}
            aria-label={typeof desc === "string" ? desc : t("password")}
          />
          {error ? (
            <p className="mt-2.5 text-[13px] font-medium" style={{ color: "var(--rd)" }}>
              {error}
            </p>
          ) : null}
          <button disabled={loading} className={btn("primary", "lg", "mt-4 w-full")}>
            {loading ? loadingLabel : submitLabel}
          </button>
        </form>
      </div>
    </CustomerRootV2>
  );
}

/* ── Thông báo nhanh ─────────────────────────────────────────────────────── */
export function ToastV2({ text, lifted = false }: { text: string | null; lifted?: boolean }) {
  if (!text) return null;
  return (
    <div
      role="status"
      className="fixed left-1/2 z-[95] max-w-[min(92vw,520px)] -translate-x-1/2 rounded-[12px] px-4 py-2.5 text-center text-[13.5px] font-semibold"
      style={{
        bottom: lifted ? "calc(108px + env(safe-area-inset-bottom, 0px))" : "calc(24px + env(safe-area-inset-bottom, 0px))",
        background: "var(--tx)",
        color: "var(--sf)",
        boxShadow: "var(--sh-toast)",
      }}
    >
      {text}
    </div>
  );
}

/* ── Nút chọn trên ô ảnh ─────────────────────────────────────────────────── */
/**
 * Vòng tròn chọn ở góc ô ảnh: vùng bấm 44px (ngón tay), hình tròn 26px. Chưa
 * chọn: viền trắng trên nền mờ; đã chọn: tròn đặc màu chủ đạo + dấu tích.
 */
export function SelectDot({
  on,
  onClick,
  label,
  icon,
  className = "right-0 top-0",
  disabled = false,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      disabled={disabled}
      aria-pressed={on}
      aria-label={label}
      title={label}
      className={`absolute z-[4] flex h-11 w-11 items-center justify-center transition-transform active:scale-90 disabled:opacity-50 ${className}`}
    >
      <span
        className="flex h-[26px] w-[26px] items-center justify-center rounded-full"
        style={{
          background: on ? "var(--ac)" : "rgba(0,0,0,.24)",
          border: "2px solid #fff",
          color: "#fff",
          boxShadow: "0 1px 4px rgba(0,0,0,.35)",
        }}
      >
        {on ? icon : null}
      </span>
    </button>
  );
}

/* ── Khung xem ảnh toàn màn hình ─────────────────────────────────────────── */
/**
 * Nền tối cố định, ảnh ở giữa (phóng to bằng chụm ngón / lăn chuột qua
 * PhotoZoom, ảnh gốc nét hơn qua ZoomHiRes), thanh trên: đóng · số thứ tự ·
 * phóng to/thu nhỏ · nút phụ. Thao tác chính (chọn, không thích, tải…) do trang
 * truyền vào `actions` và nằm ở ĐÁY màn — vùng ngón cái với tới.
 */
export function ViewerV2({
  photo,
  video = false,
  index,
  total,
  onClose,
  onStep,
  wm,
  gridW,
  fullW,
  topActions,
  actions,
  aside,
  hint,
  reserve = 176,
}: {
  photo: { id: string; drive_file_id: string; name: string };
  video?: boolean;
  index: number;
  total: number;
  onClose: () => void;
  onStep: (delta: number) => void;
  wm: string | null;
  gridW: number;
  fullW: number;
  topActions?: React.ReactNode;
  actions?: React.ReactNode;
  /** Cột phải trên máy tính (ghi chú). */
  aside?: React.ReactNode;
  hint?: React.ReactNode;
  /** Chiều cao (px) dành cho thanh trên + thanh thao tác — phần còn lại cho ảnh. */
  reserve?: number;
}) {
  const img = useAlbumImg();
  const { t } = useLang();
  // Mức phóng chỉ để bật/tắt nút "thu nhỏ" — cử chỉ do PhotoZoom lo.
  const [zoom, setZoom] = useState(1);
  const [hiResLoading, setHiResLoading] = useState(false);
  const zoomRef = useRef<PhotoZoomHandle>(null);
  const stage = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    setZoom(1);
    setHiResLoading(false);
  }, [photo.id]);
  // Khung xem phủ kín màn hình: khoá cuộn trang phía sau.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={stripExtension(photo.name)}
      className="client-doc ui-v2 fixed inset-0 z-[90] flex flex-col"
      data-theme="dark"
      style={{ background: "#07090c", color: "#eef1f5" }}
    >
      <div
        className="flex h-14 flex-none items-center gap-1 px-2 sm:px-4"
        style={{ marginTop: "env(safe-area-inset-top, 0px)", borderBottom: "1px solid rgba(255,255,255,.08)" }}
      >
        <button type="button" onClick={onClose} aria-label={t("close")} title={t("close")} className={iconBtn()} style={{ color: "#fff" }}>
          <X size={20} />
        </button>
        <div className="min-w-0 flex-1 px-1.5">
          <p className="tnum text-[14px] font-semibold leading-tight">
            {index + 1} <span style={{ color: "rgba(255,255,255,.5)" }}>/ {total}</span>
          </p>
          <p className="truncate text-[11.5px]" style={{ color: "rgba(255,255,255,.55)" }}>
            {stripExtension(photo.name)}
          </p>
        </div>
        {!video && (
          <>
            <button
              type="button"
              onClick={() => zoomRef.current?.zoomBy(1 / 1.5)}
              disabled={zoom <= 1}
              aria-label={t("zoomOut")}
              title={t("zoomOut")}
              className={iconBtn("hidden sm:inline-flex")}
              style={{ color: "#fff" }}
            >
              <ZoomOut size={19} />
            </button>
            <button
              type="button"
              onClick={() => zoomRef.current?.zoomBy(1.5)}
              aria-label={t("zoomIn")}
              title={t("zoomIn")}
              className={iconBtn("hidden sm:inline-flex")}
              style={{ color: "#fff" }}
            >
              <ZoomIn size={19} />
            </button>
          </>
        )}
        {topActions}
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div ref={stage} className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-1 py-2 md:px-16">
            {hiResLoading && (
              <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full px-3 py-1 text-[12px]" style={{ background: "rgba(0,0,0,.6)", color: "#fff" }}>
                {t("loadingOriginal")}
              </div>
            )}
            <button
              type="button"
              onClick={() => onStep(-1)}
              disabled={index === 0}
              aria-label={t("prevPhoto")}
              className="absolute left-0 top-1/2 z-10 flex h-16 w-11 -translate-y-1/2 items-center justify-center transition-opacity disabled:pointer-events-none disabled:opacity-0 md:left-2 md:w-12"
              style={{ color: "#fff", filter: "drop-shadow(0 2px 6px rgba(0,0,0,.8))" }}
            >
              <ChevronLeft size={32} strokeWidth={1.7} />
            </button>
            {video ? (
              <iframe
                src={`https://drive.google.com/file/d/${photo.drive_file_id}/preview`}
                allow="autoplay; fullscreen"
                allowFullScreen
                className="aspect-video w-full max-w-4xl rounded-lg"
                style={{ border: "none", maxHeight: `calc(100dvh - ${reserve}px)` }}
              />
            ) : (
              <div className="relative inline-flex">
                <PhotoZoom key={photo.id} ref={zoomRef} stageRef={stage} onSwipe={onStep} onZoomChange={setZoom} className="relative inline-flex">
                  <img
                    key={photo.id}
                    src={img.full(photo.drive_file_id, fullW)}
                    alt={photo.name}
                    draggable={false}
                    decoding="async"
                    onError={retryViaProxy}
                    onContextMenu={(e) => wm && e.preventDefault()}
                    className="max-w-full select-none rounded-[4px] object-contain"
                    style={{
                      maxHeight: `calc(100dvh - ${reserve}px)`,
                      // Ảnh nhỏ của lưới (đã có sẵn) nằm phía sau trong lúc ảnh lớn
                      // đang giải mã — bấm qua lại là thấy ảnh ngay.
                      backgroundImage: `url(${img.thumb(photo.drive_file_id, gridW)})`,
                      backgroundSize: "contain",
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: "center",
                    }}
                  />
                  <ZoomHiRes
                    srcs={[img.original(photo.drive_file_id), img.full(photo.drive_file_id, 4096), `${img.full(photo.drive_file_id, 2560)}&raw=1`]}
                    active={zoom > 1}
                    onLoadingChange={setHiResLoading}
                    className="rounded-[4px]"
                  />
                  {wm && <div className="pointer-events-none absolute inset-0 opacity-30" style={watermarkLayer(wm)} />}
                </PhotoZoom>
              </div>
            )}
            <button
              type="button"
              onClick={() => onStep(1)}
              disabled={index >= total - 1}
              aria-label={t("nextPhoto")}
              className="absolute right-0 top-1/2 z-10 flex h-16 w-11 -translate-y-1/2 items-center justify-center transition-opacity disabled:pointer-events-none disabled:opacity-0 md:right-2 md:w-12"
              style={{ color: "#fff", filter: "drop-shadow(0 2px 6px rgba(0,0,0,.8))" }}
            >
              <ChevronRight size={32} strokeWidth={1.7} />
            </button>
          </div>
          {hint}
          {actions ? (
            <div className="flex-none px-3 pt-2" style={{ paddingBottom: "max(14px, env(safe-area-inset-bottom, 0px))" }}>
              <div className="mx-auto w-full max-w-[560px]">{actions}</div>
            </div>
          ) : (
            <div style={{ height: "max(12px, env(safe-area-inset-bottom, 0px))" }} />
          )}
        </div>
        {aside ? (
          <aside className="hidden w-[340px] flex-none flex-col overflow-y-auto md:flex" style={{ borderLeft: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.03)" }}>
            {aside}
          </aside>
        ) : null}
      </div>
    </div>
  );
}

/** Chip lọc (thư mục, năm, loại album): viên bo tròn, đang chọn thì tô màu chủ đạo nhạt. */
export function ChipV2({
  on,
  onClick,
  children,
  count,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className="inline-flex h-9 flex-none items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[13px] font-semibold transition-colors"
      style={
        on
          ? { background: "var(--acS)", color: "var(--ac)", border: "1px solid color-mix(in srgb, var(--ac) 35%, transparent)" }
          : { background: "var(--sf)", color: "var(--tx2)", border: "1px solid var(--bd)" }
      }
    >
      {children}
      {count !== undefined ? (
        <span className="tnum text-[12px] font-semibold" style={{ color: on ? "var(--ac)" : "var(--tx3)" }}>
          {count}
        </span>
      ) : null}
    </button>
  );
}

/** Hàng chip cuộn ngang trên điện thoại (không tràn trang), xuống dòng trên máy tính. */
export function ChipRow({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div
      role="group"
      aria-label={label}
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
      style={{ scrollbarWidth: "none" }}
    >
      {children}
    </div>
  );
}
