"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { directBytesUrl, rawImageUrl } from "./drive";
import { quetRgba, SCAN_WIDTH, type ScannedFace } from "./face-scan-core";

/**
 * NHẬN DIỆN KHUÔN MẶT TRONG TRÌNH DUYỆT — cùng ba mạng với máy chủ.
 *
 * VÌ SAO CÓ FILE NÀY. Quét album trên Vercel là khoản CPU lớn nhất của cả hệ
 * thống (~0,75 giây một tấm), nên việc nặng dời sang MÁY STUDIO: tab đang mở
 * trang album tự tải thumbnail, nhận diện, rồi gửi kết quả lên. Khách tìm bằng
 * ảnh của mình cũng nhận diện ngay trên máy họ và chỉ gửi 128 con số.
 *
 * VÌ SAO LẦN NÀY VECTOR SO ĐƯỢC. Bản trình duyệt ngày trước căn mặt bằng
 * MediaPipe nên vector lệch với máy chủ (xem @/lib/face-node). Bản này dùng
 * ĐÚNG face-api, đúng ba mạng, đúng trọng số, và chạy qua cùng một hàm
 * `quetRgba` (@/lib/face-scan-core) — ảnh album còn giải mã bằng chính jpeg-js
 * như máy chủ. Lệch còn lại chỉ là sai số dấu phẩy động giữa WebGL và WASM, đo
 * ở desktop/test/face-embed-browser.mjs.
 *
 * NẠP LƯỜI: face-api (kèm TensorFlow, ~1,3 MB) và jpeg-js đều `import()` động,
 * nên chúng là chunk riêng, chỉ tải khi studio bấm quét / khách bấm tìm.
 * Trọng số tự phục vụ ở /face-model (scripts/chep-mediapipe.mjs) — CSP của repo
 * chỉ cho script cùng nguồn, và không phụ thuộc CDN nào.
 */

const MODEL_BASE = "/face-model";

/**
 * Dung lượng tải lần đầu, đo trên file thật: trọng số 12,4 MB (SSD 5,6 + landmark
 * 0,4 + nhận dạng 6,4) + thư viện ~1,3 MB. Câu chữ phía khách in đúng số này.
 *
 * Bộ dò NHỎ (tiny, nhẹ hơn 5,4 MB) đã đo và KHÔNG dùng cho ảnh khách: trên 6 ảnh
 * mẫu nó sót mặt và chọn nhầm "mặt to nhất" ở 2 ảnh (lệch 0,63 và 0,82 so với
 * ngưỡng 0,6) — xem desktop/test/face-embed-browser.mjs.
 */
export const TAI_LAN_DAU_MB = 13;

export type BoDo = "ssd" | "tiny";
export type TienDoNap = { buoc: "thu-vien" | "mo-hinh" | "xong"; phanTram: number };

type Engine = { faceapi: any; tf: any; backend: string; daNap: Set<BoDo> };

let engine: Promise<Engine> | null = null;
const dangNap = new Map<BoDo, Promise<void>>();

/** Trình duyệt này có chạy nổi không (WebGL hoặc WebAssembly). */
export function faceEmbedSupported(): boolean {
  if (typeof window === "undefined" || typeof fetch !== "function") return false;
  if (typeof WebAssembly === "object") return true;
  try {
    return !!document.createElement("canvas").getContext("webgl2");
  } catch {
    return false;
  }
}

/**
 * Nạp thư viện + chọn nền tính toán, MỘT LẦN cho mỗi tab.
 *
 * WebGL trước (máy studio thường có GPU, nhanh gấp nhiều lần), rồi WASM, rồi
 * CPU thuần: máy ảo / trình duyệt tắt WebGL vẫn phải chạy được, chỉ chậm hơn.
 */
function loadEngine(): Promise<Engine> {
  if (engine) return engine;
  engine = (async () => {
    const mod: any = await import("@vladmandic/face-api/dist/face-api.esm.js");
    const faceapi = mod.nets ? mod : mod.default;
    const tf = faceapi?.tf;
    if (!faceapi?.nets || !tf) throw new Error("face_api_khong_nap_duoc");
    let backend = "";
    for (const b of ["webgl", "wasm", "cpu"]) {
      try {
        // Dấu "/" cuối là BẮT BUỘC, thiếu thì tfjs coi đây là tên file.
        if (b === "wasm") tf.setWasmPaths?.(`${MODEL_BASE}/`);
        if (await tf.setBackend(b)) {
          await tf.ready();
          backend = b;
          break;
        }
      } catch {
        /* thử nền kế tiếp */
      }
    }
    if (!backend) throw new Error("khong_co_nen_tinh_toan");
    return { faceapi, tf, backend, daNap: new Set<BoDo>() };
  })();
  engine.catch(() => {
    engine = null;
  });
  return engine;
}

/** Nạp các mạng cần cho một bộ dò. Gọi lại nhiều lần vô hại. */
export async function napMoHinh(boDo: BoDo = "ssd", onProgress?: (p: TienDoNap) => void): Promise<{ backend: string }> {
  onProgress?.({ buoc: "thu-vien", phanTram: 5 });
  const e = await loadEngine();
  if (!e.daNap.has(boDo)) {
    let p = dangNap.get(boDo);
    if (!p) {
      p = (async () => {
        const nets = e.faceapi.nets;
        const ds = [boDo === "tiny" ? nets.tinyFaceDetector : nets.ssdMobilenetv1, nets.faceLandmark68Net, nets.faceRecognitionNet];
        let xong = 0;
        onProgress?.({ buoc: "mo-hinh", phanTram: 15 });
        await Promise.all(
          ds.map(async (n: any) => {
            if (!n.isLoaded) await n.loadFromUri(MODEL_BASE);
            xong++;
            onProgress?.({ buoc: "mo-hinh", phanTram: 15 + Math.round((xong / ds.length) * 80) });
          })
        );
        e.daNap.add(boDo);
      })();
      dangNap.set(boDo, p);
      // Hỏng (rớt mạng giữa chừng) thì lần bấm sau phải thử lại được.
      p.catch(() => dangNap.delete(boDo));
    }
    await p;
  }
  onProgress?.({ buoc: "xong", phanTram: 100 });
  return { backend: e.backend };
}

/**
 * Quét MỘT JPEG — bản trình duyệt của `scanJpeg` (@/lib/face-node).
 *
 * Giải mã bằng jpeg-js chứ KHÔNG bằng bộ giải mã của trình duyệt: hai bộ giải
 * mã cho điểm ảnh lệch nhau vài mức, và mục tiêu là dòng DB không phân biệt
 * được với dòng máy chủ ghi.
 */
export async function scanJpegBrowser(bytes: Uint8Array): Promise<ScannedFace[]> {
  await napMoHinh("ssd");
  const { faceapi, tf } = await loadEngine();
  const jpeg: any = await import("jpeg-js");
  const dec = (jpeg.default ?? jpeg).decode(bytes, { useTArray: true, maxMemoryUsageInMB: 512 });
  return quetRgba(faceapi, tf, dec.data as Uint8Array, dec.width as number, dec.height as number);
}

/** Kết quả tải một thumbnail — cùng bộ lý do với `fetchThumbChiTiet` của máy chủ. */
export type KetQuaTaiAnh = { bytes: Uint8Array; lyDo: null } | { bytes: null; lyDo: string };

/* ── Tải THẲNG từ Google trước, lùi về máy chủ của app ─────────────────────────
   Mỗi ảnh quét (~100 KB) trước đây đi qua /api/img?raw=1, tức là qua Vercel:
   album 6.000 ảnh ≈ 0,5–0,9 GB lưu lượng Vercel cho MỘT lần quét. Trình duyệt
   tải thẳng đúng địa chỉ lh3 mà máy chủ vẫn lấy → byte y hệt, Vercel tốn 0.
   Google không cho đọc chéo miền (CORS) với ảnh nào / lúc nào thì ảnh đó đi
   đường cũ; hỏng liên tiếp ngay từ đầu (Google chặn hẳn CORS) thì thôi thử
   đường thẳng cho cả phiên — khỏi phí một lượt gọi mỗi ảnh. */
const thongKe = { thang: 0, mayChu: 0, loiThang: 0 };
let thangTat = false;
/** Số ảnh đã tải theo từng đường trong phiên này (kiểm thử / chẩn đoán). */
export function thongKeTaiAnh() {
  return { ...thongKe, thangTat };
}

function docAnh(buf: Uint8Array, ct: string): KetQuaTaiAnh {
  if (!ct.startsWith("image/")) return { bytes: null, lyDo: `khong-phai-anh (${ct.split(";")[0] || "khong co content-type"})` };
  if (buf.length < 512) return { bytes: null, lyDo: `anh-giu-cho (${buf.length} byte)` };
  if (!(buf[0] === 0xff && buf[1] === 0xd8)) return { bytes: null, lyDo: "khong-phai-jpeg" };
  return { bytes: buf, lyDo: null };
}

async function taiCoHan(url: string, init: RequestInit, signal?: AbortSignal): Promise<Response> {
  const ctrl = new AbortController();
  const huy = () => ctrl.abort();
  signal?.addEventListener("abort", huy);
  const timer = setTimeout(huy, 20_000);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", huy);
  }
}

/** Thử tải thẳng từ Google. null = không dùng được (lùi về máy chủ cho ảnh này). */
async function taiThang(driveFileId: string, signal?: AbortSignal): Promise<Uint8Array | null> {
  const url = thangTat ? null : directBytesUrl(driveFileId, SCAN_WIDTH);
  if (!url) return null;
  try {
    // credentials: "omit" — ảnh công khai, và gửi cookie Google kèm request đọc
    // chéo miền thì Google phải trả CORS chặt hơn (dễ bị chặn hơn).
    const res = await taiCoHan(url, { mode: "cors", credentials: "omit" }, signal);
    if (!res.ok) return null; // 403 (chưa chia sẻ công khai) / 404… → máy chủ quyết
    const r = docAnh(new Uint8Array(await res.arrayBuffer()), res.headers.get("content-type") ?? "");
    if (!r.bytes) return null; // ảnh giữ chỗ / không phải JPEG → đường cũ thử nguồn khác
    thongKe.thang++;
    return r.bytes;
  } catch {
    if (signal?.aborted) return null;
    // TypeError ở đây gần như luôn là CORS bị chặn (hoặc mất mạng).
    thongKe.loiThang++;
    if (thongKe.thang === 0 && thongKe.loiThang >= 3) thangTat = true;
    return null;
  }
}

/**
 * Tải thumbnail một ảnh album để quét. THẲNG từ Google nếu được (không tốn
 * Vercel), không thì qua /api/img?raw=1 như cũ. Cùng bề rộng với bộ quét máy chủ.
 */
export async function taiAnhQuet(driveFileId: string, signal?: AbortSignal): Promise<KetQuaTaiAnh> {
  const thang = await taiThang(driveFileId, signal);
  if (thang) return { bytes: thang, lyDo: null };
  if (signal?.aborted) return { bytes: null, lyDo: "da-dung" };
  try {
    // `&quet=1`: service worker (public/sw.js) để request này đi thẳng mạng,
    // KHÔNG giữ vào bộ nhớ đệm ảnh — ảnh quét chỉ dùng một lần, giữ lại thì
    // quét vài nghìn tấm là đẩy hết ảnh studio / khách vừa xem ra khỏi đệm.
    const res = await taiCoHan(`${rawImageUrl(driveFileId, SCAN_WIDTH)}&quet=1`, { credentials: "same-origin" }, signal);
    if (!res.ok) return { bytes: null, lyDo: `http-${res.status}` };
    const r = docAnh(new Uint8Array(await res.arrayBuffer()), res.headers.get("content-type") ?? "");
    if (r.bytes) thongKe.mayChu++;
    return r;
  } catch (e) {
    if (signal?.aborted) return { bytes: null, lyDo: "da-dung" };
    return { bytes: null, lyDo: e instanceof Error && e.name === "AbortError" ? "het-gio (20s)" : `mang-loi: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/**
 * Ảnh KHÁCH tự chọn → vector của khuôn mặt TO NHẤT (cùng luật với máy chủ:
 * người chọn ảnh có mình thường là người gần ống kính nhất).
 *
 * Ảnh được trình duyệt giải mã (HEIC/PNG/WebP đều được, đã xoay theo EXIF) rồi
 * thu về SCAN_WIDTH — không byte nào rời khỏi máy.
 */
export async function vectorAnhKhach(
  file: Blob,
  opts: { boDo?: BoDo; onProgress?: (p: TienDoNap) => void } = {}
): Promise<{ descriptor: number[] | null; soMat: number }> {
  const boDo = opts.boDo ?? "ssd";
  const nap = napMoHinh(boDo, opts.onProgress);
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("khong_doc_duoc_anh"));
      el.src = url;
    });
    if (!img.naturalWidth) throw new Error("khong_doc_duoc_anh");
    const k = Math.min(1, SCAN_WIDTH / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * k));
    const h = Math.max(1, Math.round(img.naturalHeight * k));
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    const ctx = cv.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("khong_doc_duoc_anh");
    ctx.drawImage(img, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    await nap;
    const { faceapi, tf } = await loadEngine();
    const faces = await quetRgba(faceapi, tf, data, w, h, boDo);
    if (faces.length === 0) return { descriptor: null, soMat: 0 };
    const me = faces.reduce((a, b) => (b.box.w * b.box.h > a.box.w * a.box.h ? b : a));
    return { descriptor: me.descriptor, soMat: faces.length };
  } finally {
    URL.revokeObjectURL(url);
    // Nạp hỏng trong lúc ảnh cũng hỏng: đừng để lời hứa vỡ trôi thành lỗi vô chủ.
    nap.catch(() => {});
  }
}
