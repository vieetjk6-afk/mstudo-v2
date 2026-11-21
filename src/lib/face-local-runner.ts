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
  /** Ảnh tải thẳng từ Google / phải đi qua máy chủ trong phiên này. */
  tai?: { thang: number; mayChu: number };
};

/** Mẻ gửi đầu nhỏ (như FIRST_CHUNK của máy chủ) để "ghi không ăn" lộ ra sớm. */
const LO_DAU = 3;
/**
 * Mẻ thường = đúng trần máy chủ nhận (20). Mỗi mẻ là ~10 lượt gọi Supabase (kiểm
 * quyền, ghi mặt, ghi mốc, đọc lại, đếm tiến độ) bất kể mẻ to hay nhỏ — mẻ 8 ảnh
 * nghĩa là album 1.500 ảnh tốn ~1.900 lượt gọi chỉ cho phần ghi.
 */
const LO_THUONG = LO_TOI_DA;
/** Ngần này tấm hỏng tạm LIÊN TIẾP thì dừng: gần như chắc là mất mạng / Drive chặn. */
const HONG_LIEN_TIEP = 6;

type Item = { photoId: string; faces?: { at: number; box: number[]; descriptor: number[]; sharpness: number }[]; skip?: string };

const urlCua = (albumId: string) => `/api/albums/${albumId}/face-local`;

/** Tiến độ + một trang ảnh còn phải quét. Ném Error(mã lỗi máy chủ) khi bị từ chối. */
export async function taiViecQuet(albumId: string, boQua = 0, gomNgay = false): Promise<ViecQuetTrang> {
  const r = await fetch(`${urlCua(albumId)}?so=${boQua}${gomNgay ? "&gom=ngay" : ""}`, { cache: "no-store" });
  const d = (await r.json().catch(() => ({}))) as Partial<ViecQuetTrang> & { ok?: boolean; error?: string };
  if (!d.ok) throw new Error(d.error || `http-${r.status}`);
  return d as ViecQuetTrang;
}

type FaceRowTho = { photo_id: string; at: number; box: number[] | null; descriptor: number[] | string | null; sharpness: number | null };

/** real[] của Postgres có thể về dạng chuỗi "{0.1,0.2,…}" — đổi về mảng số. */
const veMang = (v: number[] | string | null): number[] | null =>
  v == null ? null : Array.isArray(v) ? v : v.replace(/[{}]/g, "").split(",").filter(Boolean).map(Number);

/** Chạy phép gom trong Web Worker; trình duyệt không có Worker thì chạy ngay đây. */
async function tinhTrongWorker(list: unknown[], known: unknown[]): Promise<unknown[]> {
  if (typeof Worker === "undefined") {
    const { tinhNguoi } = await import("@/lib/face-gom-tinh");
    return tinhNguoi(list as never, known as never);
  }
  const w = new Worker(new URL("./face-gom.worker.ts", import.meta.url), { type: "module" });
  try {
    return await new Promise<unknown[]>((res, rej) => {
      w.onmessage = (e: MessageEvent<{ nguoi?: unknown[]; loi?: string }>) => (e.data.loi ? rej(new Error(e.data.loi)) : res(e.data.nguoi ?? []));
      w.onerror = (e) => rej(new Error(e.message || "worker_loi"));
      w.postMessage({ list, known });
    });
  } finally {
    w.terminate();
  }
}

/**
 * GOM TRÊN MÁY STUDIO — đường mặc định.
 *
 * Album cưới vài nghìn ảnh có hàng chục nghìn khuôn mặt; lượt gom trên máy chủ
 * quá giờ và bị cắt ngang, khách không bao giờ thấy ô tìm khuôn mặt. Ở đây:
 * đọc vector THẲNG từ database (quyền chủ album, cùng lượng dữ liệu máy chủ vẫn
 * đọc), gom trong Web Worker, chỉ gửi KẾT QUẢ lên máy chủ để kiểm và ghi.
 * Trả câu lỗi thật (không nuốt) để thẻ hiện được.
 */
export async function gomAlbum(albumId: string, opts: { tuDong?: boolean } = {}): Promise<{ ok: boolean; nguoi?: number; loi?: string }> {
  // Lượt TỰ ĐỘNG vừa hỏng gần đây: đừng đọc lại cả bảng vector (10–50 MB với album
  // cưới) mỗi lần mở dashboard / mỗi 30 phút. Studio bấm tay thì vẫn chạy ngay.
  if (opts.tuDong && vuaGomHong(albumId)) return { ok: false, loi: CHO_THU_LAI };
  const kq = await gomAlbumThat(albumId);
  ghiGomHong(albumId, !kq.ok);
  return kq;
}

/** Mã trả về khi lượt gom tự động bị hoãn vì lần trước vừa hỏng — không phải lỗi mới. */
export const CHO_THU_LAI = "cho_thu_lai";
/** Gom hỏng thì lượt TỰ ĐỘNG chờ ngần này mới thử lại. */
const GOM_HONG_CHO_MS = 12 * 3600_000;
const khoaGomHong = (albumId: string) => `mstudo-gom-hong:${albumId}`;
function vuaGomHong(albumId: string): boolean {
  try {
    const t = Number(localStorage.getItem(khoaGomHong(albumId)));
    return Number.isFinite(t) && t > 0 && Date.now() - t < GOM_HONG_CHO_MS;
  } catch {
    return false;
  }
}
function ghiGomHong(albumId: string, hong: boolean): void {
  try {
    if (hong) localStorage.setItem(khoaGomHong(albumId), String(Date.now()));
    else localStorage.removeItem(khoaGomHong(albumId));
  } catch {
    /* chế độ ẩn danh / chặn lưu trữ — chỉ mất phần hoãn */
  }
}

async function gomAlbumThat(albumId: string): Promise<{ ok: boolean; nguoi?: number; loi?: string }> {
  try {
    const { createClient } = await import("@/lib/supabase/client");
    const sb = createClient();
    const trang = (from: number) =>
      sb
        .from("album_faces")
        .select("photo_id, at, box, descriptor, sharpness")
        .eq("album_id", albumId)
        .order("photo_id")
        .order("at")
        .range(from, from + 999);
    const list: { photo_id: string; at: number; box: number[] | null; descriptor: number[] | null; sharpness: number | null }[] = [];
    // 4 trang một lúc, tới khi gặp trang thiếu.
    for (let from = 0, het = false; !het; from += 4000) {
      const lo = await Promise.all([0, 1, 2, 3].map((k) => trang(from + k * 1000)));
      for (const { data, error } of lo) {
        if (error) return { ok: false, loi: `doc_khuon_mat: ${error.message}` };
        const rows = (data ?? []) as FaceRowTho[];
        if (het) continue;
        for (const r of rows) list.push({ ...r, descriptor: veMang(r.descriptor), box: r.box ? veMang(r.box as number[] | string) : null });
        if (rows.length < 1000) het = true;
      }
    }
    const { data: cu, error: eCu } = await sb.from("album_people").select("id, name, descriptor").eq("album_id", albumId);
    if (eCu) return { ok: false, loi: `doc_nguoi_cu: ${eCu.message}` };
    const known = ((cu ?? []) as { id: string; name: string | null; descriptor: number[] | string | null }[]).map((k) => ({
      id: k.id,
      name: k.name ?? "",
      descriptor: veMang(k.descriptor) ?? [],
    }));
    const nguoi = await tinhTrongWorker(list, known);
    const r = await fetch(urlCua(albumId), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ luuGom: { nguoi } }) });
    const d = (await r.json().catch(() => ({}))) as { ok?: boolean; nguoi?: number; error?: string; detail?: string };
    if (!r.ok || !d.ok) return { ok: false, loi: d.error ? `${d.error}${d.detail ? `: ${d.detail}` : ""}` : `http-${r.status}` };
    return { ok: true, nguoi: d.nguoi };
  } catch (e) {
    return { ok: false, loi: e instanceof Error ? e.message : String(e) };
  }
}

/** Câu báo khi gom hỏng — trước đây lỗi này bị nuốt: thẻ vẫn khoe số người CŨ mà khách không thấy ô tìm. */
export const LOI_GOM =
  "Đã quét xong nhưng chưa gom được khuôn mặt thành từng người, nên khách chưa thấy ô tìm khuôn mặt. Tải lại trang để thử gom lại.";
/** Câu báo kèm mã lỗi thật — để biết hỏng ở đâu thay vì đoán. */
export const loiGom = (chiTiet?: string) => (chiTiet ? `${LOI_GOM} (Mã lỗi: ${chiTiet.slice(0, 200)})` : LOI_GOM);

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
    tiLeNghi?: number | (() => number);
    /**
     * Gọi trước MỖI tấm: trả về khi máy đủ rảnh để quét tiếp. Bộ tự quét nền dùng
     * để đứng chờ trong lúc studio đang thao tác trên trang (quét tranh CPU/GPU
     * với giao diện → app giật). Thẻ quét tay không truyền: chạy hết sức.
     */
    choRanh?: (sig: AbortSignal) => Promise<void>;
    /**
     * Bộ tự quét nền (true) hay studio bấm tay (false). Lượt tự động tôn trọng
     * hai luật tiết kiệm của bước gom: gom lại nhiều nhất 12 giờ một lần, và
     * chờ 12 giờ sau một lần gom hỏng. Bấm tay thì gom ngay.
     */
    tuDong?: boolean;
  },
): Promise<{ loi: string | null; status: FaceScanStatus | null }> {
  const { signal: sig, patch } = opts;
  const nghiMs = opts.nghiMs ?? 40;
  const tiLeNghiLuc = () => Math.max(0, (typeof opts.tiLeNghi === "function" ? opts.tiLeNghi() : opts.tiLeNghi) ?? 0);
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
    // Hỏi trước còn ảnh nào không: album chỉ còn thiếu bước GOM thì khỏi tải
    // ~13 MB mô hình và khỏi bắt máy nhận diện gì cả.
    const dau = await taiViecQuet(albumId);
    patch({ status: dau });
    if (dau.anh.length > 0) {
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
        if (opts.choRanh) {
          await opts.choRanh(sig);
          if (sig.aborted) break vong;
        }
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
        const tk = embed.thongKeTaiAnh();
        patch({ tai: { thang: tk.thang, mayChu: tk.mayChu } });
        if (buf.length >= (daGui ? LO_THUONG : LO_DAU) && !(await gui())) break vong;
        // Trần 10 giây: một tấm bất thường (máy vừa ngủ dậy…) không được treo cả vòng.
        const nghi = Math.max(nghiMs, Math.min(10_000, lamMs * tiLeNghiLuc()));
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
    }
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
    let status = await taiViecQuet(albumId, 0, !opts.tuDong);
    // Gom khi đã quét HẾT (hoặc album chỉ còn thiếu bước gom). Quét dở thì để
    // lần quét xong mới gom: gom là việc nặng nhất, làm một lần cho trọn.
    if (status.conLai === 0 && status.canGom) {
      const g = await gomAlbum(albumId, { tuDong: opts.tuDong });
      if (!g.ok && !loi && g.loi !== CHO_THU_LAI) loi = loiGom(g.loi);
      status = await taiViecQuet(albumId);
    }
    return { loi, status };
  } catch {
    return { loi: loi ?? "Không đọc lại được tiến độ. Tải lại trang để xem.", status: null };
  }
}
