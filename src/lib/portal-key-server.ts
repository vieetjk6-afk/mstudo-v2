import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { keyDigits, portalKeyMatches } from "@/lib/portal-key";

/**
 * Kiểm tra mã khách gõ với một hợp đồng đã đọc (cần `id`, `client_phone`).
 *
 * Khớp SĐT thì xong ngay — đường quen thuộc không tốn thêm câu đọc nào. Chỉ khi
 * KHÔNG khớp mới đọc cột `client_passcode` riêng: database chưa chạy migration
 * ma_so_mo_hop_dong.sql thì câu này lỗi và ta coi như chưa đặt mã — không bao
 * giờ làm hỏng câu đọc hợp đồng chính.
 */
export async function checkPortalKey(
  db: SupabaseClient,
  contract: { id: string; client_phone: string | null },
  input: string | null | undefined
): Promise<boolean> {
  if (!keyDigits(input)) return false;
  if (portalKeyMatches(input, contract.client_phone)) return true;
  const { data, error } = await db
    .from("studio_contracts")
    .select("client_passcode")
    .eq("id", contract.id)
    .maybeSingle();
  if (error || !data) return false;
  return portalKeyMatches(input, contract.client_phone, (data as { client_passcode?: string | null }).client_passcode);
}
