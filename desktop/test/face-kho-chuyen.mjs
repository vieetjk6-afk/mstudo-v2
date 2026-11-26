/* Kiểm thử: chuyển album_faces cũ sang kho file (src/lib/face-kho-chuyen.ts).
 *
 * Vì sao: đây là bước XOÁ dữ liệu không hoàn tác được. Điều phải giữ bằng mọi
 * giá: chỉ xoá dòng album_faces của một album SAU KHI kho đã có đủ (đúng ảnh,
 * đúng số mặt) — Storage hỏng hay kho lệch thì giữ nguyên DB.
 */
import { chuyenMotAlbum, chuyenSangKho } from "../../src/lib/face-kho-chuyen.ts";
import { ghiManh } from "../../src/lib/face-kho-server.ts";
import { NGUON_STUDIO } from "../../src/lib/face-kho.ts";
import { khoGia } from "./kho-gia.mjs";

let fail = 0;
const ok = (name, cond, note = "") => {
  if (!cond) fail++;
  console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : `  ${note}`}`);
};
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const vec = (x) => Array.from({ length: 128 }, (_, i) => ((i * 5 + x) % 11) / 30 - 0.15);
const A = id(900), B = id(901);

/** DB giả: album_faces, photos (mốc quét), albums — đủ chuỗi lọc mà module dùng. */
function fakeDb({ faces, photos, albums, kho }) {
  const t = { album_faces: faces, photos, albums };
  const from = (table) => {
    const f = [];
    let op = "select", payload = null, head = false, cnt = false, rng = null;
    const hit = () => t[table].filter((r) => f.every((fn) => fn(r)));
    const self = {
      select(_c, o) { if (o?.head) head = true; if (o?.count) cnt = true; return self; },
      delete(o) { op = "delete"; if (o?.count) cnt = true; return self; },
      update(p) { op = "update"; payload = p; return self; },
      eq(c, v) { f.push((r) => r[c] === v); return self; },
      is(c, v) { if (v === null) f.push((r) => r[c] == null); return self; },
      not(c, o, v) { if (o === "is" && v === null) f.push((r) => r[c] != null); return self; },
      order() { return self; },
      range(a, b) { rng = [a, b]; return self; },
      then(res) {
        const h = hit();
        if (op === "delete") { t[table] = t[table].filter((r) => !h.includes(r)); return res({ data: null, count: h.length, error: null }); }
        if (op === "update") { for (const r of h) Object.assign(r, payload); return res({ data: h, error: null }); }
        if (head) return res({ data: null, count: h.length, error: null });
        return res({ data: rng ? h.slice(rng[0], rng[1] + 1) : h, count: cnt ? h.length : null, error: null });
      },
    };
    return self;
  };
  return { from, t, storage: kho.storage };
}

const mat = (album, photo, at, x) => ({ album_id: album, photo_id: id(photo), at, box: [0.1, 0.1, 0.2, 0.2], descriptor: vec(x), sharpness: 3 });

/* 1. chuyển đủ */
{
  const kho = khoGia();
  const db = fakeDb({
    kho,
    faces: [mat(A, 1, 0, 1), mat(A, 1, 1, 2), mat(A, 2, 0, 3), mat(B, 7, 0, 7),
      // real[] về dạng chuỗi như PostgREST có lúc trả
      { album_id: A, photo_id: id(4), at: 0, box: "{0.5,0.5,0.1,0.1}", descriptor: `{${vec(4).join(",")}}`, sharpness: 1 }],
    photos: [1, 2, 3, 4].map((n) => ({ id: id(n), album_id: A, faces_scanned_at: "2026-01-01" })).concat([{ id: id(7), album_id: B, faces_scanned_at: "2026-01-01" }]),
    albums: [{ id: A, faces_kho_at: null }, { id: B, faces_kho_at: null }],
  });
  const r = await chuyenMotAlbum(db, A);
  const k = kho.kho(A);
  ok("chép đủ ảnh vào kho (cả ảnh 0 mặt)", k.size === 4 && k.get(id(3)).faces.length === 0, `${k.size}`);
  ok("…đúng số mặt, đúng thứ tự at", k.get(id(1)).faces.length === 2 && Math.abs(k.get(id(1)).faces[1].descriptor[3] - vec(2)[3]) < 0.001);
  ok("…đọc được real[] dạng chuỗi", k.get(id(4)).faces.length === 1 && Math.abs(k.get(id(4)).faces[0].box[0] - 0.5) < 1e-3);
  ok("…là bản studio", [...k.values()].every((v) => v.nguon === NGUON_STUDIO));
  ok("xoá ĐÚNG dòng của album này, album khác còn nguyên", r.dongXoa === 4 && db.t.album_faces.length === 1 && db.t.album_faces[0].album_id === B);
  ok("đặt mốc faces_kho_at", !!db.t.albums[0].faces_kho_at && !db.t.albums[1].faces_kho_at);

  const tong = await chuyenSangKho(db, { nganSachMs: 10_000 });
  ok("lượt cron: chuyển album còn lại, bỏ qua album đã có mốc", tong.ok && tong.album === 1 && db.t.album_faces.length === 0 && kho.kho(B).size === 1, JSON.stringify(tong));
}

/* 2. album không có dòng nào: chỉ đặt mốc */
{
  const kho = khoGia();
  const db = fakeDb({ kho, faces: [], photos: [], albums: [{ id: A, faces_kho_at: null }] });
  const r = await chuyenMotAlbum(db, A);
  ok("album rỗng: đặt mốc, không ghi gì", r.rong && !!db.t.albums[0].faces_kho_at && kho.files.size === 0);
}

/* 3. Storage hỏng → KHÔNG xoá DB */
{
  const kho = khoGia({ hong: true });
  const db = fakeDb({ kho, faces: [mat(A, 1, 0, 1)], photos: [{ id: id(1), album_id: A, faces_scanned_at: "x" }], albums: [{ id: A, faces_kho_at: null }] });
  let nem = null;
  try { await chuyenMotAlbum(db, A); } catch (e) { nem = e.message; }
  ok("Storage hỏng → ném, GIỮ NGUYÊN dòng DB, không đặt mốc", !!nem && db.t.album_faces.length === 1 && !db.t.albums[0].faces_kho_at, nem);
  const tong = await chuyenSangKho(db, { nganSachMs: 10_000 });
  ok("…lượt cron báo lỗi chứ không im lặng", !tong.ok && /ghi_manh_that_bai/.test(tong.loi ?? ""), JSON.stringify(tong));
}

/* 4. Kho đã có bản studio từ trước (lần quét lại, MỚI hơn DB) → bản kho là bản đúng */
{
  const kho = khoGia();
  const db = fakeDb({ kho, faces: [mat(A, 1, 0, 1), mat(A, 1, 1, 2), mat(A, 2, 0, 5)], photos: [1, 2].map((n) => ({ id: id(n), album_id: A, faces_scanned_at: "x" })), albums: [{ id: A, faces_kho_at: null }] });
  await ghiManh(db, A, { nguon: NGUON_STUDIO, anh: [{ photoId: id(1), faces: [{ box: [0, 0, 0.1, 0.1], descriptor: vec(9), sharpness: 1 }] }] });
  const r = await chuyenMotAlbum(db, A);
  const k = kho.kho(A);
  ok("ảnh đã có bản studio: KHÔNG chép đè bằng dòng DB cũ", k.get(id(1)).faces.length === 1 && Math.abs(k.get(id(1)).faces[0].descriptor[2] - vec(9)[2]) < 0.001);
  ok("…ảnh còn lại vẫn được chép, rồi xoá DB", r.anh === 1 && k.get(id(2)).faces.length === 1 && db.t.album_faces.length === 0);
}

console.log(fail ? `\n${fail} bài hỏng` : "\nTất cả đạt");
process.exit(fail ? 1 : 0);
