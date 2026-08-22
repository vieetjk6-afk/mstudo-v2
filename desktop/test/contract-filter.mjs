/* Kiểm thử bộ lọc trang "Quản lý hợp đồng" (src/lib/contract-filter.ts).
 * Nạp thẳng file .ts thật bằng type-stripping của Node — không phải bản chép
 * lại — nên test đúng code đang chạy. Các bẫy được nhắm tới:
 *  - HĐ không có ngày thực hiện khi đang lọc khoảng ngày (phải bị loại)
 *  - khoảng ngày là bao gồm hai đầu (inclusive)
 *  - tìm ngày gõ theo dd/mm/yyyy như đang hiện, không chỉ dạng ISO
 *  - HĐ đã hoàn thành phải TÁCH khỏi nhóm đang thực hiện
 *  - "Tất cả" ở nhóm đang thực hiện vẫn gồm nháp và đã huỷ, KHÔNG gồm hoàn thành
 *  - lọc mã / tìm kiếm không phân biệt hoa thường
 */
import {
  filterContracts, sortContracts, splitContracts,
  addDaysIso, isUpcoming, upcomingContracts, UPCOMING_DAYS,
} from "../../src/lib/contract-filter.ts";

const rows = [
  { code: "HD-001", title: "Cưới Hiền & Nương", client_name: "Hiền", client_phone: "0900000001", event_date: "2026-03-15", status: "approved" },
  { code: "HD-002", title: "Prewedding Đà Lạt", client_name: "Nương", client_phone: "0900000002", event_date: "2026-03-20", status: "draft" },
  { code: "hd-003", title: "Quay phóng sự cưới", client_name: "Trâm", client_phone: "0900000003", event_date: "2026-04-01", status: "completed" },
  { code: "HD-004", title: "Chụp kỷ yếu", client_name: "Khoa", client_phone: "0900000004", event_date: null, status: "in_progress" },
  { code: null, title: "Thuê áo dài", client_name: null, client_phone: null, event_date: "2026-03-15", status: "cancelled" },
  { code: "HD-006", title: "Trang điểm cô dâu", client_name: "Hiền", client_phone: "0900000006", event_date: "2026-05-09", status: "completed" },
];

const codes = (list) => list.map((c) => c.code ?? "(không mã)").join(",");
let fail = 0;
const check = (name, got, want) => {
  const ok = got === want;
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${got}\n    cần : ${want}`}`);
};

// ── Không lọc gì ────────────────────────────────────────────────────────────
check("không lọc → giữ nguyên cả 6", filterContracts(rows, {}).length, 6);

// ── Lọc theo mã ─────────────────────────────────────────────────────────────
check("mã 'HD-002'", codes(filterContracts(rows, { code: "HD-002" })), "HD-002");
check("mã không phân biệt hoa thường", codes(filterContracts(rows, { code: "HD-003" })), "hd-003");
check("mã một phần '00'", filterContracts(rows, { code: "00" }).length, 5);
check("HĐ không có mã bị loại khi lọc mã", filterContracts(rows, { code: "HD" }).some((c) => c.code === null), false);

// ── Khoảng ngày thực hiện ───────────────────────────────────────────────────
check(
  "từ 2026-03-15 → gồm cả đúng ngày đầu",
  codes(filterContracts(rows, { from: "2026-03-15" })),
  "HD-001,HD-002,hd-003,(không mã),HD-006"
);
check(
  "đến 2026-03-20 → gồm cả đúng ngày cuối",
  codes(filterContracts(rows, { to: "2026-03-20" })),
  "HD-001,HD-002,(không mã)"
);
check(
  "khoảng 2026-03-16..2026-04-01",
  codes(filterContracts(rows, { from: "2026-03-16", to: "2026-04-01" })),
  "HD-002,hd-003"
);
check(
  "HĐ chưa có ngày thực hiện bị loại khi lọc khoảng ngày",
  filterContracts(rows, { from: "2020-01-01", to: "2030-01-01" }).some((c) => c.event_date === null),
  false
);
check("khoảng ngày rỗng → không loại ai", filterContracts(rows, { from: "", to: "" }).length, 6);

// ── Tìm kiếm ────────────────────────────────────────────────────────────────
check("tìm theo tên HĐ", codes(filterContracts(rows, { q: "prewedding" })), "HD-002");
check("tìm theo tên khách (2 HĐ)", codes(filterContracts(rows, { q: "hiền" })), "HD-001,HD-006");
check("tìm theo ngày dd/mm/yyyy", codes(filterContracts(rows, { q: "15/03/2026" })), "HD-001,(không mã)");
check("tìm theo ngày dạng ISO", codes(filterContracts(rows, { q: "2026-04-01" })), "hd-003");
check("tìm theo tháng/năm '03/2026'", codes(filterContracts(rows, { q: "03/2026" })), "HD-001,HD-002,(không mã)");
check("tìm theo mã qua ô tìm chung", codes(filterContracts(rows, { q: "hd-004" })), "HD-004");
check("tìm theo SĐT", codes(filterContracts(rows, { q: "0900000006" })), "HD-006");
check("tìm không khớp → rỗng", filterContracts(rows, { q: "khong-co-gi" }).length, 0);
check("HĐ thiếu khách/mã không làm vỡ tìm kiếm", codes(filterContracts(rows, { q: "áo dài" })), "(không mã)");

// ── Tách nhóm hoàn thành ────────────────────────────────────────────────────
const all = filterContracts(rows, {});
check("nhóm đang thực hiện KHÔNG có HĐ hoàn thành", codes(splitContracts(all, "active", "all")), "HD-001,HD-002,HD-004,(không mã)");
check("nhóm hoàn thành chỉ có HĐ hoàn thành", codes(splitContracts(all, "completed", "all")), "hd-003,HD-006");
check("tổng hai nhóm = tổng đã lọc", splitContracts(all, "active", "all").length + splitContracts(all, "completed", "all").length, all.length);
check("'Tất cả' ở nhóm đang thực hiện vẫn gồm nháp", splitContracts(all, "active", "all").some((c) => c.status === "draft"), true);
check("'Tất cả' ở nhóm đang thực hiện vẫn gồm đã huỷ", splitContracts(all, "active", "all").some((c) => c.status === "cancelled"), true);
check("lọc trạng thái trong nhóm đang thực hiện", codes(splitContracts(all, "active", "draft")), "HD-002");
check("lọc trạng thái không ảnh hưởng nhóm hoàn thành", codes(splitContracts(all, "completed", "draft")), "hd-003,HD-006");

// ── Kết hợp lọc + tách nhóm ─────────────────────────────────────────────────
const q1 = filterContracts(rows, { q: "hiền" });
check("tìm 'hiền' → nhóm đang thực hiện", codes(splitContracts(q1, "active", "all")), "HD-001");
check("tìm 'hiền' → nhóm hoàn thành", codes(splitContracts(q1, "completed", "all")), "HD-006");

// ── Sắp xếp ─────────────────────────────────────────────────────────────────
check("mặc định giữ nguyên thứ tự server (mới tạo trước)", codes(sortContracts(rows, "default")), codes(rows));
check("sortContracts KHÔNG sửa mảng gốc", (sortContracts(rows, "event_desc"), codes(rows)), codes(rows));
check(
  "ngày thực hiện cũ → mới, HĐ thiếu ngày xuống cuối",
  codes(sortContracts(rows, "event_asc")),
  "HD-001,(không mã),HD-002,hd-003,HD-006,HD-004"
);
check(
  "ngày thực hiện mới → cũ, HĐ thiếu ngày VẪN xuống cuối",
  codes(sortContracts(rows, "event_desc")),
  "HD-006,hd-003,HD-002,HD-001,(không mã),HD-004"
);
check(
  "mã A → Z, HĐ không có mã xuống cuối",
  codes(sortContracts(rows, "code_asc")),
  "HD-001,HD-002,hd-003,HD-004,HD-006,(không mã)"
);
check(
  "mã Z → A, HĐ không có mã VẪN xuống cuối",
  codes(sortContracts(rows, "code_desc")),
  "HD-006,HD-004,hd-003,HD-002,HD-001,(không mã)"
);
// Cùng ngày thực hiện (HD-001 và HĐ không mã đều 15/03) → thứ tự phải ổn định.
check(
  "cùng ngày thì chốt thứ tự, không nhảy giữa các lần gọi",
  codes(sortContracts(rows, "event_asc")),
  codes(sortContracts([...rows].reverse(), "event_asc"))
);
// Mã có số không đệm 0: "HD-2" phải trước "HD-10".
const numeric = [
  { code: "HD-10", title: "j", client_name: null, client_phone: null, event_date: null, status: "draft" },
  { code: "HD-2", title: "b", client_name: null, client_phone: null, event_date: null, status: "draft" },
  { code: "HD-1", title: "a", client_name: null, client_phone: null, event_date: null, status: "draft" },
];
check("mã có số so sánh theo số, không theo chuỗi", codes(sortContracts(numeric, "code_asc")), "HD-1,HD-2,HD-10");

// Sắp xếp phải giữ nguyên kết quả lọc/tách nhóm.
const activeSorted = sortContracts(splitContracts(all, "active", "all"), "event_asc");
check("sắp xếp không thêm/bớt HĐ nào của nhóm", activeSorted.length, splitContracts(all, "active", "all").length);
check("sắp xếp không kéo HĐ hoàn thành vào nhóm đang thực hiện", activeSorted.some((c) => c.status === "completed"), false);

/* ── Tab "Sắp tới N ngày" ────────────────────────────────────────────────────
 * Bẫy ở đây: cửa sổ ngày phải BAO GỒM cả hôm nay và cả ngày cuối; HĐ đã hoàn
 * thành / đã huỷ không còn là việc phải chuẩn bị; và hai buổi cùng ngày phải
 * xếp theo giờ, buổi chưa ghi giờ xuống cuối ngày đó chứ không nhảy lên đầu.
 */
const TODAY = "2026-03-15";
const up = [
  { code: "U-1", title: "chiều nay", client_name: null, client_phone: null, event_date: TODAY, event_time: "15:00", status: "approved" },
  { code: "U-2", title: "sáng nay", client_name: null, client_phone: null, event_date: TODAY, event_time: "07:30", status: "draft" },
  { code: "U-3", title: "chưa ghi giờ, cùng hôm nay", client_name: null, client_phone: null, event_date: TODAY, event_time: null, status: "sent" },
  { code: "U-4", title: "đúng ngày cuối cửa sổ", client_name: null, client_phone: null, event_date: "2026-03-22", event_time: null, status: "approved" },
  { code: "U-5", title: "quá cửa sổ 1 ngày", client_name: null, client_phone: null, event_date: "2026-03-23", event_time: null, status: "approved" },
  { code: "U-6", title: "hôm qua", client_name: null, client_phone: null, event_date: "2026-03-14", event_time: null, status: "approved" },
  { code: "U-7", title: "trong tuần nhưng đã hoàn thành", client_name: null, client_phone: null, event_date: "2026-03-18", event_time: null, status: "completed" },
  { code: "U-8", title: "trong tuần nhưng đã huỷ", client_name: null, client_phone: null, event_date: "2026-03-18", event_time: null, status: "cancelled" },
  { code: "U-9", title: "chưa có ngày chụp", client_name: null, client_phone: null, event_date: null, event_time: null, status: "approved" },
];

check("cửa sổ mặc định là 7 ngày", UPCOMING_DAYS, 7);
check("cộng ngày vắt qua tháng", addDaysIso("2026-03-28", 7), "2026-04-04");
check("cộng ngày vắt qua năm", addDaysIso("2026-12-30", 7), "2027-01-06");
check("năm nhuận", addDaysIso("2028-02-26", 7), "2028-03-04");
check("chuỗi ngày rác → rỗng, không ném lỗi", addDaysIso("hôm nay", 7), "");

check("buổi CHIỀU NAY vẫn là việc sắp tới", isUpcoming(up[0], TODAY), true);
check("buổi HÔM QUA không phải việc sắp tới", isUpcoming(up[5], TODAY), false);
check("đúng ngày cuối cửa sổ vẫn tính", isUpcoming(up[3], TODAY), true);
check("quá cửa sổ một ngày là loại", isUpcoming(up[4], TODAY), false);
check("HĐ đã hoàn thành không nằm trong việc sắp tới", isUpcoming(up[6], TODAY), false);
check("HĐ đã huỷ không nằm trong việc sắp tới", isUpcoming(up[7], TODAY), false);
check("HĐ nháp VẪN tính — ngày đã chốt, chỉ chưa gửi khách", isUpcoming(up[1], TODAY), true);
check("HĐ chưa có ngày chụp thì không thể sắp tới", isUpcoming(up[8], TODAY), false);

check("xếp gần nhất lên đầu, cùng ngày thì theo giờ, thiếu giờ xuống cuối ngày",
  upcomingContracts(up, TODAY).map((c) => c.code).join(","),
  "U-2,U-1,U-3,U-4");

// Cửa sổ hẹp lại thì chỉ còn buổi trong cửa sổ đó.
check("đổi số ngày thì cửa sổ đổi theo",
  upcomingContracts(up, TODAY, 0).map((c) => c.code).join(","), "U-2,U-1,U-3");

// Không được sửa mảng gốc (rows là state React + cache trên máy).
const before = up.map((c) => c.code).join(",");
upcomingContracts(up, TODAY);
check("không sắp xếp tại chỗ mảng gốc", up.map((c) => c.code).join(","), before);

console.log(fail ? `\n${fail} kiểm thử KHÔNG đạt` : "\nTất cả kiểm thử đạt");
process.exit(fail ? 1 : 0);
