/* Kiểm thử: phần Storage của kho khuôn mặt (src/lib/face-kho-server.ts) với
 * một Storage giả — ghi kép từ bộ quét, đọc + gộp, nén nhiều mảnh, và hỏng
 * Storage KHÔNG làm hỏng lượt quét.
 */
import { ghiKepVaoKho, ghiManh, docKho, nenNeuCan, lietKeManh, NEN_KHI_QUA } from "../../src/lib/face-kho-server.ts";
import { NGUON_KHACH, NGUON_STUDIO } from "../../src/lib/face-kho.ts";

let fail = 0;
const ok = (name, cond, note = "") => {
  if (!cond) fail++;
  console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : `  ${note}`}`);
};
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const vec = (x) => Array.from({ length: 128 }, (_, i) => ((i * 7 + x) % 13) / 40 - 0.15);

function fakeStorage({ hong = false } = {}) {
  const files = new Map();
  const bucket = {
    async upload(path, bytes) {
      if (hong) return { error: { message: "bucket not found" } };
      if (files.has(path)) return { error: { message: "exists" } };
      files.set(path, bytes.slice());
      return { error: null };
    },
    async list(prefix, { limit, offset }) {
      const rows = [...files.keys()].filter((k) => k.startsWith(prefix + "/")).sort().map((k) => ({ name: k.slice(prefix.length + 1), metadata: { size: files.get(k).length } }));
      return { data: rows.slice(offset, offset + limit), error: null };
    },
    async download(path) {
      const b = files.get(path);
      return b ? { data: new Blob([b]), error: null } : { data: null, error: { message: "nf" } };
    },
    async remove(paths) {
      for (const p of paths) files.delete(p);
      return { error: null };
    },
  };
  return { db: { storage: { from: () => bucket } }, files };
}

const A = id(999);

/* 1. ghi kép từ bộ quét: ảnh 0 mặt vẫn vào kho */
{
  const { db } = fakeStorage();
  await ghiKepVaoKho(db, A, [{ album_id: A, photo_id: id(1), at: 0, box: [0.1, 0.1, 0.2, 0.2], descriptor: vec(1), sharpness: 5 }], [id(1), id(2)]);
  const { kho } = await docKho(db, A);
  ok("ghi kép: ảnh có mặt + ảnh 0 mặt đều vào kho", kho.size === 2 && kho.get(id(1)).faces.length === 1 && kho.get(id(2)).faces.length === 0);
  ok("ghi kép là nguồn studio", kho.get(id(1)).nguon === NGUON_STUDIO);
}

/* 2. Storage hỏng → không ném (lượt quét không được đỏ vì kho) */
{
  const { db } = fakeStorage({ hong: true });
  let nem = false;
  try { await ghiKepVaoKho(db, A, [], [id(1)]); } catch { nem = true; }
  ok("Storage hỏng: ghi kép nuốt lỗi", !nem);
  let nem2 = false;
  try { await ghiKepVaoKho({}, A, [], [id(1)]); } catch { nem2 = true; }
  ok("db không có storage (kiểm thử cũ): bỏ qua êm", !nem2);
}

/* 3. nén nhiều mảnh, giữ đúng bản thắng */
{
  const { db, files } = fakeStorage();
  await ghiManh(db, A, { nguon: NGUON_KHACH, anh: [{ photoId: id(1), faces: [{ box: [0, 0, 0.1, 0.1], descriptor: vec(3), sharpness: 1 }] }] });
  for (let k = 0; k < NEN_KHI_QUA; k++) {
    await ghiManh(db, A, { nguon: k % 2 ? NGUON_STUDIO : NGUON_KHACH, anh: [{ photoId: id(100 + k), faces: [] }] });
  }
  await ghiManh(db, A, { nguon: NGUON_STUDIO, anh: [{ photoId: id(1), faces: [{ box: [0, 0, 0.1, 0.1], descriptor: vec(5), sharpness: 1 }] }] });
  const truoc = (await docKho(db, A)).kho;
  const nen = await nenNeuCan(db, A);
  const ds = await lietKeManh(db, A);
  const sau = (await docKho(db, A)).kho;
  ok("nén: quá ngưỡng thì nén", nen && ds.length === 2, `${ds.length} file`);
  ok("nén: không mất ảnh nào", sau.size === truoc.size && sau.size === NEN_KHI_QUA + 1);
  ok("nén: bản studio vẫn thắng sau khi nén", sau.get(id(1)).nguon === NGUON_STUDIO);
  ok("nén: ít mảnh thì không nén", (await nenNeuCan(db, A)) === false && files.size === 2);
}

console.log(fail ? `\n${fail} bài hỏng` : "\nTất cả đạt");
process.exit(fail ? 1 : 0);
