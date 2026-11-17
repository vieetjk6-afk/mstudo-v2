"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { laLoiVinhVien, LO_TOI_DA } from "@/lib/face-scan-core";

/* ═══════════════════════════════════════════════════════════════════════════
   QUÉT KHUÔN MẶT TRÊN MÁY NÀY — vòng điều phối chạy trong tab của studio.

   Bản sao phía trình duyệt của `scanAlbum` (@/lib/face-scan-server): hỏi máy
   chủ ảnh nào còn phải quét, tải thumbnail cùng nguồn, nhận diện bằng
   @/lib/face-embed-browser, gửi kết quả theo lô nhỏ về
   /api/albums/[id]/face-local. Máy chủ không chạy TensorFlow.

   Tiến độ là THỨ MÁY CHỦ ĐÃ LƯU, không phải biến trong tab: tải lại trang, đổi
   máy, hay hai người cùng mở đều tiếp tục đúng chỗ. Tab đóng giữa chừng chỉ mất
   lô chưa kịp gửi (≤ 8 ảnh).
   ═══════════════════════════════════════════════════════════════════════════ */

export type FaceScanStatus = {
  tong: number;
  daQuet: number;
  conLai: number;
  nguoi: number;
  /** Máy chủ cũng đang tự quét ban đêm (FACE_SERVER_SCAN=1). */
  mayChuQuet: boolean;
};
export type FaceScanPhase = "tai" | "khoa-goi" | "thieu-bang" | "nghi" | "nap" | "quet" | "dung" | "gom";
export type FaceScanView = {
  phase: FaceScanPhase;
  status: FaceScanStatus | null;
  /** % nạp mô hình (0–100) khi phase = "nap". */
  napPct: number;
  /** Tên ảnh đang quét. */
  dang: string | null;
  /** Số ảnh tải hỏng TẠM THỜI trong phiên này — lần quét sau thử lại. */
  hongTam: number;
  loi: string | null;
  backend: string | null;
};

/** Mẻ gửi đầu nhỏ (như FIRST_CHUNK của máy chủ) để "ghi không ăn" lộ ra sớm. */
const LO_DAU = 3;
const LO_THUONG = Math.min(8, LO_TOI_DA);
/** Nghỉ giữa hai ảnh để tab còn vẽ và bấm được. */
const NGHI_MS = 40;
/** Ngần này tấm hỏng tạm LIÊN TIẾP thì dừng: gần như chắc là mất mạng / Drive chặn. */
const HONG_LIEN_TIEP = 6;

type Item = { photoId: string; faces?: { at: number; box: number[]; descriptor: number[]; sharpness: number }[]; skip?: string };

export function useFaceLocalScan(albumId: string): FaceScanView & { batDau: () => void; tamDung: () => void } {
  const [v, setV] = useState<FaceScanView>({ phase: "tai", status: null, napPct: 0, dang: null, hongTam: 0, loi: null, backend: null });
  const abortRef = useRef<AbortController | null>(null);
  const url = `/api/albums/${albumId}/face-local`;

  const gom = useCallback(async () => {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gom: true }) });
    return (await r.json().catch(() => ({}))) as { ok?: boolean; nguoi?: number };
  }, [url]);

  const taiTrangThai = useCallback(
    async (boQua = 0) => {
      const r = await fetch(`${url}?so=${boQua}`, { cache: "no-store" });
      const d = (await r.json().catch(() => ({}))) as Partial<FaceScanStatus> & { ok?: boolean; error?: string; canGom?: boolean; anh?: { id: string; drive_file_id: string; name: string | null }[] };
      if (!d.ok) throw new Error(d.error || `http-${r.status}`);
      return d as FaceScanStatus & { canGom: boolean; anh: { id: string; drive_file_id: string; name: string | null }[] };
    },
    [url]
  );

  // Mở trang: đọc tiến độ. Album đã quét hết mà còn mặt chưa gom (tab đóng đúng
  // trước bước gom) thì gom luôn — không bắt studio bấm thêm gì.
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        let s = await taiTrangThai();
        if (s.canGom) {
          const g = await gom();
          if (typeof g.nguoi === "number") s = { ...s, nguoi: g.nguoi };
        }
        if (alive) setV((o) => ({ ...o, phase: "nghi", status: s }));
      } catch (e) {
        const m = e instanceof Error ? e.message : "";
        if (alive) setV((o) => ({ ...o, phase: m === "goi_khong_co_tinh_nang" ? "khoa-goi" : m === "thieu_bang" ? "thieu-bang" : "nghi", loi: /goi_|thieu_bang/.test(m) ? null : "Không đọc được tiến độ quét. Tải lại trang để thử lại." }));
      }
    })();
    return () => {
      alive = false;
      abortRef.current?.abort();
    };
  }, [taiTrangThai, gom]);

  const batDau = useCallback(() => {
    if (abortRef.current && !abortRef.current.signal.aborted) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const sig = ctrl.signal;
    const patch = (p: Partial<FaceScanView>) => setV((o) => ({ ...o, ...p }));

    void (async () => {
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
        if (typeof d.conLai === "number") {
          const conLai = d.conLai;
          setV((o) => (o.status ? { ...o, status: { ...o.status, conLai, daQuet: Math.max(0, o.status.tong - conLai) } } : o));
        }
        return true;
      };

      try {
        patch({ phase: "nap", napPct: 0, loi: null, hongTam: 0 });
        const embed = await import("@/lib/face-embed-browser");
        if (!embed.faceEmbedSupported()) throw new Error("may_khong_chay_duoc");
        const { backend } = await embed.napMoHinh("ssd", (p) => patch({ napPct: p.phanTram }));
        patch({ phase: "quet", backend });

        vong: while (!sig.aborted) {
          // Tấm hỏng tạm vẫn nằm đầu danh sách chờ → bỏ qua đúng ngần ấy dòng.
          const s = await taiTrangThai(hongTam);
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
                const faces = await embed.scanJpegBrowser(bytes);
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
            await new Promise((r) => setTimeout(r, NGHI_MS));
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
        await gom();
        const s = await taiTrangThai();
        setV((o) => ({ ...o, phase: s.conLai > 0 && (sig.aborted || loi) ? "dung" : "nghi", status: s, loi }));
      } catch {
        setV((o) => ({ ...o, phase: "dung", loi: loi ?? "Không đọc lại được tiến độ. Tải lại trang để xem." }));
      }
      if (abortRef.current === ctrl) abortRef.current = null;
    })();
  }, [url, gom, taiTrangThai]);

  const tamDung = useCallback(() => abortRef.current?.abort(), []);

  return { ...v, batDau, tamDung };
}
