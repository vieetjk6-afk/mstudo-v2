/* Kiểm thử NHẮC KỶ NIỆM.
 *
 * Đây là code sai âm thầm: sai một ngày thì studio gửi lời chúc "kỷ niệm ngày
 * cưới" vào đúng hôm sau, còn sai cửa sổ thì cả danh sách trống trơn mà không
 * ai biết là do lọc chứ không phải do không có khách. Bốn cái bẫy:
 *
 *   1. 29/2 cộng năm. `new Date(2024,1,29)` cộng 1 năm bằng cách ngây thơ ra
 *      01/3/2025 — nhắc sai ngày là hỏng cả ý nghĩa lời chúc.
 *   2. Cửa sổ phải có phần LÙI VỀ QUÁ KHỨ: studio mở app hai tuần một lần.
 *   3. Buổi chụp ở TƯƠNG LAI chưa có kỷ niệm nào; hợp đồng huỷ thì không chúc.
 *   4. Xếp thứ tự: gần nhất trước, cùng ngày thì mốc lớn hơn trước.
 *
 * Nạp thẳng code thật ở src/lib/anniversary.ts.
 */
import {
  addYears, daysBetween, milestoneKind, milestoneMessage, upcomingMilestones,
} from "../../src/lib/anniversary.ts";

let fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};

/* ── addYears ───────────────────────────────────────────────────────────── */
check("cộng 1 năm bình thường", addYears("2024-06-15", 1), "2025-06-15");
check("cộng 5 năm", addYears("2021-11-02", 5), "2026-11-02");
// Bẫy 1 — ngày nhuận.
check("29/2 + 1 năm → 28/2 (không nhảy sang 1/3)", addYears("2024-02-29", 1), "2025-02-28");
check("29/2 + 4 năm → vẫn 29/2 (năm nhuận)", addYears("2024-02-29", 4), "2028-02-29");
check("31/1 + 1 năm giữ nguyên 31", addYears("2024-01-31", 1), "2025-01-31");

/* ── daysBetween ────────────────────────────────────────────────────────── */
check("cùng ngày", daysBetween("2026-09-03", "2026-09-03"), 0);
check("sau 10 ngày", daysBetween("2026-09-03", "2026-09-13"), 10);
check("trước 3 ngày là số âm", daysBetween("2026-09-03", "2026-08-31"), -3);
// Vắt qua năm — chỗ hay lệch nếu tính bằng giờ địa phương.
check("vắt qua năm", daysBetween("2025-12-30", "2026-01-02"), 3);

/* ── milestoneKind ──────────────────────────────────────────────────────── */
check("chụp cưới", milestoneKind("wedding", null), "wedding");
check("nhận ra chữ 'cưới' trong tiêu đề", milestoneKind(null, "Chụp cưới Lan & Khôi"), "wedding");
check("ăn hỏi cũng là cưới", milestoneKind(null, "Lễ ăn hỏi nhà anh Nam"), "wedding");
check("chụp bé", milestoneKind("baby", null), "baby");
check("thôi nôi là bé", milestoneKind(null, "Thôi nôi bé Bơ"), "baby");
check("kỷ yếu không phải cưới hay bé", milestoneKind(null, "Kỷ yếu 12A3"), "generic");

/* ── upcomingMilestones ─────────────────────────────────────────────────── */
const TODAY = "2026-09-03";
const base = { id: "c1", client_name: "Chị Lan", client_phone: "0912345678", shoot_type: "wedding" };

// Cưới 12/9/2025 → tròn 1 năm vào 12/9/2026, còn 9 ngày nữa.
const r1 = upcomingMilestones([{ ...base, title: "Cưới Lan & Khôi", event_date: "2025-09-12" }], TODAY);
check("tìm ra mốc 1 năm", r1.length, 1);
check("đúng ngày kỷ niệm", r1[0]?.date, "2026-09-12");
check("còn 9 ngày", r1[0]?.inDays, 9);
check("đúng loại", r1[0]?.kind, "wedding");

// Bẫy 2 — mốc VỪA QUA vẫn phải hiện (chúc muộn còn hơn không).
const r2 = upcomingMilestones([{ ...base, event_date: "2025-08-30" }], TODAY);
check("mốc vừa qua 4 ngày vẫn hiện", r2.length, 1);
check("số ngày là âm", r2[0]?.inDays, -4);
// …nhưng qua quá lâu thì thôi.
check(
  "mốc qua 40 ngày thì bỏ",
  upcomingMilestones([{ ...base, event_date: "2025-07-25" }], TODAY).length,
  0,
);

// Ngoài cửa sổ phía trước.
check(
  "mốc còn 120 ngày thì chưa nhắc",
  upcomingMilestones([{ ...base, event_date: "2026-01-05" }], TODAY).length,
  0,
);

// Bẫy 3.
check(
  "buổi chụp ở tương lai → chưa có kỷ niệm",
  upcomingMilestones([{ ...base, event_date: "2026-09-20" }], TODAY).length,
  0,
);
check(
  "hợp đồng huỷ thì không chúc",
  upcomingMilestones([{ ...base, event_date: "2025-09-12", status: "cancelled" }], TODAY).length,
  0,
);
check(
  "không có ngày chụp thì bỏ qua",
  upcomingMilestones([{ ...base, event_date: null }], TODAY).length,
  0,
);

// Chỉ nhắc mốc tròn: 2 năm KHÔNG nằm trong danh sách.
check(
  "mốc 2 năm không được nhắc",
  upcomingMilestones([{ ...base, event_date: "2024-09-12" }], TODAY).length,
  0,
);
check(
  "mốc 3 năm thì có",
  upcomingMilestones([{ ...base, event_date: "2023-09-12" }], TODAY)[0]?.years,
  3,
);

// Bẫy 4 — xếp thứ tự.
const many = upcomingMilestones(
  [
    { ...base, id: "a", event_date: "2025-09-25" }, // 1 năm, còn 22 ngày
    { ...base, id: "b", event_date: "2021-09-05" }, // 5 năm, còn 2 ngày
    { ...base, id: "c", event_date: "2025-09-05" }, // 1 năm, còn 2 ngày
  ],
  TODAY,
);
check("gần nhất đứng trước", many.map((m) => m.contractId), ["b", "c", "a"]);

// Một hợp đồng đủ cũ có thể chạm nhiều mốc, nhưng mỗi năm chỉ một mốc rơi vào
// cửa sổ — không được đẻ ra bốn dòng cho cùng một khách.
check(
  "một hợp đồng chỉ ra một mốc trong cửa sổ",
  upcomingMilestones([{ ...base, event_date: "2016-09-10" }], TODAY).length,
  1,
);

/* ── milestoneMessage ───────────────────────────────────────────────────── */
const msg = milestoneMessage({ clientName: "chị Lan", kind: "wedding", years: 1, studio: "Mai Studio" });
check("lời chúc có tên khách", msg.includes("chị Lan"), true);
check("lời chúc có số năm", msg.includes("1 năm"), true);
check("lời chúc ký tên studio", msg.includes("— Mai Studio"), true);
check(
  "không có tên khách thì xưng anh/chị",
  milestoneMessage({ kind: "generic", years: 3 }).includes("anh/chị"),
  true,
);
check(
  "lời chúc cho bé khác lời chúc cưới",
  milestoneMessage({ kind: "baby", years: 1 }).includes("tròn 1 tuổi"),
  true,
);

console.log(fail ? `\n${fail} MỤC SAI` : "\nTẤT CẢ ĐỀU ĐÚNG");
process.exit(fail ? 1 : 0);
