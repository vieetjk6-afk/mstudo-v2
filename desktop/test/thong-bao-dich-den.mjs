/* Kiểm thử ĐÍCH ĐẾN của thông báo: bấm vào một thông báo thì đi đâu.
 *
 * Vì sao đáng test: `notificationHref()` là những chuỗi đường dẫn viết tay, mà
 * các màn quản trị thì hay được dọn chỗ. Khi mục "Yêu cầu nâng cấp" dọn từ
 * trang Cấu hình sang khu Người dùng & studio, ba bản sao của chuỗi
 * "/dashboard/settings" (hàm này + hai route API gửi push) không ai sửa theo.
 * Hậu quả: admin bấm vào thông báo CÓ TIỀN đang chờ duyệt thì rơi vào trang cấu
 * hình, nơi không có một nút duyệt nào — và không có gì báo là đã đi lạc, vì
 * trang đó vẫn mở ra bình thường.
 *
 * Hai lớp chặn:
 *   1. Chốt riêng loại upgrade_request (đúng chỗ đã hỏng).
 *   2. Lớp mạnh hơn: MỌI đích của MỌI loại thông báo phải trỏ tới một route có
 *      thật trong src/app. Lớp này bắt được cả những lần dọn màn sau này mà
 *      không ai nhớ tới file thông báo.
 *
 * Nạp thẳng code thật ở src/lib/notifications.ts.
 */
import { existsSync, readdirSync } from "node:fs";
import { UPGRADE_REVIEW_HREF, notificationHref } from "../../src/lib/notifications.ts";

const APP = new URL("../../src/app/", import.meta.url);

let fail = 0;
const check = (name, got, want) => {
  const ok = got === want;
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};
const ok = (name, cond, chiTiet = "") => {
  if (!cond) fail++;
  console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : `\n    ${chiTiet}`}`);
};

/** Dựng một dòng thông báo tối thiểu — đúng phần notificationHref đọc tới. */
const n = (kind, extra = {}) => ({ kind, contract_id: null, album_id: null, ...extra });

/* ── 1. Yêu cầu nâng cấp: chỗ đã hỏng ─────────────────────────────────────── */

// Trang Cấu hình có "Gói & giá" và "Nội dung trang nâng cấp" — toàn thứ nghe
// rất giống chỗ cần tới, nên đây đúng là kiểu sai mà nhìn qua tưởng đúng.
ok(
  "upgrade_request KHÔNG trỏ về trang Cấu hình",
  !notificationHref(n("upgrade_request")).startsWith("/dashboard/settings"),
  `đang trỏ: ${notificationHref(n("upgrade_request"))}`
);
check("upgrade_request → chỗ duyệt", notificationHref(n("upgrade_request")), UPGRADE_REVIEW_HREF);
ok("chỗ duyệt nằm trong khu quản trị", UPGRADE_REVIEW_HREF.startsWith("/dashboard/admin"), UPGRADE_REVIEW_HREF);
// Neo là thứ đưa admin xuống đúng khối; mất neo thì rơi lên đầu trang, dưới đó
// là cả một bảng tài khoản dài.
ok("chỗ duyệt có neo tới đúng khối", UPGRADE_REVIEW_HREF.includes("#"), UPGRADE_REVIEW_HREF);

/* ── 2. Vài đích khác dễ lẫn ──────────────────────────────────────────────── */

// contact CŨNG về trang Cấu hình, và lần này là ĐÚNG (mục "Góp ý & liên hệ" ở
// đó thật). Giữ phép kiểm này để bản vá trên đừng "sửa" lan sang cả nó.
check("contact → trang Cấu hình (đúng)", notificationHref(n("contact")), "/dashboard/settings");
check("new_user → khu quản trị", notificationHref(n("new_user")), "/dashboard/admin");
// plan_activated/payment_failed gửi cho CHÍNH studio, không phải admin — phải
// về trang nâng cấp của họ, tuyệt đối không về khu quản trị (họ không có quyền).
for (const k of ["plan_activated", "payment_failed"]) {
  check(`${k} → trang nâng cấp của studio`, notificationHref(n(k)), "/dashboard/upgrade");
  ok(`${k} KHÔNG dẫn studio vào khu quản trị`, !notificationHref(n(k)).startsWith("/dashboard/admin"));
}

// Thứ tự ưu tiên: có album/hợp đồng thì đi thẳng vào đúng bản ghi.
check("có album_id → vào album", notificationHref(n("info", { album_id: "a1" })), "/dashboard/albums/a1");
check("có contract_id → vào hợp đồng", notificationHref(n("signed", { contract_id: "c1" })), "/dashboard/studio/contracts/c1");
check("album_id thắng contract_id", notificationHref(n("signed", { album_id: "a1", contract_id: "c1" })), "/dashboard/albums/a1");
check("loại không có đích → null", notificationHref(n("info")), null);

/* ── 3. Mọi đích phải là route CÓ THẬT ────────────────────────────────────── */

const KINDS = [
  "signed", "edit_request", "crew_accepted", "crew_declined", "review", "payment",
  "quote_accepted", "announcement", "new_user", "upgrade_request", "contact",
  "selection", "schedule_reminder", "contract_changed", "assigned",
  "contract_created", "plan_activated", "payment_failed", "info",
];

/**
 * Đường dẫn này có khớp một route trong src/app không?
 * Khớp từng đoạn: tên thư mục đúng y, hoặc một thư mục động ([id], [[...path]]).
 */
function routeTonTai(path) {
  const segs = path.replace(/[?#].*$/, "").split("/").filter(Boolean);
  let dir = APP;
  for (const seg of segs) {
    if (existsSync(new URL(`${seg}/`, dir))) { dir = new URL(`${seg}/`, dir); continue; }
    const dong = readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name.startsWith("["))
      .map((e) => e.name);
    if (dong.length === 0) return false;
    dir = new URL(`${dong[0]}/`, dir);
  }
  return existsSync(new URL("page.tsx", dir)) || existsSync(new URL("route.ts", dir));
}

// Tự kiểm bộ dò trước khi tin nó: một đường dẫn bịa ra phải bị bắt là KHÔNG có.
ok("bộ dò route bắt được đường dẫn không tồn tại", routeTonTai("/dashboard/khong-he-co-trang-nay") === false);
ok("bộ dò route nhận ra route động", routeTonTai("/dashboard/studio/contracts/abc") === true);

for (const kind of KINDS) {
  // Dựng cả bản trơn lẫn bản có id, vì hai nhánh cho ra hai đường khác nhau.
  for (const extra of [{}, { contract_id: "c1" }, { album_id: "a1" }]) {
    const href = notificationHref(n(kind, extra));
    if (!href) continue;
    ok(`route có thật: ${kind}${Object.keys(extra)[0] ? ` (${Object.keys(extra)[0]})` : ""} → ${href}`, routeTonTai(href), `không tìm thấy page.tsx cho ${href}`);
  }
}

console.log(fail ? `\n${fail} kiểm thử HỎNG` : "\nTất cả kiểm thử đạt");
process.exit(fail ? 1 : 0);
