"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight, Check, Download, ExternalLink, FolderDown, Heart, Images, Share2, Sparkles, Star, Video, type LucideIcon,
} from "lucide-react";
import { Badge, Card, Empty, Section, Stack, btn } from "@/components/v2/kit";
import { Segmented } from "@/components/v2/kit-client";
import { fmtDate } from "@/lib/date";
import { thiepUrl } from "@/lib/hosts";
import PortalPhotoGridV2 from "./PortalPhotoGridV2";
import PortalVideosV2 from "./PortalVideosV2";
import type { GridPhoto } from "./PortalPhotoGrid";
import type { PortalPayload } from "./types";
import { sharePortalPage, useAlbumContent, usePortalRating } from "./usePortal";

/* ═══════════════════════════════════════════════════════════════════════════
   ẢNH & VIDEO — cổng khách, giao diện mới.

   • Hợp đồng ĐANG THỰC HIỆN: thẻ chọn ảnh / album đã giao (/a, /album) và các
     link sản phẩm hoàn thiện studio dán trên hợp đồng — như hai thẻ của bản cũ.
   • Hợp đồng HOÀN THÀNH: trang album (bản cũ là <AlbumView> nền tối): ảnh bìa,
     Ảnh · Video · Tải về, đánh giá sao. Cùng dữ liệu, cùng cờ cho tải +
     watermark, cùng action "review" — logic ở ./usePortal.
   ═══════════════════════════════════════════════════════════════════════════ */

export type AlbumTabV2 = "photos" | "videos" | "files";

export default function AlbumViewV2({
  token, phone, data, toast, initialTab, imgSrc,
}: {
  token: string;
  phone: string;
  data: PortalPayload;
  toast: (m: string) => void;
  /** Tab mở sẵn — chỉ màn xem trước (/uipreview). */
  initialTab?: AlbumTabV2;
  /** Chỉ màn xem trước: ảnh giữ chỗ thay cho ảnh Drive thật. */
  imgSrc?: (p: GridPhoto, w: number) => string;
}) {
  if (data.contract.status !== "completed") return <ActiveMedia token={token} data={data} />;
  return <DeliveredAlbum token={token} phone={phone} data={data} toast={toast} initialTab={initialTab} imgSrc={imgSrc} />;
}

/* ── Đang thực hiện: chọn ảnh, album đã giao, link hoàn thiện ───────────── */
function ActiveMedia({ token, data }: { token: string; data: PortalPayload }) {
  const delivered = !!data.gallery || data.selection?.phase === "delivery";
  const albumHref = data.gallery ? `/album/${data.gallery.slug}` : data.selection ? `/a/${data.selection.slug}` : null;
  const fl = data.final_links;

  if (!albumHref && !fl) {
    return (
      <Card>
        <Empty
          icon={Images}
          title="Ảnh của bạn sẽ hiện ở đây"
          hint="Sau buổi chụp, studio gửi album để bạn chọn ảnh. Link chọn ảnh, album và video hoàn thiện sẽ có ngay tại trang này."
          action={<Link href={`/c/${token}`} className={btn("secondary")}>Xem lại hợp đồng</Link>}
        />
      </Card>
    );
  }

  return (
    <Stack>
      {albumHref && (
        <Card>
          <div className="flex items-start gap-3">
            <span className="v2-section-icon" style={{ width: 44, height: 44, borderRadius: 13 }}>
              <Images size={21} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-[16px] font-semibold">Ảnh của bạn</h3>
                <Badge tone={delivered ? "green" : "amber"} dot>{delivered ? "Album đã giao" : "Đang chờ bạn chọn ảnh"}</Badge>
              </div>
              <p className="mt-1 text-[13.5px]" style={{ color: "var(--tx2)", textWrap: "pretty" }}>
                {delivered
                  ? "Album hoàn thiện đã sẵn sàng — mở để xem và tải về."
                  : "Mở album để đánh dấu những tấm bạn thích; studio hậu kỳ theo lựa chọn của bạn."}
              </p>
            </div>
          </div>
          <Link href={albumHref} className={btn("primary", "lg", "mt-4 w-full sm:w-auto")}>
            <Images size={17} /> {delivered ? "Mở album của bạn" : "Chọn ảnh của bạn"} <ArrowRight size={16} />
          </Link>
        </Card>
      )}

      {fl && (
        <Section title="Sản phẩm hoàn thiện" desc="Studio đã gửi — bấm để mở hoặc tải về." icon={Sparkles} actions={<Badge tone="green">Đã sẵn sàng</Badge>} flush>
          {fl.album_url && <LinkRow href={fl.album_url} external icon={Images} title="Album hoàn thiện" sub="Mở album để xem và tải ảnh về" />}
          {fl.originals_url && <LinkRow href={fl.originals_url} external icon={FolderDown} title="Toàn bộ file gốc" sub="Thư mục chứa toàn bộ file gốc" />}
          {fl.videos.map((v, i, all) => (
            <LinkRow key={i} href={v.url} external icon={Video} title={v.title || (all.length > 1 ? `Video ${i + 1}` : "Video hoàn thiện")} sub="Mở để xem video" />
          ))}
        </Section>
      )}
    </Stack>
  );
}

/* ── Hoàn thành: trang album ────────────────────────────────────────────── */
function DeliveredAlbum({
  token, phone, data, toast, initialTab, imgSrc,
}: {
  token: string;
  phone: string;
  data: PortalPayload;
  toast: (m: string) => void;
  initialTab?: AlbumTabV2;
  imgSrc?: (p: GridPhoto, w: number) => string;
}) {
  const c = data.contract;
  const { album, photos, albumVideos, videos, albumLink, originalsLink, canDownload, hasContent, firstTab, cover } = useAlbumContent(data);
  const { rating, rated, sendRating } = usePortalRating(token, phone, toast);
  const [tab, setTab] = useState<AlbumTabV2>(() => initialTab ?? firstTab);
  const share = () => sharePortalPage(c.client_name || c.title, toast);
  const coverSrc = imgSrc && photos[0] && !album?.cover_url ? imgSrc(photos[0], 1600) : cover;

  return (
    <Stack>
      {/* ── Ảnh bìa + một nút chính ─────────────────────────────────────── */}
      <Card padded={false} className="overflow-hidden">
        {/* Tỉ lệ khung đổi theo màn hình — KHÔNG kèm minHeight (xem AlbumView). */}
        <div className="relative flex aspect-[4/3] items-end overflow-hidden sm:aspect-[21/8]" style={{ background: "var(--sf2)" }}>
          {coverSrc && <img src={coverSrc} alt="" fetchPriority="high" decoding="async" className="absolute inset-0 h-full w-full object-cover" />}
          <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(8,10,14,.78), rgba(8,10,14,.05) 60%)" }} />
          <div className="relative w-full px-5 pb-5 sm:px-7 sm:pb-6" style={{ color: "#fff" }}>
            <p className="text-[12px] font-semibold" style={{ color: "rgba(255,255,255,.8)" }}>
              {[c.event_date ? fmtDate(c.event_date) : null, c.location].filter(Boolean).join(" · ") || data.studio_name}
            </p>
            <h2 className="mt-0.5 text-[24px] font-bold leading-tight sm:text-[32px]" style={{ letterSpacing: "-.5px", textWrap: "balance" }}>
              {c.client_name || c.title}
            </h2>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 sm:px-5">
          <p className="min-w-0 flex-1 text-[13px]" style={{ color: "var(--tx2)" }}>
            <span className="tnum font-semibold" style={{ color: "var(--tx)" }}>{photos.length}</span> ảnh ·{" "}
            <span className="tnum font-semibold" style={{ color: "var(--tx)" }}>{videos.length}</span> video
            {canDownload ? " · tải được từng ảnh" : ""}
          </p>
          <button type="button" onClick={share} className={btn("secondary", "md")}>
            <Share2 size={16} /> Chia sẻ
          </button>
          {albumLink ? (
            <a href={albumLink} target="_blank" rel="noopener noreferrer" className={btn("primary", "md")}>
              <Images size={16} /> Mở album hoàn thiện
            </a>
          ) : album ? (
            <Link href={`/album/${album.slug}`} className={btn("primary", "md")}>
              <Download size={16} /> Tải toàn bộ
            </Link>
          ) : null}
        </div>
      </Card>

      {!hasContent ? (
        <Card>
          <Empty icon={Images} title="Album đang được studio hoàn thiện" hint="Ngay khi studio giao album, ảnh và video sẽ hiện ở đây." />
        </Card>
      ) : (
        <>
          <div className="flex">
            <Segmented<AlbumTabV2>
              value={tab}
              onChange={setTab}
              label="Ảnh, video, tải về"
              options={[
                { value: "photos", label: "Ảnh", count: photos.length },
                { value: "videos", label: "Video", count: videos.length },
                { value: "files", label: "Tải về" },
              ]}
            />
          </div>

          <div key={tab} className="animate-[vkFade_.3s_ease_both]">
            {tab === "photos" &&
              (photos.length === 0 ? (
                albumLink ? (
                  <Card>
                    <Empty
                      icon={Images}
                      title="Album hoàn thiện đã sẵn sàng"
                      hint="Bấm để mở album, xem và tải ảnh về."
                      action={<a href={albumLink} target="_blank" rel="noopener noreferrer" className={btn("primary")}><ExternalLink size={16} /> Mở album</a>}
                    />
                  </Card>
                ) : (
                  <Card><Empty icon={Images} title="Chưa có ảnh trong album" hint="Studio sẽ đưa ảnh đã chỉnh màu lên đây." /></Card>
                )
              ) : (
                <PortalPhotoGridV2 photos={photos} canDownload={canDownload} watermark={album?.watermark ?? null} toast={toast} src={imgSrc} />
              ))}

            {tab === "videos" &&
              (videos.length === 0 ? (
                <Card><Empty icon={Video} title="Hợp đồng này không có video" hint="Nếu bạn muốn thêm video highlight, hãy nhắn cho studio." /></Card>
              ) : (
                <PortalVideosV2 videos={videos} />
              ))}

            {tab === "files" && (
              <Section title="Tải về" desc="Studio có thể dọn ảnh gốc trên Drive sau một thời gian lưu trữ — hãy tải bản bạn muốn giữ về máy sớm." icon={Download} flush>
                {originalsLink && <LinkRow href={originalsLink} external icon={FolderDown} title="Toàn bộ file gốc" sub="Thư mục chứa toàn bộ file gốc — mở để tải về máy" />}
                {albumLink && <LinkRow href={albumLink} external icon={Images} title="Album hoàn thiện" sub="Mở album để xem và tải ảnh về" />}
                {videos.filter((v) => v.key.startsWith("link-")).map((v) => (
                  <LinkRow key={v.key} href={v.downloadUrl ?? v.openUrl} external={!v.downloadUrl} icon={Video} title={v.title} sub={v.downloadUrl ? "Tải video về máy" : "Mở để xem video"} />
                ))}
                {album && <LinkRow href={`/album/${album.slug}`} icon={Images} title="Toàn bộ ảnh đã chỉnh" sub={`${photos.length} ảnh · mở album để chọn và tải về`} />}
                {album && albumVideos.length > 0 && (
                  <LinkRow href={`/album/${album.slug}`} icon={Video} title="Video" sub={`${albumVideos.length} video · tải bản gốc từ album`} />
                )}
                {data.wedding?.published && <LinkRow href={thiepUrl(`/${data.wedding.slug}`)} icon={Heart} title="Thiệp cưới điện tử" sub="Studio tặng kèm hợp đồng" />}
                {data.story?.published && <LinkRow href={`/story/${data.story.slug}`} icon={Heart} title="Trang Love Story" sub="Studio tặng kèm hợp đồng" />}
              </Section>
            )}
          </div>
        </>
      )}

      {/* ── Đánh giá ─────────────────────────────────────────────────────── */}
      <Card className="text-center">
        <p className="text-[15px] font-semibold">{rated ? "Cảm ơn bạn đã đánh giá!" : `Bạn hài lòng với ${data.studio_name} chứ?`}</p>
        <p className="mt-1 text-[13px]" style={{ color: "var(--tx3)" }}>
          {rated ? "Đánh giá của bạn đã được gửi tới studio." : "Chọn số sao để gửi cảm nhận cho studio."}
        </p>
        <div className="mt-3 flex items-center justify-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => !rated && sendRating(n)}
              disabled={rated}
              aria-label={`${n} sao`}
              className="flex h-11 w-11 items-center justify-center rounded-full"
            >
              <Star size={28} fill={n <= rating ? "var(--am)" : "transparent"} style={{ color: n <= rating ? "var(--am)" : "var(--bdS)" }} />
            </button>
          ))}
        </div>
        {rated && (
          <p className="mt-1 flex items-center justify-center gap-1.5 text-[12.5px] font-semibold" style={{ color: "var(--gn)" }}>
            <Check size={14} /> Đã gửi {rating} sao
          </p>
        )}
      </Card>
    </Stack>
  );
}

/** Một dòng link (mở tab mới / tải file / sang trang khác của app). */
export function LinkRow({
  href, icon: Icon, title, sub, external,
}: { href: string; icon: LucideIcon; title: string; sub: string; external?: boolean }) {
  const body = (
    <>
      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px]" style={{ background: "var(--sf2)", color: "var(--tx2)" }}>
        <Icon size={17} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="v2-row-title block">{title}</span>
        <span className="v2-row-sub block">{sub}</span>
      </span>
      {external ? <ExternalLink size={16} style={{ flex: "none", color: "var(--tx3)" }} /> : <ArrowRight size={16} style={{ flex: "none", color: "var(--tx3)" }} />}
    </>
  );
  const cls = "v2-row v2-row-link";
  if (external) return <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{body}</a>;
  // Link tải file (/api/img?dl=1 → Drive) phải là <a> thường: <Link> của Next
  // sẽ tải trước và điều hướng phía client tới một route API.
  if (href.startsWith("/api/") || /^https?:/.test(href)) return <a href={href} rel="noopener" className={cls}>{body}</a>;
  return <Link href={href} className={cls}>{body}</Link>;
}
