/* Kiểm thử: phần Storage của kho khuôn mặt (src/lib/face-kho-server.ts) với
 * một Storage giả — ghi kép từ bộ quét, đọc + gộp, nén nhiều mảnh, và hỏng
 * Storage KHÔNG làm hỏng lượt quét.
 */
import { ghiKepVaoKho, ghiManh, docKho, nenNeuCan, lietKeManh, NEN_KHI_QUA, docKhuonMatGom, khoPhuDuDeGom } from "../../src/lib/face-kho-server.ts";
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

/* 4. đợt 2: đọc để GOM — kho trước, album_faces cho phần thiếu */
function withPhotos(fs, scanned) {
  // photos: chỉ đủ chuỗi lọc mà anhDaQuet dùng (.select.eq.not.order.range).
  const q = { select: () => q, eq: () => q, not: () => q, order: () => q, range: async (from, to) => ({ data: scanned.slice(from, to + 1).map((id) => ({ id })), error: null }) };
  return { ...fs.db, from: () => q };
}
{
  const B = id(888);
  const fs = fakeStorage();
  await ghiKepVaoKho(fs.db, B, [
    { photo_id: id(1), at: 0, box: [0.1, 0.1, 0.2, 0.2], descriptor: vec(1), sharpness: 1 },
    { photo_id: id(1), at: 1, box: [0.5, 0.1, 0.2, 0.2], descriptor: vec(2), sharpness: 1 },
  ], [id(1), id(2)]);
  // Khách tự quét ảnh 3 — KHÔNG được dùng để gom.
  await ghiManh(fs.db, B, { nguon: NGUON_KHACH, anh: [{ photoId: id(3), faces: [{ box: [0, 0, 0.1, 0.1], descriptor: vec(9), sharpness: 1 }] }] });

  let goiDb = 0;
  const g1 = await docKhuonMatGom(withPhotos(fs, [id(1), id(2)]), B, async () => { goiDb++; return []; });
  ok("kho phủ đủ ảnh đã quét → không đọc album_faces", g1.phuDu && goiDb === 0);
  ok("…đủ mặt, đúng thứ tự at", g1.list.length === 2 && g1.list[0].at === 0 && g1.list[1].at === 1 && g1.list[0].photo_id === id(1));

  const dbRows = [
    { photo_id: id(1), at: 0, box: [0, 0, 0.1, 0.1], descriptor: vec(7), sharpness: 1 }, // trùng kho → bỏ
    { photo_id: id(4), at: 0, box: [0, 0, 0.1, 0.1], descriptor: vec(4), sharpness: 1 }, // chỉ có ở DB
  ];
  const g2 = await docKhuonMatGom(withPhotos(fs, [id(1), id(2), id(4)]), B, async () => { goiDb++; return dbRows; });
  ok("kho thiếu ảnh → đọc album_faces cho phần thiếu", !g2.phuDu && goiDb === 1);
  {
    const anh1 = g2.list.filter((r) => r.photo_id === id(1));
    ok("…bản kho thắng bản DB khi trùng ảnh", anh1.length === 2 && Math.abs(anh1[0].descriptor[5] - vec(1)[5]) < 0.001 && anh1.every((r) => r.descriptor !== dbRows[0].descriptor));
  }
  ok("…ảnh chỉ có ở DB vẫn có mặt", g2.list.some((r) => r.photo_id === id(4)));
  ok("…dữ liệu khách tự quét không vào lượt gom", !g2.list.some((r) => r.photo_id === id(3)));

  const g3 = await docKhuonMatGom(withPhotos(fs, [id(2)]), B, async () => []);
  ok("ảnh đã xoá khỏi album (không còn mốc) không vào lượt gom", g3.phuDu && !g3.list.some((r) => r.photo_id === id(1)));

  ok("album chưa quét tấm nào → KHÔNG coi là phủ đủ (gom sẽ xoá sạch người)", (await khoPhuDuDeGom(withPhotos(fs, []), B)) === false);
  ok("khoPhuDuDeGom: đủ", (await khoPhuDuDeGom(withPhotos(fs, [id(1), id(2)]), B)) === true);
  ok("khoPhuDuDeGom: ảnh chỉ có bản khách → chưa đủ", (await khoPhuDuDeGom(withPhotos(fs, [id(1), id(3)]), B)) === false);
}

console.log(fail ? `\n${fail} bài hỏng` : "\nTất cả đạt");
process.exit(fail ? 1 : 0);
