/* Kiểm thử phần TÍNH KHUNG của công cụ "Chuẩn mạng xã hội".
 *
 * Vì sao đáng test: đây là phần quyết định ảnh đăng Facebook có nét hay không,
 * và nó thuần số học nên test được không cần trình duyệt. Ba lỗi kinh điển:
 *   1. Phóng to ảnh nhỏ cho "đủ khung" → ảnh mờ, đúng cái mà studio phàn nàn.
 *   2. Cắt lệch tâm khi tỉ lệ ảnh khác tỉ lệ khung.
 *   3. Khung "thêm viền" ra sai kích thước nên nền tảng lại thu nhỏ lần nữa.
 */
import { planFrame, planMaxDim } from "../../src/lib/compress.ts";
import { SOCIAL_PRESETS, presetsFor, findPreset, ratioLabel, PLATFORMS } from "../../src/lib/social-presets.ts";

let fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};
const size = (p) => [p.canvas.w, p.canvas.h];

const FB_2048 = { width: 2048, height: 2048, fit: "contain" };
const FB_45 = { width: 1638, height: 2048, fit: "cover" };
const STORY = { width: 1080, height: 1920, fit: "cover" };

/* ── Giữ nguyên tỉ lệ (contain) ─────────────────────────────────────── */
check("ảnh ngang 6000×4000 → cạnh dài đúng 2048 của Facebook",
  size(planFrame(6000, 4000, FB_2048)), [2048, 1365]);
check("ảnh dọc 4000×6000 → cạnh dài cũng là 2048",
  size(planFrame(4000, 6000, FB_2048)), [1365, 2048]);
check("ảnh nhỏ 1200×800 KHÔNG bị phóng to (phóng to = mờ)",
  size(planFrame(1200, 800, FB_2048)), [1200, 800]);
check("ảnh nhỏ + cho phép phóng to → mới bằng khung",
  size(planFrame(1200, 800, FB_2048, true)), [2048, 1365]);

/* ── Cắt vừa khung (cover) ──────────────────────────────────────────── */
const cover = planFrame(6000, 4000, FB_45);
check("khổ dọc 4:5 ra đúng 1638×2048", size(cover), [1638, 2048]);
check("cắt giữa theo chiều ngang", [cover.src.x, cover.src.y], [1401, 0]);
check("vùng cắt đúng tỉ lệ khung 4:5",
  Math.abs(cover.src.w / cover.src.h - 1638 / 2048) < 0.002, true);
check("vùng cắt không vượt ra ngoài ảnh gốc",
  cover.src.x + cover.src.w <= 6000 && cover.src.y + cover.src.h <= 4000, true);

// Ảnh gốc thiếu pixel: THU NHỎ KHUNG (giữ đúng tỉ lệ) thay vì phóng to ảnh.
const small = planFrame(1000, 1000, FB_45);
check("ảnh 1000×1000 vào khung 4:5 → 800×1000, vẫn đúng tỉ lệ", size(small), [800, 1000]);
check("… và không phóng to: vùng vẽ ≤ vùng cắt", small.dest.w <= small.src.w, true);
check("cho phép phóng to → đúng khung 1638×2048",
  size(planFrame(1000, 1000, FB_45, true)), [1638, 2048]);

/* ── Thêm viền (pad) ────────────────────────────────────────────────── */
const pad = planFrame(1200, 800, { ...STORY, fit: "pad" });
check("story 9:16 ra đúng 1080×1920 dù ảnh gốc ngang", size(pad), [1080, 1920]);
check("ảnh nằm giữa khung", [pad.dest.x, pad.dest.y, pad.dest.w, pad.dest.h], [0, 600, 1080, 720]);
check("có viền → phải tô nền trước khi vẽ", pad.padded, true);
const padExact = planFrame(1080, 1920, { ...STORY, fit: "pad" });
check("ảnh đã đúng khổ 9:16 → không viền", padExact.padded, false);

/* ── Giới hạn cạnh dài (tab Nén ảnh cũ) ─────────────────────────────── */
check("cạnh dài 2048", size(planMaxDim(6000, 4000, 2048)), [2048, 1365]);
check("giữ nguyên khi không đặt cạnh dài", size(planMaxDim(6000, 4000, 0)), [6000, 4000]);
check("ảnh đã nhỏ hơn mức đặt → không phóng to", size(planMaxDim(800, 600, 2048)), [800, 600]);
check("không cắt gì ở chế độ cạnh dài", planMaxDim(6000, 4000, 2048).src, { x: 0, y: 0, w: 6000, h: 4000 });

/* ── Bảng khổ chuẩn ─────────────────────────────────────────────────── */
const ids = SOCIAL_PRESETS.map((p) => p.id);
check("mã khổ không trùng nhau", ids.length, new Set(ids).size);
check("mọi nền tảng đều có ít nhất một khổ",
  PLATFORMS.every((p) => presetsFor(p.id).length > 0), true);
check("mọi khổ đều hợp lệ (kích thước, chất lượng, trần dung lượng)",
  SOCIAL_PRESETS.every(
    (p) => p.w > 0 && p.h > 0 && p.quality > 0.5 && p.quality <= 1 && p.maxBytes >= 0
  ), true);
check("bề rộng Facebook không vượt mức 2048 mà Facebook lưu",
  presetsFor("facebook").every((p) => Math.max(p.w, p.h) <= 2048), true);
check("mã khổ lạ → lùi về khổ đầu tiên, không văng", findPreset("khong-co").id, SOCIAL_PRESETS[0].id);
check("nhãn tỉ lệ 1638×2048 → 4:5", ratioLabel(1638, 2048), "4:5");
check("nhãn tỉ lệ 1080×1920 → 9:16", ratioLabel(1080, 1920), "9:16");
check("nhãn tỉ lệ 2048×1072 → 1.91:1", ratioLabel(2048, 1072), "1.91:1");
check("nhãn tỉ lệ lẻ 1640×624 → số thập phân", ratioLabel(1640, 624), "2.63:1");

console.log(fail === 0 ? "\nTất cả đạt." : `\n${fail} mục KHÔNG đạt.`);
process.exit(fail === 0 ? 0 : 1);
