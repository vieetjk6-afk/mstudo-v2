/* Kiểm thử VOUCHER — mã thẻ, trạng thái, điều kiện dùng, hạn, tổng quan.
 * Nạp thẳng src/lib/vouchers.ts. */
import {
  makeVoucherCode, normalizeVoucherCode, voucherState, canRedeem, defaultExpiry, voucherSummary,
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

if (fail) {
  console.log(`\n${fail} kiểm thử HỎNG`);
  process.exit(1);
}
console.log("\nVoucher: mọi kiểm thử đều qua.");
