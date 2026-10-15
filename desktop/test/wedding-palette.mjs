/* Kiểm thử bảng màu thiệp cưới suy từ MỘT màu (src/lib/wedding-palette.ts)
 * và danh mục mẫu (src/app/thiep/[slug]/templates.ts).
 *
 * Vì sao đáng test: cặp đôi tự chọn màu bằng ô chọn màu tự do — chọn trắng
 * tinh, đen kịt hay hồng phấn đều được. Chữ in trên thiệp phải đọc được với
 * BẤT KỲ màu nào: chữ trắng trên nền hồng phấn hay chữ bạc trên trời trắng là
 * khách không đọc được tên, ngày, địa chỉ. Bài này quét cả dải màu và khoá các
 * ngưỡng tương phản. Thêm nữa, năm mẫu "vom-…" cũ đã gộp làm một: thiệp đã lưu
 * bằng tên cũ phải vẫn trỏ đúng mẫu và đúng màu.
 */
import { alpha, contrast, ensureContrast, lightPalette, luminance, mix, nightPalette, parseHex, safeHex } from "../../src/lib/wedding-palette.ts";
import { TEMPLATE_ALIASES, WEDDING_TEMPLATE_CATALOG, getTemplateMeta } from "../../src/app/thiep/[slug]/templates.ts";

let fail = 0;
const check = (name, ok, extra = "") => {
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `  ${extra}`}`);
};

/* ── Đọc màu ────────────────────────────────────────────────────────────── */
check("#abc → [170,187,204]", JSON.stringify(parseHex("#abc")) === "[170,187,204]");
check("AABBCC không dấu # vẫn đọc được", JSON.stringify(parseHex("AABBCC")) === "[170,187,204]");
check("chuỗi lạ → null", parseHex("red") === null && parseHex("") === null && parseHex(undefined) === null);
check("safeHex rơi về màu dự phòng", safeHex("rgb(1,2,3)", "#123456") === "#123456");
check("safeHex chuẩn hoá chữ thường", safeHex("#ABCDEF", "#000") === "#abcdef");
check("mix trắng-đen ở giữa = xám", mix("#000000", "#ffffff", 0.5) === "#808080");
check("alpha", alpha("#ff0000", 0.5) === "rgba(255,0,0,0.5)");
check("tương phản trắng/đen = 21", Math.abs(contrast("#ffffff", "#000000") - 21) < 0.01);
check("ensureContrast đẩy chữ nhạt cho đủ 4.5 trên nền trắng", contrast(ensureContrast("#f4c2c2", "#ffffff", 4.5), "#ffffff") >= 4.5);

/* ── Bảng màu sáng: quét cả dải màu ─────────────────────────────────────── */
const SAMPLE = [
  "#ffffff", "#000000", "#f4c2c2", "#fff7d6", "#d6a05b", "#6d8b74", "#2d3d6c", "#8e2f3c",
  "#ffeb3b", "#00ffd5", "#ff4fd8", "#7c948c", "#a86f3f", "#c3b4d6", "#808080", "#123123",
];
for (const c of SAMPLE) {
  const p = lightPalette(c, "#6d8b74");
  check(`sáng ${c}: chữ nhấn đọc được trên nền nhạt (≥3.4)`, contrast(p.text, p.soft) >= 3.4, contrast(p.text, p.soft).toFixed(2));
  check(`sáng ${c}: chữ chính đọc được trên thẻ (≥7)`, contrast(p.ink, p.card) >= 7, contrast(p.ink, p.card).toFixed(2));
  check(`sáng ${c}: chữ trên khối màu đọc được (≥2.2)`, contrast(p.onMain, p.main) >= 2.2, `${p.onMain} on ${p.main}`);
}
check("màu lạ → dùng màu gốc của mẫu", lightPalette("xanh", "#6d8b74").main === "#6d8b74");

/* ── Bảng màu đêm ───────────────────────────────────────────────────────── */
for (const c of ["#ffffff", "#ffeb3b", "#0c1230", "#2a0b16", "#000000", "#c9d2ff"]) {
  const n = nightPalette(c, "#0c1230");
  check(`đêm ${c}: nền trời đủ tối`, luminance(n.sky) <= 0.022, luminance(n.sky).toFixed(3));
  check(`đêm ${c}: chữ sáng đọc được trên trời (≥12)`, contrast(n.ink, n.sky) >= 12, contrast(n.ink, n.sky).toFixed(2));
  check(`đêm ${c}: chữ phụ đọc được trên trời (≥4.5)`, contrast(n.muted, n.sky) >= 4.5, contrast(n.muted, n.sky).toFixed(2));
}
const def = nightPalette(undefined, "#0c1230");
check("đêm mặc định giữ đúng xanh đêm cũ", def.sky === "#0c1230");

/* ── Danh mục mẫu & tên cũ đã gộp ───────────────────────────────────────── */
const names = new Set(WEDDING_TEMPLATE_CATALOG.map((t) => t.name));
check("không còn năm bản 'vom-…' trùng nhau trong danh mục", ![...names].some((n) => n.startsWith("vom-")));
for (const [old, a] of Object.entries(TEMPLATE_ALIASES)) {
  check(`${old} → mẫu "${a.name}" có trong danh mục`, names.has(a.name));
  check(`${old} giữ màu cũ hợp lệ`, parseHex(a.color) !== null);
  check(`getTemplateMeta("${old}") trả đúng mẫu mới`, getTemplateMeta(old).name === a.name);
}
check("không có tên mẫu trùng nhau", names.size === WEDDING_TEMPLATE_CATALOG.length);
for (const t of WEDDING_TEMPLATE_CATALOG.filter((x) => x.color)) {
  const sw = t.color.swatches;
  check(`${t.name}: màu mặc định nằm trong dải gợi ý`, sw.some((s) => s.hex === t.color.default));
  check(`${t.name}: màu gợi ý hợp lệ, không trùng`, sw.every((s) => parseHex(s.hex)) && new Set(sw.map((s) => s.hex)).size === sw.length);
}

console.log(fail ? `\n${fail} lỗi` : "\nTất cả OK");
process.exit(fail ? 1 : 0);
