/* Kiểm thử luật xếp lịch hẹn studio (trang điểm / thử đồ / chụp / tư vấn).
 *
 * Vì sao đáng test: đây là code SAI ÂM THẦM. Không có gì nổ, không có gì đỏ —
 * chỉ có studio xếp hai buổi trang điểm chồng giờ vào cùng một người, hoặc thanh
 * công suất phòng báo 40% khi phòng đã kín. Ba loại bẫy:
 *
 *   • Cộng ngày / tìm thứ Hai: lệch một ngày là cả lưới tuần lệch một cột.
 *   • So trùng giờ: hai buổi CHẠM nhau (08:00–09:00 và 09:00–10:00) KHÔNG trùng;
 *     hở một phút là báo trùng oan, mà báo oan vài lần là studio tắt cảnh báo.
 *   • Lịch chưa ghi giờ kết thúc: phải coi là chiếm 60 phút, chứ không phải
 *     "không chiếm chỗ" — nếu không thì buổi nào thiếu giờ kết thúc là buổi đó
 *     tàng hình với bộ dò trùng lịch.
 *
 * Nạp thẳng code thật ở src/lib/appointment-rules.ts.
 */
import {
  addDays, mondayOf, weekDays, toMinutes, apptSpan, apptDuration, apptTimeRange,
  findConflicts, roomLoads, countByKind, assigneeKey,
} from "../../src/lib/appointment-rules.ts";

let fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};

/* ── Ngày & tuần ─────────────────────────────────────────────────────────── */
check("cộng ngày trong tháng", addDays("2026-07-12", 3), "2026-07-15");
check("cộng ngày vắt qua tháng", addDays("2026-07-30", 3), "2026-08-02");
check("cộng ngày vắt qua năm", addDays("2026-12-30", 3), "2027-01-02");
check("lùi ngày vắt qua tháng", addDays("2026-03-01", -1), "2026-02-28");
check("năm nhuận: 28/02 + 1 = 29/02", addDays("2028-02-28", 1), "2028-02-29");

// Tuần bắt đầu THỨ HAI. 12/07/2026 là Chủ nhật — bẫy kinh điển: getDay() cho 0
// nên phép "trừ getDay()" sẽ nhảy về Chủ nhật của tuần SAU.
check("Chủ nhật 12/07/2026 → thứ Hai 06/07", mondayOf("2026-07-12"), "2026-07-06");
check("thứ Hai 06/07/2026 → chính nó", mondayOf("2026-07-06"), "2026-07-06");
check("thứ Ba 07/07/2026 → 06/07", mondayOf("2026-07-07"), "2026-07-06");
check("tuần đủ 7 ngày T2→CN", weekDays("2026-07-09"), [
  "2026-07-06", "2026-07-07", "2026-07-08", "2026-07-09", "2026-07-10", "2026-07-11", "2026-07-12",
]);

/* ── Giờ ─────────────────────────────────────────────────────────────────── */
check("đọc 'HH:MM'", toMinutes("06:30"), 390);
check("đọc 'HH:MM:SS' (Postgres time)", toMinutes("06:30:00"), 390);
check("giờ rỗng → null (chưa đặt giờ, KHÔNG phải 0h)", toMinutes(""), null);
check("giờ vô nghĩa → null", toMinutes("25:00"), null);
check("phút vô nghĩa → null", toMinutes("10:99"), null);

const t = (start_time, end_time, duration_min = null) => ({ start_time, end_time, duration_min });
check("có giờ kết thúc → dùng nó", apptSpan(t("06:30", "08:00")), { start: 390, end: 480 });
check("không giờ kết thúc, có thời lượng → cộng thời lượng", apptSpan(t("06:30", null, 90)), { start: 390, end: 480 });
check("không cả hai → mặc định 60 phút (vẫn chiếm chỗ)", apptSpan(t("06:30", null)), { start: 390, end: 450 });
check("giờ kết thúc TRƯỚC giờ bắt đầu → bỏ, lùi về 60 phút", apptSpan(t("06:30", "05:00")), { start: 390, end: 450 });
check("chưa đặt giờ → null", apptSpan(t(null, null)), null);

check("thời lượng dưới 1 giờ", apptDuration(t("06:30", "07:30")), "1 giờ");
check("thời lượng 90 phút → 1g30", apptDuration(t("06:30", "08:00")), "1g30");
check("thời lượng 45 phút → phút", apptDuration(t("06:30", "07:15")), "45 phút");
check("thời lượng 3g30", apptDuration(t("06:00", "09:30")), "3g30");
check("khoảng giờ đầy đủ", apptTimeRange(t("06:30", "08:00")), "06:30 – 08:00");
check("chỉ có giờ bắt đầu → chỉ hiện giờ đó", apptTimeRange(t("06:30", null, 90)), "06:30");
check("chưa đặt giờ → 'Cả ngày'", apptTimeRange(t(null, null)), "Cả ngày");

/* ── Trùng lịch ──────────────────────────────────────────────────────────── */
const appt = (o) => ({
  id: o.id, kind: o.kind ?? "makeup", appt_date: o.date, status: o.status ?? "scheduled",
  position: o.position ?? 0, start_time: o.start ?? null, end_time: o.end ?? null,
  duration_min: o.dur ?? null, crew_id: o.crew ?? null, staff_id: o.staff ?? null,
  crew_name: o.name ?? null, room: o.room ?? null,
});

const D = "2026-07-08";
// Hai buổi CHẠM nhau, không chồng nhau.
check("08:00–09:00 và 09:00–10:00 cùng người → KHÔNG trùng",
  findConflicts([appt({ id: "a", date: D, start: "08:00", end: "09:00", crew: "c1" }),
                 appt({ id: "b", date: D, start: "09:00", end: "10:00", crew: "c1" })]).length, 0);
// Hở một phút thì mới là trùng.
check("08:00–09:00 và 08:59–10:00 cùng người → TRÙNG",
  findConflicts([appt({ id: "a", date: D, start: "08:00", end: "09:00", crew: "c1" }),
                 appt({ id: "b", date: D, start: "08:59", end: "10:00", crew: "c1" })])
    .filter((c) => c.scope === "person").map((c) => c.items.map((i) => i.id)), [["a", "b"]]);
check("cùng giờ nhưng KHÁC người → không trùng",
  findConflicts([appt({ id: "a", date: D, start: "08:00", end: "09:00", crew: "c1" }),
                 appt({ id: "b", date: D, start: "08:00", end: "09:00", crew: "c2" })]).length, 0);
check("cùng giờ, cùng người, KHÁC ngày → không trùng",
  findConflicts([appt({ id: "a", date: D, start: "08:00", end: "09:00", crew: "c1" }),
                 appt({ id: "b", date: "2026-07-09", start: "08:00", end: "09:00", crew: "c1" })]).length, 0);
check("lịch đã HUỶ không gây trùng",
  findConflicts([appt({ id: "a", date: D, start: "08:00", end: "09:00", crew: "c1" }),
                 appt({ id: "b", date: D, start: "08:00", end: "09:00", crew: "c1", status: "cancelled" })]).length, 0);
check("lịch CHƯA ĐẶT GIỜ không bị báo trùng oan",
  findConflicts([appt({ id: "a", date: D, start: "08:00", end: "09:00", crew: "c1" }),
                 appt({ id: "b", date: D, crew: "c1" })]).length, 0);
// Buổi thiếu giờ kết thúc vẫn chiếm 60 phút → phải bị bắt.
check("buổi thiếu giờ kết thúc vẫn chiếm 60 phút nên vẫn bắt được trùng",
  findConflicts([appt({ id: "a", date: D, start: "08:00", crew: "c1" }),
                 appt({ id: "b", date: D, start: "08:30", end: "09:30", crew: "c1" })])
    .filter((c) => c.scope === "person").length, 1);
// Cùng PHÒNG cũng là trùng, kể cả khi hai người khác nhau.
check("hai người khác nhau nhưng CÙNG PHÒNG, chồng giờ → trùng phòng",
  findConflicts([appt({ id: "a", date: D, start: "08:00", end: "09:00", crew: "c1", room: "Phòng trang điểm 1" }),
                 appt({ id: "b", date: D, start: "08:30", end: "09:30", crew: "c2", room: "phòng trang điểm 1" })])
    .map((c) => c.scope), ["room"]);
// Ba buổi chồng nhau phải gom vào MỘT mục, không phải ba cặp rời.
check("ba buổi chồng nhau của một người → một mục, ba buổi",
  findConflicts([appt({ id: "a", date: D, start: "08:00", end: "11:00", crew: "c1" }),
                 appt({ id: "b", date: D, start: "09:00", end: "10:00", crew: "c1", position: 1 }),
                 appt({ id: "c", date: D, start: "09:30", end: "10:30", crew: "c1", position: 2 })])
    .filter((c) => c.scope === "person").map((c) => c.items.map((i) => i.id)), [["a", "b", "c"]]);

// Ghép người theo TÊN khi chưa gắn sổ thợ / tài khoản (studio gõ tay).
check("chưa gắn thợ nhưng cùng TÊN (khác hoa thường) → vẫn tính một người",
  assigneeKey({ crew_id: null, staff_id: null, crew_name: " Hải Đăng " }),
  assigneeKey({ crew_id: null, staff_id: null, crew_name: "hải đăng" }));
check("không người, không tên → không khoá (không gom bừa vào 'chưa phân công')",
  assigneeKey({ crew_id: null, staff_id: null, crew_name: "  " }), null);
check("hai buổi CHƯA PHÂN CÔNG chồng giờ → không báo trùng",
  findConflicts([appt({ id: "a", date: D, start: "08:00", end: "09:00" }),
                 appt({ id: "b", date: D, start: "08:30", end: "09:30" })]).length, 0);

/* ── Công suất phòng & đếm theo loại ─────────────────────────────────────── */
const rooms = [
  { id: "r1", name: "Phòng trang điểm 1", capacity_week: 10 },
  { id: "r2", name: "Phim trường", capacity_week: 4 },
  { id: "r3", name: "Phòng váy tầng 2", capacity_week: 0 }, // mẫu số 0 → không được chia cho 0
];
const week = [
  appt({ id: "1", date: D, room: "Phòng trang điểm 1" }),
  appt({ id: "2", date: D, room: "phòng trang điểm 1  " }), // khác hoa thường + khoảng trắng
  appt({ id: "3", date: D, room: "Phim trường", kind: "pre" }),
  appt({ id: "4", date: D, room: "Phim trường", kind: "pre", status: "cancelled" }), // đã huỷ, không tính
  appt({ id: "5", date: D, room: null, kind: "consult" }), // chưa xếp phòng
];
check("ghép phòng theo tên bất kể hoa thường / khoảng trắng",
  roomLoads(week, rooms).map((l) => [l.room.id, l.used, l.pct]),
  [["r1", 2, 20], ["r2", 1, 25], ["r3", 0, 0]]);
check("công suất không bao giờ vượt 100%",
  roomLoads(Array.from({ length: 30 }, (_, i) => appt({ id: `x${i}`, date: D, room: "Phim trường" })), rooms)
    .find((l) => l.room.id === "r2").pct, 100);

check("đếm theo loại, bỏ lịch đã huỷ", countByKind(week), { makeup: 2, pre: 1, consult: 1 });

console.log(fail === 0 ? "\nTẤT CẢ ĐỀU ĐÚNG" : `\n${fail} kiểm thử SAI`);
process.exit(fail === 0 ? 0 : 1);
