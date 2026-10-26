"use client";

import { useMemo, useState } from "react";
import {
  Check,
  CheckCircle2,
  Copy,
  Download,
  FileText,
  FolderDown,
  ImageOff,
  Languages,
  MousePointerClick,
  RotateCcw,
  ScanFace,
  Send,
  Share2,
  Sparkles,
  ThumbsDown,
  Undo2,
  X,
} from "lucide-react";
import { useTheme } from "@/lib/theme";
import { useLang } from "@/lib/i18n";
import { stripExtension } from "@/lib/drive";
import { downloadImage } from "@/lib/download";
import { useMasonry } from "@/lib/masonry";
import { useGridThumbWidth } from "@/lib/use-img-width";
import { watermarkLayer } from "@/lib/album-watermark";
import { syncBadge } from "@/lib/album-offline";
import InstallPwaButton from "@/components/InstallPwaButton";
import ShareDialog from "@/components/ShareDialog";
import DriveFolderLinks from "@/components/DriveFolderLinks";
import { CustomerHeaderV2, CustomerRootV2 } from "@/components/v2/customer";
import { Callout, Empty, GroupLabel, Progress, btn, iconBtn, inputCls } from "@/components/v2/kit";
import { Menu, Modal, Segmented, type MenuItem } from "@/components/v2/kit-client";
import { useCustomerAlbum, type CustomerAlbumProps } from "./useCustomerAlbum";
import { useFaceSearch } from "./useFaceSearch";
import { useDuplicateScan } from "./useDuplicateScan";
import FaceFinderV2, { FaceAvatar, faceToolAvailable } from "./FaceFinderV2";
import DuplicatesV2 from "./DuplicatesV2";
import { AlbumHeroV2, ChipRow, ChipV2, LangToggleV2, LockScreenV2, SelectDot, ToastV2, ViewerV2, useAlbumImg } from "./album-v2-ui";

/* ═══════════════════════════════════════════════════════════════════════════
   ALBUM CHỌN ẢNH (/a/[slug]) — giao diện mới. Cùng dữ liệu, cùng hành vi với
   CustomerAlbum (bản cũ; logic chung ở ./useCustomerAlbum). Khác ở cách sắp:
     • Đầu trang thương hiệu studio; ảnh bìa là một dải vừa phải, không còn
       chiếm trọn màn hình — khách thấy ngay lưới ảnh.
     • Thanh chọn ảnh DÍNH ĐÁY màn (vùng ngón cái): "Đã chọn 12/30", thanh
       tiến độ, trạng thái lưu, và MỘT nút chính "Đã chọn xong".
     • Bộ lọc gọn một hàng: Tất cả / Chưa chọn / Đã chọn / Không thích; thư mục
       là hàng chip; tìm theo khuôn mặt và ảnh na ná nhau mở bằng ngăn kéo; việc
       ít dùng (chép / xuất danh sách, chia sẻ, tải ảnh gốc, bỏ chọn hết) vào ⋯.
     • Lưới ảnh tràn mép trên điện thoại, vòng chọn 44px ở góc ô, ảnh đã chọn
       có viền + dấu tích.
     • Khung xem toàn màn hình: Không thích · Ghi chú · Chọn ảnh to ở đáy.
   ═══════════════════════════════════════════════════════════════════════════ */

type Seg = "all" | "unpicked" | "selected" | "disliked";

export default function CustomerAlbumV2(props: CustomerAlbumProps) {
  const { album, shareIds, studioName = "Studio", logoUrl = null } = props;
  const a = useCustomerAlbum(props);
  const { t } = a;
  const { theme } = useTheme();
  const { lang, setLang } = useLang();
  const img = useAlbumImg();
  const brand = { name: studioName, logoUrl };

  /** Ngăn kéo công cụ đang mở. */
  const [tool, setTool] = useState<"faces" | "dups" | null>(null);
  /** Ô ghi chú trong khung xem (điện thoại). Máy tính có cột ghi chú riêng. */
  const [noteOpen, setNoteOpen] = useState(false);

  // Đường "gửi ảnh của bạn" và lượt quét ảnh trùng giữ ở ĐÂY (không trong ngăn
  // kéo) để khách đóng ngăn kéo giữa chừng vẫn không mất kết quả / tiến độ.
  const face = useFaceSearch({
    slug: album.slug,
    password: a.password,
    onPick: (id) => {
      a.setPersonId(id);
      if (id) {
        setTool(null);
        a.flashToast(t("faceFound"));
      }
    },
  });
  const dup = useDuplicateScan({
    photos: a.photos,
    disliked: a.disliked,
    groups: a.dupGroups,
    onGroups: (g) => {
      a.setDupGroups(g);
      // Quét xong và CÓ nhóm → ẩn bớt bản trùng ngay (giống bản cũ).
      a.setHideDupes(!!g && g.length > 0);
    },
  });

  // Lưới: 2 cột điện thoại, 4 cột máy tính, đặt ảnh trái → phải (xem @/lib/masonry).
  const gridW = useGridThumbWidth(2, 4);
  const masonry = useMasonry(2, 4, (id) => {
    const f = a.driveIdOf.get(id);
    return f ? img.thumb(f, gridW) : null;
  });

  const { photos, selected, disliked } = a;
  const counts = useMemo(() => {
    let kept = 0;
    let unpicked = 0;
    for (const p of photos) {
      if (disliked.has(p.id)) continue;
      kept++;
      if (!selected.has(p.id)) unpicked++;
    }
    return { kept, unpicked };
  }, [photos, selected, disliked]);

  // ── Album có mật khẩu ──
  if (!a.unlocked) {
    return (
      <LockScreenV2
        theme={theme}
        brand={brand}
        headerRight={<LangToggleV2 />}
        title={album.title}
        desc={t("enterPassword")}
        value={a.password}
        onChange={a.setPassword}
        onSubmit={a.unlock}
        error={a.pwError ? t("wrongPassword") : null}
        loading={a.pwLoading}
        submitLabel={t("enter")}
        loadingLabel={t("loading")}
      />
    );
  }

  const seg: Seg = a.view === "selected" ? "selected" : a.view === "disliked" ? "disliked" : a.onlyUnpicked ? "unpicked" : "all";
  const setSeg = (v: Seg) => {
    a.setOnlyUnpicked(v === "unpicked");
    a.setView(v === "selected" ? "selected" : v === "disliked" ? "disliked" : "all");
  };
  const n = selected.size;
  const limit = a.limit;
  const hasLimit = limit != null && limit > 0;
  const canDone = !a.shareMode && (n > 0 || disliked.size > 0);
  const badge = syncBadge(a.ledger, a.saveActivity, a.online);
  const hasPhotos = photos.length > 0;
  const showFaces = faceToolAvailable(a.people, a.scan);
  const showDups = !a.shareMode && a.view === "all" && photos.length >= 24 && dup.supported;
  const showDrive = !a.shareMode && album.allowDrive && a.driveFolders.length > 0;
  const lbPhoto = a.lbPhoto;

  const langItem: MenuItem = {
    label: lang === "vi" ? "English" : "Tiếng Việt",
    hint: lang === "vi" ? "Switch to English" : "Chuyển sang tiếng Việt",
    icon: Languages,
    onClick: () => setLang(lang === "vi" ? "en" : "vi"),
  };
  const menuItems: MenuItem[] = a.shareMode ? [langItem] : [
    { label: a.copied ? t("copied") : "Chép tên ảnh đã chọn", icon: a.copied ? Check : Copy, onClick: a.copyList, disabled: n === 0 },
    { label: "Tải danh sách ảnh (.txt)", icon: FileText, onClick: a.exportList, disabled: n === 0 },
    { label: a.shareBusy ? "Đang tạo link…" : "Chia sẻ ảnh đã chọn", hint: "Người nhận chỉ xem đúng những ảnh này", icon: Share2, onClick: a.shareSelected, disabled: n === 0 || a.shareBusy },
    ...(showDrive
      ? (["divider", ...a.driveFolders.map((f) => ({
          label: a.driveFolders.length > 1 && f.name ? `${t("driveFolder")} · ${f.name}` : t("driveFolder"),
          hint: "Mở thư mục Google Drive",
          icon: FolderDown,
          href: f.url,
          external: true,
        }))] as MenuItem[])
      : []),
    "divider",
    { label: t("resetPicks"), icon: RotateCcw, danger: true, onClick: () => a.setResetArmed(true), disabled: n === 0 && disliked.size === 0 },
    "divider",
    langItem,
  ];

  const toolButtons = (
    <>
      {showFaces && (
        <button type="button" onClick={() => setTool("faces")} className={btn("secondary", "md", "w-full min-w-0 sm:w-auto")} style={{ paddingInline: 11 }}>
          {a.people.length > 0 ? (
            <span className="-ml-1 hidden -space-x-2 sm:flex">
              {a.people.slice(0, 3).map((p) => (
                <span key={p.id} className="rounded-full" style={{ boxShadow: "0 0 0 2px var(--sf)" }}>
                  <FaceAvatar person={p} driveIdOf={a.driveIdOf} size={22} />
                </span>
              ))}
            </span>
          ) : null}
          <ScanFace size={16} className={`flex-none ${a.people.length > 0 ? "sm:hidden" : ""}`} style={{ color: "var(--ac)" }} />
          <span className="truncate sm:hidden">{lang === "vi" ? "Tìm ảnh theo mặt" : "Find by face"}</span>
          <span className="hidden truncate sm:inline">{t("faceFindTitle")}</span>
        </button>
      )}
      {showDups && (
        <button type="button" onClick={() => setTool("dups")} className={btn("secondary", "md", "w-full min-w-0 sm:w-auto")} style={{ paddingInline: 11 }}>
          <Sparkles size={16} className="flex-none" style={{ color: "var(--am)" }} />
          <span className="truncate">{t("dupTitle")}</span>
          {dup.shown && dup.shown.length > 0 ? <span className="v2-seg-count">{dup.shown.length}</span> : null}
        </button>
      )}
    </>
  );

  const emptyState = (() => {
    if (photos.length === 0) return <Empty icon={ImageOff} title="Album chưa có ảnh nào" hint="Studio đang đưa ảnh lên. Bạn quay lại sau ít phút nhé." />;
    if (a.dislikedOnly) return <Empty icon={ThumbsDown} title={t("noDislikedPhotos")} action={<button type="button" className={btn("secondary")} onClick={() => setSeg("all")}>Xem tất cả ảnh</button>} />;
    if (a.selectedOnly)
      return (
        <Empty
          icon={CheckCircle2}
          title={t("noSelectedPhotos")}
          hint="Chạm vòng tròn ở góc ảnh để chọn."
          action={<button type="button" className={btn("secondary")} onClick={() => setSeg("all")}>Xem tất cả ảnh</button>}
        />
      );
    if (a.onlyUnpicked && counts.kept > 0)
      return <Empty icon={CheckCircle2} title="Bạn đã xem hết ảnh chưa chọn" hint="Mọi ảnh còn lại đều đã được chọn." action={<button type="button" className={btn("secondary")} onClick={() => setSeg("selected")}>Xem ảnh đã chọn</button>} />;
    if (disliked.size > 0) return <Empty icon={ThumbsDown} title="Mọi ảnh ở đây đã được đánh dấu không thích" />;
    return <Empty icon={ImageOff} title={t("loading")} />;
  })();

  return (
    <CustomerRootV2 theme={theme}>
      <CustomerHeaderV2
        brand={brand}
        sub={a.shareMode ? "Ảnh được chia sẻ" : "Album chọn ảnh"}
        right={
          <>
            {/* Cài album lên màn hình chính — tự ẩn khi đã cài / trình duyệt không hỗ trợ. */}
            {!a.shareMode && <InstallPwaButton variant="pill" label="Lưu album" />}
            <Menu items={menuItems} label="Thêm thao tác" width={270} />
          </>
        }
      />

      <AlbumHeroV2
        cover={album.cover_url}
        title={album.title}
        eyebrow={`${studioName} đã chia sẻ với bạn`}
        meta={
          <>
            <span>
              {a.shareMode ? shareIds!.length : photos.length} {t("photos")}
            </span>
            {!a.shareMode && hasLimit && photos.length > 0 ? (
              <>
                <span aria-hidden>·</span>
                <span>Chọn tối đa {limit} ảnh</span>
              </>
            ) : null}
          </>
        }
      />

      <main className="mx-auto w-full max-w-[1080px] px-4" style={{ paddingBottom: a.shareMode || !hasPhotos ? 48 : 140 }}>
        {album.cover_url ? null : <div className="h-1" />}
        <div className="flex flex-col gap-3 pt-4 sm:pt-5">
          {album.description ? (
            <p className="max-w-[70ch] text-[14px]" style={{ color: "var(--tx2)" }}>
              {album.description}
            </p>
          ) : null}
          {a.shareMode ? (
            <Callout tone="blue" icon={Share2} title={`${shareIds!.length} ảnh được chia sẻ`}>
              Người gửi link chọn sẵn những ảnh này cho bạn xem.
            </Callout>
          ) : n === 0 && disliked.size === 0 && photos.length > 0 ? (
            <Callout tone="brand" icon={MousePointerClick} title="Cách chọn ảnh">
              Chạm vòng tròn ở góc ảnh để chọn{hasLimit ? ` (tối đa ${limit} ảnh)` : ""}. Mở ảnh lớn để ghi chú hoặc đánh dấu không thích. Lựa chọn tự lưu — xong thì bấm “Đã chọn xong”.
            </Callout>
          ) : null}
        </div>

        {/* Thanh lọc — dính dưới đầu trang khi cuộn. */}
        {!a.shareMode && hasPhotos && (
          <div
            ref={a.contentRef}
            className="sticky top-[60px] z-20 -mx-4 mt-3 flex items-center gap-2 px-4 py-2.5"
            style={{ background: "color-mix(in srgb, var(--bg) 88%, transparent)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
          >
            <div className="min-w-0 flex-1 [&_.v2-seg-btn]:flex-1 [&_.v2-seg-btn]:justify-center [&_.v2-seg]:flex [&_.v2-seg]:w-full sm:[&_.v2-seg-btn]:flex-none sm:[&_.v2-seg]:inline-flex sm:[&_.v2-seg]:w-auto">
              <Segmented
                label="Lọc ảnh"
                value={seg}
                onChange={setSeg}
                options={[
                  { value: "all", label: <SegLabel text="Tất cả" count={counts.kept} /> },
                  { value: "unpicked", label: <SegLabel text="Chưa chọn" count={counts.unpicked} /> },
                  { value: "selected", label: <SegLabel text="Đã chọn" count={n} /> },
                  ...(disliked.size > 0 || a.dislikedOnly ? [{ value: "disliked" as const, label: <SegLabel text="Không thích" count={disliked.size} /> }] : []),
                ]}
              />
            </div>
            {/* Máy tính: công cụ nằm cùng hàng với bộ lọc. */}
            <div className="hidden flex-none items-center gap-2 sm:flex">{toolButtons}</div>
          </div>
        )}

        {/* Điện thoại: công cụ là hàng hai nút chia đôi ngay dưới bộ lọc. */}
        {(showFaces || showDups) && (
          <div className={`mt-1 grid gap-2 ${a.shareMode ? "mt-3 sm:flex" : "sm:hidden"} ${showFaces && showDups ? "grid-cols-2" : "grid-cols-1"}`}>{toolButtons}</div>
        )}

        {a.tabSources.length > 1 && (
          <div className="mt-3">
            <ChipRow label="Thư mục ảnh">
              <ChipV2 on={a.activeTab === "all"} onClick={() => a.setActiveTab("all")}>
                Tất cả
              </ChipV2>
              {a.tabSources.map((s) => {
                // Số đúng bằng số ảnh chip đó cho xem: thường thì trừ ảnh không thích,
                // ở tab "Không thích" thì chỉ đếm ảnh bị loại (giống bản cũ).
                // Link chia sẻ: chỉ đếm những ảnh được chia sẻ.
                const c = photos.filter(
                  (p) => p.source_id === s.id && (a.shareSet ? a.shareSet.has(p.id) : a.dislikedOnly ? disliked.has(p.id) : !disliked.has(p.id))
                ).length;
                return (
                  <ChipV2 key={s.id} on={a.activeTab === s.id} onClick={() => a.setActiveTab(s.id)} count={c}>
                    {s.name}
                  </ChipV2>
                );
              })}
            </ChipRow>
          </div>
        )}

        {(a.activePerson || (a.hideDupes && a.dupGroups && a.view === "all")) && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {a.activePerson && (
              <span className="inline-flex h-9 items-center gap-2 rounded-full pl-1 pr-1 text-[13px] font-semibold" style={{ background: "var(--acS)", color: "var(--ac)" }}>
                <FaceAvatar person={a.activePerson} driveIdOf={a.driveIdOf} size={28} />
                <span className="max-w-[46vw] truncate">
                  {a.activePerson.name ? `Ảnh của ${a.activePerson.name}` : "Ảnh của người này"} · {a.activePerson.photoIds.filter((id) => !disliked.has(id)).length}
                </span>
                <button type="button" onClick={() => a.setPersonId(null)} aria-label={t("faceClear")} title={t("faceClear")} className="flex h-7 w-7 items-center justify-center rounded-full">
                  <X size={15} />
                </button>
              </span>
            )}
            {a.hideDupes && a.dupGroups && a.view === "all" && dup.dupCount > 0 && (
              <span className="inline-flex h-9 items-center gap-2 rounded-full pl-3 pr-1 text-[13px] font-semibold" style={{ background: "var(--amS)", color: "var(--am)" }}>
                <Sparkles size={14} /> Đang ẩn {dup.dupCount} ảnh na ná
                <button type="button" onClick={() => a.setHideDupes(false)} className="rounded-full px-2.5 py-1 text-[12.5px] underline-offset-2 hover:underline">
                  Hiện lại
                </button>
              </span>
            )}
          </div>
        )}
        {a.activePerson && (
          <p className="mt-1.5 text-[12.5px]" style={{ color: "var(--tx3)" }}>
            {t("personHint")}
          </p>
        )}

        {/* Lưới ảnh */}
        <div className="mt-3">
          {a.visiblePhotos.length === 0 ? (
            <div className="v2-card">{emptyState}</div>
          ) : (
            <div ref={masonry.ref} className="-mx-4 flex flex-col gap-7 sm:mx-0">
              {a.sections.map((sec) => {
                if (sec.items.length === 0) return null;
                // Khai báo lưới TRƯỚC rồi mới hỏi khoảng (xem @/lib/masonry).
                const luoi = masonry.lattice(sec.id, sec.ids);
                const [dau, cuoi] = masonry.range(sec.id);
                const items = sec.items.slice(dau, cuoi);
                return (
                  <section key={sec.id}>
                    {sec.name && (
                      <div className="mb-2 px-4 sm:px-0">
                        <GroupLabel count={`${sec.items.length} ảnh`}>{sec.name}</GroupLabel>
                      </div>
                    )}
                    <div {...luoi}>
                      {items.map(({ p, idx }, k) => {
                        const isSel = selected.has(p.id);
                        const isDis = disliked.has(p.id);
                        const note = a.notes[p.id]?.trim();
                        const o = masonry.tileProps(sec.id, p.id, dau + k);
                        return (
                          <div key={p.id} ref={o.ref} className="o-anh-cho overflow-hidden" style={{ background: "var(--sf2)", ...o.style }}>
                            <img
                              src={img.thumb(p.drive_file_id, gridW)}
                              alt={p.name}
                              loading="lazy"
                              decoding="async"
                              draggable={false}
                              role="button"
                              tabIndex={0}
                              aria-label={`Xem ảnh ${stripExtension(p.name)}`}
                              onClick={() => a.openFromGrid(idx)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  a.openFromGrid(idx);
                                }
                              }}
                              onContextMenu={(e) => a.wm && e.preventDefault()}
                              className="block h-full w-full cursor-zoom-in select-none object-cover transition-opacity"
                              style={{ opacity: isDis ? 0.55 : 1 }}
                              {...masonry.imgProps(p.id)}
                            />
                            {a.wm && <div className="pointer-events-none absolute inset-0 z-[2] opacity-20" style={watermarkLayer(a.wm)} />}
                            {isSel && <div className="pointer-events-none absolute inset-0 z-[3]" style={{ boxShadow: "inset 0 0 0 3px var(--ac)" }} />}
                            {!a.shareMode && !isDis && (
                              <SelectDot on={isSel} onClick={() => a.toggle(p.id)} label={isSel ? t("deselect") : t("selectThis")} icon={<Check size={15} strokeWidth={3} />} />
                            )}
                            {!a.shareMode && isDis && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  a.toggleDislike(p.id);
                                }}
                                aria-label={t("undislike")}
                                title={t("undislike")}
                                className="absolute left-1.5 top-1.5 z-[4] inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[12px] font-semibold"
                                style={{ background: "rgba(0,0,0,.6)", color: "#fff" }}
                              >
                                <Undo2 size={14} /> Bỏ không thích
                              </button>
                            )}
                            {album.allowNotes && note && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  a.openFromGrid(idx);
                                }}
                                title={note}
                                aria-label={`Ghi chú: ${note}`}
                                className="absolute bottom-1.5 left-1.5 z-[4] inline-flex h-7 max-w-[80%] items-center gap-1 rounded-full px-2 text-[11.5px] font-semibold"
                                style={{ background: "rgba(0,0,0,.6)", color: "#fff" }}
                              >
                                <FileText size={13} className="flex-none" /> <span className="truncate">{note}</span>
                              </button>
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

        {/* Cuối album: tải ảnh gốc từ Drive (Google tự phục vụ, không tốn băng
            thông hệ thống). Ẩn ở link chia sẻ chọn lọc vì link mở CẢ thư mục. */}
        {showDrive && a.visiblePhotos.length > 0 && (
          <div className="v2-card v2-card-pad mx-auto mt-10 flex max-w-[560px] flex-col items-center gap-2 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: "var(--acS)", color: "var(--ac)" }}>
              <FolderDown size={20} />
            </span>
            <p className="text-[15px] font-semibold">{t("originalTitle")}</p>
            <p className="text-[13px]" style={{ color: "var(--tx2)" }}>
              {t("originalHint")}
            </p>
            <div className="mt-2">
              <DriveFolderLinks folders={a.driveFolders} label={t("driveFolderPick")} labelOne={t("driveFolder")} className={btn("secondary")} />
            </div>
          </div>
        )}
      </main>

      {/* Thanh chọn ảnh — dính đáy màn, chỗ ngón cái với tới. */}
      {!a.shareMode && hasPhotos && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 sm:bottom-4 sm:px-4">
          <div
            className="pointer-events-auto mx-auto flex w-full max-w-[640px] items-center gap-3 px-4 pt-3 sm:rounded-[18px] sm:pb-3"
            style={{
              background: "var(--sf)",
              borderTop: "1px solid var(--bd)",
              boxShadow: "0 -6px 24px -12px rgba(15,30,55,.25), 0 10px 30px -12px rgba(15,30,55,.3)",
              paddingBottom: "max(12px, env(safe-area-inset-bottom, 0px))",
            }}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5">
                <span className="text-[13px]" style={{ color: "var(--tx2)" }}>
                  Đã chọn
                </span>
                <span className="tnum text-[19px] font-bold leading-none">
                  {n}
                  {limit != null ? (
                    <span className="text-[14px] font-semibold" style={{ color: "var(--tx3)" }}>
                      /{limit}
                    </span>
                  ) : null}
                </span>
                <span title={badge.detail} aria-live="polite" className="ml-1 inline-flex min-w-0 items-center gap-1 truncate text-[11.5px] font-semibold" style={{ color: badge.tone === "wait" ? "var(--am)" : "var(--tx3)" }}>
                  <span
                    className={`h-1.5 w-1.5 flex-none rounded-full${badge.tone === "busy" ? " animate-pulse" : ""}`}
                    style={{ background: badge.tone === "ok" ? "var(--gn)" : badge.tone === "wait" ? "var(--am)" : "var(--tx3)" }}
                  />
                  <span className="truncate">{badge.text}</span>
                </span>
              </div>
              <div className="mt-1.5">
                {hasLimit ? (
                  <Progress value={(n / limit!) * 100} tone={n >= limit! ? "green" : "brand"} />
                ) : (
                  <p className="truncate text-[12px]" style={{ color: "var(--tx3)" }}>
                    {disliked.size > 0 ? `${disliked.size} ảnh không thích · ` : ""}
                    {counts.kept} ảnh trong album
                  </p>
                )}
              </div>
            </div>
            {canDone ? (
              <button type="button" onClick={a.notifyDone} disabled={a.notifyingDone} className={btn(a.doneSent ? "secondary" : "primary", "lg", "flex-none")}>
                {a.doneSent ? <CheckCircle2 size={17} style={{ color: "var(--gn)" }} /> : <Send size={16} />}
                {a.notifyingDone ? "Đang gửi…" : a.doneSent ? "Báo lại studio" : "Đã chọn xong"}
              </button>
            ) : (
              <span className="flex-none text-right text-[12.5px] leading-snug" style={{ color: "var(--tx3)" }}>
                Chạm <Check size={13} className="inline -mt-0.5" /> ở góc ảnh
                <br />
                để chọn
              </span>
            )}
          </div>
        </div>
      )}

      {/* Khung xem ảnh */}
      {lbPhoto && a.lbIdx !== null && (
        <ViewerV2
          photo={lbPhoto}
          index={a.lbIdx}
          total={a.lbPhotos.length}
          onClose={a.closeLightbox}
          onStep={a.go}
          wm={a.wm}
          gridW={gridW}
          fullW={a.fullW}
          reserve={a.shareMode && !album.allowNotes ? 80 : noteOpen ? 270 : 186}
          topActions={
            album.allowDownload ? (
              <button
                type="button"
                onClick={() => downloadImage(lbPhoto.drive_file_id, lbPhoto.name, a.wm)}
                aria-label={t("downloadPhoto")}
                title={t("downloadPhoto")}
                className={iconBtn()}
                style={{ color: "#fff" }}
              >
                <Download size={19} />
              </button>
            ) : null
          }
          hint={
            // Điện thoại: nhấn giữ ảnh để lưu vào thư viện — chỉ khi KHÔNG có watermark.
            album.allowDownload && !a.wm ? (
              <p className="hidden px-4 pb-1 text-center text-[11.5px] [@media(hover:none)]:block" style={{ color: "rgba(255,255,255,.5)" }}>
                {t("saveToPhotosHint")}
              </p>
            ) : null
          }
          actions={
            a.shareMode && !album.allowNotes ? undefined : (
              <ViewerActions
                photoId={lbPhoto.id}
                a={a}
                allowNotes={album.allowNotes}
                noteOpen={noteOpen}
                onNoteToggle={() => setNoteOpen((v) => !v)}
              />
            )
          }
          aside={album.allowNotes ? <NoteAside photoId={lbPhoto.id} a={a} /> : undefined}
        />
      )}

      <ToastV2 text={a.toast} lifted={!a.shareMode && hasPhotos} />

      <Modal
        open={a.resetArmed}
        onClose={() => a.setResetArmed(false)}
        icon={RotateCcw}
        title={`${t("resetPicks")}?`}
        desc={
          <>
            {t("resetAsk")} <b>{n}</b> {t("resetAskSelected")}
            {disliked.size > 0 && (
              <>
                {" "}
                · <b>{disliked.size}</b> {t("resetAskDisliked")}
              </>
            )}{" "}
            và mọi ghi chú.
          </>
        }
        footer={
          <>
            <button type="button" className={btn("secondary")} onClick={() => a.setResetArmed(false)}>
              {t("cancel")}
            </button>
            <button type="button" className={btn("danger")} onClick={a.resetPicks}>
              <RotateCcw size={15} /> {t("resetConfirm")}
            </button>
          </>
        }
      />

      <FaceFinderV2
        open={tool === "faces"}
        onClose={() => setTool(null)}
        people={a.people}
        activeId={a.personId}
        onPick={a.setPersonId}
        driveIdOf={a.driveIdOf}
        scan={a.scan}
        search={face}
      />
      {/* Đang xem lớn một tấm từ ngăn kéo thì tạm ẩn ngăn kéo; đóng ảnh là nó quay lại. */}
      <DuplicatesV2
        open={tool === "dups" && a.lbIdx === null}
        onClose={() => setTool(null)}
        scan={dup}
        photoCount={photos.length}
        selected={selected}
        hide={a.hideDupes}
        onHide={a.setHideDupes}
        onToggle={a.toggle}
        onOpen={a.openGroup}
      />

      <ShareDialog
        url={a.shareUrl}
        title={`Chia sẻ ${n} ảnh đã chọn`}
        subtitle="Gửi link này — người nhận sẽ chỉ xem đúng những ảnh bạn đã chọn."
        onClose={() => a.setShareUrl(null)}
      />
    </CustomerRootV2>
  );
}

/** Nhãn của một nút lọc: số đếm ẩn trên điện thoại để bốn nút vừa một hàng. */
function SegLabel({ text, count }: { text: string; count: number }) {
  return (
    <>
      {text}
      <span className="v2-seg-count hidden sm:inline">{count}</span>
    </>
  );
}

type AlbumState = ReturnType<typeof useCustomerAlbum>;

/** Ba thao tác lớn ở đáy khung xem: Không thích · Ghi chú · Chọn ảnh. */
function ViewerActions({
  photoId,
  a,
  allowNotes,
  noteOpen,
  onNoteToggle,
}: {
  photoId: string;
  a: AlbumState;
  allowNotes: boolean;
  noteOpen: boolean;
  onNoteToggle: () => void;
}) {
  const { t } = a;
  const isSel = a.selected.has(photoId);
  const isDis = a.disliked.has(photoId);
  const note = a.notes[photoId] ?? "";
  const n = a.selected.size;
  const of = a.limit != null ? `${n}/${a.limit}` : `${n}`;
  const status = isDis ? "Ảnh này ở mục Không thích" : isSel ? `Đã chọn ảnh này · ${of}` : `Chưa chọn · đã chọn ${of}`;
  const act = "flex h-[58px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-[14px] text-[12.5px] font-semibold transition-colors active:scale-[.98]";
  const ghost = { background: "rgba(255,255,255,.09)", color: "#fff" };
  return (
    <div className="flex flex-col gap-2">
      {allowNotes && noteOpen && (
        <textarea
          value={note}
          onChange={(e) => a.setNote(photoId, e.target.value)}
          placeholder="Viết ghi chú cho ảnh này…"
          rows={2}
          className={`${inputCls} md:hidden`}
          style={{ minHeight: 76, fontSize: 16 }}
          aria-label={t("note")}
        />
      )}
      {!a.shareMode && (
        <p className="text-center text-[12.5px]" style={{ color: "rgba(255,255,255,.62)" }}>
          {status}
        </p>
      )}
      <div className="flex gap-2">
        {!a.shareMode && (
          <button type="button" onClick={() => a.toggleDislike(photoId)} aria-pressed={isDis} className={act} style={isDis ? { background: "var(--rdS)", color: "var(--rd)" } : ghost}>
            {isDis ? <Undo2 size={19} /> : <ThumbsDown size={19} />}
            {isDis ? "Bỏ không thích" : "Không thích"}
          </button>
        )}
        {allowNotes && (
          <button type="button" onClick={onNoteToggle} aria-expanded={noteOpen} className={`${act} relative md:hidden`} style={noteOpen ? { background: "rgba(255,255,255,.18)", color: "#fff" } : ghost}>
            <FileText size={19} />
            {t("note")}
            {note.trim() ? <span className="absolute right-3 top-2.5 h-2 w-2 rounded-full" style={{ background: "var(--am)" }} /> : null}
          </button>
        )}
        {!a.shareMode && !isDis && (
          <button
            type="button"
            onClick={() => a.toggle(photoId)}
            aria-pressed={isSel}
            className={`${act} flex-[1.35]`}
            style={
              isSel
                ? { background: "color-mix(in srgb, var(--ac) 26%, transparent)", color: "#fff", boxShadow: "inset 0 0 0 1.5px var(--ac)" }
                : // Nền tối làm màu chủ đạo sáng lên — trộn tối lại để chữ trắng đủ tương phản.
                  { background: "color-mix(in srgb, var(--ac) 76%, #000)", color: "#fff" }
            }
          >
            {isSel ? <CheckCircle2 size={20} /> : <Check size={20} strokeWidth={2.6} />}
            {isSel ? "Đã chọn" : "Chọn ảnh"}
          </button>
        )}
      </div>
    </div>
  );
}

/** Cột ghi chú bên phải khung xem (máy tính). */
function NoteAside({ photoId, a }: { photoId: string; a: AlbumState }) {
  const { t } = a;
  const isSel = a.selected.has(photoId);
  const isDis = a.disliked.has(photoId);
  return (
    <div className="flex flex-1 flex-col gap-3 p-6">
      <p className="flex items-center gap-2 text-[15px] font-semibold">
        <FileText size={16} style={{ color: "var(--ac)" }} /> {t("note")}
      </p>
      <p className="text-[12.5px] leading-relaxed" style={{ color: "rgba(255,255,255,.55)" }}>
        {isDis ? "Cho studio biết vì sao bạn không thích ảnh này (tuỳ chọn)." : "Để lại ghi chú để studio biết bạn muốn chỉnh sửa gì cho ảnh này."}
      </p>
      <textarea
        value={a.notes[photoId] ?? ""}
        onChange={(e) => a.setNote(photoId, e.target.value)}
        placeholder="Viết ghi chú cho ảnh này…"
        rows={6}
        className={inputCls}
        aria-label={t("note")}
      />
      <div className="mt-auto flex items-center gap-2.5 border-t pt-4 text-[13px]" style={{ borderColor: "rgba(255,255,255,.1)", color: "rgba(255,255,255,.7)" }}>
        <span className="h-2 w-2 rounded-full" style={{ background: isDis ? "var(--rd)" : isSel ? "var(--gn)" : "rgba(255,255,255,.4)" }} />
        {isDis ? "Ảnh này đã chuyển sang mục Không thích" : isSel ? "Ảnh này đã được chọn" : "Ảnh chưa được chọn"}
      </div>
    </div>
  );
}
