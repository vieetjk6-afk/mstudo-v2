/* Kiểm thử VIỆC TỰ ĐỘNG THEO TRẠNG THÁI.
 *
 * Thứ dễ vỡ nhất và cũng đắt nhất của tính năng này là CHẠY LẶP. Cron chạy mỗi
 * ngày; một luật thiếu khoá chống lặp sẽ đẻ ra 30 việc giống nhau trong một
 * tháng, hoặc gửi cho khách 30 tin Zalo y hệt. Studio sẽ tắt cả tính năng, và
 * đúng ra là họ nên tắt. Nên phần lớn kiểm thử dưới đây là "chạy lần hai KHÔNG
 * sinh gì thêm".
 *
 * Thứ nhì là câu chữ: câu này gửi THẲNG cho khách qua Zalo, nên không được để
 * lọt chuỗi "{khach}" nào ra ngoài.
 *
 * Nạp thẳng code thật ở src/lib/automations.ts.
 */
import {
  AUTOMATION_RULES,
  RULE_BY_KEY,
  clampDays,
  daysBetween,
  dedupeKey,
  deliveryFor,
  dueActions,
  effectiveConfig,
  emailSubject,
  renderMessage,
} from "../../src/lib/automations.ts";

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

const TODAY = "2026-09-05";

const contract = (o = {}) => ({
  id: "hd1",
  title: "Chụp cưới trọn gói",
  clientName: "Minh & Lan",
  clientPhone: "0912345678",
  status: "in_progress",
  signedAt: null,
  eventDate: null,
  selectionDoneAt: null,
  deliveredAt: null,
  dues: [],
  ...o,
});
/** Bật đúng một luật, tắt hết luật còn lại — để mỗi ca chỉ kiểm một thứ. */
const only = (key, over = {}) => {
  const cfg = {};
  for (const r of AUTOMATION_RULES) cfg[r.key] = { rule: r.key, enabled: false, days: null, message: null };
  cfg[key] = { rule: key, enabled: true, days: null, message: null, ...over };
  return cfg;
};
const run = (c, cfg, fired = [], today = TODAY) => dueActions(c, cfg, new Set(fired), today);

/* ═══ Bản khai tám luật ══════════════════════════════════════════════════════ */

check("đúng tám luật", AUTOMATION_RULES.length, 8);
ok("khoá luật không trùng nhau", new Set(AUTOMATION_RULES.map((r) => r.key)).size === 8);
ok("mọi luật đều có câu chữ mặc định", AUTOMATION_RULES.every((r) => r.message.trim().length > 10));
ok("mọi luật đều có câu giải thích cho studio đọc", AUTOMATION_RULES.every((r) => r.hint.trim().length > 10));
ok(
  "MỌI luật gửi Zalo cho khách đều TẮT sẵn — tin nhắn sai lúc là thứ khách nhìn thấy",
  AUTOMATION_RULES.filter((r) => r.action === "zalo").every((r) => r.onByDefault === false)
);
ok(
  "luật chỉ sinh việc/chuông trong nhà thì bật sẵn được",
  AUTOMATION_RULES.some((r) => r.action !== "zalo" && r.onByDefault)
);
check("tra luật theo khoá", RULE_BY_KEY.deposit_after_sign.trigger, "signed");

/* ═══ Số ngày ════════════════════════════════════════════════════════════════ */

check("số ngày âm bị kẹp về 0", clampDays(-5), 0);
check("số ngày quá lớn bị kẹp", clampDays(9999), 365);
check("chữ → 0", clampDays("ba ngày"), 0);
check("số thực → làm tròn", clampDays(3.6), 4);

check("chưa cấu hình → dùng mặc định của luật", effectiveConfig(RULE_BY_KEY.crew_before_shoot).days, 7);
check(
  "studio đặt số ngày riêng → theo studio",
  effectiveConfig(RULE_BY_KEY.crew_before_shoot, { rule: "x", enabled: true, days: 10, message: null }).days,
  10
);
check(
  "studio để trống câu chữ → dùng câu mặc định",
  effectiveConfig(RULE_BY_KEY.deposit_after_sign, { rule: "x", enabled: true, days: null, message: "   " }).message,
  RULE_BY_KEY.deposit_after_sign.message
);

/* ═══ Câu chữ ════════════════════════════════════════════════════════════════ */

check("thay ô bình thường", renderMessage("Chào {khach}, buổi chụp {ngay}", { khach: "Lan", ngay: "05/09/2026" }), "Chào Lan, buổi chụp 05/09/2026");
check(
  "ô THIẾU dữ liệu bị xoá cùng khoảng trắng — tuyệt đối không gửi '{khach}' cho khách",
  renderMessage("Chào {khach}, studio nhắc buổi chụp {ngay} nhé", { ngay: "05/09" }),
  "Chào, studio nhắc buổi chụp 05/09 nhé"
);
check("ô lạ (studio gõ sai tên) cũng biến mất", renderMessage("Chào {khachhang} nhé", { khach: "Lan" }), "Chào nhé");
ok(
  "không có dấu ngoặc nhọn nào lọt ra ngoài trong mọi câu mặc định khi thiếu hết dữ liệu",
  AUTOMATION_RULES.every((r) => !/[{}]/.test(renderMessage(r.message, {})))
);
check("khoảng trắng đôi bị dọn", renderMessage("a  {x}  b", {}), "a b");

/* ═══ Khoảng ngày ════════════════════════════════════════════════════════════ */

check("cùng ngày → 0", daysBetween("2026-09-05", "2026-09-05"), 0);
check("ba ngày sau", daysBetween("2026-09-05", "2026-09-08"), 3);
check("ba ngày trước → số âm", daysBetween("2026-09-08", "2026-09-05"), -3);
check("qua tháng vẫn đúng", daysBetween("2026-09-28", "2026-10-02"), 4);
check("ngày rác → null", daysBetween("hôm nay", "2026-09-05"), null);

/* ═══ Luật: ký hợp đồng ══════════════════════════════════════════════════════ */

{
  const c = contract({ signedAt: "2026-09-01T10:00:00Z" });
  const first = run(c, only("deposit_after_sign"));
  check("ký xong → sinh đúng một việc thu cọc", first.map((a) => [a.rule, a.action]), [["deposit_after_sign", "task"]]);
  ok("câu việc có tên khách", /Minh & Lan/.test(first[0].message), first[0].message);

  // ĐÂY là ca quan trọng nhất của cả tính năng.
  const second = run(c, only("deposit_after_sign"), [first[0].dedupeKey]);
  check("chạy lần hai → KHÔNG sinh gì nữa (chống lặp)", second, []);
}
check("chưa ký → không sinh gì", run(contract(), only("deposit_after_sign")), []);
check(
  "hợp đồng ĐÃ HUỶ → không sinh gì, dù đã ký",
  run(contract({ signedAt: "2026-09-01T10:00:00Z", status: "cancelled" }), only("deposit_after_sign")),
  []
);
check("luật tắt → không sinh gì", run(contract({ signedAt: "2026-09-01T10:00:00Z" }), only("crew_before_shoot")), []);

/* ═══ Luật: trước buổi chụp ══════════════════════════════════════════════════ */

{
  const cfg = only("crew_before_shoot", { days: 7 });
  check("còn 10 ngày → chưa tới lúc", run(contract({ eventDate: "2026-09-15" }), cfg).length, 0);
  check("còn đúng 7 ngày → sinh việc", run(contract({ eventDate: "2026-09-12" }), cfg).length, 1);
  check(
    "còn 2 ngày → VẪN sinh việc (cron có thể bỏ nhịp; đòi khớp chính xác là mất hẳn việc đó)",
    run(contract({ eventDate: "2026-09-07" }), cfg).length,
    1
  );
  check("đúng ngày chụp → vẫn còn kịp nhắc", run(contract({ eventDate: TODAY }), cfg).length, 1);
  check("buổi chụp ĐÃ QUA → không nhắc chuẩn bị nữa", run(contract({ eventDate: "2026-09-01" }), cfg).length, 0);
  check("chưa có ngày chụp → không sinh gì", run(contract(), cfg).length, 0);

  const a = run(contract({ eventDate: "2026-09-07" }), cfg);
  check("chạy lại → không lặp", run(contract({ eventDate: "2026-09-07" }), cfg, [a[0].dedupeKey]), []);
}
{
  const a = run(contract({ eventDate: "2026-09-07" }), only("confirm_before_shoot", { days: 3 }));
  check("luật gọi xác nhận là chuông, không phải việc", a[0].action, "notify");
  ok("câu chuông nói còn mấy ngày", /còn 2 ngày|Còn 2 ngày/.test(a[0].message), a[0].message);
}

/* ═══ Luật: quá hạn thanh toán ═══════════════════════════════════════════════ */

{
  const dues = [
    { id: "d1", label: "Đợt 1 (cọc)", amount: 5_000_000, dueDate: "2026-08-30", paid: false },
    { id: "d2", label: "Đợt 2", amount: 10_000_000, dueDate: "2026-09-03", paid: false },
    { id: "d3", label: "Đợt 3", amount: 10_000_000, dueDate: "2026-08-01", paid: true },
    { id: "d4", label: "Đợt 4", amount: 5_000_000, dueDate: "2026-12-01", paid: false },
  ];
  const c = contract({ dues });
  const a = run(c, only("payment_overdue", { days: 1 }));
  check(
    "MỖI đợt quá hạn là MỘT việc riêng — không bị chống lặp gộp mất",
    a.map((x) => x.dedupeKey).sort(),
    ["payment_overdue:hd1:d1", "payment_overdue:hd1:d2"]
  );
  ok("đợt đã thu không bị nhắc", !a.some((x) => x.dedupeKey.endsWith("d3")));
  ok("đợt chưa tới hạn không bị nhắc", !a.some((x) => x.dedupeKey.endsWith("d4")));
  ok("câu nhắc có số tiền định dạng Việt Nam", /5\.000\.000₫/.test(a.find((x) => x.dedupeKey.endsWith("d1")).message));
  ok("câu nhắc có tên đợt", /Đợt 1/.test(a.find((x) => x.dedupeKey.endsWith("d1")).message));

  // Đã nhắc đợt 1 rồi thì lần sau chỉ còn đợt 2.
  const b = run(c, only("payment_overdue", { days: 1 }), ["payment_overdue:hd1:d1"]);
  check("đã nhắc đợt 1 → lần sau chỉ còn đợt 2", b.map((x) => x.dedupeKey), ["payment_overdue:hd1:d2"]);

  // Ngưỡng: đặt 5 ngày thì đợt quá hạn 2 ngày chưa tính.
  const c5 = run(c, only("payment_overdue", { days: 5 }));
  check("ngưỡng 5 ngày → chỉ đợt quá hạn ≥5 ngày", c5.map((x) => x.dedupeKey), ["payment_overdue:hd1:d1"]);
}
check(
  "đợt không có ngày hạn → không nhắc (không đoán hạn)",
  run(contract({ dues: [{ id: "d1", label: "Đợt 1", amount: 1000, dueDate: null, paid: false }] }), only("payment_overdue")),
  []
);

/* ═══ Luật: chọn ảnh xong / đã giao / hoàn thành ═════════════════════════════ */

check("khách chọn xong → sinh việc hậu kỳ", run(contract({ selectionDoneAt: "2026-09-04T09:00:00Z" }), only("start_post_after_selection")).length, 1);
check("chưa chọn xong → không gì", run(contract(), only("start_post_after_selection")), []);

{
  const a = run(contract({ deliveredAt: "2026-09-04T09:00:00Z" }), only("ask_review_after_deliver", { enabled: true }));
  check("đã giao → gửi Zalo xin đánh giá", [a[0].action, a[0].toPhone], ["zalo", "0912345678"]);
}
check(
  "KHÔNG có số điện thoại khách → luật Zalo bỏ qua, không sinh việc treo",
  run(contract({ deliveredAt: "2026-09-04T09:00:00Z", clientPhone: null }), only("ask_review_after_deliver")),
  []
);
check("hoàn thành → gửi Zalo cảm ơn", run(contract({ status: "completed" }), only("thanks_after_complete")).length, 1);
check("chưa hoàn thành → không gì", run(contract({ status: "in_progress" }), only("thanks_after_complete")), []);

/* ═══ Câu chữ rỗng sau khi thay ô = không gửi ════════════════════════════════

   Studio KHÔNG tắt luật bằng cách xoá trắng câu chữ (xoá trắng thì
   effectiveConfig rơi về câu mặc định — có công tắc riêng để tắt). Nhưng một câu
   chỉ gồm những ô KHÔNG có dữ liệu sẽ rỗng sau khi thay, và lúc đó tuyệt đối
   không được gửi một tin nhắn trắng cho khách. */

check(
  "câu chỉ gồm ô không có dữ liệu → rỗng → KHÔNG gửi tin trắng cho khách",
  run(contract({ signedAt: "x", eventDate: null }), only("deposit_after_sign", { message: "{ngay}" })),
  []
);
check(
  "xoá trắng câu chữ → rơi về câu mặc định (tắt luật là việc của công tắc)",
  run(contract({ signedAt: "x" }), only("deposit_after_sign", { message: "" })).length,
  1
);

/* ═══ Nhiều luật cùng lúc ════════════════════════════════════════════════════ */

{
  // Mặc định (không cấu hình gì): hợp đồng vừa ký, sắp chụp, quá hạn một đợt.
  const c = contract({
    signedAt: "2026-09-01T10:00:00Z",
    eventDate: "2026-09-07",
    dues: [{ id: "d1", label: "Đợt 1", amount: 5_000_000, dueDate: "2026-08-30", paid: false }],
  });
  const a = dueActions(c, {}, new Set(), TODAY);
  const keys = a.map((x) => x.rule).sort();
  check(
    "bản mặc định sinh đúng bốn việc trong nhà, KHÔNG có Zalo nào",
    keys,
    ["confirm_before_shoot", "crew_before_shoot", "deposit_after_sign", "payment_overdue"]
  );
  ok("không luật Zalo nào tự chạy khi studio chưa bật", !a.some((x) => x.action === "zalo"));

  // Chạy lại với TẤT CẢ khoá đã ghi → im lặng hoàn toàn.
  const again = dueActions(c, {}, new Set(a.map((x) => x.dedupeKey)), TODAY);
  check("chạy lại toàn bộ → im lặng hoàn toàn", again, []);
}

/* ═══ Kênh gửi & dự phòng email ══════════════════════════════════════════════ */

{
  // Việc trong nhà không đi qua bộ chọn kênh — luôn làm được.
  check("việc trong nhà: 'task' luôn đi được", deliveryFor("task", null, { zalo: false, email: false }), "task");
  check("việc trong nhà: 'notify' luôn đi được", deliveryFor("notify", null, { zalo: false, email: false }), "notify");

  check("có Zalo → đi Zalo", deliveryFor("zalo", "email", { zalo: true, email: true }), "zalo");
  check("không Zalo, có email → rơi về email", deliveryFor("zalo", "email", { zalo: false, email: true }), "email");
  check("không kênh nào → null (ĐỂ NGUYÊN cho ngày mai)", deliveryFor("zalo", "email", { zalo: false, email: false }), null);
  check("luật không khai dự phòng thì không tự rơi về email",
    deliveryFor("zalo", null, { zalo: false, email: true }), null);

  // Ba luật nhắn khách phải CÓ dự phòng, các luật trong nhà thì KHÔNG.
  for (const r of AUTOMATION_RULES) {
    if (r.action === "zalo") ok(`luật "${r.key}" có kênh dự phòng email`, r.fallback === "email");
    else ok(`luật trong nhà "${r.key}" không khai dự phòng`, r.fallback === undefined);
  }

  // Khách CHỈ có email (khách công ty) vẫn nhắn được — trước khi có dự phòng thì
  // những hợp đồng này im lặng tuột mất.
  const onlyMail = contract({ clientPhone: null, clientEmail: "lan@congty.vn", deliveredAt: "2026-09-04T09:00:00Z" });
  const a1 = run(onlyMail, only("ask_review_after_deliver"));
  check("khách chỉ có email → luật xin đánh giá vẫn sinh việc", a1.length, 1);
  check("… và mang theo địa chỉ email", a1[0]?.toEmail, "lan@congty.vn");
  check("… không mang số điện thoại", a1[0]?.toPhone, null);
  check("… kênh chọn được là email", deliveryFor(a1[0].action, a1[0].fallback, { zalo: false, email: true }), "email");

  // Không số, không email → không sinh việc: không có ai để gửi.
  const nobody = contract({ clientPhone: null, clientEmail: null, deliveredAt: "2026-09-04T09:00:00Z" });
  check("không số, không email → không sinh việc nhắn khách", run(nobody, only("ask_review_after_deliver")), []);

  // Có số nhưng chưa nối Zalo: việc VẪN sinh ra (bộ luật không biết chuyện kết
  // nối), và bộ chọn kênh mới là chỗ nói "chưa đi được".
  const phoneOnly = contract({ clientEmail: null, deliveredAt: "2026-09-04T09:00:00Z" });
  const a2 = run(phoneOnly, only("ask_review_after_deliver"));
  check("có số → vẫn sinh việc", a2.length, 1);
  check("chưa nối Zalo, khách không email → chưa đi được",
    deliveryFor(a2[0].action, a2[0].fallback, { zalo: false, email: false }), null);

  // Tiêu đề thư lấy theo LUẬT, không cắt từ thân thư.
  ok("tiêu đề thư mang tên studio", emailSubject("ask_review_after_deliver", "Ánh Dương").includes("Ánh Dương"));
  ok("tiêu đề thư không rỗng khi thiếu tên studio", emailSubject("thanks_after_complete", "").length > 0);
  check("luật lạ → tiêu đề rơi về tên studio", emailSubject("khong_co_luat_nay", "Ánh Dương"), "Ánh Dương");
}

check("khoá chống lặp không kèm ref", dedupeKey("r", "c"), "r:c");
check("khoá chống lặp kèm ref", dedupeKey("r", "c", "d1"), "r:c:d1");

console.log(fail ? `\n${fail} kiểm thử KHÔNG đạt` : "\nTất cả kiểm thử đạt");
process.exit(fail ? 1 : 0);
