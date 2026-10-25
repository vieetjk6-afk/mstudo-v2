"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ArrowLeft, ArrowLeftRight, CheckCircle2, ExternalLink, FileText, Filter, FolderOpen, Heart, Images, ListChecks, Lock,
  MousePointerClick, PackageCheck, Printer, RefreshCw, Save, Send, Settings2, Share2, Trash2,
} from "lucide-react";
import { fmtDate } from "@/lib/date";
import { Badge, Callout, Stack, btn, iconBtn } from "@/components/v2/kit";
import { Menu, Tabs, type MenuItem } from "@/components/v2/kit-client";
import { useAlbumEditor, type AlbumEditorProps } from "./useAlbumEditor";
import { Thumb, Toast } from "./album-v2-parts";
import { PhotosTabV2, SourcesDrawerV2 } from "./AlbumPhotosV2";
import { DeliverTabV2, PicksTabV2, SettingsTabV2, ShareTabV2 } from "./AlbumTabsV2";
import AlbumPrintPanelV2 from "./AlbumPrintPanelV2";

const FilterDialog = dynamic(() => import("@/components/FilterDialog"), { ssr: false });

/* ═══════════════════════════════════════════════════════════════════════════
   CHI TIẾT ALBUM — giao diện mới. Cùng dữ liệu, cùng thao tác với AlbumEditor
   (bản cũ, logic chung ở ./useAlbumEditor); khác ở cách sắp xếp:
     • Thẻ đầu: ảnh bìa, tên, nhãn giai đoạn/trạng thái, số ảnh + lượt chọn,
       MỘT nút chính theo việc tiếp theo ("Gửi cho khách", hoặc "Lọc ảnh" khi
       khách đã chốt), còn lại vào menu ⋯ (đồng bộ, nguồn Drive, đổi giai
       đoạn, xoá). Hợp đồng gắn album nằm ở dải dưới cùng của thẻ.
     • Tab: Ảnh · Khách chọn · Chia sẻ · Giao khách · Ảnh in · Cài đặt. Nguồn
       ảnh Drive mở bằng ngăn kéo từ tab Ảnh (không còn là tab riêng).
     • Cài đặt chia khối + công tắc; có thay đổi là hiện thanh "Lưu" dính đáy
       màn (ở mọi tab, để không mất thay đổi khi chuyển tab).
   ═══════════════════════════════════════════════════════════════════════════ */

export type TabV2 = "photos" | "picked" | "share" | "deliver" | "print" | "settings";

export default function AlbumEditorV2({
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
  const e = useAlbumEditor({
    album, initialSources, initialPhotos, canDelivery, canPinHome, canWatermark, studioName, studioHost,
    selections, storageMonths, deliveryTwin, linkedContract,
  });
  // Album chọn ảnh có album giao riêng (deliveryTwin): khách chọn ảnh in bên kia.
  const hasPrint = !!printInfo && !deliveryTwin;

  const [tab, setTab] = useState<TabV2>(() => {
    // Giữ được các ?tab=… của bản cũ (thông báo, link từ màn khác).
    if (initialTab === "shares") return "share";
    if (initialTab === "sources") return "photos";
    // Thông báo "khách gửi ảnh in" mở ?tab=deliver — bản mới có tab riêng.
    if (initialTab === "deliver") return hasPrint && (printInfo?.picks.length ?? 0) > 0 ? "print" : "deliver";
    if (initialTab === "print" && !hasPrint) return "deliver";
    return (["photos", "picked", "share", "deliver", "print", "settings"] as const).includes(initialTab as TabV2) ? (initialTab as TabV2) : "photos";
  });
  const [sourcesOpen, setSourcesOpen] = useState(initialTab === "sources");
  const [filterOpen, setFilterOpen] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);

  function go(next: TabV2) {
    setTab(next);
    requestAnimationFrame(() => tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  const saved = e.savedForm;
  const isDelivery = e.phase === "delivery";
  const doneAt = (album as { selection_done_at?: string | null }).selection_done_at ?? null;
  const done = !isDelivery && !!doneAt && selections.length > 0;
  const canFilter = !isDelivery;
  const coverFile = e.photos[0]?.drive_file_id ?? null;

  const primary = done ? (
    <button type="button" onClick={() => setFilterOpen(true)} className={btn("primary")}>
      <Filter size={16} /> Lọc ảnh
    </button>
  ) : (
    <button type="button" onClick={() => go("share")} className={btn("primary")}>
      <Send size={16} /> Gửi cho khách
    </button>
  );
  const secondary = done ? (
    <button type="button" onClick={() => go("share")} className={btn("secondary")}>
      <Send size={16} /> Gửi cho khách
    </button>
  ) : canFilter && selections.length > 0 ? (
    <button type="button" onClick={() => setFilterOpen(true)} className={btn("secondary")}>
      <Filter size={16} /> Lọc ảnh
    </button>
  ) : null;

  const menuItems: MenuItem[] = [
    { label: "Lựa chọn chi tiết", hint: "Ghi chú, ảnh khách không thích", icon: ListChecks, href: `/dashboard/albums/${album.id}/selections` },
    ...(canFilter && !secondary && !done ? [{ label: "Lọc ảnh", hint: "Chép ảnh khách chọn sang thư mục khác", icon: Filter, onClick: () => setFilterOpen(true) }] : []),
    "divider",
    { label: "Nguồn ảnh Google Drive", hint: `${e.sources.length} nguồn`, icon: FolderOpen, onClick: () => setSourcesOpen(true) },
    {
      label: e.syncing ? "Đang đồng bộ…" : "Đồng bộ lại từ Drive",
      icon: RefreshCw,
      onClick: () => void e.sync(),
      disabled: e.syncing || e.sources.length === 0,
    },
    ...(canDelivery || isDelivery
      ? ([
          "divider",
          {
            label: isDelivery ? "Về giai đoạn Chọn ảnh" : "Chuyển sang Giao khách",
            icon: ArrowLeftRight,
            onClick: () => void e.switchPhase(isDelivery ? "selection" : "delivery"),
            disabled: e.phaseBusy,
          },
        ] as MenuItem[])
      : []),
    "divider",
    { label: e.deleting ? "Đang xoá…" : "Xoá album", icon: Trash2, danger: true, onClick: () => void e.deleteAlbum(), disabled: e.deleting },
  ];

  const tools = (
    <>
      <a href={e.clientLink} target="_blank" rel="noreferrer" className={iconBtn()} aria-label="Mở trang khách" title="Mở trang khách">
        <ExternalLink size={17} />
      </a>
      <Menu label="Thêm thao tác với album" width={250} items={menuItems} />
    </>
  );

  const tabs = [
    { value: "photos" as const, label: "Ảnh", icon: Images, count: e.photos.length },
    { value: "picked" as const, label: "Khách chọn", icon: Heart, count: selections.length },
    { value: "share" as const, label: "Chia sẻ", icon: Share2 },
    { value: "deliver" as const, label: "Giao khách", icon: PackageCheck },
    ...(hasPrint ? [{ value: "print" as const, label: "Ảnh in", icon: Printer, count: printInfo!.picks.length || undefined }] : []),
    { value: "settings" as const, label: "Cài đặt", icon: Settings2 },
  ];

  return (
    <Stack>
      <Link href="/dashboard/albums" className="inline-flex w-fit items-center gap-1.5 text-[13px] font-medium" style={{ color: "var(--tx3)" }}>
        <ArrowLeft size={15} /> Thư viện album
      </Link>

      {/* ── Thẻ đầu: album nào, đang ở đâu, việc tiếp theo ───────────────── */}
      <div className="v2-card overflow-hidden">
        <div className="flex flex-col gap-4 p-4 sm:p-5 md:flex-row md:items-center">
          <div className="flex min-w-0 flex-1 items-start gap-3.5 sm:gap-4">
            <div className="relative h-[68px] w-[68px] flex-none overflow-hidden rounded-[12px] sm:h-[84px] sm:w-[112px]" style={{ background: "var(--sf2)" }}>
              <Thumb src={e.form.cover_url} fileId={coverFile} alt={`Ảnh bìa ${e.form.title}`} w={480} eager />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-1">
                <h1
                  className="line-clamp-2 min-w-0 flex-1 text-[18px] font-bold leading-snug md:truncate md:text-[21px] md:leading-tight"
                  style={{ letterSpacing: "-0.3px" }}
                  title={e.form.title}
                >
                  {e.form.title || "Album chưa đặt tên"}
                </h1>
                {/* Điện thoại: nút phụ lên góc thẻ, hàng dưới chỉ còn hai nút chữ. */}
                <div className="-mr-2 -mt-1.5 flex flex-none items-center md:hidden">{tools}</div>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {isDelivery ? (
                  <Badge tone="blue" icon={Send}>Giao khách</Badge>
                ) : (
                  <Badge tone="brand" icon={MousePointerClick}>Chọn ảnh</Badge>
                )}
                {saved.status === "published" ? (
                  <Badge tone="green" dot>Đã xuất bản</Badge>
                ) : (
                  <Badge tone="gray" dot>Nháp</Badge>
                )}
                {done ? <Badge tone="green" icon={CheckCircle2}>Khách đã chốt</Badge> : null}
                {e.hasPassword ? <Badge tone="gray" icon={Lock}>Có mật khẩu</Badge> : null}
              </div>
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px]" style={{ color: "var(--tx2)" }}>
                <span><b className="v2-num" style={{ color: "var(--tx)" }}>{e.photos.length.toLocaleString("vi-VN")}</b> ảnh</span>
                <span>
                  <b className="v2-num" style={{ color: selections.length ? "var(--ac)" : "var(--tx)" }}>{selections.length.toLocaleString("vi-VN")}</b> lượt chọn
                  {e.pickSessions.length > 1 ? <span style={{ color: "var(--tx3)" }}> · {e.pickSessions.length} mã</span> : null}
                </span>
                <span className="hidden sm:inline" style={{ color: "var(--tx3)" }}>Tạo {fmtDate(album.created_at)}</span>
              </p>
            </div>
          </div>

          <div className={`grid w-full gap-2 md:flex md:w-auto md:items-center ${secondary ? "grid-cols-2" : "grid-cols-1"}`}>
            {primary}
            {secondary}
            <div className="hidden items-center md:flex">{tools}</div>
          </div>
        </div>

        {/* Album thuộc hợp đồng nào — dải cuối thẻ, không chiếm một khối riêng. */}
        {linkedContract && (
          <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:px-5" style={{ borderTop: "1px solid var(--bd2)", background: "var(--sf2)" }}>
            <div className="flex min-w-0 flex-1 items-start gap-2.5">
              <FileText size={16} className="mt-0.5 flex-none" style={{ color: "var(--tx3)" }} />
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold">
                  Album của hợp đồng {linkedContract.code ? `${linkedContract.code} · ` : ""}{linkedContract.title}
                </p>
                <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>
                  {e.manualContract
                    ? "Hợp đồng dùng link ảnh riêng: link ảnh chọn ở “Nguồn ảnh Drive”, link ảnh hoàn thiện ở tab Giao khách. Cùng album này dùng để khách chọn rồi nhận ảnh."
                    : linkedContract.albumMode === "desktop"
                      ? "Album mặc định, ảnh tự đồng bộ từ mstudo desktop qua thư mục Drive của hợp đồng."
                      : "Album gắn với hợp đồng này."}
                </p>
                {e.manualContract && linkedContract.status === "completed" && !isDelivery && (
                  <p className="mt-0.5 text-[12.5px] font-semibold" style={{ color: "var(--am)" }}>
                    Hợp đồng đã hoàn thành, dán link ảnh hoàn thiện để giao khách.
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-none flex-wrap gap-2 pl-[26px] sm:pl-0">
              {e.manualContract && (
                <button
                  type="button"
                  onClick={() => (isDelivery || linkedContract.status === "completed" ? go("deliver") : setSourcesOpen(true))}
                  className={btn("secondary", "sm")}
                >
                  Dán link ảnh
                </button>
              )}
              <Link href={`/dashboard/studio/contracts/${linkedContract.id}?tab=album`} className={btn("ghost", "sm")}>
                Mở hợp đồng
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Hợp đồng đồng bộ Drive có HAI album: khi album giao khách đã sẵn sàng,
          link khách của album chọn ảnh tự chuyển sang đó. Nói thẳng ra. */}
      {e.twinTakesOver && deliveryTwin && (
        <Callout
          tone="amber"
          icon={ArrowLeftRight}
          title="Link khách đang mở album giao khách"
          action={
            <div className="flex flex-wrap gap-2">
              <Link href={`/dashboard/albums/${deliveryTwin.id}`} className={btn("secondary", "sm")}>
                Mở album giao
              </Link>
              <button type="button" onClick={e.twinBackToSelection} disabled={e.twinBusy} className={btn("soft", "sm")}>
                <ArrowLeft size={15} /> {e.twinBusy ? "Đang đổi…" : "Về Chọn ảnh"}
              </button>
            </div>
          }
        >
          Hợp đồng đã có album “{deliveryTwin.title}”, nên link khách của album chọn ảnh này tự chuyển sang đó. Hậu kỳ chưa
          xong thì đưa về để khách chọn ảnh tiếp.
        </Callout>
      )}

      <div ref={tabsRef} className="flex flex-col gap-4" style={{ scrollMarginTop: 80 }}>
        <Tabs<TabV2> label="Nội dung album" value={tab} onChange={setTab} options={tabs} />

        {tab === "photos" && (
          <PhotosTabV2
            e={e}
            slug={album.slug}
            selections={selections}
            onOpenSources={() => setSourcesOpen(true)}
            onPickedTab={() => go("picked")}
          />
        )}
        {tab === "picked" && (
          <PicksTabV2
            e={e}
            albumId={album.id}
            selections={selections}
            canFilter={canFilter}
            onFilter={() => setFilterOpen(true)}
            onShare={() => go("share")}
          />
        )}
        {tab === "share" && (
          <ShareTabV2
            e={e}
            album={album}
            customerShares={customerShares}
            studioHost={studioHost}
            clientPhone={clientPhone}
            clientName={clientName}
            contractId={contractId}
            zaloSavedName={zaloSavedName}
          />
        )}
        {tab === "deliver" && (
          <DeliverTabV2 e={e} album={album} canDelivery={canDelivery} onPrint={hasPrint ? () => go("print") : undefined} />
        )}
        {tab === "print" && hasPrint && (
          <AlbumPrintPanelV2
            albumId={album.id}
            albumSlug={album.slug}
            info={printInfo!}
            photos={e.photos}
            hasDeliveryFolder={e.sources.some((x) => x.stage === "delivery" && !!x.drive_url)}
            onToast={e.flash}
          />
        )}
        {tab === "settings" && (
          <SettingsTabV2
            e={e}
            phase={e.phase}
            canDelivery={canDelivery}
            canPinHome={canPinHome}
            canWatermark={canWatermark}
            studioCats={studioCats}
            studioHost={studioHost}
          />
        )}
      </div>

      {/* Thanh lưu dính đáy: hiện ở MỌI tab khi cài đặt có thay đổi chưa lưu. */}
      {e.dirty && (
        <div className="sticky bottom-[84px] z-40 lg:bottom-5">
          <div className="v2-card flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3" style={{ boxShadow: "var(--sh-pop)" }}>
            <span className="h-2 w-2 flex-none rounded-full" style={{ background: "var(--am)" }} />
            <p className="min-w-0 flex-1 text-[13.5px] font-semibold">
              Cài đặt có thay đổi chưa lưu
              {tab !== "settings" ? (
                <button type="button" onClick={() => go("settings")} className="ml-2 text-[12.5px] font-semibold" style={{ color: "var(--ac)" }}>
                  Xem lại
                </button>
              ) : null}
            </p>
            <div className="flex w-full gap-2 sm:w-auto">
              <button type="button" onClick={e.resetForm} disabled={e.saving} className={btn("ghost", "md", "flex-1 sm:flex-none")}>
                Huỷ thay đổi
              </button>
              <button type="button" onClick={e.saveSettings} disabled={e.saving} className={btn("primary", "md", "flex-1 sm:flex-none")}>
                <Save size={16} /> {e.saving ? "Đang lưu…" : "Lưu thay đổi"}
              </button>
            </div>
          </div>
        </div>
      )}

      <SourcesDrawerV2 e={e} open={sourcesOpen} onClose={() => setSourcesOpen(false)} canDelivery={canDelivery} />
      {filterOpen && <FilterDialog albumId={album.id} albumTitle={e.form.title} onClose={() => setFilterOpen(false)} />}
      {e.msg && <Toast>{e.msg}</Toast>}
    </Stack>
  );
}
