/* Kiểm thử NHÀ CUNG CẤP & ĐƠN ĐẶT NGOÀI.
 *
 * Hai chỗ dễ sai và cả hai đều làm studio đọc sai số:
 *
 *  1. Đơn ĐÃ GIAO KHÁCH mà vẫn bị tính là trễ hẹn. Danh sách sẽ đỏ mãi, và một
 *     màu đỏ không bao giờ tắt là màu đỏ người ta ngưng nhìn — đúng cái bẫy làm
 *     mọi badge cảnh báo mất tác dụng.
 *  2. Tiền của đơn đã giao vẫn bị cộng vào "đang treo". Studio tưởng còn nợ
 *     xưởng album vài chục triệu trong khi đã trả xong.
 *
 * Nạp thẳng code thật ở src/lib/vendors.ts.
 */
import {
  ORDER_STATUS,
  SOON_DAYS,
  VENDOR_KINDS,
  daysToDue,
  dueLabel,
  expenseFor,
  isClosed,
  lateness,
  nextStatus,
  orderStatusLabel,
  ordersOfContract,
  sortByUrgency,
  summarize,
  vendorKindLabel,
} from "../../src/lib/vendors.ts";

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

const TODAY = "2026-09-05";
const order = (o = {}) => ({
  id: "o1", vendorId: "v1", vendorName: "Xưởng Minh Anh", contractId: "hd1",
  title: "Album 30x30 cao cấp", amount: 3_500_000, status: "doing", dueDate: "2026-09-20", note: null, ...o,
});

/* ═══ Loại & trạng thái ══════════════════════════════════════════════════════ */

check("bảy loại nhà cung cấp", VENDOR_KINDS.length, 7);
check("nhãn loại", vendorKindLabel("album"), "Xưởng album");
check("loại lạ → Khác", vendorKindLabel("bay-gio-moi-nghe"), "Khác");
check("loại rỗng → Khác", vendorKindLabel(null), "Khác");

check("bốn trạng thái, đúng đường đi", [...ORDER_STATUS], ["sent", "doing", "received", "delivered"]);
check("nhãn trạng thái", orderStatusLabel("received"), "Đã nhận");
check("trạng thái lạ → về bước đầu, không nổ", orderStatusLabel("xyz"), "Đã gửi");

check("đã gửi → đang làm", nextStatus("sent"), "doing");
check("đang làm → đã nhận", nextStatus("doing"), "received");
check("đã nhận → đã giao khách", nextStatus("received"), "delivered");
check("đã giao khách → hết đường (null)", nextStatus("delivered"), null);

check("chỉ 'đã giao khách' mới là xong hẳn", [isClosed("delivered"), isClosed("received"), isClosed("sent")], [true, false, false]);

/* ═══ Trễ hẹn ════════════════════════════════════════════════════════════════ */

check("còn 15 ngày", daysToDue("2026-09-20", TODAY), 15);
check("quá hẹn 3 ngày → số âm", daysToDue("2026-09-02", TODAY), -3);
check("hẹn hôm nay → 0", daysToDue(TODAY, TODAY), 0);
check("chưa hẹn → null", daysToDue(null, TODAY), null);
check("ngày rác → null", daysToDue("tuần sau", TODAY), null);

check("cảnh báo trước 3 ngày", SOON_DAYS, 3);
check("còn 15 ngày → ok", lateness(order(), TODAY).level, "ok");
check("còn 3 ngày → sắp tới hẹn", lateness(order({ dueDate: "2026-09-08" }), TODAY).level, "soon");
check("hẹn hôm nay → sắp tới hẹn", lateness(order({ dueDate: TODAY }), TODAY).level, "soon");
check("quá hẹn → trễ", lateness(order({ dueDate: "2026-09-01" }), TODAY).level, "late");
check("chưa hẹn ngày → không doạ", lateness(order({ dueDate: null }), TODAY).level, "ok");

check(
  "đơn ĐÃ GIAO KHÁCH quá hẹn từ lâu → vẫn 'ok'; đỏ mãi là màu đỏ người ta ngưng nhìn",
  lateness(order({ status: "delivered", dueDate: "2026-01-01" }), TODAY).level,
  "ok"
);

check("nhãn hạn: quá hẹn", dueLabel(order({ dueDate: "2026-09-02" }), TODAY), "Quá hẹn 3 ngày");
check("nhãn hạn: hôm nay", dueLabel(order({ dueDate: TODAY }), TODAY), "Hẹn hôm nay");
check("nhãn hạn: còn ngày", dueLabel(order({ dueDate: "2026-09-08" }), TODAY), "Còn 3 ngày");
check("nhãn hạn: chưa hẹn", dueLabel(order({ dueDate: null }), TODAY), "Chưa hẹn ngày");
check(
  "đơn đã giao khách → nhãn nói NGÀY HẸN, không nói 'quá hẹn'",
  dueLabel(order({ status: "delivered", dueDate: "2026-01-01" }), TODAY),
  "Hẹn 01/01/2026"
);

/* ═══ Tổng hợp ═══════════════════════════════════════════════════════════════ */

{
  const list = [
    order({ id: "a", amount: 3_000_000, status: "doing", dueDate: "2026-09-01" }),      // trễ
    order({ id: "b", amount: 2_000_000, status: "sent", dueDate: "2026-09-07" }),       // sắp
    order({ id: "c", amount: 1_000_000, status: "received", dueDate: "2026-10-10" }),   // ok
    order({ id: "d", amount: 5_000_000, status: "delivered", dueDate: "2026-01-01" }),  // xong
  ];
  const s = summarize(list, TODAY);
  check("tổng tiền gồm CẢ đơn đã giao", s.total, 11_000_000);
  check(
    "tiền ĐANG TREO chỉ gồm đơn chưa giao — không thì studio tưởng còn nợ xưởng 5 triệu đã trả",
    s.open,
    6_000_000
  );
  check("đếm đúng số đơn", [s.count, s.openCount], [4, 3]);
  check("đếm trễ / sắp tới hẹn", [s.lateCount, s.soonCount], [1, 1]);
  ok("đơn đã giao KHÔNG bị đếm là trễ dù hẹn từ tháng 1", s.lateCount === 1);
}
check("danh sách rỗng → toàn 0, không nổ", summarize([], TODAY), {
  total: 0, open: 0, count: 0, openCount: 0, lateCount: 0, soonCount: 0,
});

/* ═══ Xếp theo mức cần chú ý ═════════════════════════════════════════════════ */

{
  const list = [
    order({ id: "xong", status: "delivered", dueDate: "2026-09-01" }),
    order({ id: "ok", status: "doing", dueDate: "2026-12-01" }),
    order({ id: "tre-nhieu", status: "doing", dueDate: "2026-08-20" }),
    order({ id: "sap", status: "doing", dueDate: "2026-09-06" }),
    order({ id: "tre-it", status: "doing", dueDate: "2026-09-03" }),
    order({ id: "chua-hen", status: "doing", dueDate: null }),
  ];
  check(
    "trễ trước (trễ lâu nhất lên đầu) → sắp tới hẹn → còn xa → đã giao khách xuống đáy",
    sortByUrgency(list, TODAY).map((o) => o.id),
    ["tre-nhieu", "tre-it", "sap", "ok", "chua-hen", "xong"]
  );
}

/* ═══ Lọc theo hợp đồng ══════════════════════════════════════════════════════ */

check(
  "chỉ lấy đơn của đúng hợp đồng",
  ordersOfContract([order({ id: "a" }), order({ id: "b", contractId: "hd2" }), order({ id: "c", contractId: null })], "hd1").map((o) => o.id),
  ["a"]
);

/* ═══ Dòng chi tương ứng ═════════════════════════════════════════════════════ */

{
  const e = expenseFor(order(), "2026-09-05");
  check("tiêu đề gồm tên đơn và tên nhà cung cấp", e.title, "Album 30x30 cao cấp — Xưởng Minh Anh");
  check(
    "ngày chi lấy theo NGÀY HẸN XONG, không phải ngày tạo — chi phí thuộc kỳ công việc được giao",
    e.spent_at,
    "2026-09-20"
  );
  check("phân loại chi là 'vendor' để tách khỏi chi phí tay", e.category, "vendor");
  check("số tiền đúng", e.amount, 3_500_000);
}
check(
  "chưa hẹn ngày → ngày chi rơi về ngày tạo đơn",
  expenseFor(order({ dueDate: null }), "2026-09-05").spent_at,
  "2026-09-05"
);
check(
  "không có tên nhà cung cấp → tiêu đề chỉ còn tên đơn, không có dấu gạch cụt",
  expenseFor(order({ vendorName: null }), "2026-09-05").title,
  "Album 30x30 cao cấp"
);
check("số tiền rác → 0, không ra NaN vào sổ chi", expenseFor(order({ amount: "ba triệu" }), "2026-09-05").amount, 0);

console.log(fail ? `\n${fail} kiểm thử KHÔNG đạt` : "\nTất cả kiểm thử đạt");
process.exit(fail ? 1 : 0);
