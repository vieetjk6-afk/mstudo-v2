"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Images, Video, Download, Star, Share2, Check, ExternalLink, FolderDown } from "lucide-react";
import { useToast } from "@/components/studio/Toast";
import { fullImageUrl, thumbnailUrl } from "@/lib/drive";
import { fmtDate } from "@/lib/date";
import { useFullImageWidth } from "@/lib/use-img-width";
import PortalPhotoGrid from "./PortalPhotoGrid";
import PortalVideos, { type PortalVideo } from "./PortalVideos";
import { BG, CARD, DIM, LINE } from "./dark";
import type { PortalPayload } from "./types";

/* ═══════════════════════════════════════════════════════════════════════════
   TRANG ALBUM — giai đoạn HOÀN THÀNH của cổng khách hàng

   Cùng route /portal/<token>: hợp đồng chuyển sang trạng thái "Hoàn thành" thì
   trang tự đổi sang bản nền TỐI này (ảnh phải nổi trên nền tối, đây là cách mọi
   trang trưng ảnh chuyên nghiệp làm).

   Màu ở đây CỐ Ý viết cứng chứ không dùng token: đó là một bảng màu riêng của
   bản thiết kế cho trang album, không đổi theo chế độ sáng/tối của khách — ảnh
   cưới phải luôn nằm trên đúng một nền.

   Tải hàng loạt vẫn dùng trang album sẵn có (/album/<slug>) hoặc link thư mục
   file gốc studio dán trên hợp đồng. Trang này trưng bày, cho tải TỪNG ảnh /
   video (theo đúng cờ cho tải + watermark của album) và nhận đánh giá.
   ═══════════════════════════════════════════════════════════════════════════ */

const STAR_ON = "#F0B429";
const STAR_OFF = "rgba(255,255,255,.22)";

type Tab = "photos" | "videos" | "files";

export default function AlbumView({
  token,
  phone,
  data,
  initialTab,
}: {
  token: string;
  phone: string;
  data: PortalPayload;
  /** Tab mở sẵn — chỉ màn xem trước giao diện (/uipreview) dùng. */
  initialTab?: Tab;
}) {
  const { toast, toastNode } = useToast();
  const [rating, setRating] = useState(0);
  const [rated, setRated] = useState(false);

  const c = data.contract;
  const album = data.album;
  const photos = useMemo(() => (album?.photos ?? []).filter((p) => !p.is_video), [album]);
  const albumVideos = useMemo(() => (album?.photos ?? []).filter((p) => p.is_video), [album]);
  // Link studio dán tay trên hợp đồng (YouTube / Drive / Google Photos…).
  const linkVideos = useMemo(() => data.final_links?.videos ?? [], [data.final_links]);
  const albumLink = data.final_links?.album_url ?? null;
  const originalsLink = data.final_links?.originals_url ?? null;
  const canDownload = !!album?.download_enabled;

  /** Một danh sách phát chung: video dán link trước (thường là phim chính đã
   *  dựng), rồi tới video nằm trong album Drive. */
  const videos = useMemo<PortalVideo[]>(() => {
    const fromLinks = linkVideos.map((v, i) => ({
      key: `link-${i}`,
      title: v.title || (linkVideos.length > 1 ? `Video ${i + 1}` : "Video hoàn thiện"),
      kind: v.kind ?? "other",
      embed: v.embed,
      poster: v.poster ?? null,
      openUrl: v.url,
      // Link Drive studio tự dán = studio đã chủ ý chia sẻ file đó cho khách.
      downloadUrl: v.drive_id ? `/api/img?id=${encodeURIComponent(v.drive_id)}&dl=1` : null,
    }));
    const fromAlbum = albumVideos.map((v) => ({
      key: v.id,
      title: v.name.replace(/\.[a-z0-9]{2,4}$/i, ""),
      kind: "drive" as const,
      embed: `https://drive.google.com/file/d/${v.drive_file_id}/preview`,
      poster: thumbnailUrl(v.drive_file_id, 1024),
      openUrl: `https://drive.google.com/file/d/${v.drive_file_id}/view`,
      downloadUrl: canDownload ? `/api/img?id=${encodeURIComponent(v.drive_file_id)}&dl=1` : null,
    }));
    return [...fromLinks, ...fromAlbum];
  }, [linkVideos, albumVideos, canDownload]);

  const hasContent = !!album || !!albumLink || !!originalsLink || videos.length > 0;
  // Không có ảnh nhưng có video → mở thẳng tab Video, khỏi bắt khách bấm thêm.
  const [tab, setTab] = useState<Tab>(() => initialTab ?? (photos.length === 0 && !albumLink && videos.length > 0 ? "videos" : "photos"));
  const coverW = useFullImageWidth();
  const cover = album?.cover_url || (photos[0] ? fullImageUrl(photos[0].drive_file_id, coverW) : null);

  async function sendRating(stars: number) {
    setRating(stars);
    // Mất mạng → `fetch` ném ra ngoài, sao đã sáng lên mà đánh giá không tới
    // studio và khách tưởng đã gửi. Nói thật thay vì im lặng.
    let res: Response;
    try {
      res = await fetch(`/api/c/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "review", phone, rating: stars, message: "" }),
      });
    } catch {
      setRating(0);
      toast("Đang mất mạng — chưa gửi được đánh giá. Thử lại khi có mạng nhé.");
      return;
    }
    if (res.ok) {
      setRated(true);
      toast("Cảm ơn bạn đã đánh giá!");
      return;
    }
    const j = (await res.json().catch(() => ({}))) as { message?: string };
    toast(j.message || "Chưa gửi được đánh giá, thử lại sau.");
  }

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: c.client_name || c.title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast("Đã sao chép đường dẫn album.");
    } catch {
      toast("Không chia sẻ được — hãy sao chép đường dẫn trên trình duyệt.");
    }
  }

  const TABS: { key: Tab; label: string; n: number | null }[] = [
    { key: "photos", label: "Ảnh", n: photos.length },
    { key: "videos", label: "Video", n: videos.length },
    { key: "files", label: "Tải về", n: null },
  ];

  return (
    <main className="min-h-screen" style={{ background: BG, color: "#fff" }}>
      <div className="mx-auto w-full max-w-[1180px] px-[18px] pb-[70px] pt-[22px]">
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        {/* Tỉ lệ khung đổi theo màn hình. KHÔNG dùng `minHeight` cùng
            `aspectRatio`: trình duyệt suy ngược ra bề rộng tối thiểu (260 × 21/8
            ≈ 680px) và khung tràn khỏi màn điện thoại, kéo cả trang tràn ngang. */}
        <div
          className="relative flex aspect-[4/3] items-end overflow-hidden rounded-[20px] sm:aspect-[21/8]"
          style={{ background: CARD, border: `1px solid ${LINE}` }}
        >
          {cover && (
            <img src={cover} alt="" fetchPriority="high" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
          )}
          <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(10,8,11,.86), transparent)" }} />
          <div className="relative w-full px-6 pb-6 sm:px-8 sm:pb-8">
            <p className="text-[11px] font-bold uppercase" style={{ letterSpacing: "2px", color: "rgba(255,255,255,.72)" }}>
              {[c.event_date ? fmtDate(c.event_date) : null, c.location].filter(Boolean).join(" · ") || data.studio_name}
            </p>
            <h1 className="font-serif text-[30px] font-semibold leading-tight sm:text-[40px]" style={{ textWrap: "balance" }}>
              {c.client_name || c.title}
            </h1>
          </div>
        </div>

        {/* ── Tab + hành động ──────────────────────────────────────────── */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {/* Điện thoại: tab chiếm trọn một hàng, nút hành động xuống hàng dưới. */}
          <div className="flex w-full items-center gap-1 rounded-[12px] p-1 sm:w-auto sm:flex-none" style={{ background: "rgba(255,255,255,.06)" }}>
            {TABS.map((t) => {
              const on = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className="flex-1 rounded-[9px] px-3 py-2 text-[12.5px] sm:flex-none"
                  style={on ? { background: "#fff", color: BG, fontWeight: 700 } : { color: DIM, fontWeight: 600 }}
                >
                  {t.label}{t.n != null ? ` (${t.n})` : ""}
                </button>
              );
            })}
          </div>

          <button
            onClick={share}
            className="ml-auto flex flex-none items-center gap-1.5 rounded-[10px] px-3 py-2 text-[12.5px] font-semibold"
            style={{ border: `1px solid ${LINE}`, color: "#fff" }}
          >
            <Share2 size={15} /> Chia sẻ
          </button>
          {albumLink ? (
            <a
              href={albumLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-none items-center gap-1.5 rounded-[10px] px-3.5 py-2 text-[12.5px] font-bold"
              style={{ background: "#fff", color: BG }}
            >
              <Images size={15} /> Mở album hoàn thiện
            </a>
          ) : album && (
            <Link
              href={`/album/${album.slug}`}
              className="flex flex-none items-center gap-1.5 rounded-[10px] px-3.5 py-2 text-[12.5px] font-bold"
              style={{ background: "#fff", color: BG }}
            >
              <Download size={15} /> Tải toàn bộ
            </Link>
          )}
        </div>

        {/* ── Nội dung ─────────────────────────────────────────────────── */}
        {!hasContent ? (
          <Empty title="Album đang được studio hoàn thiện" hint="Ngay khi studio giao album, ảnh và video sẽ hiện ở đây." />
        ) : (
          <div key={tab} className="mt-3.5 animate-[vkFade_.3s_ease_both]">
            {tab === "photos" && (
              photos.length === 0 ? (
                albumLink ? (
                  <a
                    href={albumLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3.5 flex flex-col items-center rounded-[16px] px-5 py-10 text-center"
                    style={{ background: CARD, border: `1px solid ${LINE}` }}
                  >
                    <Images size={26} />
                    <span className="mt-2 text-[14.5px] font-bold">Album hoàn thiện đã sẵn sàng</span>
                    <span className="mt-1 text-[12.5px]" style={{ color: DIM }}>Bấm để mở album, xem và tải ảnh về.</span>
                  </a>
                ) : (
                  <Empty title="Chưa có ảnh trong album" hint="Studio sẽ đưa ảnh đã chỉnh màu lên đây." />
                )
              ) : (
                <PortalPhotoGrid photos={photos} canDownload={canDownload} watermark={album?.watermark ?? null} toast={toast} />
              )
            )}

            {tab === "videos" && (
              videos.length === 0 ? (
                <Empty title="Hợp đồng này không có video" hint="Nếu bạn muốn thêm video highlight, hãy nhắn cho studio." />
              ) : (
                <PortalVideos videos={videos} />
              )
            )}

            {tab === "files" && (
              <div className="flex flex-col gap-2.5">
                {originalsLink && (
                  <FileRow href={originalsLink} external icon={FolderDown} title="Toàn bộ file gốc" sub="Thư mục chứa toàn bộ file gốc — mở để tải về máy" />
                )}
                {albumLink && (
                  <FileRow href={albumLink} external icon={Images} title="Album hoàn thiện" sub="Mở album để xem và tải ảnh về" />
                )}
                {videos.filter((v) => v.key.startsWith("link-")).map((v) => (
                  <FileRow key={v.key} href={v.downloadUrl ?? v.openUrl} external={!v.downloadUrl} icon={Video} title={v.title} sub={v.downloadUrl ? "Tải video về máy" : "Mở để xem video"} />
                ))}
                {album && (
                <FileRow
                  href={`/album/${album.slug}`}
                  icon={Images}
                  title="Toàn bộ ảnh đã chỉnh"
                  sub={`${photos.length} ảnh · mở album để chọn và tải về`}
                />
                )}
                {album && albumVideos.length > 0 && (
                  <FileRow
                    href={`/album/${album.slug}`}
                    icon={Video}
                    title="Video"
                    sub={`${albumVideos.length} video · tải bản gốc từ album`}
                  />
                )}
                {data.wedding?.published && (
                  <FileRow href={`/thiep/${data.wedding.slug}`} icon={Images} title="Thiệp cưới điện tử" sub="Studio tặng kèm hợp đồng" />
                )}
                {data.story?.published && (
                  <FileRow href={`/story/${data.story.slug}`} icon={Images} title="Trang Love Story" sub="Studio tặng kèm hợp đồng" />
                )}
                <p className="mt-1 text-[11.5px]" style={{ color: DIM, textWrap: "pretty" }}>
                  Studio có thể dọn ảnh gốc trên Drive sau một thời gian lưu trữ — hãy tải bản bạn muốn giữ về máy sớm.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Đánh giá ─────────────────────────────────────────────────── */}
        <div className="mt-5 rounded-[16px] px-5 py-5 text-center" style={{ background: "rgba(255,255,255,.05)", border: `1px solid ${LINE}` }}>
          <p className="text-[14.5px] font-bold">{rated ? "Cảm ơn bạn đã đánh giá!" : `Bạn hài lòng với ${data.studio_name} chứ?`}</p>
          <p className="mt-1 text-[12.5px]" style={{ color: DIM }}>
            {rated ? "Đánh giá của bạn đã được gửi tới studio." : "Chọn số sao để gửi cảm nhận cho studio."}
          </p>
          <div className="mt-3 flex items-center justify-center gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => !rated && sendRating(n)}
                disabled={rated}
                aria-label={`${n} sao`}
                style={{ lineHeight: 0 }}
              >
                <Star size={27} fill={n <= rating ? STAR_ON : "transparent"} style={{ color: n <= rating ? STAR_ON : STAR_OFF }} />
              </button>
            ))}
          </div>
          {rated && (
            <p className="mt-2 flex items-center justify-center gap-1.5 text-[12px] font-semibold" style={{ color: "#8FE3BC" }}>
              <Check size={14} /> Đã gửi {rating} sao
            </p>
          )}
        </div>

        <p className="mt-5 text-center text-[11.5px]" style={{ color: DIM }}>
          <Link href={`/c/${token}`} style={{ color: "rgba(255,255,255,.72)", fontWeight: 600 }}>Xem lại hợp đồng</Link>
          {" · "}{data.studio_name}
        </p>
      </div>

      {toastNode}
    </main>
  );
}

function FileRow({ href, icon: Icon, title, sub, external }: { href: string; icon: typeof Images; title: string; sub: string; external?: boolean }) {
  const body = (
    <>
      <span className="flex-none rounded-[10px] p-2" style={{ background: "rgba(255,255,255,.06)", lineHeight: 0 }}>
        <Icon size={17} style={{ color: "#fff" }} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-bold">{title}</span>
        <span className="block truncate text-[11.5px]" style={{ color: DIM }}>{sub}</span>
      </span>
      {external ? <ExternalLink size={17} style={{ flex: "none", color: DIM }} /> : <Download size={17} style={{ flex: "none", color: DIM }} />}
    </>
  );
  const cls = "flex items-center gap-3 rounded-[13px] px-4 py-3.5";
  const style = { background: CARD, border: `1px solid ${LINE}` };
  if (external) return <a href={href} target="_blank" rel="noopener noreferrer" className={cls} style={style}>{body}</a>;
  // Link tải file (/api/img?dl=1 → Drive) phải là <a> thường: <Link> của Next
  // sẽ tải trước và điều hướng phía client tới một route API.
  if (href.startsWith("/api/")) return <a href={href} rel="noopener" className={cls} style={style}>{body}</a>;
  return <Link href={href} className={cls} style={style}>{body}</Link>;
}

function Empty({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="mt-3.5 rounded-[16px] px-5 py-10 text-center" style={{ background: CARD, border: `1px solid ${LINE}` }}>
      <p className="text-[14.5px] font-bold">{title}</p>
      <p className="mt-1 text-[12.5px]" style={{ color: DIM }}>{hint}</p>
    </div>
  );
}
