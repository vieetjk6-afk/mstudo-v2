/* Kiểm thử SỔ LỰA CHỌN NGOẠI TUYẾN của album khách.
 *
 * Ba thứ dễ vỡ nhất, và mỗi thứ hỏng là khách mất công chọn lại từ đầu:
 *  1. Bản trên máy KHÔNG được bị vòng đọc lại (poll 20 giây) đè khi còn thay đổi
 *     chưa gửi lên. Đây chính là lỗi cũ: mạng rớt → lượt bấm mất → poll kéo bản
 *     cũ về → khách thấy ảnh mình vừa chọn tự bỏ chọn.
 *  2. Nhưng cũng KHÔNG được "bản trên máy luôn thắng": một link album mở trên
 *     hai điện thoại là chuyện thường, máy lưu sau sẽ xoá sạch lựa chọn của máy
 *     kia. Phải trộn theo từng ảnh.
 *  3. Viên trạng thái không được nói dối: còn thay đổi chờ thì cấm hiện "Đã lưu".
 *
 * Nạp thẳng code thật ở src/lib/album-offline.ts — cùng module mà
 * CustomerAlbum.tsx dùng.
 */
import {
  applyEdit,
  diffCount,
  isPending,
  markSynced,
  mergeFromServer,
  mergePicks,
  newLedger,
  normalizePicks,
  parseLedger,
  pendingCount,
  syncBadge,
} from "../../src/lib/album-offline.ts";

let fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};

const picks = (sel = [], dis = [], notes = {}) => ({ selected: sel, disliked: dis, notes });
const SLUG = "album-cuoi";

/* ── Chuẩn hoá ────────────────────────────────────────────────────────────── */

check(
  "ảnh vừa chọn vừa không thích → chỉ còn không thích",
  normalizePicks(picks(["a", "b"], ["b"])),
  picks(["a"], ["b"])
);
check("id trùng bị gộp", normalizePicks(picks(["a", "a", "b"])), picks(["a", "b"]));
check(
  "ghi chú mồ côi (ảnh không đánh dấu) bị bỏ — nếu giữ, sổ báo 'còn thay đổi' vĩnh viễn",
  normalizePicks(picks(["a"], [], { a: "cắt cúp lại", z: "ảnh nào?" })),
  picks(["a"], [], { a: "cắt cúp lại" })
);
check("ghi chú toàn khoảng trắng bị bỏ", normalizePicks(picks(["a"], [], { a: "   " })), picks(["a"]));

/* ── Mốc thời gian & trạng thái chờ ───────────────────────────────────────── */

{
  const l0 = newLedger(SLUG, picks(["a"]), 1000);
  check("sổ mới → không có gì chờ", isPending(l0), false);

  const l1 = applyEdit(l0, picks(["a", "b"]), 1000); // cùng một mili-giây
  check("bấm trong CÙNG mili-giây với lần đồng bộ vẫn phải tính là chờ", isPending(l1), true);
  check("đếm đúng 1 thay đổi chờ", pendingCount(l1), 1);

  const l2 = markSynced(l1, l1.editedAt, l1.picks);
  check("gửi xong → hết chờ", isPending(l2), false);
  check("hết chờ → đếm về 0", pendingCount(l2), 0);
}

{
  // Khách bấm thêm TRONG LÚC request đang bay: phản hồi 200 của bản cũ không
  // được đóng dấu "đã lưu" lên lượt bấm mới.
  const l0 = newLedger(SLUG, picks([]), 1000);
  const sending = applyEdit(l0, picks(["a"]), 2000);
  const sentAt = sending.editedAt;
  const sentPicks = sending.picks;
  const l1 = applyEdit(sending, picks(["a", "b"]), 3000); // bấm thêm giữa chừng
  const l2 = markSynced(l1, sentAt, sentPicks);
  check("bấm giữa chừng → vẫn còn chờ sau khi lượt lưu trước xong", isPending(l2), true);
  check("còn chờ đúng 1 ảnh (ảnh b)", pendingCount(l2), 1);

  const stale = markSynced(l2, sentAt, sentPicks);
  check("phản hồi cũ về muộn lần nữa → không đổi gì", stale, l2);
}

/* ── Hoà giải: máy này không có gì chờ ────────────────────────────────────── */

{
  const l0 = newLedger(SLUG, picks(["a"]), 1000);
  const m = mergeFromServer(l0, picks(["a", "b"]), SLUG, 2000);
  check("không chờ gì → tin máy chủ", [m.how, m.needsPush], ["remote", false]);
  check("không chờ gì → lấy đúng bản máy chủ", m.picks, picks(["a", "b"]));
  check("không chờ gì → sau hoà giải vẫn sạch", isPending(m.ledger), false);
}

{
  const m = mergeFromServer(null, picks(["a"]), SLUG, 1000);
  check("chưa có sổ → dựng sổ từ bản máy chủ", [m.how, m.picks], ["remote", picks(["a"])]);
}

/* ── Hoà giải: LỖI CŨ — poll đè mất lựa chọn vừa bấm khi mất mạng ─────────── */

{
  let l = newLedger(SLUG, picks(["a"]), 1000);
  l = applyEdit(l, picks(["a", "b"]), 2000); // bấm thêm b, mạng rớt nên chưa gửi được
  const m = mergeFromServer(l, picks(["a"]), SLUG, 3000); // poll kéo về bản CŨ
  check("máy chủ chưa biết gì mới → giữ bản trên máy", [m.how, m.needsPush], ["local", true]);
  check("ảnh b KHÔNG bị bỏ chọn", m.picks, picks(["a", "b"]));
  check("vẫn còn chờ để gửi lại", isPending(m.ledger), true);
}

/* ── Hoà giải: hai điện thoại cùng một link ───────────────────────────────── */

{
  let l = newLedger(SLUG, picks(["a"]), 1000);
  l = applyEdit(l, picks(["a", "b"]), 2000); // máy này thêm b (chưa gửi được)
  const m = mergeFromServer(l, picks(["a", "c"]), SLUG, 3000); // máy kia đã thêm c
  check("cả hai bên đều đổi → trộn", [m.how, m.needsPush], ["merged", true]);
  check("giữ CẢ b (máy này) lẫn c (máy kia)", m.picks, picks(["a", "b", "c"]));
}

{
  let l = newLedger(SLUG, picks(["a", "b"]), 1000);
  l = applyEdit(l, picks(["a"]), 2000); // máy này BỎ chọn b
  const m = mergeFromServer(l, picks(["a", "b", "c"]), SLUG, 3000); // máy kia thêm c, b còn nguyên
  check("bỏ chọn ở máy này thắng, ảnh máy kia thêm vẫn giữ", m.picks, picks(["a", "c"]));
}

{
  // Ảnh máy này không chạm tới mà máy kia đổi ⇒ theo máy kia (kể cả khi đổi sang
  // "không thích"). Nếu lấy theo máy này, studio sẽ in đúng tấm khách vừa loại.
  let l = newLedger(SLUG, picks(["a", "b"]), 1000);
  l = applyEdit(l, picks(["a", "b", "c"]), 2000);
  const m = mergeFromServer(l, picks(["a"], ["b"]), SLUG, 3000);
  check("máy kia chuyển b sang 'không thích' → tôn trọng", m.picks, picks(["a", "c"], ["b"]));
}

{
  // Sau khi trộn, `base` phải thành bản máy chủ — nếu không, vòng hoà giải kế
  // tiếp lại thấy "cả hai bên đều đổi" và dựng lại thay đổi khách đã bỏ.
  let l = newLedger(SLUG, picks(["a"]), 1000);
  l = applyEdit(l, picks(["a", "b"]), 2000);
  const m1 = mergeFromServer(l, picks(["a", "c"]), SLUG, 3000);
  const pushed = markSynced(m1.ledger, m1.ledger.editedAt, m1.ledger.picks);
  const m2 = mergeFromServer(pushed, picks(["a", "b", "c"]), SLUG, 4000);
  check("gửi xong rồi poll lại → yên, không trộn nữa", [m2.how, m2.picks], ["remote", picks(["a", "b", "c"])]);
}

/* ── Trộn ghi chú ─────────────────────────────────────────────────────────── */

check(
  "ghi chú máy này vừa sửa thắng, ghi chú ảnh khác lấy máy chủ",
  mergePicks(
    picks(["a", "b"], [], { a: "cũ", b: "giữ nguyên" }),
    picks(["a", "b"], [], { a: "mới", b: "giữ nguyên" }),
    picks(["a", "b"], [], { a: "cũ", b: "máy kia sửa" })
  ),
  picks(["a", "b"], [], { a: "mới", b: "máy kia sửa" })
);

/* ── Đọc lại sổ từ ổ đĩa ──────────────────────────────────────────────────── */

{
  const l = applyEdit(newLedger(SLUG, picks(["a"]), 1000), picks(["a", "b"]), 2000);
  const round = parseLedger(JSON.parse(JSON.stringify(l)), SLUG);
  check("ghi ra JSON rồi đọc lại → y nguyên", round, l);
  check("sổ của album khác → bỏ", parseLedger(l, "album-khac"), null);
  check("sai phiên bản định dạng → bỏ", parseLedger({ ...l, v: 99 }, SLUG), null);
  check("rác → bỏ", parseLedger("không phải sổ", SLUG), null);
  check("sổ thiếu `base` (bản cũ) → coi base = picks, không báo chờ oan", parseLedger({ ...l, base: undefined, editedAt: 1000, syncedAt: 1000 }, SLUG)?.base, l.picks);
}

/* ── Đếm khác biệt ────────────────────────────────────────────────────────── */

check("hai bản giống nhau → 0", diffCount(picks(["a", "b"]), picks(["b", "a"])), 0);
check("thêm một ảnh → 1", diffCount(picks(["a"]), picks(["a", "b"])), 1);
check("đổi thích → không thích → 1", diffCount(picks(["a"]), picks([], ["a"])), 1);
check("chỉ đổi ghi chú → 1", diffCount(picks(["a"], [], { a: "x" }), picks(["a"], [], { a: "y" })), 1);

/* ── Viên trạng thái ──────────────────────────────────────────────────────── */

{
  const clean = newLedger(SLUG, picks(["a"]), 1000);
  const dirty = applyEdit(clean, picks(["a", "b"]), 2000);

  check("đã đồng bộ, đang rảnh → Đã lưu", syncBadge(clean, "idle", true).text, "Đã lưu");
  check("đã đồng bộ mà trình duyệt báo mất mạng → vẫn Đã lưu, không doạ khách", syncBadge(clean, "idle", false).tone, "ok");
  check("còn chờ + mất mạng → nói rõ chờ mạng kèm số thay đổi", syncBadge(dirty, "idle", false).text, "Chờ mạng · 1 thay đổi");
  check("còn chờ + mất mạng → tông vàng", syncBadge(dirty, "idle", false).tone, "wait");
  check("còn chờ + có mạng, vừa lỗi → Chờ gửi", syncBadge(dirty, "failed", true).text, "Chờ gửi · 1 thay đổi");
  check("còn chờ mà đang gửi → Đang lưu…", syncBadge(dirty, "saving", true).text, "Đang lưu…");
  check("còn chờ thì TUYỆT ĐỐI không hiện 'Đã lưu'", syncBadge(dirty, "idle", true).text !== "Đã lưu", true);
  check("chưa có sổ → coi như đã lưu (chưa bấm gì)", syncBadge(null, "idle", true).text, "Đã lưu");
}

console.log(fail ? `\n${fail} kiểm thử KHÔNG đạt` : "\nTất cả kiểm thử đạt");
process.exit(fail ? 1 : 0);
