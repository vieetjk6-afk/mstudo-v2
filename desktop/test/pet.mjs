/* Kiểm thử luật chơi Bé Máy Ảnh (src/lib/pet.ts).
 *
 * Vì sao đáng test: chuỗi ngày điểm danh là thứ người chơi tiếc nhất. Đếm sai
 * một ngày (lệch múi giờ, hôm nay chưa điểm danh mà báo đứt chuỗi) là người
 * dùng thấy bị "cướp" thành quả — và bỏ game. XP tính lại từ các lượt nhận nên
 * mọi con số phải ra đúng chỉ từ danh sách đó.
 *
 * Nạp thẳng code thật.
 */
import {
  addDays, cleanName, dayDiff, feedXp, moodOf, outfitUnlocked, stageOf, streakOf, summarize, tasksFor,
  OUTFITS, STAGES,
} from "../../src/lib/pet.ts";

let fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};

const T = "2026-11-18";

// ── Ngày ──
check("dayDiff cùng ngày", dayDiff(T, T), 0);
check("dayDiff qua tháng", dayDiff("2026-10-31", "2026-11-01"), 1);
check("dayDiff qua năm nhuận", dayDiff("2028-02-28", "2028-03-01"), 2);
check("addDays lùi", addDays("2026-01-01", -1), "2025-12-31");

// ── Chuỗi ngày ──
check("chưa điểm danh lần nào", streakOf([], T), { current: 0, best: 0, fedToday: false, lastFed: null });
check(
  "3 ngày liền tới hôm nay",
  streakOf(["2026-11-16", "2026-11-17", T], T),
  { current: 3, best: 3, fedToday: true, lastFed: T },
);
check(
  "hôm nay CHƯA điểm danh không làm đứt chuỗi",
  streakOf(["2026-11-15", "2026-11-16", "2026-11-17"], T).current,
  3,
);
check(
  "bỏ một ngày (hôm qua) → chuỗi về 0, giữ kỷ lục",
  streakOf(["2026-11-14", "2026-11-15", "2026-11-16"], T),
  { current: 0, best: 3, fedToday: false, lastFed: "2026-11-16" },
);
check(
  "chuỗi mới ngắn hơn kỷ lục cũ",
  streakOf(["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-17", T], T),
  { current: 2, best: 4, fedToday: true, lastFed: T },
);
check("trùng ngày chỉ tính một", streakOf([T, T, "2026-11-17"], T).current, 2);
check("ngày tương lai (lệch đồng hồ) bị bỏ qua", streakOf(["2026-11-19"], T).current, 0);
check("chuỗi qua tháng", streakOf(["2026-10-31", "2026-11-01"], "2026-11-01").current, 2);

// ── XP điểm danh ──
check("lần đầu: 10 XP", feedXp(streakOf([], T)), 10);
check("ngày thứ 3 liên tiếp: 12 XP", feedXp(streakOf(["2026-11-16", "2026-11-17"], T)), 12);
const dai = Array.from({ length: 30 }, (_, i) => addDays(T, -30 + i));
check("chuỗi dài: tối đa 20 XP", feedXp(streakOf(dai, T)), 20);
check("vừa đứt chuỗi: về 10 XP", feedXp(streakOf(["2026-11-15"], T)), 10);

// ── Giai đoạn ──
check("0 XP là trứng", stageOf(0).index, 0);
check("49 XP vẫn là trứng, còn 1", [stageOf(49).index, stageOf(49).toNext], [0, 1]);
check("50 XP nở", stageOf(50).index, 1);
check("giữa đường 50→200", stageOf(125).progress, 0.5);
check("tối đa", [stageOf(99999).index, stageOf(99999).progress, stageOf(99999).next], [STAGES.length - 1, 1, null]);
check("XP âm/rác coi là 0", stageOf(-5).index, 0);

// ── Tâm trạng ──
check("mới tinh → đói", moodOf(null, T), "doi");
check("ăn hôm nay → vui", moodOf(T, T), "vui");
check("ăn hôm qua → đói", moodOf("2026-11-17", T), "doi");
check("3 ngày chưa ăn → buồn", moodOf("2026-11-15", T), "buon");

// ── Nhiệm vụ theo gói ──
check("gói free: điểm danh + album", tasksFor("none").map((t) => t.key), ["feed", "album"]);
check("gói Studio: đủ 4 việc", tasksFor("full").map((t) => t.key), ["feed", "album", "contract", "payment"]);

// ── Phụ kiện ──
const by = (k) => OUTFITS.find((o) => o.key === k);
check("nơ hồng khoá khi còn trứng", outfitUnlocked(by("no"), 0, 0), false);
check("nơ hồng mở khi nở", outfitUnlocked(by("no"), 1, 0), true);
check("nón lá mở nhờ chuỗi 7 ngày", outfitUnlocked(by("nonla"), 0, 7), true);
check("nón lá chưa mở ở chuỗi 6", outfitUnlocked(by("nonla"), 4, 6), false);

// ── Tên ──
check("gọt khoảng trắng", cleanName("  Bé   Mây \n"), "Bé Mây");
check("rỗng → null", cleanName("   "), null);
check("không phải chuỗi → null", cleanName(42), null);
check("cắt 24 ký tự (không cắt đôi emoji)", [...cleanName("📷".repeat(30))].length, 24);

// ── Tổng hợp ──
const claims = [
  { day: "2026-11-16", task: "feed", xp: 10 },
  { day: "2026-11-17", task: "feed", xp: 11 },
  { day: "2026-11-17", task: "album", xp: 15 },
  { day: T, task: "feed", xp: 12 },
  { day: T, task: "contract", xp: 20 },
];
const s = summarize(claims, T);
check("tổng XP cộng mọi lượt", s.xp, 68);
check("đã nở", s.stage.index, 1);
check("việc xong hôm nay theo thứ tự TASKS", s.doneToday, ["feed", "contract"]);
check("XP điểm danh hôm nay là số đã nhận", s.feedXp, 12);
check("tuần: 7 ngày, 3 ngày cuối có ăn", s.week.map((w) => w.fed), [false, false, false, false, true, true, true]);
check("tuần kết thúc hôm nay", s.week[6].day, T);
check("vui", s.mood, "vui");

if (fail) {
  console.error(`\n${fail} kiểm thử hỏng`);
  process.exit(1);
}
console.log("\nTất cả đạt.");
