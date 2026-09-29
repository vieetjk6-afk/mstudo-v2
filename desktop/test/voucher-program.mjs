// Chương trình voucher ưu đãi: % áp cho từng hợp đồng, giá trị, giai đoạn.
import assert from "node:assert/strict";
import { effectivePercent, programAmount, programStage, missingSteps, hasDeposit, readProgram } from "../../src/lib/voucher-program.ts";

let n = 0;
const t = (name, fn) => { fn(); n++; console.log("✓", name); };
const on = { enabled: true, percent: 5, max_discount: 2_000_000, valid_months: 12, title: "Voucher" };

t("chương trình tắt → không hợp đồng nào có voucher", () => {
  assert.equal(effectivePercent({ ...on, enabled: false }, null), 0);
  assert.equal(effectivePercent({ ...on, enabled: false }, 10), 0);
  assert.equal(effectivePercent(null, null), 0);
});
t("hợp đồng theo chương trình / tắt riêng / % riêng", () => {
  assert.equal(effectivePercent(on, null), 5);
  assert.equal(effectivePercent(on, 0), 0);
  assert.equal(effectivePercent(on, 8), 8);
});
t("giá trị: % × tổng, làm tròn xuống 1.000đ, có trần", () => {
  assert.equal(programAmount(20_000_000, 5, null), 1_000_000);
  assert.equal(programAmount(12_345_678, 5, null), 617_000);
  assert.equal(programAmount(60_000_000, 5, 2_000_000), 2_000_000);
  assert.equal(programAmount(0, 5, null), 0);
});
const base = { percent: 5, amount: 1_000_000, cancelled: false, clientSigned: false, depositConfirmed: false, studioSigned: false };
t("giai đoạn: chưa ký → lời mời", () => assert.equal(programStage(base), "teaser"));
t("ký rồi mà chưa cọc → chờ", () => assert.equal(programStage({ ...base, clientSigned: true, studioSigned: true }), "pending"));
t("ký + cọc nhưng studio chưa ký → chờ", () => assert.equal(programStage({ ...base, clientSigned: true, depositConfirmed: true }), "pending"));
t("đủ ba điều kiện → phát", () => assert.equal(programStage({ ...base, clientSigned: true, depositConfirmed: true, studioSigned: true }), "issued"));
t("hợp đồng huỷ thắng mọi thứ", () => assert.equal(programStage({ ...base, cancelled: true, clientSigned: true, depositConfirmed: true, studioSigned: true }), "cancelled"));
t("giá trị 0 → tắt", () => assert.equal(programStage({ ...base, amount: 0 }), "off"));
t("liệt kê việc còn thiếu", () => {
  assert.deepEqual(missingSteps({ ...base, clientSigned: true }), ["Studio xác nhận đã nhận cọc", "Studio ký xác nhận hợp đồng"]);
});
t("cọc = lần thu thật, không tính hoàn tiền / trừ voucher", () => {
  assert.equal(hasDeposit([]), false);
  assert.equal(hasDeposit([{ amount: 2_000_000, kind: "voucher" }, { amount: 500_000, kind: "refund" }]), false);
  assert.equal(hasDeposit([{ amount: 3_000_000, kind: "installment" }]), true);
});
t("đọc cài đặt: chưa có dòng → mặc định TẮT", () => {
  assert.equal(readProgram(null).enabled, false);
  assert.equal(readProgram({ enabled: true, percent: 7, valid_months: null }).valid_months, null);
});
console.log(`\n${n} ca đạt`);
