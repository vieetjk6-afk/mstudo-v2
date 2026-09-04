/* Kiểm thử HOÁ ĐƠN & XUẤT KẾ TOÁN.
 *
 * Đây là những con số ĐI RA NGOÀI studio: phiếu thu đưa tận tay khách, bản xuất
 * đưa kế toán. Sai ở đây không phải một lỗi giao diện — nó là một tờ giấy sai
 * nằm trong tay người khác.
 *
 * Ba chỗ được canh kỹ nhất:
 *  1. Ba con số trên phiếu thu (lần này / đã thu / còn lại) phải cộng khớp nhau.
 *  2. Hợp đồng ĐÃ HUỶ không được nằm trong công nợ — nếu không, "khách còn nợ"
 *     bị thổi lên và studio đi đòi tiền một hợp đồng đã huỷ.
 *  3. Luật khoá sổ phải chặn đúng chiều: ngày TRƯỚC mốc bị khoá, ngày SAU thì không.
 *
 * Nạp thẳng code thật ở src/lib/accounting.ts.
 */
import {
  categoryLabel,
  endOfMonth,
  inPeriod,
  isLocked,
  lockedMessage,
  periodSummary,
  receiptNo,
  receiptPrintData,
  receivables,
  totalReceivable,
  yearOf,
  blocksWrite,
  blockedWriteMessage,
} from "../../src/lib/accounting.ts";

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

/* ═══ Số phiếu thu ═══════════════════════════════════════════════════════════ */

check("số phiếu theo nếp Việt Nam", receiptNo(7, 2026), "PT-2026-0007");
check("số lớn không bị cắt", receiptNo(12345, 2026), "PT-2026-12345");
check("số 0 hoặc âm → về 1 (không có phiếu số 0)", receiptNo(0, 2026), "PT-2026-0001");
check("năm lấy từ ngày", yearOf("2027-03-15", 2026), 2027);
check("ngày rác → dùng năm dự phòng", yearOf("hôm nay", 2026), 2026);
check("ngày rỗng → dùng năm dự phòng", yearOf(null, 2026), 2026);

/* ═══ Phiếu thu ══════════════════════════════════════════════════════════════ */

const STUDIO = { name: "Studio Ánh Dương", phone: "0912345678", address: "12 Trần Duy Hưng, Hà Nội" };
const base = {
  no: "PT-2026-0003",
  paidOn: "05/09/2026",
  amount: 10_000_000,
  kindLabel: "Chuyển khoản",
  note: "Đợt 2",
  studio: STUDIO,
  client: { name: "Minh & Lan", phone: "0987654321", address: null },
  contract: { title: "Chụp cưới trọn gói", code: "HD-2026-014" },
  contractTotal: 40_000_000,
  paidBefore: 15_000_000,
};

{
  const d = receiptPrintData(base);
  check("dùng lại khung in hợp đồng, đổi tiêu đề thành PHIẾU THU", d.heading, "PHIẾU THU");
  check("mã trên giấy là SỐ PHIẾU, không phải mã hợp đồng", d.code, "PT-2026-0003");

  const totals = Object.fromEntries(d.totals.map((t) => [t.label, t.amount]));
  check("số tiền lần này", totals["Số tiền thu lần này"], 10_000_000);
  check("đã thu = trước đó + lần này", totals["Đã thu (gồm lần này)"], 25_000_000);
  check("còn lại = tổng − đã thu", totals["Còn lại"], 15_000_000);
  ok(
    "ba con số cộng khớp nhau — khách cầm giấy về đối chiếu",
    totals["Đã thu (gồm lần này)"] + totals["Còn lại"] === totals["Tổng giá trị hợp đồng"]
  );

  check("có dòng đọc số thành chữ", d.amountInWords, 10_000_000);
  check("hai ô ký: người nộp và người thu", d.signs.map((s) => s.label), ["Người nộp tiền", "Người thu tiền"]);
  ok("mã hợp đồng vẫn xuất hiện trong phần thông tin", d.facts.some((f) => f.value === "HD-2026-014"));
  ok("ghi chú được in khi có", d.facts.some((f) => f.value === "Đợt 2"));
}
{
  const d = receiptPrintData({ ...base, note: null });
  ok("không có ghi chú → không in dòng trống", !d.facts.some((f) => f.label === "Nội dung"));
}
{
  // Khách trả DƯ (rồi studio hoàn sau): tờ giấy đưa khách KHÔNG được ghi số âm.
  const d = receiptPrintData({ ...base, amount: 30_000_000, paidBefore: 15_000_000 });
  const totals = Object.fromEntries(d.totals.map((t) => [t.label, t.amount]));
  check("thu vượt hợp đồng → 'còn lại' kẹp ở 0, không in số âm", totals["Còn lại"], 0);
}
{
  const d = receiptPrintData({ ...base, paidBefore: 0, amount: 40_000_000 });
  const totals = Object.fromEntries(d.totals.map((t) => [t.label, t.amount]));
  check("thu một lần đủ → còn lại 0", totals["Còn lại"], 0);
}

/* ═══ Kỳ ═════════════════════════════════════════════════════════════════════ */

check("trong kỳ", inPeriod("2026-09-15", "2026-09-01", "2026-09-30"), true);
check("đúng ngày đầu kỳ → tính", inPeriod("2026-09-01", "2026-09-01", "2026-09-30"), true);
check("đúng ngày cuối kỳ → tính", inPeriod("2026-09-30", "2026-09-01", "2026-09-30"), true);
check("trước kỳ → không", inPeriod("2026-08-31", "2026-09-01", "2026-09-30"), false);
check("sau kỳ → không", inPeriod("2026-10-01", "2026-09-01", "2026-09-30"), false);
check("ngày rác → không", inPeriod("chưa rõ", "2026-09-01", "2026-09-30"), false);

/* ═══ Cộng sổ theo kỳ ════════════════════════════════════════════════════════ */

{
  const income = [
    { date: "2026-09-03", amount: 10_000_000, label: "Cọc HD-014" },
    { date: "2026-09-20", amount: 15_000_000, label: "Đợt 2 HD-014" },
    { date: "2026-08-28", amount: 99_000_000, label: "Ngoài kỳ" },
  ];
  const expense = [
    { date: "2026-09-05", amount: 3_500_000, label: "Album", category: "vendor" },
    { date: "2026-09-06", amount: 1_500_000, label: "Makeup", category: "vendor" },
    { date: "2026-09-10", amount: 5_000_000, label: "Mặt bằng", category: "rent" },
    { date: "2026-10-02", amount: 77_000_000, label: "Ngoài kỳ", category: "rent" },
  ];
  const s = periodSummary(income, expense, "2026-09-01", "2026-09-30");
  check("thu trong kỳ", s.income, 25_000_000);
  check("chi trong kỳ", s.expense, 10_000_000);
  check("lợi nhuận gộp", s.profit, 15_000_000);
  check("đếm đúng số bút toán", [s.incomeCount, s.expenseCount], [2, 3]);
  check(
    "chi theo nhóm: gộp đúng, xếp giảm dần theo tiền, BẰNG TIỀN thì theo bảng chữ cái (ổn định)",
    s.byCategory,
    [
      { category: "Mặt bằng", amount: 5_000_000, count: 1 },
      { category: "Nhà cung cấp", amount: 5_000_000, count: 2 },
    ]
  );
  {
    // Khác tiền thì tiền quyết định, không phải bảng chữ cái.
    const s2 = periodSummary([], [
      { date: "2026-09-05", amount: 1_000_000, label: "x", category: "vendor" },
      { date: "2026-09-06", amount: 9_000_000, label: "y", category: "rent" },
    ], "2026-09-01", "2026-09-30");
    check("nhóm chi nhiều tiền hơn lên trước", s2.byCategory.map((c) => c.category), ["Mặt bằng", "Nhà cung cấp"]);
  }
  ok("bút toán NGOÀI kỳ không lọt vào tổng", s.income !== 124_000_000 && s.expense !== 87_000_000);
}
check("kỳ rỗng → toàn 0", periodSummary([], [], "2026-09-01", "2026-09-30"), {
  income: 0, expense: 0, profit: 0, incomeCount: 0, expenseCount: 0, byCategory: [],
});
{
  const s = periodSummary([], [{ date: "2026-09-05", amount: 100, label: "x", category: null }], "2026-09-01", "2026-09-30");
  check("chi không ghi nhóm → gộp vào 'Khác'", s.byCategory[0].category, "Khác");
}
check("nhãn nhóm chi", categoryLabel("vendor"), "Nhà cung cấp");
check("nhóm lạ giữ nguyên tên studio tự gõ", categoryLabel("thuê drone"), "thuê drone");

/* ═══ Công nợ ════════════════════════════════════════════════════════════════ */

{
  const rows = [
    { contractId: "a", code: "HD-01", title: "A", clientName: "Khách A", eventDate: "2026-09-01", status: "in_progress", total: 40_000_000, paid: 15_000_000 },
    { contractId: "b", code: "HD-02", title: "B", clientName: "Khách B", eventDate: "2026-08-01", status: "completed", total: 20_000_000, paid: 20_000_000 },
    { contractId: "c", code: "HD-03", title: "C", clientName: "Khách C", eventDate: "2026-07-01", status: "cancelled", total: 30_000_000, paid: 0 },
    { contractId: "d", code: "HD-04", title: "D", clientName: "Khách D", eventDate: "2026-09-10", status: "approved", total: 60_000_000, paid: 10_000_000 },
    { contractId: "e", code: "HD-05", title: "E", clientName: "Khách E", eventDate: "2026-09-11", status: "in_progress", total: 10_000_000, paid: 12_000_000 },
  ];
  const r = receivables(rows);
  check(
    "chỉ hợp đồng CÒN THIẾU tiền, xếp theo số nợ giảm dần",
    r.map((x) => [x.code, x.remaining]),
    [["HD-04", 50_000_000], ["HD-01", 25_000_000]]
  );
  ok("hợp đồng ĐÃ HUỶ bị loại — không đi đòi tiền một HĐ đã huỷ", !r.some((x) => x.code === "HD-03"));
  ok("hợp đồng đã thu đủ bị loại", !r.some((x) => x.code === "HD-02"));
  ok("hợp đồng thu DƯ bị loại (không phải công nợ)", !r.some((x) => x.code === "HD-05"));
  check("tổng công nợ", totalReceivable(r), 75_000_000);
}
check("không có công nợ → tổng 0", totalReceivable([]), 0);

/* ═══ Khoá sổ ════════════════════════════════════════════════════════════════ */

check("ngày TRƯỚC mốc khoá → bị khoá", isLocked("2026-08-15", "2026-08-31"), true);
check("đúng mốc khoá → bị khoá", isLocked("2026-08-31", "2026-08-31"), true);
check("ngày SAU mốc → không khoá", isLocked("2026-09-01", "2026-08-31"), false);
check("chưa khoá kỳ nào → không khoá gì", isLocked("2020-01-01", null), false);
check("mốc khoá rác → không khoá (không chặn oan)", isLocked("2026-08-15", "tháng trước"), false);
check("ngày rác → không khoá", isLocked(null, "2026-08-31"), false);

check("cuối tháng 9", endOfMonth("2026-09"), "2026-09-30");
check("cuối tháng 2 năm thường", endOfMonth("2026-02"), "2026-02-28");
check("cuối tháng 2 năm NHUẬN", endOfMonth("2028-02"), "2028-02-29");
check("cuối tháng 12", endOfMonth("2026-12"), "2026-12-31");
check("tháng 13 → null, không bịa ngày", endOfMonth("2026-13"), null);
check("chuỗi rác → null", endOfMonth("nãy giờ"), null);

ok("câu báo khoá sổ nói ngày theo kiểu Việt Nam", /31\/08\/2026/.test(lockedMessage("2026-08-31")));
ok("và chỉ đường mở khoá", /mở khoá/.test(lockedMessage("2026-08-31")));

/* ═══ Hàng rào khoá sổ ═══════════════════════════════════════════════════════
   Luật này có HAI bản: trigger guard_books_closed() dưới DB (hàng rào thật) và
   blocksWrite() ở đây (để giao diện nói trước một câu tử tế, và để test được).
   Hai bản lệch nhau là giao diện nói được mà DB chối — nên phần này canh kỹ. */

const CLOSED = "2026-08-31";
const blocked = (o) => blocksWrite({ closedUntil: CLOSED, ...o });

check("thêm bút toán vào kỳ ĐÃ KHOÁ → chặn", blocked({ op: "insert", newDate: "2026-08-15" }), true);
check("thêm vào kỳ CHƯA khoá → cho qua", blocked({ op: "insert", newDate: "2026-09-15" }), false);
check("thêm đúng ngày mốc → chặn (mốc là ngày cuối ĐÃ chốt)", blocked({ op: "insert", newDate: CLOSED }), true);
check("xoá bút toán trong kỳ đã khoá → chặn", blocked({ op: "delete", oldDate: "2026-08-15" }), true);
check("xoá bút toán ngoài kỳ khoá → cho qua", blocked({ op: "delete", oldDate: "2026-09-15" }), false);

check(
  "sửa TIỀN của bút toán trong kỳ đã khoá → chặn",
  blocked({ op: "update", oldDate: "2026-08-15", newDate: "2026-08-15", moneyChanged: true }),
  true
);
check(
  "DỜI bút toán RA KHỎI kỳ đã khoá → vẫn chặn (cũng là làm đổi số của kỳ đó)",
  blocked({ op: "update", oldDate: "2026-08-15", newDate: "2026-09-15", moneyChanged: true }),
  true
);
check(
  "dời một bút toán MỚI VÀO kỳ đã khoá → chặn",
  blocked({ op: "update", oldDate: "2026-09-15", newDate: "2026-08-15", moneyChanged: true }),
  true
);
check(
  "sửa KHÔNG động tới tiền (đóng số phiếu, đính ảnh, sửa ghi chú) → CHO QUA",
  blocked({ op: "update", oldDate: "2026-08-15", newDate: "2026-08-15", moneyChanged: false }),
  false
);
ok(
  "…và đó là điều giữ cho việc IN LẠI phiếu thu cũ không đòi mở khoá sổ",
  blocked({ op: "update", oldDate: "2026-01-05", newDate: "2026-01-05", moneyChanged: false }) === false
);

check("chưa khoá kỳ nào → không chặn gì", blocksWrite({ op: "delete", closedUntil: null, oldDate: "2020-01-01" }), false);
check("mốc khoá rác → không chặn oan", blocksWrite({ op: "delete", closedUntil: "hôm qua", oldDate: "2020-01-01" }), false);
check("cả hai ngày đều trống → không chặn", blocked({ op: "update", moneyChanged: true }), false);

ok("câu báo nói ngày kiểu Việt Nam và chỉ đường mở khoá",
  /31\/08\/2026/.test(blockedWriteMessage(CLOSED)) && /mở khoá/.test(blockedWriteMessage(CLOSED)));

console.log(fail ? `\n${fail} kiểm thử KHÔNG đạt` : "\nTất cả kiểm thử đạt");
process.exit(fail ? 1 : 0);
