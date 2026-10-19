import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeQuota, type PrintState } from "./album-print-rules";

export type { PrintState };

/* Ảnh in tặng — phần đọc DB. Logic thuần ở album-print-rules.ts. */

/**
 * Số ảnh in tặng của album = print_quota của hợp đồng dùng album này (làm album
 * chọn ảnh rồi chuyển sang giao, hoặc album giao riêng). Album lẻ không thuộc
 * hợp đồng nào, hay DB chưa chạy migrations/anh_in_tang.sql → 0.
 */
export async function loadPrintQuota(db: SupabaseClient, albumId: string): Promise<number> {
  const { data, error } = await db
    .from("studio_contracts")
    .select("print_quota")
    .or(`selection_album_id.eq.${albumId},gallery_album_id.eq.${albumId}`)
    .limit(5);
  if (error || !data) return 0;
  return Math.max(0, ...data.map((r) => normalizeQuota((r as { print_quota?: unknown }).print_quota)));
}

/** Toàn bộ trạng thái ảnh in của album, hoặc null khi hợp đồng không tặng in. */
export async function loadPrintState(db: SupabaseClient, albumId: string): Promise<PrintState | null> {
  const quota = await loadPrintQuota(db, albumId);
  if (!quota) return null;
  const [{ data: picks }, { data: album }] = await Promise.all([
    db.from("print_picks").select("photo_id").eq("album_id", albumId),
    db.from("albums").select("print_sent_at, print_copied_at").eq("id", albumId).maybeSingle(),
  ]);
  return {
    quota,
    picks: (picks ?? []).map((p) => p.photo_id as string),
    sentAt: (album?.print_sent_at as string | null | undefined) ?? null,
    copiedAt: (album?.print_copied_at as string | null | undefined) ?? null,
  };
}
