import type { SupabaseClient } from "@supabase/supabase-js";
import { todayVN } from "@/lib/date";

/**
 * Lấy số thứ tự bằng bộ đếm NGUYÊN TỬ trong database (migrations/ma_so_khong_trung.sql):
 * hai lượt tạo cùng lúc nhận hai số khác nhau, xoá hợp đồng không làm lùi số.
 * Database chưa chạy migration thì trả null để nơi gọi đếm như cũ.
 */
async function nextSeq(supabase: SupabaseClient, ownerId: string, prefix: string, kind: "contract" | "quote"): Promise<number | null> {
  const { data, error } = await supabase.rpc("next_studio_code", { p_owner: ownerId, p_prefix: prefix, p_kind: kind });
  const n = Number(data);
  return error || !Number.isFinite(n) || n < 1 ? null : n;
}

/**
 * Next contract code for a studio: HD-{MM}-{YYYY}-{NNN}, sequence per month.
 * e.g. the 1st contract in June 2026 → "HD-06-2026-001".
 */
export async function nextContractCode(supabase: SupabaseClient, ownerId: string): Promise<string> {
  // Tháng theo giờ VN — máy chủ chạy UTC, đơn tạo lúc 0h–7h sáng ngày 1 sẽ bị
  // đánh số vào tháng trước nếu lấy getMonth() giờ máy.
  const [yyyy, mm] = todayVN().split("-");
  const prefix = `HD-${mm}-${yyyy}-`;
  const seq = await nextSeq(supabase, ownerId, prefix, "contract");
  if (seq !== null) return `${prefix}${String(seq).padStart(3, "0")}`;
  // Đếm qua RPC (security definer) chứ không qua RLS: nhân viên / quản lý chi
  // nhánh chỉ THẤY một phần hợp đồng, đếm phần đó là cấp trùng mã. Database chưa
  // chạy migrations/phan_quyen_vai_tro_hop_dong.sql thì chưa có hàm → đếm như cũ
  // (lúc đó RLS vẫn cho mọi thành viên thấy cả studio nên kết quả vẫn đúng).
  const rpc = await supabase.rpc("contract_code_count", { p_owner: ownerId, p_prefix: prefix });
  let count = rpc.error ? null : Number(rpc.data);
  if (count === null || !Number.isFinite(count)) {
    ({ count } = await supabase
      .from("studio_contracts")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", ownerId)
      .like("code", `${prefix}%`));
  }
  return `${prefix}${String((count || 0) + 1).padStart(3, "0")}`;
}

/**
 * Next quote code for a studio: BG-{MM}-{YYYY}-{NNN}, sequence per month.
 * e.g. the 1st quote in June 2026 → "BG-06-2026-001".
 */
export async function nextQuoteCode(supabase: SupabaseClient, ownerId: string): Promise<string> {
  // Tháng theo giờ VN — máy chủ chạy UTC, đơn tạo lúc 0h–7h sáng ngày 1 sẽ bị
  // đánh số vào tháng trước nếu lấy getMonth() giờ máy.
  const [yyyy, mm] = todayVN().split("-");
  const prefix = `BG-${mm}-${yyyy}-`;
  const seq = await nextSeq(supabase, ownerId, prefix, "quote");
  if (seq !== null) return `${prefix}${String(seq).padStart(3, "0")}`;
  const { count } = await supabase
    .from("studio_quotes")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId)
    .like("code", `${prefix}%`);
  return `${prefix}${String((count || 0) + 1).padStart(3, "0")}`;
}

/** Generate a URL-safe random token for /q/[token] and /c/[token] sharing. */
export function newShareToken(): string {
  const base =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return base.replace(/-/g, "");
}
