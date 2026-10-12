/* Kiểm thử ghép phản hồi (RSVP) với danh sách khách mời của thiệp cưới.
 *
 * Vì sao đáng test: cặp đôi nhìn trạng thái cạnh từng tên để biết ai sẽ đến,
 * ai chưa trả lời. Ghép sai thì hoặc báo nhầm "chưa phản hồi" (gọi điện hỏi
 * lại cả nhà người ta), hoặc gán phản hồi của người này cho người khác.
 *
 * Nạp thẳng code thật ở src/lib/wedding-guests.ts.
 */
import { matchGuestRsvps } from "../../src/lib/wedding-guests.ts";

let fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};
let t = 0;
const R = (guest_name, attending = true, num_guests = 1, wish = null) =>
  ({ id: String(++t), guest_name, attending, num_guests, wish, created_at: `2026-10-12T0${t}:00:00Z` });
const status = (s) => s.guests.map((g) => [g.name, g.rsvp ? (g.rsvp.attending ? `có ${g.rsvp.num_guests}` : "không") : "chưa"]);

/* ── Ghép đúng người ─────────────────────────────────────────────────────── */
{
  const s = matchGuestRsvps(
    ["Anh Nam & chị Lan", "Gia đình cô Ba", "Bạn Minh"],
    [R("Anh Nam & chị Lan", true, 2), R("Bạn Minh", false)],
  );
  check("tên đúng như link riêng", status(s), [["Anh Nam & chị Lan", "có 2"], ["Gia đình cô Ba", "chưa"], ["Bạn Minh", "không"]]);
  check("đếm: 1 dự · 1 không · 1 chưa · 2 người", [s.attending, s.declined, s.pending, s.people], [1, 1, 1, 2]);
  check("không ai ngoài danh sách", s.others.length, 0);
}
{
  const s = matchGuestRsvps(["Anh Nam"], [R("  anh   NAM ")]);
  check("khác hoa/thường, thừa khoảng trắng → vẫn khớp", status(s), [["Anh Nam", "có 1"]]);
}
{
  const s = matchGuestRsvps(["Cô Hằng"], [R("Co Hang", true, 3)]);
  check("gõ lại không dấu → vẫn khớp", status(s), [["Cô Hằng", "có 3"]]);
}
{
  const s = matchGuestRsvps(["Đức"], [R("Duc")]);
  check("đ → d", status(s), [["Đức", "có 1"]]);
}
{
  // "Lan" và "Lân" cùng bỏ dấu ra "lan" → không đoán bừa, để cặp đôi tự xem.
  const s = matchGuestRsvps(["Lan", "Lân"], [R("lan"), R("Lân", false), R("Lăn")]);
  check("đúng dấu → khớp đúng người", status(s), [["Lan", "có 1"], ["Lân", "không"]]);
  check("bỏ dấu mà trùng 2 người → không gán bừa", s.others.map((r) => r.guest_name), ["Lăn"]);
}
{
  const nfd = "Chị Hồng".normalize("NFD");
  const s = matchGuestRsvps(["Chị Hồng"], [R(nfd)]);
  check("Unicode tổ hợp (bàn phím iPhone) vẫn khớp", status(s), [["Chị Hồng", "có 1"]]);
}

/* ── Gửi lại / đổi ý: lấy lần gửi sau cùng ───────────────────────────────── */
{
  const s = matchGuestRsvps(["Bạn Minh"], [R("Bạn Minh", true, 2), R("Bạn Minh", false)]);
  check("đổi ý → lấy lần mới nhất", status(s), [["Bạn Minh", "không"]]);
  check("không cộng người của lần cũ", s.people, 0);
}
{
  const late = R("Bạn Minh", true, 4);
  const early = { ...R("Bạn Minh", false), created_at: "2026-01-01T00:00:00Z" };
  const s = matchGuestRsvps(["Bạn Minh"], [early, late]);
  check("thứ tự đầu vào không quan trọng", status(s), [["Bạn Minh", "có 4"]]);
}

/* ── Khách ngoài danh sách (mở link chung, tự sửa tên) ───────────────────── */
{
  const s = matchGuestRsvps(["Anh Nam"], [R("Hàng xóm Tư", true, 2), R("Hàng xóm Tư", true, 3), R("Bạn Minh", false)]);
  check("người ngoài danh sách: mỗi tên một dòng, bản mới nhất", s.others.map((r) => [r.guest_name, r.num_guests]), [["Bạn Minh", 1], ["Hàng xóm Tư", 3]]);
  check("tổng người đến gồm cả khách ngoài danh sách", s.people, 3);
  check("khách trong danh sách vẫn chưa phản hồi", status(s), [["Anh Nam", "chưa"]]);
}
{
  const s = matchGuestRsvps([], [R("Ai đó")]);
  check("chưa có danh sách → tất cả là ngoài danh sách", [s.guests.length, s.others.length], [0, 1]);
}
{
  const s = matchGuestRsvps(["A", "B"], []);
  check("chưa ai phản hồi", [s.attending, s.declined, s.pending, s.people], [0, 0, 2, 0]);
}

console.log(fail === 0 ? "\nTất cả OK" : `\n${fail} bài HỎNG`);
process.exit(fail === 0 ? 0 : 1);
