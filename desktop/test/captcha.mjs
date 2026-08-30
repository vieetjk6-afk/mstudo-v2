/* Kiểm thử luật xác minh captcha Turnstile phía máy chủ.
 *
 * Vì sao đáng test: hàm này quyết định CÓ CHO GỬI hay không ở mọi form công
 * khai của mstudo (liên hệ, góp ý, đặt lịch, tra cứu SĐT thợ). Bản cũ trả về
 * một giá trị bool duy nhất và gộp ba tình huống khác hẳn nhau vào cùng một
 * "true", trong đó có cả trường hợp CLIENT tự khai "captcha không chạy được".
 * Chuỗi đó không ký, không hạn dùng, ai gửi cũng được — nên captcha thành đồ
 * trang trí. Ba mức dưới đây phải giữ đúng:
 *
 *   verified   → Cloudflare xác nhận, cho đi thẳng
 *   unverified → không kết luận được, route sẽ SIẾT HẠN MỨC chứ không mở cửa
 *   failed     → có mã nhưng Cloudflare bác, chặn thẳng
 *
 * Nạp thẳng code thật ở src/lib/turnstile.ts.
 */
import { checkTurnstile, TURNSTILE_UNAVAILABLE } from "../../src/lib/turnstile.ts";

let fail = 0;
const check = (name, got, want) => {
  const ok = got === want;
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};

const realFetch = globalThis.fetch;
/** Giả lập câu trả lời của Cloudflare cho MỘT lần gọi. */
function stubCloudflare(reply) {
  globalThis.fetch = async () => reply();
}
const jsonRes = (body, ok = true) => ({ ok, json: async () => body });

// ── Chưa cấu hình bí mật ────────────────────────────────────────────────
delete process.env.TURNSTILE_SECRET_KEY;
stubCloudflare(() => { throw new Error("không được gọi Cloudflare khi chưa có bí mật"); });
check(
  "chưa khai TURNSTILE_SECRET_KEY → unverified (không phải verified)",
  await checkTurnstile("mã-gì-đó"),
  "unverified",
);

// ── Đã cấu hình bí mật ──────────────────────────────────────────────────
process.env.TURNSTILE_SECRET_KEY = "bí-mật-thử";

// Đây là lỗ hổng đã sửa: chuỗi client tự khai KHÔNG được tính là đã xác minh.
stubCloudflare(() => { throw new Error("không được gọi Cloudflare cho mã tự khai"); });
check(
  "client gửi cờ 'không dùng được' → unverified (KHÔNG phải verified)",
  await checkTurnstile(TURNSTILE_UNAVAILABLE),
  "unverified",
);
check("không gửi mã nào → unverified", await checkTurnstile(undefined), "unverified");
check("mã rỗng → unverified", await checkTurnstile(""), "unverified");

stubCloudflare(() => jsonRes({ success: true }));
check("Cloudflare xác nhận → verified", await checkTurnstile("mã-thật"), "verified");

stubCloudflare(() => jsonRes({ success: false, "error-codes": ["invalid-input-response"] }));
check("Cloudflare bác mã → failed", await checkTurnstile("mã-giả"), "failed");

// Thiếu hẳn trường success cũng phải coi là bị bác, đừng đoán thành verified.
stubCloudflare(() => jsonRes({}));
check("Cloudflare trả thiếu 'success' → failed", await checkTurnstile("mã-lạ"), "failed");

// ── Cloudflare trục trặc: KHÔNG được làm sập mọi form ────────────────────
// Bản cũ trả false ở đây, tức Cloudflare hắt hơi là toàn bộ form của mstudo
// chết theo. Giờ hạ xuống unverified: khách vẫn gửi được nhưng bị siết hạn mức.
stubCloudflare(() => jsonRes({}, false));
check("Cloudflare trả HTTP lỗi → unverified", await checkTurnstile("mã-thật"), "unverified");

stubCloudflare(() => { throw new Error("mạng đứt"); });
check("không gọi được Cloudflare → unverified", await checkTurnstile("mã-thật"), "unverified");

globalThis.fetch = realFetch;

console.log(fail === 0 ? "\nTẤT CẢ ĐỀU ĐẠT" : `\n${fail} mục KHÔNG ĐẠT`);
process.exit(fail === 0 ? 0 : 1);
