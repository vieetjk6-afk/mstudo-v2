/* Kiểm thử luật chọn link thư mục Drive cho nút "Tải ảnh từ Drive" ở album khách.
 *
 * Nút này là đường tải hàng loạt DUY NHẤT không tốn băng thông Vercel/Supabase
 * (Google tự nén và tự phục vụ). Ba điều dễ vỡ:
 *  1. Chỉ nhận nguồn là THƯ MỤC. `stage` mặc định 'selection' cho mọi nguồn, nên
 *     nếu nhận cả link file lẻ thì album ghép từ 30 ảnh sẽ đẻ ra menu 30 dòng.
 *  2. Nguồn thiếu drive_url phải bị loại, không được đẻ ra link rỗng.
 *  3. pickOriginalLinks (nút "File gốc" ở album giao khách) vẫn phải giữ nguyên
 *     hành vi cũ — rộng hơn, có nhận link file khi stage='selection'.
 *
 * Nạp thẳng code thật ở src/lib/album-original.ts.
 */
import { pickFolderLinks, pickOriginalLinks } from "../../src/lib/album-original.ts";

let fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};

const folder = (name, url, stage = "selection") => ({ name, drive_url: url, kind: "folder", stage });
const file = (name, url, stage = "selection") => ({ name, drive_url: url, kind: "file", stage });

check(
  "một thư mục → một link",
  pickFolderLinks([folder("Ảnh cưới", "https://drive.google.com/drive/folders/AAA")]),
  [{ name: "Ảnh cưới", url: "https://drive.google.com/drive/folders/AAA" }]
);

check(
  "album toàn link file lẻ → KHÔNG có link nào (không hiện nút)",
  pickFolderLinks([file("1.jpg", "https://drive.google.com/file/d/A/view"), file("2.jpg", "https://drive.google.com/file/d/B/view")]),
  []
);

check(
  "trộn thư mục và file lẻ → chỉ lấy thư mục",
  pickFolderLinks([file("1.jpg", "https://drive.google.com/file/d/A/view"), folder("Buổi 2", "https://drive.google.com/drive/folders/BBB")]),
  [{ name: "Buổi 2", url: "https://drive.google.com/drive/folders/BBB" }]
);

check(
  "nguồn thiếu drive_url → bị loại",
  pickFolderLinks([{ name: "Hỏng", drive_url: null, kind: "folder", stage: "selection" }]),
  []
);

check(
  "thư mục chưa đặt tên → có nhãn dự phòng",
  pickFolderLinks([folder("", "https://drive.google.com/drive/folders/CCC")]),
  [{ name: "Thư mục ảnh", url: "https://drive.google.com/drive/folders/CCC" }]
);

check(
  "nhiều thư mục → giữ đủ và đúng thứ tự",
  pickFolderLinks([folder("Buổi 1", "u1"), folder("Buổi 2", "u2")]).map((f) => f.name),
  ["Buổi 1", "Buổi 2"]
);

// Không được đụng tới hành vi của nút "File gốc" ở album giao khách.
check(
  "pickOriginalLinks vẫn nhận link file khi stage='selection'",
  pickOriginalLinks([file("goc.jpg", "https://drive.google.com/file/d/A/view", "selection")]),
  [{ name: "goc.jpg", url: "https://drive.google.com/file/d/A/view" }]
);

check(
  "pickOriginalLinks bỏ file lẻ khi chưa gắn giai đoạn",
  pickOriginalLinks([file("goc.jpg", "https://drive.google.com/file/d/A/view", null)]),
  []
);

console.log(fail === 0 ? "\nTất cả kiểm thử đạt" : `\n${fail} kiểm thử KHÔNG đạt`);
process.exit(fail === 0 ? 0 : 1);
