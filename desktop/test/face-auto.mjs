/* Kiểm LUẬT của lượt gom khuôn mặt TỰ ĐỘNG.
 *
 * Tính năng này bỏ hết mọi thao tác của studio: không tick, không nút Quét,
 * không bước Lưu. Đổi lại, nó phải tự xoay xở với hai chuyện mà bản bấm tay
 * không phải lo, và cả hai đều hỏng theo kiểu "vẫn chạy, chỉ là sai":
 *
 *  1. BỊ CẮT NGANG. Studio đóng tab giữa chừng. Nếu không nhớ được đã quét tới
 *     đâu thì mỗi lần mở lại là quét lại từ đầu — và với album 800 ảnh thì nó
 *     sẽ KHÔNG BAO GIỜ xong, một cách hoàn toàn im lặng.
 *  2. GOM QUÁ SỚM. Gom khi mới quét được nửa thì các nhóm nhảy lung tung sau
 *     mỗi mẻ; studio nhìn vào sẽ không tin cái gì cả.
 *
 * Và một cái bẫy nhỏ mà dễ dính: ảnh KHÔNG CÓ khuôn mặt nào (ảnh cổng hoa, ảnh
 * bàn tiệc) không sinh hàng nào trong kho, nên "có hàng trong kho" KHÔNG dùng
 * làm dấu đã quét được.
 */
import {
  CHUNK,
  PER_VISIT,
  chunks,
  nextBatch,
  pending,
  progressOf,
  shouldCluster,
  stateOf,
} from "../../src/lib/face-auto.ts";

let pass = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) {
    pass++;
    console.log(`✓ ${label}`);
  } else {
    fails.push(label);
    console.log(`✗ ${label}`);
  }
};
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} — ${JSON.stringify(a)}`);

const base = { savedPeople: 0, running: false, clustering: false, stoppedForNow: false, loaded: true };

const ph = (id, scanned) => ({
  id,
  drive_file_id: `d${id}`,
  name: `${id}.jpg`,
  faces_scanned_at: scanned ? "2026-01-01T00:00:00Z" : null,
});

/* ── Còn phải quét tấm nào ─────────────────────────────────────────────────── */
console.log("\n— Còn phải quét tấm nào —");
{
  const list = [ph("a", true), ph("b", false), ph("c", true), ph("d", false)];
  eq(pending(list).map((p) => p.id), ["b", "d"], "chỉ lấy tấm chưa quét, giữ thứ tự album");
  eq(pending([]), [], "album rỗng: không có gì để quét");
  eq(pending([ph("a", true)]), [], "quét hết rồi: không còn gì");
}
{
  // Tấm KHÔNG có khuôn mặt nào vẫn phải được đánh dấu đã quét. Ở đây thể hiện
  // bằng việc `pending` chỉ nhìn faces_scanned_at, không nhìn kho khuôn mặt.
  const list = [{ id: "x", drive_file_id: "dx", name: "cong-hoa.jpg", faces_scanned_at: "2026-01-01T00:00:00Z" }];
  eq(pending(list), [], "ảnh không có mặt người, đã quét → KHÔNG quét lại (bẫy vòng lặp vô tận)");
}
{
  // Hàng từ DB có thể thiếu hẳn trường đó (bản cũ) — coi như chưa quét.
  eq(pending([{ id: "y", drive_file_id: "dy", name: "y.jpg" }]).map((p) => p.id), ["y"],
    "thiếu hẳn cột faces_scanned_at → coi như chưa quét");
}

/* ── Ảnh hỏng vĩnh viễn: cái bẫy quay vòng vô tận ─────────────────────────── */
console.log("\n— Ảnh hỏng vĩnh viễn —");
/*
 * Một tấm hỏng vĩnh viễn (file bị xoá trên Drive, định dạng lạ) KHÔNG BAO GIỜ
 * được đánh dấu đã quét. Nếu không loại nó ra, danh sách còn lại không bao giờ
 * ngắn đi → lượt quét tự khởi động lại mãi mãi: đốt CPU của studio, gọi Drive
 * không ngừng, mà màn hình vẫn hiện "đang quét" một cách hoàn toàn hợp lý.
 */
{
  const list = [ph("a", true), ph("hong", false), ph("b", false)];
  eq(nextBatch(list, new Set()).map((p) => p.id), ["hong", "b"], "chưa hỏng gì thì lấy hết phần chưa quét");
  eq(nextBatch(list, new Set(["hong"])).map((p) => p.id), ["b"], "bỏ tấm đã thử và hỏng");
  eq(nextBatch(list, new Set(["hong", "b"])), [], "TẤT CẢ phần còn lại đều hỏng → không còn gì để làm");
  eq(nextBatch(list, new Set(), 1).map((p) => p.id), ["hong"], "tôn trọng trần mỗi lần mở");
  eq(nextBatch(list, new Set(), 0), [], "trần 0 → không lấy gì, không nổ");
}
{
  // Và gom nhóm KHÔNG được đợi những tấm sẽ không bao giờ xong.
  const list = [ph("a", true), ph("hong", false)];
  ok(!shouldCluster(list, 0, 3, 0), "còn ảnh chưa quét → chưa gom");
  ok(shouldCluster(list, 0, 3, 1), "…nhưng nếu tấm còn lại đã hỏng thì gom, đừng đợi mãi");
}
{
  const list = [ph("a", true), ph("hong", false)];
  const st = stateOf({ ...base, photos: list, failed: 1 });
  eq(st.kind, "stuck", "còn ảnh chưa quét mà tất cả đều hỏng → nói ra, không để thanh tiến độ treo");
  eq(st.failed, 1, "…và nói rõ bao nhiêu tấm hỏng");
  eq(
    stateOf({ ...base, photos: [ph("a", true), ph("b", false), ph("c", false)], failed: 1 }).kind,
    "paused",
    "còn tấm chưa thử thì vẫn là tạm dừng, chưa phải bí"
  );
}

/* ── Cắt mẻ ───────────────────────────────────────────────────────────────── */
console.log("\n— Cắt mẻ để ghi dần —");
eq(chunks([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]], "cắt đều, mẻ cuối ngắn hơn");
eq(chunks([], 3), [], "danh sách rỗng → không mẻ nào");
eq(chunks([1, 2], 5), [[1, 2]], "ít hơn một mẻ → vẫn một mẻ");
ok(chunks([1, 2, 3]).length === 1, `mặc định cắt theo CHUNK = ${CHUNK}`);
eq(chunks([1, 2, 3], 0), [[1, 2, 3]], "cỡ mẻ 0 không làm treo vòng lặp");
ok(PER_VISIT > CHUNK, "trần mỗi lần mở phải lớn hơn một mẻ, nếu không thì không mẻ nào chạy");

/* ── Tiến độ ──────────────────────────────────────────────────────────────── */
console.log("\n— Tiến độ —");
eq(progressOf([ph("a", true), ph("b", false)]), { done: 1, total: 2, percent: 50 }, "một nửa");
eq(progressOf([]), { done: 0, total: 0, percent: 100 }, "album rỗng → 100%, KHÔNG chia cho 0");
eq(progressOf([ph("a", true)]), { done: 1, total: 1, percent: 100 }, "xong hết");

/* ── Khi nào gom nhóm ─────────────────────────────────────────────────────── */
console.log("\n— Khi nào gom nhóm —");
ok(!shouldCluster([ph("a", true), ph("b", false)], 0, 5), "CHƯA quét hết thì KHÔNG gom (nhóm sẽ nhảy sau mỗi mẻ)");
ok(shouldCluster([ph("a", true)], 0, 3), "quét hết mà chưa có ai → gom");
ok(!shouldCluster([ph("a", true)], 4, 0), "quét hết, đã có người, không ảnh mới → thôi, khỏi gom lại");
ok(shouldCluster([ph("a", true)], 4, 2), "đã có người nhưng vừa quét thêm ảnh mới → gom lại");
ok(!shouldCluster([], 0, 0), "album rỗng → không gom");

/* ── Dòng trạng thái cho studio ───────────────────────────────────────────── */
console.log("\n— Trạng thái hiện cho studio —");
eq(stateOf({ ...base, photos: [] }).kind, "empty", "đã tải xong, album thật sự không có ảnh");
/*
 * Phép quan trọng nhất của cả bộ này. Danh sách ảnh khởi tạo bằng mảng rỗng, nên
 * "chưa đọc xong" và "đọc xong, rỗng" trông y hệt nhau nếu không có cờ riêng —
 * và màn hình sẽ báo "Chưa có ảnh nào trong album" cho một album đầy ảnh. Đó
 * đúng là lời nói dối đã tốn năm vòng qua lại: studio đi tìm nguyên nhân ở hoàn
 * toàn chỗ khác.
 */
eq(stateOf({ ...base, photos: [], loaded: false }).kind, "loading", "CHƯA đọc xong ≠ album rỗng");
eq(
  stateOf({ ...base, photos: [ph("a", false)], loaded: false }).kind,
  "loading",
  "chưa đọc xong thì chưa nói gì về tiến độ"
);
eq(
  stateOf({ ...base, photos: [], loaded: false, error: "mất mạng" }).kind,
  "error",
  "…nhưng có lỗi thì báo lỗi ngay, không đợi tải xong"
);
eq(stateOf({ ...base, photos: [ph("a", false)], running: true }).kind, "scanning", "đang quét");
eq(stateOf({ ...base, photos: [ph("a", true)], clustering: true }).kind, "clustering", "đang gom");
eq(stateOf({ ...base, photos: [ph("a", true)], savedPeople: 3 }).kind, "done", "xong, có người");
// Hai tình huống RẤT khác nhau, cố ý không gộp làm một câu chung.
eq(stateOf({ ...base, photos: [ph("a", true)] }).kind, "none", "xong mà không thấy ai — khác hẳn 'chưa có ảnh'");
eq(stateOf({ ...base, photos: [ph("a", false)] }).kind, "paused", "dừng giữa chừng (đóng tab / hết trần)");
eq(stateOf({ ...base, photos: [ph("a", true)], error: "hỏng" }).kind, "error", "có lỗi thì báo lỗi, không giả vờ xong");
{
  const s = stateOf({ ...base, photos: [ph("a", true), ph("b", false)], running: true });
  eq(s.progress, { done: 1, total: 2, percent: 50 }, "trạng thái đang quét mang theo tiến độ");
}
{
  // Lỗi phải THẮNG mọi trạng thái khác: đang chạy mà hỏng thì vẫn là hỏng.
  const s = stateOf({ ...base, photos: [ph("a", false)], running: true, error: "mất mạng" });
  eq(s.kind, "error", "đang quét mà lỗi → vẫn báo lỗi");
}

console.log(`\n${pass} đạt${fails.length ? `, ${fails.length} KHÔNG đạt` : ""}`);
if (fails.length) {
  for (const f of fails) console.log(`  ✗ ${f}`);
  process.exit(1);
}
console.log("Tất cả kiểm thử đạt");
