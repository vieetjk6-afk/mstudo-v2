/* eslint-disable @typescript-eslint/no-explicit-any */

import { apDungLocCanQuet, apDungLocConQuet } from "./face-can-quet";
import { GOM_LAI_SAU_MS, ghiKetQuaQuet, veHangDoiGomNeuCan } from "./face-ghi";
import { clusterAlbum } from "./face-gom";
import { kiemLoKetQua } from "./face-scan-core";

/**
 * PHÍA MÁY CHỦ CỦA VIỆC QUÉT TRÊN MÁY STUDIO — giao việc, nhận kết quả, gom.
 *
 * Luật thuần + vào/ra DB, KHÔNG TensorFlow (không nhập face-node /
 * face-scan-server). Route /api/albums/[id]/face-local chỉ lo đăng nhập, gói,
 * giới hạn tần suất rồi gọi xuống đây. Kiểm thử: desktop/test/face-local.mjs.
 */

/** Số ảnh giao mỗi trang. Nhỏ: mỗi dòng ~120 byte, và máy studio hỏi lại liên tục. */
export const TRANG_VIEC = 40;

export type ViecQuet = {
  /** Ảnh CẦN quét của album (không tính video / thiếu drive_file_id). */
  tong: number;
  conLai: number;
  daQuet: number;
  nguoi: number;
  /** Album đã quét hết mà còn khuôn mặt chưa gom → máy studio gọi {gom:true}. */
  canGom: boolean;
  anh: { id: string; drive_file_id: string; name: string | null }[];
};

const dem = (db: any, albumId: string) => db.from("photos").select("id", { count: "exact", head: true }).eq("album_id", albumId);

/** Album có cần gom không: đang trong hàng đợi, hoặc có tấm quét SAU lần gom cuối. */
async function canGomKhong(db: any, albumId: string, daQuet: number): Promise<{ can: boolean; lanCuoi: number | null }> {
  const { data: al, error } = await db.from("albums").select("faces_clustered_at").eq("id", albumId).maybeSingle();
  if (error) throw new Error(`doc_album_that_bai: ${error.message}`);
  const lanCuoi = al?.faces_clustered_at ? Date.parse(al.faces_clustered_at as string) : null;
  if (daQuet === 0) return { can: false, lanCuoi };
  if (lanCuoi === null || !Number.isFinite(lanCuoi)) return { can: true, lanCuoi: null };
  /*
   * Mốc gom còn đó không có nghĩa là không còn gì để gom: mẻ CUỐI của album có
   * thể toàn ảnh không mặt (không ghi dòng nào nên không đặt lại hàng đợi),
   * trong khi các mẻ trước đã ghi mặt mà chưa gom. Một dòng, một cột.
   */
  const { data: moi } = await db
    .from("photos")
    .select("id")
    .eq("album_id", albumId)
    .gt("faces_scanned_at", al.faces_clustered_at)
    .limit(1);
  return { can: (moi ?? []).length > 0, lanCuoi };
}

/** Tiến độ + một trang ảnh còn phải quét. `boQua` để bỏ qua những tấm vừa hỏng tạm. */
export async function layViecQuet(db: any, albumId: string, boQua = 0): Promise<ViecQuet> {
  const from = Math.max(0, Math.min(Number.isFinite(boQua) ? Math.floor(boQua) : 0, 100_000));
  const [can, cho, ng] = await Promise.all([
    apDungLocCanQuet(dem(db, albumId)),
    apDungLocConQuet(db.from("photos").select("id, drive_file_id, name", { count: "exact" }).eq("album_id", albumId))
      .order("position")
      .order("id")
      .range(from, from + TRANG_VIEC - 1),
    db.from("album_people").select("id", { count: "exact", head: true }).eq("album_id", albumId),
  ]);
  if (can.error) throw new Error(`dem_anh_that_bai: ${can.error.message}`);
  // `range` quá cuối danh sách thì PostgREST trả 416 — coi là trang rỗng.
  const anh = (cho.error ? [] : cho.data ?? []) as ViecQuet["anh"];
  const tong = can.count ?? 0;
  let conLai = cho.count ?? null;
  if (conLai === null) {
    const c = await apDungLocConQuet(dem(db, albumId));
    if (c.error) throw new Error(`dem_anh_cho_that_bai: ${c.error.message}`);
    conLai = c.count ?? 0;
  }
  const daQuet = Math.max(0, tong - conLai);
  const g = conLai === 0 ? await canGomKhong(db, albumId, daQuet) : { can: false };
  return { tong, conLai, daQuet, nguoi: ng.error ? 0 : ng.count ?? 0, canGom: g.can, anh };
}

export type KetQuaNhan =
  | { ok: true; daGhi: number; khuonMat: number; boQuaDaQuet: number; conLai: number; xong: boolean }
  | { ok: false; error: string; detail?: string };

/**
 * Nhận một lô kết quả từ máy studio và ghi xuống DB đúng như `scanAlbum` ghi.
 *
 * Chỉ nhận ảnh THUỘC album này và CÒN CHỜ QUÉT: tấm đã có mốc (tab thứ hai, hay
 * máy chủ vừa quét) bị bỏ qua — ghi đè sẽ trộn hai lượt dò của cùng một tấm.
 */
export async function nhanLoKetQua(db: any, albumId: string, raw: unknown): Promise<KetQuaNhan> {
  const k = kiemLoKetQua(raw);
  if (!k.ok) return { ok: false, error: "lo_khong_hop_le", detail: k.loi };

  const ids = k.lo.map((r) => r.photoId);
  const { data: rows, error } = await apDungLocConQuet(db.from("photos").select("id").eq("album_id", albumId).in("id", ids));
  if (error) throw new Error(`doc_anh_cua_lo_that_bai: ${error.message}`);
  const conCho = new Set(((rows ?? []) as { id: string }[]).map((r) => r.id));
  // Tấm nào không thuộc album (hoặc là video) thì cả lô bị từ chối — không phải
  // chuyện "đã quét rồi". Phân biệt bằng một câu đếm theo album, không lọc mốc.
  if (conCho.size < ids.length) {
    const { count } = await db.from("photos").select("id", { count: "exact", head: true }).eq("album_id", albumId).in("id", ids);
    if ((count ?? 0) < ids.length) return { ok: false, error: "anh_khong_thuoc_album" };
  }

  const faceRows: Record<string, unknown>[] = [];
  const doneIds: string[] = [];
  for (const r of k.lo) {
    if (!conCho.has(r.photoId)) continue;
    if ("faces" in r) {
      r.faces.forEach((f, at) => {
        faceRows.push({ album_id: albumId, photo_id: r.photoId, at, box: [f.box.x, f.box.y, f.box.w, f.box.h], descriptor: f.descriptor, sharpness: f.sharpness });
      });
    }
    // Đánh mốc KỂ CẢ khi 0 mặt / bỏ qua vĩnh viễn — như scanAlbum.
    doneIds.push(r.photoId);
  }
  const khuonMat = faceRows.length;
  const daGhi = doneIds.length;
  const g = await ghiKetQuaQuet(db, faceRows, doneIds);
  if (g.ghiKhongAn) return { ok: false, error: "ghi-khong-an" };

  const c = await apDungLocConQuet(dem(db, albumId));
  if (c.error) throw new Error(`dem_anh_cho_that_bai: ${c.error.message}`);
  const conLai = c.count ?? 0;
  if (g.daGhiMat > 0) await veHangDoiGomNeuCan(db, albumId, conLai === 0);
  return { ok: true, daGhi, khuonMat, boQuaDaQuet: ids.length - daGhi, conLai, xong: conLai === 0 };
}

/**
 * Gom nhóm nếu CẦN — máy studio gọi khi quét hết hoặc khi tạm dừng.
 *
 * Giữ luật 12 giờ: album còn quét dở thì gom lại nhiều nhất 12 giờ một lần (mỗi
 * lần gom đọc toàn bộ vector của album — egress Supabase). Quét hết thì gom
 * đúng một lần; gọi lại không làm gì.
 */
export async function gomNeuCan(db: any, albumId: string): Promise<{ gom: boolean; lyDo?: string; nguoi: number }> {
  const [can, con] = await Promise.all([apDungLocCanQuet(dem(db, albumId)), apDungLocConQuet(dem(db, albumId))]);
  if (can.error || con.error) throw new Error(`dem_anh_that_bai: ${(can.error ?? con.error).message}`);
  const conLai = con.count ?? 0;
  const daQuet = Math.max(0, (can.count ?? 0) - conLai);
  const demNguoi = async () => (await db.from("album_people").select("id", { count: "exact", head: true }).eq("album_id", albumId)).count ?? 0;
  const g = await canGomKhong(db, albumId, daQuet);
  if (!g.can) return { gom: false, lyDo: daQuet === 0 ? "chua-quet" : "khong-co-gi-moi", nguoi: await demNguoi() };
  if (conLai > 0 && g.lanCuoi !== null && Date.now() - g.lanCuoi < GOM_LAI_SAU_MS) {
    return { gom: false, lyDo: "cho-12-gio", nguoi: await demNguoi() };
  }
  return { gom: true, nguoi: await clusterAlbum(db, albumId) };
}
