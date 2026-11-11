/* ═══════════════════════════════════════════════════════════════════════════
   VIDEO REELS / TIKTOK / STORY từ bộ ảnh ghép — dựng NGAY TRÊN ĐIỆN THOẠI,
   không gửi ảnh đi đâu.

   • Khung dọc 1080×1920: mỗi layout đặt giữa trên nền chính nó làm mờ, phóng
     nhẹ dần (Ken Burns), chuyển cảnh mờ dần sang layout sau; carousel liền mạch
     thì máy LIA NGANG suốt dải ảnh.
   • Nhạc nền: máy TỰ SOẠN (Web Audio: hợp âm, rải nốt, bass) nên không vướng
     bản quyền; hoặc khách chọn file nhạc trên máy mình (chỉ dùng tại máy).
   • Ghi bằng MediaRecorder từ canvas (thời gian thực: video 20 giây ghi mất 20
     giây — màn hình phải mở). Ưu tiên MP4 (Instagram / TikTok nhận); trình
     duyệt chỉ có WebM thì vẫn xuất WebM (Facebook nhận).
   Chỉ chạy trong trình duyệt.
   ═══════════════════════════════════════════════════════════════════════════ */
import { blurRGBA } from "./blur";

export const REEL_W = 1080;
export const REEL_H = 1920;

/** Một cảnh của video: ảnh một layout, hoặc cả dải carousel (lia ngang). */
export interface ReelItem {
  canvas: HTMLCanvasElement;
  pan: boolean;
  /** Carousel: số slide của dải (để mỗi slide vừa bề ngang video khi lia). */
  slides?: number;
}

export type MusicKind = "soft" | "happy" | "none" | "file";

/** Trình duyệt có ghi được video từ canvas không, và ra định dạng gì. */
export function reelSupport(): { ok: boolean; mime: string | null; ext: "mp4" | "webm" | null } {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined" || typeof HTMLCanvasElement === "undefined" || !("captureStream" in HTMLCanvasElement.prototype)) {
    return { ok: false, mime: null, ext: null };
  }
  const cands = ['video/mp4;codecs="avc1.42E01E,mp4a.40.2"', "video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  const mime = cands.find((m) => {
    try {
      return MediaRecorder.isTypeSupported(m);
    } catch {
      return false;
    }
  });
  if (!mime) return { ok: false, mime: null, ext: null };
  return { ok: true, mime, ext: mime.startsWith("video/mp4") ? "mp4" : "webm" };
}

/* ── Nhạc nền tự soạn (không bản quyền) ──────────────────────────────────── */

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
// Vòng hợp âm C – G – Am – F (ấm, dễ nghe, hợp đám cưới).
const CHORDS = [
  [60, 64, 67],
  [59, 62, 67],
  [57, 60, 64],
  [57, 60, 65],
];
const ROOTS = [48, 43, 45, 41];

/** Một nốt kiểu đàn: tắt dần, hai lớp sóng (gốc + bội) cho tròn tiếng. */
function note(ctx: BaseAudioContext, out: AudioNode, f: number, t: number, len: number, vol: number, type: OscillatorType = "triangle") {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0008, t + len);
  g.connect(out);
  for (const [mul, v, wave] of [
    [1, 1, type],
    [2, 0.28, "sine"],
  ] as [number, number, OscillatorType][]) {
    const o = ctx.createOscillator();
    o.type = wave;
    o.frequency.value = f * mul;
    const gg = ctx.createGain();
    gg.gain.value = v;
    o.connect(gg).connect(g);
    o.start(t);
    o.stop(t + len + 0.05);
  }
}

/** Soạn nhạc nền dài `seconds` giây: "soft" (rải đàn chậm) hoặc "happy" (vui, có nhịp). */
export async function makeMusic(kind: "soft" | "happy", seconds: number): Promise<AudioBuffer> {
  const rate = 44100;
  const ctx = new OfflineAudioContext(2, Math.ceil(rate * (seconds + 0.5)), rate);
  const master = ctx.createGain();
  master.gain.setValueAtTime(0, 0);
  master.gain.linearRampToValueAtTime(0.55, 0.6);
  master.gain.setValueAtTime(0.55, Math.max(0.7, seconds - 1.6));
  master.gain.linearRampToValueAtTime(0, seconds);
  const comp = ctx.createDynamicsCompressor();
  master.connect(comp).connect(ctx.destination);
  // Vang nhẹ: trễ có hồi tiếp.
  const delay = ctx.createDelay(1);
  delay.delayTime.value = kind === "soft" ? 0.34 : 0.22;
  const fb = ctx.createGain();
  fb.gain.value = kind === "soft" ? 0.3 : 0.18;
  const wet = ctx.createGain();
  wet.gain.value = 0.35;
  delay.connect(fb).connect(delay);
  delay.connect(wet).connect(master);
  const bus = ctx.createGain();
  bus.connect(master);
  bus.connect(delay);

  const bpm = kind === "soft" ? 72 : 104;
  const beat = 60 / bpm;
  const bar = beat * 4;
  for (let t = 0, i = 0; t < seconds; t += bar, i++) {
    const ch = CHORDS[i % 4];
    const root = ROOTS[i % 4];
    // Bass.
    note(ctx, bus, hz(root), t, bar * 0.95, kind === "soft" ? 0.16 : 0.2, "sine");
    if (kind === "happy") note(ctx, bus, hz(root), t + beat * 2, beat * 1.8, 0.16, "sine");
    // Nền hợp âm êm (soft) / chạm hợp âm theo nhịp (happy).
    if (kind === "soft") {
      for (const n of ch) note(ctx, bus, hz(n), t, bar * 1.05, 0.035, "sine");
    } else {
      for (let b = 0; b < 4; b++) for (const n of ch) note(ctx, bus, hz(n + 12), t + b * beat + beat / 2, beat * 0.4, 0.028, "square");
    }
    // Rải nốt: 8 nốt móc đơn mỗi ô nhịp.
    const arp = [ch[0], ch[1], ch[2], ch[0] + 12, ch[2], ch[1], ch[2], ch[0] + 12];
    arp.forEach((n, k) => {
      const at = t + k * (beat / 2);
      if (at < seconds) note(ctx, bus, hz(n + (kind === "soft" ? 12 : 12)), at, kind === "soft" ? 1.4 : 0.5, kind === "soft" ? 0.07 : 0.06);
    });
  }
  return ctx.startRendering();
}

/** File nhạc khách chọn trên máy (mp3, m4a…) → AudioBuffer. */
export async function decodeMusicFile(file: File, ctx: BaseAudioContext): Promise<AudioBuffer> {
  const buf = await file.arrayBuffer();
  return await ctx.decodeAudioData(buf);
}

/* ── Dựng khung hình ─────────────────────────────────────────────────────── */

function makeCanvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/** Nền mờ tối nhẹ cho một cảnh (tính sẵn một lần, ở ảnh nhỏ cho nhanh). */
function backdrop(src: HTMLCanvasElement): HTMLCanvasElement {
  const sw = 90;
  const sh = 160;
  const small = makeCanvas(sw, sh);
  const sx = small.getContext("2d", { willReadFrequently: true })!;
  const scale = Math.max(sw / src.width, sh / src.height);
  sx.drawImage(src, (sw - src.width * scale) / 2, (sh - src.height * scale) / 2, src.width * scale, src.height * scale);
  try {
    const d = sx.getImageData(0, 0, sw, sh);
    blurRGBA(d.data, sw, sh, 6);
    sx.putImageData(d, 0, 0);
  } catch {
    /* bị khoá — dùng ảnh nhỏ chưa mờ */
  }
  const out = makeCanvas(REEL_W, REEL_H);
  const ox = out.getContext("2d")!;
  ox.imageSmoothingQuality = "high";
  ox.drawImage(small, -REEL_W * 0.05, -REEL_H * 0.05, REEL_W * 1.1, REEL_H * 1.1);
  ox.fillStyle = "rgba(0,0,0,.28)";
  ox.fillRect(0, 0, REEL_W, REEL_H);
  return out;
}

const ease = (u: number) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);

export interface ReelOptions {
  /** Giây cho mỗi layout. */
  secPer: number;
  audio: AudioBuffer | null;
  /** AudioContext đã mở trong lượt chạm của khách (iPhone bắt buộc). */
  audioCtx: AudioContext | null;
  onProgress: (p: number) => void;
  signal?: AbortSignal;
}

/** Tổng thời lượng video cho các cảnh. */
export function reelDuration(items: readonly ReelItem[], secPer: number): number {
  return items.reduce((s, it) => s + (it.pan ? Math.max(secPer * 1.6, (it.canvas.width / it.canvas.height) * secPer * 0.6) : secPer), 0);
}

/** Ghi video. Trả Blob + định dạng. */
export async function recordReel(items: ReelItem[], o: ReelOptions): Promise<{ blob: Blob; mime: string; ext: "mp4" | "webm"; seconds: number }> {
  const sup = reelSupport();
  if (!sup.ok || !sup.mime || !sup.ext) throw new Error("unsupported");
  if (!items.length) throw new Error("empty");
  const canvas = makeCanvas(REEL_W, REEL_H);
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  const backs = items.map((it) => backdrop(it.canvas));
  const durs = items.map((it) => (it.pan ? Math.max(o.secPer * 1.6, (it.canvas.width / it.canvas.height) * o.secPer * 0.6) : o.secPer));
  const starts: number[] = [];
  durs.reduce((acc, d) => (starts.push(acc), acc + d), 0);
  const total = durs.reduce((a, b) => a + b, 0);
  const X = Math.min(0.5, o.secPer * 0.25);

  const drawItem = (i: number, u: number, alpha: number) => {
    const it = items[i];
    ctx.globalAlpha = alpha;
    ctx.drawImage(backs[i], 0, 0);
    const c = it.canvas;
    if (it.pan) {
      // Lia ngang suốt dải carousel: mỗi slide vừa bề ngang video (không quá 85% chiều cao).
      const slideW = c.width / Math.max(1, it.slides ?? 1);
      const h = Math.min(REEL_H * 0.85, (REEL_W * c.height) / slideW);
      const scale = h / c.height;
      const w = c.width * scale;
      const x = -(w - REEL_W) * ease(u);
      ctx.drawImage(c, x, (REEL_H - h) / 2, w, h);
    } else {
      // Ảnh layout vừa bề ngang, phóng nhẹ dần.
      const fit = Math.min(REEL_W / c.width, REEL_H / c.height);
      const s = fit * (1 + 0.05 * u);
      const w = c.width * s;
      const h = c.height * s;
      ctx.drawImage(c, (REEL_W - w) / 2, (REEL_H - h) / 2, w, h);
    }
    ctx.globalAlpha = 1;
  };
  const draw = (t: number) => {
    let i = starts.findIndex((s, k) => t >= s && t < s + durs[k]);
    if (i < 0) i = items.length - 1;
    const u = Math.min(1, (t - starts[i]) / durs[i]);
    drawItem(i, u, 1);
    const end = starts[i] + durs[i];
    if (i < items.length - 1 && t > end - X) drawItem(i + 1, 0, (t - (end - X)) / X);
  };

  draw(0);
  const stream = (canvas as HTMLCanvasElement & { captureStream: (fps?: number) => MediaStream }).captureStream(30);
  let src: AudioBufferSourceNode | null = null;
  if (o.audio && o.audioCtx) {
    const ac = o.audioCtx;
    if (ac.state === "suspended") await ac.resume().catch(() => {});
    src = ac.createBufferSource();
    src.buffer = o.audio;
    const g = ac.createGain();
    g.gain.setValueAtTime(1, ac.currentTime);
    g.gain.setValueAtTime(1, ac.currentTime + Math.max(0.1, total - 1.5));
    g.gain.linearRampToValueAtTime(0, ac.currentTime + total);
    const dest = ac.createMediaStreamDestination();
    src.connect(g).connect(dest);
    for (const tr of dest.stream.getAudioTracks()) stream.addTrack(tr);
  }
  const rec = new MediaRecorder(stream, { mimeType: sup.mime, videoBitsPerSecond: 8_000_000, audioBitsPerSecond: 128_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => {
    if (e.data && e.data.size) chunks.push(e.data);
  };
  const done = new Promise<void>((resolve) => {
    rec.onstop = () => resolve();
  });
  rec.start(500);
  src?.start();
  const t0 = performance.now();
  await new Promise<void>((resolve, reject) => {
    const tick = () => {
      if (o.signal?.aborted) {
        reject(new DOMException("aborted", "AbortError"));
        return;
      }
      const t = (performance.now() - t0) / 1000;
      draw(Math.min(t, total));
      o.onProgress(Math.min(1, t / total));
      if (t >= total) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }).finally(() => {
    try {
      src?.stop();
    } catch {
      /* đã dừng */
    }
  });
  await new Promise((r) => setTimeout(r, 150));
  if (rec.state !== "inactive") rec.stop();
  await done;
  stream.getTracks().forEach((tr) => tr.stop());
  const blob = new Blob(chunks, { type: sup.mime.split(";")[0] });
  if (!blob.size) throw new Error("empty_video");
  return { blob, mime: sup.mime, ext: sup.ext, seconds: total };
}
