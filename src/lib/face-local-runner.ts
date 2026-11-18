"use client";

import { laLoiVinhVien, LO_TOI_DA } from "@/lib/face-scan-core";

/* ═══════════════════════════════════════════════════════════════════════════
   VÒNG QUÉT KHUÔN MẶT TRÊN MÁY STUDIO — dùng chung cho HAI chỗ:

     · thẻ "Tìm theo khuôn mặt" trong trang album (studio bấm quét), và
     · bộ TỰ QUÉT chạy nền khi studio đang mở dashboard (@/components/v2/FaceAutoScan).

   Bản sao phía trình duyệt của `scanAlbum` (@/lib/face-scan-server): hỏi máy
   chủ ảnh nào còn phải quét, tải thumbnail cùng nguồn, nhận diện bằng
   @/lib/face-embed-browser, gửi kết quả theo lô nhỏ về
   /api/albums/[id]/face-local. Máy chủ không chạy TensorFlow.

   Tiến độ là THỨ MÁY CHỦ ĐÃ LƯU, không phải biến trong tab: tải lại trang, đổi
   máy, hay hai người cùng mở đều tiếp tục đúng chỗ (máy chủ bỏ qua tấm đã có
   mốc). Tab đóng giữa chừng chỉ mất lô chưa kịp gửi (≤ 8 ảnh).
   ═══════════════════════════════════════════════════════════════════════════ */

export type FaceScanStatus = {
  tong: number;
  daQuet: number;
  conLai: number;
  nguoi: number;
  /** Máy chủ cũng đang tự quét ban đêm (FACE_SERVER_SCAN=1). */
  mayChuQuet: boolean;
};
export type ViecQuetTrang = FaceScanStatus & { canGom: boolean; anh: { id: string; drive_file_id: string; name: string | null }[] };

/** Thay đổi trạng thái mà vòng quét báo ra — người gọi tự dựng giao diện. */
export type QuetPatch = {
  phase?: "nap" | "quet" | "gom";
  napPct?: number;
  backend?: string | null;
  dang?: string | null;
  hongTam?: number;
  status?: FaceScanStatus;
  /** Chỉ báo số còn lại sau một lô gửi thành công (không đọc lại cả trạng thái). */
  conLai?: number;
};

/** Mẻ gửi đầu nhỏ (như FIRST_CHUNK của máy chủ) để "ghi không ăn" lộ ra sớm. */
const LO_DAU = 3;
const LO_THUONG = Math.min(8, LO_TOI_DA);
/** Ngần này tấm hỏng tạm LIÊN TIẾP thì dừng: gần như chắc là mất mạng / Drive chặn. */
const HONG_LIEN_TIEP = 6;

type Item = { photoId: string; faces?: { at: number; box: number[]; descriptor: number[]; sharpness: number }[]; skip?: string };

const urlCua = (albumId: string) => `/api/albums/${albumId}/face-local`;

/** Tiến độ + một trang ảnh còn phải quét. Ném Error(mã lỗi máy chủ) khi bị từ chối. */
export async function taiViecQuet(albumId: string, boQua = 0): Promise<ViecQuetTrang> {
  const r = await fetch(`${urlCua(albumId)}?so=${boQua}`, { cache: "no-store" });
  const d = (await r.json().catch(() => ({}))) as Partial<ViecQuetTrang> & { ok?: boolean; error?: string };
  if (!d.ok) throw new Error(d.error || `http-${r.status}`);
  return d as ViecQuetTrang;
}

/** Gom nhóm nếu cần (máy chủ tự quyết theo luật 12 giờ). */
export async function gomAlbum(albumId: string): Promise<{ ok?: boolean; nguoi?: number }> {
  const r = await fetch(urlCua(albumId), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gom: true }) });
  return (await r.json().catch(() => ({}))) as { ok?: boolean; nguoi?: number };
}

/* ── Một máy chỉ MỘT vòng quét tại một lúc ───────────────────────────────────
   Studio bấm quét tay trong trang album thì bộ tự quét nền (nếu đang chạy trong
   cùng tab) phải nhường: hai vòng cùng chạy chỉ chia đôi CPU của một máy, và
   cùng album thì còn làm trùng việc. Thẻ trong trang album gọi `batDauQuetTay`,
   bộ tự quét lắng nghe sự kiện này và dừng; quét tay xong thì `xongQuetTay`. */
let quetTay = 0;
const SU_KIEN_TAY = "mstudo-face-quet-tay";
export function batDauQuetTay(): void {
  quetTay++;
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SU_KIEN_TAY));
}
export function xongQuetTay(): void {
  quetTay = Math.max(0, quetTay - 1);
}
export const dangQuetTay = () => quetTay > 0;
export function nghePhaiNhuong(fn: () => void): () => void {
  window.addEventListener(SU_KIEN_TAY, fn);
  return () => window.removeEventListener(SU_KIEN_TAY, fn);
}

/**
 * Quét HẾT các ảnh còn chờ của một album (hoặc tới khi `signal` bị huỷ), rồi gom.
 *
 * Trả về câu lỗi cho người dùng (null nếu không lỗi) và tiến độ đọc lại sau
 * cùng. Không bao giờ ném. `nghiMs` = nghỉ giữa hai ảnh: thẻ quét tay để 40 ms
 * (nhanh nhất mà tab vẫn bấm được), bộ tự quét nền để lâu hơn cho máy studio
 * còn sức làm việc khác.
 */
export async function quetAlbum(
  albumId: string,
  opts: {
    signal: AbortSignal;
    patch: (p: QuetPatch) => void;
    nghiMs?: number;
    /**
     * Nghỉ thêm theo TỈ LỆ thời gian vừa nhận diện tấm trước: 1 = nghỉ đúng
     * bằng thời gian làm → máy chỉ bận khoảng MỘT NỬA thời gian, máy nhanh hay
     * chậm đều tự khớp. Bộ tự quét nền dùng 1; thẻ quét tay để 0 (nhanh nhất).
     */
    tiLeNghi?: number;
  },
): Promise<{ loi: string | null; status: FaceScanStatus | null }> {
  const { signal: sig, patch } = opts;
  const nghiMs = opts.nghiMs ?? 40;
  const tiLeNghi = Math.max(0, opts.tiLeNghi ?? 0);
  /** Thời gian nhận diện tấm vừa rồi — để tính khoảng nghỉ theo tỉ lệ. */
  let lamMs = 0;
  const url = urlCua(albumId);
  let loi: string | null = null;
  const buf: Item[] = [];
  let daGui = false;
  let hongTam = 0;
  let lienTiep = 0;

  /** Gửi lô đang giữ. Trả false = phải dừng (ghi không ăn / bị từ chối). */
  const gui = async (): Promise<boolean> => {
    if (buf.length === 0) return true;
    const lo = buf.splice(0, buf.length);
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ketQua: lo }) });
    const d = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string; conLai?: number };
    if (!d.ok) {
      loi =
        d.error === "ghi-khong-an"
          ? "Máy chủ nhận kết quả nhưng không lưu lại được — đã dừng để khỏi quét lặp. Thử lại sau ít phút."
          : r.status === 429
            ? "Gửi kết quả quá nhanh, máy chủ tạm từ chối. Bấm quét tiếp sau một phút."
            : `Máy chủ từ chối kết quả (${d.error ?? r.status}).`;
      return false;
    }
    daGui = true;
    if (typeof d.conLai === "number") patch({ conLai: d.conLai });
    return true;
  };

  try {
    patch({ phase: "nap", napPct: 0, hongTam: 0 });
    const embed = await import("@/lib/face-embed-browser");
    if (!embed.faceEmbedSupported()) throw new Error("may_khong_chay_duoc");
    const { backend } = await embed.napMoHinh("ssd", (p) => patch({ napPct: p.phanTram }));
    patch({ phase: "quet", backend });

    vong: while (!sig.aborted) {
      // Tấm hỏng tạm vẫn nằm đầu danh sách chờ → bỏ qua đúng ngần ấy dòng.
      const s = await taiViecQuet(albumId, hongTam);
      patch({ status: s });
      if (s.anh.length === 0) break;
      // Tải trước MỘT tấm trong lúc đang nhận diện tấm hiện tại.
      let cho = embed.taiAnhQuet(s.anh[0].drive_file_id, sig);
      for (let i = 0; i < s.anh.length; i++) {
        if (sig.aborted) break vong;
        const p = s.anh[i];
        const dangCho = cho;
        if (i + 1 < s.anh.length) cho = embed.taiAnhQuet(s.anh[i + 1].drive_file_id, sig);
        patch({ dang: p.name });
        const { bytes, lyDo } = await dangCho;
        if (sig.aborted) break vong;
        if (!bytes) {
          if (laLoiVinhVien(lyDo)) buf.push({ photoId: p.id, skip: lyDo! });
          else {
            // Tạm thời (403, 429, mạng…): KHÔNG đánh mốc, lần sau thử lại.
            hongTam++;
            patch({ hongTam });
            if (++lienTiep >= HONG_LIEN_TIEP) {
              loi = `Không tải được ảnh từ Drive (${lyDo}). Kiểm tra mạng / quyền chia sẻ thư mục rồi bấm quét tiếp.`;
              break vong;
            }
            continue;
          }
        } else {
          try {
            const t0 = performance.now();
            const faces = await embed.scanJpegBrowser(bytes);
            lamMs = performance.now() - t0;
            buf.push({ photoId: p.id, faces: faces.map((f, at) => ({ at, box: [f.box.x, f.box.y, f.box.w, f.box.h], descriptor: f.descriptor, sharpness: f.sharpness })) });
          } catch {
            // JPEG hỏng / hết bộ nhớ ở một tấm: coi là tạm, không chặn cả album.
            hongTam++;
            patch({ hongTam });
            continue;
          }
        }
        lienTiep = 0;
        if (buf.length >= (daGui ? LO_THUONG : LO_DAU) && !(await gui())) break vong;
        // Trần 10 giây: một tấm bất thường (máy vừa ngủ dậy…) không được treo cả vòng.
        const nghi = Math.max(nghiMs, Math.min(10_000, lamMs * tiLeNghi));
        await new Promise<void>((r) => {
          const t = setTimeout(r, nghi);
          sig.addEventListener("abort", () => (clearTimeout(t), r()), { once: true });
        });
      }
      // Hết trang: gửi nốt TRƯỚC khi hỏi trang kế, nếu không trang kế trả lại
      // đúng những tấm đang nằm trong tay.
      if (!(await gui())) break;
    }
    // Dừng giữa chừng cũng gửi nốt phần đã nhận diện — công đã bỏ ra rồi.
    if (!loi) await gui();
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    loi =
      m === "may_khong_chay_duoc" || /khong_co_nen|face_api/.test(m)
        ? "Trình duyệt này không chạy được bộ nhận diện (cần WebGL hoặc WebAssembly). Thử Chrome / Edge trên máy tính."
        : m === "rate_limited" || m === "http-429"
          ? "Máy chủ tạm từ chối vì gọi quá nhanh. Bấm quét tiếp sau một phút."
          : "Việc quét bị gián đoạn (mất mạng?). Bấm quét tiếp — phần đã quét vẫn được giữ.";
  }

  // Gom: quét hết thì gom ngay; tạm dừng thì máy chủ tự quyết theo luật 12 giờ.
  try {
    patch({ phase: "gom", dang: null });
    await gomAlbum(albumId);
    return { loi, status: await taiViecQuet(albumId) };
  } catch {
    return { loi: loi ?? "Không đọc lại được tiến độ. Tải lại trang để xem.", status: null };
  }
}
