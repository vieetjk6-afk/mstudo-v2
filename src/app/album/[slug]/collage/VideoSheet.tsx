"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Clapperboard, Download, LoaderCircle, Music, Share2 } from "lucide-react";
import { btn } from "@/components/v2/kit";
import type { CollageDoc } from "@/lib/collage/types";
import { formatById } from "@/lib/collage/formats";
import { loadImage, pageSlides, renderPage } from "@/lib/collage/render";
import { loadCollageFonts } from "@/lib/collage/text-layout";
import { docFontKeys } from "@/lib/collage/lockups";
import { decodeMusicFile, makeMusic, recordReel, reelDuration, reelSupport, type MusicKind, type ReelItem } from "@/lib/collage/reel";
import type { SignSpec } from "@/lib/collage/brand";
import { triggerDownload } from "@/lib/download";
import { Sheet } from "./ui";
import { rawImageUrl, slugify } from "./ExportSheet";

/* ═══════════════════════════════════════════════════════════════════════════
   TẠO VIDEO REELS / TIKTOK / STORY từ bộ ảnh ghép — ngay trên điện thoại
   (lib/collage/reel.ts). Nhạc nền máy tự soạn (không vướng bản quyền) hoặc file
   nhạc khách chọn trên máy (không tải lên đâu cả).
   ═══════════════════════════════════════════════════════════════════════════ */

const MUSIC: { v: MusicKind; label: string }[] = [
  { v: "soft", label: "Nhạc nhẹ" },
  { v: "happy", label: "Vui tươi" },
  { v: "file", label: "Nhạc trên máy" },
  { v: "none", label: "Không nhạc" },
];

export default function VideoSheet({
  doc,
  driveOf,
  rawSrc = rawImageUrl,
  watermark,
  sign,
  signLogo,
  baseName,
  onDone,
  onClose,
}: {
  doc: CollageDoc;
  driveOf: (id: string) => string | undefined;
  rawSrc?: (driveId: string, w: number) => string;
  watermark: string | null;
  sign: SignSpec | null;
  signLogo: HTMLImageElement | null;
  baseName: string;
  /** Video xong (để ghi thống kê cho studio). */
  onDone: (seconds: number, music: MusicKind) => void;
  onClose: () => void;
}) {
  const sup = useMemo(() => reelSupport(), []);
  const [music, setMusic] = useState<MusicKind>("soft");
  const [file, setFile] = useState<File | null>(null);
  const [secPer, setSecPer] = useState(3);
  const [phase, setPhase] = useState<"idle" | "prep" | "rec" | "done" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [out, setOut] = useState<{ file: File; url: string } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const f = formatById(doc.formatId);
  const scenes = doc.pages.length;
  const approx = Math.round(
    reelDuration(
      doc.pages.map((p) => ({ canvas: { width: f.w * pageSlides(p), height: f.h } as HTMLCanvasElement, pan: pageSlides(p) > 1, slides: pageSlides(p) })),
      secPer,
    ),
  );

  useEffect(
    () => () => {
      abort.current?.abort();
      if (out) URL.revokeObjectURL(out.url);
    },
    [out],
  );

  const getImage = useMemo(() => {
    const cache = new Map<string, Promise<HTMLImageElement>>();
    return (photoId: string, w: number) => {
      const d = driveOf(photoId);
      if (!d) return Promise.reject(new Error("no_photo"));
      const key = `${d}@${w}`;
      let pr = cache.get(key);
      if (!pr) {
        pr = loadImage(rawSrc(d, w));
        cache.set(key, pr);
      }
      return pr;
    };
  }, [driveOf, rawSrc]);

  /** Đổi cài đặt sau khi đã có video → bỏ video cũ (khác nhạc / thời lượng), về nút "Tạo video". */
  const reset = () => {
    if (phase === "prep" || phase === "rec") return;
    // URL của video cũ được effect dọn [out] ở trên thu hồi khi out đổi.
    setOut(null);
    setMsg(null);
    setPhase("idle");
  };

  async function make() {
    if (phase === "prep" || phase === "rec") return;
    // iPhone chỉ cho mở âm thanh trong đúng lượt chạm — mở ngay, trước mọi bước chờ.
    let audioCtx: AudioContext | null = null;
    if (music !== "none") {
      try {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioCtx = new AC();
        void audioCtx.resume();
      } catch {
        audioCtx = null;
      }
    }
    setMsg(null);
    setPhase("prep");
    setProgress(0);
    const ctl = new AbortController();
    abort.current = ctl;
    try {
      await loadCollageFonts(docFontKeys(doc));
      // Mỗi cảnh: ảnh của layout (carousel: ghép các slide thành một dải để lia).
      const items: ReelItem[] = [];
      for (const page of doc.pages) {
        const n = pageSlides(page);
        const scale = n > 6 ? 0.7 : 1;
        if (n === 1) {
          items.push({ canvas: await renderPage(doc, page, { scale, getImage, watermark, sign, signLogo }, Date.now()), pan: false });
        } else {
          const strip = document.createElement("canvas");
          strip.width = Math.round(f.w * n * scale);
          strip.height = Math.round(f.h * scale);
          const sx = strip.getContext("2d")!;
          for (let i = 0; i < n; i++) {
            const c = await renderPage(doc, page, { scale, getImage, watermark, sign, signLogo }, Date.now(), i);
            sx.drawImage(c, Math.round(f.w * i * scale), 0);
          }
          items.push({ canvas: strip, pan: true, slides: n });
        }
        if (ctl.signal.aborted) return;
      }
      const seconds = reelDuration(items, secPer);
      let audio: AudioBuffer | null = null;
      if (audioCtx && music === "file" && file) audio = await decodeMusicFile(file, audioCtx).catch(() => null);
      else if (audioCtx && (music === "soft" || music === "happy")) audio = await makeMusic(music, seconds + 1);
      setPhase("rec");
      const res = await recordReel(items, { secPer, audio, audioCtx, signal: ctl.signal, onProgress: setProgress });
      const name = `${slugify(baseName)}-video.${res.ext}`;
      const vf = new File([res.blob], name, { type: res.blob.type });
      setOut({ file: vf, url: URL.createObjectURL(res.blob) });
      setPhase("done");
      onDone(Math.round(res.seconds), music);
      if (res.ext === "webm") setMsg("Trình duyệt này chỉ xuất được video .webm — Facebook nhận, Instagram / TikTok có thể không. Mở bằng Safari (iPhone) hoặc Chrome mới để có .mp4.");
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      setPhase("error");
      setMsg((e as Error)?.message === "unsupported" ? "Trình duyệt này chưa tạo được video. Bạn mở album bằng Safari (iPhone) hoặc Chrome rồi thử lại." : "Chưa tạo được video — bạn kiểm tra mạng, giữ màn hình mở rồi thử lại.");
    } finally {
      void audioCtx?.close().catch(() => {});
    }
  }

  async function share() {
    if (!out) return;
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (typeof nav.share === "function" && nav.canShare?.({ files: [out.file] })) {
      try {
        await nav.share({ files: [out.file], title: baseName });
        return;
      } catch (e) {
        if ((e as Error)?.name === "AbortError") return;
      }
    }
    triggerDownload(out.file, out.file.name);
  }

  const busy = phase === "prep" || phase === "rec";
  return (
    <Sheet
      title="Tạo video Reels · TikTok · Story"
      tall
      onClose={() => {
        abort.current?.abort();
        onClose();
      }}
      footer={
        <>
          <button
            type="button"
            onClick={() => {
              abort.current?.abort();
              onClose();
            }}
            className={btn("ghost", "lg")}
          >
            Đóng
          </button>
          {out && phase === "done" ? (
            <button type="button" onClick={share} className={btn("primary", "lg", "flex-1")}>
              <Share2 size={17} /> Lưu / Chia sẻ video
            </button>
          ) : (
            <button type="button" onClick={() => void make()} disabled={busy || !sup.ok || (music === "file" && !file)} className={btn("primary", "lg", "flex-1")}>
              {busy ? <LoaderCircle size={17} className="animate-spin" /> : <Clapperboard size={17} />}
              {phase === "prep" ? "Đang chuẩn bị…" : phase === "rec" ? `Đang quay ${Math.round(progress * 100)}%` : "Tạo video"}
            </button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-3 px-4 pb-3">
        {!sup.ok ? (
          <p className="text-[13px] font-medium" style={{ color: "var(--rd)" }}>
            Trình duyệt này chưa tạo được video. Bạn mở album bằng Safari (iPhone) hoặc Chrome rồi thử lại.
          </p>
        ) : null}
        <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>
          Video dọc 1080×1920 từ {scenes} layout (khoảng {approx} giây): ảnh phóng nhẹ, chuyển cảnh mờ dần; carousel liền mạch thì máy lia ngang suốt dải. Video dựng ngay trên máy bạn — giữ màn hình mở khi đang quay.
        </p>
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: "var(--tx3)" }}>
            <Music size={14} /> Nhạc nền
          </p>
          <div className="flex flex-wrap gap-2">
            {MUSIC.map((m) => (
              <button
                key={m.v}
                type="button"
                aria-pressed={music === m.v}
                disabled={busy}
                onClick={() => {
                  if (m.v === music) return;
                  setMusic(m.v);
                  reset();
                }}
                className="h-10 rounded-full px-3.5 text-[13.5px] font-semibold"
                style={music === m.v ? { background: "var(--acS)", color: "var(--ac)", border: "1.5px solid var(--ac)" } : { background: "var(--sf2)", color: "var(--tx2)", border: "1px solid var(--bd)" }}
              >
                {m.label}
              </button>
            ))}
          </div>
          {music === "file" ? (
            <label className="mt-2 flex items-center gap-2 text-[13px]" style={{ color: "var(--tx2)" }}>
              <input
                type="file"
                accept="audio/*"
                disabled={busy}
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  reset();
                }}
                className="max-w-full text-[13px]"
              />
            </label>
          ) : (
            <p className="mt-1.5 text-[11.5px]" style={{ color: "var(--tx3)" }}>
              {music === "none" ? "Video không có tiếng — thêm nhạc sau trong Instagram / TikTok." : "Nhạc do máy tự soạn, không vướng bản quyền khi đăng."}
            </p>
          )}
        </div>
        <div>
          <p className="mb-1.5 text-[12px] font-semibold" style={{ color: "var(--tx3)" }}>
            Mỗi layout hiện
          </p>
          <div className="flex gap-2">
            {[2, 3, 4].map((sec) => (
              <button
                key={sec}
                type="button"
                aria-pressed={secPer === sec}
                disabled={busy}
                onClick={() => {
                  if (sec === secPer) return;
                  setSecPer(sec);
                  reset();
                }}
                className="h-10 rounded-full px-4 text-[13.5px] font-semibold"
                style={secPer === sec ? { background: "var(--ac)", color: "#fff" } : { background: "var(--sf2)", color: "var(--tx2)", border: "1px solid var(--bd)" }}
              >
                {sec} giây
              </button>
            ))}
          </div>
        </div>
        {busy ? (
          <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--sf2)" }}>
            <div className="h-full rounded-full transition-[width]" style={{ width: `${Math.round((phase === "prep" ? 0.04 : progress) * 100)}%`, background: "var(--ac)" }} />
          </div>
        ) : null}
        {out && phase === "done" ? (
          <video src={out.url} controls playsInline className="mx-auto max-h-[46dvh] rounded-[12px]" style={{ background: "#000" }} />
        ) : null}
        {out && phase === "done" ? (
          <button type="button" onClick={() => triggerDownload(out.file, out.file.name)} className={btn("ghost", "sm", "self-start")}>
            <Download size={15} /> Tải file video
          </button>
        ) : null}
        {msg ? (
          <p className="text-[12.5px] font-medium" style={{ color: phase === "error" ? "var(--rd)" : "var(--am)" }}>
            {msg}
          </p>
        ) : null}
      </div>
    </Sheet>
  );
}
