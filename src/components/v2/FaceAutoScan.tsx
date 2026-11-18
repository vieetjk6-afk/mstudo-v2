"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Pause, ScanFace, X } from "lucide-react";
import { dangQuetTay, nghePhaiNhuong, quetAlbum } from "@/lib/face-local-runner";

/* ═══════════════════════════════════════════════════════════════════════════
   TỰ QUÉT KHUÔN MẶT KHI STUDIO ĐANG MỞ DASHBOARD (giao diện mới).

   Studio không phải vào từng album bấm quét: khi họ đang làm việc trong
   dashboard, chính máy của họ lần lượt quét các album còn ảnh chưa quét — mới
   nhất trước. Máy chủ chỉ giao việc và lưu kết quả (@/lib/face-local-runner,
   /api/face-local/hang-doi), không chạy TensorFlow.

   Luật để không làm phiền / không làm chậm máy studio:
     · Chờ 20 giây sau khi mở dashboard mới bắt đầu (trang tải xong trước).
     · CHẠY NHẸ: sau mỗi ảnh nghỉ đúng bằng thời gian vừa nhận diện ảnh đó
       → máy chỉ bận khoảng một nửa thời gian (thẻ quét tay thì chạy hết sức).
       Chậm gấp đôi, nhưng studio làm việc khác không thấy giật.
     · Điện thoại / máy ít RAM / bật tiết kiệm dữ liệu: KHÔNG tự quét.
     · Nhiều tab: chỉ MỘT tab quét (Web Locks).
     · Studio bấm quét tay trong một album → bộ này nhường ngay.
     · Có nút tạm dừng (hết phiên này) và "tắt trên máy này" (nhớ ở localStorage).
     · Hết việc thì 30 phút sau hỏi lại (ảnh mới đồng bộ từ Drive).
   Chỉ hiện một ô nhỏ góc dưới bên phải khi đang thật sự quét.
   ═══════════════════════════════════════════════════════════════════════════ */

const KHOA_TAT = "mstudo-face-tu-quet";
/** Tên khoá Web Locks: chỉ một tab của trình duyệt này được tự quét. */
const KHOA_TAB = "mstudo-face-tu-quet-tab";
const CHO_BAT_DAU_MS = 20_000;
const HOI_LAI_MS = 30 * 60_000;
const NHUONG_MS = 2 * 60_000;
const NGHI_MS = 150;
/** Nghỉ bằng 1 lần thời gian làm → máy bận ~50%. */
const TI_LE_NGHI = 1;

export type AutoScanView =
  | { kieu: "nap"; ten: string; pct: number; thuTu: number; soAlbum: number }
  | { kieu: "quet"; ten: string; daQuet: number; tong: number; thuTu: number; soAlbum: number }
  | { kieu: "xong"; soAlbum: number }
  | { kieu: "tam-dung" };

/** Máy này có nên tự quét không — điện thoại, máy yếu, tiết kiệm dữ liệu thì không. */
function mayHopLe(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (localStorage.getItem(KHOA_TAT) === "tat") return false;
  } catch {
    /* không đọc được thì coi như chưa tắt */
  }
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  if (nav.connection?.saveData) return false;
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory < 4) return false;
  if (window.matchMedia?.("(pointer: coarse)").matches && window.innerWidth < 1024) return false;
  return true;
}

const ngu = (ms: number, sig: AbortSignal) =>
  new Promise<void>((res) => {
    const t = setTimeout(res, ms);
    sig.addEventListener("abort", () => (clearTimeout(t), res()), { once: true });
  });

export default function FaceAutoScan({ choBatDauMs = CHO_BAT_DAU_MS }: { /** Chỉ màn xem trước / kiểm thử rút ngắn. */ choBatDauMs?: number } = {}) {
  const [v, setV] = useState<AutoScanView | null>(null);
  const [an, setAn] = useState(false);
  const phienRef = useRef<AbortController | null>(null);
  const albumRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!mayHopLe()) return;
    const phien = new AbortController();
    phienRef.current = phien;

    // Studio bấm quét tay ở trang album → dừng album đang quét; vòng ngoài tự chờ.
    const boNghe = nghePhaiNhuong(() => albumRef.current?.abort());

    const chay = async () => {
      await ngu(choBatDauMs, phien.signal);
      while (!phien.signal.aborted) {
        if (dangQuetTay()) {
          setV(null);
          await ngu(NHUONG_MS, phien.signal);
          continue;
        }
        let albums: { id: string; ten: string; conLai: number }[] = [];
        try {
          const r = await fetch("/api/face-local/hang-doi", { cache: "no-store" });
          const d = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string; albums?: typeof albums };
          // Gói không có tính năng / chưa chạy SQL: thôi hẳn cho phiên này.
          if (d.error === "goi_khong_co_tinh_nang" || d.error === "thieu_bang") return;
          albums = d.ok ? d.albums ?? [] : [];
        } catch {
          albums = [];
        }
        let daXong = 0;
        for (let i = 0; i < albums.length && !phien.signal.aborted; i++) {
          if (dangQuetTay()) break;
          const a = albums[i];
          const ctrl = new AbortController();
          albumRef.current = ctrl;
          const huy = () => ctrl.abort();
          phien.signal.addEventListener("abort", huy, { once: true });
          let tong = a.conLai;
          let daQuet = 0;
          setV({ kieu: "nap", ten: a.ten, pct: 0, thuTu: i + 1, soAlbum: albums.length });
          const chayMotLuot = () => quetAlbum(a.id, {
            signal: ctrl.signal,
            nghiMs: NGHI_MS,
            tiLeNghi: TI_LE_NGHI,
            patch: (p) => {
              if (p.status) {
                tong = p.status.tong;
                daQuet = p.status.daQuet;
              }
              if (p.conLai !== undefined) daQuet = Math.max(0, tong - p.conLai);
              if (p.phase === "nap" || p.napPct !== undefined) {
                setV({ kieu: "nap", ten: a.ten, pct: p.napPct ?? 0, thuTu: i + 1, soAlbum: albums.length });
              } else if (p.phase !== "gom") {
                setV({ kieu: "quet", ten: a.ten, daQuet, tong, thuTu: i + 1, soAlbum: albums.length });
              }
            },
          });
          let { loi, status } = await chayMotLuot();
          // Còn ảnh mà không có lỗi = vài tấm hỏng TẠM (Drive 429, mạng chập chờn,
          // máy bận). Thử lại album đó MỘT lần sau ít giây, đừng bắt đợi 30 phút.
          if (!loi && status && status.conLai > 0 && !ctrl.signal.aborted) {
            await ngu(5_000, ctrl.signal);
            if (!ctrl.signal.aborted) ({ loi, status } = await chayMotLuot());
          }
          phien.signal.removeEventListener("abort", huy);
          if (status && status.conLai === 0) daXong++;
          // Trình duyệt không chạy được bộ nhận diện: album nào cũng sẽ hỏng y hệt.
          if (loi && /không chạy được bộ nhận diện/.test(loi)) {
            setV(null);
            return;
          }
        }
        albumRef.current = null;
        if (phien.signal.aborted) break;
        if (daXong > 0) {
          setV({ kieu: "xong", soAlbum: daXong });
          await ngu(8_000, phien.signal);
        }
        if (!phien.signal.aborted) setV(null);
        await ngu(HOI_LAI_MS, phien.signal);
      }
    };

    // Nhiều tab dashboard cùng mở: chỉ tab giữ khoá mới quét; các tab khác XẾP
    // HÀNG và tiếp quản khi tab kia đóng (không bỏ cuộc — bỏ cuộc thì đóng nhầm
    // tab đang quét là thôi quét cả phiên). Rời trang thì `signal` rút tên khỏi
    // hàng. Trình duyệt không có Web Locks thì cứ chạy (máy chủ bỏ qua tấm đã
    // quét, chỉ phí công).
    const locks = (navigator as Navigator & { locks?: LockManager }).locks;
    if (locks?.request) {
      locks.request(KHOA_TAB, { signal: phien.signal }, () => chay()).catch(() => {
        /* huỷ khi đang xếp hàng (rời trang) — bình thường */
      });
    } else {
      void chay();
    }

    return () => {
      boNghe();
      phien.abort();
    };
  }, [choBatDauMs]);

  const tamDung = () => {
    phienRef.current?.abort();
    setV({ kieu: "tam-dung" });
    setTimeout(() => setV(null), 6_000);
  };
  const tatHan = () => {
    try {
      localStorage.setItem(KHOA_TAT, "tat");
    } catch {
      /* không lưu được thì chỉ tắt phiên này */
    }
    phienRef.current?.abort();
    setV(null);
  };

  if (!v || an) return null;
  return <FaceAutoScanView v={v} onPause={tamDung} onDisable={tatHan} onHide={() => setAn(true)} />;
}

/** Phần hình — tách riêng để màn xem trước dựng đủ các trạng thái. */
export function FaceAutoScanView({
  v,
  onPause,
  onDisable,
  onHide,
  fixed = true,
}: {
  v: AutoScanView;
  onPause?: () => void;
  onDisable?: () => void;
  onHide?: () => void;
  fixed?: boolean;
}) {
  const pct = v.kieu === "quet" ? (v.tong > 0 ? Math.round((v.daQuet / v.tong) * 100) : 0) : v.kieu === "nap" ? v.pct : 100;
  return (
    <div
      role="status"
      aria-live="polite"
      className={`${fixed ? "fixed bottom-4 right-4 z-40" : ""} w-[300px] max-w-[calc(100vw-32px)] rounded-[12px] p-3 text-[12.5px] shadow-lg`}
      style={{ background: "var(--sf, #fff)", border: "1px solid var(--bd, #e5e7eb)", color: "var(--tx, #111)" }}
    >
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 shrink-0" style={{ color: v.kieu === "xong" ? "var(--gn, #15803d)" : "var(--ac, #2563eb)" }}>
          {v.kieu === "xong" ? <CheckCircle2 size={16} /> : v.kieu === "tam-dung" ? <Pause size={16} /> : <ScanFace size={16} />}
        </span>
        <div className="min-w-0 flex-1">
          {v.kieu === "nap" ? (
            <>
              <p className="font-semibold">Chuẩn bị quét khuôn mặt… {v.pct}%</p>
              <p className="truncate" style={{ color: "var(--tx3, #6b7280)" }}>
                Lần đầu tải bộ nhận diện (~13 MB) · {v.ten}
              </p>
            </>
          ) : v.kieu === "quet" ? (
            <>
              <p className="font-semibold">
                Đang quét khuôn mặt · {v.daQuet}/{v.tong}
              </p>
              <p className="truncate" style={{ color: "var(--tx3, #6b7280)" }}>
                {v.ten}
                {v.soAlbum > 1 ? ` · album ${v.thuTu}/${v.soAlbum}` : ""}
              </p>
            </>
          ) : v.kieu === "xong" ? (
            <p className="font-semibold">Đã quét xong khuôn mặt {v.soAlbum > 1 ? `${v.soAlbum} album` : "album"} — khách tìm được ảnh của mình.</p>
          ) : (
            <p className="font-semibold">Đã tạm dừng tự quét. Lần sau mở dashboard sẽ quét tiếp.</p>
          )}
          {(v.kieu === "nap" || v.kieu === "quet") && (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--sf2, #f3f4f6)" }}>
              <div className="h-full rounded-full transition-[width]" style={{ width: `${pct}%`, background: "var(--ac, #2563eb)" }} />
            </div>
          )}
          {(v.kieu === "nap" || v.kieu === "quet") && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              <button type="button" onClick={onPause} className="inline-flex items-center gap-1 font-medium" style={{ color: "var(--ac, #2563eb)" }}>
                <Pause size={12} /> Tạm dừng
              </button>
              <button type="button" onClick={onDisable} className="font-medium" style={{ color: "var(--tx3, #6b7280)" }}>
                Tắt tự quét trên máy này
              </button>
            </div>
          )}
        </div>
        {v.kieu !== "tam-dung" && onHide && (
          <button type="button" onClick={onHide} aria-label="Ẩn" className="shrink-0" style={{ color: "var(--tx3, #6b7280)" }}>
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

/** Bật lại tự quét trên máy này (gọi từ thẻ quét trong trang album). */
export function batLaiTuQuet(): void {
  try {
    localStorage.removeItem(KHOA_TAT);
  } catch {
    /* bỏ qua */
  }
}
export function tuQuetDangTat(): boolean {
  try {
    return localStorage.getItem(KHOA_TAT) === "tat";
  } catch {
    return false;
  }
}
