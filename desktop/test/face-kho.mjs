/* Kiểm thử: kho khuôn mặt dạng file (src/lib/face-kho.ts) — định dạng nhị
 * phân, gộp mảnh (studio thắng khách, bản đầu thắng), so khớp, kiểm mảnh khách.
 *
 * Vì sao: kho này sẽ thay album_faces (đợt 3). Sai định dạng là mất dữ liệu
 * khuôn mặt của cả album; sai luật gộp là khách gửi rác đè được dữ liệu studio.
 */
import {
  maHoaManh, giaiMaManh, gopManh, tachTheoNguon, anhKhop, kiemManhKhach, khoangCach,
  f32SangF16, f16SangF32, NGUON_STUDIO, NGUON_KHACH,
} from "../../src/lib/face-kho.ts";

let fail = 0;
const ok = (name, cond, note = "") => {
  if (!cond) fail++;
  console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : `  ${note}`}`);
};

// Vector giả lập: số ngẫu nhiên có hạt giống, cỡ ±0,3 như vector thật.
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 0.6;
const vec = () => Array.from({ length: 128 }, rnd);
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

/* 1. f16 */
{
  let maxErr = 0;
  for (const v of [0, 0.1, -0.1, 0.333, -0.29, 1e-5, 0.5, 1, -1]) maxErr = Math.max(maxErr, Math.abs(f16SangF32(f32SangF16(v)) - v));
  ok("f16 sai số ≤ 0,0005 trong khoảng ±1", maxErr <= 0.0005, String(maxErr));
}

/* 2. mã hoá ⇄ giải mã */
{
  const a = vec(), b = vec();
  const manh = {
    nguon: NGUON_STUDIO,
    anh: [
      { photoId: id(1), faces: [{ box: [0.1, 0.2, 0.3, 0.4], descriptor: a, sharpness: 12.5 }, { box: [0.5, 0.5, 0.1, 0.1], descriptor: b, sharpness: 3 }] },
      { photoId: id(2), faces: [] },
    ],
  };
  const bytes = maHoaManh(manh);
  ok("kích thước đúng (12 + 2×17 + 2×268)", bytes.length === 12 + 2 * 17 + 2 * 268, String(bytes.length));
  const back = giaiMaManh(bytes);
  ok("giữ nguồn + số ảnh + photo_id", back.nguon === NGUON_STUDIO && back.anh.length === 2 && back.anh[0].photoId === id(1) && back.anh[1].photoId === id(2));
  ok("ảnh 0 mặt vẫn được ghi (đã quét, không có ai)", back.anh[1].faces.length === 0);
  ok("vector sau f16 lệch < 0,005 (Euclid)", khoangCach(back.anh[0].faces[0].descriptor, a) < 0.005);
  ok("box + sharpness", Math.abs(back.anh[0].faces[0].box[2] - 0.3) < 1e-4 && back.anh[0].faces[0].sharpness === 12.5);
  let nem = 0;
  for (const hong of [bytes.slice(0, bytes.length - 1), new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]), (() => { const c = bytes.slice(); c[4] = 9; return c; })()]) {
    try { giaiMaManh(hong); } catch { nem++; }
  }
  ok("mảnh cắt ngang / sai dấu / sai nguồn → ném", nem === 3);
}

/* 3. gộp: studio thắng khách, bản đầu thắng */
{
  const s = vec(), k1 = vec(), k2 = vec();
  const kho = gopManh([
    { nguon: NGUON_KHACH, anh: [{ photoId: id(1), faces: [{ box: [0, 0, 0.1, 0.1], descriptor: k1, sharpness: 1 }] }, { photoId: id(3), faces: [{ box: [0, 0, 0.1, 0.1], descriptor: k1, sharpness: 1 }] }] },
    { nguon: NGUON_STUDIO, anh: [{ photoId: id(1), faces: [{ box: [0, 0, 0.1, 0.1], descriptor: s, sharpness: 1 }] }] },
    { nguon: NGUON_KHACH, anh: [{ photoId: id(3), faces: [{ box: [0, 0, 0.1, 0.1], descriptor: k2, sharpness: 1 }] }] },
  ]);
  ok("studio đè bản khách của cùng ảnh", kho.get(id(1)).nguon === NGUON_STUDIO && kho.get(id(1)).faces[0].descriptor === s);
  ok("khách sau KHÔNG đè khách trước", kho.get(id(3)).faces[0].descriptor === k1);
  const tach = tachTheoNguon(kho);
  ok("tách lại đúng hai mảnh theo nguồn", tach.length === 2 && tach[0].nguon === NGUON_STUDIO && tach[1].anh[0].photoId === id(3));

  // so khớp
  const gan = k1.map((v) => v + 0.01);
  ok("anhKhop tìm đúng ảnh có mặt gần", JSON.stringify(anhKhop(kho, gan)) === JSON.stringify([id(3)]));
  ok("vector xa không khớp ảnh nào", anhKhop(kho, vec()).length === 0);
}

/* 4. kiểm mảnh khách */
{
  const tot = { nguon: NGUON_KHACH, anh: [{ photoId: id(1), faces: [{ box: [0, 0, 0.2, 0.2], descriptor: vec(), sharpness: 1 }] }] };
  ok("mảnh khách hợp lệ", kiemManhKhach(tot, 40) === null);
  ok("mảnh khách mạo nguồn studio bị từ chối", kiemManhKhach({ ...tot, nguon: NGUON_STUDIO }, 40) === "sai_nguon");
  const rac = { nguon: NGUON_KHACH, anh: [{ photoId: id(1), faces: [{ box: [0, 0, 0.2, 0.2], descriptor: Array(128).fill(5), sharpness: 1 }] }] };
  ok("vector rác (|v|>2) bị từ chối", kiemManhKhach(rac, 40) === "descriptor_sai_so");
  ok("quá số ảnh bị từ chối", kiemManhKhach(tot, 0) === "manh_qua_lon");
  ok("trùng ảnh bị từ chối", kiemManhKhach({ nguon: NGUON_KHACH, anh: [tot.anh[0], tot.anh[0]] }, 40) === "photo_id_trung");
}

console.log(fail ? `\n${fail} bài hỏng` : "\nTất cả đạt");
process.exit(fail ? 1 : 0);
