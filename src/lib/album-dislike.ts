/**
 * Quy tắc dùng chung cho tính năng "ảnh khách không thích" trong album chọn ảnh.
 *
 * Hai chỗ dùng chung một luật, nên tách ra khỏi component/route để khỏi lệch:
 *  - CustomerAlbum (client): lọc ảnh hiển thị theo chế độ xem.
 *  - POST /api/a/[slug]/select (server): chốt lại tính loại trừ trước khi ghi DB.
 */

/** Ba chế độ xem của album khách: lưới thường · chỉ ảnh đã chọn · ảnh không thích. */
export type AlbumView = "all" | "selected" | "disliked";

/**
 * Ảnh đã chọn và ảnh không thích LOẠI TRỪ nhau. Client đã đảm bảo khi bấm, đây
 * là lưới an toàn phía server: một ảnh vừa nằm trong "chọn" vừa nằm trong "không
 * thích" thì bỏ khỏi danh sách chọn (ý muốn mới nhất của khách là loại ảnh đó).
 */
export function excludeDisliked(photoIds: string[], dislikedIds: string[]): string[] {
  if (dislikedIds.length === 0) return photoIds;
  const disliked = new Set(dislikedIds);
  return photoIds.filter((id) => !disliked.has(id));
}

/**
 * Ảnh được hiển thị theo chế độ xem hiện tại:
 *  - shareMode (khách mở link chia sẻ): đúng danh sách được chia sẻ, không lọc gì thêm.
 *  - "disliked": ĐÚNG những ảnh bị loại (tab riêng).
 *  - "selected": ảnh đã chọn, đã trừ ảnh bị loại.
 *  - "all": mọi ảnh TRỪ ảnh bị loại — đây là chỗ ảnh "không thích" biến khỏi lưới.
 */
export function filterByView<T extends { id: string }>(
  photos: T[],
  opts: {
    view: AlbumView;
    selected: ReadonlySet<string>;
    disliked: ReadonlySet<string>;
    shareSet?: ReadonlySet<string> | null;
  }
): T[] {
  const { view, selected, disliked, shareSet } = opts;
  if (shareSet) return photos.filter((p) => shareSet.has(p.id));
  if (view === "disliked") return photos.filter((p) => disliked.has(p.id));
  const kept = photos.filter((p) => !disliked.has(p.id));
  return view === "selected" ? kept.filter((p) => selected.has(p.id)) : kept;
}
