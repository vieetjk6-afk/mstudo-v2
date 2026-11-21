/* Kiểm thử isDriveUrl (src/lib/drive.ts) + tên nguồn hiện cho khách.
 *
 * Lỗi đã gặp: ô "Thêm nguồn ảnh" của album nhận mọi link — example.com được lưu
 * thành nguồn 0 ảnh rồi lộ ra trang khách thành nút "Tải ảnh gốc" mở trang lạ,
 * tên mục là "File"/"Folder" tiếng Anh.
 */
import { isDriveUrl } from "../../src/lib/drive.ts";
import { friendlySourceName, pickFolderLinks } from "../../src/lib/album-original.ts";

let fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};

check("link thư mục", isDriveUrl("https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUv"), true);
check("link thư mục /u/0/", isDriveUrl("https://drive.google.com/drive/u/0/folders/1AbCdEfGhIjKlMnOpQrStUv?usp=sharing"), true);
check("link open?id=", isDriveUrl("https://drive.google.com/open?id=1AbCdEfGhIjKlMnOpQrStUv"), true);
check("link file", isDriveUrl("https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUv/view"), true);
check("id trần", isDriveUrl("1AbCdEfGhIjKlMnOpQrStUvWx"), true);
check("trang lạ", isDriveUrl("https://example.com/not-drive"), false);
check("giả mạo host", isDriveUrl("https://drive.google.com.evil.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUv"), false);
check("drive nhưng không có id", isDriveUrl("https://drive.google.com/drive/my-drive"), false);
check("rỗng", isDriveUrl(""), false);

check("tên mặc định tiếng Anh → tiếng Việt", friendlySourceName("Folder"), "Thư mục ảnh");
check("giữ tên studio đặt", friendlySourceName("Ảnh cổng cưới"), "Ảnh cổng cưới");
check("trang khách bỏ nguồn link lạ", pickFolderLinks([
  { name: "Folder", drive_url: "https://example.com/x", kind: "file", stage: null },
  { name: "Folder", drive_url: "https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUv", kind: "folder", stage: null },
]), [{ name: "Thư mục ảnh", url: "https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUv" }]);

if (fail) { console.log(`\n${fail} kiểm thử hỏng`); process.exit(1); }
console.log("\nTất cả đạt.");
