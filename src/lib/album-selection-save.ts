/**
 * Ghi lựa chọn ảnh của khách (POST /api/a/[slug]/select) theo PHẦN CHÊNH.
 *
 * Trang khách gửi lại toàn bộ danh sách mỗi ~250 ms khi khách bấm. Bản cũ xoá
 * sạch rồi chèn lại hết: O(n²) lượt ghi cả buổi, ~2n sự kiện Realtime mỗi lần
 * lưu, và chèn hỏng sau khi đã xoá là mất lựa chọn của khách.
 *
 * Đường chính là hàm SQL save_album_selection (migrations/luu_chon_anh_tung_phan.sql)
 * — một transaction, mảng đi trong thân POST. Các hàm thuần dưới đây phục vụ
 * đường LÙI (database chưa chạy migration): tính phần chênh và chia nhỏ `.in()`
 * để URL PostgREST không phình tới mức gãy.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Chỉ giữ chuỗi đúng dạng UUID, bỏ trùng. Id lạ làm Postgres báo 22P02 cả lượt. */
export function onlyUuids(ids: unknown[]): string[] {
  const out = new Set<string>();
  for (const id of ids) if (typeof id === "string" && UUID_RE.test(id)) out.add(id.toLowerCase());
  return [...out];
}

/** Cắt mảng thành từng khúc — mỗi khúc một `.in()` ngắn (~200 UUID ≈ 7 KB URL). */
export function chunk<T>(list: T[], size = 200): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

export type SavedRow = { photo_id: string; photo_name: string; client_name?: string | null; client_note: string | null };

/**
 * So danh sách đang lưu với danh sách khách muốn:
 *  - upsert: dòng mới, hoặc dòng có tên ảnh / tên khách / ghi chú đổi;
 *  - remove: photo_id khách đã bỏ.
 * Dòng giữ nguyên thì không đụng tới → không có lượt ghi, không có sự kiện Realtime.
 */
export function diffRows<R extends SavedRow>(existing: SavedRow[], want: R[]): { upsert: R[]; remove: string[] } {
  const had = new Map(existing.map((r) => [r.photo_id, r]));
  const keep = new Set(want.map((r) => r.photo_id));
  const upsert = want.filter((r) => {
    const old = had.get(r.photo_id);
    return (
      !old ||
      old.photo_name !== r.photo_name ||
      (old.client_note ?? null) !== (r.client_note ?? null) ||
      ("client_name" in r && (old.client_name ?? null) !== (r.client_name ?? null))
    );
  });
  const remove = existing.map((r) => r.photo_id).filter((id) => !keep.has(id));
  return { upsert, remove };
}
