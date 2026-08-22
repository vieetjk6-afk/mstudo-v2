"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Images, Video, Download, Star, Share2, Play, X as XIcon, ChevronLeft, ChevronRight, Check,
} from "lucide-react";
import { useToast } from "@/components/studio/Toast";
import { Portal } from "@/components/studio/Modal";
import { fullImageUrl, thumbnailUrl } from "@/lib/drive";
import { fmtDate } from "@/lib/date";
import type { PortalPayload } from "./types";

/* ═══════════════════════════════════════════════════════════════════════════
   TRANG ALBUM — giai đoạn HOÀN THÀNH của cổng khách hàng

   Cùng route /portal/<token>: hợp đồng chuyển sang trạng thái "Hoàn thành" thì
   trang tự đổi sang bản nền TỐI này (ảnh phải nổi trên nền tối, đây là cách mọi
   trang trưng ảnh chuyên nghiệp làm).

   Màu ở đây CỐ Ý viết cứng chứ không dùng token: đó là một bảng màu riêng của
   bản thiết kế cho trang album, không đổi theo chế độ sáng/tối của khách — ảnh
   cưới phải luôn nằm trên đúng một nền.

   Tải hàng loạt và xem toàn bộ ảnh vẫn dùng trang album sẵn có (/album/<slug>):
   nơi đó đã có nén ZIP, đóng dấu mờ, và luật hạn lưu trữ ảnh gốc. Trang này là
   bề mặt trưng bày + đánh giá, không dựng lại những thứ đó lần thứ hai.
   ═══════════════════════════════════════════════════════════════════════════ */

const BG = "#141215";
const CARD = "#1E1B1F";
const LINE = "rgba(255,255,255,.08)";
const DIM = "rgba(255,255,255,.5)";
const STAR_ON = "#F0B429";
const STAR_OFF = "rgba(255,255,255,.22)";

type Tab = "photos" | "videos" | "files";

export default function AlbumView({ token, phone, data }: { token: string; phone: string; data: PortalPayload }) {
  const { toast, toastNode } = useToast();
  const [tab, setTab] = useState<Tab>("photos");
  const [rating, setRating] = useState(0);
  const [rated, setRated] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);

  const c = data.contract;
  const album = data.album;
  const photos = useMemo(() => (album?.photos ?? []).filter((p) => !p.is_video), [album]);
  const videos = useMemo(() => (album?.photos ?? []).filter((p) => p.is_video), [album]);
  const cover = album?.cover_url || (photos[0] ? fullImageUrl(photos[0].drive_file_id, 1600) : null);

  /** Điều hướng ảnh trong lightbox bằng bàn phím — album là màn để xem, không
   *  phải màn để bấm chuột từng tấm. */
  useEffect(() => {
    if (lightbox == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
      if (e.key === "ArrowRight") setLightbox((i) => (i == null ? i : Math.min(photos.length - 1, i + 1)));
      if (e.key === "ArrowLeft") setLightbox((i) => (i == null ? i : Math.max(0, i - 1)));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, photos.length]);

  async function sendRating(stars: number) {
    setRating(stars);
    const res = await fetch(`/api/c/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "review", phone, rating: stars, message: "" }),
    });
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
        <div
          className="relative flex items-end overflow-hidden rounded-[20px]"
          style={{ aspectRatio: "21 / 8", minHeight: 260, background: CARD, border: `1px solid ${LINE}` }}
        >
          {cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
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
          <div className="flex flex-none items-center gap-1 rounded-[12px] p-1" style={{ background: "rgba(255,255,255,.06)" }}>
            {TABS.map((t) => {
              const on = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className="rounded-[9px] px-3 py-2 text-[12.5px]"
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
          {album && (
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
        {!album ? (
          <Empty title="Album đang được studio hoàn thiện" hint="Ngay khi studio giao album, ảnh và video sẽ hiện ở đây." />
        ) : (
          <div key={tab} className="mt-3.5 animate-[vkFade_.3s_ease_both]">
            {tab === "photos" && (
              photos.length === 0 ? (
                <Empty title="Chưa có ảnh trong album" hint="Studio sẽ đưa ảnh đã chỉnh màu lên đây." />
              ) : (
                <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))" }}>
                  {photos.map((p, i) => (
                    <button
                      key={p.id}
                      onClick={() => setLightbox(i)}
                      className="overflow-hidden rounded-[13px]"
                      style={{ aspectRatio: "4 / 5", background: CARD, border: `1px solid ${LINE}` }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={thumbnailUrl(p.drive_file_id, 500)} alt={p.name} loading="lazy" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )
            )}

            {tab === "videos" && (
              videos.length === 0 ? (
                <Empty title="Hợp đồng này không có video" hint="Nếu bạn muốn thêm video highlight, hãy nhắn cho studio." />
              ) : (
                <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
                  {videos.map((v) => (
                    <a
                      key={v.id}
                      href={`https://drive.google.com/file/d/${v.drive_file_id}/view`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="overflow-hidden rounded-[13px]"
                      style={{ background: CARD, border: `1px solid ${LINE}` }}
                    >
                      <span className="relative block" style={{ aspectRatio: "16 / 9" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={thumbnailUrl(v.drive_file_id, 640)} alt={v.name} loading="lazy" className="h-full w-full object-cover" />
                        <span
                          className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full"
                          style={{ background: "rgba(255,255,255,.92)", color: BG }}
                        >
                          <Play size={20} style={{ marginLeft: 2 }} />
                        </span>
                      </span>
                      <span className="block px-3.5 py-3 text-[14px] font-bold" style={{ textWrap: "pretty" }}>{v.name}</span>
                    </a>
                  ))}
                </div>
              )
            )}

            {tab === "files" && (
              <div className="flex flex-col gap-2.5">
                <FileRow
                  href={`/album/${album.slug}`}
                  icon={Images}
                  title="Toàn bộ ảnh đã chỉnh"
                  sub={`${photos.length} ảnh · mở album để chọn và tải về`}
                />
                {videos.length > 0 && (
                  <FileRow
                    href={`/album/${album.slug}`}
                    icon={Video}
                    title="Video"
                    sub={`${videos.length} video · tải bản gốc từ album`}
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

      {/* ── Lightbox ─────────────────────────────────────────────────────── */}
      {lightbox != null && photos[lightbox] && (
        // Portal ra <body>: khung xem ảnh phải phủ đúng khung nhìn, không phụ
        // thuộc phần tử cha nào (xem ghi chú trong components/studio/Modal.tsx).
        <Portal>
        <div className="fixed inset-0 z-[160] flex items-center justify-center" style={{ background: "rgba(8,6,9,.94)" }} onClick={() => setLightbox(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fullImageUrl(photos[lightbox].drive_file_id, 1600)}
            alt={photos[lightbox].name}
            className="max-h-[88vh] max-w-[94vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setLightbox(null)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full"
            style={{ background: "rgba(255,255,255,.1)", color: "#fff" }}
            aria-label="Đóng"
          >
            <XIcon size={18} />
          </button>
          {lightbox > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightbox(lightbox - 1); }}
              className="absolute left-3 flex h-11 w-11 items-center justify-center rounded-full"
              style={{ background: "rgba(255,255,255,.1)", color: "#fff" }}
              aria-label="Ảnh trước"
            >
              <ChevronLeft size={20} />
            </button>
          )}
          {lightbox < photos.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightbox(lightbox + 1); }}
              className="absolute right-3 flex h-11 w-11 items-center justify-center rounded-full"
              style={{ background: "rgba(255,255,255,.1)", color: "#fff" }}
              aria-label="Ảnh sau"
            >
              <ChevronRight size={20} />
            </button>
          )}
          <p className="tnum absolute bottom-4 left-1/2 -translate-x-1/2 text-[12px]" style={{ color: DIM }}>
            {lightbox + 1} / {photos.length}
          </p>
        </div>
        </Portal>
      )}

      {toastNode}
    </main>
  );
}

function FileRow({ href, icon: Icon, title, sub }: { href: string; icon: typeof Images; title: string; sub: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-[13px] px-4 py-3.5"
      style={{ background: CARD, border: `1px solid ${LINE}` }}
    >
      <span className="flex-none rounded-[10px] p-2" style={{ background: "rgba(255,255,255,.06)", lineHeight: 0 }}>
        <Icon size={17} style={{ color: "#fff" }} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-bold">{title}</span>
        <span className="block truncate text-[11.5px]" style={{ color: DIM }}>{sub}</span>
      </span>
      <Download size={17} style={{ flex: "none", color: DIM }} />
    </Link>
  );
}

function Empty({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="mt-3.5 rounded-[16px] px-5 py-10 text-center" style={{ background: CARD, border: `1px solid ${LINE}` }}>
      <p className="text-[14.5px] font-bold">{title}</p>
      <p className="mt-1 text-[12.5px]" style={{ color: DIM }}>{hint}</p>
    </div>
  );
}
