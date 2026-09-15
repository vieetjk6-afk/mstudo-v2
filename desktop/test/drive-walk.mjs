/* Kiểm thử luật DUYỆT ẢNH trên Drive của công cụ Lọc ảnh (src/lib/drive-walk.ts).
 *
 * Gốc lỗi đang vá: "Lọc ảnh trên Drive không được — bấm Tải ảnh không có gì
 * xảy ra". Hai nguyên nhân nằm ở khâu liệt kê file:
 *  1. Chỉ nhận file có mimeType image/ | video/. Drive trả RAW máy ảnh
 *     (CR2/CR3/NEF/ARW) là application/octet-stream ⇒ thư mục toàn RAW ra 0 ảnh.
 *  2. Chỉ quét MỘT tầng. Thư mục buổi chụp hay chỉ chứa thư mục con
 *     (JPG / RAW / theo ngày) ⇒ thư mục gốc không có file nào ⇒ cũng 0 ảnh.
 *
 * Nạp thẳng code thật; phần đọc con của thư mục được thay bằng cây giả.
 */
import { walkPhotos, isPhotoFile, FOLDER_MIME } from "../../src/lib/drive-walk.ts";

let fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};

const dir = (id, name) => ({ id, name, mimeType: FOLDER_MIME });
const img = (id, name, mimeType = "image/jpeg") => ({ id, name, mimeType });
/** Cây thư mục giả: id cha → danh sách con. */
const tree = (map) => async (id) => map[id] ?? [];
const names = (w) => w.files.map((f) => f.name);

// ── 1. Nhận ảnh theo ĐUÔI khi Drive không trả mimeType ảnh ────────────────
{
  check("mimeType image/ → là ảnh", isPhotoFile(img("1", "a.jpg")), true);
  check("RAW octet-stream vẫn là ảnh (lỗi vừa vá)", isPhotoFile(img("2", "IMG_001.CR2", "application/octet-stream")), true);
  check("RAW không có mimeType vẫn là ảnh", isPhotoFile({ id: "3", name: "DSC01.arw" }), true);
  check("video là ảnh (được lọc chung)", isPhotoFile(img("4", "clip.mp4", "video/mp4")), true);
  check("thư mục không bao giờ là ảnh", isPhotoFile(dir("5", "RAW")), false);
  check("file khác (PDF hợp đồng) không phải ảnh", isPhotoFile(img("6", "hop-dong.pdf", "application/pdf")), false);
}

// ── 2. GỐC LỖI: thư mục cha CHỈ CHỨA thư mục con ──────────────────────────
{
  const t = tree({ P: [dir("A", "JPG"), dir("B", "RAW")], A: [img("a1", "IMG_001.jpg")], B: [img("b1", "IMG_001.CR2", "application/octet-stream")] });
  const flat = await walkPhotos("P", t);
  check("không quét sâu → thư mục cha rỗng (đúng hành vi cũ)", names(flat), []);
  check("nhưng vẫn đếm được thư mục con để báo cho người dùng", flat.subfolders, 2);

  const deep = await walkPhotos("P", t, { recursive: true });
  check("quét sâu → gom ảnh trong mọi thư mục con", names(deep), ["IMG_001.jpg", "IMG_001.CR2"]);
  check("và đếm đúng số thư mục con đã quét", deep.subfolders, 2);
}

// ── 3. Quét nhiều tầng, có trần độ sâu ────────────────────────────────────
{
  const t = tree({ P: [dir("A", "Ngày 1")], A: [dir("A1", "Sáng")], A1: [dir("A2", "Buổi 1")], A2: [img("x", "sau.jpg")] });
  check("mặc định 4 tầng → tới được ảnh ở tầng cuối", names(await walkPhotos("P", t, { recursive: true })), ["sau.jpg"]);
  check("maxDepth 2 → chưa chạm tầng chứa ảnh", names(await walkPhotos("P", t, { recursive: true, maxDepth: 2 })), []);
}

// ── 4. Chặn lặp vô tận & không trả trùng file ─────────────────────────────
{
  // Drive cho phép một thư mục nằm trong nhiều cha → cây có thể thành vòng.
  const t = tree({ P: [dir("A", "A")], A: [dir("P", "quay lại P"), img("x", "a.jpg")] });
  const w = await walkPhotos("P", t, { recursive: true, maxDepth: 10 });
  check("thư mục lặp vòng không làm treo, ảnh chỉ đếm một lần", names(w), ["a.jpg"]);
}
{
  // Cùng một file xuất hiện ở hai thư mục con.
  const shared = img("s1", "chung.jpg");
  const t = tree({ P: [dir("A", "A"), dir("B", "B")], A: [shared], B: [shared] });
  check("file nằm ở hai thư mục chỉ trả về một lần", names(await walkPhotos("P", t, { recursive: true })), ["chung.jpg"]);
}

// ── 5. Trần số ảnh ────────────────────────────────────────────────────────
{
  const many = Array.from({ length: 10 }, (_, i) => img(`f${i}`, `IMG_${i}.jpg`));
  const w = await walkPhotos("P", tree({ P: many }), { maxFiles: 4 });
  check("chạm trần maxFiles → cắt danh sách", w.files.length, 4);
  check("và báo truncated để giao diện nói rõ", w.truncated, true);
}

console.log(fail === 0 ? "\nTẤT CẢ ĐẠT" : `\n${fail} phép kiểm thất bại`);
process.exit(fail === 0 ? 0 : 1);
