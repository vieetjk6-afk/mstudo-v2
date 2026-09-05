"use client";

/**
 * LỌC ẢNH BẰNG AI — phần GIẢI MÃ ẢNH, chạy trong trình duyệt của studio.
 *
 * Đây là nửa còn lại của @/lib/photo-ai: file kia là số học thuần (kiểm thử được
 * bằng node), file này là phần chỉ trình duyệt làm được — mở file ảnh ra thành
 * điểm ảnh.
 *
 * KHÔNG BYTE ẢNH NÀO RỜI KHỎI MÁY. Ảnh cưới là dữ liệu riêng của khách, và một
 * buổi chụp 3.000 file thì upload là chuyện không xảy ra. `createImageBitmap` +
 * `OffscreenCanvas` giải mã và thu nhỏ ngay tại máy studio.
 *
 * Ba điều quan trọng về hiệu năng, vì lô quét là hàng nghìn ảnh:
 *
 *  1. Thu nhỏ NGAY TRONG BƯỚC GIẢI MÃ (`resizeWidth/resizeHeight` của
 *     `createImageBitmap`). Giải mã full-size một ảnh 45 MP rồi mới thu là ~180 MB
 *     RAM cho MỘT tấm — làm vậy 3.000 lần thì tab sập. Thu trong lúc giải mã thì
 *     bộ nhớ đỉnh chỉ là kích thước đã thu.
 *  2. Chạy song song có giới hạn (`CONCURRENCY`). Giải mã là việc của luồng khác
 *     nên song song có lợi, nhưng thả hết 3.000 lượt cùng lúc thì lại nổ bộ nhớ.
 *  3. Nhường luồng vẽ định kỳ, và huỷ được giữa đường — studio phải đóng được
 *     lượt quét mà không cần tải lại trang.
 */

import { SAMPLE_EDGE, cropRect, measure, type PhotoMetrics } from "./photo-ai";

/** Số ảnh giải mã cùng lúc. 4 là mức an toàn cho cả máy yếu. */
const CONCURRENCY = 4;

/** Một ảnh cần quét: hoặc file trên máy, hoặc một URL cùng origin. */
export type ScanItem = {
  key: string;
  name: string;
  /** File trên máy (File System Access API / <input type=file>). */
  file?: Blob;
  /** URL ảnh — chỉ dùng khi không có file trên máy (ví dụ thumbnail Drive). */
  url?: string;
};

export type ScanProgress = { done: number; total: number; failed: number; current: string };

export type ScanOutcome = {
  metrics: PhotoMetrics[];
  /** Ảnh không giải mã được, kèm lý do — studio phải biết chứ không được im lặng. */
  skipped: { name: string; reason: string }[];
  /** Lượt quét bị studio bấm dừng. */
  aborted: boolean;
};

/** Trình duyệt này quét được không? Cần OffscreenCanvas + createImageBitmap. */
export function scanSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof createImageBitmap === "function" &&
    typeof OffscreenCanvas === "function"
  );
}

/**
 * Định dạng trình duyệt giải mã được. File RAW (.CR3, .NEF, .ARW…) thì KHÔNG —
 * không trình duyệt nào giải mã RAW, và đây là hạn chế phải nói thẳng với studio
 * thay vì lặng lẽ bỏ qua nửa thư mục. Studio shoot RAW+JPEG hoặc xuất JPEG trước
 * khi lọc thì quét được toàn bộ.
 */
export const DECODABLE_RE = /\.(jpe?g|png|webp|gif|bmp|avif)$/i;

export function isDecodable(name: string): boolean {
  return DECODABLE_RE.test(name);
}

/** Cạnh dài sau khi thu, giữ đúng tỉ lệ ảnh gốc. */
function fitEdge(w: number, h: number): { w: number; h: number } {
  if (w <= 0 || h <= 0) return { w: SAMPLE_EDGE, h: SAMPLE_EDGE };
  const scale = SAMPLE_EDGE / Math.max(w, h);
  // Không phóng to ảnh nhỏ hơn SAMPLE_EDGE: phóng to không thêm cạnh nào mà chỉ
  // làm điểm nét đo được lệch khỏi thang điểm của cả lô.
  if (scale >= 1) return { w, h };
  return { w: Math.max(3, Math.round(w * scale)), h: Math.max(3, Math.round(h * scale)) };
}

/** Đọc một ảnh thành mảng mức xám đã thu nhỏ. */
async function sampleOne(item: ScanItem): Promise<{ gray: Uint8Array; width: number; height: number }> {
  const source: Blob = item.file ?? (await fetchBlob(item.url!));

  // Hai lượt: lượt đầu chỉ để biết kích thước gốc (bitmap "thăm dò" ở kích thước
  // nhỏ nhất có thể), lượt hai giải mã đúng kích thước cần. Trình duyệt vẫn phải
  // phân tích header ở lượt đầu nhưng không dựng ảnh full-size.
  const probe = await createImageBitmap(source);
  const { w, h } = fitEdge(probe.width, probe.height);
  let bmp: ImageBitmap;
  if (w === probe.width && h === probe.height) {
    bmp = probe;
  } else {
    probe.close();
    bmp = await createImageBitmap(source, { resizeWidth: w, resizeHeight: h, resizeQuality: "medium" });
  }

  const canvas = new OffscreenCanvas(bmp.width, bmp.height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    bmp.close();
    throw new Error("không mở được canvas");
  }
  ctx.drawImage(bmp, 0, 0);
  const { data } = ctx.getImageData(0, 0, bmp.width, bmp.height);
  const width = bmp.width;
  const height = bmp.height;
  bmp.close();

  // Luminance theo Rec. 601 — mắt nhạy với xanh lục hơn hẳn, nên trung bình cộng
  // ba kênh sẽ chấm sai độ sáng của ảnh nhiều màu.
  const gray = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
    gray[i] = (data[p] * 77 + data[p + 1] * 150 + data[p + 2] * 29) >> 8;
  }
  return { gray, width, height };
}

async function fetchBlob(url: string): Promise<Blob> {
  const res = await fetch(url, { cache: "force-cache" });
  if (!res.ok) throw new Error(`tải ảnh lỗi (${res.status})`);
  return res.blob();
}

/**
 * Quét cả lô. `onProgress` được gọi liên tục để studio thấy tiến độ; `signal`
 * cho phép bấm dừng.
 *
 * Thứ tự trong `items` chính là `index` dùng để gom chuỗi bấm liên tiếp (xem
 * `groupDuplicates`), nên NGƯỜI GỌI phải đưa vào theo đúng thứ tự thư mục.
 */
export async function scanPhotos(
  items: ScanItem[],
  onProgress: (p: ScanProgress) => void,
  signal?: AbortSignal
): Promise<ScanOutcome> {
  const metrics: PhotoMetrics[] = [];
  const skipped: { name: string; reason: string }[] = [];
  const total = items.length;
  let done = 0;
  let cursor = 0;

  const worker = async () => {
    for (;;) {
      if (signal?.aborted) return;
      const i = cursor++;
      if (i >= items.length) return;
      const item = items[i];
      if (!isDecodable(item.name)) {
        skipped.push({ name: item.name, reason: "định dạng trình duyệt không đọc được (RAW?)" });
        done++;
        onProgress({ done, total, failed: skipped.length, current: item.name });
        continue;
      }
      try {
        const s = await sampleOne(item);
        metrics.push(measure({ key: item.key, name: item.name, index: i, ...s }));
      } catch (e) {
        skipped.push({ name: item.name, reason: e instanceof Error ? e.message : "không đọc được" });
      }
      done++;
      onProgress({ done, total, failed: skipped.length, current: item.name });
      // Nhường luồng vẽ mỗi 8 ảnh: không có dòng này thì thanh tiến độ đứng im
      // và cả tab treo cho tới khi quét xong.
      if (done % 8 === 0) await new Promise((r) => setTimeout(r, 0));
    }
  };

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, Math.max(1, items.length)) }, worker));
  // Sắp lại theo thứ tự thư mục: các luồng song song hoàn thành xen kẽ nhau.
  metrics.sort((a, b) => a.index - b.index);
  return { metrics, skipped, aborted: !!signal?.aborted };
}

/**
 * Ảnh xem trước (data URL) cho một SỐ ÍT ảnh — chỉ những tấm màn hình thật sự
 * vẽ ra: các nhóm trùng và các tấm bị đề nghị loại.
 *
 * Vì sao làm sau lúc quét chứ không làm luôn trong đó: giữ ảnh xem trước cho cả
 * 3.000 tấm là vài chục MB nằm trong bộ nhớ tab để rồi studio chỉ xem vài chục
 * tấm. Giải mã lại đúng những tấm cần thì vừa nhẹ vừa gọn — mà giải mã ở đây là
 * việc rẻ, ảnh đã nằm trên máy (hoặc trong cache của service worker).
 *
 * `size` là cạnh dài. 96px đủ để BIẾT hai tấm khác nhau, nhưng KHÔNG đủ để CHỌN
 * giữa chúng — mà chọn mới là việc studio ngồi đây để làm. Nên mặc định là 320px:
 * ô ảnh lớn nhất của bảng kết quả vẫn nét, mỗi tấm ~20 KB.
 *
 * Muốn soi kỹ hơn nữa thì có `makeOnePreview` (một tấm, cỡ lớn) và `makePixelCrop`
 * (cắt 1:1 điểm ảnh gốc) — hai hàm đó giải mã ĐÚNG LÚC MỞ, không giữ sẵn.
 */
export async function makePreviews(
  items: ScanItem[],
  keys: string[],
  size = 320
): Promise<Record<string, string>> {
  const want = new Set(keys);
  const out: Record<string, string> = {};
  const list = items.filter((i) => want.has(i.key));
  let cursor = 0;

  const worker = async () => {
    for (;;) {
      const i = cursor++;
      if (i >= list.length) return;
      const item = list[i];
      try {
        const source: Blob = item.file ?? (await fetchBlob(item.url!));
        const probe = await createImageBitmap(source);
        const scale = size / Math.max(probe.width, probe.height);
        const w = scale < 1 ? Math.max(1, Math.round(probe.width * scale)) : probe.width;
        const h = scale < 1 ? Math.max(1, Math.round(probe.height * scale)) : probe.height;
        probe.close();
        const bmp = await createImageBitmap(source, { resizeWidth: w, resizeHeight: h, resizeQuality: "medium" });
        const canvas = new OffscreenCanvas(w, h);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          bmp.close();
          continue;
        }
        ctx.drawImage(bmp, 0, 0);
        bmp.close();
        const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.6 });
        out[item.key] = await blobToDataUrl(blob);
      } catch {
        /* một ảnh xem trước lỗi thì bỏ ô đó, không được làm sập cả bảng kết quả */
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, Math.max(1, list.length)) }, worker));
  return out;
}

/**
 * Một tấm, cỡ LỚN, giải mã đúng lúc mở khung so sánh.
 *
 * Trả về object URL chứ không phải data URL: một tấm 1600px là ~250 KB, mà
 * base64 còn phình thêm một phần ba và nằm lại trong state React. NGƯỜI GỌI PHẢI
 * `URL.revokeObjectURL` khi đóng khung — không gọi là rò bộ nhớ cho tới lúc tải
 * lại trang.
 */
export async function makeOnePreview(
  item: ScanItem,
  size = 1600
): Promise<{ url: string; width: number; height: number }> {
  const source: Blob = item.file ?? (await fetchBlob(item.url!));
  const probe = await createImageBitmap(source);
  const { w, h } = fitTo(probe.width, probe.height, size);
  let bmp: ImageBitmap;
  if (w === probe.width && h === probe.height) {
    bmp = probe;
  } else {
    probe.close();
    bmp = await createImageBitmap(source, { resizeWidth: w, resizeHeight: h, resizeQuality: "high" });
  }
  const url = await drawToUrl(bmp, 0.82);
  return { url, width: w, height: h };
}

/**
 * Cắt một ô vuông ĐIỂM ẢNH GỐC (1:1) quanh một điểm trên ảnh.
 *
 * Đây là cách duy nhất thật sự trả lời "tấm nào nét hơn". Ảnh thu về 1600px thì
 * hai tấm trong một chuỗi bấm trông giống hệt nhau — độ nét chỉ hiện ra ở tỉ lệ
 * 100%, đúng như cách người ta soi ảnh trong Lightroom.
 *
 * `cx`/`cy` là tâm ô cắt theo tỉ lệ 0…1 của ảnh. `edge` là cạnh ô cắt tính bằng
 * điểm ảnh GỐC — không thu nhỏ, không phóng to. Ảnh nhỏ hơn ô cắt thì lấy trọn.
 * Trả về object URL, NGƯỜI GỌI phải thu hồi.
 */
export async function makePixelCrop(
  item: ScanItem,
  cx: number,
  cy: number,
  edge = 520
): Promise<{ url: string; width: number; height: number; native: boolean }> {
  const source: Blob = item.file ?? (await fetchBlob(item.url!));
  const probe = await createImageBitmap(source);
  const iw = probe.width;
  const ih = probe.height;
  probe.close();
  // Phép kẹp nằm ở @/lib/photo-ai (cropRect) — số học thuần, kiểm thử bằng node.
  const { sx, sy, w, h } = cropRect(iw, ih, cx, cy, edge);
  const bmp = await createImageBitmap(source, sx, sy, w, h);
  const url = await drawToUrl(bmp, 0.9);
  // `native` = ô cắt đúng là điểm ảnh gốc. Sai khi nguồn là ảnh xem trước Drive
  // (đã bị thu nhỏ từ trước), và màn hình phải nói ra điều đó.
  return { url, width: w, height: h, native: iw >= edge || ih >= edge };
}

/** Cạnh dài về `edge`, giữ tỉ lệ, KHÔNG phóng to ảnh vốn đã nhỏ hơn. */
function fitTo(w: number, h: number, edge: number): { w: number; h: number } {
  if (w <= 0 || h <= 0) return { w: edge, h: edge };
  const scale = edge / Math.max(w, h);
  if (scale >= 1) return { w, h };
  return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)) };
}

/** Vẽ bitmap ra JPEG và trả object URL. Đóng bitmap dù thành công hay không. */
async function drawToUrl(bmp: ImageBitmap, quality: number): Promise<string> {
  try {
    const canvas = new OffscreenCanvas(bmp.width, bmp.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("không mở được canvas");
    ctx.drawImage(bmp, 0, 0);
    const blob = await canvas.convertToBlob({ type: "image/jpeg", quality });
    return URL.createObjectURL(blob);
  } finally {
    bmp.close();
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error("đọc ảnh xem trước lỗi"));
    fr.readAsDataURL(blob);
  });
}
