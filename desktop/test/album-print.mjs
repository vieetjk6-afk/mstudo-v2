/* Kiểm thử ảnh in tặng (src/lib/album-print-rules.ts).
 *
 * Vì sao đáng test: số ảnh in là quà theo hợp đồng — vượt số là studio in lố,
 * tự cắt bớt là âm thầm bỏ ảnh khách đã chọn. Và thư mục "Ảnh in" phải nằm
 * trong đúng thư mục giao file hoàn thiện, không lạc sang thư mục con / video.
 */
import { cleanPrintIds, isPrintable, normalizeQuota, pickDeliveryFolder, PRINT_FOLDER_NAME } from "../../src/lib/album-print-rules.ts";

let fail = 0;
const check = (name, got, want) => {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g !== w) {
    fail++;
    console.log(`✗ ${name}\n    got:  ${g}\n    want: ${w}`);
  } else console.log(`✓ ${name}`);
};

check("tên thư mục", PRINT_FOLDER_NAME, "Ảnh in");

check("số ảnh tặng: số dương", normalizeQuota(20), 20);
check("số ảnh tặng: chuỗi số", normalizeQuota("15"), 15);
check("số ảnh tặng: trống = không tặng", normalizeQuota(null), 0);
check("số ảnh tặng: 0 = không tặng", normalizeQuota(0), 0);
check("số ảnh tặng: âm = không tặng", normalizeQuota(-3), 0);
check("số ảnh tặng: làm tròn xuống", normalizeQuota(7.9), 7);
check("số ảnh tặng: chặn trên", normalizeQuota(99999), 500);

check("bỏ trùng + bỏ rỗng", cleanPrintIds(["a", "b", "a", "", 5], 5), { ok: true, ids: ["a", "b"] });
check("đúng bằng số tặng", cleanPrintIds(["a", "b", "c"], 3), { ok: true, ids: ["a", "b", "c"] });
check("vượt số tặng → lỗi, không tự cắt", cleanPrintIds(["a", "b", "c", "d"], 3), { ok: false, error: "limit_exceeded" });
check("trùng không tính vào số", cleanPrintIds(["a", "a", "b", "c"], 3), { ok: true, ids: ["a", "b", "c"] });
check("không phải mảng", cleanPrintIds("a,b", 3), { ok: false, error: "bad_request" });

check("ảnh in được", isPrintable({ name: "IMG_001.jpg" }), true);
check("video theo cờ", isPrintable({ name: "clip.jpg", is_video: true }), false);
check("video theo đuôi", isPrintable({ name: "Phong su.MP4" }), false);

const sources = [
  { id: "s1", name: "JPG Goc", stage: "selection", drive_url: "https://drive.google.com/drive/folders/goc", position: 0 },
  { id: "s4", name: "Ngày 1", stage: "delivery", drive_url: "https://drive.google.com/drive/folders/con", position: 5 },
  { id: "s3", name: "Video HoanThien", stage: "delivery", drive_url: "https://drive.google.com/drive/folders/video", position: 3 },
  { id: "s2", name: "File ChinhSua", stage: "delivery", drive_url: "https://drive.google.com/drive/folders/chinhsua", position: 2 },
];
check("chọn thư mục gốc giao khách (không phải con, không phải video)", pickDeliveryFolder(sources)?.id, "s2");
check("chỉ có video thì dùng video", pickDeliveryFolder([sources[2]])?.id, "s3");
check("không có nguồn giao khách", pickDeliveryFolder([sources[0]]), null);
check("nguồn giao khách thiếu link bị bỏ", pickDeliveryFolder([{ ...sources[3], drive_url: null }]), null);

if (fail) {
  console.log(`\n${fail} kiểm thử lỗi`);
  process.exit(1);
}
console.log("\nTất cả kiểm thử đều qua.");
