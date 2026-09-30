// Chương trình voucher ưu đãi: % áp cho từng hợp đồng, giá trị, giai đoạn.
import assert from "node:assert/strict";
import { effectiveTiers, previewPercent, programStage, missingSteps, hasDeposit, readProgram } from "../../src/lib/voucher-program.ts";

let n = 0;
const t = (name, fn) => { fn(); n++; console.log("✓", name); };
const on = { enabled: true, percent: 5, max_discount: 2_000_000, valid_months: 12, title: "Voucher" };

const tiersOn = { ...on, tiers: [{ min: 0, percent: 5 }, { min: 20_000_000, percent: 8 }] };
t("chương trình tắt → không hợp đồng nào có voucher", () => {
  assert.deepEqual(effectiveTiers({ ...tiersOn, enabled: false }, null), []);
  assert.deepEqual(effectiveTiers(null, null), []);
});
t("hợp đồng theo chương trình / tắt riêng / % riêng", () => {
  assert.deepEqual(effectiveTiers(tiersOn, null), tiersOn.tiers);
  assert.deepEqual(effectiveTiers(tiersOn, 0), []);
  assert.deepEqual(effectiveTiers(tiersOn, 12), [{ min: 0, percent: 12 }]);
});
t("xem thử % theo giá trị hợp đồng sau", () => {
  assert.equal(previewPercent(tiersOn.tiers, 10_000_000), 5);
  assert.equal(previewPercent(tiersOn.tiers, 25_000_000), 8);
});
const base = { percent: 5, cancelled: false, clientSigned: false, depositConfirmed: false, studioSigned: false };
t("giai đoạn: chưa ký → lời mời", () => assert.equal(programStage(base), "teaser"));
t("ký rồi mà chưa cọc → chờ", () => assert.equal(programStage({ ...base, clientSigned: true, studioSigned: true }), "pending"));
t("ký + cọc nhưng studio chưa ký → chờ", () => assert.equal(programStage({ ...base, clientSigned: true, depositConfirmed: true }), "pending"));
t("đủ ba điều kiện → phát", () => assert.equal(programStage({ ...base, clientSigned: true, depositConfirmed: true, studioSigned: true }), "issued"));
t("hợp đồng huỷ thắng mọi thứ", () => assert.equal(programStage({ ...base, cancelled: true, clientSigned: true, depositConfirmed: true, studioSigned: true }), "cancelled"));
t("không có mốc → tắt", () => assert.equal(programStage({ ...base, percent: 0 }), "off"));
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
  assert.deepEqual(readProgram({ enabled: true, percent: 6 }).tiers, [{ min: 0, percent: 6 }], "chưa có cột mốc → một mức");
  assert.equal(readProgram({ enabled: true, percent: 7, valid_months: null }).valid_months, null);
  assert.deepEqual(readProgram({ enabled: true }).package_names, [], "chưa có cột → mọi gói");
  assert.deepEqual(readProgram({ enabled: true, package_names: ["Phóng sự x2", "", null] }).package_names, ["Phóng sự x2"]);
});
console.log(`\n${n} ca đạt`);
