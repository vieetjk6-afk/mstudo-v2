/* Kiểm thử: dọn vector khuôn mặt của album đã giao khách lâu (src/lib/face-don.ts)
 * và chốt chặn GOM trên album đã dọn (src/lib/face-gom.ts).
 *
 * Vì sao: album_faces chiếm 198/345 MB database (trần gói Free 500 MB). Cron
 * cleanup-faces xoá nó cho album giao khách quá 15 ngày. Nguy hiểm thật sự nằm ở
 * chỗ khác: gom trên album đã mất vector sẽ xoá sạch album_people — thứ khách
 * đang dùng để tìm ảnh theo khuôn mặt. Bài này giữ cả hai đầu.
 */
import { donKhuonMatAlbumCu, daDonKhuonMat } from "../../src/lib/face-don.ts";
import { clusterAlbum, ghiNguoi } from "../../src/lib/face-gom.ts";

let fail = 0;
const ok = (name, cond, note = "") => {
  if (!cond) fail++;
  console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : `  ${note}`}`);
};

const NGAY = 24 * 3600 * 1000;
const NOW = Date.parse("2026-11-18T00:00:00Z");
const iso = (daysAgo) => new Date(NOW - daysAgo * NGAY).toISOString();

/** Database giả: đủ các bộ lọc PostgREST mà face-don / face-gom dùng. */
function fakeDb({ albums, photos = [], faces = [], people = [], thieuCot = false }) {
  const st = { albums, photos, album_faces: faces, album_people: people, album_photo_people: [] };
  const log = { docFaces: 0, xoaPeople: 0 };
  const from = (table) => {
    let op = "select";
    let payload = null;
    const f = [];
    let orF = null;
    let head = false;
    let wantCount = false;
    let one = false;
    const rows = () => st[table].filter((r) => f.every((fn) => fn(r)) && (!orF || orF(r)));
    const run = () => {
      const cols = typeof payload === "string" ? payload : "";
      if (thieuCot && table === "albums" && /faces_pruned_at/.test(cols)) {
        return { data: null, error: { code: "42703", message: "column albums.faces_pruned_at does not exist" } };
      }
      const hit = rows();
      if (op === "update") {
        for (const r of hit) Object.assign(r, payload);
        return { data: hit, error: null };
      }
      if (op === "delete") {
        st[table] = st[table].filter((r) => !hit.includes(r));
        if (table === "album_people") log.xoaPeople += hit.length;
        return { data: null, count: hit.length, error: null };
      }
      if (op === "insert") {
        st[table].push(...payload);
        return { data: null, error: null };
      }
      if (table === "album_faces" && !head) log.docFaces += hit.length;
      if (one) return { data: hit[0] ?? null, error: null };
      return { data: head ? null : hit, count: wantCount ? hit.length : null, error: null };
    };
    const q = {
      select(c, o) { if (op === "select") payload = c; if (o?.count) wantCount = true; if (o?.head) head = true; return q; },
      update(p) { op = "update"; payload = p; return q; },
      delete() { op = "delete"; return q; },
      insert(p) { op = "insert"; payload = p; return q; },
      eq(c, v) { f.push((r) => r[c] === v); return q; },
      neq(c, v) { f.push((r) => r[c] !== v); return q; },
      lt(c, v) { f.push((r) => r[c] != null && r[c] < v); return q; },
      is(c, v) { f.push((r) => (v === null ? r[c] == null : r[c] === v)); return q; },
      or(expr) {
        // Chỉ dạng face-don dùng: delivered_at.lt.X,and(delivered_at.is.null,created_at.lt.X)
        const m = /^delivered_at\.lt\.([^,]+),and\(delivered_at\.is\.null,created_at\.lt\.([^)]+)\)$/.exec(expr);
        if (!m) throw new Error(`or() lạ: ${expr}`);
        orF = (r) => (r.delivered_at ? r.delivered_at < m[1] : r.created_at < m[2]);
        return q;
      },
      order() { return q; },
      range() { return q; },
      limit() { return q; },
      in(c, list) { f.push((r) => list.includes(r[c])); return q; },
      maybeSingle() { one = true; return Promise.resolve(run()); },
      then(res, rej) { return Promise.resolve(run()).then(res, rej); },
    };
    return q;
  };
  return { db: { from }, st, log };
}

const anh = (album_id, id, scanned = true) => ({ id, album_id, is_video: false, drive_file_id: `d-${id}`, faces_scanned_at: scanned ? iso(30) : null });
const mat = (album_id, photo_id, at = 0) => ({ album_id, photo_id, at, box: [0, 0, 0.1, 0.1], descriptor: Array(128).fill(0.1), sharpness: 1 });

/* ── 1. Chọn đúng album để dọn ─────────────────────────────────────────── */
{
  const albums = [
    { id: "cu", phase: "delivery", delivered_at: iso(20), created_at: iso(60), faces_clustered_at: iso(25), faces_pruned_at: null },
    { id: "moi", phase: "delivery", delivered_at: iso(10), created_at: iso(60), faces_clustered_at: iso(12), faces_pruned_at: null },
    { id: "chon", phase: "selection", delivered_at: null, created_at: iso(90), faces_clustered_at: iso(80), faces_pruned_at: null },
    { id: "chon-moi", phase: "selection", delivered_at: null, created_at: iso(90), faces_clustered_at: iso(10), faces_pruned_at: null },
    { id: "tao-thang", phase: "delivery", delivered_at: null, created_at: iso(40), faces_clustered_at: iso(39), faces_pruned_at: null },
    { id: "chua-gom", phase: "delivery", delivered_at: iso(30), created_at: iso(40), faces_clustered_at: null, faces_pruned_at: null },
    { id: "con-quet", phase: "delivery", delivered_at: iso(30), created_at: iso(40), faces_clustered_at: iso(31), faces_pruned_at: null },
  ];
  const photos = [anh("cu", "c1"), anh("moi", "m1"), anh("chon", "s1"), anh("chon-moi", "s2"), anh("tao-thang", "t1"), anh("chua-gom", "g1"), anh("con-quet", "q1"), anh("con-quet", "q2", false)];
  const faces = photos.map((p) => mat(p.album_id, p.id));
  const { db, st } = fakeDb({ albums, photos, faces });
  const kq = await donKhuonMatAlbumCu(db, { now: NOW });
  const conLai = new Set(st.album_faces.map((r) => r.album_id));
  ok("dọn album giao khách quá 15 ngày", !conLai.has("cu"));
  ok("album tạo thẳng ở giai đoạn giao khách tính từ created_at", !conLai.has("tao-thang"));
  ok("giữ album mới giao 10 ngày", conLai.has("moi"));
  ok("dọn album chọn ảnh đã gom xong quá 30 ngày (nằm mãi ở bước chọn ảnh)", !conLai.has("chon"));
  ok("giữ album chọn ảnh mới gom 10 ngày", conLai.has("chon-moi"));
  ok("giữ album chưa gom xong (xoá thì không bao giờ có danh sách người)", conLai.has("chua-gom"));
  ok("giữ album còn ảnh chờ quét", conLai.has("con-quet"));
  ok("đặt mốc faces_pruned_at cho album đã dọn", !!albums.find((a) => a.id === "cu").faces_pruned_at && !albums.find((a) => a.id === "moi").faces_pruned_at);
  ok("đếm đúng", kq.ok && kq.daDon === 3 && kq.boQua === 2 && kq.dongXoa === 3, JSON.stringify(kq));

  // Lượt sau: album đã dọn có ảnh quét thêm → chỉ xoá phần mới, không đếm là dọn lần đầu.
  st.album_faces.push(mat("cu", "c2"));
  const kq2 = await donKhuonMatAlbumCu(db, { now: NOW });
  ok("lượt sau xoá vector của ảnh quét thêm", kq2.donLai === 1 && kq2.daDon === 0 && !st.album_faces.some((r) => r.album_id === "cu"), JSON.stringify(kq2));
}

/* ── 2. Gom KHÔNG BAO GIỜ chạy trên album đã dọn ───────────────────────── */
{
  const albums = [{ id: "a", phase: "delivery", faces_clustered_at: null, faces_pruned_at: iso(1) }];
  const people = [{ id: "n1", album_id: "a", name: "Cô dâu", descriptor: Array(128).fill(0.1) }, { id: "n2", album_id: "a", name: "", descriptor: Array(128).fill(0.2) }];
  const faces = [mat("a", "x1"), mat("a", "x2")]; // vài tấm quét thêm sau khi dọn
  const { db, st, log } = fakeDb({ albums, faces, people });
  const n = await clusterAlbum(db, "a");
  ok("clusterAlbum giữ nguyên danh sách người", st.album_people.length === 2 && log.xoaPeople === 0 && n === 2);
  ok("clusterAlbum không đọc vector khuôn mặt", log.docFaces === 0);
  ok("clusterAlbum đưa album ra khỏi hàng đợi gom", !!albums[0].faces_clustered_at);
  let nem = null;
  try { await ghiNguoi(db, "a", []); } catch (e) { nem = e.message; }
  ok("ghiNguoi (đường gom của máy studio) từ chối ghi", nem === "album_da_don_khuon_mat" && st.album_people.length === 2);
}

/* ── 3. Database chưa chạy SQL ─────────────────────────────────────────── */
{
  const albums = [{ id: "a", phase: "delivery", delivered_at: iso(20), created_at: iso(30), faces_clustered_at: iso(25) }];
  const { db } = fakeDb({ albums, thieuCot: true });
  ok("thiếu cột → coi như chưa dọn (gom vẫn chạy như cũ)", (await daDonKhuonMat(db, "a")) === false);
  const kq = await donKhuonMatAlbumCu(db, { now: NOW });
  ok("thiếu cột → cron báo lỗi rõ ràng, không xoá gì", !kq.ok && /cap-nhat\.sql/.test(kq.loi ?? ""));
}

console.log(fail ? `\n${fail} bài hỏng` : "\nTất cả đạt");
process.exit(fail ? 1 : 0);
