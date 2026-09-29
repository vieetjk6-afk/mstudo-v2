/* Kiểm thử VOUCHER — mã thẻ, trạng thái, điều kiện dùng, hạn, tổng quan.
 * Nạp thẳng src/lib/vouchers.ts. */
import {
  makeVoucherCode, normalizeVoucherCode, voucherState, canRedeem, defaultExpiry, voucherSummary,
  voucherDiscount, voucherValueLabel, voucherLineName,
  isWeddingContract, phoneUnlocks, samePhoneNumber, voucherTerms,
} from "../../src/lib/vouchers.ts";

let fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};

/* ── mã ─────────────────────────────────────────────────────────────── */
check("mã theo khuôn QUA-XXXXXX", /^QUA-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/.test(makeVoucherCode()), true);
check("rand = 0 → ký tự đầu bảng", makeVoucherCode(() => 0), "QUA-222222");
check("rand sát 1 không tràn bảng", makeVoucherCode(() => 0.9999999), "QUA-ZZZZZZ");
check("không có ký tự dễ nhầm", Array.from({ length: 200 }, () => makeVoucherCode()).join("").replace(/QUA-/g, "").match(/[01OIL]/), null);
check("chuẩn hoá mã khách gõ", normalizeVoucherCode("  qua – 7k3 m9p "), "QUA-7K3M9P");

/* ── trạng thái ─────────────────────────────────────────────────────── */
const T = "2026-09-25";
const base = { status: "active", paid: true, expires_on: "2027-09-25" };
check("còn hiệu lực", voucherState(base, T), "usable");
check("chưa thu tiền", voucherState({ ...base, paid: false }, T), "unpaid");
check("hết hạn hôm qua", voucherState({ ...base, expires_on: "2026-09-24" }, T), "expired");
check("hạn đúng hôm nay vẫn dùng được", voucherState({ ...base, expires_on: T }, T), "usable");
check("không có hạn", voucherState({ ...base, expires_on: null }, T), "usable");
check("đã dùng thắng hết hạn", voucherState({ ...base, status: "redeemed", expires_on: "2020-01-01" }, T), "redeemed");
check("đã huỷ thắng mọi thứ", voucherState({ ...base, status: "void", paid: false }, T), "void");

check("dùng được", canRedeem(base, T), { ok: true });
check("không tìm thấy", canRedeem(null, T), { ok: false, error: "not_found" });
check("chưa thu tiền thì không dùng được", canRedeem({ ...base, paid: false }, T), { ok: false, error: "unpaid" });

/* ── hạn mặc định ────────────────────────────────────────────────────── */
check("12 tháng", defaultExpiry("2026-09-25"), "2027-09-25");
check("29/2 + 12 tháng → 28/2", defaultExpiry("2024-02-29"), "2025-02-28");
check("31/1 + 1 tháng → 28/2", defaultExpiry("2026-01-31", 1), "2026-02-28");
check("vắt năm", defaultExpiry("2026-11-15", 3), "2027-02-15");

/* ── tổng quan ───────────────────────────────────────────────────────── */
const v = (o) => ({ id: "x", code: "c", title: "t", amount: 2_000_000, price: 1_800_000, buyer_name: null, buyer_phone: null, recipient_name: null, paid: true, paid_method: null, paid_at: null, expires_on: null, status: "active", redeemed_contract_id: null, redeemed_at: null, note: null, created_at: "", ...o });
check("tổng quan", voucherSummary([
  v({}),
  v({ paid: false }),
  v({ status: "redeemed" }),
  v({ status: "void" }),
  v({ expires_on: "2020-01-01" }),
], T), { sold: 4, collected: 5_400_000, outstanding: 2_000_000, outstandingCount: 1, redeemed: 2_000_000 });

/* ── voucher ưu đãi lần sau ─────────────────────────────────────────── */
const pct = { kind: "loyalty", discount_type: "percent", percent: 10, max_discount: null, amount: 0 };
const fix = { kind: "loyalty", discount_type: "amount", percent: null, max_discount: null, amount: 500_000 };
check("% làm tròn xuống bội 1.000đ", voucherDiscount(pct, 12_345_678), 1_234_000);
check("% có trần", voucherDiscount({ ...pct, max_discount: 1_000_000 }, 15_000_000), 1_000_000);
check("% dưới trần giữ nguyên", voucherDiscount({ ...pct, max_discount: 5_000_000 }, 15_000_000), 1_500_000);
check("số tiền cố định", voucherDiscount(fix, 15_000_000), 500_000);
check("không giảm quá tổng hợp đồng", voucherDiscount(fix, 300_000), 300_000);
check("hợp đồng 0đ thì không giảm", voucherDiscount(pct, 0), 0);
check("tổng âm (toàn dòng giảm) không thành số âm", voucherDiscount(fix, -100), 0);
check("nhãn %", voucherValueLabel(pct), "Giảm 10%");
check("nhãn % có trần", voucherValueLabel({ ...pct, max_discount: 2_000_000 }), "Giảm 10% (tối đa 2.000.000đ)");
check("nhãn số tiền", voucherValueLabel(fix), "Giảm 500.000đ");
check("nhãn thẻ quà giữ như cũ", voucherValueLabel({ kind: "gift", discount_type: "amount", amount: 2_000_000 }), "2.000.000đ");
check("thẻ quà cũ (chưa có cột kind) vẫn là thẻ quà", voucherValueLabel({ amount: 2_000_000 }), "2.000.000đ");
check("dòng giảm giá mang mã voucher", voucherLineName({ ...pct, code: "UD-7K3M9P" }), "Voucher UD-7K3M9P · Giảm 10%");
check("không dùng ở chính HĐ đã tặng", canRedeem({ ...base, source_contract_id: "hd1" }, T, "hd1"), { ok: false, error: "same_contract" });
check("dùng ở HĐ khác được", canRedeem({ ...base, source_contract_id: "hd1" }, T, "hd2"), { ok: true });
check("hết hạn báo hết hạn trước", canRedeem({ ...base, source_contract_id: "hd1", expires_on: "2020-01-01" }, T, "hd1"), { ok: false, error: "expired" });
check("voucher ưu đãi không vào tổng tiền thẻ quà", voucherSummary([v({}), v({ kind: "loyalty", price: 0 })], T), { sold: 1, collected: 1_800_000, outstanding: 2_000_000, outstandingCount: 1, redeemed: 0 });

/* ── luật dùng voucher ưu đãi: SĐT mở khoá, chỉ gói phóng sự cưới ───────── */
const lv = { kind: "loyalty", buyer_phone: "0933 444 555" };
check("cùng SĐT khác định dạng", samePhoneNumber("+84933444555", "0933.444.555"), true);
check("SĐT ngắn không bao giờ khớp", samePhoneNumber("444555", "444555"), false);
check("chính người được tặng dùng được", phoneUnlocks(lv, "0933444555"), true);
check("người khác nhập đúng SĐT gốc dùng được", phoneUnlocks(lv, "0911222333", "0933444555"), true);
check("người khác không có SĐT gốc thì không", phoneUnlocks(lv, "0911222333", ""), false);
check("thẻ quà không cần SĐT", phoneUnlocks({ kind: "gift", buyer_phone: "0933444555" }, null), true);
check("voucher cũ không ghi SĐT không cần kiểm", phoneUnlocks({ kind: "loyalty", buyer_phone: null }, null), true);
check("gói phóng sự cưới theo tên hạng mục", isWeddingContract("photo", ["Cưới · Phóng sự x2"]), true);
check("PSC theo loại dịch vụ", isWeddingContract("psc", []), true);
check("prewedding không phải phóng sự cưới", isWeddingContract("prewedding", ["Chụp prewedding Đà Lạt"]), false);
check("kỷ yếu không phải", isWeddingContract("photo", ["Chụp kỷ yếu lớp 12A"]), false);
check("điều kiện in trên voucher", voucherTerms({ kind: "loyalty", applies_to: "wedding" }), [
  "Áp dụng cho gói phóng sự cưới.",
  "Tặng được người khác, khi dùng nhập đúng SĐT hợp đồng gốc.",
  "Không có giá trị quy đổi thành tiền mặt.",
]);

if (fail) {
  console.log(`\n${fail} kiểm thử HỎNG`);
  process.exit(1);
}
console.log("\nVoucher: mọi kiểm thử đều qua.");
