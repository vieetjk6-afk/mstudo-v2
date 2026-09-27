// Mốc Zalo "đã thanh toán đủ": khi nào coi là đủ tiền, mặc định bật cho studio
// đang dùng, và nội dung tin gửi khách.
import assert from "node:assert/strict";
import { eventCfg, isFullyPaid, LATE_DEFAULT_EVENTS } from "../../src/lib/zalo/events.ts";
import { paymentDoneMessage } from "../../src/lib/zalo/messages.ts";

let n = 0;
const t = (name, fn) => {
  fn();
  n++;
  console.log("✓", name);
};

t("đủ tiền khi tổng thu ≥ giá trị hợp đồng", () => {
  assert.equal(isFullyPaid(15_000_000, 15_000_000), true);
  assert.equal(isFullyPaid(15_000_000, 15_500_000), true);
  assert.equal(isFullyPaid(15_000_000, 14_999_999), false);
  assert.equal(isFullyPaid(0, 0), false, "hợp đồng 0đ không phải 'đã thanh toán đủ'");
});

t("studio chưa từng chạm mốc → mặc định bật gửi khách", () => {
  assert.deepEqual(eventCfg({ deposit_confirm: { client: true } }, "payment_done"), { client: true });
  assert.deepEqual(eventCfg(null, "payment_done"), LATE_DEFAULT_EVENTS.payment_done);
});

t("studio đã tắt thì giữ tắt", () => {
  assert.deepEqual(eventCfg({ payment_done: { client: false } }, "payment_done"), { client: false });
});

t("mốc cũ không bị bật ngầm", () => {
  assert.deepEqual(eventCfg({}, "payment_due"), {});
  assert.deepEqual(eventCfg({}, "shoot_reminder"), {});
});

t("tin nhắn có tên, số tiền, tên hợp đồng, link và chữ ký", () => {
  const m = paymentDoneMessage({ name: "chị Yến", total: "12.000.000đ", title: "Cưới Yến & Nam", link: "https://x/c/abc", studio: "Mây Studio" });
  assert.match(m, /^Chào chị Yến,/);
  assert.match(m, /đã nhận đủ 12\.000\.000đ cho hợp đồng "Cưới Yến & Nam"/);
  assert.match(m, /https:\/\/x\/c\/abc/);
  assert.match(m, /— Mây Studio$/);
  assert.doesNotMatch(paymentDoneMessage({}), /undefined|null/);
});

console.log(`\n${n} ca đạt`);
