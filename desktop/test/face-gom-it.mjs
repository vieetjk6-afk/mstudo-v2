/* Kiểm thử: bộ quét KHÔNG đẩy album vào lại hàng đợi gom sau mỗi mẻ ghi, và
 * BỎ QUA VĨNH VIỄN ảnh 404 / PNG thay vì thử lại mãi.
 *
 * Vì sao: 11/2026 project Supabase bị khoá vì vượt hạn mức egress (8,5/5 GB,
 * chỉ 15 người dùng). Log cron cho thấy lượt nào cũng "gom N người" — mỗi mẻ 20
 * ảnh đặt lại faces_clustered_at = null, nên mỗi lượt cron gom lại cả album,
 * đọc toàn bộ vector 128 số của mọi khuôn mặt. Kèm một album 111 tấm 404 bị tải
 * lại ở mọi lượt.
 *
 * Nạp code thật ở src/lib/face-scan-server.ts, thay tầng database.
 */
import { scanAlbum } from "../../src/lib/face-scan-server.ts";

let fail = 0;
const ok = (name, cond, note = "") => {
  if (!cond) fail++;
  console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : `  ${note}`}`);
};

function fakeDb({ soAnh, clusteredAt }) {
  const photos = Array.from({ length: soAnh }, (_, i) => ({
    id: `p${i}`, drive_file_id: `d${i}`, name: `anh${i}.jpg`, is_video: false, faces_scanned_at: null,
  }));
  const stats = { datLaiGom: 0 };
  const builder = (table, op, payload) => {
    let ids = null;
    let wantCount = false;
    let notNullCol = null;
    const self = {
      select(_c, opts) { if (opts?.count === "exact") wantCount = true; return self; },
      eq() { return self; },
      order() { return self; },
      not(col) { notNullCol = col; return self; },
      in(_c, list) { ids = list; return self; },
      range(from, to) { return Promise.resolve({ data: photos.slice(from, to + 1), error: null }); },
      maybeSingle() {
        return Promise.resolve({ data: table === "albums" ? { faces_clustered_at: clusteredAt } : null, error: null });
      },
      then(res) {
        if (table === "photos" && op === "update") {
          const hit = photos.filter((p) => ids.includes(p.id));
          for (const p of hit) p.faces_scanned_at = payload.faces_scanned_at;
          return res({ data: hit.map((p) => ({ id: p.id })), error: null });
        }
        if (table === "photos" && op === "select" && wantCount && notNullCol) {
          return res({ data: null, count: photos.filter((p) => ids.includes(p.id) && p.faces_scanned_at).length, error: null });
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

if (fail) { console.log(`\n${fail} bài hỏng`); process.exit(1); }
console.log("\nTất cả đều đạt");
