import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeQuota, printPhoneKeys, type PrintState } from "./album-print-rules";

export type { PrintState };

/* Ảnh in tặng — phần đọc DB. Logic thuần ở album-print-rules.ts. */

/**
 * Số ảnh in tặng của album — số LỚN HƠN của hai nơi:
 *   • print_quota của hợp đồng dùng album này (album chọn ảnh rồi chuyển sang
 *     giao, hoặc album giao riêng) — studio nhập ở tab Sản phẩm của hợp đồng;
 *   • albums.print_quota — album lẻ không thuộc hợp đồng nào, studio nhập ngay
 *     trong album (tab Giao khách).
 * Hai truy vấn riêng: DB chưa chạy migration của nơi nào thì nơi đó tính 0,
 * nơi còn lại vẫn chạy.
 */
export async function loadPrintQuota(db: SupabaseClient, albumId: string): Promise<number> {
  const [contracts, album] = await Promise.all([
    db
      .from("studio_contracts")
      .select("print_quota")
      .or(`selection_album_id.eq.${albumId},gallery_album_id.eq.${albumId}`)
      .limit(5),
    db.from("albums").select("print_quota").eq("id", albumId).maybeSingle(),
  ]);
  const fromContracts = contracts.error ? [] : (contracts.data ?? []).map((r) => normalizeQuota((r as { print_quota?: unknown }).print_quota));
  const fromAlbum = album.error ? 0 : normalizeQuota((album.data as { print_quota?: unknown } | null)?.print_quota);
  return Math.max(0, fromAlbum, ...fromContracts);
}

/**
 * SĐT được phép chọn ảnh in (đã chuẩn hoá — xem printPhoneKeys): SĐT khách,
 * cô dâu, chú rể của các hợp đồng dùng album này. Rỗng = không có số nào để
 * đối chiếu (album lẻ, hợp đồng chưa ghi SĐT) → ai mở được album cũng chọn được
 * như trước. DB chưa chạy migration SĐT cô dâu / chú rể thì chỉ lấy SĐT khách.
 */
export async function loadPrintPhones(db: SupabaseClient, albumId: string): Promise<string[]> {
  const q = (cols: string) =>
    db
      .from("studio_contracts")
      .select(cols)
      .or(`selection_album_id.eq.${albumId},gallery_album_id.eq.${albumId}`)
      .limit(5);
  let res = await q("client_phone, bride_phone, groom_phone");
  if (res.error) res = await q("client_phone");
  if (res.error) return [];
  const rows = (res.data ?? []) as unknown as Record<string, unknown>[];
  return printPhoneKeys(rows.flatMap((r) => [r.client_phone, r.bride_phone, r.groom_phone]));
}

/** Toàn bộ trạng thái ảnh in của album, hoặc null khi album không được tặng in. */
export async function loadPrintState(db: SupabaseClient, albumId: string): Promise<PrintState | null> {
  const quota = await loadPrintQuota(db, albumId);
  if (!quota) return null;
  const [{ data: picks }, { data: album }, phones] = await Promise.all([
    db.from("print_picks").select("photo_id").eq("album_id", albumId),
    db.from("albums").select("print_sent_at, print_copied_at").eq("id", albumId).maybeSingle(),
    loadPrintPhones(db, albumId),
  ]);
  return {
    quota,
    picks: (picks ?? []).map((p) => p.photo_id as string),
    sentAt: (album?.print_sent_at as string | null | undefined) ?? null,
    copiedAt: (album?.print_copied_at as string | null | undefined) ?? null,
    coupleOnly: phones.length > 0,
  };
}
