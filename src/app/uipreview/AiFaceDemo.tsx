"use client";

import { useCallback, useEffect, useState } from "react";
import { detectOne, faceScanSupported, loadFaceModel } from "@/lib/face-detect";
import { judgeFaces } from "@/lib/face-ai";

/* ═══════════════════════════════════════════════════════════════════════════
   XEM TRƯỚC BỘ NHẬN DIỆN KHUÔN MẶT — và cũng là bài kiểm tra ĐẦU-CUỐI của nó.

   Phần luật (@/lib/face-ai) đã có 58 ca kiểm thử bằng node trên dữ liệu dựng
   sẵn. Nhưng chúng không trả lời được câu quan trọng nhất: mô hình có TẢI VỀ và
   CHẠY được trong đúng cấu hình của repo này không — WASM tự phục vụ từ
   `/mediapipe`, mô hình từ storage.googleapis.com, CSP chỉ cho `script-src
   'self'`. Sai một mắt xích ở đó thì bộ nhận diện im lặng không khởi động và
   mọi kiểm thử đơn vị vẫn xanh.

   Nên màn này vẽ MỘT KHUÔN MẶT bằng canvas rồi cho chạy qua đúng `detectOne()`
   của code thật. Vẽ hai bản — mắt mở và mắt nhắm — vì con số đáng giá nhất của
   cả tính năng là blendshape `eyeBlink`: nếu nó không phân biệt được hai bản
   này thì luật "ưu tiên tấm mắt mở" không dựa vào đâu cả.

   Mặt vẽ bằng hình học nên KHÔNG phải mặt người thật: mô hình có thể không bắt
   được, và điều đó tự nó không có nghĩa là tính năng hỏng. Vì vậy màn này in ra
   SỐ ĐO thô thay vì phán "đạt/không đạt" — người đọc tự kết luận.
   ═══════════════════════════════════════════════════════════════════════════ */

const W = 900;
const H = 900;

/** Vẽ một khuôn mặt chính diện. `closed` = mí mắt khép. */
function drawFace(closed: boolean): string {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const cx = W / 2;
  const cy = H / 2;

  g.fillStyle = "#6d7b88";
  g.fillRect(0, 0, W, H);

  // Tóc (khối tối sau đầu) — bộ dò khuôn mặt bám vào tương phản viền đầu.
  g.fillStyle = "#2b2118";
  g.beginPath();
  g.ellipse(cx, cy - 30, 250, 310, 0, 0, Math.PI * 2);
  g.fill();

  // Cổ + mặt.
  g.fillStyle = "#e6b98f";
  g.fillRect(cx - 80, cy + 180, 160, 200);
  g.beginPath();
  g.ellipse(cx, cy, 195, 255, 0, 0, Math.PI * 2);
  g.fill();

  // Bóng hai bên má cho khối nổi lên.
  const sh = g.createRadialGradient(cx, cy, 60, cx, cy, 230);
  sh.addColorStop(0, "rgba(0,0,0,0)");
  sh.addColorStop(1, "rgba(0,0,0,.32)");
  g.fillStyle = sh;
  g.beginPath();
  g.ellipse(cx, cy, 195, 255, 0, 0, Math.PI * 2);
  g.fill();

  // Lông mày.
  g.strokeStyle = "#3a2c20";
  g.lineWidth = 14;
  g.lineCap = "round";
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(cx + s * 40, cy - 92);
    g.quadraticCurveTo(cx + s * 78, cy - 110, cx + s * 112, cy - 88);
    g.stroke();
  }

  // Mắt.
  for (const s of [-1, 1]) {
    const ex = cx + s * 76;
    const ey = cy - 34;
    if (closed) {
      g.strokeStyle = "#2c2119";
      g.lineWidth = 8;
      g.beginPath();
      g.moveTo(ex - 40, ey);
      g.quadraticCurveTo(ex, ey + 16, ex + 40, ey);
      g.stroke();
    } else {
      g.fillStyle = "#fdfaf5";
      g.beginPath();
      g.ellipse(ex, ey, 42, 23, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#4a3a2a";
      g.beginPath();
      g.arc(ex, ey, 19, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#100c08";
      g.beginPath();
      g.arc(ex, ey, 9, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "#2c2119";
      g.lineWidth = 6;
      g.beginPath();
      g.ellipse(ex, ey, 42, 23, 0, 0, Math.PI * 2);
      g.stroke();
    }
  }

  // Mũi.
  g.strokeStyle = "rgba(90,60,40,.75)";
  g.lineWidth = 7;
  g.beginPath();
  g.moveTo(cx - 4, cy - 12);
  g.lineTo(cx - 20, cy + 58);
  g.quadraticCurveTo(cx, cy + 76, cx + 20, cy + 58);
  g.stroke();

  // Miệng.
  g.strokeStyle = "#8d4a45";
  g.lineWidth = 12;
  g.beginPath();
  g.moveTo(cx - 62, cy + 122);
  g.quadraticCurveTo(cx, cy + 162, cx + 62, cy + 122);
  g.stroke();

  return c.toDataURL("image/jpeg", 0.95);
}

type Row = { label: string; url: string; text: string };

export default function AiFaceDemo() {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Hỏi trong effect, không hỏi lúc dựng — xem ghi chú cùng nội dung ở
  // AiFilterPanel: React 18 không sửa lệch THUỘC TÍNH khi hydrate.
  const [can, setCan] = useState(false);
  useEffect(() => setCan(faceScanSupported()), []);

  const run = useCallback(async () => {
    setBusy(true);
    setErr(null);
    setRows([]);
    try {
      const model = await loadFaceModel();
      const out: Row[] = [];
      for (const [label, closed] of [
        ["Mắt mở", false],
        ["Mắt nhắm", true],
      ] as const) {
        const url = drawFace(closed);
        const m = await detectOne(model, { key: label, name: `${label}.jpg`, url }, 0);
        const j = judgeFaces(m);
        out.push({
          label,
          url,
          text:
            `${m.faces.length} mặt · nhắm ${m.faces.map((f) => f.blink.toFixed(3)).join(", ") || "—"}` +
            ` · nét mặt ${m.faces.map((f) => Math.round(f.sharpness)).join(", ") || "—"}` +
            ` · nét khung ${Math.round(m.frameSharpness)} → ${j.verdict}`,
        });
      }
      setRows(out);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "hỏng");
    }
    setBusy(false);
  }, []);

  return (
    <div>
      <p className="mb-3 text-[12.5px]" style={{ color: "var(--tx2)" }}>
        Vẽ hai khuôn mặt bằng canvas rồi cho chạy qua đúng <code>detectOne()</code> của code thật — để kiểm
        rằng mô hình tải được trong đúng cấu hình CSP của repo, và blendshape <code>eyeBlink</code> phân biệt
        được mắt mở với mắt nhắm.
      </p>
      <button
        onClick={run}
        disabled={busy || !can}
        className="rounded-[10px] px-3.5 py-2 text-[13px] font-bold disabled:opacity-60"
        style={{ background: "var(--ac)", color: "#fff" }}
      >
        {busy ? "Đang tải mô hình & nhận diện…" : "Chạy thử bộ nhận diện"}
      </button>
      {err && (
        <p className="mt-3 text-[12.5px] font-semibold" data-testid="face-error" style={{ color: "var(--rd)" }}>
          Lỗi: {err}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-3">
        {rows.map((r) => (
          <div key={r.label} className="w-[260px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={r.url} alt={r.label} className="w-full rounded-[9px]" />
            <p className="mt-1 text-[11.5px] font-semibold">{r.label}</p>
            <p className="text-[11px]" data-testid={`face-${r.label === "Mắt mở" ? "open" : "closed"}`} style={{ color: "var(--tx3)" }}>
              {r.text}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
