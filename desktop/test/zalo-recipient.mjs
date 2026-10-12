// "Nhớ người nhận Zalo": thứ tự chọn uid, chỉ dùng uid của ĐÚNG tài khoản Zalo
// đang kết nối, mượn từ hợp đồng khác cùng SĐT, lỗi nào mới được xoá người đã
// lưu, và khi nào phải ghi lại. Nạp thẳng code thật ở src/lib/zalo/recipient.ts.
import assert from "node:assert/strict";
import {
  isRecipientError,
  normalizePhone,
  pickSibling,
  resolveRecipient,
  shouldSave,
} from "../../src/lib/zalo/recipient.ts";

let n = 0;
const t = (name, fn) => {
  fn();
  n++;
  console.log("✓", name);
};

const SELF = "self-1";
const saved = (uid, name, self = SELF) => ({ zalo_uid: uid, zalo_name: name, zalo_self: self });

t("SĐT các kiểu viết về cùng một dạng", () => {
  assert.equal(normalizePhone("0901 234 567"), "84901234567");
  assert.equal(normalizePhone("+84 901-234-567"), "84901234567");
  assert.equal(normalizePhone("84901234567"), "84901234567");
  assert.equal(normalizePhone(null), "");
});

t("1. uid chọn tay thắng mọi thứ đã lưu", () => {
  const r = resolveRecipient({ toUid: "u-pick", toName: "Lan Zalo", selfId: SELF, own: [saved("u-old", "Cũ")] });
  assert.deepEqual(r, { uid: "u-pick", name: "Lan Zalo", source: "explicit" });
});

t("2. uid đã lưu trên hợp đồng/album khi khớp tài khoản Zalo", () => {
  const r = resolveRecipient({ toName: "Khách", selfId: SELF, own: [null, saved("u-c", "Lan")] });
  assert.deepEqual(r, { uid: "u-c", name: "Lan", source: "saved" });
});

t("2. album đứng trước hợp đồng", () => {
  const r = resolveRecipient({ selfId: SELF, own: [saved("u-album", "A"), saved("u-contract", "C")] });
  assert.equal(r.uid, "u-album");
});

t("2. đổi tài khoản Zalo → uid cũ bị bỏ qua", () => {
  const r = resolveRecipient({ toName: "Khách", selfId: "self-2", own: [saved("u-c", "Lan")], phone: "0901234567" });
  assert.deepEqual(r, { uid: null, name: "Khách", source: "phone" });
});

t("2. không biết tài khoản hiện tại (selfId trống) → không dùng uid đã lưu", () => {
  assert.equal(resolveRecipient({ selfId: null, own: [saved("u-c", "Lan", null)] }).source, "phone");
});

t("3. mượn từ hợp đồng khác cùng SĐT — mới sửa gần nhất", () => {
  const siblings = [
    { ...saved("u-1", "Lan cũ"), client_phone: "0901 234 567", updated_at: "2026-01-01T00:00:00Z" },
    { ...saved("u-2", "Lan mới"), client_phone: "+84901234567", updated_at: "2026-05-01T00:00:00Z" },
    { ...saved("u-3", "Người khác"), client_phone: "0911111111", updated_at: "2026-09-01T00:00:00Z" },
    { ...saved("u-4", "Tài khoản khác", "self-9"), client_phone: "0901234567", updated_at: "2026-10-01T00:00:00Z" },
  ];
  const r = resolveRecipient({ toName: "Khách", selfId: SELF, own: [], siblings, phone: "0901.234.567" });
  assert.deepEqual(r, { uid: "u-2", name: "Lan mới", source: "sibling" });
});

t("3. SĐT ngắn/nhập dở thì không mượn", () => {
  assert.equal(pickSibling([{ ...saved("u", "x"), client_phone: "0901" }], "0901", SELF), null);
});

t("3. hợp đồng chính đã có người lưu → không cần mượn", () => {
  const r = resolveRecipient({
    selfId: SELF,
    own: [saved("u-own", "Mình")],
    siblings: [{ ...saved("u-sib", "Khác"), client_phone: "0901234567" }],
    phone: "0901234567",
  });
  assert.equal(r.uid, "u-own");
});

t("4. không có gì → tra theo SĐT như cũ", () => {
  assert.deepEqual(resolveRecipient({ toName: "Khách", selfId: SELF, phone: "0901234567" }), {
    uid: null,
    name: "Khách",
    source: "phone",
  });
});

t("lỗi do người nhận → được xoá người đã lưu và thử lại", () => {
  assert.equal(isRecipientError("recipient_not_found"), true);
  assert.equal(isRecipientError("Người dùng không tồn tại"), true);
  assert.equal(isRecipientError("You have been blocked by this user"), true);
});

t("lỗi phiên/mạng → KHÔNG xoá người đã lưu", () => {
  assert.equal(isRecipientError("login_failed"), false);
  assert.equal(isRecipientError("fetch failed"), false);
  assert.equal(isRecipientError("timeout"), false);
  assert.equal(isRecipientError("zca_js_not_installed"), false);
  assert.equal(isRecipientError(""), false);
  assert.equal(isRecipientError(null), false);
});

t("ghi lại người chọn tay / mượn được; KHÔNG ghi uid tra từ SĐT", () => {
  const next = { uid: "u", name: "Lan", selfId: SELF };
  assert.equal(shouldSave("explicit", null, next), true);
  assert.equal(shouldSave("sibling", null, next), true);
  assert.equal(shouldSave("phone", null, next), false);
});

t("đã lưu y hệt thì không ghi lại (mỗi lần ghi đẩy updated_at)", () => {
  const next = { uid: "u", name: "Lan", selfId: SELF };
  assert.equal(shouldSave("saved", saved("u", "Lan"), next), false);
  assert.equal(shouldSave("explicit", saved("u", "Lan"), next), false);
  assert.equal(shouldSave("explicit", saved("u", "Lan", "self-0"), next), true, "đổi tài khoản Zalo → ghi lại");
  assert.equal(shouldSave("saved", null, next), true, "album chưa có mà hợp đồng có → chép sang");
});

console.log(`\n${n} kiểm thử đạt.`);
