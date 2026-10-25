/* Kiểm thử luật "album NÀO là album giao khách của hợp đồng" + chốt autosave.
 *
 * Vì sao đáng test:
 *   1. Trước đây mỗi nơi (cổng khách, /a/[slug], tin Zalo "ảnh đã sẵn sàng",
 *      cron, màn hợp đồng) tự đoán và đa số chỉ nhìn gallery_album_id — studio
 *      chuyển album của hợp đồng sang giao khách mà hệ thống vẫn coi là chưa
 *      giao, đẻ thêm album "Giao khách · …" rỗng và đẩy khách sang đó. Giờ chỉ
 *      một luật ở src/lib/contract-album.ts.
 *   2. autosaveContract của màn hợp đồng từng ghi `status`, `gallery_album_id`,
 *      `selection_album_id` từ state cục bộ (có thể cũ): server vừa tạo album
 *      lúc đổi trạng thái thì lượt tự lưu kế tiếp xoá mất. Quét chuỗi để luật
 *      "không ghi ba cột đó" không quay lại trong im lặng.
 *
 * Nạp thẳng code thật (cần --import ./desktop/test/giai-duong-ts.mjs vì
 * contract-album.ts nhập "./album-phase" không đuôi).
 */
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  resolveDeliveredAlbum,
  isLiveDelivery,
  albumPhaseLabel,
  albumOptionLabel,
  AUTOSAVE_FORBIDDEN_KEYS,
} from "../../src/lib/contract-album.ts";

let fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};
const via = (r) => (r ? `${r.via}:${r.album.id}` : null);

const sel = (o = {}) => ({ id: "S", phase: "selection", is_gallery: false, status: "published", ...o });
const gal = (o = {}) => ({ id: "G", phase: "delivery", is_gallery: true, status: "published", ...o });

/* ── resolveDeliveredAlbum ─────────────────────────────────────────────── */
check("không gắn album nào → chưa giao", via(resolveDeliveredAlbum({})), null);
check("chỉ album chọn ảnh, còn chọn ảnh → chưa giao", via(resolveDeliveredAlbum({ selection: sel() })), null);
check(
  "dự án hợp nhất: album của hợp đồng đã sang giao khách → nó là album giao",
  via(resolveDeliveredAlbum({ selection: sel({ phase: "delivery" }) })),
  "selection:S",
);
check("album giao riêng đang giao khách → thắng", via(resolveDeliveredAlbum({ gallery: gal(), selection: sel() })), "gallery:G");
check(
  "cả hai đều giao khách → album giao riêng thắng",
  via(resolveDeliveredAlbum({ gallery: gal(), selection: sel({ phase: "delivery" }) })),
  "gallery:G",
);
check(
  "album giao riêng bị đưa VỀ chọn ảnh (is_gallery còn bật) → rơi về album của hợp đồng",
  via(resolveDeliveredAlbum({ gallery: gal({ phase: "selection" }), selection: sel({ phase: "delivery" }) })),
  "selection:S",
);
check(
  "album giao riêng chưa xuất bản → không tính",
  via(resolveDeliveredAlbum({ gallery: gal({ status: "draft" }), selection: sel() })),
  null,
);
check(
  "album đời đầu: phase null + is_gallery → giao khách",
  via(resolveDeliveredAlbum({ gallery: gal({ phase: null }) })),
  "gallery:G",
);
check("status không nạp (undefined) → coi như đã xuất bản", isLiveDelivery({ id: "X", phase: "delivery" }), true);
check("status null → chưa xuất bản", isLiveDelivery({ id: "X", phase: "delivery", status: null }), false);

/* ── Nhãn ô chọn ───────────────────────────────────────────────────────── */
check("nhãn giai đoạn: giao khách", albumPhaseLabel({ phase: "delivery" }), "Giao khách");
check("nhãn giai đoạn: chọn ảnh (kể cả is_gallery cũ)", albumPhaseLabel({ phase: "selection", is_gallery: true }), "Chọn ảnh");
check(
  "nhãn ô chọn có huy hiệu + đánh dấu HĐ khác",
  albumOptionLabel({ id: "A", title: "Cưới An", slug: "a", phase: "selection", published: true, linkedElsewhere: true }),
  "Cưới An · Chọn ảnh · đang gắn HĐ khác",
);
check(
  "nhãn ô chọn: album nháp",
  albumOptionLabel({ id: "A", title: "Cưới An", slug: "a", phase: "delivery", published: false, linkedElsewhere: false }),
  "Cưới An · Giao khách · nháp",
);

/* ── Chốt autosave của màn hợp đồng ────────────────────────────────────── */
// Logic màn hợp đồng nằm ở hook dùng chung (useContractEditor.ts) cho cả bản cũ
// lẫn giao diện mới; đọc GỘP hook + mọi file giao diện của màn để luật bên dưới
// soi được cả hai bản.
const editorDir = resolve(import.meta.dirname, "../../src/app/dashboard/studio/contracts/[id]");
const editor = ["useContractEditor.ts", ...readdirSync(editorDir).filter((n) => /^Contract.*\.tsx$/.test(n)).sort()]
  .map((n) => readFileSync(resolve(editorDir, n), "utf8"))
  .join("\n");
const start = editor.indexOf("async function autosaveContract(");
check("tìm thấy autosaveContract", start >= 0, true);
// Thân hàm tới `.eq("id", contract.id)` đầu tiên — chính là payload update.
const body = editor.slice(start, editor.indexOf('.eq("id", contract.id)', start));
const payload = body.slice(body.indexOf(".update("));
// Bỏ comment để câu giải thích nhắc tên cột không bị tính là ghi.
const code = payload.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
for (const k of AUTOSAVE_FORBIDDEN_KEYS) {
  check(`autosaveContract KHÔNG ghi ${k}`, new RegExp(`\\b${k}\\s*:`).test(code), false);
}
// Đổi trạng thái không được hẹn lượt autosave (set("status", …)).
check('changeStatus không dùng set("status", …)', /\bset\(\s*["']status["']/.test(editor), false);
// Ô chọn album lưu ngay, không qua set() → autosave.
check('ô chọn album không dùng set("…_album_id", …)', /\bset\(\s*["'](gallery|selection)_album_id["']/.test(editor), false);

console.log(fail ? `\n${fail} kiểm thử HỎNG` : "\nTất cả đều ổn");
process.exit(fail ? 1 : 0);
