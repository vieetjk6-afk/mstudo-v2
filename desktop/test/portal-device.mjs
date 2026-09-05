/* Kiểm thử luật "cổng khách nhớ thiết bị" + nhãn tuổi bản lưu offline.
 *
 * Hai chỗ dễ sai và đều ảnh hưởng trực tiếp tới khách:
 *  1. Hạn nhớ số điện thoại. Nhớ mãi thì máy dùng chung thành cửa mở; hết hạn
 *     quá sớm thì khách lại phải gõ số mỗi lần, tức là quay về đúng cái làm
 *     khách bỏ không mở cổng nữa.
 *  2. Nhãn tuổi bản lưu. Khi mất mạng khách đọc bản chụp — mà trên đó có số tiền
 *     CÒN NỢ. Nói sai tuổi bản lưu là để khách đi chuyển khoản theo số liệu cũ.
 *
 * Nạp thẳng code thật ở src/lib/portal-device.ts.
 */
import { REMEMBER_MS, digitsOnly, memoValid, snapshotAge } from "../../src/lib/portal-device.ts";

let fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};

const NOW = Date.UTC(2026, 8, 3, 10, 0, 0);
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/* ── Chuẩn hoá số điện thoại ──────────────────────────────────────────────── */

check("bỏ mọi thứ không phải chữ số", digitsOnly(" 0912-345.678 "), "0912345678");
check("số rỗng → chuỗi rỗng", digitsOnly(null), "");

/* ── Hạn nhớ ──────────────────────────────────────────────────────────────── */

check("hạn nhớ đúng 90 ngày", REMEMBER_MS, 90 * DAY);
check("vừa nhớ xong → còn hiệu lực", memoValid({ phone: "0912345678", at: NOW }, NOW), true);
check("nhớ 89 ngày trước → còn hiệu lực", memoValid({ phone: "0912345678", at: NOW - 89 * DAY }, NOW), true);
check("nhớ 91 ngày trước → hết hiệu lực", memoValid({ phone: "0912345678", at: NOW - 91 * DAY }, NOW), false);
check("đúng mốc 90 ngày → hết hiệu lực (không cho tràn)", memoValid({ phone: "0912345678", at: NOW - 90 * DAY }, NOW), false);
check("không có số → không hiệu lực", memoValid({ phone: "", at: NOW }, NOW), false);
check("không có bản nhớ → không hiệu lực", memoValid(null, NOW), false);
check("mốc không phải số → không hiệu lực", memoValid({ phone: "0912345678", at: NaN }, NOW), false);
check(
  "đồng hồ máy đặt sai về tương lai → vẫn nhớ, đừng bắt khách gõ lại số",
  memoValid({ phone: "0912345678", at: NOW + 5 * DAY }, NOW),
  true
);

/* ── Nhãn tuổi bản lưu ────────────────────────────────────────────────────── */

check("vừa chụp", snapshotAge(NOW, NOW), "vừa xong");
check("40 giây → vẫn 'vừa xong'", snapshotAge(NOW - 40_000, NOW), "vừa xong");
check("1 phút", snapshotAge(NOW - MIN, NOW), "1 phút trước");
check("59 phút", snapshotAge(NOW - 59 * MIN, NOW), "59 phút trước");
check("1 giờ", snapshotAge(NOW - HOUR, NOW), "1 giờ trước");
check("23 giờ", snapshotAge(NOW - 23 * HOUR, NOW), "23 giờ trước");
check("1 ngày → 'hôm qua'", snapshotAge(NOW - DAY, NOW), "hôm qua");
check("3 ngày", snapshotAge(NOW - 3 * DAY, NOW), "3 ngày trước");
check("29 ngày", snapshotAge(NOW - 29 * DAY, NOW), "29 ngày trước");
check("2 tháng", snapshotAge(NOW - 62 * DAY, NOW), "2 tháng trước");
check("hơn một năm", snapshotAge(NOW - 400 * DAY, NOW), "hơn 1 năm trước");
check(
  "mốc ở tương lai (đồng hồ lệch) → 'vừa xong', không ra số âm",
  snapshotAge(NOW + 5 * MIN, NOW),
  "vừa xong"
);

console.log(fail ? `\n${fail} kiểm thử KHÔNG đạt` : "\nTất cả kiểm thử đạt");
process.exit(fail ? 1 : 0);
