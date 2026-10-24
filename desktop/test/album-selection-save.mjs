/* Kiểm thử đường LÙI của POST /api/a/[slug]/select (database chưa có hàm
 * save_album_selection): ghi theo phần chênh thay vì xoá sạch rồi chèn lại.
 *
 * Điều dễ vỡ nhất:
 *  1. Thêm / bỏ ảnh phải ra đúng phần chênh — sót một dòng "bỏ" là khách thấy
 *     lại ảnh đã bỏ; ghi lại dòng không đổi là sự kiện Realtime thừa dội vào
 *     màn studio mỗi lần khách bấm.
 *  2. `.in()` phải được chia khúc — vài nghìn UUID trên một URL là PostgREST gãy.
 *
 * Nạp thẳng code thật ở src/lib/album-selection-save.ts — cùng module route dùng.
 */
import { chunk, diffRows, onlyUuids } from "../../src/lib/album-selection-save.ts";

let fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};

const row = (photo_id, extra = {}) => ({ photo_id, photo_name: `${photo_id}.jpg`, client_name: "Lan", client_note: null, ...extra });
const ids = (rows) => rows.map((r) => r.photo_id);

// ── Thêm và bỏ ảnh ──────────────────────────────────────────────────────────
{
  const d = diffRows([], [row("a"), row("b")]);
  check("lần đầu: thêm đủ hai ảnh", ids(d.upsert), ["a", "b"]);
  check("lần đầu: không xoá gì", d.remove, []);
}
{
  const d = diffRows([row("a"), row("b")], [row("a"), row("c")]);
  check("bấm thêm ảnh c → chỉ upsert c (a không đổi thì không ghi lại)", ids(d.upsert), ["c"]);
  check("bỏ ảnh b → chỉ xoá b", d.remove, ["b"]);
}
{
  const d = diffRows([row("a"), row("b")], [row("a"), row("b")]);
  check("gửi lại y nguyên → không ghi gì", [ids(d.upsert), d.remove], [[], []]);
}
{
  const d = diffRows([row("a"), row("b")], []);
  check("bỏ hết ảnh → xoá đúng các ảnh đang có", d.remove, ["a", "b"]);
}
{
  const d = diffRows([row("a")], [row("a", { client_note: "in to" })]);
  check("sửa ghi chú → upsert đúng dòng đó", ids(d.upsert), ["a"]);
}
{
  const d = diffRows([row("a")], [row("a", { client_name: "Lan Anh" })]);
  check("đổi tên khách → upsert", ids(d.upsert), ["a"]);
}
{
  // Bảng dislikes không có cột client_name — không được coi là "đổi".
  const old = { photo_id: "a", photo_name: "a.jpg", client_note: null };
  const d = diffRows([old], [{ photo_id: "a", photo_name: "a.jpg", client_note: null }]);
  check("bảng không có client_name → dòng giữ nguyên không bị ghi lại", ids(d.upsert), []);
}

// ── Lọc id & chia khúc ──────────────────────────────────────────────────────
const U = "0b8a2f4e-1c3d-4e5f-8a9b-0c1d2e3f4a5b";
check(
  "chỉ giữ UUID hợp lệ, bỏ trùng (id lạ làm Postgres báo lỗi cả lượt)",
  onlyUuids([U, U.toUpperCase(), "x", 42, null, "1; drop table"]),
  [U]
);
check("chia 450 id thành khúc 200/200/50", chunk(Array.from({ length: 450 }, (_, i) => i)).map((c) => c.length), [200, 200, 50]);
check("mảng rỗng → không có khúc nào (không gửi `.in()` rỗng)", chunk([]), []);

console.log(fail === 0 ? "\nTất cả kiểm thử đạt" : `\n${fail} kiểm thử KHÔNG đạt`);
process.exit(fail === 0 ? 0 : 1);
