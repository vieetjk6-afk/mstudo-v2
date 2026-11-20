/* Kiểm thử "mật khẩu" mở trang hợp đồng của khách (src/lib/portal-key.ts) và
 * phần thuần của email gửi khách (src/lib/client-email-format.ts).
 *
 * Bẫy được nhắm tới:
 *  - khách không có SĐT: mở bằng MÃ SỐ studio đặt; có cả hai thì cái nào cũng mở
 *  - không có khoá nào / nhập rỗng → KHÔNG mở (fail-closed)
 *  - mã quá ngắn (< 6 số) coi như chưa đặt — không để dò 4 số là vào
 *  - lời nhắn "(mật khẩu là SĐT…)" đổi thành mã CHỈ khi khách không có SĐT
 *  - email: link bấm được, nội dung tin không chèn được HTML
 */
import {
  portalKeyMatches, passcodeValid, hasPortalKey, randomPasscode, withPasscodeHint, PHONE_HINT,
} from "../../src/lib/portal-key.ts";
import { bodyToHtml, emailSubject, isEmail } from "../../src/lib/client-email-format.ts";

let fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};

// ── Mở khoá ─────────────────────────────────────────────────────────────────
check("SĐT đúng (kể cả có dấu cách) → mở", portalKeyMatches("0912 345 678", "0912345678", null), true);
check("SĐT sai → không mở", portalKeyMatches("0912345679", "0912345678", null), false);
check("không SĐT, mã số đúng → mở", portalKeyMatches("482913", null, "482913"), true);
check("không SĐT, mã số sai → không mở", portalKeyMatches("482914", null, "482913"), false);
check("có cả hai: nhập mã số → mở", portalKeyMatches("482913", "0912345678", "482913"), true);
check("có cả hai: nhập SĐT → mở", portalKeyMatches("0912345678", "0912345678", "482913"), true);
check("hợp đồng không có khoá nào → không mở", portalKeyMatches("", null, null), false);
check("nhập rỗng khi hợp đồng không có khoá → không mở", portalKeyMatches("abc", "", ""), false);
check("mã 4 số (quá ngắn) không mở được", portalKeyMatches("1234", null, "1234"), false);

// ── Mã số hợp lệ ────────────────────────────────────────────────────────────
check("6 số hợp lệ", passcodeValid("123456"), true);
check("5 số chưa đủ", passcodeValid("12345"), false);
check("13 số quá dài", passcodeValid("1234567890123"), false);
check("có khoá: chỉ mã số", hasPortalKey(null, "123456"), true);
check("có khoá: không gì cả", hasPortalKey("", "12"), false);
const r = randomPasscode();
check("mã ngẫu nhiên: 6 số, không bắt đầu bằng 0", /^[1-9]\d{5}$/.test(r), true);

// ── Lời nhắn ────────────────────────────────────────────────────────────────
const msg = `Xem tại: https://x.vn/c/abc ${PHONE_HINT}.`;
check("có SĐT → giữ nguyên lời nhắn", withPasscodeHint(msg, "0912345678", "482913"), msg);
check("không SĐT + có mã → ghi mã", withPasscodeHint(msg, null, "482913"), "Xem tại: https://x.vn/c/abc (mã mở: 482913).");
check("không SĐT, không mã → giữ nguyên", withPasscodeHint(msg, null, null), msg);

// ── Email ───────────────────────────────────────────────────────────────────
check("tiêu đề theo mốc", emailSubject("deposit_confirm", "Studio A"), "Studio A: Đã nhận cọc");
check("mốc lạ → tiêu đề chung", emailSubject("abc", ""), "Thông báo");
check("email hợp lệ", isEmail(" a@b.vn "), true);
check("email sai", isEmail("a@b"), false);
const html = bodyToHtml("Chào <b>bạn</b>\nXem: https://x.vn/c/abc.", "S");
check("không chèn được HTML", html.includes("<b>"), false);
check("link bấm được, bỏ dấu chấm cuối", html.includes('<a href="https://x.vn/c/abc" style="color:#2563eb">https://x.vn/c/abc</a>.'), true);
check("giữ xuống dòng", html.includes("<br>"), true);

console.log(fail ? `\n${fail} kiểm thử KHÔNG đạt` : "\nTất cả kiểm thử đạt");
process.exit(fail ? 1 : 0);
