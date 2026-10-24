/* Kiểm thử công tắc GIAO DIỆN MỚI (src/lib/ui-version.ts).
 *
 * Những điều phải giữ:
 *   1. Cờ ui_v2 chưa đặt (hoặc giá trị lạ) = chỉ admin dùng thử.
 *   2. Ở mức "chỉ admin", người thường tự gõ cookie "v2" cũng KHÔNG vào được.
 *   3. "beta": ai cũng thấy gợi ý, phải tự bật mới vào bản mới.
 *   4. "default": chưa chọn gì là vào bản mới; đã chọn "v1" thì giữ bản cũ.
 *   5. Màu chủ đạo chỉ nhận khoá có trong bảng — cookie lạ về màu mặc định.
 *
 * Nạp thẳng code thật.
 */
import { resolveUi, uiV2Mode, accentKey, accentHex } from "../../src/lib/ui-version.ts";

let fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};

const OFF = { eligible: false, active: false };
const OLD = { eligible: true, active: false };
const NEW = { eligible: true, active: true };

// ── uiV2Mode ───────────────────────────────────────────────────────────────
check("cờ trống → chỉ admin", uiV2Mode({}), "admin");
check("không có cờ → chỉ admin", uiV2Mode(null), "admin");
check("giá trị lạ → chỉ admin", uiV2Mode({ ui_v2: "live" }), "admin");
check("beta", uiV2Mode({ ui_v2: "beta" }), "beta");
check("default", uiV2Mode({ ui_v2: "default" }), "default");

// ── resolveUi: chỉ admin ──────────────────────────────────────────────────
check("chỉ admin · người thường, không cookie", resolveUi("admin", false, undefined), OFF);
check("chỉ admin · người thường tự gõ cookie v2", resolveUi("admin", false, "v2"), OFF);
check("chỉ admin · admin chưa bật", resolveUi("admin", true, undefined), OLD);
check("chỉ admin · admin đã bật", resolveUi("admin", true, "v2"), NEW);
check("chỉ admin · admin quay về bản cũ", resolveUi("admin", true, "v1"), OLD);

// ── resolveUi: beta ───────────────────────────────────────────────────────
check("beta · chưa bật → bản cũ + gợi ý", resolveUi("beta", false, undefined), OLD);
check("beta · đã bật", resolveUi("beta", false, "v2"), NEW);

// ── resolveUi: default ────────────────────────────────────────────────────
check("default · chưa chọn → bản mới", resolveUi("default", false, undefined), NEW);
check("default · đã chọn bản cũ", resolveUi("default", false, "v1"), OLD);

// ── Màu chủ đạo ───────────────────────────────────────────────────────────
check("khoá hợp lệ", accentKey("violet"), "violet");
check("không có cookie → xanh dương", accentKey(undefined), "blue");
check("cookie chen CSS → xanh dương", accentKey("red;}body{display:none"), "blue");
check("mặc định là xanh dương như ảnh tham khảo", accentHex("blue"), "#0b5cc4");

console.log(fail === 0 ? "\nTất cả đều đạt." : `\n${fail} ca KHÔNG đạt.`);
process.exit(fail === 0 ? 0 : 1);
