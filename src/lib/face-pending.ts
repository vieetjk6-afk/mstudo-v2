/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * "Album này còn ảnh CHƯA được quét khuôn mặt không?"
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
export async function dangQuet(db: any, albumId: string): Promise<boolean> {
  try {
    const { count, error } = await db
      .from("photos")
      .select("id", { count: "exact", head: true })
      .eq("album_id", albumId)
      .is("faces_scanned_at", null)
      .eq("is_video", false);
    if (error) return false;
    return (count ?? 0) > 0;
  } catch {
    return false;
  }
}
