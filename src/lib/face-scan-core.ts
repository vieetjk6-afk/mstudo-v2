/* eslint-disable @typescript-eslint/no-explicit-any */

import { laplacianVariance, subGray } from "./photo-ai";

/**
 * NHẬN DIỆN KHUÔN MẶT — phần DÙNG CHUNG cho máy chủ (@/lib/face-node) và trình
 * duyệt (@/lib/face-embed-browser).
 *
 * Vì sao phải là MỘT file: việc quét đã rời máy chủ sang máy studio (CPU Vercel
 * là khoản tốn nhất), nhưng dòng album_faces do hai nơi ghi phải KHÔNG PHÂN BIỆT
 * ĐƯỢC — cùng ngưỡng dò, cùng trần số mặt, cùng thứ tự `at`, cùng cách chuẩn hoá
 * khung, cùng phép đo nét. Chép hai bản là hai bản sẽ lệch nhau, và lệch ở đây
 * nghĩa là cùng một người bị tách thành hai mà không có lỗi nào hiện ra.
 *
 * Thuần: không DOM, không node:*, không import TensorFlow — `faceapi` và `tf`
 * do người gọi nạp rồi đưa vào.
 */

/** Cỡ thumbnail lấy từ Drive để quét. */
export const SCAN_WIDTH = 800;

/**
 * Ngưỡng tin cậy của bộ dò mặt.
 *
 * 0.35 chứ không phải mặc định 0.5: ảnh cưới đầy mặt NHỎ trong ảnh nhóm và mặt
 * nghiêng ở rìa khung. Bỏ sót một khuôn mặt nghĩa là khách lọc theo mặt mình mà
 * thiếu ảnh — sai nguy hiểm hơn hẳn việc thỉnh thoảng nhận nhầm một mảng tường,
 * vì mảng tường đó sẽ đứng thành một "người" riêng chẳng ai bấm vào.
 */
export const MIN_CONFIDENCE = 0.35;

/** Trần số mặt mỗi ảnh — ảnh tiệc đông người không được ngốn hết thời gian. */
export const MAX_FACES = 24;

/** Số chiều của vector đặc trưng. */
export const DESCRIPTOR_DIM = 128;

export type ScannedFace = {
  /** Khung mặt theo TỈ LỆ 0…1 của ảnh. */
  box: { x: number; y: number; w: number; h: number };
  /** Vector 128 chiều, để NGUYÊN (không chuẩn hoá) — xem @/lib/face-group. */
  descriptor: number[];
  /** Độ nét đo RIÊNG trên vùng mặt; chỉ dùng để chọn ảnh đại diện. */
  sharpness: number;
};

/** Ảnh xám toàn khung, để đo nét trên vùng mặt. */
export function toGray(rgba: Uint8Array | Uint8ClampedArray, w: number, h: number): Uint8Array {
  const g = new Uint8Array(w * h);
  for (let i = 0, p = 0; i < g.length; i++, p += 4) {
    g[i] = (rgba[p] * 299 + rgba[p + 1] * 587 + rgba[p + 2] * 114) / 1000;
  }
  return g;
}

/**
 * Quét MỘT khung ảnh RGBA đã giải mã.
 *
 * `detector: "tiny"` chỉ dành cho ảnh khách tự chụp (một mặt to, chính diện):
 * bộ dò nhỏ tải nhẹ hơn 5,4 MB. Ảnh album LUÔN dùng "ssd".
 */
export async function quetRgba(
  faceapi: any,
  tf: any,
  data: Uint8Array | Uint8ClampedArray,
  W: number,
  H: number,
  detector: "ssd" | "tiny" = "ssd"
): Promise<ScannedFace[]> {
  if (!W || !H) return [];
  const tensor = tf.tidy(() => tf.tensor3d(new Uint8Array(data), [H, W, 4]).slice([0, 0, 0], [-1, -1, 3]));
  let results: any[];
  try {
    const opts =
      detector === "tiny"
        ? new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: MIN_CONFIDENCE })
        : new faceapi.SsdMobilenetv1Options({ minConfidence: MIN_CONFIDENCE, maxResults: MAX_FACES });
    results = await faceapi.detectAllFaces(tensor, opts).withFaceLandmarks().withFaceDescriptors();
  } finally {
    // Không dispose là rò bộ nhớ theo từng ảnh (bộ nhớ GPU ở trình duyệt, bộ nhớ
    // WASM ở máy chủ) — một album vài trăm ảnh đủ làm treo tab / chết tiến trình.
    tensor.dispose();
  }

  const gray = toGray(data, W, H);
  const out: ScannedFace[] = [];
  for (const r of results) {
    const d = r.detection?.box;
    const v: Float32Array | undefined = r.descriptor;
    if (!d || !v || v.length === 0) continue;
    const box = {
      x: Math.max(0, Math.min(1, d.x / W)),
      y: Math.max(0, Math.min(1, d.y / H)),
      w: Math.max(0, Math.min(1, d.width / W)),
      h: Math.max(0, Math.min(1, d.height / H)),
    };
    // Nét đo trên vùng mặt, KHÔNG phải cả khung: nền đầy cạnh (lá cây, ren váy)
    // làm điểm nét cả khung cao trong khi mặt nhoè. Xem @/lib/photo-ai.
    const sub = subGray(gray, W, H, box.x, box.y, box.w, box.h);
    out.push({
      box,
      descriptor: Array.from(v),
      sharpness: sub ? laplacianVariance(sub.gray, sub.width, sub.height) : 0,
    });
  }
  return out.slice(0, MAX_FACES);
}

/**
 * Lỗi tải ảnh VĨNH VIỄN — đánh mốc luôn (0 khuôn mặt) thay vì thử lại mãi:
 * http-404 = file đã xoá khỏi Drive, khong-phai-jpeg = PNG, bộ quét không đọc
 * được. Mọi lý do khác (403, 429, hết giờ…) là tạm thời, lượt sau thử lại.
 */
export function laLoiVinhVien(lyDo: string | null | undefined): boolean {
  return !!lyDo && /^(http-404|khong-phai-jpeg)/.test(lyDo);
}

/* ─────────────────────────────────────────────────────────────────────────────
   Lô kết quả do TRÌNH DUYỆT STUDIO gửi lên — kiểm chặt trước khi ghi
   ───────────────────────────────────────────────────────────────────────────── */

/** Trần số ảnh mỗi lô gửi lên (bằng mẻ ghi của bộ quét máy chủ). */
export const LO_TOI_DA = 20;
/** Trần dung lượng thân yêu cầu: 20 ảnh × 24 mặt × ~2,6 KB vẫn lọt. */
export const THAN_TOI_DA = 2 * 1024 * 1024;

export type KetQuaAnh =
  | { photoId: string; faces: ScannedFace[] }
  | { photoId: string; skip: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const so01 = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1;

/**
 * Kiểm một lô kết quả. Sai MỘT chỗ là từ chối CẢ lô: máy studio chạy đúng code
 * này thì không bao giờ sai, nên sai nghĩa là có người gọi tay — không vá hộ.
 *
 * `at` phải là 0…n-1 đúng thứ tự: đó là khoá (photo_id, at) của album_faces.
 */
export function kiemLoKetQua(raw: unknown): { ok: true; lo: KetQuaAnh[] } | { ok: false; loi: string } {
  if (!Array.isArray(raw)) return { ok: false, loi: "khong_phai_mang" };
  if (raw.length === 0) return { ok: false, loi: "lo_rong" };
  if (raw.length > LO_TOI_DA) return { ok: false, loi: "lo_qua_lon" };
  const lo: KetQuaAnh[] = [];
  const seen = new Set<string>();
  for (const r of raw as any[]) {
    const id = r?.photoId;
    if (typeof id !== "string" || !UUID.test(id)) return { ok: false, loi: "photo_id_sai" };
    if (seen.has(id)) return { ok: false, loi: "photo_id_trung" };
    seen.add(id);
    if (r.skip !== undefined) {
      if (typeof r.skip !== "string" || !laLoiVinhVien(r.skip)) return { ok: false, loi: "ly_do_bo_qua_sai" };
      lo.push({ photoId: id, skip: r.skip.slice(0, 80) });
      continue;
    }
    if (!Array.isArray(r.faces)) return { ok: false, loi: "thieu_faces" };
    if (r.faces.length > MAX_FACES) return { ok: false, loi: "qua_nhieu_mat" };
    const faces: ScannedFace[] = [];
    for (let i = 0; i < r.faces.length; i++) {
      const f = r.faces[i];
      if (f?.at !== i) return { ok: false, loi: "at_sai_thu_tu" };
      const b = f.box;
      if (!Array.isArray(b) || b.length !== 4 || !b.every(so01)) return { ok: false, loi: "box_sai" };
      const d = f.descriptor;
      if (!Array.isArray(d) || d.length !== DESCRIPTOR_DIM) return { ok: false, loi: "descriptor_sai_chieu" };
      // Vector thật của mạng này nằm trong khoảng ±1; chặn ±10 để số rác không
      // vào DB (real[] tràn) mà vẫn không bao giờ từ chối một vector thật.
      for (const n of d) if (typeof n !== "number" || !Number.isFinite(n) || Math.abs(n) > 10) return { ok: false, loi: "descriptor_sai_so" };
      const s = f.sharpness;
      if (typeof s !== "number" || !Number.isFinite(s) || s < 0 || s > 1e9) return { ok: false, loi: "sharpness_sai" };
      faces.push({ box: { x: b[0], y: b[1], w: b[2], h: b[3] }, descriptor: d as number[], sharpness: s });
    }
    lo.push({ photoId: id, faces });
  }
  return { ok: true, lo };
}

/** Kiểm vector khách gửi lên /face-match (128 số hữu hạn). */
export function laDescriptorHopLe(d: unknown): d is number[] {
  return Array.isArray(d) && d.length === DESCRIPTOR_DIM && d.every((n) => typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= 10);
}
