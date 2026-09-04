"use client";

/**
 * LỌC ẢNH THEO KHUÔN MẶT — phần chỉ trình duyệt làm được.
 *
 * Đây là nửa còn lại của @/lib/face-ai: file kia là luật thuần (kiểm thử bằng
 * node), file này lo việc nạp mô hình và chạy nó trên từng tấm ảnh.
 *
 * VẪN KHÔNG BYTE ẢNH NÀO RỜI KHỎI MÁY. Mô hình chạy bằng WebAssembly ngay trong
 * trình duyệt studio, giống hệt bộ đo nét ở @/lib/photo-ai-scan. Thứ duy nhất
 * đi qua mạng là chính MÔ HÌNH — tải một lần rồi nằm trong cache.
 *
 * BA QUYẾT ĐỊNH VỀ HẠ TẦNG, cả ba đều có lý do cụ thể:
 *
 *  1. WASM TỰ PHỤC VỤ TỪ `/mediapipe`, không lấy từ jsdelivr như hướng dẫn của
 *     MediaPipe. CSP của repo chỉ cho `script-src 'self'` cộng vài host Google
 *     (next.config.mjs) — nạp từ CDN khác sẽ bị chặn ÂM THẦM: bộ nhận diện đơn
 *     giản không bao giờ khởi động. File được chép ra lúc `postinstall`, xem
 *     scripts/chep-mediapipe.mjs.
 *  2. MÔ HÌNH tải từ storage.googleapis.com — khớp `connect-src
 *     https://*.googleapis.com` của CSP siết chặt, và đỡ 3,7 MB cho mỗi lần
 *     triển khai. Đây cũng là nơi Google phát hành nó.
 *  3. CHẠY TUẦN TỰ, không song song như bộ đo nét. Một `FaceLandmarker` là một
 *     phiên WASM có trạng thái; gọi `detect()` chồng nhau cho ra kết quả lẫn lộn
 *     giữa các ảnh. Vì thế lượt quét khuôn mặt chậm hơn hẳn lượt quét nét, và
 *     màn hình phải nói trước điều đó thay vì để studio ngồi đoán.
 *
 * ĐO NÉT RIÊNG TRÊN VÙNG MẶT: dùng lại đúng `laplacianVariance` của bộ đo cũ,
 * chỉ khác là chạy trên ô cắt khuôn mặt (`subGray`). Nhờ vậy hai con số "nét
 * mặt" và "nét khung" cùng một thang và đặt cạnh nhau so được.
 */

import { laplacianVariance, subGray } from "./photo-ai";
import type { FaceInfo, FaceMetrics } from "./face-ai";
import type { ScanItem, ScanProgress } from "./photo-ai-scan";

/**
 * Cạnh dài khi giải mã để nhận diện. Lớn hơn `SAMPLE_EDGE` (480) của bộ đo nét
 * vì mô hình cần đủ điểm ảnh trên khuôn mặt: ở 480px, một người trong ảnh nhóm
 * chỉ còn ~30px và mắt nhắm hay mở là không phân biệt được.
 */
export const FACE_EDGE = 800;

/** Số mặt tối đa mỗi tấm. Ảnh cưới có ảnh cả họ; 10 là chỗ dừng hợp lý. */
const MAX_FACES = 10;

/**
 * Mô hình face landmarker của Google (bản float16, ~3,7 MB).
 *
 * Ghim số hiệu bản (`/1/`) chứ không lấy "latest": mô hình đổi thì ngưỡng nhắm
 * mắt ở @/lib/face-ai có thể lệch, và ta không muốn kết quả tự đổi dưới chân
 * studio giữa hai buổi lọc ảnh.
 */
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

/** Thư mục WASM tự phục vụ — xem scripts/chep-mediapipe.mjs. */
const WASM_BASE = "/mediapipe";

/* ─────────────────────────────────────────────────────────────────────────────
   Nạp mô hình
   ───────────────────────────────────────────────────────────────────────────── */

type Landmarker = {
  detect: (image: OffscreenCanvas | HTMLCanvasElement | ImageBitmap) => {
    faceLandmarks: { x: number; y: number }[][];
    faceBlendshapes?: { categories: { categoryName: string; score: number }[] }[];
  };
  close: () => void;
};

let loading: Promise<Landmarker> | null = null;

/** Trình duyệt này chạy được bộ nhận diện không? */
export function faceScanSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof WebAssembly === "object" &&
    typeof createImageBitmap === "function" &&
    typeof OffscreenCanvas === "function"
  );
}

/**
 * Nạp mô hình (một lần cho cả phiên).
 *
 * Thử GPU trước rồi lùi về CPU: máy studio thường có GPU và nhanh hơn nhiều lần,
 * nhưng máy ảo / máy cũ / trình duyệt tắt WebGL thì `delegate: "GPU"` NÉM LỖI
 * ngay lúc tạo — không có nhánh lùi thì cả tính năng chết trên đúng những máy
 * cần nó nhất.
 */
export function loadFaceModel(): Promise<Landmarker> {
  if (loading) return loading;
  loading = (async () => {
    const vision = await import("@mediapipe/tasks-vision");
    const fileset = await vision.FilesetResolver.forVisionTasks(WASM_BASE);
    const base = {
      baseOptions: { modelAssetPath: MODEL_URL },
      runningMode: "IMAGE" as const,
      numFaces: MAX_FACES,
      // Blendshape là thứ DUY NHẤT cho biết mắt nhắm hay mở. Không bật cờ này
      // thì có landmark mà không có `eyeBlinkLeft/Right`, và cả tính năng chỉ
      // còn đếm được số mặt.
      outputFaceBlendshapes: true,
    };
    try {
      return (await vision.FaceLandmarker.createFromOptions(fileset, {
        ...base,
        baseOptions: { ...base.baseOptions, delegate: "GPU" },
      })) as unknown as Landmarker;
    } catch (gpuErr) {
      try {
        return (await vision.FaceLandmarker.createFromOptions(fileset, {
          ...base,
          baseOptions: { ...base.baseOptions, delegate: "CPU" },
        })) as unknown as Landmarker;
      } catch (cpuErr) {
        // "Failed to fetch" là câu mà studio sẽ nhìn thấy nếu không dịch lại, và
        // nó không nói được gì. Nguyên nhân gần như luôn là một trong hai: mạng
        // công ty chặn Google, hoặc mất mạng giữa chừng. Nói ra để họ còn biết
        // phải nhờ ai — chứ không đi báo "công cụ lọc ảnh hỏng".
        const msg = String(cpuErr instanceof Error ? cpuErr.message : cpuErr);
        if (/fetch|network|load|failed to/i.test(msg)) {
          throw new Error(
            "Không tải được bộ nhận diện khuôn mặt. Máy cần vào được storage.googleapis.com — " +
              "mạng của studio có thể đang chặn. Bỏ tick “Xét cả khuôn mặt” là quét bình thường vẫn chạy."
          );
        }
        throw cpuErr instanceof Error ? cpuErr : new Error(String(gpuErr));
      }
    }
  })();
  // Nạp hỏng (mất mạng giữa chừng) thì phải cho thử lại, chứ không nhớ mãi một
  // lời hứa đã vỡ.
  loading.catch(() => {
    loading = null;
  });
  return loading;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Giải mã + nhận diện một tấm
   ───────────────────────────────────────────────────────────────────────────── */

async function decode(item: ScanItem): Promise<{
  canvas: OffscreenCanvas;
  gray: Uint8Array;
  width: number;
  height: number;
}> {
  const source: Blob = item.file ?? (await (await fetch(item.url!, { cache: "force-cache" })).blob());
  const probe = await createImageBitmap(source);
  const scale = FACE_EDGE / Math.max(probe.width, probe.height);
  const w = scale >= 1 ? probe.width : Math.max(8, Math.round(probe.width * scale));
  const h = scale >= 1 ? probe.height : Math.max(8, Math.round(probe.height * scale));
  let bmp: ImageBitmap;
  if (w === probe.width && h === probe.height) {
    bmp = probe;
  } else {
    probe.close();
    bmp = await createImageBitmap(source, { resizeWidth: w, resizeHeight: h, resizeQuality: "medium" });
  }
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    bmp.close();
    throw new Error("không mở được canvas");
  }
  ctx.drawImage(bmp, 0, 0);
  const { data } = ctx.getImageData(0, 0, w, h);
  bmp.close();
  const gray = new Uint8Array(w * h);
  for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
    gray[i] = (data[p] * 77 + data[p + 1] * 150 + data[p + 2] * 29) >> 8;
  }
  return { canvas, gray, width: w, height: h };
}

/** Khung bao quanh một chùm landmark, đã kẹp về 0…1. */
function boxOf(points: { x: number; y: number }[]) {
  let x0 = 1;
  let y0 = 1;
  let x1 = 0;
  let y1 = 0;
  for (const p of points) {
    if (p.x < x0) x0 = p.x;
    if (p.y < y0) y0 = p.y;
    if (p.x > x1) x1 = p.x;
    if (p.y > y1) y1 = p.y;
  }
  const cl = (v: number) => Math.min(Math.max(v, 0), 1);
  x0 = cl(x0);
  y0 = cl(y0);
  x1 = cl(x1);
  y1 = cl(y1);
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
}

const blinkOf = (cats: { categoryName: string; score: number }[] | undefined) => {
  if (!cats) return 0;
  let worst = 0;
  for (const c of cats) {
    // Lấy mắt khép NHIỀU HƠN trong hai mắt, không lấy trung bình — xem ghi chú ở
    // @/lib/face-ai (FaceInfo.blink).
    if (c.categoryName === "eyeBlinkLeft" || c.categoryName === "eyeBlinkRight") {
      if (c.score > worst) worst = c.score;
    }
  }
  return worst;
};

/** Nhận diện MỘT tấm, trả về đúng hình dữ liệu mà @/lib/face-ai cần. */
export async function detectOne(
  model: Landmarker,
  item: ScanItem,
  index: number
): Promise<FaceMetrics> {
  const { canvas, gray, width, height } = await decode(item);
  const res = model.detect(canvas);
  const frameSharpness = laplacianVariance(gray, width, height);

  const faces: FaceInfo[] = [];
  const lms = res.faceLandmarks ?? [];
  for (let i = 0; i < lms.length; i++) {
    const box = boxOf(lms[i]);
    const sub = subGray(gray, width, height, box.x, box.y, box.w, box.h);
    faces.push({
      box,
      blink: blinkOf(res.faceBlendshapes?.[i]?.categories),
      // Mặt quá nhỏ để cắt ra đo thì báo 0. Luật ở face-ai đã loại những mặt bé
      // như vậy khỏi mọi quyết định, nên con số này không đi tới đâu.
      sharpness: sub ? laplacianVariance(sub.gray, sub.width, sub.height) : 0,
    });
  }
  return { key: item.key, name: item.name, index, faces, frameSharpness };
}

/* ─────────────────────────────────────────────────────────────────────────────
   Quét cả lô
   ───────────────────────────────────────────────────────────────────────────── */

export type FaceScanOutcome = {
  metrics: FaceMetrics[];
  skipped: { name: string; reason: string }[];
  aborted: boolean;
};

/**
 * Quét khuôn mặt cho cả lô, TUẦN TỰ.
 *
 * Không song song như `scanPhotos`: một `FaceLandmarker` là một phiên WASM có
 * trạng thái, gọi `detect()` chồng nhau cho ra kết quả lẫn giữa các ảnh. Đây là
 * lý do lượt quét này chậm hơn hẳn, và màn hình phải nói trước.
 */
export async function scanFaces(
  items: ScanItem[],
  onProgress: (p: ScanProgress) => void,
  signal?: AbortSignal
): Promise<FaceScanOutcome> {
  const metrics: FaceMetrics[] = [];
  const skipped: { name: string; reason: string }[] = [];
  const total = items.length;
  const model = await loadFaceModel();

  for (let i = 0; i < items.length; i++) {
    if (signal?.aborted) return { metrics, skipped, aborted: true };
    const item = items[i];
    try {
      metrics.push(await detectOne(model, item, i));
    } catch (e) {
      skipped.push({ name: item.name, reason: e instanceof Error ? e.message : "không đọc được" });
    }
    onProgress({ done: i + 1, total, failed: skipped.length, current: item.name });
    // Nhường luồng vẽ: nhận diện nặng hơn giải mã nhiều, không nhường thì thanh
    // tiến độ đứng im và cả tab treo cho tới lúc xong.
    if (i % 3 === 2) await new Promise((r) => setTimeout(r, 0));
  }
  return { metrics, skipped, aborted: !!signal?.aborted };
}
