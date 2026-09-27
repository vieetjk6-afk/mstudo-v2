// Nhật ký thao tác: chi tiết trước/sau phải là chữ người đọc được, không phải JSON.
import assert from "node:assert/strict";
import { auditFields } from "../../src/lib/audit-fields.ts";

let n = 0;
const t = (name, fn) => {
  fn();
  n++;
  console.log("✓", name);
};

const payment = {
  id: "64189c1d-f206-48b6-8493-8ffc0f20bcf7",
  kind: "installment",
  note: "Thanh toán toàn bộ hợp đồng",
  amount: 2000000,
  method: "transfer",
  paid_at: "2026-09-27",
  proof_url: null,
  created_at: "2026-09-27T15:28:54.209238+00:00",
  receipt_at: null,
  receipt_no: null,
  contract_id: "28028d99-69ce-4052-9ea5-7296870725b2",
};

t("ghi thu: nhãn tiếng Việt, ẩn id/mốc tạo/ô trống", () => {
  assert.deepEqual(auditFields(null, payment), [
    { label: "Số tiền", after: "2.000.000đ" },
    { label: "Loại", after: "Thanh toán đợt" },
    { label: "Hình thức", after: "Chuyển khoản" },
    { label: "Ngày thu", after: "27/09/2026" },
    { label: "Ghi chú", after: "Thanh toán toàn bộ hợp đồng" },
  ]);
});

t("sửa khoản thu: chỉ hiện trường đã đổi", () => {
  const f = auditFields(payment, { ...payment, amount: 2500000, method: "cash" });
  assert.deepEqual(f, [
    { label: "Số tiền", before: "2.000.000đ", after: "2.500.000đ" },
    { label: "Hình thức", before: "Chuyển khoản", after: "Tiền mặt" },
  ]);
});

t("xoá: hiện ở cột trước", () => {
  const f = auditFields(payment, null);
  assert.equal(f[0].before, "2.000.000đ");
  assert.equal(f[0].after, undefined);
});

t("trạng thái hợp đồng dịch sang chữ", () => {
  assert.deepEqual(auditFields({ status: "sent" }, { status: "cancelled", refund: 0, reason: "Khách đổi ý" }), [
    { label: "Trạng thái", before: "Chờ khách duyệt", after: "Đã huỷ" },
    { label: "Hoàn tiền", before: "—", after: "0đ" },
    { label: "Lý do", before: "—", after: "Khách đổi ý" },
  ]);
});

t("hạng mục thành bảng", () => {
  const f = auditFields(null, { lines: [{ name: "Gói cưới", qty: 1, unit_price: 12000000 }] });
  assert.deepEqual(f, [{ label: "Hạng mục", lines: [{ name: "Gói cưới", qty: "1", price: "12.000.000đ" }] }]);
});

t("không có gì đáng hiện → rỗng", () => {
  assert.deepEqual(auditFields({ id: "x" }, { id: "x" }), []);
  assert.deepEqual(auditFields(null, null), []);
});

console.log(`\n${n} ca đạt`);
