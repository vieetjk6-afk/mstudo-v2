/* eslint-disable @typescript-eslint/no-explicit-any */

import { effectivePlan, planAllowsFaceSearch, type Plan } from "./plans";
import { apDungLocCanQuet, apDungLocConQuet } from "./face-can-quet";

/**
 * "Album này quét khuôn mặt tới đâu rồi?"
 *
 * Một câu hỏi bé nhưng đáng có file riêng, vì hai lý do:
 *
 *  • Nó được hỏi ở BỐN chỗ (trang album chọn ảnh, trang album giao khách, và hai
 *    route mở khoá bằng mật khẩu tương ứng). Chép bốn bản là chép cả bốn bản
 *    cách xử lý lỗi.
 *  • Nó phải HỎNG ÊM. Cột `faces_scanned_at` là cột thêm sau; database chưa chạy
 *    supabase/khuon-mat.sql thì câu này lỗi — và lúc đó câu trả lời đúng là
 *    "không có gì đang chuẩn bị" chứ không phải làm sập trang album của khách.
 *
 * Cố ý KHÔNG nằm trong @/lib/face-scan-server: file đó kéo theo TensorFlow, mà
 * đây là thứ mọi trang album đều gọi.
 */

/**
 * Tiến độ quét của một album.
 *
 * VÌ SAO TRẢ VỀ SỐ, KHÔNG PHẢI true/false — và đây là bài học trả giá thật.
 *
 * Bản trước chỉ trả `boolean`, nên câu duy nhất nói được với khách là "đang
 * chuẩn bị, vài phút nữa quay lại nhé". Với album 400–1.000 ảnh thì "vài phút"
 * là NÓI SAI: công suất thật khoảng 300 ảnh mỗi lượt cron, tức là hàng giờ.
 * Khách (và chính studio) quay lại sau năm phút, vẫn thấy đúng câu đó, và kết
 * luận tính năng bị hỏng — trong khi bộ quét đang chạy đúng.
 *
 * Có `daQuet/tong` thì câu chữ đổi từ một lời hẹn không giữ được thành một con
 * số kiểm chứng được: "đã quét 210/700 ảnh". Người đọc tự thấy nó đang tiến.
 */
export type TienDoQuet = {
  /** Số ảnh (không tính video) đã có mốc quét. */
  daQuet: number;
  /** Tổng ảnh cần quét của album. */
  tong: number;
};

const KHONG_BIET: TienDoQuet = { daQuet: 0, tong: 0 };

export async function tienDoQuet(db: any, albumId: string): Promise<TienDoQuet> {
  try {
    // head: true → PostgREST chỉ trả header Content-Range, không trả dòng nào.
    // Album 1.000 ảnh vẫn là một con số trên đường truyền.
    const dem = () =>
      db.from("photos").select("id", { count: "exact", head: true }).eq("album_id", albumId);

    /*
     * Mẫu số và tử số đi qua @/lib/face-can-quet, không tự viết điều kiện.
     *
     * Tự viết là cách tiến độ đứng mãi ở 209/210: mẫu số đếm cả những tấm mà bộ
     * quét KHÔNG BAO GIỜ chạm tới (video, hay `drive_file_id` rỗng), nên hiệu số
     * không bao giờ về 0 và câu "đang tìm khuôn mặt" không bao giờ tắt. Một con
     * số đứng yên còn tệ hơn câu "vài phút nữa" mà nó vừa thay thế.
     */
    const [can, con] = await Promise.all([apDungLocCanQuet(dem()), apDungLocConQuet(dem())]);
    if (can.error || con.error) return KHONG_BIET;
    const tong = can.count ?? 0;
    return { daQuet: Math.max(0, tong - (con.count ?? 0)), tong };
  } catch {
    return KHONG_BIET;
  }
}

/** Còn ảnh chưa quét không — tức là có nên nói "đang chuẩn bị" hay không. */
export function conDangQuet(t: TienDoQuet): boolean {
  return t.tong > t.daQuet;
}

/**
 * Chủ album này có gói mở tính năng tìm ảnh theo khuôn mặt không?
 *
 * Câu hỏi phải trả lời được từ ID chủ album vì cổng gói không đứng một chỗ: bộ
 * quét (cron), nút quét tay của studio, công cụ chẩn đoán, và ba đường phía khách
 * đều phải hỏi cùng một câu. Chỉ chặn bộ quét là không đủ — album của một gói vừa
 * hạ hoặc vừa hết hạn còn nguyên khuôn mặt gom từ trước trong DB, nên ô tìm mặt
 * vẫn hiện và vẫn bấm ra kết quả.
 *
 * Trả về false khi không đọc được dòng profiles: fail-closed đúng ở đây, vì hỏng
 * theo hướng "tạm không có tính năng" nhẹ hơn hẳn hướng "phát không gói Studio".
 *
 * Những chỗ đã nạp dòng profiles cho việc khác (quyền tải, watermark) thì gọi
 * planAllowsFaceSearch trực tiếp thay vì hàm này — thêm một lượt đi Supabase chỉ
 * để hỏi lại đúng dòng vừa đọc là trả giá vô ích trên mọi lượt xem album.
 */
export async function chuAlbumDuocTimMat(db: any, ownerId: string | null | undefined): Promise<boolean> {
  if (!ownerId) return false;
  const { data, error } = await db
    .from("profiles")
    .select("plan, plan_expires_at, role")
    .eq("id", ownerId)
    .maybeSingle();
  if (error || !data) return false;
  const row = data as { plan?: Plan | null; plan_expires_at?: string | null; role?: string | null };
  return planAllowsFaceSearch(effectivePlan(row.plan, row.plan_expires_at), row.role === "admin");
}
