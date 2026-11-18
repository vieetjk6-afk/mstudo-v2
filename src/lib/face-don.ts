/* eslint-disable @typescript-eslint/no-explicit-any */

import { apDungLocConQuet } from "./face-can-quet";

/*
 * DỌN VECTOR KHUÔN MẶT CỦA ALBUM ĐÃ GIAO KHÁCH LÂU.
 *
 * album_faces (mỗi khuôn mặt một vector 128 số) là bảng nặng nhất database —
 * 198/345 MB lúc đo 11/2026, sát trần 500 MB của gói Free. Nó chỉ cần cho bước
 * GOM. Sau khi gom, khách tìm ảnh theo khuôn mặt bằng album_people (vector đại
 * diện của từng người) + album_photo_people; hai bảng đó GIỮ NGUYÊN, nên xoá
 * album_faces không làm mất tính năng tìm khuôn mặt.
 *
 * Cái giá: album đã dọn không gom lại được nữa. Ảnh thêm vào sau đó không vào
 * được danh sách người, và khung mặt dùng cho ghép layout không còn (ghép vẫn
 * chạy, chỉ cắt giữa ảnh thay vì cắt theo mặt).
 *
 * Mốc albums.faces_pruned_at là CHỐT AN TOÀN: gom trên album đã mất vector sẽ
 * dựng danh sách người từ vài tấm mới quét rồi XOÁ toàn bộ người cũ (ghiNguoi
 * xoá-rồi-dựng-lại). Mọi đường gom đều hỏi `daDonKhuonMat` trước.
 */

/** Xoá vector khuôn mặt sau ngần này ngày kể từ khi album chuyển sang giao khách. */
export function donSauNgay(): number {
  const n = Number(process.env.FACE_PRUNE_AFTER_DAYS);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 15;
}

/** Lỗi do database chưa có cột faces_pruned_at (chưa chạy SQL)? */
function thieuCot(e: { code?: string | null; message?: string | null } | null): boolean {
  if (!e) return false;
  return e.code === "42703" || e.code === "PGRST204" || /faces_pruned_at/i.test(e.message ?? "");
}

/**
 * Album đã bị dọn vector khuôn mặt chưa. Database chưa có cột → coi như chưa
 * (chưa có cột thì cũng chưa dọn được album nào). Lỗi khác → coi như ĐÃ dọn:
 * chặn nhầm một lượt gom chỉ làm chậm, gom nhầm thì mất danh sách người.
 */
export async function daDonKhuonMat(db: any, albumId: string): Promise<boolean> {
  const { data, error } = await db.from("albums").select("faces_pruned_at").eq("id", albumId).maybeSingle();
  if (error) return !thieuCot(error);
  return !!(data as { faces_pruned_at?: string | null } | null)?.faces_pruned_at;
}

type AlbumXet = {
  id: string;
  faces_clustered_at: string | null;
  faces_pruned_at: string | null;
};

export type KetQuaDon = {
  ok: boolean;
  /** Album vừa được dọn lần đầu. */
  daDon: number;
  /** Album đã dọn từ trước, chỉ xoá vector của ảnh quét thêm sau đó. */
  donLai: number;
  /** Đủ tuổi nhưng chưa quét / gom xong — để đêm sau. */
  boQua: number;
  /** Số dòng album_faces đã xoá. */
  dongXoa: number;
  hetGio: boolean;
  loi?: string;
};

/**
 * Một lượt dọn. Gọi lại an toàn: album đã dọn chỉ tốn một câu xoá (thường 0 dòng).
 *
 * Album đủ điều kiện dọn LẦN ĐẦU khi:
 *   • phase = 'delivery' và đã giao khách quá `donSauNgay()` ngày
 *     (delivered_at; album tạo thẳng ở giai đoạn giao khách không có mốc này
 *     → tính từ created_at);
 *   • đã gom xong (faces_clustered_at có giá trị) — chưa gom mà xoá vector thì
 *     album không bao giờ có danh sách người;
 *   • không còn ảnh chờ quét — ảnh quét sau khi dọn sẽ không gom được.
 */
export async function donKhuonMatAlbumCu(
  db: any,
  opts: { now?: number; nganSachMs?: number } = {},
): Promise<KetQuaDon> {
  const now = opts.now ?? Date.now();
  // Ngân sách tính theo đồng hồ thật — `now` chỉ là mốc ngày (kiểm thử truyền vào).
  const hanChot = Date.now() + (opts.nganSachMs ?? 240_000);
  const moc = new Date(now - donSauNgay() * 24 * 3600 * 1000).toISOString();
  const kq: KetQuaDon = { ok: true, daDon: 0, donLai: 0, boQua: 0, dongXoa: 0, hetGio: false };

  const albums: AlbumXet[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("albums")
      .select("id, faces_clustered_at, faces_pruned_at")
      .eq("phase", "delivery")
      .or(`delivered_at.lt.${moc},and(delivered_at.is.null,created_at.lt.${moc})`)
      .order("id")
      .range(from, from + 999);
    if (error) {
      return {
        ...kq,
        ok: false,
        loi: thieuCot(error)
          ? "Database chưa có cột albums.faces_pruned_at — chạy supabase/cap-nhat.sql."
          : `doc_album_that_bai: ${error.message}`,
      };
    }
    const rows = (data ?? []) as AlbumXet[];
    albums.push(...rows);
    if (rows.length < 1000) break;
  }

  for (const a of albums) {
    if (Date.now() > hanChot) {
      kq.hetGio = true;
      break;
    }
    const lanDau = !a.faces_pruned_at;
    if (lanDau) {
      if (!a.faces_clustered_at) {
        kq.boQua++;
        continue;
      }
      const { count, error: eCho } = await apDungLocConQuet(
        db.from("photos").select("id", { count: "exact", head: true }).eq("album_id", a.id),
      );
      if (eCho) {
        kq.ok = false;
        kq.loi = `dem_anh_cho_that_bai: ${eCho.message}`;
        continue;
      }
      if ((count ?? 0) > 0) {
        kq.boQua++;
        continue;
      }
      // Đặt mốc TRƯỚC khi xoá: hỏng giữa hai bước thì album bị chặn gom mà
      // vector còn nguyên (đêm sau xoá tiếp) — ngược lại thì một lượt gom chen
      // vào giữa sẽ dựng người từ bảng đã trống.
      const { error: eMoc } = await db.from("albums").update({ faces_pruned_at: new Date(now).toISOString() }).eq("id", a.id);
      if (eMoc) {
        kq.ok = false;
        kq.loi = `dat_moc_don_that_bai: ${eMoc.message}`;
        continue;
      }
    }
    // Xoá không trả dòng về (không tốn egress), chỉ đếm.
    const { count: xoa, error: eXoa } = await db.from("album_faces").delete({ count: "exact" }).eq("album_id", a.id);
    if (eXoa) {
      kq.ok = false;
      kq.loi = `xoa_khuon_mat_that_bai: ${eXoa.message}`;
      continue;
    }
    kq.dongXoa += xoa ?? 0;
    if (lanDau) kq.daDon++;
    else if ((xoa ?? 0) > 0) kq.donLai++;
  }
  return kq;
}
