/* Kiểm thử luật QUÉT THƯ MỤC TRÊN MÁY của công cụ Lọc ảnh (src/lib/local-walk.ts).
 *
 * Cùng một gốc lỗi đã vá bên Drive, nhưng ở nguồn "Máy tính": chọn THƯ MỤC GỐC
 * của buổi chụp thì phải thấy cả ảnh nằm trong thư mục con (JPG / RAW / theo
 * ngày), chứ không chỉ file nằm trơ ngay thư mục gốc.
 *
 * Nạp thẳng code thật; FileSystemDirectoryHandle được thay bằng cây giả.
 */
import { walkLocalDir, splitWebkitPath, dirDepth } from "../../src/lib/local-walk.ts";

let fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};

// Cây thư mục giả đúng hình dạng File System Access API.
const file = (name) => ({ kind: "file", name });
const dir = (name, children = []) => ({
  kind: "directory",
  name,
  values: async function* () {
    for (const c of children) yield c;
  },
});
const IMG = /\.(jpe?g|png|cr2|nef|arw)$/i;
const isPhoto = (n) => IMG.test(n);
const keys = (w) => w.files.map((f) => f.key);

// ── 1. GỐC LỖI: thư mục gốc chỉ chứa thư mục con ──────────────────────────
{
  const root = dir("Buổi chụp", [
    dir("JPG", [file("IMG_001.jpg"), file("IMG_002.jpg")]),
    dir("RAW", [file("IMG_001.CR2")]),
  ]);
  const w = await walkLocalDir(root, isPhoto);
  check("quét cả thư mục con (lỗi vừa vá)", keys(w), ["JPG/IMG_001.jpg", "JPG/IMG_002.jpg", "RAW/IMG_001.CR2"]);
  check("đếm đúng số thư mục con", w.subfolders, 2);
  check("giữ tên file để đối chiếu danh sách khách", w.files.map((f) => f.name), ["IMG_001.jpg", "IMG_002.jpg", "IMG_001.CR2"]);
  check("ghi lại thư mục con của từng ảnh", w.files.map((f) => f.dir), ["JPG", "JPG", "RAW"]);
}

// ── 2. Ảnh ngay thư mục gốc lên trước ảnh trong thư mục con ───────────────
{
  const root = dir("G", [dir("Sau", [file("b.jpg")]), file("a.jpg")]);
  check("duyệt theo chiều rộng: ảnh gốc trước", keys(await walkLocalDir(root, isPhoto)), ["a.jpg", "Sau/b.jpg"]);
}

// ── 3. Hai ảnh KHÁC NHAU trùng tên ở hai thư mục con ──────────────────────
{
  const root = dir("G", [dir("Ngày 1", [file("IMG_001.jpg")]), dir("Ngày 2", [file("IMG_001.jpg")])]);
  const w = await walkLocalDir(root, isPhoto);
  check("cả hai đều được giữ", w.files.length, 2);
  check("khoá khác nhau nên không đè nhau", keys(w), ["Ngày 1/IMG_001.jpg", "Ngày 2/IMG_001.jpg"]);
}

// ── 4. Bỏ file không phải ảnh, và trần độ sâu ────────────────────────────
{
  const root = dir("G", [file("hop-dong.pdf"), file("a.jpg"), dir("Rỗng", [])]);
  check("bỏ file không phải ảnh", keys(await walkLocalDir(root, isPhoto)), ["a.jpg"]);

  const sau = dir("G", [dir("A", [dir("B", [dir("C", [file("x.jpg")])])])]);
  check("maxDepth 4 → tới được ảnh ở tầng cuối", keys(await walkLocalDir(sau, isPhoto, { maxDepth: 4 })), ["A/B/C/x.jpg"]);
  check("maxDepth 3 → chưa chạm tầng chứa ảnh", keys(await walkLocalDir(sau, isPhoto, { maxDepth: 3 })), []);
}

// ── 5. Trần số ảnh ────────────────────────────────────────────────────────
{
  const many = Array.from({ length: 10 }, (_, i) => file(`IMG_${i}.jpg`));
  const w = await walkLocalDir(dir("G", many), isPhoto, { maxFiles: 4 });
  check("chạm trần maxFiles → cắt danh sách", w.files.length, 4);
  check("và báo truncated để giao diện nói rõ", w.truncated, true);
}

// ── 6. Nhánh <input webkitdirectory> (trình duyệt không có FS API) ────────
{
  check("tách đường dẫn có thư mục con", splitWebkitPath("Buổi chụp/RAW/IMG_001.CR2"), { root: "Buổi chụp", dir: "RAW" });
  check("file nằm ngay thư mục gốc", splitWebkitPath("Buổi chụp/IMG_001.jpg"), { root: "Buổi chụp", dir: "" });
  check("chọn từng ảnh (không có đường dẫn)", splitWebkitPath(""), { root: "", dir: "" });
  check("cấp thư mục con: gốc = 0", dirDepth(""), 0);
  check("cấp thư mục con: hai tầng", dirDepth("Ngày 1/Sáng"), 2);
}

console.log(fail === 0 ? "\nTẤT CẢ ĐẠT" : `\n${fail} phép kiểm thất bại`);
process.exit(fail === 0 ? 0 : 1);
