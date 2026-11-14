/* Kiểm thử: bộ quét KHÔNG đẩy album vào lại hàng đợi gom sau mỗi mẻ ghi, và
 * BỎ QUA VĨNH VIỄN ảnh 404 / PNG thay vì thử lại mãi.
 *
 * Vì sao: 11/2026 project Supabase bị khoá vì vượt hạn mức egress (8,5/5 GB,
 * chỉ 15 người dùng). Log cron cho thấy lượt nào cũng "gom N người" — mỗi mẻ 20
 * ảnh đặt lại faces_clustered_at = null, nên mỗi lượt cron gom lại cả album,
 * đọc toàn bộ vector 128 số của mọi khuôn mặt. Kèm một album 111 tấm 404 bị tải
 * lại ở mọi lượt.
 *
 * Cùng đợt đó, hai chỗ đọc/ghi thừa nữa (mục 7–9 bên dưới; hàng đợi quét thì
 * ở face-cong-goi.mjs):
 *   • scanAlbum kéo MỌI ảnh của album về chỉ để tìm vài chục tấm chưa quét —
 *     giờ chỉ đọc tấm còn chờ, tối đa `maxPhotos` dòng (mục 7–8);
 *   • clusterAlbum chèn từng người một (mỗi người một lượt gọi) — giờ theo lô,
 *     id sinh sẵn nên dòng nối ảnh↔người vẫn trỏ đúng người (mục 9).
 *
 * Nạp code thật ở src/lib/face-scan-server.ts, thay tầng database.
 */
import { clusterAlbum, scanAlbum } from "../../src/lib/face-scan-server.ts";

let fail = 0;
const ok = (name, cond, note = "") => {
  if (!cond) fail++;
  console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : `  ${note}`}`);
};

function fakeDb({ soAnh, clusteredAt, daQuet = 0 }) {
  const photos = Array.from({ length: soAnh }, (_, i) => ({
    id: `p${i}`, album_id: "a1", position: i, drive_file_id: `d${i}`, name: `anh${i}.jpg`, is_video: false,
    faces_scanned_at: i < daQuet ? "2026-11-01T00:00:00Z" : null,
  }));
  /** `dongDoc`: số dòng ảnh THẬT SỰ trả về qua đường truyền (head = 0 dòng). */
  const stats = { datLaiGom: 0, dongDoc: 0, docKhongLoc: 0 };
  const builder = (table, op, payload) => {
    // Bộ lọc PostgREST tối thiểu mà scanAlbum dùng — chạy thật trên dữ liệu giả.
    const eqs = [];
    const neqs = [];
    const isNull = [];
    const notNull = [];
    let inF = null;
    let gioiHan = Infinity;
    let wantCount = false;
    let head = false;
    const loc = () =>
      photos.filter(
        (p) =>
          eqs.every(([c, v]) => p[c] === v) &&
          neqs.every(([c, v]) => p[c] !== v) &&
          isNull.every((c) => p[c] == null) &&
          notNull.every((c) => p[c] != null) &&
          (!inF || inF[1].includes(p[inF[0]]))
      );
    const self = {
      select(_c, opts) { if (opts?.count === "exact") wantCount = true; if (opts?.head) head = true; return self; },
      eq(c, v) { eqs.push([c, v]); return self; },
      neq(c, v) { neqs.push([c, v]); return self; },
      is(c, v) { if (v === null) isNull.push(c); return self; },
      order() { return self; },
      limit(n) { gioiHan = n; return self; },
      not(c, o, v) { if (o === "is" && v === null) notNull.push(c); return self; },
      in(c, list) { inF = [c, list]; return self; },
      maybeSingle() {
        return Promise.resolve({ data: table === "albums" ? { faces_clustered_at: clusteredAt } : null, error: null });
      },
      then(res) {
        if (table === "photos" && op === "update") {
          const hit = loc();
          for (const p of hit) p.faces_scanned_at = payload.faces_scanned_at;
          return res({ data: hit.map((p) => ({ id: p.id })), error: null });
        }
        if (table === "photos" && op === "select") {
          const hit = loc();
          if (head) return res({ data: null, count: hit.length, error: null });
          const ra = hit.slice(0, gioiHan);
          stats.dongDoc += ra.length;
          // Đọc dòng ảnh mà KHÔNG lọc "chưa quét" = lối đọc cả album của bản trước.
          if (!isNull.includes("faces_scanned_at")) stats.docKhongLoc++;
          return res({ data: ra, count: wantCount ? hit.length : null, error: null });
        }
        if (table === "album_faces") return res({ data: payload.map((r) => ({ photo_id: r.photo_id })), error: null });
        if (table === "albums" && op === "update" && payload && "faces_clustered_at" in payload && payload.faces_clustered_at === null) {
          stats.datLaiGom++;
        }
        return res({ data: [{ id: "a1" }], error: null });
      },
    };
    return self;
  };
  return {
    stats, photos,
    from(table) {
      return {
        select: (c, o) => builder(table, "select", null).select(c, o),
        update: (p) => builder(table, "update", p),
        upsert: (p) => builder(table, "upsert", p),
      };
    },
  };
}

const quet1Mat = async () => [{ box: { x: 0, y: 0, w: 10, h: 10 }, descriptor: new Array(128).fill(0.1), sharpness: 5 }];
const taiDuoc = async () => new Uint8Array([0xff, 0xd8, 0xff, 0xdb]);
const motGioTruoc = new Date(Date.now() - 3600_000).toISOString();
const haiNgayTruoc = new Date(Date.now() - 48 * 3600_000).toISOString();

/* 1. Quét hết album (100 ảnh, nhiều mẻ ghi) → vào hàng đợi gom ĐÚNG MỘT lần. */
{
  const db = fakeDb({ soAnh: 100, clusteredAt: motGioTruoc });
  const rp = await scanAlbum(db, "a1", { budgetMs: 10_000, maxPhotos: 400, _tai: taiDuoc, _quet: quet1Mat });
  ok(`quét xong: stoppedBy = xong (${rp.stoppedBy})`, rp.stoppedBy === "xong");
  ok(`quét xong: đặt lại hàng đợi gom đúng 1 lần (thật: ${db.stats.datLaiGom})`, db.stats.datLaiGom === 1);
}

/* 2. Album lớn, lượt bị cắt giữa chừng, vừa gom 1 giờ trước → KHÔNG gom lại. */
{
  const db = fakeDb({ soAnh: 100, clusteredAt: motGioTruoc });
  const rp = await scanAlbum(db, "a1", { budgetMs: 10_000, maxPhotos: 40, _tai: taiDuoc, _quet: quet1Mat });
  ok(`cắt giữa chừng: stoppedBy = het-han-muc (${rp.stoppedBy})`, rp.stoppedBy === "het-han-muc");
  ok(`cắt giữa chừng + vừa gom: không đặt lại (thật: ${db.stats.datLaiGom})`, db.stats.datLaiGom === 0);
}

/* 3. Album lớn, lượt bị cắt, lần gom trước đã 2 ngày → cho khách thấy dần. */
{
  const db = fakeDb({ soAnh: 100, clusteredAt: haiNgayTruoc });
  await scanAlbum(db, "a1", { budgetMs: 10_000, maxPhotos: 40, _tai: taiDuoc, _quet: quet1Mat });
  ok(`cắt giữa chừng + gom đã cũ: đặt lại 1 lần (thật: ${db.stats.datLaiGom})`, db.stats.datLaiGom === 1);
}

/* 4. Ảnh 404 (đã xoá khỏi Drive) → đánh mốc luôn, lượt sau không tải lại. */
{
  const db = fakeDb({ soAnh: 30, clusteredAt: motGioTruoc });
  const rp = await scanAlbum(db, "a1", {
    budgetMs: 10_000, maxPhotos: 400, _quet: quet1Mat,
    _tai: async (id) => (Number(id.slice(1)) % 3 === 0 ? null : taiDuoc()),
  });
  // _tai trả null = "khong-tai-duoc (bản kiểm thử)" → lỗi TẠM, phải thử lại.
  ok(`lỗi tạm: không đánh mốc (failed ${rp.failed})`, rp.failed === 10 && db.photos.filter((p) => !p.faces_scanned_at).length === 10);
}
/* 5. 404 thật (lý do từ Drive) → đánh mốc 0 khuôn mặt, không còn chờ quét. */
{
  const db = fakeDb({ soAnh: 30, clusteredAt: motGioTruoc });
  const rp = await scanAlbum(db, "a1", {
    budgetMs: 10_000, maxPhotos: 400, _quet: quet1Mat,
    _tai: async (id) => (Number(id.slice(1)) % 3 === 0 ? { bytes: null, lyDo: "http-404" } : taiDuoc()),
  });
  ok(`404: không tính là lỗi tạm (failed ${rp.failed})`, rp.failed === 0);
  ok(`404: mọi ảnh đều đã có mốc (còn ${db.photos.filter((p) => !p.faces_scanned_at).length})`, db.photos.every((p) => p.faces_scanned_at));
  ok(`404: remaining = 0 (${rp.remaining}), stoppedBy = xong (${rp.stoppedBy})`, rp.remaining === 0 && rp.stoppedBy === "xong");
}

/* 6. Album toàn 404 → không "tắc", không đẩy vào hàng đợi gom. */
{
  const db = fakeDb({ soAnh: 111, clusteredAt: motGioTruoc });
  const rp = await scanAlbum(db, "a1", {
    budgetMs: 10_000, maxPhotos: 400, _quet: quet1Mat,
    _tai: async () => ({ bytes: null, lyDo: "http-404" }),
  });
  ok(`toàn 404: stoppedBy = xong (${rp.stoppedBy})`, rp.stoppedBy === "xong");
  ok(`toàn 404: không gom lại (thật: ${db.stats.datLaiGom})`, db.stats.datLaiGom === 0);
  ok("toàn 404: lượt sau không còn gì để quét", db.photos.every((p) => p.faces_scanned_at));
}

/* 7. Album 1.000 ảnh, 900 đã quét → chỉ đọc tấm còn chờ, tối đa maxPhotos dòng.
 *    Bản trước kéo cả 1.000 dòng về ở mọi lượt gọi chỉ để lọc ra 100 tấm. */
{
  const db = fakeDb({ soAnh: 1000, daQuet: 900, clusteredAt: motGioTruoc });
  const rp = await scanAlbum(db, "a1", { budgetMs: 10_000, maxPhotos: 40, _tai: taiDuoc, _quet: quet1Mat });
  ok(
    `chỉ đọc tấm còn chờ (đọc ${db.stats.dongDoc} dòng, ${db.stats.docKhongLoc} lượt đọc không lọc)`,
    db.stats.dongDoc === 40 && db.stats.docKhongLoc === 0
  );
  ok(
    `quét đúng 40 tấm chờ ĐẦU TIÊN theo thứ tự (thật: ${rp.scanned})`,
    rp.scanned === 40 && db.photos.slice(900, 940).every((p) => p.faces_scanned_at) && db.photos.slice(940).every((p) => !p.faces_scanned_at)
  );
  ok(`tongAnh vẫn là cả album (${rp.tongAnh}), remaining của cả album (${rp.remaining})`, rp.tongAnh === 1000 && rp.remaining === 60);
  ok(`còn tấm chờ sau lô → het-han-muc, không phải xong (${rp.stoppedBy})`, rp.stoppedBy === "het-han-muc");
}

/* 8. Tấm 404 nhiều hơn hạn mức: hạn mức giờ tính cả tấm bỏ qua. Đi hết lô mà
 *    còn tấm chờ thì là het-han-muc (không phải "xong", không gom lại), và lượt
 *    sau đi tiếp đúng chỗ — không tấm nào bị kẹt lại. */
{
  const db = fakeDb({ soAnh: 100, clusteredAt: motGioTruoc });
  const tai404 = async () => ({ bytes: null, lyDo: "http-404" });
  const lan = [];
  for (let k = 0; k < 3; k++) lan.push(await scanAlbum(db, "a1", { budgetMs: 10_000, maxPhotos: 40, _tai: tai404, _quet: quet1Mat }));
  ok(
    `lượt 1–2: het-han-muc, còn ${lan[0].remaining} rồi ${lan[1].remaining}`,
    lan[0].stoppedBy === "het-han-muc" && lan[1].stoppedBy === "het-han-muc" && lan[0].remaining === 60 && lan[1].remaining === 20
  );
  ok(`lượt 3: xong, remaining 0 (${lan[2].stoppedBy}, ${lan[2].remaining})`, lan[2].stoppedBy === "xong" && lan[2].remaining === 0);
  ok("sau 3 lượt cả album có mốc, không gom lại lần nào", db.photos.every((p) => p.faces_scanned_at) && db.stats.datLaiGom === 0);
}

/* 9. clusterAlbum GHI THEO LÔ — và dòng nối vẫn trỏ đúng người.
 *
 * Bản trước chèn từng người một (mỗi người một lượt gọi + một lượt nối). Giờ id
 * sinh sẵn, người và dòng nối đi theo lô. Chỗ dễ hỏng nhất là GHÉP id: lệch một
 * vị trí thì ảnh của cô dâu nối vào chú rể, mà không lỗi nào nổ. Database giả
 * có khoá ngoại person_id → album_people(id) như DB thật.
 */
function fakeDbGom({ faces, nguoiCu = [], nuotNguoi = false }) {
  const stats = { chenNguoi: 0, chenNoi: 0, cotNguoiCu: null, danhDau: 0 };
  const people = [];
  const links = [];
  const from = (table) => {
    let op = "select";
    let payload = null;
    let cols = null;
    const self = {
      select(c) { cols = c; return self; },
      insert(p) { op = "insert"; payload = p; return self; },
      delete() { op = "delete"; return self; },
      update(p) { op = "update"; payload = p; return self; },
      eq() { return self; },
      order() { return self; },
      range(a, b) { return Promise.resolve({ data: table === "album_faces" ? faces.slice(a, b + 1) : [], error: null }); },
      then(res, rej) {
        let out = { data: null, error: null };
        if (table === "album_people" && op === "select") {
          stats.cotNguoiCu = cols;
          out = { data: nguoiCu, error: null };
        } else if (table === "album_people" && op === "delete") {
          people.length = 0;
        } else if (table === "album_people" && op === "insert") {
          stats.chenNguoi++;
          // `nuotNguoi`: báo thành công mà không ghi gì — xem lô nối có nổ không.
          if (!nuotNguoi) people.push(...payload);
        } else if (table === "album_photo_people" && op === "insert") {
          stats.chenNoi++;
          const co = new Set(people.map((p) => p.id));
          if (payload.some((l) => !co.has(l.person_id))) out = { data: null, error: { message: "violates foreign key constraint" } };
          else links.push(...payload);
        } else if (table === "albums" && op === "update" && payload?.faces_clustered_at) {
          stats.danhDau++;
        }
        return Promise.resolve(out).then(res, rej);
      },
    };
    return self;
  };
  return { from, stats, people, links };
}

/** Người thứ k: vector đơn vị ở chiều k%128, nhân 1 hoặc 2 — mọi cặp người cách nhau ≥ 1 (> ngưỡng 0,6). */
const vecNguoi = (k) => {
  const v = new Array(128).fill(0);
  v[k % 128] = 1 + Math.floor(k / 128);
  return v;
};
/** 130 người × 4 ảnh = 520 dòng nối → 2 lô người (100 + 30), 2 lô nối (500 + 20). */
const SO_NGUOI = 130;
const matGia = [];
for (let k = 0; k < SO_NGUOI; k++) {
  for (let j = 0; j < 4; j++) {
    matGia.push({ photo_id: `${k}-${j}`, at: 0, box: [0.1, 0.1, 0.2 + j / 100, 0.2], descriptor: vecNguoi(k), sharpness: 5 });
  }
}
{
  const db = fakeDbGom({
    faces: matGia,
    nguoiCu: [
      { id: "cu-1", name: "Cô dâu", descriptor: vecNguoi(0) },
      { id: "cu-2", name: "Chú rể", descriptor: vecNguoi(1) },
    ],
  });
  const n = await clusterAlbum(db, "a1");
  ok(`gom ra đủ ${SO_NGUOI} người (thật: ${n})`, n === SO_NGUOI && db.people.length === SO_NGUOI);
  ok(`chèn người theo lô: 2 lượt gọi chứ không phải ${SO_NGUOI} (thật: ${db.stats.chenNguoi})`, db.stats.chenNguoi === 2);
  ok(`chèn dòng nối theo lô 500: 2 lượt (thật: ${db.stats.chenNoi})`, db.stats.chenNoi === 2 && db.links.length === SO_NGUOI * 4);
  ok(
    "id người là uuid, không trùng",
    db.people.every((p) => /^[0-9a-f-]{36}$/.test(p.id)) && new Set(db.people.map((p) => p.id)).size === SO_NGUOI
  );
  // Mỗi người phải nhận ĐÚNG 4 ảnh của chính mình: cùng tiền tố với ảnh đại diện.
  const anhCua = new Map();
  for (const l of db.links) anhCua.set(l.person_id, [...(anhCua.get(l.person_id) ?? []), l.photo_id]);
  const lech = db.people.filter((p) => {
    const ds = anhCua.get(p.id) ?? [];
    const k = String(p.cover_photo_id).split("-")[0];
    return ds.length !== 4 || ds.some((x) => x.split("-")[0] !== k);
  });
  ok(`dòng nối trỏ đúng người (lệch ${lech.length})`, lech.length === 0);
  const ten = (k) => db.people.find((p) => String(p.cover_photo_id).startsWith(`${k}-`))?.name;
  ok(`giữ tên studio đã đặt (${ten(0)} / ${ten(1)} / "${ten(2)}")`, ten(0) === "Cô dâu" && ten(1) === "Chú rể" && ten(2) === "");
  ok(
    "vị trí 0…n-1 đủ cả, không trùng",
    new Set(db.people.map((p) => p.position)).size === SO_NGUOI && db.people.every((p) => p.position >= 0 && p.position < SO_NGUOI)
  );
  ok(`đọc người cũ đúng cột cần, không "*" (${db.stats.cotNguoiCu})`, !!db.stats.cotNguoiCu && !db.stats.cotNguoiCu.includes("*"));
  ok("ra khỏi hàng đợi gom sau khi ghi xong", db.stats.danhDau === 1);
}
{
  // Lô người "thành công" mà không nằm lại → lô nối phải NỔ, và album ở lại
  // hàng đợi gom (không đánh dấu đã gom trên nửa danh sách người).
  const db = fakeDbGom({ faces: matGia.slice(0, 12), nuotNguoi: true });
  let loi = null;
  try {
    await clusterAlbum(db, "a1");
  } catch (e) {
    loi = e;
  }
  ok(`người không nằm lại → nổ ở lô nối (${loi?.message})`, /noi_anh_voi_nguoi_that_bai/.test(String(loi?.message)));
  ok("và album KHÔNG ra khỏi hàng đợi gom", db.stats.danhDau === 0);
}

if (fail) { console.log(`\n${fail} bài hỏng`); process.exit(1); }
console.log("\nTất cả đều đạt");
