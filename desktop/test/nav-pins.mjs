/* Kiểm thử MỤC GHIM menu trái của giao diện mới (src/lib/nav-pins.ts).
 *
 * Những điều phải giữ:
 *   1. Chưa có cookie → null (dùng bộ mặc định), khác với "đã bỏ ghim hết" → [].
 *   2. Chỉ nhận đường dẫn có thật trong menu; bỏ trùng; giữ đúng thứ tự.
 *   3. Tối đa MAX_PINS mục.
 *   4. Ghi rồi đọc lại ra đúng danh sách cũ.
 *
 * Nạp thẳng code thật.
 */
import { parseNavPins, serializeNavPins, DEFAULT_PINS, MAX_PINS } from "../../src/lib/nav-pins.ts";
import { NAV_GROUPS } from "../../src/lib/studio-nav.ts";

let fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};

const all = NAV_GROUPS.flatMap((g) => g.items.map((it) => it.href));

check("không có cookie → null (bộ mặc định)", parseNavPins(undefined), null);
check("cookie rỗng → [] (đã bỏ ghim hết)", parseNavPins(""), []);
check("mọi mục mặc định đều có thật trong menu", DEFAULT_PINS.every((h) => all.includes(h)), true);
check(
  "giữ thứ tự, bỏ trùng",
  parseNavPins(serializeNavPins(["/dashboard/studio/reports", "/dashboard/studio", "/dashboard/studio/reports"])),
  ["/dashboard/studio/reports", "/dashboard/studio"],
);
check(
  "bỏ đường dẫn lạ / chèn mã",
  parseNavPins(encodeURIComponent("/dashboard/studio|https://evil.example|<script>|/dashboard/albums")),
  ["/dashboard/studio", "/dashboard/albums"],
);
check("cookie hỏng mã hoá: không vỡ, vẫn giữ mục hợp lệ", parseNavPins("%E0%A4%A|/dashboard/studio"), ["/dashboard/studio"]);
check("cắt ở MAX_PINS", parseNavPins(serializeNavPins(all)).length, Math.min(MAX_PINS, all.length));
check("ghi rồi đọc lại", parseNavPins(serializeNavPins([...DEFAULT_PINS])), [...DEFAULT_PINS]);

console.log(fail === 0 ? "\nTất cả đều đạt." : `\n${fail} ca KHÔNG đạt.`);
process.exit(fail === 0 ? 0 : 1);
