/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * KHO KHUÔN MẶT — phần Storage (máy chủ, service-role). Định dạng + gộp ở
 * ./face-kho. Không `import "server-only"` để kiểm thử Node nhập được (cùng lý
 * do face-ghi.ts) — nhưng chỉ máy chủ gọi: nó cần client service-role.
 *
 * Bố cục: bucket riêng tư `face-kho`, mỗi album một thư mục `<album_id>/`, mỗi
 * lượt ghi một mảnh `<s|k>-<thời điểm base36>-<ngẫu nhiên>.bin`. Trong cùng
 * một nguồn, sắp theo tên = sắp theo thứ tự ghi — đủ cho luật "khách đầu thắng
 * khách sau" của gopManh (studio thì luôn thắng khách, không phụ thuộc thứ tự).
 *
 * Không có policy nào trên bucket: khách và studio KHÔNG đọc file trực tiếp.
 * Mọi phép so khớp chạy ở máy chủ và chỉ trả về danh sách ảnh — vector khuôn
 * mặt của người khác không bao giờ xuống máy khách.
 */

import { giaiMaManh, gopManh, maHoaManh, tachTheoNguon, NGUON_STUDIO, type AnhKho, type KhoGop, type ManhKho, type Nguon } from "./face-kho";

export const BUCKET_KHO = "face-kho";
/** Quá ngần này mảnh thì nén lại thành tối đa hai mảnh (studio + khách). */
export const NEN_KHI_QUA = 24;
/** Trần dung lượng kho của MỘT album — chặn khách gửi rác làm đầy Storage. */
export const KHO_TOI_DA_BYTE = 16 * 1024 * 1024;

type FileKho = { name: string; size: number };

function tenManh(nguon: Nguon, hau = ""): string {
  const t = Date.now().toString(36).padStart(9, "0");
  const r = Math.random().toString(36).slice(2, 8);
  return `${nguon === NGUON_STUDIO ? "s" : "k"}-${t}-${r}${hau}.bin`;
}

/** Liệt kê các mảnh của album, theo thứ tự ghi. */
export async function lietKeManh(db: any, albumId: string): Promise<FileKho[]> {
  const out: FileKho[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.storage.from(BUCKET_KHO).list(albumId, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`liet_ke_kho_that_bai: ${error.message}`);
    const rows = (data ?? []) as { name: string; metadata?: { size?: number } | null }[];
    for (const r of rows) if (r.name.endsWith(".bin")) out.push({ name: r.name, size: Number(r.metadata?.size) || 0 });
    if (rows.length < 1000) break;
  }
  return out.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/** Ghi một mảnh. Trả tên file. Mảnh rỗng thì không ghi gì. */
export async function ghiManh(db: any, albumId: string, manh: ManhKho): Promise<string | null> {
  if (manh.anh.length === 0) return null;
  const ten = tenManh(manh.nguon);
  const { error } = await db.storage
    .from(BUCKET_KHO)
    .upload(`${albumId}/${ten}`, maHoaManh(manh), { contentType: "application/octet-stream", upsert: false });
  if (error) throw new Error(`ghi_manh_that_bai: ${error.message}`);
  return ten;
}

/*
 * Bộ nhớ đệm trong tiến trình: một album khách đang tìm thì vài chục lượt hỏi
 * liền nhau. Khoá theo DANH SÁCH TÊN MẢNH — có mảnh mới là khoá đổi, đọc lại;
 * không có thì khỏi tải lại (egress Supabase). Chỉ giữ vài album gần nhất.
 */
const DEM = new Map<string, { khoa: string; kho: KhoGop }>();
const DEM_TOI_DA = 8;

/** Tải + gộp toàn bộ kho của album. Mảnh hỏng bị bỏ qua (không làm hỏng cả kho). */
export async function docKho(db: any, albumId: string, files?: FileKho[]): Promise<{ kho: KhoGop; files: FileKho[] }> {
  const ds = files ?? (await lietKeManh(db, albumId));
  const khoa = ds.map((f) => `${f.name}:${f.size}`).join("|");
  const cu = DEM.get(albumId);
  if (cu && cu.khoa === khoa) return { kho: cu.kho, files: ds };

  const manh: (ManhKho | null)[] = new Array(ds.length).fill(null);
  let i = 0;
  const tho = async () => {
    while (i < ds.length) {
      const k = i++;
      const { data, error } = await db.storage.from(BUCKET_KHO).download(`${albumId}/${ds[k].name}`);
      if (error || !data) continue;
      try {
        manh[k] = giaiMaManh(new Uint8Array(await data.arrayBuffer()));
      } catch {
        /* mảnh hỏng — bỏ */
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(6, ds.length) }, tho));
  const kho = gopManh(manh.filter((m): m is ManhKho => !!m));
  DEM.delete(albumId);
  DEM.set(albumId, { khoa, kho });
  while (DEM.size > DEM_TOI_DA) DEM.delete(DEM.keys().next().value as string);
  return { kho, files: ds };
}

/**
 * Nén: quá NEN_KHI_QUA mảnh thì ghi bản gộp (tối đa hai mảnh) rồi xoá ĐÚNG các
 * mảnh đã đọc. Mảnh ai đó ghi chen vào giữa không nằm trong danh sách nên không
 * bị xoá; người đọc giữa lúc ghi-bản-gộp và xoá thấy trùng — gopManh tự khử.
 */
export async function nenNeuCan(db: any, albumId: string): Promise<boolean> {
  const files = await lietKeManh(db, albumId);
  if (files.length <= NEN_KHI_QUA) return false;
  const { kho } = await docKho(db, albumId, files);
  for (const m of tachTheoNguon(kho)) {
    const ten = tenManh(m.nguon, "-gop");
    const { error } = await db.storage.from(BUCKET_KHO).upload(`${albumId}/${ten}`, maHoaManh(m), { contentType: "application/octet-stream", upsert: false });
    if (error) throw new Error(`ghi_ban_gop_that_bai: ${error.message}`);
  }
  // Bản gộp đã chứa đúng bản thắng của từng ảnh, nên xoá mảnh cũ không đổi kết quả đọc.
  const ten = files.map((f) => `${albumId}/${f.name}`);
  for (let k = 0; k < ten.length; k += 100) await db.storage.from(BUCKET_KHO).remove(ten.slice(k, k + 100));
  DEM.delete(albumId);
  return true;
}

/**
 * GHI KÉP từ bộ quét studio / máy chủ (@/lib/face-ghi). Hỏng thì chỉ ghi log:
 * album_faces vẫn là nguồn chính ở đợt này, kho hỏng không được làm hỏng lượt quét.
 */
export async function ghiKepVaoKho(
  db: any,
  albumId: string | null | undefined,
  faceRows: readonly Record<string, unknown>[],
  doneIds: readonly string[],
): Promise<void> {
  if (!albumId || !doneIds.length || !db?.storage) return;
  try {
    const theoAnh = new Map<string, AnhKho>();
    for (const id of doneIds) theoAnh.set(id, { photoId: id, faces: [] });
    for (const r of faceRows) {
      const a = theoAnh.get(String(r.photo_id));
      const box = r.box as number[];
      const d = r.descriptor as number[];
      if (!a || !Array.isArray(box) || box.length !== 4 || !Array.isArray(d)) continue;
      a.faces.push({ box: [box[0], box[1], box[2], box[3]], descriptor: d, sharpness: Number(r.sharpness) || 0 });
    }
    await ghiManh(db, albumId, { nguon: NGUON_STUDIO, anh: [...theoAnh.values()] });
  } catch (e) {
    console.warn("[face-kho] ghi kép thất bại:", e instanceof Error ? e.message : e);
  }
}

/** Công tắc tắt nhanh tính năng khách tự quét (FACE_SELF_SCAN=0). Mặc định bật. */
export function khachTuQuetBat(): boolean {
  return process.env.FACE_SELF_SCAN !== "0";
}

/* ── ĐỌC CHO CÁC ĐƯỜNG GOM / GHÉP LAYOUT (đợt 2) ──────────────────────────────
   Đọc KHO trước; chỉ những ảnh kho chưa có (quét trước khi có ghi kép) mới
   phải đọc album_faces. Kho phủ đủ thì không chạm album_faces lần nào. */

/** Một dòng khuôn mặt — cùng hình với FaceRow của @/lib/face-gom-tinh. */
export type DongMat = { photo_id: string; at: number; box: number[] | null; descriptor: number[] | null; sharpness: number | null };

/** Kho của album, KHÔNG BAO GIỜ ném: Storage hỏng / chưa có bucket → kho rỗng. */
export async function docKhoAnToan(db: any, albumId: string): Promise<KhoGop> {
  if (!db?.storage) return new Map();
  try {
    return (await docKho(db, albumId)).kho;
  } catch {
    return new Map();
  }
}

/** Dòng khuôn mặt của các ảnh `ids` lấy từ kho (bỏ ảnh kho không có). */
export function dongTuKho(kho: KhoGop, ids: Iterable<string>, chiStudio = false): DongMat[] {
  const out: DongMat[] = [];
  for (const id of ids) {
    const v = kho.get(id);
    if (!v || (chiStudio && v.nguon !== NGUON_STUDIO)) continue;
    v.faces.forEach((f, at) => out.push({ photo_id: id, at, box: [...f.box], descriptor: f.descriptor, sharpness: f.sharpness }));
  }
  return out;
}

/** id các ảnh studio / máy chủ ĐÃ QUÉT (có mốc faces_scanned_at) của album. null = không đọc được. */
async function anhDaQuet(db: any, albumId: string): Promise<string[] | null> {
  try {
    const out: string[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db
        .from("photos")
        .select("id")
        .eq("album_id", albumId)
        .not("faces_scanned_at", "is", null)
        .order("id")
        .range(from, from + 999);
      if (error) return null;
      const rows = (data ?? []) as { id: string }[];
      out.push(...rows.map((r) => r.id));
      if (rows.length < 1000) break;
    }
    return out;
  } catch {
    return null;
  }
}

/**
 * Khuôn mặt để GOM NGƯỜI. Chỉ dữ liệu STUDIO / MÁY CHỦ (dữ liệu khách tự quét
 * không kiểm lại được, không được quyết định danh sách người cả album thấy).
 *
 * `phuDu` = kho có đủ MỌI ảnh đã quét của album (và album có ít nhất một ảnh
 * đã quét) → không cần album_faces. Không đủ thì đọc album_faces (`docDb`)
 * cho phần còn thiếu; bản kho thắng bản DB khi trùng ảnh.
 */
export async function docKhuonMatGom(
  db: any,
  albumId: string,
  docDb: () => Promise<DongMat[]>,
): Promise<{ list: DongMat[]; phuDu: boolean; tuKho: number; tuDb: number }> {
  const [kho, daQuet] = await Promise.all([docKhoAnToan(db, albumId), anhDaQuet(db, albumId)]);
  const coTrongKho = (id: string) => kho.get(id)?.nguon === NGUON_STUDIO;
  const phuDu = !!daQuet && daQuet.length > 0 && daQuet.every(coTrongKho);
  if (phuDu) {
    const list = dongTuKho(kho, daQuet!, true);
    return { list, phuDu, tuKho: daQuet!.length, tuDb: 0 };
  }
  const tuDb = await docDb();
  // Ảnh đã bị xoá khỏi album vẫn có thể còn trong kho — chỉ lấy ảnh còn mốc quét.
  const conTrongAlbum = daQuet ? new Set(daQuet) : null;
  const idKho = [...kho.keys()].filter((id) => coTrongKho(id) && (!conTrongAlbum || conTrongAlbum.has(id)));
  const khoSet = new Set(idKho);
  const list = [...dongTuKho(kho, idKho, true), ...tuDb.filter((r) => !khoSet.has(r.photo_id))];
  return { list, phuDu, tuKho: idKho.length, tuDb: tuDb.filter((r) => !khoSet.has(r.photo_id)).length };
}

/** Kho có đủ dữ liệu để gom lại album này từ đầu không (album đã dọn album_faces). */
export async function khoPhuDuDeGom(db: any, albumId: string): Promise<boolean> {
  const [kho, daQuet] = await Promise.all([docKhoAnToan(db, albumId), anhDaQuet(db, albumId)]);
  return !!daQuet && daQuet.length > 0 && daQuet.every((id) => kho.get(id)?.nguon === NGUON_STUDIO);
}
