"use client";

import { useEffect, useRef, useState } from "react";
import { Music, Pause } from "lucide-react";
import { usePreview } from "./preview-mode";

/**
 * Floating background-music toggle. Tries to autoplay (browsers usually block
 * it until the first interaction), and lets the guest start/stop the music.
 */
export default function MusicPlayer({ url, autoplay }: { url: string; autoplay?: boolean }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const { preview, thumb } = usePreview();
  // Trong bản xem trước không tự phát nhạc (khỏi giật mình khi đang sửa thiệp).
  const auto = autoplay && !preview;

  useEffect(() => {
    if (!auto || !ref.current) return;
    ref.current.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }, [auto]);

  // Some browsers only allow audio after a user gesture — start on first tap.
  useEffect(() => {
    if (!auto) return;
    const start = () => {
      ref.current?.play().then(() => setPlaying(true)).catch(() => {});
      window.removeEventListener("pointerdown", start);
    };
    window.addEventListener("pointerdown", start, { once: true });
    return () => window.removeEventListener("pointerdown", start);
  }, [auto]);

  function toggle() {
    const a = ref.current;
    if (!a) return;
    if (a.paused) a.play().then(() => setPlaying(true)).catch(() => {});
    else { a.pause(); setPlaying(false); }
  }

  if (thumb) return null;

  const btn = (
    <button
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
      <audio ref={ref} src={url} loop preload="none" />
      {preview ? (
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
