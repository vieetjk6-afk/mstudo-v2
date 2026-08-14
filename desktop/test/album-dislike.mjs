/* Kiểm thử luật "ảnh khách không thích" trong album chọn ảnh.
 *
 * Hai điều dễ vỡ nhất của tính năng này:
 *  1. Ảnh bị đánh dấu không thích PHẢI biến khỏi lưới chọn và chỉ hiện ở tab
 *     riêng. Lọc sai một dấu là khách thấy lại ảnh đã loại, hoặc lưới trắng trơn.
 *  2. "Đã chọn" và "không thích" LOẠI TRỪ nhau. Nếu lọt cả hai, studio sẽ lọc ra
 *     rồi in/chỉnh đúng tấm ảnh khách vừa yêu cầu xoá.
 *
 * Nạp thẳng code thật ở src/lib/album-dislike.ts — cùng module mà
 * CustomerAlbum.tsx và POST /api/a/[slug]/select dùng.
 */
import { excludeDisliked, filterByView } from "../../src/lib/album-dislike.ts";

let fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};

const PHOTOS = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
const ids = (list) => list.map((p) => p.id);
const view = (v, sel, dis, share = null) =>
  ids(
    filterByView(PHOTOS, {
      view: v,
      selected: new Set(sel),
      disliked: new Set(dis),
      shareSet: share ? new Set(share) : null,
    })
  );

// ── Ảnh không thích biến khỏi lưới ──────────────────────────────────────────
check("lưới thường ẩn ảnh không thích", view("all", [], ["b"]), ["a", "c", "d"]);
check("chưa loại ảnh nào → lưới đủ ảnh", view("all", ["a"], []), ["a", "b", "c", "d"]);
check("tab Không thích hiện ĐÚNG ảnh bị loại", view("disliked", [], ["b", "d"]), ["b", "d"]);
check("tab Không thích khi chưa loại ảnh nào → rỗng", view("disliked", ["a"], []), []);
check("loại hết ảnh → lưới thường rỗng (không rơi về hiện tất cả)", view("all", [], ["a", "b", "c", "d"]), []);

// ── Chế độ "chỉ ảnh đã chọn" vẫn phải trừ ảnh bị loại ───────────────────────
check("chỉ ảnh đã chọn", view("selected", ["a", "c"], []), ["a", "c"]);
check(
  "ảnh vừa nằm trong 'đã chọn' vừa bị loại → KHÔNG hiện ở tab đã chọn",
  view("selected", ["a", "b"], ["b"]),
  ["a"]
);

// ── Link chia sẻ: xem đúng danh sách được chia sẻ, kể cả ảnh bị loại ────────
check(
  "share link cho xem đúng ảnh được chia sẻ",
  view("all", [], ["b"], ["b", "c"]),
  ["b", "c"]
);

// ── Loại trừ khi ghi DB ─────────────────────────────────────────────────────
check("bỏ khỏi danh sách chọn những ảnh bị loại", excludeDisliked(["a", "b", "c"], ["b"]), ["a", "c"]);
check("không có ảnh bị loại → giữ nguyên thứ tự", excludeDisliked(["c", "a"], []), ["c", "a"]);
check("loại toàn bộ → danh sách chọn rỗng", excludeDisliked(["a", "b"], ["a", "b"]), []);
check("ảnh bị loại không nằm trong danh sách chọn → không ảnh hưởng", excludeDisliked(["a"], ["z"]), ["a"]);

console.log(fail ? `\n${fail} kiểm thử KHÔNG đạt` : "\nTất cả kiểm thử đạt");
process.exit(fail ? 1 : 0);
