"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Music, Pause } from "lucide-react";
import { usePreview } from "./preview-mode";
import { parseYoutubeMusic, type YoutubeMusic } from "@/lib/youtube-music";

/** Điều khiển chung cho hai nguồn nhạc: thẻ <audio> và trình phát YouTube ẩn. */
type MusicCtl = { play(): void; pause(): void; paused(): boolean };

/**
 * Floating background-music toggle. Tries to autoplay (browsers usually block
 * it until the first interaction), and lets the guest start/stop the music.
 *
 * File nhạc (mp3… hoặc file đã tải lên) phát bằng <audio>. Link YouTube thì
 * <audio> không đọc được — phát bằng trình phát YouTube ẩn (IFrame API).
 */
export default function MusicPlayer({ url, autoplay }: { url: string; autoplay?: boolean }) {
  const ref = useRef<HTMLAudioElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [playing, setPlaying] = useState(false);
  const { preview, thumb } = usePreview();
  // Trong bản xem trước không tự phát nhạc (khỏi giật mình khi đang sửa thiệp).
  const auto = autoplay && !preview;
  const yt = useMemo(() => parseYoutubeMusic(url), [url]);
  const tube = useYoutubeMusic(thumb ? null : yt, setPlaying);

  const audio = useMemo<MusicCtl>(() => ({
    play: () => { ref.current?.play().then(() => setPlaying(true)).catch(() => setPlaying(false)); },
    pause: () => { ref.current?.pause(); setPlaying(false); },
    paused: () => ref.current?.paused ?? true,
  }), []);
  const music = yt ? tube.music : audio;

  useEffect(() => {
    if (auto) music.play();
  }, [auto, music]);

  // Some browsers only allow audio after a user gesture — start on first tap.
  useEffect(() => {
    if (!auto) return;
    const start = (e: PointerEvent) => {
      // Chạm thẳng vào nút nhạc → để toggle() lo, kẻo vừa bật đã bị tắt ngay.
      if (btnRef.current?.contains(e.target as Node)) return;
      music.play();
    };
    window.addEventListener("pointerdown", start, { once: true });
    return () => window.removeEventListener("pointerdown", start);
  }, [auto, music]);

  function toggle() {
    if (music.paused()) music.play();
    else music.pause();
  }

  if (thumb) return null;

  const btn = (
    <button
      ref={btnRef}
      onClick={toggle}
      aria-label="Nhạc nền"
      className="grid h-12 w-12 place-items-center rounded-full text-white shadow-lg transition active:scale-95"
      style={{ background: "var(--wed-accent)" }}
    >
      <span className={playing ? "animate-spin-slow" : ""}>{playing ? <Pause size={18} /> : <Music size={18} />}</span>
    </button>
  );

  return (
    <>
      {yt ? (
        // Đẩy ra ngoài màn hình chứ không display:none — trình phát bị ẩn hẳn có
        // thể không chịu phát. Khung này phải luôn còn (kể cả khi lỗi) để đổi
        // link trong trình chỉnh sửa thì trình phát dựng lại được.
        <div ref={tube.box} aria-hidden style={{ position: "fixed", left: -10000, top: 0, width: 200, height: 200, opacity: 0, pointerEvents: "none" }} />
      ) : (
        <audio ref={ref} src={url} loop preload="none" />
      )}
      {tube.failed ? null : preview ? (
        // Khung xem trước có thanh cuộn riêng → dùng sticky để nút bám đáy KHUNG
        // (position:fixed sẽ bám theo cửa sổ trình duyệt, lọt ra ngoài khung).
        <div style={{ position: "sticky", bottom: 16, zIndex: 50, height: 0, display: "flex", justifyContent: "flex-end", paddingRight: 16 }}>
          <span style={{ transform: "translateY(-100%)", display: "inline-flex" }}>{btn}</span>
        </div>
      ) : (
        <div className="fixed bottom-5 right-5 z-50">{btn}</div>
      )}
      <style>{`@keyframes wed-spin{to{transform:rotate(360deg)}}.animate-spin-slow{display:inline-flex;animation:wed-spin 3s linear infinite}`}</style>
    </>
  );
}

/* ── Trình phát YouTube ẩn ─────────────────────────────────────────────── */

type YTPlayer = {
  playVideo(): void;
  pauseVideo(): void;
  unMute(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getPlayerState(): number;
  destroy(): void;
};
type YTApi = { Player: new (el: HTMLElement, opts: object) => YTPlayer };

declare global {
  interface Window {
    YT?: YTApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

/** Trạng thái trình phát YouTube (YT.PlayerState). */
const ENDED = 0, PLAYING = 1, PAUSED = 2, BUFFERING = 3;

let ytApi: Promise<YTApi> | null = null;

/** Nạp IFrame API của YouTube đúng một lần cho cả trang. */
function loadYoutubeApi(): Promise<YTApi> {
  ytApi ??= new Promise<YTApi>((resolve, reject) => {
    if (window.YT?.Player) return resolve(window.YT);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      if (window.YT) resolve(window.YT);
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.async = true;
    s.onerror = () => {
      ytApi = null;
      reject(new Error("youtube_api"));
    };
    document.head.appendChild(s);
  });
  return ytApi;
}

function useYoutubeMusic(yt: YoutubeMusic | null, setPlaying: (v: boolean) => void) {
  const box = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  const ready = useRef(false);
  // Khách đã bấm phát trong lúc trình phát chưa kịp tải xong → phát ngay khi sẵn sàng.
  const want = useRef(false);
  const [failed, setFailed] = useState(false);
  const id = yt?.id;
  const start = yt?.start ?? 0;

  useEffect(() => {
    const host = box.current;
    if (!id || !host) return;
    let alive = true;
    setFailed(false);
    const el = document.createElement("div");
    host.appendChild(el);
    loadYoutubeApi()
      .then((YT) => {
        if (!alive) return;
        player.current = new YT.Player(el, {
          videoId: id,
          width: 200,
          height: 200,
          playerVars: { start, playsinline: 1, controls: 0, disablekb: 1, fs: 0, rel: 0, iv_load_policy: 3 },
          events: {
            onReady: (e: { target: YTPlayer }) => {
              ready.current = true;
              if (want.current) { e.target.unMute(); e.target.playVideo(); }
            },
            onStateChange: (e: { data: number; target: YTPlayer }) => {
              if (e.data === PLAYING) setPlaying(true);
              else if (e.data === PAUSED) setPlaying(false);
              // Hết bài → phát lại từ mốc đã chọn (tham số loop của YouTube luôn quay về giây 0).
              else if (e.data === ENDED) { e.target.seekTo(start, true); e.target.playVideo(); }
            },
            // Video bị gỡ / để riêng tư / chủ sở hữu chặn phát trên web khác → ẩn nút nhạc.
            onError: () => { setFailed(true); setPlaying(false); },
          },
        });
      })
      .catch(() => { if (alive) setFailed(true); });
    return () => {
      alive = false;
      ready.current = false;
      want.current = false;
      player.current?.destroy();
      player.current = null;
      host.replaceChildren();
      setPlaying(false);
    };
  }, [id, start, setPlaying]);

  const music = useMemo<MusicCtl>(() => ({
    play: () => {
      const p = player.current;
      if (p && ready.current) { p.unMute(); p.playVideo(); }
      else want.current = true;
    },
    pause: () => {
      want.current = false;
      if (ready.current) player.current?.pauseVideo();
      setPlaying(false);
    },
    paused: () => {
      if (!ready.current) return !want.current;
      const s = player.current?.getPlayerState();
      return s !== PLAYING && s !== BUFFERING;
    },
  }), [setPlaying]);

  return { box, failed, music };
}
