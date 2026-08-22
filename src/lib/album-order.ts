/**
 * Thứ tự Thư viện album — theo VIỆC CẦN LÀM, không theo ngày sửa.
 *
 * Server trả album mới sửa trước (order by updated_at desc). Đó là thứ tự của
 * máy, không phải của người: album khách vừa chốt xong nằm lẫn giữa đống album
 * cũ, còn album vừa tạo mà chưa nạp ảnh lại chiếm ngay hàng đầu — trong khi nó
 * là thứ DUY NHẤT chưa cần đụng tới.
 *
 * Để riêng ra khỏi component (và KHÔNG import gì) để desktop/test/album-order.mjs
 * nạp thẳng file này mà không kéo theo React — cùng lý do với contract-filter.ts.
 */

/** Chỉ những cột luật xếp thực sự đọc — nhận cả AlbumRow đầy đủ. */
export type OrderableAlbum = {
  /** Lần gần nhất khách bấm "Đã chọn xong". null/undefined = chưa chốt. */
  selection_done_at?: string | null;
  photoCount: number;
};

/**
 * Ba bậc ưu tiên:
 *   0  Khách đã chọn xong  → tới lượt studio lọc ảnh. Việc gấp nhất.
 *   1  Đang chạy bình thường.
 *   2  Chưa có ảnh nào     → chưa làm gì được, xuống đáy.
 *
 * Album RỖNG luôn ở bậc 2 kể cả khi mang mốc đã chốt: một album không ảnh mà
 * ghi "khách chọn xong" là dữ liệu cũ còn sót (ảnh đã bị gỡ khỏi Drive), không
 * phải việc phải làm — đẩy nó lên đầu thì mỗi ngày studio lại phải bỏ qua nó.
 */
export function albumRank(a: OrderableAlbum): number {
  if ((a.photoCount ?? 0) === 0) return 2;
  return a.selection_done_at ? 0 : 1;
}

/**
 * Sắp lại theo bậc, GIỮ NGUYÊN thứ tự server bên trong mỗi bậc (Array.prototype
 * .sort ổn định theo chuẩn ES2019, nên không cần khoá phụ). Không sửa mảng gốc.
 *
 * Trong bậc "đã chốt", album chốt GẦN ĐÂY nhất lên trước — studio xử lý theo
 * thứ tự khách chốt, không phải theo thứ tự mình vô tình mở ra sửa.
 */
export function sortAlbums<T extends OrderableAlbum>(rows: readonly T[]): T[] {
  return [...rows].sort((x, y) => {
    const d = albumRank(x) - albumRank(y);
    if (d !== 0) return d;
    if (albumRank(x) === 0) return (y.selection_done_at || "").localeCompare(x.selection_done_at || "");
    return 0;
  });
}

/** Số album đang chờ studio lọc ảnh — dùng cho băng nhắc việc ở đầu thư viện. */
export function pendingSelectionCount(rows: readonly OrderableAlbum[]): number {
  return rows.filter((a) => albumRank(a) === 0).length;
}
