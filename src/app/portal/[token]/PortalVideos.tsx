"use client";

import { useRef, useState } from "react";
import { Download, ExternalLink, Film, Play } from "lucide-react";
import { autoplayUrl, type VideoKind } from "@/lib/final-links";
import { CARD, DIM, LINE } from "./dark";

/* ═══════════════════════════════════════════════════════════════════════════
   KHU XEM VIDEO của trang album nền tối (/portal)

   Bố cục kiểu rạp chiếu: MỘT khung phát lớn 16:9 ở trên, danh sách phát bên
   phải (máy tính) hoặc ngay bên dưới (điện thoại). Bản trước là lưới thẻ nhỏ,
   bấm vào là bị đẩy sang tab Drive — không giống nơi xem phim cưới chút nào.

   Khung phát chỉ dựng <iframe> SAU khi khách bấm phát: chưa bấm thì chỉ là ảnh
   bìa + nút phát. Một iframe YouTube/Drive nặng vài trăm KB script, nhúng sẵn
   cả chục cái là trang chậm hẳn — mà khách thường chỉ xem một hai video.
   ═══════════════════════════════════════════════════════════════════════════ */

export type PortalVideo = {
  key: string;
  title: string;
  kind: VideoKind;
  embed: string | null;
  poster: string | null;
  /** Mở ở tab mới (trang gốc của video). */
  openUrl: string;
  /** Link tải về — null khi studio không cho tải hoặc nguồn không hỗ trợ. */
  downloadUrl: string | null;
};

const KIND_LABEL: Record<VideoKind, string> = {
  youtube: "YouTube",
  vimeo: "Vimeo",
  drive: "Google Drive",
  other: "Liên kết ngoài",
};

export default function PortalVideos({ videos }: { videos: PortalVideo[] }) {
  const [cur, setCur] = useState(0);
  const [playing, setPlaying] = useState(false);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const v = videos[cur] ?? videos[0];
  if (!v) return null;
  const many = videos.length > 1;

  function pick(i: number) {
    setCur(i);
    // Khách đã bấm chọn → phát luôn (thao tác bấm cho phép tự chạy).
    setPlaying(!!videos[i]?.embed);
    // Điện thoại: danh sách nằm dưới khung phát — cuộn lên cho thấy video.
    const top = stageRef.current?.getBoundingClientRect().top ?? 0;
    if (top < 0) stageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className={many ? "grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]" : "mx-auto max-w-[980px]"}>
      {/* ── Khung phát ────────────────────────────────────────────────── */}
      <div>
        <div
          ref={stageRef}
          className="relative overflow-hidden rounded-[18px]"
          style={{ aspectRatio: "16 / 9", background: "#000", border: `1px solid ${LINE}`, boxShadow: "0 24px 60px rgba(0,0,0,.45)", scrollMarginTop: 12 }}
        >
          {playing && v.embed ? (
            <iframe
              key={v.key}
              src={autoplayUrl(v.embed, v.kind)}
              title={v.title}
              className="absolute inset-0 h-full w-full"
              style={{ border: 0 }}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
            />
          ) : (
            <Poster video={v} onPlay={() => setPlaying(true)} />
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-start gap-x-3 gap-y-2 px-0.5">
          <div className="min-w-0 flex-1">
            <h3 className="font-serif text-[19px] font-semibold leading-snug sm:text-[22px]" style={{ textWrap: "balance" }}>{v.title}</h3>
            <p className="mt-0.5 text-[12px]" style={{ color: DIM }}>
              {many ? `Video ${cur + 1} / ${videos.length} · ` : ""}{KIND_LABEL[v.kind]}
            </p>
          </div>
          <div className="flex flex-none gap-2">
            <a
              href={v.openUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-[12.5px] font-semibold"
              style={{ border: `1px solid ${LINE}`, color: "#fff" }}
            >
              <ExternalLink size={15} /> Mở tab mới
            </a>
            {v.downloadUrl && (
              <a
                href={v.downloadUrl}
                rel="noopener"
                className="flex items-center gap-1.5 rounded-[10px] px-3.5 py-2 text-[12.5px] font-bold"
                style={{ background: "#fff", color: "#141215" }}
              >
                <Download size={15} /> Tải video
              </a>
            )}
          </div>
        </div>
      </div>

      {/* ── Danh sách phát ────────────────────────────────────────────── */}
      {many && (
        <div className="rounded-[16px] p-2" style={{ background: CARD, border: `1px solid ${LINE}` }}>
          <p className="px-2 pb-2 pt-1.5 text-[11px] font-bold uppercase" style={{ letterSpacing: "1.5px", color: DIM }}>
            Danh sách phát · {videos.length} video
          </p>
          <ul className="flex flex-col gap-1 lg:max-h-[520px] lg:overflow-y-auto">
            {videos.map((x, i) => {
              const on = i === cur;
              return (
                <li key={x.key}>
                  <button
                    type="button"
                    onClick={() => pick(i)}
                    className="flex w-full items-center gap-3 rounded-[11px] p-1.5 text-left transition-colors"
                    style={{ background: on ? "rgba(255,255,255,.09)" : "transparent" }}
                    aria-current={on ? "true" : undefined}
                  >
                    <span className="relative block w-[124px] flex-none overflow-hidden rounded-[8px]" style={{ aspectRatio: "16 / 9", background: "#000" }}>
                      {x.poster ? (
                        <img src={x.poster} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center" style={{ color: DIM }}><Film size={20} /></span>
                      )}
                      <span className="absolute inset-0 flex items-center justify-center" style={{ background: on ? "rgba(0,0,0,.45)" : "transparent" }}>
                        {on && <span className="text-[10.5px] font-bold uppercase" style={{ letterSpacing: "1px" }}>{playing ? "Đang phát" : "Đang chọn"}</span>}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-[13.5px] font-bold leading-snug" style={{ color: on ? "#fff" : "rgba(255,255,255,.86)" }}>{x.title}</span>
                      <span className="mt-0.5 block text-[11.5px]" style={{ color: DIM }}>{KIND_LABEL[x.kind]}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function Poster({ video, onPlay }: { video: PortalVideo; onPlay: () => void }) {
  const inner = (
    <>
      {video.poster ? (
        <img src={video.poster} alt="" decoding="async" fetchPriority="high" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <span className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 30% 20%, #3a2f3b, #0d0b0e 70%)" }} />
      )}
      <span className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,.72), rgba(0,0,0,.12) 55%, rgba(0,0,0,.25))" }} />
      <span
        className="absolute left-1/2 top-1/2 flex h-[68px] w-[68px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full transition-transform group-hover:scale-105 sm:h-20 sm:w-20"
        style={{ background: "rgba(255,255,255,.95)", color: "#141215", boxShadow: "0 10px 30px rgba(0,0,0,.4)" }}
      >
        <Play size={28} fill="currentColor" style={{ marginLeft: 4 }} />
      </span>
      <span className="absolute bottom-0 left-0 right-0 px-4 pb-3.5 text-left sm:px-6 sm:pb-5">
        <span className="block text-[10.5px] font-bold uppercase" style={{ letterSpacing: "1.5px", color: "rgba(255,255,255,.7)" }}>
          {video.embed ? "Bấm để xem" : "Mở video ở tab mới"}
        </span>
        <span className="mt-0.5 line-clamp-1 block font-serif text-[17px] font-semibold sm:text-[22px]">{video.title}</span>
      </span>
    </>
  );
  return video.embed ? (
    <button type="button" onClick={onPlay} className="group absolute inset-0 block w-full" aria-label={`Phát ${video.title}`}>
      {inner}
    </button>
  ) : (
    <a href={video.openUrl} target="_blank" rel="noopener noreferrer" className="group absolute inset-0 block" aria-label={`Mở ${video.title}`}>
      {inner}
    </a>
  );
}
