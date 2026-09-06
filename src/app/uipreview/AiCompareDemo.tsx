"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AiCompareView, { type CompareFrame } from "@/components/AiCompareView";
import type { ScanItem } from "@/lib/photo-ai-scan";

/* ═══════════════════════════════════════════════════════════════════════════
   XEM TRƯỚC KHUNG SO SÁNH ẢNH.

   Khung so sánh (@/components/AiCompareView) là màn KHÓ MỞ nhất của bộ lọc ảnh:
   phải đăng nhập studio, mở công cụ Lọc ảnh, trỏ vào một thư mục có sẵn một
   chuỗi bấm liên tiếp, quét xong rồi mới bấm được vào một tấm. Sửa một dòng CSS
   ở đó mà phải đi lại cả quãng ấy thì sẽ không ai sửa.

   Nên ảnh mẫu ở đây được SINH RA bằng số học ngay trong trình duyệt — không thêm
   file ảnh nào vào repo. Bốn tấm cùng một "cảnh", khác nhau đúng thứ mà khung
   này sinh ra để phân biệt: ĐỘ NÉT. Ba tấm bị làm mờ ở ba mức, một tấm nét
   nguyên. Ở cỡ ô nhỏ chúng trông y hệt nhau; chỉ khi soi 1:1 mới thấy khác —
   đó chính là điều cần kiểm.
   ═══════════════════════════════════════════════════════════════════════════ */

const W = 1400;
const H = 900;

/** Một "cảnh" có cạnh sắc và chi tiết mảnh, làm mờ `blurPx` để giả ảnh lấy nét trượt. */
function scene(blurPx: number): string {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;

  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#25384f");
  sky.addColorStop(1, "#c9a97a");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Chi tiết tần số cao — thứ duy nhất phép làm mờ ăn mất, và cũng là thứ mắt
  // dùng để chấm "tấm nào nét hơn".
  ctx.filter = blurPx > 0 ? `blur(${blurPx}px)` : "none";
  ctx.strokeStyle = "rgba(255,255,255,.55)";
  ctx.lineWidth = 1;
  for (let x = 120; x < W - 120; x += 7) {
    ctx.beginPath();
    ctx.moveTo(x, 300);
    ctx.lineTo(x, 620);
    ctx.stroke();
  }
  ctx.fillStyle = "#f3ede2";
  ctx.beginPath();
  ctx.arc(W * 0.3, H * 0.45, 96, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1d2530";
  ctx.fillRect(W * 0.62, H * 0.28, 230, 330);
  ctx.font = "bold 54px system-ui, sans-serif";
  ctx.fillStyle = "#fff";
  ctx.fillText("mstudo", W * 0.64, H * 0.5);
  ctx.filter = "none";

  return c.toDataURL("image/jpeg", 0.92);
}

const FRAMES: Omit<CompareFrame, "keeper">[] = [
  { key: "f1", name: "DSC_4471.JPG", label: "Trùng", color: "var(--tx2)", soft: "var(--sf2)", reason: "Trùng với DSC_4472 — bản này kém nét hơn.", sharpness: 118, inRemoveList: true },
  { key: "f2", name: "DSC_4472.JPG", label: "Giữ", color: "var(--gn)", soft: "var(--gnS)", reason: "Bản nét nhất của chuỗi 3 tấm.", sharpness: 742, inRemoveList: false },
  { key: "f3", name: "DSC_4473.JPG", label: "Trùng", color: "var(--tx2)", soft: "var(--sf2)", reason: "Trùng với DSC_4472 — bản này kém nét hơn.", sharpness: 291, inRemoveList: true },
  { key: "f4", name: "DSC_4474.JPG", label: "Nên loại", color: "var(--rd)", soft: "var(--rdS)", reason: "Điểm nét 41, dưới 35% trung vị của lô (742).", sharpness: 41, inRemoveList: true },
];
const BLUR = [3, 0, 1.4, 7];

export default function AiCompareDemo() {
  const [urls, setUrls] = useState<string[] | null>(null);
  const [at, setAt] = useState<number | null>(null);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  useEffect(() => {
    setUrls(BLUR.map((b) => scene(b)));
  }, []);

  const items = useMemo<ScanItem[]>(
    () => (urls ?? []).map((u, i) => ({ key: FRAMES[i].key, name: FRAMES[i].name, url: u })),
    [urls]
  );
  const frames = useMemo<CompareFrame[]>(
    () => FRAMES.map((f) => ({ ...f, keeper: f.key === "f2" })),
    []
  );
  const thumbs = useMemo(
    () => Object.fromEntries((urls ?? []).map((u, i) => [FRAMES[i].key, u])),
    [urls]
  );

  // Hàm ổn định: khung so sánh nạp ảnh trong một effect phụ thuộc vào nó, nên
  // một arrow dựng lại mỗi lần vẽ sẽ bắt effect ấy chạy lại liên tục.
  const itemOf = useCallback((k: string) => items.find((i) => i.key === k), [items]);

  if (!urls) return <p className="text-[13px]">Đang sinh ảnh mẫu…</p>;

  return (
    <div>
      <p className="mb-3 text-[12.5px]" style={{ color: "var(--tx2)" }}>
        Bốn tấm cùng một cảnh, khác nhau ở <b>độ nét</b>. Bấm một tấm để mở khung so sánh: <b>C</b> đặt
        cạnh bản đề xuất, <b>Z</b> (hoặc bấm vào ảnh) soi 1:1 điểm ảnh gốc, <b>← →</b> đổi tấm.
      </p>
      <div className="flex flex-wrap gap-2">
        {urls.map((u, i) => (
          <button
            key={FRAMES[i].key}
            onClick={() => setAt(i)}
            className="w-[190px] overflow-hidden rounded-[9px]"
            style={{ border: `2px solid ${i === 1 ? "var(--gn)" : "var(--bd)"}` }}
          >
            <img src={u} alt={FRAMES[i].name} className="aspect-square w-full object-cover" />
            <span className="block px-1.5 py-1 text-left text-[10.5px] font-semibold">{FRAMES[i].name}</span>
          </button>
        ))}
      </div>

      {at !== null && (
        <AiCompareView
          frames={frames}
          index={at}
          itemOf={itemOf}
          thumbs={thumbs}
          excluded={excluded}
          onToggle={(k) =>
            setExcluded((p) => {
              const n = new Set(p);
              if (n.has(k)) n.delete(k);
              else n.add(k);
              return n;
            })
          }
          onIndex={setAt}
          onClose={() => setAt(null)}
        />
      )}
    </div>
  );
}
