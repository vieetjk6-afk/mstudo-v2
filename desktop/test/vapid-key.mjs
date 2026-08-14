/* Kiểm thử luật so khoá VAPID của đăng ký thông báo đẩy.
 *
 * Vì sao đáng test: kết quả của hàm này quyết định có HUỶ một đăng ký đang chạy
 * hay không. Sai theo hướng "false" oan là tự tay huỷ đăng ký tốt của khách; sai
 * theo hướng "true" oan là để nút báo "đang bật" trong khi máy đó không bao giờ
 * nhận được gì nữa (dịch vụ đẩy trả 403, mà máy chủ chỉ dọn 404/410).
 *
 * Ba nhánh phải giữ đúng:
 *   true  → khớp, để nguyên
 *   false → lệch, huỷ rồi đăng ký lại
 *   null  → KHÔNG kết luận được, để nguyên (thà giữ còn hơn huỷ nhầm)
 *
 * Nạp thẳng code thật ở src/lib/vapid-key.ts.
 */
import { matchesVapidKey, urlBase64ToUint8Array } from "../../src/lib/vapid-key.ts";

let fail = 0;
const check = (name, got, want) => {
  const ok = got === want;
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};

// Khoá VAPID công khai thật có dạng base64url, 65 byte sau khi giải mã.
const KEY_A =
  "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U";
const KEY_B =
  "BNbxGYNMhEIi9zrneh4uGnrhCrPtqEqJn0PZLcbwp0zHyDpKO0h9SHXQAftDMr9Q3nCFqDLTAsyU5_ZmU8OuBJk";

const buf = (base64) => urlBase64ToUint8Array(base64).buffer;

check("giải mã ra đúng 65 byte", urlBase64ToUint8Array(KEY_A).length, 65);

check("cùng một khoá → khớp", matchesVapidKey(buf(KEY_A), KEY_A), true);
check("hai khoá khác nhau → lệch", matchesVapidKey(buf(KEY_A), KEY_B), false);

// Lệch đúng MỘT byte cuối: kiểu sai dễ lọt nhất nếu chỉ so độ dài hoặc so vài
// byte đầu (mọi khoá VAPID đều bắt đầu bằng byte 0x04).
const almost = urlBase64ToUint8Array(KEY_A);
almost[almost.length - 1] ^= 1;
check("lệch đúng 1 byte cuối → vẫn phát hiện", matchesVapidKey(almost.buffer, KEY_A), false);

const shorter = urlBase64ToUint8Array(KEY_A).slice(0, 64);
check("độ dài khác → lệch", matchesVapidKey(shorter.buffer, KEY_A), false);

// Ba trường hợp "không kết luận được" — đều PHẢI trả null để khỏi huỷ oan.
check("trình duyệt không cho đọc khoá → null", matchesVapidKey(null, KEY_A), null);
check("khoá của đăng ký undefined → null", matchesVapidKey(undefined, KEY_A), null);
check("máy chủ chưa khai khoá nào → null", matchesVapidKey(buf(KEY_A), ""), null);
check("đăng ký có khoá rỗng → null", matchesVapidKey(new ArrayBuffer(0), KEY_A), null);

console.log(fail === 0 ? "\nTất cả kiểm thử đạt" : `\n${fail} kiểm thử KHÔNG đạt`);
process.exit(fail === 0 ? 0 : 1);
