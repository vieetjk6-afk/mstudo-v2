/* Kiểm thử bộ đếm hoạt động tài khoản.
 *
 * Vì sao đáng test: đếm sai một lần là số liệu HỎNG VĨNH VIỄN — không có nhật ký
 * từng lượt để dựng lại, và đây là số admin dùng để quyết định gọi lại studio
 * nào. Hai hướng sai đều tệ:
 *   • Đếm thừa → studio bỏ app vẫn trông "đang dùng", không ai gọi, mất khách.
 *   • Đếm thiếu → studio đang dùng bị xếp vào "đã bỏ", gọi làm phiền khách.
 *
 * Ba cái bẫy chính:
 *   • Mở app nhiều lần trong CÙNG một ngày chỉ được tính MỘT ngày.
 *   • Chốt ngày theo giờ VN, không theo UTC — nếu không, mọi hoạt động từ 0h
 *     đến 7h sáng VN bị gán sang hôm trước và số ngày thiếu đi hệ thống.
 *   • Cùng phiên, cùng ngày thì KHÔNG ghi DB (trả null) — ghi đè cùng giá trị
 *     mỗi lần bấm menu là lãng phí, và làm mốc thời gian trôi vô nghĩa.
 */
import {
  nextActivity, activityLevel, daysSince, lastActiveLabel, vnDay, SESSION_GAP_MINUTES,
} from "../../src/lib/activity.ts";

let fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};

// ── Chốt ngày theo giờ VN ──────────────────────────────────────────────────
// 01:00 sáng ngày 10/06 giờ VN = 18:00 ngày 09/06 UTC. Theo UTC sẽ ra ngày 9 (sai).
check("01h sáng VN vẫn là ngày VN hôm đó", vnDay(new Date("2026-06-09T18:00:00Z")), "2026-06-10");
check("23h đêm VN vẫn là ngày VN hôm đó", vnDay(new Date("2026-06-10T16:00:00Z")), "2026-06-10");

// ── nextActivity ───────────────────────────────────────────────────────────
const NONE = { last_active_at: null, last_active_day: null, active_days: 0, visit_count: 0 };
const t0 = new Date("2026-06-10T03:00:00Z"); // 10:00 sáng VN ngày 10/06

check("lần mở ĐẦU TIÊN → 1 ngày dùng, 1 phiên", nextActivity(NONE, t0), {
  last_active_at: t0.toISOString(), last_active_day: "2026-06-10", active_days: 1, visit_count: 1,
});

const after1 = { last_active_at: t0.toISOString(), last_active_day: "2026-06-10", active_days: 1, visit_count: 1 };

// Bấm menu liên tục trong cùng phiên: không ghi gì.
check("mở lại sau 5 phút, cùng ngày → KHÔNG ghi DB",
  nextActivity(after1, new Date("2026-06-10T03:05:00Z")), null);
check(`mở lại sau đúng ${SESSION_GAP_MINUTES} phút → phiên MỚI nhưng vẫn 1 ngày`,
  nextActivity(after1, new Date("2026-06-10T03:15:00Z")),
  { last_active_at: "2026-06-10T03:15:00.000Z", last_active_day: "2026-06-10", active_days: 1, visit_count: 2 });
check("mở lại 3 tiếng sau, vẫn cùng ngày → 1 ngày, 2 phiên",
  nextActivity(after1, new Date("2026-06-10T06:00:00Z")),
  { last_active_at: "2026-06-10T06:00:00.000Z", last_active_day: "2026-06-10", active_days: 1, visit_count: 2 });

// Sang ngày mới.
check("mở hôm sau → 2 ngày dùng",
  nextActivity(after1, new Date("2026-06-11T03:00:00Z")),
  { last_active_at: "2026-06-11T03:00:00.000Z", last_active_day: "2026-06-11", active_days: 2, visit_count: 2 });

// Bẫy múi giờ: 22:00 ngày 10/06 UTC = 05:00 sáng ngày 11/06 giờ VN → PHẢI là ngày mới.
check("mở 5h sáng VN hôm sau (vẫn cùng ngày UTC) → vẫn tính là ngày MỚI",
  nextActivity(after1, new Date("2026-06-10T22:00:00Z")),
  { last_active_at: "2026-06-10T22:00:00.000Z", last_active_day: "2026-06-11", active_days: 2, visit_count: 2 });

// Ngày mới nhưng vẫn trong 15 phút của lần trước (mở lúc gần nửa đêm rồi mở lại)
// → cộng ngày, KHÔNG cộng phiên.
const nearMidnight = { last_active_at: "2026-06-10T16:55:00Z", last_active_day: "2026-06-10", active_days: 3, visit_count: 9 };
check("qua nửa đêm VN trong cùng phiên → +1 ngày, KHÔNG +1 phiên",
  nextActivity(nearMidnight, new Date("2026-06-10T17:05:00Z")),
  { last_active_at: "2026-06-10T17:05:00.000Z", last_active_day: "2026-06-11", active_days: 4, visit_count: 9 });

// Dữ liệu hỏng không được làm sập bộ đếm.
check("mốc cũ là rác → coi như phiên mới, vẫn ghi được",
  nextActivity({ last_active_at: "khong-phai-ngay", last_active_day: "2026-06-10", active_days: 2, visit_count: 5 }, t0),
  { last_active_at: t0.toISOString(), last_active_day: "2026-06-10", active_days: 2, visit_count: 6 });

// ── Xếp mức hoạt động ──────────────────────────────────────────────────────
const now = new Date("2026-06-10T03:00:00Z");
const ago = (d) => new Date(now.getTime() - d * 86400000).toISOString();

check("chưa từng mở", activityLevel(null, now), "never");
check("mở hôm nay → đang dùng", activityLevel(ago(0), now), "active");
check("7 ngày → vẫn đang dùng (biên)", activityLevel(ago(7), now), "active");
check("8 ngày → thưa dần", activityLevel(ago(8), now), "idle");
check("30 ngày → vẫn thưa dần (biên)", activityLevel(ago(30), now), "idle");
check("31 ngày → ngủ đông", activityLevel(ago(31), now), "dormant");
check("90 ngày → vẫn ngủ đông (biên)", activityLevel(ago(90), now), "dormant");
check("91 ngày → đã bỏ", activityLevel(ago(91), now), "lost");

// ── Nhãn đọc được ──────────────────────────────────────────────────────────
check("nhãn hôm nay", lastActiveLabel(ago(0), now), "Hôm nay");
check("nhãn hôm qua", lastActiveLabel(ago(1), now), "Hôm qua");
check("nhãn nhiều ngày", lastActiveLabel(ago(12), now), "12 ngày trước");
check("nhãn chưa từng mở", lastActiveLabel(null, now), "Chưa từng mở");
// Lệch giờ máy chủ khiến mốc rơi vào tương lai — không được hiện số âm.
check("mốc ở tương lai → kẹp về 0, không ra số âm",
  daysSince(new Date(now.getTime() + 3 * 86400000).toISOString(), now), 0);

console.log(fail === 0 ? "\nTẤT CẢ ĐỀU ĐÚNG" : `\n${fail} kiểm thử SAI`);
process.exit(fail === 0 ? 0 : 1);
