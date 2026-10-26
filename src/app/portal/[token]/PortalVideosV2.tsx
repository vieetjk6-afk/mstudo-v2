"use client";

import { Download, ExternalLink, Film, Play } from "lucide-react";
import { Section, btn } from "@/components/v2/kit";
import { autoplayUrl } from "@/lib/final-links";
import { Poster, VIDEO_KIND_LABEL, usePortalVideoPlayer, type PortalVideo } from "./PortalVideos";

/* ═══════════════════════════════════════════════════════════════════════════
   VIDEO — cổng khách, giao diện mới. Cùng cơ chế với PortalVideos: một khung
   phát 16:9, iframe chỉ dựng SAU khi khách bấm phát; danh sách phát bên phải
   (máy tính) hoặc ngay dưới (điện thoại). Khác ở phần vẽ: thẻ và nút của bộ V2.
   ═══════════════════════════════════════════════════════════════════════════ */

export default function PortalVideosV2({ videos }: { videos: PortalVideo[] }) {
  const { cur, playing, setPlaying, stageRef, v, many, pick } = usePortalVideoPlayer(videos);
  if (!v) return null;

  return (
    <div className={many ? "grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_330px]" : "min-w-0"}>
      <div className="min-w-0">
        <div
          ref={stageRef}
          className="relative overflow-hidden rounded-[16px]"
          style={{ aspectRatio: "16 / 9", background: "#000", border: "1px solid var(--bd)", scrollMarginTop: 76 }}
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

        <div className="mt-3 flex flex-wrap items-start gap-x-3 gap-y-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-[16px] font-semibold leading-snug" style={{ textWrap: "balance" }}>{v.title}</h3>
            <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--tx3)" }}>
              {many ? `Video ${cur + 1} / ${videos.length} · ` : ""}{VIDEO_KIND_LABEL[v.kind]}
            </p>
          </div>
          <div className="flex flex-none gap-2">
            <a href={v.openUrl} target="_blank" rel="noopener noreferrer" className={btn("secondary", "sm")}>
              <ExternalLink size={15} /> Mở tab mới
            </a>
            {v.downloadUrl && (
              <a href={v.downloadUrl} rel="noopener" className={btn("secondary", "sm")}>
                <Download size={15} /> Tải video
              </a>
            )}
          </div>
        </div>
      </div>

      {many && (
        <Section title="Danh sách phát" desc={`${videos.length} video`} flush>
          <ul className="flex flex-col p-1.5 lg:max-h-[460px] lg:overflow-y-auto">
            {videos.map((x, i) => {
              const on = i === cur;
              return (
                <li key={x.key}>
                  <button
                    type="button"
                    onClick={() => pick(i)}
                    className="flex w-full items-center gap-3 rounded-[11px] p-1.5 text-left transition-colors"
                    style={{ background: on ? "var(--acS)" : "transparent" }}
                    aria-current={on ? "true" : undefined}
                  >
                    <span className="relative block w-[112px] flex-none overflow-hidden rounded-[8px]" style={{ aspectRatio: "16 / 9", background: "#000" }}>
                      {x.poster ? (
                        <img src={x.poster} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center" style={{ color: "rgba(255,255,255,.55)" }}><Film size={20} /></span>
                      )}
                      {on && (
                        <span className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,.42)", color: "#fff" }}>
                          <Play size={18} fill="currentColor" />
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-[13.5px] font-semibold leading-snug" style={{ color: on ? "var(--ac)" : "var(--tx)" }}>{x.title}</span>
                      <span className="mt-0.5 block text-[12px]" style={{ color: "var(--tx3)" }}>
                        {on ? (playing ? "Đang phát · " : "Đang chọn · ") : ""}{VIDEO_KIND_LABEL[x.kind]}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Section>
      )}
    </div>
  );
}
