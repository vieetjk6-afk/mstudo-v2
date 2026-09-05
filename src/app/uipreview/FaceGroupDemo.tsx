"use client";

import { useCallback, useEffect, useState } from "react";
import { loadFaceModel, detectFull, faceScanSupported } from "@/lib/face-detect";
import { embedFace, loadRecognizer } from "@/lib/face-embed";
import { euclidean, groupFaces, type FaceVector } from "@/lib/face-group";
import { draw, IDENTITIES as PEOPLE, VARIANTS } from "./veMatNguoi";

/* ═══════════════════════════════════════════════════════════════════════════
   XEM TRƯỚC — và KIỂM CHỨNG — việc gom ảnh theo từng người.

   Đây là phần rủi ro nhất của cả tính năng, và rủi ro không nằm ở chỗ "code có
   chạy không". Nó nằm ở chỗ: mô hình nhận dạng có THẬT SỰ tách được người này
   với người kia không, và ngưỡng gom cụm ở @/lib/face-group có nằm đúng giữa hai
   phân bố không. Sai chỗ đó thì mọi thứ vẫn chạy trơn tru và cho ra kết quả sai
   — mục "ảnh của cô dâu" có ảnh người lạ, và đó là kiểu hỏng tệ nhất.

   Nên màn này vẽ BỐN "người" khác nhau về hình học khuôn mặt (khoảng cách mắt,
   bề ngang mặt, độ dài mũi, bề rộng miệng, tông da, kiểu tóc), mỗi người BA biến
   thể (nét mặt, nghiêng đầu, độ sáng) — rồi cho chạy qua đúng đường mà code thật
   đi: MediaPipe tìm mặt → căn chỉnh theo hai mắt → mạng 128 chiều → gom cụm.

   Rồi in ra ba con số quyết định:
     • độ giống TRUNG BÌNH giữa hai ảnh CÙNG người,
     • độ giống TRUNG BÌNH giữa hai người KHÁC nhau,
     • và lượt gom có khôi phục đúng bốn người không.

   Mặt vẽ bằng hình học nên KHÔNG phải mặt người thật — kết quả ở đây là bằng
   chứng đường ống chạy đúng, KHÔNG phải thước đo độ chính xác trên ảnh cưới
   thật. Màn này in số thô để người đọc tự kết luận, không tự phán "đạt".
   ═══════════════════════════════════════════════════════════════════════════ */

type Shot = { id: string; person: string; label: string; url: string };

export default function FaceGroupDemo() {
  const [busy, setBusy] = useState(false);
  const [shots, setShots] = useState<Shot[]>([]);
  const [report, setReport] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [can, setCan] = useState(false);
  useEffect(() => setCan(faceScanSupported()), []);

  const run = useCallback(async () => {
    setBusy(true);
    setErr(null);
    setReport(null);
    try {
      const list: Shot[] = [];
      for (const p of PEOPLE) {
        for (const v of VARIANTS) list.push({ id: `${p.name}-${v.label}`, person: p.name, label: v.label, url: draw(p, v) });
      }
      setShots(list);

      const detector = await loadFaceModel();
      const recog = await loadRecognizer();

      const vecs: (FaceVector & { person: string })[] = [];
      const missed: string[] = [];
      for (let i = 0; i < list.length; i++) {
        const s = list[i];
        const full = await detectFull(detector, { key: s.id, name: s.id, url: s.url }, i);
        const lm = full.landmarks[0];
        const face = full.metrics.faces[0];
        if (!lm || !face) {
          missed.push(s.id);
          continue;
        }
        const v = await embedFace(recog, full.canvas, full.width, full.height, lm);
        if (!v) {
          missed.push(s.id);
          continue;
        }
        vecs.push({ key: s.id, at: 0, v, area: face.box.w * face.box.h, sharpness: face.sharpness, person: s.person });
      }

      // Hai phân bố độ giống — con số quyết định của cả tính năng.
      let sameSum = 0, sameN = 0, sameMax = 0;
      let diffSum = 0, diffN = 0, diffMin = Infinity;
      for (let i = 0; i < vecs.length; i++) {
        for (let j = i + 1; j < vecs.length; j++) {
          const d = euclidean(vecs[i].v, vecs[j].v);
          if (vecs[i].person === vecs[j].person) {
            sameSum += d; sameN++; sameMax = Math.max(sameMax, d);
          } else {
            diffSum += d; diffN++; diffMin = Math.min(diffMin, d);
          }
        }
      }

      // Gom cụm ở ngưỡng ĐẶT GIỮA KHE vừa đo, KHÔNG dùng ngưỡng mặc định 0,6.
      //
      // Đây là chỗ dễ rút ra kết luận sai nhất. Mặt vẽ bằng hình học đều một kiểu
      // nên khoảng cách giữa hai "người" ở đây (≈0,3) NHỎ HƠN cả khoảng cách giữa
      // hai ảnh cùng một người thật — chúng nằm ngoài phân bố mà mạng được huấn
      // luyện. Vậy nên bài này KHÔNG hiệu chỉnh được ngưỡng, và ép nó chạy ở 0,6
      // rồi kết luận "gom sai" là kết luận về ẢNH VẼ, không phải về thuật toán.
      //
      // Cái bài này kiểm được — và là cái duy nhất nó có quyền kiểm — là: hai
      // phân bố có TÁCH RỜI nhau không, và khi có một ngưỡng nằm trong khe đó
      // thì thuật toán gom có khôi phục đúng từng người không.
      const mid = (sameMax + diffMin) / 2;
      const g = groupFaces(vecs, { minFaces: 2, maxDistance: mid });
      const clusters = g.people.map((p) => {
        const names = p.photoKeys.map((k) => vecs.find((v) => v.key === k)?.person ?? "?");
        return `${p.photoKeys.length} ảnh [${names.join(",")}]`;
      });
      // Gom ĐÚNG = mỗi cụm chỉ một người, và đủ bốn người, không ai bị bỏ rơi.
      const pure = g.people.every((p) => new Set(p.photoKeys.map((k) => vecs.find((v) => v.key === k)?.person)).size === 1);
      const covered = new Set(g.people.flatMap((p) => p.photoKeys.map((k) => vecs.find((v) => v.key === k)?.person))).size;

      setReport(
        [
          `vector ${vecs.length}/${list.length}${missed.length ? ` (hụt: ${missed.join(", ")})` : ""}`,
          `cùng người — khoảng cách: tb ${(sameSum / (sameN || 1)).toFixed(3)} · XA nhất ${sameMax.toFixed(3)}`,
          `khác người — khoảng cách: tb ${(diffSum / (diffN || 1)).toFixed(3)} · GẦN nhất ${diffMin.toFixed(3)}`,
          `khe giữa hai phân bố: ${(diffMin - sameMax).toFixed(3)} (dương là tách được)`,
          `ngưỡng đặt giữa khe: ${mid.toFixed(3)}`,
          `gom được ${g.people.length} cụm: ${clusters.join(" | ")}`,
          `cụm thuần: ${pure ? "có" : "KHÔNG"} · số người phủ: ${covered}/${PEOPLE.length} · lẻ ${g.loose}`,
        ].join("\n")
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "hỏng");
    }
    setBusy(false);
  }, []);

  return (
    <div>
      <p className="mb-3 text-[12.5px]" style={{ color: "var(--tx2)" }}>
        Bốn “người” khác nhau về hình học khuôn mặt, mỗi người ba biến thể (nét mặt, nghiêng đầu, độ sáng).
        Chạy qua đúng đường của code thật: MediaPipe tìm mặt → căn chỉnh theo hai mắt → mạng 128 chiều → gom
        cụm. Con số cần nhìn là <b>khoảng cách hai phân bố</b>: cùng người phải giống hơn hẳn khác người.
      </p>
      <button
        onClick={run}
        disabled={busy || !can}
        className="rounded-[10px] px-3.5 py-2 text-[13px] font-bold disabled:opacity-60"
        style={{ background: "var(--ac)", color: "#fff" }}
      >
        {busy ? "Đang tải mô hình & gom cụm…" : "Chạy thử gom theo người"}
      </button>
      {err && (
        <p className="mt-3 text-[12.5px] font-semibold" data-testid="group-error" style={{ color: "var(--rd)" }}>
          Lỗi: {err}
        </p>
      )}
      {report && (
        <pre
          data-testid="group-report"
          className="mt-3 whitespace-pre-wrap rounded-[10px] p-3 text-[11.5px] leading-relaxed"
          style={{ background: "var(--sf2)", color: "var(--tx)" }}
        >
          {report}
        </pre>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {shots.map((s) => (
          <div key={s.id} className="w-[120px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.url} alt={s.id} className="w-full rounded-[7px]" />
            <p className="text-[10.5px]" style={{ color: "var(--tx3)" }}>{s.id}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
