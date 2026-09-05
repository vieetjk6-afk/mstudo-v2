"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight, Columns2, Square, ZoomIn, Loader2, Check } from "lucide-react";
import { makeOnePreview, makePixelCrop, type ScanItem } from "@/lib/photo-ai-scan";

/* ═══════════════════════════════════════════════════════════════════════════
   KHUNG SO SÁNH — xem ảnh đủ lớn để CHỌN, không chỉ để biết.

   Bảng kết quả của bộ lọc AI vẽ ảnh ở cỡ ô vuông nhỏ. Cỡ đó đủ để nhận ra "đây
   là một chuỗi bấm liên tiếp", nhưng KHÔNG đủ để trả lời câu hỏi duy nhất mà
   người ngồi đây phải trả lời: trong bảy tấm gần như giống hệt nhau này, giữ tấm
   nào. Hai tấm cách nhau 1/8 giây thì ở cỡ 128px chúng là một.

   Nên khung này có ba nấc, và cả ba đều cần thiết:

     1. MỘT ẢNH LỚN — thấy bố cục, biểu cảm, ai nhắm mắt.
     2. HAI ẢNH CẠNH NHAU — so tấm đang xem với BẢN ĐỀ XUẤT của chuỗi. Đây là
        câu hỏi thật: "bản máy chọn có hơn tấm tôi thích không?"
     3. CẮT 1:1 ĐIỂM ẢNH GỐC — nấc quyết định. Thu về màn hình thì hai tấm trong
        một chuỗi trông y hệt; độ nét chỉ hiện ra ở tỉ lệ 100%, đúng cách người
        ta soi ảnh trong Lightroom. Ở chế độ hai ảnh, CẢ HAI cắt cùng một điểm —
        so hai chỗ khác nhau trên hai tấm thì không kết luận được gì.

   Ảnh lớn và ô cắt đều giải mã ĐÚNG LÚC MỞ rồi nhớ lại (`bigRef`/`cropRef`), chứ
   không dựng sẵn cho cả lô: một lô 3.000 tấm mà giữ sẵn ảnh 1600px là vài GB.
   ═══════════════════════════════════════════════════════════════════════════ */

export type CompareFrame = {
  key: string;
  name: string;
  /** Nhãn kết luận ("Nên loại", "Trùng"…) và màu của nó. */
  label: string;
  color: string;
  soft: string;
  reason: string;
  sharpness: number;
  /** Tấm này là bản đề xuất của chuỗi. */
  keeper: boolean;
  /** Tấm này đang nằm trong danh sách đề nghị loại (có ô tick để bỏ). */
  inRemoveList: boolean;
};

/** Cạnh ô cắt 1:1, tính bằng điểm ảnh GỐC. */
const CROP_EDGE = 520;

export default function AiCompareView({
  frames,
  index,
  itemOf,
  thumbs,
  excluded,
  onToggle,
  onIndex,
  onClose,
}: {
  /** Các tấm cùng một chuỗi (hoặc cùng một danh sách) để lật qua lại. */
  frames: CompareFrame[];
  index: number;
  itemOf: (key: string) => ScanItem | undefined;
  /** Ảnh nhỏ đã có sẵn của bảng kết quả — dùng cho dải ảnh dưới đáy, để một ô
   *  44px không phải chờ giải mã lại một tấm 1600px. */
  thumbs: Record<string, string>;
  excluded: ReadonlySet<string>;
  onToggle: (key: string) => void;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const [twoUp, setTwoUp] = useState(false);
  const [peek, setPeek] = useState(false);
  // Điểm soi, theo tỉ lệ 0…1 của ảnh. Mặc định giữa khung — chỗ chủ thể hay nằm.
  const [focus, setFocus] = useState({ cx: 0.5, cy: 0.5 });
  // Kho ảnh nằm trong ref (không phải state) vì nó bị thay đổi tại chỗ; biến này
  // chỉ để buộc vẽ lại sau mỗi lượt giải mã xong.
  const [, setTick] = useState(0);

  const cur = frames[index];
  // Bản đề xuất của chuỗi để đặt cạnh. Tấm đang xem CHÍNH LÀ bản đề xuất thì so
  // với tấm liền trước (hoặc liền sau nếu nó đứng đầu) — so một tấm với chính nó
  // là một ô trống vô nghĩa.
  const other = useMemo(() => {
    if (!cur) return null;
    const keeper = frames.find((f) => f.keeper);
    if (keeper && keeper.key !== cur.key) return keeper;
    if (frames.length < 2) return null;
    return index > 0 ? frames[index - 1] : frames[1];
  }, [frames, cur, index]);

  // ── Kho ảnh đã giải mã ────────────────────────────────────────────────────
  const bigRef = useRef(new Map<string, { url: string; width: number; height: number }>());
  const cropRef = useRef(new Map<string, { url: string; native: boolean }>());
  const pending = useRef(new Set<string>());
  // Khung đã đóng thì lượt giải mã đang chạy dở KHÔNG được ghi vào kho nữa: dọn
  // dẹp đã chạy xong rồi, nên object URL ghi thêm sau đó không ai thu hồi.
  const alive = useRef(true);
  // Tấm giải mã HỎNG. Không có tập này thì ô ảnh quay vòng tròn mãi mãi và
  // người dùng không biết là đang chờ hay là hỏng.
  const failed = useRef(new Set<string>());

  // Thu hồi MỌI object URL khi đóng khung. Không có phần này là rò bộ nhớ cho
  // tới lúc tải lại trang — mỗi lần mở một chuỗi là thêm vài chục MB.
  useEffect(() => {
    // PHẢI đặt lại `true` ở ĐẦU effect, không chỉ ở lần khai báo ref. React
    // StrictMode (bản dev) chạy mount → cleanup → mount: lượt cleanup đầu đặt cờ
    // về false, mà ref sống xuyên qua lần mount thứ hai — nên nếu không đặt lại
    // thì MỌI lượt giải mã sau đó đều bị vứt đi và khung so sánh quay vòng tròn
    // mãi mãi. Đúng lỗi này đã xảy ra và chỉ lộ ra khi mở màn thật.
    alive.current = true;
    return () => {
      alive.current = false;
      for (const v of bigRef.current.values()) URL.revokeObjectURL(v.url);
      for (const v of cropRef.current.values()) URL.revokeObjectURL(v.url);
      bigRef.current.clear();
      cropRef.current.clear();
      failed.current.clear();
    };
  }, []);

  const wantBig = useCallback(
    (key: string) => {
      if (bigRef.current.has(key) || pending.current.has(`b:${key}`)) return;
      const item = itemOf(key);
      if (!item) return;
      pending.current.add(`b:${key}`);
      makeOnePreview(item)
        .then((v) => {
          if (!alive.current) return URL.revokeObjectURL(v.url);
          bigRef.current.set(key, v);
          setTick((t) => t + 1);
        })
        .catch(() => {
          failed.current.add(`b:${key}`);
          setTick((t) => t + 1);
        })
        .finally(() => pending.current.delete(`b:${key}`));
    },
    [itemOf]
  );

  // Khoá kho ô cắt gồm CẢ điểm soi: đổi chỗ soi là một ô cắt khác, không phải
  // cùng một ảnh — dùng chung khoá thì soi chỗ mới vẫn hiện ô cắt chỗ cũ.
  const cropKey = useCallback(
    (key: string) => `${key}@${focus.cx.toFixed(3)},${focus.cy.toFixed(3)}`,
    [focus]
  );

  const wantCrop = useCallback(
    (key: string) => {
      const ck = cropKey(key);
      if (cropRef.current.has(ck) || pending.current.has(`c:${ck}`)) return;
      const item = itemOf(key);
      if (!item) return;
      pending.current.add(`c:${ck}`);
      makePixelCrop(item, focus.cx, focus.cy, CROP_EDGE)
        .then((v) => {
          if (!alive.current) return URL.revokeObjectURL(v.url);
          cropRef.current.set(ck, { url: v.url, native: v.native });
          setTick((t) => t + 1);
        })
        .catch(() => {
          failed.current.add(`c:${ck}`);
          setTick((t) => t + 1);
        })
        .finally(() => pending.current.delete(`c:${ck}`));
    },
    [itemOf, focus, cropKey]
  );

  // Nạp đúng những gì đang vẽ. Thêm một tấm ở hai bên để bấm mũi tên không phải
  // chờ — chuỗi bấm thường được lật qua lại nhiều lần chứ không xem một lượt.
  useEffect(() => {
    if (!cur) return;
    if (peek) {
      wantCrop(cur.key);
      if (twoUp && other) wantCrop(other.key);
      return;
    }
    wantBig(cur.key);
    if (twoUp && other) wantBig(other.key);
    if (frames[index - 1]) wantBig(frames[index - 1].key);
    if (frames[index + 1]) wantBig(frames[index + 1].key);
  }, [cur, other, index, frames, peek, twoUp, wantBig, wantCrop]);

  // ── Phím tắt ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return onClose();
      if (e.key === "ArrowLeft") return onIndex(Math.max(0, index - 1));
      if (e.key === "ArrowRight") return onIndex(Math.min(frames.length - 1, index + 1));
      if (e.key === "c" || e.key === "C") return setTwoUp((v) => !v);
      if (e.key === "z" || e.key === "Z") return setPeek((v) => !v);
      if (e.key === " " && cur?.inRemoveList) {
        e.preventDefault();
        onToggle(cur.key);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, frames.length, cur, onClose, onIndex, onToggle]);

  if (!cur) return null;

  /** Bấm vào ảnh = đặt điểm soi ở đúng chỗ đó rồi bật cắt 1:1. */
  const pickFocus = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const img = bigRef.current.get(cur.key);
    if (!img || r.width === 0 || r.height === 0) return;
    // Ảnh vẽ theo `object-contain` nên có viền trống hai bên; phải quy toạ độ về
    // KHUNG ẢNH THẬT, nếu không bấm vào viền sẽ soi nhầm chỗ.
    const scale = Math.min(r.width / img.width, r.height / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    const x = (e.clientX - r.left - (r.width - dw) / 2) / dw;
    const y = (e.clientY - r.top - (r.height - dh) / 2) / dh;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    setFocus({ cx: x, cy: y });
    setPeek(true);
  };

  const pane = (f: CompareFrame, primary: boolean) => {
    const big = bigRef.current.get(f.key);
    const crop = peek ? cropRef.current.get(cropKey(f.key)) : null;
    const src = peek ? crop?.url : big?.url;
    const broke = failed.current.has(peek ? `c:${cropKey(f.key)}` : `b:${f.key}`);
    return (
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          className={`relative flex min-h-0 flex-1 items-center justify-center overflow-hidden ${primary ? (peek ? "cursor-zoom-out" : "cursor-zoom-in") : ""}`}
          onClick={primary ? (peek ? () => setPeek(false) : pickFocus) : undefined}
        >
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={f.name}
              className="max-h-full max-w-full"
              style={{ objectFit: "contain", imageRendering: peek ? "pixelated" : "auto" }}
            />
          ) : broke ? (
            <p className="px-4 text-center text-[12.5px]" style={{ color: "#c08" }}>
              Không mở được tấm này ở cỡ lớn.
            </p>
          ) : (
            <Loader2 size={26} className="animate-spin" style={{ color: "#888" }} />
          )}
          {f.keeper && (
            <span
              className="absolute left-2 top-2 rounded-[6px] px-2 py-0.5 text-[11px] font-bold"
              style={{ background: "var(--gn, #1e9e72)", color: "#fff" }}
            >
              Bản đề xuất
            </span>
          )}
        </div>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-2 py-1.5 text-[11.5px]" style={{ color: "#ccc" }}>
          <span className="truncate font-semibold" style={{ color: "#fff" }}>{f.name}</span>
          <span className="tnum">nét {Math.round(f.sharpness)}</span>
          {peek && crop && !crop.native && <span style={{ color: "#e0a944" }}>· nguồn đã thu nhỏ, không phải 1:1 thật</span>}
        </p>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[120] flex flex-col" style={{ background: "#0c0c0e" }}>
      {/* ── Thanh trên ─────────────────────────────────────────────────── */}
      <div className="flex flex-none flex-wrap items-center gap-2 px-3 py-2.5">
        <span
          className="rounded-full px-2.5 py-0.5 text-[11.5px] font-bold"
          style={{ background: cur.soft, color: cur.color }}
        >
          {cur.keeper ? "Nên giữ" : cur.label}
        </span>
        <span className="min-w-0 flex-1 truncate text-[12.5px]" style={{ color: "#bbb" }}>{cur.reason}</span>

        <button
          onClick={() => setTwoUp((v) => !v)}
          disabled={!other}
          className="flex items-center gap-1.5 rounded-[9px] px-2.5 py-1.5 text-[12px] font-semibold disabled:opacity-40"
          style={{ background: twoUp ? "var(--ac, #a9740a)" : "rgba(255,255,255,.12)", color: "#fff" }}
          title="Phím C"
        >
          {twoUp ? <Square size={14} /> : <Columns2 size={14} />}
          {twoUp ? "Một ảnh" : "So 2 ảnh"}
        </button>
        <button
          onClick={() => setPeek((v) => !v)}
          className="flex items-center gap-1.5 rounded-[9px] px-2.5 py-1.5 text-[12px] font-semibold"
          style={{ background: peek ? "var(--ac, #a9740a)" : "rgba(255,255,255,.12)", color: "#fff" }}
          title="Phím Z — bấm vào ảnh để chọn chỗ soi"
        >
          <ZoomIn size={14} /> {peek ? "Đang soi 1:1" : "Soi 1:1"}
        </button>
        <button
          onClick={onClose}
          aria-label="Đóng"
          className="flex h-8 w-8 items-center justify-center rounded-full"
          style={{ background: "rgba(255,255,255,.12)", color: "#fff" }}
        >
          <X size={16} />
        </button>
      </div>

      {/* ── Ảnh ────────────────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 items-stretch gap-2 px-3">
        <button
          onClick={() => onIndex(Math.max(0, index - 1))}
          disabled={index === 0}
          aria-label="Ảnh trước"
          className="my-auto flex h-10 w-10 flex-none items-center justify-center rounded-full disabled:opacity-25"
          style={{ background: "rgba(255,255,255,.12)", color: "#fff" }}
        >
          <ChevronLeft size={20} />
        </button>

        {/* Xếp CHỒNG trên điện thoại, CẠNH NHAU từ 640px: hai tấm cạnh nhau trên
            màn 390px thì mỗi tấm còn chưa tới 180px — hẹp hơn cả ô ảnh mà khung
            này sinh ra để thay thế. */}
        <div className="flex min-h-0 flex-1 flex-col gap-2 sm:flex-row">
          {pane(cur, true)}
          {twoUp && other && (
            <>
              <div className="h-px w-full flex-none sm:h-auto sm:w-px" style={{ background: "rgba(255,255,255,.15)" }} />
              {pane(other, false)}
            </>
          )}
        </div>

        <button
          onClick={() => onIndex(Math.min(frames.length - 1, index + 1))}
          disabled={index >= frames.length - 1}
          aria-label="Ảnh sau"
          className="my-auto flex h-10 w-10 flex-none items-center justify-center rounded-full disabled:opacity-25"
          style={{ background: "rgba(255,255,255,.12)", color: "#fff" }}
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {!peek && (
        <p className="flex-none px-3 pt-1.5 text-center text-[11px]" style={{ color: "#777" }}>
          Bấm vào ảnh để soi 1:1 đúng chỗ đó · ← → đổi ảnh · C so 2 ảnh · Z soi · Space bỏ khỏi danh sách loại
        </p>
      )}

      {/* ── Dải ảnh + ô tick ───────────────────────────────────────────── */}
      <div className="flex flex-none flex-wrap items-center gap-2 px-3 py-2.5">
        {cur.inRemoveList && (
          <label
            className="flex cursor-pointer items-center gap-1.5 rounded-[9px] px-2.5 py-1.5 text-[12px] font-semibold"
            style={{ background: excluded.has(cur.key) ? "rgba(255,255,255,.12)" : "var(--rd, #c0392b)", color: "#fff" }}
          >
            <input
              type="checkbox"
              className="sr-only"
              checked={!excluded.has(cur.key)}
              onChange={() => onToggle(cur.key)}
            />
            {excluded.has(cur.key) ? <Square size={14} /> : <Check size={14} />}
            {excluded.has(cur.key) ? "Đã bỏ khỏi danh sách loại" : "Đang trong danh sách loại"}
          </label>
        )}
        <span className="tnum text-[12px]" style={{ color: "#999" }}>
          {index + 1}/{frames.length}
        </span>
        <div className="ml-auto flex max-w-full gap-1.5 overflow-x-auto">
          {frames.map((f, i) => (
            <button
              key={f.key}
              onClick={() => onIndex(i)}
              aria-label={f.name}
              className="h-11 w-11 flex-none overflow-hidden rounded-[6px]"
              style={{
                border: i === index ? "2px solid #fff" : f.keeper ? "2px solid var(--gn, #1e9e72)" : "2px solid transparent",
                opacity: excluded.has(f.key) ? 0.4 : 1,
                background: "rgba(255,255,255,.08)",
              }}
            >
              {thumbs[f.key] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumbs[f.key]} alt="" className="h-full w-full object-cover" />
              ) : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
