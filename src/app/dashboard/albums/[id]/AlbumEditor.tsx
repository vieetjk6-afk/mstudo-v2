"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  RefreshCw,
  Copy,
  FileText,
  MessageSquareText,
  ImageOff,
  Check,
  Trash2,
  Plus,
  Star,
  ExternalLink,
  Users,
  Save,
  Images,
  PackageCheck,
  ArrowRight,
  FolderOpen,
  HardDrive,
  HardDriveDownload,
} from "lucide-react";
import { studioUrl } from "@/lib/hosts";
import ShareButton from "@/components/ShareButton";
import ZaloSendButton from "@/components/ZaloSendButton";
import FilterPhotosButton from "@/components/FilterPhotosButton";
import PhotoCodeButtons from "@/components/PhotoCodeButtons";
import { thumbnailUrl, stripExtension } from "@/lib/drive";
import { CATEGORY_PRESETS, slugifyVi } from "@/lib/category";
import { fmtDate, fmtDateTime } from "@/lib/date";
import { albumShareMessage } from "@/lib/share-messages";
import { storageState, storageLabel, STORAGE_EXTEND_CHOICES } from "@/lib/storage-lifecycle";
import { useUiV2 } from "@/components/v2/UiV2Context";
import AlbumPrintPanel from "./AlbumPrintPanel";
import AlbumEditorV2 from "./AlbumEditorV2";
import { useAlbumEditor, type AlbumEditorProps, type CustomerShare } from "./useAlbumEditor";
import type { Album, Photo, SourceStage } from "@/lib/types";

// Kiểu dữ liệu + logic chung nằm ở ./useAlbumEditor (bản mới AlbumEditorV2 dùng chung).
export type { AlbumPick, CustomerShare, DeliveryTwin, LinkedContractInfo, AlbumEditorProps } from "./useAlbumEditor";

/* ── Tab của màn cài đặt album (bản thiết kế, màn "Album chọn ảnh") ──────────
   Trước đây mọi thứ nằm trong một lưới 3 cột: cột trái cài đặt dài dằng dặc,
   cột phải nguồn ảnh + lưới ảnh. Gom vào tab để mỗi lần chỉ thấy đúng việc
   đang làm, thứ tự đi theo cách studio dùng thật. */
const ALBUM_TABS = [
  ["photos", "Ảnh"],
  ["picked", "Lượt chọn"],
  ["shares", "Khách chia sẻ"],
  ["sources", "Nguồn ảnh"],
  ["settings", "Cài đặt"],
  ["deliver", "Giao khách"],
] as const;
type AlbumTab = (typeof ALBUM_TABS)[number][0];

/** Giao diện mới có bản riêng (AlbumEditorV2) — đổi kiểu component, không rẽ nhánh giữa các hook. */
export default function AlbumEditor(props: AlbumEditorProps) {
  return useUiV2() ? <AlbumEditorV2 {...props} /> : <AlbumEditorV1 {...props} />;
}

function AlbumEditorV1({
  album,
  initialSources,
  initialPhotos,
  canDelivery = true,
  canPinHome = true,
  canWatermark = true,
  studioName = "Studio",
  studioHost = null,
  studioCats = [],
  contractId = null,
  clientPhone = null,
  clientName = null,
  zaloSavedName = null,
  selections = [],
  storageMonths = 6,
  deliveryTwin = null,
  linkedContract = null,
  printInfo = null,
  customerShares = [],
  initialTab,
}: AlbumEditorProps) {
  const {
    t,
    deleting, deleteAlbum,
    form, setForm, saving, saveSettings,
    hasPassword, newPassword, setNewPassword, savePassword,
    phase, phaseBusy, switchPhase, manualContract,
    twinTakesOver, twinBusy, twinBackToSelection,
    storageDate, storageBusy, extendStorage, clearStorage,
    sources, photos, newSource, setNewSource, addSource, removeSource, sync, syncing,
    editedUrl, setEditedUrl, deliveryBusy, saveDeliveryLink, deliveryMissing,
    msg,
    deliveryCount, selectionCount, photoGroups, splitBySource, deliveryFolders,
    photoById, pickSessions, pickSession, setPickSession, notesOnly, setNotesOnly,
    visiblePicks, pickedIds, notedCount, copiedList, copyPickList, exportPickList,
    setCover, removePhoto, clientLink,
  } = useAlbumEditor({
    album, initialSources, initialPhotos, canDelivery, canPinHome, canWatermark, studioName, studioHost,
    selections, storageMonths, deliveryTwin, linkedContract,
  });
  const [tab, setTab] = useState<AlbumTab>(() =>
    ALBUM_TABS.some(([k]) => k === initialTab) ? (initialTab as AlbumTab) : "photos"
  );
  const [photoStage, setPhotoStage] = useState<"all" | "delivery" | "selection">("all");


  return (
    <div className="page-in pb-16">
      {/* ── Đầu màn: quay lại · tên album + dòng phụ · hành động ────────────
          Đúng hàng đầu của bản thiết kế; nút phụ dồn phải, nút chính là link
          gửi khách. Vẫn wrap được vì trên điện thoại hàng này dài hơn màn. */}
      <div className="mb-3.5 flex flex-wrap items-center gap-3">
        <Link
          href="/dashboard/albums"
          aria-label="Về thư viện album"
          className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[9px]"
          style={{ border: "1px solid var(--bd)", background: "var(--sf)" }}
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-[19px] font-bold" style={{ letterSpacing: "-.4px" }}>{form.title}</h1>
          <p className="mt-px truncate text-[11.5px]" style={{ color: "var(--tx3)" }}>
            {[
              phase === "delivery" ? "Album giao khách" : "Album chọn ảnh",
              `${photos.length} ảnh`,
              form.status === "published" ? "đã xuất bản" : "đang là nháp",
            ].join(" · ")}
          </p>
        </div>

        {/* Trên điện thoại: lưới 2 cột, mọi nút bằng nhau và bằng chiều cao —
            trước đây 7 nút với 3 cỡ chữ khác nhau tự wrap thành các hàng so le.
            Từ 820px trở lên trở về dải ngang dồn phải như bản thiết kế.
            Thứ tự cũng xếp lại theo việc: xem → chia sẻ → thêm ảnh → xoá. */}
        <div className="ml-auto grid w-full grid-cols-2 items-center gap-2 min-[820px]:flex min-[820px]:w-auto min-[820px]:flex-wrap">
          <Link href={`/dashboard/albums/${album.id}/selections`} className="act-btn">
            <Users size={16} /> {t("customerSelections")}
          </Link>
          {/* Lọc ảnh NGAY từ cài đặt album — mở popup công cụ lọc tại chỗ (nguồn
              Drive hoặc máy tính). Chỉ hiện ở album chọn ảnh; giai đoạn giao
              khách không lọc theo danh sách khách chọn nữa. Khuôn mặt thì KHÔNG
              có mặt ở màn này chút nào — máy chủ tự quét, xem
              @/lib/face-scan-server. */}
          {phase !== "delivery" && <FilterPhotosButton albumId={album.id} albumTitle={form.title} className="act-btn" />}
          <a href={clientLink} target="_blank" rel="noreferrer" className="act-btn">
            <ExternalLink size={16} /> Mở link khách
          </a>
          <ShareButton path={clientLink} title={form.title} className="act-btn" message={albumShareMessage(clientName || album.client_name, clientLink)} />
          {/* Ô nhập số điện thoại + nút gửi nên chiếm cả hàng trên điện thoại,
              nhồi vào nửa hàng thì ô nhập chỉ còn vài chục pixel. */}
          <div className="col-span-2 min-[820px]:col-auto">
            <ZaloSendButton
              phone={clientPhone || album.client_phone}
              name={clientName || album.client_name}
              contractId={contractId}
              albumId={album.id}
              savedName={zaloSavedName}
              audience="client"
              kind="album_share"
              askPhone
              className="act-btn act-btn-auto flex-1"
              message={albumShareMessage(clientName || album.client_name, clientLink)}
            />
          </div>
          <button onClick={() => setTab("sources")} className="act-btn act-btn-primary">
            <Plus size={16} /> Tải thêm ảnh
          </button>
          <button onClick={deleteAlbum} disabled={deleting} className="act-btn act-btn-danger">
            <Trash2 size={15} /> {deleting ? "Đang xóa…" : t("delete")}
          </button>
        </div>
      </div>

      {msg && (
        <div className="mb-3.5 rounded-[10px] px-3.5 py-2.5 text-[12.5px] font-semibold" style={{ background: "var(--amS)", color: "var(--am)" }}>
          {msg}
        </div>
      )}

      {/* KHÔNG có bảng gom khuôn mặt ở đây, và đó là chủ ý.
          Bản trước quét khuôn mặt ngay trên màn này: studio mở album ra là trình
          duyệt chạy ngầm. Studio nói thẳng bước đó thừa — studio không tìm mặt
          bao giờ, chỉ KHÁCH mới cần. Giờ máy chủ tự quét (cron
          /api/cron/face-scan). Muốn xem đã quét tới đâu thì gọi
          GET /api/albums/<id>/face-scan; muốn chạy ngay thì POST cùng đường dẫn. */}

      {/* Hợp đồng đồng bộ Drive có HAI album. Khi album giao khách đã sẵn sàng,
          link khách của album chọn ảnh tự chuyển sang đó — nhìn ở màn này thì
          album vẫn ghi "Chọn ảnh" mà bấm link lại ra trang giao khách. Nói
          thẳng ra, kèm nút đưa ngược về. */}
      {twinTakesOver && deliveryTwin && (
        <div className="mb-3.5 flex flex-col gap-2.5 rounded-[12px] p-3.5 sm:flex-row sm:items-center" style={{ background: "var(--amS)", border: "1px solid var(--am)" }}>
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-bold" style={{ color: "var(--am)" }}>
              Link khách đang mở album giao khách
            </p>
            <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--tx2)" }}>
              Hợp đồng đã có album “{deliveryTwin.title}”, nên link khách của album chọn ảnh này tự chuyển sang đó.
              Hậu kỳ chưa xong thì đưa về để khách chọn ảnh tiếp.
            </p>
          </div>
          <div className="flex flex-none flex-wrap gap-2">
            <Link href={`/dashboard/albums/${deliveryTwin.id}`} className="act-btn">
              Mở album giao khách
            </Link>
            <button onClick={twinBackToSelection} disabled={twinBusy} className="act-btn act-btn-primary">
              <ArrowLeft size={15} /> {twinBusy ? "Đang đổi…" : "Về giai đoạn Chọn ảnh"}
            </button>
          </div>
        </div>
      )}

      {/* Album thuộc hợp đồng nào. Hợp đồng "Nhập link ảnh riêng": MỘT album
          này dùng cho cả chọn ảnh lẫn giao hoàn thiện — nói rõ dán link ở đâu. */}
      {linkedContract && (
        <div className="mb-3.5 flex flex-col gap-2.5 rounded-[12px] p-3.5 sm:flex-row sm:items-center" style={{ background: "var(--sf2)", border: "1px solid var(--bd)" }}>
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-bold">
              Album của hợp đồng {linkedContract.code ? `${linkedContract.code} · ` : ""}{linkedContract.title}
            </p>
            <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--tx2)" }}>
              {manualContract
                ? "Hợp đồng dùng link ảnh riêng: dán link Drive ảnh chọn ở “Nguồn ảnh” (loại Ảnh chọn), link ảnh hoàn thiện ở “Giao khách”. Cùng album này dùng để khách chọn ảnh rồi nhận ảnh hoàn thiện."
                : linkedContract.albumMode === "desktop"
                  ? "Album mặc định — ảnh tự đồng bộ từ mstudo desktop qua thư mục Drive của hợp đồng."
                  : "Album gắn với hợp đồng này."}
            </p>
            {manualContract && linkedContract.status === "completed" && phase !== "delivery" && (
              <p className="mt-1 text-[11.5px] font-semibold" style={{ color: "var(--am)" }}>
                Hợp đồng đã hoàn thành — dán link ảnh hoàn thiện để giao khách.
              </p>
            )}
          </div>
          <div className="flex flex-none flex-wrap gap-2">
            {manualContract && (
              <button onClick={() => setTab(phase === "delivery" || linkedContract.status === "completed" ? "deliver" : "sources")} className="act-btn">
                <Plus size={15} /> Dán link ảnh
              </button>
            )}
            <Link href={`/dashboard/studio/contracts/${linkedContract.id}?tab=album`} className="act-btn">
              Mở hợp đồng
            </Link>
          </div>
        </div>
      )}

      {/* ── Bốn thẻ số liệu ───────────────────────────────────────────────
          Bản thiết kế đặt ngay dưới đầu màn: ảnh trong album, ảnh khách chọn,
          nguồn ảnh và trạng thái công bố — nhìn là biết album đang tới đâu. */}
      <div className="mb-3.5 grid grid-cols-2 gap-3 min-[900px]:grid-cols-4">
        {([
          [String(photos.length), "Ảnh trong album", "photos"],
          [String(selections.length), pickSessions.length > 1 ? `Lượt khách chọn · ${pickSessions.length} mã` : "Lượt khách chọn", "picked"],
          [String(sources.length), "Nguồn ảnh Drive", "sources"],
          [form.status === "published" ? "Đã xuất bản" : "Nháp", phase === "delivery" ? "Giai đoạn giao khách" : "Giai đoạn chọn ảnh", "settings"],
        ] as [string, string, AlbumTab][]).map(([v, l, go]) => {
          const on = tab === go;
          return (
            <button
              key={l}
              onClick={() => setTab(go)}
              className="rounded-[14px] px-4 py-3.5 text-left"
              style={{ background: on ? "var(--acS)" : "var(--sf)", border: `1px solid ${on ? "var(--acM)" : "var(--bd)"}` }}
            >
              <p className="tnum text-[22px] font-bold" style={{ letterSpacing: "-.6px", color: on ? "var(--ac)" : "var(--tx)" }}>{v}</p>
              <p className="mt-0.5 text-[12px]" style={{ color: "var(--tx2)" }}>{l}</p>
            </button>
          );
        })}
      </div>

      {/* ── Thẻ nội dung có tab ───────────────────────────────────────────── */}
      <div>
        <div role="tablist" aria-label="Nội dung album" className="flex gap-0.5 overflow-x-auto rounded-[14px] px-3" style={{ background: "var(--sf)", border: "1px solid var(--bd)" }}>
          {ALBUM_TABS.map(([key, label]) => {
            const on = tab === key;
            const badge = key === "photos" ? photos.length : key === "picked" ? selections.length : key === "shares" ? customerShares.length : key === "sources" ? sources.length : 0;
            return (
              <button
                key={key}
                role="tab"
                aria-selected={on}
                onClick={() => setTab(key)}
                className="flex flex-none items-center gap-1.5 whitespace-nowrap px-3 pb-2.5 pt-3 text-[13px]"
                style={{
                  color: on ? "var(--ac)" : "var(--tx2)",
                  fontWeight: on ? 700 : 550,
                  borderBottom: `2px solid ${on ? "var(--ac)" : "transparent"}`,
                }}
              >
                {label}
                {badge > 0 && (
                  <span className="rounded-[20px] px-1.5 text-[10.5px] font-bold" style={{ background: on ? "var(--acS)" : "var(--sf2)", color: on ? "var(--ac)" : "var(--tx3)" }}>
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-3.5 space-y-3.5">

          {/* Ảnh: lưới ảnh đã đồng bộ về album */}
          {tab === "photos" && (
            <>
            {/* Photos */}
            <div className="card p-6">
              <h2 className="mb-4 flex flex-wrap items-center gap-2 text-sm font-medium uppercase tracking-wide text-accent-muted">
                {photos.length} {t("photos")}
                {deliveryCount > 0 && (
                  <span className="flex gap-1.5 normal-case">
                    <span className="rounded px-1.5 py-0.5 text-[10px]" style={{ background: "color-mix(in srgb, var(--gold) 15%, transparent)", color: "var(--gold)" }}>{selectionCount} chọn</span>
                    <span className="rounded px-1.5 py-0.5 text-[10px]" style={{ background: "color-mix(in srgb, var(--success) 15%, transparent)", color: "var(--success)" }}>{deliveryCount} giao</span>
                  </span>
                )}
                {/* Mã ảnh của đúng bộ đang xem (lọc giai đoạn) — đem đi lọc ảnh / gửi thợ. */}
                <span className="ml-auto normal-case tracking-normal">
                  <PhotoCodeButtons
                    names={photoGroups.filter((g) => photoStage === "all" || photoStage === g.key).flatMap((g) => g.photos.map((p) => p.name))}
                    fileName={`${album.slug}-${photoStage === "delivery" ? "anh-giao-khach" : photoStage === "selection" ? "anh-chon" : "tat-ca-anh"}`}
                  />
                </span>
              </h2>
              {pickedIds.size > 0 && (
                <p className="mb-3 text-[12.5px]" style={{ color: "var(--tx2)" }}>
                  Ảnh viền đậm kèm dấu tích là ảnh khách đã chọn ({pickedIds.size}/{photos.length}).{" "}
                  <button onClick={() => setTab("picked")} className="font-semibold underline" style={{ color: "var(--ac)" }}>
                    Xem riêng ảnh khách chọn
                  </button>
                </p>
              )}
              {/* Lọc theo giai đoạn — chỉ có nghĩa khi album có cả hai bộ ảnh. */}
              {deliveryCount > 0 && selectionCount > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {([
                    ["all", `Tất cả · ${photos.length}`],
                    ["delivery", `Ảnh giao khách · ${deliveryCount}`],
                    ["selection", `Ảnh chọn · ${selectionCount}`],
                  ] as ["all" | "delivery" | "selection", string][]).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setPhotoStage(key)}
                      className="rounded-[20px] px-3 py-[6px] text-[12px] font-semibold"
                      style={photoStage === key
                        ? { background: "var(--ac)", color: "#fff" }
                        : { background: "var(--sf2)", color: "var(--tx2)", border: "1px solid var(--bd)" }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {photoGroups.map((g) => {
                if (g.photos.length === 0) return null;
                if (photoStage !== "all" && photoStage !== g.key) return null;
                const showGroupHead = deliveryCount > 0 && selectionCount > 0;
                return (
                  <div key={g.key} className="mb-5 last:mb-0">
                    {showGroupHead && (
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span
                          className="rounded-[6px] px-2 py-0.5 text-[11px] font-bold"
                          style={g.key === "delivery"
                            ? { background: "color-mix(in srgb, var(--success) 15%, transparent)", color: "var(--success)" }
                            : { background: "color-mix(in srgb, var(--gold) 15%, transparent)", color: "var(--gold)" }}
                        >
                          {g.label}
                        </span>
                        <span className="text-[11.5px]" style={{ color: "var(--tx3)" }}>
                          {g.photos.length} ảnh · bấm ★ trên ảnh để đặt làm ảnh bìa
                        </span>
                        {photoStage === "all" && (
                          <span className="ml-auto">
                            <PhotoCodeButtons compact names={g.photos.map((p) => p.name)} fileName={`${album.slug}-${g.key === "delivery" ? "anh-giao-khach" : "anh-chon"}`} />
                          </span>
                        )}
                      </div>
                    )}
                    {splitBySource(g.photos).map((sec) => (
                      <div key={`${g.key}-${sec.id}`} className="mb-3.5 last:mb-0">
                        {sec.name && (
                          <p className="mb-1.5 text-[12px] font-semibold" style={{ color: "var(--tx2)" }}>
                            {sec.name}
                            <span className="ml-1.5 font-normal" style={{ color: "var(--tx3)" }}>· {sec.photos.length} ảnh</span>
                          </p>
                        )}
                        {/* Lưới ảnh 6 cột như bản thiết kế, tỉ lệ 3:2, khe 10px. */}
                        <div className="grid grid-cols-3 gap-2.5 min-[700px]:grid-cols-4 min-[1000px]:grid-cols-5 min-[1280px]:grid-cols-6">
                          {sec.photos.map((p) => {
                            const isPicked = pickedIds.has(p.id);
                            return (
                            <div
                              key={p.id}
                              className="group relative aspect-[3/2] overflow-hidden rounded-[9px]"
                              style={{ background: "var(--sf2)", border: isPicked ? "2px solid var(--ac)" : "1px solid var(--bd2)" }}
                            >
                              <img
                                src={thumbnailUrl(p.drive_file_id, 400)}
                                alt={p.name}
                                loading="lazy"
                                className="h-full w-full object-cover"
                              />
                              <div className="absolute inset-0 flex items-end justify-between bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 transition group-hover:opacity-100">
                                <button
                                  onClick={() => setCover(p.drive_file_id)}
                                  title={t("setCover")}
                                  aria-label={t("setCover")}
                                  className="rounded bg-ink-900/80 p-1.5 text-accent-gold hover:bg-ink-800"
                                >
                                  <Star size={14} />
                                </button>
                                <button
                                  onClick={() => removePhoto(p.id)}
                                  aria-label={t("delete")}
                                  className="rounded bg-ink-900/80 p-1.5 hover:bg-ink-800"
                                  style={{ color: "var(--danger)" }}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                              {isPicked && (
                                <span
                                  className="absolute right-1 top-1 flex h-[19px] w-[19px] items-center justify-center rounded-full"
                                  style={{ background: "var(--ac)", color: "#fff" }}
                                  title="Khách đã chọn ảnh này"
                                >
                                  <Check size={13} />
                                </span>
                              )}
                              {form.cover_url === thumbnailUrl(p.drive_file_id, 800) && (
                                <span className="absolute left-1.5 top-1.5 rounded-[5px] px-1.5 py-0.5 text-[9px] font-bold uppercase" style={{ background: "var(--ac)", color: "#fff" }}>
                                  {t("cover")}
                                </span>
                              )}
                              <span
                                className="pointer-events-none absolute bottom-1 left-1.5 max-w-[85%] truncate text-[9px]"
                                style={{ color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,.75)", fontFamily: "ui-monospace, monospace" }}
                              >
                                {stripExtension(p.name)}
                              </span>
                            </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
              {photos.length === 0 && (
                <p className="text-sm text-accent-muted">
                  {t("addSource")} → {t("syncDrive")}
                </p>
              )}
            </div>
            </>
          )}

          {/* Lượt chọn: chỉ ảnh khách ĐÃ chọn, lọc theo mã chọn và theo ghi chú */}
          {tab === "picked" && (
            <>
            <div className="card p-5">
              {selections.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <span className="mx-auto flex h-[54px] w-[54px] items-center justify-center rounded-[15px]" style={{ background: "var(--sf2)", color: "var(--tx3)" }}>
                    <ImageOff size={26} />
                  </span>
                  <p className="mt-3 text-[14px] font-bold">Khách chưa chọn ảnh nào</p>
                  <p className="mx-auto mt-1 max-w-[360px] text-[12px] leading-relaxed" style={{ color: "var(--tx3)", textWrap: "pretty" }}>
                    Gửi link album cho khách; mỗi lần một người mở link và bấm tim là một <b>mã chọn</b> riêng, hiện ngay ở đây.
                  </p>
                </div>
              ) : (
                <>
                  {/* Mã chọn: mỗi phiên khách bấm chọn là một mã */}
                  <p className="eyebrow mb-2">Mã chọn ({pickSessions.length})</p>
                  <div className="mb-3.5 flex flex-wrap gap-2">
                    <button
                      onClick={() => setPickSession("all")}
                      className="flex items-center gap-1.5 whitespace-nowrap rounded-[20px] px-3 py-[6px] text-[12px] font-semibold"
                      style={pickSession === "all"
                        ? { background: "var(--ac)", color: "#fff" }
                        : { background: "var(--sf2)", color: "var(--tx2)", border: "1px solid var(--bd)" }}
                    >
                      Tất cả
                      <span className="text-[11px] font-bold opacity-75">{selections.length}</span>
                    </button>
                    {pickSessions.map((g) => {
                      const on = pickSession === g.id;
                      return (
                        <button
                          key={g.id}
                          onClick={() => setPickSession(g.id)}
                          title={`Mã ${g.id}`}
                          className="flex items-center gap-1.5 whitespace-nowrap rounded-[20px] px-3 py-[6px] text-[12px] font-semibold"
                          style={on
                            ? { background: "var(--ac)", color: "#fff" }
                            : { background: "var(--sf2)", color: "var(--tx2)", border: "1px solid var(--bd)" }}
                        >
                          <span style={{ fontFamily: "ui-monospace, monospace" }}>{g.id.slice(0, 6).toUpperCase()}</span>
                          {g.name ? <span className="font-normal opacity-80">· {g.name}</span> : null}
                          <span className="text-[11px] font-bold opacity-75">{g.count}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Thanh hành động: lọc ghi chú · chép danh sách · tải .txt */}
                  <div className="mb-3.5 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setNotesOnly((v) => !v)}
                      aria-pressed={notesOnly}
                      className="flex items-center gap-1.5 rounded-[9px] px-3 py-2 text-[12.5px] font-semibold"
                      style={notesOnly
                        ? { background: "var(--acS)", color: "var(--ac)", border: "1px solid var(--acM)" }
                        : { background: "var(--sf)", color: "var(--tx2)", border: "1px solid var(--bd)" }}
                    >
                      <MessageSquareText size={15} /> Chỉ ảnh có ghi chú
                      <span className="text-[11px] font-bold opacity-75">{notedCount}</span>
                    </button>
                    <span className="text-[12px]" style={{ color: "var(--tx3)" }}>
                      Đang hiện {visiblePicks.length} ảnh · ảnh khách không chọn được ẩn đi
                    </span>
                    <div className="ml-auto flex flex-wrap gap-2">
                      <button
                        onClick={copyPickList}
                        className="flex items-center gap-1.5 rounded-[9px] px-3 py-2 text-[12.5px] font-semibold"
                        style={{ border: "1px solid var(--bd)", background: "var(--sf)" }}
                      >
                        {copiedList ? <Check size={15} /> : <Copy size={15} />} {copiedList ? "Đã chép" : "Chép danh sách"}
                      </button>
                      <button
                        onClick={exportPickList}
                        className="flex items-center gap-1.5 rounded-[9px] px-3 py-2 text-[12.5px] font-semibold"
                        style={{ border: "1px solid var(--bd)", background: "var(--sf)" }}
                      >
                        <FileText size={15} /> Tải .txt
                      </button>
                      <Link
                        href={`/dashboard/albums/${album.id}/selections`}
                        className="flex items-center gap-1.5 rounded-[9px] px-3 py-2 text-[12.5px] font-semibold"
                        style={{ background: "var(--acS)", color: "var(--ac)" }}
                      >
                        <HardDriveDownload size={15} /> Tải ảnh gốc
                      </Link>
                    </div>
                  </div>

                  {visiblePicks.length === 0 ? (
                    <p className="rounded-[10px] px-3.5 py-8 text-center text-[12.5px]" style={{ background: "var(--sf2)", color: "var(--tx3)" }}>
                      {notesOnly ? "Không có ảnh nào kèm ghi chú trong bộ lọc này." : "Mã chọn này chưa có ảnh nào."}
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2.5 min-[700px]:grid-cols-4 min-[1000px]:grid-cols-5 min-[1280px]:grid-cols-6">
                      {visiblePicks.map((s) => {
                        const p = photoById.get(s.photo_id);
                        const note = (s.client_note || s.photographer_note || "").trim();
                        return (
                          <div key={s.id} className="overflow-hidden rounded-[9px]" style={{ background: "var(--sf2)", border: "1px solid var(--bd2)" }}>
                            <div className="relative aspect-[3/2]">
                              {p ? (
                                <img src={thumbnailUrl(p.drive_file_id, 400)} alt={s.photo_name} loading="lazy" className="h-full w-full object-cover" />
                              ) : (
                                <span className="flex h-full items-center justify-center text-[10.5px]" style={{ color: "var(--tx3)" }}>Ảnh đã bị gỡ</span>
                              )}
                              {note && (
                                <span
                                  className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full"
                                  style={{ background: "var(--ac)", color: "#fff" }}
                                  title={note}
                                >
                                  <MessageSquareText size={13} />
                                </span>
                              )}
                            </div>
                            <p className="truncate px-2 pt-1.5 text-[11px] font-semibold">{stripExtension(s.photo_name)}</p>
                            <p className="line-clamp-2 px-2 pb-2 pt-px text-[10.5px] leading-snug" style={{ color: note ? "var(--tx2)" : "var(--tx3)" }}>
                              {note || "—"}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
            </>
          )}

          {/* Nguồn ảnh: các thư mục / link Drive nạp vào album */}
          {tab === "shares" && (
            <SharesPanel shares={customerShares} photos={photos} slug={album.slug} baseUrl={studioUrl(studioHost, `/${phase === "delivery" ? "album" : "a"}/${form.slug}`)} />
          )}

          {tab === "sources" && (
            <>
            {/* Sources */}
            <div className="card p-6">
              <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-accent-muted">
                {t("sources")}
              </h2>

              <ul className="mb-4 space-y-2">
                {sources.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between rounded-md border border-ink-800 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm text-accent">
                        <span className="rounded bg-ink-700 px-1.5 py-0.5 text-[10px] uppercase text-accent-muted">
                          {s.kind}
                        </span>
                        <span
                          className="rounded px-1.5 py-0.5 text-[10px] uppercase"
                          style={s.stage === "delivery"
                            ? { background: "color-mix(in srgb, var(--success) 15%, transparent)", color: "var(--success)" }
                            : { background: "color-mix(in srgb, var(--gold) 15%, transparent)", color: "var(--gold)" }}
                        >
                          {s.stage === "delivery" ? "Giao" : "Chọn"}
                        </span>
                        {s.name}
                      </div>
                      <div className="truncate text-xs text-ink-600">{s.drive_url}</div>
                    </div>
                    <button
                      onClick={() => removeSource(s.id)}
                      className="text-accent-muted hover:text-red-400"
                      aria-label={t("delete")}
                    >
                      <Trash2 size={15} />
                    </button>
                  </li>
                ))}
                {sources.length === 0 && (
                  <li className="text-sm text-accent-muted">—</li>
                )}
              </ul>

              <form onSubmit={addSource} className="grid grid-cols-1 gap-2 sm:grid-cols-[auto_1fr_2fr_auto]">
                <select
                  className="input"
                  value={newSource.stage}
                  onChange={(e) =>
                    setNewSource({ ...newSource, stage: e.target.value as SourceStage })
                  }
                >
                  <option value="selection">Ảnh chọn</option>
                  {canDelivery && <option value="delivery">Ảnh giao</option>}
                </select>
                <input
                  className="input"
                  placeholder={t("sourceName")}
                  value={newSource.name}
                  onChange={(e) =>
                    setNewSource({ ...newSource, name: e.target.value })
                  }
                />
                <input
                  className="input"
                  placeholder={t("driveLink")}
                  value={newSource.url}
                  onChange={(e) =>
                    setNewSource({ ...newSource, url: e.target.value })
                  }
                />
                <button className="btn-ghost whitespace-nowrap">
                  <Plus size={15} /> {t("addSource")}
                </button>
              </form>

              <button
                onClick={sync}
                disabled={syncing || sources.length === 0}
                className="btn-primary mt-4"
              >
                <RefreshCw size={15} className={syncing ? "animate-spin" : ""} />
                {syncing ? t("syncing") : t("syncDrive")}
              </button>
            </div>

            </>
          )}

          {/* Cài đặt: tên, đường dẫn, giới hạn chọn, watermark, mật khẩu */}
          {tab === "settings" && (
            <>
            {/* Settings */}
            <div className="card space-y-4 p-6 lg:col-span-1">
              <h2 className="text-sm font-medium uppercase tracking-wide text-accent-muted">
                {t("settings")}
              </h2>

              <div>
                <label className="label">{t("albumTitle")}</label>
                <input
                  className="input"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>
              <div>
                <label className="label">{t("description")}</label>
                <textarea
                  className="input min-h-[70px]"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div>
                <label className="label">{t("slug")}</label>
                <input
                  className="input"
                  value={form.slug}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      slug: e.target.value.replace(/[^a-z0-9-]/gi, "-").toLowerCase(),
                    })
                  }
                />
              </div>
              <div>
                <label className="label">{t("selectionLimit")}</label>
                <input
                  type="number"
                  min={0}
                  className="input"
                  placeholder={t("unlimited")}
                  value={form.selection_limit}
                  onChange={(e) =>
                    setForm({ ...form, selection_limit: e.target.value })
                  }
                />
              </div>

              {canWatermark ? (
                <div className="rounded-md border border-ink-800 p-3">
                  <label className="flex items-center gap-2 text-sm text-accent">
                    <input
                      type="checkbox"
                      checked={form.watermark_enabled}
                      onChange={(e) =>
                        setForm({ ...form, watermark_enabled: e.target.checked })
                      }
                    />
                    {t("enableWatermark")}
                  </label>
                  {form.watermark_enabled && (
                    <input
                      className="input mt-3"
                      placeholder={t("watermarkText")}
                      value={form.watermark_text}
                      onChange={(e) =>
                        setForm({ ...form, watermark_text: e.target.value })
                      }
                    />
                  )}
                  <p className="mt-2 text-xs" style={{ color: "var(--text3)" }}>
                    Bật watermark để chữ tự gắn lên ảnh khi khách xem (kể cả ảnh phóng to) — chống chụp màn hình.
                  </p>
                </div>
              ) : (
                <div className="rounded-md border border-ink-800 p-3">
                  <p className="text-sm text-accent">{t("enableWatermark")}</p>
                  <p className="mt-2 text-xs" style={{ color: "var(--text3)" }}>
                    Watermark có ở gói <strong>Photographer Plus</strong> và <strong>Studio</strong>.
                    Ảnh không watermark được tải thẳng từ Google Drive nên nhanh hơn và
                    không giới hạn lượt tải.
                  </p>
                </div>
              )}

              <label className="flex items-center gap-2 rounded-md border border-ink-800 p-3 text-sm text-accent">
                <input
                  type="checkbox"
                  checked={form.download_enabled}
                  onChange={(e) => setForm({ ...form, download_enabled: e.target.checked })}
                />
                Cho phép khách tải ảnh xuống
              </label>

              {canDelivery && canWatermark && (
                <label className="flex items-center gap-2 rounded-md border border-ink-800 p-3 text-sm text-accent">
                  <input
                    type="checkbox"
                    checked={form.watermark_delivery}
                    onChange={(e) => setForm({ ...form, watermark_delivery: e.target.checked })}
                  />
                  Watermark cả ở giai đoạn Giao khách
                </label>
              )}

              {/* "Show on homepage" only applies to the delivery phase. */}
              {phase === "delivery" && canPinHome && (
                <label className="flex items-center gap-2 rounded-md border border-ink-800 p-3 text-sm text-accent">
                  <input
                    type="checkbox"
                    checked={form.gallery_pinned}
                    onChange={(e) => setForm({ ...form, gallery_pinned: e.target.checked })}
                  />
                  Hiện ở trang chủ công khai (khách xem không cần mật khẩu)
                </label>
              )}
              {phase === "delivery" && canDelivery && !canPinHome && (
                <Link href="/dashboard/upgrade" className="flex items-center gap-2 rounded-md border border-ink-800 p-3 text-sm" style={{ color: "var(--text3)" }}>
                  🔒 Hiện ở trang chủ công khai — nâng cấp gói Photographer/Studio
                </Link>
              )}

              <div>
                <label className="label">Loại album (phân loại)</label>
                <input
                  className="input"
                  list="album-category-presets"
                  placeholder="VD: Cưới, Sự kiện, Doanh nghiệp…"
                  value={form.category_label}
                  onChange={(e) => {
                    const label = e.target.value;
                    setForm({ ...form, category_label: label, category: slugifyVi(label) });
                  }}
                />
                <datalist id="album-category-presets">
                  {/* Loại của CHÍNH studio đã dùng (ưu tiên), rồi tới gợi ý mẫu. */}
                  {studioCats.map((c) => (
                    <option key={`s-${c.slug}`} value={c.label} />
                  ))}
                  {CATEGORY_PRESETS.filter((p) => !studioCats.some((c) => c.slug === p.slug)).map((c) => (
                    <option key={`p-${c.slug}`} value={c.label} />
                  ))}
                </datalist>
                <p className="mt-1 text-xs text-accent-muted">
                  Tự đặt loại theo ý bạn — loại mới sẽ tự lưu để chọn cho album khác.{" "}
                  <Link href="/dashboard/studio/album-categories" className="underline">Quản lý loại album</Link>
                </p>
              </div>

              <div>
                <label className="label">{t("status")}</label>
                <select
                  className="input"
                  value={form.status}
                  onChange={(e) =>
                    setForm({ ...form, status: e.target.value as Album["status"] })
                  }
                >
                  <option value="draft">{t("draft")}</option>
                  <option value="published">{t("published")}</option>
                </select>
              </div>

              <button
                onClick={saveSettings}
                disabled={saving}
                className="btn-primary w-full"
              >
                <Save size={15} /> {saving ? t("saving") : t("save")}
              </button>

              {/* Password */}
              <div className="rounded-md border border-ink-800 p-3">
                <label className="label">{t("albumPassword")}</label>
                <p className="mb-2 text-xs text-accent-muted">{t("passwordHint")}</p>
                <input
                  type="text"
                  className="input"
                  placeholder={hasPassword ? "•••••• (đã đặt)" : ""}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <button onClick={savePassword} className="btn-ghost mt-3 w-full text-xs">
                  {hasPassword && !newPassword ? t("remove") : t("save")}
                </button>
              </div>
            </div>
            </>
          )}

          {/* Giao khách: đổi giai đoạn, link ảnh đã chỉnh, tải bản gốc */}
          {tab === "deliver" && (
            <>
            {/* Project phase: which set of photos the client link currently shows. */}
            <div className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full"
                  style={phase === "delivery"
                    ? { background: "color-mix(in srgb, var(--success) 15%, transparent)", color: "var(--success)" }
                    : { background: "color-mix(in srgb, var(--gold) 15%, transparent)", color: "var(--gold)" }}
                >
                  {phase === "delivery" ? <PackageCheck size={18} /> : <Images size={18} />}
                </span>
                <div>
                  <p className="text-sm font-medium text-accent">
                    Giai đoạn hiện tại: {phase === "delivery" ? "Giao khách (ảnh hoàn thiện)" : "Chọn ảnh (ảnh gốc)"}
                  </p>
                  <p className="text-xs" style={{ color: "var(--text3)" }}>
                    {phase === "delivery"
                      ? "Khách đang xem & tải ảnh hoàn thiện qua link dự án."
                      : "Khách đang chọn ảnh gốc qua link dự án."}
                  </p>
                </div>
              </div>
              {canDelivery ? (
                <button
                  onClick={() => switchPhase(phase === "delivery" ? "selection" : "delivery")}
                  disabled={phaseBusy}
                  className="btn-ghost whitespace-nowrap"
                >
                  {phase === "delivery" ? (
                    <><ArrowLeft size={15} /> Về giai đoạn Chọn ảnh</>
                  ) : (
                    <>Chuyển sang Giao khách <ArrowRight size={15} /></>
                  )}
                </button>
              ) : phase === "delivery" ? (
                // Stuck in delivery on a plan that no longer allows it — let them out.
                <button onClick={() => switchPhase("selection")} disabled={phaseBusy} className="btn-ghost whitespace-nowrap">
                  <ArrowLeft size={15} /> Về giai đoạn Chọn ảnh
                </button>
              ) : (
                <Link href="/dashboard/upgrade" className="btn-ghost whitespace-nowrap" title="Nâng cấp để dùng giao khách">
                  🔒 Giao khách (nâng cấp gói)
                </Link>
              )}
            </div>

            {/* Hạn lưu trữ ảnh gốc — chỉ có nghĩa sau khi đã giao khách.
                Hệ thống KHÔNG tự xoá gì: nó nhắc trước hạn, còn dọn Drive hay
                gia hạn là quyết định của studio. */}
            {album.delivered_at && (() => {
              const st = storageState(storageDate);
              const tone =
                st === "expired" ? { fg: "var(--s-red)", bg: "color-mix(in srgb, var(--s-red) 12%, transparent)" }
                : st === "warn" ? { fg: "var(--s-amber)", bg: "color-mix(in srgb, var(--s-amber) 12%, transparent)" }
                : { fg: "var(--text2)", bg: "var(--surface2)" };
              return (
                <div className="card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-medium text-accent">
                        <HardDrive size={16} /> Lưu trữ ảnh gốc trên Drive
                      </p>
                      <p className="mt-1 text-xs" style={{ color: "var(--text3)" }}>
                        Giao khách ngày {fmtDate(album.delivered_at.slice(0, 10))}
                        {storageDate ? ` · dự kiến dọn ảnh gốc ngày ${fmtDate(storageDate)}` : ""}
                      </p>
                    </div>
                    <span className="flex-none rounded-full px-2.5 py-1 text-[11.5px] font-semibold" style={{ background: tone.bg, color: tone.fg }}>
                      {storageLabel(storageDate)}
                    </span>
                  </div>
                  <p className="mt-3 text-[11.5px]" style={{ color: "var(--text3)" }}>
                    mstudo không tự xoá ảnh. Tới hạn bạn sẽ được nhắc để tự dọn thư mục gốc trên Drive, hoặc gia hạn thêm.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {STORAGE_EXTEND_CHOICES.map((m) => (
                      <button key={m} onClick={() => extendStorage(m)} disabled={storageBusy} className="btn-ghost px-3 py-1.5 text-xs">
                        + {m} tháng
                      </button>
                    ))}
                    {storageDate && (
                      <button onClick={clearStorage} disabled={storageBusy} className="btn-ghost px-3 py-1.5 text-xs" style={{ color: "var(--text3)" }}>
                        Giữ vô thời hạn
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}
            {/* Delivery phase: studio pastes the EDITED-photos folder link. Those photos
                are what the client sees in the delivery gallery; the originals the client
                picked earlier auto-surface as the "File gốc" button (see getOriginalFolders). */}
            {(phase === "delivery" || manualContract) && (
              <div className="card p-5">
                <label className="label">Link ảnh đã chỉnh sửa (hiện cho khách ở album giao)</label>
                {phase !== "delivery" && (
                  <p className="mb-2 text-[11.5px]" style={{ color: "var(--tx2)" }}>
                    Dán link ảnh hoàn thiện trước, rồi bấm <b>“Chuyển sang Giao khách”</b> ở trên — khách nhận ảnh trên chính album này.
                  </p>
                )}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    className="input flex-1"
                    placeholder="Dán link thư mục Google Drive ảnh đã chỉnh sửa…"
                    value={editedUrl}
                    onChange={(e) => setEditedUrl(e.target.value)}
                  />
                  <button
                    onClick={saveDeliveryLink}
                    disabled={deliveryBusy || syncing || !editedUrl.trim()}
                    className="btn-primary whitespace-nowrap"
                  >
                    {deliveryBusy ? "Đang lưu…" : "Lưu & đồng bộ"}
                  </button>
                </div>
                <p className="mt-2 text-[11px]" style={{ color: "var(--text3)" }}>
                  Ảnh trong thư mục này sẽ hiện ở album giao khách. Ảnh gốc khách đã chọn ở
                  giai đoạn trước tự thành nút <b>“Ảnh gốc”</b> để khách xem/tải trên
                  Drive. Thư mục cần chia sẻ ở chế độ “ai có link xem được”. Nếu thư mục
                  có <b>thư mục con</b>, mỗi thư mục con tự thành một mục riêng ở album giao khách.
                </p>

                {/* Thư mục con đã tách được — studio nhìn là biết album giao khách
                    đang chia thành mấy mục và mỗi mục bao nhiêu ảnh. */}
                {deliveryFolders.length > 1 && (
                  <div className="mt-3 rounded-[10px] p-3" style={{ background: "var(--sf2)" }}>
                    <p className="mb-1.5 text-[11.5px] font-semibold" style={{ color: "var(--tx2)" }}>
                      Thư mục giao khách đã tách riêng ({deliveryFolders.length})
                    </p>
                    <ul className="space-y-1">
                      {deliveryFolders.map((f) => (
                        <li key={f.id} className="flex items-center gap-1.5 text-[11.5px]" style={{ color: "var(--tx3)" }}>
                          <FolderOpen size={13} className="flex-none" />
                          <span className="truncate">{f.name}</span>
                          <span className="flex-none font-semibold">
                            · {photos.filter((ph) => ph.source_id === f.id).length} ảnh
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Nói thẳng nút "Tải file chỉnh sửa" bên album khách đã hiện chưa và
                    còn thiếu gì — ba điều kiện nằm ở ba màn hình khác nhau, không nói
                    ra thì studio không có cách nào đoán. */}
                {(() => {
                  const missing = deliveryMissing;
                  return (
                    <p
                      className="mt-2 rounded-lg px-2.5 py-1.5 text-[11px]"
                      style={
                        missing.length
                          ? { background: "color-mix(in srgb, var(--s-amber) 12%, transparent)", color: "var(--s-amber)" }
                          : { background: "color-mix(in srgb, var(--s-green) 12%, transparent)", color: "var(--s-green)" }
                      }
                    >
                      {missing.length
                        ? `Nút “Tải file chỉnh sửa” CHƯA hiện với khách — ${missing.join("; ")}.`
                        : "Nút “Tải file chỉnh sửa” đang hiện ở đầu album giao khách."}
                    </p>
                  );
                })()}
              </div>
            )}

            {/* Ảnh in tặng: khách chọn ở album giao khách → studio chép vào thư mục
                "Ảnh in" trong thư mục giao file hoàn thiện. */}
            {/* Album chọn ảnh có album giao riêng (deliveryTwin): khách chọn ảnh in
                bên album kia, thẻ chỉ hiện ở đó. */}
            {printInfo && !deliveryTwin && (
              <AlbumPrintPanel
                albumId={album.id}
                albumSlug={album.slug}
                info={printInfo}
                photos={photos}
                hasDeliveryFolder={sources.some((x) => x.stage === "delivery" && !!x.drive_url)}
              />
            )}

            {/* Delivery phase: download the finished album at ORIGINAL quality from Drive. */}
            {phase === "delivery" && deliveryFolders.length > 0 && (
              <div className="card p-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full" style={{ background: "color-mix(in srgb, var(--success) 15%, transparent)", color: "var(--success)" }}>
                    <HardDriveDownload size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-accent">Tải album gốc từ Drive</p>
                    <p className="mb-3 text-xs" style={{ color: "var(--text3)" }}>
                      Tải toàn bộ ảnh giao khách ở chất lượng gốc (không nén, không watermark) trực tiếp
                      từ Google Drive — Google tự nén và phục vụ, không tốn băng thông máy chủ.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {deliveryFolders.map((s) => (
                        <a
                          key={s.id}
                          href={s.drive_url}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-ghost"
                          title="Mở thư mục trên Google Drive để tải trực tiếp (không tốn băng thông máy chủ)"
                        >
                          <FolderOpen size={15} /> Mở thư mục Drive{deliveryFolders.length > 1 ? ` · ${s.name}` : ""}
                        </a>
                      ))}
                    </div>
                    {deliveryFolders.length > 0 && (
                      <p className="mt-2 text-[11px]" style={{ color: "var(--text3)" }}>
                        Mẹo: “Mở thư mục Drive” cho phép tải cả album trực tiếp từ Google (nhanh & không tốn băng thông máy chủ).
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            </>
          )}

        </div>
      </div>
    </div>
  );
}

/**
 * Tab "Khách chia sẻ": mỗi link "chia sẻ ảnh đã chọn" khách gửi cho người khác
 * (người thân, thợ in…) kèm đúng những ảnh trong link — studio chép mã ảnh để
 * biết khách đang khoe/gửi in những tấm nào.
 */
function SharesPanel({ shares, photos, slug, baseUrl }: { shares: CustomerShare[]; photos: Photo[]; slug: string; baseUrl: string }) {
  const byId = useMemo(() => {
    const m = new Map<string, Photo>();
    for (const p of photos) {
      m.set(p.id, p);
      if (p.drive_file_id) m.set(p.drive_file_id, p);
    }
    return m;
  }, [photos]);

  if (shares.length === 0) {
    return (
      <div className="card p-6 text-center text-[13px]" style={{ color: "var(--tx2)" }}>
        Khách chưa tạo link chia sẻ nào. Khi khách chọn vài ảnh rồi bấm <b>“Chia sẻ ảnh đã chọn”</b> trên album,
        link đó và mã các ảnh trong link sẽ hiện ở đây.
      </div>
    );
  }

  return (
    <>
      {shares.map((sh) => {
        const list = sh.photoIds.map((id) => byId.get(id)).filter((p): p is Photo => !!p);
        const missing = sh.photoIds.length - list.length;
        const url = `${baseUrl}?s=${sh.token}`;
        return (
          <div key={sh.token} className="card p-5">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <div className="min-w-0">
                <p className="text-[13.5px] font-semibold">Link chia sẻ · {list.length} ảnh</p>
                <p className="text-[11.5px]" style={{ color: "var(--tx3)" }}>
                  Tạo lúc {fmtDateTime(sh.createdAt)}
                  {missing > 0 && ` · ${missing} ảnh không còn trong album`}
                </p>
              </div>
              <div className="ml-auto flex flex-wrap items-center gap-1.5">
                <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-[9px] px-3 py-2 text-[12.5px] font-semibold" style={{ background: "var(--acS)", color: "var(--ac)" }}>
                  <ExternalLink size={15} /> Mở link
                </a>
                <PhotoCodeButtons names={list.map((p) => p.name)} fileName={`${slug}-chia-se-${sh.token}`} />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
              {list.map((p) => (
                <figure key={p.id} className="min-w-0">
                  <div className="aspect-square overflow-hidden rounded-md" style={{ background: "var(--sf2)" }}>
                    <img src={thumbnailUrl(p.drive_file_id, 240)} alt={p.name} loading="lazy" className="h-full w-full object-cover" />
                  </div>
                  <figcaption className="mt-0.5 truncate text-[10.5px]" style={{ color: "var(--tx3)" }} title={p.name}>
                    {stripExtension(p.name)}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}
