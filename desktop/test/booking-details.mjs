// Chi tiết đặt lịch (nhiều gói, ngày chính/phụ, cô dâu/chú rể) — kiểm phần
// máy chủ lọc dữ liệu khách gửi và phần tóm tắt thành chữ.
import { bookingDetailLines, cleanBookingDetails, looksLikeWedding } from "../../src/lib/booking-details.ts";

let fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};

check("rác → null", cleanBookingDetails("abc"), null);
check("rỗng → null", cleanBookingDetails({ packages: [], extra_days: [], bride: {} }), null);

const d = cleanBookingDetails({
  packages: [{ name: " Phóng sự x1 ", price: 4500000 }, { name: "Album 30x30", price: -5 }, { name: "" }],
  event_label: "Lễ nhà gái",
  extra_days: [{ label: "Lễ nhà trai", date: "2026-12-26" }, { label: "Sai", date: "26/12" }, { date: "2026-12-27" }],
  bride: { name: "Thu Lan", phone: "0901 234 567", address: "12 Lê Lợi" },
  groom: { name: "", phone: "", address: "" },
  hack: "<script>",
});
check("gói: cắt khoảng trắng, giá âm → null, bỏ gói không tên", d.packages, [{ name: "Phóng sự x1", price: 4500000 }, { name: "Album 30x30", price: null }]);
check("ngày phụ: bỏ sai định dạng, thiếu tên → 'Ngày phụ'", d.extra_days, [{ label: "Lễ nhà trai", date: "2026-12-26" }, { label: "Ngày phụ", date: "2026-12-27" }]);
check("cô dâu: SĐT chỉ còn số", d.bride, { name: "Thu Lan", phone: "0901234567", address: "12 Lê Lợi" });
check("chú rể toàn rỗng → bỏ", d.groom, undefined);
check("khoá lạ bị bỏ", "hack" in d, false);
check("tóm tắt thành chữ", bookingDetailLines(d, { includePackages: true }), [
  "Gói: Phóng sự x1, Album 30x30",
  "Ngày chính: Lễ nhà gái",
  "Ngày phụ: Lễ nhà trai 26/12/2026",
  "Ngày phụ: Ngày phụ 27/12/2026",
  "Cô dâu: Thu Lan · 0901234567 · 12 Lê Lợi",
]);
check("nhận ra đám cưới", [looksLikeWedding("Cưới · Phóng sự x1"), looksLikeWedding("Gói quay Plus"), looksLikeWedding(null, "ăn hỏi")], [true, false, true]);

if (fail) {
  console.error(`\n${fail} kiểm tra hỏng.`);
  process.exit(1);
}
console.log("\nTất cả kiểm tra đều qua.");
