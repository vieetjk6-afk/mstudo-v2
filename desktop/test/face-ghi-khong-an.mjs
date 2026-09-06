/* Kiểm thử TÌNH HUỐNG "GHI XONG MÀ KHÔNG NẰM LẠI" của bộ quét khuôn mặt.
 *
 * Vì sao bài này tồn tại — đây là log production thật ngày 06/09, tám lượt gọi
 * liên tiếp trong CÙNG một lượt cron, cùng một album:
 *
 *   lượt 1: scanned 37, daGhiMoc 37 → lượt sau pending vẫn 343
 *   lượt 2: scanned 43, daGhiMoc 43 → lượt sau pending vẫn 343
 *   ...
 *   lượt 8: scanned 45, daGhiMoc 45 → lượt sau pending vẫn 343
 *
 * Câu UPDATE báo đã ghi 37–47 dòng, mà đọc lại vẫn đủ 343 ảnh chưa quét. Không
 * tiến một tấm nào suốt cả ngày. `daGhiMoc` không bắt được vì nó đếm dòng do
 * chính câu UPDATE trả về (RETURNING) — thứ chứng minh câu lệnh KHỚP 37 dòng,
 * chứ không chứng minh giá trị còn nằm trong bảng sau đó.
 *
 * Hậu quả không dừng ở một album: hàng đợi xếp album mới nhất trước, nên album
 * kẹt đứng mãi ở đầu hàng và ăn trọn ngân sách mỗi lượt. Mọi album cũ hơn không
 * bao giờ được quét — đúng triệu chứng "album khác không thấy khuôn mặt".
 *
 * Hai điều bài này khoá lại:
 *   1. PHÁT HIỆN được: đọc lại bằng câu riêng → stoppedBy = "ghi-khong-an".
 *   2. BỎ SỚM: không tiêu hết ngân sách, để lượt cron còn phục vụ album khác.
 * Và một bài đối chứng: database LÀNH thì mọi thứ chạy như cũ.
 *
 * Nạp code thật ở src/lib/face-scan-server.ts, thay mỗi tầng database.
 */
import { scanAlbum, pendingRows } from "../../src/lib/face-scan-server.ts";

let fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};
const ok = (name, cond, note = "") => {
  if (!cond) fail++;
  console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : `  ${note}`}`);
};

/* ── Database giả, đủ dùng cho scanAlbum ─────────────────────────────────────
 * `giuMoc: false` mô phỏng đúng cảnh production: UPDATE trả về đủ số dòng
 * (RETURNING chạy bình thường) nhưng giá trị KHÔNG được giữ lại — thứ mà một
 * trigger BEFORE UPDATE trả OLD, một rule, hay một bản sao chỉ-đọc đều tạo ra.
 */
function fakeDb({ soAnh, giuMoc }) {
  const photos = Array.from({ length: soAnh }, (_, i) => ({
    id: `p${i}`,
    drive_file_id: `d${i}`,
    name: `anh${i}.jpg`,
    is_video: false,
    faces_scanned_at: null,
  }));
  const stats = { updateCalls: 0, verifyCalls: 0, faceUpserts: 0 };

  const builder = (table, op, payload) => {
    let ids = null;
    let wantCount = false;
    let notNullCol = null;
    const self = {
      select(_cols, opts) {
        if (opts?.count === "exact") wantCount = true;
        return self;
      },
      eq() { return self; },
      order() { return self; },
      not(col, _op, _val) { notNullCol = col; return self; },
      in(_col, list) { ids = list; return self; },
      range(from, to) {
        const slice = photos.slice(from, to + 1);
        return Promise.resolve({ data: slice, error: null });
      },
      then(res) {
        if (table === "photos" && op === "update") {
          stats.updateCalls++;
          const hit = photos.filter((p) => ids.includes(p.id));
          // Giá trị chỉ nằm lại khi database LÀNH. RETURNING trả đủ dòng ở cả
          // hai trường hợp — đó chính là điểm mù của bản trước.
          if (giuMoc) for (const p of hit) p.faces_scanned_at = payload.faces_scanned_at;
          return res({ data: hit.map((p) => ({ id: p.id })), error: null });
        }
        if (table === "photos" && op === "select" && wantCount && notNullCol) {
          stats.verifyCalls++;
          const n = photos.filter((p) => ids.includes(p.id) && p.faces_scanned_at != null).length;
          return res({ data: null, count: n, error: null });
        }
        if (table === "album_faces") {
          stats.faceUpserts++;
          return res({ data: payload.map((r) => ({ photo_id: r.photo_id })), error: null });
        }
        if (table === "albums") return res({ data: [{ id: "a1" }], error: null });
        return res({ data: [], error: null });
      },
    };
    return self;
  };

  return {
    stats,
    photos,
    from(table) {
      return {
        select: (cols, opts) => builder(table, "select", null).select(cols, opts),
        update: (payload) => builder(table, "update", payload),
        upsert: (payload) => builder(table, "upsert", payload),
        delete: () => builder(table, "delete", null),
        insert: (payload) => builder(table, "insert", payload),
      };
    },
  };
}

/* Bộ quét giả: mỗi ảnh tìm được đúng 1 khuôn mặt, không chạm mạng. */
const stubScan = async () => [{ box: { x: 0, y: 0, w: 10, h: 10 }, descriptor: new Array(128).fill(0.1), sharpness: 5 }];
const stubFetch = async () => new Uint8Array([0xff, 0xd8, 0xff, 0xdb]);

/* ── 1. Database LÀNH — phải quét bình thường, không báo động nhầm ────────── */
{
  const db = fakeDb({ soAnh: 30, giuMoc: true });
  const rp = await scanAlbum(db, "a1", {
    budgetMs: 10_000,
    maxPhotos: 400,
    _tai: stubFetch,
    _quet: stubScan,
  });
  ok(`db lành: quét hết 30 ảnh (thật: ${rp.scanned})`, rp.scanned === 30);
  check("db lành: stoppedBy", rp.stoppedBy, "xong");
  ok(`db lành: daXacNhan bằng daGhiMoc (${rp.daXacNhan}/${rp.daGhiMoc})`, rp.daXacNhan === rp.daGhiMoc && rp.daXacNhan === 30);
  ok("db lành: mốc thật sự nằm lại trong bảng", db.photos.every((p) => p.faces_scanned_at != null));
  ok("db lành: lượt sau không còn gì để quét", pendingRows(db.photos).length === 0);
}

/* ── 2. Database NUỐT GHI — đúng cảnh production ─────────────────────────── */
{
  const db = fakeDb({ soAnh: 343, giuMoc: false });
  const rp = await scanAlbum(db, "a1", {
    budgetMs: 10_000,
    maxPhotos: 400,
    _tai: stubFetch,
    _quet: stubScan,
  });
  check("db nuốt ghi: stoppedBy nói thẳng ra", rp.stoppedBy, "ghi-khong-an");
  ok(`db nuốt ghi: daGhiMoc vẫn báo "thành công" (${rp.daGhiMoc}) — đây là điểm mù cũ`, rp.daGhiMoc > 0);
  check("db nuốt ghi: daXacNhan = 0, đọc lại không thấy mốc nào", rp.daXacNhan, 0);

  // ĐÂY là phần cứu các album khác: bỏ sớm sau mẻ ghi đầu tiên, không tiêu hết
  // ngân sách. Trước đây album kẹt ăn trọn 45 giây MỖI lượt cron.
  ok(`db nuốt ghi: bỏ sau vài tấm, không quét cả album (thật: ${rp.scanned}/343)`, rp.scanned <= 10);
  ok(`db nuốt ghi: chỉ ghi thử 1 mẻ nhỏ (thật: ${db.stats.updateCalls} lượt UPDATE)`, db.stats.updateCalls === 1);
  ok(`db nuốt ghi: có đọc lại để kiểm (thật: ${db.stats.verifyCalls} lượt)`, db.stats.verifyCalls === 1);
}

/* ── 3. Ngân sách còn lại đủ cho album kế — điều kiện để album khác tới lượt ─ */
{
  const db = fakeDb({ soAnh: 343, giuMoc: false });
  const t0 = Date.now();
  await scanAlbum(db, "a1", { budgetMs: 45_000, maxPhotos: 400, _tai: stubFetch, _quet: stubScan });
  const dung = Date.now() - t0;
  ok(`album kẹt trả lại ngân sách gần như nguyên vẹn (tiêu ${dung} ms / 45.000 ms)`, dung < 5_000);
}

console.log(fail === 0 ? "\nTất cả OK" : `\n${fail} bài HỎNG`);
process.exit(fail === 0 ? 0 : 1);
