/* Kiểm thử trang xác nhận đăng nhập MStudo Desktop (/auth/desktop) không tự
 * làm hỏng chốt same-origin của chính nó.
 *
 * Lỗi đã xảy ra thật: trang có <meta name="referrer" content="no-referrer">.
 * Với chính sách đó Chromium (cả WebView2) gửi `Origin: null` khi bấm nút
 * "Đăng nhập" (form POST) → POST so Origin với Host, thấy lệch, đá về
 * /login?error=desktop_bad_origin. Nghĩa là nút đăng nhập tự động KHÔNG BAO
 * GIỜ chạy trong trình duyệt thật — chỉ curl (tự đặt Origin) là qua.
 *
 * Bài này đọc mã nguồn route và chặn mọi chính sách referrer khiến Origin
 * thành null (no-referrer), đồng thời đòi chính sách vẫn giấu token_hash
 * khỏi Referer (không được là unsafe-url / no-referrer-when-downgrade / origin-when-…
 * mà gửi nguyên URL).
 */
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../../src/app/auth/desktop/route.ts", import.meta.url), "utf8");

let fail = 0;
const check = (name, ok, extra = "") => {
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok || !extra ? "" : `\n    ${extra}`}`);
};

const metas = [...src.matchAll(/<meta\s+name="referrer"\s+content="([^"]+)"/g)].map((m) => m[1]);
check("có đúng một thẻ meta referrer", metas.length === 1, `tìm thấy: ${JSON.stringify(metas)}`);
const policy = metas[0] ?? "";
check(
  "không dùng no-referrer (làm Origin của form POST thành null)",
  policy !== "no-referrer",
  `đang là: ${policy}`
);
check(
  "Referer không mang nguyên URL (token_hash) — chỉ origin",
  ["strict-origin", "origin", "same-origin"].includes(policy),
  `đang là: ${policy}`
);
check("POST vẫn còn chốt same-origin", /desktop_bad_origin/.test(src) && /headers\.get\("origin"\)/.test(src));

if (fail) {
  console.log(`\n${fail} kiểm tra hỏng`);
  process.exit(1);
}
console.log("\nĐạt hết.");
