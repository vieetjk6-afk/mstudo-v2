/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * "ẢNH NÀO CÒN PHẢI QUÉT KHUÔN MẶT" — MỘT định nghĩa duy nhất.
 *
 * Câu hỏi này được hỏi ở BA phía, và cả ba phải trả lời giống nhau:
 *
 *   1. HÀNG ĐỢI của bộ quét — `albumsNeedingScan` đếm bằng PostgREST.
 *   2. VÒNG QUÉT — `scanAlbum` lọc trên mảng ảnh đã lấy về.
 *   3. TIẾN ĐỘ cho khách — `tienDoQuet` đếm bằng PostgREST để in "210/700".
 *
 * Ba phía đó KHÔNG đồng ý với nhau, và cái giá là một vòng lặp vô hạn im lặng.
 * Hàng đợi đếm `faces_scanned_at is null AND is_video = false`; vòng quét đòi
 * thêm `drive_file_id` không rỗng. Một dòng ảnh có `drive_file_id = ''` — cột
 * khai `not null` nhưng chuỗi rỗng thì lọt qua — rơi đúng vào khe đó:
 *
 *   • hàng đợi ĐẾM nó → album luôn "còn việc"
 *   • vòng quét BỎ nó → `todo` rỗng, `scanned` bằng 0, không mốc nào được ghi
 *   • nên album quay lại hàng đợi ở MỌI lượt cron, chiếm một trong ba chỗ
 *     (MAX_ALBUMS = 3), mãi mãi, không lỗi, không cảnh báo
 *   • và tiến độ của khách đứng ở 209/210 vĩnh viễn, kèm câu "đang tìm khuôn
 *     mặt" không bao giờ hết
 *
 * Đúng cái bẫy chết đói mà `stoppedBy: "ghi-khong-an"` đã chữa cho một biến thể
 * khác — hai đường khác nhau vào cùng một chỗ.
 *
 * VÌ SAO LÀ FILE RIÊNG, không nằm trong @/lib/face-scan-server: file đó kéo theo
 * TensorFlow. Mà phía thứ 3 là @/lib/face-pending, thứ MỌI trang album của khách
 * đều gọi. Định nghĩa dùng chung phải nhẹ hơn cả hai phía dùng nó.
 */

export type ScanRow = {
  id: string;
  drive_file_id: string;
  name: string | null;
  is_video: boolean | null;
  faces_scanned_at: string | null;
};

/** Lọc trên mảng đã lấy về. */
export function pendingRows(rows: readonly ScanRow[]): ScanRow[] {
  return rows.filter((p) => !p.is_video && !p.faces_scanned_at && !!p.drive_file_id);
}

/** Cùng bộ điều kiện, viết bằng ngôn ngữ PostgREST. */
export function apDungLocConQuet(q: any): any {
  return q.is("faces_scanned_at", null).eq("is_video", false).neq("drive_file_id", "");
}

/**
 * Ảnh CẦN quét của album — mẫu số của tiến độ.
 *
 * Bằng "còn phải quét" cộng "đã quét", nên nó phải loại đúng những dòng mà
 * `pendingRows` loại, nếu không mẫu số chứa những tấm không bao giờ tới được tử
 * số. Video bị loại vì bộ quét bỏ qua chúng; `drive_file_id` rỗng bị loại vì
 * không có gì để tải về mà quét.
 */
export function apDungLocCanQuet(q: any): any {
  return q.eq("is_video", false).neq("drive_file_id", "");
}
