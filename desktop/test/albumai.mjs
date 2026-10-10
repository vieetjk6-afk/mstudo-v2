/* Kiểm thử luật TẶNG 1 NĂM bản quyền Album AI cho gói Studio.
 *
 * Vì sao đáng test: đây là luật PHÁT QUÀ có giá trị tiền thật, và máy chủ Album AI
 * tin hoàn toàn vào câu trả lời của /api/albumai/license. Hai hướng sai đều đắt:
 *
 *  • Phát nhầm: bản dùng thử Studio 7 ngày (mỗi tài khoản một lần, nhưng tạo
 *    tài khoản mới là có lần nữa) mà đổi được 1 năm bản quyền thì ai cũng lấy.
 *  • Thu nhầm: chủ studio đã kích hoạt rồi, gói hết hạn một hôm vì quên gia hạn,
 *    mà Album AI khoá ngay — quà đã tặng thì không thu lại giữa chừng.
 *
 * Nạp thẳng code thật ở src/lib/albumai.ts (cần móc giải đường dẫn .ts).
 */
import { readFileSync } from "node:fs";
import {
  albumAiStatus,
  albumAiStatusOf,
  albumAiGiftExpiry,
  ALBUMAI_HOST_LABEL,
  ALBUMAI_GIFT_YEARS,
} from "../../src/lib/albumai.ts";

let fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};

const NOW = new Date("2026-10-10T03:00:00.000Z");
const base = { plan: "studio", planCycle: "year", isAdmin: false, isStaff: false, expiresAt: null };
const st = (over) => albumAiStatus({ ...base, ...over }, NOW).state;

/* ── Ai được tặng ─────────────────────────────────────────────────────────── */
check("Studio trả phí theo năm, chưa kích hoạt → sẵn sàng kích hoạt", st({}), "ready");
check("Studio trả phí theo tháng → sẵn sàng", st({ planCycle: "month" }), "ready");
check("Studio do admin cấp (không ghi chu kỳ) → sẵn sàng", st({ planCycle: null }), "ready");
check("Admin → sẵn sàng (để thử)", st({ plan: "free", isAdmin: true }), "ready");

/* ── Ai KHÔNG được tặng ──────────────────────────────────────────────────── */
check("Studio DÙNG THỬ → chưa tặng", st({ planCycle: "trial" }), "trial");
check("Photographer Plus → mời nâng cấp", st({ plan: "photographer_plus" }), "upgrade");
check("Photographer → mời nâng cấp", st({ plan: "photographer" }), "upgrade");
check("Basic → mời nâng cấp", st({ plan: "basic" }), "upgrade");
check("Free → mời nâng cấp", st({ plan: "free" }), "upgrade");
check("Nhân viên studio → bản quyền gắn email chủ", st({ isStaff: true }), "staff");
check("Nhân viên, kể cả chủ đã kích hoạt → vẫn là staff", st({ isStaff: true, expiresAt: "2027-10-10T03:00:00.000Z" }), "staff");

/* ── Đã kích hoạt: giữ đúng mốc đã tặng ─────────────────────────────────── */
check("Đã kích hoạt, còn hạn → active", albumAiStatus({ ...base, expiresAt: "2027-01-01T00:00:00.000Z" }, NOW), {
  state: "active",
  expiresAt: "2027-01-01T00:00:00.000Z",
});
check("Đã kích hoạt rồi gói tụt về free → quà vẫn còn", st({ plan: "free", expiresAt: "2027-01-01T00:00:00.000Z" }), "active");
check("Đã kích hoạt, quá 1 năm → hết hạn", st({ expiresAt: "2026-10-01T00:00:00.000Z" }), "expired");
check("Hết hạn đúng thời điểm → hết hạn (không tính trùng giây là còn)", st({ expiresAt: NOW.toISOString() }), "expired");
check("Mốc hết hạn hỏng → coi như chưa kích hoạt", st({ expiresAt: "khong-phai-ngay" }), "ready");

/* ── Đọc từ dòng profiles ───────────────────────────────────────────────── */
check(
  "Gói Studio đã quá plan_expires_at → tính là free → mời nâng cấp",
  albumAiStatusOf({ plan: "studio", plan_cycle: "year", plan_expires_at: "2026-09-01T00:00:00.000Z" }, false, NOW).state,
  "upgrade",
);
check(
  "Chưa chạy migration (không có cột albumai_expires_at) → vẫn chạy, sẵn sàng",
  albumAiStatusOf({ plan: "studio", plan_cycle: "year", plan_expires_at: "2027-09-01T00:00:00.000Z" }, false, NOW).state,
  "ready",
);
check("role admin trong profiles → sẵn sàng", albumAiStatusOf({ role: "admin", plan: "free" }, false, NOW).state, "ready");

/* ── Thời hạn tặng ──────────────────────────────────────────────────────── */
check("Tặng đúng 1 năm", ALBUMAI_GIFT_YEARS, 1);
check("Kích hoạt 10/10/2026 → hết hạn 10/10/2027", albumAiGiftExpiry(NOW), "2027-10-10T03:00:00.000Z");
check("Kích hoạt 29/02 → hết hạn 01/03 năm sau (không lùi về 28/02)", albumAiGiftExpiry(new Date("2028-02-29T05:00:00.000Z")), "2029-03-01T05:00:00.000Z");

check("Tên miền hiển thị mặc định", ALBUMAI_HOST_LABEL, "albumai.mstudo.com");

/* ── Menu: gói thấp vẫn THẤY mục thiết kế album / slide để được mời nâng cấp ─ */
const nav = readFileSync(new URL("../../src/lib/studio-nav.ts", import.meta.url), "utf8");
const line = (href) => nav.split("\n").find((l) => l.includes(`href: "${href}"`)) ?? "";
for (const href of ["/dashboard/studio/album-designer", "/dashboard/studio/thiep"]) {
  check(`${href}: vẫn là tính năng gói Studio (minTier full)`, /minTier: "full"/.test(line(href)), true);
  check(`${href}: gói Photographer trở lên thấy để nâng cấp (upsellFrom booking)`, /upsellFrom: "booking"/.test(line(href)), true);
}

console.log(fail === 0 ? "\nTẤT CẢ ĐỀU ĐÚNG" : `\n${fail} kiểm thử SAI`);
process.exit(fail === 0 ? 0 : 1);
