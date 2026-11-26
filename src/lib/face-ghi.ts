/* eslint-disable @typescript-eslint/no-explicit-any */

import { ghiKetQuaVaoKho } from "./face-kho-server";

/**
 * GHI KẾT QUẢ QUÉT KHUÔN MẶT XUỐNG DB — MỘT đường cho cả hai nơi quét:
 *
 *   • bộ quét máy chủ (`scanAlbum` ở @/lib/face-scan-server), và
 *   • route nhận kết quả từ trình duyệt studio (/api/albums/[id]/face-local).
 *
 * Tách khỏi face-scan-server vì file đó kéo theo TensorFlow (@/lib/face-node);
 * route nhận kết quả thì không được chạm tới nó. Phần đáng giá nhất ở đây là
 * vòng kiểm "ghi không ăn" — đã trả giá mấy vòng mới có, nên không chép hai bản.
 */

/**
 * GHI XUỐNG DB SAU MỖI BAO NHIÊU ẢNH.
 *
 * 20, và con số này KHÔNG phải để tối ưu — nó là điều kiện để bộ quét tiến lên
 * được. Bản trước đặt 100: ở ~0,75 giây một ảnh thì 100 ảnh mất 75 giây, mà một
 * hàm serverless có thể bị cắt ở 60 giây (giới hạn gói Hobby của Vercel). Khi
 * đó lượt quét CHƯA BAO GIỜ tới mốc ghi — quét xong 80 ảnh rồi mất sạch, lượt
 * sau bắt đầu lại từ 0, và `chuaQuet` không bao giờ nhích. Không có lỗi nào hiện
 * ra ở đâu cả, vì về mặt code thì chẳng có gì sai.
 *
 * 20 ảnh ≈ 15 giây, an toàn dưới mọi hạn thời gian; đổi lại là thêm vài lượt
 * ghi, thứ rẻ hơn nhiều so với mất cả mẻ.
 */
export const WRITE_CHUNK = 20;
/**
 * Mẻ ghi đầu tiên của mỗi album — nhỏ, để "mốc quét có nằm lại không" lộ ra sau
 * vài giây thay vì sau nửa ngân sách. Xem chỗ dùng trong vòng quét.
 */
export const FIRST_CHUNK = 3;

/** Album quét dở thì gom lại nhiều nhất 12 giờ một lần (egress Supabase). */
export const GOM_LAI_SAU_MS = 12 * 3600_000;

export type KetQuaGhi = {
  /** Số khuôn mặt đã ghi vào kho file. */
  daGhiMat: number;
  /** Số dòng photos câu UPDATE trả về. */
  daGhiMoc: number;
  /** Số ảnh ĐỌC LẠI BẰNG CÂU RIÊNG mà thật sự đã mang mốc. */
  daXacNhan: number;
  /** Mốc ghi xong nhưng đọc lại vẫn null → người gọi phải DỪNG album này. */
  ghiKhongAn: boolean;
};

/**
 * Đẩy khuôn mặt + mốc "đã quét" xuống DB. Hai mảng bị RÚT CẠN (splice) — người
 * gọi dùng chúng làm bộ đệm giữa các mẻ.
 */
export async function ghiKetQuaQuet(
  db: any,
  faceRows: Record<string, unknown>[],
  doneIds: string[],
  albumId?: string,
): Promise<KetQuaGhi> {
  const r: KetQuaGhi = { daGhiMat: 0, daGhiMoc: 0, daXacNhan: 0, ghiKhongAn: false };
  /*
   * ĐỢT 3: khuôn mặt chỉ ghi vào KHO FILE (@/lib/face-kho-server) — album_faces
   * không nhận dòng mới nữa. Ghi kho TRƯỚC và bắt buộc: hỏng thì NÉM trước khi
   * đánh mốc "đã quét", kẻo ảnh mang mốc mà khuôn mặt không nằm ở đâu cả (lượt
   * sau sẽ không bao giờ quét lại nó). Một mảnh gồm cả ảnh 0 mặt — kho biết
   * ảnh nào đã quét mà không có ai.
   *
   * KHÔNG đưa album vào lại hàng đợi gom ở đây — xem `veHangDoiGomNeuCan`.
   */
  if (faceRows.length || doneIds.length) {
    if (!albumId) throw new Error("ghi_kho_thieu_album_id");
    r.daGhiMat = await ghiKetQuaVaoKho(db, albumId, faceRows, doneIds);
    faceRows.length = 0;
  }
  while (doneIds.length) {
    const part = doneIds.splice(0, WRITE_CHUNK);
    const { data: d2, error: e2 } = await db
      .from("photos")
      .update({ faces_scanned_at: new Date().toISOString() })
      .in("id", part)
      .select("id");
    if (e2) throw new Error(`ghi_moc_quet_that_bai: ${e2.message}`);
    r.daGhiMoc += (d2 ?? []).length;
    // Chạm 0 dòng trong khi vừa gửi một danh sách id có thật = câu ghi bị chặn
    // ở đâu đó. Nổ ra to còn hơn quét lại đúng những tấm đó tới vô tận.
    if ((d2 ?? []).length === 0) throw new Error(`ghi_moc_quet_cham_0_dong (gui ${part.length} id)`);

    /*
     * ĐỌC LẠI BẰNG MỘT CÂU RIÊNG — không tin RETURNING của chính câu vừa ghi.
     *
     * Đây là chỗ bản trước còn mù. RETURNING nói "đã ghi 37 dòng" nhưng nó chỉ
     * chứng minh câu UPDATE KHỚP 37 dòng — mà thậm chí con số ấy cũng có thể
     * là đồ cũ lấy từ cache. Log production ngày 06/09: tám lượt liên tiếp đều
     * báo daGhiMoc 37–47, database chỉ nhận đúng MỘT mẻ (51/343 ảnh), và mọi
     * lượt đọc sau vẫn thấy nguyên 343 ảnh chưa quét.
     *
     * Gốc rễ đã chữa ở @/lib/supabase/no-cache-fetch. Vòng kiểm này ở lại làm
     * lưới an toàn: một câu SELECT RIÊNG là cách duy nhất phân biệt "ghi thật"
     * với "được kể lại là đã ghi". Rẻ: đếm head, không kéo dòng nào về.
     */
    const { count: thuc } = await db
      .from("photos")
      .select("id", { count: "exact", head: true })
      .in("id", part)
      .not("faces_scanned_at", "is", null);
    r.daXacNhan += thuc ?? 0;
    if ((thuc ?? 0) === 0) {
      // Không nổ ra: nổ thì cả lượt cron đỏ và MỌI album khác cũng đứng theo.
      // Ghi nhận rồi bỏ album này, để phần thời gian còn lại phục vụ album khác.
      r.ghiKhongAn = true;
      doneIds.length = 0;
      return r;
    }
  }
  return r;
}

/**
 * ĐƯA ALBUM VÀO LẠI HÀNG ĐỢI GOM — tối đa một lần cho mỗi lượt quét hết album.
 *
 * Người gọi chỉ gọi khi lượt này CÓ ghi khuôn mặt mới. Đưa vào hàng đợi khi:
 *   • đã đi hết danh sách (`xong`) → album quét xong, gom một lần là đủ; hoặc
 *   • lần gom trước đã cũ hơn 12 giờ → album khổng lồ quét nhiều đêm vẫn
 *     cho khách thấy dần, nhưng không gom lại sau mỗi lượt cron.
 * Bản trước đặt lại sau MỖI mẻ ghi: album 1.449 ảnh quét ~35 tấm/lượt bị gom
 * lại ~40 lần, mỗi lần đọc toàn bộ vector khuôn mặt của album từ Supabase.
 */
export async function veHangDoiGomNeuCan(db: any, albumId: string, xong: boolean): Promise<boolean> {
  let veHangDoiGom = xong;
  if (!veHangDoiGom) {
    const { data: al } = await db.from("albums").select("faces_clustered_at").eq("id", albumId).maybeSingle();
    const luc = al?.faces_clustered_at ? Date.parse(al.faces_clustered_at as string) : NaN;
    veHangDoiGom = Number.isFinite(luc) && Date.now() - luc > GOM_LAI_SAU_MS;
  }
  if (veHangDoiGom) {
    const { error: e3 } = await db.from("albums").update({ faces_clustered_at: null }).eq("id", albumId);
    if (e3) throw new Error(`dat_lai_hang_doi_gom_that_bai: ${e3.message}`);
  }
  return veHangDoiGom;
}
