/* Kiểm thử CHẤM CÔNG THỢ.
 *
 * Đây là số liệu dẫn tới TIỀN TRẢ CHO NGƯỜI THẬT, nên hai chỗ tuyệt đối không
 * được sai:
 *
 *  1. Dòng CÒN HỞ (thợ bấm bắt đầu, quên bấm xong) không được tính là 0 giờ.
 *     Tính 0 nghĩa là bảng lương báo thợ đi làm cả ngày mà không được đồng nào,
 *     và không ai phát hiện ra vì con số vẫn "có". Phải trả `null` và đếm riêng
 *     để studio xử lý tay.
 *  2. Đơn giá chưa khai thì KHÔNG đề xuất 0₫. Ai bấm "áp dụng" sẽ xoá mất số đã
 *     nhập tay trước đó.
 *
 * Nạp thẳng code thật ở src/lib/timesheet.ts.
 */
import {
  MAX_SESSION_HOURS,
  ROUND_MINUTES,
  availabilityOn,
  digitsOnly,
  hoursByContract,
  humanHours,
  sessionHours,
  sessionState,
  slotLabel,
  suggestPay,
  summarizeByPerson,
} from "../../src/lib/timesheet.ts";

let fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};
const ok = (name, cond, note = "") => {
  if (!cond) fail++;
  console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : `  ${note}`}`);
};

const D = "2026-09-05";
const at = (hm) => `${D}T${hm}:00+07:00`;
const row = (o = {}) => ({
  id: "t1", phone: "0912345678", name: "Anh Tú", contractId: "hd1",
  workDate: D, startedAt: at("08:00"), endedAt: at("17:00"), note: null, ...o,
});

/* ═══ Giờ của một dòng ═══════════════════════════════════════════════════════ */

check("08:00 → 17:00 = 9 giờ", sessionHours(row()), 9);
check("làm tròn về bội số 15 phút (8:00→12:07 ≈ 4 giờ)", sessionHours(row({ endedAt: at("12:07") })), 4);
check("8:00 → 12:08 làm tròn lên 4,25 giờ", sessionHours(row({ endedAt: at("12:08") })), 4.25);
check("bội số làm tròn là 15 phút", ROUND_MINUTES, 15);

check(
  "CHƯA bấm xong → null, KHÔNG phải 0 (0 nghĩa là thợ làm không lương)",
  sessionHours(row({ endedAt: null })),
  null
);
check("chưa bấm bắt đầu → null", sessionHours(row({ startedAt: null })), null);
check("bấm xong TRƯỚC lúc bắt đầu → null (dữ liệu sai)", sessionHours(row({ endedAt: at("07:00") })), null);
check("bấm xong ĐÚNG lúc bắt đầu → null (0 giờ không phải một buổi làm)", sessionHours(row({ endedAt: at("08:00") })), null);
check("mốc thời gian rác → null", sessionHours(row({ startedAt: "hôm qua" })), null);
check(
  `dài hơn ${MAX_SESSION_HOURS} giờ → null, coi như quên bấm xong`,
  sessionHours(row({ endedAt: `2026-09-06T09:00:00+07:00` })),
  null
);
{
  // Qua đêm HỢP LỆ (chụp tiệc tối tới khuya): phải tính được, không bị coi là sai.
  const overnight = sessionHours(row({ startedAt: at("19:00"), endedAt: "2026-09-06T02:00:00+07:00" }));
  check("chụp tiệc 19:00 → 02:00 hôm sau = 7 giờ", overnight, 7);
}

/* ═══ Trạng thái dòng ════════════════════════════════════════════════════════ */

check("đủ hai mốc, hợp lý → done", sessionState(row()), "done");
check("thiếu giờ xong → open (đang làm)", sessionState(row({ endedAt: null })), "open");
check("thiếu giờ bắt đầu → invalid", sessionState(row({ startedAt: null })), "invalid");
check("xong trước bắt đầu → invalid", sessionState(row({ endedAt: at("07:00") })), "invalid");
check(
  "quá dài → suspicious (không im lặng bỏ qua, cũng không tính vào tiền)",
  sessionState(row({ endedAt: "2026-09-06T09:00:00+07:00" })),
  "suspicious"
);

/* ═══ Cộng theo người ════════════════════════════════════════════════════════ */

check("chuẩn hoá SĐT", digitsOnly(" 091-234.5678 "), "0912345678");

{
  const rows = [
    row({ id: "a", startedAt: at("08:00"), endedAt: at("12:00") }),                 // 4 giờ
    row({ id: "b", startedAt: at("13:00"), endedAt: at("17:30") }),                 // 4,5 giờ
    row({ id: "c", startedAt: at("18:00"), endedAt: null }),                        // còn hở
    row({ id: "d", phone: "0987654321", name: "Chị Hà", startedAt: at("09:00"), endedAt: at("11:00") }), // 2 giờ
  ];
  const s = summarizeByPerson(rows);
  check("gom đúng hai người, xếp theo giờ giảm dần", s.map((p) => [p.name, p.hours, p.sessions]), [
    ["Anh Tú", 8.5, 2],
    ["Chị Hà", 2, 1],
  ]);
  check("dòng còn hở được ĐẾM RIÊNG, không cộng vào giờ", s[0].openCount, 1);
  check("không có dòng lỗi", s[0].problemCount, 0);
}

{
  // Cùng một người nhập SĐT có dấu gạch → vẫn phải gom về một dòng.
  const rows = [
    row({ id: "a", phone: "0912345678", endedAt: at("12:00") }),
    row({ id: "b", phone: "091-234-5678", startedAt: at("13:00"), endedAt: at("15:00") }),
  ];
  check("SĐT khác định dạng vẫn gom về MỘT người", summarizeByPerson(rows).length, 1);
  check("và cộng đủ giờ của cả hai dòng", summarizeByPerson(rows)[0].hours, 6);
}

{
  // Một dòng thiếu tên: bảng không được hiện SĐT trần khi dòng khác đã có tên.
  const rows = [
    row({ id: "a", name: null, endedAt: at("10:00") }),
    row({ id: "b", name: "Anh Tú", startedAt: at("11:00"), endedAt: at("13:00") }),
  ];
  check("lấy được tên từ dòng có tên", summarizeByPerson(rows)[0].name, "Anh Tú");
}

check("dòng không có SĐT bị bỏ (không có ai để trả tiền)", summarizeByPerson([row({ phone: "" })]), []);
check("danh sách rỗng → không nổ", summarizeByPerson([]), []);

{
  const rows = [
    row({ id: "a", startedAt: at("08:00"), endedAt: "2026-09-06T09:00:00+07:00" }), // quá dài
    row({ id: "b", startedAt: null }),                                              // thiếu mốc
  ];
  const s = summarizeByPerson(rows);
  check("hai dòng lỗi → 0 giờ, đếm 2 vấn đề", [s[0].hours, s[0].problemCount, s[0].sessions], [0, 2, 0]);
}

/* ═══ Cộng theo hợp đồng ═════════════════════════════════════════════════════ */

{
  const rows = [
    row({ id: "a", contractId: "hd1", endedAt: at("12:00") }),                       // 4
    row({ id: "b", contractId: "hd1", startedAt: at("13:00"), endedAt: at("16:00") }), // 3
    row({ id: "c", contractId: "hd2", startedAt: at("09:00"), endedAt: at("11:00") }), // 2
    row({ id: "d", contractId: null, startedAt: at("09:00"), endedAt: at("10:00") }),  // không gắn HĐ
    row({ id: "e", contractId: "hd1", endedAt: null }),                              // còn hở
  ];
  check("cộng giờ theo từng job, bỏ dòng còn hở và dòng không gắn HĐ", hoursByContract(rows), { hd1: 7, hd2: 2 });
}

/* ═══ Đề xuất tiền công ══════════════════════════════════════════════════════ */

check("8 giờ × 80.000₫ = 640.000₫", suggestPay(8, 80_000), 640_000);
check("làm tròn tới nghìn đồng", suggestPay(4.25, 77_777), 331_000);
check(
  "CHƯA khai đơn giá → null, KHÔNG đề xuất 0₫ (0₫ sẽ xoá mất số nhập tay)",
  suggestPay(8, 0),
  null
);
check("đơn giá thiếu → null", suggestPay(8, null), null);
check("đơn giá âm → null", suggestPay(8, -50_000), null);
check("0 giờ → null (không đề xuất gì)", suggestPay(0, 80_000), null);

check("6,5 giờ đọc thành lời", humanHours(6.5), "6 giờ 30 phút");
check("tròn giờ không thêm '0 phút'", humanHours(3), "3 giờ");
check("dưới một giờ chỉ nói phút", humanHours(0.75), "45 phút");
check("0 giờ", humanHours(0), "0 phút");

/* ═══ Khoảng rảnh ════════════════════════════════════════════════════════════ */

const slot = (date, start = null, end = null) => ({ date, start, end });

check(
  "thợ tự báo BẬN → bận, dù cũng có khai rảnh (lời báo bận là mới hơn và cụ thể hơn)",
  availabilityOn(D, [slot(D, "08:00", "12:00")], [slot(D)]),
  "busy"
);
check("có khai rảnh, không báo bận → rảnh", availabilityOn(D, [slot(D, "08:00", "12:00")], []), "free");
check(
  "CHƯA khai gì → 'chưa rõ', KHÔNG phải 'rảnh' (phần lớn thợ không bao giờ vào khai)",
  availabilityOn(D, [], []),
  "unknown"
);
check("khai rảnh ngày KHÁC → ngày này vẫn chưa rõ", availabilityOn(D, [slot("2026-09-06")], []), "unknown");

check("khoảng cả ngày", slotLabel(slot(D)), "Cả ngày");
check("khoảng có giờ", slotLabel(slot(D, "08:00", "12:00")), "08:00–12:00");
check("chỉ có giờ bắt đầu", slotLabel(slot(D, "08:00", null)), "từ 08:00");
check("chỉ có giờ kết thúc", slotLabel(slot(D, null, "12:00")), "tới 12:00");

console.log(fail ? `\n${fail} kiểm thử KHÔNG đạt` : "\nTất cả kiểm thử đạt");
process.exit(fail ? 1 : 0);
