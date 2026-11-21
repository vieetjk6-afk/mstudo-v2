"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { batDauQuetTay, CHO_THU_LAI, gomAlbum, loiGom, quetAlbum, taiViecQuet, xongQuetTay, type FaceScanStatus } from "@/lib/face-local-runner";

/* ═══════════════════════════════════════════════════════════════════════════
   QUÉT KHUÔN MẶT TRÊN MÁY NÀY — thẻ trong trang album.

   Vòng quét thật nằm ở @/lib/face-local-runner (dùng chung với bộ tự quét nền
   của dashboard). Hook này chỉ giữ trạng thái cho giao diện, và báo cho bộ tự
   quét nhường máy khi studio bấm quét tay.
   ═══════════════════════════════════════════════════════════════════════════ */

export type { FaceScanStatus } from "@/lib/face-local-runner";
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
  /** Ảnh tải thẳng từ Google / qua máy chủ trong phiên quét này. */
  tai?: { thang: number; mayChu: number } | null;
};

export function useFaceLocalScan(albumId: string): FaceScanView & { batDau: () => void; tamDung: () => void } {
  const [v, setV] = useState<FaceScanView>({ phase: "tai", status: null, napPct: 0, dang: null, hongTam: 0, loi: null, backend: null });
  const abortRef = useRef<AbortController | null>(null);

  // Mở trang: đọc tiến độ. Album đã quét hết mà còn mặt chưa gom (tab đóng đúng
  // trước bước gom) thì gom luôn — không bắt studio bấm thêm gì.
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        let s: FaceScanStatus & { canGom?: boolean } = await taiViecQuet(albumId);
        let loi: string | null = null;
        if (s.canGom) {
          if (alive) setV((o) => ({ ...o, phase: "gom", status: s }));
          // Tự gom khi MỞ TRANG là lượt tự động: lần trước vừa hỏng thì chờ, bấm
          // "Quét" để thử ngay.
          const g = await gomAlbum(albumId, { tuDong: true });
          if (g.ok && typeof g.nguoi === "number") s = { ...s, nguoi: g.nguoi, canGom: false };
          else if (!g.ok && g.loi !== CHO_THU_LAI) loi = loiGom(g.loi);
        }
        if (alive) setV((o) => ({ ...o, phase: "nghi", status: s, loi }));
      } catch (e) {
        const m = e instanceof Error ? e.message : "";
        if (alive) setV((o) => ({ ...o, phase: m === "goi_khong_co_tinh_nang" ? "khoa-goi" : m === "thieu_bang" ? "thieu-bang" : "nghi", loi: /goi_|thieu_bang/.test(m) ? null : "Không đọc được tiến độ quét. Tải lại trang để thử lại." }));
      }
    })();
    return () => {
      alive = false;
      abortRef.current?.abort();
    };
  }, [albumId]);

  const batDau = useCallback(() => {
    if (abortRef.current && !abortRef.current.signal.aborted) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setV((o) => ({ ...o, loi: null }));
    batDauQuetTay();
    void (async () => {
      const { loi, status } = await quetAlbum(albumId, {
        signal: ctrl.signal,
        patch: (p) =>
          setV((o) => {
            const n = { ...o };
            if (p.phase) n.phase = p.phase;
            if (p.napPct !== undefined) n.napPct = p.napPct;
            if (p.backend !== undefined) n.backend = p.backend;
            if (p.dang !== undefined) n.dang = p.dang;
            if (p.hongTam !== undefined) n.hongTam = p.hongTam;
            if (p.status) n.status = p.status;
            if (p.tai) n.tai = p.tai;
            if (p.conLai !== undefined && n.status) n.status = { ...n.status, conLai: p.conLai, daQuet: Math.max(0, n.status.tong - p.conLai) };
            return n;
          }),
      });
      xongQuetTay();
      setV((o) =>
        status
          ? { ...o, phase: status.conLai > 0 && (ctrl.signal.aborted || loi) ? "dung" : "nghi", status, loi, dang: null }
          : { ...o, phase: "dung", loi, dang: null },
      );
      if (abortRef.current === ctrl) abortRef.current = null;
    })();
  }, [albumId]);

  const tamDung = useCallback(() => abortRef.current?.abort(), []);

  return { ...v, batDau, tamDung };
}
