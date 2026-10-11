/* Kiểm thử phần thuần của việc chốt báo giá → hợp đồng (src/lib/quote-lines.ts).
 *
 * Vì sao đáng test:
 *  • Ưu đãi gói (bulk_discount_amount) khách THẤY trên trang báo giá phải đi
 *    theo sang hợp đồng — trước đây bị bỏ quên, khách ký xong bị đòi giá gốc.
 *  • Cọc làm tròn 500K tối thiểu 500K → tổng 0 ra "Cọc Infinity%", tổng nhỏ
 *    ra cọc lớn hơn cả hợp đồng. Phải kẹp về [0, tổng].
 */
import { safeDeposit, depositPercent, activeBulkDiscount, quoteToContractLines } from "../../src/lib/quote-lines.ts";

let fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};

// ── Kẹp cọc ────────────────────────────────────────────────────────────────
check("tổng 0 → cọc 0", safeDeposit(0), 0);
check("tổng âm → cọc 0", safeDeposit(-1_000_000), 0);
check("tổng 300K → cọc không vượt tổng", safeDeposit(300_000), 300_000);
check("tổng 10tr → cọc 2.5tr", safeDeposit(10_000_000), 2_500_000);
check("phần trăm khi tổng 0 → 0 (không Infinity)", depositPercent(0, 500_000), 0);
check("phần trăm 10tr/2.5tr → 25", depositPercent(10_000_000, 2_500_000), 25);

// ── Ưu đãi gói ─────────────────────────────────────────────────────────────
const items = [
  { name: "Gói A - chụp", qty: 1, unit_price: 10_000_000, is_optional: true, selected: true, package_group: "Gói A" },
  { name: "Gói B - chụp", qty: 1, unit_price: 15_000_000, is_optional: true, selected: false, package_group: "Gói B" },
  { name: "Album thêm", description: "30x30", qty: 2, unit_price: 1_000_000, is_optional: true, selected: true },
  { name: "Giảm khách quen", qty: 1, unit_price: 500_000, is_optional: false, is_discount: true, selected: false },
];
const quoteA = { bulk_discount_amount: 2_000_000, discount_package_group: "Gói A" };
const quoteB = { bulk_discount_amount: 2_000_000, discount_package_group: "Gói B" };

check("chọn đúng gói ưu đãi → áp", activeBulkDiscount(quoteA, items), 2_000_000);
check("chọn gói khác → không áp", activeBulkDiscount(quoteB, items), 0);
check("không đặt gói → không áp", activeBulkDiscount({ bulk_discount_amount: 2_000_000, discount_package_group: null }, items), 0);

const rA = quoteToContractLines(quoteA, items);
check("dòng hợp đồng khi được ưu đãi", rA.lines, [
  { name: "Gói A - chụp", description: null, qty: 1, unit_price: 10_000_000 },
  { name: "Album thêm", description: "30x30", qty: 2, unit_price: 1_000_000 },
  { name: "🏷️ Giảm khách quen", description: null, qty: 1, unit_price: -500_000 },
  { name: "🏷️ Ưu đãi gói Gói A", description: null, qty: 1, unit_price: -2_000_000 },
]);
check("tổng đã trừ ưu đãi gói", rA.total, 9_500_000);
check("cọc tính trên tổng đã giảm", rA.deposit, 2_500_000);
check("phần trăm cọc", rA.depositPct, 26);

const rB = quoteToContractLines(quoteB, items);
check("không ưu đãi → không thêm dòng", rB.lines.length, 3);
check("tổng không ưu đãi", rB.total, 11_500_000);

const rZero = quoteToContractLines({}, [{ name: "Tặng", qty: 1, unit_price: 0, is_optional: false, selected: false }]);
check("tổng 0 → cọc 0, % 0", [rZero.total, rZero.deposit, rZero.depositPct], [0, 0, 0]);

check("không chọn gì → không dòng, không dòng ưu đãi", quoteToContractLines(quoteA, [
  { name: "Gói A", qty: 1, unit_price: 1, is_optional: true, selected: false, package_group: "Gói A" },
]).lines, []);

if (fail) {
  console.error(`\n${fail} kiểm thử hỏng`);
  process.exit(1);
}
console.log("\nTất cả đạt.");
