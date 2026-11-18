/* eslint-disable @typescript-eslint/no-explicit-any */

import { randomUUID } from "node:crypto";
import type { KnownPerson } from "./face-group";
import { tinhNguoi, type FaceRow, type NguoiGom } from "./face-gom-tinh";

/*
 * GOM NHÓM là phép tính vector thuần — KHÔNG cần TensorFlow. Nằm riêng (không ở
 * @/lib/face-scan-server, file kéo theo face-node) để route của máy studio gom
 * được mà gói của nó không dính một byte mô hình nào.
 */

/**
 * Gom toàn bộ khuôn mặt đã quét của album thành từng NGƯỜI.
 *
 * Dựng lại từ đầu chứ không vá từng dòng: lượt gom là sự thật mới nhất, và xoá
 * theo album thì các dòng nối tự đi theo (on delete cascade). Tên studio đã đặt
 * được giữ lại bằng cách ghép cụm mới với người cũ theo tâm cụm.
 */
export async function clusterAlbum(db: any, albumId: string): Promise<number> {
  // Đọc THEO TRANG: PostgREST lặng lẽ cắt ở 1000 dòng, nên album đông người
  // (đám cưới 1.500 ảnh dễ có vài nghìn khuôn mặt) trước đây chỉ được gom từ
  // 1000 mặt đầu — người xuất hiện ở cuối album biến mất khỏi hàng chip, và vì
  // lượt gom XOÁ rồi dựng lại người, họ mất luôn tên studio đã đặt. Trang nào
  // lỗi thì NÉM chứ không gom trên phần đọc dở (sẽ xoá nhầm người).
  const list: FaceRow[] = [];
  const trang = (from: number) =>
    db
      .from("album_faces")
      .select("photo_id, at, box, descriptor, sharpness")
      .eq("album_id", albumId)
      .order("photo_id")
      .order("at")
      .range(from, from + 999);
  // Đọc 4 trang MỘT LÚC: album lớn có vài chục trang, đọc lần lượt thì riêng
  // khâu này đã ăn gần hết thời gian của máy chủ. Vẫn đọc tới khi gặp trang thiếu
  // (không tin số đếm trước — ảnh có thể được quét thêm giữa chừng).
  for (let from = 0, het = false; !het; from += 4000) {
    const lo = await Promise.all([0, 1, 2, 3].map((k) => trang(from + k * 1000)));
    for (const { data: page, error } of lo) {
      if (error) throw new Error(`doc_album_faces_that_bai: ${error.message}`);
      const rows = (page ?? []) as FaceRow[];
      if (het) continue;
      list.push(...rows);
      if (rows.length < 1000) het = true;
    }
  }

  if (!list.some((f) => Array.isArray(f.descriptor) && f.descriptor.length === 128)) {
    /*
     * Không có khuôn mặt nào (album toàn ảnh phong cảnh, hoặc chưa quét tấm nào):
     * vẫn phải RA KHỎI HÀNG ĐỢI, nếu không lượt cron nào cũng gom lại album này.
     * KIỂM LỖI, đừng nuốt — một câu cập nhật hỏng lặng lẽ là một vòng lặp vô hạn.
     */
    const { data: d, error: e } = await db
      .from("albums")
      .update({ faces_clustered_at: new Date().toISOString() })
      .eq("id", albumId)
      .select("id");
    if (e) throw new Error(`danh_dau_album_rong_that_bai: ${e.message}`);
    if ((d ?? []).length === 0) throw new Error(`danh_dau_album_rong_cham_0_dong: ${albumId}`);
    return 0;
  }

  // Đúng ba cột matchKnown cần — không `*` (cover_box, face_count… đọc về là thừa).
  const { data: old } = await db.from("album_people").select("id, name, descriptor").eq("album_id", albumId);
  const known: KnownPerson[] = ((old ?? []) as any[]).map((k) => ({
    id: k.id,
    name: k.name ?? "",
    descriptor: (k.descriptor as number[] | null) ?? [],
  }));
  const nguoi = tinhNguoi(list, known);
  await ghiNguoi(db, albumId, nguoi);
  return nguoi.length;
}

/**
 * GHI kết quả gom: xoá người cũ của album (dòng nối tự đi theo, on delete
 * cascade), chèn người mới + dòng nối theo lô, rồi đặt mốc đã gom. Dùng chung
 * cho gom trên máy chủ và gom trên máy studio (route face-local {luuGom}).
 *
 * GHI THEO LÔ, id sinh sẵn ở đây: biết trước người nào mang id nào nên cả người
 * lẫn dòng nối ghi được theo lô, không phải đọc lại. Dòng nối trỏ tới
 * album_people bằng khoá ngoại: lô người không nằm lại thì lô nối nổ ra ngay.
 */
export async function ghiNguoi(db: any, albumId: string, nguoi: readonly NguoiGom[]): Promise<void> {
  const { error: eDel } = await db.from("album_people").delete().eq("album_id", albumId);
  if (eDel) throw new Error(`xoa_nguoi_cu_that_bai: ${eDel.message}`);
  const dong = nguoi.map((p) => ({
    id: randomUUID(),
    album_id: albumId,
    name: p.name,
    face_count: p.face_count,
    cover_photo_id: p.cover_photo_id,
    cover_at: p.cover_at,
    cover_box: p.cover_box,
    descriptor: p.descriptor,
    position: p.position,
  }));
  // 100 người một lô: mỗi dòng mang vector 128 số (~2,5 KB JSON), giữ thân yêu cầu vừa phải.
  for (let k = 0; k < dong.length; k += 100) {
    const { error: eIns } = await db.from("album_people").insert(dong.slice(k, k + 100));
    if (eIns) throw new Error(`them_nguoi_that_bai: ${eIns.message}`);
  }
  const noi = nguoi.flatMap((p, i) => p.anh.map((photo_id) => ({ album_id: albumId, person_id: dong[i].id, photo_id })));
  for (let k = 0; k < noi.length; k += 500) {
    const { error: e2 } = await db.from("album_photo_people").insert(noi.slice(k, k + 500));
    if (e2) throw new Error(`noi_anh_voi_nguoi_that_bai: ${e2.message}`);
  }
  // Ra khỏi hàng đợi. Đặt SAU vòng ghi: hỏng giữa chừng thì album ở lại hàng đợi
  // và lượt sau dựng lại từ đầu, chứ không mắc kẹt với nửa danh sách người.
  const { error: eMark } = await db
    .from("albums")
    .update({ faces_clustered_at: new Date().toISOString() })
    .eq("id", albumId);
  if (eMark) throw new Error(`danh_dau_da_gom_that_bai: ${eMark.message}`);
}

