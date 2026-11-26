/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * ĐỢT 3 — CHUYỂN album_faces CŨ SANG KHO FILE, rồi xoá khỏi database.
 *
 * Chạy trong cron cleanup-faces (mỗi đêm), từng album một, có ngân sách giờ;
 * hết giờ thì đêm sau làm tiếp. Mỗi album:
 *
 *   1. Đọc HẾT album_faces của album (theo trang) + danh sách ảnh đã quét.
 *   2. Ghi vào kho những ảnh kho CHƯA có bản studio (kể cả ảnh 0 mặt).
 *   3. ĐỌC LẠI kho và kiểm: mọi ảnh có dòng trong album_faces đều có bản studio
 *      trong kho, và ảnh VỪA CHÉP thì đúng số khuôn mặt. Thiếu / lệch một ảnh là
 *      KHÔNG XOÁ gì của album đó — báo lỗi, để nguyên cho người xem.
 *   4. Kiểm xong mới xoá các dòng album_faces của album, rồi đặt mốc
 *      albums.faces_kho_at để lượt sau bỏ qua.
 *
 * Album đã dọn vector từ trước (faces_pruned_at) vẫn chuyển phần còn lại bình
 * thường; phần đã dọn thì đã mất từ trước, không liên quan việc này.
 */

import { giaiMaManh, gopManh, NGUON_STUDIO, type AnhKho } from "./face-kho";
import { anhDaQuet, docKho, ghiManh, lietKeManh, BUCKET_KHO } from "./face-kho-server";

/** Một mảnh tối đa ngần này byte (bucket chặn 4 MB/file). */
const MANH_TOI_DA_BYTE = 3 * 1024 * 1024;

type Dong = { photo_id: string; at: number; box: number[] | string | null; descriptor: number[] | string | null; sharpness: number | null };

/** real[] có thể về dạng chuỗi "{0.1,0.2}" — đổi về mảng số. */
const veMang = (v: number[] | string | null): number[] | null =>
  v == null ? null : Array.isArray(v) ? v.map(Number) : v.replace(/[{}]/g, "").split(",").filter(Boolean).map(Number);

export type KetQuaChuyen = {
  ok: boolean;
  /** Album đã chuyển xong + xoá dòng DB ở lượt này. */
  album: number;
  /** Album không có dòng nào — chỉ đặt mốc. */
  albumRong: number;
  /** Ảnh được ghi mới vào kho. */
  anh: number;
  /** Dòng album_faces đã xoá. */
  dongXoa: number;
  /** false = hết giờ giữa chừng, lượt sau chạy tiếp (trang Sức khoẻ in "chưa xong"). */
  done: boolean;
  /** Số album lỗi ở lượt này — dòng DB của chúng còn nguyên. */
  albumLoi: number;
  /** Câu lỗi (album đầu tiên lỗi) — tên `error` để trang Sức khoẻ hiện ra. */
  error?: string;
};

async function docDongAlbum(db: any, albumId: string): Promise<Dong[]> {
  const out: Dong[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("album_faces")
      .select("photo_id, at, box, descriptor, sharpness")
      .eq("album_id", albumId)
      .order("photo_id")
      .order("at")
      .range(from, from + 999);
    if (error) throw new Error(`doc_album_faces_that_bai: ${error.message}`);
    const rows = (data ?? []) as Dong[];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

/** Chia danh sách ảnh thành các mảnh dưới trần dung lượng. */
function chiaManh(anh: AnhKho[]): AnhKho[][] {
  const out: AnhKho[][] = [];
  let cur: AnhKho[] = [];
  let bytes = 12;
  for (const a of anh) {
    const n = 17 + a.faces.length * 268;
    if (cur.length && bytes + n > MANH_TOI_DA_BYTE) {
      out.push(cur);
      cur = [];
      bytes = 12;
    }
    cur.push(a);
    bytes += n;
  }
  if (cur.length) out.push(cur);
  return out;
}

/** Chuyển MỘT album. Trả số ảnh ghi mới + số dòng đã xoá. NÉM khi kiểm lại lệch. */
export async function chuyenMotAlbum(db: any, albumId: string): Promise<{ anh: number; dongXoa: number; rong: boolean }> {
  const { count, error: eDem } = await db.from("album_faces").select("photo_id", { count: "exact", head: true }).eq("album_id", albumId);
  if (eDem) throw new Error(`dem_album_faces_that_bai: ${eDem.message}`);
  if ((count ?? 0) === 0) {
    await datMoc(db, albumId);
    return { anh: 0, dongXoa: 0, rong: true };
  }

  const [dong, daQuet, truoc] = await Promise.all([docDongAlbum(db, albumId), anhDaQuet(db, albumId), docKho(db, albumId)]);
  if (!daQuet) throw new Error("doc_anh_da_quet_that_bai");

  // Gom dòng theo ảnh, giữ đúng thứ tự `at`.
  const theoAnh = new Map<string, AnhKho>();
  for (const id of daQuet) theoAnh.set(id, { photoId: id, faces: [] });
  for (const r of dong) {
    let a = theoAnh.get(r.photo_id);
    if (!a) theoAnh.set(r.photo_id, (a = { photoId: r.photo_id, faces: [] }));
    const box = veMang(r.box);
    const d = veMang(r.descriptor);
    if (!box || box.length !== 4 || !d || d.length !== 128) continue;
    a.faces[r.at] = { box: [box[0], box[1], box[2], box[3]], descriptor: d, sharpness: Number(r.sharpness) || 0 };
  }
  for (const a of theoAnh.values()) a.faces = a.faces.filter(Boolean);

  const canGhi = [...theoAnh.values()].filter((a) => truoc.kho.get(a.photoId)?.nguon !== NGUON_STUDIO);
  for (const lo of chiaManh(canGhi)) await ghiManh(db, albumId, { nguon: NGUON_STUDIO, anh: lo });

  // KIỂM LẠI trên bản đọc MỚI từ Storage (không tin bộ đệm trong tiến trình).
  const sau = await docKhoKhongDem(db, albumId);
  const soMatDb = new Map<string, number>();
  for (const r of dong) soMatDb.set(r.photo_id, (soMatDb.get(r.photo_id) ?? 0) + 1);
  // Chỉ kiểm những ảnh VỪA CHÉP. Ảnh đã có bản studio trong kho từ trước thì
  // bản kho là lần quét mới hơn (quét lại) — album_faces có thể còn dòng cũ
  // thừa, lệch số là chuyện bình thường, không phải lỗi.
  const vuaChep = new Set(canGhi.map((a) => a.photoId));
  for (const [id, n] of soMatDb) {
    if (!vuaChep.has(id)) {
      if (sau.get(id)?.nguon !== NGUON_STUDIO) throw new Error(`kiem_lai_thieu_anh: ${id}`);
      continue;
    }
    const v = sau.get(id);
    if (!v || v.nguon !== NGUON_STUDIO) throw new Error(`kiem_lai_thieu_anh: ${id}`);
    if (v.faces.length !== n) throw new Error(`kiem_lai_lech_so_mat: ${id} (db ${n}, kho ${v.faces.length})`);
  }

  // Đủ rồi mới xoá.
  const { count: xoa, error: eXoa } = await db.from("album_faces").delete({ count: "exact" }).eq("album_id", albumId);
  if (eXoa) throw new Error(`xoa_album_faces_that_bai: ${eXoa.message}`);
  await datMoc(db, albumId);
  return { anh: canGhi.length, dongXoa: xoa ?? 0, rong: false };
}

/** Đọc + gộp kho bằng cách tải thẳng từng mảnh, bỏ qua bộ đệm của docKho. */
async function docKhoKhongDem(db: any, albumId: string) {
  const files = await lietKeManh(db, albumId);
  const manh = [];
  for (const f of files) {
    const { data, error } = await db.storage.from(BUCKET_KHO).download(`${albumId}/${f.name}`);
    if (error || !data) throw new Error(`tai_manh_that_bai: ${f.name}`);
    manh.push(giaiMaManh(new Uint8Array(await data.arrayBuffer())));
  }
  return gopManh(manh);
}

async function datMoc(db: any, albumId: string) {
  const { error } = await db.from("albums").update({ faces_kho_at: new Date().toISOString() }).eq("id", albumId);
  if (error) throw new Error(`dat_moc_faces_kho_at_that_bai: ${error.message}`);
}

/** Một lượt chuyển: các album chưa có mốc faces_kho_at, tới khi hết ngân sách. */
export async function chuyenSangKho(db: any, opts: { nganSachMs?: number } = {}): Promise<KetQuaChuyen> {
  const hanChot = Date.now() + (opts.nganSachMs ?? 120_000);
  const kq: KetQuaChuyen = { ok: true, album: 0, albumRong: 0, anh: 0, dongXoa: 0, done: true, albumLoi: 0 };
  const ids: string[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("albums").select("id").is("faces_kho_at", null).order("id").range(from, from + 999);
    if (error) return { ...kq, ok: false, error: `doc_album_that_bai: ${error.message}` };
    const rows = (data ?? []) as { id: string }[];
    ids.push(...rows.map((r) => r.id));
    if (rows.length < 1000) break;
  }
  for (const id of ids) {
    if (Date.now() > hanChot) {
      kq.done = false;
      break;
    }
    try {
      const r = await chuyenMotAlbum(db, id);
      if (r.rong) kq.albumRong++;
      else kq.album++;
      kq.anh += r.anh;
      kq.dongXoa += r.dongXoa;
    } catch (e) {
      // Lỗi một album không chặn album khác; album đó giữ nguyên dòng DB.
      kq.ok = false;
      kq.albumLoi++;
      // Giữ câu lỗi của album ĐẦU TIÊN — đủ để lần ra, không bị album sau đè.
      kq.error ??= `album ${id}: ${e instanceof Error ? e.message : String(e)}`.slice(0, 300);
    }
  }
  return kq;
}
